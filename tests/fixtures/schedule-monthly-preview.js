'use strict';
// B1.2: somente dados fictícios explicitamente confirmados para esta demonstração.
(()=>{
 const base=IASDPISchedulePreview.request,store=IASDPIB1Preview,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const save=(entity,identifier,data,version=0)=>base('iasdpi_schedule_save',{p_entity:entity,p_id:identifier,p_expected_version:version,p_data:data,p_request_id:crypto.randomUUID()});
 const ready=(async()=>{
  await store.demoReady;
  for(const [person,department,role,name] of [[24,4,43,'Épsilon'],[25,2,41,'Zeta']]){
   await save('person',id(person),{name:'Pessoa '+name+' — exemplo',display_name:name+' — exemplo',department_id:id(department)});
   const c=await base('iasdpi_schedule_catalog'),member=c.memberships.find(m=>m.person_id===id(person)&&m.department_id===id(department));
   await save('membership',member.id,{role_ids:[id(role)]},member.version);
  }
  let c=await base('iasdpi_schedule_catalog');
  for(const person of c.people)await save('availability',crypto.randomUUID(),{person_id:person.id,department_id:null,kind:'available',pattern:'weekly',weekdays:[0,3,6],active:true,origin:'manual'});
  c=await base('iasdpi_schedule_catalog');
  for(const [person,department] of [[20,1],[21,2],[22,3],[23,4]]){const m=c.memberships.find(m=>m.person_id===id(person)&&m.department_id===id(department));await save('membership',m.id,{is_ministry_head:true},m.version);}
  // Histórico publicado fictício: demonstra continuidade sem importar cultos reais.
  const config=await base('iasdpi_schedule_settings_get'),date=new Date(config.today.slice(0,7)+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()-1);const day=date.toISOString().slice(0,10);
  const event={id:crypto.randomUUID(),title:'Histórico fictício para rodízio',scheduled_on:day,timing_mode:'day',starts_at:null,ends_at:null};store.events.push(event);
  const plan={id:crypto.randomUUID(),department_id:id(1),month:day.slice(0,7)+'-01',title:'Histórico fictício',status:'published',version:1,requirements:[{id:crypto.randomUUID(),event_id:event.id,role_id:id(40),required_count:1,notes:'Exemplo, não é uma atribuição real.',assignments:[{id:crypto.randomUUID(),person_id:id(20),timing_mode:'day',starts_at:null,ends_at:null,assigned_on:day}]}]};
  store.plans.set(plan.department_id+':'+plan.month,plan);store.versions.set(plan.id,[structuredClone(plan)]);
 })();store.monthlyReady=ready;
 async function context(department,month){
  const c=await base('iasdpi_schedule_catalog');if(!c.departments.some(d=>d.id===department&&d.can_manage))throw Error('Sem gestão deste departamento.');
  const plan=store.plans.get(department+':'+month),occupied=[...store.plans.values()].flatMap(p=>p.requirements.flatMap(r=>r.assignments.map(a=>({person:a.person_id,day:store.events.find(e=>e.id===r.event_id).scheduled_on,plan:p.id,department:p.department_id,status:p.status}))));
  const workspace=await base('iasdpi_schedule_workspace',{p_department:department,p_month:month}),exceptions=await base('iasdpi_schedule_exceptions');
  return {month,department_id:department,basis_version:plan?.version||0,history_scope:'published-before-month',heads:c.memberships.filter(m=>m.department_id===department&&m.active&&m.is_ministry_head).map(m=>c.people.find(p=>p.id===m.person_id)?.display_name).filter(Boolean),people:c.people.filter(p=>c.memberships.some(m=>m.person_id===p.id&&m.department_id===department)).map(p=>{
   const rows=occupied.filter(a=>a.person===p.id),history=rows.filter(a=>a.department===department&&a.day<month&&a.status==='published'),external=rows.filter(a=>a.plan!==plan?.id&&a.day.slice(0,7)===month.slice(0,7));
   return {person_id:p.id,history_count:new Set(history.map(a=>a.day)).size,last_day:history.map(a=>a.day).sort().at(-1)||null,global_days:[...new Set(external.map(a=>a.day))],department_days:[...new Set(external.filter(a=>a.department===department).map(a=>a.day))],days:workspace.availability.filter(a=>a.person_id===p.id).map(a=>({date:a.date,state:a.state,conflict:external.some(x=>x.day===a.date&&x.department!==department&&!exceptions.some(e=>e.enabled&&e.person_id===p.id&&e.day===a.date&&[e.department_a,e.department_b].includes(department)&&[e.department_a,e.department_b].includes(x.department)))}))};
  })};
 }
 IASDPISchedulePreview.request=async(name,args={})=>{
  await ready;
  if(name==='iasdpi_schedule_rotation_context')return context(args.p_department,args.p_month);
  if(name==='iasdpi_schedule_workspace'){const data=await base(name,args);return {...data,monthly:true,rotation_context:await context(args.p_department,args.p_month)};}
  return base(name,args);
 };
})();
