// Pass 16 release dry run: independent real-loopback HTTP, no npm packages.
// Uses fictional identities and a throwaway SQLite database; it never prints credentials.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';

const people=['priya','sam','alex'];
const makeTokens=()=>Object.fromEntries(people.map(u=>[u,randomBytes(32).toString('hex')]));
const tokens=makeTokens(),mcpTokens=makeTokens();
const dir=mkdtempSync(join(tmpdir(),'relaycase-judge-'));
const dbFile=join(dir,'cases.sqlite');
const checks=[];
let app,base;
const pass=(name)=>checks.push(name);
async function call(actor,path,body,options={}){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${tokens[actor]}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...options.headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});
 const parsed=await response.json();return {status:response.status,body:parsed};
}
async function command(actor,message){return call(actor,'/api/assistant',{message});}
async function start(){app=createApp({dbFile,tokens,mcpTokens,host:'127.0.0.1',port:0});base=await app.listen();}
try{
 await start();
 const health=await fetch(base+'/healthz');assert.equal(health.status,200);pass('Loopback application health');
 const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/relaycase/i);pass('Real HTML asset served');
 const anonymous=await fetch(base+'/api/cases');assert.equal(anonymous.status,401);pass('Anonymous access refused');
 const wrongOrigin=await call('priya','/api/cases',undefined,{headers:{Origin:'https://attacker.invalid'}});assert.equal(wrongOrigin.status,403);pass('Cross-origin request refused');
 const members=await command('priya','who can help?');assert.equal(members.status,200);assert.ok(members.body.trace?.some(t=>t.tool==='list_eligible_members'));pass('Assistant invoked MCP members tool');
 const created=await command('priya','draft: Return the borrowed library book -> sam');assert.equal(created.status,200);const id=created.body.result.id;assert.ok(id);pass('Assistant MCP tool created persisted draft');
 const unauthorized=await call('alex',`/api/cases/${id}`);assert.equal(unauthorized.status,404);pass('Unrelated identity cannot read case');
 const preview=await command('priya',`preview case ${id}`);assert.equal(preview.status,200);assert.equal(preview.body.result.status,'AWAITING_REQUESTER_APPROVAL');pass('Preview created through MCP');
 const before=await command('priya',`send case ${id}`);assert.equal(before.status,422);assert.match(before.body.answer,/APPROVAL_REQUIRED/);pass('MCP cannot bypass human approval');
 const approved=await call('priya',`/api/cases/${id}/approve`,{version:preview.body.result.version});assert.equal(approved.status,200);pass('Separate first-party requester approval recorded');
 const sent=await command('priya',`send case ${id}`);assert.equal(sent.status,200);assert.equal(sent.body.result.status,'AWAITING_ASSIGNEE_RESPONSE');pass('MCP send succeeds only after approval');
 const invited=await call('sam',`/api/cases/${id}`);assert.equal(invited.status,200);assert.equal(invited.body.status,'AWAITING_ASSIGNEE_RESPONSE');pass('Assignee sees invitation');
 const accepted=await call('sam',`/api/cases/${id}/accept`,{version:invited.body.version,idempotencyKey:randomUUID()});assert.equal(accepted.status,200);assert.equal(accepted.body.status,'ACCEPTED');pass('Human assignee accepts');
 const claimed=await call('sam',`/api/cases/${id}/claim`,{version:accepted.body.version,idempotencyKey:randomUUID()});assert.equal(claimed.status,200);assert.equal(claimed.body.status,'CLAIMED_DONE');pass('Assignee reports rather than proves completion');
 const acknowledged=await call('priya',`/api/cases/${id}/acknowledge`,{version:claimed.body.version,idempotencyKey:randomUUID()});assert.equal(acknowledged.status,200);assert.equal(acknowledged.body.status,'CLOSED_ACKNOWLEDGED');pass('Requester acknowledges human completion claim');
 const events=await call('priya',`/api/cases/${id}/history`);assert.equal(events.status,200);assert.ok(events.body.events.length>=6);pass('Persisted audit history readable');
 const leaked=JSON.stringify({members,created,events});for(const secret of Object.values({...tokens,...mcpTokens}))assert.ok(!leaked.includes(secret));pass('Results do not contain authentication secrets');
 await app.close();app=null;await start();
 const afterRestart=await call('priya',`/api/cases/${id}`);assert.equal(afterRestart.status,200);assert.equal(afterRestart.body.status,'CLOSED_ACKNOWLEDGED');pass('Database retains case after server restart');
 const afterHistory=await call('priya',`/api/cases/${id}/history`);assert.deepEqual(afterHistory.body.events.map(e=>e.id),events.body.events.map(e=>e.id));pass('Audit history stable after restart');
 console.log(JSON.stringify({result:'PASS',test:'RelayCase independent judge dry run',checks:checks.length,transport:'custom 2025-11-25-shaped HTTP MCP subset',mode:'deterministic simulated assistant, no Alexa+ or external LLM',caseStatus:afterRestart.body.status,checklist:checks},null,2));
}catch(err){console.error(JSON.stringify({result:'FAIL',completedChecks:checks.length,error:err.message,checks},null,2));process.exitCode=1;}
finally{if(app)await app.close().catch(()=>{});rmSync(dir,{recursive:true,force:true});}
