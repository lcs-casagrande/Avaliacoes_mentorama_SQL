'use strict';
// Ações administrativas confirmadas por RPC; nunca excluem definitivamente.
const trashState={rows:null,detail:null,error:'',requests:new Map()};
async function trashRPC(name,args={}){
  const access=await IASDPIAuth.requireAccess();
  if(!IASDPIAuth.isAdmin())throw Error('Acesso administrativo necessário.');
  return IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify(args)}).then(result=>{
    if(IASDPIAuth.session()?.access_token!==access.token)throw Error('Sessão alterada. Entre novamente e atualize a lista.');
    return result;
  });
}
async function refreshTrash(){
  try{
    const rows=[];
    for(let offset=0;;offset+=100){const page=await trashRPC('iasdpi_list_trash',{p_offset:offset});rows.push(...page);if(page.length<100)break;}
    trashState.rows=rows;trashState.error='';
  }catch(error){trashState.error=error.message+' Confira se a migração 004 foi instalada.';}
  if(state.page==='trash')render();
}
function trashWhen(value){const parsed=inspectRecordTime(value);return parsed.valid?`${displayDate(parsed.day)} ${displayActualTime(value)}`:'Data não informada';}
function trashPage(){
  if(!IASDPIAuth.isAdmin())return empty('Acesso administrativo necessário','Somente administradores podem consultar e restaurar cultos da lixeira.');
  const detail=trashState.detail,p=detail?.document;
  return heading('ADMINISTRAÇÃO','Lixeira de cultos','Os registros permanecem recuperáveis. Não existe exclusão definitiva.',`<div class="actions">${button('Atualizar lixeira','trash-refresh')}${button('Voltar às programações','programs')}</div>`)+
    (trashState.error?`<p class="form-error" role="alert">${esc(trashState.error)}</p>`:'')+
    (p?`<section class="panel"><h2>${esc(p.plan?.name)}</h2><p>${esc(displayDate(p.plan?.date))} · ID: ${esc(p.id)}</p><p>Movido em ${esc(trashWhen(detail.deleted_at))} por ${esc(detail.deleted_by_email||detail.deleted_by)}.</p><p>Motivo: ${esc(detail.deletion_reason||'Não informado')}</p><p>Status anterior: ${esc(p.status)} · Versão ${esc(detail.version)}</p><p>Observações: ${esc(p.note||'—')}</p><p>Ocorrências: ${esc(p.incident||'—')}</p><p>Informações complementares: ${esc(p.record_info||'—')}</p><div class="table-scroll"><table><thead><tr><th>Atividade / responsável / observações</th><th>Previsto</th><th>Real</th><th>Duração prevista</th><th>Duração real</th><th>Diferença</th></tr></thead><tbody>${summaryActivityRows(p)}</tbody></table></div><div class="actions">${button('Restaurar culto','trash-restore',p.id,'class="primary"')}${button('Fechar detalhes','trash-close')}</div><details><summary>Histórico da lixeira</summary><ul>${(detail.audit||[]).map(a=>`<li>${esc(a.action==='trash'?'Movido para a lixeira':'Restaurado')} · ${esc(trashWhen(a.happened_at))} · ${esc(a.actor_id)} · versão ${esc(a.to_version)}${a.reason?' · '+esc(a.reason):''}</li>`).join('')}</ul></details></section>`:'')+
    (trashState.rows===null?'<p>Use Atualizar lixeira para consultar o Supabase.</p>':trashState.rows.length?`<div class="table-scroll"><table><thead><tr><th>Culto</th><th>Excluído em / por</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>${trashState.rows.map(row=>`<tr><td>${esc(row.document.plan?.name)}<small>${esc(displayDate(row.document.plan?.date))} · ${esc(row.id)}</small></td><td>${esc(trashWhen(row.deleted_at))}<small>${esc(row.deleted_by_email||row.deleted_by)}</small></td><td>${esc(row.deletion_reason||'—')}</td><td>${button('Ver detalhes','trash-detail',row.id)}${button('Restaurar','trash-restore',row.id)}</td></tr>`).join('')}</tbody></table></div>`:empty('Lixeira vazia','Nenhum culto foi movido para a lixeira.'));
}
async function handleTrashAction(action,id){
  await IASDPIAuth.requireAccess();if(!IASDPIAuth.isAdmin())throw Error('Acesso administrativo necessário.');
  if(!window.IASDPIOperational)throw Error('A lixeira exige persistência Supabase e a migração 004.');
  if(action==='trash-refresh'){trashState.detail=null;await refreshTrash();return;}
  if(action==='trash-open'){if(navigate('trash')===false)return;await refreshTrash();return;}
  if(action==='trash-detail'){trashState.detail=await trashRPC('iasdpi_trash_detail',{p_id:id});render();return;}
  if(action==='trash-close'){trashState.detail=null;render();return;}
  if(action==='trash-move'){
    const p=state.programs.find(row=>row.id===id);if(!p)throw Error('Atualize as programações antes de continuar.');
    if(!confirm(`Mover para a lixeira o culto “${p.plan.name}” de ${displayDate(p.plan.date)}?\nID: ${p.id}\nAs atividades e os horários serão preservados e poderão ser restaurados.`))return;
    const reason=prompt('Motivo da exclusão (opcional, até 2000 caracteres):','');if(reason===null)return;
    if(reason.length>2000)throw Error('O motivo deve ter até 2000 caracteres.');
    await trashChange('iasdpi_trash_program',p.id,p.version,reason);
    toast('Supabase confirmou: culto movido para a lixeira.');
  }else if(action==='trash-restore'){
    const row=trashState.detail?.id===id?trashState.detail:trashState.rows?.find(row=>row.id===id);
    if(!row)throw Error('Atualize a lixeira antes de continuar.');
    if(!confirm(`Restaurar “${row.document.plan.name}” de ${displayDate(row.document.plan.date)}?\nID: ${id}`))return;
    await trashChange('iasdpi_restore_program',id,row.version);
    toast('Supabase confirmou: culto restaurado nas programações.');
  }
}
async function trashChange(rpc,id,version,reason){
  const key=JSON.stringify([IASDPIAuth.session()?.user.id,rpc,id,version,reason]);
  const request=trashState.requests.get(key)||crypto.randomUUID();trashState.requests.set(key,request);
  await trashRPC(rpc,{p_id:id,p_expected_version:version,p_request_id:request,...(reason===undefined?{}:{p_reason:reason})});
  trashState.requests.delete(key);trashState.detail=null;
  state.programs=await api('programs');if(state.selected===id)state.selected=null;
  if(state.page==='trash')await refreshTrash();else render();
}
window.addEventListener('iasdpi-auth-changed',()=>{if(!IASDPIAuth.isAdmin()){trashState.rows=null;trashState.detail=null;trashState.error='';trashState.requests.clear();}});
