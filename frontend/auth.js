'use strict';
window.IASDPIAuth = (() => {
  let session=null, access=null, verification=null, generation=0, expiryTimer=null;
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
  function allowed(){return Boolean(session&&access&&session.expires_at*1000>Date.now());}
  function invalidate(){generation++;session=null;access=null;verification=null;clearTimeout(expiryTimer);window.dispatchEvent(new Event('iasdpi-auth-changed'));}
  function remoteRequestAllowed(path,method='GET'){
    if(!window.IASDPIConfig?.remoteReadOnly)return true;
    if(method==='GET')return /^\/auth\/v1\/(health|settings|user)$/.test(path)||/^\/rest\/v1\/(iasdpi_access|iasdpi_templates|culto_archives)(?:\?|$)/.test(path);
    if(method!=='POST')return false;
    return path==='/auth/v1/token?grant_type=password'||path==='/auth/v1/logout?scope=local'||
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
  async function requireAccess(){
    if(!session||session.expires_at*1000<=Date.now()){invalidate();throw Error('Entre com uma conta autorizada.');}
    if(verification)return verification;
    const ticket=generation,token=session.access_token;
    verification=(async()=>{
      try{
        const headers={Authorization:'Bearer '+token};
        const user=await jsonRequest('/auth/v1/user',{headers});
        if(user.is_anonymous!==false||!user.id)throw Error('Conta sem autorização.');
        const rows=await jsonRequest('/rest/v1/iasdpi_access?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,role,enabled&limit=1',{headers});
        if(!Array.isArray(rows)||rows.length!==1||rows[0].user_id!==user.id||rows[0].enabled!==true||!['admin','leader'].includes(rows[0].role))throw Error('Conta sem autorização. Solicite acesso à administração.');
        if(ticket!==generation)throw Error('Sessão encerrada.');
        const previousRole=access?.role;access=rows[0];session.user=user;
        if(previousRole&&previousRole!==access.role)window.dispatchEvent(new Event('iasdpi-role-changed'));
        return {token,role:access.role,user};
      }catch(error){if(ticket===generation)invalidate();throw error;}
      finally{if(ticket===generation)verification=null;}
    })();
    return verification;
  }
  async function login(email,password,key,inviteToken){
    invalidate();const ticket=generation;const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    // Apenas chave pública; senha e tokens nunca são persistidos.
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    const result=await jsonRequest('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(ticket!==generation)throw Error('Login cancelado.');
    if(!result.access_token||!Number.isFinite(result.expires_in)||result.expires_in<=0)throw Error('Resposta de autenticação inválida.');
    session={access_token:result.access_token,expires_at:Date.now()/1000+result.expires_in,user:result.user};
    try{
      if(inviteToken)await jsonRequest('/rest/v1/rpc/iasdpi_accept_invite',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_token:inviteToken})});
      await requireAccess();
    }catch(error){if(ticket===generation)invalidate();throw error;}
    expiryTimer=setTimeout(invalidate,Math.min(result.expires_in*1000,2147483647));
    window.dispatchEvent(new Event('iasdpi-auth-changed'));
  }
  async function signup(email,password,key){
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    await jsonRequest('/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  }
  async function logout(){
    const token=session?.access_token;invalidate();
    const endpoint=window.IASDPIConfig?.environment==='homologation'?'/auth/v1/logout?scope=local':'/auth/v1/logout';
    if(token){try{await jsonRequest(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token}});}catch(_){/* acesso local já encerrado */}}
  }
  function loginPage(){
    return heading('ACESSO RESTRITO','Entrar no IASDPI','Cronogramas, registros, histórico e backups são exclusivos de administradores e líderes autorizados.')+
      `<section class="panel auth-panel"><form id="auth-login-form">${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${`<details ${config().key?'':'open'}><summary>Configuração da conexão</summary><p class="muted">Informe a chave pública do projeto. Nunca use chave secreta ou senha do banco.</p>${field('Chave pública publishable/anon','public-key','','text',!config().key,'autocomplete="off"')}</details>`}<button class="primary" type="submit">Entrar</button><p class="muted">O cadastro de uma conta não concede acesso. A autorização depende da administração da igreja.</p></form></section>`;
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)void requireAccess().catch(()=>{});});
  setInterval(()=>{if(session)void requireAccess().catch(()=>{});},60000);
  return {config,remoteRequestAllowed,allowed,isAdmin:()=>allowed()&&access.role==='admin',requireAccess,jsonRequest,login,signup,logout,loginPage,isPublic:page=>publicPages.has(page),session:()=>allowed()?session:null};
})();
