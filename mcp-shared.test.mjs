import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOLS,runDomainTool} from './mcp-lite.mjs';
import {RelayDomain,DomainError} from './domain.mjs';

// Ensures BOTH MCP adapters continue to share the same tool name/argument
// contracts and that unknown action names cannot mutate persisted state.
test('seven shared tools have supported schema types and no model approval',()=>{
 assert.equal(TOOLS.length,7);
 assert.equal(new Set(TOOLS.map(t=>t.name)).size,7);
 assert.ok(!TOOLS.some(t=>t.name==='approve_in_first_party_ui'));
 assert.ok(TOOLS.some(t=>t.name==='send_approved_handoff')); // sending does not confer approval
 for(const t of TOOLS){
  assert.equal(t.inputSchema.type,'object');
  assert.equal(t.inputSchema.additionalProperties,false);
  for(const field of Object.values(t.inputSchema.properties))assert.ok(['string','integer'].includes(field.type));
 }
});

test('shared domain tool executor rejects unknown operations safely',()=>{
 const domain=new RelayDomain(':memory:');
 try{
  assert.deepEqual(runDomainTool('list_eligible_members',{},domain,'priya').members,[{id:'sam'},{id:'alex'}]);
  assert.throws(()=>runDomainTool('approve_in_first_party_ui',{},domain,'priya'),e=>e instanceof DomainError&&e.code==='UNSUPPORTED_TOOL'&&e.status===422);
  assert.equal(domain.listCases('priya').length,0);
 }finally{domain.close();}
});
