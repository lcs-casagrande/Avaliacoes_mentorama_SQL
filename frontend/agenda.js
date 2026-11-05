'use strict';
const agendaInitialDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const agendaState={month:agendaInitialDate.slice(0,7),area:'church',department:'all',view:'calendar',showPeople:true,day:agendaInitialDate};
const ministrySchedules={'Comunicação':[
  {date:'2026-10-03',person:'Henrique'},{date:'2026-10-10',person:'Izabelle PI Souza'},
  {date:'2026-10-17',person:'Simone/Profªde Pilates 🧘'},{date:'2026-10-24',person:'macedo Logos'},
  {date:'2026-10-31',person:'Letícia PI'}
], 'Sonoplastia':[
  {date:'2026-10-03',person:'Mini Lucas'},{date:'2026-10-04',person:'Rafa'},
  {date:'2026-10-07',person:'Samuel'},{date:'2026-10-10',person:'Luan'},
  {date:'2026-10-11',person:'Macedo'},{date:'2026-10-14',person:'Paulitos'},
  {date:'2026-10-17',person:'Mini Lucas'},{date:'2026-10-18',person:'Raphael'},
  {date:'2026-10-21',person:'Luan'},{date:'2026-10-24',person:'Mini Lucas'},
  {date:'2026-10-25',person:'Rafa'},{date:'2026-10-28',person:'Luan'},
  {date:'2026-10-31',person:'Raphael'},{date:'2026-11-01',person:'Raphael'},
  {date:'2026-11-04',person:'Paulitos'}
]};
const soundScheduleInfo={title:'Escala de Sonoplastia — Outubro de 2026',instruction:'Em caso de impedimento, avisar antecipadamente no grupo responsável.'};
function agendaWeekday(date){const name=new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));return name[0].toLocaleUpperCase('pt-BR')+name.slice(1);}
function agendaSource(){return window.IASDPIAgendaData || {status:'pending',events:[]};}
const agendaDateAdd=(day,amount)=>new Date(new Date(day+'T12:00:00Z').getTime()+amount*86400000).toISOString().slice(0,10);
function agendaPeriod(e){return e.startDate===e.endDate?programDate(e.startDate):`${programDate(e.startDate)} → ${programDate(e.endDate)}`;}
function agendaOverlaps(e,start,end){return e.startDate<=end && e.endDate>=start;}
function agendaMonthBounds(month){const first=month+'-01',date=new Date(first+'T12:00:00Z');return [first,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).toISOString().slice(0,10)];}
function agendaEvents(){
  const grouped=[];
  for(const e of agendaSource().events.filter(e=>e.kind==='event').sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title))){
    const previous=grouped.findLast(p=>(p.allDay||p.wholeDay)&&(e.allDay||e.wholeDay)&&p.title===e.title&&p.department===e.department&&p.location===e.location&&agendaDateAdd(p.endDate,1)===e.startDate);
    if(previous){previous.end=e.end;previous.endDate=e.endDate;previous.sourceIds.push(e.id);}
    else grouped.push({...e,sourceIds:[e.id]});
  }
  return grouped.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
