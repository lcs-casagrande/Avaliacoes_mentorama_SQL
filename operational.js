'use strict';
// Banco operacional. Nunca usa localStorage como fallback para leituras/gravações.
if(window.IASDPIConfig?.storageMode==='supabase')window.IASDPIOperational=(()=>{
  const pending=new Map();let templates=[],preview=null,recoveries=[],lastActor=null;
  async function remote(path,method='GET',body,expectedActor=null){
    const access=await IASDPIAuth.requireAccess();
    if(expectedActor&&access.user.id!==expectedActor)throw Error('Este envio pertence a outra sessão. Reentre com a conta original.');
    lastActor=access.user.id;
    try{
      const result=await IASDPIAuth.jsonRequest('/rest/v1/'+path,{method,headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(IASDPIAuth.session()?.access_token!==access.token)throw Error('Sessão alterada. Entre novamente para consultar o resultado.');
      return result;
    }catch(error){
      if(error.code==='40001')throw error;
      throw Error(error.message+' Os campos não foram descartados. Nenhuma confirmação de gravação foi recebida.');
    }
  }
  function outboxDb(){return new Promise((resolve,reject)=>{
    const opening=indexedDB.open('iasdpi-pending-writes-v1',1);
    opening.onupgradeneeded=()=>opening.result.createObjectStore('writes',{keyPath:'key'});
    opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(Error('Não foi possível preservar o envio pendente neste dispositivo.'));
  });}
  async function outbox(mode,value,actor=null){
    const db=await outboxDb(),uid=actor||IASDPIAuth.session()?.user.id;
    if(!uid){db.close();throw Error('Entre novamente.');}
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('writes',mode==='list'?'readonly':'readwrite'),store=tx.objectStore('writes');
      const op=mode==='list'?store.getAll():mode==='put'?store.put({...value,key:uid+':'+value.args.p_request_id,uid}):store.delete(uid+':'+value);
      let result;op.onsuccess=()=>result=op.result;
      tx.oncomplete=()=>{db.close();resolve(mode==='list'?result.filter(row=>row.uid===uid):result);};
      tx.onerror=()=>{db.close();reject(Error('Não foi possível atualizar a recuperação local do envio.'));};
    });
  }
  async function commit(document,expected,importing=false,key=document.id){
    const uid=IASDPIAuth.session()?.user.id||lastActor,signature=JSON.stringify([document,expected,importing]);
    let entry=pending.get(key);
    if(entry&&(entry.signature!==signature||entry.uid!==uid)){
      throw Error('Há um envio anterior sem confirmação. Abra Arquivo e banco para conferir ou recuperar esse envio antes de alterar seu conteúdo.');
    }
    if(!entry){entry={uid,signature,args:{p_id:document.id,p_expected_version:expected,p_document:document,p_request_id:crypto.randomUUID(),p_import:importing}};pending.set(key,entry);}
    // Fila de recuperação, não banco operacional. Falha aqui não impede gravar no servidor.
    let recoveryAvailable=true;try{await outbox('put',entry,uid);}catch(_){recoveryAvailable=false;}
    let result;
    try{result=await remote('rpc/iasdpi_save_program','POST',entry.args,entry.uid);}
    catch(error){throw Error(error.message+(recoveryAvailable?' Envio pendente disponível em Arquivo e banco.':' Recuperação local indisponível: mantenha esta aba aberta para não perder as alterações.'));}
    pending.delete(key);try{await outbox('delete',entry.args.p_request_id);}catch(_){/* RPC idempotente permite reconferir após uma resposta confirmada. */}
    return result;
  }
  async function list(){
    const all=[];
    for(let offset=0;;offset+=500){
      const rows=await remote('iasdpi_programs?select=document&deleted_at=is.null&order=id&limit=500&offset='+offset);
      all.push(...rows.map(row=>row.document));if(rows.length<500)break;
    }
    return all;
  }
  async function get(id){
    const rows=await remote('iasdpi_programs?id=eq.'+encodeURIComponent(id)+'&select=document&deleted_at=is.null');
    if(!rows[0])throw Error('Registro não encontrado no Supabase.');return rows[0].document;
  }
  async function request(path,method='GET',body={}){
    if(path==='health')return {timezone:'America/Sao_Paulo',server_time:new Date().toISOString()};
    if(method==='GET')await IASDPIAuth.requireAccess();
    if(path==='chronogram')path='templates/liturgy-i';
    if(path.startsWith('templates/')){
      const id=path.slice(10),rows=await remote('iasdpi_templates?id=eq.'+encodeURIComponent(id)+'&select=plan');
      if(!rows[0])throw Error('Modelo não configurado. Confira a migração 003.');return rows[0].plan;
    }
    if(path==='programs'&&method==='GET')return list();
    const [,id,route]=path.split('/');
    if(id&&method==='GET')return get(id);
    if(route==='correct-date')throw Error('Altere a data pela edição do registro, preservando o mesmo ID.');
    const key=id&&route!=='duplicate'?id:'create:'+path;
    let candidate,expected;
    if(!pending.has(key)){
      try{const queued=(await outbox('list',null,lastActor)).find(row=>row.source===JSON.stringify([path,body]));if(queued)pending.set(key,queued);}catch(_){/* Sem fila local, a confirmação continua dependendo do servidor. */}
    }
    const existingPending=pending.get(key);
    if(existingPending){
      if(existingPending.source!==JSON.stringify([path,body]))throw Error('Há um envio pendente. Confira-o em Arquivo e banco antes de continuar.');
      candidate=existingPending.args.p_document;expected=existingPending.args.p_expected_version;
    }else{
      const current=id?(state.programs.find(p=>p.id===id)||await get(id)):null;
      candidate=IASDPILocalAdapter.apply(current?[current]:[],path,method,body);
      expected=(path==='programs'||route==='duplicate')?0:body.version;
    }
    const saving=commit(candidate,expected,false,key);
    if(pending.has(key))pending.get(key).source=JSON.stringify([path,body]);
    const saved=await saving;return saved.document;
  }
  async function refreshTemplates(){
    templates=await remote('iasdpi_templates?select=id,plan,version,display_name&order=id');
    const visible=templates.filter(t=>t.display_name);
    if(!visible.some(t=>t.id==='liturgy-i')||!visible.some(t=>t.id==='free'))throw Error('Modelos Liturgia I/Livre indisponíveis; confira a migração 003.');
    cultoTemplates=visible.sort((a,b)=>(a.id==='liturgy-i'?-1:b.id==='liturgy-i'?1:a.id==='free'?-1:b.id==='free'?1:a.display_name.localeCompare(b.display_name))).map(t=>({id:t.id,label:t.display_name,name:t.plan.name||t.display_name,source:'templates/'+t.id}));
  }
  function panel(){
    return `<section class="panel"><h2>Persistência centralizada</h2><p>Registros e revisões ficam no Supabase e podem ser abertos em outro dispositivo autorizado. As cópias em culto_archives são independentes. Backup manual do navegador não é necessário a cada publicação.</p><div class="actions">${button('Atualizar registros do banco','operational-refresh')}${button('Conferir registros antigos deste navegador','operational-preview')}${button('Conferir envios pendentes','operational-pending')}</div>
    ${preview?`<h3>Prévia de importação opcional</h3><p>Nenhum registro existente será sobrescrito. A cópia local será mantida integralmente.</p><div class="table-scroll"><table><thead><tr><th>Importar</th><th>Culto</th><th>Data / ID</th><th>Situação</th></tr></thead><tbody>${preview.rows.map(row=>`<tr><td>${row.status==='new'?`<input type="checkbox" data-import-id="${esc(row.id)}" checked aria-label="Importar ${esc(row.name)}">`:'—'}</td><td>${esc(row.name)}</td><td>${esc(displayDate(row.date))}<small>${esc(row.id)}</small></td><td>${esc({unavailable:'Indisponível: consulte um administrador',new:'Novo',exists:'Já importado',conflict:'Conflito: versão do banco preservada',duplicate:'Duplicado: já existe com outro ID',imported:'Importação confirmada'}[row.status]||row.status)}</td></tr>`).join('')}</tbody></table></div>${button('Confirmar importação dos selecionados','operational-import','','class="primary"')}`:''}
    ${recoveries.length?`<h3>Envios pendentes neste dispositivo</h3><p>Reenviar reconfirma a mesma operação. Em caso de conflito, a versão do banco será preservada.</p><ul>${recoveries.map(row=>`<li>${esc(row.args.p_document.plan.name)} · ${esc(displayDate(row.args.p_document.plan.date))} ${button('Reenviar / conferir','operational-retry',row.args.p_request_id)} ${button('Descartar somente este envio','operational-discard',row.args.p_request_id)}</li>`).join('')}</ul>`:''}</section>
    ${IASDPIAuth.isAdmin()?`<section class="panel"><h2>Modelos de liturgia</h2><p>Administradores podem salvar a programação prevista de um culto como modelo. A execução real não é copiada.</p><form id="operational-template-form">${field('ID do modelo','model-id','','text',true,'pattern="[a-z0-9_-]{1,100}" placeholder="ex.: liturgia-ii"')}${field('Nome na lista','model-name','','text',true,'maxlength="200"')}<label>Programação de referência<select name="program-id">${state.programs.map(p=>`<option value="${esc(p.id)}">${esc(p.plan.name)} · ${esc(displayDate(p.plan.date))}</option>`).join('')}</select></label><button type="submit">Salvar modelo</button></form></section>`:''}`;
  }
  async function prepareImport(documents,raw=null){
    backupValidate({format:'IASDPI-backup',version:1,programs:documents});
    const rows=await remote('rpc/iasdpi_preview_import','POST',{p_documents:documents});
    preview={documents:structuredClone(documents),rows,raw};render();
  }
  async function importDocuments(documents){await prepareImport(documents);return {added:0,copies:0,preview:true};}
  async function action(action,id){
    await IASDPIAuth.requireAccess();
    if(action==='operational-refresh'){state.programs=await list();render();toast('Registros atualizados do Supabase.');}
    else if(action==='operational-preview'){
      const raw=localStorage.getItem('iasdpi-demo-v1');
      if(!raw)throw Error('Não há registros antigos neste navegador. Você pode cadastrar novos cultos normalmente.');
      await prepareImport(JSON.parse(raw),raw);
    }else if(action==='operational-import'){
      if(!preview)throw Error('Confira a prévia primeiro.');
      if(preview.raw!==null&&localStorage.getItem('iasdpi-demo-v1')!==preview.raw)throw Error('Os dados locais mudaram. Reabra a prévia.');
      const ids=[...document.querySelectorAll('[data-import-id]:checked')].map(input=>input.dataset.importId);
      for(const id of ids){
        const row=preview.rows.find(row=>row.id===id);if(row.status!=='new')continue;
        const result=await commit(preview.documents.find(p=>p.id===id),0,true,'import:'+id);
        row.status=result.status;render();
      }
      state.programs=await list();render();toast('Importações selecionadas confirmadas no Supabase. A cópia local foi preservada.');
    }else if(action==='operational-pending'){
      recoveries=await outbox('list');render();if(!recoveries.length)toast('Nenhum envio pendente neste dispositivo.');
    }else if(action==='operational-retry'){
      const row=recoveries.find(row=>row.args.p_request_id===id);if(!row)throw Error('Envio não encontrado.');
      await remote('rpc/iasdpi_save_program','POST',row.args);
      await outbox('delete',id);for(const [key,value] of pending)if(value.args.p_request_id===id)pending.delete(key);
      recoveries=await outbox('list');state.programs=await list();render();toast('Gravação reconfirmada pelo Supabase.');
    }else if(action==='operational-discard'){
      if(!confirm('Descartar apenas este envio pendente? O registro no Supabase não será alterado.'))return;
      await outbox('delete',id);for(const [key,value] of pending)if(value.args.p_request_id===id)pending.delete(key);
      recoveries=await outbox('list');render();
    }
  }
  async function saveTemplate(form){
    await refreshTemplates();
    const id=form.elements['model-id'].value,prior=templates.find(t=>t.id===id),program=await get(form.elements['program-id'].value);
    if(prior&&!confirm('Atualizar o modelo existente? Os cultos já registrados não serão alterados.'))return;
    await remote('rpc/iasdpi_save_template','POST',{p_id:id,p_expected_version:prior?.version||0,p_name:form.elements['model-name'].value,p_plan:program.plan});
    await refreshTemplates();toast('Modelo confirmado no Supabase.');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const banner=document.createElement('aside');banner.className='demo-banner';banner.textContent='SUPABASE · Registros compartilhados da IASD Parada Inglesa. Alterações são confirmadas pelo banco.';document.querySelector('.header').after(banner);
  });
  window.addEventListener('iasdpi-auth-changed',()=>{if(!IASDPIAuth.allowed()){pending.clear();templates=[];preview=null;recoveries=[];lastActor=null;}});
  return {request,refreshTemplates,panel,action,importDocuments,saveTemplate};
})();
