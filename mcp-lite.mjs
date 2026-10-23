// EXPERIMENTAL MCP 2025-11-25 Streamable HTTP subset — deliberately NOT an official SDK.
// Keep independent official SDK verification as an explicit release gate.
import {DomainError} from './domain.mjs';
export const MCP_VERSION='2025-11-25';
const obj=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const str=(minLength=1,maxLength=200)=>({type:'string',minLength,maxLength});
const integer={type:'integer',minimum:1};
const CASE_ID=str(1,100);
const KEY=str(8,128);
const tool=(name,description,properties={},required=[])=>({name,description,inputSchema:obj(properties,required)});
export const TOOLS=[
 tool('list_eligible_members','Return synthetic demo members excluding authenticated caller.'),
 tool('create_handoff_draft','Persist a task draft only. Does not send invitations.',{title:str(4,160),details:str(0,2000),assigneeId:str(1,10),idempotencyKey:KEY},['title','assigneeId','idempotencyKey']),
 tool('get_handoff_case','Read an authenticated actor-visible case; claims are not independent proof.',{caseId:CASE_ID},['caseId']),
 tool('preview_handoff','Freeze an exact request for separate human authorization.',{caseId:CASE_ID,version:integer},['caseId','version']),
 tool('send_approved_handoff','Send only after independently authenticated first-party UI approval.',{caseId:CASE_ID,version:integer,idempotencyKey:KEY},['caseId','version','idempotencyKey']),
 tool('list_my_cases','List cases visible to authenticated user.'),
 tool('get_case_history','Return an actor-scoped event timeline.',{caseId:CASE_ID},['caseId'])
];
const rpcError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const rpcResult=(id,result)=>({jsonrpc:'2.0',id,result});
const textResult=(v,isError=false)=>({content:[{type:'text',text:JSON.stringify(v)}],isError});
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validate(schema,arg){
 if(!isPlain(arg))return false;
 if(Object.keys(arg).some(k=>!(k in schema.properties)))return false;
 if(schema.required.some(k=>!(k in arg)))return false;
 for(const [k,v] of Object.entries(arg)){
  const p=schema.properties[k];
  if(p.type==='integer' && (!Number.isInteger(v)||v<p.minimum))return false;
  if(p.type==='string'&&(typeof v!=='string'||v.length<p.minLength||v.length>p.maxLength))return false;
 }
 return true;
}
export function dispatchMcp(message,domain,actor,protocolHeader){
 if(!isPlain(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')
   return {status:400,body:rpcError(message?.id??null,-32600,'Invalid Request')};
 const {id,method}=message;
 if(method==='initialize'){
  const p=message.params;
  if(id===undefined || !isPlain(p) || typeof p.protocolVersion!=='string'||!isPlain(p.capabilities)||!isPlain(p.clientInfo))
    return {status:200,body:rpcError(id??null,-32602,'Invalid initialize params')};
  return {status:200,body:rpcResult(id,{protocolVersion:MCP_VERSION,capabilities:{tools:{}},serverInfo:{name:'relaycase-research-subset',version:'0.12.0'},instructions:'Synthetic household only. Completion claims are not verified physical outcomes.'})};
 }
 // Our deliberate handshake-version-only subset does not silently assume newer versions.
 if(protocolHeader!==MCP_VERSION)return {status:400,body:rpcError(id??null,-32600,'Unsupported MCP-Protocol-Version')};
 if(method==='notifications/initialized'&&id===undefined)return {status:202};
 if(id===undefined)return {status:202}; // Ignore unsupported notifications; no user write.
 if(method==='ping')return {status:200,body:rpcResult(id,{})};
 if(method==='tools/list')return {status:200,body:rpcResult(id,{tools:TOOLS})};
 if(method!=='tools/call')return {status:200,body:rpcError(id,-32601,'Method not found')};
 const params=message.params;
 if(!isPlain(params)||typeof params.name!=='string')return {status:200,body:rpcError(id,-32602,'Invalid tool call params')};
 const spec=TOOLS.find(t=>t.name===params.name);
 if(!spec)return {status:200,body:rpcError(id,-32602,'Unknown tool')};
 const a=params.arguments??{};
 if(!validate(spec.inputSchema,a))return {status:200,body:rpcResult(id,textResult({code:'INVALID_TOOL_ARGS'},true))};
 try{
  const result=runDomainTool(params.name,a,domain,actor);
  return {status:200,body:rpcResult(id,textResult(result))};
 }catch(e){const code=e instanceof DomainError?e.code:'INTERNAL';
  return {status:200,body:rpcResult(id,textResult({code,message:code==='INTERNAL'?'Unexpected error':e.message},true))};
 }
}

// The official-SDK adapter calls this exact same function. All authorization,
// approval and persisted-state rules still live in RelayDomain.
export function runDomainTool(name,a,domain,actor){
 switch(name){
  case 'list_eligible_members': return {members:['priya','sam','alex'].filter(x=>x!==actor).map(id=>({id}))};
  case 'create_handoff_draft': return domain.createDraft(actor,{title:a.title,details:a.details??'',assigneeId:a.assigneeId,idempotencyKey:a.idempotencyKey});
  case 'get_handoff_case': return domain.visibleCase(actor,a.caseId);
  case 'preview_handoff': return domain.preview(actor,a.caseId,a.version);
  case 'send_approved_handoff': return domain.sendApproved(actor,a.caseId,a.version,a.idempotencyKey);
  case 'list_my_cases': return {cases:domain.listCases(actor)};
  case 'get_case_history': return {events:domain.history(actor,a.caseId)};
  default: throw new DomainError(422,'UNSUPPORTED_TOOL','Tool is not allowed');
 }
}
