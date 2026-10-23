// RelayCase Pass11: stdlib HTTP + SQLite synthetic local demonstration.
// Not a real Alexa+ integration, official MCP endpoint, or production auth deployment.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {RelayDomain,DomainError} from './domain.mjs';
import {dispatchMcp} from './mcp-lite.mjs';
import {runAssistant} from './assistant-host.mjs';
const DIR=dirname(fileURLToPath(import.meta.url));
const ASSETS={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
const TYPES={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'};
const USERS=['priya','sam','alex'];
const secureCompare=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const safeError=(e)=> e instanceof DomainError?{status:e.status,code:e.code,message:e.message}:
 {status:500,code:'INTERNAL',message:'An unexpected error occurred'};
export const createApp=({dbFile=':memory:',tokens,mcpTokens=null,host='127.0.0.1',port=0,limit=180,allowedOrigins,mcpMode='experimental'}={})=>{
 if(!['experimental','official'].includes(mcpMode))throw Error('Unsupported MCP transport mode');
 if(mcpTokens && (USERS.some(u=>typeof mcpTokens[u]!=='string'||mcpTokens[u].length<24) || new Set(USERS.map(u=>mcpTokens[u])).size!==3 || USERS.some(u=>Object.values(tokens??{}).includes(mcpTokens[u])))) throw Error('Separate, unique MCP credentials required');
 if(!tokens||USERS.some(u=>typeof tokens[u]!=='string'||tokens[u].length<24)||new Set(USERS.map(u=>tokens[u])).size!==3)
   throw Error('Three separate UNIQUE 24+ character demonstration credentials required');
 const domain=new RelayDomain(dbFile);
 const metrics=new Map();
 let address;
 const send=(res,status,data)=>{if(!res.headersSent){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));}};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; base-uri 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  const origin=req.headers.origin;
  const portNum=address?.port??port;
  const allow=allowedOrigins??(
   ['127.0.0.1','localhost','::1'].includes(host)
     ? [`http://127.0.0.1:${portNum}`,`http://localhost:${portNum}`,`http://[::1]:${portNum}`]
     : [`http://${host}:${portNum}`]
  );
  if(origin && !allow.includes(origin))return send(res,403,{code:'BAD_ORIGIN',message:'Browser origin not allowed'});
  let path;
  try{path=new URL(req.url,'http://local').pathname;}catch{return send(res,400,{code:'BAD_PATH'});}
  if(path==='/healthz'&&req.method==='GET')return send(res,200,{status:'ok',mode:'synthetic_demo',mcp:mcpTokens?(mcpMode==='official'?'official_sdk_candidate_requires_independent_test':'experimental_custom_subset_sdk_unverified'):'disabled'});
  if(path==='/mcp'){
   if(!mcpTokens)return send(res,404,{code:'MCP_DISABLED'});
   const header=req.headers.authorization??'';const supplied=header.startsWith('Bearer ')?header.slice(7):'';
   const mcpActor=USERS.find(u=>secureCompare(supplied,mcpTokens[u]));
   if(!mcpActor)return send(res,401,{code:'UNAUTHENTICATED'});
   if(req.method==='GET'||req.method==='DELETE'){res.setHeader('Allow','POST');return send(res,405,{code:'SSE_NOT_SUPPORTED'});}
   if(req.method!=='POST')return send(res,405,{code:'METHOD_NOT_ALLOWED'});
   if(!(req.headers.accept??'').includes('application/json')||!(req.headers.accept??'').includes('text/event-stream'))return send(res,406,{code:'ACCEPT_REQUIRED'});
   if(!(req.headers['content-type']??'').toLowerCase().startsWith('application/json'))return send(res,415,{code:'JSON_REQUIRED'});
   const len=Number(req.headers['content-length']);if(Number.isFinite(len)&&len>16384)return send(res,413,{code:'TOO_LARGE'});
   let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>16384)return send(res,413,{code:'TOO_LARGE'});}
   let message;try{message=JSON.parse(raw);}catch{ return send(res,400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
   if(mcpMode==='official'){
    let serveOfficialMcp;
    try {({serveOfficialMcp}=await import('./mcp-official.mjs'));}
    catch(e){console.error('Official SDK load failure',e?.code||e?.message);return send(res,503,{code:'MCP_SDK_NOT_INSTALLED',message:'Install pinned npm dependencies before using official transport'});}
    return serveOfficialMcp(req,res,message,domain,mcpActor);
   }
   const out=dispatchMcp(message,domain,mcpActor,req.headers['mcp-protocol-version']);
   if(out.status===202){res.statusCode=202;return res.end();}
   return send(res,out.status,out.body);
  }
  if(req.method==='GET' && ASSETS[path]){
   const f=ASSETS[path];res.statusCode=200;res.setHeader('Content-Type',TYPES[f.split('.').at(-1)]);res.end(readFileSync(join(DIR,f)));return;
  }
  if(!path.startsWith('/api/'))return send(res,404,{code:'NOT_FOUND'});
  const auth=req.headers.authorization??'';
  const provided=auth.startsWith('Bearer ')?auth.slice(7):'';
  const actor=USERS.find(u=>secureCompare(provided,tokens[u]));
  if(!actor)return send(res,401,{code:'UNAUTHENTICATED',message:'Enter a valid demo identity credential'});
  // Scope-level local limiter, not a substitute for production abuse protection.
  const bucket=createHash('sha256').update(provided).digest('hex');const now=Date.now();
  const state=metrics.get(bucket)??{n:0,until:now+60000};
  if(now>state.until){state.n=0;state.until=now+60000;}
  state.n++;metrics.set(bucket,state);
  if(state.n>limit)return send(res,429,{code:'RATE_LIMIT',message:'Too many requests; retry later'});
  if(metrics.size>1024)for(const [k,v] of metrics){if(v.until<now)metrics.delete(k);}
  try{
   const segments=path.split('/').filter(Boolean);
   if(req.method==='GET'){
    if(path==='/api/me')return send(res,200,{actor,synthetic:true});
    if(path==='/api/members')return send(res,200,{members:USERS.filter(x=>x!==actor).map(id=>({id}))});
    if(path==='/api/cases')return send(res,200,{cases:domain.listCases(actor)});
    if(segments.length===3&&segments[1]==='cases')return send(res,200,domain.visibleCase(actor,segments[2]));
    if(segments.length===4&&segments[1]==='cases'&&segments[3]==='history')return send(res,200,{events:domain.history(actor,segments[2])});
    return send(res,404,{code:'NOT_FOUND'});
   }
   if(req.method!=='POST')return send(res,405,{code:'METHOD_NOT_ALLOWED'});
   if(!(req.headers['content-type']??'').toLowerCase().startsWith('application/json'))return send(res,415,{code:'JSON_REQUIRED'});
   const length=Number(req.headers['content-length']);
   if(Number.isFinite(length)&&length>16384)return send(res,413,{code:'TOO_LARGE'});
   let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>16384)return send(res,413,{code:'TOO_LARGE'});}
   let input;try{input=JSON.parse(raw||'{}');}catch{return send(res,400,{code:'BAD_JSON'});}
   if(!input||typeof input!=='object'||Array.isArray(input))return send(res,422,{code:'BAD_BODY'});
   if(path==='/api/assistant'){
    if(!mcpTokens)return send(res,503,{code:'MCP_DISABLED',message:'MCP must be enabled for the simulated assistant.'});
    if(Object.keys(input).some(k=>k!=='message')||typeof input.message!=='string')return send(res,422,{code:'BAD_ASSISTANT_INPUT'});
    const result=await runAssistant({message:input.message,baseUrl:`http://${host}:${address.port}`,token:mcpTokens[actor]});
    return send(res,result.ok?200:422,result);
   }
   if(path==='/api/cases')return send(res,201,domain.createDraft(actor,input));
   if(segments.length!==4||segments[1]!=='cases')return send(res,404,{code:'NOT_FOUND'});
   const cid=segments[2], action=segments[3], version=input.version, key=input.idempotencyKey;
   const routes={
    preview:()=>domain.preview(actor,cid,version),
    approve:()=>domain.approveInFirstPartyUi(actor,cid,version),
    send:()=>domain.sendApproved(actor,cid,version,key),
    accept:()=>domain.accept(actor,cid,version,key),
    decline:()=>domain.decline(actor,cid,version,key),
    claim:()=>domain.claimDone(actor,cid,version,key),
    acknowledge:()=>domain.acknowledge(actor,cid,version,key),
    withdraw:()=>domain.withdraw(actor,cid,version,key),
    cancel:()=>domain.cancel(actor,cid,version,key),
    dispute:()=>domain.dispute(actor,cid,version,input.reason,key),
    reassign:()=>domain.reassign(actor,cid,version,input.newAssignee),
    edit:()=>domain.editUnsent(actor,cid,version,input),
   };
   if(!routes[action])return send(res,404,{code:'NOT_FOUND'});
   return send(res,200,routes[action]());
  }catch(e){const safe=safeError(e);if(safe.status===500)console.error('RelayCase server error',e?.message);return send(res,safe.status,{code:safe.code,message:safe.message});}
 });
 return {
  server,domain,
  async listen(){await new Promise(resolve=>server.listen(port,host,resolve));address=server.address();return `http://${host}:${address.port}`;},
  async close(){await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));domain.close();}
 };
};
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const tokens={};
 for(const u of USERS){const v=process.env[`RELAY_UI_${u.toUpperCase()}`];if(!v||v.length<24)throw Error(`Set RELAY_UI_${u.toUpperCase()} to a long unique demo credential`);tokens[u]=v;}
 const mcpNames=USERS.map(u=>process.env[`RELAY_MCP_${u.toUpperCase()}`]);
 if(mcpNames.some(Boolean)&&!mcpNames.every(Boolean))throw Error('All three RELAY_MCP_* credentials required together');
 const mcpTokens=mcpNames.every(Boolean)?Object.fromEntries(USERS.map((u,i)=>[u,mcpNames[i]])):null;
 const app=createApp({dbFile:process.env.RELAY_DB||'./relaycase-demo.sqlite',tokens,mcpTokens,port:Number(process.env.PORT||3000),mcpMode:process.env.RELAY_MCP_TRANSPORT||'experimental'});
 const url=await app.listen();console.log(`RelayCase LOCAL SYNTHETIC demo running at ${url}`);
 console.log('Demo identities: Priya, Sam, Alex. Enter each identity credential in browser. No Alexa+ integration.');
 process.on('SIGINT',async()=>{await app.close();process.exit(0);});
}
