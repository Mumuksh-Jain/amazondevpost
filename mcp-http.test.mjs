import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const names=['priya','sam','alex'];
const tokens=Object.fromEntries(names.map(n=>[n,randomBytes(32).toString('hex')]));
const mcpTokens=Object.fromEntries(names.map(n=>[n,randomBytes(32).toString('hex')]));
const req=(id,method,params={})=>({jsonrpc:'2.0',id,method,params});
const init=req(1,'initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'independent-http-test',version:'1.0'}});
const rpc=(base,actor,payload,extra={})=>fetch(base+'/mcp',{method:'POST',headers:{Authorization:`Bearer ${mcpTokens[actor]}`,'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25',...(extra.headers||{})},body:JSON.stringify(payload)});
const ui=async(base,actor,path,body)=>{const res=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${tokens[actor]}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,result:await res.json()};};
const tool=async(base,actor,name,args={},id=3)=>{const r=await rpc(base,actor,req(id,'tools/call',{name,arguments:args}));assert.equal(r.status,200);const v=await r.json();assert.equal(v.jsonrpc,'2.0');return {isError:v.result?.isError===true,body:JSON.parse(v.result.content[0].text)};};
async function harness(fn){const app=createApp({tokens,mcpTokens});const base=await app.listen();try{await fn(base,app);}finally{await app.close();}}
test('2025-11-25 HTTP handshake, initialized notification, seven discoverable tools',async()=>harness(async base=>{
 const response=await rpc(base,'priya',init);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);
 const body=await response.json();assert.equal(body.result.protocolVersion,'2025-11-25');assert.deepEqual(Object.keys(body.result.capabilities),['tools']);
 const notif=await rpc(base,'priya',{jsonrpc:'2.0',method:'notifications/initialized'});assert.equal(notif.status,202);assert.equal(await notif.text(),'');
 const listed=await (await rpc(base,'priya',req(2,'tools/list'))).json();assert.equal(listed.result.tools.length,7);
 for(const t of listed.result.tools){assert.equal(t.inputSchema.type,'object');assert.ok(t.name);}
 const get=await fetch(base+'/mcp',{headers:{Authorization:`Bearer ${mcpTokens.priya}`,Accept:'text/event-stream'}});assert.equal(get.status,405);
}));
test('MCP writes a real draft that first-party UI sees; no direct approval tool',async()=>harness(async base=>{
 const members=await tool(base,'priya','list_eligible_members');assert.equal(members.isError,false);assert.equal(members.body.members.length,2);
 const d=await tool(base,'priya','create_handoff_draft',{title:'Bring recycling boxes inside',assigneeId:'sam',idempotencyKey:randomUUID()});assert.equal(d.body.status,'DRAFT');
 const list=await ui(base,'priya','/api/cases');assert.ok(list.result.cases.some(c=>c.id===d.body.id));
 const read=await tool(base,'priya','get_handoff_case',{caseId:d.body.id});assert.equal(read.body.status,'DRAFT');
 const preview=await tool(base,'priya','preview_handoff',{caseId:d.body.id,version:d.body.version});assert.equal(preview.body.status,'AWAITING_REQUESTER_APPROVAL');
 const sentWithoutApproval=await tool(base,'priya','send_approved_handoff',{caseId:d.body.id,version:preview.body.version,idempotencyKey:randomUUID()});
 assert.equal(sentWithoutApproval.isError,true);assert.equal(sentWithoutApproval.body.code,'APPROVAL_REQUIRED');
 const approval=await ui(base,'priya',`/api/cases/${d.body.id}/approve`,{version:preview.body.version});assert.equal(approval.status,200);
 const sent=await tool(base,'priya','send_approved_handoff',{caseId:d.body.id,version:preview.body.version,idempotencyKey:randomUUID()});assert.equal(sent.isError,false);assert.equal(sent.body.status,'AWAITING_ASSIGNEE_RESPONSE');
 const history=await tool(base,'priya','get_case_history',{caseId:d.body.id});assert.ok(history.body.events.some(e=>e.kind==='INVITE_SENT'));
 const outsider=await tool(base,'alex','get_handoff_case',{caseId:d.body.id});assert.equal(outsider.isError,true);assert.equal(outsider.body.code,'NOT_FOUND');
}));
test('MCP bearer scopes separate from first-party browser, invalid origins do not write',async()=>harness(async base=>{
 const uiToken=await fetch(base+'/mcp',{method:'POST',headers:{Authorization:`Bearer ${tokens.priya}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify(init)});assert.equal(uiToken.status,401);
 const mcpOnUi=await fetch(base+'/api/cases',{headers:{Authorization:`Bearer ${mcpTokens.priya}`}});assert.equal(mcpOnUi.status,401);
 const badOrigin=await rpc(base,'priya',req(4,'tools/call',{name:'create_handoff_draft',arguments:{title:'Unauthorized malicious draft',assigneeId:'sam',idempotencyKey:randomUUID()}}),{headers:{Origin:'https://untrusted.example'}});assert.equal(badOrigin.status,403);
 const after=await tool(base,'priya','list_my_cases');assert.equal(after.body.cases.length,0);
}));
test('incorrect protocol version, invalid input, malformed request and unsupported method are rejected safely',async()=>harness(async base=>{
 const wrong=await rpc(base,'priya',req(3,'tools/list'),{headers:{'MCP-Protocol-Version':'2026-07-28'}});assert.equal(wrong.status,400);
 const invalid=await tool(base,'priya','create_handoff_draft',{title:'short',assigneeId:'sam',idempotencyKey:12});assert.equal(invalid.isError,true);assert.equal(invalid.body.code,'INVALID_TOOL_ARGS');
 const unknown=await (await rpc(base,'priya',req(4,'unknown/method'))).json();assert.equal(unknown.error.code,-32601);
 const missing=await (await rpc(base,'priya',req(5,'tools/call',{name:'approve_in_first_party_ui'}))).json();assert.equal(missing.error.code,-32602);
 const malformed=await fetch(base+'/mcp',{method:'POST',headers:{Authorization:`Bearer ${mcpTokens.priya}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:'{'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).error.code,-32700);
}));
test('persistence survives service restart: new MCP request reads real SQLite data',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'relay-p12-'));const file=join(dir,'db.sqlite');
 try{
  const a=createApp({tokens,mcpTokens,dbFile:file});let base=await a.listen();let id;
  try{const d=await tool(base,'priya','create_handoff_draft',{title:'Close the garage side door',assigneeId:'sam',idempotencyKey:randomUUID()});id=d.body.id;}finally{await a.close();}
  const b=createApp({tokens,mcpTokens,dbFile:file});base=await b.listen();try{const d=await tool(base,'priya','get_handoff_case',{caseId:id});assert.equal(d.body.id,id);assert.equal(d.body.status,'DRAFT');}finally{await b.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('custom bridge rejects missing credentials configuration and does not affect original REST-only startup',async()=>{
 assert.throws(()=>createApp({tokens,mcpTokens:{priya:'short',sam:'short',alex:'short'}}),/Separate/);
 assert.throws(()=>createApp({tokens,mcpTokens:{priya:tokens.priya,sam:mcpTokens.sam,alex:mcpTokens.alex}}),/Separate/);
 const app=createApp({tokens});try{const base=await app.listen();const r=await fetch(base+'/mcp');assert.equal(r.status,404);}finally{await app.close();}
});
