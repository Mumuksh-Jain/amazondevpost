import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createApp} from './server.mjs';
const actors=['priya','sam','alex'];
const keys=()=>Object.fromEntries(actors.map(a=>[a,randomBytes(32).toString('hex')]));
const tokens=keys(),mcpTokens=keys();
async function setup(fn,enabled=true){const app=createApp({tokens,mcpTokens:enabled?mcpTokens:null});const base=await app.listen();try{await fn(base,app);}finally{await app.close();}}
async function api(base,actor,path,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Authorization:`Bearer ${tokens[actor]}`,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json()};}
const command=(b,a,message)=>api(b,a,'/api/assistant',{message});
const traceHas=(result,tool)=>result.trace.some(x=>x.method==='tools/call'&&x.tool===tool&&x.transport==='real_local_HTTP'&&x.protocol==='2025-11-25');
test('deterministic simulated host makes true HTTP MCP calls, returns sanitized trace',()=>setup(async base=>{
 const who=await command(base,'priya','who can help?');assert.equal(who.status,200);assert.ok(traceHas(who.value,'list_eligible_members'));assert.equal(who.value.result.members.length,2);
 const list=await command(base,'priya','show my cases');assert.equal(list.status,200);assert.ok(traceHas(list.value,'list_my_cases'));
 for(const call of [...who.value.trace,...list.value.trace]){assert.ok(call.id);assert.equal(call.protocol,'2025-11-25');assert.ok(!JSON.stringify(call).includes(tokens.priya));assert.ok(!JSON.stringify(call).includes(mcpTokens.priya));}
}));
test('assistant creates real draft, previews via MCP, and cannot send before independent UI approval',()=>setup(async base=>{
 const made=await command(base,'priya','draft: Bring the recycling box inside -> sam');assert.equal(made.status,200);assert.ok(traceHas(made.value,'create_handoff_draft'));
 const id=made.value.result.id;assert.ok(id);
 const persisted=await api(base,'priya',`/api/cases/${id}`);assert.equal(persisted.value.status,'DRAFT');
 const preview=await command(base,'priya',`preview case ${id}`);assert.equal(preview.status,200);assert.equal(preview.value.result.status,'AWAITING_REQUESTER_APPROVAL');
 const denied=await command(base,'priya',`send case ${id}`);assert.equal(denied.status,422);assert.equal(denied.value.ok,false);assert.match(denied.value.answer,/APPROVAL_REQUIRED/);assert.ok(denied.value.trace.some(t=>t.tool==='send_approved_handoff'&&t.success===false));
 const human=await api(base,'priya',`/api/cases/${id}/approve`,{version:preview.value.result.version});assert.equal(human.status,200);
 const sent=await command(base,'priya',`send case ${id}`);assert.equal(sent.status,200);assert.equal(sent.value.result.status,'AWAITING_ASSIGNEE_RESPONSE');assert.ok(traceHas(sent.value,'send_approved_handoff'));
 const outsider=await command(base,'alex',`show case ${id}`);assert.equal(outsider.status,422);assert.match(outsider.value.answer,/NOT_FOUND/);
 const status=await command(base,'sam',`show case ${id}`);assert.equal(status.status,200);
 const hist=await command(base,'sam',`history case ${id}`);assert.equal(hist.status,200);assert.ok(hist.value.result.events.length>0);
}));
test('unsupported commands and forged actor identifiers do not cause writes',()=>setup(async base=>{
 const unsupported=await command(base,'priya','take over all approvals');assert.equal(unsupported.status,422);assert.equal(unsupported.value.code,'UNSUPPORTED_REQUEST');
 const bad=await api(base,'priya','/api/assistant',{message:'who can help?',actor:'sam'});assert.equal(bad.status,422);
 const noTokens=await fetch(base+'/api/assistant',{method:'POST',headers:{Authorization:`Bearer ${mcpTokens.priya}`,'Content-Type':'application/json'},body:JSON.stringify({message:'who can help?'})});assert.equal(noTokens.status,401);
 const badOrigin=await fetch(base+'/api/assistant',{method:'POST',headers:{Authorization:`Bearer ${tokens.priya}`,'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({message:'who can help?'})});assert.equal(badOrigin.status,403);
 const cases=await api(base,'priya','/api/cases');assert.equal(cases.value.cases.length,0);
}));
test('synthetic assistant fails closed rather than making fake output when MCP disabled',()=>setup(async base=>{
 const r=await command(base,'priya','show my cases');assert.equal(r.status,503);assert.equal(r.value.code,'MCP_DISABLED');
},false));
test('assistant transport properly reports invalid target and oversized requests',()=>setup(async base=>{
 const invalid=await command(base,'priya','draft: Task -> intruder');assert.equal(invalid.status,422);
 const oversized=await command(base,'priya','x'.repeat(501));assert.equal(oversized.status,422);
 const hidden=await command(base,'priya',`show case ${'a'.repeat(36)}`);assert.equal(hidden.status,422);assert.equal(hidden.value.ok,false);
}));
