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
 function data(){return [...legacy(),...periods().map(r=>window.IASDPIRegistry?.historical(r)||r),...(window.IASDPIPortalAccess?.enabled()?IASDPIPortalAccess.feedRows(ui.month).filter(e=>!e.kind):[])];}
 const departments=()=>[...new Set([...Object.keys(colors),...data().map(r=>r.department)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const active=d=>ui.departments===null||ui.departments.has(d);
 const matches=r=>active(r.department)&&(ui.person==='all'||(r.person||'__unassigned__')===ui.person);
 const overlaps=(r,start,end)=>r.startDate?r.startDate<=end&&r.endDate>=start:r.date>=start&&r.date<=end;
 const sort=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.department.localeCompare(b.department,'pt-BR')||(a.person||'').localeCompare(b.person||'','pt-BR'));
 function monthDays(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês válido.');return new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).getUTCDate();}
 function changeMonth(value){monthDays(value);ui.month=value;ui.day=value===dayNow().slice(0,7)?dayNow():value+'-01';}
 function shift(n){const d=new Date(ui.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);changeMonth(d.toISOString().slice(0,7));}
 const personText=r=>r.person||(r.role?'A definir':'Responsável não informado');
 const label=r=>`${r.department} — ${personText(r)} · ${r.role||'Função não informada'}`;
 function tag(r,compact=false){return `<span class="scale-tag ${compact?'scale-chip':''}" data-scale-color="${escape(r.department)}" title="${escape(label(r))}">${icon(r.department)}<span class="scale-person-name">${escape(compact?personText(r):r.department+' — '+personText(r))}</span>${compact?`<span class="sr-only">${escape(r.department+' · '+(r.role||'Função não informada'))}</span>`:''}</span>`;}
 let detailHelpId=0;
 function list(rows,emptyText){return rows.length?`<ul class="scale-details">${rows.map(r=>`<li>${tag(r)}<small>${r.startDate?dateText(r.startDate)+' a '+dateText(r.endDate):dateText(r.date)}${window.IASDPIScheduleUI?.isReview()?(r.role?' · '+escape(r.role):''):' · '+escape(r.role||'Função não informada')+' · '+escape(r.origin)}</small>${window.IASDPIScheduleUI?.isReview()?IASDPIScheduleUI.help('calendar-details-'+(++detailHelpId),'Origem: '+String(r.origin||'Não informada').replace(/SIMULAÇÃO LOCAL · não publicada no site oficial|Escala publicada nesta demonstração · memória da aba/,'Publicação nesta aba')+'.','Detalhes de '+label(r)):''}</li>`).join('')}</ul>`:`<p class="muted">${escape(emptyText)}</p>`;}

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
  const monthly=filtered.filter(r=>overlaps(r,monthStart,monthEnd)),selected=filtered.filter(r=>overlaps(r,ui.day,ui.day));
  const people=[...new Set(rows.map(r=>r.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const title=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(monthStart+'T12:00:00Z'));
  const offset=new Date(monthStart+'T12:00:00Z').getUTCDay(),first=addDays(monthStart,-offset),weekCount=Math.ceil((offset+days)/7);
  const weeks=Array.from({length:weekCount},(_,week)=>{
   const weekStart=addDays(first,week*7);
   const bands=bandRows(monthly,weekStart,monthStart,monthEnd);
   const numbers=bands?`<tr class="scale-number-row">${Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);return day.startsWith(ui.month)?`<td><span class="scale-day-number ${day===dayNow()?'scale-today-number':''}" aria-hidden="true">${Number(day.slice(-2))}</span></td>`:'<td class="scale-outside" aria-hidden="true"></td>';}).join('')}</tr>`:'';
   const cells=Array.from({length:7},(_,col)=>{const day=addDays(weekStart,col);if(!day.startsWith(ui.month))return '<td class="scale-outside" aria-hidden="true"></td>';
    const items=monthly.filter(r=>!r.startDate&&r.date===day),all=monthly.filter(r=>overlaps(r,day,day));
    return `<td data-scale-day="${day}"><button type="button" class="scale-day" data-scale-action="day" data-date="${day}" aria-label="${escape(dateText(day)+' · '+all.length+' entradas'+(all.length?': '+all.map(label).join('; '):''))}" aria-pressed="${day===ui.day}" ${day===dayNow()?'aria-current="date"':''}>${bands?'':`<span class="scale-day-number">${Number(day.slice(-2))}</span>`}${items.map(r=>tag(r,true)).join('')}</button></td>`;
   }).join('');
   return `<tbody class="scale-week-group ${bands?'scale-week-with-periods':''}">${numbers}${bands}<tr class="scale-days-row" data-week-start="${weekStart}">${cells}</tr></tbody>`;
  }).join('');
  const missing=monthly.filter(r=>!r.person&&r.role),pointCount=monthly.filter(r=>!r.startDate).length,source=officialSource();
  return `<div class="scale-heading"><div><p class="eyebrow">GESTÃO DE ESCALAS · CONSULTA</p><h1>Calendário de escalas</h1></div><div><a href="#schedule-setup" data-calendar-nav>Cadastros de pessoas e funções</a>${window.IASDPIScheduleManagement?'<a href="#schedule-build" class="button primary" data-calendar-nav>Criar escala</a>':'<button type="button" class="primary" disabled aria-describedby="scale-create-note">Criar escala</button>'}</div></div>
   ${window.IASDPIScheduleUI?.isReview()?'':`<p id="scale-create-note" class="muted">${window.IASDPIScheduleManagement?'Montagem manual disponível para administradores e gestores ministeriais autorizados.':'Criação de escalas em preparação. Nesta etapa não há gravação da Fase B.'}</p>`}
   ${window.IASDPIScheduleUI?.isReview()?'':`<details class="scale-provenance"><summary>Origem das escalas</summary><p>Sonoplastia: 15 registros manuais de outubro/início de novembro de 2026. Comunicação: cinco registros manuais de outubro. Grafias preservadas; sem sincronização automática dessas listas.</p><p>Anciãos: cópia da Agenda oficial${source.syncedAt?' atualizada em '+escape(dateText(source.syncedAt.slice(0,10))):'; atualização não informada'}. Datas finais inclusivas conforme a fonte. Nenhum ancião é inferido nos períodos sem escala.</p><p>Horários não informados; esta consulta não valida conflitos de horário.</p></details>`}
   ${publicStatus}${!window.IASDPIScheduleUI?.isReview()&&window.IASDPICalendarManagedPeriodsSource?'<p class="muted">Somente publicações confirmadas aparecem aqui. Uma nova revisão em rascunho mantém a última publicação no calendário. Nesta demonstração, as alterações ficam apenas na aba.</p>':''}<section class="panel scale-month-panel"><div class="scale-month-actions"><button type="button" data-scale-action="previous" aria-label="Mês anterior">‹</button><h2 id="scale-month-title">${escape(title)}</h2><button type="button" data-scale-action="next" aria-label="Próximo mês">›</button>${window.IASDPIScheduleUI?.isReview()?IASDPIScheduleUI.monthPicker('scale-month',ui.month):`<label>Mês<input type="month" id="scale-month" value="${ui.month}"></label>`}<button type="button" data-scale-action="today">Hoje</button></div>
   <div class="scale-filters scale-person-filters"><label>Pessoa<select id="scale-person"><option value="all">Todas</option>${people.map(p=>`<option value="${escape(p)}" ${ui.person===p?'selected':''}>${escape(p)}</option>`).join('')}${rows.some(r=>!r.person&&r.role)?`<option value="__unassigned__" ${ui.person==='__unassigned__'?'selected':''}>A definir</option>`:''}</select></label><div class="scale-help-control"><button type="button" class="scale-help-button" aria-label="Ajuda sobre os filtros" aria-controls="scale-help-tip" aria-describedby="scale-help-tip" aria-expanded="false">?</button><span id="scale-help-tip" role="tooltip" hidden>Toque nos departamentos para mostrar ou ocultar. Selecione um dia ou faixa para ver os detalhes completos.${window.IASDPIScheduleUI?.isReview()?' Sonoplastia e Comunicação usam escalas manuais; Ancionato também mantém referências da Agenda. Só as escalas publicadas nesta aba aparecem no calendário; rascunhos não aparecem.':''}</span></div></div>
   <div class="scale-filter-bar" role="group" aria-label="Filtrar departamentos"><button type="button" class="scale-all-filter" data-scale-action="all" aria-pressed="${departments().every(active)}">Todos</button>${departments().map(d=>`<button type="button" class="scale-filter scale-tag" data-scale-action="department" data-department="${escape(d)}" data-scale-color="${escape(d)}" aria-pressed="${active(d)}">${icon(d)}<span>${escape(d)}</span><span class="scale-filter-state" aria-hidden="true">${active(d)?'✓':'—'}</span></button>`).join('')}</div>
   ${monthly.some(r=>r.kind==='monthly')?`<div class="scale-month-responsibles" role="group" aria-label="Responsáveis do mês">${monthly.filter(r=>r.kind==='monthly').map(r=>`<button type="button" class="scale-monthly" data-scale-action="period" data-start-date="${r.startDate>monthStart?r.startDate:monthStart}" data-scale-id="${escape(r.id)}" data-scale-kind="monthly" data-scale-color="${escape(r.department)}" data-from="${r.startDate>monthStart?r.startDate:monthStart}" data-to="${r.endDate<monthEnd?r.endDate:monthEnd}" aria-label="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}" title="${escape(label(r)+' · '+dateText(r.startDate)+' a '+dateText(r.endDate))}">${icon(r.department)}<span class="scale-month-role">${escape(r.role)}:</span><span class="scale-person-name">${escape(personText(r))}</span></button>`).join('')}</div>`:''}
   <table class="scale-calendar"><caption class="sr-only">${escape(title)} — semanas de domingo a sábado, com faixas de anciãos da semana</caption><thead><tr>${['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'].map(d=>`<th scope="col"><abbr title="${d}">${d.slice(0,3)}</abbr></th>`).join('')}</tr></thead>${weeks}</table>
   <p class="scale-result" role="status" aria-live="polite">${pointCount} escalas pontuais e ${monthly.length-pointCount} períodos de anciãos neste mês com os filtros aplicados.</p></section>
   <section class="panel" id="scale-selected" tabindex="-1" aria-labelledby="scale-selected-title"><h2 id="scale-selected-title">Escalas de ${dateText(ui.day)}</h2>${list(selected,'Nenhuma escala corresponde aos filtros nesta data.')}</section>
   <div class="scale-overview"><section class="panel"><h2>Próximas escalas</h2><p class="muted">A partir de ${dateText(dayNow())}${window.IASDPIScheduleUI?.isReview()?'':', com os filtros aplicados; inclui períodos em andamento.'}</p>${list(filtered.filter(r=>(r.endDate||r.date)>=dayNow()).slice(0,6),'Não há próximas escalas informadas com estes filtros.')}</section>
   <section class="panel"><h2>Departamentos</h2><p>${escape(departments().filter(active).join(' · ')||'Nenhum selecionado')}</p><h2>Pessoas escaladas</h2><p>${escape([...new Set(monthly.map(r=>r.person).filter(Boolean))].join(' · ')||'Nenhuma na escala informada neste filtro')}</p><h2>Funções ainda sem responsável</h2>${list(missing,'Nenhuma função sem responsável foi informada nesta seleção.')}${window.IASDPIScheduleUI?.isReview()?'':'<p class="muted">Funções ausentes da fonte não são inferidas.</p>'}</section></div>`;
 }
 function mount(){
  window.IASDPIScheduleUI?.mount();
  const extras=departments().filter(d=>!Object.hasOwn(colors,d));
  document.querySelectorAll('[data-scale-color]').forEach(el=>{const d=el.dataset.scaleColor,[bg,fg]=colors[d]||[`hsl(${(extras.indexOf(d)*137.508+24)%360} 65% 91%)`,'#24313b'];el.style.backgroundColor=el.matches('.scale-filter[aria-pressed="false"]')?'#fff':el.dataset.scaleKind==='weekly'?'#f2e1aa':bg;el.style.color=fg;el.style.borderColor=fg;});
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
 function redraw(focus){if(state.page!=='schedule-calendar')return;render();mount();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
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
 function show({month,department}){changeMonth(month);ui.departments=department?new Set([department]):null;ui.person='all';}
 return {page,mount,legacy,data,periods,segments,monthDays,dayNow,show};
})();
