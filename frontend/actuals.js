'use strict';
// Carregado somente por uma fonte autorizada, nunca incluído no HTML público.
window.IASDPIChronogram = null;
function cultoForDate(template,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!recordDay(date))throw Error('Selecione uma data válida para o culto.');
  const plan=structuredClone(template);plan.date=date;
  plan.name=plan.name.replace(/03\/10\/2026|2026-10-03/g,'').replace(/\s*[·—-]\s*$/,'').trim()||'Culto de sábado';
  for(const item of plan.items){delete item.planned_start;delete item.planned_end;}
  delete plan.planned_start;delete plan.planned_end;
  return plan;
}
function correctedCultoDate(original){
  if(original.execution_mode!=='manual'||original.plan.date!=='2026-10-03')throw Error('Este registro não corresponde à correção de 03/10 para 10/10/2026.');
  backupValidate({format:'IASDPI-backup',version:1,programs:[original]});
  const p=structuredClone(original),zone='America/Sao_Paulo';
  const shift=value=>{
    if(value==null)return value;
    if(typeof value!=='string'||!Number.isFinite(new Date(value).getTime()))throw Error('Há um horário inválido; nada será alterado.');
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date(value));
    if(day==='2026-10-10')return value;
    if(day!=='2026-10-03')throw Error('Há horários em outra data. Revise o registro antes de corrigir; nada foi alterado.');
    const prefix=new Date(new Date(value.slice(0,10)+'T12:00:00Z').getTime()+7*86400000).toISOString().slice(0,10);
    return prefix+value.slice(10);
  };
  p.plan.date='2026-10-10';
  p.plan.name=p.plan.name.replace(/03\/10\/2026/g,'10/10/2026').replace(/2026-10-03/g,'2026-10-10');
  for(const field of ['planned_start','planned_end'])if(p[field]!=null)p[field]=shift(p[field]);
  for(const item of p.plan.items)for(const field of ['planned_start','planned_end'])if(item[field]!=null)item[field]=shift(item[field]);
  for(const execution of Object.values(p.executions))for(const field of ['started','ended'])if(execution[field]!=null)execution[field]=shift(execution[field]);
  return p;
}
let cultoTemplates=[
  {id:'liturgy-i',label:'Liturgia I — Padrão',source:'chronogram',name:'Culto · Liturgia I'},
  {id:'free',label:'Livre — Sem atividades',source:null,name:'Culto livre'}
];
function saoPauloToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());}
async function draftFromTemplate(id){
  const model=cultoTemplates.find(model=>model.id===id);if(!model)throw Error('Selecione um modelo válido.');
  const date=saoPauloToday();
  const draft=window.IASDPIOperational?cultoForDate(await api('templates/'+id),date):model.source?cultoForDate(await api(model.source),date):{date,start:'',end:'',items:[],team:{}};
  return {...draft,name:model.name,template_id:model.id,execution_mode:'manual'};
}
function newCultoForm(){
  return heading('REGISTRO DO CULTO','Registro do Culto','Escolha um modelo e crie um registro com a data atual de São Paulo. A data poderá ser alterada.')+
    `<form id="new-record-form" class="panel"><label>Modelo da programação<select name="template-id">${cultoTemplates.map(model=>`<option value="${model.id}">${esc(model.label)}</option>`).join('')}</select></label><button class="primary" type="submit">Novo registro</button></form>`+
    `${state.programs.some(p=>p.execution_mode==='manual')?`<form id="open-record-form" class="panel"><label>Registro existente<select name="record-id">${state.programs.filter(p=>p.execution_mode==='manual').map(p=>`<option value="${esc(p.id)}">${esc(p.plan.name)} · ${esc(displayDate(p.plan.date))}</option>`).join('')}</select></label><button type="submit">Editar registro</button></form>`:''}`;
}
function actualClock(value) {
  const parsed=inspectRecordTime(value);return parsed.valid?parsed.clock.slice(0,8):'';
}
// Frações antigas são preservadas no dado; a interface sempre mostra HH:mm:ss.
const validActualTime=validRecordClock;
const displayActualTime=value=>{const parsed=inspectRecordTime(value);return parsed.empty?'':parsed.valid?parsed.clock.slice(0,8):String(value);};
const timeSeconds=value=>value?value.split(':').reduce((sum,part)=>sum*60+Number(part),0)*(value.length===5?60:1):null;
function storedActualClock(value){return recordClock(value);}
function actualRecordTimes(p,id){
  const extra=p?.extra_events?.find(e=>e.id===id),e=p?.executions?.[id];
  return extra?{...extra,start:recordClock(extra.start,p?.plan?.date),end:recordClock(extra.end,p?.plan?.date)}:{start:recordClock(e?.started,p?.plan?.date),end:recordClock(e?.ended,p?.plan?.date)||recordClock(p?.actual_details?.[id]?.partial_end,p?.plan?.date)};
}
function readActualTime(input,previous=''){
  const value=input.value.trim();
  if(input.dataset.timeEdited!=='true'&&validRecordClock(input.dataset.conflictClock)&&value===displayActualTime(input.dataset.conflictClock))return input.dataset.conflictClock;
  if(input.dataset.timeEdited!=='true'&&value===displayActualTime(previous)){
    const day=tryReadDate(input.closest('form')?.elements['record-date']?.value||'');
    if(importedTimeWarning(previous)||((!day||day===input.dataset.originalDay)&&importedTimeWarning(input.dataset.originalTime,day)))throw fieldError(input,'Corrija o horário importado inválido antes de salvar.');
    return previous;
  }
  if(value&&!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value))throw fieldError(input,'Use o formato 24 horas HH:mm:ss, com segundos (ex.: 14:05:35).');
  return displayActualTime(value);
}
function actualTimeField(label,name,value,index=0,day,context=`atividade ${index+1}`) {
  const warning=importedTimeWarning(value,day),warningId='time-warning-'+crypto.randomUUID();
  const control=field(label,name,displayActualTime(value),'text',false,`maxlength="8" placeholder="HH:mm:ss" inputmode="text" data-real-time="true" data-original-time="${esc(value??'')}" data-original-day="${esc(recordDay(day))}" autocomplete="off" aria-label="${label} — ${context}" ${warning?`aria-invalid="true" aria-describedby="${warningId}"`:''}`);
  return `<div class="actual-time-field">${control.replace('</label>',`${warning?`<span class="field-error" id="${warningId}" role="alert">${esc(warning)}</span>`:''}</label>`)}<button type="button" data-action="time-now" data-field="${name}" aria-label="Preencher ${label.toLowerCase()} — ${context} com a hora atual">Agora</button></div>`;
}
function transitions(p) {
  const original=p,day=recordDay(p.plan.date);
  const edge=(item,key)=>{
    const extra=original.extra_events?.find(e=>e.id===item.id);
    const raw=extra?{started:extra.start,ended:extra.end}:original.executions?.[item.id]||{};
    const parsed=inspectRecordTime(raw[key],day);
    return recordInterval(raw.started,raw.ended,day).state==='invalid'||!day||parsed.day!==day?null:parsed.epoch;
  };
  p=programForMetrics(p);
  if(p.extra_events?.length)p={...p,...registrationData(p)};
  const groups=[];
  for (const item of p.plan.items) {
    const previous=groups.at(-1);
    if(item.parallel && previous?.items[0].parallel && previous.items[0].start===item.start && previous.items[0].end===item.end)previous.items.push(item);
    else groups.push({items:[item]});
  }
  return groups.slice(1).map((group,index)=>{
    const prior=groups[index];
    const ends=prior.items.map(i=>edge(i,'ended'));
    const starts=group.items.map(i=>edge(i,'started'));
    const seconds=ends.every(v=>v!==null&&Number.isFinite(v))&&starts.every(v=>v!==null&&Number.isFinite(v))?(Math.min(...starts)-Math.max(...ends))/1000:null;
    return {from:prior.items.map(i=>i.activity).join(' / '),to:group.items.map(i=>i.activity).join(' / '),seconds};
  });
}
function transitionView(programs) {
  const all=programs.flatMap(p=>transitions(p).map(t=>({...t,event:p.plan.name}))),rows=all.filter(t=>t.seconds!==null&&Number.isFinite(t.seconds));
  return `<section class="section"><h2>Transição entre atividades</h2><p class="muted">Do término da atividade anterior ao início da próxima. Alerta acima de 30 segundos. Itens simultâneos formam um único grupo. ${rows.length} transições consideradas; ${all.length-rows.length} desconsideradas por horários ausentes ou inválidos.</p>${rows.length?`<div class="table-scroll"><table><thead><tr><th>Evento</th><th>De → Para</th><th>Transição</th><th>Situação</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.event)}</td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${Math.round(Math.abs(t.seconds))} s</td><td><span class="badge ${t.seconds>30?'critical':t.seconds<0?'warning':'good'}">${t.seconds>30?'Alerta: acima de 30 s':t.seconds<0?'Sobreposição':'Dentro de 30 s'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Preencha o término de uma atividade e o início da próxima para calcular a transição.</p>'}</section>`;
}
const ministryOptions=['Min. Louvor','Min. Mordomia','Min. Louvor e/ou Ancianato'];
function activityLabel(plan,index) {
  const name=String(plan.items[index].activity||'Atividade sem título').replace(/^(Música Congregacional[^:]*):.*$/, '$1');
  if(!name.startsWith('Música Congregacional'))return name;
  const number=plan.items.slice(0,index+1).filter(i=>String(i.activity||'').startsWith('Música Congregacional')).length;
  return `${number}ª ${name}`;
}
function activityDetailsField(p,item,index) {
  const detail=p?.actual_details?.[item.id] || {};
  const defaultMinistry={'Ministério de Louvor':'Min. Louvor','Ministério Louvor':'Min. Louvor','Ministério da Mordomia':'Min. Mordomia','Ministério de Louvor e/ou Ancianato':'Min. Louvor e/ou Ancianato'}[item.responsible] || '';
  const responsible=detail.responsible ?? (defaultMinistry || item.responsible || '');
  const custom=responsible && !ministryOptions.includes(responsible);
  return `<div class="activity-details"><label>Observação<textarea name="activity-note" maxlength="2000" rows="1" placeholder="Observação da atividade" aria-label="Observação da atividade ${index+1}">${esc(detail.note ?? item.note ?? '')}</textarea></label><div><label>Responsável<select name="responsible-option" aria-label="Responsável da atividade ${index+1}"><option value="">Selecionar</option>${ministryOptions.map(name=>`<option value="${esc(name)}" ${responsible===name?'selected':''}>${esc(name)}</option>`).join('')}<option value="other" ${custom?'selected':''}>Outro responsável</option></select></label><input name="responsible-name" value="${esc(custom?responsible:'')}" maxlength="200" placeholder="Nome do responsável" aria-label="Nome do responsável da atividade ${index+1}" ${custom?'':'hidden'}></div></div>`;
}
function validateExtraEvents(p,input,finalize) {
  if(!Array.isArray(input)||input.length+p.plan.items.length>100)throw Error('Lista de eventos inválida ou maior que 100 atividades.');
  const ids=new Set(p.plan.items.map(i=>i.id)),positions=new Set();
  return input.map(e=>{
    if(!e || typeof e.id!=='string'||!e.id||e.id.length>200||ids.has(e.id)||!Number.isInteger(e.position)||e.position<0||e.position>=p.plan.items.length+input.length||positions.has(e.position))throw Error('Identificador ou posição de evento inválido.');
    ids.add(e.id);positions.add(e.position);
    for(const [name,limit] of [['activity',200],['note',2000],['responsible',200]])if(typeof e[name]!=='string'||e[name].length>limit)throw Error('Tema, observação ou responsável inválido.');
    if(!e.activity.trim())throw Error('Informe o tema do evento.');
    const valid=validActualTime;
    if(typeof e.start!=='string'||typeof e.end!=='string'||(e.start&&!valid(e.start))||(e.end&&(!valid(e.end)||(e.start&&timeSeconds(e.end)<timeSeconds(e.start)))))throw Error('Informe horários reais válidos para o evento.');
    const detail=validateActivityRecord(e,e.id);
    if(finalize&&(!e.start||!e.end))throw Error('Resolva os eventos extras antigos antes de finalizar.');
    return {...e,...detail,activity:e.activity,note:e.note,responsible:e.responsible};
  });
}
function registrationData(p) {
  const view=p?programForMetrics(p):{plan:IASDPIChronogram,executions:{}};
  const plan=structuredClone(view.plan),executions={...view.executions};
  for(const extra of [...(p?.extra_events || [])].sort((a,b)=>a.position-b.position)){
    plan.items.splice(Math.min(extra.position,plan.items.length),0,{id:extra.id,activity:extra.activity,block:'Culto',unplanned:true});
    if(extra.start)executions[extra.id]={started:inspectRecordTime(extra.start,recordDay(plan.date)).iso,ended:inspectRecordTime(extra.end,recordDay(plan.date)).iso};
  }
  return {plan,executions};
}
function actualRow(p,plan,i,index,executions) {
  const e=executions[i.id];
  const extra=(p?.extra_events || []).find(event=>event.id===i.id);
  const details=extra?{actual_details:{[i.id]:extra}}:p;
  return `<fieldset class="actual-row" data-id="${esc(i.id)}" ${i.unplanned?'data-extra="true"':`data-planned="${(validActualTime(i.start)&&validActualTime(i.end)?(timeSeconds(i.end)-timeSeconds(i.start))/60:'')}"`}><legend><span class="actual-number">${index+1}</span>. ${esc(i.block)}</legend><div class="actual-description">${i.unplanned?field('Tema do evento','extra-theme',i.activity,'text',true,'maxlength="200" placeholder="Ex.: 4ª música — tema"'):`<h3>${esc(activityLabel(plan,index))}</h3>`}<span class="muted">Previsto: ${i.unplanned?'Fora da liturgia':esc(displayPlannedTime(i.start))+' → '+(i.end_inferred?'não informado (referência: '+esc(displayPlannedTime(i.end))+')':esc(displayPlannedTime(i.end)))}</span>${activityDetailsField(details,i,index)}</div><div class="actual-inputs">${actualTimeField('Início real','start',extra?.start??p?.executions?.[i.id]?.started??'',index,plan.date)}${actualTimeField('Término real','end',extra?.end??p?.executions?.[i.id]?.ended??p?.actual_details?.[i.id]?.partial_end??'',index,plan.date)}<output class="actual-difference muted">Aguardando horários</output></div><div class="actual-row-actions">${button('Adicionar subatividade','add-subactivity')}${i.unplanned?button('Remover evento','remove-extra','','class="danger-text"'):''}</div><div class="subactivities" aria-label="Subatividades de ${esc(i.activity)}">${(details?.actual_details?.[i.id]?.subactivities||[]).map(child=>subactivityRow(child,i.id,plan.date)).join('')}</div></fieldset>`;
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
function summaryActivityRows(p){
  const {plan,executions}=registrationData(p);
  return plan.items.map((i,index)=>{
    const e=executions[i.id],extra=p.extra_events?.find(x=>x.id===i.id),details=extra||p.actual_details?.[i.id]||{};
    const source=extra?{started:extra.start,ended:extra.end}:p.executions?.[i.id]||{};
    const actual=recordInterval(source.started,source.ended??details.partial_end,recordDay(p.plan.date));
    const planned=i.unplanned?null:recordInterval(i.planned_start,i.planned_end,recordDay(p.plan.date)).minutes,real=actual.minutes;
    return `<tr><td>${esc(activityLabel(plan,index))}${i.unplanned?'<small>Fora da liturgia</small>':''}<small>${esc(details.responsible??i.responsible??'')}</small>${details.note?`<small>${esc(details.note)}</small>`:''}${subactivitiesSummary(details)}</td><td>${i.unplanned?'Fora da liturgia':esc(displayPlannedTime(i.start))+' → '+esc(displayPlannedTime(i.end))}</td><td>${displayActualTime(actualClock(e?.started))||'—'} → ${displayActualTime(actualClock(e?.ended))||'—'}</td><td>${planned===null?'—':duration(planned)}</td><td>${real===null?'—':duration(real)}</td><td>${real===null||planned===null?'—':badge(real-planned,signed(real-planned))}</td></tr>`;
  }).join('');
}
function extraEventsSummary(p) {
  if(!p.extra_events?.length)return '';
  return `<section class="section"><h2>Eventos fora da liturgia</h2><div class="table-scroll"><table><thead><tr><th>Tema</th><th>Horários reais</th><th>Responsável / observação</th></tr></thead><tbody>${p.extra_events.map(e=>`<tr><td>${esc(e.activity)}<small>Previsto: Fora da liturgia</small></td><td>${esc(displayActualTime(e.start) || '—')} → ${esc(displayActualTime(e.end) || '—')}</td><td>${esc(e.responsible)}${e.note?`<small>${esc(e.note)}</small>`:''}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function actualsForm(p) {
  if(!p&&!window.IASDPIChronogram)return newCultoForm();
  const {plan,executions}=registrationData(p);
  return heading('REGISTRO DO CULTO', 'Registrar culto', `${esc(dateLabel(plan.date))} · ${esc(plan.name)}`, `<div class="actions">${p?button('Editar registro','edit-record',p.id):''}${!p||['Planejamento','Pronta'].includes(p.status)?button('Editar programação prevista','edit-record-plan',p?.id||''):''}${button('Voltar às programações','programs')}</div>`) +
    `<section class="planned-bar"><span>Previsto <strong>${esc(displayPlannedTime(plan.start||'—'))} → ${esc(displayPlannedTime(plan.end||'—'))}</strong></span><span class="badge neutral">Registro manual</span></section>
    <details class="panel"><summary>Equipe da programação</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role==='Responsável pela programação'?'Ministração do Culto':role)}</dt><dd>${esc((plan.team||{})[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>
    ${plan.items.some(i=>i.end_inferred) ? '<p class="form-note">O término dos anúncios não foi informado no cronograma. A referência de 10:05, início do próximo item, será usada apenas para comparar a duração. Os itens das 10:10 são simultâneos.</p>' : ''}
    <form id="actuals-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="registration-savebar" data-state="${p?'saved':'dirty'}" role="region" aria-label="Salvar registro do culto">
        <p id="registration-save-status" role="status" aria-live="polite" aria-atomic="true">${p?(window.IASDPIOperational?'Registro existente · salvo no Supabase.':window.IASDPIDemo?'Registro existente · salvo neste navegador.':'Registro existente · salvo no servidor local.'):'Novo registro · ainda não salvo.'}</p>
        <button type="submit" name="save" formnovalidate class="primary">Salvar alterações</button>
      </section>
      <div class="notes-grid">${field('Nome do culto','record-name',plan.name,'text',true,'maxlength="200"')}${field('Data do culto','record-date',plan.date,'date',true)}${!recordDay(plan.date)?'<span class="field-error" role="alert">Data importada inválida. Informe a data do culto para salvar.</span>':''}</div>

      <div class="section-heading"><h2>O que aconteceu no culto?</h2><span id="actuals-progress" class="muted"></span></div>
      <p class="muted">Para finalizar, preencha início e término de cada atividade no formato 24 horas HH:mm:ss. Durante o culto, os horários podem ficar em branco. Subatividades não alteram o planejamento nem somam duração. Responsável e observação são opcionais. Salvar registro permite guardar o preenchimento parcial e continuar depois.</p>
      <div class="actuals-list">${plan.items.map((i,index)=>actualRow(p,plan,i,index,executions)).join('')}</div>

      <div id="actual-transitions"></div>
      <section class="section"><h2>Observações</h2><div class="notes-grid"><div><label for="manual-note">Observações do culto</label><textarea id="manual-note" name="note" maxlength="5000" rows="3">${esc(p?.note || '')}</textarea></div><div><label for="manual-incident">Ocorrência não prevista</label><textarea id="manual-incident" name="incident" maxlength="5000" rows="3">${esc(p?.incident || '')}</textarea></div></div></section>
      <section class="section"><label>Informações complementares<textarea name="record-info" rows="2" maxlength="5000">${esc(p?.record_info||'')}</textarea></label></section>
      <div class="actions manual-actions">${button('Cancelar edição','cancel-record',p?.id||'')}<button type="submit" class="primary" name="finalize">Finalizar e ver resumo</button></div>
    </form>`;
}
function updateActuals() {
  const form=document.querySelector('#actuals-form');if(!form)return;
  refreshSubactivityLabels();
  let completed=0;
  const rows=[...form.querySelectorAll('.actual-row')];
  rows.forEach(row=>{
    const start=row.querySelector('[name="start"]').value, end=row.querySelector('[name="end"]').value;
    const output=row.querySelector('output');output.className='actual-difference muted';
    if(start && end && validActualTime(start) && validActualTime(end)){
      const real=(timeSeconds(end)-timeSeconds(start))/60;
      if(real<0){output.textContent='Término anterior ao início';output.className='actual-difference critical';}
      else if(row.dataset.extra){completed++;output.textContent=`${duration(real)} realizados · Fora da liturgia`;}
      else if(row.dataset.planned===''){output.textContent='Horário previsto inconsistente. Revise a programação.';}
      else{completed++;const diff=real-Number(row.dataset.planned);output.textContent=`${duration(real)} realizados · ${signed(diff)} de diferença`;output.className=`actual-difference ${statusTone(diff)}`;}
    }else output.textContent=end&&!start?'Informe o início real':start?'Falta o término real':'Aguardando horários';
  });
  const originalPlan=selected()?.plan || window.IASDPIChronogram;if(!originalPlan)return;
  const plan=structuredClone(originalPlan);plan.date=tryReadDate(form.elements['record-date'].value)||plan.date;
  plan.items=rows.map(row=>plan.items.find(i=>i.id===row.dataset.id)||{id:row.dataset.id,activity:row.querySelector('[name="extra-theme"]').value || 'Novo evento',unplanned:true});
  const executions=Object.fromEntries(rows.map(row=>[row.dataset.id,Object.fromEntries([['start','started'],['end','ended']].map(([name,key])=>{const v=row.querySelector(`[name="${name}"]`).value;return [key,v&&validActualTime(v)?inspectRecordTime(v,recordDay(plan.date)).iso:null];}))]));
  document.querySelector('#actual-transitions').innerHTML=transitionView([{plan,executions}]);
  document.querySelector('#actuals-progress').textContent=`${completed} de ${rows.length} atividades completas`;
  refreshScrollableTables();
}
async function saveActuals(form,finalize,draftSave=window.IASDPIDrafts?.beginSave(form)){
  let p=state.programs.find(record=>record.id===form.dataset.id)||null;
  const base=p||{plan:window.IASDPIChronogram};
  const date=readDateField(form.elements['record-date']);
  let recordPlan;try{recordPlan=recordEditPlan(base,{record_name:form.elements['record-name'].value,record_date:date});}
  catch(error){throw fieldError(form.elements['record-name'],error.message);}
  if(finalize&&!recordPlan.items.length)throw Error('Adicione atividades na edição da programação prevista antes de finalizar.');
  const records={},extra_events=[];
  const rows=[...form.querySelectorAll('.actual-row')];
  for(const [position,row] of rows.entries()){
    const id=row.dataset.id,previous=actualRecordTimes(p,id);
    for(const title of row.querySelectorAll('.subactivity [name="sub-title"]'))if(!title.value.trim())throw fieldError(title,'Informe o título da subatividade.');
    const subactivities=[...row.querySelectorAll('.subactivity')].map(child=>({...((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)||{}),id:child.dataset.subId,parent_id:child.dataset.parentId,title:child.querySelector('[name="sub-title"]').value,responsible:child.querySelector('[name="sub-responsible"]').value,note:child.querySelector('[name="sub-note"]').value,start:readActualTime(child.querySelector('[name="sub-start"]'),recordClock((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)?.start,p?.plan?.date)),end:readActualTime(child.querySelector('[name="sub-end"]'),recordClock((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)?.end,p?.plan?.date))}));
    let record={start:readActualTime(row.querySelector('[name="start"]'),previous.start),end:readActualTime(row.querySelector('[name="end"]'),previous.end),note:row.querySelector('[name="activity-note"]').value,responsible:row.querySelector('[name="responsible-option"]').value==='other'?row.querySelector('[name="responsible-name"]').value:row.querySelector('[name="responsible-option"]').value,subactivities};
    if(record.start&&record.end&&timeSeconds(record.end)<timeSeconds(record.start))throw fieldError(row.querySelector('[name="end"]'),'O término real não pode ser anterior ao início.');
    record=validateActivityRecord(record,id);
    if(finalize&&(!record.start||!record.end))throw fieldError(row.querySelector(record.start?'[name="end"]':'[name="start"]'),'Preencha início e término desta atividade para finalizar.');
    if(row.dataset.extra){
      const previous=p?.extra_events?.find(e=>e.id===id)||{};
      extra_events.push({...previous,id,position,activity:row.querySelector('[name="extra-theme"]').value,...record});
    }else records[id]=record;
  }
  // Todas as validações precedem a criação de um registro novo.
  validateExtraEvents({plan:recordPlan},extra_events,finalize);
  if(!form.dataset.id){
    p=await api('programs','POST',{...structuredClone(window.IASDPIChronogram),name:recordPlan.name,date:recordPlan.date});
    replaceProgram(p);state.selected=p.id;form.dataset.id=p.id;form.dataset.version=p.version;
    await window.IASDPIDrafts?.bind(form,p,draftSave?.context);
    IASDPINavigation.identify('actuals',p.id);
  }
  p=await api(`programs/${form.dataset.id}/actuals`,'PUT',{version:Number(form.dataset.version),executions:records,extra_events,record_name:recordPlan.name,record_date:recordPlan.date,record_info:form.elements['record-info'].value,note:form.elements.note.value,incident:form.elements.incident.value,finalize});
  const newer=await window.IASDPIDrafts?.saved(draftSave,p);
  if(!newer)registrationDirty=false;
  const stillEditing=form.isConnected,previousSelected=state.selected;replaceProgram(p);
  if(!stillEditing)state.selected=previousSelected;else if(!newer)navigate(finalize?'summary':'actuals',p.id,{replace:!finalize,refresh:true});
  const message=window.IASDPIOperational?'Alterações confirmadas e salvas no Supabase.':window.IASDPIDemo?'Alterações salvas neste navegador. Nenhuma gravação na nuvem.':'Alterações salvas no servidor local.';
  const currentForm=stillEditing&&!newer&&!finalize?document.querySelector('#actuals-form'):form;
  setRegistrationSaveState(currentForm,newer?'dirty':'saved',newer?'Envio confirmado. Alterações mais recentes continuam em rascunho local.':message);
  toast(message);
}
let registrationDirty=false;
function validateSubactivities(input,parentId,start,end){
  if(!Array.isArray(input)||input.length>50)throw Error('Limite de 50 subatividades por atividade.');
  const ids=new Set();const valid=validActualTime;
  return input.map(s=>{
    if(!s||typeof s.id!=='string'||!s.id||s.id.length>200||ids.has(s.id)||s.parent_id!==parentId)throw Error('Vínculo de subatividade inválido.');ids.add(s.id);
    for(const [key,limit] of [['title',200],['responsible',200],['note',2000]])if(typeof s[key]!=='string'||s[key].length>limit)throw Error('Dados da subatividade inválidos.');
    if(!s.title.trim())throw Error('Informe o título da subatividade.');
    if(typeof s.start!=='string'||typeof s.end!=='string'||(s.start&&!valid(s.start))||(s.end&&!valid(s.end)))throw Error('Horários da subatividade inválidos.');
    if((s.start||s.end)&&(!start||!end))throw Error('Preencha o intervalo real completo da atividade principal antes de informar horários da subatividade.');
    if((s.start&&(timeSeconds(s.start)<timeSeconds(start)||timeSeconds(s.start)>timeSeconds(end)))||(s.end&&(timeSeconds(s.end)<timeSeconds(start)||timeSeconds(s.end)>timeSeconds(end)))||(s.start&&s.end&&timeSeconds(s.end)<timeSeconds(s.start)))throw Error('Os horários da subatividade devem ficar dentro do intervalo real da atividade principal.');
    return {...s};
  });
}
function validateActivityRecord(record,id){
  if(record.partial_end!==undefined&&(typeof record.partial_end!=='string'||(record.partial_end&&!validActualTime(record.partial_end))))throw Error('Horário parcial inválido.');
  if((record.start&&!validActualTime(record.start))||(record.end&&!validActualTime(record.end)))throw Error('Horários reais inválidos.');
  if(record.start&&record.end&&timeSeconds(record.end)<timeSeconds(record.start))throw Error('Término anterior ao início.');
  const subactivities=validateSubactivities(record.subactivities??[],id,record.start,record.end);
  return {...record,subactivities};
}
function recordEditPlan(p,body){
  const plan=structuredClone(p.plan),date=recordDay(body.record_date??plan.date),name=body.record_name??plan.name;
  plan.start=plannedClock(plan.start);plan.end=plannedClock(plan.end);
  for(const item of plan.items){item.start=plannedClock(item.start);item.end=plannedClock(item.end);}
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!recordDay(date))throw Error('Data do culto inválida.');
  if(typeof name!=='string'||!name.trim()||name.length>200)throw Error('Nome do culto inválido.');
  if(date!==plan.date)for(const item of plan.items){item.planned_start=recordInstant(date,item.start);item.planned_end=recordInstant(date,item.end);}
  plan.date=date;plan.name=name===p.plan.name?name:name.trim();return plan;
}
function subactivityRow(s={},parentId,day){
  return `<fieldset class="subactivity" data-sub-id="${esc(s.id||crypto.randomUUID())}" data-parent-id="${esc(s.parent_id??parentId)}"><legend>Subatividade</legend><div class="notes-grid">${field('Título','sub-title',s.title||'','text',true,'maxlength="200"')}${field('Responsável','sub-responsible',s.responsible||'','text',false,'maxlength="200"')}${actualTimeField('Início real (opcional)','sub-start',s.start||'',0,day)}${actualTimeField('Término real (opcional)','sub-end',s.end||'',0,day)}</div><label>Observação<textarea name="sub-note" rows="2" maxlength="2000">${esc(s.note||'')}</textarea></label><button type="button" data-action="remove-subactivity" class="danger-text">Excluir subatividade</button></fieldset>`;
}
function refreshSubactivityLabels(){
  document.querySelectorAll('#actuals-form .actual-row').forEach((row,parentIndex)=>{
    const activity=row.querySelector('.actual-description h3')?.textContent||row.querySelector('[name="extra-theme"]')?.value||'Atividade sem título';
    row.querySelectorAll('.subactivity').forEach((child,index)=>{
      const title=child.querySelector('[name="sub-title"]')?.value||'sem título';
      const context=`Atividade ${parentIndex+1}: ${activity} / Subatividade ${index+1}: ${title}`;
      child.querySelector('legend').textContent=`Subatividade ${index+1}`;
      const labels={'sub-title':'Título','sub-responsible':'Responsável','sub-note':'Observação','sub-start':'Início real (opcional)','sub-end':'Término real (opcional)'};
      for(const [name,label] of Object.entries(labels))child.querySelector(`[name="${name}"]`)?.setAttribute('aria-label',`${label} — ${context}`);
      child.querySelectorAll('[data-action="time-now"]').forEach(button=>button.setAttribute('aria-label',`Preencher ${labels[button.dataset.field]} — ${context} com a hora atual`));
      child.querySelector('[data-action="remove-subactivity"]')?.setAttribute('aria-label',`Excluir ${context}`);
    });
  });
}
function subactivitiesSummary(detail){
  if(!detail?.subactivities?.length)return '';
  return `<ul class="subactivities-summary">${detail.subactivities.map(s=>`<li><strong>${esc(s.title)}</strong>${s.start||s.end?` · ${esc(displayActualTime(s.start)||'—')} → ${esc(displayActualTime(s.end)||'—')}`:''}${s.responsible?`<small>${esc(s.responsible)}</small>`:''}${s.note?`<small>${esc(s.note)}</small>`:''}</li>`).join('')}</ul>`;
}
function markRegistrationDirty(){registrationDirty=true;const form=document.querySelector('#actuals-form');const saving=form?.querySelector('.registration-savebar')?.dataset.state==='saving';setRegistrationSaveState(form,saving?'saving':'dirty',saving?'Envio em andamento. Há alterações mais recentes pendentes.':'Alterações pendentes · ainda não salvas.');}
function canLeaveRegistration(){
  if(window.IASDPIDrafts)return IASDPIDrafts.canLeave();
  if(!registrationDirty)return true;
  if(!window.confirm('Descartar as alterações não salvas deste registro?'))return false;
  registrationDirty=false;return true;
}
window.addEventListener('beforeunload',event=>{if(!window.IASDPIDrafts&&registrationDirty){event.preventDefault();event.returnValue='';}});

// Somente apresentação: o envio continua no mesmo formulário e nas mesmas RPCs.
function setRegistrationSaveState(form,phase,message){
  const bar=form?.querySelector('.registration-savebar'),status=bar?.querySelector('#registration-save-status');
  if(!bar||!status)return;
  bar.dataset.state=phase;bar.setAttribute('aria-busy',String(phase==='saving'));
  status.setAttribute('aria-live',phase==='error'?'assertive':'polite');
  status.textContent=message;
}
function refreshScrollableTables(){
  for(const wrapper of document.querySelectorAll('.table-scroll')){
    const scrollable=wrapper.scrollWidth>wrapper.clientWidth+1;
    if(scrollable){
      wrapper.tabIndex=0;wrapper.setAttribute('role','region');
      const title=wrapper.closest('section')?.querySelector('h2')?.textContent||wrapper.querySelector('th')?.textContent||'Dados';
      wrapper.setAttribute('aria-label',`Tabela: ${title}. Rolagem horizontal disponível.`);
    }else{wrapper.removeAttribute('tabindex');wrapper.removeAttribute('role');wrapper.removeAttribute('aria-label');}
  }
}
const pageLayout=(()=>{
  let resizeObserver=null,draftObserver=null;
  function floating(){const candidate=document.querySelector('.registration-savebar,.execution-actions .big');return candidate&&getComputedStyle(candidate).position==='fixed'?candidate:null;}
  function measure(){
    const bar=floating(),root=document.documentElement;
    if(!bar){root.style.removeProperty('--registration-bar-height');root.style.removeProperty('--registration-viewport-inset');return;}
    const viewport=window.visualViewport;
    const inset=viewport&&viewport.scale===1?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
    root.style.setProperty('--registration-viewport-inset',inset+'px');
    root.style.setProperty('--registration-bar-height',Math.ceil(bar.getBoundingClientRect().height)+'px');
  }
  function revealField(){
    const input=document.activeElement,bar=floating();
    if(!bar||!input?.matches('input,select,textarea')||!input.closest('#actuals-form,#notes-form'))return;
    const bounds=input.getBoundingClientRect(),top=(window.visualViewport?.offsetTop||0)+12,bottom=bar.getBoundingClientRect().top-12;
    if(bounds.bottom>bottom)window.scrollBy({top:bounds.bottom-bottom,behavior:'instant'});
    else if(bounds.top<top)window.scrollBy({top:bounds.top-top,behavior:'instant'});
  }
  function resized(){measure();refreshScrollableTables();requestAnimationFrame(revealField);}
  function mount(){
    resizeObserver?.disconnect();draftObserver?.disconnect();
    const form=document.querySelector('#actuals-form'),bar=form?.querySelector('.registration-savebar');
    const control=floating();if(control){resizeObserver=new ResizeObserver(measure);resizeObserver.observe(control);}
    if(bar){
      draftObserver=new MutationObserver(()=>{
        if(form.isConnected&&registrationDirty&&bar.dataset.state==='saved'&&form.querySelector('.draft-feedback'))
          setRegistrationSaveState(form,'dirty','Rascunho recuperado ou alterado · ainda não salvo.');
      });
      draftObserver.observe(form,{childList:true,subtree:true});
    }
    measure();refreshScrollableTables();
  }
  window.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('scroll',measure);
  document.addEventListener('focusin',()=>requestAnimationFrame(revealField));
  return {mount};
})();
