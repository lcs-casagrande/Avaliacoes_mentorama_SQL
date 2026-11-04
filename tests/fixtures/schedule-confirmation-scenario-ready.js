'use strict';
// Somente o arquivo separado de teste: nunca carregado com nomes informados.
(()=>{
 const request=IASDPISchedulePreview.request,store=IASDPIKnownPreview;
 const ready=(async()=>{
  const c=await request('iasdpi_schedule_catalog'),config=await request('iasdpi_schedule_settings_get');
  const generated=await request('iasdpi_schedule_generate_days',{p_department:c.departments[0].id,p_title:'Culto fictício de teste'});
  for(const department of c.departments)for(const month of config.future_months){
   const role=c.roles.find(r=>r.department_id===department.id),plan={id:crypto.randomUUID(),department_id:department.id,month,title:'Cenário fictício isolado',status:'draft',version:1,requirements:generated.events.filter(e=>e.scheduled_on.slice(0,7)===month.slice(0,7)).map(e=>({id:crypto.randomUUID(),event_id:e.id,role_id:role.id,required_count:1,notes:'Vaga de teste, sem correspondência com pessoa real.',assignments:[]}))};
   store.plans.set(department.id+':'+month,structuredClone(plan));store.versions.set(plan.id,[structuredClone(plan)]);
  }
 })();
 IASDPISchedulePreview.request=async(name,args={})=>{await ready;return request(name,args);};
})();
