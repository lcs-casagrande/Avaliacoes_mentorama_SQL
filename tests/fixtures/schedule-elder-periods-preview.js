'use strict';
// Adaptador exclusivo da prévia: períodos canônicos, versões e confirmações na aba.
(()=>{
 const request=IASDPISchedulePreview.request,store=IASDPIKnownPreview,clone=v=>structuredClone(v),engine=()=>IASDPIElderPeriods;
 const periods=new Map(),identities=new Map(),receipts=new Map(),versions=[];store.elderPeriods=periods;store.elderPeriodVersions=versions;
 const key=(d,r)=>d+':'+engine().key(r),source=()=>IASDPICalendarOfficialSource().events||[];
 function publishedPeriods(){const found=new Map();for(const row of versions)if(row.status==='published')found.set(key(row.department_id,row),row);return [...found.values()];}
 window.IASDPICalendarManagedPeriodsSource=()=>publishedPeriods().map(row=>({id:row.id,kind:row.kind,startDate:row.starts_on,endDate:row.ends_on,person:IASDPIKnownPreviewSeed.catalog.people.find(p=>p.id===row.person_id)?.display_name||'',origin:'Escala publicada nesta demonstração · memória da aba'}));
 function period(c,d,r){const identity=key(d,r),old=periods.get(identity);if(old)return clone(old);if(!identities.has(identity))identities.set(identity,crypto.randomUUID());const ref=source().find(e=>e.kind===r.kind&&e.startDate===r.starts_on&&e.endDate===r.ends_on),person=c.people.find(p=>p.display_name===ref?.person&&c.memberships.some(m=>m.person_id===p.id&&m.department_id===d));return {id:identities.get(identity),department_id:d,...r,person_id:person?.id||null,status:'draft',version:0,source_name:ref?.person||null};}
 function occupied(){return [...store.scheduleCommitments(),...[...publishedPeriods(),...[...periods.values()].filter(p=>p.status!=='published')].filter(p=>p.person_id&&engine().conflictsEnabled(p)).flatMap(p=>engine().range(p.starts_on,p.ends_on).map(date=>({person_id:p.person_id,department_id:p.department_id,date,status:p.status})))];}
 function context(result,department){const commitments=occupied();result.availability_enabled=false;for(const p of result.people)for(const day of p.days)if(commitments.some(a=>a.person_id===p.person_id&&a.department_id!==department&&a.status==='published'&&a.date===day.date))day.conflict=true;return result;}
 function history(c,department,month){const result=new Map();for(const ref of source()){if(!['weekly','monthly'].includes(ref.kind)||ref.startDate>=month)continue;const person=c.people.find(p=>p.display_name===ref.person&&c.memberships.some(m=>m.person_id===p.id&&m.department_id===department));if(person){const row={kind:ref.kind,starts_on:ref.startDate,ends_on:ref.endDate,person_id:person.id,status:'reference'};result.set(engine().key(row),row);}}for(const r of publishedPeriods())if(r.department_id===department&&r.starts_on<month)result.set(engine().key(r),clone(r));return [...result.values()];}
 IASDPISchedulePreview.request=async function(name,args={}){
  if(name==='iasdpi_schedule_settings_get'){const s=await request(name,args);return {...s,elder_periods:true,availability_enabled:false};}
  if(name==='iasdpi_schedule_workspace'){const s=await request(name,args);s.settings={...s.settings,elder_periods:true,availability_enabled:false};s.rotation_context=context(s.rotation_context,args.p_department);return s;}
  if(name==='iasdpi_schedule_rotation_context')return context(await request(name,args),args.p_department);
  if(name==='iasdpi_schedule_save'&&args.p_entity==='availability')throw Error('Disponibilidade temporariamente desativada; regras anteriores preservadas.');
  if(name==='iasdpi_schedule_member_save'&&(Object.hasOwn(args.p_data,'weekdays')||Object.hasOwn(args.p_data,'unavailable_dates')))throw Error('Disponibilidade temporariamente desativada; não alterada.');
  if(name==='iasdpi_schedule_plan_save'){
   const previous=[...store.plans.values()].find(p=>p.id===args.p_id),d=previous?.department_id||args.p_data.department_id,requirements=args.p_data.requirements||previous?.requirements||[];
   for(const r of requirements)for(const a of r.assignments)if(publishedPeriods().some(p=>engine().conflictsEnabled(p)&&p.person_id===a.person_id&&p.department_id!==d&&engine().range(p.starts_on,p.ends_on).includes(store.events.find(e=>e.id===r.event_id)?.scheduled_on)))throw Error('Conflito com escala de ancião publicada neste período.');
  }
  if(name==='iasdpi_schedule_elder_workspace'||name==='iasdpi_schedule_elder_save'||name==='iasdpi_schedule_elder_versions'){
   const c=await request('iasdpi_schedule_catalog'),d=c.departments.find(d=>d.id===args.p_department&&d.active&&d.code==='ancionato');
   if(!d||!(c.is_admin||d.can_roster||d.can_manage))throw Error('Sem consulta autorizada ao Ancionato.');
   if(name==='iasdpi_schedule_elder_versions')return versions.filter(r=>r.department_id===d.id&&r.kind===args.p_kind&&r.starts_on===args.p_starts_on).map(r=>({version:r.version,actor_id:r.actor_id,captured_at:r.captured_at,snapshot:clone(r)})).reverse();
   if(name==='iasdpi_schedule_elder_workspace')return {periods:(args.p_year?[...engine().periods(args.p_month.slice(0,7)).filter(r=>r.kind==='weekly'),...engine().year(args.p_year)]:engine().periods(args.p_month.slice(0,7))).map(r=>period(c,d.id,r)),commitments:occupied(),history:history(c,d.id,args.p_month),availability_enabled:false};
   if(!(c.is_admin||d.can_manage))throw Error('Sem gestão do Ancionato.');
   if(!args.p_request_id||!['draft','published'].includes(args.p_status)||!Array.isArray(args.p_rows)||!args.p_rows.length||args.p_rows.length>12)throw Error('Gravação de períodos inválida.');
   const signature=JSON.stringify(args);if(receipts.has(args.p_request_id)){const receipt=receipts.get(args.p_request_id);if(receipt.signature!==signature)throw Error('Solicitação reutilizada.');return clone(receipt.result);}
   const seen=new Set(),next=[];
   for(const row of args.p_rows){
    const definition=engine().periods(row.starts_on.slice(0,7)).find(r=>engine().key(r)===engine().key(row));if(!definition||row.ends_on!==definition.ends_on||seen.has(engine().key(row)))throw Error('Período deve ser único: domingo a sábado, ou mês completo.');seen.add(engine().key(row));
    const old=period(c,d.id,definition);if(row.id!==old.id||row.expected_version!==old.version)throw Error('Esta escala mudou em outra edição. Atualize antes de salvar.');
    if(args.p_status==='published'&&!row.person_id)throw Error('Publicação bloqueada: há períodos sem ancião.');
    if(row.person_id){const reasons=engine().reasons(c,d.id,row,row.person_id,occupied());if(reasons.length)throw Error(reasons.join('; '));}
    next.push({...old,person_id:row.person_id||null,status:args.p_status,version:old.version+1});
   }
   // Só altera o estado após validar todo o lote. Nenhuma gravação parcial.
   for(const row of next){periods.set(key(d.id,row),clone(row));versions.push({...clone(row),actor_id:c.actor_id,captured_at:new Date().toISOString()});}
   const result={periods:clone(next)};receipts.set(args.p_request_id,{signature,result});return result;
  }
  return request(name,args);
 };
})();
