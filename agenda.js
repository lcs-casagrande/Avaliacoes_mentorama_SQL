'use strict';
const agendaInitialDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const agendaState={month:agendaInitialDate.slice(0,7),area:'church',department:'all',view:'calendar',showPeople:true,day:agendaInitialDate};
const ministrySchedules={'Comunicação':[
  {date:'2026-10-03',person:'Henrique'},{date:'2026-10-10',person:'Izabelle PI Souza'},
  {date:'2026-10-17',person:'Simone/Profªde Pilates 🧘'},{date:'2026-10-24',person:'macedo Logos'},
  {date:'2026-10-31',person:'Letícia PI'}
], 'Sonoplastia':[]};
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
  return `<ul class="church-events">${events.map(e=>`<li><div class="church-event-date"><span>${esc(agendaPeriod(e))}</span><strong>${e.allDay||e.wholeDay?'Dia inteiro':esc(clock(e.start)+' → '+clock(e.end))}</strong></div><div class="church-event-body"><h3>${esc(e.title)}</h3><p>${esc(e.department || 'Departamento não informado')}${e.location?' · '+esc(e.location):''}</p>${e.sourceIds.length>1?`<small class="muted">Período agrupado · ${e.sourceIds.length} registros da fonte preservados</small>`:''}<div class="agenda-flags">${agendaIssues(e,allMonth).map(flag=>`<span class="badge warning">${esc(flag)}</span>`).join('')}</div></div></li>`).join('')}</ul>`;
}
function agendaResponsibles(start,end){
  const month=agendaSource().events.filter(e=>e.kind==='monthly'&&agendaOverlaps(e,start,end));
  const weekly=agendaSource().events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start));
  const selected=weekly.filter(e=>agendaOverlaps(e,agendaState.day,agendaState.day));
  const names=e=>agendaState.showPeople?esc(e.person):'Escala definida';
  return `<section class="agenda-responsibles" aria-label="Anciãos responsáveis"><div class="panel"><p class="eyebrow">ANCIÃO DO MÊS</p>${month.length?month.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado no calendário para este mês.</p>'}</div><div class="panel"><p class="eyebrow">ANCIÃO DA SEMANA · DATA SELECIONADA</p>${selected.length?selected.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado para a data selecionada.</p>'}</div></section>
  <details class="panel agenda-weeks" ${agendaState.month!==today().slice(0,7)?'open':''}><summary>Escalas semanais do mês · ${weekly.length}</summary>${weekly.length?`<ul>${weekly.map(e=>`<li><strong>${names(e)}</strong><span>${esc(agendaPeriod(e))}</span></li>`).join('')}</ul>`:'<p class="muted">Nenhuma escala semanal neste período.</p>'}</details>`;
}
function agendasPage(){
  const {month,area,department,view,day,showPeople}=agendaState,[start,end]=agendaMonthBounds(month);
  const source=agendaSource(),allMonth=agendaEvents().filter(e=>agendaOverlaps(e,start,end));
  const events=allMonth.filter(e=>department==='all'||e.department===department);
  const departments=[...new Set(agendaSource().events.filter(e=>e.kind==='event').map(e=>e.department||'Não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const ministry=area==='communication'?'Comunicação':'Sonoplastia',scale=area==='church'?[]:ministrySchedules[ministry].filter(e=>e.date.startsWith(month));
  const monthDate=new Date(start+'T12:00:00Z'),monthTitle=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthDate);
  const current=new Date(currentTime()),syncTime=source.syncedAt?new Date(source.syncedAt):null;
  const stale=syncTime && current-syncTime>86400000;
  return heading('ORGANIZAÇÃO','Escalas e agendas','Anciãos, programação da igreja e escalas dos ministérios.')+
    `<p class="agenda-source muted" role="status">${source.status==='synced'?`Fonte oficial consultada em ${esc(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(syncTime))}.${stale?' A última sincronização tem mais de 24 horas.':''}`:'Aguardando sincronização com o calendário oficial.'} <a href="https://iasd-paradainglesa.netlify.app/" target="_blank" rel="noopener noreferrer">Consultar fonte oficial ↗</a></p>${source.fromMonth && (month<source.fromMonth||month>source.toMonth)?'<p class="form-note">Este mês está fora do período importado. Uma nova sincronização é necessária para verificar os registros.</p>':''}
    <section class="panel agenda-filters"><label for="agenda-area">Consultar<select id="agenda-area"><option value="church" ${area==='church'?'selected':''}>Agenda da igreja</option><option value="communication" ${area==='communication'?'selected':''}>Escala de Comunicação</option><option value="sound" ${area==='sound'?'selected':''}>Escala de Sonoplastia</option></select></label>${area==='church'?`<label for="agenda-department">Departamento<select id="agenda-department"><option value="all">Todos os departamentos</option>${departments.map(name=>`<option value="${esc(name)}" ${name===department?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`:''}<label class="checkbox"><input id="agenda-show-people" type="checkbox" ${showPeople?'checked':''}> Mostrar pessoa escalada</label></section>
    <section class="panel agenda-toolbar"><div class="agenda-month"><button type="button" data-action="agenda-previous" aria-label="Mês anterior">‹</button><h2 id="agenda-month-title">${esc(monthTitle)}</h2><button type="button" data-action="agenda-next" aria-label="Próximo mês">›</button></div><div class="agenda-controls"><label for="agenda-month-picker">Mês e ano<input id="agenda-month-picker" type="month" value="${month}"></label>${button('Mês atual','agenda-current')}<div class="agenda-view" aria-label="Visualização">${button('Calendário','agenda-calendar','','aria-pressed="'+(view==='calendar')+'"')}${button('Lista','agenda-list','','aria-pressed="'+(view==='list')+'"')}</div></div></section>
    ${area==='church'?agendaResponsibles(start,end):''}
    ${view==='calendar'?`<section class="agenda-calendar" aria-label="Calendário de ${esc(monthTitle)}"><div class="calendar-weekdays" aria-hidden="true">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days">${Array.from({length:monthDate.getUTCDay()},()=>'<span aria-hidden="true"></span>').join('')}${Array.from({length:Number(end.slice(-2))},(_,index)=>{
      const date=month+'-'+String(index+1).padStart(2,'0'),appointments=events.filter(e=>agendaOverlaps(e,date,date)),entry=scale.find(e=>e.date===date);
      const count=area==='church'?appointments.length:entry?1:0;
      return `<button type="button" class="calendar-day ${count?'scheduled':''} ${date===day?'selected-day':''}" data-action="agenda-day" data-id="${date}" aria-pressed="${date===day}" ${date===today()?'aria-current="date"':''} aria-label="${esc(programDate(date))} · ${count} ${area==='church'?'eventos':'escalas'}"><span class="calendar-number">${index+1}</span>${area==='church'?appointments.length?`<span class="calendar-person">${appointments.length} evento${appointments.length>1?'s':''}</span><span class="calendar-event-title">${esc(appointments[0].title)}${appointments[0].startDate!==date?' · continuação':''}</span>`:'':entry?`<span class="calendar-person">${showPeople?esc(entry.person):'Escala definida'}</span>`:''}</button>`;
    }).join('')}</div></section>`:''}
    <section class="section"><div class="section-heading"><h2>${area==='church'?view==='calendar'?'Eventos · '+esc(programDate(day)):'Programação da igreja':`Escala de ${esc(ministry)}`}</h2><span class="muted">${area==='church'?events.length+' eventos no mês':scale.length+' datas com escala'}</span></div>${area==='church'?agendaEventList(view==='calendar'?events.filter(e=>agendaOverlaps(e,day,day)):events,allMonth):scale.length?`<ul class="agenda-list">${scale.map(e=>`<li><button type="button" data-action="agenda-day" data-id="${e.date}"><span>${esc(programDate(e.date))}</span><strong>${showPeople?esc(e.person):'Escala definida'}</strong></button></li>`).join('')}</ul>`:empty('Nenhuma escala cadastrada neste mês',`Ainda não há nomes informados para ${esc(ministry)} neste período.`)}</section>`;
}
function selectAgendaMonth(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês e ano válidos.');
  agendaState.month=month;agendaState.day=month===today().slice(0,7)?today():month+'-01';render();
}
function changeAgendaMonth(amount){const date=new Date(agendaState.month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+amount);selectAgendaMonth(date.toISOString().slice(0,7));document.querySelector(`[data-action="${amount>0?'agenda-next':'agenda-previous'}"]`).focus();}
