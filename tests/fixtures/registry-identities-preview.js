'use strict';
// Apenas prévia G8.4. O MESMO catálogo central e os MESMOS IDs do portal.
(()=>{
 const g=IASDPIG6Preview,prior=g.rpc,c=IASDPIKnownPreviewSeed.catalog,rules=IASDPIConfirmedNames,receipts=new Map(),audits=[],retired=new Map(),norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim(),clone=v=>structuredClone(v),ok=value=>({handled:true,value});
 const members=(p)=>c.memberships.filter(m=>m.person_id===p),actor={id:c.actor_id,globalRole:'admin'};
 function group(rule){
  const names=[rule.name,...rule.aliases].map(norm),people=c.people.filter(p=>!p.merged_into&&names.includes(norm(p.name))&&(norm(p.name)===norm(rule.name)||!rule.department||members(p.id).some(m=>c.departments.find(d=>d.id===m.department_id)?.code===rule.department))).sort((a,b)=>(b.name===rule.name)-(a.name===rule.name)||a.id.localeCompare(b.id));
  const ids=new Set(people.map(p=>p.id)),links=c.memberships.filter(m=>ids.has(m.person_id)),blockers=[];
  if(new Set(links.map(m=>m.department_id)).size<links.length)blockers.push('Há vínculos duplicados no mesmo departamento. Revisão necessária.');
  const commitments=[...IASDPIB1Preview.legacy,...[...IASDPIB1Preview.plans.values()].filter(p=>p.status==='published').flatMap(p=>p.requirements.flatMap(r=>r.assignments.map(a=>({person_id:a.person_id,department_id:p.department_id,date:IASDPIB1Preview.events.find(e=>e.id===r.event_id)?.scheduled_on}))))];
  if(commitments.some(a=>ids.has(a.person_id)&&commitments.some(b=>ids.has(b.person_id)&&b.person_id!==a.person_id&&b.department_id!==a.department_id&&b.date===a.date)))blockers.push('Compromissos confirmados em departamentos diferentes no mesmo dia.');
  if(people.length>1&&c.availability.some(v=>ids.has(v.person_id)&&!v.department_id&&v.active))blockers.push('Disponibilidade global exige revisão antes de mesclar.');
  const references={schedule_memberships:links.length,schedule_availability:c.availability.filter(v=>ids.has(v.person_id)).length,schedule_legacy_commitments:commitments.filter(v=>ids.has(v.person_id)).length};
  return {name:rule.name,department:rule.department,aliases:rule.aliases,people:people.map(({id,name,display_name,active,version})=>({id,name,display_name,active,version,departments:members(id).map(m=>({id:m.department_id,name:c.departments.find(d=>d.id===m.department_id)?.name||'Departamento'}))})),blockers,references,token:JSON.stringify({people,links,availability:c.availability.filter(v=>ids.has(v.person_id)),commitments:commitments.filter(v=>ids.has(v.person_id))})};
 }
 function apply(rule,canonical,who){
  const preview=group(rule),people=preview.people.map(p=>c.people.find(x=>x.id===p.id)),target=people.find(p=>p.id===canonical);if(!target||preview.blockers.length)throw Error(preview.blockers.join(' ')||'Identificador inválido.');
  const old=people.filter(p=>p.id!==canonical),ids=new Set(old.map(p=>p.id));target.aliases=[...new Set([...(target.aliases||[]),...rule.aliases,...people.flatMap(p=>[p.name,p.display_name,...(p.aliases||[])])])];
  for(const list of [c.memberships,c.availability,IASDPIKnownPreviewSeed.legacy,IASDPIB1Preview.legacy])for(const row of list)if(ids.has(row.person_id)){row.person_id=canonical;row.version=(row.version||0)+1;}
  for(const plan of IASDPIB1Preview.plans.values())for(const req of plan.requirements)for(const a of req.assignments)if(ids.has(a.person_id))a.person_id=canonical;
  for(const p of old){p.merged_into=canonical;p.active=false;retired.set(p.id,clone(p));}c.people=c.people.filter(p=>!ids.has(p.id));c.identity_registry=true;c.identity_redirects=[...retired.values()].map(p=>({id:p.id,canonical_id:p.merged_into,original_name:p.name}));target.name=target.display_name=rule.name;target.version++;
  audits.push({id:crypto.randomUUID(),person_id:canonical,actor_id:who,entity:'registry-identity',version:target.version,captured_at:new Date().toISOString(),changed_fields:['names','aliases','canonical_id']});return {person_id:canonical,name:rule.name,retired_ids:[...ids]};
 }
 const ready=(async()=>{await IASDPIG82Demo.ready;
  for(const rule of rules){const groupBefore=group(rule);if(groupBefore.people.length&&!groupBefore.blockers.length)apply(rule,groupBefore.people[0].id,actor.id);}
  // Associa referências que a composição local já vinculou explicitamente; fonte original intacta.
  for(const row of IASDPIKnownPreviewSeed.legacy){const p=c.people.find(p=>p.id===row.person_id);if(!p?.aliases)continue;
   await prior(actor,'iasdpi_registry_source_save',{p_source_key:row.source_key,p_person:p.id,p_expected_version:0,p_request_id:crypto.randomUUID(),p_reference:{department_id:row.department_id,starts_on:row.date,ends_on:row.date,kind:'daily',original_name:row.original_name}});
  }
 })();
 g.rpc=async(a,name,b)=>{await ready;if(name==='iasdpi_schedule_save'&&b.p_entity==='person'&&a.globalRole!=='admin')throw Error('Identidade central administrada pela igreja.');
  if(['iasdpi_registry_identity_preview','iasdpi_registry_identity_apply','iasdpi_registry_audit'].includes(name)){
   if(a.globalRole!=='admin')throw Error('Somente administrador da igreja.');
   if(name==='iasdpi_registry_identity_preview')return ok({groups:rules.map(group),possible_duplicates:Object.values(c.people.reduce((groups,p)=>{for(const key of new Set([p.name,...(p.aliases||[])].map(norm)))(groups[key]||=[]).push(p);return groups;},{})).filter(ps=>ps.length>1).map(ps=>({people:ps.map(p=>({id:p.id,name:p.name})),count:ps.length}))});
   if(name==='iasdpi_registry_audit')return ok(clone(audits.filter(r=>r.person_id===b.p_person)));
   const signature=JSON.stringify([a.id,b]);if(receipts.has(b.p_request_id)){const old=receipts.get(b.p_request_id);if(old.signature!==signature)throw Error('Solicitação reutilizada.');return ok(clone(old.result));}
   const rule=rules.find(r=>r.name===b.p_name);if(!rule)throw Error('Nome não confirmado.');const preview=group(rule);if(preview.token!==b.p_token)throw Error('Dados mudaram após a prévia. Recarregue e compare.');const result=apply(rule,b.p_canonical,a.id);receipts.set(b.p_request_id,{signature,result:clone(result)});return ok(result);
  }
  if(name==='iasdpi_registry_people'){if(a.globalRole!=='admin'&&!c.departments.some(d=>g.cap(a,d.id,'members')))throw Error('Sem administração de membros.');const term=norm(b.p_search);return ok(clone(c.people.filter(p=>norm([p.name,p.display_name,...(p.aliases||[])].join(' ')).includes(term)).map(({id,name,display_name,active,version,aliases=[]})=>({id,name,display_name,active,version,aliases}))));}
  const before=name==='iasdpi_registry_save'?clone(c.people.find(p=>p.id===b.p_person)):null;const result=await prior(a,name,b);
  if(result?.handled&&(name==='iasdpi_registry_catalog'||name==='iasdpi_schedule_catalog')){result.value.identity_registry=true;result.value.identity_redirects=[...retired.values()].map(p=>({id:p.id,canonical_id:p.merged_into,original_name:p.name}));}
  if(before&&name==='iasdpi_registry_save'&&Object.keys(b.p_person_patch).length){const after=c.people.find(p=>p.id===before.id);if(after){after.aliases=[...new Set([...(after.aliases||[]),before.name,before.display_name])];audits.push({id:crypto.randomUUID(),person_id:after.id,actor_id:a.id,entity:'person',version:after.version,captured_at:new Date().toISOString(),changed_fields:Object.keys(b.p_person_patch)});}}
  return result;
 };
 const previousFetch=window.fetch;window.fetch=async(url,args={})=>{await ready;const response=await previousFetch(url,args);if(String(url)==='https://g4demo.supabase.co/rest/v1/rpc/iasdpi_registry_public'&&new Headers(args.headers).get('x-iasdpi-church')==='IASD_PI'){const data=await response.json();data.confirmed_names=rules.flatMap(r=>{const p=c.people.find(p=>p.name===r.name);return p?r.aliases.map(alias=>({alias,name:p.display_name,department:r.department||''})):[];});return Response.json(data);}return response;};
 window.IASDPIG84Demo={ready,retired};
})();
