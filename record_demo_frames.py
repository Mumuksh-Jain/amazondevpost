"""Actual Chromium UI DOM events bridged to the actual Node HTTP API by Playwright Python.
NOTE browser-to-localhost native navigation is blocked in this environment: this is NOT
an unmodified end-to-end browser networking test. No fake JSON/database results.
"""
import os, subprocess, pathlib, secrets, time, socket, json, re, urllib.request, urllib.error, contextlib
from playwright.sync_api import sync_playwright, expect
P=pathlib.Path(__file__).parent
TOKENS={name:secrets.token_hex(32) for name in ('priya','sam','alex')}
MCP={name:secrets.token_hex(32) for name in ('priya','sam','alex')}
with socket.socket() as s:
 s.bind(('127.0.0.1',0));PORT=s.getsockname()[1]
ENV=os.environ.copy();ENV.update({f'RELAY_UI_{k.upper()}':v for k,v in TOKENS.items()});ENV.update({f'RELAY_MCP_{k.upper()}':v for k,v in MCP.items()});ENV['PORT']=str(PORT);ENV['RELAY_DB']=':memory:'
LOG=open(P/'pass13_node_backend.log','w')
proc=subprocess.Popen(['node','server.mjs'],cwd=P,env=ENV,stdout=LOG,stderr=subprocess.STDOUT)
BASE=f'http://127.0.0.1:{PORT}'

def http(path,init):
 headers=init.get('headers',{})
 body=init.get('body')
 req=urllib.request.Request(BASE+path,data=body.encode() if body is not None else None,headers=headers,method=init.get('method','GET'))
 try:
  with urllib.request.urlopen(req,timeout=5) as r:raw=r.read();status=r.status
 except urllib.error.HTTPError as e:raw=e.read();status=e.code
 return {'status':status,'body':json.loads(raw.decode()) if raw else {}}

def new_page(browser,w,h):
 page=browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 # Browser loads source as in-memory document because the administrator blocks loopback navigation.
 html=(P/'index.html').read_text();html=re.sub(r'<link\s+rel="stylesheet"[^>]+>','',html);html=re.sub(r'<script\s+type="module"\s+src="/app.js"></script>','',html)
 page.set_content(html)
 page.add_style_tag(content=(P/'style.css').read_text())
 page.expose_function('relayActualBackend',http)
 page.evaluate('''() => {
  window.fetch=async (path, init={}) => {
   const r=await window.relayActualBackend(path,init);
   return new Response(JSON.stringify(r.body),{status:r.status, headers:{'Content-Type':'application/json'}});
  };
  if(!crypto.randomUUID) crypto.randomUUID=()=> Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 }''')
 page.add_script_tag(content=(P/'app.js').read_text())
 assert not errors,errors
 return page,errors

def login(page,name):
 page.get_by_label('Demo access credential').fill(TOKENS[name]);page.get_by_role('button',name='Unlock synthetic household').click()
 page.get_by_role('heading',name='Household handoffs').wait_for()
 assert f'Identity: {name}' in page.locator('header').inner_text()

def logout(page):page.locator('header button').click();page.get_by_role('button',name='Unlock synthetic household').wait_for()


OUT=P/'recording_frames';OUT.mkdir(exist_ok=True)
shots=[]
def capture(page,title,caption,seconds=6):
    file=OUT/f'{len(shots):02d}.png'
    page.screenshot(path=str(file),full_page=False,animations='disabled')
    shots.append({'file':file.name,'title':title,'caption':caption,'seconds':seconds})
