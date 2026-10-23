// OPTIONAL maintained MCP TypeScript SDK v1 transport adapter.
// Only load when RELAY_MCP_TRANSPORT=official and root npm dependencies installed.
// This adapter uses the SAME RelayDomain; it cannot grant first-party approval.
// CAUTION: source prepared from SDK docs, runtime interoperability must be tested.
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as z from 'zod/v4';
import {DomainError} from './domain.mjs';
import {TOOLS,runDomainTool} from './mcp-lite.mjs';

const makeSchema=(properties)=>Object.fromEntries(Object.entries(properties).map(([name,p])=>{
 let v=p.type==='integer'?z.number().int().min(p.minimum??0):z.string().min(p.minLength??0).max(p.maxLength??10000);
 return [name,v];
}));

function makeServer(domain,actor){
 const server=new McpServer({name:'relaycase',version:'0.15.0'},{capabilities:{tools:{}}});
 for(const tool of TOOLS){
  const schema=makeSchema(tool.inputSchema.properties);
  // Optional properties must stay optional at the SDK validation boundary.
  for(const [name,p] of Object.entries(tool.inputSchema.properties))if(!tool.inputSchema.required.includes(name))schema[name]=schema[name].optional();
  server.registerTool(tool.name,{
   title:tool.name.replaceAll('_',' '),description:tool.description,inputSchema:schema
  },async(args)=>{
   try{
    return {content:[{type:'text',text:JSON.stringify(runDomainTool(tool.name,args,domain,actor))}]};
   }catch(e){
    const code=e instanceof DomainError?e.code:'INTERNAL';
    return {isError:true,content:[{type:'text',text:JSON.stringify({code,message:code==='INTERNAL'?'Unexpected server error':e.message})}]};
   }
  });
 }
 return server;
}

// Use JSON response mode to preserve the deterministic simulated host's
// response parser; no outbound MCP sampling, SSE or server-initiated requests.
export async function serveOfficialMcp(req,res,message,domain,actor){
 const sdkServer=makeServer(domain,actor);
 const transport=new StreamableHTTPServerTransport({
  sessionIdGenerator:undefined,enableJsonResponse:true
 });
 try{
  await sdkServer.connect(transport);
  res.once('close',()=>{Promise.resolve(transport.close()).catch(()=>{});Promise.resolve(sdkServer.close()).catch(()=>{});});
  await transport.handleRequest(req,res,message);
 }catch(e){
  console.error('Official MCP request failed',e?.message);
  if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:message?.id??null,error:{code:-32603,message:'Internal error'}}));}
 }
}
