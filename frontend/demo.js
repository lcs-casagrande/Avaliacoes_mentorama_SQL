'use strict';
// Adaptador exclusivo da demonstração estática. Nenhum dado é enviado a um servidor.
if (location.hostname.endsWith('.github.io') || new URLSearchParams(location.search).get('demo') === '1' || window.IASDPIConfig?.storageMode === 'browser') {
  window.IASDPIDemo = (() => {
    const key = IASDPIStorage.programs;
    const zone = 'America/Sao_Paulo';
    const clone = data => JSON.parse(JSON.stringify(data));
    const date = time => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date(time));
    const time = stamp => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour:'2-digit', minute:'2-digit' }).format(new Date(stamp));
    const instant = (day, clock) => `${day}T${clock.length===5?clock+':00':clock}-03:00`;
    const stamp = () => new Date().toISOString();
    const id = () => crypto.randomUUID();
    function prepare(input) {
      const p = clone(input);
      if (!p.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || date(instant(p.date, '12:00')) !== p.date) throw Error('Informe nome e data válidos.');
      const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
      const emptyFree=p.execution_mode==='manual'&&p.template_id==='free'&&Array.isArray(p.items)&&!p.items.length;
      if (!(emptyFree&&!p.start&&!p.end)&&(!validTime(p.start) || !validTime(p.end) || p.end <= p.start)) throw Error('Informe horários válidos, com término depois do início.');
      if (!Array.isArray(p.items) || (!p.items.length&&!emptyFree) || p.items.length > 100) throw Error('Cadastre entre 1 e 100 atividades.');
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
      return {name:p.name, date:p.date, start:p.start, end:p.end, items:p.items, team:p.team || {},...(p.template_id?{template_id:p.template_id}:{})};
    }
    function make(input, status = 'Planejamento') {
      const plan = prepare(input);
      return {id:id(), execution_mode:input.execution_mode || 'live', plan, status, version:1, note:'', incident:'', paused:false, executions:{}, planned_start:plan.start?instant(plan.date,plan.start):null, planned_end:plan.end?instant(plan.date,plan.end):null};
    }
    function isTestProgram(p) {
      return p.sample_set === 'adherence-v1' ||
        ['Culto · demonstração', 'Próximo culto · exemplo', 'Culto de sábado · exemplo'].includes(p.plan?.name);
    }
    // Não carregar nem modificar registros antes da autorização.
    let memory = [], storageAvailable = true;
    function save(writeSafety=true) {
      try { const previous=localStorage.getItem(key);if(writeSafety&&previous!==null)localStorage.setItem(IASDPIStorage.safety,previous);localStorage.setItem(key,JSON.stringify(memory)); storageAvailable=true; }
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
      if (route === 'correct-date') {
        if(body.expected!==JSON.stringify(p))throw Error('O registro mudou após a conferência. Reabra a prévia antes de confirmar.');
        const corrected=correctedCultoDate(p);corrected.version++;
        const raw=localStorage.getItem(IASDPIStorage.dateCorrections);
        const backups=raw===null?{version:1,records:[]}:JSON.parse(raw);
        if(backups?.version!==1||!Array.isArray(backups.records))throw Error('Cópia de segurança de data inválida. Nada foi alterado.');
        if(!backups.records.some(entry=>entry.id===p.id)){
          backups.records.push({id:p.id,captured_at:stamp(),program:clone(p)});
          localStorage.setItem(IASDPIStorage.dateCorrections,JSON.stringify(backups));
        }
        memory[memory.indexOf(p)]=corrected;save(false);return clone(corrected);
      }
      if (route === 'actuals') {
        if (p.execution_mode !== 'manual') throw Error('Use uma programação de registro manual.');
        const records = body.executions;
        if (!records || Object.keys(records).length !== p.plan.items.length) throw Error('Envie todos os itens.');
        const nextPlan=recordEditPlan(p,body);
        const executions = {}, details = structuredClone(p.actual_details||{});
        for (const item of p.plan.items) {
          const e=records[item.id];
          if(!e || typeof e.start!=='string' || typeof e.end!=='string') throw Error('Registro de horário inválido.');
          const note=e.note ?? p.actual_details?.[item.id]?.note ?? '', responsible=e.responsible ?? p.actual_details?.[item.id]?.responsible ?? '';
          if(typeof note!=='string'||note.length>2000||typeof responsible!=='string'||responsible.length>200)throw Error('Observação ou responsável inválido.');
          const checked=validateActivityRecord({...e,status:e.status??activityState(p.actual_details?.[item.id],e.start,e.end),subactivities:e.subactivities??p.actual_details?.[item.id]?.subactivities??[]},item.id);
          details[item.id]={...(p.actual_details?.[item.id]||{}),note,responsible,status:checked.status,subactivities:checked.subactivities};
          if(!e.start && !e.end) continue;
          const valid=v=>/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v);
          if(!valid(e.start) || (e.end && (!valid(e.end) || timeSeconds(e.end)<timeSeconds(e.start)))) throw Error('Informe início e término reais válidos.');
          executions[item.id]={started:instant(nextPlan.date,e.start),ended:e.end?instant(nextPlan.date,e.end):null};
        }
        const complete = p.plan.items.every(item=>details[item.id].status==='nao_realizada'||details[item.id].status==='realizada'&&executions[item.id]?.ended);
        if(body.finalize&&!p.plan.items.length)throw Error('Adicione atividades antes de finalizar.');
        if(body.finalize && !complete) throw Error('Preencha todas as atividades antes de finalizar.');
        const extraEvents=validateExtraEvents(p,body.extra_events ?? p.extra_events ?? [],Boolean(body.finalize));
        const info=body.record_info??p.record_info??'';if(typeof info!=='string'||info.length>5000)throw Error('Informações complementares inválidas.');
        const wasFinished=p.status==='Finalizada';p.plan=nextPlan;p.planned_start=nextPlan.start?instant(nextPlan.date,nextPlan.start):null;p.planned_end=nextPlan.end?instant(nextPlan.date,nextPlan.end):null;p.record_info=info;
        p.extra_events=extraEvents;p.executions=executions;p.actual_details=details;p.note=body.note??p.note??'';p.incident=body.incident??p.incident??'';
        p.status=body.finalize||wasFinished?'Finalizada':(Object.keys(executions).length||extraEvents.some(e=>e.start))?'Em andamento':'Planejamento';p.paused=false;
      }
      else if (route === 'notes') { p.note=body.note || ''; p.incident=body.incident || ''; }
      else if (!route && method === 'PUT') {
        if (!['Planejamento','Pronta'].includes(p.status)) throw Error('O plano fica protegido após o início.');
        const plan=prepare({...body,execution_mode:p.execution_mode || 'live'});p.plan=plan;p.planned_start=plan.start?instant(plan.date,plan.start):null;p.planned_end=plan.end?instant(plan.date,plan.end):null;p.status='Planejamento';
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
      await window.IASDPIAuth.requireAccess();
      if(path==='chronogram'&&method==='GET'){
        const rows=await window.IASDPIAuth.jsonRequest('/rest/v1/iasdpi_templates?id=eq.culto-03102026&select=plan',{headers:{Authorization:'Bearer '+window.IASDPIAuth.session().access_token}});
        if(!rows[0]?.plan)throw Error('Cronograma não configurado. Os registros existentes permanecem preservados.');
        return rows[0].plan;
      }
      const apply=()=>{
      let before;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const stored = JSON.parse(raw);
          if (!Array.isArray(stored)) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
          memory = stored;
        }else memory=[];
        before = clone(memory);
        return performRequest(path, method, body);
      } catch (error) {
        if (before) memory = before;
        if (error instanceof SyntaxError) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
        if (error.name === 'SecurityError') throw Error('O navegador bloqueou o armazenamento local. Libere-o para salvar os dados.');
        throw error;
      }
      };
      if(method!=='GET'&&navigator.locks)return navigator.locks.request('iasdpi-records:'+key,apply);
      return apply();
    }

    document.addEventListener('DOMContentLoaded', () => {
      const banner=document.createElement('aside');banner.className='demo-banner';
      banner.textContent='ARMAZENAMENTO LOCAL · Os registros permanecem neste navegador. Guarde uma cópia em Arquivo e banco.' + (storageAvailable ? '' : ' O salvamento está bloqueado neste navegador.');
      document.querySelector('.header').after(banner);
    });
    window.addEventListener('iasdpi-auth-changed',()=>{if(!window.IASDPIAuth.allowed())memory=[];});
    return {request};
  })();
}
