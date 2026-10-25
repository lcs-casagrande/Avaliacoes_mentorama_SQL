'use strict';
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const state = { programs: [], selected: null, page: 'home', busy: false, zone: 'America/Sao_Paulo', offset: 0, duplicate: null, programsLoad: {status:'idle',error:''} };
let programsLoadGeneration=0;
let bootInProgress=false,sessionWasAuthorized=false;
let bootTask=null,pendingNavigation=null;
const thresholds = { onTime: 1, attention: 5 };
const roles = ['Ancião do mês', 'Recepção', 'Diácono', 'Diaconisa', 'Diretor de culto', 'Sonoplastia', 'Equipe de louvor', 'Responsável pela programação'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const minutes = (end,start,day) => {const a=recordEpoch(end,day),b=recordEpoch(start,day);return a===null||b===null?null:(a-b)/60000;};
const currentTime = () => new Date(Date.now() + state.offset);
const clock = value => actualClock(value)||'—';
const dateLabel = value => {const day=recordDay(value);return day?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(day+'T12:00:00Z')):'Data inconsistente — corrija no registro';};
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: state.zone }).format(currentTime());
const signed = value => { if(value===null||!Number.isFinite(value))return '—';const n = Math.round(value); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} min`; };
const duration = value => value==null||!Number.isFinite(value)?'—':`${Math.round(value)} min`;
const elapsed = start => { if(recordEpoch(start)===null)return '—';const seconds = Math.max(0, Math.floor((currentTime() - new Date(start)) / 1000)); return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2, '0')}`; };
function statusTone(value) { if(value===null||!Number.isFinite(value))return 'neutral';const n = Math.round(value); return n <= thresholds.onTime ? 'good' : n <= thresholds.attention ? 'warning' : 'critical'; }
function delayLabel(value) { if(value===null||!Number.isFinite(value))return 'Dados insuficientes';const n = Math.round(value); return n < 0 ? `${Math.abs(n)} min adiantado` : n <= 1 ? 'No horário' : `${n} min de atraso`; }
function toast(message, error = false) {
  notice.textContent = message; notice.className = error ? 'error' : ''; notice.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}
