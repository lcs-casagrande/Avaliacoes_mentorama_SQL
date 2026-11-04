'use strict';
// Apresentação compacta opcional; os contratos de dados e autorização são os mesmos.
window.IASDPIScheduleUI=(()=>{
 const isReview=()=>Boolean(window.IASDPIKnownPreviewSeed?.review_ready||window.IASDPIPortalAccess?.enabled());
 function help(id,text,label='Ajuda sobre a escala'){return `<span class="scale-help-control schedule-help-control"><button type="button" class="scale-help-button" aria-label="${esc(label)}" aria-controls="${esc(id)}" aria-describedby="${esc(id)}" aria-expanded="false">?</button><span id="${esc(id)}" role="tooltip" hidden>${esc(text)}</span></span>`;}
 function feedback(text){if(!isReview())return text;return String(text||'').replace(/Alterações confirmadas (?:apenas na memória desta demonstração|somente na memória desta demonstração)\./g,'Alterações salvas nesta aba.').replace('Abra Ver no calendário.','').replace(/Proposta editável: (\d+) vagas sugeridas; (\d+) pendentes\. Atribuições existentes preservadas\. Revise antes de salvar ou publicar\./,'$1 vagas sugeridas · $2 pendentes.').replace(/Proposta editável: (\d+) períodos sugeridos\. Revise antes de salvar\./,'$1 períodos sugeridos.').trim();}
 function departments(catalog){if(window.IASDPIPortalAccess?.enabled()){const priority=IASDPIPortalAccess.departments().map(d=>d.id);return catalog.departments.filter(d=>d.active&&(d.can_manage||d.can_roster)).sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));}const rows=catalog.departments.filter(d=>d.active&&(d.can_manage||d.can_roster));if(!isReview())return rows;const main=['sonoplastia','ancionato','comunicacao','ministerio-da-familia','ministerio-da-crianca','musica'];return main.map(code=>rows.find(d=>d.code===code)).filter(Boolean);}
 const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 let pendingFocus='';
 const monthLabel=value=>months[Number(value.slice(5))-1]+' de '+value.slice(0,4);
 function monthPicker(id,value,disabled=false){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||Number(value.slice(0,4))<1000||Number(value.slice(0,4))>9998)throw Error('Mês inválido.');
  return `<div class="schedule-month-picker" data-month-picker="${esc(id)}" data-picker-year="${value.slice(0,4)}"><span class="schedule-picker-label" id="${esc(id)}-label">Mês e ano</span><input type="hidden" id="${esc(id)}" name="month" value="${esc(value)}" ${disabled?'disabled':''}><button type="button" class="schedule-month-trigger" data-month-open aria-labelledby="${esc(id)}-label ${esc(id)}-value" aria-haspopup="dialog" aria-controls="${esc(id)}-popup" aria-expanded="false" ${disabled?'disabled':''}><span id="${esc(id)}-value" data-month-label>${esc(monthLabel(value))}</span><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 10h18M8 3v5M16 3v5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><div class="schedule-month-popup" id="${esc(id)}-popup" role="dialog" aria-label="Escolher mês e ano" hidden><div class="schedule-picker-year"><button type="button" data-month-year="-1" aria-label="Ano anterior">‹</button><strong data-picker-year-label>${value.slice(0,4)}</strong><button type="button" data-month-year="1" aria-label="Próximo ano">›</button></div><div class="schedule-picker-months">${months.map((name,index)=>`<button type="button" data-month-option="${String(index+1).padStart(2,'0')}" aria-pressed="${index+1===Number(value.slice(5))}">${name}</button>`).join('')}</div></div></div>`;
 }
 function yearSelect(id,value,disabled=false){const year=Number(value);return `<label>Ano<select id="${esc(id)}" name="year" data-auto-year ${disabled?'disabled':''}>${Array.from({length:11},(_,i)=>year-5+i).filter(y=>y>=1000&&y<=9998).map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>`;}
 function updatePicker(host,value){
  const input=host.querySelector('input');if(value){input.value=value;host.dataset.pickerYear=value.slice(0,4);host.querySelector('[data-month-label]').textContent=monthLabel(value);}
  const year=Number(host.dataset.pickerYear);host.querySelector('[data-picker-year-label]').textContent=year;
  host.querySelectorAll('[data-month-option]').forEach(button=>button.setAttribute('aria-pressed',String(year+'-'+button.dataset.monthOption===input.value)));
  host.querySelector('[data-month-year="-1"]').disabled=year<=1000;host.querySelector('[data-month-year="1"]').disabled=year>=9998;
 }
 function closePicker(host,focus=false){host.querySelector('[role=dialog]').hidden=true;host.querySelector('[data-month-open]').setAttribute('aria-expanded','false');if(focus)host.querySelector('[data-month-open]').focus({preventScroll:true});}
 function restoreMonth(form,value){const host=form.querySelector('[data-month-picker]');if(host){updatePicker(host,value);closePicker(host,true);pendingFocus='';}}
 function mount(){if(!pendingFocus)return;const year=document.getElementById(pendingFocus);if(year?.matches('[data-auto-year]')){pendingFocus='';year.focus({preventScroll:true});return;}const host=document.querySelector('[data-month-picker="'+pendingFocus+'"]');if(host){pendingFocus='';host.querySelector('[data-month-open]').focus({preventScroll:true});}}
 document.addEventListener('click',e=>{
  const host=e.target.closest('[data-month-picker]');document.querySelectorAll('[data-month-picker]').forEach(other=>{if(other!==host)closePicker(other);});if(!host||host.querySelector('input').disabled)return;
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-month-open')){const popup=host.querySelector('[role=dialog]'),open=popup.hidden;if(open){updatePicker(host,host.querySelector('input').value);popup.hidden=false;button.setAttribute('aria-expanded','true');host.querySelector('[data-month-option][aria-pressed=true]')?.focus();}else closePicker(host);return;}
  if(button.hasAttribute('data-month-year')){const year=Number(host.dataset.pickerYear)+Number(button.dataset.monthYear);if(year>=1000&&year<=9998){host.dataset.pickerYear=year;updatePicker(host);}return;}
  if(button.hasAttribute('data-month-option')){const input=host.querySelector('input'),value=host.dataset.pickerYear+'-'+button.dataset.monthOption;if(value===input.value){closePicker(host,true);return;}pendingFocus=host.dataset.monthPicker;input.value=value;closePicker(host);host.querySelector('[data-month-label]').textContent=monthLabel(value);input.dispatchEvent(new Event('change',{bubbles:true}));mount();}
 });
 document.addEventListener('change',e=>{if(!e.target.matches('[data-month-picker] input,[data-auto-year]'))return;const form=e.target.closest('form');if(form?.matches('#b1-scope,#elder-month,#elder-year')){if(e.target.matches('[data-auto-year]'))pendingFocus=e.target.id;form.requestSubmit();mount();}});
 document.addEventListener('keydown',e=>{
  const host=e.target.closest('[data-month-picker]');if(!host||host.querySelector('[role=dialog]').hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker(host,true);return;}
  if(e.target.hasAttribute('data-month-option')){const buttons=[...host.querySelectorAll('[data-month-option]')],index=buttons.indexOf(e.target),delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3}[e.key];if(delta||e.key==='Home'||e.key==='End'){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?11:(index+delta+12)%12].focus();}}
 });
 document.addEventListener('focusout',e=>{const host=e.target.closest('[data-month-picker]');if(host&&e.relatedTarget&&!host.contains(e.relatedTarget))closePicker(host);});
 return {isReview,help,feedback,departments,monthPicker,monthLabel,yearSelect,restoreMonth,mount};
})();
// B1.2: motor puro de proposta. A confirmação transacional continua no PostgreSQL.
window.IASDPIScheduleEditWindow=(()=>{
 const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function bounds(settings={}){const today=settings.editable_from||settings.today||localDay(),month=today.slice(0,7),count=Number(settings.planning_months)||1,last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+count+1,0);return {from:today,until:settings.editable_until||last.toISOString().slice(0,10),month};}
 function day(date,settings){if(!settings?.schedule_edit_policy)return true;const b=bounds(settings);return Boolean(date&&date>=b.from&&date<=b.until);}
 function month(value,settings){if(!settings?.schedule_edit_policy)return true;const b=bounds(settings);return value>=b.month&&value<=b.until.slice(0,7);}
 function period(row,settings){if(!settings?.schedule_edit_policy)return true;const b=bounds(settings);return row.ends_on>=b.from&&row.starts_on<=b.until;}
 return {bounds,day,month,period};
})();
window.IASDPIScheduleRotation=(()=>{
 const editWindow=window.IASDPIScheduleEditWindow||{day:()=>true,bounds:()=>({})};
 const event=(s,r)=>s.events.find(e=>e.id===r.event_id);
 function days(s,r,a){
  if(a?.timing_mode==='timed'&&a.starts_at&&a.ends_at){
   const local=value=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
   // Date.parse corta microssegundos; só recua se não houver fração residual.
   const residual=/\.(\d+)/.exec(a.ends_at)?.[1]?.slice(3)||'',first=local(a.starts_at),last=local(new Date(Date.parse(a.ends_at)-(/[1-9]/.test(residual)?0:1))),out=[];
   for(let d=new Date(first+'T12:00:00Z');d.toISOString().slice(0,10)<=last;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));return out;
  }
  return event(s,r)?[event(s,r).scheduled_on]:[];
 }
 function usage(s,person,skip){const month=s.context?.month?.slice(0,7)||s.events[0]?.scheduled_on.slice(0,7);return new Set(s.plan.requirements.flatMap(r=>r.assignments.filter(a=>a.person_id===person&&a.id!==skip).flatMap(a=>days(s,r,a))).filter(day=>day.slice(0,7)===month));}
 function reasons(s,r,person,skip,manual=false){
  const p=s.catalog.people.find(p=>p.id===person),member=s.catalog.memberships.find(m=>m.person_id===person&&m.department_id===s.department),role=s.catalog.roles.find(role=>role.id===r.role_id),context=s.context?.people.find(p=>p.person_id===person),date=event(s,r)?.scheduled_on,out=[];
  if(!p?.active)out.push('Pessoa inativa');
  if(!member?.active)out.push('Sem vínculo ativo');
  if(!role?.active||role.department_id!==s.department||((!role.general_assignment||(s.context?.central_registry&&!manual))&&!s.catalog.qualifications.some(q=>q.membership_id===member?.id&&q.role_id===r.role_id)))out.push('Sem habilitação para a função — Pendente de confirmação');
  if(s.context?.central_registry&&!manual&&member?.participation_confirmed!==true)out.push('Participação — Pendente de confirmação');
  if(!date)out.push('Evento não encontrado');
  if(!editWindow.day(date,s.context))out.push(date<editWindow.bounds(s.context).from?'Data encerrada':'Data fora do período de edição');
  const detail=context?.days.find(d=>d.date===date);
  const advisory=manual&&s.context?.availability_advisory,defaultAvailable=!s.context?.central_registry&&s.context?.availability_default==='available';
  if(s.context?.availability_enabled!==false&&!advisory&&detail?.state!=='available'&&!(defaultAvailable&&(!detail?.state||detail.state==='unknown')))out.push(detail?.state==='unavailable'?'Indisponível nesta data':'Disponibilidade desconhecida — Pendente de confirmação');
  if(detail?.conflict)out.push('Conflito com outro departamento nesta data');
  if((s.batchAssignments||[]).some(a=>a.person_id===person&&a.date===date&&a.department_id!==s.department))out.push('Conflito com proposta deste lote em outro departamento');
  if(r.assignments.some(a=>a.person_id===person&&a.id!==skip))out.push('Já ocupa esta função no evento');
  const used=usage(s,person,skip);if(date)used.add(date);
  const global=new Set([...(context?.global_days||[]),...used]),department=new Set([...(context?.department_days||[]),...used]);
  if(!advisory&&p?.max_monthly_count!=null&&global.size>p.max_monthly_count)out.push('Limite mensal da pessoa atingido');
  if(!advisory&&member?.max_monthly_count!=null&&department.size>member.max_monthly_count)out.push('Limite mensal do departamento atingido');
  return out;
 }
 function candidates(s,r,skip){return s.catalog.people.filter(p=>s.catalog.memberships.some(m=>m.person_id===p.id&&m.department_id===s.department)).map(p=>({person:p,reasons:reasons(s,r,p.id,skip)}));}
 function warnings(s,r,person){const date=event(s,r)?.scheduled_on,detail=s.context?.people.find(p=>p.person_id===person)?.days.find(d=>d.date===date);return detail?.draft_dispute?['Possível disputa com outro rascunho; não é compromisso confirmado. Revalidar ao publicar.']:[];}
 function propose(source){
  if(!source.context||source.context.basis_version!==source.plan.version)throw Error('Atualize os dados do rodízio antes de sugerir.');
  const plan=structuredClone(source.plan),s={...source,plan},round=new Set(),order=s.context.people.map(p=>p.person_id).sort();let added=0;
  const latest=[...s.context.people].filter(p=>p.last_day).sort((a,b)=>b.last_day.localeCompare(a.last_day)||a.person_id.localeCompare(b.person_id))[0];
  let cursor=latest?(order.indexOf(latest.person_id)+1)%order.length:0;
  const rows=[...plan.requirements].sort((a,b)=>(event(s,a)?.scheduled_on||'').localeCompare(event(s,b)?.scheduled_on||'')||a.role_id.localeCompare(b.role_id)||a.id.localeCompare(b.id));
  const allowed=r=>!Array.isArray(s.context.planning_weekdays)||s.context.planning_weekdays.includes(new Date(event(s,r)?.scheduled_on+'T12:00:00Z').getUTCDay())||(s.context.extra_dates||[]).includes(event(s,r)?.scheduled_on);
  for(const r of rows)while(allowed(r)&&editWindow.day(event(s,r)?.scheduled_on,s.context)&&r.assignments.length<r.required_count){
   let eligible=candidates(s,r).filter(c=>!c.reasons.length);if(!eligible.length)break;
   if(eligible.every(c=>round.has(c.person.id)))round.clear();
   const rank=p=>{const c=s.context.people.find(c=>c.person_id===p.id),count=new Set([...(c.department_days||[]),...usage(s,p.id)]).size;return [warnings(s,r,p.id).length,count,round.has(p.id)?1:0,c.history_count||0,(order.indexOf(p.id)-cursor+order.length)%order.length,p.id];};
   eligible.sort((a,b)=>{const x=rank(a.person),y=rank(b.person);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]<y[i]?-1:1;}return 0;});
   const p=eligible[0].person;r.assignments.push({id:crypto.randomUUID(),person_id:p.id,timing_mode:'day',starts_at:null,ends_at:null});round.add(p.id);cursor=(order.indexOf(p.id)+1)%order.length;added++;
  }
  return {plan,added};
 }
 function proposeBatch(sources){
  const commitments=sources.flatMap(s=>s.plan.requirements.flatMap(r=>r.assignments.flatMap(a=>days(s,r,a).map(date=>({person_id:a.person_id,department_id:s.department,date}))))),result=[];
  for(const source of sources){const proposal=propose({...source,batchAssignments:[...(source.batchAssignments||[]),...commitments]});result.push(proposal);for(const r of proposal.plan.requirements)for(const a of r.assignments)for(const date of days(source,r,a))commitments.push({person_id:a.person_id,department_id:source.department,date});}
  return result;
 }
 const manualReasons=(s,r,p,skip)=>reasons(s,r,p,skip,true);
 const preferences=(s,r,p,skip)=>reasons(s,r,p,skip).filter(reason=>!manualReasons(s,r,p,skip).includes(reason));
 function metrics(s){const rows=s.plan.requirements.filter(r=>editWindow.day(event(s,r)?.scheduled_on,s.context)),total=rows.reduce((n,r)=>n+r.required_count,0),filled=rows.reduce((n,r)=>n+r.assignments.length,0),people=new Map();let conflicts=0,advisories=0;
  for(const r of rows)for(const a of r.assignments){people.set(a.person_id,(people.get(a.person_id)||0)+1);if(manualReasons(s,r,a.person_id,a.id).length)conflicts++;if(preferences(s,r,a.person_id,a.id).length)advisories++;}
  return {total,filled,pending:Math.max(0,total-filled),people:[...people].map(([id,count])=>({id,count})),conflicts,advisories};
 }
 return {propose,proposeBatch,candidates,reasons,manualReasons,preferences,warnings,metrics};
})();
// B1 — montagem manual. Cadastros e autorização reutilizam a Fase A.
window.IASDPIScheduleManagement=(()=>{
 const m={monthly:false,context:null,day:'',layout:'monthly',settings:null,availability:[],periodInitialized:false,status:'idle',catalog:null,department:'',month:currentMonth(),events:[],plan:null,versions:[],dirty:false,saving:false,error:'',feedback:'',generation:0,selected:[],remote:null,history:null,request:crypto.randomUUID(),owner:null,
  form:{title:'Culto',start:'',end:'',days:[3,6,0],extraTitle:'',extraDate:'',extraEndDate:'',extraStart:'',extraEnd:'',role:'',count:'1'}};
 const h=value=>esc(value),rpc=(name,args={})=>IASDPISchedules.request(name,args);
 function currentMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
 function dates(month,weekdays){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000||!Array.isArray(weekdays)||weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Mês ou dias da semana inválidos.');
  const first=new Date(month+'-01T12:00:00Z'),rows=[];
  for(let d=new Date(first);d.toISOString().slice(0,7)===month;d.setUTCDate(d.getUTCDate()+1))if(weekdays.includes(d.getUTCDay()))rows.push(d.toISOString().slice(0,10));
  return rows;
 }
 const hour=value=>{const d=new Date(value);return value&&!isNaN(d)?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d):'Horário inválido';};
 const eventName=e=>e?`${displayDate(e.scheduled_on)} · ${e.title}${e.timing_mode==='day'?'':` · ${hour(e.starts_at)}–${hour(e.ends_at)}${m.settings?' (horário histórico)':''}`}`:'Evento indisponível';
 const lookup=(list,id)=>m.catalog?.[list]?.find(r=>r.id===id);
 const available=(person,event)=>m.availability.find(a=>a.person_id===person&&a.date===event?.scheduled_on)?.state||'unknown';
 const canPublish=()=>IASDPIScheduleEditWindow.month(m.month,m.settings)&&m.catalog?.departments.some(d=>d.id===m.department&&(d.can_publish??d.can_manage)&&d.active);
 const editable=()=>IASDPIScheduleEditWindow.month(m.month,m.settings)&&m.catalog?.departments.some(d=>d.id===m.department&&(d.can_edit??d.can_manage)&&d.active)&&(m.plan?.status!=='published'||canPublish());
 const simple=()=>Boolean(m.settings?.simplified_daily);
 const clean=IASDPIScheduleUI.isReview;
 const musicAutomaticDisabled=()=>lookup('departments',m.department)?.code==='musica';
 const canStartMonth=()=>m.settings&&(m.settings.future_months.includes(m.month+'-01')||m.month===(m.settings.today||'').slice(0,7));
 const canEditDay=day=>editable()&&IASDPIScheduleEditWindow.day(day,m.settings);
 const b=(text,action,extra='')=>`<button type="button" data-b1-action="${action}" ${clean()&&action==='prefill'?'class="schedule-auto-fill"':''} ${extra}>${h(text)}</button>`;
 const input=(label,name,value='',extra='')=>`<label>${h(label)}<input name="${name}" value="${h(value)}" ${extra}></label>`;
 const time=(label,name,value)=>input(label+' — HH:mm',name,value,'type="text" inputmode="numeric" placeholder="09:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" required');
 const select=(label,name,options)=>`<label>${h(label)}<select name="${name}">${options}</select></label>`;
 const opt=(value,label,chosen)=>`<option value="${h(value)}" ${value===chosen?'selected':''}>${h(label)}</option>`;
 function redraw(){if(state.page==='schedule-build'){render();positionMusicPickers();}}
 function draft(row){return {id:row?.id||crypto.randomUUID(),department_id:m.department,month:m.month+'-01',title:row?.title||'Escala mensal',status:row?.status||'draft',version:row?.version||0,requirements:(row?.requirements||[]).map(r=>({id:r.id,event_id:r.event_id,role_id:r.role_id,required_count:r.required_count,notes:r.notes||'',assignments:(r.assignments||[]).map(a=>({id:a.id,person_id:a.person_id,starts_at:a.starts_at,ends_at:a.ends_at,...(a.timing_mode?{timing_mode:a.timing_mode}:{})}))}))};}
 function adopt(workspace){
  if(!workspace||!Array.isArray(workspace.events)||!Array.isArray(workspace.versions)||(workspace.plan&&!Array.isArray(workspace.plan.requirements)))throw Error('Resposta de escala inválida.');
  m.monthly=Boolean(workspace.monthly);m.context=workspace.rotation_context||null;m.settings=workspace.settings||null;m.availability=workspace.availability||[];m.events=workspace.events;m.versions=workspace.versions;m.plan=draft(workspace.plan);m.rotationReasons=[];m.dirty=false;m.selected=[];m.remote=null;m.history=null;m.request=crypto.randomUUID();
 }
 async function load(){
  const ticket=++m.generation;m.status='loading';m.error='';redraw();
  try{
   const catalog=await rpc('iasdpi_schedule_catalog');
   if(ticket!==m.generation)return;
   if(!catalog?.actor_id||['departments','roles','people','memberships','qualifications'].some(key=>!Array.isArray(catalog[key])))throw Error('Resposta de permissões inválida.');
   if(m.owner&&m.owner!==catalog.actor_id){m.plan=null;m.dirty=false;m.events=[];m.department='';m.selected=[];m.remote=null;m.history=null;}
   m.owner=catalog.actor_id;m.catalog=catalog;
   const preferred=window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.preferred():'';if(catalog.departments.some(d=>d.id===preferred))m.department=preferred;
   const departments=IASDPIScheduleUI.departments(catalog);
   if(!departments.some(d=>d.id===m.department))m.department=departments[0]?.id||'';
   if(!m.department)throw Error('Solicite ao administrador acesso de gestão ou consulta a um departamento.');
   const workspaceForMonth=async()=>{const settings=lookup('departments',m.department)?.code==='ancionato'?await rpc('iasdpi_schedule_settings_get'):null;return settings?.elder_periods?{settings,events:[],versions:[],plan:null}:rpc('iasdpi_schedule_workspace',{p_department:m.department,p_month:m.month+'-01'});};
   let workspace=await workspaceForMonth();
   if(workspace.settings&&!m.periodInitialized){m.month=workspace.settings.schedule_edit_policy?workspace.settings.today.slice(0,7):workspace.settings.future_months[0].slice(0,7);m.periodInitialized=true;workspace=await workspaceForMonth();}
   if(ticket!==m.generation)return;
   if(!(workspace.settings?.elder_periods&&lookup('departments',m.department)?.code==='ancionato')&&workspace.settings?.simplified_daily&&editable()&&!m.catalog.roles.some(r=>r.department_id===m.department&&r.general_assignment&&r.active)){
    const role=await rpc('iasdpi_schedule_daily_role',{p_department:m.department});if(ticket!==m.generation)return;m.catalog.roles.push(role);
   }
   if(!m.dirty)adopt(workspace);else{m.events=workspace.events;m.versions=workspace.versions;m.settings=workspace.settings||null;m.availability=workspace.availability||[];m.context=workspace.rotation_context||null;}
   ensureDailySlots();
   if(simple()&&m.settings?.schedule_edit_policy&&editable()&&canStartMonth()&&!m.plan.requirements.some(r=>IASDPIScheduleEditWindow.day(m.events.find(e=>e.id===r.event_id)?.scheduled_on,m.settings))){await createDays(false);if(ticket!==m.generation)return;}
   m.status='ready';redraw();
  }catch(e){if(ticket!==m.generation)return;m.status='error';m.error=e.message;redraw();}
 }
 function canLeave(){
  if(window.IASDPIRegistry&&!IASDPIRegistry.canLeave())return false;
  if(window.IASDPIScheduleDepartmentDays&&!IASDPIScheduleDepartmentDays.canLeave())return false;
  if(window.IASDPIScheduleElders&&!IASDPIScheduleElders.canLeave())return false;
  if(window.IASDPIScheduleDailyAdmin&&!IASDPIScheduleDailyAdmin.canLeave())return false;
  if(m.saving){alert('Aguarde a confirmação do salvamento da escala.');return false;}
  if(m.dirty&&!confirm('Descartar somente as alterações ainda não salvas desta escala?'))return false;
  if(m.dirty){m.dirty=false;m.plan=null;m.status='idle';}return true;
 }
 function dirty(){m.rotationReasons=[];m.dirty=true;m.request=crypto.randomUUID();m.feedback='Alterações pendentes, ainda não salvas.';m.remote=null;}
 function vacancies(plan=m.plan){return (plan?.requirements||[]).filter(r=>IASDPIScheduleEditWindow.day(m.events.find(e=>e.id===r.event_id)?.scheduled_on,m.settings)).reduce((sum,r)=>sum+Math.max(0,r.required_count-r.assignments.length),0);}
 function eligible(role){const general=lookup('roles',role)?.general_assignment;return (m.catalog?.people||[]).filter(p=>p.active&&m.catalog.memberships.some(member=>member.person_id===p.id&&member.department_id===m.department&&member.active&&(general||m.catalog.qualifications.some(q=>q.membership_id===member.id&&q.role_id===role))));}
 function departmentDay(event){const weekdays=m.settings?.department_weekdays?.[m.department];return !weekdays||weekdays.includes(new Date(event.scheduled_on+'T12:00:00Z').getUTCDay())||(m.settings.extra_dates||[]).includes(event.scheduled_on);}
 function ensureDailySlots(){
  if(!simple()||!editable()||!m.plan||m.plan.status==='published'&&!m.settings.schedule_edit_policy)return;
  const role=m.catalog.roles.find(r=>r.department_id===m.department&&r.active&&r.general_assignment);if(!role)return;
  let added=0;for(const e of m.events.filter(e=>e.scheduled_on.slice(0,7)===m.month&&e.timing_mode==='day'&&departmentDay(e)&&IASDPIScheduleEditWindow.day(e.scheduled_on,m.settings)))if(!m.plan.requirements.some(r=>r.event_id===e.id)){m.plan.requirements.push({id:crypto.randomUUID(),event_id:e.id,role_id:role.id,required_count:1,notes:'',assignments:[]});added++;}
  if(added&&(!m.settings.schedule_edit_policy||m.plan.version>0))dirty();
 }
 function rotationSource(){return {catalog:m.catalog,context:m.context,department:m.department,events:m.events,plan:m.plan};}
 function volunteerField(r,slot,prefix,compact=false){
  const event=m.events.find(e=>e.id===r.event_id),people=eligible(r.role_id),a=r.assignments[slot],current=lookup('people',a?.person_id),choices=m.monthly?m.catalog.people.filter(p=>m.catalog.memberships.some(member=>member.person_id===p.id&&member.department_id===m.department)):[...people];
  if(current&&!choices.some(p=>p.id===current.id))choices.push(current);
  const options=opt('','Vaga pendente',a?.person_id||'')+choices.map(p=>{
   const status=available(p.id,event),reasons=m.monthly?IASDPIScheduleRotation.manualReasons(rotationSource(),r,p.id,a?.id):[];
   const blocked=Boolean(m.monthly?reasons.length:m.settings&&status!=='available'),warning=blocked||status==='unavailable';
   return opt(p.id,p.display_name+(warning?' · ⚠ Indisponível':''),a?.person_id).replace('<option ','<option '+(warning?'class="schedule-person-unavailable" ':'')+(blocked&&p.id!==a?.person_id?'disabled ':''));
  }).join('');
  return select(compact?'Pessoa'+(r.required_count>1?' '+(slot+1):''):'Voluntário '+(slot+1),'volunteer',options).replace('<select ','<select '+(compact?'data-calendar-volunteer ':'')+'aria-label="'+h((compact?'Calendário · ':'')+'Voluntário '+(slot+1)+' · '+prefix)+'" data-slot="'+slot+'" '+(m.saving?'disabled ':''));
 }
 function musicTeam(row){return simple()&&lookup('departments',m.department)?.code==='musica'&&lookup('roles',row.role_id)?.general_assignment;}
 function musicPeople(row,prefix){
  const choices=m.catalog.people.filter(person=>m.catalog.memberships.some(member=>member.person_id===person.id&&member.department_id===m.department));
  for(const assignment of row.assignments)if(!choices.some(person=>person.id===assignment.person_id))choices.push(m.catalog.people.find(person=>person.id===assignment.person_id)||{id:assignment.person_id,display_name:'Pessoa não encontrada'});
  const names=row.assignments.map(a=>choices.find(p=>p.id===a.person_id)?.display_name).filter(Boolean),label=names.length===1?names[0]:names.length+' membros';
  return `<details class="music-picker" data-music-picker="${h(row.id)}" ${m.musicPicker===row.id?'open':''}><summary aria-label="${h('Selecionar membros · '+prefix+(names.length?' · '+names.join(', '):''))}"><span>${names.length?h(label):'Selecionar membros'}</span><span aria-hidden="true">⌄</span></summary><fieldset class="music-team"><legend class="sr-only">Pessoas escaladas · ${h(prefix)}</legend>${choices.map(person=>{const current=row.assignments.find(a=>a.person_id===person.id),reasons=IASDPIScheduleRotation.manualReasons(rotationSource(),row,person.id,current?.id),warning=reasons.length||available(person.id,m.events.find(e=>e.id===row.event_id))==='unavailable';return `<div class="music-person"><label class="checkbox"><input type="checkbox" name="music-volunteer" data-music-volunteer value="${h(person.id)}" aria-label="${h(person.display_name+' · '+prefix)}" ${current?'checked':''} ${m.saving||!editable()||reasons.length&&!current?'disabled':''}><span>${h(person.display_name)}${warning?'<small class="schedule-person-unavailable"> ⚠ Indisponível</small>':''}</span></label></div>`;}).join('')||'<p>Nenhuma pessoa vinculada à Música.</p>'}</fieldset></details>`;
 }
 function positionMusicPickers(){
  for(const picker of document.querySelectorAll('.music-picker[open]')){
   const panel=picker.querySelector('.music-team'),rect=picker.querySelector('summary').getBoundingClientRect(),width=Math.min(300,innerWidth-24),below=innerHeight-rect.bottom-12,above=rect.top-12,height=Math.min(320,Math.max(below,above));
   panel.style.width=width+'px';panel.style.maxHeight=Math.max(100,height)+'px';panel.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';
   if(below>=Math.min(200,above)){panel.style.top=Math.max(12,rect.bottom+4)+'px';panel.style.bottom='auto';}else{panel.style.top='auto';panel.style.bottom=Math.max(12,innerHeight-rect.top+4)+'px';}
  }
 }
 document.addEventListener('toggle',e=>{if(!e.target.matches('.music-picker')||!e.target.isConnected)return;const picker=e.target;if(picker.open){m.musicPicker=picker.dataset.musicPicker;document.querySelectorAll('.music-picker[open]').forEach(other=>{if(other!==picker)other.open=false;});positionMusicPickers();}else if(m.musicPicker===picker.dataset.musicPicker)m.musicPicker='';},true);
 document.addEventListener('click',e=>{if(e.target.closest('.music-picker'))return;document.querySelectorAll('.music-picker[open]').forEach(p=>p.open=false);});
 document.addEventListener('keydown',e=>{const picker=e.target.closest('.music-picker[open]');if(e.key==='Escape'&&picker){picker.open=false;picker.querySelector('summary').focus();e.preventDefault();}});
 window.addEventListener('resize',positionMusicPickers);document.addEventListener('scroll',positionMusicPickers,true);
 function metricsView(stats){return `<dl class="monthly-metrics"><div><dt>Total de vagas</dt><dd>${stats.total}</dd></div><div><dt>Preenchidas</dt><dd>${stats.filled}</dd></div><div><dt>Pendentes</dt><dd>${stats.pending}</dd></div><div><dt>Pessoas escaladas</dt><dd>${stats.people.length}</dd></div><div><dt>Atribuições com impedimentos</dt><dd>${m.context?stats.conflicts:'Não verificado'}</dd></div>${simple()&&(!clean()||m.settings.availability_enabled!==false)?`<div><dt>Escolhas fora das preferências</dt><dd>${stats.advisories}</dd></div>`:''}</dl>`;}
 function requirements(plan=m.plan,readOnly=false,onlyDay=''){
  if(!plan?.requirements.length)return '<p class="empty">Nenhuma função incluída. Selecione eventos e adicione uma função.</p>';
  return plan.requirements.filter(r=>!onlyDay||m.events.find(e=>e.id===r.event_id)?.scheduled_on===onlyDay).map(r=>{
   const role=lookup('roles',r.role_id),event=m.events.find(e=>e.id===r.event_id),people=eligible(r.role_id);
   const prefix=eventName(event)+(role?.general_assignment?'':' · '+(role?.name||'Função indisponível'));
   return `<fieldset class="b1-requirement" data-requirement="${h(r.id)}"><legend>${h(prefix)}</legend><p>${r.assignments.length}/${r.required_count} vagas preenchidas</p>${readOnly?`<ul>${r.assignments.map(a=>`<li>${h(window.IASDPIRegistry?.personName(m.catalog,a.person_id)||lookup('people',a.person_id)?.display_name||'Pessoa indisponível')}${a.timing_mode==='day'?' · Por dia':' · '+hour(a.starts_at||event?.starts_at)+'–'+hour(a.ends_at||event?.ends_at)}</li>`).join('')}</ul><p>${h(r.notes)}</p>`:
    `<div class="schedule-grid">${Array.from({length:r.required_count},(_,slot)=>volunteerField(r,slot,prefix)).join('')}</div>${m.monthly?`<details><summary>Sugestões e impedimentos</summary><ul>${IASDPIScheduleRotation.candidates(rotationSource(),r).map(c=>{const message=c.reasons.join('; ')||IASDPIScheduleRotation.warnings(rotationSource(),r,c.person.id).join('; ');return `<li>${h(c.person.display_name)}${message?': '+h(message):''}</li>`;}).join('')}</ul></details>`:''}${input('Observações','notes',r.notes,'maxlength="2000" aria-label="'+h('Observações · '+prefix)+'"')}${simple()&&role?.general_assignment?'':b('Remover função','remove','data-id="'+h(r.id)+'"')}${simple()?'':`<small>${m.settings?'Nova atribuição por dia, sem horário. Valores históricos são preservados.':'O horário integral do evento é usado para novas atribuições; intervalos existentes são preservados.'} ${simple()?'Preferências orientam o automático; a escolha manual fora delas é permitida com aviso. Conflitos e permissões são revalidados no banco.':'Habilitação, disponibilidade e conflitos são revalidados no banco.'}</small>`}`}</fieldset>`;
  }).join('');
 }
 function page(){if(m.status==='ready'&&m.settings?.elder_periods&&lookup('departments',m.department)?.code==='ancionato')return IASDPIScheduleElders.page(m.catalog,m.settings,m.department,m.month,month=>{m.month=month;m.periodInitialized=true;redraw();});return m.status==='ready'&&m.monthly&&m.layout==='monthly'?monthlyPage():manualPage();}
 function distributionTable(stats){
  const people=m.catalog.people.filter(p=>m.catalog.memberships.some(member=>member.person_id===p.id&&member.department_id===m.department));
  const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(m.month+'-01T12:00:00Z'));
  return `<section class="panel"><h2>Pessoas e distribuição${clean()?IASDPIScheduleUI.help('distribution-help','Atribuições contam vagas; dias contam datas distintas no mês. O histórico considera os dias publicados antes do mês selecionado.','Ajuda sobre a distribuição'):''}</h2><div class="table-scroll schedule-distribution-scroll" tabindex="0" aria-label="Distribuição de escalas por pessoa"><table class="schedule-distribution"><caption>${h(monthLabel)}${clean()?'':' · histórico publicado antes de '+h(displayDate(m.month+'-01'))}</caption><thead><tr><th scope="col">Pessoa</th><th scope="col">Atribuições no mês</th><th scope="col">Dias no mês</th><th scope="col">Histórico anterior (dias)</th></tr></thead><tbody>${people.map(p=>{const count=stats.people.find(row=>row.id===p.id)?.count||0,days=new Set(m.plan.requirements.filter(r=>r.assignments.some(a=>a.person_id===p.id)).map(r=>m.events.find(e=>e.id===r.event_id)?.scheduled_on).filter(Boolean)).size,history=m.context?.people.find(row=>row.person_id===p.id)?.history_count;return `<tr><th scope="row">${h(p.display_name)}</th><td>${count}</td><td>${days}</td><td>${history==null?'—':h(history)}</td></tr>`;}).join('')||'<tr><td colspan="4">Nenhuma pessoa cadastrada neste departamento.</td></tr>'}</tbody></table></div><small class="schedule-table-hint">Deslize a tabela para ver todas as colunas.</small></section>`;
 }
 function publishBar(){
  return `<section class="panel schedule-publishbar" aria-label="Salvar e publicar escala"><div><strong>${m.dirty?'Escala em edição':m.plan.status==='published'?'Escala publicada':'Escala em rascunho'}</strong><p role="status">${h(m.error||(m.saving?'Aguardando confirmação…':vacancies()?vacancies()+' vagas pendentes.':m.dirty?'Alterações pendentes. Pronta para publicar.':m.plan.status==='published'?'Publicação confirmada.':'Rascunho salvo. Publique para exibir no calendário.'))}</p>${clean()?'':`<small>${window.IASDPISchedulePreview?'Demonstração: publicação visível no calendário desta aba.':'Rascunhos não são públicos.'}</small>`}</div><div class="schedule-publish-actions">${editable()?b('Salvar rascunho','save',m.saving?'disabled':''):''}${canPublish()?b(m.saving?'Aguardando confirmação…':'Publicar escala','publish','class="primary" '+(m.saving?'disabled':'')):''}<a class="button schedule-secondary" href="#schedule-calendar" data-b1-nav="schedule-calendar" data-schedule-month="${h(m.month)}" data-schedule-department="${h(lookup('departments',m.department)?.name||'')}">${clean()?'Ver calendário':'Ver no calendário'}</a></div></section>`;
 }
 function monthlyPage(){
  const dept=lookup('departments',m.department),roles=m.catalog.roles.filter(r=>r.active&&r.department_id===m.department),days=dates(m.month,[0,1,2,3,4,5,6]),monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(m.month+'-01T12:00:00Z'));
  if(!days.includes(m.day))m.day=m.events[0]?.scheduled_on||days[0];
  const dayEvents=m.events.filter(e=>e.scheduled_on===m.day),stats=IASDPIScheduleRotation.metrics(rotationSource()),heads=m.context?.heads||[];
  const reference=typeof churchMinistries==='undefined'?[]:churchMinistries.filter(x=>x.name===dept.name||(dept.code==='musica'&&x.name==='Ministério da Música')||(dept.code==='diaconato'&&x.name.startsWith('Diaconato —'))).flatMap(x=>x.responsibles);
  const responsibles=heads.length?heads:reference;
  const color=['sonoplastia','diaconato','musica','ancionato','comunicacao'].includes(dept.code)?dept.code:'other';
  const calendar=days.map(day=>{
   const events=m.events.filter(e=>e.scheduled_on===day&&(!simple()||departmentDay(e)||m.plan.requirements.some(r=>r.event_id===e.id))),rows=m.plan.requirements.filter(r=>events.some(e=>e.id===r.event_id)),names=rows.flatMap(r=>r.assignments.map(a=>lookup('people',a.person_id)?.display_name||'Pessoa não encontrada')),pending=rows.reduce((n,r)=>n+r.required_count-r.assignments.length,0);
   const label=displayDate(day)+(events.length?' · '+events.map(e=>e.title).join(', '):' · Sem evento')+(names.length?' · '+names.join(', '):'')+(pending?' · '+pending+' vagas pendentes':'');
   const inline=canEditDay(day)&&rows.length;
   const selectors=inline?'<div class="monthly-inline-selectors">'+rows.map(r=>{const role=lookup('roles',r.role_id),event=events.find(e=>e.id===r.event_id),prefix=(dept?.name||'')+' · '+eventName(event)+' · '+(role?.general_assignment?'Pessoa escalada':role?.name||'Função indisponível');return `<div data-requirement="${h(r.id)}">${rows.length>1?`<span class="monthly-slot-role" title="${h((event?.title||'')+' · '+(role?.name||''))}">${h(role?.general_assignment?'Pessoa escalada':role?.name||'Função')}</span>`:''}${musicTeam(r)?musicPeople(r,prefix):Array.from({length:r.required_count},(_,slot)=>volunteerField(r,slot,prefix,true)).join('')}${simple()&&event?.scheduled_on===m.day?`<details class="monthly-note"><summary>Observações${r.notes?' •':''}</summary><label><span class="sr-only">${h('Observações · '+prefix)}</span><textarea name="notes" rows="2" aria-label="${h('Observações · '+prefix)}">${h(r.notes)}</textarea></label></details>`:''}</div>`;}).join('')+'</div>':'';
   return `<div class="monthly-cell ${events.length?'has-events':''} ${inline?'has-selectors':''} ${!IASDPIScheduleEditWindow.day(day,m.settings)?'is-locked':''}"><button type="button" class="monthly-day ${events.length?'has-events':''}" data-b1-action="day" data-day="${day}" aria-label="${h(label)}" aria-pressed="${day===m.day}"><span class="monthly-number">${Number(day.slice(8))}</span><span class="monthly-weekday">${h(new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'}).format(new Date(day+'T12:00:00Z')))}</span>${names.slice(0,3).map(name=>`<span class="monthly-name ${inline?'sr-only':''}">${h(name)}</span>`).join('')}${names.length>3?`<small>+${names.length-3}</small>`:''}${!IASDPIScheduleEditWindow.day(day,m.settings)?'<small class="schedule-date-locked">'+(day<IASDPIScheduleEditWindow.bounds(m.settings).from?'Encerrado':'Fora do período')+'</small>':''}${pending&&IASDPIScheduleEditWindow.day(day,m.settings)?`<small class="monthly-pending">${pending} pendente${pending>1?'s':''}</small>`:!rows.length&&events.length?'<small>Definir funções</small>':''}</button>${selectors}</div>`;
  }).join('');
  return heading('ESCALAS · MONTAGEM MENSAL',dept.name,'Responsável ministerial: '+(responsibles.join(' · ')||'Não informado no cadastro')+'.')+
   (!clean()&&window.IASDPISchedulePreview?`<p class="demo-banner">${window.IASDPIKnownPreviewSeed?.catalog.reference_preview?(window.IASDPIKnownPreviewSeed?.elder_periods?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade temporariamente desativada.':window.IASDPIKnownPreviewSeed?.simplified_daily?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade padrão para o automático.':'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidades pendentes de confirmação.'):'DEMONSTRAÇÃO — DADOS FICTÍCIOS.'} Salvamento em memória; reinicia ao recarregar.</p>`:'')+
   `<nav class="monthly-departments" aria-label="Departamentos das escalas">${IASDPIScheduleUI.departments(m.catalog).map(d=>b(d.name,'department','data-department="'+h(d.id)+'" aria-pressed="'+(d.id===m.department)+'"')).join('')}</nav>
   <section class="panel"><form id="b1-scope" class="schedule-grid"><input type="hidden" name="department" value="${h(m.department)}">${clean()?IASDPIScheduleUI.monthPicker('schedule-month',m.month,m.saving):input('Mês e ano','month',m.month,'type="month" required')+'<button type="submit">Abrir mês</button>'}</form><div class="monthly-toolbar">${b('Mês anterior','month','data-direction="-1"')}${b('Próximo mês','month','data-direction="1"')}${m.catalog.is_admin?'<a class="button schedule-secondary" href="#schedule-settings" data-b1-nav="schedule-settings">Período de edição</a>':''}${editable()?b(simple()?'Preencher automaticamente':'Pré-preencher por rodízio','prefill','aria-describedby="rotation-requirements-help" '+(m.saving||musicAutomaticDisabled()||(!m.plan.requirements.length&&(!simple()||!canStartMonth()))?'disabled':'')+(musicAutomaticDisabled()?' title="Preenchimento automático da Música temporariamente desativado"':''))+b('Limpar escala','clear','class="schedule-clear" '+(m.saving||!m.plan.requirements.some(r=>r.assignments.length)?'disabled':''))+(simple()?'':b('Salvar rascunho','save',m.saving?'disabled':'')+(canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):'')):''}${!editable()&&canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):''}${b(clean()?'Recarregar escala':window.IASDPISchedulePreview?'Atualizar escala':'Atualizar do banco','reload',m.saving?'disabled':'')}</div>
   ${window.IASDPIScheduleDepartmentDays?.page(m.catalog,m.settings,m.department,m.month)||''}
   ${clean()?IASDPIScheduleUI.help('rotation-requirements-help','O preenchimento automático propõe nomes para as vagas vazias. Revise as escolhas antes de salvar. Salvar mantém um rascunho; publicar o exibe no calendário. Limpar escala retira somente os nomes do mês e departamento atuais, mantendo datas, vagas e observações. Recarregar escala recupera a última versão salva nesta aba e pede confirmação se houver alterações pendentes.','Ajuda sobre a montagem da escala'):`${m.catalog.is_admin?'<p><a href="#schedule-members" data-b1-nav="schedule-members">'+(m.settings.availability_enabled===false?'Membros — disponibilidade desativada':'Dias e restrições por voluntário')+'</a></p>':''}<p id="rotation-requirements-help">${!m.plan.requirements.length?(simple()?'Comece a escala deste mês para escolher as pessoas, ou use Preencher automaticamente para receber uma proposta.':'Para habilitar o rodízio, gere ou cadastre os eventos e adicione as funções e vagas nas datas. Abra “Preparar eventos e informações da escala” abaixo.'):'O rodízio preenche apenas as vagas vazias. Revise a proposta antes de salvar.'}</p><p role="status" id="b1-feedback">${h(m.feedback||(m.dirty?'Alterações pendentes.':'Nenhuma alteração pendente.'))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}<p>${m.plan.status==='published'?'Publicada':'Rascunho'} · versão ${m.plan.version}. Pré-preencher somente propõe; salvar não publica. ${!window.IASDPISchedulePreview?'Integração de novas escalas com o calendário público aguarda autorização.':''}</p>`}
   ${clean()?'':metricsView(stats)}</section>
   ${simple()&&!m.plan.requirements.length&&editable()&&canStartMonth()?b('Começar escala','start',m.saving?'disabled':''):''}<section class="panel monthly-calendar ${simple()?'simple-daily-calendar':''} monthly-${color}" aria-label="Calendário mensal de ${h(dept.name)}"><h2>${h(monthLabel)}</h2><div class="calendar-weekdays">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="monthly-days">${'<span aria-hidden="true"></span>'.repeat(new Date(m.month+'-01T12:00:00Z').getUTCDay())}${calendar}</div></section>
   ${clean()?`<section class="panel schedule-summary" aria-label="Resumo da escala"><h2>Resumo da escala</h2><p role="status" id="b1-feedback">${h(IASDPIScheduleUI.feedback(m.feedback)||(m.dirty?'Alterações pendentes.':''))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}${m.rotationReasons?.length?'<div class="schedule-rotation-reasons"><a class="button schedule-secondary" href="#schedule-members" data-b1-nav="schedule-members">Conferir equipe</a>'+IASDPIScheduleUI.help('rotation-empty-reasons',m.rotationReasons.join('; '),'Por que não houve sugestões')+'</div>':''}${metricsView(stats)}</section>`:''}
   ${simple()?'':`<section class="panel" id="monthly-day-details" tabindex="-1"><h2>${displayDate(m.day)} — detalhes</h2>${dayEvents.length?'':'<p>Nenhuma escala prevista nesta data.</p>'}${requirements(m.plan,!editable(),m.day)||'<p>Nenhuma função definida nesta data.</p>'}
   ${editable()&&!simple()?`<fieldset ${m.saving?'disabled':''}><legend>Adicionar função no dia</legend><div class="b1-event-list">${dayEvents.map(e=>`<label class="checkbox"><input type="checkbox" name="event" value="${h(e.id)}" ${m.selected.includes(e.id)?'checked':''}>${h(e.title)}</label>`).join('')}</div><form id="b1-add" class="schedule-grid">${select('Função necessária','role',roles.map(r=>opt(r.id,r.name,m.form.role)).join(''))}${input('Vagas por evento','count',m.form.count,'type="number" min="1" max="100" required')}<button type="submit" ${dayEvents.length&&roles.length?'':'disabled'}>Adicionar função aos eventos selecionados</button></form></fieldset>`:''}</section>`}
   ${distributionTable(stats)}
   ${editable()&&!simple()?`<details class="panel"><summary>Preparar eventos e informações da escala</summary><p>Período futuro: ${m.settings.future_months.map(displayDate).join(' · ')}. Não há distribuição automática ao gerar datas.</p><form id="b1-recurring" class="schedule-grid">${input('Nome dos cultos','title',m.form.title,'required maxlength="160"')}<button type="submit" ${m.saving||!m.settings.future_months.includes(m.month+'-01')?'disabled':''}>Gerar dias do período</button></form><form id="b1-extra" class="schedule-grid">${input('Nome do evento','extraTitle',m.form.extraTitle,'required maxlength="160"')}${input('Data — dd/mm/aaaa','extraDate',m.form.extraDate,'required placeholder="10/11/2026"')}<button type="submit" ${m.saving?'disabled':''}>Adicionar evento extraordinário</button></form>${input('Título da escala','planTitle',m.plan.title,'required maxlength="160"')}</details>`:''}
   ${simple()?'':`<p><a href="#schedule-setup" data-b1-nav="schedule-setup">Cadastros e habilitações</a> · <a href="#schedule-calendar" data-b1-nav="schedule-calendar">Calendário público preservado</a>${m.catalog.is_admin?' · <a href="#schedule-members" data-b1-nav="schedule-members">Membros</a> · <a href="#schedule-settings" data-b1-nav="schedule-settings">Configurações</a>':''}</p>`}${simple()?publishBar()+`<details class="panel"><summary>Versões anteriores</summary>${m.versions.length?m.versions.map(v=>b('Consultar versão '+v.version,'version','data-version="'+v.version+'"')).join(''):'<p>Nenhuma versão salva.</p>'}${m.history?requirements(m.history,true):''}</details>`:b('Montagem em lista e versões anteriores','layout')}`;
 }
 function manualPage(){
  const title=heading('ESCALAS · MONTAGEM MANUAL','Montar escala',m.settings?'Escolha o departamento e o mês; preencha as vagas por dia, com disponibilidade confirmada.':'Escolha o departamento e o mês, confirme os horários e preencha as vagas.');
  if(m.status==='idle'){queueMicrotask(load);return title+'<p role="status">Recuperando acesso às escalas…</p>';}
  const preview=!clean()&&window.IASDPISchedulePreview?'<p class="demo-banner">DEMONSTRAÇÃO — DADOS FICTÍCIOS. Alterações somente na memória desta aba; reiniciam ao recarregar. Não há conexão com Supabase.</p>':'';
  const links='<p><a href="#schedule-calendar" data-b1-nav="schedule-calendar">Calendário</a> · <a href="#schedule-setup" data-b1-nav="schedule-setup">Pessoas, funções e disponibilidades</a></p>';
  if(m.status==='loading')return title+preview+links+'<p role="status">Carregando escala e permissões…</p>';
  if(m.status==='error')return title+preview+links+`<section class="panel"><p role="alert">${h(m.error)}</p><p>As migrações 005 e 006 precisam estar instaladas em ambiente autorizado. Seus campos pendentes permanecem em memória para a mesma conta.</p>${b('Tentar novamente','retry')}<form id="b1-login" class="schedule-grid">${window.IASDPIAuth?.loginIdentifierField?IASDPIAuth.loginIdentifierField():input('E-mail','email','','type="email" required autocomplete="username"')}${input('Senha','password','','type="password" required autocomplete="current-password"')}<button type="submit">Entrar</button><p role="status"></p></form><a href="#forgot-password">Esqueci minha senha</a></section>`;
  const adminLinks=m.settings&&m.catalog.is_admin?'<p><a href="#schedule-settings" data-b1-nav="schedule-settings">Configurar período e dias</a> · <a href="#schedule-members" data-b1-nav="schedule-members">Planilha de membros</a></p>':'';
  const roles=m.catalog.roles.filter(r=>r.active&&r.department_id===m.department),f=m.form;
  return title+preview+links+adminLinks+(m.monthly?b('Voltar à visão mensal','layout'):'')+`<section class="panel"><form id="b1-scope" class="schedule-grid">${select('Departamento','department',m.catalog.departments.filter(d=>d.active&&(d.can_manage||d.can_roster)).map(d=>opt(d.id,d.name,m.department)).join(''))}${input('Mês e ano','month',m.month,'type="month" required')}<button type="submit" ${m.saving?'disabled':''}>Abrir escala</button></form></section>
  <section class="panel b1-status"><h2>${h(m.plan.title)}</h2><p>${m.plan.status==='published'?'Publicada':'Rascunho'} · versão ${m.plan.version} · <strong>${vacancies()} vagas pendentes</strong></p><p role="status" id="b1-feedback">${h(m.feedback||(m.dirty?'Alterações pendentes.':'Nenhuma alteração pendente.'))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}</section>
  ${editable()?`<fieldset class="b1-controls" ${m.saving?'disabled':''}><legend class="sr-only">Montagem manual da escala</legend><section class="panel"><h2>1. Cultos e eventos</h2><form id="b1-recurring" class="schedule-grid">${input('Nome dos cultos','title',f.title,'required maxlength="160"')}${m.settings?'':time('Início','start',f.start)+time('Término','end',f.end)}<fieldset><legend>Gerar datas neste mês</legend>${(m.settings?(m.settings.department_weekdays?.[m.department]||m.settings.weekdays||[]).map(day=>[day,['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][day]]):[[3,'Quartas-feiras'],[6,'Sábados'],[0,'Domingos']]).map(([day,label])=>`<label class="checkbox"><input type="checkbox" name="weekday" value="${day}" ${m.settings?'checked disabled':f.days.includes(day)?'checked':''}> ${label}</label>`).join('')}</fieldset><button type="submit" ${m.settings&&!m.settings.future_months.includes(m.month+'-01')?'disabled':''}>${m.settings?'Gerar dias do período':'Gerar datas'}</button></form><p>${m.settings?'Período de geração (sempre a partir do próximo mês): '+m.settings.future_months.map(displayDate).join(' · ')+'. Dias definidos pelo administrador. Escalas existentes não serão apagadas.':'Horários de America/Sao_Paulo, informados por você. Gere grupos separados para cultos com horários diferentes. Eventos iguais já cadastrados são reutilizados.'}</p>
  <details><summary>Adicionar evento extraordinário</summary><form id="b1-extra" class="schedule-grid">${input('Nome do evento','extraTitle',f.extraTitle,'required maxlength="160"')}${input('Data — dd/mm/aaaa','extraDate',f.extraDate,'required placeholder="10/10/2026"')}${m.settings?'':time('Início do evento','extraStart',f.extraStart)+time('Término do evento','extraEnd',f.extraEnd)+input('Data final — opcional, dd/mm/aaaa','extraEndDate',f.extraEndDate,'placeholder="11/10/2026"')}<button type="submit">Adicionar evento</button></form></details></section>
  <section class="panel"><h2>${simple()?'2. Pessoas escaladas':'2. Funções e voluntários'}</h2><div class="b1-event-list">${m.events.map(e=>`<label class="checkbox"><input type="checkbox" name="event" value="${h(e.id)}" ${m.selected.includes(e.id)?'checked':''}> ${h(eventName(e))}</label>`).join('')||'<p>Nenhum evento cadastrado neste mês. Gere datas ou adicione um evento acima.</p>'}</div>${simple()?'':`<form id="b1-add" class="schedule-grid">${select('Função necessária','role',roles.map(r=>opt(r.id,r.name,f.role)).join(''))}${input('Vagas por evento','count',f.count,'type="number" min="1" max="100" required')}<button type="submit" ${roles.length?'':'disabled'}>Adicionar função aos eventos selecionados</button></form>`}${!roles.length?'<p>Cadastre as funções confirmadas deste departamento em Cadastros antes de continuar.</p>':''}${input('Título da escala','planTitle',m.plan.title,'required maxlength="160"')}<div id="b1-requirements">${requirements()}</div></section></fieldset>`:`<section class="panel"><p>Consulta autorizada. Somente administradores e gestores do departamento podem alterar esta escala.</p>${requirements(m.plan,true)}</section>`}
  <section class="panel b1-save"><p>Salvar rascunho não publica. Publicar exige cobertura completa e confirmação.</p>${editable()?b(m.saving?'Aguardando confirmação…':'Salvar rascunho','save','class="primary" '+(m.saving?'disabled':''))+(canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):''):''}${!editable()&&canPublish()?b('Publicar escala','publish',m.saving?'disabled':''):''}${b('Atualizar do banco','reload',m.saving?'disabled':'')}${b('Comparar versão salva','compare',m.saving?'disabled':'')}</section>
  ${m.remote?`<section class="panel"><h2>Versão salva no banco — ${m.remote.version}</h2><p>Seu formulário não foi substituído. Atualize do banco somente após revisar as diferenças.</p>${requirements(m.remote,true)}</section>`:''}
  <section class="panel"><h2>Histórico de versões</h2>${m.versions.length?m.versions.map(v=>b('Consultar versão '+v.version,'version','data-version="'+v.version+'"')).join(''):'<p>A primeira versão será criada após confirmar o salvamento.</p>'}${m.history?`<h3>Versão ${m.history.version} · ${h(m.history.title)}</h3>${requirements(m.history,true)}`:''}</section>`;
 }
 function capture(form){const data=new FormData(form);for(const key of Object.keys(m.form))if(key!=='days'&&data.has(key))m.form[key]=String(data.get(key));if(form.id==='b1-recurring')m.form.days=data.getAll('weekday').map(Number);}
 async function createEvents(extra=false){
  if(m.settings)return createDays(extra);
  const f=m.form,parse=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v:tryReadDate(v);
  const date=extra?parse(f.extraDate):null,endDate=extra&&f.extraEndDate?parse(f.extraEndDate):null;
  if(extra&&(!date||(f.extraEndDate&&!endDate)||date.slice(0,7)!==m.month))throw Error('Revise a data do evento: deve pertencer ao mês selecionado.');
  const days=extra?[date]:dates(m.month,f.days);if(!days.length)throw Error('Selecione pelo menos um dia da semana.');
  const start=extra?f.extraStart:f.start,end=extra?f.extraEnd:f.end;
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)||(!endDate&&end<=start))throw Error('Informe início e término válidos em HH:mm. Para atravessar a meia-noite, use um evento extraordinário com data final.');
  m.saving=true;m.error='';m.feedback='Confirmando eventos…';redraw();let count=0;
  try{for(const day of days){
   const event=await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:m.department,title:extra?f.extraTitle:f.title,date:day,start_time:start,end_time:end,...(endDate?{end_date:endDate}:{})},p_request_id:crypto.randomUUID()});
   if(!event?.id||!event.starts_at||!event.ends_at)throw Error('Resposta de evento inválida. Consulte a lista antes de repetir.');
   if(!m.events.some(e=>e.id===event.id))m.events.push(event);count++;
  }m.events.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));m.feedback=count+' eventos confirmados'+(window.IASDPISchedulePreview?' nesta demonstração.':' pelo Supabase.');
  }catch(e){m.error=e.message+' '+count+' eventos já confirmados; os restantes não foram confirmados. Repetir reutiliza eventos existentes.';}finally{m.saving=false;redraw();}
 }
 async function createDays(extra){
  const f=m.form,date=/^\d{4}-\d{2}-\d{2}$/.test(f.extraDate)?f.extraDate:tryReadDate(f.extraDate);
  if(extra&&(!date||date.slice(0,7)!==m.month))throw Error('Informe uma data válida do mês selecionado.');
  m.saving=true;m.error='';m.feedback='Confirmando dias…';redraw();
  try{
   if(!extra&&!canStartMonth())throw Error('Selecione o mês atual ou um mês do período de planejamento.');
   let result;
   if(!extra&&m.settings.schedule_edit_policy){result=await rpc('iasdpi_schedule_prepare_month',{p_department:m.department,p_month:m.month+'-01',p_request_id:crypto.randomUUID(),p_title:f.title});}
   else if(!extra&&m.month===(m.settings.today||'').slice(0,7)){
    const weekdays=m.settings.department_weekdays?.[m.department]||m.settings.weekdays,events=[];
    const days=[...new Set([...dates(m.month,weekdays),...(m.settings.extra_dates||[]).filter(day=>day.slice(0,7)===m.month)])].sort();
    for(const day of days)events.push(await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:m.department,title:f.title,date:day},p_request_id:crypto.randomUUID()}));
    result={events};
   }else result=extra?await rpc('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:m.department,title:f.extraTitle,date},p_request_id:crypto.randomUUID()}):await rpc('iasdpi_schedule_generate_days',{p_department:m.department,p_title:f.title,p_request_id:crypto.randomUUID()});
   const events=extra?[result]:result.events;if(!Array.isArray(events))throw Error('Resposta de geração inválida.');
   m.events=[...new Map([...m.events,...events.filter(e=>e.scheduled_on.slice(0,7)===m.month)].map(e=>[e.id,e])).values()];
   const workspace=await rpc('iasdpi_schedule_workspace',{p_department:m.department,p_month:m.month+'-01'});m.events=workspace.events;m.settings=workspace.settings;m.availability=workspace.availability||[];m.context=workspace.rotation_context||null;ensureDailySlots();
   m.feedback=events.length+' dias confirmados'+(window.IASDPISchedulePreview?' somente na demonstração.':' pelo Supabase.')+(m.dirty?' Revise e salve as vagas pendentes.':'');
  }catch(e){m.error=e.message+' Confira a lista antes de repetir a operação.';}finally{m.saving=false;redraw();}
 }
 function addRequirements(){
  const chosen=lookup('roles',m.form.role),role=chosen?.department_id===m.department&&chosen.active?chosen:m.catalog.roles.find(r=>r.department_id===m.department&&r.active),count=Number(m.form.count);
  if(!m.selected.length||!role||role.department_id!==m.department||!Number.isInteger(count)||count<1||count>100)throw Error('Selecione eventos, uma função e de 1 a 100 vagas.');
  let added=0;for(const event_id of m.selected)if(!m.plan.requirements.some(r=>r.event_id===event_id&&r.role_id===role.id)){m.plan.requirements.push({id:crypto.randomUUID(),event_id,role_id:role.id,required_count:count,notes:'',assignments:[]});added++;}
  if(added)dirty();else m.feedback='As funções selecionadas já estão neste plano; nenhum item foi duplicado.';redraw();
 }
 async function save(status){
  if((status==='published'?!canPublish():!editable())||m.saving)return;
  if(!m.plan.title.trim())throw Error('Informe o título da escala.');
  if(status==='published'&&!confirm('Publicar esta escala após validar todas as vagas e conflitos?'))return;
  if(status==='draft'&&m.plan.status==='published'&&!confirm(window.IASDPISchedulePreview?'Salvar esta revisão como rascunho? A publicação anterior continua no calendário e no histórico até publicar novamente.':'Salvar como rascunho muda o estado atual desta escala publicada. A versão anterior continuará no histórico. Continuar?'))return;
  const id=m.plan.id,expected=m.plan.version;
  const data=editable()?{department_id:m.department,month:m.month+'-01',title:m.plan.title,status,requirements:structuredClone(m.plan.requirements)}:{status};
  const signature=JSON.stringify(data);if(m.signature&&m.signature!==signature)m.request=crypto.randomUUID();m.signature=signature;const request=m.request;
  m.saving=true;m.error='';m.feedback='Aguardando confirmação do salvamento…';redraw();
  try{
   const row=await rpc('iasdpi_schedule_plan_save',{p_id:id,p_expected_version:expected,p_data:data,p_request_id:request});
   if(row?.id!==id||!Number.isInteger(row.version)||row.version!==expected+1||!Array.isArray(row.requirements))throw Error('Confirmação inválida. Consulte a versão salva antes de repetir.');
   m.plan=draft(row);if(status==='published')window.dispatchEvent(new Event('iasdpi-schedule-published'));m.dirty=false;m.request=crypto.randomUUID();m.remote=null;
   m.versions.unshift({version:row.version});m.feedback=window.IASDPISchedulePreview?'Alterações confirmadas apenas na memória desta demonstração.'+(status==='published'?' Escala publicada. Abra Ver no calendário.':' Rascunho salvo; ainda não publicado.'):(status==='published'?'Publicação':'Rascunho')+' confirmada pelo Supabase.';
   if(m.monthly){m.context=null;try{m.context=await rpc('iasdpi_schedule_rotation_context',{p_department:m.department,p_month:m.month+'-01'});}catch(_){m.feedback+=' O rodízio precisa atualizar seus dados antes de uma nova sugestão.';}}
  }catch(e){m.error=e.message+' Seus campos continuam no formulário; nenhuma confirmação de gravação foi recebida.';m.feedback='';}
  finally{m.saving=false;redraw();}
 }
 document.addEventListener('submit',e=>{
  const form=e.target;if(!['b1-scope','b1-recurring','b1-extra','b1-add','b1-login'].includes(form.id))return;e.preventDefault();e.stopImmediatePropagation();
  if(m.saving)return;
  void(async()=>{
   if(form.id==='b1-scope'){const data=new FormData(form),month=String(data.get('month'));dates(month,[]);if(clean()&&month===m.month&&String(data.get('department'))===m.department)return;if(!canLeave()){IASDPIScheduleUI.restoreMonth(form,m.month);return;}m.department=String(data.get('department'));m.month=month;m.periodInitialized=true;m.plan=null;m.dirty=false;m.feedback='';await load();return;}
   if(form.id==='b1-login'){const email=form.elements.email.value,password=form.elements.password.value;form.elements.password.value='';await IASDPIAuth.loginIdentity(email,password);await load();return;}
   if(!editable())throw Error('Sem gestão deste departamento.');capture(form);
   if(form.id==='b1-recurring')await createEvents();if(form.id==='b1-extra')await createEvents(true);if(form.id==='b1-add')addRequirements();
  })().catch(error=>{m.error=error.message;redraw();});
 },true);
 document.addEventListener('input',e=>{
  if(state.page!=='schedule-build'||m.saving)return;const field=e.target,form=field.closest('form');if(form)capture(form);
  if(field.name==='planTitle'){m.plan.title=field.value;dirty();}
  if(field.name==='notes'){const r=m.plan.requirements.find(r=>r.id===field.closest('[data-requirement]')?.dataset.requirement);if(r&&canEditDay(m.events.find(e=>e.id===r.event_id)?.scheduled_on)){r.notes=field.value;dirty();}}
  const feedback=document.getElementById('b1-feedback');if(feedback&&m.dirty)feedback.textContent=m.feedback;
 });
 document.addEventListener('change',e=>{
  if(state.page!=='schedule-build'||m.saving)return;const field=e.target,form=field.closest('form');if(form)capture(form);
  if(field.name==='event')m.selected=[...document.querySelectorAll('.b1-event-list input:checked')].map(el=>el.value);
  if(field.hasAttribute('data-music-volunteer')){
   const row=m.plan.requirements.find(r=>r.id===field.closest('[data-requirement]')?.dataset.requirement);if(!row||!musicTeam(row)||!canEditDay(m.events.find(e=>e.id===row.event_id)?.scheduled_on)){redraw();return;}
   m.musicPicker=row.id;
   const existing=row.assignments.find(a=>a.person_id===field.value);
   if(field.checked&&!existing){const reasons=IASDPIScheduleRotation.manualReasons(rotationSource(),row,field.value);if(reasons.length||row.assignments.length>=100){m.error=reasons.join('; ')||'Máximo de 100 pessoas por atividade.';redraw();return;}row.assignments.push({id:crypto.randomUUID(),person_id:field.value,timing_mode:'day',starts_at:null,ends_at:null});}
   else if(!field.checked)row.assignments=row.assignments.filter(a=>a.person_id!==field.value);
   else return;
   row.required_count=Math.max(1,row.assignments.length);m.day=m.events.find(event=>event.id===row.event_id)?.scheduled_on||m.day;dirty();m.error='';redraw();document.querySelector('[data-requirement="'+row.id+'"] [data-music-volunteer][value="'+field.value+'"]')?.focus({preventScroll:true});return;
  }
  if(field.name==='volunteer'){
   const r=m.plan.requirements.find(r=>r.id===field.closest('[data-requirement]')?.dataset.requirement),slot=Number(field.dataset.slot);if(!r||!canEditDay(m.events.find(e=>e.id===r.event_id)?.scheduled_on)){redraw();return;}
   const scope=field.closest('.monthly-inline-selectors')?'.monthly-inline-selectors':field.closest('#monthly-day-details')?'#monthly-day-details':'#b1-requirements';
   if(scope==='.monthly-inline-selectors'){m.day=m.events.find(e=>e.id===r.event_id)?.scheduled_on||m.day;m.selected=m.events.filter(e=>e.scheduled_on===m.day).map(e=>e.id);}
   if(field.value){const existing=r.assignments[slot];r.assignments[slot]=existing?.person_id===field.value?existing:{id:crypto.randomUUID(),person_id:field.value,...(m.settings?{timing_mode:'day'}:{})};}
   else r.assignments.splice(slot,1);
   r.assignments=r.assignments.filter(Boolean);dirty();redraw();document.querySelector(scope+' [data-requirement="'+r.id+'"] select[data-slot="'+Math.min(slot,r.required_count-1)+'"]')?.focus({preventScroll:true});
  }
 });
 document.addEventListener('click',e=>{
  const link=e.target.closest('[data-b1-nav]');if(link&&window.IASDPINavigation){e.preventDefault();if(link.dataset.scheduleMonth)IASDPIScheduleCalendar.show({month:link.dataset.scheduleMonth,department:link.dataset.scheduleDepartment});void IASDPINavigation.navigate(link.dataset.b1Nav);return;}
  const button=e.target.closest('[data-b1-action]');if(!button||m.saving)return;e.preventDefault();
  void(async()=>{
   const action=button.dataset.b1Action;
   if(action==='start'&&editable())await createDays(false);
   if(action==='layout'){m.layout=m.layout==='monthly'?'list':'monthly';redraw();}
   if(action==='day'){m.day=button.dataset.day;m.selected=m.events.filter(e=>e.scheduled_on===m.day).map(e=>e.id);redraw();if(simple())document.querySelector('[data-b1-action=day][data-day="'+m.day+'"]')?.focus({preventScroll:true});else document.querySelector('#monthly-day-details')?.focus();}
   if(action==='department'||action==='month'){
    if(!canLeave())return;
    if(action==='department')m.department=button.dataset.department;
    else{const date=new Date(m.month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+Number(button.dataset.direction));m.month=date.toISOString().slice(0,7);}
    m.periodInitialized=true;m.day='';m.plan=null;m.feedback='';await load();
   }
   if(action==='clear'&&editable()){
    if(!m.plan?.requirements.some(r=>r.assignments.length))return;
    const department=lookup('departments',m.department)?.name||'este departamento',month=m.month.slice(5)+'/'+m.month.slice(0,4);
    if(!confirm('Limpar os nomes da escala de '+department+' de '+month+'? Datas, vagas e observações serão mantidas. A limpeza ficará pendente até salvar.'))return;
    for(const row of m.plan.requirements)if(canEditDay(m.events.find(e=>e.id===row.event_id)?.scheduled_on))row.assignments=[];
    dirty();m.error='';m.feedback='Nomes removidos. Salve o rascunho para confirmar.';redraw();document.querySelector('[data-b1-action=prefill]')?.focus({preventScroll:true});
   }
   if(action==='prefill'&&editable()&&!musicAutomaticDisabled()){
    if(simple()&&!m.plan.requirements.length){await createDays(false);if(m.error)throw Error(m.error);}
    const ticket=m.generation;m.saving=true;m.error='';m.feedback='Consultando disponibilidade, histórico e conflitos…';redraw();
    try{
     const catalog=await rpc('iasdpi_schedule_catalog');if(ticket!==m.generation)return;
     if(catalog.actor_id!==m.owner||!catalog.departments.some(d=>d.id===m.department&&(d.can_edit??d.can_manage)&&d.active))throw Error('Permissão de gestão mudou. Seu formulário foi preservado.');
     const context=await rpc('iasdpi_schedule_rotation_context',{p_department:m.department,p_month:m.month+'-01'});
     if(ticket!==m.generation)return;
     if(context.department_id!==m.department||context.month!==m.month+'-01')throw Error('Contexto do rodízio inválido; seu formulário foi preservado.');
     m.catalog=catalog;m.context=context;const proposal=IASDPIScheduleRotation.propose(rotationSource());m.plan=proposal.plan;
     if(proposal.added)dirty();
     m.rotationReasons=[];if(!proposal.added&&vacancies()){const reasons=m.plan.requirements.filter(r=>r.assignments.length<r.required_count&&canEditDay(m.events.find(e=>e.id===r.event_id)?.scheduled_on)).flatMap(r=>IASDPIScheduleRotation.candidates(rotationSource(),r).flatMap(c=>c.reasons));m.rotationReasons=[...new Set(reasons)];}
     m.feedback=proposal.added?`Proposta editável: ${proposal.added} vagas sugeridas; ${vacancies()} pendentes. Atribuições existentes preservadas. Revise antes de salvar ou publicar.`:vacancies()?'0 vagas sugeridas. Nenhuma pessoa elegível.':'0 vagas sugeridas. Nenhuma vaga pendente neste período.';
    }catch(error){m.error=error.message;}finally{m.saving=false;redraw();}
   }
   if(action==='retry')await load();
   if(action==='reload'){if(canLeave()){m.plan=null;m.dirty=false;m.feedback='';await load();}}
   if(action==='save'||action==='publish')await save(action==='publish'?'published':'draft');
   if(action==='remove'&&editable()&&confirm('Remover esta função e suas atribuições somente do rascunho em edição?')){m.plan.requirements=m.plan.requirements.filter(r=>r.id!==button.dataset.id);dirty();redraw();}
   if(action==='compare'){const data=await rpc('iasdpi_schedule_workspace',{p_department:m.department,p_month:m.month+'-01'});m.remote=data.plan;m.feedback=data.plan?'Comparação carregada. Seu formulário foi preservado.':'Ainda não existe uma versão salva no banco.';redraw();}
   if(action==='version'){m.history=await rpc('iasdpi_schedule_plan_version',{p_id:m.plan.id,p_version:Number(button.dataset.version)});redraw();}
  })().catch(error=>{m.error=error.message;redraw();});
 });
 window.addEventListener('iasdpi-registry-saved',()=>{if(state.page!=='schedule-build'){m.status='idle';m.catalog=null;}else if(!m.dirty&&!m.saving)void load();});
 window.addEventListener('iasdpi-department-days-saved',e=>{const row=e.detail;if(!m.settings||!row)return;m.settings.department_weekdays[row.department_id]=row.weekdays;m.settings.department_days_versions[row.department_id]=row.version;if(m.department===row.department_id&&m.context)m.context.planning_weekdays=row.weekdays;const d=m.catalog?.departments.find(d=>d.id===row.department_id);if(d)d.version=row.version;redraw();});
 window.addEventListener('beforeunload',e=>{if(m.dirty||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.status='idle';m.catalog=null;m.context=null;m.remote=null;m.history=null;redraw();});
 window.addEventListener('iasdpi-portal-context',()=>{m.generation++;m.status='idle';m.catalog=null;});
 return {page,load,canLeave,dates};
})();

