'use strict';
// Recuperação local de edição; nunca substitui confirmação do servidor.
window.IASDPIDrafts=(()=>{
  const ttl=24*60*60*1000, forms=new Set(['actuals-form','program-form','notes-form']);
  const scope=JSON.stringify([location.pathname,IASDPIConfig.supabaseUrl,IASDPIConfig.storageNamespace||'',IASDPIConfig.storageMode||'browser']);
  let active=null, observer=null, queue=Promise.resolve(), preferred=null, memoryOnly=false;
  const memory=new Map(),keys=new Map(),labels={'actuals-form':'Registro do culto','program-form':'Programação','notes-form':'Observações do resumo'};
  let tab;
  try{tab=sessionStorage.getItem('iasdpi-draft-tab-v1')||crypto.randomUUID();sessionStorage.setItem('iasdpi-draft-tab-v1',tab);}catch(_){tab=crypto.randomUUID();}
  const actor=()=>IASDPIAuth.session()?.user.id||null;
  const group=uid=>JSON.stringify([scope,uid]);
  const draftKey=(uid,kind,id)=>JSON.stringify([scope,uid,kind,id,tab]);
  const aad=row=>new TextEncoder().encode(JSON.stringify([row.key,row.revision,row.baseVersion,row.expiresAt]));
  function enqueue(job){const task=queue.then(job);queue=task.catch(()=>{});return task;}
  function open(){return new Promise((resolve,reject)=>{
    const request=indexedDB.open('iasdpi-edit-drafts-v1',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'key'});request.result.createObjectStore('keys',{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Armazenamento local indisponível.'));
  });}
  async function storage(store,mode,operation){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));
      tx.oncomplete=()=>{db.close();resolve(request.result);};
      tx.onabort=tx.onerror=()=>{db.close();reject(Error('Não foi possível preservar o rascunho neste navegador.'));};
    });
  }
  async function keyFor(uid){
    const id=group(uid);if(keys.has(id))return keys.get(id);
    let row;
    if(!memoryOnly)try{row=await storage('keys','readonly',s=>s.get(id));}catch(_){memoryOnly=true;}
    if(!row){
      row={key:id,value:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])};
      // add, e não put: duas abas não podem trocar a chave que cifra o mesmo usuário.
      if(!memoryOnly)try{await storage('keys','readwrite',s=>s.add(row));}
      catch(_){try{row=await storage('keys','readonly',s=>s.get(id))||row;}catch(_){memoryOnly=true;}}
    }
    keys.set(id,row.value);return row.value;
  }
  async function rows(){
    if(!memoryOnly)try{return await storage('drafts','readonly',s=>s.getAll());}catch(_){memoryOnly=true;}
    return [...memory.values()];
  }
  async function write(row){
    memory.set(row.key,row);
    if(!memoryOnly)try{await storage('drafts','readwrite',s=>s.put(row));}catch(_){memoryOnly=true;}
  }
  async function remove(key,revision=null){
    if(!revision||memory.get(key)?.revision===revision)memory.delete(key);
    if(memoryOnly)return;
    const db=await open();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),read=store.get(key);
      read.onsuccess=()=>{if(read.result&&(!revision||read.result.revision===revision))store.delete(key);};
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(Error('Não foi possível limpar o rascunho local.'));};
    });
  }
  async function owned(uid){
    const all=await rows(),now=Date.now(),valid=[];
    for(const row of all){
      if(row.scope!==scope)continue;
      if(row.expiresAt<=now){await remove(row.key,row.revision);continue;}
      if(row.uid===uid)valid.push(row);
    }
    return valid.sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  function controls(root,exclude){
    return [...root.querySelectorAll('input,select,textarea')].filter(e=>e.name&&!['password','file'].includes(e.type)&&(!exclude||!e.closest(exclude))).map(e=>({
      name:e.name,value:e.value,checked:e.type==='checkbox'?e.checked:undefined,
      edited:e.dataset.timeEdited,original:e.dataset.originalTime,day:e.dataset.originalDay,reapplied:e.dataset.conflictClock
    }));
  }
  function snapshot(form){
    const kind=form.id,rowSelector=kind==='actuals-form'?'.actual-row':kind==='program-form'?'.item-editor':null;
    const data={fields:controls(form,rowSelector),rows:[]};
    if(rowSelector)data.rows=[...form.querySelectorAll(rowSelector)].map(row=>({
      id:kind==='actuals-form'?row.dataset.id:row.dataset.itemId,extra:row.dataset.extra==='true',
      fields:controls(row,kind==='actuals-form'?'.subactivity':null),
      children:[...row.querySelectorAll('.subactivity')].map(child=>({id:child.dataset.subId,parent:child.dataset.parentId,fields:controls(child)}))
    }));
    return data;
  }
  function feedback(message,error=false){
    if(!active?.form.isConnected)return;
    let target=active.form.querySelector('.draft-feedback');
    if(!target){target=document.createElement('p');target.className='draft-feedback form-note';target.setAttribute('role','status');active.form.prepend(target);}
    target.textContent=message;target.classList.toggle('form-error',error);
  }
  function persist(context,required=false){
    const row={key:context.key,scope,uid:context.uid,kind:context.kind,id:context.id,page:context.page,baseVersion:context.version,
      revision:context.revision,updatedAt:Date.now(),expiresAt:Date.now()+ttl};
    const data=structuredClone(context.data);
    return enqueue(async()=>{
      row.iv=crypto.getRandomValues(new Uint8Array(12));
      row.cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(row)},await keyFor(row.uid),new TextEncoder().encode(JSON.stringify(data)));
      await write(row);
      if(required&&memoryOnly)throw Error('Cópia de recuperação persistente indisponível. Mantenha esta edição aberta.');
      if(active?.key===row.key&&active.revision===row.revision){
        feedback(memoryOnly?'Rascunho somente nesta aba: recuperação após recarregar indisponível. Mantenha a aba aberta.':'Rascunho local protegido por até 24 horas. Ainda não salvo no servidor.');
      }
      await refreshNotice();
    }).catch(error=>{if(active?.key===row.key)feedback('Falha ao preservar o rascunho. Mantenha esta aba aberta. '+error.message,true);if(required)throw Error('Não foi possível preservar a cópia anterior. Nenhuma seleção foi reaplicada. '+error.message);});
  }
  function changed(){
    if(!active?.form.isConnected)return;
    const data=snapshot(active.form),serial=JSON.stringify(data);
    if(serial===active.serial)return;
    active.data=data;active.serial=serial;active.revision=crypto.randomUUID();active.dirty=true;active.leaving=false;
    if(active.kind==='actuals-form')registrationDirty=true;
    feedback('Alterações não salvas. Preservando rascunho local…');
    void persist(active);
  }
  function suspend(){
    changed();observer?.disconnect();active=null;
    const notice=document.querySelector('#drafts-notice');if(notice)notice.replaceChildren();
    if(notice)notice.hidden=true;
  }
  async function refreshNotice(){
    const uid=actor();let host=document.querySelector('#drafts-notice');
    if(!uid){if(host)host.hidden=true;return;}
    const list=await owned(uid);if(actor()!==uid)return;
    if(!host){host=document.createElement('aside');host.id='drafts-notice';host.className='drafts-notice';document.querySelector('#app').before(host);}
    host.replaceChildren();host.hidden=!list.length;if(!list.length)return;
    const details=document.createElement('details'),title=document.createElement('summary');
    title.textContent='Rascunhos locais ('+list.length+') · não enviados ao servidor';details.append(title);
    const explanation=document.createElement('p');explanation.textContent='Disponíveis por até 24 horas neste navegador. Sair da conta remove estes rascunhos.';details.append(explanation);
    for(const row of list){
      const button=document.createElement('button');button.type='button';
      button.textContent='Retomar '+labels[row.kind]+(row.id?' · '+row.id.slice(0,12):' · novo')+' · '+new Date(row.updatedAt).toLocaleString('pt-BR',{hourCycle:'h23'});
      button.onclick=()=>guarded(async()=>{
        await IASDPIAuth.requireAccess();if(actor()!==uid)throw Error('Entre com a conta original.');
        if(!canLeave())return;
        if(row.id&&!state.programs.some(p=>p.id===row.id))throw Error('Este registro não está disponível. O rascunho foi preservado.');
        preferred=row.key;state.selected=row.id||null;navigate(row.page,row.id||undefined,{refresh:true});
      },button);
      details.append(button);
    }
    host.append(details);
  }
  function formContext(form){
    const uid=actor(),kind=form?.id;if(!uid||!forms.has(kind))return null;
    const id=form.dataset.id||'';
    return {uid,kind,id,key:draftKey(uid,kind,id),page:state.page,version:Number(form.dataset.version||0),form,
      baseline:JSON.stringify(snapshot(form)),serial:JSON.stringify(snapshot(form)),data:snapshot(form),revision:null,dirty:false,leaving:false,source:null};
  }
  function mount(){
    if(active?.form.isConnected)return;
    observer?.disconnect();
    const form=document.querySelector('#actuals-form,#program-form,#notes-form');
    active=formContext(form);
    if(active){observer=new MutationObserver(()=>changed());observer.observe(form,{childList:true,subtree:true});}
    const context=active;
    void enqueue(async()=>{
      await refreshNotice();if(!context||active!==context||actor()!==context.uid)return;
      const list=await owned(context.uid);
      const row=list.find(r=>r.key===preferred&&r.kind===context.kind&&r.id===context.id)||list.find(r=>r.key===context.key)||list.find(r=>r.kind===context.kind&&r.id===context.id);
      preferred=null;if(!row||active!==context||actor()!==context.uid||context.dirty)return;
      const panel=document.createElement('section');panel.className='draft-offer form-note';
      const message=document.createElement('p');
      message.textContent=row.baseVersion===context.version?'Existe um rascunho local. A recuperação não grava no servidor.':'A versão do registro mudou. O rascunho foi preservado para consulta; não será aplicado sobre a versão atual.';
      panel.append(message);
      const restore=document.createElement('button');restore.type='button';restore.dataset.draftRestore='true';restore.textContent='Recuperar rascunho';restore.disabled=row.baseVersion!==context.version;
      restore.onclick=()=>guarded(()=>recover(row,context),restore);panel.append(restore);
      if(row.baseVersion!==context.version){const compare=document.createElement('button');compare.type='button';compare.textContent='Comparar com versão atual';compare.dataset.draftCompare='true';compare.onclick=()=>guarded(async()=>{const data=await unlock(row,context);await IASDPIConflicts.openDraft(context.form,{data,version:row.baseVersion,uid:row.uid});},compare);panel.append(compare);}
      const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Consultar rascunho';
      inspect.onclick=()=>guarded(async()=>{
        const data=await unlock(row,context);const pre=document.createElement('pre');pre.className='draft-preview';pre.textContent=JSON.stringify(data,null,2);panel.append(pre);inspect.remove();
      },inspect);panel.append(inspect);
      const discard=document.createElement('button');discard.type='button';discard.textContent='Descartar este rascunho';
      discard.onclick=()=>guarded(async()=>{
        await IASDPIAuth.requireAccess();if(actor()!==row.uid)throw Error('Entre com a conta original.');
        if(!confirm('Descartar somente este rascunho local? O registro salvo não será alterado.'))return;
        await enqueue(()=>remove(row.key,row.revision));panel.remove();await refreshNotice();
      },discard);panel.append(discard);context.form.prepend(panel);
    }).catch(error=>feedback(error.message,true));
  }
  async function unlock(row,context){
    await IASDPIAuth.requireAccess();
    if(actor()!==row.uid||active!==context||row.scope!==scope)throw Error('Rascunho indisponível para esta sessão.');
    const current=(await owned(row.uid)).find(r=>r.key===row.key&&r.revision===row.revision);
    if(!current)throw Error('Rascunho expirou ou foi atualizado. Reabra a edição.');
    const value=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(row)},await keyFor(row.uid),row.cipher);
    if(actor()!==row.uid||active!==context)throw Error('Sessão alterada.');
    return JSON.parse(new TextDecoder().decode(value));
  }
  function fill(root,fields,exclude){
    if(!Array.isArray(fields))throw Error('Rascunho incompatível.');
    const inputs=[...root.querySelectorAll('input,select,textarea')].filter(e=>!exclude||!e.closest(exclude));
    for(const saved of fields){
      const input=inputs.find(e=>e.name===saved.name);if(!input||typeof saved.value!=='string'||['password','file'].includes(input.type))continue;
      input.value=saved.value;if(input.type==='checkbox')input.checked=Boolean(saved.checked);
      for(const [name,value] of [['timeEdited',saved.edited],['originalTime',saved.original],['originalDay',saved.day],['conflictClock',saved.reapplied]]){
        if(typeof value==='string')input.dataset[name]=value;else delete input.dataset[name];
      }
    }
  }
  const values=fields=>Object.fromEntries(fields.map(f=>[f.name,f.value]));
  async function recover(row,context){
    const data=await unlock(row,context);
    if(row.baseVersion!==context.version)throw Error('A versão do registro mudou. Consulte o rascunho antes de reaplicar seus dados.');
    applyData(context,data,{key:row.key,revision:row.revision});
  }
  function applyData(context,data,source=null){
    if(!Array.isArray(data.rows)||!Array.isArray(data.fields))throw Error('Rascunho incompatível.');
    if(context.kind==='actuals-form'){
      const rows=[...context.form.querySelectorAll('.actual-row')],planned=rows.filter(r=>!r.dataset.extra).map(r=>r.dataset.id).sort();
      if(JSON.stringify(planned)!==JSON.stringify(data.rows.filter(r=>!r.extra).map(r=>r.id).sort()))throw Error('As atividades da programação mudaram. O rascunho permanece disponível para consulta.');
      const list=context.form.querySelector('.actuals-list'),fragment=document.createDocumentFragment();
      for(const saved of data.rows){
        let target=rows.find(r=>r.dataset.id===saved.id);
        if(!target&&saved.extra){
          const item={id:saved.id,activity:values(saved.fields)['extra-theme']||'',block:'Culto',unplanned:true};
          const holder=document.createElement('div');holder.innerHTML=actualRow(null,{items:[item]},item,0,{});target=holder.firstElementChild;
        }
        if(!target)throw Error('Atividade não encontrada. Rascunho preservado.');
        fill(target,saved.fields,'.subactivity');
        target.querySelector('.subactivities').innerHTML=saved.children.map(child=>subactivityRow({...values(child.fields),id:child.id,parent_id:child.parent,title:values(child.fields)['sub-title'],responsible:values(child.fields)['sub-responsible'],note:values(child.fields)['sub-note'],start:'',end:''},saved.id)).join('');
        [...target.querySelectorAll('.subactivity')].forEach((child,index)=>fill(child,saved.children[index].fields));
        fragment.append(target);
      }
      list.replaceChildren(fragment);list.querySelectorAll('.actual-number').forEach((e,i)=>e.textContent=i+1);
    }else if(context.kind==='program-form'){
      context.form.querySelector('#items-editor').innerHTML=data.rows.map((r,i)=>itemEditor({...values(r.fields),id:r.id},i)).join('');
    }
    fill(context.form,data.fields,context.kind==='actuals-form'?'.actual-row':context.kind==='program-form'?'.item-editor':null);
    context.form.querySelector('.draft-offer')?.remove();
    context.source=source;context.serial='';changed();
    for(const select of context.form.querySelectorAll('[name="responsible-option"]'))select.closest('.actual-row').querySelector('[name="responsible-name"]').hidden=select.value!=='other';
    updateWeekday();updateActuals();feedback('Rascunho recuperado localmente, ainda não salvo no servidor. Revise os campos e salve para enviar.');
  }
  function comparison(form){
    if(!IASDPIAuth.allowed()||active?.form!==form||active.uid!==actor())throw Error('Edição indisponível para esta conta.');
    changed();return {uid:active.uid,version:active.version,baseline:JSON.parse(active.baseline),data:snapshot(form)};
  }
  async function preserveConflict(form,data,version,pendingDocument){
    const access=await IASDPIAuth.requireAccess(),context=active;
    if(context?.form!==form||context.uid!==access.user.id)throw Error('Edição indisponível para esta conta.');
    const copy=structuredClone(data);if(pendingDocument)copy.pendingDocument=structuredClone(pendingDocument);
    await persist({...context,key:context.key+':conflict:'+crypto.randomUUID(),version,data:copy,revision:crypto.randomUUID()},true);
  }
  function rebase(form,data){
    if(!IASDPIAuth.allowed()||active?.form!==form||active.uid!==actor())throw Error('Edição indisponível para esta conta.');
    applyData(active,data);feedback('Seleção reaplicada somente nesta edição. Revise e salve para gravar. O rascunho anterior foi preservado para consulta.');
  }
  function canLeave(){
    changed();if(!active?.dirty||active.leaving)return true;
    if(!confirm('Há alterações não salvas. Sair desta edição mantendo um rascunho local para recuperação? Nada será enviado ao servidor.'))return false;
    active.leaving=true;registrationDirty=false;return true;
  }
  function beforeRender(){changed();observer?.disconnect();active=null;}
  function beginSave(form){
    if(!forms.has(form.id))return null;
    changed();if(active?.form!==form)return null;
    return {context:active,key:active.key,revision:active.revision,uid:active.uid,source:active.source};
  }
  async function bind(form,program,context=active){
    if(context?.form!==form)return;
    const oldKey=context.key,revision=context.revision;
    context.version=program.version;context.id=program.id;context.key=draftKey(context.uid,context.kind,program.id);
    form.dataset.version=program.version;form.dataset.id=program.id;
    if(context.dirty)await persist(context);
    if(oldKey!==context.key&&revision)await enqueue(()=>remove(oldKey,revision));
  }
  async function saved(ticket,program){
    if(!ticket)return false;
    const context=ticket.context;
    await enqueue(async()=>{
      if(ticket.revision)await remove(ticket.key,ticket.revision);
      if(context.key!==ticket.key&&ticket.revision)await remove(context.key,ticket.revision);
      if(ticket.source)await remove(ticket.source.key,ticket.source.revision);
    });
    if(context.revision!==ticket.revision){
      await bind(context.form,program,context);return true;
    }
    context.version=program.version;context.dirty=false;context.baseline=context.serial;context.leaving=true;
    if(context.kind==='actuals-form')registrationDirty=false;
    await refreshNotice();return false;
  }
  async function discardCurrent(){
    changed();if(!active?.dirty)return true;
    if(!confirm('Descartar somente as alterações não salvas desta edição? O registro salvo não será alterado.'))return false;
    const context=active;observer?.disconnect();active=null;registrationDirty=false;
    await enqueue(async()=>{await remove(context.key,context.revision);if(context.source)await remove(context.source.key,context.source.revision);});
    await refreshNotice();return true;
  }
  async function clearUser(uid){
    if(!uid)return;suspend();
    await enqueue(async()=>{
      for(const row of memory.values())if(row.scope===scope&&row.uid===uid)memory.delete(row.key);
      keys.delete(group(uid));
      // Tentar também quando houve fallback em memória: pode haver uma cópia
      // persistida de antes da falha. Não afirmar limpeza se o navegador a negar.
      try{
        const db=await open();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(['drafts','keys'],'readwrite'),store=tx.objectStore('drafts'),read=store.getAll();
          read.onsuccess=()=>{for(const row of read.result)if(row.scope===scope&&row.uid===uid)store.delete(row.key);};
          tx.objectStore('keys').delete(group(uid));
          tx.oncomplete=()=>{db.close();resolve();};
          tx.onabort=tx.onerror=()=>{db.close();reject(Error('Limpeza local indisponível.'));};
        });
      }catch(_){throw Error('Sessão encerrada, mas o navegador impediu a limpeza dos rascunhos cifrados. Em dispositivo compartilhado, limpe os dados deste site no navegador.');}
    });
  }
  async function confirmLogout(){
    changed();const uid=actor();if(!uid)return true;
    const list=await enqueue(()=>owned(uid));
    return !list.length&&!active?.dirty||confirm('Sair da conta removerá os rascunhos locais deste usuário neste site. Alterações ainda não enviadas serão descartadas. Salve no servidor antes de sair se quiser mantê-las. Continuar?');
  }
  document.addEventListener('input',event=>{if(forms.has(event.target.closest('form')?.id))changed();});
  document.addEventListener('change',event=>{if(forms.has(event.target.closest('form')?.id))changed();});
  window.addEventListener('iasdpi-auth-changed',()=>{if(!actor()||(active&&active.uid!==actor()))suspend();});
  window.addEventListener('beforeunload',event=>{changed();if(active?.dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)changed();});
  return {mount,beforeRender,changed,canLeave,beginSave,bind,saved,discardCurrent,clearUser,confirmLogout,comparison,preserveConflict,rebase,capture:form=>{if(!IASDPIAuth.allowed()||!forms.has(form?.id))throw Error('Acesso necessário.');return snapshot(form);},flush:()=>queue};
})();
