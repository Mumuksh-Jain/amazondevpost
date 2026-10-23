// MUST run on a network-connected development machine after npm install.
// This script uses the independent MAINTAINED MCP TypeScript SDK v1 client.
// It is deliberately not shipped with a fabricated PASS transcript.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {randomUUID} from 'node:crypto';
const url=process.env.RELAY_MCP_URL||'http://127.0.0.1:3000/mcp';
const token=process.env.RELAY_MCP_TEST_TOKEN;
if(!token)throw Error('Set RELAY_MCP_TEST_TOKEN to the Priya MCP credential. Never paste it into logs.');
const client=new Client({name:'relaycase-independent-sdk-verifier',version:'1.0.0'});
const transport=new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:`Bearer ${token}`}}});
try {
 await client.connect(transport);
 const version=client.getServerVersion?.();
 const list=await client.listTools();
 const expected=['list_eligible_members','create_handoff_draft','get_handoff_case','preview_handoff','send_approved_handoff','list_my_cases','get_case_history'];
 for(const name of expected)if(!list.tools.some(t=>t.name===name))throw Error(`Expected tool missing: ${name}`);
 const drafted=await client.callTool({name:'create_handoff_draft',arguments:{title:'Independent SDK compatibility test',assigneeId:'sam',idempotencyKey:randomUUID()}});
 if(drafted.isError)throw Error('SDK draft rejected');
 const record=JSON.parse(drafted.content.find(c=>c.type==='text').text);
 if(record.status!=='DRAFT')throw Error('Unexpected domain status');
 const read=await client.callTool({name:'get_handoff_case',arguments:{caseId:record.id}});
 if(read.isError)throw Error('SDK read rejected');
 const persisted=JSON.parse(read.content.find(c=>c.type==='text').text);
 if(persisted.id!==record.id)throw Error('MCP read ID mismatch');
 const preview=await client.callTool({name:'preview_handoff',arguments:{caseId:record.id,version:record.version}});
 if(preview.isError)throw Error('MCP preview rejected');
 const pending=JSON.parse(preview.content.find(c=>c.type==='text').text);
 const blocked=await client.callTool({name:'send_approved_handoff',arguments:{caseId:record.id,version:pending.version,idempotencyKey:randomUUID()}});
 if(!blocked.isError)throw Error('Security gate failed: send without separate human approval');
 const denied=JSON.parse(blocked.content.find(c=>c.type==='text').text);
 if(denied.code!=='APPROVAL_REQUIRED')throw Error('Unexpected pre-approval rejection: '+denied.code);
 let outcome='PRE_APPROVAL_SEND_BLOCKED';
 if(process.env.RELAY_UI_TEST_TOKEN){
  const ui=await fetch(new URL(`/api/cases/${record.id}/approve`,url),{method:'POST',headers:{Authorization:`Bearer ${process.env.RELAY_UI_TEST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({version:pending.version})});
  if(!ui.ok)throw Error('First-party separate human approval was rejected: '+ui.status);
  const sent=await client.callTool({name:'send_approved_handoff',arguments:{caseId:record.id,version:pending.version,idempotencyKey:randomUUID()}});
  if(sent.isError)throw Error('Post-approval send failed');
  const delivered=JSON.parse(sent.content.find(c=>c.type==='text').text);
  if(delivered.status!=='AWAITING_ASSIGNEE_RESPONSE')throw Error('Wrong status after send');
  outcome='APPROVED_AND_SENT';
 }
 console.log(JSON.stringify({test:'independent SDK handshake, seven tools, draft and persisted read',result:'PASS',mcpVersion:'2025-11-25',server:version?.name||'unknown',toolCount:list.tools.length,caseStatus:persisted.status,approvalGate:outcome},null,2));
} catch (error){console.error('INDEPENDENT SDK INTEROPERABILITY FAILED:',error.message);process.exitCode=1;}
finally{await client.close().catch(()=>{});}
