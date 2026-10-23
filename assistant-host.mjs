// Deterministic simulated assistant HOST, not a model or an Alexa+ integration.
// Explicit user messages are routed through actual MCP HTTP JSON-RPC transport.
// No model output or browser-supplied actor may authorize a human approval.
import {randomUUID} from 'node:crypto';
import {MCP_VERSION} from './mcp-lite.mjs';

class AssistantError extends Error {
 constructor(code,message,status=422){super(message);this.code=code;this.status=status;}
}
const permitted = new Set(['list_eligible_members','list_my_cases','create_handoff_draft','get_handoff_case','preview_handoff','send_approved_handoff','get_case_history']);
const extract = result => {
 if(!result || !Array.isArray(result.content) || result.content[0]?.type!=='text')
   throw new AssistantError('INVALID_TOOL_RESULT','The MCP tool returned a response this host cannot interpret.',502);
 let data;try {data=JSON.parse(result.content[0].text);} catch {
   throw new AssistantError('INVALID_TOOL_RESULT','The MCP tool result is not JSON.',502);
 }
 if(result.isError) throw new AssistantError(data.code||'TOOL_REJECTED',data.message||'Action rejected by domain service.',409);
 return data;
};
export function parseCommand(input){
 if(typeof input!=='string'||input.length>500||!input.trim())throw new AssistantError('INVALID_MESSAGE','Enter a message up to 500 characters.');
 const msg=input.trim();
 if(/^(who can help\??|list members\??)$/i.test(msg))return {intent:'members'};
 if(/^(show my cases\??|list my cases\??|what cases are mine\??)$/i.test(msg))return {intent:'cases'};
 const draft=/^draft:\s*(.{4,160}?)\s*->\s*(priya|sam|alex)$/i.exec(msg);
 if(draft)return {intent:'draft',title:draft[1].trim(),assigneeId:draft[2].toLowerCase()};
 const caseCmd=/^(show|preview|send|history) case\s+([a-f0-9-]{16,100})$/i.exec(msg);
 if(caseCmd)return {intent:caseCmd[1].toLowerCase(),caseId:caseCmd[2]};
 throw new AssistantError('UNSUPPORTED_REQUEST','Use: who can help? · show my cases · draft: Task title -> sam · show/preview/send/history case <case-id>. No free-form AI interpretation is enabled.');
}
export async function invokeRealMcp({baseUrl,token,toolName,args={}}){
 if(!permitted.has(toolName))throw new AssistantError('UNSUPPORTED_TOOL','The assistant cannot use this tool.');
 const endpoint = new URL('/mcp',baseUrl).toString();
 const trace=[];
 const request=async(method,params,notification=false)=>{
  const id=notification?undefined:randomUUID();
  const payload={jsonrpc:'2.0',...(!notification?{id}:{}),method,...(params?{params}:{})};
  let r;
  try{r=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':MCP_VERSION,Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});}
  catch{throw new AssistantError('MCP_NETWORK_ERROR','Local MCP endpoint unavailable.',503);}
  if(notification){if(r.status!==202)throw new AssistantError('MCP_INIT_FAILED','MCP initialization notification rejected.',502);return;}
  let body;try{body=await r.json();}catch{throw new AssistantError('MCP_BAD_RESPONSE','MCP did not return JSON.',502);}
  if(!r.ok||body.jsonrpc!=='2.0'||body.id!==id||body.error)
   throw new AssistantError('MCP_PROTOCOL_ERROR',body.error?.message||`MCP HTTP ${r.status}`,502);
  trace.push({method,id,protocol:MCP_VERSION,transport:'real_local_HTTP',success:true});
  return body.result;
 };
 const init=await request('initialize',{protocolVersion:MCP_VERSION,capabilities:{},clientInfo:{name:'relaycase-deterministic-host',version:'0.13.0'}});
 if(init.protocolVersion!==MCP_VERSION)throw new AssistantError('WRONG_PROTOCOL','MCP endpoint negotiated a different protocol.',502);
 await request('notifications/initialized',undefined,true);
 const output=await request('tools/call',{name:toolName,arguments:args});
 // No raw credentials or private parameters in trace. Tool name is sufficient for reviewer inspection.
 trace[trace.length-1].tool=toolName;
 try { return {data:extract(output),trace}; }
 catch(error) {trace[trace.length-1].success=false;return {error,trace};}
}
export async function runAssistant({message,baseUrl,token}){
 let command;
 try{command=parseCommand(message);}
 catch(e){if(e instanceof AssistantError)return {ok:false,code:e.code,answer:`${e.code}: ${e.message}`,trace:[],mode:'deterministic_mcp_host'};throw e;}
 const calls=[];
 const invoke=async(name,args={})=>{const r=await invokeRealMcp({baseUrl,token,toolName:name,args});calls.push(...r.trace);if(r.error)throw r.error;return r.data;};
 try {
  if(command.intent==='members'){
   const d=await invoke('list_eligible_members');return {ok:true,answer:`Available fictional household members: ${d.members.map(m=>m.id).join(', ')||'none'}.`,result:d,trace:calls,mode:'deterministic_mcp_host'};
  }
  if(command.intent==='cases'){
   const d=await invoke('list_my_cases');return {ok:true,answer:`You can see ${d.cases.length} recorded case(s).`,result:d,trace:calls,mode:'deterministic_mcp_host'};
  }
  if(command.intent==='draft'){
   const d=await invoke('create_handoff_draft',{title:command.title,assigneeId:command.assigneeId,idempotencyKey:randomUUID()});
   return {ok:true,answer:`Saved draft ${d.id}. No invitation has been sent. Preview and human approval are required.`,result:d,trace:calls,mode:'deterministic_mcp_host'};
  }
  const current=await invoke('get_handoff_case',{caseId:command.caseId});
  if(command.intent==='show')return {ok:true,answer:`Case ${current.id} is ${current.status}. This is a recorded status, not physical verification.`,result:current,trace:calls,mode:'deterministic_mcp_host'};
  if(command.intent==='history'){
   const d=await invoke('get_case_history',{caseId:command.caseId});return {ok:true,answer:`This case has ${d.events.length} recorded event(s).`,result:d,trace:calls,mode:'deterministic_mcp_host'};
  }
  if(command.intent==='preview'){
   const d=await invoke('preview_handoff',{caseId:command.caseId,version:current.version});
   return {ok:true,answer:'Preview persisted. A separate authenticated human must approve it in the UI before sending.',result:d,trace:calls,mode:'deterministic_mcp_host'};
  }
  if(command.intent==='send'){
   const d=await invoke('send_approved_handoff',{caseId:command.caseId,version:current.version,idempotencyKey:randomUUID()});
   return {ok:true,answer:'Invitation sent through the MCP tool after verifying separate human approval.',result:d,trace:calls,mode:'deterministic_mcp_host'};
  }
  throw new AssistantError('UNSUPPORTED_REQUEST','Unsupported deterministic command.');
 }catch(error){
  if(error instanceof AssistantError)
    return {ok:false,code:error.code,answer:`${error.code}: ${error.message}`,trace:calls,mode:'deterministic_mcp_host'};
  throw error;
 }
}
