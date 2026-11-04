'use strict';
// Host exclusivo de demonstração. Nenhum cliente, chave ou conexão Supabase.
const state={page:'schedule-setup'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heading=(tag,title,description)=>`<p class="eyebrow">${esc(tag)}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p>`;
const displayDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):v||'';
function tryReadDate(v){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v||'');if(!m)return null;const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(iso+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:null;}
function render(){document.querySelector('#app').innerHTML=IASDPISchedules.page();}
function toast(text){document.querySelector('#notice').textContent=text;document.querySelector('#notice').hidden=false;}
const deny=()=>{throw Error('Conexões externas bloqueadas nesta demonstração.');};
window.fetch=async()=>deny();window.XMLHttpRequest=class{open(){deny();}};window.WebSocket=class{constructor(){deny();}};window.EventSource=class{constructor(){deny();}};
Object.defineProperty(navigator,'sendBeacon',{value:()=>false});
window.IASDPIAuth={logout:async()=>true,allowed:()=>false,requireIdentity:async()=>deny(),jsonRequest:async()=>deny()};
window.IASDPISchedulePreview=(()=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const departments=['Sonoplastia','Diaconato','Música','Ancionato'].map((name,i)=>({id:id(i+1),name,code:['sonoplastia','diaconato','musica','ancionato'][i],active:true,version:1,can_manage:true,can_roster:true}));
 const people=['Pessoa Alfa — exemplo','Pessoa Beta — exemplo','Pessoa Gama — exemplo'].map((name,i)=>({id:id(20+i),name,display_name:name,active:true,version:1}));
 const roles=['Operação de áudio — exemplo','Diácono — exemplo','Vocalista — exemplo','Ancião do culto — exemplo'].map((name,i)=>({id:id(40+i),department_id:departments[i].id,name,active:true,version:1}));
 const memberships=people.map((p,i)=>({id:id(60+i),person_id:p.id,department_id:departments[i].id,active:true,version:1,desired_monthly_count:2,preferences:'Preferência fictícia para demonstração.'}));
 memberships.push({id:id(65),person_id:people[0].id,department_id:departments[2].id,active:true,version:1});
 const c={actor_id:id(99),is_admin:true,departments,people,roles,memberships,qualifications:[{membership_id:id(60),role_id:id(40),department_id:id(1)}],availability:[{id:id(80),person_id:id(20),department_id:id(1),kind:'unavailable',pattern:'weekly',weekdays:[2],start_time:'18:00',end_time:'20:00',active:true,version:1}],access:[]};
 const details={},receipts=new Map();
 return {async request(name,b={}){
  if(name==='iasdpi_schedule_catalog')return structuredClone(c);
  if(name==='iasdpi_schedule_person_details')return structuredClone(details[b.p_id]||{contact:'',notes:'Observação fictícia.',auth_user_id:null});
  if(name==='iasdpi_find_account')return b.p_email==='conta@exemplo.invalid'?[{user_id:id(99),email:'conta@exemplo.invalid',confirmed:true}]:[];
  if(name!=='iasdpi_schedule_save')throw Error('Operação fora desta demonstração.');
  const signature=JSON.stringify(b);
  if(receipts.has(b.p_request_id)){const old=receipts.get(b.p_request_id);if(old.signature!==signature)throw Error('Solicitação reutilizada com outros dados.');return structuredClone(old.row);}
  const key={person:'people',department:'departments',membership:'memberships',role:'roles',availability:'availability',access:'access'}[b.p_entity];
  if(!key)throw Error('Cadastro desconhecido.');
  const old=c[key].find(r=>r.id===b.p_id);
  if((old?.version||0)!==b.p_expected_version)throw Error('Versão mudou nesta demonstração. Atualize os cadastros.');
  const row={active:true,enabled:true,...old,...b.p_data,id:b.p_id,version:(old?.version||0)+1};
  if(key==='people'){
   details[row.id]={auth_user_id:row.auth_user_id||null,contact:row.contact||'',notes:row.notes||''};
   if(!old&&row.department_id)c.memberships.push({id:crypto.randomUUID(),person_id:row.id,department_id:row.department_id,active:true,version:1});
   for(const k of ['department_id','auth_user_id','contact','notes','confirm_homonym','reason'])delete row[k];
  }
  if(key==='memberships'&&row.role_ids){c.qualifications=c.qualifications.filter(q=>q.membership_id!==row.id);for(const role_id of row.role_ids)c.qualifications.push({membership_id:row.id,role_id,department_id:row.department_id});delete row.role_ids;}
  if(key==='departments'){row.can_manage=true;row.can_roster=true;}
  if(old)Object.assign(old,row);else c[key].push(row);
  receipts.set(b.p_request_id,{signature,row:structuredClone(row)});return structuredClone(row);
 }};
})();
