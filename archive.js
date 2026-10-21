'use strict';
const archiveKey=IASDPIStorage.programs;
const cloudState={session:null,archives:[],busy:false,dirty:false};
function backupValidate(data){
  if(!data || data.format!=='IASDPI-backup'||data.version!==1||!Array.isArray(data.programs))throw Error('Arquivo de backup incompatível. Nada foi alterado.');
  const ids=new Set();
  for(const p of data.programs){
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||!p.plan||typeof p.plan.name!=='string'||!Array.isArray(p.plan.items)||!p.executions||typeof p.executions!=='object'||!Number.isInteger(p.version)||p.version<1)throw Error('Registro inválido no backup. Nada foi alterado.');
    ids.add(p.id);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.plan.date)||p.plan.items.some(i=>!i||typeof i.id!=='string'||typeof i.activity!=='string'))throw Error('Cronograma inválido no backup. Nada foi alterado.');
    const clock=/^([01]\d|2[0-3]):[0-5]\d$/;
    if(!clock.test(p.plan.start)||!clock.test(p.plan.end)||!['Planejamento','Pronta','Em andamento','Finalizada'].includes(p.status)||!Number.isFinite(new Date(p.planned_start).getTime())||!Number.isFinite(new Date(p.planned_end).getTime()))throw Error('Datas, horários ou status inválidos no backup.');
    const itemIds=new Set();
    for(const item of p.plan.items){if(itemIds.has(item.id)||!clock.test(item.start)||!clock.test(item.end)||typeof item.block!=='string'||!Number.isFinite(new Date(item.planned_start).getTime())||!Number.isFinite(new Date(item.planned_end).getTime()))throw Error('Atividade inválida no backup.');itemIds.add(item.id);}
    if(Array.isArray(p.executions))throw Error('Execução inválida no backup.');
    for(const [id,e] of Object.entries(p.executions)){if(!itemIds.has(id)||!e||typeof e.started!=='string'||!Number.isFinite(new Date(e.started).getTime())||(e.ended!=null&&(typeof e.ended!=='string'||!Number.isFinite(new Date(e.ended).getTime()))))throw Error('Horários realizados inválidos no backup.');}
    for(const item of p.plan.items){const detail=p.actual_details?.[item.id];if(detail&&(detail.status!==undefined||detail.subactivities!==undefined)){const e=p.executions[item.id];validateActivityRecord({...detail,start:actualClock(e?.started),end:actualClock(e?.ended)},item.id);}}
    if(p.extra_events)validateExtraEvents(p,p.extra_events,false);
  }
  return data;
}
async function backupPayload(){
  await IASDPIAuth.requireAccess();
  const raw=window.IASDPIDemo?localStorage.getItem(archiveKey):null;
  const programs=window.IASDPIDemo?(raw===null?[]:JSON.parse(raw)):await api('programs');
  return backupValidate({format:'IASDPI-backup',version:1,programs,
    dateCorrectionBackupsRaw:window.IASDPIDemo?localStorage.getItem(IASDPIStorage.dateCorrections):null});
}
const toBase64=bytes=>{let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
const fromBase64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function backupCipher(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptBackup(data,password){
  if(password.length<10)throw Error('Use uma senha de backup com pelo menos 10 caracteres.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await backupCipher(password,salt);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
  return {format:'IASDPI-encrypted-backup',version:1,salt:toBase64(salt),iv:toBase64(iv),data:toBase64(new Uint8Array(bytes))};
}
async function decryptBackup(data,password){
  if(data.format!=='IASDPI-encrypted-backup')return backupValidate(data);
  if(data.version!==1)throw Error('Versão de backup incompatível.');
  try{const key=await backupCipher(password,fromBase64(data.salt));const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(data.iv)},key,fromBase64(data.data));return backupValidate(JSON.parse(new TextDecoder().decode(bytes)));}
  catch(_){throw Error('Senha incorreta ou arquivo danificado. Nada foi alterado.');}
}
async function downloadBackup(data){
  await IASDPIAuth.requireAccess();
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='IASDPI-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function restoreBackup(data){
  await IASDPIAuth.requireAccess();
  backupValidate(data);
  if(!window.IASDPIDemo)throw Error('A restauração pelo navegador está disponível no Pages/HTML local. A base SQLite não foi alterada.');
  const raw=localStorage.getItem(archiveKey),current=raw?JSON.parse(raw):[];
  backupValidate({format:'IASDPI-backup',version:1,programs:current});
  const merged=structuredClone(current),ids=new Set(current.map(p=>p.id));let added=0,copies=0;
  for(const p of data.programs){const existing=merged.find(e=>e.id===p.id);if(existing&&JSON.stringify(existing)===JSON.stringify(p))continue;const copy=structuredClone(p);if(ids.has(copy.id)){copy.id=crypto.randomUUID();copy.plan.name+=' (cópia restaurada)';copies++;}ids.add(copy.id);merged.push(copy);added++;}
  if(raw!==null)localStorage.setItem(IASDPIStorage.beforeRestore,raw);
  localStorage.setItem(archiveKey,JSON.stringify(merged));
  state.programs=merged;return {added,copies};
}
function cloudConfig(){return IASDPIAuth.config();}
function archivePage(){
  const account=IASDPIAuth.session();
  if(!account)return IASDPIAuth.loginPage();
  return heading('PROTEÇÃO DOS REGISTROS','Arquivo e banco','Guarde uma cópia fora do celular. Os registros existentes permanecem no navegador.')+
  `<section class="panel"><h2>Baixar backup protegido</h2><p class="muted">Inclui programações, horários, atividades extras, responsáveis e observações. Guarde o arquivo no Drive/OneDrive e mantenha a senha em local separado. Sem essa senha, o arquivo não poderá ser recuperado.</p><form id="backup-export-form"><div class="notes-grid">${field('Senha do backup','password','','password',true,'minlength="10" autocomplete="new-password"')}${field('Repetir senha','repeat','','password',true,'minlength="10" autocomplete="new-password"')}</div><button type="submit" class="primary">Baixar backup</button></form></section>
  <section class="panel"><h2>Restaurar uma cópia</h2><p class="muted">Os registros atuais não são substituídos. Versões diferentes do mesmo culto entram como cópias identificadas.</p><form id="backup-restore-form"><label>Arquivo de backup<input type="file" name="file" accept=".json,application/json" required></label>${field('Senha do arquivo protegido','password','','password',false,'autocomplete="off"')}<button type="submit">Restaurar sem substituir registros</button></form></section>
  <section class="panel"><h2>Banco privado · Supabase</h2><p class="muted">Conecte um projeto com a tabela culto_archives e políticas de acesso instaladas. Administradores e líderes autorizados acessam as cópias da igreja; as versões arquivadas não podem ser alteradas ou apagadas pelo site.</p><p>Conectado como ${esc(account.user.email)}.</p><div class="actions">${button('Arquivar registros no banco','cloud-save','','class="primary"')}${button('Consultar arquivos','cloud-list')}${button('Sair','cloud-signout')}</div><div class="section">${cloudState.archives.length?`<ul class="agenda-list">${cloudState.archives.map(row=>`<li>${button('Restaurar cópia de '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(row.created_at)),'cloud-restore',row.id)}</li>`).join('')}</ul>`:''}</div></section>`;
}
async function cloudRequest(path,options={}){
  const authorization=await IASDPIAuth.requireAccess();
  if(!IASDPIAuth.remoteRequestAllowed(path,(options.method||'GET').toUpperCase()))throw Error('Homologação em modo de consulta: arquivamento remoto bloqueado.');
  const config=cloudConfig();
  const response=await fetch(config.url+path,{...options,headers:{apikey:config.key,Authorization:'Bearer '+authorization.token,'Content-Type':'application/json',...options.headers}});
  if(IASDPIAuth.session()?.access_token!==authorization.token)throw Error('Sessão encerrada.');
  if(!response.ok)throw Error(response.status===401?'Sessão expirada. Saia e conecte novamente.':'O banco não confirmou a operação. Verifique a tabela e as políticas de acesso. Os dados locais foram preservados.');
  return response.status===204?null:response.json();
}
async function cloudSave(){
  const {user}=await IASDPIAuth.requireAccess();
  const payload=await backupPayload(),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));const digest=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
  await cloudRequest('/rest/v1/culto_archives?on_conflict=owner_id,digest',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({digest,payload})});
  const rows=await cloudRequest('/rest/v1/culto_archives?owner_id=eq.'+encodeURIComponent(user.id)+'&digest=eq.'+digest+'&select=id,digest,payload');
  const comparable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  if(!Array.isArray(rows)||!rows.some(r=>r.digest===digest&&comparable(r.payload)===comparable(payload)))throw Error('Não foi possível confirmar o conteúdo da cópia no banco. Os dados locais permanecem preservados.');
  localStorage.removeItem(IASDPIStorage.pending);toast('Cópia arquivada e confirmada no banco.');
}
async function cloudAutoArchive(){
  if(!cloudState.session||window.IASDPIConfig?.remoteReadOnly)return;cloudState.dirty=true;if(cloudState.busy)return;cloudState.busy=true;
  try{while(cloudState.dirty){cloudState.dirty=false;await cloudSave();}}
  catch(_){try{localStorage.setItem(IASDPIStorage.pending,'true');}catch(_){}toast('Registro local preservado. Arquivamento no banco pendente; tente novamente em Arquivo e banco.',true);}
  finally{cloudState.busy=false;}
}
