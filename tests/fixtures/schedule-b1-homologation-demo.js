'use strict';
// Exclusivo do pacote /b1/: cadastros fictícios, sem novas atribuições automáticas.
(()=>{
 const request=window.IASDPISchedulePreview.request,store=window.IASDPIB1Preview;
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 let catalog=null;
 const save=(entity,identifier,data,version=0)=>request('iasdpi_schedule_save',{p_entity:entity,p_id:identifier,p_expected_version:version,p_data:data,p_request_id:crypto.randomUUID()});
 const ready=(async()=>{
  await save('person',id(23),{name:'Pessoa Delta — exemplo',display_name:'Delta — exemplo',department_id:id(4)});
  catalog=await request('iasdpi_schedule_catalog');
  for(const [person,name] of [[20,'Alfa'],[21,'Beta'],[22,'Gama']]){
   const row=catalog.people.find(p=>p.id===id(person));await save('person',row.id,{display_name:name+' — exemplo'},row.version);
  }
  catalog=await request('iasdpi_schedule_catalog');
  // Alfa: Sono/Música; Beta: Sono/Diaconato; Gama: Música; Delta: Ancionato.
  for(const [person,department,role] of [[20,1,40],[20,3,42],[21,1,40],[21,2,41],[22,3,42],[23,4,43]]){
   const member=catalog.memberships.find(m=>m.person_id===id(person)&&m.department_id===id(department));
   await save('membership',member?.id||crypto.randomUUID(),{person_id:id(person),department_id:id(department),active:true,role_ids:[id(role)]},member?.version||0);
  }
  catalog=await request('iasdpi_schedule_catalog');
 })();
 store.demoReady=ready;
 function unavailable(person,department,start,end){
  const time=value=>value?(value.length===5?value+':00':value):'00:00:00';
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const local=date=>{const p=Object.fromEntries(format.formatToParts(new Date(date)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;};
  const first=local(start),last=local(end),firstDay=first.slice(0,10),lastDay=last.slice(0,10);
  return catalog.availability.some(v=>{
   if(!v.active||v.kind!=='unavailable'||v.person_id!==person||(v.department_id&&v.department_id!==department))return false;
   if(v.pattern==='period'){
    const after=new Date(v.ends_on+'T12:00:00Z');after.setUTCDate(after.getUTCDate()+1);
    return `${v.starts_on}T${time(v.start_time)}`<last&&first<(v.end_time?`${v.ends_on}T${time(v.end_time)}`:`${after.toISOString().slice(0,10)}T00:00:00`);
   }
   for(let day=new Date(firstDay+'T12:00:00Z');day.toISOString().slice(0,10)<=lastDay;day.setUTCDate(day.getUTCDate()+1)){
    const date=day.toISOString().slice(0,10);if(!(v.weekdays||[]).includes(day.getUTCDay())||(v.valid_from&&date<v.valid_from)||(v.valid_until&&date>v.valid_until))continue;
    const after=new Date(day);after.setUTCDate(after.getUTCDate()+1);
    if(`${date}T${time(v.start_time)}`<last&&first<(v.end_time?`${date}T${time(v.end_time)}`:`${after.toISOString().slice(0,10)}T00:00:00`))return true;
   }
   return false;
  });
 }
 window.IASDPISchedulePreview.request=async(name,args={})=>{
  await ready;
  // A demonstração B1 antecede as configurações da 007; não simular dias/Ancionato G5 aqui.
  if(name==='iasdpi_schedule_settings_get')return null;
  if(name==='iasdpi_schedule_plan_save'){
   catalog=await request('iasdpi_schedule_catalog');
   for(const r of args.p_data.requirements||[])for(const a of r.assignments||[]){
    const event=store.events.find(e=>e.id===r.event_id);
    if(event&&unavailable(a.person_id,args.p_data.department_id,a.starts_at||event.starts_at,a.ends_at||event.ends_at))throw Error('Conflito simulado: voluntário indisponível no período.');
   }
  }
  const result=await request(name,args);
  if(name==='iasdpi_schedule_catalog')catalog=result;
  if(name==='iasdpi_schedule_save')catalog=await request('iasdpi_schedule_catalog');
  return result;
 };
 window.IASDPICalendarSource=()=>{
  if(!catalog)return [];
  return [...store.plans.values()].filter(p=>p.status==='published').flatMap(plan=>plan.requirements.flatMap(r=>{
   const event=store.events.find(e=>e.id===r.event_id),department=catalog.departments.find(d=>d.id===plan.department_id),role=catalog.roles.find(role=>role.id===r.role_id);
   if(!event||!department)return [];
   return r.assignments.map(a=>({id:'demo:'+a.id,date:event.scheduled_on,department:department.name,person:catalog.people.find(p=>p.id===a.person_id)?.display_name||'Pessoa fictícia não encontrada',role:role?.name||'Função fictícia não encontrada',origin:'DEMONSTRAÇÃO · escala fictícia publicada · versão '+plan.version}));
  }));
 };
 const draw=render;
 render=function(){
  draw();
  document.querySelectorAll('[data-demo-view]').forEach(el=>{if(el.dataset.demoView===state.page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(state.page!=='schedule-build')return;
  const scope=document.querySelector('#b1-scope')?.closest('section');if(!scope)return;
  const help=document.createElement('details');help.className='panel b1-demo-help';help.innerHTML=`<summary>Como testar um conflito entre departamentos</summary><p>Somente pessoas fictícias. Alfa está habilitada em Sonoplastia e Música; Beta em Sonoplastia e Diaconato; Gama em Música e Delta em Ancionato. Nenhuma pessoa foi escalada automaticamente.</p><ol><li>Em Sonoplastia, escolha um mês, informe 09:30–11:30 e gere sábados.</li><li>Selecione um evento, adicione a função de áudio, escolha Alfa — exemplo e salve o rascunho.</li><li>Abra Música no mesmo mês. Use o mesmo evento, adicione a função de vocalista, escolha Alfa — exemplo e tente salvar: haverá conflito.</li><li>Troque por Gama — exemplo, salve e publique. No calendário demonstrativo, selecione o mesmo mês para consultar a escala publicada.</li></ol><p>Use <strong>Cadastros</strong> para consultar ou editar as pessoas, funções, habilitações e disponibilidades fictícias. A simulação não comprova permissões RLS. Tudo reinicia ao recarregar.</p>`;
  scope.before(help);
 };
})();
