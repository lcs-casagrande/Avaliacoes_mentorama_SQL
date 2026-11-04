'use strict';
// Exemplo pronto para clicar em rodízio. Exclusivo da prévia, sem dados reais.
(()=>{
 const request=IASDPISchedulePreview.request,store=IASDPIB1Preview;
 const ready=(async()=>{
  await store.monthlyReady;
  const catalog=await request('iasdpi_schedule_catalog'),settings=await request('iasdpi_schedule_settings_get');
  const generated=await request('iasdpi_schedule_generate_days',{p_department:catalog.departments[0].id,p_title:'Culto fictício — teste de rodízio',p_request_id:crypto.randomUUID()});
  for(const department of catalog.departments)for(const month of settings.future_months){
   const key=department.id+':'+month;if(store.plans.has(key))continue;
   const role=catalog.roles.find(r=>r.department_id===department.id&&r.active);if(!role)continue;
   const plan={id:crypto.randomUUID(),department_id:department.id,month,title:'Exemplo fictício para testar rodízio',status:'draft',version:1,requirements:generated.events.filter(e=>e.scheduled_on.slice(0,7)===month.slice(0,7)).map(event=>({id:crypto.randomUUID(),event_id:event.id,role_id:role.id,required_count:1,notes:'Vaga fictícia preparada para demonstração.',assignments:[]}))};
   store.plans.set(key,structuredClone(plan));store.versions.set(plan.id,[structuredClone(plan)]);
  }
 })();
 IASDPISchedulePreview.request=async(name,args={})=>{await ready;return request(name,args);};
 const draw=render;render=function(){
  draw();const help=document.querySelector('.b1-demo-help');if(help)help.innerHTML='<summary>Como testar o rodízio agora</summary><p>Os cultos, funções e vagas deste exemplo já estão preparados. Clique em <strong>Pré-preencher por rodízio</strong>, confira os nomes no calendário e clique em uma data para substituir ou remover uma pessoa. Salvar e publicar são apenas simulações nesta aba.</p><p>Todos os dados e disponibilidades são fictícios. Nenhuma pessoa foi atribuída automaticamente ao abrir esta prévia. Recarregar reinicia o exemplo.</p>';
 };
})();
