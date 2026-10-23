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

try:
 for attempt in range(60):
  if proc.poll() is not None:raise RuntimeError('node server exited')
  try:
   http('/healthz',{});break
  except Exception:time.sleep(.1)
 else:raise RuntimeError('node did not start')
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page,errors=new_page(browser,1440,900)
  login(page,'priya')
  # Exercise the DOM's actual assistant submit, the real Node /api/assistant route,
  # and Node server -> real HTTP /mcp loopback tool invocation + shared SQLite.
  page.get_by_label('Command to simulated assistant').fill('who can help?')
  page.get_by_role('button',name='Run via MCP').click()
  expect(page.locator('.assistant-transcript')).to_contain_text('Available fictional household members')
  assert 'Real MCP trace' in page.locator('.assistant-transcript').inner_text()
  page.get_by_label('Command to simulated assistant').fill('draft: Check the side gate latch -> sam')
  page.get_by_role('button',name='Run via MCP').click()
  expect(page.locator('.assistant-transcript')).to_contain_text('Saved draft')
  expect(page.locator('aside')).to_contain_text('Check the side gate latch')
  page.get_by_label('What needs doing?').fill('Bring the parcel box indoors')
  page.get_by_label('Optional instructions').fill('The package is behind the porch bench.')
  page.get_by_label('Invitee').select_option('sam')
  page.get_by_role('button',name='Save draft').click()
  page.get_by_role('button',name='Preview request').click()
  expect(page.get_by_role('button',name='Approve invitation (human)')).to_be_visible()
  page.get_by_role('button',name='Approve invitation (human)').click()
  expect(page.locator('#root p.success')).to_be_visible()
  page.get_by_role('button',name='Send approved invitation').click()
  expect(page.locator('main')).to_contain_text('AWAITING ASSIGNEE RESPONSE')
  page.screenshot(path=str(P/'pass13_desktop_assistant_workflow.png'),full_page=True)
  logout(page);login(page,'sam')
  page.get_by_role('button',name=re.compile('Bring the parcel box indoors')).click()
  page.get_by_role('button',name='Accept responsibility').click()
  expect(page.get_by_role('button',name='Report I finished')).to_be_visible()
  page.get_by_role('button',name='Report I finished').click()
  expect(page.locator('main')).to_contain_text('CLAIMED DONE')
  logout(page);login(page,'priya')
  page.get_by_role('button',name=re.compile('Bring the parcel box indoors')).click()
  page.get_by_role('button',name='Acknowledge report').click()
  expect(page.locator('main')).to_contain_text('CLOSED ACKNOWLEDGED')
  page.get_by_role('button',name='Load history').click()
  expect(page.locator('ol.timeline')).to_contain_text('COMPLETION CLAIMED')
  assert 'not independently verified' in page.locator('main').inner_text().lower()
  assert not errors,errors
  page.close()
  mobile,errors=new_page(browser,390,844)
  login(mobile,'priya')
  mobile.get_by_label('Command to simulated assistant').fill('who can help?')
  mobile.get_by_role('button',name='Run via MCP').click()
  expect(mobile.locator('.assistant-transcript')).to_contain_text('Available fictional household members')
  assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
  mobile.screenshot(path=str(P/'pass13_mobile_assistant.png'),full_page=True)
  assert not errors,errors
  mobile.close()
  browser.close()
 print('PASS: Chromium UI simulated assistant -> server -> actual local MCP HTTP -> SQLite, plus manual Priya -> Sam -> Priya')
 print('PASS: 1440px desktop screenshot; 390px authenticated mobile screenshot')
 print('PASS: no JavaScript page errors, status truthfulness and mobile overflow check')
 print('LIMITATION: browser requests were bridged by Playwright/Python into real Node HTTP because direct Chromium loopback navigation is blocked')
finally:
 proc.terminate()
 try:proc.wait(timeout=5)
 except subprocess.TimeoutExpired:proc.kill()
 LOG.close()