try:
 for attempt in range(60):
  if proc.poll() is not None: raise RuntimeError('Node backend failed')
  try:http('/healthz',{});break
  except Exception:time.sleep(.1)
 else:raise RuntimeError('node backend did not start')
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page,errors=new_page(browser,1440,900)
  capture(page,'RelayCase','A simulated Alexa+ household responsibility assistant',5)
  login(page,'priya')
  capture(page,'A shared household workbench','An authenticated requester sees their own cases.',5)
  page.get_by_label('Command to simulated assistant').fill('who can help?')
  page.get_by_role('button',name='Run via MCP').click()
  expect(page.locator('.assistant-transcript')).to_contain_text('Available fictional household members')
  capture(page,'Assistant invokes a real local MCP tool','Tool discovery is visible; no Alexa+ or LLM connection is claimed.',7)
  page.get_by_label('Command to simulated assistant').fill('draft: Bring the parcel box indoors -> sam')
  page.get_by_role('button',name='Run via MCP').click()
  expect(page.locator('.assistant-transcript')).to_contain_text('Saved draft')
  capture(page,'Draft created through MCP','A draft is not an invitation. No one has agreed yet.',7)
  page.get_by_role('button',name=re.compile('Bring the parcel box indoors')).click()
  page.get_by_role('button',name='Preview request').click()
  expect(page.get_by_role('button',name='Approve invitation (human)')).to_be_visible()
  capture(page,'Preview is awaiting approval','The model-facing tool cannot approve on someone else’s behalf.',7)
  page.get_by_role('button',name='Send approved invitation').click()
  expect(page.locator('main')).to_contain_text('APPROVAL_REQUIRED')
  capture(page,'Unauthorized send blocked','The server rejects the send without a fresh human approval.',7)
  page.get_by_role('button',name='Approve invitation (human)').click()
  expect(page.get_by_text('Approval confirmed for this exact preview.',exact=False)).to_be_visible()
  capture(page,'Separate human approval','Priya authorizes the exact request using the first-party interface.',7)
  page.get_by_role('button',name='Send approved invitation').click()
  expect(page.locator('main')).to_contain_text('AWAITING ASSIGNEE RESPONSE')
  capture(page,'Request sent and persisted','An invitation exists, but Sam has not accepted responsibility.',7)
  logout(page);login(page,'sam')
  page.get_by_role('button',name=re.compile('Bring the parcel box indoors')).click()
  capture(page,'Sam sees the invitation','Separate synthetic identity; no inferred or automatic acceptance.',6)
  page.get_by_role('button',name='Accept responsibility').click()
  expect(page.get_by_role('button',name='Report I finished')).to_be_visible()
  capture(page,'Responsibility accepted','Acceptance is recorded as a human action.',6)
  page.get_by_role('button',name='Report I finished').click()
  expect(page.locator('main')).to_contain_text('CLAIMED DONE')
  capture(page,'Completion reported, not independently verified','RelayCase preserves the difference between a claim and proof.',7)
  logout(page);login(page,'priya')
  page.get_by_role('button',name=re.compile('Bring the parcel box indoors')).click()
  page.get_by_role('button',name='Acknowledge report').click()
  expect(page.locator('main')).to_contain_text('CLOSED ACKNOWLEDGED')
  capture(page,'Requester acknowledges the report','A complete audit trail survives across people and sessions.',7)
  page.get_by_role('button',name='Load history').click()
  expect(page.locator('ol.timeline')).to_contain_text('COMPLETION CLAIMED')
  capture(page,'Evidence-first audit timeline','Events originate in the persisted SQLite database.',7)
  assert not errors,errors
  mobile,merr=new_page(browser,390,844)
  login(mobile,'priya')
  mobile.get_by_role('button',name=re.compile('Bring the parcel box indoors')).click()
  assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
  # record mobile at its actual resolution; compositing will preserve aspect ratio.
  capture(mobile,'Responsive mobile interface','The same authenticated case remains visible on small screens.',6)
  assert not merr,merr
  mobile.close();page.close();browser.close()
 print(json.dumps({'result':'PASS','screens':len(shots),'captions':shots,'captureMethod':'Chromium DOM interactions bridged to the real local Node HTTP server'},default=str,indent=2))
 (OUT/'shots.json').write_text(json.dumps(shots,indent=2))
finally:
 proc.terminate()
 try:proc.wait(timeout=5)
 except subprocess.TimeoutExpired:proc.kill()
 LOG.close()
