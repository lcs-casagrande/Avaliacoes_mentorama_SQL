'use strict';
// Fase A: cadastros. Escalas legadas e calendário oficial mantêm fontes próprias.
window.IASDPISchedules=(()=>{
  const model={status:'idle',catalog:null,error:'',tab:window.IASDPIConfig?.portalAccessEnabled?'departments':'people',query:'',department:'',editor:null,dirty:false,saving:false,feedback:'',generation:0};
  const tables={department:'departments',person:'people',role:'roles',membership:'memberships',availability:'availability',access:'access'};
  const titles={department:'Departamento',person:'Pessoa',role:'Função',membership:'Vínculo e habilitações',availability:'Disponibilidade',access:'Permissão ministerial'};
  const weekdays=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const suggestions={sonoplastia:['Operador de áudio','Projeção/multimídia','Apoio técnico'],diaconato:['Diácono','Diaconisa','Recepção ou apoio'],musica:['Direção musical','Instrumentista','Vocalista','Equipe de louvor'],ancionato:['Ancião responsável pelo culto','Ancião da semana','Ancião do mês']};
  const references={sonoplastia:'Luan',diaconato:'Diáconos: Marciano · Diaconisas: Rose',musica:'Alexandre',ancionato:'Consulte os anciãos no organograma; funções a confirmar.'};
  const h=value=>esc(value),find=(entity,id)=>model.catalog?.[tables[entity]]?.find(r=>r.id===id);
  function button(label,action,id='',extra=''){return `<button type="button" data-schedule-action="${action}" data-id="${h(id)}" ${extra}>${h(label)}</button>`;}
  async function rpc(name,body={}){
    if(window.IASDPISchedulePreview)return IASDPISchedulePreview.request(name,body);
    const {token}=await IASDPIAuth.requireIdentity();
    const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!IASDPIAuth.identityCurrent(token))throw Error('Sessão alterada. Recarregue antes de continuar.');
    return result;
  }
  function redraw(){if(state.page==='schedule-setup')render();lockRelations();}
  function lockRelations(){if(!model.editor?.version)return;for(const name of ['department_id','person_id','user_id']){const field=document.querySelector('#schedule-editor [name="'+name+'"]');if(field&&model.editor.entity!=='person')field.disabled=true;}}
  async function load(){
    const ticket=++model.generation;model.status='loading';model.error='';redraw();
    try{
      const data=await rpc('iasdpi_schedule_catalog');
      if(ticket!==model.generation)return;
      if(!data||!data.actor_id||typeof data.is_admin!=='boolean'||Object.values(tables).some(k=>!Array.isArray(data[k])))throw Error('Resposta de cadastros inválida.');
      model.catalog=data;model.status='ready';if(!window.IASDPISchedulePreview&&!IASDPIAuth.allowed())IASDPIAuth.scopeValidated();redraw();
    }catch(e){if(ticket!==model.generation)return;model.status='error';model.error=e.message;model.catalog=null;redraw();}
  }
  function canLeave(){
    if(model.saving){window.alert('Aguarde a confirmação do salvamento.');return false;}
    if(!model.dirty)return true;
    if(!window.confirm('Descartar somente as alterações ainda não salvas deste cadastro?'))return false;
    model.editor=null;model.dirty=false;return true;
  }
  function deptOptions(selected,managed=false,blank=false){return (blank?'<option value="">Todos / geral</option>':'')+(model.catalog?.departments||[]).filter(d=>!managed||(d.can_manage_members??d.can_manage)).map(d=>`<option value="${h(d.id)}" ${d.id===selected?'selected':''}>${h(d.name)}${d.active?'':' (inativo)'}</option>`).join('');}
  function personName(id){return model.catalog?.people.find(p=>p.id===id)?.display_name||'Pessoa indisponível';}
  function deptName(id){return model.catalog?.departments.find(d=>d.id===id)?.name||'Geral';}
  const check=(label,name,value)=>`<label class="checkbox"><input type="checkbox" name="${name}" ${value?'checked':''}> ${h(label)}</label>`;
  function input(label,name,value='',type='text',attrs=''){return `<label>${h(label)}<input name="${name}" type="${type}" value="${h(value??'')}" ${attrs}></label>`;}
  function select(label,name,options){return `<label>${h(label)}<select name="${name}">${options}</select></label>`;}
  const text=(label,name,value='')=>`<label>${h(label)}<textarea name="${name}" rows="2">${h(value)}</textarea></label>`;
  const formatDay=day=>day?displayDate(day):'Sem limite';
  function page(){
    const title=heading('ESCALAS · FUNDAÇÃO','Cadastros de escalas',model.catalog?.availability_enabled===false?'Organize pessoas, departamentos e vínculos. Disponibilidade temporariamente desativada.':'Organize pessoas, departamentos, funções e disponibilidades. Pessoas e funções são reutilizadas na montagem manual das escalas.');
    if(model.status==='idle'){queueMicrotask(load);return title+'<p role="status">Recuperando acesso aos cadastros…</p>';}
    const preview=!window.IASDPIScheduleUI?.isReview()&&window.IASDPISchedulePreview?'<p class="demo-banner">Prévia com dados fictícios. Alterações apenas em memória; não grava no Supabase e reinicia ao recarregar.</p>':'';
    if(model.status==='loading')return title+preview+'<p role="status">Carregando cadastros e permissões…</p>';
    if(model.status==='error')return title+preview+`<section class="panel"><p role="alert" class="form-error">${h(model.error)}</p><p>Se a migração 005 ainda não foi instalada, solicite sua revisão e ativação. Não há substituição por dados locais.</p>${button('Tentar novamente','refresh')}<form id="schedule-login" class="schedule-grid"><h2>Entrar nos cadastros</h2>${window.IASDPIAuth?.loginIdentifierField?IASDPIAuth.loginIdentifierField():input('E-mail','email','','email','required autocomplete="username"')}${input('Senha','password','','password','required autocomplete="current-password"')}<button class="primary" type="submit">Entrar</button><p class="schedule-feedback" role="status"></p></form><p><a href="#forgot-password">Esqueci minha senha</a></p></section>`;
    const c=model.catalog,manage=c.is_admin||c.departments.some(d=>(d.can_manage_members??d.can_manage));
    if(c.availability_enabled===false&&model.tab==='availability')model.tab='people';
    const tabs=[['people','Pessoas'],['departments','Departamentos'],['roles','Funções'],['memberships','Vínculos'],['availability','Disponibilidade'],...(c.is_admin&&!window.IASDPIGovernance?.enabled()?[['access','Permissões']]:[]),['sources','Fontes atuais']].filter(([key])=>key!=='availability'||c.availability_enabled!==false);
    return title+preview+`<div class="schedule-toolbar"><p>${c.is_admin?'Administrador':manage?'Gestão ministerial autorizada':'Consulta autorizada'} · ${button('Atualizar','refresh')}${button('Sair','logout')}</p><p role="status" class="schedule-feedback">${h(model.feedback)}</p></div>
    <nav class="schedule-tabs" aria-label="Cadastros de escalas">${tabs.map(([key,label])=>button(label,'tab',key,model.tab===key?'aria-current="page"':'')).join('')}</nav>
    ${window.IASDPIGovernance?.enabled()?'<p><a href="#access-admin" data-page="access-admin">Gestão de acessos por departamento</a></p>':''}${model.editor?editor():''}
    ${model.tab==='sources'?sources():`<section class="panel"><div class="schedule-toolbar"><h2>${h(tabs.find(t=>t[0]===model.tab)?.[1]||'Pessoas')}</h2>${canCreate(model.tab)?button('Cadastrar '+({people:'pessoa',departments:'departamento',roles:'função',memberships:'vínculo',availability:'disponibilidade',access:'permissão'}[model.tab]),'create',Object.keys(tables).find(k=>tables[k]===model.tab),'class="primary"'):''}</div>
    <form id="schedule-search" class="schedule-grid">${input('Pesquisar nome, pessoa ou departamento','query',model.query,'search')}${select('Departamento','filter',deptOptions(model.department,false,true))}<button type="submit">Pesquisar</button>${button('Limpar filtros','clear')}</form>
    ${list()}</section>`}`;
  }
  function canCreate(tab){if(tab==='availability'&&model.catalog.availability_enabled===false)return false;return model.catalog.is_admin||(['people','roles','memberships','availability'].includes(tab)&&model.catalog.departments.some(d=>(d.can_manage_members??d.can_manage)));}
  function rowCanEdit(entity,r){if(entity==='availability'&&model.catalog.availability_enabled===false)return false;return model.catalog.is_admin||(entity!=='person'&&entity!=='department'&&entity!=='access'&&model.catalog.departments.some(d=>d.id===r.department_id&&(d.can_manage_members??d.can_manage)));}
  function list(){
    const entity=Object.keys(tables).find(k=>tables[k]===model.tab),q=model.query.toLocaleLowerCase('pt-BR');
    const rows=model.catalog[model.tab].filter(r=>{
      const deps=r.department_id?[r.department_id]:model.tab==='departments'?[r.id]:model.catalog.memberships.filter(m=>m.person_id===r.id).map(m=>m.department_id);
      return (!model.department||deps.includes(model.department))&&[r.name,r.display_name,r.person_id?personName(r.person_id):'',...deps.map(deptName)].join(' ').toLocaleLowerCase('pt-BR').includes(q);
    });
    if(!rows.length)return '<p class="empty">Nenhum cadastro encontrado com estes filtros.</p>';
    return `<ul class="schedule-list">${rows.map(r=>{
      const label=entity==='availability'?`${personName(r.person_id)} · ${r.kind==='available'?'Disponível':'Indisponível'}`:entity==='membership'?personName(r.person_id):entity==='access'?`${r.user_id} · ${r.access_level==='manager'?'Gestor':'Visualizador'}`:r.display_name||r.name;
      let detail=deptName(r.department_id);
      if(entity==='department'){const heads=model.catalog.memberships.filter(m=>m.department_id===r.id&&m.active&&m.is_ministry_head).map(m=>personName(m.person_id));detail=heads.length?'Responsáveis cadastrados: '+heads.join(', '):references[r.code]?'Referência no organograma: '+references[r.code]+' · Vínculos ministeriais a confirmar.':'Sem responsável ministerial cadastrado.';}
      if(entity==='person')detail=model.catalog.memberships.filter(m=>m.person_id===r.id).map(m=>deptName(m.department_id)+(m.is_ministry_head?' · Responsável ministerial':'')+(m.active?'':' (vínculo inativo)')).join(' · ')||'Sem departamento';
      if(entity==='membership')detail+=' · '+(model.catalog.qualifications.filter(q=>q.membership_id===r.id).map(q=>model.catalog.roles.find(role=>role.id===q.role_id)?.name).filter(Boolean).join(', ')||'Funções a confirmar');
      if(entity==='availability')detail+=` · ${r.pattern==='weekly'?(r.weekdays||[]).map(d=>weekdays[d]).join(', '):formatDay(r.starts_on)+' a '+formatDay(r.ends_on)} · ${r.start_time?r.start_time.slice(0,5)+'–'+r.end_time.slice(0,5):'Dia inteiro'}${r.pattern==='weekly'?' · Vigência: '+formatDay(r.valid_from)+' a '+formatDay(r.valid_until):''}`;
      return `<li><div><strong>${h(label)}</strong><small>${h(detail)}</small><small>${r.active===false||r.enabled===false?'Inativo':'Ativo'} · versão ${r.version}</small></div>${rowCanEdit(entity,r)?button('Editar','edit',entity+':'+r.id,'aria-label="Editar '+h(label)+'"'):''}</li>`;
    }).join('')}</ul>`;
  }
  function sources(){
    const sound=ministrySchedules.Sonoplastia,communication=ministrySchedules.Comunicação;
    return `<section class="panel"><h2>Fontes preservadas</h2><p>As escalas antigas continuam na Agenda. Esta consulta não importa nem altera pessoas ou escalas.</p><ul><li>Sonoplastia: escala manual da liderança · ${sound.length} registros de outubro/início de novembro de 2026.</li><li>Comunicação: escala manual · ${communication.length} registros.</li><li>Anciãos: calendário oficial, fonte independente. <a href="#agendas">Consultar a Agenda</a>.</li></ul><p>Rafa e Raphael são identidades diferentes até confirmação explícita. Não há fusão por semelhança.</p><div class="table-scroll"><table><caption>Prévia das escalas manuais, sem importação</caption><thead><tr><th>Data</th><th>Departamento</th><th>Pessoa informada</th></tr></thead><tbody>${[['Sonoplastia',sound],['Comunicação',communication]].flatMap(([dep,rows])=>rows.map(r=>`<tr><td>${h(displayDate(r.date))}</td><td>${h(dep)}</td><td>${h(r.person)}</td></tr>`)).join('')}</tbody></table></div><p>A importação idempotente de atribuições será proposta na Fase B, com confirmação de identidades e prévia de alterações.</p></section>`;
  }
  async function openEditor(entity,id){
    if(!canLeave())return;
    const row=id?find(entity,id):null,c=model.catalog;
    if(id&&(!row||!rowCanEdit(entity,row)))throw Error('Sem permissão para editar este cadastro.');
    const initial=structuredClone(row||{active:true,enabled:true,department_id:c.departments.find(d=>(d.can_manage_members??d.can_manage))?.id||'',kind:'unavailable',pattern:'period',access_level:'viewer'});
    if(entity==='person'&&id&&c.is_admin)Object.assign(initial,await rpc('iasdpi_schedule_person_details',{p_id:id}));
    if(entity==='membership')initial.role_ids=c.qualifications.filter(q=>q.membership_id===id).map(q=>q.role_id);
    model.editor={entity,id:id||crypto.randomUUID(),version:row?.version||0,values:initial,request:crypto.randomUUID()};model.dirty=false;model.feedback='';redraw();document.querySelector('#schedule-editor input, #schedule-editor select')?.focus();
  }
  function editor(){
    const e=model.editor,v=e.values,a=model.catalog.is_admin,selected=(value,key)=>value===key?'selected':'';
    const dep=select('Departamento','department_id',deptOptions(v.department_id,true,e.entity==='availability'&&a));
    const person=select('Pessoa','person_id',model.catalog.people.map(p=>`<option value="${h(p.id)}" ${selected(p.id,v.person_id)}>${h(p.display_name)}${p.active?'':' (inativa)'}</option>`).join(''));
    const accountLookup=a?`<div class="schedule-account-lookup">${input('Buscar conta pelo e-mail exato (opcional)','lookup_email','','email')}${button('Buscar conta existente','lookup-account')}<p class="schedule-lookup-result" role="status"></p></div>`:'';
    let fields='';
    if(e.entity==='department')fields=input('Nome do departamento','name',v.name,'text','required maxlength="120"')+input('Código único (ex.: sonoplastia)','code',v.code,'text','required pattern="[a-z][a-z0-9-]{1,59}"');
    if(e.entity==='person')fields=input('Nome completo','name',v.name,'text','required maxlength="160"')+input('Nome de exibição','display_name',v.display_name,'text','required maxlength="160"')+(!e.version?dep:'')+(a?`${accountLookup}${input('Conta Supabase opcional (UUID)','auth_user_id',v.auth_user_id,'text','pattern="[0-9a-fA-F-]{36}"')}${input('Contato privado — somente admin','contact',v.contact,'text','maxlength="1000"')}${text('Observações privadas — somente admin','notes',v.notes)}${check('Confirmo que é outra pessoa com o mesmo nome','confirm_homonym',v.confirm_homonym)}${input('Justificativa do homônimo (se confirmado)','reason',v.reason,'text','maxlength="1000"')}`:'<p>A identidade compartilhada será administrada centralmente. Pessoas não precisam ter login.</p>');
    if(e.entity==='role'){
      const code=model.catalog.departments.find(d=>d.id===v.department_id)?.code;
      fields=dep+input('Nome da função','name',v.name,'text','required maxlength="120" list="schedule-role-examples"')+`<datalist id="schedule-role-examples">${(suggestions[code]||[]).map(n=>`<option value="${h(n)}"></option>`).join('')}</datalist><p>Exemplos opcionais; confirme as práticas locais antes de cadastrar.</p>`+text('Descrição','description',v.description)+input('Quantidade de referência (opcional)','default_required_count',v.default_required_count,'number','min="0" max="100"');
    }
    if(e.entity==='membership')fields=person+dep+check('Responsável ministerial — não concede acesso ao site','is_ministry_head',v.is_ministry_head)+`<fieldset><legend>Funções que esta pessoa pode exercer</legend>${model.catalog.roles.filter(r=>r.department_id===v.department_id).map(r=>check(r.name,'role:'+r.id,(v.role_ids||[]).includes(r.id))).join('')||'<p>Cadastre as funções confirmadas deste departamento primeiro.</p>'}</fieldset>`+input('Participações mensais desejadas (opcional)','desired_monthly_count',v.desired_monthly_count,'number','min="0" max="100"')+input('Limite mensal (opcional)','max_monthly_count',v.max_monthly_count,'number','min="0" max="100"')+input('Limite de participações consecutivas (opcional)','max_consecutive',v.max_consecutive,'number','min="1" max="100"')+text('Preferências de participação','preferences',v.preferences);
    if(e.entity==='availability')fields=person+dep+select('Tipo','kind',`<option value="unavailable" ${selected(v.kind,'unavailable')}>Indisponível</option><option value="available" ${selected(v.kind,'available')}>Disponível / preferência</option>`)+select('Repetição','pattern',`<option value="period" ${selected(v.pattern,'period')}>Data ou período</option><option value="weekly" ${selected(v.pattern,'weekly')}>Semanal</option>`)+(v.pattern==='weekly'?`<fieldset><legend>Dias da semana</legend>${weekdays.map((d,i)=>check(d,'weekday:'+i,(v.weekdays||[]).includes(i))).join('')}</fieldset>${input('Válida a partir de (opcional)','valid_from',v.valid_from?displayDate(v.valid_from):'')}${input('Válida até (opcional)','valid_until',v.valid_until?displayDate(v.valid_until):'')}`:input('Data inicial','starts_on',v.starts_on?displayDate(v.starts_on):'')+input('Data final','ends_on',v.ends_on?displayDate(v.ends_on):''))+input('Hora inicial — HH:mm (opcional)','start_time',v.start_time?.slice(0,5),'text','inputmode="numeric" placeholder="09:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"')+input('Hora final — HH:mm (opcional)','end_time',v.end_time?.slice(0,5),'text','inputmode="numeric" placeholder="11:30" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"')+'<p>Datas: dd/mm/aaaa. Horas locais de America/Sao_Paulo. Deixe ambas as horas vazias para dia inteiro. Disponibilidade cadastrada ainda não é uma escala.</p>';
    if(e.entity==='access')fields=accountLookup+dep+input('UUID da conta existente e confirmada','user_id',v.user_id,'text','required pattern="[0-9a-fA-F-]{36}"')+select('Permissão no departamento','access_level',`<option value="viewer" ${selected(v.access_level,'viewer')}>Visualizador</option><option value="manager" ${selected(v.access_level,'manager')}>Gestor ministerial</option>`)+check('Acesso ministerial ativo','enabled',v.enabled)+'<p>Consulte o UUID em Administração → Usuários ou Supabase Auth. Isso não concede o perfil global leader/admin. Não existe cadastro ou promoção automática.</p>';
    return `<section class="panel schedule-editor-panel" aria-labelledby="schedule-editor-title"><h2 id="schedule-editor-title">${e.version?'Editar':'Cadastrar'} ${h(titles[e.entity])}</h2><form id="schedule-editor" class="schedule-grid">${fields}${e.version&&['role','membership','availability','access'].includes(e.entity)?'<p>O vínculo não pode ser transferido. Para outra pessoa ou departamento, inative este cadastro e crie outro.</p>':''}<p class="schedule-similar" role="status"></p>${e.entity!=='access'?check('Cadastro ativo','active',v.active):''}<div class="actions"><button type="submit" class="primary" ${model.saving?'disabled':''}>${model.saving?'Salvando…':'Salvar cadastro'}</button>${button('Cancelar','cancel','',''+(model.saving?'disabled':''))}</div><p class="schedule-feedback" role="status" aria-live="polite">${model.saving?'Aguardando confirmação do Supabase…':model.dirty?'Alterações pendentes, ainda não salvas.':''}</p><p class="schedule-error" role="alert">${h(e.error||'')}</p></form></section>`;
  }
  function capture(form){
    const v=model.editor.values;
    for(const el of form.elements){if(!el.name||el.name==='lookup_email')continue;if(el.name.startsWith('role:')||el.name.startsWith('weekday:'))continue;v[el.name]=el.type==='checkbox'?el.checked:el.value;}
    v.role_ids=Array.from(form.querySelectorAll('[name^="role:"]:checked')).map(el=>el.name.slice(5));
    v.weekdays=Array.from(form.querySelectorAll('[name^="weekday:"]:checked')).map(el=>Number(el.name.slice(8)));
  }
  function payload(){
    const e=model.editor,v=e.values,p={};
    const sets={department:['name','code','active'],person:['name','display_name','active'],role:['department_id','name','description','default_required_count','active'],membership:['person_id','department_id','active','is_ministry_head','desired_monthly_count','max_monthly_count','max_consecutive','preferences','role_ids'],availability:['person_id','department_id','kind','pattern','active','start_time','end_time'],access:['department_id','user_id','access_level','enabled']};
    for(const k of sets[e.entity])if(v[k]!==undefined)p[k]=v[k];
    for(const k of ['default_required_count','desired_monthly_count','max_monthly_count','max_consecutive'])if(k in p)p[k]=p[k]===''||p[k]===null?null:Number(p[k]);
    if(e.entity==='person'){
      if(!e.version)p.department_id=v.department_id||null;
      if(model.catalog.is_admin){p.auth_user_id=v.auth_user_id||null;p.contact=v.contact||'';p.notes=v.notes||'';if(v.confirm_homonym){p.confirm_homonym=true;p.reason=v.reason||'';}}
    }
    if(e.entity==='availability'){
      p.department_id=p.department_id||null;p.start_time=p.start_time||null;p.end_time=p.end_time||null;
      if(Boolean(p.start_time)!==Boolean(p.end_time))throw Error('Informe as duas horas ou deixe ambas vazias.');
      for(const k of ['starts_on','ends_on','valid_from','valid_until'])p[k]=null;p.weekdays=null;
      const date=key=>{const raw=v[key];if(!raw)return null;const iso=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:tryReadDate(raw);if(!iso)throw Error('Revise a data: use dd/mm/aaaa.');return iso;};
      if(p.pattern==='weekly'){p.weekdays=v.weekdays;p.valid_from=date('valid_from');p.valid_until=date('valid_until');if(!p.weekdays.length)throw Error('Selecione ao menos um dia da semana.');}
      else{p.starts_on=date('starts_on');p.ends_on=date('ends_on');if(!p.starts_on||!p.ends_on)throw Error('Informe as datas inicial e final.');}
    }
    return p;
  }
  async function save(form){
    capture(form);const data=payload(),e=model.editor;model.saving=true;redraw();
    try{
      const row=await rpc('iasdpi_schedule_save',{p_entity:e.entity,p_id:e.id,p_expected_version:e.version,p_data:data,p_request_id:e.request});
      if(!row||row.id!==e.id||!Number.isInteger(row.version))throw Error('Confirmação inválida. Consulte o cadastro antes de tentar novamente.');
      model.editor=null;model.dirty=false;model.feedback=window.IASDPIScheduleUI?.isReview()?'Cadastro salvo nesta aba.':window.IASDPISchedulePreview?'Cadastro atualizado apenas nesta prévia fictícia.':'Cadastro confirmado pelo Supabase.';
      window.dispatchEvent(new Event('iasdpi-registry-saved'));await load();
    }catch(err){
      model.feedback='';e.error=err.message+(err.code==='40001'?' Seus campos continuam no formulário. Cancele e atualize a lista para comparar antes de reaplicar.':'');
    }finally{model.saving=false;redraw();}
  }
  document.addEventListener('submit',event=>{
    const form=event.target;if(!['schedule-login','schedule-editor','schedule-search'].includes(form.id))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(form.id==='schedule-search'){model.query=form.elements.query.value;model.department=form.elements.filter.value;redraw();return;}
    if(form.id==='schedule-editor'){if(!model.saving)void save(form).catch(e=>{form.querySelector('.schedule-error').textContent=e.message;});return;}
    const feedback=form.querySelector('.schedule-feedback'),submit=form.querySelector('button');submit.disabled=true;feedback.textContent='Confirmando identidade…';
    const email=form.elements.email.value,password=form.elements.password.value;form.elements.password.value='';
    void IASDPIAuth.loginIdentity(email,password).then(load).catch(e=>{feedback.textContent=e.message;}).finally(()=>{submit.disabled=false;});
  },true);
  document.addEventListener('input',event=>{const form=event.target.closest('#schedule-editor');if(!form||model.saving)return;capture(form);model.dirty=true;model.editor.request=crypto.randomUUID();form.querySelector('.schedule-feedback').textContent='Alterações pendentes, ainda não salvas.';
    if(event.target.name==='name'&&model.editor.entity==='person'){const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();const name=norm(event.target.value);const matches=name.length>1?model.catalog.people.filter(p=>p.id!==model.editor.id&&(norm(p.name).includes(name)||name.includes(norm(p.name)))):[];form.querySelector('.schedule-similar').textContent=matches.length?'Confira os cadastros semelhantes antes de criar: '+matches.map(p=>p.name).join(', ')+'. Nenhuma fusão automática.':'';}});
  document.addEventListener('change',event=>{
    const form=event.target.closest('#schedule-editor');if(!form)return;capture(form);model.dirty=true;
    if(event.target.name==='pattern'||(event.target.name==='department_id'&&['membership','role'].includes(model.editor.entity))){if(model.editor.entity==='membership')model.editor.values.role_ids=[];redraw();}
  });
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-schedule-action]');if(!b)return;
    event.preventDefault();const action=b.dataset.scheduleAction,id=b.dataset.id;
    void(async()=>{
      if(action==='refresh'){if(canLeave())await load();}
      if(action==='tab'){if(canLeave()){model.tab=id;model.query='';model.department='';redraw();}}
      if(action==='create')await openEditor(id);
      if(action==='edit'){const [entity,key]=id.split(':');await openEditor(entity,key);}
      if(action==='lookup-account'){const form=document.querySelector('#schedule-editor'),target=form.querySelector('.schedule-lookup-result');capture(form);const email=form.elements.lookup_email.value.trim();if(!email)throw Error('Informe o e-mail exato da conta.');const rows=await rpc('iasdpi_find_account',{p_email:email});const account=rows?.[0];if(account?.confirmed){const field=form.elements[model.editor.entity==='person'?'auth_user_id':'user_id'];field.value=account.user_id;capture(form);model.dirty=true;model.editor.request=crypto.randomUUID();target.textContent='Conta confirmada identificada. Revise e salve para vincular; nenhum acesso foi concedido ainda.';}else target.textContent='Conta confirmada não encontrada. Solicite cadastro e confirmação antes de vincular.';}
      if(action==='cancel'){if(canLeave()){model.editor=null;redraw();}}
      if(action==='clear'){model.query='';model.department='';redraw();}
      if(action==='logout'&&canLeave()){await IASDPIAuth.logout();reset();redraw();}
    })().catch(e=>toast(e.message,true));
  });
  function reset(){model.generation++;model.catalog=null;model.status='idle';model.editor=null;model.dirty=false;model.feedback='';}
  window.addEventListener('iasdpi-identity-ended',()=>{reset();redraw();});
  window.addEventListener('iasdpi-registry-saved',()=>{if(state.page!=='schedule-setup'&&!model.dirty&&!model.saving){model.status='idle';model.catalog=null;}});
  window.addEventListener('beforeunload',event=>{if(model.dirty||model.saving){event.preventDefault();event.returnValue='';}});
  async function editPerson(id){await load();if(model.status!=='ready'||!model.catalog?.is_admin)throw Error('Dados privados exigem administrador da igreja.');model.tab='people';await openEditor('person',id);}
  return {page,canLeave,load,request:rpc,editPerson};
})();

