'use strict';
window.IASDPIAuth = (() => {
  let client=null, session=null, access=null, verification=null, generation=0, recovery=null;
  let phase='recovering', statusMessage='Recuperando sessão…', signingIn=false, expiryTimer=null;
  const publicPages=new Set(['organization','agendas','login','invite','forgot-password','reset-password']);
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
          if(['42501','23514','22023','40001'].includes(error.code)){const failure=Error(String(error.message).slice(0,250));failure.code=error.code;throw failure;}
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
      if(event==='PASSWORD_RECOVERY'){
        adopt(value);access=null;recoveryMetadata({uid:value.user.id,until:Math.min(Date.now()+900000,value.expires_at*1000)});status('recovering','Defina sua nova senha.');
      }else if(event==='SIGNED_OUT'){
        recoveryMetadata(null);
        const existed=Boolean(session);adopt(null);
        invalidate(existed?'expired':'anonymous',existed?'Sessão expirada. Entre novamente.':'Entre com uma conta autorizada.',true);
      }else{
        const changed=session?.access_token!==value?.access_token;adopt(value);
        if(value&&changed&&!signingIn&&!passwordRecoveryActive())setTimeout(()=>{void restore().catch(()=>{});},0);
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
        if(passwordRecoveryActive()){status('recovering','Defina sua nova senha.');return null;}
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
    if(passwordRecoveryActive())throw Error('Conclua a recuperação de senha antes de acessar os registros.');
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
    if(window.IASDPIDrafts&&!await IASDPIDrafts.confirmLogout())return false;
    const draftOwner=session?.user.id;
    const {error}=await getClient().auth.signOut({scope:'local'});
    if(error)throw Error('Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.');
    await window.IASDPIDrafts?.clearUser(draftOwner);
    adopt(null);invalidate('anonymous','Sessão encerrada.',true);
    return true;
  }
  // O SDK guarda o verificador PKCE e a sessão. Aqui só há metadados temporários.
  const passwordMarker=IASDPIStorage.authSession+':password-recovery-v1';
  let passwordContext=null,passwordRequestAt=0,passwordMessage='Link ausente, inválido ou expirado. Solicite um novo e abra no mesmo navegador.';
  function recoveryMetadata(value){
    passwordContext=value;
    try{if(value)sessionStorage.setItem(passwordMarker,JSON.stringify(value));else sessionStorage.removeItem(passwordMarker);}catch(_){}
  }
  function passwordRecoveryActive(){
    if(!passwordContext)try{passwordContext=JSON.parse(sessionStorage.getItem(passwordMarker)||'null');}catch(_){}
    return Boolean(session&&passwordContext?.uid===session.user.id&&passwordContext.until>Date.now()&&session.expires_at*1000>Date.now());
  }
  function passwordRedirect(){
    const url=new URL(location.href);
    if(!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('A recuperação exige o site HTTPS ou uma prévia local autorizada.');
    url.search='';url.hash='reset-password';
    if(url.origin!==location.origin||url.username||url.password)throw Error('Endereço de recuperação inválido.');
    return url.href;
  }
  async function requestPasswordReset(email){
    if(!remoteRequestAllowed('/auth/v1/recover','POST'))throw Error('Envio de e-mail bloqueado nesta prévia de consulta. Use o ambiente de testes autorizado.');
    const redirectTo=passwordRedirect();
    if(Date.now()-passwordRequestAt<60000)throw Error('Aguarde um minuto antes de solicitar outro link.');
    passwordRequestAt=Date.now();
    const {error}=await getClient().auth.resetPasswordForEmail(email,{redirectTo});
    if(error&&error.status===429)throw Error('Muitas solicitações. Aguarde antes de tentar novamente.');
    if(error&&!['user_not_found','email_not_found'].includes(error.code))throw Error('Não foi possível solicitar a recuperação agora. Verifique a conexão e tente novamente mais tarde.');
    return 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha. Verifique também o spam. Abra o link neste mesmo navegador.';
  }
  async function handlePasswordCallback(){
    const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
    const recoveryRoute=url.hash==='#reset-password',implicit=hash.get('type')==='recovery';
    if(!recoveryRoute&&!implicit&&!hash.has('error')&&!hash.has('error_code'))return false;
    const codes=url.searchParams.getAll('code'),code=codes[0],hasError=url.searchParams.has('error')||hash.has('error')||url.searchParams.has('error_code')||hash.has('error_code');
    const flowId=url.searchParams.get('sb_flow_id');
    // Remover códigos/erros antes de qualquer navegação, consulta ou mensagem.
    if(codes.length||hasError||implicit){url.search='';url.hash='reset-password';window.history.replaceState(null,'',url.pathname+url.hash);}
    if(!codes.length&&!hasError&&!implicit)return false;
    recoveryMetadata(null);
    passwordMessage='Conferindo o link de recuperação…';signingIn=true;
    try{
      if(hasError||implicit||codes.length!==1||!code||code.length>2048)throw Error();
      const {data,error}=await getClient().auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
      if(error||data?.redirectType!=='recovery'||!data.session)throw Error();
      adopt(data.session);recoveryMetadata({uid:session.user.id,until:Math.min(Date.now()+900000,session.expires_at*1000)});
      passwordMessage='Link confirmado. Defina sua nova senha.';status('recovering',passwordMessage);
    }catch(_){recoveryMetadata(null);passwordMessage='Link inválido, já utilizado ou expirado. Solicite outro e abra no mesmo navegador da solicitação.';}
    finally{signingIn=false;}
    return true;
  }
  async function updatePassword(password){
    const sdk=getClient(),{data,error}=await sdk.auth.getSession();
    if(error||!data.session){recoveryMetadata(null);passwordMessage='A recuperação expirou. Solicite um novo link.';throw Error(passwordMessage);}
    adopt(data.session);
    if(!passwordRecoveryActive())throw Error('Link inválido ou expirado. Solicite um novo link.');
    if(typeof password!=='string'||password.length<12)throw Error('Use uma senha com pelo menos 12 caracteres.');
    const result=await sdk.auth.updateUser({password});
    if(result.error){if([401,403].includes(result.error.status)){recoveryMetadata(null);passwordMessage='Link expirado. Solicite um novo link.';}throw Error('Não foi possível redefinir a senha. Verifique a conexão, a validade do link e os requisitos de senha do projeto.');}
    recoveryMetadata(null);passwordMessage='Senha redefinida. Entre novamente com a nova senha.';
    const signedOut=await sdk.auth.signOut({scope:'local'});
    adopt(null);invalidate('anonymous',passwordMessage,true);
    if(signedOut.error)throw Error('Senha alterada, mas não foi possível encerrar a sessão local. Recarregue e entre com a nova senha.');
  }
  function forgotPasswordPage(){
    if(bootInProgress)return heading('ACESSO','Recuperar senha')+'<p role="status">Preparando formulário de recuperação…</p>';
    return heading('ACESSO','Recuperar senha','Informe seu e-mail. Esta solicitação não concede autorização de acesso à igreja.')+`<section class="panel auth-panel"><form id="password-request-form">${field('E-mail','email','','email',true,'autocomplete="email"')}<button type="submit" class="primary">Enviar link de recuperação</button><p class="password-feedback" role="status" aria-live="polite"></p></form><p><a href="#login" data-auth-page="login">Voltar para Entrar</a></p></section>`;
  }
  function resetPasswordPage(){
    if(bootInProgress)return heading('ACESSO','Definir nova senha')+'<p role="status">Conferindo sessão de recuperação…</p>';
    return heading('ACESSO','Definir nova senha','A redefinição usa uma sessão de recuperação do Supabase e não altera as permissões da conta.')+`<section class="panel auth-panel"><p role="status">${esc(passwordRecoveryActive()?'Link confirmado. Defina sua nova senha.':passwordMessage)}</p>${passwordRecoveryActive()?`<form id="password-reset-form">${field('Nova senha','password','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirmar nova senha','repeat','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}<button type="submit" class="primary">Definir nova senha</button></form>`:`<p><a href="#forgot-password" data-auth-page="forgot-password">Solicitar novo link</a></p>`}<p><a href="#login" data-auth-page="login">Voltar para Entrar</a></p></section>`;
  }

  function loginPage(){
    return heading('ACESSO RESTRITO','Entrar no IASDPI','Cronogramas, registros, histórico e backups são exclusivos de administradores e líderes autorizados.')+
      `<section class="panel auth-panel"><p role="status">${esc(statusMessage)}</p><form id="auth-login-form">${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${`<details ${config().key?'':'open'}><summary>Configuração da conexão</summary><p class="muted">Informe somente a chave pública do projeto.</p>${field('Chave pública publishable/anon','public-key','','text',!config().key,'autocomplete="off"')}</details>`}<button class="primary" type="submit">Entrar</button><p><a href="#forgot-password" data-auth-page="forgot-password">Esqueci minha senha</a></p><p class="muted">A sessão é mantida pelo Supabase neste navegador. Use Sair em dispositivos compartilhados. A autorização depende da administração da igreja.</p></form></section>`;
  }
  document.addEventListener('visibilitychange',()=>{
    if(!client)return;
    if(document.hidden)client.auth.stopAutoRefresh();
    else{client.auth.startAutoRefresh();void restore().catch(()=>{});}
  });
  setInterval(()=>{if(session&&!document.hidden)void requireAccess().catch(()=>{});},60000);
  return {config,remoteRequestAllowed,allowed,isAdmin:()=>allowed()&&access.role==='admin',requireAccess,jsonRequest,login,signup,logout,loginPage,restore,requestPasswordReset,handlePasswordCallback,updatePassword,passwordRecoveryActive,forgotPasswordPage,resetPasswordPage,
    status:()=>({phase,message:statusMessage}),isPublic:page=>publicPages.has(page),session:()=>allowed()?session:null};
})();
