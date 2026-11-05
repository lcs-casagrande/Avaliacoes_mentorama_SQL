'use strict';
// G11/G12: servidor exclusivamente fictício, memória desta aba e CSP sem rede.
(()=>{
 const g=IASDPIG6Preview,c=IASDPIKnownPreviewSeed.catalog,priorRpc=g.rpc,priorFetch=window.fetch,copy=v=>structuredClone(v),events=IASDPIE1Demo;
 const decisionReceipts=new Map(),submitReceipts=new Map(),kinds=new Map(),pending=new Map();
 window.IASDPIConfig=Object.freeze({...IASDPIConfig,governanceAdministrationEnabled:true,responsibilityGovernanceEnabled:true,storageNamespace:'iasdpi-g12-preview-v1'});
 const admin=a=>a?.enabled&&a.globalRole==='admin',approver=a=>admin(a)||a?.enabled&&a.approveGeneral&&c.departments.some(d=>d.code==='ancionato'&&g.cap(a,d.id,'view'));
 const safe=row=>row?Object.fromEntries(['name','display_name','active','status','approval_status','version','title','can_view','can_edit','can_publish','can_manage_members','responsibility_kind','can_approve_general_events'].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]])):{};
 const deny=message=>{const e=Error(message);e.code='42501';throw e;},ok=value=>({handled:true,value});
 const audit=(a,action,target_id,before={},after={})=>g.audit.unshift({id:crypto.randomUUID(),actor_id:a.id,action,target_id,created_at:new Date().toISOString(),details:{entity:action.startsWith('event')?'event':'account',before,after}});
 const personFor=a=>c.people.find(p=>p.auth_user_id===a.id);
 const ready=(async()=>{await IASDPIG84Demo.ready;for(const [alias,name] of [['som.iasdpi','Luan Vaz'],['musica.iasdpi','Alexandre'],['anciao.iasdpi','Raphael Moreira']]){const a=g.accounts.find(a=>a.alias===alias),p=c.people.find(p=>p.name===name);if(a&&p&&!p.auth_user_id){p.auth_user_id=a.id;a.name=p.display_name;for(const m of c.memberships.filter(m=>m.person_id===p.id)){if(a.caps[m.department_id]){kinds.set(a.id+':'+m.department_id,alias==='anciao.iasdpi'?'elder':'leader');if(alias!=='anciao.iasdpi')m.is_ministry_head=true;}}}if(a&&alias==='anciao.iasdpi')a.approveGeneral=true;}const h=c.people.find(p=>p.name==='Henrique Franco'),d=c.departments.find(d=>d.code==='comunicacao');if(h&&d){const m=c.memberships.find(m=>m.person_id===h.id&&m.department_id===d.id);if(m)m.is_ministry_head=true;}})();
 g.rpc=async(a,name,b)=>{await ready;
  if(name==='iasdpi_password_change_context')return ok({must_change_password:Boolean(a.mustChange),aliases:IASDPIG6Demo.aliases().filter(r=>r.user_id===a.id).map(r=>r.identifier)});
  const administrative=['iasdpi_governance_catalog','iasdpi_governance_history','iasdpi_access_requests','iasdpi_alias_list','iasdpi_alias_save','iasdpi_department_access_save','iasdpi_account_link','iasdpi_account_state_save','iasdpi_governance_permission_save','iasdpi_account_creation_cancel'];
  if(a.mustChange&&name!=='iasdpi_my_churches')deny('Altere a senha provisória antes de acessar os módulos.');
  if(administrative.includes(name)&&!admin(a))deny('Somente o administrador gerencia acessos e auditoria.');
  if(name==='iasdpi_governance_catalog'){
   const result=(await priorRpc(a,name,b)).value;
   const aliases=IASDPIG6Demo.aliases();return ok({...result,administration_version:11,people:c.people.filter(p=>!p.merged_into).map(p=>({...copy(p),memberships:c.memberships.filter(m=>m.person_id===p.id).map(m=>({...copy(m),department:c.departments.find(d=>d.id===m.department_id)?.name}))})),
    account_plan:c.people.filter(p=>p.active&&!p.merged_into&&c.memberships.some(m=>m.person_id===p.id&&m.active&&(m.is_ministry_head||kinds.get(p.auth_user_id+':'+m.department_id)==='elder'))).map(p=>({person_id:p.id,name:p.display_name,auth_user_id:p.auth_user_id,suggested_alias:p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.iasdpi',departments:c.memberships.filter(m=>m.person_id===p.id).map(m=>c.departments.find(d=>d.id===m.department_id))})),
    users:g.accounts.map(u=>({user_id:u.id,name:personFor(u)?.display_name||u.name,person_id:personFor(u)?.id,person_version:personFor(u)?.version,role:u.globalRole||null,status:u.enabled?(u.status||'active'):(u.status||'revoked'),must_change_password:Boolean(u.mustChange),last_sign_in_at:u.lastSignIn||null,departments:Object.keys(u.caps).map(id=>({id,name:c.departments.find(d=>d.id===id)?.name||id,status:result.access.find(row=>row.user_id===u.id&&row.department_id===id)?.status||'active'}))})),aliases,
    access:result.access.map(row=>({...row,responsibility_kind:kinds.get(row.user_id+':'+row.department_id)||'manual',can_approve_general_events:Boolean(g.accounts.find(u=>u.id===row.user_id)?.approveGeneral&&c.departments.find(d=>d.id===row.department_id)?.code==='ancionato')})),pending_accounts:[...pending.values()]});
  }
  if(name==='iasdpi_account_link'){
   const p=c.people.find(p=>p.id===b.p_person),u=g.accounts.find(u=>u.id===b.p_user);if(!p||!u||p.version!==b.p_expected_version||p.auth_user_id&&p.auth_user_id!==u.id||c.people.some(other=>other.id!==p.id&&other.auth_user_id===u.id))deny('Pessoa, identidade ou versão incompatível.');p.auth_user_id=u.id;p.version++;u.name=p.display_name;audit(a,'account_linked',u.id,{}, {person_id:p.id});return ok(copy(p));
  }
  if(name==='iasdpi_account_state_save'){
   const target=g.accounts.find(u=>u.id===b.p_user);if(!target||!['active','suspended','revoked'].includes(b.p_status)||String(b.p_reason||'').trim().length<10)deny('Revise a identidade, situação e motivo.');
   if(target.globalRole==='admin'&&b.p_status!=='active'&&g.accounts.filter(u=>u.enabled&&u.globalRole==='admin').length===1)deny('Preserve o último administrador.');
   const before={status:target.status||(target.enabled?'active':'revoked')};target.status=b.p_status;target.enabled=b.p_status==='active';audit(a,'identity_'+b.p_status,target.id,before,{status:target.status});return ok(null);
  }
  if(name==='iasdpi_account_creation_cancel'){pending.delete(b.p_id);audit(a,'account_creation_cancelled',b.p_id);return ok(null);}
  if(name==='iasdpi_governance_permission_save'){
   const target=g.accounts.find(u=>u.id===b.p_user),p=target&&personFor(target),m=p&&c.memberships.find(m=>m.person_id===p.id&&m.department_id===b.p_department&&m.active),dep=c.departments.find(d=>d.id===b.p_department);
   if(b.p_status==='active'&&b.p_kind!=='manual'&&(!m||b.p_kind==='leader'&&!m.is_ministry_head||b.p_kind==='elder'&&!c.memberships.some(m=>m.person_id===p.id&&m.active&&c.departments.find(d=>d.id===m.department_id)?.code==='ancionato')))deny('Confirme a responsabilidade no Cadastro Geral.');
   if(b.p_approve_general&&(b.p_kind!=='elder'||dep?.code!=='ancionato'))deny('Aprovação geral exige Ancionato autorizado.');
   const before=(await priorRpc(a,'iasdpi_governance_catalog',{})).value.access.find(row=>row.user_id===b.p_user&&row.department_id===b.p_department),head=g.audit[0];
   const r=await priorRpc(a,'iasdpi_department_access_save',b);if(g.audit[0]!==head&&g.audit[0]?.action==='department_access_'+b.p_status)g.audit.shift();audit(a,'department_access_'+b.p_status,b.p_user,safe(before),{...safe(r.value),responsibility_kind:b.p_kind,can_approve_general_events:b.p_approve_general});kinds.set(b.p_user+':'+b.p_department,b.p_kind);if(dep.code==='ancionato')target.approveGeneral=b.p_status==='active'&&b.p_approve_general;return r;
  }
  return priorRpc(a,name,b);
 };
 // O atalho local de Escalas/Cadastro também deve alimentar a auditoria (não passa pelo fetch).
 const writeNames=['iasdpi_registry_save','iasdpi_schedule_plan_save','iasdpi_schedule_elder_save'],writeReceipts=new Set();
 const beforeWrite=(name,b)=>name==='iasdpi_registry_save'?safe(c.people.find(p=>p.id===b.p_person)):name==='iasdpi_schedule_plan_save'?safe([...IASDPIB1Preview.plans.values()].find(p=>p.id===b.p_id)):{};
 const recordWrite=(a,name,b,data,before)=>{const key=a.id+':'+name+':'+b.p_request_id;if(writeReceipts.has(key))return;writeReceipts.add(key);
  if(name==='iasdpi_registry_save'){audit(a,Object.keys(before).length?'person_updated':'person_created',b.p_person,before,safe(data.person));g.audit[0].details.entity='person';}
  if(name==='iasdpi_schedule_plan_save'){audit(a,data.status==='published'?'schedule_published':'schedule_draft',b.p_id,before,safe(data));g.audit[0].details.entity='schedule';}
  if(name==='iasdpi_schedule_elder_save')for(const row of data.periods||[]){audit(a,b.p_status==='published'?'elder_published':'schedule_draft',row.id,{},safe(row));g.audit[0].details.entity='schedule';}
 };
 const priorSchedule=IASDPISchedulePreview.request;
 IASDPISchedulePreview.request=async(name,b={})=>{await ready;const identity=await IASDPIAuth.requireIdentity(),a=g.accounts.find(a=>a.id===identity.user.id&&a.enabled);if(!a||a.mustChange)deny('Sessão autorizada e troca de senha necessárias.');const before=beforeWrite(name,b),result=await priorSchedule(name,b);if(writeNames.includes(name))recordWrite(a,name,b,result,before);return result;};
 const actor=options=>{try{const token=(new Headers(options.headers).get('authorization')||'').split(' ')[1],claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return g.accounts.find(a=>claims.exp>Date.now()/1000&&a.id===claims.sub&&a.enabled&&(!a.minimumIat||claims.iat>a.minimumIat));}catch{return null;}};
 const canGeneral=a=>admin(a)||window.IASDPIInstitutionalDemo?.hasResponsibility(a)||a&&[...kinds].some(([key,kind])=>key.startsWith(a.id+':')&&['leader','elder'].includes(kind)&&g.cap(a,key.slice(a.id.length+1),'view'));
 const preview=(data,exclude=[])=>{const rows=IASDPIEventPlanning.occurrences(data,IASDPIEventPlanning.yearEnd()),others=[...events.versions.values()].map(rows=>rows.filter(v=>['published','cancelled'].includes(v.status)).at(-1)).filter(v=>v?.status==='published'&&!exclude.includes(v.snapshot.id)).map(v=>v.snapshot),spaces=IASDPIEventPlanningDemo.spaces;const occurrences=rows.map(row=>({...row,reservation_conflicts:IASDPIEventPlanning.conflicts(row,others,spaces)}));return {until:IASDPIEventPlanning.yearEnd(),occurrences,conflict_count:occurrences.filter(row=>row.reservation_conflicts.length).length};};
 const version=(a,e,action,before={})=>{events.versions.set(e.id,[...(events.versions.get(e.id)||[]),{version:e.version,status:e.status,actor_id:a.id,captured_at:new Date().toISOString(),snapshot:copy(e)}]);audit(a,action,e.id,before, {status:e.status,approval_status:e.approval_status,version:e.version});};
 window.fetch=async(input,options={})=>{await ready;const url=new URL(typeof input==='string'?input:input.url),name=url.pathname.split('/').pop(),b=JSON.parse(options.body||'{}'),a=actor(options);
  if(url.origin!=='https://g4demo.supabase.co')return priorFetch(input,options);
  try{
   const publicRpc=['iasdpi_registry_public','iasdpi_schedule_published','iasdpi_events_published','iasdpi_access_request_options'];
   if(url.pathname.startsWith('/rest/v1/rpc/')&&name!=='iasdpi_list_churches'){
    if(new Headers(options.headers).get('x-iasdpi-church')!=='IASD_PI')deny('Igreja não autorizada.');
    if(!publicRpc.includes(name)&&(!a||a.mustChange&&!['iasdpi_password_change_context','iasdpi_my_churches'].includes(name)))deny('Sessão autorizada e troca de senha necessárias.');
   }
   if(url.pathname==='/functions/v1/alias-login'||url.pathname==='/auth/v1/token'&&url.search.includes('grant_type=password')){
    const alias=IASDPIG6Demo.aliases().find(r=>r.identifier===b.identifier&&r.enabled),target=b.identifier?g.accounts.find(u=>u.id===alias?.user_id):g.accounts.find(u=>u.email===b.email);
    if(target&&personFor(target)&&!Object.values(target.caps).some(f=>f.view)){
     if(!target.enabled||b.password!==target.demoPassword)deny('Identificação ou senha inválida.');
     const result=g.session(target),parts=result.access_token.split('.'),claims=JSON.parse(atob(parts[1]));claims.iat=Math.max(claims.iat,(target.minimumIat||0)+1);parts[1]=btoa(JSON.stringify(claims)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');result.access_token=parts.join('.');if(target.minimumIat)result.refresh_token+=':'+target.minimumIat;target.lastSignIn=new Date().toISOString();return Response.json(result);
    }
   }
   if(url.pathname==='/functions/v1/access-assistance'&&b.action==='issue'&&!admin(a))deny('Somente administrador pode emitir redefinição.');
   if(url.pathname==='/functions/v1/access-assistance'&&b.action==='create_account'){
    if(b.church!=='IASD_PI'||!admin(a))deny('Somente administrador da igreja selecionada.');const p=c.people.find(p=>p.id===b.person);if(!p||p.auth_user_id||p.version!==b.version)deny('Pessoa já vinculada ou alterada.');if(!/^[a-z][a-z0-9._-]{2,63}$/.test(b.identifier)||g.accounts.some(u=>u.alias===b.identifier))deny('Identificador já utilizado ou inválido.');
    const u={id:crypto.randomUUID(),name:p.display_name,alias:b.identifier,email:b.email||b.identifier+'@example.invalid',enabled:true,caps:{},mustChange:true,demoPassword:'ProvisoriaG11!'+crypto.randomUUID()};g.accounts.push(u);p.auth_user_id=u.id;p.version++;
    await priorRpc(a,'iasdpi_alias_save',{p_identifier:u.alias,p_user_id:u.id,p_enabled:true,p_expected_version:0,p_reason:'Conta fictícia individual de homologação'});audit(a,'account_created',u.id,{}, {person_id:p.id});return Response.json({completed:true,user_id:u.id,identifier:u.alias,password:u.demoPassword,credential_available:true});
   }
   if(url.pathname==='/functions/v1/access-assistance'&&b.action==='change_password'){
    if(!a||typeof b.password!=='string'||b.password.length<12||b.password.toLowerCase()===a.alias.toLowerCase())deny('Senha individual inválida.');a.demoPassword=b.password;a.mustChange=false;a.minimumIat=Math.floor(Date.now()/1000);audit(a,'own_password_changed',a.id);return Response.json({completed:true,login_required:true});
   }
   if(name==='iasdpi_governance_history'){if(!admin(a))deny('Auditoria exclusiva do administrador.');return Response.json(copy(g.audit).slice(b.p_offset||0,(b.p_offset||0)+50));}
   if(name==='iasdpi_event_preview'&&b.p_data?.program_category==='general'){if(!canGeneral(a))deny('Responsabilidade necessária.');return Response.json(preview(b.p_data,b.p_exclude));}
   if(['iasdpi_event_approve','iasdpi_event_reject'].includes(name)){
    if(!approver(a))deny('Aprovação exige ancião autorizado ou administrador.');const signature=JSON.stringify([a.id,name,b]);if(decisionReceipts.has(b.p_request_id)){const prior=decisionReceipts.get(b.p_request_id);if(prior.signature!==signature)deny('Solicitação já utilizada.');return Response.json(copy(prior.result));}const e=events.events.get(b.p_id);if(!e||e.version!==b.p_expected_version||e.approval_status!=='pending')deny('Evento alterado ou fora da fila.');
    if(name==='iasdpi_event_approve'&&preview({...e,recurrence:'none'},[e.id]).conflict_count)deny('Conflito de reserva.');const before=safe(e);e.status=name==='iasdpi_event_approve'?'published':'draft';e.approval_status=name==='iasdpi_event_approve'?'approved':'rejected';e.updated_by=a.id;e.version++;version(a,e,name==='iasdpi_event_approve'?'event_approved':'event_rejected',before);if(e.series_id){const root=IASDPIEventPlanningDemo.series.get(e.series_id);root.version++;root.approval_status=[...events.events.values()].some(row=>row.series_id===root.id&&row.approval_status==='pending')?'pending':e.approval_status;}decisionReceipts.set(b.p_request_id,{signature,result:copy(e)});return Response.json(copy(e));
   }
   if(['iasdpi_event_submit','iasdpi_event_series_save'].includes(name)){
    const seriesStore=IASDPIEventPlanningDemo,root=seriesStore.series.get(b.p_id),old=events.events.get(b.p_id),candidate={...(name==='iasdpi_event_series_save'?root?.definition:old),...b.p_patch};
    if(candidate.program_category==='general'){
     if(!canGeneral(a)||old&&old.created_by!==a.id&&!admin(a)||root&&root.created_by!==a.id&&!admin(a))deny('Evento geral de outra identidade.');
     const signature=JSON.stringify([a.id,name,b]),prior=submitReceipts.get(b.p_request_id);if(prior){if(prior.signature!==signature)deny('Solicitação já utilizada.');return Response.json(copy(prior.result));}
     if((name==='iasdpi_event_series_save'?root?.version||0:old?.version||0)!==b.p_expected_version)deny('Evento alterado.');
     const approval=candidate.status==='published'?(approver(a)?'approved':'pending'):'not_required',status=approval==='pending'?'draft':candidate.status;
     const write=(id,oldRow,data,meta={})=>{
      const e={...data,...meta,id,created_by:oldRow?.created_by||a.id,updated_by:a.id,created_at:oldRow?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),version:(oldRow?.version||0)+1,approval_status:approval,status};events.events.set(id,e);version(a,e,approval==='pending'?'event_submitted':status==='cancelled'?'event_cancelled':status==='published'?'event_published':'event_draft',safe(oldRow));return copy(e);
     };
     let result;
     if(name==='iasdpi_event_submit'){
      if(candidate.status==='published'&&preview({...candidate,recurrence:'none'},old?[old.id]:[]).conflict_count)deny('Conflito de reserva.');result={event:write(b.p_id,old,candidate)};
     }else{
      if(!['all','following'].includes(b.p_scope))deny('Abrangência inválida.');const selected=events.events.get(b.p_occurrence);if(b.p_scope==='following'&&selected?.series_id!==root?.id)deny('Ocorrência fora da série.');
      const cutoff=b.p_scope==='following'?selected.occurrence_on:null,existing=[...events.events.values()].filter(e=>e.series_id===root?.id&&(!cutoff||e.occurrence_on>=cutoff)),plan=preview({...candidate,recurrence_until:root?.until_date||IASDPIEventPlanning.yearEnd(),...(cutoff?{preview_from:cutoff}:{})},existing.map(e=>e.id));
      if(candidate.status==='published'&&plan.conflict_count)deny('Conflito de reserva.');
      const series={id:b.p_id,definition:copy(candidate),created_by:root?.created_by||a.id,until_date:root?.until_date||plan.until,version:(root?.version||0)+1,approval_status:approval,category:candidate.category,department_id:candidate.department_id};seriesStore.series.set(series.id,series);
      const rows=[];for(const item of plan.occurrences){const priorRow=existing.find(e=>e.occurrence_on===item.date);rows.push(write(priorRow?.id||crypto.randomUUID(),priorRow,item,{series_id:series.id,occurrence_on:item.date}));}
      for(const removed of existing.filter(e=>!plan.occurrences.some(item=>item.date===e.occurrence_on))){const cancelled={...removed,status:'cancelled',approval_status:'not_required',version:removed.version+1,updated_by:a.id};events.events.set(cancelled.id,cancelled);version(a,cancelled,'event_cancelled',safe(removed));}
      seriesStore.seriesVersions.set(series.id,[...(seriesStore.seriesVersions.get(series.id)||[]),copy(series)]);result={series:copy(series),events:rows,requires_confirmation:false,conflict_count:plan.conflict_count};
     }
     submitReceipts.set(b.p_request_id,{signature,result:copy(result)});return Response.json(result);
    }
   }
   if(name==='iasdpi_event_history'){const e=events.events.get(b.p_id);if(e?.program_category==='general'){if(!admin(a)&&e.created_by!==a?.id)deny('Histórico privado.');return Response.json(copy(events.versions.get(e.id)||[]));}}
   const before=writeNames.includes(name)?beforeWrite(name,b):name==='iasdpi_event_submit'?safe(events.events.get(b.p_id)):{};
   const response=await priorFetch(input,options);
   if(response.ok&&a&&writeNames.includes(name))recordWrite(a,name,b,await response.clone().json(),before);
   if(response.ok&&a&&['iasdpi_event_submit','iasdpi_event_series_save'].includes(name)){
    const data=await response.clone().json(),after=data.event||data.series,action=after?.status==='published'||after?.definition?.status==='published'?'event_published':after?.status==='cancelled'?'event_cancelled':'event_draft';audit(a,action,after?.id,before,safe(after));
   }
   if(name==='iasdpi_events_catalog'&&response.ok){const data=await response.json(),known=new Set(data.events.map(e=>e.id));for(const e of events.events.values())if(e.program_category==='general'&&!known.has(e.id)&&(admin(a)||e.created_by===a?.id||approver(a)&&e.approval_status==='pending'))data.events.push(copy(e));data.series=IASDPIEventPlanningDemo?[...IASDPIEventPlanningDemo.series.values()].filter(row=>row.definition.program_category==='general'&&(admin(a)||row.created_by===a?.id||approver(a)&&row.approval_status==='pending')).map(copy).concat((data.series||[]).filter(row=>row.definition.program_category!=='general')):data.series;data.events=data.events.filter(e=>e.program_category!=='general'||admin(a)||e.created_by===a?.id||approver(a)&&e.approval_status==='pending');return Response.json({...data,event_approval_required:true,can_submit_general:canGeneral(a),can_approve_general:approver(a)});}
   if(response.ok&&(url.pathname==='/auth/v1/token'||url.pathname==='/functions/v1/alias-login')){const session=await response.clone().json();const id=session.user?.id||(session.access_token?JSON.parse(atob(session.access_token.split('.')[1])).sub:null);const account=g.accounts.find(u=>u.id===id);if(account)account.lastSignIn=new Date().toISOString();}
   return response;
  }catch(e){return Response.json({code:e.code||'23514',message:e.message},{status:403});}
 };
 window.IASDPIG11Demo={ready,pending,accounts:g.accounts};
 const banner=document.querySelector('.demo-banner');if(banner){banner.firstChild.textContent='IASDPI · HOMOLOGAÇÃO — autenticação simulada; alterações temporárias nesta aba. ';}
})();