function agendaIssues(e,events){
  const flags=[];
  if(!(e.allDay||e.wholeDay)&&events.some(other=>other.id!==e.id&&!(other.allDay||other.wholeDay)&&new Date(e.start)<new Date(other.end)&&new Date(e.end)>new Date(other.start)))flags.push('Horários simultâneos · conferir');
  if(events.some(other=>other.id!==e.id&&e.title===other.title&&e.startDate===other.startDate&&e.start!==other.start))flags.push('Mesmo nome em horários diferentes');
  const anniversary=e.title.match(/(\d+)\s*Anos da Escola Sabatina/i);
  if(anniversary&&events.some(other=>{const match=other.title.match(/(\d+)\s*Anos da Escola Sabatina/i);return match&&match[1]!==anniversary[1]&&other.startDate===e.startDate;}))flags.push('Número do aniversário divergente');
  return flags;
}
function agendaEventList(events,allMonth){
  if(!events.length)return empty('Nenhum evento neste período','Escolha outro departamento, dia ou mês.');
  return `<ul class="church-events">${events.map(e=>`<li><div class="church-event-date"><span>${esc(agendaPeriod(e))}</span><strong>${e.allDay||e.wholeDay?'Dia inteiro':esc(displayPlannedTime(e.start)+' → '+displayPlannedTime(e.end))}</strong></div><div class="church-event-body"><h3>${esc(e.title)}</h3><p>${esc(e.department || 'Departamento não informado')}${e.location?' · '+esc(e.location):''}</p>${e.sourceIds.length>1?`<small class="muted">Período agrupado · ${e.sourceIds.length} registros da fonte preservados</small>`:''}<div class="agenda-flags">${agendaIssues(e,allMonth).map(flag=>`<span class="badge warning">${esc(flag)}</span>`).join('')}</div></div></li>`).join('')}</ul>`;
}
function agendaResponsibles(start,end){
  const month=agendaSource().events.filter(e=>e.kind==='monthly'&&agendaOverlaps(e,start,end));
  const weekly=agendaSource().events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start));
  const selected=weekly.filter(e=>agendaOverlaps(e,agendaState.day,agendaState.day));
  const names=e=>agendaState.showPeople?esc(e.person):'Escala definida';
  return `<section class="agenda-responsibles" aria-label="Anciãos responsáveis"><div class="panel"><p class="eyebrow">ANCIÃO DO MÊS</p>${month.length?month.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado no calendário para este mês.</p>'}</div><div class="panel"><p class="eyebrow">ANCIÃO DA SEMANA · DATA SELECIONADA</p>${selected.length?selected.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado para a data selecionada.</p>'}</div></section>
  <details class="panel agenda-weeks" ${agendaState.month!==today().slice(0,7)?'open':''}><summary>Escalas semanais do mês · ${weekly.length}</summary>${weekly.length?`<ul>${weekly.map(e=>`<li><strong>${names(e)}</strong><span>${esc(agendaPeriod(e))}</span></li>`).join('')}</ul>`:'<p class="muted">Nenhuma escala semanal neste período.</p>'}</details>`;
}
// Origem dos dados, sem atribuir uma sincronização oficial às escalas manuais.
function agendaProvenance(area,source=agendaSource()){
  if(area==='communication'||area==='sound'){
    const ministry=area==='communication'?'Comunicação':'Sonoplastia',dates=ministrySchedules[ministry].map(e=>e.date).sort();
    return `<section class="agenda-source form-note" aria-label="Fonte da escala" data-source="manual"><strong>Origem: escala manual de ${esc(ministry)}${area==='sound'?' fornecida pela liderança':''}</strong><p>${area==='sound'?'Fornecida pela liderança.':'Informada à aplicação e mantida no código.'} Não é sincronizada automaticamente com o calendário oficial.</p><p>Última atualização da escala: não informada. Vigência: ${dates.length?esc(displayDate(dates[0])+' a '+displayDate(dates.at(-1))):'não definida; nenhuma escala cadastrada'}.</p>${area==='sound'&&dates.length?`<p>Documento: Outubro de 2026 · ${dates.length} datas. Inclui também 01/11/2026 e 04/11/2026; selecione novembro para consultar essas datas.</p><p class="schedule-instruction">${esc(soundScheduleInfo.instruction)}</p>`:''}</section>`;
  }
  const valid=source.syncedAt&&inspectRecordTime(source.syncedAt).valid,stale=valid&&currentTime()-new Date(source.syncedAt)>86400000;
  return `<section class="agenda-source muted" aria-label="Fonte da agenda" data-source="official"><strong>Origem: calendário oficial da igreja (Google Calendar)</strong><p>${source.status==='synced'&&valid?`Fonte oficial consultada em ${esc(displayRecordTimestamp(source.syncedAt))}.${stale?' A última sincronização tem mais de 24 horas.':''}`:'Aguardando sincronização com o calendário oficial.'} Esta página usa uma cópia publicada; abrir ou atualizar o navegador não consulta novamente o calendário.</p><p>Período importado: ${source.fromMonth&&source.toMonth?esc(source.fromMonth.split('-').reverse().join('/')+' a '+source.toMonth.split('-').reverse().join('/')):'não informado'}. <a href="https://iasd-paradainglesa.netlify.app/" target="_blank" rel="noopener noreferrer">Consultar fonte oficial ↗</a></p></section>`;
}
function agendasPage(){
  if(window.IASDPIConfig?.calendarPrivacyEnabled)return IASDPIScheduleCalendar.page();
  const {month,area,department,view,day,showPeople}=agendaState,[start,end]=agendaMonthBounds(month);
  const source=agendaSource(),allMonth=agendaEvents().filter(e=>agendaOverlaps(e,start,end));
  const events=allMonth.filter(e=>department==='all'||e.department===department);
  const departments=[...new Set(agendaSource().events.filter(e=>e.kind==='event').map(e=>e.department||'Não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const ministry=area==='elders'?'Anciãos':area==='communication'?'Comunicação':'Sonoplastia';
  const scale=area==='elders'?source.events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start)).map(e=>({...e,date:e.startDate<start?start:e.startDate})):area==='church'?[]:ministrySchedules[ministry].filter(e=>e.date.startsWith(month));
  const monthDate=new Date(start+'T12:00:00Z'),monthTitle=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthDate);
  return heading('ORGANIZAÇÃO','Escalas e agendas','Anciãos, programação da igreja e escalas dos ministérios.')+
    '<p><a href="#schedule-calendar">Calendário mensal de escalas</a> · <a href="#schedule-setup">Cadastros de escalas — pessoas, departamentos e funções</a></p>'+
    `${agendaProvenance(area,source)}${!['communication','sound'].includes(area)&&source.fromMonth && (month<source.fromMonth||month>source.toMonth)?'<p class="form-note">Este mês está fora do período importado. Uma nova sincronização é necessária para verificar os registros.</p>':''}
    <section class="panel agenda-filters"><label for="agenda-area">Consultar<select id="agenda-area"><option value="church" ${area==='church'?'selected':''}>Agenda da igreja</option><option value="communication" ${area==='communication'?'selected':''}>Escala de Comunicação</option><option value="elders" ${area==='elders'?'selected':''}>Escala de Anciãos</option><option value="sound" ${area==='sound'?'selected':''}>Escala de Sonoplastia</option></select></label>${area==='church'?`<label for="agenda-department">Departamento<select id="agenda-department"><option value="all">Todos os departamentos</option>${departments.map(name=>`<option value="${esc(name)}" ${name===department?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`:''}<label class="checkbox"><input id="agenda-show-people" type="checkbox" ${showPeople?'checked':''}> Mostrar pessoa escalada</label></section>
    <section class="panel agenda-toolbar"><div class="agenda-month"><button type="button" data-action="agenda-previous" aria-label="Mês anterior">‹</button><h2 id="agenda-month-title">${esc(monthTitle)}</h2><button type="button" data-action="agenda-next" aria-label="Próximo mês">›</button></div><div class="agenda-controls"><label for="agenda-month-picker">Mês e ano<input id="agenda-month-picker" type="month" value="${month}"></label>${button('Mês atual','agenda-current')}<div class="agenda-view" aria-label="Visualização">${button('Calendário','agenda-calendar','','aria-pressed="'+(view==='calendar')+'"')}${button('Lista','agenda-list','','aria-pressed="'+(view==='list')+'"')}</div></div></section>
    ${area==='church'||area==='elders'?agendaResponsibles(start,end):''}
    ${view==='calendar'?`<section class="agenda-calendar" aria-label="Calendário de ${esc(monthTitle)}"><div class="calendar-weekdays" aria-hidden="true">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days">${Array.from({length:monthDate.getUTCDay()},()=>'<span aria-hidden="true"></span>').join('')}${Array.from({length:Number(end.slice(-2))},(_,index)=>{
      const date=month+'-'+String(index+1).padStart(2,'0'),appointments=events.filter(e=>agendaOverlaps(e,date,date)),entry=scale.find(e=>e.startDate?agendaOverlaps(e,date,date):e.date===date);
      const count=area==='church'?appointments.length:entry?1:0;
      return `<button type="button" class="calendar-day ${count?'scheduled':''} ${date===day?'selected-day':''}" data-action="agenda-day" data-id="${date}" aria-pressed="${date===day}" ${date===today()?'aria-current="date"':''} aria-label="${esc(programDate(date))} · ${count} ${area==='church'?'eventos':'escalas'}"><span class="calendar-number">${index+1}</span>${area==='church'?appointments.length?`<span class="calendar-person">${appointments.length} evento${appointments.length>1?'s':''}</span><span class="calendar-event-title">${esc(appointments[0].title)}${appointments[0].startDate!==date?' · continuação':''}</span>`:'':entry?`<span class="calendar-person">${showPeople?esc(entry.person):'Escala definida'}</span>`:''}</button>`;
    }).join('')}</div></section>`:''}
    <section class="section"><div class="section-heading"><h2>${area==='church'?view==='calendar'?'Eventos · '+esc(programDate(day)):'Programação da igreja':area==='sound'?esc(soundScheduleInfo.title):`Escala de ${esc(ministry)}`}</h2><span class="muted">${area==='church'?events.length+' eventos no mês':scale.length+' datas com escala'}</span></div>${area==='church'?agendaEventList(view==='calendar'?events.filter(e=>agendaOverlaps(e,day,day)):events,allMonth):scale.length?`<ul class="agenda-list">${scale.map(e=>`<li><button type="button" ${e.startDate?'':'class="ministry-shift" data-schedule-date="'+e.date+'"'} data-action="agenda-day" data-id="${e.date}">${e.startDate?`<span>${esc(agendaPeriod(e))}</span>`:`<span class="ministry-shift-date"><time datetime="${e.date}">${esc(displayDate(e.date))}</time><small>${esc(agendaWeekday(e.date))}</small></span><span class="ministry-shift-department">${esc(ministry)}</span>`}<strong>${showPeople?esc(e.person):'Escala definida'}</strong></button></li>`).join('')}</ul>`:empty('Nenhuma escala cadastrada neste mês',`Ainda não há nomes informados para ${esc(ministry)} neste período.`)}</section>`;
}
function selectAgendaMonth(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês e ano válidos.');
  agendaState.month=month;agendaState.day=month===today().slice(0,7)?today():month+'-01';render();
}
function changeAgendaMonth(amount){const date=new Date(agendaState.month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+amount);selectAgendaMonth(date.toISOString().slice(0,7));document.querySelector(`[data-action="${amount>0?'agenda-next':'agenda-previous'}"]`).focus();}

// Calendário de consulta: sem escrita ou inferência de atribuições.
window.IASDPIScheduleCalendar=(()=>{
 const zone='America/Sao_Paulo';
 const dayNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date());
 const ui={month:dayNow().slice(0,7),day:dayNow(),departments:null,person:'all'};
 const colors=Object.assign(Object.create(null),{'Sonoplastia':['#e6f0ff','#174c8a'],'Diaconato':['#e5f5eb','#185b35'],'Música':['#f1e8ff','#61368a'],'Ancionato':['#fff3cd','#6c4e00'],'Comunicação':['#fff0df','#8c420b']});
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateText=d=>d.split('-').reverse().join('/');
 const addDays=(d,n)=>new Date(new Date(d+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
 const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 function icon(department){
  const paths={Sonoplastia:'M5 3v18M12 3v18M19 3v18M2 8h6M9 15h6M16 7h6',Música:'M9 18V5l11-2v13M9 5l11-2M9 18c0 2-6 3-6 0s6-3 6 0M20 16c0 2-6 3-6 0s6-3 6 0',Diaconato:'M2 13l5-5 5 3 5-3 5 5-6 7H8zM7 8l5-4 5 4M8 14l4 3 4-3',Ancionato:'M12 5c-3-2-7-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1v15',Comunicação:'M3 10h5l12-6v16L8 14H3zM8 14l2 7h4l-3-8M20 9h2v6h-2'};
  return `<svg class="scale-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${(Object.hasOwn(paths,department)?paths[department]:null)||'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 12h8M12 8v8'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 }
 function legacy(){
  if(window.IASDPIConfig?.calendarPrivacyEnabled)return [];
  if(window.IASDPIPortalAccess?.enabled()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI')return [];
  const rows=window.IASDPICalendarSource?window.IASDPICalendarSource():Object.entries(ministrySchedules).flatMap(([department,entries])=>entries.map(r=>({id:'legacy:'+department+':'+r.date+':'+r.person,date:r.date,department,person:r.person,role:null,origin:'Escala manual informada'})));
  return rows.map(r=>window.IASDPIRegistry?.historical({...r})||{...r});
 }
 function officialSource(){if(window.IASDPIPortalAccess?.enabled()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI')return {events:[]};return window.IASDPICalendarOfficialSource?window.IASDPICalendarOfficialSource():window.IASDPIAgendaData||{events:[]};}
 function periods(){
  const seen=new Set();
  const valid=e=>['monthly','weekly'].includes(e.kind)&&validDay(e.startDate)&&validDay(e.endDate)&&e.endDate>=e.startDate;
  const feed=window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedRows(ui.month):[];
  const managed=[...(window.IASDPICalendarManagedPeriodsSource?.()||[]),...feed.filter(e=>e.kind)].filter(valid),key=e=>e.kind+':'+e.startDate+':'+e.endDate,managedKeys=new Set(managed.map(key));
  const official=(officialSource().events||[]).filter(valid).filter(e=>!managedKeys.has(key(e)));
  return [...official.map(e=>({...e,calendarId:'official:'+(e.id||[e.kind,e.startDate,e.endDate,e.person||''].join(':')),calendarOrigin:'Agenda oficial · cópia publicada'})),...managed.map(e=>({...e,calendarId:'managed:'+e.id,calendarOrigin:e.origin||'Escala publicada no sistema'}))].map(e=>({id:e.calendarId,date:e.startDate,startDate:e.startDate,endDate:e.endDate,kind:e.kind,department:'Ancionato',person:e.person||null,role:e.kind==='monthly'?'Ancião do Mês':'Ancião da Semana',origin:e.calendarOrigin})).filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});
 }
 function data(){return [...legacy(),...periods().map(r=>window.IASDPIRegistry?.historical(r)||r),...(window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedRows(ui.month).filter(e=>!e.kind).map(r=>window.IASDPIRegistry?.historical(r)||r):[])];}
 const departments=()=>[...new Set([...Object.keys(colors),...data().map(r=>r.department)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const active=d=>ui.departments===null||ui.departments.has(d);
 const unified=()=>window.IASDPIEvents?.enabled()===true;
 const refine={mode:'all',departments:new Set(),people:new Set(),categories:new Set(),panel:false,open:null,search:''};
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const chosen=(set,value)=>!set.size||set.has(value);
 const eventDepartment=e=>e.department_name||e.department||'';
 const eventCategory=e=>e.program_category||'pending';
 const categoryOptions=[['general','Programação Geral'],['departmental','Programação Departamental'],['reserved','Atividade Reservada'],['pending','Pendente de revisão']];
 function matchesEvent(e){return refine.mode!=='scales'&&chosen(refine.departments,eventDepartment(e))&&(refine.mode!=='events'||chosen(refine.categories,eventCategory(e)));}
 const matches=r=>unified()?refine.mode!=='events'&&chosen(refine.departments,r.department)&&(refine.mode!=='scales'||chosen(refine.people,r.person||'__unassigned__')):active(r.department)&&(ui.person==='all'||(r.person||'__unassigned__')===ui.person);
 function filterOptions(){
  const events=window.IASDPIEvents?.allRows(ui.month)||[],rows=data();
  return {departments:[...new Set([...departments(),...events.map(eventDepartment),...refine.departments].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>[v,v]),
   people:[...new Set([...rows.map(r=>r.person||(r.role?'__unassigned__':null)),...refine.people].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>[v,v==='__unassigned__'?'A definir':v]),
   categories:categoryOptions};
 }
 function refinements(){return [['departments','Departamento'],...(refine.mode==='scales'?[['people','Pessoa']]:[]),...(refine.mode==='events'?[['categories','Categoria do evento']]:[])];}
 function filterCount(){return refinements().reduce((sum,[key])=>sum+refine[key].size,0);}
 function clearRefinements(){for(const key of ['departments','people','categories'])refine[key].clear();refine.search='';refine.open=null;}
 function multiselect(key,label,options){
  const selected=refine[key];return `<details class="calendar-multiselect" data-refine-list="${key}" ${refine.open===key?'open':''}><summary id="calendar-${key}-summary"><span>${label}</span><span class="calendar-filter-count">${selected.size?selected.size+' selecionado'+(selected.size===1?'':'s'):'Todos'}</span><span aria-hidden="true">⌄</span></summary><div class="calendar-options-panel" role="group" aria-label="${label}">${key==='people'?`<label class="calendar-person-search">Pesquisar pessoas<input type="search" id="calendar-person-search" autocomplete="off" value="${escape(refine.search)}" placeholder="Digite parte do nome"></label><p class="calendar-option-note">Nomes presentes nas escalas autorizadas.</p>`:''}<div class="calendar-options">${options.map(([value,name],i)=>`<label class="calendar-check-option" ${key==='people'&&!normalize(name).includes(normalize(refine.search))?'hidden':''} data-search-name="${escape(normalize(name))}"><input type="checkbox" id="calendar-${key}-${i}" data-calendar-filter="${key}" value="${escape(value)}" ${selected.has(value)?'checked':''}><span>${escape(name)}</span></label>`).join('')}</div>${key==='people'?`<p class="calendar-search-empty" role="status" ${options.some(([,name])=>normalize(name).includes(normalize(refine.search)))?'hidden':''}>Nenhuma pessoa corresponde à pesquisa.</p>`:''}</div></details>`;
 }
 function quickDepartments(){
  if(refine.mode!=='scales')return '';
  const guest=window.IASDPIConfig?.calendarPrivacyEnabled&&!IASDPIAuth.identityKey(),quick=guest?['Ancionato']:departments();
  return `<div class="calendar-quick-departments" role="group" aria-label="Filtros rápidos de departamentos">${guest?'':`<button type="button" class="calendar-quick-all" data-calendar-quick-all aria-pressed="${refine.departments.size===0}">Todos</button>`}${quick.map(d=>`<button type="button" class="scale-tag calendar-quick-filter" data-calendar-quick-department="${escape(d)}" data-scale-color="${escape(d)}" aria-pressed="${refine.departments.has(d)}">${icon(d)}<span>${escape(d)}</span>${refine.departments.has(d)?'<span aria-hidden="true">✓</span>':''}</button>`).join('')}${guest?'<a class="calendar-login-reminder" href="#portal-login" data-page="portal-login">Logar para demais escalas</a>':''}</div>`;
 }
 function refinementControls(){
  const options=filterOptions(),count=filterCount(),classified=window.IASDPIEvents.allRows(ui.month).some(e=>e.program_category);
  const chips=refinements().flatMap(([key,label])=>[...refine[key]].map(value=>{const name=options[key].find(([v])=>v===value)?.[1]||value;return `<button type="button" class="calendar-filter-chip" data-calendar-remove="${key}" data-value="${escape(value)}" aria-label="Remover ${escape(label.toLowerCase()+': '+name)}" title="${escape(label+': '+name)}"><span>${escape(name)}</span><span aria-hidden="true">×</span></button>`;})).join('');
  return `<div class="calendar-filter-toolbar"><div class="calendar-modes" role="group" aria-label="Mostrar no calendário">${[['all','Tudo'],['scales','Escalas'],['events','Eventos']].map(([mode,label])=>`<button type="button" id="calendar-mode-${mode}" data-calendar-mode="${mode}" aria-pressed="${refine.mode===mode}">${label}</button>`).join('')}</div><button type="button" id="calendar-filters-toggle" aria-expanded="${refine.panel}" aria-controls="calendar-refine-panel" data-calendar-toggle><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M10 15v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Filtros${count?' ('+count+')':''}</button></div>
   ${quickDepartments()}
   <section class="calendar-refine-panel" id="calendar-refine-panel" aria-labelledby="calendar-refine-title" ${refine.panel?'':'hidden'}><h3 id="calendar-refine-title">Refinar calendário</h3><div class="calendar-filter-fields">${refinements().map(([key,label])=>multiselect(key,label,options[key])).join('')}</div><p class="calendar-filter-hint">Sem seleção, todas as opções são consideradas.${refine.departments.size?' As atividades estão restritas aos departamentos selecionados.':''}</p>${refine.mode==='events'&&!classified?'<p class="calendar-option-note">Classificação pendente de revisão. Os dados anteriores permanecem preservados.</p>':''}<div class="calendar-filter-actions"><button type="button" data-calendar-clear>Limpar filtros</button><button type="button" data-events-feed-retry="${escape(ui.month)}">Atualizar calendário</button><button type="button" class="primary" data-calendar-done>Concluir</button></div></section>
   ${chips?`<div class="calendar-active-filters" role="group" aria-label="Filtros ativos">${chips}</div>`:''}`;
 }
 document.addEventListener('toggle',e=>{const el=e.target;if(!unified()||!el.isConnected||!el.matches('details[data-refine-list]'))return;if(el.open){refine.open=el.dataset.refineList;document.querySelectorAll('details[data-refine-list][open]').forEach(other=>{if(other!==el)other.open=false;});}else if(refine.open===el.dataset.refineList)refine.open=null;},true);
 document.addEventListener('input',e=>{if(e.target.id!=='calendar-person-search'||!unified())return;refine.search=e.target.value;const dropdown=e.target.closest('details');let visible=0;dropdown.querySelectorAll('[data-search-name]').forEach(row=>{row.hidden=!row.dataset.searchName.includes(normalize(refine.search));if(!row.hidden)visible++;});dropdown.querySelector('.calendar-search-empty').hidden=visible>0;});
 document.addEventListener('change',e=>{const el=e.target;if(!unified()||!el.matches('[data-calendar-filter]'))return;const set=refine[el.dataset.calendarFilter];if(!set)return;if(el.checked)set.add(el.value);else set.delete(el.value);refine.open=el.closest('details').dataset.refineList;redraw(el.id);});
 document.addEventListener('click',e=>{const el=e.target.closest('[data-calendar-quick-all],[data-calendar-quick-department],[data-calendar-mode],[data-calendar-toggle],[data-calendar-done],[data-calendar-clear],[data-calendar-remove]');if(!unified()||!el)return;e.preventDefault();
  if(el.hasAttribute('data-calendar-quick-all')){refine.departments.clear();redraw();document.querySelector('[data-calendar-quick-all]')?.focus({preventScroll:true});return;}
  if(el.dataset.calendarQuickDepartment){const department=el.dataset.calendarQuickDepartment;if(refine.departments.has(department))refine.departments.delete(department);else refine.departments.add(department);redraw();[...document.querySelectorAll('[data-calendar-quick-department]')].find(button=>button.dataset.calendarQuickDepartment===department)?.focus({preventScroll:true});return;}
  if(el.dataset.calendarMode){refine.mode=el.dataset.calendarMode;if(refine.mode!=='scales'){refine.people.clear();refine.search='';}if(refine.mode!=='events')refine.categories.clear();refine.open=null;redraw('calendar-mode-'+refine.mode);return;}
  if(el.hasAttribute('data-calendar-toggle')){refine.panel=!refine.panel;if(!refine.panel)refine.open=null;redraw('calendar-filters-toggle');return;}
  if(el.hasAttribute('data-calendar-done')){refine.panel=false;refine.open=null;redraw('calendar-filters-toggle');return;}
  if(el.hasAttribute('data-calendar-clear')){clearRefinements();redraw('calendar-filters-toggle');return;}
  if(el.dataset.calendarRemove){refine[el.dataset.calendarRemove]?.delete(el.dataset.value);redraw('calendar-filters-toggle');}
 });
 document.addEventListener('keydown',e=>{if(!unified()||e.key!=='Escape')return;const dropdown=e.target.closest('details[data-refine-list]');if(dropdown?.open){dropdown.open=false;refine.open=null;dropdown.querySelector('summary').focus();e.preventDefault();e.stopPropagation();}else if(e.target.closest('#calendar-refine-panel')){refine.panel=false;refine.open=null;redraw('calendar-filters-toggle');e.preventDefault();}});
 document.addEventListener('click',e=>{if(!unified()||!refine.open||e.target.closest('details[data-refine-list]'))return;document.querySelectorAll('details[data-refine-list][open]').forEach(el=>el.open=false);refine.open=null;});
 window.addEventListener('iasdpi-church-changed',()=>{clearRefinements();refine.mode='all';refine.panel=false;});
 const overlaps=(r,start,end)=>r.startDate?r.startDate<=end&&r.endDate>=start:r.date>=start&&r.date<=end;
 const compareNames=(a,b)=>window.IASDPIScheduleRules?.compareNames(a,b)??String(a||'').localeCompare(String(b||''),'pt-BR',{sensitivity:'base'});
 const sort=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||compareNames(a.person||'\uffff',b.person||'\uffff')||compareNames(a.department,b.department)||String(a.id||'').localeCompare(String(b.id||'')));
 function monthDays(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês válido.');return new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).getUTCDate();}
 function changeMonth(value){monthDays(value);ui.month=value;ui.day=value===dayNow().slice(0,7)?dayNow():value+'-01';}
 function shift(n){const d=new Date(ui.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);changeMonth(d.toISOString().slice(0,7));}
 const personText=r=>r.person||(r.role?'A definir'+(r.vacancy_count>1?' ('+r.vacancy_count+' vagas)':''):'Responsável não informado');
 const label=r=>`${r.department} — ${personText(r)} · ${r.role||'Função não informada'}`;
 function tag(r,compact=false){if(r.isEvent)return IASDPIEvents.chip(r);return `<span class="scale-tag ${compact?'scale-chip':''}" data-scale-color="${escape(r.department)}" title="${escape(label(r))}">${icon(r.department)}<span class="scale-person-name">${escape(compact?personText(r):r.department+' — '+personText(r))}</span>${compact?`<span class="sr-only">${escape(r.department+' · '+(r.role||'Função não informada'))}</span>`:''}</span>`;}
 let detailHelpId=0;
 function list(rows,emptyText){return rows.length?`<ul class="scale-details">${rows.map(r=>r.isEvent?`<li>${IASDPIEvents.details(r)}</li>`:`<li>${tag(r)}<small>${r.startDate?dateText(r.startDate)+' a '+dateText(r.endDate):dateText(r.date)}${window.IASDPIScheduleUI?.isReview()?(r.role?' · '+escape(r.role):''):' · '+escape(r.role||'Função não informada')+' · '+escape(r.origin)}</small>${window.IASDPIScheduleUI?.isReview()?IASDPIScheduleUI.help('calendar-details-'+(++detailHelpId),'Origem: '+String(r.origin||'Não informada').replace(/SIMULAÇÃO LOCAL · não publicada no site oficial|Escala publicada nesta demonstração · memória da aba/,'Publicação nesta aba')+'.','Detalhes de '+label(r)):''}</li>`).join('')}</ul>`:`<p class="muted">${escape(emptyText)}</p>`;}

 // Cada intervalo é recortado por semana. Faixas sobrepostas recebem linhas próprias.
 function segments(rows,weekStart,monthStart,monthEnd){
  const start=weekStart<monthStart?monthStart:weekStart,end=addDays(weekStart,6)>monthEnd?monthEnd:addDays(weekStart,6);
  return rows.filter(r=>r.startDate&&overlaps(r,start,end)).map(r=>{const from=r.startDate>start?r.startDate:start,to=r.endDate<end?r.endDate:end;return {record:r,from,to,column:Math.round((new Date(from+'T12:00:00Z')-new Date(weekStart+'T12:00:00Z'))/86400000),span:Math.round((new Date(to+'T12:00:00Z')-new Date(from+'T12:00:00Z'))/86400000)+1};}).sort((a,b)=>a.record.kind.localeCompare(b.record.kind)||a.column-b.column||a.record.id.localeCompare(b.record.id));
 }
 function bandRows(rows,weekStart,monthStart,monthEnd){
  const parts=segments(rows,weekStart,monthStart,monthEnd),output=[];
  for(const kind of ['weekly']){
   const lanes=[];
   for(const part of parts.filter(p=>p.record.kind===kind)){let lane=lanes.find(l=>l.at(-1).column+l.at(-1).span<=part.column);if(!lane){lane=[];lanes.push(lane);}lane.push(part);}
   for(const lane of lanes){let cursor=0,cells='';for(const part of lane){const r=part.record;if(part.column>cursor)cells+=`<td colspan="${part.column-cursor}" class="scale-band-gap"></td>`;
    cells+=`<td colspan="${part.span}" class="scale-band-cell"><button type="button" class="scale-band scale-${kind}" data-scale-action="period" data-start-date="${part.from}" data-scale-id="${escape(r.id)}" data-scale-kind="${kind}" data-scale-color="Ancionato" data-from="${part.from}" data-to="${part.to}" aria-label="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}" title="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}">${icon('Ancionato')}<span class="scale-band-label">${kind==='monthly'?'Mês':'Semana'}:</span><span class="scale-person-name">${escape(personText(r))}</span></button></td>`;cursor=part.column+part.span;}
    if(cursor<7)cells+=`<td colspan="${7-cursor}" class="scale-band-gap"></td>`;
    output.push(`<tr class="scale-band-row" data-band-kind="${kind}">${cells}</tr>`);
   }
  }
  return output.join('');
 }
 function page(){
  const publicStatus=window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedStatus(ui.month):'';
  const rows=data(),filtered=sort(rows.filter(matches)),monthStart=ui.month+'-01',days=monthDays(ui.month),monthEnd=ui.month+'-'+days;
  const eventsEnabled=window.IASDPIEvents?.enabled(),eventRows=eventsEnabled?IASDPIEvents.rows(ui.month):[];
  const monthly=filtered.filter(r=>overlaps(r,monthStart,monthEnd)),selected=[...filtered.filter(r=>overlaps(r,ui.day,ui.day)),...eventRows.filter(e=>IASDPIEvents.onDay(e,ui.day))];
  const people=[...new Set(rows.map(r=>r.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const title=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(monthStart+'T12:00:00Z'));
  const offset=new Date(monthStart+'T12:00:00Z').getUTCDay(),first=addDays(monthStart,-offset),weekCount=Math.ceil((offset+days)/7);
  const weeks=Array.from({length:weekCount},(_,week)=>{
   const weekStart=addDays(first,week*7);
   const bands=bandRows(monthly,weekStart,monthStart,monthEnd);
   const numbers=bands?`<tr class="scale-number-row">${Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);return day.startsWith(ui.month)?`<td><span class="scale-day-number ${day===dayNow()?'scale-today-number':''}" aria-hidden="true">${Number(day.slice(-2))}</span></td>`:'<td class="scale-outside" aria-hidden="true"></td>';}).join('')}</tr>`:'';
   const cells=Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);if(!day.startsWith(ui.month))return '<td class="scale-outside" aria-hidden="true"></td>';
    const dayEvents=eventRows.filter(e=>IASDPIEvents.onDay(e,day)),items=[...monthly.filter(r=>!r.startDate&&r.date===day),...dayEvents],all=[...monthly.filter(r=>overlaps(r,day,day)),...dayEvents];
    return `<td data-scale-day="${day}"><button type="button" class="scale-day" data-scale-action="day" data-date="${day}" aria-label="${escape(dateText(day)+' · '+all.length+' entradas'+(all.length?': '+all.map(r=>r.isEvent?r.title+' · '+IASDPIEvents.categoryText(r):label(r)).join('; '):''))}" aria-pressed="${day===ui.day}" ${day===dayNow()?'aria-current="date"':''}>${bands?'':`<span class="scale-day-number">${Number(day.slice(-2))}</span>`}${items.map(r=>tag(r,true)).join('')}</button></td>`;
   }).join('');
   return `<tbody class="scale-week-group ${bands?'scale-week-with-periods':''}">${numbers}${bands}<tr class="scale-days-row" data-week-start="${weekStart}">${cells}</tr></tbody>`;
  }).join('');
  const missing=monthly.filter(r=>!r.person&&r.role),pointCount=monthly.filter(r=>!r.startDate).length,source=officialSource();
  return `<div class="scale-heading"><div><p class="eyebrow">GESTÃO DE ESCALAS · CONSULTA</p><h1>${eventsEnabled?'Calendário IASDPI':'Calendário de escalas'}</h1></div>${eventsEnabled?'<a class="button" href="#events" data-page="events">Gestão de Eventos</a>':''}<div><a href="#schedule-setup" data-calendar-nav>Cadastros de pessoas e funções</a>${window.IASDPIScheduleManagement?'<a href="#schedule-build" class="button primary" data-calendar-nav>Criar escala</a>':'<button type="button" class="primary" disabled aria-describedby="scale-create-note">Criar escala</button>'}</div></div>
   ${window.IASDPIScheduleUI?.isReview()?'':`<p id="scale-create-note" class="muted">${window.IASDPIScheduleManagement?'Montagem manual disponível para administradores e gestores ministeriais autorizados.':'Criação de escalas em preparação. Nesta etapa não há gravação da Fase B.'}</p>`}
   ${window.IASDPIScheduleUI?.isReview()?'':`<details class="scale-provenance"><summary>Origem das escalas</summary><p>Sonoplastia: 15 registros manuais de outubro/início de novembro de 2026. Comunicação: cinco registros manuais de outubro. Grafias preservadas; sem sincronização automática dessas listas.</p><p>Anciãos: cópia da Agenda oficial${source.syncedAt?' atualizada em '+escape(dateText(source.syncedAt.slice(0,10))):'; atualização não informada'}. Datas finais inclusivas conforme a fonte. Nenhum ancião é inferido nos períodos sem escala.</p><p>Horários não informados; esta consulta não valida conflitos de horário.</p></details>`}
   ${eventsEnabled?IASDPIEvents.controls(ui.month):''}${publicStatus}${!window.IASDPIScheduleUI?.isReview()&&window.IASDPICalendarManagedPeriodsSource?'<p class="muted">Somente publicações confirmadas aparecem aqui. Uma nova revisão em rascunho mantém a última publicação no calendário. Nesta demonstração, as alterações ficam apenas na aba.</p>':''}<section class="panel scale-month-panel"><div class="scale-month-actions"><button type="button" data-scale-action="previous" aria-label="Mês anterior">‹</button><h2 id="scale-month-title">${escape(title)}</h2><button type="button" data-scale-action="next" aria-label="Próximo mês">›</button>${window.IASDPIScheduleUI?.isReview()?IASDPIScheduleUI.monthPicker('scale-month',ui.month):`<label>Mês<input type="month" id="scale-month" value="${ui.month}"></label>`}<button type="button" data-scale-action="today">Hoje</button></div>
   ${eventsEnabled?refinementControls():''}
   ${!eventsEnabled?`<div class="scale-filter-bar" role="group" aria-label="Filtrar departamentos"><button type="button" class="scale-all-filter" data-scale-action="all" aria-pressed="${departments().every(active)}">Todos</button>${departments().map(d=>`<button type="button" class="scale-filter scale-tag" data-scale-action="department" data-department="${escape(d)}" data-scale-color="${escape(d)}" aria-pressed="${active(d)}">${icon(d)}<span>${escape(d)}</span><span class="scale-filter-state" aria-hidden="true">${active(d)?'✓':'—'}</span></button>`).join('')}</div>`:''}
   ${monthly.some(r=>r.kind==='monthly')?`<div class="scale-month-responsibles" role="group" aria-label="Responsáveis do mês">${monthly.filter(r=>r.kind==='monthly').map(r=>`<button type="button" class="scale-monthly" data-scale-action="period" data-start-date="${r.startDate>monthStart?r.startDate:monthStart}" data-scale-id="${escape(r.id)}" data-scale-kind="monthly" data-scale-color="${escape(r.department)}" data-from="${r.startDate>monthStart?r.startDate:monthStart}" data-to="${r.endDate<monthEnd?r.endDate:monthEnd}" aria-label="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}" title="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}">${icon(r.department)}<span class="scale-month-role">${escape(r.role)}:</span><span class="scale-person-name">${escape(personText(r))}</span></button>`).join('')}</div>`:''}
   <table class="scale-calendar"><caption class="sr-only">${escape(title)} — semanas de domingo a sábado, com faixas de anciãos da semana</caption><thead><tr>${['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'].map(d=>`<th scope="col"><abbr title="${d}">${d.slice(0,3)}</abbr></th>`).join('')}</tr></thead>${weeks}</table>
   ${!eventsEnabled?`<div class="scale-filters scale-person-filters"><label>Pessoa<select id="scale-person"><option value="all">Todas</option>${people.map(p=>`<option value="${escape(p)}" ${ui.person===p?'selected':''}>${escape(p)}</option>`).join('')}${rows.some(r=>!r.person&&r.role)?`<option value="__unassigned__" ${ui.person==='__unassigned__'?'selected':''}>A definir</option>`:''}</select></label><div class="scale-help-control"><button type="button" class="scale-help-button" aria-label="Ajuda sobre os filtros" aria-controls="scale-help-tip" aria-describedby="scale-help-tip" aria-expanded="false">?</button><span id="scale-help-tip" role="tooltip" hidden>Toque nos departamentos para mostrar ou ocultar. Selecione um dia ou faixa para ver os detalhes completos.${window.IASDPIScheduleUI?.isReview()?' Sonoplastia e Comunicação usam escalas manuais; Ancionato também mantém referências da Agenda. Só as escalas publicadas nesta aba aparecem no calendário; rascunhos não aparecem.':''}</span></div></div>`:''}
   <p class="scale-result" role="status" aria-live="polite">${pointCount} escalas pontuais e ${monthly.length-pointCount} períodos de anciãos${eventsEnabled?' · '+eventRows.filter(e=>e.date<=monthEnd&&e.end_date>=monthStart).length+' eventos':''} neste mês com os filtros aplicados.</p></section>
   <section class="panel" id="scale-selected" tabindex="-1" aria-labelledby="scale-selected-title"><h2 id="scale-selected-title">${eventsEnabled?'Agenda de':'Escalas de'} ${dateText(ui.day)}</h2>${list(selected,eventsEnabled?'Nenhuma escala ou evento corresponde aos filtros nesta data.':'Nenhuma escala corresponde aos filtros nesta data.')}</section>
   <div class="scale-overview"><section class="panel"><h2>Próximas escalas</h2><p class="muted">A partir de ${dateText(dayNow())}${window.IASDPIScheduleUI?.isReview()?'':', com os filtros aplicados; inclui períodos em andamento.'}</p>${list(filtered.filter(r=>(r.endDate||r.date)>=dayNow()).slice(0,6),'Não há próximas escalas informadas com estes filtros.')}</section>
   <section class="panel"><h2>Departamentos</h2><p>${escape(departments().filter(active).join(' · ')||'Nenhum selecionado')}</p><h2>Pessoas escaladas</h2><p>${escape([...new Set(monthly.map(r=>r.person).filter(Boolean))].sort(compareNames).join(' · ')||'Nenhuma na escala informada neste filtro')}</p><h2>Funções ainda sem responsável</h2>${list(missing,'Nenhuma função sem responsável foi informada nesta seleção.')}${window.IASDPIScheduleUI?.isReview()?'':'<p class="muted">Funções ausentes da fonte não são inferidas.</p>'}</section></div>`;
 }
 function mount(){
  window.IASDPIScheduleUI?.mount();
  const extras=departments().filter(d=>!Object.hasOwn(colors,d));
  document.querySelectorAll('[data-scale-color]').forEach(el=>{const d=el.dataset.scaleColor,[bg,fg]=colors[d]||[`hsl(${(extras.indexOf(d)*137.508+24)%360} 65% 91%)`,'#24313b'];el.style.backgroundColor=el.matches('.scale-filter[aria-pressed="false"],.calendar-quick-filter[aria-pressed="false"]')?'#fff':el.dataset.scaleKind==='weekly'?'#f2e1aa':bg;el.style.color=fg;el.style.borderColor=fg;});
  document.querySelectorAll('.scale-help-control').forEach(help=>{
   const button=help.querySelector('button'),tip=help.querySelector('[role=tooltip]');let pinned=false;
   const show=open=>{tip.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open&&help.classList.contains('schedule-help-control')){const rect=button.getBoundingClientRect(),width=Math.min(320,innerWidth-32),height=tip.getBoundingClientRect().height;tip.style.left=Math.max(16,Math.min(rect.left,innerWidth-width-16))+'px';tip.style.top=Math.max(8,rect.bottom+height+12<innerHeight?rect.bottom+6:rect.top-height-6)+'px';}};
   help.onmouseenter=()=>show(true);
   help.onmouseleave=()=>{if(!pinned&&!button.matches(':focus-visible'))show(false);};
   button.onfocus=()=>{if(button.matches(':focus-visible'))show(true);};
   button.onblur=()=>{pinned=false;show(false);};
   button.onclick=()=>{pinned=!pinned;show(pinned);};
   button.onkeydown=e=>{if(e.key==='Escape'){pinned=false;show(false);e.preventDefault();e.stopPropagation();}};
  });
 }
 function redraw(focus){if(state.page!=='schedule-calendar'&&!(window.IASDPIConfig?.calendarPrivacyEnabled&&state.page==='agendas'))return;render();mount();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-scale-action]');if(!b)return;e.preventDefault();
  try{const a=b.dataset.scaleAction;
   if(a==='previous')shift(-1);if(a==='next')shift(1);if(a==='today'){changeMonth(dayNow().slice(0,7));ui.day=dayNow();}
   if(a==='day'||a==='period')ui.day=a==='period'?b.dataset.startDate:b.dataset.date;
   if(a==='all')ui.departments=departments().every(active)?new Set():null;
   if(a==='department'){if(ui.departments===null)ui.departments=new Set(departments());const d=b.dataset.department;if(ui.departments.has(d))ui.departments.delete(d);else ui.departments.add(d);}
   redraw(a==='day'||a==='period'?'scale-selected':null);
   if(a==='day'||a==='period')document.getElementById('scale-selected')?.scrollIntoView({block:'nearest'});
   else [...document.querySelectorAll('[data-scale-action]')].find(el=>el.dataset.scaleAction===a&&(a!=='department'||el.dataset.department===b.dataset.department))?.focus({preventScroll:true});
  }catch(error){toast(error.message,true);}
 });
 document.addEventListener('change',e=>{if(!['scale-month','scale-person'].includes(e.target.id))return;try{if(e.target.id==='scale-month')changeMonth(e.target.value);else ui.person=e.target.value;redraw(e.target.id);}catch(error){toast(error.message,true);}});
 function show({month,department}){changeMonth(month);ui.departments=department?new Set([department]):null;ui.person='all';if(unified()){clearRefinements();refine.departments=department?new Set([department]):new Set();}}
 return {page,mount,legacy,data,periods,segments,monthDays,dayNow,show,matchesEvent};
})();

// E2: planejamento puro, sem persistência ou autorização implícita.
window.IASDPIEventPlanning=(()=>{
 const day=d=>d.toISOString().slice(0,10),date=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')||isNaN(new Date(s+'T12:00:00Z'))||day(new Date(s+'T12:00:00Z'))!==s)throw Error('Informe uma data válida.');return new Date(s+'T12:00:00Z');};
 function yearEnd(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(now)+'-12-31';}
 function occurrences(e,until=yearEnd()){
  const start=date(e.date),last=date(until),end=date(e.end_date||e.date),span=Math.round((end-start)/86400000),frequency=e.recurrence||'none',weekday=e.recurrence_weekday==null?start.getUTCDay():Number(e.recurrence_weekday),ordinal=Number(e.recurrence_ordinal||1),out=[];
  if(span<0||span>366||!['none','weekly','monthly'].includes(frequency))throw Error('Revise as datas e a recorrência.');
  if(frequency==='none')return [{...e,end_date:e.end_date||e.date}];
  if(start>last||end>last)throw Error('A data inicial/final ultrapassa o limite da recorrência: '+until.split('-').reverse().join('/')+'.');
  if(!Number.isInteger(weekday)||weekday<0||weekday>6||![-1,1,2,3,4].includes(ordinal)||last-start>7000*86400000)throw Error('Revise o dia e a posição da recorrência.');
  for(let d=new Date(start);d.getTime()+span*86400000<=last;d.setUTCDate(d.getUTCDate()+1)){
   const monthEnd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(),nth=Math.floor((d.getUTCDate()-1)/7)+1;
   if(d.getUTCDay()===weekday&&(frequency==='weekly'||ordinal===-1&&d.getUTCDate()+7>monthEnd||ordinal===nth))out.push({...e,date:day(d),end_date:day(new Date(d.getTime()+span*86400000))});
  }
  if(!out.length||out.length>1000)throw Error('Nenhuma ocorrência válida ou série muito extensa. Revise as datas.');return out;
 }
 function interval(e){const a=e.all_day?recordEpoch('00:00',e.date):recordEpoch(e.start_time,e.date),end=e.end_date||e.date,b=e.all_day?recordEpoch('00:00',day(new Date(date(end).getTime()+86400000))):recordEpoch(e.end_time,end);if(a===null||b===null)return null;if(b<=a)throw Error('O término deve ocorrer após o início.');return [a,b];}
 function conflicts(e,others,spaces){
  const r=interval(e);if(!r)return [];const exclusive=new Set(spaces.filter(s=>s.exclusive).map(s=>s.code));
  return others.flatMap(other=>{
   const common=(e.spaces||[]).filter(code=>exclusive.has(code)&&(other.spaces||[]).includes(code));
   if(!common.length||other.id===e.id||other.date>(e.end_date||e.date)||(other.end_date||other.date)<e.date)return [];
   let b=null,timePending=false;try{b=interval(other);}catch(_){}if(!b){timePending=true;b=interval({...other,all_day:true});}
   return b&&r[0]<b[1]&&b[0]<r[1]?common.map(code=>({space_code:code,space_name:spaces.find(s=>s.code===code).name,date:e.date,event_title:other.title,time_pending:timePending,occupied:timePending?'Horário pendente de revisão':other.all_day?'Dia inteiro':other.start_time+' → '+other.end_time})):[];
  });
 }

 return {occurrences,yearEnd,interval,conflicts};
})();

// E1: publicação editorial separada dos eventos técnicos usados nas escalas.
window.IASDPIEvents=(()=>{
 const enabled=()=>window.IASDPIConfig?.eventsEnabled===true,h=v=>esc(v),feeds=new Map();
 const s={phase:'idle',catalog:null,error:'',message:'',row:null,values:null,dirty:new Set(),request:crypto.randomUUID(),saving:false,history:null,sourceOpen:false,owner:'',generation:0};
 const sourceWarning=e=>/\d+\s*Anos da Escola Sabatina/i.test(e.title)&&sources().some(other=>other.date===e.date&&/\d+\s*Anos da Escola Sabatina/i.test(other.title)&&other.title!==e.title)?'Divergência na fonte: confirme o número do aniversário.':'';
 const church=()=>IASDPIChurches?.selected()||'IASD_PI',key=m=>church()+':'+m+(window.IASDPIConfig?.calendarPrivacyEnabled?':'+(IASDPIAuth.identityKey()||'public'):'');
 const redraw=()=>{if(enabled()&&['events','schedule-calendar',...(window.IASDPIConfig?.calendarPrivacyEnabled?['agendas']:[])].includes(state.page))render();};
 async function rpc(name,args={},publicCall=false){
  const identity=publicCall?null:await IASDPIAuth.requireIdentity();
  const value=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})},body:JSON.stringify(args)});
  if(identity&&!IASDPIAuth.identityCurrent(identity.token))throw Error('Sessão ou igreja alterada. Suas alterações não foram enviadas novamente.');return value;
 }
 async function refreshFeed(month){const k=key(month),f={phase:'loading',events:[],suppressed:[],error:''};feeds.set(k,f);
  try{const signed=window.IASDPIConfig?.calendarPrivacyEnabled&&IASDPIAuth.identityKey();const v=await rpc(signed?'iasdpi_events_visible':'iasdpi_events_published',{p_month:month+'-01'},!signed);
   if(!v||!Array.isArray(v.events)||!Array.isArray(v.suppressed_source_keys)||v.events.some(e=>!e||e.status!=='published'||!validDate(e.date)||!validDate(e.end_date)||typeof e.title!=='string'))throw Error('Resposta pública de eventos inválida.');
   if(feeds.get(k)!==f)return;Object.assign(f,{phase:'ready',events:v.events,suppressed:v.suppressed_source_keys});
  }catch(e){if(feeds.get(k)===f)Object.assign(f,{phase:'error',error:e.code==='PGRST202'?'Eventos gerenciados indisponíveis: a migração 020 ainda não foi instalada.':e.message});}
  finally{if(k===key(month))redraw();}
 }
 function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
 const same=(a,b)=>String(a.title||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR')===String(b.title||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR')&&a.date===b.date&&a.end_date===b.end_date&&String(a.start_time||'').slice(0,5)===String(b.start_time||'').slice(0,5)&&String(a.location||'').trim()===String(b.location||'').trim();
 function sources(includeStatic=false){if(window.IASDPIConfig?.calendarPrivacyEnabled&&!includeStatic||church()!=='IASD_PI')return [];const seen=new Set();return (agendaSource().events||[]).filter(e=>e.kind==='event'&&validDate(e.startDate)&&validDate(e.endDate)&&!seen.has(e.id)&&seen.add(e.id)).map(e=>{
   const timed=!(e.allDay||e.wholeDay),clock=value=>{try{if(!value||!/[T]/.test(value)||isNaN(new Date(value)))return null;return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value));}catch{return null;}};
   return {id:'official-event:'+e.id,source_key:e.id,source_url:'https://iasd-paradainglesa.netlify.app/',title:e.title,date:e.startDate,end_date:e.endDate,start_time:timed?clock(e.start):null,end_time:timed?clock(e.end):null,
    location:e.location||'',description:'',all_day:Boolean(e.allDay||e.wholeDay),category:e.department&&e.department!=='Não informado'?'department':null,department_name:e.department&&e.department!=='Não informado'?e.department:'',department_id:null,status:'published',origin:'Agenda oficial · cópia publicada',isEvent:true};
  });}
 function feed(month){const k=key(month);if(!feeds.has(k)){feeds.set(k,{phase:'loading',events:[],suppressed:[],error:''});queueMicrotask(()=>refreshFeed(month));}return feeds.get(k);}
 function allRows(month){if(!enabled())return [];const f=feed(month),suppressed=new Set(f.suppressed);return [...sources().filter(e=>!suppressed.has(e.source_key)),...f.events.map(e=>({...e,isEvent:true,origin:'Publicado no IASDPI'}))];}
 function rows(month){return allRows(month).filter(e=>IASDPIScheduleCalendar.matchesEvent(e));}
 const onDay=(e,day)=>e.date<=day&&e.end_date>=day;
 function category(e){return {general:'Programação Geral',departmental:'Programação Departamental',reserved:'Atividade Reservada'}[e.program_category]||'Classificação pendente de revisão';}
 function chip(e){return `<span class="event-chip event-${e.program_category||'pending'}" title="${h(category(e)+' · '+e.title)}"><span aria-hidden="true">◇</span> ${h(e.title)}<span class="sr-only"> · ${h(category(e))}</span></span>`;}
 function details(e){return `<article class="event-details"><h3>${h(e.title)}</h3><p>${h(category(e))}${e.department_name?' · '+h(e.department_name):''}</p><p>${h(displayDate(e.date))}${e.end_date!==e.date?' a '+h(displayDate(e.end_date)):''} · ${e.all_day?'Dia inteiro':e.start_time?h(displayPlannedTime(e.start_time))+(e.end_time?' → '+h(displayPlannedTime(e.end_time)):''):'Horário não informado'}</p><p>Local: ${h((Array.isArray(e.space_names)?e.space_names.join(' · '):'')||e.location||'Não informado')}</p><p>${h(e.description||'Descrição não informada')}</p><small>${h(e.origin||'Publicado no IASDPI')}</small>${sourceWarning(e)?`<p class="form-note">${h(sourceWarning(e))}</p>`:''}${e.source_key?'<p class="muted">Dados da fonte preservados; divergências precisam de confirmação.</p>':''}</article>`;}

 function controls(month){if(!enabled())return '';const f=feed(month);return `${f.phase==='loading'?'<p role="status">Carregando eventos gerenciados…</p>':f.phase==='error'?`<p role="alert">${h(f.error)} <button type="button" data-events-feed-retry="${h(month)}">Tentar novamente</button></p>`:''}`;}
 function select(row=null){s.pendingPlan=null;s.seriesRequestId=null;s.seriesBaseline=null;s.row=row;s.values=row?{...row}:{id:crypto.randomUUID(),title:'',date:IASDPIScheduleCalendar.dayNow(),end_date:IASDPIScheduleCalendar.dayNow(),start_time:'',end_time:'',all_day:false,program_category:null,organizer_kind:null,audience:null,is_restricted:false,organizer_department_id:null,location:'',description:'',category:s.catalog?.is_admin?'church':'department',department_id:s.catalog?.is_admin?'':s.catalog?.departments.find(d=>d.can_edit)?.id||'',source_key:null,source_url:null};s.dirty=new Set(row?[]:['title','date','end_date','start_time','end_time','all_day','program_category','organizer_kind','audience','is_restricted','organizer_department_id','location','description','category','department_id','source_key','source_url'].filter(k=>window.IASDPIConfig?.calendarPrivacyEnabled||!['program_category','organizer_kind','audience','is_restricted','organizer_department_id'].includes(k)));if(planningEnabled()){const series=s.catalog.series?.find(x=>x.id===row?.series_id);s.seriesBaseline=series?structuredClone(series):null;Object.assign(s.values,{spaces:row?.spaces??[],recurrence:series?.definition.recurrence||'none',recurrence_weekday:series?.definition.recurrence_weekday??new Date(s.values.date+'T12:00:00Z').getUTCDay(),recurrence_ordinal:series?.definition.recurrence_ordinal||1,edit_scope:'occurrence'});if(!row){s.values.organizer_kind=null;s.dirty.add('spaces');}s.dirty.delete('audience');}s.history=null;s.request=crypto.randomUUID();s.error='';s.message='';}
 async function load(){const ticket=++s.generation;s.phase='loading';redraw();try{
  const identity=await IASDPIAuth.requireIdentity(),c=await rpc('iasdpi_events_catalog');
  if(ticket!==s.generation)return;if(!c||typeof c.is_admin!=='boolean'||!Array.isArray(c.events)||!Array.isArray(c.departments))throw Error('Resposta de eventos inválida.');
  if(s.owner&&s.owner!==identity.user.id){s.values=null;s.dirty.clear();s.row=null;}
  s.owner=identity.user.id;s.catalog=c;if(c.event_management_v2&&s.values?.series_id&&!s.dirty.size)s.seriesBaseline=structuredClone(c.series?.find(x=>x.id===s.values.series_id)||null);s.phase='ready';s.error='';
 }catch(e){if(ticket===s.generation){s.phase='error';s.error=e.code==='PGRST202'?'Gestão indisponível: revise a instalação da migração 020.':e.message;}}finally{if(ticket===s.generation)redraw();}}
 const statuses={draft:'Rascunho',published:'Publicado',cancelled:'Cancelado'};
 function canEdit(e=s.values){return s.catalog?.is_admin||e?.category==='church'&&e?.program_category==='general'&&s.catalog?.can_submit_general&&(!e.created_by||e.created_by===s.owner)||e?.category==='department'&&s.catalog?.departments.some(d=>d.id===e.department_id&&d.can_edit);}
 function canPublish(e=s.values){return s.catalog?.is_admin||e?.category==='church'&&e?.program_category==='general'&&s.catalog?.can_submit_general&&(!e.created_by||e.created_by===s.owner)||e?.category==='department'&&s.catalog?.departments.some(d=>d.id===e.department_id&&d.can_publish);}
 const dateUi=v=>validDate(v)?displayDate(v):v||'';
 const input=(label,name,value,attrs='')=>`<label>${h(label)}<input name="${name}" value="${h(value??'')}" ${attrs}></label>`;
 function eventSelect(label,name,value,options){return `<label>${h(label)}<select name="${name}"><option value="">Pendente de revisão</option>${options.map(([id,text])=>`<option value="${h(id)}" ${value===id?'selected':''}>${h(text)}</option>`).join('')}</select></label>`;}
 function planningEnabled(){return s.catalog?.event_management_v2===true;}
 function organizerValue(v){return v.organizer_kind==='department'&&v.organizer_department_id?'department:'+v.organizer_department_id:v.organizer_kind||'';}
 function planningEditor(){
  const v=s.values,series=s.seriesBaseline||s.catalog.series?.find(x=>x.id===v.series_id),recurrence=(s.dirty.has('recurrence')?v.recurrence:series?.definition.recurrence)||v.recurrence||'none',week=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const select=(label,name,value,options,extra='')=>`<label>${h(label)}<select name="${name}" ${extra}>${options.map(([id,text])=>`<option value="${h(id)}" ${String(value)===String(id)?'selected':''}>${h(text)}</option>`).join('')}</select></label>`;
  const conflictList=plan=>`<ul class="event-conflicts">${(plan.occurrences||[{reservation_conflicts:plan.conflicts||[]}]).flatMap(e=>(e.reservation_conflicts||[]).map(c=>`<li><strong>${h(c.space_name)} · ${h(displayDate(c.date||e.date))}</strong><span>${h(c.event_title)} · ${h(c.time_pending?'Horário pendente de revisão':c.period_label||c.occupied||'Dia inteiro')}</span></li>`)).join('')}</ul>`;
  return `<form id="event-editor" class="panel event-editor-v2" novalidate aria-busy="${s.saving}"><fieldset class="event-form-fields" ${s.saving?'disabled':''}><legend class="sr-only">Dados do evento</legend><div class="event-editor-heading"><h2>${s.row?'Editar evento':'Novo evento'}</h2><span class="badge neutral">${h(s.catalog?.event_approval_required&&v.approval_status==='pending'?'Aguardando aprovação':statuses[v.status]||'Rascunho')}</span></div>
  ${series?select('Aplicar alterações','edit_scope',v.edit_scope||'occurrence',[['occurrence','Somente esta ocorrência'],['following','Esta e as próximas ocorrências'],['all','Toda a série']]):''}
  <section class="event-form-section"><h3>Informações do evento</h3><div class="event-fields">${input('Título do evento','title',v.title,'required maxlength="160"')}${input('Data inicial','date',dateUi(v.date),'placeholder="dd/mm/aaaa" required')}${input('Data final — opcional','end_date',dateUi(v.end_date),'placeholder="dd/mm/aaaa"')}</div><div class="event-time-fields">${input('Horário inicial','start_time',v.start_time?displayPlannedTime(v.start_time):'','placeholder="HH:mm" inputmode="numeric" '+(v.all_day?'disabled':''))}${input('Horário final','end_time',v.end_time?displayPlannedTime(v.end_time):'','placeholder="HH:mm" inputmode="numeric" '+(v.all_day?'disabled':''))}<label class="checkbox"><input type="checkbox" name="all_day" ${v.all_day?'checked':''}> Dia inteiro</label></div>
  <div class="event-fields">${select('Recorrência','recurrence',recurrence,(series?[['weekly','Semanalmente'],['monthly','Mensalmente']]:[['none','Não repetir'],['weekly','Semanalmente'],['monthly','Mensalmente']]),s.row&&(!series||v.edit_scope==='occurrence')?'disabled':'')}${recurrence==='monthly'?select('Posição no mês','recurrence_ordinal',(s.dirty.has('recurrence_ordinal')?v.recurrence_ordinal:series?.definition.recurrence_ordinal)||v.recurrence_ordinal||1,[[1,'1ª'],[2,'2ª'],[3,'3ª'],[4,'4ª'],[-1,'Última']],s.row&&v.edit_scope==='occurrence'?'disabled':''):''}${recurrence!=='none'?select('Dia da semana','recurrence_weekday',(s.dirty.has('recurrence_weekday')?v.recurrence_weekday:series?.definition.recurrence_weekday)??v.recurrence_weekday??new Date(v.date+'T12:00:00Z').getUTCDay(),week.map((text,id)=>[id,text]),s.row&&v.edit_scope==='occurrence'?'disabled':''):''}</div>${recurrence!=='none'?`<p class="muted">Esta recorrência será programada até ${h(displayDate(series?.until_date||IASDPIEventPlanning.yearEnd()))}.</p>`:''}
  <label>Descrição — opcional<textarea name="description" maxlength="5000">${h(v.description||'')}</textarea></label></section>
  <section class="event-form-section"><h3>Organização</h3>${select('Responsável / Organizador','event_organizer',organizerValue(v),[['','Pendente de revisão'],...s.catalog.organizer_options.filter(o=>s.catalog.is_admin||s.catalog.can_submit_general&&o.value==='local_church'||o.value.startsWith('department:')||o.value===organizerValue(v)).map(o=>[o.value,o.label])])}</section>
  <section class="event-form-section"><h3>Locais e reservas</h3><details class="event-space-picker"><summary>${v.spaces?.length?h(s.catalog.spaces.filter(x=>v.spaces.includes(x.code)).map(x=>x.name).join(' · ')):'Selecionar locais'}</summary><fieldset><legend class="sr-only">Locais utilizados</legend>${s.catalog.spaces.map(space=>`<label class="checkbox"><input type="checkbox" data-event-space value="${h(space.code)}" ${v.spaces?.includes(space.code)?'checked':''}>${h(space.name)}${space.exclusive?'<small>Reserva exclusiva</small>':''}</label>`).join('')}</fieldset></details>${s.row?.spaces==null&&s.row?.location?`<p class="muted">Local anterior preservado: ${h(s.row.location)}. Confirme os locais para validar reservas.</p>`:''}</section>
  <section class="event-form-section"><h3>Participação e visibilidade</h3>${select('Público-alvo','program_category',v.program_category,[['','Pendente de revisão'],['general','Programação Geral'],['departmental','Programação Departamental'],['reserved','Atividade Reservada']])}<label class="checkbox"><input type="checkbox" name="is_restricted" ${v.is_restricted?'checked':''}> Restrito — não mostrar no calendário público</label></section>
  ${s.pendingPlan?`<section class="event-conflict-panel" role="alert"><h3>Conflitos de reserva</h3><p>Resolva os conflitos de reserva antes de publicar. Você pode salvar um rascunho.</p>${conflictList(s.pendingPlan)}<button type="button" data-event-confirm>Salvar como rascunho</button></section>`:''}
  <p id="event-save-state" role="status">${s.saving?'Aguardando confirmação…':h(s.message||(s.dirty.size?'Alterações pendentes.':'Sem alterações pendentes.'))}</p><div class="actions">${canEdit()?'<button type="submit" value="draft">Salvar rascunho</button>':''}${canPublish()?`<button type="submit" class="primary" value="published">${s.catalog?.event_approval_required&&v.program_category==='general'&&!s.catalog?.can_approve_general?'Enviar para aprovação':'Publicar'}</button>`:''}${s.row&&(s.catalog?.is_admin||s.row.category!=='church'&&canEdit()||s.row.created_by===s.owner)?'<button type="button" data-event-history>Histórico</button>':''}${s.row&&canPublish()?'<button type="button" data-event-cancel>Cancelar evento</button>':''}<button type="button" data-event-close>Fechar</button></div>
  ${s.row&&(s.row.audience||s.row.category||s.row.location)?`<details class="event-legacy"><summary>Informações anteriores preservadas</summary><p>Gestão: ${h(({church:'Igreja',department:'Departamento'})[s.row.category]||'Não informada')} · Público-alvo anterior: ${h(({whole_church:'Toda a igreja',specific:'Público específico',restricted:'Restrito/Convidados'})[s.row.audience]||'Não informado')} · Local: ${h(s.row.location||'Não informado')}</p><p>Esses dados permanecem no histórico; não são reclassificados automaticamente.</p></details>`:''}${s.history?`<ol class="event-history">${s.history.map(v=>`<li>Versão ${v.version} · ${h(statuses[v.status])} · ${h(displayRecordTimestamp(v.captured_at))} · autor ${h(v.actor_id||'Não informado')}</li>`).join('')}</ol>`:''}</fieldset></form>`;
 }
 function planningChange(e){
  const f=e.target,v=s.values;
  if(f.hasAttribute('data-event-space')){const codes=new Set(v.spaces||[]);if(f.checked)codes.add(f.value);else codes.delete(f.value);v.spaces=[...codes];s.dirty.add('spaces');s.pendingPlan=null;s.request=crypto.randomUUID();redraw();return true;}
  if(f.name==='event_organizer'){
   if(f.value!==organizerValue(v)){const isDepartment=f.value.startsWith('department:');v.organizer_kind=isDepartment?'department':f.value||null;v.organizer_department_id=isDepartment?f.value.slice(11):null;v.category=isDepartment?'department':'church';v.department_id=isDepartment?v.organizer_department_id:null;for(const name of ['organizer_kind','organizer_department_id','category','department_id'])s.dirty.add(name);}
   s.request=crypto.randomUUID();s.pendingPlan=null;redraw();return true;
  }
  if(['recurrence','recurrence_weekday','recurrence_ordinal','edit_scope','program_category'].includes(f.name)){v[f.name]=f.value;s.dirty.add(f.name);s.pendingPlan=null;s.request=crypto.randomUUID();redraw();return true;}
  return false;
 }
 async function planningSave(status,accept=false){
  const v=s.values,series=s.seriesBaseline||s.catalog.series?.find(x=>x.id===v.series_id),scope=v.edit_scope||'occurrence',isSeries=Boolean(series&&scope!=='occurrence'||!s.row&&v.recurrence&&v.recurrence!=='none'),patch={};
  if(s.saving)return;
  for(const name of s.dirty)if(!['recurrence','recurrence_weekday','recurrence_ordinal','edit_scope','event_organizer'].includes(name))patch[name]=v[name];
  if(patch.date!==undefined)patch.date=readDate(patch.date);if(patch.end_date!==undefined)patch.end_date=patch.end_date?readDate(patch.end_date):(patch.date||s.row?.date);
  for(const name of ['start_time','end_time'])if(name in patch){if(patch[name]&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(patch[name]))throw Error('Informe horário de 24 horas no formato HH:mm.');patch[name]=patch[name]||null;}
  for(const name of ['department_id','organizer_department_id','program_category','organizer_kind'])if(name in patch)patch[name]=patch[name]||null;
  patch.status=status;
  const data={...v,...patch,date:patch.date||v.date,end_date:patch.end_date||v.end_date||v.date};
  if(String(v.title||'').trim().length<2)throw Error('Informe um título de pelo menos dois caracteres.');
  if(!s.row&&(!v.organizer_kind||!v.program_category))throw Error('Confirme Responsável / Organizador e Público-alvo.');
  if(isSeries){delete patch.source_key;delete patch.source_url;for(const name of ['recurrence','recurrence_weekday','recurrence_ordinal'])if(s.dirty.has(name))patch[name]=name==='recurrence'?v[name]:Number(v[name]);if(!series)Object.assign(patch,{recurrence:v.recurrence,recurrence_weekday:Number(v.recurrence_weekday),recurrence_ordinal:Number(v.recurrence_ordinal)});IASDPIEventPlanning.occurrences(series?{...series.definition,...patch}:data,series?.until_date);}
  s.saving=true;s.error='';redraw();try{
   if(!accept&&status!=='cancelled'){
    const previewData=isSeries&&series?{...series.definition,...patch,recurrence_until:series.until_date,...(scope==='following'?{preview_from:v.occurrence_on}:{})}:isSeries?data:{...data,recurrence:'none'};
    const exclude=isSeries&&series?s.catalog.events.filter(e=>e.series_id===series.id&&(scope==='all'||e.occurrence_on>=v.occurrence_on)).map(e=>e.id):s.row?[v.id]:[];
    const plan=await rpc('iasdpi_event_preview',{p_data:previewData,p_exclude:exclude});
    if(plan.conflict_count&&status==='published'){s.pendingPlan=plan;s.intent='draft';return;}
   }
   let result;
   if(isSeries){s.seriesRequestId=s.seriesRequestId||crypto.randomUUID();result=await rpc('iasdpi_event_series_save',{p_id:series?.id||s.seriesRequestId,p_expected_version:series?.version||0,p_patch:patch,p_request_id:s.request,p_scope:scope==='occurrence'?'all':scope,p_occurrence:series?v.id:null,p_accept_conflicts:accept});}
   else result=await rpc('iasdpi_event_submit',{p_id:v.id,p_expected_version:s.row?.version||0,p_patch:patch,p_request_id:s.request,p_accept_conflicts:accept});
   if(result.requires_confirmation){s.pendingPlan=result;s.intent='draft';return;}
   s.pendingPlan=null;const saved=result.event||result.events?.find(e=>e.occurrence_on===v.occurrence_on)||result.events?.[0];
   select(saved);s.message=s.catalog?.event_approval_required&&saved?.approval_status==='pending'?'Enviado para aprovação.':saved?.status==='published'?'Publicação confirmada.':saved?.status==='cancelled'?'Cancelamento confirmado; histórico preservado.':'Rascunho salvo. Confirmação recebida.';
   feeds.clear();await load();
  }catch(e){s.error=e.message;s.message='Alterações mantidas nesta tela. Nenhuma nova gravação foi confirmada.';}finally{s.saving=false;redraw();}
 }

 function editor(){if(planningEnabled()&&s.values)return planningEditor();const modern=window.IASDPIConfig?.calendarPrivacyEnabled===true;const v=s.values;if(!v)return '';return `<form id="event-editor" class="panel" novalidate aria-busy="${s.saving}"><fieldset class="event-form-fields" ${s.saving?'disabled':''}><legend class="sr-only">Dados do evento</legend><h2>${s.row?'Editar evento':'Novo evento'}</h2><div class="form-grid">${input('Título','title',v.title,'maxlength="160" required')}${input('Data — dd/mm/aaaa','date',dateUi(v.date),'placeholder="dd/mm/aaaa" required')}${input('Data final — opcional','end_date',dateUi(v.end_date),'placeholder="dd/mm/aaaa"')}${input('Horário inicial — opcional, HH:mm','start_time',v.start_time?displayPlannedTime(v.start_time):'','inputmode="text" maxlength="5" placeholder="HH:mm"')}${input('Horário final — opcional, HH:mm','end_time',v.end_time?displayPlannedTime(v.end_time):'','inputmode="text" maxlength="5" placeholder="HH:mm"')}<label>Gestão do evento<select name="category"><option value="">Pendente de confirmação</option>${s.catalog.is_admin?`<option value="church" ${v.category==='church'?'selected':''}>Evento da Igreja</option>`:''}<option value="department" ${v.category==='department'?'selected':''}>Evento de Departamento</option></select></label><label>Departamento responsável<select name="department_id" ${v.category!=='department'?'disabled':''}><option value="">Pendente de confirmação</option>${s.catalog.departments.map(d=>`<option value="${h(d.id)}" ${v.department_id===d.id?'selected':''}>${h(d.name)}</option>`).join('')}</select></label>${input('Local — opcional','location',v.location,'maxlength="500"')}</div>${modern?`<div class="form-grid">${eventSelect('Classificação','program_category',v.program_category,[['general','Programação Geral'],['departmental','Programação Departamental'],['reserved','Atividade Reservada']])}${eventSelect('Organizador','organizer_kind',v.organizer_kind,[['local_church','Igreja Local'],['association','Associação'],['school','Escola Adventista'],['department','Departamento'],['other','Outro']])}${eventSelect('Público-alvo','audience',v.audience,[['whole_church','Toda a igreja'],['specific','Público específico'],['restricted','Restrito/Convidados']])}${v.organizer_kind==='department'?eventSelect('Departamento organizador','organizer_department_id',v.organizer_department_id,s.catalog.departments.map(d=>[d.id,d.name])):''}</div><label class="checkbox"><input type="checkbox" name="is_restricted" ${v.is_restricted?'checked':''}> Restrito — não mostrar no calendário público</label><p class="form-note">Classificação e organizador não alteram permissões. “Restrito” controla a visibilidade pública, independentemente da classificação e do público-alvo.</p>`:''}<label class="checkbox"><input type="checkbox" name="all_day" ${v.all_day?'checked':''}> Dia inteiro</label><label>Descrição — opcional<textarea name="description" maxlength="5000">${h(v.description||'')}</textarea></label><p id="event-save-state" role="status">${s.saving?'Aguardando confirmação…':s.message||(s.dirty.size?'Alterações pendentes.':'Sem alterações pendentes.')}</p><div class="actions">${canEdit()?'<button type="submit" value="draft" '+(s.saving?'disabled':'')+'>Salvar rascunho</button>':''}${canPublish()?'<button type="submit" class="primary" value="published" '+(s.saving?'disabled':'')+'>Publicar</button>':''}${s.row?'<button type="button" data-event-history>Histórico</button>':''}${s.row&&canPublish()?'<button type="button" data-event-cancel '+(s.saving?'disabled':'')+'>Cancelar evento</button>':''}<button type="button" data-event-close ${s.saving?'disabled':''}>Fechar</button></div>${s.history?`<ol class="event-history">${s.history.map(v=>`<li>Versão ${v.version} · ${h(statuses[v.status])} · ${h(displayRecordTimestamp(v.captured_at))} · autor ${h(v.actor_id)}${v.snapshot?details({...v.snapshot,origin:'Histórico · '+statuses[v.status]}):''}</li>`).join('')}</ol>`:''}</fieldset></form>`;}
 function sourcePreview(){const c=s.catalog;if(!c)return '';const list=sources().filter(e=>e.date.startsWith(agendaState.month));return `<details class="panel" id="events-source-preview" ${s.sourceOpen?'open':''}><summary>Conferir eventos da Agenda antes de cadastrar</summary><label>Mês de referência<input type="month" id="events-source-month" value="${h(agendaState.month)}"></label><p class="muted">Importação cria rascunho para revisão. Datas e IDs da Agenda são preservados. Categoria, local e horários desconhecidos ficam pendentes.</p><ul class="event-source-list">${list.map(e=>{const linked=c.events.find(x=>x.source_key===e.source_key),candidates=c.events.filter(x=>same(x,e));return `<li><strong>${h(displayDate(e.date)+' · '+e.title)}</strong><span>${h(e.department_name||'Departamento não informado')}</span>${sourceWarning(e)?`<span class="form-note">${h(sourceWarning(e))}</span>`:''}${linked?`<button type="button" data-event-open="${h(linked.id)}">Abrir registro existente</button>`:candidates.length?`<span>Possível correspondência: revisar o registro existente.</span>${candidates.map(x=>`<button type="button" data-event-open="${h(x.id)}">${h(x.title)} · versão ${x.version}</button>${c.is_admin&&!x.source_key?`<button type="button" data-event-associate="${h(x.id)}" data-source-key="${h(e.source_key)}">Associar fonte a este registro</button>`:''}`).join('')}`:c.is_admin?`<button type="button" data-event-import="${h(e.source_key)}">Revisar cadastro</button>`:'<span>Associação da fonte requer administrador.</span>'}</li>`;}).join('')||'<li>Nenhum evento da fonte neste mês.</li>'}</ul></details>`;}
 function page(){if(!enabled())return '<section class="panel"><h1>Gestão de Eventos</h1><p>Ativação pendente neste ambiente.</p></section>';if(s.phase==='idle'){queueMicrotask(load);return '<p role="status">Carregando eventos…</p>';}
  return heading('IASDPI','Gestão de Eventos','Eventos da igreja e dos departamentos.',(s.catalog?.is_admin||s.catalog?.can_submit_general||s.catalog?.departments.some(d=>d.can_edit)?'<button type="button" class="primary" data-event-new>Novo evento</button>':'')+'<button type="button" data-events-retry>Atualizar lista</button>')+
   `${s.error?`<p role="alert">${h(s.error)} <button type="button" data-events-retry>Tentar novamente</button></p>`:''}${s.phase==='loading'?'<p role="status">Carregando eventos…</p>':''}${s.message?`<p role="status">${h(s.message)}</p>`:''}${editor()}${s.catalog?`<section class="panel"><h2>Eventos cadastrados</h2>${s.catalog.events.length?`<ul class="event-manager-list">${s.catalog.events.map(e=>`<li><strong>${h(displayDate(e.date)+' · '+e.title)}</strong><span>${h(s.catalog?.event_approval_required&&e.approval_status==='pending'?'Aguardando aprovação':statuses[e.status])} · v${e.version}</span>${s.catalog?.can_approve_general&&e.approval_status==='pending'&&e.program_category==='general'?`<button type="button" class="primary" data-event-approve="${h(e.id)}" data-version="${e.version}">Aprovar e publicar</button>`:''}<button type="button" data-event-open="${h(e.id)}">Abrir</button></li>`).join('')}</ul>`:'<p>Nenhum evento cadastrado.</p>'}</section>${sourcePreview()}`:''}`;
 }
 async function save(status){if(planningEnabled())return planningSave(status);if(s.saving)return;const v=s.values,patch={};for(const name of s.dirty)patch[name]=v[name];
  if(patch.date!==undefined)patch.date=readDate(patch.date);if(patch.end_date!==undefined)patch.end_date=patch.end_date?readDate(patch.end_date):(patch.date||s.row?.date);
  for(const name of ['start_time','end_time'])if(Object.hasOwn(patch,name)){if(patch[name]&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(patch[name]))throw Error('Informe horário de 24 horas no formato HH:mm.');patch[name]=patch[name]||null;}
  for(const name of ['department_id','category','program_category','organizer_kind','audience','organizer_department_id'])if(Object.hasOwn(patch,name))patch[name]=patch[name]||null;
  patch.status=status;if(status==='published'&&v.end_time&&!v.start_time)throw Error('Horário inicial pendente. Confirme antes de publicar.');if(status==='published'&&(!v.category||v.category==='department'&&!v.department_id))throw Error('Confirme a categoria e o departamento antes de publicar.');
  if(String(v.title||'').trim().length<2)throw Error('Informe um título de pelo menos dois caracteres.');
  s.saving=true;s.error='';redraw();try{const saved=await rpc('iasdpi_event_save',{p_id:v.id,p_expected_version:s.row?.version||0,p_patch:patch,p_request_id:s.request});select(saved);s.message=status==='published'?'Publicação confirmada.':status==='cancelled'?'Cancelamento confirmado; histórico preservado.':'Rascunho salvo. Confirmação recebida.';feeds.clear();await load();}
  catch(e){s.error=e.message;s.message='Alterações mantidas nesta tela. Nenhuma nova gravação foi confirmada.';}
  finally{s.saving=false;redraw();}
 }
 function canLeave(){if(state.page!=='events'||!s.dirty.size)return true;if(s.saving){toast('Aguarde a confirmação da gravação.',true);return false;}if(!confirm('Descartar alterações não salvas deste evento?'))return false;s.dirty.clear();s.values=null;return true;}
 function failure(e){s.error=e.message;redraw();}
 document.addEventListener('toggle',e=>{if(e.target.id==='events-source-preview')s.sourceOpen=e.target.open;},true);
 document.addEventListener('input',e=>{if(e.target.closest('#event-editor')&&e.target.name){if(e.target.name==='date'&&s.values.end_date===s.values.date){s.values.end_date=e.target.value;s.dirty.add('end_date');e.target.form.elements.end_date.value=e.target.value;}s.values[e.target.name]=e.target.type==='checkbox'?e.target.checked:e.target.value;s.dirty.add(e.target.name);s.pendingPlan=null;document.querySelector('.event-conflict-panel')?.remove();s.request=crypto.randomUUID();const hint=document.getElementById('event-save-state');if(hint)hint.textContent='Alterações pendentes.';}});
 document.addEventListener('change',e=>{if(e.target.closest('#event-editor')){if(planningEnabled()&&planningChange(e))return;s.values[e.target.name]=e.target.type==='checkbox'?e.target.checked:e.target.value;s.dirty.add(e.target.name);s.request=crypto.randomUUID();if(e.target.name==='all_day'&&e.target.checked){if((s.values.start_time||s.values.end_time)&&!confirm('Remover os horários desta edição e marcar dia inteiro? A alteração depende de salvar.')){s.values.all_day=false;e.target.checked=false;return;}s.values.start_time='';s.values.end_time='';s.dirty.add('start_time');s.dirty.add('end_time');redraw();}if(e.target.name==='all_day'&&!e.target.checked)redraw();if(e.target.name==='organizer_kind'){s.values.organizer_department_id=null;s.dirty.add('organizer_department_id');redraw();}if(e.target.name==='category'){s.values.department_id='';s.dirty.add('department_id');redraw();}}if(e.target.id==='events-source-month'){agendaState.month=e.target.value;redraw();}});
 document.addEventListener('submit',e=>{if(e.target.id!=='event-editor')return;e.preventDefault();e.stopImmediatePropagation();void save(e.submitter?.value||'draft').catch(failure);},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-event-approve],[data-event-confirm],[data-events-feed-retry],[data-events-retry],[data-event-new],[data-event-open],[data-event-import],[data-event-close],[data-event-cancel],[data-event-history],[data-event-associate]');if(!b||!enabled())return;e.preventDefault();
  if(b.dataset.eventApprove){if(!confirm('Aprovar e publicar este evento geral após validar as reservas?'))return;void rpc('iasdpi_event_approve',{p_id:b.dataset.eventApprove,p_expected_version:Number(b.dataset.version),p_request_id:crypto.randomUUID()}).then(async()=>{feeds.clear();s.message='Evento aprovado e publicado.';await load();}).catch(failure);return;}  if(b.hasAttribute('data-event-confirm')){void planningSave(s.intent||'published',true).catch(failure);return;}if(b.dataset.eventsFeedRetry){void refreshFeed(b.dataset.eventsFeedRetry);if(window.IASDPIPortalAccess?.enabled())void IASDPIPortalAccess.refreshFeed(b.dataset.eventsFeedRetry);return;}if(b.hasAttribute('data-events-retry')){void load();return;}
  if(b.hasAttribute('data-event-history')){void rpc('iasdpi_event_history',{p_id:s.row.id}).then(v=>{s.history=v;redraw();}).catch(failure);return;}
  if(b.hasAttribute('data-event-cancel')){if(!confirm(planningEnabled()&&s.values?.series_id?(s.values.edit_scope==='all'?'Cancelar toda a série? O histórico será preservado.':s.values.edit_scope==='following'?'Cancelar esta e as próximas ocorrências? O histórico será preservado.':'Cancelar somente esta ocorrência? O restante da série será preservado.'):'Cancelar este evento? O histórico será preservado.'))return;s.values.cancellation_reason=prompt('Motivo do cancelamento (opcional):')||'';s.dirty.add('cancellation_reason');void save('cancelled').catch(failure);return;}
  if(!canLeave())return;
  if(b.dataset.eventAssociate){const source=sources().find(x=>x.source_key===b.dataset.sourceKey),row=s.catalog.events.find(x=>x.id===b.dataset.eventAssociate);if(!source||!row||!s.catalog.is_admin)return;select(row);s.values.source_key=source.source_key;s.values.source_url=source.source_url;s.dirty.add('source_key');s.dirty.add('source_url');}
  if(b.hasAttribute('data-event-new'))select();if(b.dataset.eventOpen)select(s.catalog.events.find(x=>x.id===b.dataset.eventOpen));
  if(b.dataset.eventImport){const source=sources().find(x=>x.source_key===b.dataset.eventImport);if(!source)return;const existing=s.catalog.events.find(x=>x.source_key===source.source_key||same(x,source));if(existing)select(existing);else{select();Object.assign(s.values,source,{id:crypto.randomUUID(),department_id:s.catalog.departments.find(d=>d.name===source.department_name)?.id||''});s.values.status='draft';}}
  if(b.hasAttribute('data-event-close')){s.values=null;s.row=null;s.dirty.clear();}redraw();
 });
 for(const name of ['iasdpi-identity-ended','iasdpi-church-changed'])window.addEventListener(name,()=>{s.generation++;s.phase='idle';s.catalog=null;s.values=null;s.row=null;s.dirty.clear();s.owner='';feeds.clear();});
 for(const name of ['iasdpi-auth-changed','iasdpi-role-changed'])window.addEventListener(name,()=>{feeds.clear();if(['schedule-calendar','agendas'].includes(state.page))queueMicrotask(redraw);});
 window.addEventListener('beforeunload',e=>{if(state.page==='events'&&s.dirty.size){e.preventDefault();e.returnValue='';}});
 return {enabled,page,rows,controls,allRows,onDay,chip,details,categoryText:category,sources,same,validDate,refreshFeed,load,canLeave};
})();
