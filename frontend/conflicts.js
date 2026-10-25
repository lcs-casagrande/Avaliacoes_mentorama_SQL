'use strict';
// Compara controles por IDs estáveis. Reaplicar prepara uma edição; nunca grava.
window.IASDPIConflicts=(()=>{
  let current=null,dialog=null;
  const kinds=new Set(['actuals-form','program-form','notes-form']);
  const captions={'record-name':'Nome do culto','record-date':'Data do culto','record-info':'Informações complementares',note:'Observação',incident:'Ocorrência',name:'Nome da programação',date:'Data',start:'Início',end:'Término',activity:'Atividade',block:'Bloco',responsible:'Responsável',ready:'Marcar como pronta','extra-theme':'Tema da atividade extra','activity-note':'Observação da atividade','sub-title':'Título','sub-responsible':'Responsável','sub-note':'Observação','sub-start':'Início real','sub-end':'Término real',responsavel:'Responsável'};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function groups(fields=[]){
    const result=new Map();
    for(const field of fields||[]){const key=['responsible-option','responsible-name'].includes(field.name)?'responsavel':field.name;if(!result.has(key))result.set(key,[]);result.get(key).push(field);}
    return result;
  }
  function semantic(fields){return fields?.map(f=>({name:f.name,value:f.value,checked:f.checked??null,precision:f.original===undefined?null:f.edited==='true'?'editado':f.reapplied||f.original}));}
  function text(fields){
    if(!fields)return 'Não existe nesta versão';
    if(fields.some(f=>f.name==='responsible-option')){const option=fields.find(f=>f.name==='responsible-option')?.value;return option==='other'?fields.find(f=>f.name==='responsible-name')?.value||'Em branco':option||'Em branco';}
    return fields.map(f=>f.checked!==undefined?(f.checked?'Sim':'Não'):(f.value||'Em branco')+(f.original&&f.edited!=='true'&&/\.\d+/.test(f.reapplied||f.original)?' (precisão original: '+(f.reapplied||f.original)+')':'')).join(' · ');
  }
  function describeRows(rows=[]){return rows.map(row=>text(row.fields)).join('\n');}
  function differences(baseline,mine,remote,kind,latest,blocked){
    const changes=[];
    function controls(base,local,saved,path,label){
      const old=groups(base),a=groups(local),b=groups(saved);
      for(const key of new Set([...a.keys(),...b.keys()])){
        const source=a.get(key),target=b.get(key);if(equal(semantic(source),semantic(target)))continue;
        const localChange=base===null||!equal(semantic(source),semantic(old.get(key)));
        changes.push({type:'fields',path,key,label:label+(key.startsWith('team-')?roles[Number(key.slice(5))]:captions[key]||key),mine:source,remote:target,local:localChange,enabled:!blocked&&localChange&&Boolean(source&&target),reason:!localChange?'Alterado somente no banco; será mantido.':!target?'Campo removido no banco; ajuste manual necessário.':blocked?'A programação prevista está protegida após o início.':''});
      }
    }
    function collection(base,local,saved,path,isChild=false){
      const old=new Map((base||[]).map(r=>[r.id,r])),a=new Map(local.map(r=>[r.id,r])),b=new Map(saved.map(r=>[r.id,r]));
      const title=row=>row?.fields?.find(f=>['activity','extra-theme','sub-title'].includes(f.name))?.value||latest.plan.items.find(i=>i.id===row?.id)?.activity||row?.id||'Sem título';
      for(const id of new Set([...a.keys(),...b.keys()])){
        const source=a.get(id),target=b.get(id),previous=old.get(id),index=local.findIndex(r=>r.id===id)+1;
        const label=(isChild?'Subatividade ':'Atividade ')+(index||saved.findIndex(r=>r.id===id)+1)+': '+title(source||target)+' / ';
        if(source&&target){
          controls(previous?.fields??(baseline===null?null:[]),source.fields,target.fields,[...path,id],label);
          if(!isChild)collection(previous?.children??(baseline===null?null:[]),source.children||[],target.children||[],[...path,id,'children'],true);
        }else{
          const addition=Boolean(source&&!previous),removal=Boolean(!source&&previous),allowed=isChild||kind==='program-form'||(source||previous)?.extra;
          changes.push({type:addition?'add':removal?'remove':'unavailable',path,id,label:label+(addition?'Adicionar':removal?'Excluir':'Removida ou adicionada no banco'),mine:source,remote:target,local:addition||removal,enabled:!blocked&&allowed&&(addition||removal),reason:blocked?'A programação prevista está protegida após o início.':!addition&&!removal?'Estrutura alterada no banco; será preservada.':!allowed?'Atividades previstas só podem mudar na edição da programação.':''});
        }
      }
      const ordered=rows=>(rows||[]).map(r=>r.id).filter(id=>a.has(id)&&b.has(id));
      if(base&& !equal(ordered(base),ordered(local)))changes.push({type:'order',path,label:'Ordem das atividades / subatividades',mine:local,remote:saved,local:true,enabled:false,reason:'Reordene manualmente após comparar; a ordem recente não será substituída.'});
    }
    controls(baseline?.fields??null,mine.fields,remote.fields,[],'');
    collection(baseline?.rows??null,mine.rows,remote.rows,[]);
    return changes;
  }
  function snapshotFor(program,kind){
    const protectedPlan=kind==='program-form'&&!['Planejamento','Pronta'].includes(program.status);
    const template=document.createElement('template');
    template.innerHTML=kind==='actuals-form'?actualsForm(program):kind==='notes-form'?notes(program):editor(protectedPlan?{...program,status:'Planejamento'}:program,true);
    const form=template.content.querySelector('#'+kind);if(!form)throw Error('O tipo de registro mudou; reabra a programação para editar.');
    return {data:IASDPIDrafts.capture(form),blocked:protectedPlan||kind==='actuals-form'&&program.execution_mode!=='manual'};
  }
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.dataset.conflictDialog='true';dialog.className='conflict-dialog';dialog.setAttribute('aria-labelledby','conflict-title');document.body.append(dialog);
    dialog.addEventListener('close',()=>{if(dialog.open)return;const target=current?.form;current=null;dialog.replaceChildren();if(document.activeElement===document.body&&target?.isConnected)target.querySelector('button[type="submit"]')?.focus();});
  }
  function run(task,button){return guarded(async()=>{try{await task();}catch(error){const target=dialog?.querySelector('.conflict-feedback');if(dialog?.open&&target){target.setAttribute('role','alert');target.textContent=error.message;}throw error;}},button);}
  function draw(notice=''){
    const review=current;if(!review)return;
    const value=change=>change.type==='fields'?text(change.mine):change.mine?describeRows(Array.isArray(change.mine)?change.mine:[change.mine]):'Removida nesta edição';
    const saved=change=>change.type==='fields'?text(change.remote):change.remote?describeRows(Array.isArray(change.remote)?change.remote:[change.remote]):'Não existe nesta versão';
    dialog.innerHTML=`<h2 id="conflict-title">Comparar versões do registro</h2><p><strong>Banco: versão ${review.latest.version}</strong> · Sua edição: versão ${review.version}. ${esc(review.latest.plan.name)}</p><p>Nada será gravado nesta janela. Selecione somente as alterações que deseja reaplicar, confirme e depois revise e salve o formulário. Campos não selecionados manterão a versão do banco. A cópia local anterior será preservada como rascunho protegido.</p>${review.baseline===null?'<p class="form-note">Rascunho antigo: não há uma base confiável para identificar quais campos foram alterados originalmente. Revise cada diferença; nenhuma seleção é automática.</p>':''}${notice?`<p role="alert" class="form-error">${esc(notice)}</p>`:''}${review.blocked?'<p class="form-error" role="status">A programação prevista está protegida após o início. As diferenças são apenas para consulta.</p>':''}
      <p id="conflict-scroll-hint" class="muted">Se as colunas não couberem, deslize a tabela na horizontal. Com teclado, foque a tabela e use as setas para consultar as duas versões.</p><div class="table-scroll" tabindex="0" role="region" aria-describedby="conflict-scroll-hint" aria-label="Diferenças entre sua edição e a versão salva no banco"><table><thead><tr><th>Reaplicar</th><th>Campo</th><th>Versão salva no banco</th><th>Sua edição local</th></tr></thead><tbody>${review.changes.map((change,index)=>`<tr><td><label class="conflict-choice"><input type="checkbox" data-conflict-choice="${index}" ${change.enabled?'':'disabled'} aria-label="Reaplicar ${esc(change.label)}"></label></td><th scope="row">${esc(change.label)}<small>${esc(change.reason)}</small></th><td><pre>${esc(saved(change))}</pre></td><td><pre>${esc(value(change))}</pre></td></tr>`).join('')}</tbody></table></div>${!review.changes.length?'<p role="status">Não há campos divergentes. Você pode carregar a versão atual para continuar.</p>':''}
      <p class="conflict-feedback" role="status" aria-live="polite">Nenhuma alteração selecionada.</p><div class="actions conflict-actions"><button type="button" data-conflict-close>Voltar à edição</button><button type="button" data-conflict-refresh>Atualizar comparação</button><button type="button" data-conflict-load>Usar versão atual do banco</button><button type="button" class="primary" data-conflict-apply disabled>Reaplicar seleção na edição</button></div>`;
    dialog.querySelectorAll('[data-conflict-choice]').forEach(input=>input.addEventListener('change',()=>{const count=dialog.querySelectorAll('[data-conflict-choice]:checked').length;dialog.querySelector('[data-conflict-apply]').disabled=!count;dialog.querySelector('.conflict-feedback').textContent=count?`${count} alterações selecionadas. Ainda não reaplicadas.`:'Nenhuma alteração selecionada.';}));
    dialog.querySelector('[data-conflict-close]').onclick=close;
    dialog.querySelector('[data-conflict-refresh]').onclick=event=>run(()=>refresh(review),event.currentTarget);
    dialog.querySelector('[data-conflict-apply]').onclick=event=>run(()=>apply(review,false),event.currentTarget);
    dialog.querySelector('[data-conflict-load]').onclick=event=>run(()=>apply(review,true),event.currentTarget);
  }
  async function load(form,error,source=null,notice=''){
    const access=await IASDPIAuth.requireAccess(),context=IASDPIDrafts.comparison(form),uid=source?.uid||context.uid;
    if(uid!==access.user.id)throw Error('A edição pertence a outra conta.');
    const id=form.dataset.id;if(!id)throw Error('O registro precisa existir para comparar versões.');
    const fingerprint=JSON.stringify(IASDPIDrafts.capture(form)),latest=await api('programs/'+encodeURIComponent(id));
    if(!form.isConnected||IASDPIAuth.session()?.user.id!==uid)throw Error('A edição ou a sessão mudou.');
    const reference=snapshotFor(latest,form.id);
    current={form,page:state.page,kind:form.id,id,uid,error,source,version:source?.version??context.version,baseline:source?null:context.baseline,mine:structuredClone(source?.data||context.data),fingerprint,latest,remote:reference.data,blocked:reference.blocked};
    current.changes=differences(current.baseline,current.mine,current.remote,current.kind,latest,current.blocked);
    ensureDialog();draw(notice);if(!dialog.open)dialog.showModal();dialog.querySelector('[data-conflict-close]').focus();
  }
  async function open(form,error){await load(form,error);}
  async function openDraft(form,source){await load(form,null,source);}
  async function refresh(review,notice='Comparação atualizada. Revise novamente as seleções.'){
    if(current!==review||!dialog.open)return;
    await load(review.form,review.error,review.source,notice);
  }
  function fieldsAt(snapshot,path){
    if(!path.length)return snapshot;
    const row=snapshot.rows.find(r=>r.id===path[0]);
    return path.length===1?row:row?.children?.find(c=>c.id===path[2]);
  }
  function collectionAt(snapshot,path){return !path.length?snapshot.rows:snapshot.rows.find(r=>r.id===path[0])?.children;}
  function copiedField(field){const copy=structuredClone(field);if(copy.original&&copy.edited!=='true'){const clock=recordClock(copy.reapplied||copy.original);if(validRecordClock(clock))copy.reapplied=clock;}return copy;}
  function copiedRow(row){return {...structuredClone(row),fields:row.fields.map(copiedField),children:(row.children||[]).map(copiedRow)};}
  function patch(snapshot,change){
    if(change.type==='fields'){
      const target=fieldsAt(snapshot,change.path);if(!target)throw Error('A estrutura mudou; reabra a comparação.');
      for(const field of change.mine){
        const copy=copiedField(field);
        const index=target.fields.findIndex(f=>f.name===copy.name);if(index>=0)target.fields[index]=copy;
      }
    }else if(change.type==='add'||change.type==='remove'){
      const target=collectionAt(snapshot,change.path);if(!target)throw Error('A atividade principal foi removida.');
      if(change.type==='add'){if(target.some(r=>r.id===change.id))throw Error('Identificador já existente.');target.push(copiedRow(change.mine));}
      else{const index=target.findIndex(r=>r.id===change.id);if(index>=0)target.splice(index,1);}
    }
  }
  async function apply(review,remoteOnly){
    if(current!==review||!dialog.open)throw Error('Comparação encerrada.');
    const selected=remoteOnly?[]:[...dialog.querySelectorAll('[data-conflict-choice]:checked')].map(input=>review.changes[Number(input.dataset.conflictChoice)]);
    if(!remoteOnly&&(!selected.length||selected.some(c=>!c.enabled)))throw Error('Selecione alterações válidas.');
    if(!confirm(remoteOnly?'Carregar a versão atual sem reaplicar alterações? Sua cópia local será preservada para consulta. Nada será gravado no banco.':`Reaplicar ${selected.length} alterações selecionadas sobre a versão ${review.latest.version}? As demais informações do banco serão mantidas. Você ainda deverá revisar e salvar.`))return;
    const access=await IASDPIAuth.requireAccess();if(access.user.id!==review.uid)throw Error('A conta mudou.');
    if(!review.form.isConnected||JSON.stringify(IASDPIDrafts.capture(review.form))!==review.fingerprint)throw Error('A edição local mudou. Atualize a comparação antes de reaplicar.');
    const latest=await api('programs/'+encodeURIComponent(review.id));
    if(latest.version!==review.latest.version){await refresh(review,'O banco mudou novamente. Nenhuma seleção foi reaplicada. Revise a nova versão.');return;}
    const data=structuredClone(review.remote);for(const change of selected)patch(data,change);
    await IASDPIDrafts.preserveConflict(review.form,review.mine,review.version,review.error?.conflict?.document);
    if(review.error?.conflict&&window.IASDPIOperational)await IASDPIOperational.releaseConflict(review.error.conflict,latest.version);
    if(current!==review||!dialog.open||IASDPIAuth.session()?.user.id!==review.uid||!IASDPIAuth.allowed())throw Error('A comparação ou sessão foi encerrada.');
    state.page=review.kind==='actuals-form'?(latest.execution_mode==='manual'?'actuals':'tracking'):review.kind==='program-form'?'plan-edit':review.page;
    replaceProgram(latest);IASDPINavigation.identify(state.page,latest.id);render();
    const form=document.querySelector('#'+review.kind);if(!form){if(remoteOnly){close();app.focus({preventScroll:true});toast('Versão atual carregada para consulta. Nenhuma gravação foi realizada.');return;}throw Error('A programação mudou de estado; reabra o registro.');}
    if(!remoteOnly){IASDPIDrafts.rebase(form,data);if(review.kind==='actuals-form')setRegistrationSaveState(form,'dirty','Seleção reaplicada nesta edição · ainda não salva.');}
    close();form.querySelector('input,textarea,select')?.focus();toast(remoteOnly?'Versão atual carregada. Nenhuma gravação foi realizada.':'Seleção reaplicada somente na edição. Revise e clique em Salvar.');
  }
  function close(){if(dialog?.open)dialog.close();}
  window.addEventListener('iasdpi-auth-changed',()=>{if(current&&(!IASDPIAuth.allowed()||IASDPIAuth.session()?.user.id!==current.uid))close();});
  return {open,openDraft,close};
})();
