'use strict';
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const state = { programs: [], selected: null, page: 'home', busy: false, zone: 'America/Sao_Paulo', offset: 0, duplicate: null };
const thresholds = { onTime: 1, attention: 5 };
const roles = ['Ancião do mês', 'Recepção', 'Diácono', 'Diaconisa', 'Diretor de culto', 'Sonoplastia', 'Equipe de louvor', 'Responsável pela programação'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const minutes = (end, start) => (new Date(end) - new Date(start)) / 60000;
const currentTime = () => new Date(Date.now() + state.offset);
const clock = value => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: state.zone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const dateLabel = value => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: state.zone }).format(currentTime());
const signed = value => { const n = Math.round(value); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} min`; };
const duration = value => `${Math.round(value)} min`;
const elapsed = start => { const seconds = Math.max(0, Math.floor((currentTime() - new Date(start)) / 1000)); return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2, '0')}`; };
function statusTone(value) { const n = Math.round(value); return n <= thresholds.onTime ? 'good' : n <= thresholds.attention ? 'warning' : 'critical'; }
function delayLabel(value) { const n = Math.round(value); return n < 0 ? `${Math.abs(n)} min adiantado` : n <= 1 ? 'No horário' : `${n} min de atraso`; }
function toast(message, error = false) {
  notice.textContent = message; notice.className = error ? 'error' : ''; notice.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}
async function api(path = '', method = 'GET', body) {
  if (window.IASDPIDemo) return window.IASDPIDemo.request(path, method, body);
  const response = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}