async function api(path = '', method = 'GET', body) {
  if(window.IASDPIOperational)return window.IASDPIOperational.request(path,method,body);
  const authorization=path==='health'?null:await IASDPIAuth.requireAccess();
  if (window.IASDPIDemo){const result=await window.IASDPIDemo.request(path,method,body);if(method!=='GET'&&cloudState.session)void cloudAutoArchive();return result;}
  const response = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authorization?{Authorization:'Bearer '+authorization.token}:{}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if(authorization&&IASDPIAuth.session()?.access_token!==authorization.token)throw Error('Sessão encerrada.');
  if (!response.ok) {if(response.status===401||response.status===403)void IASDPIAuth.restore().catch(()=>{});const failure=new Error(result.error||'Não foi possível concluir a operação.');if(response.status===409)failure.code='40001';throw failure;}
  if(method!=='GET'&&cloudState.session)void cloudAutoArchive();
  return result;
}
async function loadPrograms({renderState=false}={}){
  const generation=++programsLoadGeneration;
  state.programsLoad={status:'loading',error:''};if(renderState)render();
  try{
    const rows=await api('programs');
    if(!Array.isArray(rows)||rows.some(p=>!p||typeof p.id!=='string'||!p.plan||!Array.isArray(p.plan.items))||new Set(rows.map(p=>p.id)).size!==rows.length)throw Error('Resposta inválida ao consultar as programações.');
    if(generation!==programsLoadGeneration||!IASDPIAuth.allowed())return null;
    state.programs=rows;state.programsLoad={status:rows.length?'records':'empty',error:''};
    return rows;
  }catch(error){
    if(generation===programsLoadGeneration&&IASDPIAuth.allowed())state.programsLoad={status:'error',error:error.message};
    throw error;
  }finally{if(renderState&&generation===programsLoadGeneration)render();}
}
function programsLoadView(){
  const {status,error}=state.programsLoad;
  if(status==='error')return `<section class="empty" role="alert" data-load-state="error"><h2>Erro ao carregar os registros</h2><p>${esc(error)}</p><p>Não foi possível confirmar os dados. Isso não significa que não existam registros. Os dados já carregados e os rascunhos foram preservados.</p>${button('Tentar novamente','retry-programs','','class="primary"')}</section>`;
  return '<section class="empty" role="status" data-load-state="loading"><h2>Carregando registros…</h2><p>Aguarde a confirmação da consulta.</p></section>';
}
function selected() { return state.programs.find(p => p.id === state.selected); }
function replaceProgram(program) {
  const i = state.programs.findIndex(p => p.id === program.id);
  if (i < 0) state.programs.unshift(program); else state.programs[i] = program;
  state.selected = program.id;
  if(['records','empty'].includes(state.programsLoad.status))state.programsLoad={status:'records',error:''};
}
function executionInfo(p) {
  const source=p,samples=activitySamples(source),counts=sampleCounts(samples),day=recordDay(source.plan.date);
  const extraSamples=(source.extra_events||[]).map(e=>recordInterval(e.start,e.end,day));
  const extraCounts=sampleCounts(extraSamples);
  const actualComplete=counts.total>0&&samples.every(s=>s.actual.state==='valid')&&extraSamples.every(e=>e.state==='valid');
  let complete=actualComplete&&counts.considered===counts.total;
  p=programForMetrics(p);
  const items = p.plan.items;
  const active = p.execution_mode === 'manual' ? null : items.find(i => p.executions[i.id]?.started && !p.executions[i.id].ended);
  const pending = items.find(i => !p.executions[i.id]?.started);
  const finished = samples.filter(s=>s.actual.state==='valid').map(s=>s.item);
  const records = Object.values(p.extra_events?.length?registrationData(p).executions:p.executions).filter(e=>e?.started);
  const first = [...records].sort((a,b) => new Date(a.started)-new Date(b.started))[0];
  const last = records.filter(e => e.ended).sort((a,b) => new Date(b.ended)-new Date(a.ended))[0];
  let shift = null;
  const plannedInterval=recordInterval(source.planned_start||source.plan.start,source.planned_end||source.plan.end,day);
  complete &&= plannedInterval.state==='valid';
  if (p.status === 'Finalizada') {if(complete&&last&&plannedInterval.state==='valid')shift = minutes(last.ended, p.planned_end);}
  else if (active) {
    const e = p.executions[active.id];
    const plannedDuration = minutes(active.planned_end, active.planned_start);
    const delta=minutes(e.started,active.planned_start);
    shift=delta===null||plannedDuration===null?null:delta+Math.max(0,minutes(currentTime(),e.started)-plannedDuration);
  } else if (p.plan.date === today() && p.status === 'Pronta') {
    const delta=minutes(currentTime(),p.planned_start);shift=delta===null?null:Math.max(0,delta);
  }
  const origin = items.find(i => {
    const e = p.executions[i.id];
    return e && (minutes(e.started, i.planned_start) > thresholds.onTime || (e.ended && minutes(e.ended, i.planned_end) > thresholds.onTime));
  }) || (active && shift > thresholds.onTime ? active : null);
  const expected = items.find(i => currentTime() >= new Date(i.planned_start) && currentTime() < new Date(i.planned_end));
  const forecast = p.planned_end&&shift!==null?new Date(new Date(p.planned_end).getTime() + shift * 60000):null;
  const actualDuration=actualComplete&&first&&last?minutes(last.ended,first.started):null;
  return { active, pending, finished, first, last, shift, origin, expected, forecast, complete, counts, extraCounts, actualDuration };
}
function badge(value, label = delayLabel(value)) { return `<span class="badge ${statusTone(value)}">${esc(label)}</span>`; }
function heading(eyebrow, title, description = '', action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}</div>${action}</div>`;
}
function empty(title, description, action = '') { return `<div class="empty"><h2>${title}</h2><p>${description}</p>${action}</div>`; }
function button(label, action, id = '', extra = '') { return `<button type="button" data-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`; }
function programDate(value){return dateLabel(value);}
function programStatus(p) {
  const tone={'Planejamento':'neutral','Pronta':'good','Em andamento':'warning','Finalizada':'complete'}[p.status] || 'neutral';
  return `<span class="badge ${tone}">${esc(p.status==='Planejamento'?'Rascunho':p.status)}</span>`;
}
function programRow(p, historic = false) {
  const m = executionInfo(p);
  const view=programForMetrics(p);const planned = recordInterval(view.planned_start,view.planned_end,recordDay(p.plan.date)).minutes;
  const actual = m.actualDuration;
  return `<tr><td><strong>${esc(p.plan.name)}</strong><small>${esc(programDate(p.plan.date))}</small></td>
    <td>${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}${historic ? `<small>${duration(planned)} previstos · ${actual === null ? '—' : duration(actual)} realizados</small>` : ''}</td>
    <td>${historic ? badge(m.shift, signed(m.shift)) : `${programStatus(p)}`}</td>
    <td class="row-actions">${button(historic || p.status==='Finalizada' ? 'Ver resumo' : ['Planejamento','Pronta'].includes(p.status) ? 'Editar' : 'Ver programação', historic || p.status==='Finalizada' ? 'summary' : 'edit', p.id)}${button('Duplicar', 'duplicate', p.id)}${!historic&&window.IASDPIOperational&&IASDPIAuth.isAdmin()?button('Mover para a lixeira','trash-move',p.id,'class="danger-text"'):''}${!historic ? button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"') : ''}</td></tr>`;
}
function programTable(programs, historic = false) {
  return `<div class="table-scroll"><table><thead><tr><th>Programação</th><th>Horário ${historic ? '/ duração' : 'previsto'}</th><th>${historic ? 'Desvio do término' : 'Status'}</th><th>Ações</th></tr></thead><tbody>${programs.map(p => programRow(p, historic)).join('')}</tbody></table></div>`;
}
function home() {
  const upcoming = state.programs.filter(p => p.status !== 'Finalizada' && p.plan.date >= today())
    .sort((a, b) => `${a.plan.date} ${a.plan.start}`.localeCompare(`${b.plan.date} ${b.plan.start}`))[0];
  const running = state.programs.find(p => p.status === 'Em andamento');
  const featured = running || upcoming;
  const recent = state.programs.filter(p => p.status === 'Finalizada').sort((a,b) => String(b.plan.date||'').localeCompare(String(a.plan.date||''))).slice(0, 5);
  return heading('BEM-VINDO', 'Cada momento, no seu tempo.', 'Uma programação clara. Um acompanhamento tranquilo.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto', 'chronogram')}</div>`) +
    (featured ? `<section class="featured"><div><p class="eyebrow">${running ? 'EM ANDAMENTO' : 'PRÓXIMO CULTO'}</p><h2>${esc(featured.plan.name)}</h2><div class="featured-meta"><p class="date">${esc(programDate(featured.plan.date))}</p>${programStatus(featured)}</div><p class="large-time">${esc(displayPlannedTime(featured.plan.start||'—'))} <span>→</span> ${esc(displayPlannedTime(featured.plan.end||'—'))}</p><div class="actions">${button('Abrir programação', 'edit', featured.id)}${button(featured.execution_mode==='manual'?'Registrar culto':running?'Continuar acompanhamento':'Acompanhar culto', featured.execution_mode==='manual'?'actuals':'track', featured.id, 'class="primary"')}</div></div><div class="featured-aside"><span class="eyebrow">PLANEJAMENTO</span><strong>${featured.plan.items.length}</strong><span>momentos organizados</span></div></section>` : empty('Vamos preparar a próxima programação?', 'Use Nova programação para planejar ou Registrar culto para informar o que aconteceu.')) +
    `<section class="section"><div class="section-heading"><h2>Últimas programações</h2>${recent.length ? `<span class="muted">Desvio médio do término: ${signed(endStatistics(recent).mean)} · ${endStatistics(recent).considered} considerados / ${endStatistics(recent).excluded} desconsiderados</span>` : ''}</div>${recent.length ? programTable(recent, true) : '<p class="muted">Os resumos aparecerão aqui após finalizar uma programação.</p>'}</section>`;
}
function programsPage() {
  const list = [...state.programs].sort((a,b) => String(b.plan.date||'').localeCompare(String(a.plan.date||'')));
  return heading('PLANEJAMENTO', 'Programações', 'Organize horários, atividades e responsáveis.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto', 'chronogram')}</div>`) +
    (window.IASDPIOperational&&IASDPIAuth.isAdmin()?`<div class="actions">${button('Gerenciar modelos','models-open')}${button('Lixeira de cultos','trash-open')}</div>`:'') +
    (list.length ? programTable(list) : empty('Nenhuma programação cadastrada', 'Use Nova programação para cadastrar os horários e as atividades.'));
}
function displayDate(value){const day=recordDay(value);return day?day.split('-').reverse().join('/'):value||'';}
function readDate(value){const day=recordDay(value);if(!day)throw Error('Informe uma data válida no formato dd/mm/aaaa.');return day;}
function readDateField(input){try{return readDate(input.value);}catch(error){throw fieldError(input,error.message);}}
function tryReadDate(value){try{return readDate(value);}catch(_){return '';}}
function field(label, name, value = '', type = 'text', required = false, extra = '') {
  if(type==='date'){value=displayDate(value);type='text';extra+=' data-date-input inputmode="numeric" placeholder="dd/mm/aaaa"';}
  if(type==='time'){value=displayPlannedTime(value);type='text';extra+=' data-planned-time maxlength="5" placeholder="HH:mm" inputmode="text" autocomplete="off" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"';}
  return `<label><span class="field-label">${label}${required?' <span class="required-marker" aria-hidden="true">*</span><span class="sr-only"> (obrigatório)</span>':''}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${extra}></label>`;
}
function itemEditor(i = {}, index = 0) {
  const complete=Boolean(i.activity && i.start && i.end);
  return `<fieldset class="item-editor" data-item-id="${esc(i.id || crypto.randomUUID())}"><legend>Atividade <span class="item-number">${index+1}</span></legend>
    <details class="item-details" ${complete?'':'open'}><summary><span class="item-overview"><strong class="item-overview-title">${esc(displayPlannedTime(i.start || '—'))} → ${esc(displayPlannedTime(i.end || '—'))} · ${esc(i.activity || 'Nova atividade')}</strong><small class="item-overview-responsible">${esc(i.responsible || 'Responsável opcional')}</small></span><span class="item-edit-label">Editar</span></summary>
    <div class="item-fields">${field('Bloco', 'block', i.block || 'Culto', 'text', true, 'maxlength="200" list="blocks"')}${field('Atividade', 'activity', i.activity, 'text', true, 'maxlength="200"')}${field('Responsável', 'responsible', i.responsible, 'text', false, 'maxlength="200"')}${field('Início previsto', 'start', i.start, 'time', true)}${field('Término previsto', 'end', i.end, 'time', true)}${field('Observação', 'note', i.note, 'text', false, 'maxlength="2000"')}</div></details>
    <div class="item-controls">${button('↑ Subir', 'up')}${button('↓ Descer', 'down')}${button('Excluir atividade', 'remove-item', '', 'class="danger-text"')}</div></fieldset>`;
}
function updateItemOverview(row) {
  const get=name=>row.querySelector(`[name="${name}"]`).value;
  row.querySelector('.item-overview-title').textContent=`${get('start') || '—'} → ${get('end') || '—'} · ${get('activity') || 'Nova atividade'}`;
  row.querySelector('.item-overview-responsible').textContent=get('responsible') || 'Responsável opcional';
}
function fieldError(input,message) {
  input.setAttribute('aria-invalid','true');
  let error=input.parentElement.querySelector('.field-error');
  if(!error){error=document.createElement('span');error.className='field-error';error.id='error-'+crypto.randomUUID();input.after(error);}
  error.textContent=message;input.setAttribute('aria-describedby',error.id);
  for(let parent=input.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  input.disabled=false;input.focus();
  return Error(message);
}
function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const error=input.parentElement.querySelector('.field-error');
  if(error){input.removeAttribute('aria-describedby');error.remove();}
}
function validateProgramForm(form,plan) {
  if(plan.template_id==='free'&&!plan.items.length&&!plan.start&&!plan.end)return;
  const check=(input,message)=>{throw fieldError(input,message);};
  for(const input of form.querySelectorAll('[data-planned-time]'))if((input.required||input.value)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.value))check(input,'Use o formato 24 horas HH:mm (ex.: 14:05).');
  if(plan.end<=plan.start)check(form.querySelector('.form-grid [name="end"]'),'O término deve ser depois do início.');
  if(!plan.name.trim())check(form.querySelector('[name="name"]'),'Informe o nome da programação.');
  const rows=[...form.querySelectorAll('.item-editor')];
  if(!rows.length&&plan.template_id!=='free'){form.querySelector('[data-action="add-item"]').focus();throw Error('Adicione pelo menos uma atividade.');}
  let previous=plan.start;
  plan.items.forEach((item,index)=>{
    const row=rows[index];
    for(const name of ['activity','block'])if(!item[name].trim())check(row.querySelector(`[name="${name}"]`),'Preencha este campo obrigatório.');
    if(item.end<=item.start)check(row.querySelector('[name="end"]'),'O término deve ser depois do início.');
    if(item.start<previous)check(row.querySelector('[name="start"]'),'A atividade deve começar após a anterior e dentro da programação.');
    if(item.end>plan.end)check(row.querySelector('[name="end"]'),'O término ultrapassa o horário da programação.');
    previous=item.end;
  });
}
function editor(p,plannedOnly=false) {
  if (p?.execution_mode === 'manual'&&!plannedOnly) return actualsForm(p);
  if (p && !['Planejamento', 'Pronta'].includes(p.status)) return planView(p);
  const plan = p?.plan || { name: 'Culto de sábado', date: today(), start: '09:30', end: '12:25', team: {}, items: [] };
  return heading('PLANEJAMENTO', p ? 'Editar programação' : 'Nova programação', 'Planeje os horários. Campos com * são obrigatórios; a equipe é opcional.', button('Voltar', 'programs')) +
    `<form id="program-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="panel form-grid">${field('Nome da programação', 'name', plan.name, 'text', true, 'maxlength="200"')}${field('Data', 'date', plan.date, 'date', true)}${field('Início previsto', 'start', plan.start, 'time', !(plan.template_id==='free'&&!plan.items.length))}${field('Término previsto', 'end', plan.end, 'time', !(plan.template_id==='free'&&!plan.items.length))}<p id="weekday" class="muted"></p></section>
      <details class="panel"><summary>Equipe <span class="muted">· preenchimento opcional</span></summary><div class="form-grid team">${roles.map((role,i) => field(role, `team-${i}`, plan.team[role], 'text', false, 'maxlength="200"')).join('')}</div></details>
      <div class="section-heading"><h2>Itens da programação</h2>${button('+ Adicionar atividade', 'add-item')}</div><p class="muted">A ordem deve acompanhar os horários. Intervalos são permitidos; sobreposições, não.</p>
      <datalist id="blocks"><option value="Culto"><option value="Escola Sabatina"></datalist>
      <div id="items-editor">${(plan.items.length ? plan.items : plan.template_id==='free'?[]:[{}]).map(itemEditor).join('')}</div>
      <div class="actions form-footer"><button class="primary" type="submit">Salvar programação</button><label class="checkbox" ${p?.execution_mode==='manual'?'hidden':''}><input name="ready" type="checkbox" ${p?.status === 'Pronta'&&p.execution_mode!=='manual' ? 'checked' : ''}> Liberar para acompanhamento após salvar</label><p class="muted ready-help" ${p?.execution_mode==='manual'?'hidden':''}>Ao marcar, o sistema salva o planejamento e depois altera o status para Pronta.</p></div>
    </form>`;
}
function planView(p) {
  return heading('PROGRAMAÇÃO', esc(p.plan.name), esc(dateLabel(p.plan.date)), `${button('Duplicar', 'duplicate', p.id)}${window.IASDPIOperational&&IASDPIAuth.isAdmin()?button('Mover para a lixeira','trash-move',p.id,'class="danger-text"'):''} ${button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"')}`) +
    `<p class="muted">Planejamento protegido após o início. Horário previsto: ${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}.</p>` + timeline(p) +
    `<details class="panel"><summary>Equipe</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role)}</dt><dd>${esc((p.plan.team||{})[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>`;
}
function timeline(p) {
  p=programForMetrics(p);
  let block = '';
  return `<section class="section"><div class="section-heading"><h2>Linha da programação</h2><span class="muted">✓ Finalizado · ● Em andamento · ○ Pendente</span></div><ol class="timeline">${p.plan.items.map(i => {
    const e = p.executions[i.id];
    const done = Boolean(e?.ended), active = e && !done;
    const diff = done ? minutes(e.ended, i.planned_end) : e ? minutes(e.started, i.planned_start) : 0;
    const blockLabel = block !== i.block ? `<li class="block-label">${esc(i.block)}</li>` : ''; block = i.block;
    return `${blockLabel}<li class="timeline-row ${active ? 'active' : ''}"><span class="timeline-symbol" aria-label="${done ? 'Finalizado' : active ? 'Em andamento' : 'Pendente'}">${done ? '✓' : active ? '●' : '○'}</span><div class="timeline-time">${esc(displayPlannedTime(i.start))}<small>${esc(displayPlannedTime(i.end))}</small></div><div class="timeline-content"><strong>${esc(i.activity)}</strong><span>${esc(i.responsible || 'Responsável não informado')}</span><small>Previsto: ${esc(displayPlannedTime(i.start))} → ${esc(displayPlannedTime(i.end))}${e ? ` · Real: ${clock(e.started)} → ${e.ended ? clock(e.ended) : 'em andamento'}` : ''}</small>${i.note ? `<small>${esc(i.note)}</small>` : ''}</div>${e ? badge(diff, done ? `${signed(diff)} no término` : `${signed(diff)} no início`) : '<span class="badge neutral">Pendente</span>'}</li>`;
  }).join('')}</ol></section>`;
}
function notes(p) {
  return `<section class="section"><h2>Observações e ocorrências</h2><form id="notes-form" data-id="${esc(p.id)}" data-version="${p.version}"><div class="notes-grid"><div><label for="execution-note">Observações</label><textarea id="execution-note" name="note" maxlength="5000" rows="3" placeholder="Registre o que ajudou ou afetou a programação.">${esc(p.note)}</textarea></div><div><label for="execution-incident">Ocorrência não prevista</label><textarea id="execution-incident" name="incident" maxlength="5000" rows="3" placeholder="Ex.: comunicação adicionada após os anúncios.">${esc(p.incident)}</textarea></div></div><button type="submit">Salvar observações</button></form></section>`;
}
function tracking(p) {
  if (p?.execution_mode === 'manual') return actualsForm(p);
  if (!p) return heading('EXECUÇÃO', 'Acompanhar culto', 'Use esta tela durante o culto para iniciar, avançar e pausar as atividades.') + empty('Escolha uma programação', 'Abra uma programação pronta para acompanhar.', button('Ver programações', 'programs', '', 'class="primary"'));
  if (p.status === 'Finalizada') return summary(p);
  p=programForMetrics(p);
  const m = executionInfo(p);
  const focus = m.active || m.expected || m.pending;
  const index = focus ? p.plan.items.findIndex(item=>item.id===focus?.id) : -1;
  const next = p.plan.items[index + 1];
  const e = focus && p.executions[focus.id];
  const dateMismatch = p.plan.date !== today();
  return heading('EXECUÇÃO', 'Acompanhar culto', `${esc(dateLabel(p.plan.date))} · ${esc(p.plan.name)} · Controle durante a execução.`, button('Atualizar', 'refresh')) +
    `<div class="planned-bar"><span>Previsto <strong>${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}</strong></span>${programStatus(p)}</div>
    <section class="metrics" aria-label="Situação da programação"><div><span>HORÁRIO ATUAL</span><strong data-live="clock">${clock(currentTime())}</strong></div><div><span>DESVIO DO HORÁRIO</span><strong data-live="shift" class="${statusTone(m.shift)}">${signed(m.shift)}</strong><small data-live="status">${delayLabel(m.shift)}</small></div><div><span>PREVISÃO DE TÉRMINO</span><strong data-live="forecast">${p.status === 'Planejamento' ? '—' : (displayPlannedTime(m.forecast)||'—')}</strong></div></section>
    <p class="context-line">Pelo plano, agora: <strong data-live="expected">${esc(m.expected?.activity || (dateMismatch ? 'outra data' : 'intervalo ou fora da programação'))}</strong></p>
    <section class="current-activity"><p class="eyebrow" data-live="focus-label">${m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE'}</p><h2 data-live="activity">${esc(focus?.activity || 'Sem atividades')}</h2><p class="responsible" data-live="responsible">${esc(focus?.responsible || 'Responsável não informado')}</p><div class="current-details"><div><span>Planejado</span><strong data-live="period">${esc(displayPlannedTime(focus?.start || '—'))} → ${esc(displayPlannedTime(focus?.end || '—'))}</strong></div><div><span>Início real</span><strong>${clock(e?.started)}</strong></div><div><span>Tempo transcorrido</span><strong data-live="elapsed">${e ? elapsed(e.started) : '—'}</strong></div></div><p data-live="item-note">${esc(focus?.note || '')}</p><p class="muted" data-live="origin">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'}</p></section>
    ${next ? `<section class="next-activity" data-next><span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(displayPlannedTime(next.start))}</strong></section>` : '<p class="muted" data-next>Última atividade da programação.</p>'}
    <div class="execution-actions">${p.status === 'Planejamento' ? button('Marcar programação como pronta', 'ready', p.id, 'class="primary big"') : m.active ? (p.paused ? button('Retomar acompanhamento', 'resume', p.id, 'class="primary big"') : button(m.pending ? 'Finalizar e avançar' : 'Finalizar programação', 'next', p.id, 'class="primary big"')) : button(`Iniciar atividade${m.expected && m.expected.id !== m.pending?.id ? ` · ${esc(m.pending.activity)}` : ''}`, 'start', p.id, `class="primary big" ${dateMismatch ? 'disabled' : ''}`)}${m.active && !p.paused ? button('Pausar acompanhamento', 'pause', p.id) : ''}${button('Voltar', 'programs')}</div>
    ${dateMismatch ? '<p class="muted">O início será liberado na data da programação. Para testar hoje, duplique com a data de hoje.</p>' : ''}${p.paused ? '<p class="pause-note">Acompanhamento pausado. O tempo real continua contando; a pausa não altera o planejamento nem exclui tempo do culto.</p>' : ''}
    ${timeline(p)}${notes(p)}`;
}
function summary(p) {
  const m = executionInfo(p);
  const view=programForMetrics(p);const plannedDuration = recordInterval(view.planned_start,view.planned_end,recordDay(p.plan.date)).minutes;
  const actualDuration = m.actualDuration;
  return heading('PLANEJADO × REALIZADO', 'Resumo da programação', `${esc(p.plan.name)} · ${esc(dateLabel(p.plan.date))}`, `${button('Duplicar programação', 'duplicate', p.id)} ${p.execution_mode === 'manual' ? button('Editar registro', 'actuals', p.id) : ''} ${window.IASDPIDemo&&p.execution_mode==='manual'&&p.plan.date==='2026-10-03'?button('Conferir correção para 10/10/2026','correct-date',p.id):''}`) +
    `<section class="summary-grid">${[['Início planejado', displayPlannedTime(p.plan.start)], ['Início real', actualClock(m.first?.started)||'—'], ['Término planejado', displayPlannedTime(p.plan.end)], ['Término real', actualClock(m.last?.ended)||'—'], ['Duração planejada', duration(plannedDuration)], ['Duração real', actualDuration === null ? '—' : duration(actualDuration)], ['Desvio da duração', actualDuration === null || plannedDuration === null ? '—' : signed(actualDuration - plannedDuration)], ['Desvio do término', signed(m.shift)]].map(([label,value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}</section>
    <p class="muted">Desvio do término compara o relógio. Desvio da duração compara o tempo total entre o primeiro início e o último término, incluindo intervalos. ${metricsCountLabel(m.counts)}.${m.extraCounts.total?` Atividades extras: ${m.extraCounts.considered} consideradas; ${m.extraCounts.missing} com dados ausentes; ${m.extraCounts.invalid} com dados inválidos.`:''} Duração total e pontualidade exigem horários completos das atividades principais e extras; subatividades não são somadas novamente.</p>
    <p class="context-line">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}. Veja as observações para entender a causa.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'}</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade / bloco</th><th>Horários previstos</th><th>Horários reais</th><th>Duração prevista</th><th>Duração real</th><th>Diferença de duração</th></tr></thead><tbody>${summaryActivityRows(p)}</tbody></table></div>${transitionView([p])}${notes(p)}`;
}
const adherenceTolerance = 2;
function metricsCountLabel(c){return `${c.considered} atividades consideradas; ${c.total-c.considered} desconsideradas (${c.missing} com dados ausentes; ${c.invalid} com dados inválidos)`;}
function endStatistics(programs){
  const shifts=programs.map(p=>executionInfo(p).shift).filter(v=>v!==null&&Number.isFinite(v));
  return {considered:shifts.length,excluded:programs.length-shifts.length,mean:shifts.length?shifts.reduce((s,v)=>s+v,0)/shifts.length:null,onTime:shifts.filter(v=>Math.abs(v)<=adherenceTolerance).length};
}
function adherence(p) {
  const samples=activitySamples(p),counts=sampleCounts(samples),completed=samples.filter(s=>s.state==='valid');
  const conforming=completed.filter(({item,actual,planned})=>Math.abs(minutes(actual.start,planned.start))<=adherenceTolerance&&(item.end_inferred||Math.abs(minutes(actual.end,planned.end))<=adherenceTolerance)).length;
  return {...counts,total:counts.considered,expected:counts.total,excluded:counts.total-counts.considered,conforming,percent:completed.length?Math.round(conforming/completed.length*100):null};
}
function median(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return !sorted.length?null:sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}
function activityMedians(programs) {
  const groups=new Map();
  programs.forEach(p=>activitySamples(p).forEach(({item,actual,planned,state})=>{
    const name=String(item.activity||'Atividade sem título').startsWith('Música Congregacional') ? 'Música Congregacional' : item.activity;
    if(!groups.has(name))groups.set(name,{name,values:[],events:new Set(),estimated:false,missing:0,invalid:0});
    const group=groups.get(name);
    if(state!=='valid'){group[state]++;return;}
    group.values.push(actual.minutes-planned.minutes);
    group.events.add(p.id);group.estimated ||= Boolean(item.end_inferred);
  }));
  return [...groups.values()].map(group=>({...group,median:median(group.values)}));
}
function medianView(programs) {
  const groups=activityMedians(programs);
  const label=value=>value===null?'Dados insuficientes':`${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString('pt-BR',{maximumFractionDigits:1})} min`;
  return `<section class="section median-section"><div class="section-heading"><h2>Mediana do desvio por atividade</h2><span class="muted">${programs.length} programações finalizadas</span></div>
    <p class="muted">Diferença entre duração realizada e prevista em cada registro de atividade. Positivo = durou mais; negativo = durou menos. As músicas congregacionais estão agrupadas, incluindo sentados e em pé.</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade</th><th>Mediana do desvio</th><th>Registros comparados / desconsiderados</th><th>Programações</th></tr></thead><tbody>${groups.map(group=>`<tr><td>${esc(group.name)}${group.estimated?' *':''}</td><td><span class="badge ${statusTone(group.median)}">${label(group.median)}</span></td><td>${group.values.length} considerados; ${group.missing+group.invalid} desconsiderados<small>${group.missing} ausentes · ${group.invalid} inválidos</small></td><td>${group.events.size}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">${groups.some(g=>g.estimated)?'* Atividades marcadas usam um término de referência. ':''}A mediana considera somente intervalos válidos, inclusive quando a atividade se repete no mesmo culto.</p></section>`;
}
function adherenceOverview(programs=state.programs) {
  const examples=programs.filter(p=>p.status==='Finalizada').sort((a,b)=>String(a.plan.date||'').localeCompare(String(b.plan.date||'')));
  if(!examples.length)return '';
  const counts=examples.map(adherence),ends=endStatistics(examples);
  const conforming=counts.reduce((sum,a)=>sum+a.conforming,0),total=counts.reduce((sum,a)=>sum+a.total,0),excluded=counts.reduce((sum,a)=>sum+a.excluded,0);
  const percent=total?Math.round(conforming/total*100)+'%':'Dados insuficientes';
  return `<section class="section adherence-section"><div class="section-heading"><h2>Aderência à programação</h2><span class="badge neutral">${examples.length} eventos finalizados</span></div>
    <p class="muted">Aderência = atividades com início e término até ${adherenceTolerance} minutos antes ou depois do previsto. Atividades com término de referência são avaliadas somente pelo início. Dados incompletos não permitem classificar o culto inteiro.</p>
    <div class="metrics"><div><span>ATIVIDADES ADERENTES</span><strong>${percent}</strong><small>${conforming} de ${total} atividades consideradas; ${excluded} desconsideradas (${counts.reduce((s,a)=>s+a.missing,0)} ausentes; ${counts.reduce((s,a)=>s+a.invalid,0)} inválidas)</small></div><div><span>EVENTOS COM TÉRMINO ADERENTE</span><strong>${ends.considered?ends.onTime+'/'+ends.considered:'Dados insuficientes'}</strong><small>${ends.considered} cultos considerados; ${ends.excluded} desconsiderados · tolerância ±${adherenceTolerance} min</small></div><div><span>DESVIO MÉDIO DO TÉRMINO</span><strong>${signed(ends.mean)}</strong><small>${ends.considered} cultos considerados; ${ends.excluded} desconsiderados. Atrasos positivos · adiantamentos negativos</small></div></div>
    <div class="table-scroll"><table><thead><tr><th>Evento</th><th>Aderência</th><th>Atividades aderentes / consideradas</th><th>Desvio do término</th><th>Detalhes</th></tr></thead><tbody>${examples.map(p=>{
      const a=adherence(p),m=executionInfo(p);const tone=a.percent===null||!m.complete?'neutral':a.percent>=90?'good':a.percent>=70?'warning':'critical';
      return `<tr><td>${esc(p.plan.name)}<small>${esc(programDate(p.plan.date))}</small></td><td><span class="badge ${tone}">${a.percent===null?'Dados insuficientes':a.percent+'%'+(!m.complete?' · parcial':'')}</span></td><td>${a.conforming} / ${a.total}<small>${a.excluded} desconsideradas (${a.missing} ausentes; ${a.invalid} inválidas)</small></td><td>${badge(m.shift,signed(m.shift))}</td><td>${button('Ver realizado','summary',p.id)}</td></tr>`;
    }).join('')}</tbody></table></div><p class="muted">Cultos completos: verde a partir de 90%, amarelo de 70% a 89%, vermelho abaixo de 70%. Dados parciais: classificação neutra. A duração total considera o intervalo do evento, sem duplicar os itens simultâneos ou as subatividades.</p>${medianView(examples)}${transitionView(examples)}</section>`;
}
function modelsPage(){return heading('ADMINISTRAÇÃO','Modelos de liturgia','Use o mesmo cadastro de modelos da igreja. Atualizar um modelo não altera cultos já registrados.')+(!IASDPIAuth.isAdmin()?empty('Acesso restrito','Somente administradores podem gerenciar modelos.'):window.IASDPIOperational?IASDPIOperational.templatePanel():empty('Gerenciamento disponível no modo Supabase','Esta prévia local preserva os dados e não altera modelos no banco.'));}
function historyPage(){return IASDPIHistory.page();}

