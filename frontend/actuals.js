'use strict';
window.IASDPIChronogram = {
  name:'Culto de sábado', date:'2026-10-03', start:'09:30', end:'11:24', execution_mode:'manual',
  team:{'Ancião do mês':'Adriano','Recepção':'Nilce','Diácono':'Rafael Braga','Diaconisa':'Rose','Diretor de culto':'Elmo','Sonoplastia':'','Equipe de louvor':'','Responsável pela programação':'Elmo'},
  items:[
    ['09:30','09:35','Música Congregacional (sentados)','Ministério de Louvor'],
    ['09:35','09:40','Música Congregacional (sentados)','Ministério de Louvor'],
    ['09:40','09:45','Música Congregacional (em pé)','Ministério de Louvor'],
    ['09:45','09:50','Oração Intercessora (de joelhos)','Núbia'],
    ['09:50','10:00','Adoração Infantil','Pr. Carlos'],
    ['10:00','10:05','Anúncios/Comunicação','Henrique'],
    ['10:05','10:10','Provai e Vede (vídeo)','Ministério da Mordomia'],
    ['10:10','10:15','Tudo Vem de Ti','Ministério Louvor'],
    ['10:10','10:15','Ofertório','Alçar Ofertas'],
    ['10:15','10:17','Oração pelas Ofertas',''],
    ['10:17','10:22','Mensagem Musical','Priscilla'],
    ['10:22','11:05','Sermão','Gabriel Henrique'],
    ['11:05','11:10','Mensagem Musical','Priscilla'],
    ['11:10','11:15','Apelo e Oração Final','Gabriel Henrique'],
    ['11:15','11:20','Música Congregacional (em pé)','Ministério de Louvor'],
    ['11:20','11:22','Orientações sobre a Classe','Ministério de Louvor e/ou Ancianato'],
    ['11:22','11:24','Vídeo para a saída das pessoas','Sonoplastia']
  ].map(([start,end,activity,responsible],index) => ({id:`culto-03102026-${index+1}`,block:'Culto',start,end,activity,responsible,note:'',parallel:false,end_inferred:false})).filter(item=>item.id!=='culto-03102026-8')
};
// Atualiza o cronograma conhecido sem alterar os horários reais dos demais itens.
function updateCultoChronogram(p) {
  if(p.execution_mode!=='manual' || !p.plan.items.some(i=>i.id==='culto-03102026-1'))return false;
  let changed=false;
  p.plan.items=p.plan.items.filter(i=>{
    if(i.id==='culto-03102026-8' && i.activity==='Tudo Vem de Ti'){
      delete p.executions[i.id];changed=true;return false;
    }
    return true;
  });
  p.plan.items.forEach((i,index)=>{
    if(i.id==='culto-03102026-6' && (i.end_inferred || i.end!=='10:05')){
      i.end='10:05';i.end_inferred=false;
      i.planned_end=`${p.plan.date}T10:05:00-03:00`;changed=true;
    }
    if(i.id==='culto-03102026-9' && i.parallel){i.parallel=false;changed=true;}
    i.order=index+1;
  });
  return changed;
}
function actualClock(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', {timeZone:state.zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '';
}
const timeSeconds = value => value ? value.split(':').reduce((sum,part)=>sum*60+Number(part),0)*(value.length===5?60:1) : null;
function actualTimeField(label,name,value,index) {
  return `<div class="actual-time-field">${field(label,name,value,'time',false,`step="1" aria-label="${label} da atividade ${index+1}"`)}<button type="button" data-action="time-now" data-field="${name}" aria-label="Preencher ${label.toLowerCase()} da atividade ${index+1} com a hora atual">Agora</button></div>`;
}
function transitions(p) {
  const groups=[];
  for (const item of p.plan.items) {
    const previous=groups.at(-1);
    if(item.parallel && previous?.items[0].parallel && previous.items[0].start===item.start && previous.items[0].end===item.end)previous.items.push(item);
    else groups.push({items:[item]});
  }
  return groups.slice(1).map((group,index)=>{
    const prior=groups[index];
    const ends=prior.items.map(i=>p.executions[i.id]?.ended);
    const starts=group.items.map(i=>p.executions[i.id]?.started);
    const seconds=ends.every(Boolean)&&starts.every(Boolean)?(Math.min(...starts.map(v=>new Date(v).getTime()))-Math.max(...ends.map(v=>new Date(v).getTime())))/1000:null;
    return {from:prior.items.map(i=>i.activity).join(' / '),to:group.items.map(i=>i.activity).join(' / '),seconds};
  });
}
function transitionView(programs) {
  const rows=programs.flatMap(p=>transitions(p).filter(t=>t.seconds!==null).map(t=>({...t,event:p.plan.name})));
  return `<section class="section"><h2>Transição entre atividades</h2><p class="muted">Do término da atividade anterior ao início da próxima. Alerta acima de 30 segundos. Itens simultâneos formam um único grupo.</p>${rows.length?`<div class="table-scroll"><table><thead><tr><th>Evento</th><th>De → Para</th><th>Transição</th><th>Situação</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.event)}</td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${Math.abs(t.seconds)} s</td><td><span class="badge ${t.seconds>30?'critical':t.seconds<0?'warning':'good'}">${t.seconds>30?'Alerta: acima de 30 s':t.seconds<0?'Sobreposição':'Dentro de 30 s'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Preencha o término de uma atividade e o início da próxima para calcular a transição.</p>'}</section>`;
}
const ministryOptions=['Min. Louvor','Min. Mordomia','Min. Louvor e/ou Ancianato'];
function activityLabel(plan,index) {
  const name=plan.items[index].activity.replace(/^(Música Congregacional[^:]*):.*$/, '$1');
  if(!name.startsWith('Música Congregacional'))return name;
  const number=plan.items.slice(0,index+1).filter(i=>i.activity.startsWith('Música Congregacional')).length;
  return `${number}ª ${name}`;
}
function activityDetailsField(p,item,index) {
  const detail=p?.actual_details?.[item.id] || {};
  const defaultMinistry={'Ministério de Louvor':'Min. Louvor','Ministério Louvor':'Min. Louvor','Ministério da Mordomia':'Min. Mordomia','Ministério de Louvor e/ou Ancianato':'Min. Louvor e/ou Ancianato'}[item.responsible] || '';
  const responsible=detail.responsible ?? defaultMinistry;
  const custom=responsible && !ministryOptions.includes(responsible);
  return `<div class="activity-details"><label>Nota<input name="activity-note" value="${esc(detail.note || '')}" maxlength="2000" placeholder="Observação da atividade" aria-label="Nota da atividade ${index+1}"></label><div><label>Responsável<select name="responsible-option" aria-label="Responsável da atividade ${index+1}"><option value="">Selecionar</option>${ministryOptions.map(name=>`<option value="${esc(name)}" ${responsible===name?'selected':''}>${esc(name)}</option>`).join('')}<option value="other" ${custom?'selected':''}>Outro responsável</option></select></label><input name="responsible-name" value="${esc(custom?responsible:'')}" maxlength="200" placeholder="Nome do responsável" aria-label="Nome do responsável da atividade ${index+1}" ${custom?'':'hidden'}></div></div>`;
}
function actualsForm(p) {
  const plan=p?.plan || window.IASDPIChronogram;
  const executions=p?.executions || {};
  return heading('REGISTRO DO REALIZADO', 'Preencher realizado', `${esc(dateLabel(plan.date))} · ${esc(plan.name)}`, button('Voltar às programações','programs')) +
    `<section class="planned-bar"><span>Previsto <strong>${esc(plan.start)} → ${esc(plan.end)}</strong></span><span class="badge neutral">Registro manual</span></section>
    <details class="panel"><summary>Equipe da programação</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role==='Responsável pela programação'?'Ministração do Culto':role)}</dt><dd>${esc(plan.team[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>
    ${plan.items.some(i=>i.end_inferred) ? '<p class="form-note">O término dos anúncios não foi informado no cronograma. A referência de 10:05, início do próximo item, será usada apenas para comparar a duração. Os itens das 10:10 são simultâneos.</p>' : ''}
    <form id="actuals-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <div class="section-heading"><h2>O que aconteceu no culto?</h2><span id="actuals-progress" class="muted"></span></div>
      <p class="muted">Informe os horários reais, sem alterar o planejamento. Você pode salvar parcialmente e completar depois.</p>
      <div class="actuals-list">${plan.items.map((i,index)=>{
        const e=executions[i.id];
        return `<fieldset class="actual-row" data-id="${esc(i.id)}" data-planned="${minutes(`2000-01-01T${i.end}:00`,`2000-01-01T${i.start}:00`)}"><legend>${index+1}. ${esc(i.block)}</legend><div class="actual-description"><h3>${esc(activityLabel(plan,index))}</h3><span class="muted">Previsto: ${esc(i.start)} → ${i.end_inferred?'não informado (referência: '+esc(i.end)+')':esc(i.end)}</span>${i.parallel?'<span class="badge neutral">Atividade simultânea · 10:10–10:15</span>':''}${activityDetailsField(p,i,index)}</div><div class="actual-inputs">${actualTimeField('Início real','start',e?.started?actualClock(e.started):'',index)}${actualTimeField('Término real','end',e?.ended?actualClock(e.ended):'',index)}<output class="actual-difference muted">Aguardando horários</output></div></fieldset>`;
      }).join('')}</div>
      <div id="actual-transitions"></div>
      <section class="section"><h2>Observações</h2><div class="notes-grid"><div><label for="manual-note">Observações do culto</label><textarea id="manual-note" name="note" maxlength="5000" rows="3">${esc(p?.note || '')}</textarea></div><div><label for="manual-incident">Ocorrência não prevista</label><textarea id="manual-incident" name="incident" maxlength="5000" rows="3">${esc(p?.incident || '')}</textarea></div></div></section>
      <div class="actions manual-actions"><button type="submit" class="primary" name="save">Salvar realizado</button><button type="submit" name="finalize">Finalizar e ver resumo</button></div>
    </form>`;
}
function updateActuals() {
  const form=document.querySelector('#actuals-form');if(!form)return;
  let completed=0;
  const rows=[...form.querySelectorAll('.actual-row')];
  rows.forEach(row=>{
    const start=row.querySelector('[name="start"]').value, end=row.querySelector('[name="end"]').value;
    const output=row.querySelector('output');output.className='actual-difference muted';
    if(start && end){
      const real=(timeSeconds(end)-timeSeconds(start))/60;
      if(real<0){output.textContent='Término anterior ao início';output.className='actual-difference critical';}
      else{completed++;const diff=real-Number(row.dataset.planned);output.textContent=`${duration(real)} realizados · ${signed(diff)} de diferença`;output.className=`actual-difference ${statusTone(diff)}`;}
    }else output.textContent=end&&!start?'Informe o início real':start?'Falta o término real':'Aguardando horários';
  });
  const plan=selected()?.plan || window.IASDPIChronogram;
  const executions=Object.fromEntries(rows.map(row=>[row.dataset.id,Object.fromEntries([['start','started'],['end','ended']].map(([name,key])=>{const v=row.querySelector(`[name="${name}"]`).value;return [key,v?`${plan.date}T${v.length===5?v+':00':v}-03:00`:null];}))]));
  document.querySelector('#actual-transitions').innerHTML=transitionView([{plan,executions}]);
  document.querySelector('#actuals-progress').textContent=`${completed} de ${rows.length} atividades completas`;
}
async function saveActuals(form, finalize) {
  const records=Object.fromEntries([...form.querySelectorAll('.actual-row')].map(row=>[row.dataset.id,{start:row.querySelector('[name="start"]').value,end:row.querySelector('[name="end"]').value,note:row.querySelector('[name="activity-note"]').value,responsible:row.querySelector('[name="responsible-option"]').value==='other'?row.querySelector('[name="responsible-name"]').value:row.querySelector('[name="responsible-option"]').value}]));
  for(const record of Object.values(records)){
    if(record.end && !record.start)throw Error('Informe o início real antes do término.');
    if(record.start && record.end && timeSeconds(record.end)<timeSeconds(record.start))throw Error('O término real não pode ser anterior ao início.');
    if(finalize && (!record.start || !record.end))throw Error('Preencha início e término de todas as atividades para finalizar.');
  }
  let p=selected();
  if(!form.dataset.id){
    p=await api('programs','POST',structuredClone(window.IASDPIChronogram));
    replaceProgram(p);form.dataset.id=p.id;form.dataset.version=p.version;
    window.history.replaceState(null,'',`#actuals/${p.id}`);
  }
  p=await api(`programs/${form.dataset.id}/actuals`,'PUT',{version:Number(form.dataset.version),executions:records,note:form.elements.note.value,incident:form.elements.incident.value,finalize});
  replaceProgram(p);navigate(finalize?'summary':'actuals',p.id);
  toast(finalize?'Realizado finalizado. Resumo disponível.':'Realizado salvo. Você pode continuar depois.');
}
