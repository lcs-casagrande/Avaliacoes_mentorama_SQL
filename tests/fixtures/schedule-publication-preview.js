'use strict';
// 024: dados continuam na mesma memória; não aprova eventos nem conecta ao banco.
(()=>{
 const g=IASDPIG6Preview,prior=g.rpc;
 g.rpc=async(a,name,args)=>{
  const result=await prior(a,name,args);
  if(result?.handled){
   if(['iasdpi_schedule_settings_get','iasdpi_schedule_settings_save'].includes(name))Object.assign(result.value,{allow_pending_publication:true,non_blocking_department_codes:['comunicacao']});
   if(name==='iasdpi_schedule_workspace')Object.assign(result.value.settings,{allow_pending_publication:true,non_blocking_department_codes:['comunicacao']});
  }
  return result;
 };
 window.IASDPISchedulePublicationPreview={allowPending:true};
})();
