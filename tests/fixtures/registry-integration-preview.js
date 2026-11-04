'use strict';
// G8.2: adaptador local sobre o MESMO catálogo/IDs da prévia G7. Sem rede externa.
(()=>{
 window.IASDPIConfig=Object.freeze({...IASDPIConfig,centralRegistryEnabled:true,storageNamespace:'iasdpi-registry-g82-preview-v1'});
 const g=IASDPIG6Preview,prior=g.rpc,receipts=new Map(),links=new Map(),configured=new Map(),clone=v=>structuredClone(v),ok=value=>({handled:true,value}),fail=m=>{throw Error(m);};
 const ready=(async()=>{await IASDPIG7Demo.ready;let c=await g.raw('iasdpi_schedule_catalog');IASDPIB1Preview.legacy=[]; // Só a fixture: referências públicas permanecem; associações ainda não foram confirmadas.
  // Confirmações da demonstração G6 não se tornam confirmações de pessoas reais.
  for(const a of c.availability)await g.raw('iasdpi_schedule_save',{p_entity:'availability',p_id:a.id,p_expected_version:a.version||1,p_data:{active:false},p_request_id:crypto.randomUUID()});
  for(const m of c.memberships)await g.raw('iasdpi_schedule_save',{p_entity:'membership',p_id:m.id,p_expected_version:m.version,p_data:{participation_confirmed:false,availability_override:false,leadership_scope:'',role_ids:[]},p_request_id:crypto.randomUUID()});
 })();
 const admin=a=>a.globalRole==='admin',manager=(a,d)=>g.cap(a,d,'members');
 function state(c,p,d,date){const member=c.memberships.find(m=>m.person_id===p&&m.department_id===d),day=new Date(date+'T12:00:00Z').getUTCDay();const rows=c.availability.filter(v=>v.active&&v.person_id===p&&(!v.department_id||v.department_id===d)&&((v.pattern==='weekly'&&v.weekdays.includes(day)&&(!v.valid_from||v.valid_from<=date)&&(!v.valid_until||v.valid_until>=date))||(v.pattern==='period'&&v.starts_on<=date&&v.ends_on>=date)));if(rows.some(v=>v.kind==='unavailable'))return 'unavailable';return rows.some(v=>v.kind==='available'&&!v.start_time&&!v.end_time&&(!member?.availability_override||v.department_id===d))?'available':'unknown';}
 async function projection(){const c=await g.raw('iasdpi_schedule_catalog');return {configured:[...configured.values()],heads:c.memberships.filter(m=>m.active&&m.is_ministry_head).flatMap(m=>{const p=c.people.find(p=>p.id===m.person_id&&p.active),d=c.departments.find(d=>d.id===m.department_id&&d.active);return p&&d?[{department_code:d.code,department:d.name,scope:m.leadership_scope||'',name:p.display_name}]:[];}),links:[...links.values()].map(l=>({source_key:l.source_key,display_name:c.people.find(p=>p.id===l.person_id)?.display_name||''}))};}
 g.rpc=async(a,n,b)=>{
  await ready;
  const c=await g.raw('iasdpi_schedule_catalog');
  if(n==='iasdpi_registry_people'||n==='iasdpi_registry_catalog'){
   if(!admin(a)&&!c.departments.some(d=>manager(a,d.id)))fail('Sem administração de membros.');
   if(n==='iasdpi_registry_people'){const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();return ok(c.people.filter(p=>norm(p.name+' '+p.display_name).includes(norm(b.p_search))).map(({id,name,display_name,active,version})=>({id,name,display_name,active,version})));}
   const departments=c.departments.filter(d=>manager(a,d.id)).map(d=>({...d,can_manage_members:true,can_edit:g.cap(a,d.id,'edit'),can_publish:g.cap(a,d.id,'publish')})),ids=new Set(departments.map(d=>d.id)),memberships=c.memberships.filter(m=>ids.has(m.department_id));
   return ok({...c,actor_id:a.id,is_admin:admin(a),departments,memberships,roles:c.roles.filter(r=>ids.has(r.department_id)),qualifications:c.qualifications.filter(q=>memberships.some(m=>m.id===q.membership_id)),profiles:memberships.map(m=>({membership_id:m.id,weekdays:Object.fromEntries(Array.from({length:7},(_,day)=>[day,c.availability.find(v=>v.person_id===m.person_id&&(v.department_id===m.department_id||(!v.department_id&&!m.availability_override))&&v.active&&v.pattern==='weekly'&&v.weekdays.includes(day))?.kind||'unknown']))})),source_links:admin(a)?[...links.values()].map(clone):[]});
  }
  if(n==='iasdpi_registry_save'){
   const old=c.people.find(p=>p.id===b.p_person),patch=b.p_person_patch,rows=b.p_links;
   if(!admin(a)&&(Object.keys(patch).length||!rows.length))fail('Dados da pessoa são administrados centralmente.');
   for(const e of rows)if(!manager(a,e.department_id))fail('Sem administração deste departamento.');
   const signature=JSON.stringify([a.id,b]);if(receipts.has(b.p_request_id)){const r=receipts.get(b.p_request_id);if(r.signature!==signature)fail('Solicitação reutilizada.');return ok(clone(r.result));}
   if((old?.version||0)!==b.p_expected_person_version)fail('Cadastro da pessoa mudou. Recarregue e compare.');
   for(const e of rows){const m=c.memberships.find(m=>m.person_id===b.p_person&&m.department_id===e.department_id);if((m?.version||0)!==e.expected_version)fail('Vínculo alterado em outra edição.');if(e.patch.role_ids?.some(id=>!c.roles.some(r=>r.id===id&&r.active&&r.department_id===e.department_id)))fail('Função de outro departamento.');}
   if(Object.keys(patch).length){const privateBefore=old?await g.raw('iasdpi_schedule_person_details',{p_id:old.id}):{};await g.raw('iasdpi_schedule_save',{p_entity:'person',p_id:b.p_person,p_expected_version:b.p_expected_person_version,p_data:{...privateBefore,...patch,...(patch.name&&!Object.hasOwn(patch,'display_name')?{display_name:patch.name}:{})},p_request_id:crypto.randomUUID()});}
   for(const e of rows){let m=c.memberships.find(m=>m.person_id===b.p_person&&m.department_id===e.department_id),p={...e.patch};const days=p.weekdays;delete p.weekdays;
    if(!m)m={id:crypto.randomUUID(),version:0,person_id:b.p_person,department_id:e.department_id};if(days)p.availability_override=true;if(Object.hasOwn(p,'is_ministry_head')||Object.hasOwn(p,'leadership_scope')){const dep=c.departments.find(d=>d.id===e.department_id);for(const scope of [m.leadership_scope||'',p.leadership_scope??m.leadership_scope??''])configured.set(dep.id+':'+scope,{department_code:dep.code,department:dep.name,scope});}
    await g.raw('iasdpi_schedule_save',{p_entity:'membership',p_id:m.id,p_expected_version:m.version,p_data:{active:true,is_ministry_head:false,participation_confirmed:false,...m,...p},p_request_id:crypto.randomUUID()});
    if(days){const before=await g.raw('iasdpi_schedule_catalog');for(const v of before.availability.filter(v=>v.person_id===b.p_person&&v.department_id===e.department_id&&v.active&&v.origin==='registry-g82'))await g.raw('iasdpi_schedule_save',{p_entity:'availability',p_id:v.id,p_expected_version:v.version,p_data:{active:false},p_request_id:crypto.randomUUID()});
     for(const kind of ['available','unavailable']){const weekdays=Object.entries(days).filter(([,v])=>v===kind).map(([k])=>Number(k));if(weekdays.length)await g.raw('iasdpi_schedule_save',{p_entity:'availability',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{person_id:b.p_person,department_id:e.department_id,kind,pattern:'weekly',weekdays,origin:'registry-g82'},p_request_id:crypto.randomUUID()});}
    }
   }
   const after=await g.raw('iasdpi_schedule_catalog'),result={person:after.people.find(p=>p.id===b.p_person),memberships:after.memberships.filter(m=>m.person_id===b.p_person&&manager(a,m.department_id))};receipts.set(b.p_request_id,{signature,result:clone(result)});return ok(result);
  }
  if(n==='iasdpi_registry_source_save'){
   if(!admin(a))fail('Associação exige administrador.');const old=links.get(b.p_source_key);if((old?.version||0)!==b.p_expected_version)fail('Associação alterada.');const ref=b.p_reference;if(ref&&Object.keys(ref).length&&ref.kind!=='monthly'){if(!c.memberships.some(m=>m.person_id===b.p_person&&m.department_id===ref.department_id))fail('Vincule a pessoa ao departamento antes de conciliar.');for(const date of IASDPIElderPeriods.range(ref.starts_on,ref.ends_on)){const key=b.p_source_key+':day:'+date,previous=IASDPIB1Preview.legacy.find(r=>r.source_key===key);if(previous&&previous.person_id!==b.p_person)fail('Compromisso já conciliado com outra identidade.');if(!previous)IASDPIB1Preview.legacy.push({source_key:key,person_id:b.p_person,department_id:ref.department_id,date,original_name:ref.original_name});}}const row={source_key:b.p_source_key,person_id:b.p_person,reference:b.p_reference||{},version:(old?.version||0)+1};links.set(b.p_source_key,row);return ok(clone(row));
  }
  if(n==='iasdpi_registry_history'){
   if(!manager(a,b.p_department))fail('Sem histórico deste vínculo.');
   const daily=await g.raw('iasdpi_schedule_person_history',{p_person:b.p_person}),dept=c.departments.find(d=>d.id===b.p_department),plans=[...IASDPIB1Preview.plans.values()].filter(p=>p.department_id===b.p_department);
   return ok({current:[...daily.current.filter(r=>r.department===dept.name),...IASDPIB1Preview.legacy.filter(r=>r.person_id===b.p_person&&r.department_id===b.p_department).map(r=>({assigned_on:r.date,department:dept.name,role:'Função histórica: Pendente de confirmação',status:'Histórico manual — original preservado'}))],versions:daily.versions.filter(v=>plans.some(p=>p.id===v.plan_id))});
  }
  const result=await prior(a,n,b);
  if(n==='iasdpi_schedule_rotation_context'||n==='iasdpi_schedule_workspace'){
   if(!result?.handled)return result;const ctx=n==='iasdpi_schedule_workspace'?result.value.rotation_context:result.value;
   Object.assign(ctx,{central_registry:true,availability_enabled:true,availability_default:'unknown'});for(const p of ctx.people)for(const day of p.days)day.state=state(c,p.person_id,b.p_department,day.date);
   if(n==='iasdpi_schedule_workspace')Object.assign(result.value.settings,{central_registry:true,availability_enabled:true,availability_default:'unknown'});return result;
  }
  if(n==='iasdpi_schedule_elder_workspace'){
   if(!g.cap(a,b.p_department,'view'))fail('Departamento não autorizado.');const r=await g.raw(n,b),dates=[...new Set(r.periods.flatMap(p=>IASDPIElderPeriods.range(p.starts_on,p.ends_on)))];r.central_registry=true;r.availability_days=c.memberships.filter(m=>m.department_id===b.p_department&&m.active).flatMap(m=>dates.map(date=>({person_id:m.person_id,date,state:state(c,m.person_id,b.p_department,date)})));return ok(r);
  }
  return result;
 };
 const fetchBefore=window.fetch;window.fetch=async(url,args={})=>{if(String(url)==='https://g4demo.supabase.co/rest/v1/rpc/iasdpi_registry_public'){await ready;return Response.json(new Headers(args.headers).get('x-iasdpi-church')==='IASD_PI'?await projection():{heads:[],links:[]});}return fetchBefore(url,args);};
 window.IASDPIG82Demo={ready};document.querySelector('.demo-banner').insertAdjacentHTML('beforeend','<p>Cadastro Geral G8.2: confirmações pendentes. Altere somente os dados desta demonstração para experimentar o rodízio.</p>');
})();
