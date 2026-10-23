// Accessible, synthetic-only, first-party browser client. Secrets remain memory-only.
const state={token:'',actor:'',cases:[],selected:null,notice:'',error:'',assistantHistory:[]};
const root=document.querySelector('#root');
const notify=(msg)=>{document.querySelector('#announcer').textContent=msg;};
const node=(tag,text='',className='')=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
const add=(parent,...children)=>{for(const c of children)if(c)parent.append(c);return parent;};
const btn=(text,fn,cls='')=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const fld=(parent,label,type='text',value='',required=true)=>{
 const wrap=node('div','','field'),id=`field-${Math.random().toString(36).slice(2)}`;
 const lab=node('label',label);lab.htmlFor=id;
 const input=node(type==='textarea'?'textarea':'input');input.id=id;if(type!=='textarea')input.type=type;
 input.value=value;input.required=required;add(wrap,lab,input);parent.append(wrap);return input;
};
const choose=(parent,label,options)=>{
 const wrap=node('div','','field'),lab=node('label',label),s=node('select');s.id='choose-member';lab.htmlFor=s.id;
 options.forEach(o=>{const x=node('option',o);x.value=o;s.append(x);});add(wrap,lab,s);parent.append(wrap);return s;
};
function shell(){root.replaceChildren();const wrapper=node('main','','shell');const head=node('header','','heading');const brand=node('div');
 const mark=node('span','↗','brand-mark');add(brand,mark,node('span','relaycase','brand'));
 add(head,brand,state.actor?btn(`Identity: ${state.actor} · Sign out`,()=>{state.token='';state.actor='';state.selected=null;state.cases=[];state.assistantHistory=[];render();}):node('span','Human decisions · Proven history','subtle'));
 wrapper.append(head);root.append(wrapper);return wrapper;}
