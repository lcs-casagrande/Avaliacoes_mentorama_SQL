'use strict';
// Servidor SIMULADO exclusivo da prévia G4. Não integra o pacote de produção.
(()=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,copy=v=>structuredClone(v),password='Demonstracao#2026';
 const all={view:true,edit:true,publish:true,members:true,access:true,requests:true};
 const accounts=[
  {id:id(91),alias:'admin.teste',name:'Administrador fictício',globalRole:'admin',caps:{}},
  {id:id(92),alias:'som.teste',name:'Líder fictício de Sonoplastia',caps:{[id(1)]:{view:true,edit:true,publish:true,members:true}}},
  {id:id(93),alias:'multi.teste',name:'Líder fictício de dois ministérios',caps:{[id(1)]:{view:true,edit:true,publish:true},[id(3)]:{view:true,edit:true,publish:true}}},
  {id:id(94),alias:'leitura.teste',name:'Visualizador fictício',caps:{[id(1)]:{view:true}}},
  {id:id(95),alias:'editor.teste',name:'Editor fictício sem publicação',caps:{[id(1)]:{view:true,edit:true}}},
  {id:id(97),alias:'anciao.teste',name:'Gestor fictício do Ancionato',caps:{[id(4)]:{view:true,edit:true,publish:true}}},
  {id:id(98),alias:'anciao.editor.teste',name:'Editor fictício do Ancionato',caps:{[id(4)]:{view:true,edit:true}}},
  {id:id(99),alias:'anciao.leitura.teste',name:'Leitor fictício do Ancionato',caps:{[id(4)]:{view:true}}},
  {id:id(96),alias:'crono.teste',name:'Líder fictício da Cronoanálise',globalRole:'leader',caps:{}}
 ].map(a=>({...a,email:a.alias+'@example.invalid',enabled:true}));
 const raw=IASDPISchedulePreview.request,store=IASDPIB1Preview,audit=[],queue=[];let current=null;
 if(window.IASDPIG6Preview)accounts.push(...[{id:id(100),alias:'admin.geral.teste',name:'Administrador geral fictício · IASD_PI',globalRole:'admin',caps:{}},{id:id(101),alias:'admin.pi.teste',name:'Administrador fictício da IASD_PI',globalRole:'admin',caps:{}},{id:id(102),alias:'musica.teste',name:'Líder fictício de Música',caps:{[id(3)]:{view:true,edit:true,publish:true,members:true}}}].map(a=>({...a,email:a.alias+'@example.invalid',enabled:true})));
 const seeded=(async()=>{
  await store.monthlyReady;let c=await raw('iasdpi_schedule_catalog');IASDPIKnownPreviewSeed.catalog=c;
  for(const r of c.roles)await raw('iasdpi_schedule_save',{p_entity:'role',p_id:r.id,p_expected_version:r.version,p_data:{general_assignment:true},p_request_id:crypto.randomUUID()});
  c=await raw('iasdpi_schedule_catalog');const cfg=await raw('iasdpi_schedule_settings_get'),generated=await raw('iasdpi_schedule_generate_days',{p_department:id(1),p_title:'Culto fictício',p_request_id:crypto.randomUUID()});
  for(const d of c.departments)for(const month of cfg.future_months){const key=d.id+':'+month;if(store.plans.has(key))continue;const role=c.roles.find(r=>r.department_id===d.id);
   const p={id:crypto.randomUUID(),department_id:d.id,month,title:'Escala fictícia · '+d.name,status:'draft',version:1,requirements:generated.events.filter(e=>e.scheduled_on.startsWith(month.slice(0,7))).map(e=>({id:crypto.randomUUID(),event_id:e.id,role_id:role.id,required_count:1,notes:'',assignments:[]}))};store.plans.set(key,p);store.versions.set(p.id,[copy(p)]);
  }
 })();
 const cap=(a,d,k)=>a?.enabled&&(a.globalRole==='admin'||Boolean(a.caps[d]?.[k]));
 const account=token=>{try{return accounts.find(a=>a.id===JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub&&a.enabled);}catch{return null;}};
 const fail=message=>{const e=Error(message);e.code='42501';throw e;};
 async function catalog(a){const c=await raw('iasdpi_schedule_catalog');const allowed=c.departments.filter(d=>cap(a,d.id,'view'));if(!allowed.length)fail('Sem autorização ministerial. A Cronoanálise usa seu acesso próprio.');
  c.actor_id=a.id;c.is_admin=a.globalRole==='admin';c.departments=allowed.map(d=>({...d,can_manage:cap(a,d.id,'edit')||cap(a,d.id,'publish')||cap(a,d.id,'members'),can_roster:true,can_edit:cap(a,d.id,'edit'),can_publish:cap(a,d.id,'publish'),can_manage_members:cap(a,d.id,'members')}));
  c.memberships=c.memberships.filter(m=>allowed.some(d=>d.id===m.department_id));c.people=c.people.filter(p=>c.memberships.some(m=>m.person_id===p.id));c.roles=c.roles.filter(r=>allowed.some(d=>d.id===r.department_id));c.qualifications=c.qualifications.filter(q=>c.memberships.some(m=>m.id===q.membership_id));c.availability=c.availability.filter(v=>c.people.some(p=>p.id===v.person_id));c.access=Object.entries(a.caps).map(([department_id,x])=>({department_id,user_id:a.id,enabled:true,status:'active',can_manage_members:Boolean(x.members),can_manage_access:Boolean(x.access),can_handle_requests:Boolean(x.requests)}));return c;
 }
 async function protectedRpc(token,church,name,b={}){await seeded;const a=account(token);if(!a||(church!=='IASD_PI'&&name!=='iasdpi_my_churches'))fail('Sessão inválida ou igreja não autorizada.');
  if(window.IASDPIG6Preview?.rpc){const r=await IASDPIG6Preview.rpc(a,name,b);if(r?.handled)return r.value;}
  if(name==='iasdpi_my_churches')return a.globalRole||Object.values(a.caps).some(c=>c.view)?[{id:'1a5d0000-0000-4000-8000-000000000001',code:'IASD_PI',name:'IASD Parada Inglesa',is_admin:a.globalRole==='admin'}]:[];
  if(name==='iasdpi_schedule_catalog')return catalog(a);
  if(name==='iasdpi_portal_context'){const c=await catalog(a);return {actor_id:a.id,is_admin:c.is_admin,departments:c.departments.map(d=>({...d,can_manage_access:cap(a,d.id,'access'),can_handle_requests:cap(a,d.id,'requests')}))};}
  if(name==='iasdpi_governance_catalog'){const c=await catalog(a);if(!c.is_admin&&!c.departments.some(d=>cap(a,d.id,'members')||cap(a,d.id,'access')||cap(a,d.id,'requests')))fail('Gestão de acessos não autorizada.');return {actor_id:a.id,is_admin:c.is_admin,church_id:'1a5d0000-0000-4000-8000-000000000001',departments:c.departments.map(d=>({id:d.id,name:d.name,can_access:cap(a,d.id,'access'),can_requests:cap(a,d.id,'requests'),can_members:cap(a,d.id,'members')})),users:accounts.filter(u=>c.is_admin||Object.keys(u.caps).some(d=>cap(a,d,'members'))).map(u=>({user_id:u.id,name:u.name,role:u.globalRole||null,status:u.enabled?'active':'revoked'})),access:[],aliases:c.is_admin?accounts.map(u=>({identifier:u.alias,user_id:u.id,version:1,enabled:u.enabled})):[]};}
  if(name==='iasdpi_access_requests')return a.globalRole==='admin'?copy(queue):[];
  if(name==='iasdpi_governance_history')return copy(audit.filter(r=>a.globalRole==='admin'||r.actor_id===a.id));
  if(['iasdpi_list_users','iasdpi_list_invites','iasdpi_find_account'].includes(name)){if(a.globalRole!=='admin')fail('Somente administrador da igreja.');return name==='iasdpi_find_account'?accounts.filter(u=>u.email===b.p_email).map(u=>({user_id:u.id,email:u.email,confirmed:true,authorized:true})):[];}
  if(name==='iasdpi_department_members'){if(!cap(a,b.p_department,'members'))fail('Sem administração de membros.');const c=await catalog(a);return c.memberships.filter(m=>m.department_id===b.p_department).map(m=>({...m,name:c.people.find(p=>p.id===m.person_id).display_name}));}
  if(['iasdpi_department_access_save','iasdpi_identity_state_save','iasdpi_set_access','iasdpi_alias_save','iasdpi_access_request_review'].includes(name)){
   if(a.globalRole!=='admin')fail('Somente administrador da igreja.');const target=accounts.find(u=>u.id===(b.p_user||b.p_user_id));
   if(name==='iasdpi_department_access_save'){if(!target)fail('Conta não identificada.');target.caps[b.p_department]=b.p_status==='active'?copy(b.p_flags):{};}
   else if(name==='iasdpi_identity_state_save'||name==='iasdpi_set_access'){if(!target)fail('Conta não identificada.');if(target.globalRole==='admin'&&(b.p_status&&b.p_status!=='active'||b.p_role&&b.p_role!=='admin')&&accounts.filter(u=>u.enabled&&u.globalRole==='admin').length===1)fail('Preserve o último administrador.');if(name==='iasdpi_identity_state_save')target.enabled=b.p_status==='active';else target.globalRole=b.p_role;}
   else if(name==='iasdpi_alias_save')fail('Use a prévia G3 para alteração de apelidos; identidades G4 são fixas para homologação.');
   else Object.assign(queue.find(q=>q.id===b.p_id)||{}, {status:b.p_status,verification:b.p_verification,version:b.p_expected_version+1});
   audit.unshift({actor_id:a.id,action:name,created_at:new Date().toISOString()});return null;
  }
  const old=[...store.plans.values()].find(p=>p.id===b.p_id);let d=b.p_department||b.p_data?.department_id||old?.department_id;
  if(name==='iasdpi_schedule_plan_version')d=[...store.plans.values()].find(p=>p.id===b.p_id)?.department_id;
  if(name==='iasdpi_schedule_save'){const c=await raw('iasdpi_schedule_catalog'),table={person:'people',membership:'memberships',role:'roles',availability:'availability'}[b.p_entity],row=c[table]?.find(x=>x.id===b.p_id);d=row?.department_id||d;if(a.globalRole!=='admin'&&!cap(a,d,'members'))fail('Sem administração deste cadastro.');if(b.p_entity==='access')fail('Use Gestão de acessos.');}
  else if(name==='iasdpi_schedule_elder_save'){if(b.p_status==='published'&&!cap(a,d,'publish'))fail('Sem publicação do Ancionato.');for(const row of b.p_rows){const old=[...store.elderPeriods.values()].find(p=>p.id===row.id);if((b.p_status!=='published'||row.person_id!==old?.person_id)&&!cap(a,d,'edit'))fail('Sem edição do Ancionato.');if(old?.status==='published'&&!cap(a,d,'publish'))fail('Sem revisão publicada.');}}
  else if(name==='iasdpi_schedule_plan_save'){
   if((b.p_data.status==='published'||old?.status==='published')&&!cap(a,d,'publish'))fail('Sem permissão para publicar.');if(Object.keys(b.p_data).some(k=>k!=='status')&&!cap(a,d,'edit'))fail('Sem permissão para editar.');if(b.p_data.status!=='published'&&!cap(a,d,'edit'))fail('Sem edição.');
   b={...b,p_data:{...copy(old||{}),...copy(b.p_data)}};
  }else if(['iasdpi_schedule_generate_days','iasdpi_schedule_daily_role','iasdpi_schedule_event_create'].includes(name)){if(!cap(a,d,'edit'))fail('Sem edição deste departamento.');}
  else if(['iasdpi_schedule_settings_save','iasdpi_schedule_members','iasdpi_schedule_member_save','iasdpi_schedule_exception_save','iasdpi_schedule_person_details','iasdpi_schedule_person_history'].includes(name)){if(a.globalRole!=='admin')fail('Somente administrador da igreja.');}
  else if(!['iasdpi_schedule_settings_get','iasdpi_schedule_exceptions'].includes(name)&&!cap(a,d,'view'))fail('Departamento não autorizado.');
  if(name==='iasdpi_schedule_daily_role'){const c=await raw('iasdpi_schedule_catalog');return c.roles.find(r=>r.department_id===d&&r.general_assignment);}
  if(name==='iasdpi_schedule_exceptions'&&a.globalRole!=='admin')return [];
  const result=await raw(name,b);if(name==='iasdpi_schedule_elder_save')for(const row of result.periods){const version=store.elderPeriodVersions.find(v=>v.id===row.id&&v.version===row.version);if(version)version.actor_id=a.id;}if(name==='iasdpi_schedule_workspace')result.settings={...result.settings,simplified_daily:true};return result;
 }
 async function published(month){await seeded;const c=await raw('iasdpi_schedule_catalog'),result=[];for(const versions of store.versions.values()){const p=versions.filter(v=>v.status==='published'&&v.month===month).sort((a,b)=>b.version-a.version)[0];if(!p)continue;for(const r of p.requirements)for(const assignment of r.assignments){const e=store.events.find(e=>e.id===r.event_id);result.push({id:'published:'+p.id+':'+assignment.id,date:e.scheduled_on,department_id:p.department_id,department:c.departments.find(d=>d.id===p.department_id).name,person:c.people.find(person=>person.id===assignment.person_id).display_name,role:c.roles.find(role=>role.id===r.role_id).name,origin:'Escala publicada no sistema',version:p.version,published_at:'2026-10-30T12:00:00Z'});}}const latest=new Map();for(const p of store.elderPeriodVersions||[])if(p.status==='published')latest.set(p.id,p);for(const p of latest.values())if(p.starts_on<month.slice(0,7)+'-32'&&p.ends_on>=month)result.push({id:'elder:'+p.id,date:p.starts_on,startDate:p.starts_on,endDate:p.ends_on,kind:p.kind,department_id:p.department_id,department:'Ancionato',person:c.people.find(x=>x.id===p.person_id)?.display_name||'',role:p.kind==='weekly'?'Ancião da Semana':'Ancião do Mês',version:p.version,published_at:p.captured_at,origin:'Escala publicada no sistema'});return result;}
 delete window.IASDPICalendarManagedPeriodsSource;
 // O caminho usado pelos componentes também passa pela autorização simulada.
 IASDPISchedulePreview.request=async(name,b={})=>{const identity=await IASDPIAuth.requireIdentity();return protectedRpc(identity.token,IASDPIChurches.selected(),name,b);};
 const jwt=a=>{const encode=v=>btoa(JSON.stringify(v)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');return encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:a.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),role:'authenticated',aud:'authenticated'})+'.fictitious-signature';};
 const session=a=>({access_token:jwt(a),refresh_token:'fictitious-refresh-'+a.id,token_type:'bearer',expires_in:3600,user:{id:a.id,email:a.email,is_anonymous:false}});
 window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url);if(url.origin!=='https://g4demo.supabase.co')throw Error('Rede externa bloqueada na demonstração.');const headers=new Headers(options.headers),token=(headers.get('authorization')||'').replace(/^Bearer /,''),a=account(token),body=options.body?JSON.parse(options.body):{};const path=url.pathname;
  try{
   if(path==='/rest/v1/rpc/iasdpi_list_churches')return Response.json([{id:'1a5d0000-0000-4000-8000-000000000001',code:'IASD_PI',name:'IASD Parada Inglesa'}]);
   if(path==='/functions/v1/alias-login'||path==='/auth/v1/token'){let user;if(url.search.includes('refresh_token'))user=accounts.find(a=>body.refresh_token==='fictitious-refresh-'+a.id&&a.enabled);else user=accounts.find(a=>a.enabled&&(body.identifier===a.alias||body.email===a.email)&&body.password===password);if(!user)return Response.json({error:'Identificação ou senha inválida.'},{status:400});current=user;return Response.json(path.startsWith('/functions/')?{access_token:jwt(user),refresh_token:'fictitious-refresh-'+user.id}:session(user));}
   if(path==='/auth/v1/user'){if(!a)return Response.json({error:'Sessão expirada.'},{status:401});current=a;return Response.json({id:a.id,email:a.email,is_anonymous:false});}
   if(path==='/auth/v1/logout'){current=null;return new Response(null,{status:204});}
   if(path==='/rest/v1/iasdpi_access')return Response.json(a?.globalRole?[{user_id:a.id,role:a.globalRole,enabled:a.enabled}]:[]);
   if(path==='/rest/v1/iasdpi_templates'||path==='/rest/v1/culto_archives')return Response.json([]);
   if(path==='/rest/v1/rpc/iasdpi_schedule_published')return Response.json(await published(body.p_month));
   if(path==='/rest/v1/rpc/iasdpi_access_request_options'){const c=await raw('iasdpi_schedule_catalog');return Response.json(c.departments.map(({id,name})=>({id,name})));}
   if(path==='/functions/v1/access-assistance'&&body.action==='submit'){queue.unshift({id:body.id,requester_name:body.name,identifier:body.identifier,kind:body.kind,status:'pending',version:1,message:body.message,created_at:new Date().toISOString(),can_reset:false});return Response.json({accepted:true},{status:202});}
   if(path.startsWith('/rest/v1/rpc/')){const result=await protectedRpc(token,headers.get('x-iasdpi-church'),path.split('/').pop(),body);return result===undefined||result===null?new Response(null,{status:204}):Response.json(result);}
   return Response.json({error:'Operação fora da prévia.'},{status:404});
  }catch(e){return Response.json({code:e.code||'23514',message:e.message},{status:403});}
 };
 delete window.IASDPICalendarSource;
 window.XMLHttpRequest=class{open(){throw Error('Rede externa bloqueada.');}};window.WebSocket=class{constructor(){throw Error('Rede externa bloqueada.');}};
 document.querySelectorAll('.demo-banner').forEach(b=>b.remove());
 document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.demo-banner').forEach(b=>{if(b.textContent.startsWith('ARMAZENAMENTO LOCAL ·'))b.remove();});});
 document.querySelector('.header').insertAdjacentHTML('afterend',`<aside class="demo-banner">HOMOLOGAÇÃO G4 — CONTAS E ALTERAÇÕES FICTÍCIAS. Sem conexão com Supabase. As alterações das escalas reiniciam ao recarregar.<details id="g4-demo-accounts"><summary>Contas fictícias para testar</summary><p>Senha de todos os exemplos: <code>${password}</code></p><ul>${accounts.map(a=>`<li><strong>${a.alias}</strong> · ${a.name}</li>`).join('')}</ul></details></aside>`);
 if(window.IASDPIG6Preview)Object.assign(IASDPIG6Preview,{accounts,audit,queue,raw,cap,id,jwt,session});
 window.IASDPIG4Demo={ready:seeded,accounts:()=>accounts.map(({id,alias,name})=>({id,alias,name})),revoke:alias=>{const a=accounts.find(a=>a.alias===alias);if(a)a.enabled=false;window.dispatchEvent(new Event('iasdpi-auth-changed'));},request:protectedRpc};
})();
