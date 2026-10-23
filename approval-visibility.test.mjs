import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createApp} from './server.mjs';
const users=['priya','sam','alex'];
const t=()=>Object.fromEntries(users.map(u=>[u,randomBytes(32).toString('hex')]));

test('UI approval indicator is server-derived, requester-only, and changes after human action',async()=>{
 const tokens=t(),mcpTokens=t();const app=createApp({tokens,mcpTokens});
 const base=await app.listen();
 const req=async(actor,path,input)=>{
  const r=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Authorization:`Bearer ${tokens[actor]}`,...(input===undefined?{}:{'Content-Type':'application/json'})},body:input===undefined?undefined:JSON.stringify(input)});
  return {status:r.status,body:await r.json()};
 };
 try{
  const d=await req('priya','/api/cases',{title:'Review parcel delivery',assigneeId:'sam',details:'',idempotencyKey:randomUUID()});
  assert.equal(d.status,201);
  const id=d.body.id;
  const p=await req('priya',`/api/cases/${id}/preview`,{version:d.body.version});assert.equal(p.body.humanApprovalReady,false);
  const forbidden=await req('sam',`/api/cases/${id}`);assert.equal(forbidden.status,404);
  const fromBrowser=await req('priya',`/api/cases/${id}/approve`,{version:p.body.version});assert.equal(fromBrowser.status,200);
  const visible=await req('priya',`/api/cases/${id}`);assert.equal(visible.body.humanApprovalReady,true);
  assert.ok(!Object.hasOwn(visible.body,'approvalId'));
  const delivered=await req('priya',`/api/cases/${id}/send`,{version:p.body.version,idempotencyKey:randomUUID()});
  assert.equal(delivered.status,200);
  const consumed=await req('priya',`/api/cases/${id}`);assert.equal(consumed.body.humanApprovalReady,undefined);
  const assignee=await req('sam',`/api/cases/${id}`);assert.equal(assignee.status,200);assert.equal(assignee.body.humanApprovalReady,undefined);
 }finally{await app.close();}
});
