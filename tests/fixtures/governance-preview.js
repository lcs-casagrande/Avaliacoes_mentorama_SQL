'use strict';
// Somente prévia local. Não é importado pelo pacote de produção.
window.IASDPIConfig=Object.freeze({storageMode:'browser',storageNamespace:'iasdpi-g3-preview-only',supabaseUrl:'https://demo.invalid',supabasePublishableKey:'preview-only',churchIsolationEnabled:true,aliasLoginEnabled:true,governanceEnabled:true});
(()=>{
 const UID='11111111-1111-4111-8111-111111111111',MEMBER='22222222-2222-4222-8222-222222222222',D='a0000000-0000-4000-8000-000000000001',E='a0000000-0000-4000-8000-000000000003',copy=v=>structuredClone(v);
 const catalog={actor_id:UID,is_admin:true,church_id:'1a5d0000-0000-4000-8000-000000000001',departments:[{id:D,name:'Sonoplastia',can_access:true,can_members:true,can_requests:true},{id:E,name:'Música',can_access:true,can_members:true,can_requests:true}],users:[{user_id:UID,name:'Administrador de exemplo',role:'admin',status:'active'},{user_id:MEMBER,name:'Líder de exemplo',role:null,status:'active'}],aliases:[{identifier:'sonoplastia',user_id:MEMBER,enabled:true,version:1},{identifier:'musica',user_id:null,enabled:false,version:1}],access:[{department_id:D,user_id:MEMBER,status:'active',version:1,can_view:true,can_edit:true,can_publish:false,can_manage_members:false,can_manage_access:false,can_handle_requests:false}]};
 const queue=[{id:MEMBER,requester_name:'Pessoa de exemplo',identifier:'sonoplastia',kind:'password',message:'Preciso recuperar o acesso.',status:'pending',verification:'',version:1,created_at:'2026-10-30T12:00:00Z',can_reset:true}],audit=[],members=[{id:MEMBER,person_id:MEMBER,name:'Participante de exemplo',active:true,version:1}];
 const rpc=async(path,options={})=>{const name=path.split('?')[0].split('/').pop(),b=JSON.parse(options.body||'{}');
  if(name==='iasdpi_find_account')return [{user_id:MEMBER,email:'identidade@example.invalid',confirmed:true,authorized:true}];
  if(name==='iasdpi_governance_catalog')return copy(catalog);
  if(name==='iasdpi_governance_history')return copy(audit);
  if(name==='iasdpi_access_requests')return copy(queue);
  if(name==='iasdpi_access_request_options')return catalog.departments.map(({id,name})=>({id,name}));
  if(name==='iasdpi_department_members')return copy(members);
  if(name==='iasdpi_department_access_save'){let a=catalog.access.find(a=>a.user_id===b.p_user&&a.department_id===b.p_department);if(!a){a={user_id:b.p_user,department_id:b.p_department,version:0};catalog.access.push(a);}if(a.version!==b.p_expected_version)throw Error('Versão alterada. Atualize a consulta.');Object.assign(a,{status:b.p_status,version:a.version+1});for(const [k,v] of Object.entries(b.p_flags))a['can_'+({members:'manage_members',access:'manage_access',requests:'handle_requests'}[k]||k)]=v;}
  else if(name==='iasdpi_alias_save'){let a=catalog.aliases.find(a=>a.identifier===b.p_identifier);if(!a){a={identifier:b.p_identifier,version:0};catalog.aliases.push(a);}Object.assign(a,{user_id:b.p_user_id,enabled:b.p_enabled,version:a.version+1});}
  else if(name==='iasdpi_identity_state_save'){if(b.p_user===UID&&b.p_status!=='active')throw Error('O último administrador geral deve ser preservado.');catalog.users.find(u=>u.user_id===b.p_user).status=b.p_status;}
  else if(name==='iasdpi_set_access'){if(b.p_user_id===UID&&b.p_role!=='admin')throw Error('O último administrador geral deve ser preservado.');catalog.users.find(u=>u.user_id===b.p_user_id).role=b.p_role;}
  else if(name==='iasdpi_access_request_review'){Object.assign(queue.find(q=>q.id===b.p_id),{status:b.p_status,verification:b.p_verification,version:b.p_expected_version+1});}
  else if(name==='iasdpi_schedule_save'){const m=members.find(m=>m.id===b.p_id);Object.assign(m,b.p_data,{version:m.version+1});}
  else if(name==='iasdpi_list_users'||name==='iasdpi_list_invites')return [];
  else throw Error('Esta operação não está disponível na prévia visual.');
  audit.unshift({actor_id:UID,action:name.replace('iasdpi_',''),created_at:new Date().toISOString()});return null;
 };
 window.IASDPIChurches={enabled:()=>true,ready:()=>true,selected:()=> 'IASD_PI',current:()=>({name:'IASD Parada Inglesa'}),ensure:async()=> 'IASD_PI',headers:()=>({'x-iasdpi-church':'IASD_PI'}),selectedLabel:()=>'',selectionPage:()=>''};
 const identity={token:'preview-identity-only',user:{id:UID},role:'admin'};
 window.IASDPIAuth={allowed:()=>true,isAdmin:()=>true,isPublic:p=>['organization','agendas','login','access-admin','access-request','controlled-reset'].includes(p),status:()=>({phase:'authenticated'}),session:()=>({user:{id:UID},access_token:identity.token}),requireIdentity:async()=>identity,requireAccess:async()=>identity,identityCurrent:t=>t===identity.token,scopeValidated:()=>{},restore:async()=>identity,handlePasswordCallback:async()=>false,config:()=>({url:'https://demo.invalid',key:'preview-only'}),jsonRequest:rpc,loginIdentifierField:()=>'<label>Identificador<input name="email" required></label>',loginIdentity:async()=>identity,loginPage:()=>'<p>Identidade fictícia de administração.</p>',forgotPasswordPage:()=>'<p>Utilize Solicitar acesso nesta demonstração.</p>',resetPasswordPage:()=>'<p>Somente demonstração.</p>',passwordRecoveryActive:()=>false,logout:async()=>{throw Error('Prévia fictícia: não existe sessão remota.');}};
 window.fetch=async(url,o={})=>{if(url!=='https://demo.invalid/functions/v1/access-assistance')throw Error('Rede bloqueada nesta prévia.');const b=JSON.parse(o.body);
  if(b.action==='submit'){queue.unshift({id:b.id,requester_name:b.name,identifier:b.identifier,kind:b.kind,message:b.message,status:'pending',version:1,created_at:new Date().toISOString(),verification:'',can_reset:false});return Response.json({accepted:true});}
  if(b.action==='issue')return Response.json({code:'a'.repeat(64),expires_at:new Date(Date.now()+900000).toISOString()});
  if(b.action==='complete')return Response.json({completed:true});
  return Response.json({},{status:400});
 };
 if(!location.hash)location.hash='access-admin';
 document.querySelectorAll('.demo-banner').forEach(b=>b.remove());
 document.querySelector('.header').insertAdjacentHTML('afterend','<aside class="demo-banner">DEMONSTRAÇÃO — DADOS FICTÍCIOS · alterações somente nesta aba; nenhuma conexão com Supabase.</aside>');
 const nav=document.querySelector('.header nav');nav.innerHTML='<a href="#access-admin" data-page="access-admin">Gestão de acessos</a><a href="#access-request" data-page="access-request">Solicitar acesso</a><button id="auth-logout" hidden>Sair</button>';
})();
