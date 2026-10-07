'use strict';
window.IASDPIChronogram = {
  name:'Culto de sábado', date:'2026-10-03', start:'09:30', end:'11:24', execution_mode:'manual',
  team:{'Ancião do mês':'Adriano','Recepção':'Nilce','Diácono':'Rafael Braga','Diaconisa':'Rose','Diretor de culto':'Elmo','Sonoplastia':'','Equipe de louvor':'','Responsável pela programação':'Elmo'},
  items:[
    ['09:30','09:35','Música Congregacional (sentados): 321 - Jesus é Melhor','Ministério de Louvor'],
    ['09:35','09:40','Música Congregacional (sentados): 344 - Confiarei','Ministério de Louvor'],
    ['09:40','09:45','Música Congregacional (em pé): 346 - Como Agradecer','Ministério de Louvor'],
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
  ].map(([start,end,activity,responsible],index) => ({id:`culto-03102026-${index+1}`,block:'Culto',start,end,activity,responsible,note:'',parallel:index===7 || index===8,end_inferred:index===5}))
};
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
        return `<fieldset class="actual-row" data-id="${esc(i.id)}" data-planned="${minutes(`2000-01-01T${i.end}:00`,`2000-01-01T${i.start}:00`)}"><legend>${index+1}. ${esc(i.block)}</legend><div class="actual-description"><h3>${esc(i.activity)}</h3><p>${esc(i.responsible || 'Responsável não informado')}</p><span class="muted">Previsto: ${esc(i.start)} → ${i.end_inferred?'não informado (referência: '+esc(i.end)+')':esc(i.end)}</span>${i.parallel?'<span class="badge neutral">Atividade simultânea · 10:10–10:15</span>':''}</div><div class="actual-inputs">${field('Início real','start',e?.started?clock(e.started):'','time',false,'aria-label="Início real da atividade '+(index+1)+'"')}${field('Término real','end',e?.ended?clock(e.ended):'','time',false,'aria-label="Término real da atividade '+(index+1)+'"')}<output class="actual-difference muted">Aguardando horários</output></div></fieldset>`;
      }).join('')}</div>
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
      const real=minutes(`2000-01-01T${end}:00`,`2000-01-01T${start}:00`);
      if(real<0){output.textContent='Término anterior ao início';output.className='actual-difference critical';}
      else{completed++;const diff=real-Number(row.dataset.planned);output.textContent=`${duration(real)} realizados · ${signed(diff)} de diferença`;output.className=`actual-difference ${statusTone(diff)}`;}
    }else output.textContent=end&&!start?'Informe o início real':start?'Falta o término real':'Aguardando horários';
  });
  document.querySelector('#actuals-progress').textContent=`${completed} de ${rows.length} atividades completas`;
}
async function saveActuals(form, finalize) {
  const records=Object.fromEntries([...form.querySelectorAll('.actual-row')].map(row=>[row.dataset.id,{start:row.querySelector('[name="start"]').value,end:row.querySelector('[name="end"]').value}]));
  for(const record of Object.values(records)){
    if(record.end && !record.start)throw Error('Informe o início real antes do término.');
    if(record.start && record.end && record.end<record.start)throw Error('O término real não pode ser anterior ao início.');
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
