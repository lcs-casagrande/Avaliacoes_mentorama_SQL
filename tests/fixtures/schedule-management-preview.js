'use strict';
// Somente prévia/testes: simulação em memória, NÃO é implementação de segurança.
window.IASDPIB1Preview={events:[],plans:new Map(),versions:new Map(),receipts:new Map(),failNext:false};
(()=>{
 const base=window.IASDPISchedulePreview.request,store=window.IASDPIB1Preview,copy=v=>structuredClone(v);
 function local(day,time){
  const wanted=Date.parse(day+'T'+time+':00Z');let guess=wanted;
  for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));const n=Object.fromEntries(parts.map(p=>[p.type,p.value]));guess+=wanted-Date.UTC(+n.year,+n.month-1,+n.day,+n.hour,+n.minute,+n.second);}
  return new Date(guess).toISOString();
 }
 window.IASDPISchedulePreview.request=async(name,b={})=>{
  if(!['iasdpi_schedule_workspace','iasdpi_schedule_event_create','iasdpi_schedule_plan_save','iasdpi_schedule_plan_version'].includes(name))return base(name,b);
  if(store.failNext){store.failNext=false;throw Error('Falha temporária simulada. Tente novamente.');}
  const catalog=await base('iasdpi_schedule_catalog');
  const key=(d,month)=>d+':'+month;
  if(name==='iasdpi_schedule_workspace'){
   const plan=store.plans.get(key(b.p_department,b.p_month));
   return copy({plan:plan||null,events:store.events.filter(e=>e.scheduled_on.slice(0,7)===b.p_month.slice(0,7)),versions:plan?[...(store.versions.get(plan.id)||[])].reverse().map(p=>({version:p.version,actor_id:catalog.actor_id})):[]});
  }
  if(name==='iasdpi_schedule_plan_version')return copy(store.versions.get(b.p_id)?.find(p=>p.version===b.p_version)||null);
  const signature=name+JSON.stringify(b);
  if(store.receipts.has(b.p_request_id)){const old=store.receipts.get(b.p_request_id);if(old.signature!==signature)throw Error('Solicitação reutilizada com dados diferentes.');return copy(old.response);}
  const data=b.p_data;
  if(!catalog.departments.some(d=>d.id===data.department_id&&d.can_manage))throw Error('Sem gestão deste departamento.');
  let result;
  if(name==='iasdpi_schedule_event_create'){
   const start=local(data.date,data.start_time),end=local(data.end_date||data.date,data.end_time);
   if(end<=start)throw Error('Término deve ser posterior ao início.');
   const existing=store.events.find(e=>e.title.trim().toLocaleLowerCase()===data.title.trim().toLocaleLowerCase()&&e.starts_at===start);
   if(existing&&existing.ends_at!==end)throw Error('Já existe evento com horários diferentes.');
   result=existing||{id:b.p_id,title:data.title,scheduled_on:data.date,starts_at:start,ends_at:end};
   if(!existing)store.events.push(result);
  }else{
   const previous=store.plans.get(key(data.department_id,data.month));
   if(previous&&(previous.id!==b.p_id||previous.version!==b.p_expected_version))throw Error('Esta escala mudou em outro dispositivo. Recarregue e compare.');
   if(!previous&&b.p_expected_version!==0)throw Error('Escala não encontrada.');
   result={...copy(data),id:b.p_id,version:b.p_expected_version+1};
   const pending=[];
   for(const r of result.requirements){
    const event=store.events.find(e=>e.id===r.event_id),role=catalog.roles.find(role=>role.id===r.role_id&&role.department_id===data.department_id&&role.active);
    if(!event||event.scheduled_on.slice(0,7)!==data.month.slice(0,7)||!role)throw Error('Evento ou função inválida.');
    for(const a of r.assignments){
     const person=catalog.people.find(p=>p.id===a.person_id&&p.active),membership=catalog.memberships.find(m=>m.person_id===a.person_id&&m.department_id===data.department_id&&m.active);
     if(!person||!membership||!catalog.qualifications.some(q=>q.membership_id===membership.id&&q.role_id===r.role_id))throw Error('Voluntário sem habilitação ativa.');
     a.starts_at=a.starts_at||event.starts_at;a.ends_at=a.ends_at||event.ends_at;
     const others=[...store.plans.values()].filter(p=>p.id!==b.p_id).flatMap(p=>p.requirements.flatMap(r=>r.assignments));
     if([...others,...pending].some(other=>other.person_id===a.person_id&&Date.parse(other.starts_at)<Date.parse(a.ends_at)&&Date.parse(a.starts_at)<Date.parse(other.ends_at)))throw Error('Conflito de horários entre atribuições.');
     pending.push(a);
    }
   }
   if(result.status==='published'&&(!result.requirements.length||result.requirements.some(r=>r.assignments.length<r.required_count)))throw Error('Publicação bloqueada: vagas pendentes.');
   store.plans.set(key(data.department_id,data.month),copy(result));
   if(!store.versions.has(b.p_id))store.versions.set(b.p_id,[]);store.versions.get(b.p_id).push(copy(result));
  }
  store.receipts.set(b.p_request_id,{signature,response:copy(result)});return copy(result);
 };
})();