// G8.2 — projeções do cadastro normalizado; nenhum cadastro de pessoas paralelo.
window.IASDPIRegistry=(()=>{
 const enabled=()=>window.IASDPIConfig?.centralRegistryEnabled===true,h=v=>esc(v),rpc=(n,b={})=>IASDPISchedules.request(n,b),week=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 const m={phase:'idle',catalog:null,people:[],department:'',pending:new Map(),saving:false,error:'',message:'',generation:0,history:null,requests:new Map(),forms:new Map(),newPersonId:'',query:'',personStatus:'all',personDepartment:'all',focusPerson:'',identities:null,audit:null,identityEpoch:0};
 const pub={key:'',phase:'idle',heads:[],configured:[],links:[],confirmed_names:[],error:'',generation:0};
 const redraw=()=>{if(['schedule-members','organization','schedule-calendar'].includes(state.page))render();};
 const managed=()=>m.catalog?.departments.filter(d=>d.active&&(m.catalog.is_admin||d.can_manage_members))||[];
 function canLeave(){if(m.saving){alert('Aguarde a confirmação do cadastro.');return false;}if((m.pending.size||m.forms.size)&&!confirm('Descartar somente as alterações do cadastro ainda não salvas?'))return false;m.pending.clear();m.forms.clear();m.newPersonId='';return true;}
 async function load(preserve=false){const ticket=++m.generation;m.phase='loading';m.error='';redraw();try{
  const [c,people]=await Promise.all([rpc('iasdpi_registry_catalog'),rpc('iasdpi_registry_people',{p_search:''})]);if(ticket!==m.generation)return;
  if(!Array.isArray(c.memberships)||!Array.isArray(c.profiles)||!Array.isArray(people))throw Error('Resposta do Cadastro Geral inválida.');
  const identities=c.identity_registry&&c.is_admin?await rpc('iasdpi_registry_identity_preview'):null;if(ticket!==m.generation)return;
  if(m.catalog?.actor_id&&m.catalog.actor_id!==c.actor_id)m.pending.clear();m.catalog=c;m.people=people;m.identities=identities;
  if(!managed().some(d=>d.id===m.department))m.department=managed()[0]?.id||'';
  if(!preserve)m.pending.clear();m.phase='ready';
 }catch(e){if(ticket===m.generation){m.error=e.message;m.phase='error';}}finally{if(ticket===m.generation)redraw();}}
 function profile(link){return {weekdays:Object.fromEntries(week.map((_,i)=>[i,'unknown'])),...m.catalog.profiles.find(p=>p.membership_id===link.id)};}
 function changes(form){
  const fd=new FormData(form),get=n=>fd.has(n),link=m.catalog.memberships.find(l=>l.id===form.dataset.registryForm),oldRoles=m.catalog.qualifications.filter(q=>q.membership_id===link.id).map(q=>q.role_id),hidden=oldRoles.filter(id=>!m.catalog.roles.some(r=>r.id===id&&r.active));
  const values={active:get('active'),is_ministry_head:get('is_ministry_head'),leadership_scope:String(fd.get('leadership_scope')||''),participation_confirmed:get('participation_confirmed'),availability_override:get('availability_override'),max_monthly_count:fd.get('max_monthly_count')===''?null:Number(fd.get('max_monthly_count')),role_ids:[...fd.getAll('role_ids'),...hidden].sort(),weekdays:Object.fromEntries(week.map((_,i)=>[i,String(fd.get('day_'+i))]))};
  const before={...link,role_ids:[...oldRoles].sort(),weekdays:profile(link).weekdays};return Object.fromEntries(Object.entries(values).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(before[k])));
 }
 function row(link){const p=m.people.find(p=>p.id===link.person_id)||m.catalog.people.find(p=>p.id===link.person_id),d=m.catalog.departments.find(d=>d.id===link.department_id),f='registry-link-'+link.id,attrs=`form="${h(f)}" ${m.saving?'disabled':''}`,q={...link,role_ids:m.catalog.qualifications.filter(q=>q.membership_id===link.id).map(q=>q.role_id),weekdays:profile(link).weekdays,...m.pending.get(link.id)?.patch};
  const label=(text,input)=>`<label>${h(text)}${input}</label>`,flag=(text,name)=>label(text,`<input ${attrs} type="checkbox" name="${name}" ${q[name]?'checked':''} aria-label="${h(text+' · '+p.display_name+' · '+d.name)}">`);
  const pending=(!q.participation_confirmed?'Participação; ':'')+(!q.role_ids.length?'Habilitação; ':'')+(Object.values(q.weekdays).some(v=>v==='unknown')?'Disponibilidade; ':'');
  return `<tr data-registry-member="${h(link.id)}"><th scope="row">${h(p.display_name)}<small>${h(d.name)}</small></th><td>${flag('Responsável no Organograma público','is_ministry_head')}${flag('Participante confirmado','participation_confirmed')}${flag('Dias específicos do departamento','availability_override')}${d.code==='diaconato'?label('Liderança',`<select ${attrs} name="leadership_scope">${['','Diaconato — Diáconos','Diaconato — Diaconisas'].map(v=>`<option value="${h(v)}" ${q.leadership_scope===v?'selected':''}>${h(v||'Sem subdivisão')}</option>`).join('')}</select>`):''}${flag('Vínculo ativo','active')}</td><td>${m.catalog.roles.filter(r=>r.department_id===d.id&&r.active).map(r=>label(r.name,`<input ${attrs} type="checkbox" name="role_ids" value="${h(r.id)}" ${q.role_ids.includes(r.id)?'checked':''} aria-label="${h('Habilitado: '+r.name+' · '+p.display_name)}">`)).join('')||'Nenhuma função cadastrada'}</td>${week.map((day,i)=>`<td>${label(day,`<select ${attrs} name="day_${i}" aria-label="${h(day+' · '+p.display_name+' · '+d.name)}">${[['unknown','Pendente'],['available','Disponível'],['unavailable','Indisponível']].map(([v,l])=>`<option value="${v}" ${q.weekdays[i]===v?'selected':''}>${l}</option>`).join('')}</select>`)}</td>`).join('')}<td>${label('Máximo mensal',`<input ${attrs} type="number" name="max_monthly_count" min="0" max="100" value="${h(q.max_monthly_count??'')}" aria-label="${h('Limite · '+p.display_name+' · '+d.name)}" placeholder="Não informado">`)}<small>Dias distintos</small></td><td>${h(pending?'Pendente de confirmação: '+pending.replace(/; $/,'.'):'Confirmações preenchidas')}<small>Regras por data/período anteriores continuam aplicadas.</small></td><td><button ${attrs} type="submit" ${m.saving?'disabled':''}>Salvar vínculo</button><button type="button" data-registry-history="${h(link.person_id)}" data-registry-history-department="${h(link.department_id)}" ${m.saving?'disabled':''}>Histórico</button><p role="status">${m.pending.has(link.id)?'Alterações pendentes':''}</p></td></tr>`;
 }
 const searchText=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
 function visiblePeople(){
  const ids=new Set(managed().map(d=>d.id)),q=searchText(m.query);
  return m.people.filter(p=>{const links=m.catalog.memberships.filter(l=>l.person_id===p.id&&ids.has(l.department_id));
   return (m.catalog.is_admin||links.length)&&(!q||searchText(p.name+' '+p.display_name+' '+(p.aliases||[]).join(' ')).includes(q))&&
    (m.personStatus==='all'||(m.personStatus==='active'?p.active:!p.active))&&
    (m.personDepartment==='all'||(m.personDepartment==='none'?!m.catalog.memberships.some(l=>l.person_id===p.id):links.some(l=>l.department_id===m.personDepartment)));
  });
 }
 function directory(){
  const people=visiblePeople(),ds=managed(),church=window.IASDPIChurches?.current()?.name||window.IASDPIChurches?.selected()||'IASD_PI';
  return `<section class="panel registry-directory"><h2>Pessoas cadastradas</h2><form id="registry-filters" role="search" class="schedule-grid"><label>Pesquisar por nome ou apelido<input id="registry-search" type="search" maxlength="160" autocomplete="off" value="${h(m.query)}" aria-controls="registry-people-results"></label><label>Status da pessoa<select id="registry-person-status">${[['all','Todos'],['active','Ativas'],['inactive','Inativas']].map(([v,l])=>`<option value="${v}" ${v===m.personStatus?'selected':''}>${l}</option>`).join('')}</select></label><label>Departamento da pessoa<select id="registry-person-department"><option value="all">Todos os autorizados</option>${m.catalog.is_admin?`<option value="none" ${m.personDepartment==='none'?'selected':''}>Sem departamento</option>`:''}${ds.map(d=>`<option value="${h(d.id)}" ${d.id===m.personDepartment?'selected':''}>${h(d.name)}</option>`).join('')}</select></label><button type="button" data-registry-clear-filters>Limpar filtros</button></form><p role="status" data-registry-result-count>${people.length} ${people.length===1?'pessoa encontrada':'pessoas encontradas'}.</p>
  <div id="registry-people-results">${people.length?`<div class="table-scroll" tabindex="0" aria-label="Pessoas da igreja"><table class="registry-directory-table"><thead><tr><th>Nome completo</th><th>Nome preferido</th><th>Igreja</th><th>Status da pessoa</th><th>Vínculos</th><th>Ações</th></tr></thead><tbody>${people.map(p=>{const links=m.catalog.memberships.filter(l=>l.person_id===p.id&&ds.some(d=>d.id===l.department_id));return `<tr data-registry-person-row="${h(p.id)}"><th scope="row">${h(p.name)}</th><td>${h(p.display_name)}${p.aliases?.length?`<small>Apelidos históricos: ${p.aliases.map(h).join(', ')}</small>`:''}</td><td>${h(church)}</td><td>${p.active?'Ativa':'Inativa'}</td><td>${links.map(l=>h(ds.find(d=>d.id===l.department_id)?.name)+(l.active?'':' (vínculo inativo)')).join('<br>')||'Sem vínculo nos departamentos exibidos'}</td><td><button type="button" data-registry-person-links="${h(p.id)}">Vínculos</button>${m.catalog.is_admin?`<button type="button" data-registry-edit-person="${h(p.id)}">Editar pessoa</button>${m.catalog.identity_registry?`<button type="button" data-registry-audit="${h(p.id)}">Histórico cadastral</button>`:''}`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p>Nenhuma pessoa corresponde aos filtros. Os cadastros foram carregados.</p>'}</div></section>`;
 }
 function identities(){
  if(!m.identities)return '';
  const groups=m.identities.groups.filter(g=>g.people.length),duplicates=m.identities.possible_duplicates||[],duplicateCount=new Set([...groups.filter(g=>g.people.length>1),...duplicates].map(g=>g.people.map(p=>p.id).sort().join(':'))).size,labels={schedule_memberships:'Vínculos',schedule_availability:'Regras de disponibilidade',schedule_assignments:'Atribuições',schedule_day_exceptions:'Exceções',schedule_legacy_commitments:'Compromissos históricos',schedule_elder_periods:'Períodos de anciãos',schedule_source_links:'Fontes associadas',people:'Cadastros',private_details:'Fichas privadas',qualifications:'Habilitações',confirmed_days:'Dias comprometidos',aliases:'Apelidos'};
  return `<details class="panel registry-identities"><summary>Nomes confirmados e possíveis duplicidades · ${duplicateCount}</summary><p>Confira as referências e escolha o identificador que será mantido. Conflitos exigem revisão; nenhum histórico será apagado.</p><button type="button" data-registry-identities-reload>Atualizar prévia</button>
  ${groups.length?groups.map((g,i)=>`<section class="registry-identity-group" data-identity-group="${h(g.name)}"><h3>${h(g.name)}</h3><p>${g.people.map(p=>h(p.name)+(p.departments?.length?' ('+p.departments.map(d=>h(d.name)).join(', ')+')':'')).join(' · ')}${g.department?' · Somente Desbravadores para o apelido Victoria':''}</p><p class="muted">${Object.entries(g.references).filter(([,n])=>n&&n!==0).map(([k,n])=>h(labels[k]||k)+': '+n).join(' · ')||'Sem referências vinculadas'}</p>${g.blockers.length?`<ul role="status">${g.blockers.map(b=>`<li>${h(b)}</li>`).join('')}</ul>`:''}<label>Identificador a manter<select data-identity-canonical="${i}" ${g.blockers.length?'disabled':''}>${g.people.map(p=>`<option value="${h(p.id)}">${h(p.name+(p.departments?.length?' — '+p.departments.map(d=>d.name).join(', '):'')+' · ID '+p.id.slice(0,8))}</option>`).join('')}</select></label><button type="button" data-registry-consolidate="${h(g.name)}" ${g.blockers.length?'disabled':''}>${g.people.length>1?'Confirmar consolidação':'Confirmar nome e apelidos'}</button></section>`).join(''):'<p>Não há correspondências confirmadas nesta igreja.</p>'}
  ${duplicates.length?`<h3>Possíveis homônimos</h3><ul>${duplicates.map(g=>`<li>${g.people.map(p=>h(p.name+(p.departments?.length?' — '+p.departments.map(d=>d.name).join(', '):'')+' · ID '+p.id.slice(0,8))).join(' / ')}. Confirme a identidade; sem mesclagem automática.</li>`).join('')}</ul>`:''}</details>`;
 }
 function auditPanel(){return m.audit?`<section class="panel" id="registry-audit"><h2>Histórico cadastral</h2><p>${h(m.people.find(p=>p.id===m.audit.person)?.name||'Pessoa')}</p>${m.audit.rows.length?`<div class="table-scroll" tabindex="0" aria-label="Histórico de alterações cadastrais"><table><thead><tr><th>Data</th><th>Ação</th><th>Autor (ID)</th><th>Versão</th><th>Campos</th></tr></thead><tbody>${m.audit.rows.map(r=>`<tr><td>${h(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(new Date(r.captured_at)))}</td><td>${h(r.entity)}</td><td>${h(r.actor_id)}</td><td>${h(r.version)}</td><td>${(r.changed_fields||[]).map(h).join(', ')}</td></tr>`).join('')}</tbody></table></div>`:'<p>Nenhuma alteração cadastral registrada.</p>'}</section>`:'';}
 function openPerson(id){const p=m.people.find(p=>p.id===id),form=document.getElementById('registry-person');if(!p||!form)return;
  if(m.forms.has('registry-person')&&form.elements.person.value!==id&&!confirm('Descartar apenas as alterações da pessoa ainda não salvas?'))return;
  m.forms.delete('registry-person');form.elements.person.value=p.id;form.elements.name.value=p.name;form.elements.display_name.value=p.display_name;form.elements.active.checked=p.active;form.dataset.displayEdited='false';form.querySelector('[data-registry-private-person]').disabled=false;form.closest('details').open=true;form.elements.name.focus();
 }
 function sources(){
  const rows=[];
  if(typeof churchMinistries!=='undefined')for(const d of churchMinistries)for(const name of d.responsibles)rows.push({key:'ministry:'+d.name+':'+name,name,department:d.name,origin:'Organograma informado'});
  if(typeof ministrySchedules!=='undefined')for(const [department,entries] of Object.entries(ministrySchedules))for(const e of entries)rows.push({key:'legacy:'+department+':'+e.date+':'+e.person,name:e.person,department,starts_on:e.date,ends_on:e.date,kind:'daily',origin:displayDate(e.date)});
  for(const e of window.IASDPIAgendaData?.events||[])if(e.person&&['weekly','monthly'].includes(e.kind))rows.push({key:'official:'+(e.id||[e.kind,e.startDate,e.endDate,e.person].join(':')),name:e.person,department:'Ancionato',starts_on:e.startDate,ends_on:e.endDate,kind:e.kind,origin:'Agenda oficial · '+(e.startDate||'')});
  return [...new Map(rows.map(r=>[r.key,r])).values()];
 }
 function page(){
  if(!enabled())return '';
  if(m.phase==='idle'){queueMicrotask(()=>load());return '<p role="status">Carregando Cadastro Geral…</p>';}
  if(m.phase==='loading')return '<p role="status">Carregando pessoas e vínculos…</p>';
  if(m.phase==='error')return `<section class="panel"><p role="alert">${h(m.error)}</p><button data-registry-retry>Tentar novamente</button></section>`;
  queueMicrotask(()=>{for(const [id,entries] of m.forms){const form=document.getElementById(id);if(!form)continue;for(const field of form.elements){if(!field.name)continue;const values=entries.filter(([k])=>k===field.name).map(([,v])=>v);if(field.type==='checkbox')field.checked=values.includes(field.value);else if(values.length)field.value=values[0];}form.closest('details')?.setAttribute('open','');if(form.id==='registry-person')form.querySelector('[data-registry-private-person]').disabled=!form.elements.person.value;}});
  const c=m.catalog,ds=managed(),links=c.memberships.filter(l=>(m.focusPerson?l.person_id===m.focusPerson&&ds.some(d=>d.id===l.department_id):l.department_id===m.department)),unmatched=sources().filter(r=>!c.source_links.some(l=>l.source_key===r.key)),options=m.people.map(p=>`<option value="${h(p.id)}">${h(p.display_name+(p.active?'':' · Inativa'))}</option>`).join('');
  return heading('PESSOAS E MINISTÉRIOS','Cadastro Geral de Membros','Uma pessoa, vários departamentos. Confirmações e limites pertencem a cada vínculo.')+`<p role="status" data-registry-status>${h(m.message)}</p>${m.error?`<p role="alert">${h(m.error)}</p>`:''}<fieldset class="registry-controls" ${m.saving?'disabled':''}><legend class="sr-only">Cadastro e vínculos</legend>${directory()}${identities()}${auditPanel()}<section class="panel"><label>Departamento<select id="registry-department" ${m.saving?'disabled':''}>${ds.map(d=>`<option value="${h(d.id)}" ${m.department===d.id?'selected':''}>${h(d.name)}</option>`).join('')}</select></label></section>
  <section class="panel"><h2>${m.focusPerson?'Vínculos de '+h(m.people.find(p=>p.id===m.focusPerson)?.display_name||'pessoa'):'Pessoas do departamento'}</h2>${m.focusPerson?'<button type="button" data-registry-back-department>Voltar ao departamento</button>':''}<p class="muted">Deslize a tabela para consultar os dias e salvar cada vínculo.</p>${links.length?`${links.map(l=>`<form id="registry-link-${h(l.id)}" data-registry-form="${h(l.id)}"></form>`).join('')}<div class="table-scroll" tabindex="0" aria-label="Pessoas, habilitações e disponibilidade por departamento"><table class="registry-table"><thead><tr><th>Pessoa</th><th>Condição e status</th><th>Funções habilitadas</th>${week.map(w=>'<th>'+w+'</th>').join('')}<th>Limite</th><th>Pendências</th><th>Ações</th></tr></thead><tbody>${links.map(row).join('')}</tbody></table></div>`:'<p>Nenhuma pessoa vinculada a este departamento.</p>'}</section>
  <details class="panel"><summary>Vincular pessoa a departamentos</summary><form id="registry-add-links"><label>Pessoa existente<select name="person" required><option value="">Selecione no cadastro central</option>${options}</select></label><fieldset><legend>Departamentos — um único cadastro de pessoa</legend>${ds.map(d=>`<label class="checkbox"><input type="checkbox" name="departments" value="${h(d.id)}">${h(d.name)}</label>`).join('')}</fieldset><p>Vínculos existentes são preservados. Novos vínculos ficam pendentes de confirmação.</p><button ${m.saving?'disabled':''}>Salvar novos vínculos</button></form></details>
  ${c.is_admin?`<details class="panel"><summary>Cadastrar ou atualizar pessoa</summary><form id="registry-person"><label>Pessoa<select name="person"><option value="">Novo cadastro</option>${options}</select></label><label>Nome completo<input name="name" required maxlength="160"></label><label>Nome preferido (exibição)<input name="display_name" required maxlength="160"></label><label class="checkbox"><input name="active" type="checkbox" checked>Pessoa ativa</label><p>Vínculo com a igreja: ${h(window.IASDPIChurches?.current()?.name||window.IASDPIChurches?.selected()||'IASD_PI')}.</p><button type="button" data-registry-private-person disabled>Editar contatos privados</button><p>Antes de cadastrar, confira a lista. Homônimos e nomes semelhantes não são associados automaticamente.</p><button ${m.saving?'disabled':''}>Salvar pessoa</button></form></details><details class="panel"><summary>Associações pendentes · ${unmatched.length}</summary><p>Associe somente após confirmar a identidade. A fonte histórica original será preservada.</p>${unmatched.length?`<form id="registry-associate"><label>Registro de origem<select name="source" required>${unmatched.map(r=>`<option value="${h(r.key)}">${h(r.department+' · '+r.name+' · '+r.origin)}</option>`).join('')}</select></label><label>Pessoa confirmada<select name="person" required><option value="">Selecione</option>${options}</select></label><button ${m.saving?'disabled':''}>Confirmar associação</button></form>`:'<p>Nenhuma associação pendente nas fontes locais disponíveis.</p>'}</details>`:''}
  ${m.history?`<section class="panel" id="registry-history"><h2>Histórico de escalas</h2><ul>${m.history.current.map(r=>`<li>${h(displayDate(r.assigned_on))} · ${h(r.department)} · ${h(r.role)} · ${h(r.status)}</li>`).join('')||'<li>Nenhuma atribuição nos departamentos autorizados.</li>'}</ul><p>${m.history.versions.length} versões registradas nos departamentos autorizados.</p></section>`:''}</fieldset>`;
 }
 async function save(person,patch,links,key){
  if(m.saving)return;
  if(!confirm('Confirmar alterações '+(links.length?'em '+links.length+' vínculo(s)':'no cadastro da pessoa')+'? Os demais vínculos serão preservados.'))return;
  const identity=m.catalog.actor_id,ticket=m.generation;let request=m.requests.get(key);
  const previous=m.people.find(p=>p.id===person),args={p_person:person,p_expected_person_version:previous?.version||0,p_person_patch:patch,p_links:links};
  const signature=JSON.stringify(args);if(!request||request.signature!==signature){request={signature,id:crypto.randomUUID()};m.requests.set(key,request);}m.saving=true;m.error='';m.message='Aguardando confirmação…';redraw();
  try{const result=await rpc('iasdpi_registry_save',{...args,p_request_id:request.id});if(ticket!==m.generation||m.catalog?.actor_id!==identity)return;
   if(result.person?.id!==person||!Array.isArray(result.memberships))throw Error('Confirmação do cadastro inválida.');
   if(key.startsWith('row:'))m.pending.delete(key.slice(4));m.requests.delete(key);if(key.startsWith('links:'))m.forms.delete('registry-add-links');if(key.startsWith('person:')){m.forms.delete('registry-person');m.newPersonId='';}m.message=window.IASDPISchedulePreview?'Alterações confirmadas nesta demonstração.':'Alterações confirmadas pelo Supabase.';
   window.dispatchEvent(new Event('iasdpi-registry-saved'));await load(true);
  }catch(e){if(ticket===m.generation){m.error=e.message+' Suas alterações pendentes foram preservadas.';m.message='';}}finally{m.saving=false;redraw();}
 }
 function rememberForm(e){if(!enabled()||m.saving)return;const form=e.target.form;if(form?.id==='registry-person'&&e.type==='input'){if(e.target.name==='display_name')form.dataset.displayEdited='true';if(e.target.name==='name'&&form.dataset.displayEdited!=='true')form.elements.display_name.value=form.elements.name.value;}if(form?.matches('#registry-add-links,#registry-person,#registry-associate'))m.forms.set(form.id,[...new FormData(form)]);}
 document.addEventListener('input',e=>{rememberForm(e);const f=e.target.form;if(!enabled()||m.saving||!f?.dataset.registryForm)return;const id=f.dataset.registryForm,link=m.catalog.memberships.find(l=>l.id===id);m.pending.set(id,{department_id:link.department_id,expected_version:link.version,patch:changes(f)});document.querySelector('[data-registry-member="'+id+'"] [role=status]').textContent='Alterações pendentes.';});
 document.addEventListener('change',e=>{
  if(!enabled()||m.saving)return;
  if(e.target.id==='registry-department'){if(canLeave()){m.focusPerson='';m.department=e.target.value;m.history=null;redraw();}else e.target.value=m.department;return;}
  const form=e.target.form;if(form?.dataset.registryForm){const id=form.dataset.registryForm,member=m.catalog.memberships.find(l=>l.id===id);m.pending.set(id,{department_id:member.department_id,expected_version:member.version,patch:changes(form)});const row=document.querySelector('[data-registry-member="'+id+'"]');row.querySelector('[role=status]').textContent='Alterações pendentes.';}
  if(form?.id==='registry-person'&&e.target.name==='person'){const p=m.people.find(p=>p.id===e.target.value);form.elements.name.value=p?.name||'';form.elements.display_name.value=p?.display_name||'';form.elements.active.checked=p?.active!==false;form.querySelector('[data-registry-private-person]').disabled=!p;form.dataset.displayEdited='false';}
  rememberForm(e);
 });
 document.addEventListener('submit',e=>{if(!enabled())return;const f=e.target;if(!f.matches('[data-registry-form],#registry-add-links,#registry-person,#registry-associate'))return;e.preventDefault();e.stopImmediatePropagation();if(m.saving)return;const fd=new FormData(f);
  if(f.dataset.registryForm){const id=f.dataset.registryForm,l=m.catalog.memberships.find(l=>l.id===id),entry={department_id:l.department_id,expected_version:l.version,patch:changes(f)};if(!Object.keys(entry.patch).length){m.pending.delete(id);m.message='Nenhuma alteração neste vínculo.';redraw();return;}m.pending.set(id,entry);void save(l.person_id,{},[entry],'row:'+id);}
  if(f.id==='registry-add-links'){const person=String(fd.get('person')),deps=fd.getAll('departments');const known=m.catalog.memberships.filter(l=>l.person_id===person);const links=deps.filter(d=>!known.some(l=>l.department_id===d)).map(d=>({department_id:d,expected_version:0,patch:{}}));if(!links.length){m.error='Selecione ao menos um departamento ainda não vinculado.';redraw();return;}void save(person,{},links,'links:'+person);}
  if(f.id==='registry-person')void save(String(fd.get('person')||(m.newPersonId||=crypto.randomUUID())),{name:String(fd.get('name')),display_name:String(fd.get('display_name')),active:fd.has('active')},[],'person:'+fd.get('person'));
  if(f.id==='registry-associate'){
   if(!confirm('Confirmou a identidade e o departamento? Escalas de dias/semanas passarão a contar nos compromissos. A fonte histórica original será preservada.'))return;
   const key=String(fd.get('source')),person=String(fd.get('person')),source=sources().find(r=>r.key===key),code={Sonoplastia:'sonoplastia','Comunicação':'comunicacao',Ancionato:'ancionato'}[source?.department],department=m.catalog.departments.find(d=>d.code===code||d.name===source?.department);if(source?.starts_on&&!department){m.error='Cadastre o departamento antes de conciliar esta escala.';redraw();return;}m.saving=true;m.error='';const request=crypto.randomUUID(),reference=source?.starts_on?{department_id:department.id,starts_on:source.starts_on,ends_on:source.ends_on,kind:source.kind,original_name:source.name}:{};void rpc('iasdpi_registry_source_save',{p_source_key:key,p_person:person,p_expected_version:0,p_request_id:request,p_reference:reference}).then(()=>{m.forms.delete('registry-associate');m.message=window.IASDPISchedulePreview?'Associação confirmada nesta demonstração.':'Associação confirmada pelo Supabase.';window.dispatchEvent(new Event('iasdpi-registry-saved'));return load(true);}).catch(err=>{m.error=err.message;}).finally(()=>{m.saving=false;redraw();});
  }
 },true);
 document.addEventListener('click',e=>{if(!enabled())return;if(e.target.closest('[data-registry-retry]')){void load(true);return;}const b=e.target.closest('[data-registry-history]');if(b&&!m.saving)void rpc('iasdpi_registry_history',{p_person:b.dataset.registryHistory,p_department:b.dataset.registryHistoryDepartment||m.department}).then(v=>{m.history=v;redraw();document.getElementById('registry-history')?.scrollIntoView({block:'nearest'});}).catch(err=>{m.error=err.message;redraw();});});
 document.addEventListener('input',e=>{if(!enabled()||m.saving||e.target.id!=='registry-search')return;m.query=e.target.value;const caret=e.target.selectionStart;redraw();const field=document.getElementById('registry-search');field?.focus({preventScroll:true});if(field&&caret!=null)field.setSelectionRange(caret,caret);});
 document.addEventListener('change',e=>{if(!enabled()||m.saving)return;if(e.target.id==='registry-person-status')m.personStatus=e.target.value;else if(e.target.id==='registry-person-department')m.personDepartment=e.target.value;else return;redraw();document.getElementById(e.target.id)?.focus({preventScroll:true});});
 document.addEventListener('submit',e=>{if(e.target.id==='registry-filters')e.preventDefault();});
 document.addEventListener('click',e=>{if(!enabled()||m.saving)return;
  const edit=e.target.closest('[data-registry-edit-person]'),show=e.target.closest('[data-registry-person-links]'),priv=e.target.closest('[data-registry-private-person]');
  if(e.target.closest('[data-registry-identities-reload]')){if(canLeave())void load(true);return;}
  const audit=e.target.closest('[data-registry-audit]');if(audit){const ticket=m.generation,identity=m.catalog.actor_id;void rpc('iasdpi_registry_audit',{p_person:audit.dataset.registryAudit}).then(rows=>{if(ticket!==m.generation||m.catalog?.actor_id!==identity)return;m.audit={person:audit.dataset.registryAudit,rows};redraw();document.getElementById('registry-audit')?.scrollIntoView({block:'nearest'});}).catch(err=>{if(ticket===m.generation){m.error=err.message;redraw();}});return;}
  const merge=e.target.closest('[data-registry-consolidate]');if(merge){const group=m.identities?.groups.find(g=>g.name===merge.dataset.registryConsolidate);if(!group||group.blockers.length||!canLeave())return;const canonical=merge.closest('[data-identity-group]').querySelector('select').value;
   if(!confirm('Confirmar '+group.people.map(p=>p.name).join(' + ')+' → '+group.name+'? O ID '+canonical+' será mantido. Vínculos e referências serão consolidados; históricos anteriores serão preservados.'))return;
   const ticket=m.generation,identity=m.catalog.actor_id,epoch=m.identityEpoch;m.saving=true;m.error='';m.message='Aguardando confirmação…';redraw();const key=group.name+':'+canonical+':'+group.token;let request=m.requests.get(key);if(!request){request={id:crypto.randomUUID()};m.requests.set(key,request);}
   void rpc('iasdpi_registry_identity_apply',{p_name:group.name,p_canonical:canonical,p_token:group.token,p_request_id:request.id}).then(()=>{if(ticket!==m.generation||m.catalog?.actor_id!==identity)return;m.requests.delete(key);m.message=window.IASDPISchedulePreview?'Consolidação confirmada nesta demonstração.':'Consolidação confirmada pelo Supabase.';window.dispatchEvent(new Event('iasdpi-registry-saved'));return load(true);}).catch(err=>{if(ticket===m.generation)m.error=err.message;}).finally(()=>{if(epoch===m.identityEpoch){m.saving=false;redraw();}});return;
  }
  if(edit){openPerson(edit.dataset.registryEditPerson);return;}
  if(show){if(!canLeave())return;m.focusPerson=show.dataset.registryPersonLinks;m.history=null;redraw();document.querySelector('.registry-table')?.scrollIntoView({block:'nearest'});return;}
  if(e.target.closest('[data-registry-back-department]')){if(canLeave()){m.focusPerson='';redraw();}return;}
  if(e.target.closest('[data-registry-clear-filters]')){m.query='';m.personStatus='all';m.personDepartment='all';redraw();return;}
  if(priv){const person=document.getElementById('registry-person')?.elements.person.value;if(!person)return;void(async()=>{if(await IASDPINavigation.navigate('schedule-setup'))await IASDPISchedules.editPerson(person);})().catch(err=>{m.error=err.message;if(typeof toast==='function')toast(err.message,true);redraw();});}
 });
 function publicKey(){return window.IASDPIChurches?.selected()||'IASD_PI';}
 async function refreshPublic(){const key=publicKey(),ticket=++pub.generation;pub.key=key;pub.phase='loading';pub.error='';try{
  const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_registry_public',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(ticket!==pub.generation||key!==publicKey())return;if(!Array.isArray(result.heads)||!Array.isArray(result.links)||(result.confirmed_names!==undefined&&!Array.isArray(result.confirmed_names)))throw Error('Resposta do organograma inválida.');Object.assign(pub,result,{confirmed_names:result.confirmed_names||[],phase:'ready'});
 }catch(e){if(ticket===pub.generation){pub.phase='error';pub.error=e.message;}}finally{if(ticket===pub.generation)redraw();}}
 function publicState(){if(!enabled())return null;if(pub.key!==publicKey()||pub.phase==='idle'){pub.key=publicKey();pub.phase='loading';queueMicrotask(refreshPublic);}return pub;}
 function periodReasons(c,d,r,person){
  const member=c.memberships.find(m=>m.person_id===person&&m.department_id===d),need=r.kind==='weekly'?'semana':'mes',out=[];
  if(member?.participation_confirmed!==true)out.push('Participação — Pendente de confirmação');
  if(!c.roles.some(role=>role.department_id===d&&role.active&&role.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(need)&&c.qualifications.some(q=>q.membership_id===member?.id&&q.role_id===role.id)))out.push('Habilitação do período — Pendente de confirmação');
  for(const day of IASDPIElderPeriods.range(r.starts_on,r.ends_on)){const state=c.registry_days?.find(v=>v.person_id===person&&v.date===day)?.state;if(state!=='available'){out.push(state==='unavailable'?'Indisponível no período':'Disponibilidade — Pendente de confirmação');break;}}
  return out;
 }
 function confirmedName(name,department){const s=publicState();if(s?.phase!=='ready')return name;const code=searchText(department).replace(/[^a-z0-9]+/g,'-');return s.confirmed_names?.find(a=>searchText(a.alias)===searchText(name)&&(!a.department||a.department===code))?.name||name;}
 function personName(catalog,id){const target=catalog?.identity_redirects?.find(p=>p.id===id)?.canonical_id||id;return catalog?.people?.find(p=>p.id===target)?.display_name||null;}
 const map={musica:'Ministério da Música','ministerio-da-familia':'Ministério da Família','ministerio-da-crianca':'Ministério da Criança'};
 function ministry(entry){const s=publicState();if(s?.phase!=='ready')return entry;const d=(s.departments||[]).find(d=>(map[d.code]||d.name)===entry.name||d.name===entry.name||entry.name.startsWith('Diaconato')&&d.code==='diaconato');const heads=s.heads.filter(r=>(r.scope||map[r.department_code]||r.department)===entry.name);return {...entry,archived:d?.active===false,responsibles:heads.length||(s.configured||[]).some(r=>(r.scope||map[r.department_code]||r.department)===entry.name)?[...new Set(heads.map(r=>r.name))]:entry.responsibles.map(name=>s.links.find(l=>l.source_key==='ministry:'+entry.name+':'+name)?.display_name||confirmedName(name,entry.name))};}
 function historical(row){const s=publicState(),link=s?.phase==='ready'?s.links.find(l=>l.source_key===row.id):null;const name=link?.display_name||confirmedName(row.person,row.department);return name!==row.person?{...row,original_person:row.original_person||row.person,person:name}:row;}
 function publicStatus(){const p=publicState();if(!p)return '';return p.phase==='loading'?'<p role="status">Carregando vínculos de liderança…</p>':p.phase==='error'?`<p role="alert">${h(p.error)} Exibindo as referências históricas preservadas. <button data-registry-public-retry>Tentar novamente</button></p>`:'';}
 document.addEventListener('click',e=>{if(e.target.closest('[data-registry-public-retry]'))void refreshPublic();});
 window.addEventListener('iasdpi-registry-saved',()=>{pub.phase='idle';if(state.page!=='schedule-members'&&!m.pending.size&&!m.forms.size)m.phase='idle';});
 window.addEventListener('iasdpi-identity-ended',()=>{m.generation++;m.catalog=null;m.people=[];m.phase='idle';m.pending.clear();m.requests.clear();m.forms.clear();m.newPersonId='';m.query='';m.personStatus='all';m.personDepartment='all';m.focusPerson='';m.history=null;m.identities=null;m.audit=null;m.saving=false;m.identityEpoch++;});
 window.addEventListener('beforeunload',e=>{if(m.pending.size||m.forms.size||m.saving){e.preventDefault();e.returnValue='';}});
 return {enabled,page,canLeave,sources,ministry,historical,publicStatus,refreshPublic,periodReasons,personName,publicDepartments:()=>{const s=publicState();return s?.phase==='ready'?(s.departments||[]).map(d=>ministry({name:map[d.code]||d.name,responsibles:[]})):[];}};
})();