function render() {
  window.IASDPIDrafts?.beforeRender();
  const allowed=IASDPIAuth.allowed();
  if(!allowed&&!IASDPIAuth.isPublic(state.page))state.page='login';
  document.querySelectorAll('nav a').forEach(a=>{a.hidden=['users','trash','models'].includes(a.dataset.page)?!IASDPIAuth.isAdmin():a.dataset.page==='login'?allowed:!allowed&&!IASDPIAuth.isPublic(a.dataset.page);});
  document.querySelector('#auth-logout').hidden=!allowed;

  const activePage=state.page==='summary'?'history':['edit','tracking'].includes(state.page)&&selected()?.execution_mode==='manual'?'actuals':['edit','plan-edit'].includes(state.page)?'programs':state.page;
  document.querySelectorAll('nav a').forEach(a => {const active=a.dataset.page===activePage;a.classList.toggle('selected',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const missingRecord=['edit','plan-edit','actuals','tracking','summary'].includes(state.page)&&state.selected&&!selected();
  const needsPrograms=['home','programs','history','edit','plan-edit','actuals','tracking','summary','models'].includes(state.page);
  app.innerHTML = allowed&&needsPrograms&&!['records','empty'].includes(state.programsLoad.status)?programsLoadView():allowed&&missingRecord?empty('Registro não encontrado','Este identificador não está entre os cultos ativos disponíveis. Confira o link ou as programações.',button('Ver programações','programs')):({home, models:modelsPage, trash: trashPage, users: usersPage, invite: invitePage, login: IASDPIAuth.loginPage, 'forgot-password':IASDPIAuth.forgotPasswordPage,'reset-password':IASDPIAuth.resetPasswordPage, organization: organizationPage, archive: archivePage, agendas: agendasPage, programs: programsPage, history: historyPage, edit: () => editor(selected()), 'plan-edit':()=>editor(selected(),true), actuals: () => actualsForm(selected()), tracking: () => tracking(selected()), summary: () => selected() ? summary(selected()) : historyPage()}[state.page] || home)();
  updateWeekday(); updateActuals(); tick(); window.IASDPIDrafts?.mount(); pageLayout.mount();
}
function navigate(page,id,options){return IASDPINavigation.navigate(page,id,options);}
function updateWeekday() {
  const form = document.querySelector('#program-form');
  const target = document.querySelector('#weekday');
  if (form && target) { const value = tryReadDate(form.elements.date.value); target.textContent = value ? dateLabel(value) : ''; }
}
function tick() {
  const p = selected(); if (!p || state.page !== 'tracking' || p.status === 'Finalizada') return;
  const m = executionInfo(p), e = m.active && programForMetrics(p).executions[m.active.id];
  const focus = m.active || m.expected || m.pending;
  const next = p.plan.items[p.plan.items.findIndex(item=>item.id===focus?.id) + 1];
  const nextElement = document.querySelector('[data-next]');
  if (nextElement && nextElement.dataset.item !== (next?.id || '')) {
    nextElement.dataset.item = next?.id || '';
    nextElement.className = 'next-activity';
    nextElement.innerHTML = next ? `<span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(displayPlannedTime(next.start))}</strong>` : '<span class="muted">Última atividade da programação.</span>';
  }
  const values = {'focus-label': m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE', activity: focus?.activity || 'Sem atividades', responsible: focus?.responsible || 'Responsável não informado', period: `${displayPlannedTime(focus?.start)||'—'} → ${displayPlannedTime(focus?.end)||'—'}`, 'item-note': focus?.note || '', clock: clock(currentTime()), shift: signed(m.shift), status: delayLabel(m.shift), forecast: p.status === 'Planejamento' ? '—' : (displayPlannedTime(m.forecast)||'—'), elapsed: e ? elapsed(e.started) : '—', expected: m.expected?.activity || (p.plan.date !== today() ? 'outra data' : 'intervalo ou fora da programação'), origin: m.origin ? `Primeiro atraso observado: ${m.origin.activity}.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'};
  for (const [key, value] of Object.entries(values)) {
    const element = document.querySelector(`[data-live="${key}"]`);
    if (element) { element.textContent = value; if (key === 'shift') element.className = statusTone(m.shift); }
  }
}
async function handleAction(target) {
  const {action, id} = target.dataset;
  if(['chronogram','new','actuals','summary','programs','edit','track','duplicate','correct-date','edit-record-plan'].includes(action)&&!canLeaveRegistration())return;
  if(!action.startsWith('agenda-'))await IASDPIAuth.requireAccess();
  if(action.startsWith('trash-')){await handleTrashAction(action,id);return;}
  if(action.startsWith('users-')){await handleUsersAction(action,id);return;}
  if(action.startsWith('operational-')){await IASDPIOperational.action(action,id);return;}
  if(action==='cloud-save')await cloudSave();
  else if(action==='cloud-list')await refreshArchives();
  else if(action==='cloud-signout'){await IASDPIAuth.logout();}
  else if(action==='cloud-restore'){const [row]=await cloudRequest('/rest/v1/culto_archives?id=eq.'+encodeURIComponent(id)+'&select=payload');if(!row)throw Error('Arquivo não encontrado.');const result=await restoreBackup(row.payload);render();toast(result.preview?'Confira e confirme a prévia de importação.':`${result.added} registros restaurados sem substituir os atuais.`);}
  else if(action==='agenda-current'){selectAgendaMonth(today().slice(0,7));document.querySelector('[data-action="agenda-current"]').focus();}
  else if(action==='agenda-calendar'||action==='agenda-list'){agendaState.view=action==='agenda-calendar'?'calendar':'list';render();document.querySelector(`[data-action="${action}"]`).focus();}
  else if(action==='agenda-previous'||action==='agenda-next')changeAgendaMonth(action==='agenda-next'?1:-1);
  else if(action==='agenda-day'){agendaState.day=id;render();document.querySelector(`.calendar-day[data-id="${id}"]`)?.focus();}
  else if(action==='add-subactivity'){
    const row=target.closest('.actual-row'),list=row.querySelector('.subactivities');
    if(list.children.length>=50)throw Error('Limite de 50 subatividades por atividade.');
    list.insertAdjacentHTML('beforeend',subactivityRow({},row.dataset.id));markRegistrationDirty();refreshSubactivityLabels();list.lastElementChild.querySelector('input').focus();
  }
  else if(action==='remove-subactivity'){
    if(window.confirm('Excluir esta subatividade? A exclusão só será aplicada ao salvar o registro.')){target.closest('.subactivity').remove();markRegistrationDirty();refreshSubactivityLabels();}
  }
  else if(action==='edit-record-plan'){
    const form=document.querySelector('#actuals-form');
    if(!form.dataset.id)await saveActuals(form,false);
    navigate('plan-edit',selected().id);
  }
  else if(action==='edit-record'){document.querySelector('#actuals-form [name="record-name"]')?.focus();}
  else if(action==='cancel-record'){
    if(window.IASDPIDrafts?!await IASDPIDrafts.discardCurrent():!canLeaveRegistration())return;
    if(id){replaceProgram(await api('programs/'+id));navigate('summary',id);}else navigate('programs');
  }
  else if(action==='add-extra')throw Error('Novos detalhes devem ser adicionados como subatividades.');
  else if(action==='remove-extra'){if(!window.confirm('Remover esta atividade extra antiga ao salvar?'))return;target.closest('.actual-row').remove();markRegistrationDirty();document.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);updateActuals();}
  else if (action === 'time-now') {
    const input=target.closest('.subactivity, .actual-row').querySelector(`[name="${target.dataset.field}"]`);
    input.value=displayActualTime(actualClock(currentTime()));input.dataset.timeEdited='true';
    markRegistrationDirty();updateActuals();
  }
  else if (action === 'chronogram') {
    if(window.IASDPIOperational)await IASDPIOperational.refreshTemplates();
    window.IASDPIChronogram=null;state.selected=null;navigate('actuals',undefined,{refresh:true});
  }
  else if (action === 'actuals') navigate('actuals', id);
  else if(action==='correct-date'){
    if(!window.IASDPIDemo)throw Error('A correção está disponível apenas para registros locais deste navegador.');
    const original=await api('programs/'+id),corrected=correctedCultoDate(original);
    dateCorrection={id:original.id,version:original.version,expected:JSON.stringify(original)};
    document.querySelector('#correct-date-preview').innerHTML=`<h2 id="correct-date-title">Conferir correção de data</h2><p>Origem: localStorage deste navegador. Somente este registro será alterado.</p><p><strong>${esc(original.plan.name)}</strong> · ID: ${esc(original.id)}</p><p>03/10/2026 → <strong>10/10/2026</strong> · ${original.plan.items.length} atividades e ${original.extra_events?.length||0} eventos extras. Horários, responsáveis e observações preservados. Não cria cópia nem altera o Supabase.</p><details><summary>Ver todos os dados atuais do registro afetado</summary><pre class="date-correction-json">${esc(JSON.stringify(original,null,2))}</pre></details><h3>Prévia das atividades após a correção</h3><div class="table-scroll"><table><tbody>${summaryActivityRows(corrected)}</tbody></table></div>`;
    document.querySelector('#correct-date-dialog').showModal();
  }
  else if (action === 'new') { state.selected = null; navigate('edit'); }
  else if (action === 'models-open') {if(!IASDPIAuth.isAdmin())throw Error('Acesso exclusivo de administradores.');if(window.IASDPIOperational)await IASDPIOperational.refreshTemplates();navigate('models');}

  else if (action === 'programs') navigate('programs');
  else if (['edit','summary','track'].includes(action)) navigate(action === 'track' ? 'tracking' : action, id);
  else if (action === 'duplicate') {
    state.duplicate = id;
    document.querySelector('#duplicate-form').elements.date.value = displayDate(today());
    document.querySelector('#duplicate-dialog').showModal();
  } else if (action === 'close-dialog') document.querySelector('#duplicate-dialog').close();
  else if (action === 'add-item') {
    const container = document.querySelector('#items-editor');
    container.insertAdjacentHTML('beforeend', itemEditor({}, container.children.length));
    document.querySelectorAll('#program-form .form-grid [name="start"],#program-form .form-grid [name="end"]').forEach(input=>input.required=true);
    container.lastElementChild.querySelector('[name="activity"]').focus();
  } else if (['remove-item','up','down'].includes(action)) {
    const row = target.closest('.item-editor');
    if (action === 'remove-item') {row.remove();toast('Atividade removida. Salve a programação para confirmar a alteração.');}
    if (action === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
    if (action === 'down' && row.nextElementSibling) row.nextElementSibling.after(row);
    document.querySelectorAll('.item-number').forEach((n,i) => { n.textContent = i+1; });
  } else if (action === 'refresh'||action==='retry-programs') { await loadPrograms({renderState:true}); render(); toast('Registros carregados.'); }
  else if (['ready','start','next','pause','resume'].includes(action)) {
    let p = state.programs.find(p => p.id === id);
    const notesForm = document.querySelector('#notes-form');
    if (notesForm?.dataset.id === id && (notesForm.elements.note.value !== p.note || notesForm.elements.incident.value !== p.incident)) {
      p = await api(`programs/${id}/notes`, 'PUT', {version:Number(notesForm.dataset.version), note:notesForm.elements.note.value, incident:notesForm.elements.incident.value});
      replaceProgram(p); notesForm.dataset.version = p.version;
    }
    const updated = await api(`programs/${id}/action`, 'POST', {action, version:p.version});
    replaceProgram(updated); navigate(updated.status === 'Finalizada' ? 'summary' : 'tracking', id,{refresh:true});
    toast({'ready':'Programação pronta para acompanhar.','start':'Culto iniciado.','pause':'Acompanhamento pausado.','resume':'Acompanhamento retomado.','next':updated.status==='Finalizada'?'Programação finalizada. Resumo disponível.':'Atividade finalizada. Próxima atividade iniciada.'}[action]);
  }
}
async function guarded(task, trigger) {
  if (state.busy) return;
  state.busy = true;
  app.setAttribute('aria-busy','true');
  const originalLabel=trigger?.textContent;
  if(trigger)trigger.textContent='Processando…';
  const pending=setTimeout(()=>toast('Processando…'),200);
  const buttons = [...document.querySelectorAll('button, input, textarea, select')].filter(b => !b.disabled);
  buttons.forEach(b => { b.disabled = true; });
  try { await task(); } catch (error) {
    toast(error.message, true);
    const form=trigger?.closest('form');
    if(form?.id==='actuals-form'&&trigger?.type==='submit')setRegistrationSaveState(form,'error','Não foi possível '+(trigger.name==='finalize'?'finalizar':'salvar')+'. Alterações preservadas; revise a mensagem no formulário e tente novamente.');
    if(form){let feedback=form.querySelector('.form-error');if(!feedback){feedback=document.createElement('p');feedback.className='form-error';feedback.setAttribute('role','alert');form.prepend(feedback);}feedback.textContent=error.message;}
    if(error.code==='40001'&&['actuals-form','program-form','notes-form'].includes(form?.id))try{await IASDPIConflicts.open(form,error);}catch(comparisonError){toast('Comparação indisponível. Os campos e rascunhos foram preservados. '+comparisonError.message,true);}
    // Atualiza a versão em memória sem substituir campos que o usuário está editando.
    if(IASDPIAuth.allowed()&&!['password-request-form','password-reset-form'].includes(form?.id)&&state.programsLoad.status!=='error')try { await loadPrograms(); } catch (_) { /* preservar campos e exibir erro ao consultar as listas */ }
  } finally { clearTimeout(pending);if(notice.textContent==='Processando…')notice.hidden=true;state.busy=false;app.removeAttribute('aria-busy');if(trigger?.isConnected)trigger.textContent=originalLabel;buttons.forEach(b=>{b.disabled=false;});if(trigger?.isConnected&&document.activeElement===document.body)trigger.focus();drainNavigation(); }
}
app.addEventListener('click', event => { const link=event.target.closest('[data-auth-page]');if(link){event.preventDefault();navigate(link.dataset.authPage);return;}const target = event.target.closest('[data-action]'); if(target?.dataset.action==='history-clear'&&IASDPIAuth.allowed()){IASDPIHistory.clear();return;}if (target) guarded(() => handleAction(target), target); });
app.addEventListener('toggle',event=>{if(event.target.matches('.item-details'))event.target.querySelector('.item-edit-label').textContent=event.target.open?'Recolher':'Editar';},true);
app.addEventListener('input', event => {IASDPIHistory.input(event.target);if(event.target.dataset.realTime){event.target.dataset.timeEdited='true';delete event.target.dataset.conflictClock;}clearFieldError(event.target);event.target.closest('form')?.querySelector('.form-error')?.remove();if(event.target.closest('#actuals-form')){markRegistrationDirty();updateActuals();}const row=event.target.closest('.item-editor');if(row)updateItemOverview(row);});
 document.addEventListener('invalid',event=>{if(event.target.matches('input,textarea,select')){event.preventDefault();if(event.target.closest('#actuals-form'))setRegistrationSaveState(event.target.closest('form'),'error','Revise o campo indicado. O registro ainda não foi finalizado.');fieldError(event.target,event.target.validity.valueMissing?'Preencha este campo obrigatório.':event.target.hasAttribute('data-planned-time')?'Use o formato 24 horas HH:mm (ex.: 14:05).':event.target.validationMessage);}},true);
app.addEventListener('change', event => {if(event.target.closest('#actuals-form')){markRegistrationDirty();updateActuals();}if(['agenda-area','agenda-department','agenda-show-people','agenda-month-picker'].includes(event.target.id)){const id=event.target.id;if(id==='agenda-area')agendaState.area=event.target.value;else if(id==='agenda-department')agendaState.department=event.target.value;else if(id==='agenda-show-people')agendaState.showPeople=event.target.checked;else if(event.target.value)selectAgendaMonth(event.target.value);render();document.getElementById(id)?.focus();return;} if (event.target.name === 'date') updateWeekday(); if(event.target.name==='responsible-option'){const input=event.target.closest('.actual-row').querySelector('[name="responsible-name"]');input.hidden=event.target.value!=='other';if(!input.hidden)input.focus();} });
document.querySelector('#duplicate-dialog').addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) guarded(()=>handleAction(target),target); });
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if(form.id==='history-filters'){IASDPIHistory.apply(form);return;}
  const finalize = event.submitter?.name === 'finalize';
  const draftSave=window.IASDPIDrafts?.beginSave(form);
  const actionButton=event.submitter||(form.id==='actuals-form'?form.querySelector('[name="save"]'):null);
  if(form.id==='actuals-form'&&!state.busy)setRegistrationSaveState(form,'saving',finalize?'Finalizando registro… Aguarde a confirmação.':'Salvando alterações… Aguarde a confirmação.');
  guarded(async () => {
    if(form.id==='password-request-form'){const message=await IASDPIAuth.requestPasswordReset(form.elements.email.value.trim());form.querySelector('.password-feedback').textContent=message;form.reset();return;}
    if(form.id==='password-reset-form'){if(form.elements.password.value!==form.elements.repeat.value)throw fieldError(form.elements.repeat,'As senhas devem ser iguais.');const password=form.elements.password.value;form.reset();try{await IASDPIAuth.updatePassword(password);}catch(error){if(!IASDPIAuth.passwordRecoveryActive())render();throw error;}navigate('login',undefined,{replace:true,refresh:true});toast('Senha redefinida. Entre com sua nova senha.');return;}
    if(form.id==='invite-signup-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.signup(form.elements.email.value,password,form.elements['public-key']?.value);
      toast('Se o cadastro puder ser concluído, siga as instruções do e-mail. Após confirmar, reabra o convite e entre.');return;
    }
    if(form.id==='invite-login-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.login(form.elements.email.value,password,form.elements['public-key']?.value,usersState.inviteToken);
      usersState.inviteToken='';cloudState.session=IASDPIAuth.session();navigate('home');await boot();return;
    }
    if(form.id==='auth-login-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.login(form.elements.email.value,password,form.elements['public-key']?.value);
      cloudState.session=IASDPIAuth.session();state.page='home';await boot();return;
    }
    if(form.id==='actuals-form'&&window.IASDPIOperational){await saveActuals(form,finalize,draftSave);return;}
    if(!(window.IASDPIOperational&&['program-form','notes-form'].includes(form.id)))await IASDPIAuth.requireAccess();
    if(form.id.startsWith('users-')||form.classList.contains('user-access-form')){await submitUsersForm(form);return;}
    if(form.id==='operational-template-form'){await IASDPIOperational.saveTemplate(form);return;}
    if(form.id==='backup-export-form'){if(form.elements.password.value!==form.elements.repeat.value)throw fieldError(form.elements.repeat,'As senhas devem ser iguais.');await downloadBackup(await encryptBackup(await backupPayload(),form.elements.password.value));form.reset();toast('Backup preparado para download. Confira o arquivo na pasta Downloads.');return;}
    if(form.id==='backup-restore-form'){const file=form.elements.file.files[0];if(!file||file.size>20971520)throw Error('Escolha um backup JSON de até 20 MB.');const data=await decryptBackup(JSON.parse(await file.text()),form.elements.password.value);const result=await restoreBackup(data);render();toast(result.preview?'Confira a prévia e confirme os registros que deseja importar.':`${result.added} registros restaurados; ${result.copies} cópias diferentes preservadas.`);return;}
    if(form.id==='open-record-form'){navigate('actuals',form.elements['record-id'].value);return;}
    if(form.id==='new-record-form'){
      window.IASDPIChronogram=await draftFromTemplate(form.elements['template-id'].value);
      if(window.IASDPIOperational){const p=await api('programs','POST',window.IASDPIChronogram);replaceProgram(p);navigate('actuals',p.id,{replace:true,refresh:true});toast('Novo registro confirmado no Supabase.');}
      else{state.selected=null;navigate('actuals',undefined,{refresh:true});}return;
    }
    if (form.id === 'actuals-form') { await saveActuals(form, finalize); return; }
    const id = form.dataset.id;
    if (form.id === 'program-form') {
      const get = name => form.querySelector(`[name="${name}"]`).value;
      const plan = {name:get('name'), date:readDateField(form.querySelector('[name="date"]')),template_id:selected()?.plan.template_id, start:get('start'), end:get('end'), team:Object.fromEntries(roles.map((role,i) => [role,get(`team-${i}`)])), items: [...form.querySelectorAll('.item-editor')].map(row => ({id:row.dataset.itemId, ...Object.fromEntries([...row.querySelectorAll('input')].map(input => [input.name,input.value]))}))};
      validateProgramForm(form,plan);
      if (id) plan.version = Number(form.dataset.version);
      let p = await api(id ? `programs/${id}` : 'programs', id ? 'PUT' : 'POST', plan);
      await window.IASDPIDrafts?.bind(form,p,draftSave?.context);
      if (form.elements.ready.checked) p = await api(`programs/${p.id}/action`, 'POST', {action:'ready', version:p.version});
      const newer=await window.IASDPIDrafts?.saved(draftSave,p);
      const stillEditing=form.isConnected,previousSelected=state.selected;replaceProgram(p);
      if(!stillEditing)state.selected=previousSelected;else if(!newer)navigate(p.execution_mode==='manual'?'actuals':'programs',p.id);
      toast(newer?'Envio confirmado. Há alterações mais recentes preservadas em rascunho.':'Programação salva.');
    } else if (form.id === 'notes-form') {
      const p = await api(`programs/${id}/notes`, 'PUT', {version:Number(form.dataset.version), note:form.elements.note.value, incident:form.elements.incident.value});
      const newer=await window.IASDPIDrafts?.saved(draftSave,p);
      const previousSelected=state.selected;replaceProgram(p);if(!form.isConnected)state.selected=previousSelected;
      form.dataset.version = p.version; toast(newer?'Envio confirmado. Há alterações mais recentes preservadas em rascunho.':'Observações salvas.');
    }
  }, actionButton);
});
document.querySelector('#duplicate-form').addEventListener('submit', event => {
  event.preventDefault();
  guarded(async () => {
    const p = await api(`programs/${state.duplicate}/duplicate`, 'POST', {date:readDateField(event.target.elements.date)});
    document.querySelector('#duplicate-dialog').close(); replaceProgram(p); navigate('edit', p.id); toast('Planejamento duplicado.');
  }, event.submitter);
});
function openNavigation(page){
  if(state.busy||bootInProgress){pendingNavigation=page;toast('Carregando… A página escolhida abrirá em seguida.');return;}
  if(page==='actuals')void guarded(()=>handleAction({dataset:{action:'chronogram'}}));
  else navigate(page);
}
function drainNavigation(){
  if(!pendingNavigation||state.busy||bootInProgress)return;
  const page=pendingNavigation;pendingNavigation=null;
  if(IASDPIAuth.allowed()||IASDPIAuth.isPublic(page))openNavigation(page);
}
document.querySelector('nav').addEventListener('click', event => { const link = event.target.closest('a[data-page]'); if(link){event.preventDefault();openNavigation(link.dataset.page);} });

