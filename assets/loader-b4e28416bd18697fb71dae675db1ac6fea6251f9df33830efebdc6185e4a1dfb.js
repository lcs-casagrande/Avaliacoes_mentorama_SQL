'use strict';
// URLs e integridade são preenchidas pelo gerador do pacote, sem destinos externos.
(() => {
  const bundle="assets/app-362a1857602c89fb47f74d24415348d3aef59c5ae53c4e195fa55bcf604ee404.js?v=362a1857602c89fb",integrity="sha256-NioYV2AsiftH900kQVNI0671nFrlPE4ZX6Vbz2BO5AQ=";
  const panel=document.querySelector('#release-recovery');
  const message=panel.querySelector('[data-release-message]');
  const retry=panel.querySelector('[data-release-retry]');
  let script=null,phase='loading',executing=false,reloadRequired=false;
  function fail(needsReload=false){
    reloadRequired ||= needsReload;phase='error';panel.hidden=false;retry.hidden=false;
    retry.textContent=reloadRequired?'Recarregar versão':'Tentar novamente';
    message.textContent='Não foi possível carregar uma versão completa do IASDPI. Seus registros e rascunhos não foram apagados. Verifique a conexão e tente novamente.';
  }
  async function reload(){
    try{await window.IASDPIDrafts?.flush();}
    catch(_){message.textContent='Não foi possível preservar o rascunho. Mantenha esta aba aberta e tente salvar antes de recarregar.';return;}
    const url=new URL(location.href);url.searchParams.set('iasdpi-update',String(Date.now()));location.assign(url.href);
  }
  function load(){
    if(reloadRequired){void reload();return;}
    if(script&&phase==='loading')return;
    phase='loading';retry.hidden=true;panel.hidden=false;executing=false;
    message.textContent='Carregando uma versão completa do IASDPI…';
    script?.remove();script=document.createElement('script');
    script.src=bundle;script.integrity=integrity;script.crossOrigin='anonymous';
    script.onload=()=>{if(phase!=='error'){phase='ready';panel.hidden=true;}};
    script.onerror=()=>fail(executing);document.head.append(script);
  }
  window.IASDPIRelease=Object.freeze({executing(){executing=true;},status:()=>phase});
  window.addEventListener('error',event=>{
    if(event.target===window&&executing&&phase==='loading')fail(true);
    if(event.target?.matches?.('[data-release-style]'))fail(true);
  },true);
  // A falha do CSS pode preceder o carregamento deste script defer.
  window.addEventListener('load',()=>{if(getComputedStyle(document.documentElement).getPropertyValue('--iasdpi-release-style').trim()!=='ready'||!window.IASDPIAgendaData)fail(true);},{once:true});
  retry.addEventListener('click',load);
  panel.querySelector('[data-release-reload]').addEventListener('click',event=>{event.preventDefault();void reload();});
  load();
})();
