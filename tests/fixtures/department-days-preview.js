'use strict';
// G7: persistência simulada somente na memória da aba; nunca chama um servidor.
(()=>{
 const g=IASDPIG6Preview,previous=g.rpc,copy=v=>structuredClone(v),receipts=new Map();
 const fail=message=>{throw Error(message);},handled=value=>({handled:true,value}),can=(a,d)=>g.cap(a,d,'members')||g.cap(a,d,'access');
 const ready=(async()=>{await IASDPIG6Demo.ready;const c=await g.raw('iasdpi_schedule_catalog');for(const d of c.departments)await g.raw('iasdpi_schedule_save',{p_entity:'department',p_id:d.id,p_expected_version:d.version,p_data:{planning_weekdays:['comunicacao','ministerio-da-familia','ministerio-da-crianca'].includes(d.code)?[6]:[3,6,0]},p_request_id:crypto.randomUUID()});})();
 async function settings(a,s){
  const c=await g.raw('iasdpi_schedule_catalog'),ds=c.departments.filter(d=>d.active&&g.cap(a,d.id,'view'));
  return {...s,department_days_enabled:true,department_weekdays:Object.fromEntries(ds.map(d=>[d.id,d.planning_weekdays])),department_days_versions:Object.fromEntries(ds.map(d=>[d.id,d.version])),department_days_can_edit:Object.fromEntries(ds.map(d=>[d.id,Boolean(can(a,d.id))]))};
 }
 g.rpc=async(a,name,b)=>{
  const old=await previous(a,name,b);if(old?.handled)return old;
  const names=['iasdpi_schedule_department_days','iasdpi_schedule_department_days_save','iasdpi_schedule_settings_get','iasdpi_schedule_settings_save','iasdpi_schedule_workspace','iasdpi_schedule_rotation_context','iasdpi_schedule_generate_days'];
  if(!names.includes(name))return null;
  await ready;const c=await g.raw('iasdpi_schedule_catalog'),d=c.departments.find(d=>d.id===b.p_department&&d.active);
  if(b.p_department&&(!d||!g.cap(a,d.id,'view')))fail('Departamento não autorizado.');
  const row=d=>({department_id:d.id,weekdays:copy(d.planning_weekdays),version:d.version,can_edit:Boolean(can(a,d.id))});
  if(name==='iasdpi_schedule_department_days')return handled(row(d));
  if(name==='iasdpi_schedule_department_days_save'){
   if(!can(a,d.id))fail('Sem administração deste departamento.');
   if(!b.p_request_id||!Array.isArray(b.p_weekdays)||b.p_weekdays.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(b.p_weekdays).size!==b.p_weekdays.length)fail('Dias inválidos.');
   const signature=JSON.stringify([a.id,b]);if(receipts.has(b.p_request_id)){const r=receipts.get(b.p_request_id);if(r.signature!==signature)fail('Solicitação reutilizada.');return handled(copy(r.result));}
   if(d.version!==b.p_expected_version)fail('Configuração alterada em outro dispositivo. Recarregue e compare antes de salvar.');
   const saved=await g.raw('iasdpi_schedule_save',{p_entity:'department',p_id:d.id,p_expected_version:d.version,p_data:{planning_weekdays:copy(b.p_weekdays)},p_request_id:b.p_request_id});
   const result=row(saved);receipts.set(b.p_request_id,{signature,result:copy(result)});g.audit.unshift({actor_id:a.id,action:'department-days',department_id:d.id,created_at:new Date().toISOString()});return handled(result);
  }
  if(name==='iasdpi_schedule_settings_get')return handled(await settings(a,await g.raw(name,b)));
  if(name==='iasdpi_schedule_settings_save'){
   if(a.globalRole!=='admin')fail('Somente administrador.');
   const old=await g.raw('iasdpi_schedule_settings_get');if(Object.hasOwn(b.p_data,'weekdays')&&JSON.stringify(b.p_data.weekdays)!==JSON.stringify(old.weekdays))fail('Configure em cada departamento.');
   b=copy(b);delete b.p_data.weekdays;return handled(await settings(a,await g.raw(name,b)));
  }
  if(name==='iasdpi_schedule_workspace'){const r=await g.raw(name,b);r.settings=await settings(a,{...r.settings,simplified_daily:true});r.rotation_context={...r.rotation_context,planning_weekdays:copy(d.planning_weekdays),extra_dates:r.settings.extra_dates};return handled(r);}
  if(name==='iasdpi_schedule_rotation_context'){const s=await g.raw('iasdpi_schedule_settings_get');return handled({...await g.raw(name,b),planning_weekdays:copy(d.planning_weekdays),extra_dates:s.extra_dates});}
  if(!g.cap(a,d.id,'edit'))fail('Sem edição deste departamento.');
  const s=await g.raw('iasdpi_schedule_settings_get'),events=[];
  for(const month of s.future_months)for(const date of IASDPIScheduleManagement.dates(month.slice(0,7),[0,1,2,3,4,5,6]))if(d.planning_weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay())||s.extra_dates.includes(date))events.push(await g.raw('iasdpi_schedule_event_create',{p_id:crypto.randomUUID(),p_data:{department_id:d.id,title:b.p_title,date},p_request_id:crypto.randomUUID()}));
  return handled({months:s.future_months,events,settings_version:s.version,department_days_version:d.version,weekdays:copy(d.planning_weekdays)});
 };
 [...document.querySelectorAll('.demo-banner details')].at(-1).innerHTML='<summary>Limites desta homologação</summary><p>G7: dias e escalas simulados na memória desta aba. Recarregar reinicia os dados. Contas e preferências são fictícias. Nenhuma conexão com o Supabase. Semanas e meses do Ancionato mantêm intervalos completos.</p>';
 window.IASDPIG7Demo={ready};
})();
