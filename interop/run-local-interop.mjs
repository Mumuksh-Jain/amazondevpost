// One-command independent maintained-SDK interoperability verifier.
// Run AFTER `npm install` in the RelayCase root. No real credentials required.
// Starts the first-party and official-SDK MCP service in one process, then
// runs a separately implemented maintained MCP client over real HTTP.
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createApp} from '../server.mjs';

const users=['priya','sam','alex'];
const secrets=()=>Object.fromEntries(users.map(u=>[u,randomBytes(32).toString('hex')]));
const tokens=secrets(),mcpTokens=secrets();
const app=createApp({dbFile:':memory:',tokens,mcpTokens,mcpMode:'official'});
let client;
let checks=0;
const toolJson=async(name,args={})=>{
 const t=await client.callTool({name,arguments:args});
 const part=t.content?.find(c=>c.type==='text');
 assert.ok(part,'MCP response must include text');
 return {error:t.isError===true,body:JSON.parse(part.text)};
};
try{
 const base=await app.listen();
 client=new Client({name:'relaycase-independent-official-sdk-test',version:'1.0.0'});
 const transport=new StreamableHTTPClientTransport(new URL(base+'/mcp'),{
  requestInit:{headers:{Authorization:`Bearer ${mcpTokens.priya}`}}
 });
 await client.connect(transport);checks++;
 const list=await client.listTools();
 const expected=['list_eligible_members','create_handoff_draft','get_handoff_case','preview_handoff','send_approved_handoff','list_my_cases','get_case_history'];
 assert.deepEqual(list.tools.map(t=>t.name).sort(),expected.sort());checks++;
 const created=await toolJson('create_handoff_draft',{title:'Confirm delivery of shared keys',assigneeId:'sam',idempotencyKey:randomUUID()});
 assert.equal(created.error,false);assert.equal(created.body.status,'DRAFT');checks++;
 const read=await toolJson('get_handoff_case',{caseId:created.body.id});
 assert.equal(read.error,false);assert.equal(read.body.id,created.body.id);checks++;
 const preview=await toolJson('preview_handoff',{caseId:created.body.id,version:created.body.version});
 assert.equal(preview.error,false);assert.equal(preview.body.status,'AWAITING_REQUESTER_APPROVAL');checks++;
 const blocked=await toolJson('send_approved_handoff',{caseId:created.body.id,version:preview.body.version,idempotencyKey:randomUUID()});
 assert.equal(blocked.error,true);assert.equal(blocked.body.code,'APPROVAL_REQUIRED');checks++;
 const approval=await fetch(base+`/api/cases/${created.body.id}/approve`,{
  method:'POST',headers:{Authorization:`Bearer ${tokens.priya}`,'Content-Type':'application/json'},body:JSON.stringify({version:preview.body.version})
 });
 assert.equal(approval.status,200);checks++;
 const sent=await toolJson('send_approved_handoff',{caseId:created.body.id,version:preview.body.version,idempotencyKey:randomUUID()});
 assert.equal(sent.error,false);assert.equal(sent.body.status,'AWAITING_ASSIGNEE_RESPONSE');checks++;
 const sam=await fetch(base+`/api/cases/${created.body.id}`,{headers:{Authorization:`Bearer ${tokens.sam}`}});
 assert.equal(sam.status,200);checks++;
 console.log(JSON.stringify({result:'PASS',mode:'MAINTAINED_MCP_SDK_V1_OVER_HTTP',checks,tools:list.tools.length,caseState:sent.body.status,approvedBy:'separate_first_party_UI_credentials',note:'Local-only synthetic test; no Alexa+ preview access or deployed service'},null,2));
}catch(e){
 console.error('FAIL — maintained SDK integration:',e?.stack||e);
 process.exitCode=1;
}finally{
 if(client)await client.close().catch(()=>{});
 await app.close();
}
