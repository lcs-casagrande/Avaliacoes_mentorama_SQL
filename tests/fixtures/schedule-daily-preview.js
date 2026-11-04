'use strict';
// Simulador B1.1 exclusivamente em memória. Não é prova de RLS/concorrência SQL.
(()=>{
 const base=IASDPISchedulePreview.request,store=IASDPIB1Preview;
 const settings={planning_months:2,weekdays:[3,6,0],extra_dates:[],version:1,daily:true,can_edit:true};
 const exceptions=[];let catalog;
 const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;};
 function configuration(){const first=today().slice(0,7);return {...structuredClone(settings),today:today(),future_months:Array.from({length:settings.planning_months},(_,i)=>{const d=new Date(first+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+i+1);return d.toISOString().slice(0,10);})};}
 const save=(entity,id,data,version=0)=>base('iasdpi_schedule_save',{p_entity:entity,p_id:id,p_expected_version:version,p_data:data,p_request_id:crypto.randomUUID()});
 function availability(person,department,day){const dow=new Date(day+'T12:00:00Z').getUTCDay();const matching=catalog.availability.filter(v=>v.active&&v.person_id===person&&(!v.department_id||v.department_id===department)&&((v.pattern==='period'&&day>=v.starts_on&&day<=v.ends_on)||(v.pattern==='weekly'&&(v.weekdays||[]).includes(dow)&&(!v.valid_from||day>=v.valid_from)&&(!v.valid_until||day<=v.valid_until))));return matching.some(v=>v.kind==='unavailable')?'unavailable':matching.some(v=>v.kind==='available'&&!v.start_time&&!v.end_time)?'available':'unknown';}
 async function event(b){const d=b.p_data,old=store.events.find(e=>e.title===d.title&&e.scheduled_on===d.date);if(old)return structuredClone(old);const e={id:b.p_id,title:d.title,scheduled_on:d.date,starts_at:null,ends_at:null,timing_mode:'day'};store.events.push(e);return structuredClone(e);}
 window.IASDPISchedulePreview.request=async(name,b={})=>{
  await store.demoReady;catalog=await base('iasdpi_schedule_catalog');
  const admin=()=>{if(!catalog.is_admin)throw Error('Somente administrador.');};
  if(name==='iasdpi_schedule_settings_get')return configuration();
  if(name==='iasdpi_schedule_settings_save'){admin();if(b.p_expected_version!==settings.version)throw Error('Configuração mudou.');if(![1,2,3,6].includes(b.p_data.planning_months))throw Error('Quantidade de meses inválida.');Object.assign(settings,structuredClone(b.p_data),{version:settings.version+1});return configuration();}
  if(name==='iasdpi_schedule_event_create'&&!b.p_data.start_time)return event(b);
  if(name==='iasdpi_schedule_generate_days'){
   const config=configuration(),events=[];
   for(const month of config.future_months){const date=new Date(month+'T12:00:00Z');while(date.toISOString().slice(0,7)===month.slice(0,7)){const day=date.toISOString().slice(0,10);if(settings.weekdays.includes(date.getUTCDay())||settings.extra_dates.includes(day))events.push(await event({p_id:crypto.randomUUID(),p_data:{title:b.p_title,date:day}}));date.setUTCDate(date.getUTCDate()+1);}}
   return {events,months:config.future_months,settings_version:settings.version};
  }
  if(name==='iasdpi_schedule_workspace'){
   const data=await base(name,b),days=IASDPIScheduleManagement.dates(b.p_month.slice(0,7),[0,1,2,3,4,5,6]);
   return {...data,settings:configuration(),availability:catalog.memberships.filter(m=>m.department_id===b.p_department&&m.active).flatMap(m=>days.map(day=>({person_id:m.person_id,date:day,state:availability(m.person_id,b.p_department,day)})))};
  }
  if(name==='iasdpi_schedule_members'){
   admin();return {catalog,members:catalog.people.map(p=>({...p,weekdays:Object.fromEntries(Array.from({length:7},(_,d)=>[d,catalog.availability.some(v=>v.person_id===p.id&&v.origin==='daily-profile'&&v.active&&v.pattern==='weekly'&&v.kind==='unavailable'&&v.weekdays.includes(d))?'unavailable':catalog.availability.some(v=>v.person_id===p.id&&v.origin==='daily-profile'&&v.active&&v.pattern==='weekly'&&v.kind==='available'&&v.weekdays.includes(d))?'available':'unknown'])),unavailable_dates:catalog.availability.filter(v=>v.person_id===p.id&&v.active&&v.origin==='daily-profile'&&v.pattern==='period').map(v=>v.starts_on),manual_rules:catalog.availability.filter(v=>v.person_id===p.id&&v.active&&v.origin!=='daily-profile').length}))};
  }
  if(name==='iasdpi_schedule_member_save'){
   admin();const d=b.p_data,previous=catalog;
   const projected=catalog.availability.filter(v=>v.person_id!==b.p_id||v.origin!=='daily-profile');
   for(const kind of ['available','unavailable']){const days=Object.entries(d.weekdays).filter(([_,state])=>state===kind).map(([day])=>Number(day));if(days.length)projected.push({person_id:b.p_id,department_id:null,kind,pattern:'weekly',weekdays:days,active:true});}
   for(const day of d.unavailable_dates)projected.push({person_id:b.p_id,department_id:null,kind:'unavailable',pattern:'period',starts_on:day,ends_on:day,active:true});
   catalog={...catalog,availability:projected};
   try{for(const plan of store.plans.values())for(const r of plan.requirements){const day=store.events.find(e=>e.id===r.event_id)?.scheduled_on;if(day>=today()&&r.assignments.some(a=>a.person_id===b.p_id)&&(!d.active||availability(b.p_id,plan.department_id,day)!=='available'))throw Error('Disponibilidade não confirmada ou pessoa indisponível para uma escala futura. Corrija a atribuição antes de alterar o cadastro.');}}finally{catalog=previous;}
   const result=await save('person',b.p_id,{name:d.name,display_name:d.display_name,active:d.active,max_monthly_count:d.max_monthly_count},b.p_expected_version);
   for(const old of catalog.availability.filter(v=>v.person_id===b.p_id&&v.origin==='daily-profile'&&v.active))await save('availability',old.id,{active:false},old.version);
   for(const kind of ['available','unavailable']){const days=Object.entries(d.weekdays).filter(([_,state])=>state===kind).map(([day])=>Number(day));if(days.length)await save('availability',crypto.randomUUID(),{person_id:b.p_id,department_id:null,kind,pattern:'weekly',weekdays:days,origin:'daily-profile',active:true});}
   for(const day of d.unavailable_dates)await save('availability',crypto.randomUUID(),{person_id:b.p_id,department_id:null,kind:'unavailable',pattern:'period',starts_on:day,ends_on:day,origin:'daily-profile',active:true});
   return result;
  }
  if(name==='iasdpi_schedule_exceptions'){admin();return structuredClone(exceptions);}
  if(name==='iasdpi_schedule_exception_save'){
   admin();const d=b.p_data,old=exceptions.find(x=>x.id===b.p_id);if(old&&old.version!==b.p_expected_version)throw Error('Exceção mudou.');if(!old&&(!d.reason||d.reason.trim().length<10||d.department_a===d.department_b))throw Error('Revise a justificativa e os departamentos.');
   if(old&&d.enabled===false){const used=department=>[...store.plans.values()].some(p=>p.department_id===department&&p.requirements.some(r=>store.events.find(e=>e.id===r.event_id)?.scheduled_on===old.day&&r.assignments.some(a=>a.person_id===old.person_id)));if(used(old.department_a)&&used(old.department_b))throw Error('Exceção em uso. Corrija uma das atribuições antes de revogar.');}
   const row={...old,...d,id:b.p_id,enabled:d.enabled??true,version:(old?.version||0)+1,approved_by:catalog.actor_id,approved_at:new Date().toISOString()};if(old)Object.assign(old,row);else exceptions.push(row);return structuredClone(row);
  }
  if(name==='iasdpi_schedule_person_history'){
   admin();const current=[...store.plans.values()].flatMap(p=>p.requirements.flatMap(r=>r.assignments.filter(a=>a.person_id===b.p_person).map(a=>({...a,assigned_on:store.events.find(e=>e.id===r.event_id).scheduled_on,department:catalog.departments.find(d=>d.id===p.department_id).name,role:catalog.roles.find(role=>role.id===r.role_id).name,status:p.status}))));return {current,versions:[...store.versions.values()].flat().filter(p=>p.requirements.some(r=>r.assignments.some(a=>a.person_id===b.p_person))).map(p=>({title:p.title,version:p.version,status:p.status}))};
  }
  if(name==='iasdpi_schedule_plan_save'){
   for(const r of b.p_data.requirements)for(const a of r.assignments){const e=store.events.find(e=>e.id===r.event_id),day=e.scheduled_on;
    if(availability(a.person_id,b.p_data.department_id,day)!=='available')throw Error('Disponibilidade desconhecida ou pessoa indisponível.');
    const conflicting=[...store.plans.values()].filter(p=>p.id!==b.p_id&&p.department_id!==b.p_data.department_id).flatMap(p=>p.requirements.filter(r=>store.events.find(e=>e.id===r.event_id)?.scheduled_on===day).flatMap(r=>r.assignments.filter(x=>x.person_id===a.person_id).map(()=>p.department_id)));
    for(const other of conflicting)if(!exceptions.some(x=>x.enabled&&x.person_id===a.person_id&&x.day===day&&[x.department_a,x.department_b].includes(other)&&[x.department_a,x.department_b].includes(b.p_data.department_id)))throw Error('Conflito: dois departamentos na mesma data. Exceção somente por administrador.');
    a.assigned_on=day;a.timing_mode='day';a.starts_at=null;a.ends_at=null;
   }
  }
  return base(name,b);
 };
 const draw=render;render=function(){draw();const help=document.querySelector('.b1-demo-help');if(help)help.innerHTML='<summary>Como testar escalas por dia</summary><ol><li>Abra Membros e confirme explicitamente os dias disponíveis de uma pessoa fictícia. Sem flags, a disponibilidade é desconhecida.</li><li>Confira o período e os dias em Configurações. Somente o administrador pode alterá-los.</li><li>Volte a Montar escala e gere os dias dos próximos meses, sem horários. Inclua funções e selecione pessoas confirmadas.</li><li>Tente usar Alfa em dois departamentos no mesmo dia: haverá conflito. A exceção só pode ser autorizada em Configurações, com justificativa.</li></ol><p>Todos os dados são fictícios, em memória. Nenhuma pessoa é distribuída automaticamente.</p>';};
})();
