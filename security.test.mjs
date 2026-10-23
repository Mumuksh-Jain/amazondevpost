import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {RelayDomain,DomainError} from './domain.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
const tokens=Object.fromEntries(['priya','sam','alex'].map(x=>[x,randomBytes(28).toString('hex')]));
const key=()=>randomUUID();
const fail=(code)=>(e)=>e instanceof DomainError&&e.code===code;
const use=async(fn,limit)=>{const app=createApp({tokens,limit});try{const base=await app.listen();
 const call=async(actor,path,body,opts={})=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${tokens[actor]}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...(opts.headers??{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,headers:r.headers};};
 await fn({app,base,call});}finally{await app.close();}};
const make=async(call,title='Bring the recycling container in')=>{
 const d=await call('priya','/api/cases',{title,details:'Please do this before dinner.',assigneeId:'sam',idempotencyKey:key()});
 assert.equal(d.status,201);return d.data;
};
const send=async(call,d)=>{
 const p=await call('priya',`/api/cases/${d.id}/preview`,{version:d.version});assert.equal(p.status,200);
 const ap=await call('priya',`/api/cases/${d.id}/approve`,{version:p.data.version});assert.equal(ap.status,200);
 const s=await call('priya',`/api/cases/${d.id}/send`,{version:p.data.version,idempotencyKey:key()});assert.equal(s.status,200);return s.data;
};