function selected() { return state.programs.find(p => p.id === state.selected); }
function replaceProgram(program) {
  const i = state.programs.findIndex(p => p.id === program.id);
  if (i < 0) state.programs.unshift(program); else state.programs[i] = program;
  state.selected = program.id;
}
function executionInfo(p) {
  const items = p.plan.items;
  const active = p.execution_mode === 'manual' ? null : items.find(i => p.executions[i.id] && !p.executions[i.id].ended);
  const pending = items.find(i => !p.executions[i.id]);
  const finished = items.filter(i => p.executions[i.id]?.ended);
  const records = Object.values(p.extra_events?.length?registrationData(p).executions:p.executions);
  const first = [...records].sort((a,b) => new Date(a.started)-new Date(b.started))[0];
  const last = records.filter(e => e.ended).sort((a,b) => new Date(b.ended)-new Date(a.ended))[0];
  let shift = 0;
  if (p.status === 'Finalizada' && last) shift = minutes(last.ended, p.planned_end);
  else if (active) {
    const e = p.executions[active.id];
    const plannedDuration = minutes(active.planned_end, active.planned_start);
    shift = minutes(e.started, active.planned_start) + Math.max(0, minutes(currentTime(), e.started) - plannedDuration);
  } else if (p.plan.date === today() && p.status === 'Pronta') {
    shift = Math.max(0, minutes(currentTime(), p.planned_start));
  }
  const origin = items.find(i => {
    const e = p.executions[i.id];
    return e && (minutes(e.started, i.planned_start) > thresholds.onTime || (e.ended && minutes(e.ended, i.planned_end) > thresholds.onTime));
  }) || (active && shift > thresholds.onTime ? active : null);
  const expected = items.find(i => currentTime() >= new Date(i.planned_start) && currentTime() < new Date(i.planned_end));
  const forecast = new Date(new Date(p.planned_end).getTime() + shift * 60000);
  return { active, pending, finished, first, last, shift, origin, expected, forecast };
}
function badge(value, label = delayLabel(value)) { return `<span class="badge ${statusTone(value)}">${esc(label)}</span>`; }
function heading(eyebrow, title, description = '', action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}</div>${action}</div>`;
}
function empty(title, description, action = '') { return `<div class="empty"><h2>${title}</h2><p>${description}</p>${action}</div>`; }
function button(label, action, id = '', extra = '') { return `<button type="button" data-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`; }
function programDate(value) {
  const day=new Date(`${value}T12:00:00Z`);
  return `${new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(day)} · ${new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(day)}`;
}
function programStatus(p) {
  const tone={'Planejamento':'neutral','Pronta':'good','Em andamento':'warning','Finalizada':'complete'}[p.status] || 'neutral';
  return `<span class="badge ${tone}">${esc(p.status==='Planejamento'?'Rascunho':p.status)}</span>`;
}
function programRow(p, historic = false) {
  const m = executionInfo(p);
  const planned = minutes(p.planned_end, p.planned_start);
  const actual = m.first && m.last ? minutes(m.last.ended, m.first.started) : null;
  return `<tr><td><strong>${esc(p.plan.name)}</strong><small>${esc(programDate(p.plan.date))}</small></td>
    <td>${esc(p.plan.start)} → ${esc(p.plan.end)}${historic ? `<small>${duration(planned)} previstos · ${actual === null ? '—' : duration(actual)} realizados</small>` : ''}</td>
    <td>${historic ? badge(m.shift, signed(m.shift)) : `${programStatus(p)}`}</td>
    <td class="row-actions">${button(historic || p.status==='Finalizada' ? 'Ver resumo' : ['Planejamento','Pronta'].includes(p.status) ? 'Editar' : 'Ver programação', historic || p.status==='Finalizada' ? 'summary' : 'edit', p.id)}${button('Duplicar', 'duplicate', p.id)}${!historic ? button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"') : ''}</td></tr>`;
}
function programTable(programs, historic = false) {
  return `<div class="table-scroll"><table><thead><tr><th>Programação</th><th>Horário ${historic ? '/ duração' : 'previsto'}</th><th>${historic ? 'Desvio do término' : 'Status'}</th><th>Ações</th></tr></thead><tbody>${programs.map(p => programRow(p, historic)).join('')}</tbody></table></div>`;
}
function home() {
  const upcoming = state.programs.filter(p => p.status !== 'Finalizada' && p.plan.date >= today())
    .sort((a, b) => `${a.plan.date} ${a.plan.start}`.localeCompare(`${b.plan.date} ${b.plan.start}`))[0];
  const running = state.programs.find(p => p.status === 'Em andamento');
  const featured = running || upcoming;
  const recent = state.programs.filter(p => p.status === 'Finalizada').sort((a,b) => b.plan.date.localeCompare(a.plan.date)).slice(0, 5);
  return heading('BEM-VINDO', 'Cada momento, no seu tempo.', 'Uma programação clara. Um acompanhamento tranquilo.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto · 03/10/2026', 'chronogram')}</div>`) +
    (featured ? `<section class="featured"><div><p class="eyebrow">${running ? 'EM ANDAMENTO' : 'PRÓXIMO CULTO'}</p><h2>${esc(featured.plan.name)}</h2><div class="featured-meta"><p class="date">${esc(programDate(featured.plan.date))}</p>${programStatus(featured)}</div><p class="large-time">${esc(featured.plan.start)} <span>→</span> ${esc(featured.plan.end)}</p><div class="actions">${button('Abrir programação', 'edit', featured.id)}${button(featured.execution_mode==='manual'?'Registrar culto':running?'Continuar acompanhamento':'Acompanhar culto', featured.execution_mode==='manual'?'actuals':'track', featured.id, 'class="primary"')}</div></div><div class="featured-aside"><span class="eyebrow">PLANEJAMENTO</span><strong>${featured.plan.items.length}</strong><span>momentos organizados</span></div></section>` : empty('Vamos preparar a próxima programação?', 'Use Nova programação para planejar ou Registrar culto para informar o que aconteceu.')) +
    `<section class="section"><div class="section-heading"><h2>Últimas programações</h2>${recent.length ? `<span class="muted">Desvio médio do término: ${signed(recent.reduce((sum,p) => sum + executionInfo(p).shift, 0)/recent.length)}</span>` : ''}</div>${recent.length ? programTable(recent, true) : '<p class="muted">Os resumos aparecerão aqui após finalizar uma programação.</p>'}</section>`;
}
function programsPage() {
  const list = [...state.programs].sort((a,b) => b.plan.date.localeCompare(a.plan.date));
  return heading('PLANEJAMENTO', 'Programações', 'Organize horários, atividades e responsáveis.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto · 03/10/2026', 'chronogram')}</div>`) +
    (list.length ? programTable(list) : empty('Nenhuma programação cadastrada', 'Use Nova programação para cadastrar os horários e as atividades.'));
}
function field(label, name, value = '', type = 'text', required = false, extra = '') {
  return `<label><span class="field-label">${label}${required?' <span class="required-marker" aria-hidden="true">*</span><span class="sr-only"> (obrigatório)</span>':''}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${extra}></label>`;
}
function itemEditor(i = {}, index = 0) {
  const complete=Boolean(i.activity && i.start && i.end);
  return `<fieldset class="item-editor" data-item-id="${esc(i.id || crypto.randomUUID())}"><legend>Atividade <span class="item-number">${index+1}</span></legend>
    <details class="item-details" ${complete?'':'open'}><summary><span class="item-overview"><strong class="item-overview-title">${esc(i.start || '—')} → ${esc(i.end || '—')} · ${esc(i.activity || 'Nova atividade')}</strong><small class="item-overview-responsible">${esc(i.responsible || 'Responsável opcional')}</small></span><span class="item-edit-label">Editar</span></summary>
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
  const check=(input,message)=>{throw fieldError(input,message);};
  if(plan.end<=plan.start)check(form.querySelector('.form-grid [name="end"]'),'O término deve ser depois do início.');
  if(!plan.name.trim())check(form.querySelector('[name="name"]'),'Informe o nome da programação.');
  const rows=[...form.querySelectorAll('.item-editor')];
  if(!rows.length){form.querySelector('[data-action="add-item"]').focus();throw Error('Adicione pelo menos uma atividade.');}
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
function editor(p) {
  if (p?.execution_mode === 'manual') return actualsForm(p);
  if (p && !['Planejamento', 'Pronta'].includes(p.status)) return planView(p);
  const plan = p?.plan || { name: 'Culto de sábado', date: today(), start: '09:30', end: '12:25', team: {}, items: [] };
  return heading('PLANEJAMENTO', p ? 'Editar programação' : 'Nova programação', 'Planeje os horários. Campos com * são obrigatórios; a equipe é opcional.', button('Voltar', 'programs')) +
    `<form id="program-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="panel form-grid">${field('Nome da programação', 'name', plan.name, 'text', true, 'maxlength="200"')}${field('Data', 'date', plan.date, 'date', true)}${field('Início previsto', 'start', plan.start, 'time', true)}${field('Término previsto', 'end', plan.end, 'time', true)}<p id="weekday" class="muted"></p></section>
      <details class="panel"><summary>Equipe <span class="muted">· preenchimento opcional</span></summary><div class="form-grid team">${roles.map((role,i) => field(role, `team-${i}`, plan.team[role], 'text', false, 'maxlength="200"')).join('')}</div></details>
      <div class="section-heading"><h2>Itens da programação</h2>${button('+ Adicionar atividade', 'add-item')}</div><p class="muted">A ordem deve acompanhar os horários. Intervalos são permitidos; sobreposições, não.</p>
      <datalist id="blocks"><option value="Culto"><option value="Escola Sabatina"></datalist>
      <div id="items-editor">${(plan.items.length ? plan.items : [{}]).map(itemEditor).join('')}</div>
      <div class="actions form-footer"><button class="primary" type="submit">Salvar programação</button><label class="checkbox"><input name="ready" type="checkbox" ${p?.status === 'Pronta' ? 'checked' : ''}> Liberar para acompanhamento após salvar</label><p class="muted ready-help">Ao marcar, o sistema salva o planejamento e depois altera o status para Pronta.</p></div>
    </form>`;
}
function planView(p) {
  return heading('PROGRAMAÇÃO', esc(p.plan.name), esc(dateLabel(p.plan.date)), `${button('Duplicar', 'duplicate', p.id)} ${button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"')}`) +
    `<p class="muted">Planejamento protegido após o início. Horário previsto: ${esc(p.plan.start)} → ${esc(p.plan.end)}.</p>` + timeline(p) +
    `<details class="panel"><summary>Equipe</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role)}</dt><dd>${esc(p.plan.team[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>`;
}
function timeline(p) {
  let block = '';
  return `<section class="section"><div class="section-heading"><h2>Linha da programação</h2><span class="muted">✓ Finalizado · ● Em andamento · ○ Pendente</span></div><ol class="timeline">${p.plan.items.map(i => {
    const e = p.executions[i.id];
    const done = Boolean(e?.ended), active = e && !done;
    const diff = done ? minutes(e.ended, i.planned_end) : e ? minutes(e.started, i.planned_start) : 0;
    const blockLabel = block !== i.block ? `<li class="block-label">${esc(i.block)}</li>` : ''; block = i.block;
    return `${blockLabel}<li class="timeline-row ${active ? 'active' : ''}"><span class="timeline-symbol" aria-label="${done ? 'Finalizado' : active ? 'Em andamento' : 'Pendente'}">${done ? '✓' : active ? '●' : '○'}</span><div class="timeline-time">${esc(i.start)}<small>${esc(i.end)}</small></div><div class="timeline-content"><strong>${esc(i.activity)}</strong><span>${esc(i.responsible || 'Responsável não informado')}</span><small>Previsto: ${esc(i.start)} → ${esc(i.end)}${e ? ` · Real: ${clock(e.started)} → ${e.ended ? clock(e.ended) : 'em andamento'}` : ''}</small>${i.note ? `<small>${esc(i.note)}</small>` : ''}</div>${e ? badge(diff, done ? `${signed(diff)} no término` : `${signed(diff)} no início`) : '<span class="badge neutral">Pendente</span>'}</li>`;
  }).join('')}</ol></section>`;
}
function notes(p) {
  return `<section class="section"><h2>Observações e ocorrências</h2><form id="notes-form" data-id="${esc(p.id)}" data-version="${p.version}"><div class="notes-grid"><div><label for="execution-note">Observações</label><textarea id="execution-note" name="note" maxlength="5000" rows="3" placeholder="Registre o que ajudou ou afetou a programação.">${esc(p.note)}</textarea></div><div><label for="execution-incident">Ocorrência não prevista</label><textarea id="execution-incident" name="incident" maxlength="5000" rows="3" placeholder="Ex.: comunicação adicionada após os anúncios.">${esc(p.incident)}</textarea></div></div><button type="submit">Salvar observações</button></form></section>`;
}
function tracking(p) {
  if (p?.execution_mode === 'manual') return actualsForm(p);
  if (!p) return heading('EXECUÇÃO', 'Acompanhar culto', 'Use esta tela durante o culto para iniciar, avançar e pausar as atividades.') + empty('Escolha uma programação', 'Abra uma programação pronta para acompanhar.', button('Ver programações', 'programs', '', 'class="primary"'));
  if (p.status === 'Finalizada') return summary(p);
  const m = executionInfo(p);
  const focus = m.active || m.expected || m.pending;
  const index = focus ? p.plan.items.indexOf(focus) : -1;
  const next = p.plan.items[index + 1];
  const e = focus && p.executions[focus.id];
  const dateMismatch = p.plan.date !== today();
  return heading('EXECUÇÃO', 'Acompanhar culto', `${esc(dateLabel(p.plan.date))} · ${esc(p.plan.name)} · Controle durante a execução.`, button('Atualizar', 'refresh')) +
    `<div class="planned-bar"><span>Previsto <strong>${esc(p.plan.start)} → ${esc(p.plan.end)}</strong></span>${programStatus(p)}</div>
    <section class="metrics" aria-label="Situação da programação"><div><span>HORÁRIO ATUAL</span><strong data-live="clock">${clock(currentTime())}</strong></div><div><span>DESVIO DO HORÁRIO</span><strong data-live="shift" class="${statusTone(m.shift)}">${signed(m.shift)}</strong><small data-live="status">${delayLabel(m.shift)}</small></div><div><span>PREVISÃO DE TÉRMINO</span><strong data-live="forecast">${p.status === 'Planejamento' ? '—' : clock(m.forecast)}</strong></div></section>
    <p class="context-line">Pelo plano, agora: <strong data-live="expected">${esc(m.expected?.activity || (dateMismatch ? 'outra data' : 'intervalo ou fora da programação'))}</strong></p>
    <section class="current-activity"><p class="eyebrow" data-live="focus-label">${m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE'}</p><h2 data-live="activity">${esc(focus?.activity || 'Sem atividades')}</h2><p class="responsible" data-live="responsible">${esc(focus?.responsible || 'Responsável não informado')}</p><div class="current-details"><div><span>Planejado</span><strong data-live="period">${esc(focus?.start || '—')} → ${esc(focus?.end || '—')}</strong></div><div><span>Início real</span><strong>${clock(e?.started)}</strong></div><div><span>Tempo transcorrido</span><strong data-live="elapsed">${e ? elapsed(e.started) : '—'}</strong></div></div><p data-live="item-note">${esc(focus?.note || '')}</p><p class="muted" data-live="origin">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}.` : 'Nenhum atraso registrado.'}</p></section>
    ${next ? `<section class="next-activity" data-next><span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(next.start)}</strong></section>` : '<p class="muted" data-next>Última atividade da programação.</p>'}
    <div class="execution-actions">${p.status === 'Planejamento' ? button('Marcar programação como pronta', 'ready', p.id, 'class="primary big"') : m.active ? (p.paused ? button('Retomar acompanhamento', 'resume', p.id, 'class="primary big"') : button(m.pending ? 'Finalizar e avançar' : 'Finalizar programação', 'next', p.id, 'class="primary big"')) : button(`Iniciar atividade${m.expected && m.expected.id !== m.pending?.id ? ` · ${esc(m.pending.activity)}` : ''}`, 'start', p.id, `class="primary big" ${dateMismatch ? 'disabled' : ''}`)}${m.active && !p.paused ? button('Pausar acompanhamento', 'pause', p.id) : ''}${button('Voltar', 'programs')}</div>
    ${dateMismatch ? '<p class="muted">O início será liberado na data da programação. Para testar hoje, duplique com a data de hoje.</p>' : ''}${p.paused ? '<p class="pause-note">Acompanhamento pausado. O tempo real continua contando; a pausa não altera o planejamento nem exclui tempo do culto.</p>' : ''}
    ${timeline(p)}${notes(p)}`;
}
function summary(p) {
  const m = executionInfo(p);
  const plannedDuration = minutes(p.planned_end, p.planned_start);
  const actualDuration = m.first && m.last ? minutes(m.last.ended, m.first.started) : null;
  return heading('PLANEJADO × REALIZADO', 'Resumo da programação', `${esc(p.plan.name)} · ${esc(dateLabel(p.plan.date))}`, `${button('Duplicar programação', 'duplicate', p.id)} ${p.execution_mode === 'manual' ? button('Editar registro', 'actuals', p.id) : ''}`) +
    `<section class="summary-grid">${[['Início planejado', p.plan.start], ['Início real', clock(m.first?.started)], ['Término planejado', p.plan.end], ['Término real', clock(m.last?.ended)], ['Duração planejada', duration(plannedDuration)], ['Duração real', actualDuration === null ? '—' : duration(actualDuration)], ['Desvio da duração', actualDuration === null ? '—' : signed(actualDuration - plannedDuration)], ['Desvio do término', signed(m.shift)]].map(([label,value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}</section>
    <p class="muted">Desvio do término compara o relógio. Desvio da duração compara o tempo total entre o primeiro início e o último término, incluindo intervalos.</p>
    <p class="context-line">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}. Veja as observações para entender a causa.` : 'Nenhum atraso registrado.'}</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade / bloco</th><th>Horários previstos</th><th>Horários reais</th><th>Duração prevista</th><th>Duração real</th><th>Diferença de duração</th></tr></thead><tbody>${p.plan.items.map((i,index) => {
      const e = p.executions[i.id]; const planned = minutes(i.planned_end, i.planned_start); const real = e?.ended ? minutes(e.ended, e.started) : null;
      return `<tr><td><strong>${esc(activityLabel(p.plan,index))}</strong><small>${esc(i.block)} · ${esc(p.actual_details?.[i.id]?.responsible ?? i.responsible)}</small>${p.actual_details?.[i.id]?.note?`<small>${esc(p.actual_details[i.id].note)}</small>`:''}</td><td>${esc(i.start)} → ${esc(i.end)}${i.end_inferred ? ' (referência)' : ''}</td><td>${actualClock(e?.started) || '—'} → ${actualClock(e?.ended) || '—'}</td><td>${duration(planned)}</td><td>${real === null ? '—' : duration(real)}</td><td>${real === null ? '—' : badge(real - planned, signed(real - planned))}</td></tr>`;
    }).join('')}</tbody></table></div>${extraEventsSummary(p)}${transitionView([p])}${notes(p)}`;
}
const adherenceTolerance = 2;
function adherence(p) {
  const completed=p.plan.items.filter(item=>p.executions[item.id]?.ended);
  const conforming=completed.filter(item=>{
    const real=p.executions[item.id];
    return Math.abs(minutes(real.started,item.planned_start)) <= adherenceTolerance &&
      (item.end_inferred || Math.abs(minutes(real.ended,item.planned_end)) <= adherenceTolerance);
  });
  return {total:completed.length,conforming:conforming.length,percent:completed.length ? Math.round(conforming.length/completed.length*100) : 0};
}
function median(values) {
  const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}
function activityMedians(programs) {
  const groups=new Map();
  programs.forEach(p=>p.plan.items.forEach(item=>{
    const real=p.executions[item.id];if(!real?.ended)return;
    const name=item.activity.startsWith('Música Congregacional') ? 'Música Congregacional' : item.activity;
    if(!groups.has(name))groups.set(name,{name,values:[],events:new Set(),estimated:false});
    const group=groups.get(name);
    group.values.push(minutes(real.ended,real.started)-minutes(item.planned_end,item.planned_start));
    group.events.add(p.id);group.estimated ||= Boolean(item.end_inferred);
  }));
  return [...groups.values()].map(group=>({...group,median:median(group.values)}));
}
function medianView(programs) {
  const groups=activityMedians(programs);
  const label=value=>`${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString('pt-BR',{maximumFractionDigits:1})} min`;
  return `<section class="section median-section"><div class="section-heading"><h2>Mediana do desvio por atividade</h2><span class="muted">${programs.length} programações finalizadas</span></div>
    <p class="muted">Diferença entre duração realizada e prevista em cada registro de atividade. Positivo = durou mais; negativo = durou menos. As músicas congregacionais estão agrupadas, incluindo sentados e em pé.</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade</th><th>Mediana do desvio</th><th>Registros comparados</th><th>Programações</th></tr></thead><tbody>${groups.map(group=>`<tr><td>${esc(group.name)}${group.estimated?' *':''}</td><td><span class="badge ${statusTone(group.median)}">${label(group.median)}</span></td><td>${group.values.length}</td><td>${group.events.size}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">${groups.some(g=>g.estimated)?'* Atividades marcadas usam um término de referência. ':''}A mediana considera os registros, inclusive quando a atividade se repete no mesmo culto.</p></section>`;
}
function adherenceOverview() {
  const examples=state.programs.filter(p=>p.status==='Finalizada' && p.plan.items.some(i=>p.executions[i.id]?.ended)).sort((a,b)=>a.plan.date.localeCompare(b.plan.date));
  if(!examples.length)return '';
  const counts=examples.map(adherence);
  const conforming=counts.reduce((sum,a)=>sum+a.conforming,0),total=counts.reduce((sum,a)=>sum+a.total,0);
  const endOnTime=examples.filter(p=>Math.abs(executionInfo(p).shift)<=adherenceTolerance).length;
  return `<section class="section adherence-section"><div class="section-heading"><h2>Aderência à programação</h2><span class="badge neutral">${examples.length} eventos finalizados</span></div>
    <p class="muted">Aderência = atividades com início e término até ${adherenceTolerance} minutos antes ou depois do previsto. Atividades com término de referência são avaliadas somente pelo início.</p>
    <div class="metrics"><div><span>ATIVIDADES ADERENTES</span><strong>${Math.round(conforming/total*100)}%</strong><small>${conforming} de ${total} atividades</small></div><div><span>EVENTOS COM TÉRMINO ADERENTE</span><strong>${endOnTime}/${examples.length}</strong><small>Dentro da tolerância de ±${adherenceTolerance} min</small></div><div><span>DESVIO MÉDIO DO TÉRMINO</span><strong>${signed(examples.reduce((sum,p)=>sum+executionInfo(p).shift,0)/examples.length)}</strong><small>Atrasos positivos · adiantamentos negativos</small></div></div>
    <div class="table-scroll"><table><thead><tr><th>Evento</th><th>Aderência</th><th>Atividades aderentes</th><th>Desvio do término</th><th>Detalhes</th></tr></thead><tbody>${examples.map(p=>{
      const a=adherence(p);const tone=a.percent>=90?'good':a.percent>=70?'warning':'critical';
      return `<tr><td>${esc(p.plan.name)}<small>${esc(programDate(p.plan.date))}</small></td><td><span class="badge ${tone}">${a.percent}%</span></td><td>${a.conforming} / ${a.total}</td><td>${badge(executionInfo(p).shift,signed(executionInfo(p).shift))}</td><td>${button('Ver realizado','summary',p.id)}</td></tr>`;
    }).join('')}</tbody></table></div><p class="muted">Aderência: verde a partir de 90%, amarelo de 70% a 89%, vermelho abaixo de 70%. A duração total considera o intervalo do evento, sem duplicar os itens simultâneos.</p>${medianView(examples)}${transitionView(examples)}</section>`;
}
function historyPage() {
  const completed = state.programs.filter(p => p.status === 'Finalizada').sort((a,b) => b.plan.date.localeCompare(a.plan.date));
  return heading('MEMÓRIA', 'Histórico', 'Um registro simples para melhorar a próxima programação.') + adherenceOverview() + (completed.length ? programTable(completed, true) : empty('Ainda não há programações finalizadas', 'Ao finalizar a última atividade, o resumo será gerado automaticamente.'));
}
function render() {
  const activePage=state.page==='summary'?'history':['edit','tracking'].includes(state.page)&&selected()?.execution_mode==='manual'?'actuals':state.page==='edit'?'programs':state.page;
  document.querySelectorAll('nav a').forEach(a => {const active=a.dataset.page===activePage;a.classList.toggle('selected',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  app.innerHTML = ({home, programs: programsPage, history: historyPage, edit: () => editor(selected()), actuals: () => actualsForm(selected()), tracking: () => tracking(selected()), summary: () => selected() ? summary(selected()) : historyPage()}[state.page] || home)();
  updateWeekday(); updateActuals(); tick();
}
function navigate(page, id) { if (id) state.selected = id; state.page = page; window.history.replaceState(null, '', `#${page}${['edit','summary','tracking','actuals'].includes(page) && state.selected ? '/' + state.selected : ''}`); render(); app.focus({preventScroll:true}); window.scrollTo({top: 0, behavior: 'instant'}); }
function updateWeekday() {
  const form = document.querySelector('#program-form');
  const target = document.querySelector('#weekday');
  if (form && target) { const value = form.elements.date.value; target.textContent = value ? dateLabel(value) : ''; }
}
function tick() {
  const p = selected(); if (!p || state.page !== 'tracking' || p.status === 'Finalizada') return;
  const m = executionInfo(p), e = m.active && p.executions[m.active.id];
  const focus = m.active || m.expected || m.pending;
  const next = p.plan.items[p.plan.items.indexOf(focus) + 1];
  const nextElement = document.querySelector('[data-next]');
  if (nextElement && nextElement.dataset.item !== (next?.id || '')) {
    nextElement.dataset.item = next?.id || '';
    nextElement.className = 'next-activity';
    nextElement.innerHTML = next ? `<span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(next.start)}</strong>` : '<span class="muted">Última atividade da programação.</span>';
  }
  const values = {'focus-label': m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE', activity: focus?.activity || 'Sem atividades', responsible: focus?.responsible || 'Responsável não informado', period: `${focus?.start || '—'} → ${focus?.end || '—'}`, 'item-note': focus?.note || '', clock: clock(currentTime()), shift: signed(m.shift), status: delayLabel(m.shift), forecast: p.status === 'Planejamento' ? '—' : clock(m.forecast), elapsed: e ? elapsed(e.started) : '—', expected: m.expected?.activity || (p.plan.date !== today() ? 'outra data' : 'intervalo ou fora da programação'), origin: m.origin ? `Primeiro atraso observado: ${m.origin.activity}.` : 'Nenhum atraso registrado.'};
  for (const [key, value] of Object.entries(values)) {
    const element = document.querySelector(`[data-live="${key}"]`);
    if (element) { element.textContent = value; if (key === 'shift') element.className = statusTone(m.shift); }
  }
}
async function handleAction(target) {
  const {action, id} = target.dataset;
  if(action==='add-extra')addExtraEvent(target);
  else if(action==='remove-extra'){target.closest('.actual-row').remove();document.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);updateActuals();}
  else if (action === 'time-now') {
    target.closest('.actual-row').querySelector(`[name="${target.dataset.field}"]`).value=actualClock(currentTime());
    updateActuals();
  }
  else if (action === 'chronogram') {
    const existing = state.programs.find(p => p.execution_mode === 'manual' && p.plan.date === '2026-10-03' && p.plan.items.some(i => i.id === 'culto-03102026-1'));
    state.selected = existing?.id || null; navigate('actuals', existing?.id);
  }
  else if (action === 'actuals') navigate('actuals', id);
  else if (action === 'new') { state.selected = null; navigate('edit'); }
  else if (action === 'programs') navigate('programs');
  else if (['edit','summary','track'].includes(action)) navigate(action === 'track' ? 'tracking' : action, id);
  else if (action === 'duplicate') {
    state.duplicate = id;
    document.querySelector('#duplicate-form').elements.date.value = today();
    document.querySelector('#duplicate-dialog').showModal();
  } else if (action === 'close-dialog') document.querySelector('#duplicate-dialog').close();
  else if (action === 'add-item') {
    const container = document.querySelector('#items-editor');
    container.insertAdjacentHTML('beforeend', itemEditor({}, container.children.length));
    container.lastElementChild.querySelector('[name="activity"]').focus();
  } else if (['remove-item','up','down'].includes(action)) {
    const row = target.closest('.item-editor');
    if (action === 'remove-item') {row.remove();toast('Atividade removida. Salve a programação para confirmar a alteração.');}
    if (action === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
    if (action === 'down' && row.nextElementSibling) row.nextElementSibling.after(row);
    document.querySelectorAll('.item-number').forEach((n,i) => { n.textContent = i+1; });
  } else if (action === 'refresh') { state.programs = await api('programs'); render(); toast('Programação atualizada.'); }
  else if (['ready','start','next','pause','resume'].includes(action)) {
    let p = state.programs.find(p => p.id === id);
    const notesForm = document.querySelector('#notes-form');
    if (notesForm?.dataset.id === id && (notesForm.elements.note.value !== p.note || notesForm.elements.incident.value !== p.incident)) {
      p = await api(`programs/${id}/notes`, 'PUT', {version:Number(notesForm.dataset.version), note:notesForm.elements.note.value, incident:notesForm.elements.incident.value});
      replaceProgram(p); notesForm.dataset.version = p.version;
    }
    const updated = await api(`programs/${id}/action`, 'POST', {action, version:p.version});
    replaceProgram(updated); navigate(updated.status === 'Finalizada' ? 'summary' : 'tracking', id);
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
    if(form){let feedback=form.querySelector('.form-error');if(!feedback){feedback=document.createElement('p');feedback.className='form-error';feedback.setAttribute('role','alert');form.prepend(feedback);}feedback.textContent=error.message;}
    // Atualiza a versão em memória sem substituir campos que o usuário está editando.
    try { state.programs = await api('programs'); } catch (_) { /* manter dados já carregados */ }
  } finally { clearTimeout(pending);if(notice.textContent==='Processando…')notice.hidden=true;state.busy=false;app.removeAttribute('aria-busy');if(trigger?.isConnected)trigger.textContent=originalLabel;buttons.forEach(b=>{b.disabled=false;});if(trigger?.isConnected&&document.activeElement===document.body)trigger.focus(); }
}
app.addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) guarded(() => handleAction(target), target); });
app.addEventListener('toggle',event=>{if(event.target.matches('.item-details'))event.target.querySelector('.item-edit-label').textContent=event.target.open?'Recolher':'Editar';},true);
app.addEventListener('input', event => {clearFieldError(event.target);event.target.closest('form')?.querySelector('.form-error')?.remove();if(event.target.closest('#actuals-form'))updateActuals();const row=event.target.closest('.item-editor');if(row)updateItemOverview(row);});
 document.addEventListener('invalid',event=>{if(event.target.matches('input,textarea,select')){event.preventDefault();fieldError(event.target,event.target.validity.valueMissing?'Preencha este campo obrigatório.':event.target.validationMessage);}},true);
app.addEventListener('change', event => { if (event.target.name === 'date') updateWeekday(); if(event.target.name==='responsible-option'){const input=event.target.closest('.actual-row').querySelector('[name="responsible-name"]');input.hidden=event.target.value!=='other';if(!input.hidden)input.focus();} });
document.querySelector('#duplicate-dialog').addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) handleAction(target); });
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  const finalize = event.submitter?.name === 'finalize';
  guarded(async () => {
    if (form.id === 'actuals-form') { await saveActuals(form, finalize); return; }
    const id = form.dataset.id;
    if (form.id === 'program-form') {
      const get = name => form.querySelector(`[name="${name}"]`).value;
      const plan = {name:get('name'), date:get('date'), start:get('start'), end:get('end'), team:Object.fromEntries(roles.map((role,i) => [role,get(`team-${i}`)])), items: [...form.querySelectorAll('.item-editor')].map(row => ({id:row.dataset.itemId, ...Object.fromEntries([...row.querySelectorAll('input')].map(input => [input.name,input.value]))}))};
      validateProgramForm(form,plan);
      if (id) plan.version = Number(form.dataset.version);
      let p = await api(id ? `programs/${id}` : 'programs', id ? 'PUT' : 'POST', plan);
      if (form.elements.ready.checked) p = await api(`programs/${p.id}/action`, 'POST', {action:'ready', version:p.version});
      replaceProgram(p); navigate('programs'); toast('Programação salva.');
    } else if (form.id === 'notes-form') {
      const p = await api(`programs/${id}/notes`, 'PUT', {version:Number(form.dataset.version), note:form.elements.note.value, incident:form.elements.incident.value});
      replaceProgram(p); form.dataset.version = p.version; toast('Observações salvas.');
    }
  }, event.submitter);
});
document.querySelector('#duplicate-form').addEventListener('submit', event => {
  event.preventDefault();
  guarded(async () => {
    const p = await api(`programs/${state.duplicate}/duplicate`, 'POST', {date:event.target.elements.date.value});
    document.querySelector('#duplicate-dialog').close(); replaceProgram(p); navigate('edit', p.id); toast('Planejamento duplicado.');
  }, event.submitter);
});
document.querySelector('nav').addEventListener('click', event => { const link = event.target.closest('a[data-page]'); if (link) { event.preventDefault(); if (link.dataset.page === 'actuals') handleAction({dataset:{action:'chronogram'}}); else navigate(link.dataset.page); } });
window.addEventListener('hashchange', () => { const [page,id] = location.hash.slice(1).split('/'); if (['home','programs','tracking','history','edit','summary','actuals'].includes(page)) navigate(page, id); });
async function boot() {
  try {
    const health = await api('health'); state.zone = health.timezone; state.offset = new Date(health.server_time).getTime() - Date.now();
    state.programs = await api('programs');
    state.selected = state.programs.find(p => p.status === 'Em andamento')?.id || state.programs.find(p => p.status === 'Pronta')?.id || null;
    const [page,id] = location.hash.slice(1).split('/');
    if (id && state.programs.some(p => p.id === id)) state.selected = id;
    if (page === 'actuals' && !id) state.selected = null;
    state.page = ['home','programs','tracking','history','edit','summary','actuals'].includes(page) ? page : 'home'; render();
  } catch (error) {
    app.innerHTML = empty('Não foi possível carregar os dados', esc(error.message)); toast(error.message, true);
  }
}
setInterval(tick, 1000);
boot();