// B1.1 — projeção administrativa dos cadastros normalizados, sem cadastro paralelo.
window.IASDPIScheduleDailyAdmin=(()=>{
 const m={page:'',status:'idle',data:null,pending:new Map(),saving:false,error:'',feedback:'',generation:0,history:null,person:''};
 const rpc=(name,args={})=>IASDPISchedules.request(name,args),h=v=>esc(v),week=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
 const b=(text,action,extra='')=>`<button type="button" data-daily-action="${action}" ${extra}>${h(text)}</button>`;
 const option=(value,label,chosen)=>`<option value="${h(value)}" ${value===chosen?'selected':''}>${h(label)}</option>`;
 const dates=text=>[...new Set(text.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).map(value=>{const day=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:tryReadDate(value);if(!day)throw Error('Revise as datas: dd/mm/aaaa, separadas por vírgula.');return day;}))];
 function redraw(){if(['schedule-members','schedule-settings'].includes(state.page))render();}
 async function load(page=m.page){
  const ticket=++m.generation;m.page=page;m.status='loading';m.error='';redraw();
  try{
   const [settings,catalog]=await Promise.all([rpc('iasdpi_schedule_settings_get'),rpc('iasdpi_schedule_catalog')]);
   if(!catalog.is_admin||!settings.can_edit)throw Error('Área restrita aos administradores.');
   const content=await rpc(page==='schedule-members'?'iasdpi_schedule_members':'iasdpi_schedule_exceptions');if(ticket!==m.generation)return;
   m.data={settings,catalog,...(page==='schedule-members'?content:{exceptions:content})};
   if(page==='schedule-members'&&settings.availability_default==='available')m.data.members=m.data.members.map(p=>({...p,weekdays:Object.fromEntries(Array.from({length:7},(_,i)=>[i,p.weekdays?.[i]&&p.weekdays[i]!=='unknown'?p.weekdays[i]:'available']))}));
   m.status='ready';redraw();
  }catch(e){if(ticket!==m.generation)return;m.error=e.message;m.status='error';redraw();}
 }
 function canLeave(){if(m.saving){alert('Aguarde a confirmação administrativa.');return false;}if(m.pending.size&&!confirm('Descartar somente as alterações administrativas ainda não salvas?'))return false;m.pending.clear();return true;}
 function page(which){
  if(which==='schedule-members'&&window.IASDPIRegistry?.enabled())return IASDPIRegistry.page();
  if(m.page!==which||m.status==='idle'){m.page=which;queueMicrotask(()=>load(which));return '<p role="status">Carregando administração das escalas…</p>';}
  const title=heading('ADMINISTRAÇÃO · ESCALAS',which==='schedule-members'?(m.data?.settings.availability_enabled===false?'Membros':'Membros e disponibilidades'):'Período, dias e exceções',IASDPIScheduleUI.isReview()?'':'Cadastros e contas de login são entidades separadas. Somente administradores podem alterar esta página.');
  const nav='<p><a href="#schedule-build" data-b1-nav="schedule-build">Montar escala</a> · <a href="#schedule-members" data-b1-nav="schedule-members">Membros</a> · <a href="#schedule-settings" data-b1-nav="schedule-settings">Configurações</a> · <a href="#schedule-setup" data-b1-nav="schedule-setup">Vínculos e funções</a></p>';
  if(m.status==='loading')return title+nav+'<p role="status">Carregando dados confirmados…</p>';
  if(m.status==='error')return title+nav+`<p role="alert">${h(m.error)}</p><p>Esta área depende da migração 007. Entre com uma conta administradora pela tela de montagem.</p>${b('Tentar novamente','reload')}`;
  const banner=!IASDPIScheduleUI.isReview()&&window.IASDPISchedulePreview?`<p class="demo-banner">${window.IASDPIKnownPreviewSeed?.catalog.reference_preview?(window.IASDPIKnownPreviewSeed?.elder_periods?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade temporariamente desativada.':window.IASDPIKnownPreviewSeed?.simplified_daily?'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidade padrão para o automático.':'DEMONSTRAÇÃO — NOMES INFORMADOS; disponibilidades pendentes de confirmação.'):'DEMONSTRAÇÃO — DADOS FICTÍCIOS.'} Gravação apenas na memória desta aba.</p>`:'';
  return title+banner+nav+`<p role="status">${h(m.feedback)}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}`+(which==='schedule-members'?members():settings());
 }
 function members(){
  if(m.data.settings.availability_enabled===false)return membersWithoutAvailability();
  const c=m.data.catalog;
  const selected=m.data.members.find(p=>p.id===m.person);
  return `<section class="panel daily-person-picker"><h2>Dias e restrições por voluntário</h2><label>Voluntário<select id="daily-person" ${m.saving?'disabled':''}>${option('','Todos — visualizar planilha',m.person)}${c.people.map(p=>option(p.id,p.display_name,m.person)).join('')}</select></label><p>${m.data.settings.availability_advisory?'Todos começam disponíveis por padrão. Dias bloqueados e limites orientam somente o preenchimento automático; a escolha manual é permitida com aviso. Datas específicas indisponíveis prevalecem no automático.':'Selecione uma pessoa para editar seus dias sem rolar a planilha. Marque disponível ou indisponível; sem marcação significa <strong>Pendente de confirmação</strong>. Datas específicas indisponíveis prevalecem sobre os dias disponíveis.'}</p></section>${selected?personDays(m.pending.get(selected.id)||selected):''}<p>Uma pessoa mantém um único UUID em vários ministérios. Edite departamentos e funções pelos cadastros existentes. Limite mensal conta dias distintos; vazio significa não informado.</p><p>${m.data.settings.availability_advisory?'Sem restrição cadastrada = disponível por padrão para o automático. Escolhas manuais fora das preferências recebem aviso. Conflitos entre departamentos e permissões continuam sendo validados.':'Nenhuma flag marcada = disponibilidade desconhecida — Pendente de confirmação. Regras manuais/históricas permanecem preservadas e podem prevalecer sobre as flags.'}</p><details class="panel"><summary>Confirmar habilitação de uma pessoa</summary><p>Liderança ministerial e participação histórica não confirmam uma função. Informe somente a função verificada; a disponibilidade é confirmada separadamente nas flags abaixo.</p><form id="daily-qualification-confirm" class="schedule-grid"><label>Pessoa<select name="person_id">${c.people.filter(p=>p.active).map(p=>option(p.id,p.display_name,'')).join('')}</select></label><label>Departamento<select name="department_id">${c.departments.filter(d=>d.active).map(d=>option(d.id,d.name,'')).join('')}</select></label><label>Função confirmada<input name="role_name" required maxlength="120" placeholder="Informe a função verificada" list="daily-confirmed-roles"></label><datalist id="daily-confirmed-roles">${c.roles.filter(r=>r.active).map(r=>`<option value="${h(r.name)}"></option>`).join('')}</datalist><label class="checkbox"><input name="confirmed" type="checkbox" required>Confirmo que esta pessoa está habilitada para a função informada.</label><button type="submit">Confirmar habilitação</button></form></details><p><a href="#schedule-setup" data-b1-nav="schedule-setup">Cadastrar pessoa / editar vínculos e habilitações</a></p>${m.data.members.map(p=>`<form id="member-${h(p.id)}" data-member-form="${h(p.id)}"></form>`).join('')}
  ${selected?'':`<div class="table-scroll daily-member-scroll" tabindex="0" aria-label="Planilha de membros, rolagem horizontal"><table class="daily-member-table"><caption>Membros da igreja — dados dos cadastros de pessoas, vínculos, habilitações e disponibilidade</caption><thead><tr><th scope="col">Nome</th><th scope="col">Departamentos e funções</th>${week.map(d=>`<th scope="col">${d}</th>`).join('')}<th scope="col">Datas indisponíveis</th><th scope="col">Limite mensal</th><th scope="col">Ativo</th><th scope="col">Ações e histórico</th></tr></thead><tbody>${m.data.members.map(original=>{
   const p=m.pending.get(original.id)||original,form='member-'+p.id,attrs=`form="${h(form)}"`,memberships=c.memberships.filter(member=>member.person_id===p.id),links=memberships.map(member=>{const dep=c.departments.find(d=>d.id===member.department_id);const roles=c.qualifications.filter(q=>q.membership_id===member.id).map(q=>c.roles.find(r=>r.id===q.role_id)?.name).filter(Boolean);return (dep?.name||'Departamento indisponível')+' · '+(member.is_ministry_head?'Responsável ministerial; ':'')+(roles.join(', ')||'Habilitação: Pendente de confirmação')+(member.active?'':' (vínculo inativo)');});
   return `<tr data-member="${h(p.id)}"><td><label>Nome<input ${attrs} name="name" aria-label="Nome · ${h(p.name)}" value="${h(p.name)}" required maxlength="160"></label><small>Exibição: ${h(p.display_name)}</small></td><td>${links.map(h).join('<br>')||'Sem vínculos'}<small>${p.manual_rules||0} regras manuais preservadas</small></td>${week.map((day,i)=>`<td><label class="checkbox"><input ${attrs} type="checkbox" name="available_${i}" aria-label="Disponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='available'?'checked':''}> Disponível</label><label class="checkbox"><input ${attrs} type="checkbox" name="unavailable_${i}" aria-label="Indisponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='unavailable'?'checked':''}> Indisponível</label></td>`).join('')}<td><label>Datas — dd/mm/aaaa<textarea ${attrs} name="dates" aria-label="Datas indisponíveis · ${h(p.name)}" rows="2">${h(p.raw_dates??(p.unavailable_dates||[]).map(displayDate).join(', '))}</textarea></label></td><td><label>Dias distintos<input ${attrs} type="number" name="max_monthly_count" aria-label="Limite mensal · ${h(p.name)}" min="0" max="100" value="${h(p.max_monthly_count??'')}" placeholder="Pendente de confirmação"></label></td><td><input ${attrs} name="active" type="checkbox" aria-label="Ativo · ${h(p.name)}" ${p.active?'checked':''}></td><td><button type="submit" aria-label="Salvar ${h(p.name)}" ${attrs} ${m.saving?'disabled':''}>Salvar linha</button>${b('Histórico','history','data-person="'+h(p.id)+'" aria-label="Histórico de '+h(p.name)+'"')}<p role="status" data-member-status="${h(p.id)}">${m.pending.has(p.id)?'Alterações pendentes':''}</p></td></tr>`;
  }).join('')}</tbody></table></div>`}${m.history?`<section class="panel" id="daily-history" tabindex="-1"><h2>Histórico de escalas</h2><ul>${m.history.current.map(row=>`<li>${h(displayDate(row.assigned_on))} · ${h(row.department)} · ${h(row.role)} · ${h(row.status)}</li>`).join('')||'<li>Sem atribuições atuais.</li>'}</ul><h3>Versões registradas</h3><ul>${m.history.versions.map(row=>`<li>${h(row.title)} · versão ${row.version} · ${h(row.status)}</li>`).join('')||'<li>Sem versões para esta pessoa.</li>'}</ul></section>`:''}`;
 }
 function membersWithoutAvailability(){
  const c=m.data.catalog,selected=m.data.members.find(p=>p.id===m.person),visible=selected?[selected]:m.data.members;
  return `<section class="panel"><h2>Membros</h2>${IASDPIScheduleUI.isReview()?'':'<p id="availability-paused" role="status">Disponibilidade temporariamente desativada. Os dados anteriores estão preservados e não são usados no preenchimento automático.</p>'}<label>Voluntário<select id="daily-person">${option('','Todos — visualizar planilha',m.person)}${c.people.map(p=>option(p.id,p.display_name,m.person)).join('')}</select></label></section>${m.data.members.map(p=>`<form id="member-${h(p.id)}" data-member-form="${h(p.id)}"></form>`).join('')}
  <div class="table-scroll daily-member-scroll" tabindex="0" aria-label="Cadastro de membros"><table class="daily-member-table members-core"><caption>Pessoas, vínculos e limites mensais — disponibilidade desativada</caption><thead><tr><th>Nome</th><th>Departamentos</th><th>Limite mensal</th><th>Ativo</th><th>Salvar</th></tr></thead><tbody>${visible.map(original=>{const p=m.pending.get(original.id)||original,attrs=`form="member-${h(p.id)}"`;return `<tr data-member="${h(p.id)}"><td><label>Nome<input ${attrs} name="name" value="${h(p.name)}" required maxlength="160"></label></td><td>${c.memberships.filter(member=>member.person_id===p.id).map(member=>h(c.departments.find(d=>d.id===member.department_id)?.name||'Departamento indisponível')).join('<br>')}</td><td><label>Dias distintos<input ${attrs} name="max_monthly_count" type="number" min="0" max="100" value="${h(p.max_monthly_count??'')}" placeholder="Não informado"></label></td><td><label><input ${attrs} name="active" type="checkbox" ${p.active?'checked':''}>Ativo</label></td><td><button ${attrs} type="submit" ${m.saving?'disabled':''}>Salvar linha</button><p role="status" data-member-status="${h(p.id)}">${m.pending.has(p.id)?'Alterações pendentes':''}</p></td></tr>`;}).join('')}</tbody></table></div>`;
 }
 function personDays(p){
  const attrs=`form="member-${h(p.id)}"`;
  return `<section class="panel daily-person-days" data-member="${h(p.id)}"><h2>Dias e restrições — ${h(p.display_name)}</h2><input ${attrs} type="hidden" name="name" value="${h(p.name)}"><fieldset><legend>Dias da semana — ${h(p.display_name)}</legend><div class="daily-week-grid">${week.map((day,i)=>`<fieldset><legend>${day}</legend><label class="checkbox"><input ${attrs} type="checkbox" name="available_${i}" aria-label="Disponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='available'?'checked':''}>Disponível</label><label class="checkbox"><input ${attrs} type="checkbox" name="unavailable_${i}" aria-label="Indisponível ${day} · ${h(p.name)}" ${p.weekdays?.[i]==='unavailable'?'checked':''}>Indisponível</label></fieldset>`).join('')}</div></fieldset><div class="schedule-grid"><label>Datas indisponíveis — dd/mm/aaaa<textarea ${attrs} name="dates" aria-label="Datas indisponíveis · ${h(p.name)}" rows="3" placeholder="Ex.: 15/11/2026, 22/11/2026">${h(p.raw_dates??(p.unavailable_dates||[]).map(displayDate).join(', '))}</textarea></label><label>Limite mensal — dias distintos<input ${attrs} type="number" name="max_monthly_count" min="0" max="100" value="${h(p.max_monthly_count??'')}" placeholder="Pendente de confirmação"></label></div><label class="checkbox"><input ${attrs} name="active" type="checkbox" ${p.active?'checked':''}>Voluntário ativo</label><p>${p.manual_rules||0} regras manuais preservadas. ${m.data.settings.availability_advisory?'Restrições orientam somente o automático e não bloqueiam a escolha manual.':'Restrições valem para todos os departamentos; habilitações são confirmadas separadamente.'}</p><button type="submit" ${attrs} ${m.saving?'disabled':''}>Salvar restrições</button><p role="status" data-member-status="${h(p.id)}">${m.pending.has(p.id)?'Alterações pendentes':''}</p></section>`;
 }
 function settings(){
  const s=m.data.settings,c=m.data.catalog;
  return `<section class="panel"><form id="daily-settings"><h2>Período de edição das escalas</h2><label>Meses futuros liberados<select name="planning_months">${[1,2,3,6].map(n=>option(n,n+' '+(n===1?'mês':'meses'),s.planning_months)).join('')}</select></label><p>O mês atual fica sempre aberto a partir de hoje. Futuros: ${s.future_months.map(value=>IASDPIScheduleUI.monthLabel(value.slice(0,7))).join(' · ')}.</p>${IASDPIScheduleUI.help('edit-window-settings','Dias encerrados ficam somente para consulta. Esta configuração libera os meses seguintes para criação e edição; a geração do período continua começando no próximo mês, sem apagar escalas existentes.','Como funciona o período de edição')}${s.department_days_enabled?'<p>Configure os dias na tela de cada departamento.</p>':`<fieldset><legend>Dias usados na geração</legend>${week.map((day,i)=>`<label class="checkbox"><input type="checkbox" name="weekday" value="${i}" ${s.weekdays.includes(i)?'checked':''}> ${day}</label>`).join('')}</fieldset>`}<label>Datas extraordinárias — dd/mm/aaaa, separadas por vírgula<textarea name="extra_dates" rows="2">${h(s.extra_dates.map(displayDate).join(', '))}</textarea></label><button type="submit" ${m.saving?'disabled':''}>Salvar configuração</button></form></section>
  <section class="panel"><h2>Autorizar exceção entre departamentos</h2><p>A autorização é por pessoa, data e par de departamentos. Não dispensa habilitação, disponibilidade confirmada ou limite mensal.</p><form id="daily-exception" class="schedule-grid"><label>Pessoa<select name="person_id">${c.people.filter(p=>p.active).map(p=>option(p.id,p.display_name,'')).join('')}</select></label><label>Data — dd/mm/aaaa<input name="day" required placeholder="10/11/2026"></label>${['a','b'].map((key,i)=>`<label>Departamento ${i+1}<select name="department_${key}">${c.departments.filter(d=>d.active).map((d,j)=>option(d.id,d.name,c.departments[i]?.id)).join('')}</select></label>`).join('')}<label>Justificativa<input name="reason" required minlength="10" maxlength="2000"></label><button type="submit" ${m.saving?'disabled':''}>Autorizar exceção</button></form><ul>${m.data.exceptions.map(x=>`<li>${h(displayDate(x.day))} · ${h(c.people.find(p=>p.id===x.person_id)?.display_name||x.person_id)} · ${h(x.reason)} · ${x.enabled?'Ativa':'Revogada'}<small>Autorizada por ${h(x.approved_by)} em ${h(x.approved_at)}</small>${x.enabled?b('Revogar','revoke','data-id="'+h(x.id)+'"'):''}</li>`).join('')||'<li>Nenhuma exceção autorizada.</li>'}</ul></section>`;
 }
 function collect(id,parse=false){const original=m.data.members.find(p=>p.id===id),form=document.getElementById('member-'+id),fd=new FormData(form),flags={};for(let i=0;i<7;i++)flags[i]=fd.has('unavailable_'+i)?'unavailable':fd.has('available_'+i)?'available':'unknown';return {...original,name:String(fd.get('name')),active:fd.has('active'),weekdays:m.data.settings.availability_enabled===false?original.weekdays:flags,raw_dates:m.data.settings.availability_enabled===false?original.raw_dates:String(fd.get('dates')),unavailable_dates:m.data.settings.availability_enabled===false?original.unavailable_dates:parse?dates(String(fd.get('dates'))):original.unavailable_dates,max_monthly_count:fd.get('max_monthly_count')===''?null:Number(fd.get('max_monthly_count'))};}
 document.addEventListener('change',e=>{if(e.target.id==='daily-person'&&!m.saving){m.person=e.target.value;redraw();document.getElementById('daily-person')?.focus();}});
 document.addEventListener('input',e=>{
  const form=e.target.form;if(!form||m.saving)return;
  if(form.dataset.memberForm){const id=form.dataset.memberForm;if(e.target.type==='checkbox'&&/^(un)?available_/.test(e.target.name)&&e.target.checked){const other=e.target.name.startsWith('unavailable_')?e.target.name.replace('unavailable_','available_'):e.target.name.replace('available_','unavailable_');form.elements[other].checked=false;}
   try{m.pending.set(id,collect(id));}catch(_){m.pending.set(id,{...m.data.members.find(p=>p.id===id)});}document.querySelector('[data-member-status="'+id+'"]').textContent='Alterações pendentes';
  }else if(['daily-settings','daily-exception','daily-qualification-confirm'].includes(form.id))m.pending.set(form.id,true);
 });
 document.addEventListener('submit',e=>{
  const form=e.target;if(!form.dataset.memberForm&&!['daily-settings','daily-exception','daily-qualification-confirm'].includes(form.id))return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;
  void(async()=>{
   m.saving=true;m.error='';const submit=form.dataset.memberForm?document.querySelector('button[form="'+form.id+'"]'):form.querySelector('button[type=submit]');submit.disabled=true;
   if(form.id==='daily-qualification-confirm'){
    try{
     const data=new FormData(form),department=String(data.get('department_id')),person=String(data.get('person_id')),name=String(data.get('role_name')||'').trim();
     if(!data.has('confirmed')||name.length<2)throw Error('Confirme explicitamente a habilitação e informe a função.');
     let role=m.data.catalog.roles.find(r=>r.department_id===department&&r.name.trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
     if(role&&!role.active)throw Error('A função está inativa. Revise o cadastro antes de confirmar.');
     if(!role)role=await rpc('iasdpi_schedule_save',{p_entity:'role',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{department_id:department,name},p_request_id:crypto.randomUUID()});
     const member=m.data.catalog.memberships.find(x=>x.person_id===person&&x.department_id===department),roles=[...new Set([...m.data.catalog.qualifications.filter(q=>q.membership_id===member?.id).map(q=>q.role_id),role.id])];
     await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:member?.id||crypto.randomUUID(),p_expected_version:member?.version||0,p_data:{person_id:person,department_id:department,active:true,role_ids:roles},p_request_id:crypto.randomUUID()});
     m.pending.delete(form.id);m.feedback=window.IASDPISchedulePreview?'Habilitação confirmada somente nesta prévia local.':'Habilitação confirmada pelo Supabase.';await load();
    }catch(error){m.error=error.message;let alert=form.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message;}
    finally{m.saving=false;submit.disabled=false;if(m.status==='ready'&&!m.error)redraw();}
    return;
   }
   try{
    if(form.dataset.memberForm){const id=form.dataset.memberForm,p=collect(id,true);await rpc('iasdpi_schedule_member_save',{p_id:id,p_expected_version:p.version,p_data:{name:p.name,display_name:p.display_name,active:p.active,max_monthly_count:p.max_monthly_count,...(m.data.settings.availability_enabled===false?{}:{weekdays:p.weekdays,unavailable_dates:p.unavailable_dates})},p_request_id:crypto.randomUUID()});m.pending.delete(id);}
    if(form.id==='daily-settings'){const fd=new FormData(form);await rpc('iasdpi_schedule_settings_save',{p_expected_version:m.data.settings.version,p_data:{planning_months:Number(fd.get('planning_months')),...(m.data.settings.department_days_enabled?{}:{weekdays:fd.getAll('weekday').map(Number)}),extra_dates:dates(String(fd.get('extra_dates')))}});m.pending.delete(form.id);}
    if(form.id==='daily-exception'){if(!confirm('Autorizar explicitamente esta pessoa nos dois departamentos nesta data?'))return;const fd=new FormData(form);await rpc('iasdpi_schedule_exception_save',{p_id:crypto.randomUUID(),p_expected_version:0,p_data:{person_id:fd.get('person_id'),day:dates(String(fd.get('day')))[0],department_a:fd.get('department_a'),department_b:fd.get('department_b'),reason:fd.get('reason')}});m.pending.delete(form.id);}
    m.feedback=IASDPIScheduleUI.isReview()?'Alterações salvas nesta aba.':window.IASDPISchedulePreview?'Gravação simulada na memória desta aba.':'Alteração confirmada pelo Supabase.';await load();
   }catch(error){m.error=error.message;if(form.dataset.memberForm)document.querySelector('[data-member-status="'+form.dataset.memberForm+'"]').textContent=error.message;else{let alert=form.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.setAttribute('role','alert');form.append(alert);}alert.textContent=error.message;}}
   finally{m.saving=false;submit.disabled=false;if(m.status==='ready'&&!m.error)redraw();}
  })();
 },true);
 document.addEventListener('click',e=>{const el=e.target.closest('[data-daily-action]');if(!el||m.saving)return;e.preventDefault();void(async()=>{
  if(el.dataset.dailyAction==='reload'){if(canLeave())await load();}
  if(el.dataset.dailyAction==='history'){m.history=await rpc('iasdpi_schedule_person_history',{p_person:el.dataset.person});redraw();document.getElementById('daily-history')?.focus();}
  if(el.dataset.dailyAction==='revoke'&&confirm('Revogar esta autorização? Se estiver em uso, o banco impedirá a revogação.')){const x=m.data.exceptions.find(x=>x.id===el.dataset.id);await rpc('iasdpi_schedule_exception_save',{p_id:x.id,p_expected_version:x.version,p_data:{enabled:false}});await load();}
 })().catch(error=>{m.error=error.message;redraw();});});
 window.addEventListener('beforeunload',e=>{if(m.pending.size||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.status='idle';m.data=null;m.pending.clear();m.history=null;redraw();});
 return {page,canLeave};
})();

