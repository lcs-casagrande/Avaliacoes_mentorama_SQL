'use strict';
const usersState={rows:[],invites:[],offset:0,loaded:false,loading:false,error:'',found:null,inviteLink:'',inviteToken:''};
function resetUsers(){usersState.rows=[];usersState.invites=[];usersState.found=null;usersState.loaded=false;usersState.loading=false;usersState.error='';usersState.offset=0;usersState.inviteLink='';}
async function usersRpc(name,body={}){
  const authorization=await IASDPIAuth.requireAccess();
  if(authorization.role!=='admin')throw Error('Acesso exclusivo de administradores.');
  const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+authorization.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(IASDPIAuth.session()?.access_token!==authorization.token||!IASDPIAuth.isAdmin())throw Error('Acesso administrativo encerrado.');
  return result;
}
async function refreshUsers(){
  usersState.loading=true;usersState.error='';render();
  try{
    const [rows,invites]=await Promise.all([usersRpc('iasdpi_list_users',{p_offset:usersState.offset}),usersRpc('iasdpi_list_invites')]);
    if(!Array.isArray(rows)||!Array.isArray(invites))throw Error('Resposta inválida ao consultar usuários.');
    usersState.rows=rows;usersState.invites=invites;usersState.loaded=true;
  }catch(error){usersState.error=error.message;throw error;}
  finally{usersState.loading=false;render();}
}
function usersPage(){
  if(!IASDPIAuth.isAdmin())return heading('ADMINISTRAÇÃO','Acesso restrito','Somente administradores podem gerenciar usuários.');
  return heading('ADMINISTRAÇÃO','Usuários','IASD Parada Inglesa · autorizações e convites.',button('Atualizar lista','users-refresh'))+
    (window.IASDPIConfig?.remoteReadOnly?'<p class="form-note">Modo de consulta: listagem e busca disponíveis; alterações de acesso e convites bloqueadas nesta interface.</p>':'')+
    `<section class="panel"><h2>Autorizar conta existente</h2><p class="muted">Busque pelo e-mail exato. A conta precisa ter o e-mail confirmado.</p><form id="users-find-form" class="users-inline">${field('E-mail','email','','email',true)}<button type="submit">Buscar conta</button></form>${usersState.found?`<div class="users-result"><p>${esc(usersState.found.email)} · ${usersState.found.confirmed?'E-mail confirmado':'E-mail ainda não confirmado'}</p>${usersState.found.confirmed&&!usersState.found.authorized?button('Autorizar como líder','users-authorize',usersState.found.user_id,'class="primary"'):'<p class="muted">Se a conta já está na lista, altere seu perfil abaixo.</p>'}</div>`:''}</section>
    <section class="panel"><h2>Convidar novo líder</h2><p class="muted">O convite é individual, válido por 48 horas e só pode ser aceito pela conta com o e-mail confirmado correspondente. Não concede perfil administrador.</p><form id="users-invite-form" class="users-inline">${field('E-mail do convidado','email','','email',true)}<button type="submit">Gerar convite</button></form>${usersState.inviteLink?`<label>Link do convite<input id="users-invite-link" readonly value="${esc(usersState.inviteLink)}"></label><p class="muted">Copie e envie por um canal privado. Este link não será exibido novamente ao recarregar.</p>${button('Copiar link','users-copy')}`:''}</section>
    <section class="section"><h2>Usuários autorizados</h2><p class="muted">Administrador pode gerenciar acessos. Líder pode operar cultos e backups. Desmarcar “Acesso ativo” revoga a autorização. O último administrador não pode ser removido ou rebaixado.</p>${usersState.loading?'<p role="status">Carregando usuários…</p>':usersState.error?`<p role="alert" class="form-error">Erro ao carregar usuários: ${esc(usersState.error)} ${button('Tentar novamente','users-refresh')}</p>`:usersState.loaded?usersState.rows.length?`<ul class="users-list">${usersState.rows.map(row=>`<li><form class="user-access-form" data-user-id="${esc(row.user_id)}"><div><strong>${esc(row.email)}</strong><small>${row.user_id===IASDPIAuth.session()?.user.id?'Sua conta':'Conta autorizada'}</small></div><label>Perfil<select name="role"><option value="leader" ${row.role==='leader'?'selected':''}>Líder</option><option value="admin" ${row.role==='admin'?'selected':''}>Administrador</option></select></label><label class="checkbox"><input name="enabled" type="checkbox" ${row.enabled?'checked':''}> Acesso ativo</label><button type="submit">Salvar acesso</button></form></li>`).join('')}</ul>`:'<p>Nenhum usuário nesta página.</p>':'<p class="muted">Atualize a lista para consultar as autorizações.</p>'}<div class="actions">${button('Anterior','users-previous','',''+(usersState.offset===0?'disabled':''))}${button('Próxima','users-next','',''+(usersState.rows.length<50?'disabled':''))}</div></section>
    <section class="section"><h2>Convites pendentes</h2>${usersState.loading?'<p role="status">Carregando convites…</p>':usersState.error?'<p>Não foi possível consultar os convites. Tente novamente.</p>':usersState.invites.length?`<ul class="users-list">${usersState.invites.map(i=>`<li class="users-inline"><div><strong>${esc(i.email)}</strong><small>Expira em ${esc(displayRecordTimestamp(i.expires_at))}</small></div>${button('Revogar convite','users-revoke-invite',i.id)}</li>`).join('')}</ul>`:usersState.loaded?'<p class="muted">Nenhum convite pendente.</p>':'<p class="muted">Atualize a lista para consultar os convites.</p>'}</section>`;
}
function captureInvite(fragment){
  if(/(?:^|&)(?:error|error_code)=/.test(fragment)||/(?:^|&)type=recovery(?:&|$)/.test(fragment)){void IASDPIAuth.handlePasswordCallback();return;}
  // Confirmação de e-mail pode redirecionar com tokens no fragmento.
  // Este fluxo usa login por senha: não importar nem deixar tokens na URL.
  if(/(?:^|&)(?:access_token|refresh_token)=/.test(fragment)){
    window.history.replaceState(null,'','#organization');return;
  }
  const [page,token]=fragment.split('/');
  if(page==='invite'&&token){
    usersState.inviteToken=/^[a-f0-9]{64}$/.test(token)?token:'';
    window.history.replaceState(null,'','#invite');
  }
}
function invitePage(){
  return heading('CONVITE','Acesso à IASD Parada Inglesa','Confirme seu e-mail antes de aceitar. O convite só autoriza a conta indicada pelo administrador.')+
    (usersState.inviteToken?`<section class="panel auth-panel"><form id="invite-login-form"><h2>Já tenho uma conta</h2>${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${IASDPIAuth.config().key?'':field('Chave pública da conexão','public-key','','text',true)}<button type="submit" class="primary">Entrar e aceitar convite</button></form><hr><form id="invite-signup-form"><h2>Criar minha conta</h2>${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Nova senha','password','','password',true,'minlength="12" autocomplete="new-password"')}${IASDPIAuth.config().key?'':field('Chave pública da conexão','public-key','','text',true)}<button type="submit">Cadastrar e confirmar e-mail</button><p class="muted">Após confirmar pelo e-mail recebido, reabra o convite original e entre com sua senha. O cadastro sozinho não autoriza o acesso.</p></form></section>`:'<p class="panel">Abra o link individual enviado pelo administrador. Se o convite expirou, solicite outro.</p>');
}
async function handleUsersAction(action,id){
  if(action==='users-copy'){await navigator.clipboard.writeText(usersState.inviteLink);toast('Link copiado. Envie apenas ao convidado.');return;}
  if(action==='users-authorize'){
    await usersRpc('iasdpi_set_access',{p_user_id:id,p_role:'leader',p_enabled:true});usersState.found=null;toast('Líder autorizado.');
  }else if(action==='users-revoke-invite'){
    await usersRpc('iasdpi_revoke_invite',{p_id:id});usersState.inviteLink='';toast('Convite revogado.');
  }else if(action==='users-next')usersState.offset+=50;
  else if(action==='users-previous')usersState.offset=Math.max(0,usersState.offset-50);
  await refreshUsers();
}
async function submitUsersForm(form){
  if(form.id==='users-find-form'){
    const rows=await usersRpc('iasdpi_find_account',{p_email:form.elements.email.value});
    usersState.found=rows[0]||null;render();if(!usersState.found)toast('Conta não encontrada. Você pode gerar um convite.');
  }else if(form.id==='users-invite-form'){
    if(location.protocol==='file:')throw Error('Gere convites no endereço do site. Um link de arquivo local não pode ser enviado ao convidado.');
    const [invite]=await usersRpc('iasdpi_create_invite',{p_email:form.elements.email.value});
    usersState.inviteLink=location.href.split('#')[0]+'#invite/'+invite.token;await refreshUsers();
  }else if(form.classList.contains('user-access-form')){
    await usersRpc('iasdpi_set_access',{p_user_id:form.dataset.userId,p_role:form.elements.role.value,p_enabled:form.elements.enabled.checked});
    await IASDPIAuth.requireAccess();toast('Acesso atualizado.');
    if(IASDPIAuth.isAdmin())await refreshUsers();else{resetUsers();navigate('home');}
  }
}
