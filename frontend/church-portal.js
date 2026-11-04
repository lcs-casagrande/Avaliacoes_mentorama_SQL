'use strict';
// Portal público da homologação. A cronoanálise continua no módulo oficial autenticado.
window.IASDPIChurchPortal=(()=>{
 const integrated=()=>window.IASDPIPortalAccess?.enabled();
 const cronoUrl='https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/#home';
 const h=value=>esc(value),zone='America/Sao_Paulo';
 const link=(page,label,extra='')=>`<a href="#${page}" ${integrated()?'data-page':'data-demo-view'}="${page}" ${extra}>${h(label)}</a>`;
 const crono=(label='Abrir cronoanálise')=>`<a class="schedule-secondary" href="${integrated()?'#home':cronoUrl}" ${integrated()?'data-page="home"':'target="_blank" rel="noopener noreferrer"'} aria-label="${h(label+' · acesso com login'+(integrated()?'':', abre em outra aba'))}">${h(label)} <svg class="portal-external-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
 const group=page=>page.startsWith('schedule-')?'schedule-calendar':page;
 function home(){
  if(integrated())return portalHome();
  const other=integrated()&&IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI';
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date()),events=(other?[]:agendaEvents()).filter(e=>e.endDate>=today).slice(0,4);
  return (integrated()?IASDPIPortalAccess.workspace():'')+heading('IGREJA ADVENTISTA DO SÉTIMO DIA',integrated()?(IASDPIChurches.current()?.name||'IASD Parada Inglesa'):'Parada Inglesa','Agenda e ministérios.')+`<section class="church-portal-cards" aria-label="Áreas da igreja"><article class="panel"><h2>Escalas</h2><p>Equipes e responsabilidades.</p>${link('schedule-calendar','Ver escalas','class="schedule-secondary"')}${link('schedule-build','Montar escala','class="church-inline-link"')}</article><article class="panel"><h2>Organograma</h2><p>Ministérios e responsáveis.</p>${link('organization','Ver organograma','class="schedule-secondary"')}</article><article class="panel"><h2>Agenda</h2><p>Compromissos da igreja.</p>${link('agendas','Ver agenda','class="schedule-secondary"')}</article><article class="panel"><h2>Cronoanálise <span class="badge neutral">Com login</span></h2><p>Programação e horários dos cultos.</p>${crono()}</article></section><section class="panel"><div class="section-heading"><h2>Próximos compromissos</h2>${link('agendas','Ver agenda')}</div>${agendaSource().status==='synced'?(events.length?`<ul class="portal-upcoming">${events.map(e=>`<li><time datetime="${h(e.startDate)}">${h(displayDate(e.startDate))}</time><span>${h(e.title)}</span></li>`).join('')}</ul>`:'<p>Nenhum compromisso futuro nesta cópia da agenda.</p>'):'<p role="status">A agenda não está disponível nesta cópia.</p>'}</section>`;
 }
 function portalHome(){
  const access=IASDPIPortalAccess,other=IASDPIChurches.selected()&&IASDPIChurches.selected()!=='IASD_PI',today=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date()),events=(other?[]:agendaEvents()).filter(e=>e.endDate>=today).slice(0,4);
  const card=(title,text,page,label,cls='')=>`<article class="portal-home-card ${cls}"><h2>${h(title)}</h2><p>${h(text)}</p>${link(page,label,'class="'+(cls?'primary portal-home-action':'church-inline-link')+'"')}</article>`;
  return heading('IASD PARADA INGLESA','A vida da igreja, em um só lugar.','Consulte a programação e acompanhe os ministérios.')+`<section class="church-portal-cards portal-home-grid" aria-label="Áreas da igreja">${card('Calendário','Eventos e escalas publicadas, organizados por dia.','schedule-calendar','Ver calendário','portal-home-featured')}${card('Organograma','Conheça os ministérios, responsáveis e equipes.','organization','Conhecer os ministérios')}${access.valid()?`${access.can('schedule-build')?card('Escalas','Monte as equipes e revise as escalas antes de publicar.','schedule-build','Montar escala'):''}${window.IASDPIEvents?.enabled()&&access.can('events')?card('Eventos','Organize os eventos da igreja e dos departamentos.','events','Gerenciar eventos'):''}${card('Cronoanálise','Planejamento, registro e acompanhamento dos cultos.','home','Abrir Cronoanálise')}`:''}</section><section class="panel portal-next-events"><div class="section-heading"><h2>Próximas programações</h2>${link('schedule-calendar','Ver calendário')}</div>${agendaSource().status==='synced'?(events.length?`<ul class="portal-upcoming">${events.map(e=>`<li><time datetime="${h(e.startDate)}">${h(displayDate(e.startDate))}</time><span>${h(e.title)}</span></li>`).join('')}</ul>`:'<p>Nenhuma programação futura nesta cópia da agenda.</p>'):'<p role="status">A agenda não está disponível nesta cópia.</p>'}</section>`;
 }
 function moduleNav(page){return `<nav class="portal-module-nav" aria-label="Área de escalas">${[['schedule-build','Montar escala'],['schedule-calendar','Calendário'],['schedule-members','Cadastro Geral'],['schedule-setup','Cadastros'],['schedule-settings','Configurações']].map(([target,label])=>`<button type="button" data-demo-view="${target}" ${page===target?'aria-current="page"':''}>${h(label)}</button>`).join('')}</nav>`;}
 function page(page){
  if(page==='church-home')return home();
  if(page==='organization')return organizationPage();
  if(page==='agendas')return agendasPage();
  const content=page==='schedule-build'?IASDPIScheduleManagement.page():['schedule-members','schedule-settings'].includes(page)?IASDPIScheduleDailyAdmin.page(page):page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page();
  return moduleNav(page)+content;
 }
 function agendaProvenance(area,source){
  const manual=['communication','sound'].includes(area),department=area==='communication'?'Comunicação':'Sonoplastia',dates=manual?ministrySchedules[department].map(e=>e.date).sort():[];
  const title=manual?'Escala manual de '+department:'Agenda oficial · cópia publicada';
  const description=manual?'Informação fornecida pela liderança, sem sincronização automática. Vigência: '+displayDate(dates[0])+' a '+displayDate(dates.at(-1))+'.':(source.status==='synced'?'Fonte consultada em '+displayRecordTimestamp(source.syncedAt)+'.':'Fonte ainda não disponível.')+' Abrir esta página não atualiza o calendário de origem.';
  return `<section class="portal-source" aria-label="Fonte da agenda" data-source="${manual?'manual':'official'}"><span>${h(title)}</span>${IASDPIScheduleUI.help('portal-agenda-source',description,'Origem das informações da agenda')}</section>`;
 }
 document.addEventListener('click',e=>{
  if(integrated()||!window.IASDPISchedulePreview||state.page!=='agendas')return;const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!action.startsWith('agenda-'))return;e.preventDefault();
  if(action==='agenda-current')selectAgendaMonth(today().slice(0,7));
  else if(['agenda-calendar','agenda-list'].includes(action)){agendaState.view=action==='agenda-calendar'?'calendar':'list';render();}
  else if(['agenda-previous','agenda-next'].includes(action)){changeAgendaMonth(action==='agenda-next'?1:-1);return;}
  else if(action==='agenda-day'){agendaState.day=button.dataset.id;render();document.querySelector('.calendar-day[data-id="'+agendaState.day+'"]')?.focus();return;}
  document.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
 });
 document.addEventListener('change',e=>{
  if(integrated()||!window.IASDPISchedulePreview||state.page!=='agendas'||!['agenda-area','agenda-department','agenda-show-people','agenda-month-picker'].includes(e.target.id))return;
  const id=e.target.id;if(id==='agenda-area')agendaState.area=e.target.value;else if(id==='agenda-department')agendaState.department=e.target.value;else if(id==='agenda-show-people')agendaState.showPeople=e.target.checked;else selectAgendaMonth(e.target.value);
  render();document.getElementById(id)?.focus({preventScroll:true});
 });
 return {home,page,group,agendaProvenance,cronoUrl};
})();