'use strict';
// Períodos civis inclusivos. Uma semana conserva a identidade ao atravessar meses.
window.IASDPIElderPeriods=(()=>{
 const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Data do período inválida.');const d=new Date(value+'T12:00:00Z');if(isNaN(d)||d.toISOString().slice(0,10)!==value)throw Error('Data do período inválida.');return d;};
 const iso=d=>d.toISOString().slice(0,10),add=(value,n)=>{const d=day(value);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
 function range(start,end){const first=day(start),last=day(end);if(last<first||last-first>32*86400000)throw Error('Intervalo do período inválido.');const out=[];for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1))out.push(iso(d));return out;}
 function periods(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||Number(month.slice(0,4))<1000||Number(month.slice(0,4))>9998)throw Error('Mês inválido.');
  day(month+'-01');const first=month+'-01',lastDate=day(first);lastDate.setUTCMonth(lastDate.getUTCMonth()+1);lastDate.setUTCDate(0);const last=iso(lastDate),rows=[];
  for(let start=add(first,-day(first).getUTCDay());start<=last;start=add(start,7))rows.push({kind:'weekly',starts_on:start,ends_on:add(start,6)});
  return [...rows,{kind:'monthly',starts_on:first,ends_on:last}];
 }
 const key=row=>row.kind+':'+row.starts_on;
 // Ancião do mês é uma referência de responsabilidade; não reserva os dias do mês.
 const conflictsEnabled=row=>row.kind!=='monthly';
 function reasons(catalog,department,row,person,commitments,automatic=false,pending=[]){
  const p=catalog.people.find(p=>p.id===person),m=catalog.memberships.find(m=>m.person_id===person&&m.department_id===department),out=[],days=range(row.starts_on,row.ends_on);
  if(!p?.active||!m?.active)out.push('Pessoa inativa ou sem vínculo ativo no Ancionato');
  if(conflictsEnabled(row)&&commitments.some(a=>conflictsEnabled(a)&&a.person_id===person&&a.department_id!==department&&a.status==='published'&&days.includes(a.date)))out.push('Conflito com outro departamento em uma data deste período');
  if(automatic&&catalog.central_registry)out.push(...IASDPIRegistry.periodReasons(catalog,department,row,person));
  if(automatic)for(const [maximum,onlyDepartment] of [[p?.max_monthly_count,false],[m?.max_monthly_count,true]]){if(maximum==null)continue;const dates=new Set([...commitments.filter(a=>a.person_id===person&&a.status==='published'&&(!onlyDepartment||a.department_id===department)),...pending.filter(a=>a.person_id===person).flatMap(a=>range(a.starts_on,a.ends_on).map(date=>({date})))].map(a=>a.date));for(const date of days)dates.add(date);if([...new Set(days.map(d=>d.slice(0,7)))].some(mon=>[...dates].filter(d=>d.slice(0,7)===mon).length>maximum))out.push('Limite mensal informado: período não sugerido automaticamente');}
  return out;
 }
 function propose(rows,catalog,department,commitments,history=[]){
  const people=catalog.people.filter(p=>p.active&&catalog.memberships.some(m=>m.person_id===p.id&&m.department_id===department&&m.active)),result=structuredClone(rows);let added=0;
  const used=new Map(),round=new Set(result.filter(r=>r.person_id).map(r=>r.person_id));for(const r of [...history,...result])if(r.person_id)used.set(r.person_id,(used.get(r.person_id)||0)+1);
  const ordered=people.map(p=>p.id).sort(),previous=[...history].filter(r=>r.person_id).sort((a,b)=>b.starts_on.localeCompare(a.starts_on))[0];let cursor=previous?(ordered.indexOf(previous.person_id)+1)%ordered.length:0;
  for(const row of result){if(row.person_id)continue;const choices=people.filter(p=>!reasons(catalog,department,row,p.id,commitments,true,result).length);if(choices.length&&choices.every(p=>round.has(p.id)))round.clear();choices.sort((a,b)=>Number(round.has(a.id))-Number(round.has(b.id))||(used.get(a.id)||0)-(used.get(b.id)||0)||((ordered.indexOf(a.id)-cursor+ordered.length)%ordered.length)-((ordered.indexOf(b.id)-cursor+ordered.length)%ordered.length)||a.id.localeCompare(b.id));
   if(choices.length){row.person_id=choices[0].id;round.add(row.person_id);used.set(row.person_id,(used.get(row.person_id)||0)+1);cursor=(ordered.indexOf(row.person_id)+1)%ordered.length;added++;}
  }return {rows:result,added};
 }
 function year(year){if(!/^\d{4}$/.test(String(year))||Number(year)<1000||Number(year)>9998)throw Error('Ano inválido.');return Array.from({length:12},(_,index)=>periods(year+'-'+String(index+1).padStart(2,'0')).find(r=>r.kind==='monthly'));}
 return {periods,year,range,key,reasons,propose,conflictsEnabled};
})();

