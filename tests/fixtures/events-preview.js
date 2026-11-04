'use strict';
// Adaptador de homologação E1. Só memória; não cria contas ou dados no Supabase.
(()=>{
 const privacy=window.IASDPIConfig?.calendarPrivacyEnabled===true;
 const previous=window.fetch,events=new Map(),versions=new Map(),receipts=new Map();let serial=Promise.resolve();
 const clone=v=>structuredClone(v),allowed=new Set(['title','date','end_date','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason','all_day','program_category','organizer_kind','audience','is_restricted','organizer_department_id']);
 const fail=(message,code='23514')=>{const e=Error(message);e.code=code;throw e;};
 const can=(a,e,cap)=>a?.enabled&&(a.globalRole==='admin'||e.category==='department'&&Boolean(a.caps[e.department_id]?.[cap]));
 const catalog=()=>IASDPIKnownPreviewSeed.catalog,dept=id=>catalog().departments.find(d=>d.id===id);
 const current=a=>[...events.values()].filter(e=>a.globalRole==='admin'||e.category==='department'&&a.caps[e.department_id]?.view);
 const time=t=>t?String(t).padEnd(8,':00'):'';
 function fingerprint(e){return JSON.stringify([e.title.trim().normalize('NFC').toLowerCase(),e.date,e.end_date,time(e.start_time),time(e.end_time),e.category,e.department_id,e.location.trim().toLowerCase()]);}
 function save(a,b){
  if(!b.p_id||!Number.isInteger(b.p_expected_version)||b.p_expected_version<0||!b.p_request_id||!b.p_patch||Object.keys(b.p_patch).some(k=>!allowed.has(k)))fail('Campos, identificador ou versão inválidos.','22023');
  const old=events.get(b.p_id),patch=b.p_patch,e={title:'',location:'',description:'',category:null,department_id:null,program_category:null,organizer_kind:null,audience:null,is_restricted:false,organizer_department_id:null,all_day:false,start_time:null,end_time:null,status:'draft',source_key:null,source_url:null,cancellation_reason:'',...clone(old||{}),...clone(patch)};
  if(!Object.hasOwn(patch,'end_date')&&(!old||old.date===old.end_date))e.end_date=e.date;
  const edit=!old||Object.keys(patch).some(k=>!['status','cancellation_reason'].includes(k))||e.status==='draft';
  if(edit&&(!can(a,e,'edit')||old&&!can(a,old,'edit'))||['published','cancelled'].includes(e.status)&&(!can(a,e,'publish')||old&&!can(a,old,'publish')))fail('Sem permissão para gerir ou publicar este evento nesta igreja e departamento.','42501');
  if(e.source_key&&(!old||e.source_key!==old.source_key)&&a.globalRole!=='admin')fail('Somente administrador associa eventos da fonte oficial.','42501');
  const sig=JSON.stringify([a.id,b.p_id,b.p_expected_version,b.p_patch]),receipt=receipts.get(b.p_request_id);
  if(receipt){if(receipt.sig!==sig)fail('Solicitação já utilizada.','22023');return clone(receipt.result);}
  if((old?.version||0)!==b.p_expected_version)fail('Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.','40001');
  if(old?.source_key&&(e.source_key!==old.source_key||e.source_url!==old.source_url))fail('A associação da fonte existente não pode ser substituída.','22023');
  if(e.title.trim().length<2||e.title.length>160||!IASDPIEvents.validDate(e.date)||!IASDPIEvents.validDate(e.end_date)||e.end_date<e.date||new Date(e.end_date)-new Date(e.date)>366*86400000||e.description.length>5000||e.location.length>500||!['draft','published','cancelled'].includes(e.status)||e.category!==null&&!['church','department'].includes(e.category)||e.department_id&&(!dept(e.department_id)||e.category!=='department'))fail('Revise título, datas, categoria e departamento.');
  if(typeof e.is_restricted!=='boolean'||e.program_category&&!['general','departmental','reserved'].includes(e.program_category)||e.organizer_kind&&!['local_church','association','school','department','other'].includes(e.organizer_kind)||e.audience&&!['whole_church','specific','restricted'].includes(e.audience)||e.organizer_department_id&&(e.organizer_kind!=='department'||!dept(e.organizer_department_id)))fail('Classificação, organizador, público-alvo ou restrição inválidos.');
  if(typeof e.all_day!=='boolean'||e.all_day&&(e.start_time||e.end_time))fail('Dia inteiro não possui horários preenchidos.');
  for(const t of [e.start_time,e.end_time])if(t&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(t))fail('Horário inválido.');
  if(e.status==='published'&&e.end_time&&!e.start_time||e.date===e.end_date&&e.start_time&&e.end_time&&time(e.end_time)<=time(e.start_time))fail('O término deve ocorrer após o início.');
  if(e.status==='published'&&(!e.category||e.category==='department'&&!dept(e.department_id)?.active))fail('Confirme a categoria e o departamento responsável antes de publicar.');
  if(Boolean(e.source_key)!==Boolean(e.source_url)||e.source_url&&e.source_url!=='https://iasd-paradainglesa.netlify.app/')fail('Fonte inválida.');
  if([...events.values()].some(x=>x.id!==b.p_id&&(e.source_key&&x.source_key===e.source_key||fingerprint(x)===fingerprint(e))))fail('Evento ou fonte já cadastrado. Reabra o registro existente.','23505');
  Object.assign(e,{id:b.p_id,church_id:'1a5d0000-0000-4000-8000-000000000001',version:(old?.version||0)+1,created_by:old?.created_by||a.id,created_at:old?.created_at||new Date().toISOString(),updated_by:a.id,updated_at:new Date().toISOString()});
  events.set(e.id,e);const history=versions.get(e.id)||[];history.push({event_id:e.id,version:e.version,status:e.status,actor_id:a.id,captured_at:e.updated_at,snapshot:clone(e)});versions.set(e.id,history);receipts.set(b.p_request_id,{sig,result:clone(e)});return clone(e);
 }
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url),name=url.pathname.split('/').pop();
  if(!privacy&&['iasdpi_registry_public','iasdpi_schedule_visible','iasdpi_schedule_published'].includes(name))return previous(input,options);
  if(url.origin!=='https://g4demo.supabase.co'||!['iasdpi_registry_public','iasdpi_schedule_published','iasdpi_schedule_visible','iasdpi_events_visible','iasdpi_events_catalog','iasdpi_events_published','iasdpi_event_save','iasdpi_event_history'].includes(name))return previous(input,options);
  try{
   await IASDPIG84Demo.ready;await IASDPIG4Demo.ready;
   const headers=new Headers(options.headers);if(headers.get('x-iasdpi-church')!=='IASD_PI')fail('Igreja não autorizada.','42501');
   const b=JSON.parse(options.body||'{}');
   let actor;try{const token=(headers.get('authorization')||'').split(' ')[1];actor=IASDPIG6Preview.accounts.find(a=>a.id===JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub&&a.enabled);}catch{}
   if(privacy&&!window.IASDPIE1Demo.seeded){
    for(const source of IASDPIEvents.sources(true)){const e={...source,id:crypto.randomUUID(),category:'church',department_id:null,program_category:null,organizer_kind:null,audience:null,is_restricted:false,version:1};events.set(e.id,e);versions.set(e.id,[{event_id:e.id,version:1,status:'published',snapshot:clone(e)}]);}
    window.IASDPIE1Demo.seeded=true;
   }
   if(name==='iasdpi_registry_public'){const response=await previous(input,options);if(!response.ok)return response;const value=await response.json();value.links=value.links.filter(l=>l.source_key.startsWith('ministry:'));return Response.json(value);}
   if(['iasdpi_schedule_published','iasdpi_schedule_visible'].includes(name)){
    if(name==='iasdpi_schedule_visible'&&!actor)fail('Entre com identidade autorizada.','42501');
    const response=await previous('https://g4demo.supabase.co/rest/v1/rpc/iasdpi_schedule_published',options);if(!response.ok)return response;
    const managed=await response.json(),legacy=name==='iasdpi_schedule_visible'?(window.IASDPICalendarSource?.()||Object.entries(ministrySchedules).flatMap(([department,rows])=>rows.map(e=>({...e,id:'legacy:'+department+':'+e.date+':'+e.person,department,role:null})))).filter(e=>e.date>=b.p_month&&e.date.slice(0,7)===b.p_month.slice(0,7)).map(e=>({...e,legacy:true,origin:'Histórico manual confirmado'})):[];
    const visible=[...managed,...legacy].filter(e=>e.department==='Ancionato'||name==='iasdpi_schedule_visible'&&(actor.globalRole==='admin'||actor.caps[e.department_id||catalog().departments.find(d=>d.name===e.department)?.id]?.view));
    return Response.json(visible);
   }
   if(name==='iasdpi_events_published'||name==='iasdpi_events_visible'){
    if(name==='iasdpi_events_visible'&&!actor)fail('Entre com identidade autorizada.','42501');
    if(!/^\d{4}-\d{2}-01$/.test(b.p_month||''))fail('Mês inválido.','22023');
    const latest=[...versions.values()].map(v=>v.filter(x=>['published','cancelled'].includes(x.status)).at(-1)).filter(Boolean);
    const visible=latest.filter(v=>v.status==='published'&&v.snapshot.date.slice(0,7)<=b.p_month.slice(0,7)&&v.snapshot.end_date>=b.p_month&&(!(v.snapshot.is_restricted||events.get(v.event_id||v.snapshot.id)?.is_restricted)||name==='iasdpi_events_visible'&&can(actor,v.snapshot,'view'))).map(v=>{const e=clone(v.snapshot);delete e.created_by;delete e.updated_by;delete e.cancellation_reason;return {...e,department_name:dept(e.department_id)?.name||e.department_name||''};});
    return Response.json({events:visible,suppressed_source_keys:[...new Set([...latest.filter(v=>!privacy||!(v.snapshot.is_restricted||events.get(v.event_id||v.snapshot.id)?.is_restricted)).map(v=>v.snapshot.source_key)].filter(Boolean))]});
   }
   if(!actor)fail('Entre com identidade autorizada.','42501');
   if(name==='iasdpi_events_catalog')return Response.json({is_admin:actor.globalRole==='admin',departments:catalog().departments.filter(d=>d.active&&(actor.globalRole==='admin'||actor.caps[d.id]?.view)).map(d=>({id:d.id,name:d.name,code:d.code,can_edit:can(actor,{category:'department',department_id:d.id},'edit'),can_publish:can(actor,{category:'department',department_id:d.id},'publish')})),events:current(actor).map(e=>({...clone(e),can_edit:can(actor,e,'edit'),can_publish:can(actor,e,'publish')}))});
   if(name==='iasdpi_event_history'){if(!current(actor).some(e=>e.id===b.p_id))fail('Histórico indisponível.','42501');return Response.json(clone(versions.get(b.p_id)||[]));}
   const task=serial.then(()=>save(actor,b));serial=task.catch(()=>{});return Response.json(await task);
  }catch(e){return Response.json({code:e.code||'23514',message:e.message},{status:400});}
 };
 window.IASDPIE1Demo={events,versions};
 document.addEventListener('DOMContentLoaded',()=>{
  const banner=document.querySelector('.demo-banner:has(#g4-demo-accounts)');if(banner){const help=banner.querySelector('details');banner.replaceChildren();banner.append(document.createTextNode('Homologação · acesso simulado · alterações nesta aba. '));help.querySelector('summary').textContent='Acessos';banner.append(help);}
  const mark=document.querySelector('.brand small');if(mark)mark.textContent='Parada Inglesa';
 });
})();
