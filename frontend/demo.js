'use strict';
// Adaptador exclusivo da demonstração estática. Nenhum dado é enviado a um servidor.
if (location.hostname.endsWith('.github.io') || new URLSearchParams(location.search).get('demo') === '1') {
  window.IASDPIDemo = (() => {
    const key = 'iasdpi-demo-v1';
    const zone = 'America/Sao_Paulo';
    const clone = data => JSON.parse(JSON.stringify(data));
    const date = time => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date(time));
    const time = stamp => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour:'2-digit', minute:'2-digit' }).format(new Date(stamp));
    const instant = (day, clock) => `${day}T${clock}:00-03:00`;
    const stamp = () => new Date().toISOString();
    const id = () => crypto.randomUUID();
    function prepare(input) {
      const p = clone(input);
      if (!p.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || date(instant(p.date, '12:00')) !== p.date) throw Error('Informe nome e data válidos.');
      const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
      if (!validTime(p.start) || !validTime(p.end) || p.end <= p.start) throw Error('Informe horários válidos, com término depois do início.');
      if (!Array.isArray(p.items) || !p.items.length || p.items.length > 100) throw Error('Cadastre entre 1 e 100 atividades.');
      let previous = p.start, previousItem = null;
      const ids = new Set();
      p.items = p.items.map((item, index) => {
        const parallel = p.execution_mode === 'manual' && item.parallel && previousItem?.parallel && item.start === previousItem.start && item.end === previousItem.end;
        if (!validTime(item.start) || !validTime(item.end) || (item.start < previous && !parallel) || item.end <= item.start || item.end > p.end) throw Error(`Atividade ${index+1}: horários sobrepostos, fora de ordem ou fora da programação.`);
        if (!item.activity?.trim() || !item.block?.trim()) throw Error('Informe atividade e bloco.');
        previous = item.end; previousItem = item;
        const identifier = item.id || id();
        if (ids.has(identifier)) throw Error('Identificador de atividade duplicado.');
        ids.add(identifier);
        return {...item, id:identifier, order:index+1, planned_start:instant(p.date,item.start), planned_end:instant(p.date,item.end)};
      });
      return {name:p.name, date:p.date, start:p.start, end:p.end, items:p.items, team:p.team || {}};
    }
    function make(input, status = 'Planejamento') {
      const plan = prepare(input);
      return {id:id(), execution_mode:input.execution_mode || 'live', plan, status, version:1, note:'', incident:'', paused:false, executions:{}, planned_start:instant(plan.date,plan.start), planned_end:instant(plan.date,plan.end)};
    }
    function seed() {
      // Exemplo relativo ao relógio para permitir experimentar imediatamente.
      let base = new Date(); base.setSeconds(0,0);
      if (time(base) < '00:20' || time(base) > '22:46') {
        base = new Date(instant(date(base),'12:00'));
      }
      const at = offset => new Date(base.getTime()+offset*60000);
      const rows = [[-20,-15,'Música Congregacional','Equipe de louvor'],[-15,-10,'Oração Intercessora','Responsável de exemplo'],[-10,33,'Sermão','Orador de exemplo'],[33,38,'Mensagem Musical','Equipe de louvor'],[38,73,'Escola Sabatina','Equipe da Escola Sabatina']];
      const active = make({name:'Culto · demonstração',date:date(base),start:time(at(-20)),end:time(at(73)),team:{},items:rows.map(([a,b,activity,responsible],i) => ({start:time(at(a)),end:time(at(b)),activity,responsible,block:i===4?'Escola Sabatina':'Culto',note:''}))},'Em andamento');
      active.executions[active.plan.items[0].id] = {started:at(-20).toISOString(),ended:at(-15).toISOString()};
      active.executions[active.plan.items[1].id] = {started:at(-15).toISOString(),ended:at(-7).toISOString()};
      active.executions[active.plan.items[2].id] = {started:at(-7).toISOString(),ended:null};
      active.incident = 'Exemplo fictício: uma comunicação adicional atrasou o início do sermão em 3 minutos.';
      const upcomingDate = new Date(base.getTime()+7*86400000);
      const upcoming = make({...active.plan,name:'Próximo culto · exemplo',date:date(upcomingDate)},'Pronta');
      const programs = [active, upcoming];
      return programs;
    }
    function adherenceExamples() {
      const scenarios = [
        {date:'2026-09-05',label:'Dentro do planejado',start:0,changes:{},note:'Exemplo fictício: todas as atividades seguiram os horários previstos.'},
        {date:'2026-09-12',label:'Pequenos desvios',start:1,changes:{3:2,11:-3},note:'Exemplo fictício: a oração durou 2 minutos a mais; o sermão compensou o tempo.'},
        {date:'2026-09-19',label:'Atraso relevante',start:3,changes:{5:3,11:9},note:'Exemplo fictício: comunicação adicional e sermão prolongado elevaram o atraso.'},
        {date:'2026-09-26',label:'Recuperação do atraso',start:4,changes:{0:-2,3:-1,11:-1},note:'Exemplo fictício: o culto começou atrasado, mas ajustes de duração recuperaram o horário.'},
        {date:'2026-10-03',label:'Levemente adiantado',start:-1,changes:{11:-1},note:'Exemplo fictício: início e término levemente adiantados, dentro da tolerância.'}
      ];
      return scenarios.map(scenario => {
        const plan=clone(window.IASDPIChronogram);plan.date=scenario.date;plan.name=`Culto · ${scenario.label} (fictício)`;
        plan.team={};plan.items.forEach(item=>{item.id=id();item.responsible='';});
        const p=make(plan,'Finalizada');p.sample_set='adherence-v1';p.note=scenario.note;
        if(scenario.start>2 || scenario.changes[5])p.incident=scenario.note;
        let cursor=new Date(instant(plan.date,plan.start)).getTime()+scenario.start*60000;
        for(let i=0;i<p.plan.items.length;i++){
          const item=p.plan.items[i];
          const planned=(new Date(item.planned_end)-new Date(item.planned_start))/60000;
          const end=cursor+(planned+(scenario.changes[i] || 0))*60000;
          p.executions[item.id]={started:new Date(cursor).toISOString(),ended:new Date(end).toISOString()};
          if(item.parallel && p.plan.items[i+1]?.parallel && p.plan.items[i+1].start===item.start){
            p.executions[p.plan.items[++i].id]={started:new Date(cursor).toISOString(),ended:new Date(end).toISOString()};
          }
          cursor=end;
        }
        return p;
      });
    }
    let memory, needsInitialSave = false, initialReadError = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) { memory = seed(); needsInitialSave = true; }
      else {
        memory = JSON.parse(raw);
        if (!Array.isArray(memory)) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
      }
    } catch (error) { initialReadError = error; memory = seed(); }
    let storageAvailable = initialReadError === null;
    function save() {
      try { localStorage.setItem(key, JSON.stringify(memory)); storageAvailable = true; }
      catch (_) { throw Error('O navegador não permitiu salvar a demonstração. Libere o armazenamento local.'); }
    }
    function performRequest(path, method, body = {}) {
      if (path === 'health') return {status:'ok',timezone:zone,server_time:stamp()};
      if (path === 'programs' && method === 'GET') return clone(memory);
      if (path === 'programs' && method === 'POST') {
        const p=make(body); memory.unshift(p); save(); return clone(p);
      }
      const [,identifier,route] = path.split('/');
      const p = memory.find(p => p.id === identifier);
      if (!p) throw Error('Programação não encontrada.');
      if (method === 'GET') return clone(p);
      if (route === 'duplicate') {
        const plan=clone(p.plan); plan.date=body.date; plan.execution_mode=p.execution_mode || 'live';
        plan.items.forEach(i => {i.id=id();});
        const copy=make(plan); memory.unshift(copy); save(); return clone(copy);
      }
      if (body.version !== p.version) throw Error('Esta programação mudou. Atualize antes de continuar.');
      if (route === 'actuals') {
        if (p.execution_mode !== 'manual') throw Error('Use uma programação de registro manual.');
        const records = body.executions;
        if (!records || Object.keys(records).length !== p.plan.items.length) throw Error('Envie todos os itens.');
        const executions = {};
        for (const item of p.plan.items) {
          const e=records[item.id];
          if(!e || typeof e.start!=='string' || typeof e.end!=='string') throw Error('Registro de horário inválido.');
          if(!e.start && !e.end) continue;
          const valid=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
          if(!valid(e.start) || (e.end && (!valid(e.end) || e.end<e.start))) throw Error('Informe início e término reais válidos.');
          executions[item.id]={started:instant(p.plan.date,e.start),ended:e.end?instant(p.plan.date,e.end):null};
        }
        const complete = Object.keys(executions).length === p.plan.items.length && Object.values(executions).every(e=>e.ended);
        if(body.finalize && !complete) throw Error('Preencha todas as atividades antes de finalizar.');
        p.executions=executions;p.note=body.note || '';p.incident=body.incident || '';
        p.status=body.finalize?'Finalizada':Object.keys(executions).length?'Em andamento':'Planejamento';p.paused=false;
      }
      else if (route === 'notes') { p.note=body.note || ''; p.incident=body.incident || ''; }
      else if (!route && method === 'PUT') {
        if (!['Planejamento','Pronta'].includes(p.status)) throw Error('O plano fica protegido após o início.');
        const plan=prepare({...body,execution_mode:p.execution_mode || 'live'});p.plan=plan;p.planned_start=instant(plan.date,plan.start);p.planned_end=instant(plan.date,plan.end);p.status='Planejamento';
      } else if (route === 'action') {
        if(p.execution_mode==='manual')throw Error('Use o formulário de realizado.');
        const active = p.plan.items.find(i => p.executions[i.id] && !p.executions[i.id].ended);
        const next = p.plan.items.find(i => !p.executions[i.id]);
        const now=stamp();
        if (body.action==='ready' && p.status==='Planejamento') p.status='Pronta';
        else if (body.action==='start' && p.status==='Pronta') {
          if(p.plan.date!==date(new Date())) throw Error('O acompanhamento só pode começar na data da programação.');
          p.executions[p.plan.items[0].id]={started:now,ended:null};p.status='Em andamento';
        } else if (body.action==='next' && active && !p.paused) {
          p.executions[active.id].ended=now;
          if(next) p.executions[next.id]={started:now,ended:null}; else p.status='Finalizada';
        } else if (['pause','resume'].includes(body.action) && p.status==='Em andamento') p.paused=body.action==='pause';
        else throw Error('Ação indisponível para o estado atual.');
      } else throw Error('Operação indisponível.');
      p.version++; save(); return clone(p);
    }
    async function request(path, method, body = {}) {
      if (path === 'health') return performRequest(path, method, body);
      let before;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const stored = JSON.parse(raw);
          if (!Array.isArray(stored)) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
          memory = stored;
        }
        before = clone(memory);
        if (path === 'programs' && method === 'GET' && window.IASDPIChronogram && !memory.some(p => p.sample_set === 'adherence-v1')) {
          memory.push(...adherenceExamples());
          try { save(); } catch (_) { memory = before; }
          before = clone(memory);
        }
        return performRequest(path, method, body);
      } catch (error) {
        if (before) memory = before;
        if (error instanceof SyntaxError) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
        if (error.name === 'SecurityError') throw Error('O navegador bloqueou o armazenamento local. Libere-o para salvar os dados.');
        throw error;
      }
    }
    if (needsInitialSave) { try { save(); } catch (_) { storageAvailable = false; } }
    document.addEventListener('DOMContentLoaded', () => {
      const banner=document.createElement('aside');banner.className='demo-banner';
      banner.textContent='DEMONSTRAÇÃO · Sem envio de dados. Suas alterações ficam apenas neste navegador.' + (storageAvailable ? '' : ' O salvamento está bloqueado neste navegador.');
      document.querySelector('.header').after(banner);
    });
    return {request};
  })();
}
