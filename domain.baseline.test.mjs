import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RelayDomain,DomainError} from './domain.mjs';
const k=(i)=>`fixture-key-${i}-keep-unique`;
const create=(d,i='1')=>d.createDraft('priya',{title:'Bring the recycling box inside',assigneeId:'sam',idempotencyKey:k(i)});
const invite=(d,c)=>{const preview=d.preview('priya',c.id,c.version);d.approveInFirstPartyUi('priya',c.id,preview.version);return d.sendApproved('priya',c.id,preview.version,k('send'+c.id+'-'+preview.version));};
const isCode=(code)=>e=>e instanceof DomainError && e.code===code;
test('two real actor identities; consent and completion claims preserved',()=>{
 const d=new RelayDomain();const draft=create(d);const sent=invite(d,draft);
 assert.equal(sent.status,'AWAITING_ASSIGNEE_RESPONSE');
 assert.throws(()=>d.accept('priya',draft.id,sent.version,k('badaccept')),isCode('NOT_FOUND'));
 const accepted=d.accept('sam',draft.id,sent.version,k('accept'));
 assert.equal(accepted.status,'ACCEPTED');
 assert.throws(()=>d.claimDone('priya',draft.id,accepted.version,k('badclaim')),isCode('NOT_FOUND'));
 const claimed=d.claimDone('sam',draft.id,accepted.version,k('claim'));
 assert.equal(claimed.status,'CLAIMED_DONE');
 assert.throws(()=>d.acknowledge('sam',draft.id,claimed.version,k('badack')),isCode('FORBIDDEN'));
 const ack=d.acknowledge('priya',draft.id,claimed.version,k('ack'));
 assert.equal(ack.status,'CLOSED_ACKNOWLEDGED');
 assert.equal(d.history('priya',draft.id).at(-2).payload.independentVerification,false);
 assert.throws(()=>d.accept('sam',draft.id,ack.version,k('terminal')),isCode('FORBIDDEN'));
 d.close();
});
test('fresh first-party UI approval required and attempt is immutable',()=>{
 const d=new RelayDomain();const draft=create(d,'2');const p=d.preview('priya',draft.id,draft.version);
 assert.throws(()=>d.sendApproved('priya',draft.id,p.version,k('before')),isCode('APPROVAL_REQUIRED'));
 d.approveInFirstPartyUi('priya',draft.id,p.version);const sent=d.sendApproved('priya',draft.id,p.version,k('after'));
 assert.equal(d.sendApproved('priya',draft.id,p.version,k('after')).version,sent.version);
 assert.throws(()=>d.sendApproved('priya',draft.id,p.version,k('replay')),isCode('VERSION_CONFLICT'));
 assert.throws(()=>d.preview('priya',draft.id,p.version),isCode('VERSION_CONFLICT'));
 assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE case_id=?').get(draft.id).n,1);
 assert.throws(()=>d.db.prepare("UPDATE events SET kind='FORGED' WHERE case_id=?").run(draft.id)); d.close();
});
test('decline has visible recovery and no false completion',()=>{
 const d=new RelayDomain(); const s=invite(d,create(d,'3'));const declined=d.decline('sam',s.id,s.version,k('decline'));
 assert.equal(declined.status,'NEEDS_REASSIGNMENT');
 const changed=d.reassign('priya',s.id,declined.version,'alex');const sent=invite(d,changed);
 assert.equal(sent.attempts.length,2);assert.equal(sent.attempts[0].status,'DECLINED');
 assert.throws(()=>d.accept('sam',s.id,sent.version,k('stale')),isCode('FORBIDDEN'));
 assert.equal(d.accept('alex',s.id,sent.version,k('acceptalex')).status,'ACCEPTED');d.close();
});
test('SQLite persists across process-equivalent reconnect and protects unrelated cases',()=>{
 const dir=mkdtempSync(join(tmpdir(),'relay-p07-'));const file=join(dir,'relay.sqlite');
 try {
  let d=new RelayDomain(file);const a=create(d,'4');const id=a.id;d.close();
  d=new RelayDomain(file);assert.equal(d.visibleCase('priya',id).status,'DRAFT');
  assert.throws(()=>d.visibleCase('alex',id),isCode('NOT_FOUND'));
  assert.throws(()=>d.createDraft('priya',{title:'Different task',assigneeId:'sam',idempotencyKey:k('4')}),isCode('IDEMPOTENCY_CONFLICT'));
  d.close();
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('an expired human approval cannot authorize an invitation',()=>{
 const d=new RelayDomain();const draft=create(d,'expired');const preview=d.preview('priya',draft.id,draft.version);
 const approval=d.approveInFirstPartyUi('priya',draft.id,preview.version);
 d.db.prepare('UPDATE approvals SET expires_at=? WHERE id=?').run(Date.now()-1000,approval.approvalId);
 assert.throws(()=>d.sendApproved('priya',draft.id,preview.version,k('expiredsend')),isCode('APPROVAL_REQUIRED'));
 assert.equal(d.caseRaw(draft.id).status,'AWAITING_REQUESTER_APPROVAL');
 assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE case_id=?').get(draft.id).n,0);
 d.close();
});
test('uninvited member cannot read or modify case and denied operations do not append events',()=>{
 const d=new RelayDomain();const draft=create(d,'privacy');const sent=invite(d,draft);
 const n=d.history('priya',draft.id).length;
 assert.throws(()=>d.visibleCase('alex',draft.id),isCode('NOT_FOUND'));
 assert.throws(()=>d.history('alex',draft.id),isCode('NOT_FOUND'));
 assert.throws(()=>d.decline('alex',draft.id,sent.version,k('baddecline')),isCode('NOT_FOUND'));
 assert.equal(d.history('priya',draft.id).length,n);d.close();
});
test('different idempotency keys for same stale operation cannot create duplicate acceptance',()=>{
 const d=new RelayDomain();const draft=create(d,'duplicate');const sent=invite(d,draft);
 const a=d.accept('sam',draft.id,sent.version,k('firstaccept'));
 assert.throws(()=>d.accept('sam',draft.id,sent.version,k('secondaccept')),isCode('VERSION_CONFLICT'));
 assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM events WHERE case_id=? AND kind='INVITE_ACCEPTED'").get(draft.id).n,1);
 assert.equal(a.status,'ACCEPTED');d.close();
});
test('requester cannot invent completion claim and timeline displays actual claim provenance',()=>{
 const d=new RelayDomain();const sent=invite(d,create(d,'provenance'));const accepted=d.accept('sam',sent.id,sent.version,k('accprov'));
 assert.throws(()=>d.claimDone('priya',sent.id,accepted.version,k('ownerforged')),isCode('NOT_FOUND'));
 assert.throws(()=>d.acknowledge('priya',sent.id,accepted.version,k('earlyack')),isCode('BAD_STATE'));
 const claimed=d.claimDone('sam',sent.id,accepted.version,k('realclaim'));
 const e=d.history('priya',sent.id).find(x=>x.kind==='COMPLETION_CLAIMED');
 assert.equal(e.actor_id,'sam');assert.equal(e.payload.source,'authenticated_assignee_claim');
 assert.equal(e.payload.independentVerification,false);
 assert.equal(claimed.status,'CLAIMED_DONE');d.close();
});

// Regression: identical timestamp must never let lexicographically-sorted UUIDs reorder event history.
test('history preserves append order when two events share identical timestamps',()=>{
 const d=new RelayDomain();
 try {
  const draft=create(d,'stable-history-ties');
  const insert=d.db.prepare('INSERT INTO events (id,case_id,actor_id,kind,at,payload_json) VALUES (?,?,?,?,?,?)');
  const time='2026-10-22T10:00:00.000Z';
  insert.run('zzzz-history-first',draft.id,'priya','SAME_MS_ORDER_TEST',time,'{}');
  insert.run('aaaa-history-second',draft.id,'priya','SAME_MS_ORDER_TEST',time,'{}');
  const ids=d.history('priya',draft.id).filter(e=>e.kind==='SAME_MS_ORDER_TEST').map(e=>e.id);
  assert.deepEqual(ids,['zzzz-history-first','aaaa-history-second']);
 } finally {d.close();}
});
