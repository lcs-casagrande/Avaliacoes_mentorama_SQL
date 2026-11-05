'use strict';
// G4: integra contexto ministerial; todas as autorizações continuam no servidor.
window.IASDPIPortalAccess=(()=>{
 const enabled=()=>window.IASDPIConfig?.portalAccessEnabled===true,h=v=>esc(v);
 const s={phase:'idle',catalog:null,churches:[],error:'',token:null,church:'',generation:0,preferred:''};let loading=null;
 const feeds=new Map();const church=()=>window.IASDPIChurches?.selected()||'IASD_PI';
 const memberPages=new Set(['schedule-build','schedule-setup','schedule-members','schedule-settings','access-admin','access-audit','users','events']);
 const publicPages=new Set(['church-home','agendas','organization','schedule-calendar','portal-login','access-request']);
 const redraw=()=>{if(enabled()&&typeof render==='function')render();};
 async function rpc(name,args={},identity){const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})},body:JSON.stringify(args)});if(identity&&!IASDPIAuth.identityCurrent(identity.token))throw Error('Sessão ou igreja alterada.');return result;}
 async function ensure(){if(loading)return loading;const ticket=s.generation;s.phase='loading';loading=(async()=>{try{
  const identity=await IASDPIAuth.requireIdentity(),churches=await rpc('iasdpi_my_churches',{},identity);
  if(!Array.isArray(churches))throw Error('Resposta de igrejas inválida.');if(ticket!==s.generation)return;s.churches=churches;if(!churches.some(c=>c.code===church()))throw Error('Esta identidade não possui acesso à igreja selecionada.');
  const catalog=await rpc('iasdpi_portal_context',{},identity);if(!catalog||!Array.isArray(catalog.departments)||typeof catalog.is_admin!=='boolean')throw Error('Resposta de permissões inválida.');
  if(ticket!==s.generation)return;s.catalog=catalog;s.churches=churches;s.token=identity.token;s.church=church();s.phase='ready';s.error='';if(!IASDPIAuth.allowed())IASDPIAuth.scopeValidated();
  window.dispatchEvent(new Event('iasdpi-portal-context'));
 }catch(e){if(ticket===s.generation){s.phase='error';s.catalog=null;s.token=null;s.error=e.message;}}finally{if(ticket===s.generation){loading=null;redraw();}}})();return loading;}
 function valid(){return s.phase==='ready'&&s.church===church()&&IASDPIAuth.identityCurrent(s.token);}
 function departments(){return valid()?s.catalog.departments.filter(d=>d.active).slice().sort((a,b)=>Number(Boolean(b.can_edit||b.can_publish||b.can_manage_members))-Number(Boolean(a.can_edit||a.can_publish||a.can_manage_members))||a.name.localeCompare(b.name,'pt-BR')):[];}
 function can(page){if(!valid())return false;if(page==='events')return s.catalog.is_admin||departments().some(d=>d.can_edit||d.can_publish);if(['access-admin','access-audit','users'].includes(page)&&window.IASDPIConfig?.governanceAdministrationEnabled)return s.catalog.is_admin;if(['access-admin','access-audit','users','events'].includes(page))return s.catalog.is_admin||departments().some(d=>d.can_manage_access||d.can_handle_requests||d.can_manage_members);if(page==='schedule-members')return s.catalog.is_admin||(window.IASDPIRegistry?.enabled()&&departments().some(d=>d.can_manage_members));if(page==='schedule-settings')return s.catalog.is_admin;return departments().length>0;}
 function switcher(){return s.churches.length&&(s.churches.length>1||!s.churches.some(c=>c.code===church()))?`<label>Igreja autorizada<select id="portal-church">${!s.churches.some(c=>c.code===church())?'<option value="">Escolha uma igreja autorizada</option>':''}${s.churches.map(c=>`<option value="${h(c.code)}" ${c.code===church()?'selected':''}>${h(c.name)}</option>`).join('')}</select></label>`:'';}
 function loginPage(){return heading('ACESSO MINISTERIAL',window.IASDPIEvents?.enabled()?'Entrar no IASDPI':'Entrar para gerenciar escalas',IASDPIChurches.current()?.name||'Selecione a igreja e entre com sua identidade autorizada.')+`<section class="panel auth-panel">${s.error?`<p role="alert">${h(s.error)}</p><button type="button" data-portal-retry>Tentar novamente</button>`:''}<form id="portal-login-form">${IASDPIChurches.loginSelector()}${IASDPIAuth.loginIdentifierField()}${field('Senha','password','','password',true,'autocomplete="current-password"')}${IASDPIAuth.rememberField()}<button type="submit" class="primary">Entrar</button><p role="status" data-portal-feedback></p></form><p><a href="#access-request" data-page="access-request">Solicitar acesso ou recuperação</a></p><p><a href="#login" data-page="login">Entrar na Cronoanálise</a></p></section>`;}
 function guard(page){if(!enabled()||!memberPages.has(page))return null;if(s.phase==='ready'&&!valid())s.phase='idle';if(s.phase==='idle'){queueMicrotask(ensure);return '<p role="status">Recuperando acesso ministerial…</p>';}if(s.phase==='loading')return '<p role="status">Verificando permissões da igreja…</p>';if(!valid())return loginPage();if(!can(page))return `<section class="panel"><h1>Acesso restrito</h1><p>Você não possui autorização para esta área na igreja selecionada.</p><a href="#church-home" data-page="church-home">Voltar ao início</a></section>`;return null;}
 function workspace(){if(!enabled()||!valid())return '';const selector=switcher();return selector?`<section class="portal-workspace" aria-label="Igreja selecionada">${selector}</section>`:'';}
 function feedKey(month){return church()+':'+month+(window.IASDPIConfig?.calendarPrivacyEnabled?':'+(IASDPIAuth.identityKey()||'public'):'');}
 function feed(month){const key=feedKey(month);if(!feeds.has(key)){feeds.set(key,{phase:'loading',rows:[],error:''});queueMicrotask(()=>refreshFeed(month));}return feeds.get(key);}
 async function refreshFeed(month){const key=feedKey(month);feeds.set(key,{phase:'loading',rows:[],error:''});try{
  if(window.IASDPIConfig?.remoteDisabled===true)throw Error('Conexão preparada; acesso remoto ainda desativado.');
  const cfg=IASDPIAuth.config(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let result;
  const identity=window.IASDPIConfig?.calendarPrivacyEnabled&&IASDPIAuth.identityKey()?await IASDPIAuth.requireIdentity():null;
  try{const response=await fetch(cfg.url+'/rest/v1/rpc/'+(identity?'iasdpi_schedule_visible':'iasdpi_schedule_published'),{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json','x-iasdpi-church':key.split(':')[0],...(identity?{Authorization:'Bearer '+identity.token}:{})},body:JSON.stringify({p_month:month+'-01'}),signal:controller.signal});if(!response.ok)throw Error('Não foi possível carregar as escalas publicadas.');result=await response.json();}finally{clearTimeout(timer);}
  if(!Array.isArray(result)||result.some(r=>!r||typeof r.id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||typeof r.person!=='string'||typeof r.department!=='string'||!['Escala publicada no sistema','Histórico manual confirmado'].includes(r.origin)))throw Error('Resposta pública inválida.');
  if(key!==feedKey(month)||identity&&!IASDPIAuth.identityCurrent(identity.token))return;feeds.set(key,{phase:'ready',rows:result,error:''});
 }catch(e){feeds.set(key,{phase:'error',rows:[],error:e.name==='AbortError'?'A consulta demorou demais. Tente novamente.':e.message});}finally{if((state.page==='schedule-calendar'||window.IASDPIConfig?.calendarPrivacyEnabled&&state.page==='agendas')&&key===feedKey(month))redraw();}}
 function feedRows(month){return enabled()?feed(month).rows:[];}
 function feedStatus(month){if(!enabled())return '';const f=feed(month),pending=f.rows.filter(r=>r.pending).reduce((sum,r)=>sum+(r.vacancy_count||1),0);return `<div class="portal-feed-state" role="${f.phase==='error'?'alert':'status'}">${f.phase==='loading'?'Carregando escalas publicadas…':f.phase==='error'?h(f.error)+` <button data-portal-feed="${h(month)}">Tentar novamente</button>`:f.rows.length?(pending?f.rows.length+' registros publicados · '+pending+' '+(pending===1?'vaga a definir.':'vagas a definir.'):f.rows.length+' atribuições publicadas neste mês.'):'Nenhuma escala administrada publicada neste mês. As fontes históricas continuam abaixo.'}</div>`;}
 function clear(){feeds.clear();s.generation++;s.phase='idle';s.catalog=null;s.token=null;s.churches=[];s.preferred='';loading=null;}
 for(const event of ['iasdpi-identity-ended','iasdpi-auth-changed','iasdpi-role-changed'])window.addEventListener(event,clear);
 window.addEventListener('iasdpi-schedule-published',()=>{feeds.clear();});
 window.addEventListener('iasdpi-registry-saved',()=>{feeds.clear();});
 document.addEventListener('click',e=>{if(!enabled())return;if(e.target.closest('[data-portal-retry]')){e.preventDefault();void ensure();redraw();return;}const pageLink=e.target.closest('#app a[data-page]');if(pageLink){e.preventDefault();navigate(pageLink.dataset.page);return;}const retry=e.target.closest('[data-portal-feed]'),department=e.target.closest('[data-portal-department]');if(retry){e.preventDefault();void refreshFeed(retry.dataset.portalFeed);redraw();}if(department){e.preventDefault();if(!departments().some(d=>d.id===department.dataset.portalDepartment))return;if(!canLeaveRegistration())return;s.preferred=department.dataset.portalDepartment;void IASDPIScheduleManagement.load();navigate('schedule-build');}},true);
 document.addEventListener('change',e=>{if(!enabled()||e.target.id!=='portal-church')return;const code=e.target.value;if(!s.churches.some(c=>c.code===code)||!canLeaveRegistration()){e.target.value=church();return;}try{IASDPIChurches.switchAuthorized(code);}catch(error){s.error=error.message;s.phase='error';redraw();}});
 document.addEventListener('submit',e=>{if(!enabled()||e.target.id!=='portal-login-form')return;e.preventDefault();e.stopImmediatePropagation();const f=e.target,password=f.elements.password.value;f.elements.password.value='';const button=f.querySelector('button[type=submit]'),feedback=f.querySelector('[data-portal-feedback]');button.disabled=true;feedback.textContent='Confirmando identidade…';void(async()=>{await IASDPIAuth.loginIdentity(f.elements.email.value,password,{remember:f.elements.remember.checked,church:f.elements.church?.value});await ensure();if(valid()){if(state.page==='portal-login')navigate('schedule-build');else redraw();}})().catch(error=>{s.generation++;loading=null;s.phase='error';s.catalog=null;s.error=error.message;redraw();}).finally(()=>{button.disabled=false;});},true);
 return {enabled,can,guard,ensure,departments,workspace,valid,status:()=>s.phase,isAdmin:()=>valid()&&s.catalog.is_admin,preferred:()=>{const d=s.preferred;s.preferred='';return d;},isPublic:page=>publicPages.has(page)||memberPages.has(page),loginPage,feedRows,feedStatus,refreshFeed};
})();

// Organização visual do portal. As rotas e as autorizações permanecem nos módulos.
window.IASDPIPortalNavigation=(()=>{
 const crono=new Set(['home','programs','edit','plan-edit','actuals','tracking','summary','history','archive','models','trash','login','forgot-password','reset-password','invite']);
 const administration=new Set(['schedule-members','schedule-setup','schedule-settings','access-admin','access-audit','access-request','users','models','archive','trash']);
 let shell=null;
 const anchor=(page,label)=>`<a href="#${page}" data-portal-route="${page}">${esc(label)}</a>`;
 function module(page){if(page==='agendas'||page==='schedule-calendar')return 'schedule-calendar';if(administration.has(page))return 'administration';if(crono.has(page))return 'home';if(page==='schedule-build')return 'schedule-build';return page;}
 function install(){
  const header=document.querySelector('.header'),nav=header.querySelector('nav'),links=new Map([...nav.querySelectorAll('a[data-page]')].map(a=>[a.dataset.page,a])),logout=document.getElementById('auth-logout');
  const create=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;return el;},primary=create('div','portal-primary-links'),legacy=create('span','portal-legacy-links');legacy.hidden=true;
  if(!links.has('access-audit')){const a=create('a','');a.href='#access-audit';a.dataset.page='access-audit';a.textContent='Auditoria';links.set('access-audit',a);}
  const admin=create('details','portal-admin-menu'),summary=create('summary','');summary.textContent='Administração';admin.append(summary);
  const groups=create('div','portal-admin-links');admin.append(groups);
  for(const [title,pages] of [['Pessoas e equipes',['schedule-members','schedule-setup']],['Governança',['schedule-settings','access-admin','access-audit','users','access-request']],['Registros da Cronoanálise',['models','history','archive','trash']]]){
   const section=create('section','portal-admin-group'),heading=create('h2','');heading.textContent=title;section.append(heading);groups.append(section);
   for(const page of pages)if(links.has(page))section.append(links.get(page));
  }
  const labels={'church-home':'Início','schedule-calendar':'Calendário','schedule-build':'Escalas',events:'Eventos',organization:'Organograma',home:'Cronoanálise','portal-login':'Entrar','schedule-members':'Cadastro Geral','schedule-setup':'Departamentos e funções','schedule-settings':'Configurações de escalas','access-admin':'Usuários e Acessos','access-audit':'Auditoria','access-request':'Solicitações e recuperação',models:'Modelos de liturgia',history:'Histórico de cultos',archive:'Arquivos e backups',trash:'Lixeira',users:'Usuários da Cronoanálise'};
  for(const page of ['church-home','schedule-calendar','schedule-build','events','organization','home','portal-login'])if(links.has(page))primary.append(links.get(page));
  const account=create('div','portal-account');account.setAttribute('aria-label','Conta conectada');account.innerHTML='<span class="portal-account-avatar" aria-hidden="true">●</span><span class="portal-account-identity"><strong data-account-label>Minha conta</strong><small data-account-church></small></span>';if(window.IASDPIConfig?.responsibilityGovernanceEnabled){const password=create('a','portal-account-password');password.href='#reset-password';password.dataset.authPage='reset-password';password.textContent='Alterar senha';account.append(password);}account.append(logout);
  for(const a of links.values())if(a.parentNode===nav)legacy.append(a);
  nav.replaceChildren(primary,admin,account,legacy);nav.id='portal-main-navigation';
  const toggle=create('button','portal-menu-toggle');toggle.type='button';toggle.textContent='Menu';toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');header.insertBefore(toggle,nav);
  header.classList.add('portal-header');document.body.classList.add('portal-navigation-ready');
  shell={header,nav,links,primary,admin,groups,account,logout,toggle,labels};return shell;
 }
 function sync(page){
  if(!window.IASDPIPortalAccess?.enabled())return;
  const n=shell||install(),portal=IASDPIPortalAccess,signed=Boolean(IASDPIAuth.identityKey()),admin=portal.isAdmin()||IASDPIAuth.isAdmin();
  if(signed&&portal.status()==='idle')queueMicrotask(()=>portal.ensure());
  for(const [page,a] of n.links){if(n.labels[page])a.textContent=n.labels[page];a.hidden=true;a.classList.remove('selected');a.removeAttribute('aria-current');}
  const show=page=>{const a=n.links.get(page);if(a)a.hidden=false;};
  for(const target of ['church-home','schedule-calendar','organization'])show(target);
  if(signed){if(portal.can('schedule-build'))show('schedule-build');if(window.IASDPIEvents?.enabled()&&portal.can('events'))show('events');show('home');}
  else show('portal-login');
  for(const page of ['schedule-members','schedule-setup','schedule-settings','access-admin'])if(portal.valid()&&portal.can(page))show(page);
  if(admin&&window.IASDPIConfig?.governanceAdministrationEnabled)show('access-audit');if(admin){for(const page of ['models','history','archive','trash','access-request'])show(page);if(!window.IASDPIGovernance?.enabled())show('users');}
  n.groups.querySelectorAll('section').forEach(s=>s.hidden=![...s.querySelectorAll('a')].some(a=>!a.hidden));
  n.admin.hidden=![...n.groups.querySelectorAll('a')].some(a=>!a.hidden);
  n.account.hidden=!signed;n.logout.hidden=!signed;
  n.account.querySelector('[data-account-label]').textContent=admin?'Administrador':'Minha conta';
  n.account.querySelector('[data-account-church]').textContent=IASDPIChurches.current()?.name||'IASD Parada Inglesa';
  n.header.querySelector('.brand').href='#church-home';n.header.querySelector('.brand small').textContent='Parada Inglesa';
  const active=!signed&&!['church-home','agendas','schedule-calendar','organization'].includes(page)?'portal-login':module(page),link=n.links.get(active);
  if(link&&!link.hidden){link.classList.add('selected');link.setAttribute('aria-current','page');}
  if(active==='administration'&&!n.admin.hidden)n.admin.querySelector('summary').setAttribute('aria-current','page');else n.admin.querySelector('summary').removeAttribute('aria-current');
  for(const a of n.groups.querySelectorAll('a'))if(a.dataset.page===page){a.classList.add('selected');a.setAttribute('aria-current','page');}
 }
 function context(page){
  if(!window.IASDPIPortalAccess?.enabled())return;
  let content='';
  if(crono.has(page)&&IASDPIAuth.allowed())content=`<nav class="portal-context-nav" aria-label="Cronoanálise">${[['home','Visão geral'],['programs','Programações'],['actuals','Registrar culto'],['tracking','Acompanhar'],['history','Histórico']].map(([target,label])=>anchor(target,label)).join('')}</nav>`;
  if(administration.has(page)&&page!=='access-request')content=`<div class="portal-breadcrumb">${anchor('church-home','Início')}<span aria-hidden="true">/</span><span>Administração</span></div>`+content;
  if(content){app.insertAdjacentHTML('afterbegin',content);const target=page==='summary'?'history':['edit','plan-edit'].includes(page)?'programs':page;app.querySelectorAll('[data-portal-route]').forEach(a=>{if(a.dataset.portalRoute===target)a.setAttribute('aria-current','page');});}
 }
 function close(){if(!shell)return;shell.header.dataset.menuOpen='false';shell.toggle.setAttribute('aria-expanded','false');shell.header.querySelectorAll('details').forEach(d=>d.open=false);}
 document.addEventListener('click',e=>{
  if(!window.IASDPIPortalAccess?.enabled())return;
  if(e.target.closest('.portal-menu-toggle')){const open=shell.header.dataset.menuOpen!=='true';shell.header.dataset.menuOpen=String(open);shell.toggle.setAttribute('aria-expanded',String(open));return;}
  const route=e.target.closest('[data-portal-route]');if(route){e.preventDefault();openNavigation(route.dataset.portalRoute);close();return;}
  if(e.target.closest('.portal-header a[data-page],#auth-logout'))close();
  else if(shell&&!e.target.closest('.portal-header'))shell.header.querySelectorAll('details').forEach(d=>d.open=false);
 });
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!shell)return;const details=e.target.closest('.portal-header details[open]');if(details){details.open=false;details.querySelector('summary').focus();e.preventDefault();}else if(shell.header.dataset.menuOpen==='true'){close();shell.toggle.focus();e.preventDefault();}});
 return {sync,context,module};
})();
