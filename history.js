'use strict';
// Apenas consulta: os mesmos registros e cálculos dos Lotes 1–4.
window.IASDPIHistory=(()=>{
  let owner=null,filters={query:'',from:'',to:''},timer=null;
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
  function filter(programs,values=filters){
    const from=values.from?recordDay(values.from):'',to=values.to?recordDay(values.to):'',query=normalize(values.query);
    const error=values.from&&!from?{field:'history-from',message:'Informe uma data inicial válida em dd/mm/aaaa.'}:values.to&&!to?{field:'history-to',message:'Informe uma data final válida em dd/mm/aaaa.'}:from&&to&&from>to?{field:'history-to',message:'A data final não pode ser anterior à inicial.'}:null;
    const all=programs.filter(p=>p.status==='Finalizada');
    if(error)return {error,all,rows:[],excluded:all.length};
    const rows=all.filter(p=>{const day=recordDay(p.plan.date);return (!from||day&&day>=from)&&(!to||day&&day<=to)&&(!query||normalize(p.plan.name).includes(query)||normalize(displayDate(p.plan.date)).includes(query)||String(p.plan.date||'').includes(query));}).sort((a,b)=>String(b.plan.date||'').localeCompare(String(a.plan.date||'')));
    return {error:null,all,rows,excluded:all.length-rows.length,from,to};
  }
  function results(){
    const result=filter(state.programs);
    if(result.error)return `<p role="alert" class="form-error">${esc(result.error.message)} Os indicadores não foram calculados com filtros inválidos.</p>`;
    const {rows,all,excluded,from,to}=result,days=rows.map(p=>recordDay(p.plan.date)).filter(Boolean).sort();
    const period=from||to?`${from?displayDate(from):'Sem limite inicial'} a ${to?displayDate(to):'sem limite final'}`:days.length?`${displayDate(days[0])} a ${displayDate(days.at(-1))}`:'Todos os períodos';
    const ends=endStatistics(rows),badDates=all.filter(p=>!recordDay(p.plan.date)).length;
    const info=`<p class="history-context" role="status" aria-live="polite">Período analisado: <strong>${esc(period)}</strong>. ${rows.length} de ${all.length} cultos finalizados neste recorte; ${excluded} fora dos filtros. Indicadores de término: ${ends.considered} considerados e ${ends.excluded} desconsiderados por dados insuficientes ou inválidos.${badDates?` ${badDates} cultos com data inconsistente${from||to?', excluídos do filtro por período':''}.`:''}</p>`;
    if(!rows.length)return info+empty(all.length?'Nenhum culto corresponde aos filtros':'Ainda não há programações finalizadas',all.length?'Revise a pesquisa ou use Limpar filtros.':'Os registros aparecerão aqui após a finalização.');
    return info+adherenceOverview(rows)+programTable(rows,true);
  }
  function page(){
    const uid=IASDPIAuth.session()?.user.id;if(owner!==uid){owner=uid;filters={query:'',from:'',to:''};}
    return heading('MEMÓRIA','Histórico','Pesquise cultos finalizados e analise os indicadores do período selecionado.')+
      `<form id="history-filters" class="panel"><div class="history-filters-grid"><label>Pesquisar por nome ou data<input type="search" name="history-query" value="${esc(filters.query)}" maxlength="200" placeholder="Ex.: sábado ou 10/10/2026" autocomplete="off"></label>${field('De','history-from',filters.from,'text',false,'data-date-input placeholder="dd/mm/aaaa" inputmode="numeric"')}${field('Até','history-to',filters.to,'text',false,'data-date-input placeholder="dd/mm/aaaa" inputmode="numeric"')}</div><div class="actions"><button type="submit" class="primary">Aplicar filtros</button><button type="button" data-action="history-clear">Limpar filtros</button></div><p class="muted">A pesquisa por nome ou data é combinada com o período. Os limites de data são inclusivos.</p></form><section id="history-results" aria-label="Resultados do Histórico">${results()}</section>`;
  }
  function apply(form=document.querySelector('#history-filters')){
    clearTimeout(timer);if(!form?.isConnected)return;
    filters={query:form.elements['history-query'].value,from:form.elements['history-from'].value.trim(),to:form.elements['history-to'].value.trim()};
    form.querySelectorAll('[aria-invalid="true"]').forEach(clearFieldError);
    const result=filter(state.programs),target=document.querySelector('#history-results');
    if(target)target.innerHTML=results();
    if(result.error)fieldError(form.elements[result.error.field],result.error.message);else pageLayout.mount();
  }
  function input(input){
    if(input.closest('form')?.id!=='history-filters')return;
    clearTimeout(timer);const form=input.form;timer=setTimeout(()=>apply(form),180);
  }
  function clear(){
    clearTimeout(timer);filters={query:'',from:'',to:''};
    const form=document.querySelector('#history-filters');if(!form)return;
    for(const input of form.querySelectorAll('input')){input.value='';clearFieldError(input);}
    apply(form);form.elements['history-query'].focus();
  }
  return {page,apply,input,clear,filter};
})();
