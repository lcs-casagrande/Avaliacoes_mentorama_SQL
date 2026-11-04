'use strict';
// Somente prévia/testes. Não faz parte do pacote estático de produção.
window.IASDPISchedulePreview=(()=>{
 const ids=['a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004'];
 const c={actor_id:'11111111-1111-4111-8111-111111111111',is_admin:true,
 departments:['Sonoplastia','Diaconato','Música','Ancionato'].map((name,i)=>({id:ids[i],name,code:['sonoplastia','diaconato','musica','ancionato'][i],version:1,active:true,can_manage:true,can_roster:true})),
 people:[{id:'b0000000-0000-4000-8000-000000000001',name:'Participante de demonstração',display_name:'Participante de demonstração',active:true,version:1}],
 memberships:[{id:'c0000000-0000-4000-8000-000000000001',person_id:'b0000000-0000-4000-8000-000000000001',department_id:ids[0],active:true,version:1,is_ministry_head:false}],
 roles:[{id:'d0000000-0000-4000-8000-000000000001',department_id:ids[0],name:'Operador de áudio',description:'Função fictícia para demonstração',active:true,version:1}],qualifications:[],availability:[],access:[]};
 const details={},receipts=new Map();
 async function request(name,b={}){
  if(name==='iasdpi_schedule_catalog')return structuredClone(c);
  if(name==='iasdpi_schedule_person_details')return structuredClone(details[b.p_id]||{auth_user_id:null,contact:'',notes:''});
  if(name!=='iasdpi_schedule_save')throw Error('Operação ausente nesta prévia.');
  if(receipts.has(b.p_request_id))return structuredClone(receipts.get(b.p_request_id));
  const table={department:'departments',person:'people',role:'roles',membership:'memberships',availability:'availability',access:'access'}[b.p_entity];
  const row=c[table].find(r=>r.id===b.p_id);if((row?.version||0)!==b.p_expected_version){const e=Error('Este cadastro mudou em outro dispositivo.');e.code='40001';throw e;}
  const data={active:true,enabled:true,...row,...b.p_data,id:b.p_id,version:(row?.version||0)+1};
  if(b.p_entity==='person'){
   details[data.id]={auth_user_id:data.auth_user_id||null,contact:data.contact||'',notes:data.notes||''};
   if(!row&&data.department_id)c.memberships.push({id:crypto.randomUUID(),person_id:data.id,department_id:data.department_id,active:true,version:1});
   for(const key of ['auth_user_id','contact','notes','department_id','confirm_homonym','reason'])delete data[key];
  }
  if(b.p_entity==='membership'&&data.role_ids){c.qualifications=c.qualifications.filter(q=>q.membership_id!==data.id);for(const role of data.role_ids)c.qualifications.push({membership_id:data.id,department_id:data.department_id,role_id:role});delete data.role_ids;}
  if(b.p_entity==='department'){data.can_manage=true;data.can_roster=true;}
  if(row)Object.assign(row,data);else c[table].push(data);
  receipts.set(b.p_request_id,structuredClone(data));return structuredClone(data);
 }
 return {request};
})();
