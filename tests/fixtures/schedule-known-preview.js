'use strict';
// Prévia local com nomes informados. Cadastro único via API da Fase A; sem rede.
(()=>{
 const base=IASDPISchedulePreview.request,seed=IASDPIKnownPreviewSeed;
 const store={events:[],plans:new Map(),versions:new Map(),receipts:new Map(),legacy:seed.legacy.map(row=>Object.freeze({...row})),failNext:false};
 window.IASDPIKnownPreview=store;
 const config={daily:true,can_edit:true,version:1,planning_months:2,weekdays:[0,3,6],extra_dates:[],...(seed.simplified_daily?{simplified_daily:true,department_weekdays:Object.fromEntries(seed.catalog.departments.filter(d=>['comunicacao','ministerio-da-familia','ministerio-da-crianca'].includes(d.code)).map(d=>[d.id,[6]])),availability_advisory:true,availability_default:'available'}:{})};
 const clone=v=>structuredClone(v),today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;};
 function settings(){return {...clone(config),today:today(),...(window.IASDPIScheduleEditingDemo?IASDPIScheduleEditingDemo.policy({...config,today:today()}):{}),future_months:Array.from({length:config.planning_months},(_,i)=>{const d=new Date(today().slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+i+1);return d.toISOString().slice(0,10);})};}
 function availability(c,person,department,day){const dow=new Date(day+'T12:00:00Z').getUTCDay(),rules=c.availability.filter(v=>v.person_id===person&&v.active&&(!v.department_id||v.department_id===department)&&((v.pattern==='weekly'&&(v.weekdays||[]).includes(dow)&&(!v.valid_from||day>=v.valid_from)&&(!v.valid_until||day<=v.valid_until))||(v.pattern==='period'&&day>=v.starts_on&&day<=v.ends_on)));return rules.some(v=>v.kind==='unavailable')?'unavailable':rules.some(v=>v.kind==='available'&&!v.start_time&&!v.end_time)?'available':seed.simplified_daily?'available':'unknown';}
 const publishedPlans=()=>[...store.plans.values()].map(p=>p.status==='published'?p:[...(store.versions.get(p.id)||[])].reverse().find(v=>v.status==='published')).filter(Boolean);
 const occupied=()=>[...store.legacy.map(r=>({person_id:r.person_id,department_id:r.department_id,date:r.date,status:'published',plan_id:null})),...[...publishedPlans(),...[...store.plans.values()].filter(p=>p.status!=='published')].flatMap(p=>p.requirements.flatMap(r=>r.assignments.map(a=>({person_id:a.person_id,department_id:p.department_id,date:store.events.find(e=>e.id===r.event_id).scheduled_on,status:p.status,plan_id:p.id}))))];
 store.publishedPlans=publishedPlans;store.scheduleCommitments=occupied;
 function context(c,department,month){
  const plan=store.plans.get(department+':'+month),days=IASDPIScheduleManagement.dates(month.slice(0,7),[0,1,2,3,4,5,6]),all=occupied();
  return {...(window.IASDPIScheduleEditingDemo?IASDPIScheduleEditingDemo.policy(settings()):{}),department_id:department,month,basis_version:plan?.version||0,drafts_are_warnings:true,...(seed.simplified_daily?{availability_advisory:true,availability_default:'available'}:{}),history_scope:'published-and-manual-references',heads:c.memberships.filter(m=>m.department_id===department&&m.active&&m.is_ministry_head).map(m=>c.people.find(p=>p.id===m.person_id)?.display_name).filter(Boolean),people:c.people.filter(p=>c.memberships.some(m=>m.person_id===p.id&&m.department_id===department)).map(p=>{
   const rows=all.filter(a=>a.person_id===p.id&&a.plan_id!==plan?.id),history=rows.filter(a=>a.department_id===department&&a.date<month&&a.status==='published'),confirmed=rows.filter(a=>a.status==='published'&&a.date.slice(0,7)===month.slice(0,7));
   return {person_id:p.id,history_count:new Set(history.map(a=>a.date)).size,last_day:history.map(a=>a.date).sort().at(-1)||null,global_days:[...new Set(confirmed.map(a=>a.date))],department_days:[...new Set(confirmed.filter(a=>a.department_id===department).map(a=>a.date))],days:days.map(date=>({date,state:availability(c,p.id,department,date),conflict:confirmed.some(a=>a.date===date&&(window.IASDPIScheduleRules?IASDPIScheduleRules.departmentsConflict(c,a.department_id,department):a.department_id!==department)),draft_dispute:rows.some(a=>a.date===date&&(window.IASDPIScheduleRules?IASDPIScheduleRules.departmentsConflict(c,a.department_id,department):a.department_id!==department)&&a.status==='draft')}))};
  })};
 }
 const rpcSave=(entity,id,version,data)=>base('iasdpi_schedule_save',{p_entity:entity,p_id:id,p_expected_version:version,p_data:data,p_request_id:crypto.randomUUID()});
 IASDPISchedulePreview.request=async function localRequest(name,b={}){
  const c=await base('iasdpi_schedule_catalog'),admin=()=>{if(!c.is_admin)throw Error('Somente administrador.');},scope=department=>{if(!c.departments.some(d=>d.id===department&&d.active&&d.can_manage))throw Error('Sem gestão deste departamento.');};
  if(name==='iasdpi_schedule_save'&&b.p_entity==='person'&&b.p_data.name){const duplicate=c.people.find(p=>p.id!==b.p_id&&p.name.trim().toLocaleLowerCase('pt-BR')===b.p_data.name.trim().toLocaleLowerCase('pt-BR'));if(duplicate&&!(c.is_admin&&b.p_data.confirm_homonym&&b.p_data.reason?.trim().length>=10))throw Error('Nome já cadastrado. Reutilize a pessoa existente ou confirme administrativamente um homônimo.');}
  if(name==='iasdpi_schedule_settings_get')return settings();
  if(name==='iasdpi_schedule_daily_role'){scope(b.p_department);const role=c.roles.find(r=>r.department_id===b.p_department&&r.general_assignment&&r.active);if(!role)throw Error('Participação diária não preparada.');return clone(role);}
  if(name==='iasdpi_schedule_settings_save'){admin();if(config.version!==b.p_expected_version)throw Error('Configuração mudou.');Object.assign(config,clone(b.p_data),{version:config.version+1});return settings();}
  if(name==='iasdpi_schedule_members'){
   admin();return {catalog:c,members:c.people.map(p=>({...p,weekdays:Object.fromEntries(Array.from({length:7},(_,day)=>[day,c.availability.some(v=>v.person_id===p.id&&v.origin==='daily-profile'&&v.pattern==='weekly'&&v.active&&v.kind==='unavailable'&&v.weekdays.includes(day))?'unavailable':c.availability.some(v=>v.person_id===p.id&&v.origin==='daily-profile'&&v.pattern==='weekly'&&v.active&&v.kind==='available'&&v.weekdays.includes(day))?'available':'unknown'])),unavailable_dates:c.availability.filter(v=>v.person_id===p.id&&v.origin==='daily-profile'&&v.pattern==='period'&&v.active).map(v=>v.starts_on),manual_rules:c.availability.filter(v=>v.person_id===p.id&&v.origin!=='daily-profile'&&v.active).length}))};
  }
  if(name==='iasdpi_schedule_member_save'){
   admin();const d=b.p_data,result=await rpcSave('person',b.p_id,b.p_expected_version,{name:d.name,display_name:d.display_name,active:d.active,max_monthly_count:d.max_monthly_count});
   for(const old of c.availability.filter(v=>v.person_id===b.p_id&&v.origin==='daily-profile'&&v.active&&((d.weekdays&&v.pattern==='weekly')||(d.unavailable_dates&&v.pattern==='period'))))await rpcSave('availability',old.id,old.version,{active:false});
   for(const kind of ['available','unavailable']){const days=Object.entries(d.weekdays||{}).filter(([_,s])=>s===kind).map(([day])=>+day);if(days.length)await rpcSave('availability',crypto.randomUUID(),0,{person_id:b.p_id,department_id:null,kind,pattern:'weekly',weekdays:days,origin:'daily-profile',active:true});}
   for(const day of d.unavailable_dates||[])await rpcSave('availability',crypto.randomUUID(),0,{person_id:b.p_id,department_id:null,kind:'unavailable',pattern:'period',starts_on:day,ends_on:day,origin:'daily-profile',active:true});return result;
  }
  if(name==='iasdpi_schedule_event_create'){
   scope(b.p_data.department_id);let event=store.events.find(e=>e.title===b.p_data.title&&e.scheduled_on===b.p_data.date);if(!event){event={id:b.p_id,title:b.p_data.title,scheduled_on:b.p_data.date,timing_mode:'day',starts_at:null,ends_at:null};store.events.push(event);}return clone(event);
  }
  if(name==='iasdpi_schedule_generate_days'){
   scope(b.p_department);const events=[];for(const month of settings().future_months)for(const day of IASDPIScheduleManagement.dates(month.slice(0,7),config.weekdays)){const e=await localRequest('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:b.p_department,date:day,title:b.p_title}});events.push(e);}return {events,months:settings().future_months};
  }
  if(name==='iasdpi_schedule_rotation_context'){scope(b.p_department);return context(c,b.p_department,b.p_month);}
  if(name==='iasdpi_schedule_workspace'){
   scope(b.p_department);const ctx=context(c,b.p_department,b.p_month),plan=store.plans.get(b.p_department+':'+b.p_month);return clone({monthly:true,rotation_context:ctx,settings:settings(),events:store.events.filter(e=>e.scheduled_on.slice(0,7)===b.p_month.slice(0,7)),plan:plan||null,versions:plan?(store.versions.get(plan.id)||[]).map(p=>({version:p.version})):[],availability:ctx.people.flatMap(p=>p.days.map(d=>({person_id:p.person_id,date:d.date,state:d.state})))});
  }
  if(name==='iasdpi_schedule_plan_save'){
   scope(b.p_data.department_id);const key=b.p_data.department_id+':'+b.p_data.month,old=store.plans.get(key);if((old?.version||0)!==b.p_expected_version||(old&&old.id!==b.p_id))throw Error('Esta escala mudou em outro dispositivo.');
   const data={...clone(b.p_data),id:b.p_id,version:b.p_expected_version+1};
   const source={catalog:c,context:context(c,data.department_id,data.month),events:store.events,department:data.department_id,plan:data};
   for(const r of data.requirements.filter(r=>!window.IASDPIScheduleEditingDemo||IASDPIScheduleEditWindow.day(store.events.find(e=>e.id===r.event_id)?.scheduled_on,source.context)))for(const a of r.assignments){const reasons=IASDPIScheduleRotation.manualReasons(source,r,a.person_id,a.id);if(reasons.length)throw Error(reasons.join('; '));}
   if(data.status==='published'&&(!data.requirements.length||!window.IASDPISchedulePublicationPreview&&data.requirements.some(r=>(!window.IASDPIScheduleEditingDemo||IASDPIScheduleEditWindow.day(store.events.find(e=>e.id===r.event_id)?.scheduled_on,source.context))&&r.assignments.length<r.required_count)))throw Error('Publicação bloqueada: vagas pendentes.');
   store.plans.set(key,clone(data));if(!store.versions.has(data.id))store.versions.set(data.id,[]);store.versions.get(data.id).push(clone(data));return clone(data);
  }
  if(name==='iasdpi_schedule_plan_version')return clone(store.versions.get(b.p_id)?.find(p=>p.version===b.p_version)||null);
  if(name==='iasdpi_schedule_person_history'){
   admin();return {current:occupied().filter(a=>a.person_id===b.p_person).map(a=>({assigned_on:a.date,department:c.departments.find(d=>d.id===a.department_id).name,role:a.plan_id?'Função confirmada na escala':'Função histórica: Pendente de confirmação',status:a.plan_id?a.status:'Histórico manual — original preservado'})),versions:[]};
  }
  if(name==='iasdpi_schedule_exceptions'){admin();return [];}
  if(name==='iasdpi_schedule_exception_save')throw Error('Autorizações de exceção não são simuladas com estes nomes. Use o cenário de teste separado.');
  return base(name,b);
 };
 IASDPICalendarSource=()=>{const managed=publishedPlans().flatMap(p=>p.requirements.flatMap(r=>r.assignments.map(a=>({id:'local:'+a.id,date:store.events.find(e=>e.id===r.event_id).scheduled_on,department:seed.catalog.departments.find(d=>d.id===p.department_id)?.name,person:seed.catalog.people.find(person=>person.id===a.person_id)?.display_name||'Nome alterado nesta prévia',role:'Escala por dia',origin:'SIMULAÇÃO LOCAL · não publicada no site oficial'}))));const keys=new Set(managed.map(row=>row.department+':'+row.date));return [...seed.rows.filter(row=>!keys.has(row.department+':'+row.date)),...managed];};
 const draw=render;render=function(){draw();const heading=document.querySelector('.b1-demo-help');if(heading)heading.remove();};
})();
