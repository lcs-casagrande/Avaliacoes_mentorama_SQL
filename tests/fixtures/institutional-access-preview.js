'use strict';
// G12 institucional: mesmas pessoas, IDs e stores; contas/credenciais apenas em memória.
(()=>{
 const g=IASDPIG6Preview,c=IASDPIKnownPreviewSeed.catalog,prior=g.rpc,fetchBefore=window.fetch,slots=new Map(),legacyCaps=new Map(),managedUsers=new Set();
 const copy=v=>structuredClone(v),ok=value=>({handled:true,value}),admin=a=>a?.enabled&&a.globalRole==='admin',deny=m=>{throw Error(m);};
 window.IASDPIConfig=Object.freeze({...IASDPIConfig,institutionalAccessEnabled:true,storageNamespace:'iasdpi-institutional-g12-v1'});
 const audit=(a,action,id,before,after)=>g.audit.unshift({actor_id:a.id,action,target_id:id,created_at:new Date().toISOString(),details:{entity:'institutional_access',before,after}});
 const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
 const unique=base=>{let name=base,n=2;while(slots.has(name))name=base+'_'+n++;return name;};
 const makeDept=d=>{if([...slots.values()].some(r=>r.department_id===d.id&&r.kind==='department'))return;const identifier=unique(slug(d.code)),person=c.people.find(p=>p.active&&c.memberships.some(m=>m.person_id===p.id&&m.department_id===d.id&&m.active&&m.is_ministry_head));const r={identifier,label:d.name,kind:'department',department_id:d.id,person_id:person?.id||null,user_id:person?.auth_user_id||null,departments:[d.id],approve_general:false,credential_pending:false,version:1};slots.set(identifier,r);};
 const ready=(async()=>{await IASDPIG11Demo.ready;
 const names=[...churchMinistries.map(d=>d.name),...churchOrganization.flatMap(e=>e.departments.map(name=>organizationDepartmentNames[name]||name))],codes={'Ministério da Música':'musica','Ministério da Família':'ministerio-da-familia','Ministério da Criança':'ministerio-da-crianca'};
 for(const name of new Set(names)){if(name.startsWith('Diaconato'))continue;const code=codes[name]||slug(name).replaceAll('_','-');if(!c.departments.some(d=>d.code===code||d.name===name))c.departments.push({id:crypto.randomUUID(),code,name,active:true,version:1,can_manage:true,can_roster:true});}
 for(const d of c.departments){makeDept(d);if(!c.roles.some(r=>r.department_id===d.id))c.roles.push({id:crypto.randomUUID(),department_id:d.id,name:'Participação no departamento',active:true,general_assignment:true,default_required_count:1,version:1});}
 const diaconato=c.departments.find(d=>d.code==='diaconato');for(const [identifier,label] of [['diaconato_diaconisas','Diaconato — Diaconisas'],['diaconato_diaconos','Diaconato — Diáconos']])slots.set(identifier,{identifier,label,kind:'position',department_id:diaconato.id,person_id:null,user_id:null,departments:[diaconato.id],approve_general:false,version:1});
const elder=c.departments.find(d=>d.code==='ancionato');let n=0;for(const p of c.people.filter(p=>p.active&&c.memberships.some(m=>m.person_id===p.id&&m.department_id===elder.id&&m.active)).sort((a,b)=>a.display_name.localeCompare(b.display_name,'pt-BR'))){const u=g.accounts.find(a=>a.id===p.auth_user_id);slots.set('anciao_'+(++n),{identifier:'anciao_'+n,label:'Ancião',kind:'elder',person_id:p.id,user_id:u?.id||null,departments:[elder.id],approve_general:Boolean(u?.approveGeneral),credential_pending:false,version:1});}
 const a=g.accounts.find(a=>a.alias==='admin.iasdpi');slots.set('admin',{identifier:'admin',label:'Administrador',kind:'admin',user_id:a.id,person_id:c.people.find(p=>p.auth_user_id===a.id)?.id||null,departments:[],approve_general:false,version:1});
 const member={id:crypto.randomUUID(),alias:'membro',name:'Membro · leitura compartilhada',enabled:true,caps:{},sharedReader:true,demoPassword:'Demonstracao#2026'};for(const d of c.departments.filter(d=>d.active))member.caps[d.id]={view:true};g.accounts.push(member);slots.set('membro',{identifier:'membro',label:'Membros · somente conteúdo publicado',kind:'member',shared:true,person_id:null,user_id:member.id,departments:Object.keys(member.caps),approve_general:false,credential_pending:false,version:1});
 for(const a of g.accounts)legacyCaps.set(a.id,copy(a.caps));
 for(const r of slots.values())if(r.user_id){const aliases=IASDPIG6Demo.aliases(),old=aliases.find(a=>a.identifier===r.identifier);await prior(g.accounts.find(a=>a.globalRole==='admin'),'iasdpi_alias_save',{p_identifier:r.identifier,p_user_id:r.user_id,p_enabled:true,p_expected_version:old?.version||0,p_reason:'Login institucional da homologação'});}
 })();
 const person=id=>c.people.find(p=>p.id===id&&p.active&&!p.merged_into);
 async function reconcile(a,uid){if(!uid)return;if(!managedUsers.has(uid)&&![...slots.values()].some(r=>r.user_id===uid))return;managedUsers.add(uid);const u=g.accounts.find(a=>a.id===uid);if(!u)return;u.caps={};u.approveGeneral=false;for(const r of slots.values())if(r.user_id===uid&&!r.archived){for(const d of r.departments.filter(id=>c.departments.some(d=>d.id===id&&d.active))){u.caps[d]={...u.caps[d],view:true,...(r.kind==='member'?{}:{edit:true,publish:true})};}if(r.kind==='elder'&&r.approve_general)u.approveGeneral=true;if(r.kind==='admin')u.globalRole='admin';}}
 g.rpc=async(a,name,b)=>{await ready;
  if(name==='iasdpi_registry_save'&&!admin(a)&&(b.p_links||[]).some(link=>Object.hasOwn(link.patch,'is_ministry_head')||Object.hasOwn(link.patch,'leadership_scope')))deny('Somente administrador altera responsáveis ministeriais.');
  if(name==='iasdpi_alias_save'&&slots.has(b.p_identifier))deny('Use a tabela institucional para este login.');
  const shared=g.accounts.find(u=>u.id===(b.p_user||b.p_user_id))?.sharedReader;
  if(shared&&(name==='iasdpi_set_access'||['iasdpi_governance_permission_save','iasdpi_department_access_save'].includes(name)&&(Object.entries(b.p_flags||{}).some(([k,v])=>k!=='view'&&v)||b.p_approve_general)))deny('Conta membro compartilhada não pode receber gestão.');
  if(name.startsWith('iasdpi_institutional_')){
   if(!admin(a))deny('Somente administrador pode alterar responsáveis e permissões.');
   if(name==='iasdpi_institutional_catalog'){for(const d of c.departments)makeDept(d);return ok({is_admin:true,people:c.people.filter(p=>!p.merged_into).map(p=>({id:p.id,display_name:p.display_name,active:p.active})),departments:copy(c.departments),slots:[...slots.values()].map(r=>({...copy(r),archived:['department','position'].includes(r.kind)&&!c.departments.find(d=>d.id===r.department_id)?.active})).sort((x,y)=>x.identifier.localeCompare(y.identifier,'pt-BR',{numeric:true}))});}
   if(name==='iasdpi_institutional_department_save'){
    const d=c.departments.find(d=>d.id===b.p_id);if((d?.version||0)!==b.p_expected_version)deny('Departamento alterado; recarregue.');if(typeof b.p_name!=='string'||b.p_name.trim().length<2||c.departments.some(x=>x.id!==b.p_id&&slug(x.name)===slug(b.p_name)))deny('Nome de departamento inválido ou já cadastrado.');
    const before=copy(d||{});if(d)Object.assign(d,{name:b.p_name.trim(),active:b.p_active,version:d.version+1});else{const code=unique(slug(b.p_name)).replaceAll('_','-');c.departments.push({id:b.p_id,code,name:b.p_name.trim(),active:true,version:1,can_manage:true,can_roster:true});c.roles.push({id:crypto.randomUUID(),department_id:b.p_id,name:'Participação no departamento',active:true,general_assignment:true,default_required_count:1,version:1});}const after=c.departments.find(d=>d.id===b.p_id);makeDept(after);for(const r of slots.values())if(r.department_id===after.id){r.archived=!after.active;if(r.kind==='department')r.label=after.name;}for(const u of g.accounts)await reconcile(a,u.id);audit(a,'department_'+(after.active?'saved':'archived'),after.id,{active:before.active},{active:after.active});return ok(copy(after));
   }
   const r=slots.get(b.p_identifier);if(!r||r.archived||r.version!==b.p_expected_version)deny('Linha alterada ou arquivada; recarregue.');
   if(name==='iasdpi_institutional_save'){
    if(Object.keys(b).some(k=>!['p_identifier','p_expected_version','p_person','p_departments','p_approve_general','p_confirm_reset','p_confirm_elevated'].includes(k)))deny('Campos não autorizados.');
    const p=b.p_person?person(b.p_person):null;if(b.p_person&&!p)deny('Selecione uma pessoa ativa do Cadastro Geral.');if(!Array.isArray(b.p_departments)||new Set(b.p_departments).size!==b.p_departments.length||b.p_departments.some(id=>!c.departments.some(d=>d.id===id&&d.active)))deny('Departamento inválido.');
    const changed=(r.person_id||null)!==(p?.id||null);if(changed&&!b.p_confirm_reset)deny('Troca exige redefinição e revogação das sessões.');if(b.p_approve_general&&(r.kind!=='elder'||!b.p_confirm_elevated&&!r.approve_general))deny('Aprovação geral exige ancião e confirmação explícita.');if(r.kind==='admin'&&changed&&!b.p_confirm_elevated)deny('Confirme controle administrativo completo.');
    if(b.p_approve_general&&!c.departments.some(d=>d.code==='ancionato'&&b.p_departments.includes(d.id)))deny('Inclua o Ancionato para autorizar aprovação geral.');
    if(r.kind==='elder'&&p&&!c.memberships.some(m=>m.person_id===p.id&&m.active&&c.departments.find(d=>d.id===m.department_id)?.code==='ancionato'))deny('Confirme primeiro o vínculo do responsável com o Ancionato.');if(r.kind==='admin'&&!p)deny('O administrador deve ser preservado.');
    const before={person_id:r.person_id,version:r.version},oldUser=r.user_id;let u=g.accounts.find(a=>a.id===p?.auth_user_id);
    if(r.kind==='member')u=g.accounts.find(a=>a.id===r.user_id);
    else if(p&&!u){u={id:crypto.randomUUID(),name:p.display_name,alias:'individual.'+crypto.randomUUID(),email:'individual.'+crypto.randomUUID()+'@example.invalid',enabled:true,caps:{},mustChange:true,demoPassword:crypto.randomUUID()+'!Provisoria'};g.accounts.push(u);p.auth_user_id=u.id;p.version++;legacyCaps.set(u.id,{});}
    const beforeAlias=IASDPIG6Demo.aliases().find(a=>a.identifier===r.identifier);if(u)await prior(a,'iasdpi_alias_save',{p_identifier:r.identifier,p_user_id:u.id,p_enabled:true,p_expected_version:beforeAlias?.version||0,p_reason:'Responsável institucional confirmado pelo administrador'});else if(beforeAlias)await prior(a,'iasdpi_alias_save',{p_identifier:r.identifier,p_user_id:null,p_enabled:false,p_expected_version:beforeAlias.version,p_reason:'Responsável institucional removido pelo administrador'});
    Object.assign(r,{person_id:p?.id||null,user_id:u?.id||null,departments:r.kind==='admin'?[]:[...b.p_departments],approve_general:r.kind==='elder'&&b.p_approve_general,credential_pending:changed||Boolean(r.credential_pending)||u?.id!==oldUser,version:r.version+1});
    if(['department','position'].includes(r.kind)&&changed){for(const m of c.memberships.filter(m=>m.department_id===r.department_id&&m.person_id===before.person_id))m.is_ministry_head=false;if(p){let m=c.memberships.find(m=>m.department_id===r.department_id&&m.person_id===p.id);if(!m){m={id:crypto.randomUUID(),person_id:p.id,department_id:r.department_id,active:true,version:1,participation_confirmed:false};c.memberships.push(m);}m.is_ministry_head=true;}}
    if(oldUser)managedUsers.add(oldUser);if(u)managedUsers.add(u.id);await reconcile(a,oldUser);await reconcile(a,u?.id);if(changed)for(const id of new Set([oldUser,u?.id].filter(Boolean))){const who=g.accounts.find(a=>a.id===id);who.mustChange=true;who.minimumIat=Math.floor(Date.now()/1000);}
    audit(a,'institutional_access_saved',r.identifier,before,{person_id:r.person_id,version:r.version});return ok(copy(r));
   }
   deny('Operação institucional desconhecida.');
  }
  if(a.sharedReader&&!['iasdpi_my_churches','iasdpi_portal_context','iasdpi_password_change_context'].includes(name))deny('Conta membro: somente escalas publicadas autorizadas.');
  const result=await prior(a,name,b);return result;
 };
 const actor=opts=>{try{const token=new Headers(opts.headers).get('authorization')?.split(' ')[1],claims=JSON.parse(atob(token.split('.')[1]));return g.accounts.find(a=>a.enabled&&a.id===claims.sub&&claims.exp>Date.now()/1000&&(!a.minimumIat||claims.iat>a.minimumIat));}catch{return null;}};
 window.fetch=async(input,opts={})=>{await ready;const url=new URL(typeof input==='string'?input:input.url),name=url.pathname.split('/').pop(),a=actor(opts),b=JSON.parse(opts.body||'{}');
  if(url.origin!=='https://g4demo.supabase.co')return fetchBefore(input,opts);
  if(name==='iasdpi_portal_context'&&a?.sharedReader)return Response.json({actor_id:a.id,is_admin:false,published_only:true,departments:c.departments.filter(d=>d.active&&a.caps[d.id]?.view).map(d=>({...copy(d),can_edit:false,can_publish:false,can_manage_members:false}))});
  if(a?.sharedReader&&name==='iasdpi_events_visible')return fetchBefore('https://g4demo.supabase.co/rest/v1/rpc/iasdpi_events_published',{...opts,headers:{'Content-Type':'application/json','x-iasdpi-church':'IASD_PI'},body:opts.body});
  if(a?.sharedReader&&url.pathname.startsWith('/rest/')&&!['iasdpi_my_churches','iasdpi_schedule_visible','iasdpi_events_published','iasdpi_registry_public','iasdpi_password_change_context','iasdpi_events_visible'].includes(name))return Response.json({message:'Conta membro: somente conteúdo publicado.'},{status:403});
  if(url.pathname==='/functions/v1/access-assistance'&&b.action==='institutional_reset'){
   const r=slots.get(b.identifier);if(!admin(a)||b.church!=='IASD_PI'||!r?.user_id||!r.person_id||r.version!==b.version)return Response.json({message:'Redefinição não autorizada.'},{status:403});if(r.user_id===a.id)return Response.json({self_change:true});
   const target=g.accounts.find(u=>u.id===r.user_id);target.mustChange=true;r.credential_pending=true;
   const request={id:crypto.randomUUID(),requester_name:person(r.person_id)?.display_name||'Custódia membro',identifier:r.identifier,kind:'password',target_user_id:r.user_id,department_id:r.department_id||null,status:'verified',version:1,created_at:new Date().toISOString(),verification:'Identidade confirmada pelo administrador'};g.queue.unshift(request);
   return fetchBefore('https://g4demo.supabase.co/functions/v1/access-assistance',{...opts,body:JSON.stringify({action:'issue',church:'IASD_PI',request_id:request.id,version:1})});
  }
  const result=await fetchBefore(input,opts);
  if(name==='iasdpi_registry_public'&&result.ok){const data=await result.json();return Response.json({...data,departments:c.departments.map(d=>({id:d.id,code:d.code,name:d.name,active:d.active}))});}
  if(result.ok&&url.pathname==='/functions/v1/access-assistance'&&b.action==='complete'){for(const r of slots.values()){const request=g.queue.find(q=>q.identifier===r.identifier&&q.status==='resolved');if(request){const u=g.accounts.find(u=>u.id===r.user_id);if(u)u.mustChange=false;r.credential_pending=false;}}}
  return result;
 };
 document.querySelector('#g4-demo-accounts ul')?.insertAdjacentHTML('beforeend','<li><strong>admin</strong> · Administração institucional</li><li><strong>membro</strong> · Somente escalas publicadas autorizadas</li>');
 window.IASDPIInstitutionalDemo={ready,slots,hasResponsibility:a=>a?.enabled&&[...slots.values()].some(r=>r.user_id===a.id&&['department','position','elder'].includes(r.kind)&&!r.archived&&(r.kind==='elder'?c.departments.some(d=>d.code==='ancionato'&&g.cap(a,d.id,'view')):r.departments.includes(r.department_id)&&g.cap(a,r.department_id,'view')))};
})();