window.IASDPIScheduleElders=(()=>{
 const m={key:'',generation:0,status:'idle',catalog:null,settings:null,department:'',month:'',kind:'weekly',rows:[],history:[],commitments:[],pending:new Map(),saving:false,error:'',feedback:'',versions:[],historyKey:'',request:crypto.randomUUID(),signature:''};
 const h=v=>esc(v),rpc=(name,args)=>IASDPISchedules.request(name,args),engine=IASDPIElderPeriods,clean=()=>!window.IASDPISchedulePreview||IASDPIScheduleUI.isReview();
 const redraw=()=>{if(state.page==='schedule-build')render();};
 const action=(label,name,extra='')=>`<button type="button" data-elder-action="${name}" ${clean()&&name==='prefill'?'class="schedule-auto-fill"':''} ${m.saving?'disabled':''} ${extra}>${h(label)}</button>`;
 const rows=()=>m.rows.filter(r=>r.kind===m.kind).map(r=>m.pending.get(engine.key(r))||r);
 async function load(){const ticket=++m.generation;m.status='loading';m.error='';redraw();try{
  const result=await rpc('iasdpi_schedule_elder_workspace',{p_department:m.department,p_month:m.month+'-01',p_year:Number(m.month.slice(0,4))});if(ticket!==m.generation)return;
  if(!Array.isArray(result.periods)||!Array.isArray(result.commitments)||!Array.isArray(result.history))throw Error('Resposta de períodos inválida.');
  if(result.central_registry){m.catalog.central_registry=true;m.catalog.registry_days=result.availability_days||[];}
  m.rows=result.periods;m.commitments=result.commitments;m.history=result.history;m.status='ready';redraw();
 }catch(e){if(ticket!==m.generation)return;m.status='error';m.error=e.message;redraw();}}
 function canLeave(){if(m.saving){alert('Aguarde a confirmação da escala de anciãos.');return false;}if(m.pending.size&&!confirm('Descartar somente as alterações de anciãos ainda não salvas?'))return false;m.pending.clear();return true;}
 function periodContents(row,manage,people){
  manage=manage&&IASDPIScheduleEditWindow.period(row,m.settings);
  const label=displayDate(row.starts_on)+' a '+displayDate(row.ends_on),conflicts=row.person_id?engine.reasons(m.catalog,m.department,row,row.person_id,m.commitments):[],weekly=row.kind==='weekly';
  return `<div class="elder-period-assignment"><label>${weekly?'Ancião da semana':'Ancião do mês'}<select data-elder-person aria-label="${h((weekly?'Ancião da semana':'Ancião do mês')+' · '+label)}" ${!manage||m.saving?'disabled':''}><option value="">A definir</option>${people.map(p=>{const reasons=engine.reasons(m.catalog,m.department,row,p.id,m.commitments);return `<option value="${h(p.id)}" ${row.person_id===p.id?'selected':''} ${reasons.length&&row.person_id!==p.id?'disabled':''}>${h(p.display_name+(reasons.length?' · '+reasons.join('; '):''))}</option>`;}).join('')}</select></label>${clean()?`<div class="elder-period-meta"><small>${h(row.starts_on.slice(8)+'/'+row.starts_on.slice(5,7)+' – '+row.ends_on.slice(8)+'/'+row.ends_on.slice(5,7))} · ${row.status==='published'?'Publicado':'Rascunho'}</small>${IASDPIScheduleUI.help('period-help-'+row.id,'Período: '+label+'. Versão '+row.version+'.'+(row.source_name?' Referência da Agenda: '+row.source_name+'.':'')+(weekly?' Uma única escolha cobre toda a semana, inclusive na virada do mês.':' A escolha mensal é independente da semanal.'),'Detalhes do período '+label)}</div>`:`<small>${h(label)} · ${row.status==='published'?'Publicado':'Rascunho'} · versão ${row.version}</small>`}${!clean()&&row.source_name?`<small>Referência da Agenda: ${h(row.source_name)}. A fonte original não é alterada.</small>`:''}${!clean()&&weekly&&row.starts_on.slice(0,7)!==row.ends_on.slice(0,7)?'<small>A mesma semana aparece nos dois meses, com uma única atribuição.</small>':''}${conflicts.length?`<p role="alert">${h(conflicts.join('; '))}</p>`:''}${row.version?`<button type="button" data-elder-history="${h(engine.key(row))}" ${m.saving?'disabled':''}>Histórico</button>`:''}</div>`;
 }
 function calendar(list,manage,people){
  if(m.kind==='monthly')return `<div class="elder-year-calendar" aria-label="Calendário anual de anciãos · ${h(m.month.slice(0,4))}">${list.map(row=>{const monthName=new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'America/Sao_Paulo'}).format(new Date(row.starts_on+'T12:00:00Z'));return `<article class="elder-period elder-month-card" data-elder-period="${h(engine.key(row))}"><h3>${h(monthName)}</h3><span class="sr-only">Primeiro ao último dia do mês</span>${periodContents(row,manage,people)}</article>`;}).join('')}</div>`;
  return `<div class="elder-week-calendar monthly-calendar monthly-ancionato" aria-label="Calendário mensal · ancião por semana"><div class="calendar-weekdays" aria-hidden="true">${['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(day=>'<span>'+day+'</span>').join('')}</div>${list.map(row=>`<article class="elder-period elder-week-row" data-elder-period="${h(engine.key(row))}"><div class="elder-week-days">${engine.range(row.starts_on,row.ends_on).map(day=>`<div class="elder-calendar-day ${day.slice(0,7)===m.month?'':'is-outside'}" ${day===m.settings.today?'aria-current="date"':''}><time datetime="${day}" aria-label="${h(displayDate(day))}">${Number(day.slice(8))}</time></div>`).join('')}</div>${periodContents(row,manage,people)}</article>`).join('')}</div>`;
 }
 function page(catalog,settings,department,month,openMonth){
  m.openMonth=openMonth;m.catalog=catalog;m.settings=settings;
  const next=catalog.actor_id+':'+department+':'+month;
  if(next!==m.key){m.key=next;m.catalog=catalog;m.settings=settings;m.department=department;m.month=month;m.status='idle';m.rows=[];m.pending.clear();m.feedback='';m.versions=[];m.historyKey='';m.request=crypto.randomUUID();m.signature='';}
  const manage=catalog.departments.some(d=>d.id===department&&d.active&&(d.can_edit??d.can_manage)),publish=catalog.departments.some(d=>d.id===department&&d.active&&(d.can_publish??d.can_manage)),title=heading('ESCALAS · ANCIONATO','Escalas de anciãos',clean()?'':'Calendário mensal por semana e calendário anual para o ancião de cada mês.');
  const nav=`<nav class="monthly-departments" aria-label="Departamentos das escalas">${IASDPIScheduleUI.departments(catalog).map(d=>`<button type="button" data-b1-action="department" data-department="${h(d.id)}" aria-pressed="${d.id===department}" ${m.saving?'disabled':''}>${h(d.name)}</button>`).join('')}</nav>`;
  if(m.status==='idle'){queueMicrotask(load);return title+nav+'<p role="status">Carregando semanas e escala mensal…</p>';}
  if(m.status==='loading')return title+nav+'<p role="status">Carregando semanas e escala mensal…</p>';
  if(m.status==='error')return title+nav+`<p role="alert">${h(m.error)}</p>${action('Tentar novamente','reload')}`;
  const list=rows(),filled=list.filter(r=>r.person_id).length,people=catalog.people.filter(p=>catalog.memberships.some(member=>member.department_id===department&&member.person_id===p.id&&member.active));
  return title+nav+`${clean()?'':'<p class="demo-banner">PRÉVIA — alterações somente na memória desta aba. Disponibilidade temporariamente desativada; dados anteriores preservados.</p>'}
  <section class="panel"><div class="elder-tabs" role="group" aria-label="Tipo de escala do Ancionato">${action('Ancião da semana','kind','data-kind="weekly" aria-pressed="'+(m.kind==='weekly')+'"')}${action('Ancião do mês — ano','kind','data-kind="monthly" aria-pressed="'+(m.kind==='monthly')+'"')}</div>
  ${m.kind==='weekly'?`<form id="elder-month" class="schedule-grid">${clean()?IASDPIScheduleUI.monthPicker('elder-month-value',month,m.saving):`<label>Mês e ano<input type="month" name="month" value="${h(month)}" required ${m.saving?'disabled':''}></label><button type="submit" ${m.saving?'disabled':''}>Abrir mês</button>`}</form><div class="monthly-toolbar">${action('Mês anterior','month','data-direction="-1"')}${action('Próximo mês','month','data-direction="1"')}</div>`:`<form id="elder-year" class="schedule-grid">${clean()?IASDPIScheduleUI.yearSelect('elder-year-value',month.slice(0,4),m.saving):`<label>Ano<input type="number" name="year" min="1000" max="9998" step="1" value="${h(month.slice(0,4))}" required ${m.saving?'disabled':''}></label><button type="submit" ${m.saving?'disabled':''}>Abrir ano</button>`}</form><div class="monthly-toolbar">${action('Ano anterior','year','data-direction="-1"')}${action('Próximo ano','year','data-direction="1"')}</div>`}
  ${clean()?IASDPIScheduleUI.help('elder-guide',m.kind==='weekly'?'Escolha um ancião para cada semana, de domingo a sábado. A mesma semana mantém uma única escolha na virada do mês. Conflitos com outros departamentos são verificados antes de salvar.':'Escolha um ancião em cada mês. O Ancião do mês não bloqueia a participação em outros departamentos. Salvar e publicar esta aba não altera as semanas.','Ajuda sobre a escala de anciãos'):`<p>${m.kind==='weekly'?'Uma única seleção por semana, de domingo a sábado. Os dias de outros meses aparecem discretamente para completar a semana.':'Uma seleção por mês, de janeiro a dezembro. Conflitos do Ancião do mês desativados: esta responsabilidade não bloqueia a participação em outros departamentos. A proteção semanal permanece ativa.'}</p>`}</section>
  ${window.IASDPIScheduleDepartmentDays?.page(catalog,settings,department)||''}
  <section class="panel" aria-label="${m.kind==='weekly'?'Escala semanal de anciãos':'Escala anual de anciãos por mês'}"><h2>${h(m.kind==='weekly'?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(month+'-01T12:00:00Z')):'Ancião do mês · '+month.slice(0,4))}</h2>${calendar(list,manage,people)}<p class="elder-summary">${filled} de ${list.length} períodos preenchidos.</p>
  <div class="monthly-toolbar schedule-publishbar" aria-label="Salvar e publicar escala de anciãos">${manage?action('Preencher automaticamente','prefill')+action('Limpar escala','clear','class="schedule-clear" '+(!m.saving&&!list.some(r=>r.person_id)?'disabled':''))+action('Salvar '+(m.kind==='weekly'?'semanas':'ano'),'save'):''}${publish?action('Publicar '+(m.kind==='weekly'?'semanas':'ano'),'publish','class="primary"'):''}${action(clean()?'Recarregar escala':'Atualizar períodos','reload')}<a class="button schedule-secondary" href="#schedule-calendar" data-b1-nav="schedule-calendar" data-schedule-month="${h(m.month)}" data-schedule-department="Ancionato">${clean()?'Ver calendário':'Ver no calendário'}</a></div><p role="status" id="elder-feedback">${h(IASDPIScheduleUI.feedback(m.feedback)||(m.pending.size?'Alterações pendentes.':clean()?'':'Nenhuma alteração pendente.'))}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}${m.historyKey?`<details class="elder-history" open><summary>Histórico · ${m.historyKey.startsWith('weekly')?'Semana':'Mês'} de ${h(displayDate(m.historyKey.split(':')[1]))}</summary>${m.versions.length?m.versions.map(v=>`<p>Versão ${h(v.version)} · ${v.snapshot.status==='published'?'Publicada':'Rascunho'} · ${h(window.IASDPIRegistry?.personName(m.catalog,v.snapshot.person_id)||m.catalog.people.find(p=>p.id===v.snapshot.person_id)?.display_name||'A definir')}<small>${h(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(new Date(v.captured_at)))} · Autor: ${h(v.actor_id)}</small></p>`).join(''):'<p>Nenhuma versão.</p>'}</details>`:''}${clean()?'':'<p>Salvar e publicar nesta prévia são simulações. Cada aba é salva separadamente; recarregar a página reinicia a demonstração.</p>'}</section>`;
 }
 document.addEventListener('change',e=>{if(!e.target.matches('[data-elder-person]')||m.saving)return;const key=e.target.closest('[data-elder-period]').dataset.elderPeriod,row=m.pending.get(key)||m.rows.find(r=>engine.key(r)===key);if(!row||!IASDPIScheduleEditWindow.period(row,m.settings)){redraw();return;}m.pending.set(key,{...row,person_id:e.target.value||null});m.error='';m.feedback='Alterações pendentes.';redraw();document.querySelector('[data-elder-period="'+key+'"] select')?.focus({preventScroll:true});});
 async function save(status){
  const d=m.catalog?.departments.find(d=>d.id===m.department);if(!d||!(status==='published'?(d.can_publish??d.can_manage):(d.can_edit??d.can_manage)))throw Error('Sem permissão para esta ação do Ancionato.');
  if(status==='published'&&!confirm(clean()?'Publicar os períodos desta aba?':'Publicar somente esta escala de anciãos na demonstração? A outra aba não será alterada.'))return;
  const changes=rows().filter(r=>IASDPIScheduleEditWindow.period(r,m.settings)&&(status==='published'||m.pending.has(engine.key(r))));if(!changes.length){m.feedback='Nenhuma alteração para salvar nesta aba.';redraw();return;}
  const signature=JSON.stringify({department:m.department,status,changes});if(m.signature&&m.signature!==signature)m.request=crypto.randomUUID();m.signature=signature;
  m.saving=true;m.error='';m.feedback='Aguardando confirmação…';redraw();try{
   const result=await rpc('iasdpi_schedule_elder_save',{p_department:m.department,p_status:status,p_rows:changes.map(r=>({id:r.id,kind:r.kind,starts_on:r.starts_on,ends_on:r.ends_on,person_id:r.person_id,expected_version:r.version})),p_request_id:m.request});
   if(!Array.isArray(result.periods)||result.periods.length!==changes.length||new Set(result.periods.map(engine.key)).size!==changes.length||result.periods.some(row=>!changes.some(change=>change.id===row.id&&engine.key(change)===engine.key(row)&&change.ends_on===row.ends_on&&(change.person_id||null)===(row.person_id||null)&&row.version===change.version+1&&row.status===status)))throw Error('Confirmação de gravação inválida.');
   for(const row of result.periods){const key=engine.key(row);m.pending.delete(key);m.rows=m.rows.map(r=>engine.key(r)===key?row:r);}
   m.request=crypto.randomUUID();m.signature='';if(status==='published')window.dispatchEvent(new Event('iasdpi-schedule-published'));
   m.feedback=(window.IASDPISchedulePreview?'Alterações confirmadas somente na memória desta demonstração.':'Alterações confirmadas pelo Supabase.')+(status==='published'?' Escala publicada. Abra Ver no calendário.':' Rascunho salvo; ainda não publicado.');
  }catch(e){m.error=e.message+' Suas alterações foram preservadas.';m.feedback='';}finally{m.saving=false;redraw();}
 }
 document.addEventListener('click',e=>{const button=e.target.closest('[data-elder-history]');if(!button||m.saving)return;const row=m.rows.find(r=>engine.key(r)===button.dataset.elderHistory);if(!row)return;void rpc('iasdpi_schedule_elder_versions',{p_department:m.department,p_kind:row.kind,p_starts_on:row.starts_on}).then(list=>{if(!Array.isArray(list))throw Error('Histórico inválido.');m.historyKey=engine.key(row);m.versions=list;redraw();}).catch(e=>{m.error=e.message;redraw();});});
 document.addEventListener('submit',e=>{if(e.target.id!=='elder-month')return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;const value=new FormData(e.target).get('month');try{engine.periods(value);if(clean()&&value===m.month)return;if(canLeave())m.openMonth(value);else IASDPIScheduleUI.restoreMonth(e.target,m.month);}catch(error){m.error=error.message;redraw();}},true);
 document.addEventListener('submit',e=>{if(e.target.id!=='elder-year')return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;const year=String(new FormData(e.target).get('year'));try{engine.year(year);if(clean()&&year===m.month.slice(0,4))return;if(canLeave())m.openMonth(year+m.month.slice(4));else if(clean())e.target.elements.year.value=m.month.slice(0,4);}catch(error){m.error=error.message;redraw();}},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-elder-action]');if(!b||m.saving)return;e.preventDefault();void(async()=>{
  if(b.dataset.elderAction==='kind'){m.kind=b.dataset.kind;m.error='';m.feedback='';redraw();document.querySelector('[data-elder-action=kind][data-kind="'+m.kind+'"]')?.focus();}
  if(b.dataset.elderAction==='month'){if(!canLeave())return;const d=new Date(m.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.direction));m.openMonth(d.toISOString().slice(0,7));}
  if(b.dataset.elderAction==='year'){const year=String(Number(m.month.slice(0,4))+Number(b.dataset.direction));engine.year(year);if(canLeave())m.openMonth(year+m.month.slice(4));}
  if(b.dataset.elderAction==='reload'&&canLeave())await load();
  if(b.dataset.elderAction==='clear'){
   if(!m.catalog.departments.some(d=>d.id===m.department&&d.active&&(d.can_edit??d.can_manage)))return;
   const filled=rows().filter(r=>r.person_id&&IASDPIScheduleEditWindow.period(r,m.settings));if(!filled.length)return;
   const scope=m.kind==='weekly'?'das semanas exibidas em '+m.month.slice(5)+'/'+m.month.slice(0,4):'dos 12 meses de '+m.month.slice(0,4),other=m.kind==='weekly'?'A escala mensal':'A escala semanal';
   if(!confirm('Limpar os nomes '+scope+'? '+other+' será preservada. A limpeza ficará pendente até salvar.'))return;
   for(const row of filled)m.pending.set(engine.key(row),{...row,person_id:null});
   m.error='';m.feedback='Nomes removidos. Salve para confirmar.';redraw();document.querySelector('[data-elder-action=prefill]')?.focus({preventScroll:true});
  }
  if(b.dataset.elderAction==='prefill'){const proposal=engine.propose(rows().filter(r=>IASDPIScheduleEditWindow.period(r,m.settings)),m.catalog,m.department,m.commitments,m.history.filter(r=>r.kind===m.kind));for(const row of proposal.rows)if(row.person_id!==(m.pending.get(engine.key(row))||m.rows.find(r=>engine.key(r)===engine.key(row)))?.person_id)m.pending.set(engine.key(row),row);m.feedback=`Proposta editável: ${proposal.added} períodos sugeridos. Revise antes de salvar.`;redraw();}
  if(b.dataset.elderAction==='save'||b.dataset.elderAction==='publish')await save(b.dataset.elderAction==='publish'?'published':'draft');
 })().catch(error=>{m.error=error.message;redraw();});});
 window.addEventListener('beforeunload',e=>{if(m.pending.size||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.key='';m.rows=[];m.pending.clear();m.catalog=null;m.status='idle';});
 return {page,canLeave};
})();

