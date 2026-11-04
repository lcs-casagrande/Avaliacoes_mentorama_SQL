'use strict';
// Somente simulação em memória. SQL 022 é validada separadamente em PostgreSQL.
(()=>{
 const prior=window.fetch,store=IASDPIE1Demo,series=new Map(),seriesVersions=new Map(),receipts=new Map(),clone=v=>structuredClone(v),engine=IASDPIEventPlanning;
 const spaces=[{code:'nave',name:'Nave',exclusive:true},{code:'quadra',name:'Quadra',exclusive:true},{code:'patio',name:'Pátio',exclusive:true},{code:'salas',name:'Salas',exclusive:false},{code:'externo',name:'Externo',exclusive:false}];let queue=Promise.resolve();
 const fail=message=>{throw Error(message);},can=(a,e,cap)=>a?.enabled&&(a.globalRole==='admin'||e.category==='department'&&a.caps[e.department_id]?.[cap]);
 const json=async(name,b,options)=>{const r=await prior('https://g4demo.supabase.co/rest/v1/rpc/'+name,{...options,body:JSON.stringify(b)}),v=await r.json();if(!r.ok)throw Error(v.message||'Operação rejeitada.');return v;};
 const published=()=>[...store.versions.values()].map(rows=>rows.filter(v=>['published','cancelled'].includes(v.status)).at(-1)).filter(v=>v?.status==='published').map(v=>{const e=clone(v.snapshot);if(!e.spaces&&e.location){const known=spaces.find(s=>s.name.toLocaleLowerCase('pt-BR')===e.location.toLocaleLowerCase('pt-BR'));e.spaces=known?[known.code]:[];}return e;});
 function preview(a,data,exclude=[]){
  if(!can(a,data,'edit')||exclude.some(id=>!can(a,store.events.get(id),'edit')))fail('Sem permissão para este evento.');
  const candidates=engine.occurrences(data,data.recurrence_until||engine.yearEnd()).filter(e=>!data.preview_from||e.date>=data.preview_from),others=published().filter(e=>!exclude.includes(e.id));
  const out=[];for(const e of candidates){const conflicts=engine.conflicts(e,[...others,...out],spaces).map(c=>{const other=others.find(v=>v.title===c.event_title);return {...c,event_title:other?.is_restricted&&!can(a,other,'view')?'Evento restrito':c.event_title};});out.push({...e,reservation_conflicts:conflicts});}
  return {until:engine.yearEnd(),occurrences:out,conflict_count:out.filter(e=>e.reservation_conflicts.length).length};
 }
 const clean=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['recurrence','recurrence_weekday','recurrence_ordinal','reservation_conflicts','preview_from','recurrence_until'].includes(k)));
 async function write(a,id,version,patch,options,meta={},pending=false){
  const old=store.events.get(id),candidate={...old,...patch};if(!can(a,candidate,'edit')||old&&!can(a,old,'edit')||['published','cancelled'].includes(patch.status)&&(!can(a,candidate,'publish')||old&&!can(a,old,'publish')))fail('Sem permissão para salvar/publicar.');
  const approval=['pending','rejected'].includes(old?.approval_status)?old.approval_status:pending||candidate.program_category==='general'?'pending':old?.approval_status||'not_required';
  const conflicts=patch.status==='cancelled'?[]:preview(a,{...candidate,recurrence:'none'},old?[id]:[]).occurrences[0].reservation_conflicts;
  if(conflicts.length&&!pending)fail(conflicts.map(c=>c.space_name+' · '+c.date+' · '+c.occupied+' · '+c.event_title).join('; '));
  const payload=clean(patch);if(approval==='pending'&&payload.status==='published')payload.status='draft';
  if(payload.status==='published'&&candidate.spaces?.some(code=>spaces.find(s=>s.code===code)?.exclusive)&&!engine.interval(candidate))fail('Informe início e término ou marque Dia inteiro para confirmar a reserva exclusiva.');
  if(candidate.spaces!=null&&(!Array.isArray(candidate.spaces)||new Set(candidate.spaces).size!==candidate.spaces.length||candidate.spaces.some(code=>!spaces.some(s=>s.code===code))))fail('Locais inválidos ou duplicados.');
  const saved=await json('iasdpi_event_save',{p_id:id,p_expected_version:version,p_patch:payload,p_request_id:crypto.randomUUID()},options);
  Object.assign(store.events.get(id),{...meta,spaces:clone(candidate.spaces??null),approval_status:approval,reservation_conflicts:conflicts});
  const row=clone(store.events.get(id)),history=store.versions.get(id);history.at(-1).snapshot=clone(row);return row;
 }
 async function action(name,b,options,a){
  const signature=JSON.stringify([a.id,name,b]);
  const base=store.events.get(b.p_id),oldSeries=series.get(b.p_id),candidate=name==='iasdpi_event_series_save'?{...oldSeries?.definition,...b.p_patch}:{...base,...b.p_patch};
  if(!can(a,candidate,'edit')||base&&!can(a,base,'edit')||oldSeries&&!can(a,oldSeries.definition,'edit')||['published','cancelled'].includes(candidate.status)&&!can(a,candidate,'publish'))fail('Sem permissão para salvar/publicar.');
  if(receipts.has(b.p_request_id)){const old=receipts.get(b.p_request_id);if(old.signature!==signature)fail('Solicitação já utilizada.');return clone(old.result);}
  if(name==='iasdpi_event_submit'){
   if((base?.version||0)!==b.p_expected_version)fail('Evento alterado em outro dispositivo.');
   const plan=preview(a,{...candidate,recurrence:'none'},base?[base.id]:[]);
   if(base?.series_id&&plan.conflict_count&&!b.p_accept_conflicts)return {...plan,requires_confirmation:true};
   const event=await write(a,b.p_id,b.p_expected_version,b.p_patch,options,{},Boolean(base?.series_id&&plan.conflict_count));
   if(base?.series_id){const root=series.get(base.series_id);root.version++;if(event.approval_status==='pending')root.approval_status='pending';}
   const result={event,requires_confirmation:false};receipts.set(b.p_request_id,{signature,result:clone(result)});return result;
  }
  if((oldSeries?.version||0)!==b.p_expected_version||!['all','following'].includes(b.p_scope))fail('A série mudou ou a abrangência é inválida.');
  const selected=store.events.get(b.p_occurrence);if(b.p_scope==='following'&&(!selected||selected.series_id!==b.p_id))fail('Ocorrência não pertence à série.');
  const cutoff=b.p_scope==='following'?selected.occurrence_on:null,oldRows=[...store.events.values()].filter(e=>e.series_id===b.p_id&&(!cutoff||e.occurrence_on>=cutoff));
  const plan=preview(a,{...candidate,recurrence_until:oldSeries?.until_date||engine.yearEnd(),...(cutoff?{preview_from:cutoff}:{})},oldRows.map(e=>e.id));
  if(plan.conflict_count&&!b.p_accept_conflicts&&candidate.status!=='cancelled')return {...plan,requires_confirmation:true};
  const pending=candidate.program_category==='general'||plan.conflict_count>0||oldSeries?.approval_status==='pending',root={id:b.p_id,definition:clone(candidate),until_date:oldSeries?.until_date||plan.until,version:(oldSeries?.version||0)+1,approval_status:pending?'pending':'not_required',category:candidate.category,department_id:candidate.department_id};
  series.set(root.id,root);const events=[];
  for(const row of oldRows.filter(e=>!plan.occurrences.some(x=>x.date===e.occurrence_on)))await write(a,row.id,row.version,{status:'cancelled'},options,{},true);
  for(const item of plan.occurrences){const old=oldRows.find(e=>e.occurrence_on===item.date);events.push(await write(a,old?.id||crypto.randomUUID(),old?.version||0,clean(item),options,{series_id:root.id,occurrence_on:item.date},Boolean(pending)));}
  const history=seriesVersions.get(root.id)||[];history.push(clone(root));seriesVersions.set(root.id,history);
  const result={series:clone(root),events,conflict_count:plan.conflict_count,requires_confirmation:false};receipts.set(b.p_request_id,{signature,result:clone(result)});return result;
 }
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url),name=url.pathname.split('/').pop();
  if(url.origin!=='https://g4demo.supabase.co')return prior(input,options);
  if(['iasdpi_events_published','iasdpi_events_visible'].includes(name)){const response=await prior(input,options);if(!response.ok)return response;const data=await response.json();data.events=data.events.filter(e=>!['pending','rejected'].includes(e.approval_status)&&!['pending','rejected'].includes(series.get(e.series_id)?.approval_status)).map(e=>{const result={...e,space_names:(e.spaces||[]).map(code=>spaces.find(s=>s.code===code)?.name||code)};delete result.reservation_conflicts;return result;});return Response.json(data);}
  if(name==='iasdpi_events_catalog'){const response=await prior(input,options);if(!response.ok)return response;const c=await response.json();for(const e of store.events.values()){if(!e.approval_status)e.approval_status='legacy';if(!('spaces' in e))e.spaces=null;}c.events=c.events.map(e=>({...e,approval_status:e.approval_status||'legacy',spaces:e.spaces??null}));return Response.json({...c,event_management_v2:true,spaces,organizer_options:[{value:'local_church',label:'Igreja Local'},{value:'association',label:'Associação / Missão'},{value:'school',label:'Escola Adventista'},{value:'other',label:'Outros'},...c.departments.map(d=>({value:'department:'+d.id,label:d.name}))],series:[...series.values()].filter(s=>c.is_admin||c.departments.some(d=>d.id===s.department_id)).map(clone)});}
  if(!['iasdpi_event_submit','iasdpi_event_series_save','iasdpi_event_preview'].includes(name))return prior(input,options);
  try{
   await IASDPIG84Demo.ready;const headers=new Headers(options.headers);if(headers.get('x-iasdpi-church')!=='IASD_PI')fail('Igreja não autorizada.');
   let actor;try{const token=(headers.get('authorization')||'').split(' ')[1],claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));actor=claims.exp>Date.now()/1000&&IASDPIG6Preview.accounts.find(a=>a.id===claims.sub&&a.enabled);}catch{}
   if(!actor)fail('Identidade autorizada necessária.');const b=JSON.parse(options.body||'{}');
   if(name==='iasdpi_event_preview')return Response.json(preview(actor,b.p_data,b.p_exclude));
   const task=queue.then(async()=>{const before=clone([...store.events]),versions=clone([...store.versions]),parents=clone([...series]);try{return await action(name,b,options,actor);}catch(error){store.events.clear();before.forEach(([k,v])=>store.events.set(k,v));store.versions.clear();versions.forEach(([k,v])=>store.versions.set(k,v));series.clear();parents.forEach(([k,v])=>series.set(k,v));throw error;}});queue=task.catch(()=>{});return Response.json(await task);
  }catch(error){return Response.json({message:error.message,code:'23514'},{status:400});}
 };
 window.IASDPIEventPlanningDemo={series,seriesVersions,spaces};
})();