function displayMessage(where){if(state.error)where.append(node('p',state.error,'error'));if(state.notice)where.append(node('p',state.notice,'success'));}
function renderLogin(){const app=shell(),box=node('section','','panel centered');
 add(box,node('h1','Responsibility, clearly recorded.'),node('p','This local demo has three fictional people. Enter the separate credential assigned to Priya, Sam or Alex. No real Alexa+ account or service is connected.','muted'));
 const f=node('form');const secret=fld(f,'Demo access credential','password');secret.autocomplete='off';
 const submit=node('button','Unlock synthetic household','primary');submit.type='submit';f.append(submit);
 f.addEventListener('submit',async(e)=>{e.preventDefault();state.error='';try{state.token=secret.value.trim();const me=await request('/api/me');state.actor=me.actor;await refresh();state.notice=`Signed in as ${state.actor} (fictional demo identity)`;render();}catch(err){state.token='';state.error=err.message;renderLogin();}});
 add(box,f,node('p','Credentials are kept only in this open browser tab’s JavaScript memory; they are cleared by sign out or page reload.','helper'));displayMessage(box);app.append(box);
}
async function request(path,body){const init={method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${state.token}`}};
 if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body);}
 const r=await fetch(path,init);let out={};try{out=await r.json();}catch{}if(!r.ok)throw Error(`${out.code||r.status}: ${out.message||'Request failed'}`);return out;}
async function refresh(){const data=await request('/api/cases');state.cases=data.cases;
 if(state.selected)try{state.selected=await request(`/api/cases/${encodeURIComponent(state.selected.id)}`);}catch{state.selected=null;}
}
async function doAction(name,extras={}){const c=state.selected;if(!c)return;
 state.error='';state.notice='';try{const body={version:c.version,...extras};if(!['preview','approve','reassign','edit'].includes(name))body.idempotencyKey=crypto.randomUUID();
 const result=await request(`/api/cases/${encodeURIComponent(c.id)}/${name}`,body);if(name!=='approve')state.selected=result;
 state.notice=name==='approve'?'Human approval recorded. Now press Send invitation.':`Action '${name}' persisted. Refresh the case if anything looks out of date.`;
 await refresh();render();notify(state.notice);}catch(e){state.error=e.message;await refresh();render();notify(state.error);}
}
async function showCase(c){state.selected=await request(`/api/cases/${encodeURIComponent(c.id)}`);state.error='';state.notice='';render();}
async function makeCase(form){const title=form.querySelector('[name=title]').value,details=form.querySelector('[name=details]').value;
 const assigneeId=form.querySelector('[name=assignee]').value;try{state.selected=await request('/api/cases',{title,details,assigneeId,idempotencyKey:crypto.randomUUID()});
 state.notice='Draft saved, but no invitation has been sent.';state.error='';await refresh();render();}catch(e){state.error=e.message;render();}}
function draftForm(box){const section=node('section','','panel');add(section,node('h2','Create a handoff'),node('p','Saving a draft does not invite anyone.','subtle'));
 const form=node('form');const title=fld(form,'What needs doing?');title.name='title';title.maxLength=160;title.minLength=4;title.placeholder='Bring the recycling box inside';
 const details=fld(form,'Optional instructions','textarea','',false);details.name='details';details.maxLength=2000;
 const eligible=['priya','sam','alex'].filter(x=>x!==state.actor);const s=choose(form,'Invitee',eligible);s.name='assignee';const submit=node('button','Save draft','primary');submit.type='submit';form.append(submit);
 form.addEventListener('submit',(e)=>{e.preventDefault();makeCase(form);});section.append(form);box.append(section);}
function actionButtons(panel,c){const actions=node('div','','row');
 const owner=c.requester_id===state.actor,currentAssignee=c.assignee_id===state.actor;
 const openInput=(promptText,callback)=>{const val=window.prompt(promptText);if(val!==null)callback(val);};
 if(owner){
  if(c.status==='DRAFT'){actions.append(btn('Preview request',()=>doAction('preview'),'primary'),btn('Cancel draft',()=>doAction('cancel'),'danger'));}
  if(c.status==='AWAITING_REQUESTER_APPROVAL'){if(!c.humanApprovalReady)actions.append(btn('Approve invitation (human)',()=>doAction('approve'),'primary'));actions.append(btn('Send approved invitation',()=>doAction('send'),'primary'),btn('Cancel',()=>doAction('cancel'),'danger'));}
  if(c.status==='AWAITING_ASSIGNEE_RESPONSE')actions.append(btn('Withdraw unanswered invitation',()=>doAction('withdraw'),'danger'));
  if(c.status==='NEEDS_REASSIGNMENT'){
   actions.append(btn('Reassign and revise',()=>{openInput('New assignee (sam, alex, or priya):',id=>doAction('reassign',{newAssignee:id.trim().toLowerCase()}));},'primary'),btn('End unresolved case',()=>doAction('cancel'),'danger'));
  }
  if(c.status==='CLAIMED_DONE')actions.append(btn('Acknowledge report',()=>doAction('acknowledge'),'primary'),btn('Dispute completion claim',()=>openInput('Describe the discrepancy (8+ characters):',reason=>doAction('dispute',{reason})),'danger'));
 }
 if(currentAssignee&&c.status==='AWAITING_ASSIGNEE_RESPONSE')actions.append(btn('Accept responsibility',()=>doAction('accept'),'primary'),btn('Decline',()=>doAction('decline'),'danger'));
 if(currentAssignee&&c.status==='ACCEPTED')actions.append(btn('Report I finished',()=>doAction('claim'),'primary'));
 if(actions.children.length)panel.append(add(node('div','','stack'),node('h3','Permitted actions for this identity'),actions));
}
function caseDetail(container,c){const box=node('section','','panel stack');add(box,node('span',c.status.replaceAll('_',' '),'pill'),node('h1',c.title));
 if(c.details)box.append(node('p',c.details,'muted'));
 const fact=node('div','','facts');for(const [title,val] of [['Requested by',c.requester_id],['Current invitee',c.assignee_id],['Version',String(c.version)],['Case ID',c.id.slice(0,8)+'…']]){const d=node('div');add(d,node('span',title),node('strong',val));fact.append(d);}box.append(fact);
 const expl=c.status==='CLAIMED_DONE'?'A person reported task completion. That is not independent physical verification.':
 c.status==='CLOSED_ACKNOWLEDGED'?'The requester acknowledged a completion claim; the physical outcome was not independently verified.':
 c.status==='AWAITING_REQUESTER_APPROVAL'?(c.humanApprovalReady?'Human approval has been recorded for this preview. The invitation has not yet been sent.':'This is a preview. Explicit human approval and a separate send action are required.'):
 c.status==='DISPUTED'?'The original completion claim remains in the history. This prototype does not resolve disputes automatically.':
 'Case records distinguish invitations, human commitments, and completion claims.';
 box.append(node('div',expl,'info'));if(c.humanApprovalReady)box.append(node('p','Approval confirmed for this exact preview. Sending is still a separate action.','success'));actionButtons(box,c);
 const timeline=node('section');timeline.append(node('h2','Recorded history'));
 const load=btn('Load history',async()=>{try{const data=await request(`/api/cases/${encodeURIComponent(c.id)}/history`);const ol=node('ol','','timeline');data.events.forEach(ev=>{const li=node('li');add(li,node('strong',ev.kind.replaceAll('_',' ')),node('p',`${ev.at} · ${ev.actor_id||'system'}`));ol.append(li);});timeline.querySelector('ol')?.remove();timeline.append(ol);}catch(e){state.error=e.message;render();}});
 timeline.append(load);box.append(timeline);container.append(box);
}
function assistantPanel(parent){
 const area=node('section','','panel stack assistant-panel');
 add(area,node('h2','Simulated assistant · real MCP tool calls'),
  node('p','Deterministic commands only: no language model, live Alexa+ access or independent physical-world proof. Each supported request calls the local /mcp endpoint.','helper'));
 const transcript=node('div','','assistant-transcript');transcript.setAttribute('aria-label','Assistant messages and MCP call trace');
 for(const h of state.assistantHistory.slice(-8)){
  const bubble=node('div','','assistant-entry');
  add(bubble,node('strong',h.message),node('p',h.answer,h.ok?'muted':'error'));
  if(h.trace?.length){const t=node('details');t.append(node('summary',`Real MCP trace (${h.trace.length} request(s))`));
   const pre=node('pre',JSON.stringify(h.trace,null,2));t.append(pre);bubble.append(t);}
  transcript.append(bubble);
 }
 if(!state.assistantHistory.length)transcript.append(node('p','Try “who can help?” or “draft: Bring the recycling box inside -> sam”.','muted'));
 const form=node('form','','assistant-form');const f=fld(form,'Command to simulated assistant');
 f.name='assistantMessage';f.maxLength=500;f.placeholder='who can help?';
 const send=node('button','Run via MCP','primary');send.type='submit';form.append(send);
 const hint=node('p','Commands: who can help? · show my cases · draft: Task title -> sam · show/preview/send/history case <full UUID>','helper');
 form.addEventListener('submit',async(e)=>{
  e.preventDefault();if(send.disabled)return;send.disabled=true;
  const message=f.value.trim();
  try{
   const r=await fetch('/api/assistant',{method:'POST',headers:{Authorization:`Bearer ${state.token}`,'Content-Type':'application/json'},body:JSON.stringify({message})});
   const out=await r.json();
   state.assistantHistory.push({message,answer:out.answer||`${out.code||r.status}: ${out.message||'Request failed'}`,ok:r.ok,trace:out.trace||[]});
   if(r.ok)await refresh();f.value='';render();notify(out.answer||'Assistant request finished');
  }catch(err){state.assistantHistory.push({message,answer:err.message,ok:false,trace:[]});render();notify(err.message);}
  finally{send.disabled=false;}
 });
 add(area,transcript,form,hint);parent.append(area);
}
function render(){if(!state.actor)return renderLogin();const app=shell();const intro=node('div');add(intro,node('h1','Household handoffs'),node('p','Proof of human agreement, not AI-generated assurance.','subtle'));displayMessage(intro);app.append(intro);
 const grid=node('div','','layout'),sidebar=node('aside','','stack'),main=node('div','','stack');
 const list=node('section','','panel stack');add(list,node('h2',`Cases (${state.cases.length})`));
 if(!state.cases.length)list.append(node('p','No cases visible to this identity.','subtle'));
 state.cases.forEach(c=>{const b=btn('',()=>showCase(c),'case-item'+(state.selected?.id===c.id?' active':''));add(b,node('strong',c.title),node('small',c.status.replaceAll('_',' ')));list.append(b);});
 sidebar.append(list);sidebar.append(btn('New handoff',()=>{state.selected=null;render();},'primary'));
 if(state.selected)caseDetail(main,state.selected);else draftForm(main);
 assistantPanel(main);add(grid,sidebar,main);app.append(grid);
}
render();
