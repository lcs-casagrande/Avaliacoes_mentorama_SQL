'use strict';
const churchOrganization = [
  {name:'Adriano', departments:['Tesouraria','Desbravadores','Escola Sabatina']},
  {name:'Lucas', departments:['Adolescente','Vida e Saúde','Ministério 3ª Idade']},
  {name:'Elmo', departments:['Mordomia','ASA','Publicações']},
  {name:'Márcia', departments:['Família','Ministério da Mulher','Recepção']},
  {name:'Márcio', departments:['Patrimônio','Diaconato','Secretaria']},
  {name:'Raphael', departments:['Sonoplastia','Liberdade Religiosa','Ministério das Possibilidades']},
  {name:'Samuel', departments:['Ministério Pessoal','Música','Ministério dos Homens']},
  {name:'Victoria', departments:['Aventureiros','Gol da Esperança','Ministério Infantil']},
  {name:'Rosana', departments:['Comunicação','Ministério Recuperação','Jovens']}
];

// Responsáveis dos ministérios, separados do acompanhamento pelos anciãos.
const churchMinistries = [
  {name:'Diaconato — Diaconisas',responsibles:['Rose']},
  {name:'Diaconato — Diáconos',responsibles:['Marciano']},
  {name:'Ancionato',responsibles:[]},
  {name:'Ministério da Criança',responsibles:['Luciana Abdias']},
  {name:'Ministério dos Adolescentes',responsibles:['Taislane']},
  {name:'Comunicação',responsibles:['Henrique']},
  {name:'Ministério da Família',responsibles:['Luana','Raphael']},
  {name:'Ministério da Saúde',responsibles:['Simone Cristina']},
  {name:'Ministério de Publicações',responsibles:['Glaucia']},
  {name:'Ministério da Música',responsibles:['Alexandre']},
  {name:'Escola Sabatina',responsibles:['Renato']},
  {name:'Mordomia Cristã',responsibles:['Samuel']},
  {name:'Ministério Pessoal',responsibles:['Rosana']},
  {name:'Ação Solidária Adventista (ASA)',responsibles:['João Pedro']},
  {name:'Ministério Adventista das Possibilidades',responsibles:['João Pedro']},
  {name:'Liberdade Religiosa',responsibles:['João Pedro']},
  {name:'Ministério da Mulher',responsibles:['Gislaine']},
  {name:'Recepção',responsibles:['Nilce']},
  {name:'Ministério Jovem',responsibles:['Cauê']},
  {name:'Clube de Desbravadores',responsibles:['Victoria']},
  {name:'Clube de Aventureiros',responsibles:['Valeska']},
  {name:'Terceira Idade',responsibles:['Sandra']},
  {name:'Sonoplastia',responsibles:['Luan']},
  {name:'Patrimônio',responsibles:['Sérgio']},
  {name:'Ministério dos Homens',responsibles:['Paulo Scarpelini']},
  {name:'Gol da Esperança',responsibles:['Nelson']}
];
const organizationDepartmentNames = {
  'Desbravadores':'Clube de Desbravadores','Adolescente':'Ministério dos Adolescentes',
  'Vida e Saúde':'Ministério da Saúde','Ministério 3ª Idade':'Terceira Idade',
  'Mordomia':'Mordomia Cristã','ASA':'Ação Solidária Adventista (ASA)',
  'Publicações':'Ministério de Publicações','Família':'Ministério da Família',
  'Ministério das Possibilidades':'Ministério Adventista das Possibilidades',
  'Música':'Ministério da Música','Aventureiros':'Clube de Aventureiros',
  'Ministério Infantil':'Ministério da Criança','Jovens':'Ministério Jovem'
};
const organizationState = {query:''};
const organizationSearchText = value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const ministryPeople = ministry=>ministry.responsibles.length?new Intl.ListFormat('pt-BR',{type:'conjunction'}).format(ministry.responsibles):'Não informado';
const organizationCountText = count=>`${count} ${count===1?'resultado encontrado':'resultados encontrados'}.`;
function organizationDepartments(elder){
  return elder.departments.flatMap(original=>{
    const names=original==='Diaconato'?['Diaconato — Diaconisas','Diaconato — Diáconos']:[organizationDepartmentNames[original]||original];
    return names.map(name=>{const ministry=churchMinistries.find(entry=>entry.name===name);return {name,original,responsibles:ministry?.responsibles||[]};});
  });
}
function organizationResults(){
  const query=organizationSearchText(organizationState.query);
  const matches=ministry=>!query||organizationSearchText([ministry.name,ministry.original||'',ministryPeople(ministry)].join(' ')).includes(query);
  const ancionato=churchMinistries.find(ministry=>ministry.name==='Ancionato');
  const showAncionato=matches(ancionato);
  const groups=churchOrganization.map(elder=>({...elder,departments:organizationDepartments(elder).filter(matches)})).filter(elder=>elder.departments.length);
  const count=groups.reduce((total,elder)=>total+elder.departments.length,0)+Number(showAncionato);
  const ministryHtml=ministry=>`<h3 class="organization-ministry-name">${esc(ministry.name)}</h3><p class="organization-responsible"><span class="muted">${ministry.responsibles.length>1?'Responsáveis':'Responsável'}:</span> <strong>${esc(ministryPeople(ministry))}</strong></p>`;
  return {count,html:count?`${showAncionato?`<section class="organization-ancionato" data-ministry="Ancionato">${ministryHtml(ancionato)}</section>`:''}
    ${groups.length?`<p class="organization-level">Anciãos e departamentos sob seu acompanhamento</p><ul class="organization-elders">${groups.map(elder=>`<li class="organization-elder"><div class="organization-elder-heading"><span class="eyebrow">${['Márcia','Victoria','Rosana'].includes(elder.name)?'ANCIÃ':'ANCIÃO'} · ACOMPANHAMENTO</span><h2>${esc(elder.name)}</h2></div><ul class="organization-departments">${elder.departments.map(ministry=>`<li data-ministry="${esc(ministry.name)}">${ministryHtml(ministry)}</li>`).join('')}</ul></li>`).join('')}</ul>`:''}`:empty('Nenhum ministério encontrado','Revise o nome do ministério ou responsável, ou limpe a pesquisa.')};
}
function organizationPage() {
  const results=organizationResults();
  return heading('NOSSA IGREJA','Organograma da igreja','Ministérios, seus responsáveis e o acompanhamento pastoral e dos anciãos.') +
    `<section class="panel organization-search" role="search" aria-label="Pesquisa de ministérios"><label for="organization-query">Pesquisar ministério ou responsável<input type="search" id="organization-query" maxlength="200" autocomplete="off" placeholder="Ex.: Música ou Alexandre" value="${esc(organizationState.query)}" aria-controls="organization-results"></label><button type="button" id="organization-clear">Limpar pesquisa</button><p id="organization-count" class="muted" role="status" aria-live="polite">${organizationCountText(results.count)}</p></section>`+
    `<section class="organization" aria-label="Hierarquia da liderança da igreja">
      <div class="organization-pastor"><span class="eyebrow">PASTOR</span><h2>Luciano</h2><p>Acompanhamento de todos os anciãos</p></div>
      <div id="organization-results">${results.html}</div>
    </section>`;
}
function updateOrganizationSearch(){
  const target=document.getElementById('organization-results');if(!target)return;
  const results=organizationResults();target.innerHTML=results.html;
  document.getElementById('organization-count').textContent=organizationCountText(results.count);
}
document.addEventListener('input',event=>{if(event.target.id==='organization-query'){organizationState.query=event.target.value;updateOrganizationSearch();}});
document.addEventListener('click',event=>{if(event.target.closest('#organization-clear')){organizationState.query='';const input=document.getElementById('organization-query');input.value='';updateOrganizationSearch();input.focus();}});