test('first-party API runs a two-human flow without trusting actor in JSON',async()=>use(async({call})=>{
 const draft=await make(call);const sent=await send(call,draft);
 assert.equal(sent.status,'AWAITING_ASSIGNEE_RESPONSE');
 const fake=await call('priya',`/api/cases/${draft.id}/accept`,{actorId:'sam',version:sent.version,idempotencyKey:key()});
 assert.equal(fake.status,404);assert.equal(fake.data.code,'NOT_FOUND');
 const accepted=await call('sam',`/api/cases/${draft.id}/accept`,{actorId:'priya',version:sent.version,idempotencyKey:key()});assert.equal(accepted.data.status,'ACCEPTED');
 const claimed=await call('sam',`/api/cases/${draft.id}/claim`,{version:accepted.data.version,idempotencyKey:key()});assert.equal(claimed.data.status,'CLAIMED_DONE');
 const closed=await call('priya',`/api/cases/${draft.id}/acknowledge`,{version:claimed.data.version,idempotencyKey:key()});
 assert.equal(closed.data.status,'CLOSED_ACKNOWLEDGED');
 const history=await call('priya',`/api/cases/${draft.id}/history`);
 assert.equal(history.data.events.find(e=>e.kind==='COMPLETION_CLAIMED').payload.independentVerification,false);
}));
test('different fictional identities cannot read another person’s private case',async()=>use(async({call})=>{
 const d=await make(call);const outsider=await call('alex',`/api/cases/${d.id}`);
 assert.equal(outsider.status,404);const h=await call('alex',`/api/cases/${d.id}/history`);assert.equal(h.status,404);
 const sam=await call('sam',`/api/cases/${d.id}`);assert.equal(sam.status,404);
 const s=await send(call,d);const visible=await call('sam',`/api/cases/${d.id}`);
 assert.equal(visible.status,200);assert.equal(visible.data.details,undefined);
 assert.equal(visible.data.attempts[0].assignee_id,'sam');
 assert.equal((await call('alex',`/api/cases/${s.id}`)).status,404);
}));
test('origin validation and authentication are enforced before any mutations',async()=>use(async({app,base,call})=>{
 const noAuth=await fetch(base+'/api/cases');assert.equal(noAuth.status,401);
 const badOrigin=await call('priya','/api/cases',{title:'Bad origin test case',assigneeId:'sam',idempotencyKey:key()}, {headers:{Origin:'https://attacker.example'}});
 assert.equal(badOrigin.status,403);assert.equal(badOrigin.data.code,'BAD_ORIGIN');
 const list=await call('priya','/api/cases');assert.equal(list.data.cases.length,0);
 const response=await fetch(base+'/');assert.equal(response.status,200);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.ok(!response.headers.get('access-control-allow-origin'));
}));
test('malformed and oversized writes are rejected with safe JSON errors',async()=>use(async({base})=>{
 const options={method:'POST',headers:{Authorization:`Bearer ${tokens.priya}`,'Content-Type':'application/json'}};
 const malformed=await fetch(base+'/api/cases',{...options,body:'{'});assert.equal(malformed.status,400);
 const huge=await fetch(base+'/api/cases',{...options,body:JSON.stringify({title:'A'.repeat(17000)})});assert.equal(huge.status,413);
 const wrong=await fetch(base+'/api/cases',{method:'POST',headers:{Authorization:`Bearer ${tokens.priya}`,'Content-Type':'text/plain'},body:'hi'});assert.equal(wrong.status,415);
}));
test('rate limiter rejects excess requests per demo identity',async()=>use(async({call})=>{
 assert.equal((await call('sam','/api/me')).status,200);assert.equal((await call('sam','/api/me')).status,200);
 assert.equal((await call('sam','/api/me')).status,429);
},2));
test('withdrawal preserves history and blocks stale assignee acceptance',async()=>use(async({call})=>{
 const s=await send(call,await make(call));const w=await call('priya',`/api/cases/${s.id}/withdraw`,{version:s.version,idempotencyKey:key()});
 assert.equal(w.data.status,'NEEDS_REASSIGNMENT');assert.equal(w.data.attempts[0].status,'WITHDRAWN');
 const late=await call('sam',`/api/cases/${s.id}/accept`,{version:s.version,idempotencyKey:key()});assert.equal(late.status,409);
 const history=await call('priya',`/api/cases/${s.id}/history`);
 assert.ok(history.data.events.some(e=>e.kind==='INVITE_WITHDRAWN'));
}));
test('server-time expiry is durable and cannot expire an accepted task',()=>{
 const d=new RelayDomain();try{
  const a=d.createDraft('priya',{title:'Bring parcel in',assigneeId:'sam',idempotencyKey:key()});
  const p=d.preview('priya',a.id,a.version);d.approveInFirstPartyUi('priya',a.id,p.version);
  const s=d.sendApproved('priya',a.id,p.version,key());
  d.db.prepare('UPDATE attempts SET expires_at=? WHERE case_id=?').run(Date.now()-1000,a.id);
  assert.throws(()=>d.accept('sam',a.id,s.version,key()),fail('VERSION_CONFLICT'));
  assert.equal(d.caseRaw(a.id).status,'NEEDS_REASSIGNMENT');
  assert.equal(d.visibleCase('priya',a.id).attempts[0].status,'EXPIRED');
  assert.equal(d.history('priya',a.id).filter(e=>e.kind==='INVITE_EXPIRED').length,1);
  d.expirePending(a.id);assert.equal(d.history('priya',a.id).filter(e=>e.kind==='INVITE_EXPIRED').length,1);
 }finally{d.close();}
});
test('reported completion can be disputed without erasing original claim',async()=>use(async({call})=>{
 const s=await send(call,await make(call));const a=(await call('sam',`/api/cases/${s.id}/accept`,{version:s.version,idempotencyKey:key()})).data;
 const claimed=(await call('sam',`/api/cases/${s.id}/claim`,{version:a.version,idempotencyKey:key()})).data;
 const no=await call('sam',`/api/cases/${s.id}/dispute`,{version:claimed.version,reason:'Not actually completed',idempotencyKey:key()});assert.equal(no.status,403);
 const disputed=await call('priya',`/api/cases/${s.id}/dispute`,{version:claimed.version,reason:'The item was left outdoors.',idempotencyKey:key()});
 assert.equal(disputed.data.status,'DISPUTED');
 const hist=await call('priya',`/api/cases/${s.id}/history`);
 assert.ok(hist.data.events.some(x=>x.kind==='COMPLETION_CLAIMED'));
 assert.ok(hist.data.events.some(x=>x.kind==='CLAIM_DISPUTED'));
 const undo=await call('priya',`/api/cases/${s.id}/acknowledge`,{version:disputed.data.version,idempotencyKey:key()});assert.equal(undo.status,409);
}));
test('editing unsent preview invalidates old consent; terminal states deny changes',async()=>use(async({call})=>{
 const d=await make(call);const p=(await call('priya',`/api/cases/${d.id}/preview`,{version:d.version})).data;
 await call('priya',`/api/cases/${d.id}/approve`,{version:p.version});
 const edited=await call('priya',`/api/cases/${d.id}/edit`,{version:p.version,title:'Take the recycling bin indoors',details:'Updated instruction',assigneeId:'sam'});
 assert.equal(edited.data.status,'DRAFT');
 const stale=await call('priya',`/api/cases/${d.id}/send`,{version:p.version,idempotencyKey:key()});assert.equal(stale.status,409);
 const cancelled=await call('priya',`/api/cases/${d.id}/cancel`,{version:edited.data.version,idempotencyKey:key()});assert.equal(cancelled.data.status,'CANCELLED');
 const late=await call('priya',`/api/cases/${d.id}/preview`,{version:cancelled.data.version});assert.equal(late.status,409);
}));
test('idempotency retries do not duplicate events and conflicting reuse fails',async()=>use(async({call})=>{
 const k=key(),body={title:'Remember to switch off the hallway light',assigneeId:'sam',idempotencyKey:k};
 const first=await call('priya','/api/cases',body),second=await call('priya','/api/cases',body);
 assert.equal(first.data.id,second.data.id);const conflict=await call('priya','/api/cases',{...body,title:'Different action'});assert.equal(conflict.status,409);
 const events=(await call('priya',`/api/cases/${first.data.id}/history`)).data.events;
 assert.equal(events.filter(e=>e.kind==='CASE_CREATED').length,1);
}));
test('unrelated actor cannot enumerate owner-only case via wrong version or cause expiry',()=>{
 const d=new RelayDomain();try{
  const a=d.createDraft('priya',{title:'Private invitation to Sam',assigneeId:'sam',idempotencyKey:key()});
  const p=d.preview('priya',a.id,a.version);d.approveInFirstPartyUi('priya',a.id,p.version);
  const s=d.sendApproved('priya',a.id,p.version,key());
  d.db.prepare('UPDATE attempts SET expires_at=? WHERE case_id=?').run(Date.now()-1000,a.id);
  const before=d.history('priya',a.id).length;
  assert.throws(()=>d.accept('alex',a.id,999,key()),fail('NOT_FOUND'));
  assert.throws(()=>d.cancel('alex',a.id,999,key()),fail('NOT_FOUND'));
  assert.equal(d.history('priya',a.id).length,before);
  assert.equal(d.caseRaw(a.id).status,'AWAITING_ASSIGNEE_RESPONSE');
  assert.throws(()=>d.accept('sam',a.id,s.version,key()),fail('VERSION_CONFLICT'));
  assert.equal(d.caseRaw(a.id).status,'NEEDS_REASSIGNMENT');
 }finally{d.close();}
});

test('demo startup rejects missing or reused credentials before opening a database',()=>{
 assert.throws(()=>createApp({tokens:{priya:tokens.priya,sam:tokens.priya,alex:tokens.alex}}),/UNIQUE/);
 assert.throws(()=>createApp({tokens:{priya:'short',sam:tokens.sam,alex:tokens.alex}}),/UNIQUE/);
});