function boot(){
  if(!bootTask)bootTask=performBoot().finally(()=>{bootTask=null;drainNavigation();});
  return bootTask;
}
async function performBoot() {
  bootInProgress=true;
  await IASDPIAuth.handlePasswordCallback();
  if(!IASDPIAuth.allowed()){
    pendingNavigation=null;
    const requested=location.hash.slice(1).split('/')[0]||'organization';
    state.page=IASDPIAuth.isPublic(requested)?requested:'login';render();
  }
  if(window.IASDPIConfig?.environment==='validation'&&!document.querySelector('#validation-banner')){
    const banner=document.createElement('aside');banner.id='validation-banner';banner.className='demo-banner';
    banner.textContent='VALIDAÇÃO DO LOGIN · Supabase somente para login e consultas. Registros continuam neste navegador; exporte um backup em Arquivo e banco.';
    document.querySelector('.header').after(banner);
  }
  if(window.IASDPIConfig?.environment==='homologation'&&!document.querySelector('#homologation-banner')){
    const banner=document.createElement('aside');banner.id='homologation-banner';banner.className='demo-banner';
    banner.textContent='HOMOLOGAÇÃO · Login e consultas. Alterações no Supabase bloqueadas nesta interface; registros locais separados do site principal.';
    document.querySelector('.header').after(banner);
  }
  try {
    try{await IASDPIAuth.restore();}catch(_){}
    const health = await api('health'); state.zone = health.timezone; state.offset = new Date(health.server_time).getTime() - Date.now();
    captureInvite(location.hash.slice(1));const requested=location.hash.slice(1).split('/');
    state.page=requested[0]&&requested[0]!=='login'?requested[0]:IASDPIAuth.allowed()?'home':'organization';
    if(requested[1])state.selected=requested[1];
    if(IASDPIAuth.allowed())await loadPrograms({renderState:true});
    state.selected = state.programs.find(p => p.status === 'Em andamento')?.id || state.programs.find(p => p.status === 'Pronta')?.id || null;
    captureInvite(location.hash.slice(1)); const [page,id] = location.hash.slice(1).split('/');
    if(id)state.selected=id;
    if (page === 'actuals' && !id) state.selected = null;
    // A rota atual é restaurada; novos cultos escolhem modelo e usam a data de São Paulo.
    state.page = ['home','programs','tracking','history','edit','summary','actuals','agendas','archive','organization','login','users','invite','plan-edit','trash','models','forgot-password','reset-password'].includes(page) ? (page==='login'&&IASDPIAuth.allowed()?'home':page) : IASDPIAuth.allowed()?'home':'organization'; bootInProgress=false;IASDPINavigation.start();render();
  } catch (error) {
    bootInProgress=false;
    if(IASDPIAuth.allowed())state.programsLoad={status:'error',error:error.message};
    render();toast(error.message,true);
  } finally {bootInProgress=false;}
}
window.addEventListener('iasdpi-auth-changed',()=>{
  cloudState.session=IASDPIAuth.session();cloudState.archives=[];cloudState.loaded=false;cloudState.loading=false;cloudState.error='';resetUsers();
  if(!IASDPIAuth.allowed()){
    programsLoadGeneration++;state.programsLoad={status:'idle',error:''};
    pendingNavigation=null;
    registrationDirty=false;state.programs=[];state.selected=null;state.duplicate=null;window.IASDPIChronogram=null;
    dateCorrection=null;document.querySelector('#correct-date-dialog').close();document.querySelector('#correct-date-preview').replaceChildren();
    document.querySelector('#duplicate-dialog').close();
    render();
  }
});
window.addEventListener('iasdpi-role-changed',()=>{resetUsers();render();});
document.querySelector('#auth-logout').addEventListener('click',()=>{
  guarded(async()=>{if(await IASDPIAuth.logout()===false)return;state.page='organization';navigate('organization');});
});
setInterval(tick, 1000);
let dateCorrection=null;
document.querySelector('#correct-date-dialog').addEventListener('close',()=>{dateCorrection=null;document.querySelector('#correct-date-preview').replaceChildren();});
document.querySelector('#correct-date-cancel').addEventListener('click',()=>{dateCorrection=null;document.querySelector('#correct-date-dialog').close();});
document.querySelector('#correct-date-confirm').addEventListener('click',()=>guarded(async()=>{
  if(!dateCorrection||!window.IASDPIDemo)throw Error('Reabra a prévia do registro local.');
  const p=await api('programs/'+dateCorrection.id+'/correct-date','PUT',dateCorrection);
  dateCorrection=null;document.querySelector('#correct-date-dialog').close();replaceProgram(p);navigate('summary',p.id,{refresh:true});
  toast('Data corrigida para 10/10/2026 neste navegador. Nenhum culto foi duplicado. Exporte um novo backup.');
}));
window.addEventListener('iasdpi-session-status',()=>{
  let banner=document.querySelector('#session-status');
  if(!banner){banner=document.createElement('aside');banner.id='session-status';banner.className='demo-banner';banner.setAttribute('role','status');document.querySelector('.header').after(banner);}
  const status=IASDPIAuth.status();banner.hidden=status.phase==='authenticated'||status.phase==='anonymous';banner.textContent=status.message;
  const recovered=IASDPIAuth.allowed()&&!sessionWasAuthorized;sessionWasAuthorized=IASDPIAuth.allowed();
  if(recovered&&!state.busy&&!bootInProgress)void boot();
});
boot();

document.addEventListener('focusout',event=>{if(event.target.matches('[data-date-input]')){const iso=tryReadDate(event.target.value);if(iso)event.target.value=displayDate(iso);}});
