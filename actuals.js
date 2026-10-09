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
  return `<div class="actual-time-field">${field(label,name,value,'time',true,`step="1" aria-label="${label} da atividade ${index+1}"`)}<button type="button" data-action="time-now" data-field="${name}" aria-label="Preencher ${label.toLowerCase()} da atividade ${index+1} com a hora atual">Agora</button></div>`;
}
function transitions(p) {
  if(p.extra_events?.length)p={...p,...registrationData(p)};
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
  return `<div class="activity-details"><label>Observação<input name="activity-note" value="${esc(detail.note || '')}" maxlength="2000" placeholder="Observação da atividade" aria-label="Observação da atividade ${index+1}"></label><div><label>Responsável<select name="responsible-option" aria-label="Responsável da atividade ${index+1}"><option value="">Selecionar</option>${ministryOptions.map(name=>`<option value="${esc(name)}" ${responsible===name?'selected':''}>${esc(name)}</option>`).join('')}<option value="other" ${custom?'selected':''}>Outro responsável</option></select></label><input name="responsible-name" value="${esc(custom?responsible:'')}" maxlength="200" placeholder="Nome do responsável" aria-label="Nome do responsável da atividade ${index+1}" ${custom?'':'hidden'}></div></div>`;
}
function validateExtraEvents(p,input,finalize) {
  if(!Array.isArray(input)||input.length+p.plan.items.length>100)throw Error('Lista de eventos inválida ou maior que 100 atividades.');
  const ids=new Set(p.plan.items.map(i=>i.id)),positions=new Set();
  return input.map(e=>{
    if(!e || typeof e.id!=='string'||!e.id||e.id.length>200||ids.has(e.id)||!Number.isInteger(e.position)||e.position<0||e.position>=p.plan.items.length+input.length||positions.has(e.position))throw Error('Identificador ou posição de evento inválido.');
    ids.add(e.id);positions.add(e.position);
    for(const [name,limit] of [['activity',200],['note',2000],['responsible',200]])if(typeof e[name]!=='string'||e[name].length>limit)throw Error('Tema, observação ou responsável inválido.');
    if(!e.activity.trim())throw Error('Informe o tema do evento.');
    const valid=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v);
    if(typeof e.start!=='string'||typeof e.end!=='string'||(e.start&&!valid(e.start))||(e.end&&(!e.start||!valid(e.end)||timeSeconds(e.end)<timeSeconds(e.start))))throw Error('Informe horários reais válidos para o evento.');
    if(finalize&&(!e.start||!e.end))throw Error('Preencha os horários dos eventos fora da liturgia para finalizar.');
    return {id:e.id,position:e.position,activity:e.activity.trim(),start:e.start,end:e.end,note:e.note.trim(),responsible:e.responsible.trim()};
  });
}
function registrationData(p) {
  const plan=structuredClone(p?.plan || IASDPIChronogram), executions={...(p?.executions || {})};
  for(const extra of [...(p?.extra_events || [])].sort((a,b)=>a.position-b.position)){
    plan.items.splice(Math.min(extra.position,plan.items.length),0,{id:extra.id,activity:extra.activity,block:'Culto',unplanned:true});
    if(extra.start)executions[extra.id]={started:`${plan.date}T${extra.start.length===5?extra.start+':00':extra.start}-03:00`,ended:extra.end?`${plan.date}T${extra.end.length===5?extra.end+':00':extra.end}-03:00`:null};
  }
  return {plan,executions};
}
function actualRow(p,plan,i,index,executions) {
  const e=executions[i.id];
  const extra=(p?.extra_events || []).find(event=>event.id===i.id);
  const details=extra?{actual_details:{[i.id]:extra}}:p;
  return `<fieldset class="actual-row" data-id="${esc(i.id)}" ${i.unplanned?'data-extra="true"':`data-planned="${minutes('2000-01-01T'+i.end+':00','2000-01-01T'+i.start+':00')}"`}><legend><span class="actual-number">${index+1}</span>. ${esc(i.block)}</legend><div class="actual-description">${i.unplanned?field('Tema do evento','extra-theme',i.activity,'text',true,'maxlength="200" placeholder="Ex.: 4ª música — tema"'):`<h3>${esc(activityLabel(plan,index))}</h3>`}<span class="muted">Previsto: ${i.unplanned?'Fora da liturgia':esc(i.start)+' → '+(i.end_inferred?'não informado (referência: '+esc(i.end)+')':esc(i.end))}</span>${activityDetailsField(details,i,index)}</div><div class="actual-inputs">${actualTimeField('Início real','start',e?.started?actualClock(e.started):'',index)}${actualTimeField('Término real','end',e?.ended?actualClock(e.ended):'',index)}<output class="actual-difference muted">Aguardando horários</output></div><div class="actual-row-actions">${button('+ Adicionar evento após esta atividade','add-extra')}${i.unplanned?button('Remover evento','remove-extra','','class="danger-text"'):''}</div></fieldset>`;
}
function addExtraEvent(target) {
  const form=document.querySelector('#actuals-form'),rows=form.querySelectorAll('.actual-row');
  if(rows.length>=100)throw Error('Limite de 100 atividades por culto.');
  const item={id:crypto.randomUUID(),activity:'',block:'Culto',unplanned:true};
  const row=target.closest('.actual-row');
  const html=actualRow(null,{items:[item]},item,0,{});
  if(row)row.insertAdjacentHTML('afterend',html);else form.querySelector('.actuals-list').insertAdjacentHTML('beforeend',html);
  const added=row?row.nextElementSibling:form.querySelector('.actuals-list').lastElementChild;
  form.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);
  added.querySelector('[name="extra-theme"]').focus();updateActuals();
}
function extraEventsSummary(p) {
  if(!p.extra_events?.length)return '';
  return `<section class="section"><h2>Eventos fora da liturgia</h2><div class="table-scroll"><table><thead><tr><th>Tema</th><th>Horários reais</th><th>Responsável / observação</th></tr></thead><tbody>${p.extra_events.map(e=>`<tr><td>${esc(e.activity)}<small>Previsto: Fora da liturgia</small></td><td>${esc(e.start || '—')} → ${esc(e.end || '—')}</td><td>${esc(e.responsible)}${e.note?`<small>${esc(e.note)}</small>`:''}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function actualsForm(p) {
  const {plan,executions}=registrationData(p);
  return heading('REGISTRO DO CULTO', 'Registrar culto', `${esc(dateLabel(plan.date))} · ${esc(plan.name)}`, button('Voltar às programações','programs')) +
    `<section class="planned-bar"><span>Previsto <strong>${esc(plan.start)} → ${esc(plan.end)}</strong></span><span class="badge neutral">Registro manual</span></section>
    <details class="panel"><summary>Equipe da programação</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role==='Responsável pela programação'?'Ministração do Culto':role)}</dt><dd>${esc(plan.team[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>
    ${plan.items.some(i=>i.end_inferred) ? '<p class="form-note">O término dos anúncios não foi informado no cronograma. A referência de 10:05, início do próximo item, será usada apenas para comparar a duração. Os itens das 10:10 são simultâneos.</p>' : ''}
    <form id="actuals-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <div class="section-heading"><h2>O que aconteceu no culto?</h2><span id="actuals-progress" class="muted"></span></div>
      <p class="muted">Todos os horários de início e término são obrigatórios para finalizar (*). Responsável e observação são opcionais. Salvar registro permite guardar o preenchimento parcial e continuar depois.</p>
      <div class="actuals-list">${plan.items.map((i,index)=>actualRow(p,plan,i,index,executions)).join('')}</div>
      <div class="actions">${button('+ Adicionar evento fora da liturgia','add-extra')}</div>
      <div id="actual-transitions"></div>
      <section class="section"><h2>Observações</h2><div class="notes-grid"><div><label for="manual-note">Observações do culto</label><textarea id="manual-note" name="note" maxlength="5000" rows="3">${esc(p?.note || '')}</textarea></div><div><label for="manual-incident">Ocorrência não prevista</label><textarea id="manual-incident" name="incident" maxlength="5000" rows="3">${esc(p?.incident || '')}</textarea></div></div></section>
      <div class="actions manual-actions"><button type="submit" name="save" formnovalidate>Salvar registro</button><button type="submit" class="primary" name="finalize">Finalizar e ver resumo</button></div>
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
      else if(row.dataset.extra){completed++;output.textContent=`${duration(real)} realizados · Fora da liturgia`;}
      else{completed++;const diff=real-Number(row.dataset.planned);output.textContent=`${duration(real)} realizados · ${signed(diff)} de diferença`;output.className=`actual-difference ${statusTone(diff)}`;}
    }else output.textContent=end&&!start?'Informe o início real':start?'Falta o término real':'Aguardando horários';
  });
  const plan=structuredClone(selected()?.plan || window.IASDPIChronogram);
  plan.items=rows.map(row=>plan.items.find(i=>i.id===row.dataset.id)||{id:row.dataset.id,activity:row.querySelector('[name="extra-theme"]').value || 'Novo evento',unplanned:true});
  const executions=Object.fromEntries(rows.map(row=>[row.dataset.id,Object.fromEntries([['start','started'],['end','ended']].map(([name,key])=>{const v=row.querySelector(`[name="${name}"]`).value;return [key,v?`${plan.date}T${v.length===5?v+':00':v}-03:00`:null];}))]));
  document.querySelector('#actual-transitions').innerHTML=transitionView([{plan,executions}]);
  document.querySelector('#actuals-progress').textContent=`${completed} de ${rows.length} atividades completas`;
}
async function saveActuals(form, finalize) {
  const records=Object.fromEntries([...form.querySelectorAll('.actual-row')].map(row=>[row.dataset.id,{start:row.querySelector('[name="start"]').value,end:row.querySelector('[name="end"]').value,note:row.querySelector('[name="activity-note"]').value,responsible:row.querySelector('[name="responsible-option"]').value==='other'?row.querySelector('[name="responsible-name"]').value:row.querySelector('[name="responsible-option"]').value}]));
  for(const [id,record] of Object.entries(records)){
    const row=form.querySelector(`.actual-row[data-id="${CSS.escape(id)}"]`);
    if(row.dataset.extra && !row.querySelector('[name="extra-theme"]').value.trim())throw fieldError(row.querySelector('[name="extra-theme"]'),'Informe o tema do evento.');
    if(record.end && !record.start)throw fieldError(row.querySelector('[name="start"]'),'Informe o início real antes do término.');
    if(record.start && record.end && timeSeconds(record.end)<timeSeconds(record.start))throw fieldError(row.querySelector('[name="end"]'),'O término real não pode ser anterior ao início.');
    if(finalize && (!record.start || !record.end))throw fieldError(row.querySelector(record.start?'[name="end"]':'[name="start"]'),'Informe este horário para finalizar o culto.');
  }
  let p=selected();
  if(!form.dataset.id){
    p=await api('programs','POST',structuredClone(window.IASDPIChronogram));
    replaceProgram(p);form.dataset.id=p.id;form.dataset.version=p.version;
    window.history.replaceState(null,'',`#actuals/${p.id}`);
  }
  const extra_events=[...form.querySelectorAll('.actual-row')].flatMap((row,position)=>row.dataset.extra?[{id:row.dataset.id,position,activity:row.querySelector('[name="extra-theme"]').value.trim(),...records[row.dataset.id]}]:[]);
  for(const extra of extra_events)delete records[extra.id];
  p=await api(`programs/${form.dataset.id}/actuals`,'PUT',{version:Number(form.dataset.version),executions:records,extra_events,note:form.elements.note.value,incident:form.elements.incident.value,finalize});
  replaceProgram(p);navigate(finalize?'summary':'actuals',p.id);
  toast(finalize?'Culto registrado e finalizado. Resumo disponível.':'Registro salvo. Você pode continuar depois.');
}
