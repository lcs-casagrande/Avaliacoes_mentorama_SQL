'use strict';
// Demonstração isolada: datas e vagas vazias prontas, nunca atribuições publicadas.
(()=>{
 const request=IASDPISchedulePreview.request,store=IASDPIKnownPreview;
 const ready=(async()=>{
  const c=await request('iasdpi_schedule_catalog'),config=await request('iasdpi_schedule_settings_get');
  const generated=await request('iasdpi_schedule_generate_days',{p_department:c.departments[0].id,p_title:'Culto'});
  for(const department of c.departments.filter(d=>d.active))for(const month of config.future_months){
   const role=c.roles.find(r=>r.department_id===department.id&&r.general_assignment),plan={id:crypto.randomUUID(),department_id:department.id,month,title:'Escala mensal — '+department.name,status:'draft',version:0,requirements:generated.events.filter(e=>e.scheduled_on.slice(0,7)===month.slice(0,7)&&(!config.department_weekdays?.[department.id]||config.department_weekdays[department.id].includes(new Date(e.scheduled_on+'T12:00:00Z').getUTCDay()))).map(e=>({id:crypto.randomUUID(),event_id:e.id,role_id:role.id,required_count:1,notes:'',assignments:[]}))};
   store.plans.set(department.id+':'+month,structuredClone(plan));
  }
 })();
 IASDPISchedulePreview.request=async(name,args={})=>{await ready;return request(name,args);};
})();
