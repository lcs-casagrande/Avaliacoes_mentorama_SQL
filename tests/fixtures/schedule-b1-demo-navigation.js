'use strict';
// Navegação do host estático de demonstração; não substitui a navegação do site.
(()=>{
 const pages=new Set(['schedule-build','schedule-calendar','schedule-setup']);
 let current={page:pages.has(location.hash.slice(1))?location.hash.slice(1):'schedule-build',position:0},restoring=false;
 const allowed=()=>IASDPISchedules.canLeave()&&IASDPIScheduleManagement.canLeave();
 function syncHeader(){
  document.querySelectorAll('.schedule-primary-nav [data-demo-view]').forEach(button=>{if(button.dataset.demoView===(window.IASDPIChurchPortal?IASDPIChurchPortal.group(current.page):current.page))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  const more=document.querySelector('.schedule-nav-more');if(more){more.open=false;const summary=more.querySelector('summary');if(window.IASDPIChurchPortal?current.page==='agendas':['schedule-setup','schedule-settings'].includes(current.page))summary.setAttribute('aria-current','page');else summary.removeAttribute('aria-current');}
 }
 function display(page){state.page=page;if(page==='schedule-build')void IASDPIScheduleManagement.load();else render();syncHeader();document.querySelector('#app').focus();}
 history.replaceState({demoPosition:0},'','#'+current.page);state.page=current.page;syncHeader();
 document.addEventListener('keydown',e=>{const more=document.querySelector('.schedule-nav-more[open]');if(e.key==='Escape'&&more){more.open=false;more.querySelector('summary').focus();e.preventDefault();}});
 document.addEventListener('focusout',e=>{const more=e.target.closest('.schedule-nav-more');if(more&&e.relatedTarget&&!more.contains(e.relatedTarget))more.open=false;});
 document.addEventListener('click',e=>{
  if(!e.target.closest('.schedule-nav-more')){const more=document.querySelector('.schedule-nav-more');if(more)more.open=false;}
  const el=e.target.closest('[data-demo-view], [data-calendar-nav], [data-b1-nav]');if(!el)return;e.preventDefault();
  const page=el.dataset.demoView||el.dataset.b1Nav||el.getAttribute('href')?.slice(1)||'schedule-setup';
  if(!pages.has(page)||page===current.page||!allowed())return;
  if(page==='schedule-calendar'&&el.dataset.scheduleMonth)IASDPIScheduleCalendar.show({month:el.dataset.scheduleMonth,department:el.dataset.scheduleDepartment});
  current={page,position:current.position+1};history.pushState({demoPosition:current.position},'','#'+page);display(page);
 });
 window.addEventListener('popstate',e=>{
  if(restoring){restoring=false;return;}
  const page=location.hash.slice(1),known=Number.isInteger(e.state?.demoPosition),position=known?e.state.demoPosition:current.position+1;
  if(!pages.has(page))return;
  if(!allowed()){restoring=true;history.go(current.position-position);return;}
  if(!known)history.replaceState({demoPosition:position},'','#'+page);
  current={page,position};display(page);
 });
})();
