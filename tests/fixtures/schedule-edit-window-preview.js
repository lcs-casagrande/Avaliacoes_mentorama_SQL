'use strict';
// Mesma política temporal da 023; somente memória, nunca Supabase.
(()=>{
 const g=IASDPIG6Preview,previous=g.rpc,clone=v=>structuredClone(v),receipts=new Map(),ok=value=>({handled:true,value});
 const fail=message=>{throw Error(message);};
 function policy(settings){const b=IASDPIScheduleEditWindow.bounds(settings);return {schedule_edit_policy:true,today:b.from,editable_from:b.from,editable_until:b.until};}
 const can=(a,d,status)=>g.cap(a,d,'edit')&&(status!=='published'||g.cap(a,d,'publish'));
 function frozen(plan,events,today){return (plan?.requirements||[]).filter(r=>events.find(e=>e.id===r.event_id)?.scheduled_on<today).map(r=>({id:r.id,event_id:r.event_id,role_id:r.role_id,required_count:r.required_count,notes:r.notes||'',assignments:r.assignments.map(a=>({id:a.id,person_id:a.person_id,timing_mode:a.timing_mode||events.find(e=>e.id===r.event_id)?.timing_mode,starts_at:a.starts_at||null,ends_at:a.ends_at||null})).sort((a,b)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.id.localeCompare(b.id));}
 g.rpc=async(a,name,args)=>{
  await window.IASDPIG84Demo?.ready;
  const settings=await g.raw('iasdpi_schedule_settings_get'),bounds=policy(settings),config={...settings,...bounds},store=IASDPIB1Preview;
  if(name==='iasdpi_schedule_settings_save'&&!([1,2,3,6].includes(args.p_data.planning_months)))fail('Escolha 1, 2, 3 ou 6 meses futuros.');
  if(['iasdpi_schedule_prepare_month','iasdpi_schedule_plan_save','iasdpi_schedule_event_create','iasdpi_schedule_elder_save'].includes(name)){
   const old=[...store.plans.values()].find(p=>p.id===args.p_id),d=args.p_department||old?.department_id||args.p_data?.department_id;
   if(name==='iasdpi_schedule_elder_save'?!(args.p_status==='published'?g.cap(a,d,'publish'):g.cap(a,d,'edit')):name==='iasdpi_schedule_plan_save'?!g.cap(a,d,'edit')&&!g.cap(a,d,'publish'):!can(a,d,args.p_data?.status))fail('Sem permissão para esta ação do departamento.');
   if(name==='iasdpi_schedule_plan_save'&&((args.p_data?.status==='published'&&!g.cap(a,d,'publish'))||(Object.keys(args.p_data||{}).some(k=>k!=='status')&&!g.cap(a,d,'edit'))||(args.p_data?.status!=='published'&&!g.cap(a,d,'edit'))))fail('Sem edição/publicação para esta ação.');
   if(old?.status==='published'&&!g.cap(a,d,'publish'))fail('Sem revisão de escala publicada.');
   const signature=JSON.stringify([a.id,name,args]),receipt=receipts.get(args.p_request_id);
   if(receipt){if(receipt.signature!==signature)fail('Solicitação reutilizada.');return ok(clone(receipt.value));}
   if(name==='iasdpi_schedule_prepare_month'){
    if(!IASDPIScheduleEditWindow.month(args.p_month.slice(0,7),config)||args.p_month.slice(8)!=='01')fail('Mês somente para consulta.');
    const c=await g.raw('iasdpi_schedule_catalog'),dept=c.departments.find(d=>d.id===args.p_department&&d.active);if(!dept)fail('Departamento inválido.');
    const events=[];for(const day of IASDPIScheduleManagement.dates(args.p_month.slice(0,7),[0,1,2,3,4,5,6]))if(IASDPIScheduleEditWindow.day(day,config)&&((dept.planning_weekdays||settings.weekdays).includes(new Date(day+'T12:00:00Z').getUTCDay())||settings.extra_dates.includes(day)))events.push(await g.raw('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:dept.id,date:day,title:args.p_title||'Culto'},p_request_id:crypto.randomUUID()}));
    const value={events,month:args.p_month,settings_version:settings.version};receipts.set(args.p_request_id,{signature,value:clone(value)});return ok(value);
   }
   if(name==='iasdpi_schedule_event_create'&&!IASDPIScheduleEditWindow.day(args.p_data.date,config))fail('Data encerrada ou fora do período de edição.');
   if(name==='iasdpi_schedule_plan_save'){
    const candidate={...clone(old||{}),...clone(args.p_data)};
    if(!IASDPIScheduleEditWindow.month(candidate.month?.slice(0,7),config))fail('Mês somente para consulta.');
    if(JSON.stringify(frozen(candidate,store.events,bounds.today))!==JSON.stringify(frozen(old,store.events,bounds.today)))fail('Datas encerradas não podem ser alteradas, incluídas ou removidas.');
    if(candidate.requirements.some(r=>store.events.find(e=>e.id===r.event_id)?.scheduled_on>bounds.editable_until))fail('Data fora do período de edição.');
    const value=await g.raw(name,{...args,p_data:candidate});receipts.set(args.p_request_id,{signature,value:clone(value)});return ok(value);
   }
   if(name==='iasdpi_schedule_elder_save'&&args.p_rows.some(row=>!IASDPIScheduleEditWindow.period(row,config)))fail('Período encerrado ou fora dos meses liberados.');
  }
  const result=await previous(a,name,args);
  if(result?.handled){
   if(['iasdpi_schedule_settings_get','iasdpi_schedule_settings_save'].includes(name))Object.assign(result.value,policy(result.value),{can_edit:a.globalRole==='admin'});
   if(name==='iasdpi_schedule_workspace'){Object.assign(result.value.settings,policy(result.value.settings));Object.assign(result.value.rotation_context,bounds);}
   if(name==='iasdpi_schedule_rotation_context')Object.assign(result.value,bounds);
  }
  return result;
 };
 window.IASDPIScheduleEditingDemo={policy};
})();
