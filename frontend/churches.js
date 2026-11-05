'use strict';
// Seleção pública de contexto, nunca de autorização. Ativar somente após 011.
window.IASDPIChurches=(()=>{
 const enabled=()=>window.IASDPIConfig?.churchIsolationEnabled===true;
 const original='IASD_PI',namespace=window.IASDPIConfig?.storageNamespace||'',key=(namespace?namespace+':':'')+'iasdpi-selected-church-v1';
 let rows=[],phase='idle',message='',loading=null;
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function selected(){if(!enabled())return original;try{const code=sessionStorage.getItem(key)||'';return /^[A-Z][A-Z0-9_]{2,39}$/.test(code)?code:'';}catch(_){return '';}}
 const ready=()=>!enabled()||(phase==='ready'&&rows.some(c=>c.code===selected()));
 const current=()=>rows.find(c=>c.code===selected())||null;
 function headers(){if(!enabled())return {};if(!ready())throw Error('Selecione uma igreja autorizada antes de continuar.');return {'x-iasdpi-church':selected()};}
 function storageScope(name){const code=selected();return enabled()&&code&&code!==original?'church:'+code+':'+name:name;}
 function redraw(){if(typeof render==='function')render();}
 async function load(){
  if(!enabled())return [];if(loading)return loading;
  phase='loading';message='Carregando igrejas…';
  loading=(async()=>{try{
   if(window.IASDPIConfig?.remoteDisabled===true)throw Error('Conexão preparada; acesso remoto ainda desativado.');
   const config=window.IASDPIAuth?.config?.()||{url:window.IASDPIConfig?.supabaseUrl,key:window.IASDPIConfig?.supabasePublishableKey};
   const url=new URL(config.url);
   if(url.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(url.host)||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!config.key)throw Error('Conexão pública não configurada.');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   let response;try{response=await fetch(config.url+'/rest/v1/rpc/iasdpi_list_churches',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:'{}',signal:controller.signal});}finally{clearTimeout(timer);}
   if(!response.ok)throw Error('Consulta de igrejas indisponível. Confira a instalação da migração 011.');
   const result=await response.json();
   if(!Array.isArray(result)||result.some(c=>!c||typeof c.id!=='string'||! /^[A-Z][A-Z0-9_]{2,39}$/.test(c.code)||typeof c.name!=='string')||new Set(result.map(c=>c.code)).size!==result.length)throw Error('Lista de igrejas inválida.');
   rows=result.map(({id,code,name})=>({id,code,name}));phase='ready';message=rows.length?'':'Nenhuma igreja está liberada para acesso.';
   if(!selected()&&rows.some(c=>c.code===original))sessionStorage.setItem(key,original);
   return rows;
  }catch(error){rows=[];phase='error';message=error.name==='AbortError'?'A consulta demorou demais. Tente novamente.':error.message;throw error;}
  finally{loading=null;redraw();}})();return loading;
 }
 async function ensure(){
  if(!enabled())return original;if(phase!=='ready')await load();
  if(!ready())throw Error('Selecione uma igreja autorizada antes de entrar.');return selected();
 }
 function selectionPage(){
  if(phase==='idle')queueMicrotask(()=>{void load().catch(()=>{});});
  return `<div class="page-heading"><div><p class="eyebrow">ACESSO</p><h1>Escolha sua igreja</h1><p class="muted">Depois, entre com sua conta autorizada.</p></div></div><section class="panel auth-panel"><p role="${phase==='error'?'alert':'status'}">${h(message||(phase==='ready'?'Selecione a igreja para continuar.':'Carregando igrejas…'))}</p>${phase==='ready'&&rows.length?`<form id="church-select-form"><label for="church-select">Igreja<select id="church-select" name="church" required><option value="">Selecione a igreja</option>${rows.map(c=>`<option value="${h(c.code)}">${h(c.name)}</option>`).join('')}</select></label><button type="submit" class="primary">Continuar</button><p class="form-note">A escolha da igreja não concede acesso aos dados.</p></form>`:phase==='error'?'<button type="button" data-church-retry>Tentar novamente</button>':''}</section>`;
 }
 function selectedLabel(){return enabled()&&ready()?`<p class="church-selected"><strong>${h(current().name)}</strong> <button type="button" data-church-change>Trocar igreja</button></p>`:'';}
 function loginSelector(){
  if(!enabled())return '';
  if(phase==='idle')queueMicrotask(()=>{void load().catch(()=>{});});
  return `<label for="church-select">Igreja<select id="church-select" name="church" required ${phase!=='ready'?'disabled':''}>${!ready()?'<option value="">Selecione a igreja</option>':''}${rows.map(c=>`<option value="${h(c.code)}" ${c.code===selected()?'selected':''}>${h(c.name)}</option>`).join('')}</select></label>${phase==='error'?`<p role="alert">${h(message)}</p><button type="button" data-church-retry>Tentar novamente</button>`:phase!=='ready'?'<p role="status">Carregando igrejas…</p>':!rows.length?'<p role="alert">Nenhuma igreja está liberada para acesso.</p>':''}`;
 }
 async function selectForLogin(code){
  if(!enabled())return original;if(phase!=='ready')await load();
  if(!rows.some(c=>c.code===code))throw Error('Selecione uma igreja autorizada.');
  if(code!==selected()&&window.IASDPIAuth?.identityKey()&&await IASDPIAuth.logout()===false)throw Error('A troca de igreja foi cancelada.');
  sessionStorage.setItem(key,code);return code;
 }
 document.addEventListener('submit',e=>{
  if(e.target.id!=='church-select-form')return;e.preventDefault();const code=new FormData(e.target).get('church');if(phase!=='ready'||!rows.some(c=>c.code===code))return;
  try{sessionStorage.setItem(key,code);location.reload();}catch(_){message='Não foi possível guardar a escolha nesta aba. Permita o armazenamento da sessão e tente novamente.';redraw();}
 });
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-church-retry]')){void load().catch(()=>{});redraw();}
  if(e.target.closest('[data-church-change]')){void (async()=>{try{await IASDPIAuth.logout();sessionStorage.removeItem(key);location.reload();}catch(error){message=error.message;redraw();}})();}
 });
 function switchAuthorized(code){if(!window.IASDPIPortalAccess?.enabled()||!rows.some(c=>c.code===code))throw Error('Igreja não disponível.');sessionStorage.setItem(key,code);location.reload();}
 return {switchAuthorized,enabled,selected,ready,current,headers,storageScope,ensure,load,selectionPage,selectedLabel,loginSelector,selectForLogin};
})();
