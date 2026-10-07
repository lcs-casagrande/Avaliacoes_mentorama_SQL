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
      let previous = p.start;
      const ids = new Set();
      p.items = p.items.map((item, index) => {
        if (!validTime(item.start) || !validTime(item.end) || item.start < previous || item.end <= item.start || item.end > p.end) throw Error(`Atividade ${index+1}: horários sobrepostos, fora de ordem ou fora da programação.`);
        if (!item.activity?.trim() || !item.block?.trim()) throw Error('Informe atividade e bloco.');
        previous = item.end;
        const identifier = item.id || id();
        if (ids.has(identifier)) throw Error('Identificador de atividade duplicado.');
        ids.add(identifier);
        return {...item, id:identifier, order:index+1, planned_start:instant(p.date,item.start), planned_end:instant(p.date,item.end)};
      });
      return {name:p.name, date:p.date, start:p.start, end:p.end, items:p.items, team:p.team || {}};
    }
    function make(plan, status = 'Planejamento') {
      plan = prepare(plan);
      return {id:id(), plan, status, version:1, note:'', incident:'', paused:false, executions:{}, planned_start:instant(plan.date,plan.start), planned_end:instant(plan.date,plan.end)};
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
      [5,-2,6,1,0].forEach((deviation,index) => {
        const day = date(new Date(base.getTime()-(index+1)*7*86400000));
        const p = make({name:'Culto de sábado · exemplo',date:day,start:'09:30',end:'12:25',team:{},items:[{block:'Culto',start:'09:30',end:'11:10',activity:'Culto',responsible:'Equipe de exemplo'},{block:'Escola Sabatina',start:'11:10',end:'12:25',activity:'Escola Sabatina',responsible:'Equipe de exemplo'}]},'Finalizada');
        const first = new Date(instant(day,'09:30'));
        const middle = new Date(instant(day,'11:10'));
        const end = new Date(new Date(instant(day,'12:25')).getTime()+deviation*60000);
        p.executions[p.plan.items[0].id] = {started:first.toISOString(),ended:middle.toISOString()};
        p.executions[p.plan.items[1].id] = {started:middle.toISOString(),ended:end.toISOString()};
        programs.push(p);
      });
      return programs;
    }
    let memory;
    try { memory = JSON.parse(localStorage.getItem(key)); } catch (_) { memory = null; }
    if (!Array.isArray(memory) || !memory.length) memory = seed();
    function save() {
      try { localStorage.setItem(key, JSON.stringify(memory)); }
      catch (_) { throw Error('O navegador não permitiu salvar a demonstração. Libere o armazenamento local.'); }
    }
    async function request(path, method, body = {}) {
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
        const plan=clone(p.plan); plan.date=body.date;
        plan.items.forEach(i => {i.id=id();});
        const copy=make(plan); memory.unshift(copy); save(); return clone(copy);
      }
      if (body.version !== p.version) throw Error('Esta programação mudou. Atualize antes de continuar.');
      if (route === 'notes') { p.note=body.note || ''; p.incident=body.incident || ''; }
      else if (!route && method === 'PUT') {
        if (!['Planejamento','Pronta'].includes(p.status)) throw Error('O plano fica protegido após o início.');
        const plan=prepare(body);p.plan=plan;p.planned_start=instant(plan.date,plan.start);p.planned_end=instant(plan.date,plan.end);p.status='Planejamento';
      } else if (route === 'action') {
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
    save();
    document.addEventListener('DOMContentLoaded', () => {
      const banner=document.createElement('aside');banner.className='demo-banner';
      banner.textContent='DEMONSTRAÇÃO · Dados fictícios. Suas alterações ficam apenas neste navegador.';
      document.querySelector('.header').after(banner);
    });
    return {request};
  })();
}
