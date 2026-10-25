'use strict';
// Histórico da interface; autorização e dados continuam nos serviços existentes.
window.IASDPINavigation=(()=>{
  const pages=new Set(['home','programs','tracking','history','edit','summary','actuals','agendas','archive','organization','login','users','invite','plan-edit','trash','models','forgot-password','reset-password']);
  const records=new Set(['edit','summary','tracking','actuals','plan-edit']);
  let current=null,restoring=null;
  function parse(){
    captureInvite(location.hash.slice(1));
    const parts=location.hash.slice(1).split('/');let id;
    try{id=parts[1]?decodeURIComponent(parts[1]):null;}catch(_){return null;}
    return pages.has(parts[0])&&parts.length<=2?{page:parts[0],id:records.has(parts[0])?id:null}:null;
  }
  function route(page,id){return '#'+page+(records.has(page)&&id?'/'+encodeURIComponent(id):'');}
  function entry(){return window.history.state?.iasdpiNavigation;}
  function stamp(position,hash,scroll=0){window.history.replaceState({...window.history.state,iasdpiNavigation:{position,hash,scroll}},'',hash);}
  function choose(page,id){
    state.page=page;
    if(id)state.selected=id;
    else if(['actuals','edit','plan-edit','summary'].includes(page))state.selected=null;
    else if(page==='tracking'&&!selected())state.selected=state.programs.find(p=>p.status==='Em andamento')?.id||state.programs.find(p=>p.status==='Pronta')?.id||null;
  }
  function display(page,id,scroll=0){
    window.IASDPIConflicts?.close();choose(page,id);render();app.focus({preventScroll:true});window.scrollTo({top:scroll,behavior:'instant'});
    if(page==='users'&&IASDPIAuth.isAdmin()&&!usersState.loaded)void guarded(()=>refreshUsers());
    if(page==='trash'&&IASDPIAuth.isAdmin()&&trashState.rows===null)void guarded(()=>refreshTrash());
  }
  function start(){
    let parsed=parse()||{page:state.page,id:null};
    if(parsed.page==='login'&&IASDPIAuth.allowed())parsed={page:'home',id:null};
    choose(parsed.page,parsed.id);
    const hash=route(parsed.page,parsed.id),position=Number.isInteger(entry()?.position)?entry().position:current?.position||0;
    current={position,hash};restoring=null;stamp(position,hash,entry()?.scroll||0);
  }
  function navigate(page,id,{replace=false,refresh=false}={}){
    if(restoring)return false;
    if(!pages.has(page))return false;
    const recordId=id||(records.has(page)&&!['actuals','edit'].includes(page)?state.selected:null);
    const hash=route(page,recordId);
    if(current?.hash===hash&&!refresh){app.focus({preventScroll:true});return true;}
    if(!canLeaveRegistration())return false;
    if(!current)start();
    stamp(current.position,current.hash,window.scrollY);
    const replaceEntry=replace||current.hash===hash,position=replaceEntry?current.position:current.position+1;
    if(replaceEntry)stamp(position,hash);else window.history.pushState({iasdpiNavigation:{position,hash,scroll:0}},'',hash);
    current={position,hash};display(page,recordId);return true;
  }
  function identify(page,id){
    const hash=route(page,id),position=current?.position??entry()?.position??0;
    current={position,hash};stamp(position,hash,window.scrollY);
  }
  function traversed(){
    if(!current)return;
    const parsed=parse()||{page:IASDPIAuth.allowed()?'home':'organization',id:null};
    const hash=route(parsed.page,parsed.id),metadata=entry();
    if(restoring){
      if(metadata?.position===restoring.position&&hash===restoring.hash){restoring=null;return;}
      // Uma única travessia de retorno está em trânsito. Não enfileirar outro go.
      return;
    }
    if(hash===current.hash&&metadata?.position===current.position)return;
    const position=Number.isInteger(metadata?.position)?metadata.position:current.position+1;
    if(!canLeaveRegistration()){
      restoring={...current};
      const delta=current.position-position;
      if(delta)window.history.go(delta);else{stamp(current.position,current.hash,window.scrollY);restoring=null;}
      return;
    }
    current={position,hash};stamp(position,hash,metadata?.scroll||0);display(parsed.page,parsed.id,metadata?.scroll||0);
  }
  window.addEventListener('popstate',traversed);
  // Travessias e alterações de fragmento já disparam popstate. hashchange da
  // mesma travessia não representa outra intenção do usuário.
  document.querySelector('.skip-link')?.addEventListener('click',event=>{event.preventDefault();app.focus({preventScroll:true});app.scrollIntoView({block:'start'});});
  return {start,navigate,identify,pending:()=>Boolean(restoring)};
})();
