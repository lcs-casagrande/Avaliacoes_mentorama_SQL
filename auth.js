'use strict';
window.IASDPIAuth = (() => {
  let client=null, session=null, access=null, verification=null, generation=0, recovery=null;
  let phase='recovering', statusMessage='Recuperando sessão…', signingIn=false, expiryTimer=null;
  const publicPages=new Set(['organization','agendas','login','invite']);
  function config(){
    let saved={};try{saved=JSON.parse(localStorage.getItem(IASDPIStorage.cloudConfig)||'{}');}catch(_){}
    return {url:window.IASDPIConfig?.supabaseUrl || '',key:window.IASDPIConfig?.supabasePublishableKey || saved.key || ''};
  }
  function validateConfig(value){
    const parsed=new URL(value.url);
    if(parsed.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(parsed.host)||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Configure a URL pública do Supabase.');
    if(!value.key.startsWith('sb_publishable_')&&!value.key.startsWith('eyJ'))throw Error('Configure somente a chave pública publishable/anon.');
    if(value.key.startsWith('eyJ')){try{if(JSON.parse(atob(value.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon')throw Error();}catch(_){throw Error('Use somente a chave pública anon, nunca service_role.');}}
  }
  function remoteRequestAllowed(path,method='GET'){
    if(!window.IASDPIConfig?.remoteReadOnly)return true;
    if(method==='GET')return /^\/auth\/v1\/(health|settings|user)$/.test(path)||/^\/rest\/v1\/(iasdpi_access|iasdpi_templates|culto_archives)(?:\?|$)/.test(path);
    if(method!=='POST')return false;
    return path==='/auth/v1/token?grant_type=password'||path==='/auth/v1/token?grant_type=refresh_token'||path==='/auth/v1/logout?scope=local'||
      ['/rest/v1/rpc/iasdpi_list_users','/rest/v1/rpc/iasdpi_list_invites','/rest/v1/rpc/iasdpi_find_account'].includes(path);
  }
  async function jsonRequest(path,options={}){
    if(!remoteRequestAllowed(path,(options.method||'GET').toUpperCase()))throw Error('Homologação em modo de consulta: alterações remotas estão bloqueadas.');
    const cfg=config();validateConfig(cfg);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(cfg.url+path,{...options,signal:controller.signal,headers:{apikey:cfg.key,...options.headers}});
      if(!response.ok){
        if(path.startsWith('/rest/v1/rpc/')){
          let error={};try{error=await response.json();}catch(_){}
          if(['42501','23514','22023','40001'].includes(error.code))throw Error(error.code==='40001'?'Outra operação alterou os acessos. Atualize e tente novamente.':String(error.message).slice(0,250));
        }
        throw Error(response.status===401?'Sessão inválida ou expirada. Entre novamente.':'Não foi possível confirmar o acesso. Verifique a conexão e a configuração do Supabase.');
      }
      return response.status===204?null:await response.json();
    }finally{clearTimeout(timer);}
  }

  function status(next,message){phase=next;statusMessage=message;window.dispatchEvent(new Event('iasdpi-session-status'));}
  function allowed(){return Boolean(session&&access&&session.expires_at*1000>Date.now());}
  function invalidate(next='expired',message='Sessão expirada. Entre novamente.',dropSession=false){
    generation++;access=null;verification=null;clearTimeout(expiryTimer);
    if(dropSession)session=null;
    status(next,message);window.dispatchEvent(new Event('iasdpi-auth-changed'));
  }
  function adopt(value){
    if(session?.access_token!==value?.access_token){generation++;verification=null;}
    session=value;
    clearTimeout(expiryTimer);
    if(value)expiryTimer=setTimeout(()=>{void restore().catch(()=>{});},Math.max(100,Math.min(value.expires_at*1000-Date.now()+50,2147483647)));
  }
  function getClient(){
    if(client)return client;
    const cfg=config();validateConfig(cfg);
    if(!window.supabase?.createClient)throw Error('Não foi possível carregar a autenticação. Recarregue a página.');
    client=window.supabase.createClient(cfg.url,cfg.key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
        storageKey:IASDPIStorage.authSession,flowType:'pkce'},
      global:{fetch:async(input,options={})=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.origin!==cfg.url||!remoteRequestAllowed(url.pathname+url.search,(options.method||'GET').toUpperCase()))throw Error('Operação remota bloqueada no modo de consulta.');
        return fetch(input,options);
      }}
    });
    client.auth.onAuthStateChange((event,value)=>{
      // Callback síncrono: chamadas Auth dentro deste callback podem bloquear o SDK.
      if(event==='SIGNED_OUT'){
        const existed=Boolean(session);adopt(null);
        invalidate(existed?'expired':'anonymous',existed?'Sessão expirada. Entre novamente.':'Entre com uma conta autorizada.',true);
      }else{
        const changed=session?.access_token!==value?.access_token;adopt(value);
        if(value&&changed&&!signingIn)setTimeout(()=>{void restore().catch(()=>{});},0);
      }
    });
    return client;
  }
  async function verify(){
    if(!session||session.expires_at*1000<=Date.now())throw Error('Sessão expirada. Entre novamente.');
    if(verification)return verification;
    const ticket=generation,token=session.access_token;
    verification=(async()=>{
      try{
        const headers={Authorization:'Bearer '+token};
        const user=await jsonRequest('/auth/v1/user',{headers});
        if(user.is_anonymous!==false||!user.id)throw Error('Conta sem autorização.');
        const rows=await jsonRequest('/rest/v1/iasdpi_access?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,role,enabled&limit=1',{headers});
        if(!Array.isArray(rows)||rows.length!==1||rows[0].user_id!==user.id||rows[0].enabled!==true||!['admin','leader'].includes(rows[0].role))throw Error('Conta sem autorização. Solicite acesso à administração.');
        if(ticket!==generation)throw Error('Sessão alterada. Tente novamente.');
        const previousRole=access?.role;access=rows[0];session.user=user;status('authenticated','Sessão ativa.');
        if(previousRole&&previousRole!==access.role)window.dispatchEvent(new Event('iasdpi-role-changed'));
        return {token,role:access.role,user};
      }catch(error){if(ticket===generation)invalidate('unavailable',error.message);throw error;}
      finally{if(ticket===generation)verification=null;}
    })();
    return verification;
  }
  async function restore(){
    if(recovery)return recovery;
    recovery=Promise.resolve().then(async()=>{
      if(!allowed())status('recovering','Recuperando sessão…');
      try{
        const {data,error}=await getClient().auth.getSession();
        if(error)throw error;
        adopt(data.session);
        if(!session){invalidate('anonymous','Entre com uma conta autorizada.',true);return null;}
        return await verify();
      }catch(error){
        const expired=error.status===400||error.status===401||/refresh_token|expirada/i.test(error.code||error.message||'');
        const denied=/Conta sem autorização/.test(error.message||'');
        invalidate(denied?'unauthorized':expired?'expired':'unavailable',denied?error.message:expired?'Sessão expirada. Entre novamente.':'Não foi possível recuperar a sessão. Verifique sua conexão e tente novamente.');
        throw error;
      }finally{recovery=null;}
    });
    return recovery;
  }
  async function requireAccess(){
    if(!session||session.expires_at*1000<=Date.now())await restore();
    return verify();
  }
  async function login(email,password,key,inviteToken){
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    if(client&&cfg.key!==config().key)throw Error('Recarregue a página após alterar a chave pública.');
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    signingIn=true;status('recovering','Confirmando acesso…');
    try{
      const {data,error}=await getClient().auth.signInWithPassword({email,password});
      if(error)throw Error('Não foi possível entrar. Confira e-mail, senha e conexão.');
      adopt(data.session);
      if(inviteToken)await jsonRequest('/rest/v1/rpc/iasdpi_accept_invite',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_token:inviteToken})});
      await verify();window.dispatchEvent(new Event('iasdpi-auth-changed'));
    }catch(error){invalidate('unavailable',error.message);throw error;}
    finally{signingIn=false;}
  }
  async function signup(email,password,key){
    if(!remoteRequestAllowed('/auth/v1/signup','POST'))throw Error('Cadastro bloqueado no modo de consulta.');
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    const {error}=await getClient().auth.signUp({email,password});if(error)throw Error('Não foi possível concluir o cadastro. Verifique sua conexão.');
  }
  async function logout(){
    const {error}=await getClient().auth.signOut({scope:'local'});
    if(error)throw Error('Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.');
    adopt(null);invalidate('anonymous','Sessão encerrada.',true);
  }
  function loginPage(){
    return heading('ACESSO RESTRITO','Entrar no IASDPI','Cronogramas, registros, histórico e backups são exclusivos de administradores e líderes autorizados.')+
      `<section class="panel auth-panel"><p role="status">${esc(statusMessage)}</p><form id="auth-login-form">${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${`<details ${config().key?'':'open'}><summary>Configuração da conexão</summary><p class="muted">Informe somente a chave pública do projeto.</p>${field('Chave pública publishable/anon','public-key','','text',!config().key,'autocomplete="off"')}</details>`}<button class="primary" type="submit">Entrar</button><p class="muted">A sessão é mantida pelo Supabase neste navegador. Use Sair em dispositivos compartilhados. A autorização depende da administração da igreja.</p></form></section>`;
  }
  document.addEventListener('visibilitychange',()=>{
    if(!client)return;
    if(document.hidden)client.auth.stopAutoRefresh();
    else{client.auth.startAutoRefresh();void restore().catch(()=>{});}
  });
  setInterval(()=>{if(session&&!document.hidden)void requireAccess().catch(()=>{});},60000);
  return {config,remoteRequestAllowed,allowed,isAdmin:()=>allowed()&&access.role==='admin',requireAccess,jsonRequest,login,signup,logout,loginPage,restore,
    status:()=>({phase,message:statusMessage}),isPublic:page=>publicPages.has(page),session:()=>allowed()?session:null};
})();
