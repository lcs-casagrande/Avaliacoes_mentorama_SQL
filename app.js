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
  const active = items.find(i => p.executions[i.id] && !p.executions[i.id].ended);
  const pending = items.find(i => !p.executions[i.id]);
  const finished = items.filter(i => p.executions[i.id]?.ended);
  const first = items.map(i => p.executions[i.id]).find(Boolean);
  const last = [...items].reverse().map(i => p.executions[i.id]).find(e => e?.ended);
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
function programRow(p, historic = false) {
  const m = executionInfo(p);
  const planned = minutes(p.planned_end, p.planned_start);
  const actual = m.first && m.last ? minutes(m.last.ended, m.first.started) : null;
  return `<tr><td><strong>${esc(p.plan.name)}</strong><small>${esc(dateLabel(p.plan.date))}</small></td>
    <td>${esc(p.plan.start)} → ${esc(p.plan.end)}${historic ? `<small>${duration(planned)} previstos · ${actual === null ? '—' : duration(actual)} realizados</small>` : ''}</td>
    <td>${historic ? badge(m.shift, signed(m.shift)) : `<span class="badge neutral">${esc(p.status)}</span>`}</td>
    <td class="row-actions">${button(historic ? 'Ver resumo' : 'Abrir', historic ? 'summary' : 'edit', p.id)}${button('Duplicar', 'duplicate', p.id)}${!historic ? button('Acompanhar', 'track', p.id, 'class="primary"') : ''}</td></tr>`;
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
  return heading('BEM-VINDO', 'Cada momento, no seu tempo.', 'Uma programação clara. Um acompanhamento tranquilo.', button('Nova programação', 'new', '', 'class="primary"')) +
    (featured ? `<section class="featured"><div><p class="eyebrow">${running ? 'EM ANDAMENTO' : 'PRÓXIMA PROGRAMAÇÃO'}</p><h2>${esc(featured.plan.name)}</h2><p class="date">${esc(dateLabel(featured.plan.date))}</p><p class="large-time">${esc(featured.plan.start)} <span>→</span> ${esc(featured.plan.end)}</p><div class="actions">${button('Abrir programação', 'edit', featured.id)}${button(running ? 'Continuar acompanhamento' : 'Iniciar acompanhamento', 'track', featured.id, 'class="primary"')}</div></div><div class="featured-aside"><span class="eyebrow">PLANEJAMENTO</span><strong>${featured.plan.items.length}</strong><span>momentos organizados</span><span class="badge neutral">${esc(featured.status)}</span></div></section>` : empty('Vamos preparar a próxima programação?', 'Cadastre os horários e responsáveis ou use o exemplo para experimentar.', `${button('Nova programação', 'new', '', 'class="primary"')} ${button('Usar programação de exemplo', 'sample')}`)) +
    `<section class="section"><div class="section-heading"><h2>Últimas programações</h2>${recent.length ? `<span class="muted">Desvio médio do término: ${signed(recent.reduce((sum,p) => sum + executionInfo(p).shift, 0)/recent.length)}</span>` : ''}</div>${recent.length ? programTable(recent, true) : '<p class="muted">Os resumos aparecerão aqui após finalizar uma programação.</p>'}</section>`;
}
function programsPage() {
  const list = [...state.programs].sort((a,b) => b.plan.date.localeCompare(a.plan.date));
  return heading('PLANEJAMENTO', 'Programações', 'Organize horários, atividades e responsáveis.', button('Nova programação', 'new', '', 'class="primary"')) +
    (list.length ? programTable(list) : empty('Nenhuma programação cadastrada', 'Comece do zero ou experimente uma programação de exemplo.', button('Usar exemplo', 'sample')));
}
function field(label, name, value = '', type = 'text', required = false, extra = '') {
  return `<label>${label}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${extra}></label>`;
}
function itemEditor(i = {}, index = 0) {
  return `<fieldset class="item-editor" data-item-id="${esc(i.id || crypto.randomUUID())}"><legend>Atividade <span class="item-number">${index + 1}</span></legend>
    <div class="item-fields">${field('Bloco', 'block', i.block || 'Culto', 'text', true, 'maxlength="200" list="blocks"')}${field('Atividade', 'activity', i.activity, 'text', true, 'maxlength="200"')}${field('Responsável', 'responsible', i.responsible, 'text', false, 'maxlength="200"')}${field('Início previsto', 'start', i.start, 'time', true)}${field('Término previsto', 'end', i.end, 'time', true)}${field('Observação', 'note', i.note, 'text', false, 'maxlength="2000"')}</div>
    <div class="item-controls">${button('↑ Subir', 'up')}${button('↓ Descer', 'down')}${button('Excluir atividade', 'remove-item', '', 'class="danger-text"')}</div></fieldset>`;
}
function editor(p) {
  if (p && !['Planejamento', 'Pronta'].includes(p.status)) return planView(p);
  const plan = p?.plan || { name: 'Culto de sábado', date: today(), start: '09:30', end: '12:25', team: {}, items: [] };
  return heading('PLANEJAMENTO', p ? 'Editar programação' : 'Nova programação', 'Os horários previstos são preservados durante a execução.', button('Voltar', 'programs')) +
    `<form id="program-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="panel form-grid">${field('Nome da programação', 'name', plan.name, 'text', true, 'maxlength="200"')}${field('Data', 'date', plan.date, 'date', true)}${field('Início previsto', 'start', plan.start, 'time', true)}${field('Término previsto', 'end', plan.end, 'time', true)}<p id="weekday" class="muted"></p></section>
      <details class="panel"><summary>Equipe <span class="muted">· preenchimento opcional</span></summary><div class="form-grid team">${roles.map((role,i) => field(role, `team-${i}`, plan.team[role], 'text', false, 'maxlength="200"')).join('')}</div></details>
      <div class="section-heading"><h2>Itens da programação</h2>${button('+ Adicionar atividade', 'add-item')}</div><p class="muted">A ordem deve acompanhar os horários. Intervalos são permitidos; sobreposições, não.</p>
      <datalist id="blocks"><option value="Culto"><option value="Escola Sabatina"></datalist>
      <div id="items-editor">${(plan.items.length ? plan.items : [{}]).map(itemEditor).join('')}</div>
      <div class="actions form-footer"><button class="primary" type="submit">Salvar programação</button><label class="checkbox"><input name="ready" type="checkbox" ${p?.status === 'Pronta' ? 'checked' : ''}> Marcar como pronta para acompanhar</label></div>
    </form>`;
}
function planView(p) {
  return heading('PROGRAMAÇÃO', esc(p.plan.name), esc(dateLabel(p.plan.date)), `${button('Duplicar', 'duplicate', p.id)} ${button('Acompanhar', 'track', p.id, 'class="primary"')}`) +
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
  if (!p) return heading('EXECUÇÃO', 'Acompanhamento do Culto') + empty('Escolha uma programação', 'Abra uma programação pronta para acompanhar.', button('Ver programações', 'programs', '', 'class="primary"'));
  if (p.status === 'Finalizada') return summary(p);
  const m = executionInfo(p);
  const focus = m.active || m.expected || m.pending;
  const index = focus ? p.plan.items.indexOf(focus) : -1;
  const next = p.plan.items[index + 1];
  const e = focus && p.executions[focus.id];
  const dateMismatch = p.plan.date !== today();
  return heading('EXECUÇÃO', 'Acompanhamento do Culto', `${esc(dateLabel(p.plan.date))} · ${esc(p.plan.name)}`, button('Atualizar', 'refresh')) +
    `<div class="planned-bar"><span>Previsto <strong>${esc(p.plan.start)} → ${esc(p.plan.end)}</strong></span><span class="badge neutral">${esc(p.status)}</span></div>
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
  return heading('PLANEJADO × REALIZADO', 'Resumo da programação', `${esc(p.plan.name)} · ${esc(dateLabel(p.plan.date))}`, button('Duplicar programação', 'duplicate', p.id)) +
    `<section class="summary-grid">${[['Início planejado', p.plan.start], ['Início real', clock(m.first?.started)], ['Término planejado', p.plan.end], ['Término real', clock(m.last?.ended)], ['Duração planejada', duration(plannedDuration)], ['Duração real', actualDuration === null ? '—' : duration(actualDuration)], ['Desvio da duração', actualDuration === null ? '—' : signed(actualDuration - plannedDuration)], ['Desvio do término', signed(m.shift)]].map(([label,value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}</section>
    <p class="muted">Desvio do término compara o relógio. Desvio da duração compara o tempo total entre o primeiro início e o último término, incluindo intervalos.</p>
    <p class="context-line">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}. Veja as observações para entender a causa.` : 'Nenhum atraso registrado.'}</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade / bloco</th><th>Horários previstos</th><th>Horários reais</th><th>Duração prevista</th><th>Duração real</th><th>Diferença de duração</th></tr></thead><tbody>${p.plan.items.map(i => {
      const e = p.executions[i.id]; const planned = minutes(i.planned_end, i.planned_start); const real = e?.ended ? minutes(e.ended, e.started) : null;
      return `<tr><td><strong>${esc(i.activity)}</strong><small>${esc(i.block)} · ${esc(i.responsible)}</small></td><td>${esc(i.start)} → ${esc(i.end)}</td><td>${clock(e?.started)} → ${clock(e?.ended)}</td><td>${duration(planned)}</td><td>${real === null ? '—' : duration(real)}</td><td>${real === null ? '—' : badge(real - planned, signed(real - planned))}</td></tr>`;
    }).join('')}</tbody></table></div>${notes(p)}`;
}
function historyPage() {
  const completed = state.programs.filter(p => p.status === 'Finalizada').sort((a,b) => b.plan.date.localeCompare(a.plan.date));
  return heading('MEMÓRIA', 'Histórico', 'Um registro simples para melhorar a próxima programação.') + (completed.length ? programTable(completed, true) : empty('Ainda não há programações finalizadas', 'Ao finalizar a última atividade, o resumo será gerado automaticamente.'));
}
function render() {
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('selected', a.dataset.page === (['edit', 'summary'].includes(state.page) ? state.page === 'summary' ? 'history' : 'programs' : state.page)));
  app.innerHTML = ({home, programs: programsPage, history: historyPage, edit: () => editor(selected()), tracking: () => tracking(selected()), summary: () => selected() ? summary(selected()) : historyPage()}[state.page] || home)();
  updateWeekday(); tick();
}
function navigate(page, id) { if (id) state.selected = id; state.page = page; window.history.replaceState(null, '', `#${page}${['edit','summary','tracking'].includes(page) && state.selected ? '/' + state.selected : ''}`); render(); window.scrollTo({top: 0, behavior: 'instant'}); }
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
async function sample() {
  const rows = [['09:30','09:35','Música Congregacional','Ministério de Louvor'],['09:35','09:40','Música Congregacional','Ministério de Louvor'],['09:40','09:45','Música Congregacional','Ministério de Louvor'],['09:45','09:50','Oração Intercessora','Núbia'],['09:50','10:00','Adoração Infantil','Pr. Carlos'],['10:00','10:05','Anúncios / Comunicação','Henrique'],['10:05','10:10','Provai e Vede','Ministério da Mordomia'],['10:22','11:05','Sermão','Gabriel Henrique'],['11:05','11:10','Mensagem Musical','Priscilla'],['11:10','12:25','Escola Sabatina','Equipe da Escola Sabatina']];
  const p = await api('programs', 'POST', { name:'Culto de sábado · exemplo', date:today(), start:'09:30', end:'12:25', team:{}, items: rows.map(([start,end,activity,responsible],i) => ({start,end,activity,responsible,block: i === 9 ? 'Escola Sabatina' : 'Culto', note:''})) });
  replaceProgram(p); navigate('edit', p.id); toast('Exemplo criado. Confira os horários e marque como pronta.');
}
async function handleAction(target) {
  const {action, id} = target.dataset;
  if (action === 'new') { state.selected = null; navigate('edit'); }
  else if (action === 'programs') navigate('programs');
  else if (['edit','summary','track'].includes(action)) navigate(action === 'track' ? 'tracking' : action, id);
  else if (action === 'sample') await sample();
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
    if (action === 'remove-item') row.remove();
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
    if (updated.status === 'Finalizada') toast('Programação finalizada. Resumo disponível.');
  }
}
async function guarded(task) {
  if (state.busy) return;
  state.busy = true;
  const buttons = [...document.querySelectorAll('button, input, textarea')].filter(b => !b.disabled);
  buttons.forEach(b => { b.disabled = true; });
  try { await task(); } catch (error) {
    toast(error.message, true);
    // Atualiza a versão em memória sem substituir campos que o usuário está editando.
    try { state.programs = await api('programs'); } catch (_) { /* manter dados já carregados */ }
  } finally { state.busy = false; buttons.forEach(b => { b.disabled = false; }); }
}
app.addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) guarded(() => handleAction(target)); });
app.addEventListener('change', event => { if (event.target.name === 'date') updateWeekday(); });
document.querySelector('#duplicate-dialog').addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) handleAction(target); });
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  guarded(async () => {
    const id = form.dataset.id;
    if (form.id === 'program-form') {
      const get = name => form.querySelector(`[name="${name}"]`).value;
      const plan = {name:get('name'), date:get('date'), start:get('start'), end:get('end'), team:Object.fromEntries(roles.map((role,i) => [role,get(`team-${i}`)])), items: [...form.querySelectorAll('.item-editor')].map(row => ({id:row.dataset.itemId, ...Object.fromEntries([...row.querySelectorAll('input')].map(input => [input.name,input.value]))}))};
      if (id) plan.version = Number(form.dataset.version);
      let p = await api(id ? `programs/${id}` : 'programs', id ? 'PUT' : 'POST', plan);
      if (form.elements.ready.checked) p = await api(`programs/${p.id}/action`, 'POST', {action:'ready', version:p.version});
      replaceProgram(p); navigate('programs'); toast('Programação salva.');
    } else if (form.id === 'notes-form') {
      const p = await api(`programs/${id}/notes`, 'PUT', {version:Number(form.dataset.version), note:form.elements.note.value, incident:form.elements.incident.value});
      replaceProgram(p); form.dataset.version = p.version; toast('Observações salvas.');
    }
  });
});
document.querySelector('#duplicate-form').addEventListener('submit', event => {
  event.preventDefault();
  guarded(async () => {
    const p = await api(`programs/${state.duplicate}/duplicate`, 'POST', {date:event.target.elements.date.value});
    document.querySelector('#duplicate-dialog').close(); replaceProgram(p); navigate('edit', p.id); toast('Planejamento duplicado.');
  });
});
document.querySelector('nav').addEventListener('click', event => { const link = event.target.closest('a[data-page]'); if (link) { event.preventDefault(); navigate(link.dataset.page); } });
window.addEventListener('hashchange', () => { const [page,id] = location.hash.slice(1).split('/'); if (['home','programs','tracking','history','edit','summary'].includes(page)) navigate(page, id); });
async function boot() {
  try {
    const health = await api('health'); state.zone = health.timezone; state.offset = new Date(health.server_time).getTime() - Date.now();
    state.programs = await api('programs');
    state.selected = state.programs.find(p => p.status === 'Em andamento')?.id || state.programs.find(p => p.status === 'Pronta')?.id || null;
    const [page,id] = location.hash.slice(1).split('/');
    if (id && state.programs.some(p => p.id === id)) state.selected = id;
    state.page = ['home','programs','tracking','history','edit','summary'].includes(page) ? page : 'home'; render();
  } catch (error) {
    app.innerHTML = empty('Não foi possível conectar', 'Verifique se o servidor está em execução e recarregue a página.'); toast(error.message, true);
  }
}
setInterval(tick, 1000);
boot();
