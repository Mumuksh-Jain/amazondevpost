// Pass 11 security-focused local prototype, not a production security certification.
// This is NOT a full production app or an official MCP implementation.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';

export class DomainError extends Error {
  constructor(status, code, message) { super(message); this.status=status; this.code=code; }
}
const reject = (status,code,msg) => { throw new DomainError(status,code,msg); };
const json = (x) => JSON.stringify(x);
const iso = () => new Date().toISOString();
const digest = (x) => createHash('sha256').update(json(x)).digest('hex');
const row = (x) => x ? Object.fromEntries(Object.entries(x)) : null;

export class RelayDomain {
  constructor(file=':memory:') {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', assignee_id TEXT NOT NULL REFERENCES users(id),
        status TEXT NOT NULL, version INTEGER NOT NULL, preview_hash TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
        assignee_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, created_at TEXT NOT NULL,
        responded_at TEXT, expires_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_attempt ON attempts(case_id) WHERE status IN ('PENDING','ACCEPTED');
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
        requester_id TEXT NOT NULL, preview_hash TEXT NOT NULL, case_version INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, consumed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
        actor_id TEXT, kind TEXT NOT NULL, at TEXT NOT NULL, payload_json TEXT NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS no_update_events BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'append only'); END;
      CREATE TRIGGER IF NOT EXISTS no_delete_events BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'append only'); END;
      CREATE TABLE IF NOT EXISTS idempotency (
        actor_id TEXT NOT NULL, action TEXT NOT NULL, key TEXT NOT NULL,
        fingerprint TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY(actor_id,action,key)
      );
    `);
    this.db.prepare('INSERT OR IGNORE INTO users (id,name) VALUES (?,?)').run('priya','Priya');
    this.db.prepare('INSERT OR IGNORE INTO users (id,name) VALUES (?,?)').run('sam','Sam');
    this.db.prepare('INSERT OR IGNORE INTO users (id,name) VALUES (?,?)').run('alex','Alex');
  }
  close(){ this.db.close(); }
  tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const out=fn(); this.db.exec('COMMIT'); return out; }
    catch(e){this.db.exec('ROLLBACK');throw e;} }
  actor(id){if (!this.db.prepare('SELECT 1 FROM users WHERE id=?').get(id)) reject(401,'UNAUTHENTICATED','Invalid session identity'); return id; }
  event(cid, actor, kind, payload={}) {
    this.db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?)').run(randomUUID(),cid,actor,kind,iso(),json(payload));
  }
  caseRaw(cid){const c=row(this.db.prepare('SELECT * FROM cases WHERE id=?').get(cid)); if(!c) reject(404,'NOT_FOUND','Case not found'); return c;}
  visibleCase(actor,cid){
    this.actor(actor);const c=this.caseRaw(cid);
    const invited=this.db.prepare('SELECT 1 FROM attempts WHERE case_id=? AND assignee_id=?').get(cid,actor);
    if(c.requester_id!==actor && !invited) reject(404,'NOT_FOUND','Case not found');
    const out={...c};
    if(c.requester_id===actor && c.status==='AWAITING_REQUESTER_APPROVAL'){
      // Read-only marker: authoritative authorization remains approval lookup in sendApproved().
      // Never expose approval IDs, bearer credentials or a client-controlled approval switch.
      out.humanApprovalReady=Boolean(this.db.prepare(`SELECT 1 FROM approvals
        WHERE case_id=? AND requester_id=? AND case_version=? AND preview_hash=?
        AND consumed_at IS NULL AND expires_at>=? LIMIT 1`)
        .get(cid,actor,c.version,c.preview_hash,Date.now()));
    }
    if(c.requester_id!==actor){ delete out.preview_hash; delete out.details; }
    out.attempts=this.db.prepare('SELECT id,assignee_id,status,created_at,responded_at FROM attempts WHERE case_id=? ORDER BY created_at').all(cid).map(row).filter(a=>c.requester_id===actor || a.assignee_id===actor);
    return out;
  }
  owner(actor,cid,expected){const c=this.caseRaw(cid);
    if(c.requester_id!==actor) {
      const participated=this.db.prepare('SELECT 1 FROM attempts WHERE case_id=? AND assignee_id=?').get(cid,actor);
      reject(participated?403:404,participated?'FORBIDDEN':'NOT_FOUND',participated?'Only requester may perform this action':'Case not found');
    }
    if(!Number.isInteger(expected)||expected<1) reject(422,'BAD_VERSION','Positive integer version required');
    if(c.version!==expected) reject(409,'VERSION_CONFLICT','Refresh case before retry'); return c;
  }
  asAssignee(actor,cid,expected){const c=this.caseRaw(cid);
    const a=row(this.db.prepare("SELECT * FROM attempts WHERE case_id=? AND assignee_id=? AND status IN ('PENDING','ACCEPTED') ORDER BY created_at DESC LIMIT 1").get(cid,actor));
    if(!a){const participated=this.db.prepare('SELECT 1 FROM attempts WHERE case_id=? AND assignee_id=?').get(cid,actor);
      if(!participated)reject(404,'NOT_FOUND','Case not found');
      if(c.version!==expected)reject(409,'VERSION_CONFLICT','Refresh case before retry');
      reject(403,'FORBIDDEN','No active invitation for this actor');}
    if(!Number.isInteger(expected)||expected<1)reject(422,'BAD_VERSION','Positive integer version required');
    if(c.version!==expected) reject(409,'VERSION_CONFLICT','Refresh case before retry');
    return [c,a]; }
  idempotent(actor,action,key,input,fn){
    if(typeof key!=='string'||key.length<8||key.length>128) reject(422,'BAD_IDEMPOTENCY_KEY','Use 8–128 characters');
    const fp=digest(input);
    return this.tx(()=>{
      const old=this.db.prepare('SELECT fingerprint,response_json FROM idempotency WHERE actor_id=? AND action=? AND key=?').get(actor,action,key);
      if(old){if(old.fingerprint!==fp) reject(409,'IDEMPOTENCY_CONFLICT','Key reused for different request');return JSON.parse(old.response_json);}
      const out=fn(); this.db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?)').run(actor,action,key,fp,json(out)); return out;
    });
  }
  createDraft(actor,{title,details='',assigneeId='sam',idempotencyKey}) {
    this.actor(actor);
    if(typeof title!=='string'||title.trim().length<4||title.length>160||typeof details!=='string'||details.length>2000) reject(422,'VALIDATION','Invalid title/details');
    if(actor===assigneeId||!this.db.prepare('SELECT 1 FROM users WHERE id=?').get(assigneeId)) reject(422,'VALIDATION','Choose a different eligible person');
    return this.idempotent(actor,'createDraft',idempotencyKey,{title,details,assigneeId},()=>{
      const id=randomUUID();this.db.prepare('INSERT INTO cases VALUES (?,?,?,?,?,?,?,?,?)').run(id,actor,title.trim(),details,assigneeId,'DRAFT',1,null,iso());
      this.event(id,actor,'CASE_CREATED',{source:'human_authored',assigneeId});return this.visibleCase(actor,id);
    });
  }
  preview(actor,cid,expected){this.actor(actor);return this.tx(()=>{
    const c=this.owner(actor,cid,expected);if(c.status!=='DRAFT') reject(409,'BAD_STATE','Preview requires DRAFT');
    const hash=digest({title:c.title,details:c.details,assigneeId:c.assignee_id});
    this.db.prepare('UPDATE cases SET status=?,version=version+1,preview_hash=? WHERE id=?').run('AWAITING_REQUESTER_APPROVAL',hash,cid);
    this.event(cid,actor,'PREVIEW_CREATED',{hash});return this.visibleCase(actor,cid);
  });}
  approveInFirstPartyUi(actor,cid,expected){this.actor(actor);return this.tx(()=>{
    const c=this.owner(actor,cid,expected);
    if(c.status!=='AWAITING_REQUESTER_APPROVAL') reject(409,'BAD_STATE','No approved preview exists');
    const id=randomUUID();const ttl=Date.now()+120000;
    this.db.prepare('INSERT INTO approvals VALUES (?,?,?,?,?,?,NULL)').run(id,cid,actor,c.preview_hash,c.version,ttl);
    this.event(cid,actor,'HUMAN_APPROVED_PREVIEW',{approvalId:id,source:'first_party_ui'});
    return {approvalId:id,expiresAt:new Date(ttl).toISOString()};
  });}
  sendApproved(actor,cid,expected,idempotencyKey){this.actor(actor);
    return this.idempotent(actor,'sendApproved',idempotencyKey,{cid,expected},()=>{
      const c=this.owner(actor,cid,expected);
      if(c.status!=='AWAITING_REQUESTER_APPROVAL') reject(409,'BAD_STATE','Not awaiting approval');
      const ap=this.db.prepare('SELECT * FROM approvals WHERE case_id=? AND requester_id=? AND case_version=? AND preview_hash=? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1').get(cid,actor,expected,c.preview_hash);
      if(!ap||ap.expires_at<Date.now()) reject(403,'APPROVAL_REQUIRED','Fresh human UI approval is required');
      const attemptId=randomUUID();
      this.db.prepare('UPDATE approvals SET consumed_at=? WHERE id=?').run(iso(),ap.id);
      this.db.prepare('INSERT INTO attempts (id,case_id,assignee_id,status,created_at,responded_at,expires_at) VALUES (?,?,?,?,?,NULL,?)').run(attemptId,cid,c.assignee_id,'PENDING',iso(),Date.now()+24*60*60*1000);
      this.db.prepare('UPDATE cases SET status=?,version=version+1 WHERE id=?').run('AWAITING_ASSIGNEE_RESPONSE',cid);
      this.event(cid,actor,'INVITE_SENT',{attemptId,source:'first_party_ui_authorized'});return this.visibleCase(actor,cid);
    });
  }
  accept(actor,cid,expected,idempotencyKey){this.actor(actor);this.visibleCase(actor,cid);this.expirePending(cid);return this.idempotent(actor,'accept',idempotencyKey,{cid,expected},()=>{
    const [c,a]=this.asAssignee(actor,cid,expected);if(c.status!=='AWAITING_ASSIGNEE_RESPONSE'||a.status!=='PENDING') reject(409,'BAD_STATE','Not pending');
    this.db.prepare("UPDATE attempts SET status='ACCEPTED', responded_at=? WHERE id=?").run(iso(),a.id);
    this.db.prepare("UPDATE cases SET status='ACCEPTED',version=version+1 WHERE id=?").run(cid);
    this.event(cid,actor,'INVITE_ACCEPTED',{attemptId:a.id,source:'human_claim'});return this.visibleCase(actor,cid);
  });}
  decline(actor,cid,expected,idempotencyKey){this.actor(actor);this.visibleCase(actor,cid);this.expirePending(cid);return this.idempotent(actor,'decline',idempotencyKey,{cid,expected},()=>{
    const [c,a]=this.asAssignee(actor,cid,expected);if(c.status!=='AWAITING_ASSIGNEE_RESPONSE'||a.status!=='PENDING') reject(409,'BAD_STATE','Not pending');
    this.db.prepare("UPDATE attempts SET status='DECLINED', responded_at=? WHERE id=?").run(iso(),a.id);
    this.db.prepare("UPDATE cases SET status='NEEDS_REASSIGNMENT',version=version+1 WHERE id=?").run(cid);
    this.event(cid,actor,'INVITE_DECLINED',{attemptId:a.id,source:'human_claim'});return this.visibleCase(actor,cid);
  });}
  claimDone(actor,cid,expected,idempotencyKey){this.actor(actor);return this.idempotent(actor,'claimDone',idempotencyKey,{cid,expected},()=>{
    const [c,a]=this.asAssignee(actor,cid,expected);if(c.status!=='ACCEPTED'||a.status!=='ACCEPTED') reject(409,'BAD_STATE','Cannot claim completion');
    this.db.prepare("UPDATE attempts SET status='CLAIMED_DONE',responded_at=? WHERE id=?").run(iso(),a.id);
    this.db.prepare("UPDATE cases SET status='CLAIMED_DONE',version=version+1 WHERE id=?").run(cid);
    this.event(cid,actor,'COMPLETION_CLAIMED',{attemptId:a.id,source:'authenticated_assignee_claim',independentVerification:false});return this.visibleCase(actor,cid);
  });}
  acknowledge(actor,cid,expected,idempotencyKey){this.actor(actor);return this.idempotent(actor,'acknowledge',idempotencyKey,{cid,expected},()=>{
    const c=this.owner(actor,cid,expected);if(c.status!=='CLAIMED_DONE') reject(409,'BAD_STATE','No completion claim to acknowledge');
    this.db.prepare("UPDATE cases SET status='CLOSED_ACKNOWLEDGED',version=version+1 WHERE id=?").run(cid);
    this.event(cid,actor,'CLAIM_ACKNOWLEDGED',{source:'requester_acknowledgement',independentVerification:false});return this.visibleCase(actor,cid);
  });}
  history(actor,cid){this.visibleCase(actor,cid);const owner=this.caseRaw(cid).requester_id===actor;
    return this.db.prepare('SELECT id,actor_id,kind,at,payload_json FROM events WHERE case_id=? ORDER BY rowid').all(cid).map(x=>({id:x.id,actor_id:x.actor_id,kind:x.kind,at:x.at,payload:owner?JSON.parse(x.payload_json):{redacted:true}}));
  }
  reassign(actor,cid,expected,newAssignee){this.actor(actor);return this.tx(()=>{
    const c=this.owner(actor,cid,expected);if(c.status!=='NEEDS_REASSIGNMENT') reject(409,'BAD_STATE','No reassignment needed');
    if(newAssignee===actor||!this.db.prepare('SELECT 1 FROM users WHERE id=?').get(newAssignee)) reject(422,'VALIDATION','Choose another eligible member');
    this.db.prepare('UPDATE cases SET assignee_id=?,status=?,version=version+1,preview_hash=NULL WHERE id=?').run(newAssignee,'DRAFT',cid);
    this.event(cid,actor,'REASSIGNMENT_PROPOSED',{assigneeId:newAssignee});return this.visibleCase(actor,cid);
  });}
  // Expiry is a durable server-time fact; it never expires an accepted commitment.
  expirePending(cid,now=Date.now()) { return this.tx(()=>{
    const c=this.caseRaw(cid);
    if(c.status!=='AWAITING_ASSIGNEE_RESPONSE') return false;
    const a=this.db.prepare("SELECT * FROM attempts WHERE case_id=? AND status='PENDING'").get(cid);
    if(!a||a.expires_at==null||a.expires_at>now) return false;
    this.db.prepare("UPDATE attempts SET status='EXPIRED',responded_at=? WHERE id=?").run(iso(),a.id);
    this.db.prepare("UPDATE cases SET status='NEEDS_REASSIGNMENT',version=version+1 WHERE id=?").run(cid);
    this.event(cid,null,'INVITE_EXPIRED',{attemptId:a.id,source:'server_clock'});return true;
  });}
  withdraw(actor,cid,expected,key){this.actor(actor);return this.idempotent(actor,'withdraw',key,{cid,expected},()=>{
    const c=this.owner(actor,cid,expected);
    if(c.status!=='AWAITING_ASSIGNEE_RESPONSE') reject(409,'BAD_STATE','Can withdraw only pending invitation');
    const a=this.db.prepare("SELECT * FROM attempts WHERE case_id=? AND status='PENDING'").get(cid);
    if(!a) reject(409,'BAD_STATE','Pending attempt no longer exists');
    this.db.prepare("UPDATE attempts SET status='WITHDRAWN',responded_at=? WHERE id=?").run(iso(),a.id);
    this.db.prepare("UPDATE cases SET status='NEEDS_REASSIGNMENT',version=version+1 WHERE id=?").run(cid);
    this.event(cid,actor,'INVITE_WITHDRAWN',{attemptId:a.id,source:'requester_ui'});return this.visibleCase(actor,cid);
  });}
  cancel(actor,cid,expected,key){this.actor(actor);return this.idempotent(actor,'cancel',key,{cid,expected},()=>{
    const c=this.owner(actor,cid,expected);
    if(!['DRAFT','AWAITING_REQUESTER_APPROVAL','NEEDS_REASSIGNMENT'].includes(c.status)) reject(409,'BAD_STATE','Case cannot be cancelled in this status');
    this.db.prepare("UPDATE cases SET status='CANCELLED',version=version+1,preview_hash=NULL WHERE id=?").run(cid);
    this.db.prepare('UPDATE approvals SET consumed_at=? WHERE case_id=? AND consumed_at IS NULL').run(iso(),cid);
    this.event(cid,actor,'CASE_CANCELLED',{source:'requester_ui',unresolved:c.status==='NEEDS_REASSIGNMENT'});return this.visibleCase(actor,cid);
  });}
  dispute(actor,cid,expected,reason,key){this.actor(actor);return this.idempotent(actor,'dispute',key,{cid,expected,reason},()=>{
    const c=this.owner(actor,cid,expected);
    if(c.status!=='CLAIMED_DONE') reject(409,'BAD_STATE','Only a reported completion may be disputed');
    if(typeof reason!=='string'||reason.trim().length<8||reason.length>500) reject(422,'VALIDATION','Reason must be 8–500 characters');
    this.db.prepare("UPDATE cases SET status='DISPUTED',version=version+1 WHERE id=?").run(cid);
    this.event(cid,actor,'CLAIM_DISPUTED',{reason:reason.trim(),source:'requester_human_dispute',independentVerification:false});return this.visibleCase(actor,cid);
  });}
  editUnsent(actor,cid,expected,{title,details,assigneeId}){this.actor(actor);return this.tx(()=>{
    const c=this.owner(actor,cid,expected);
    if(!['DRAFT','AWAITING_REQUESTER_APPROVAL'].includes(c.status)) reject(409,'BAD_STATE','Only unsent draft may be edited');
    if(typeof title!=='string'||title.trim().length<4||title.length>160||typeof details!=='string'||details.length>2000) reject(422,'VALIDATION','Invalid draft fields');
    if(assigneeId===actor||!this.db.prepare('SELECT 1 FROM users WHERE id=?').get(assigneeId)) reject(422,'VALIDATION','Choose another eligible member');
    this.db.prepare("UPDATE cases SET title=?,details=?,assignee_id=?,status='DRAFT',preview_hash=NULL,version=version+1 WHERE id=?").run(title.trim(),details,assigneeId,cid);
    this.db.prepare('UPDATE approvals SET consumed_at=? WHERE case_id=? AND consumed_at IS NULL').run(iso(),cid);
    this.event(cid,actor,'DRAFT_EDITED',{source:'requester_ui',approvalInvalidated:true});return this.visibleCase(actor,cid);
  });}
  listCases(actor){this.actor(actor);
    return this.db.prepare(`SELECT DISTINCT c.id,c.title,c.status,c.version,c.requester_id,c.assignee_id,c.created_at FROM cases c
      LEFT JOIN attempts a ON a.case_id=c.id WHERE c.requester_id=? OR a.assignee_id=? ORDER BY c.created_at DESC LIMIT 50`).all(actor,actor).map(row);
  }

}
