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

function organizationPage() {
  return heading('NOSSA IGREJA','Organograma da igreja','Pastor, anciãos e departamentos sob seu acompanhamento.') +
    `<section class="organization" aria-label="Hierarquia da liderança da igreja">
      <div class="organization-pastor"><span class="eyebrow">PASTOR</span><h2>Luciano</h2><p>Acompanhamento de todos os anciãos</p></div>
      <p class="organization-level">Anciãos e seus departamentos</p>
      <ul class="organization-elders">${churchOrganization.map(elder=>`<li class="organization-elder"><div class="organization-elder-heading"><span class="eyebrow">${['Márcia','Victoria','Rosana'].includes(elder.name)?'ANCIÃ':'ANCIÃO'}</span><h2>${esc(elder.name)}</h2></div><ul class="organization-departments">${elder.departments.map(department=>`<li>${esc(department)}</li>`).join('')}</ul></li>`).join('')}</ul>
    </section>`;
}