// G7: configuração administrativa do departamento; sem reconstruir sua escala.
window.IASDPIScheduleDepartmentDays=(()=>{
 const m={key:'',row:null,days:[],dirty:false,saving:false,message:'',error:'',request:crypto.randomUUID()},week=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
 const redraw=()=>{if(state.page==='schedule-build')render();};
 function page(catalog,settings,department,month){
  if(!settings?.department_days_enabled)return '';
  const key=catalog.actor_id+':'+(window.IASDPIChurches?.selected()||'IASD_PI')+':'+department;
  const row={department_id:department,weekdays:settings.department_weekdays?.[department],version:settings.department_days_versions?.[department],can_edit:settings.department_days_can_edit?.[department]===true};
  if(!Array.isArray(row.weekdays)||!Number.isInteger(row.version))return '<p role="alert">Configuração dos dias indisponível. Recarregue a escala.</p>';
  if(key!==m.key){m.key=key;m.row=row;m.days=[...row.weekdays];m.dirty=false;m.message='';m.error='';m.request=crypto.randomUUID();}
  else if(!m.dirty&&!m.saving){m.row=row;m.days=[...row.weekdays];}
  const dept=catalog.departments.find(d=>d.id===department),name=dept?.name||'Departamento';
  const generate=dept?.code!=='ancionato'&&(dept?.can_edit??dept?.can_manage)&&settings.future_months.includes(month+'-01')?`<button type="button" data-b1-action="start" data-days-generate ${m.saving||m.dirty?'disabled':''}>Gerar dias do período</button>`:'';
  return `<details class="panel department-days" ${m.dirty||m.message||m.error?'open':''}><summary>Dias de escala · ${esc(name)}</summary>${IASDPIScheduleUI.help('department-days-help','Altera somente a geração diária e as propostas automáticas futuras. Escalas e atribuições existentes são preservadas. Semanas e meses do Ancionato mantêm seus intervalos completos.','Como os dias afetam a geração')}<form id="department-days-form"><fieldset ${!row.can_edit||m.saving?'disabled':''}><legend>Dias usados na geração</legend><div class="schedule-grid">${week.map((label,i)=>`<label class="checkbox"><input type="checkbox" name="weekday" value="${i}" ${m.days.includes(i)?'checked':''}>${esc(label)}</label>`).join('')}</div>${row.can_edit?`<button type="submit" ${m.saving?'disabled':''}>Salvar dias do departamento</button>`:''}</fieldset>${generate}<p role="status" data-days-status>${esc(m.saving?'Aguardando confirmação…':m.message||(m.dirty?'Alterações pendentes.':''))}</p>${m.error?`<p role="alert">${esc(m.error)}</p>`:''}</form></details>`;
 }
 function canLeave(){if(m.saving){alert('Aguarde a confirmação dos dias de escala.');return false;}if(m.dirty&&!confirm('Descartar somente os dias de escala ainda não salvos?'))return false;m.dirty=false;return true;}
 document.addEventListener('change',e=>{if(e.target.form?.id!=='department-days-form'||m.saving)return;m.days=[...e.target.form.querySelectorAll('[name=weekday]:checked')].map(x=>Number(x.value));m.dirty=true;m.message='';m.error='';m.request=crypto.randomUUID();e.target.form.querySelector('[data-days-status]').textContent='Alterações pendentes.';const generate=e.target.form.querySelector('[data-days-generate]');if(generate)generate.disabled=true;});
 document.addEventListener('submit',e=>{if(e.target.id!=='department-days-form')return;e.preventDefault();e.stopImmediatePropagation();if(m.saving||!m.row?.can_edit)return;const key=m.key,old=m.row,days=[...m.days];m.saving=true;m.error='';redraw();void(async()=>{try{
  const row=await IASDPISchedules.request('iasdpi_schedule_department_days_save',{p_department:old.department_id,p_expected_version:old.version,p_weekdays:days,p_request_id:m.request});
  if(m.key!==key)return;
  if(!row||row.department_id!==old.department_id||row.version!==old.version+1||!Array.isArray(row.weekdays)||JSON.stringify([...row.weekdays].sort())!==JSON.stringify([...days].sort()))throw Error('Confirmação dos dias inválida.');
  m.row=row;m.days=[...row.weekdays];m.dirty=false;m.request=crypto.randomUUID();m.message=window.IASDPISchedulePreview?'Dias salvos nesta demonstração.':'Dias confirmados pelo Supabase.';
  window.dispatchEvent(new CustomEvent('iasdpi-department-days-saved',{detail:row}));
 }catch(err){if(m.key===key)m.error=err.message+' Sua seleção foi preservada.';}finally{m.saving=false;redraw();}})();},true);
 window.addEventListener('beforeunload',e=>{if(m.dirty||m.saving){e.preventDefault();e.returnValue='';}});
 window.addEventListener('iasdpi-identity-ended',()=>{m.key='';m.row=null;m.dirty=false;m.message='';m.error='';});
 return {page,canLeave};
})();
