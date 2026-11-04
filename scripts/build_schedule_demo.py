"""Prepara prévias estáticas isoladas das Fases A/B1. Não publica nem acessa o Supabase."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
def build(output, calendar_preview=False, management_preview=False, homologation_demo=False, daily_preview=False, monthly_preview=False, rotation_ready=False, known_people=False, confirmation_test=False, simplified_daily=False, elder_periods=False, review_ready=False, church_portal=False):
    if church_portal:review_ready=True
    if review_ready and confirmation_test:raise ValueError('A interface de revisão não pode ocultar a identificação de um cenário fictício.')
    if review_ready:elder_periods=True
    if elder_periods:simplified_daily=True
    if simplified_daily:known_people=True
    if confirmation_test:known_people=True
    if known_people:monthly_preview=True
    if rotation_ready:monthly_preview=True
    if monthly_preview:daily_preview=True
    if daily_preview:homologation_demo=True
    if homologation_demo:management_preview=True
    if management_preview:calendar_preview=True
    output=Path(output)
    if output.exists() and any(output.iterdir()):raise ValueError('Destino não vazio; nada sobrescrito.')
    module=(ROOT/'frontend/schedule-foundation.js').read_text()
    # Copia o componente real; troca apenas a apresentação das fontes reais na demonstração.
    module,count=re.subn(r'  const references=.*?;\n',"  const references={};\n",module,count=1)
    if count!=1:raise ValueError('Referências ministeriais não reconhecidas; revisar gerador.')
    start=module.index('  function sources(){');end=module.index('  async function openEditor',start)
    module=module[:start]+'''  function sources(){return '<section class="panel"><h2>Fontes fictícias</h2><p>Todos os cadastros são exemplos. Nenhuma escala da liderança, agenda oficial ou registro real foi carregado.</p></section>';}
'''+module[end:]
    module=module.replace("['sources','Fontes atuais']","['sources','Fontes fictícias']")
    runtime=(ROOT/'tests/fixtures/schedule-demo-runtime.js').read_text()
    js=runtime+'\n'+module+'\nrender();\n'
    if calendar_preview:
        agenda=(ROOT/'frontend/agenda.js').read_text()
        manual_part=agenda[agenda.index('const ministrySchedules='):agenda.index('const soundScheduleInfo=')]
        rows=[]
        for department,part in re.findall(r"'([^']+)':\[(.*?)\]",manual_part,re.S):
            for day,name in re.findall(r"date:'([^']+)',person:'([^']+)'",part):
                rows.append({'date':day,'person':name,'department':department,'id':'legacy:'+department+':'+day+':'+name,'role':None,'origin':'Escala manual informada pela liderança'})
        if sum(r['department']=='Sonoplastia' for r in rows)!=15 or sum(r['department']=='Comunicação' for r in rows)!=5 or len({r['id'] for r in rows})!=20:raise ValueError('Conferir as fontes originais antes de gerar a prévia.')
        source=(ROOT/'frontend/agenda-data.js').read_text()
        snapshot=json.loads(source.split('=',1)[1].strip().rstrip(';'))
        official={k:snapshot.get(k) for k in ['status','syncedAt','fromMonth','toMonth']}
        official['events']=[{k:e.get(k) for k in ['id','kind','person','startDate','endDate']} for e in snapshot.get('events',[]) if e.get('kind') in ['monthly','weekly']]
        runtime=runtime.replace("page:'schedule-setup'", "page:'schedule-calendar'",1).replace("document.querySelector('#app').innerHTML=IASDPISchedules.page();", "document.querySelector('#app').innerHTML=state.page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page();window.IASDPIScheduleCalendar?.mount();",1)
        calendar=agenda[agenda.index('// Calendário de consulta:'):]
        bootstrap='window.IASDPICalendarSource=()=>'+json.dumps(rows,ensure_ascii=False)+';\nwindow.IASDPICalendarOfficialSource=()=>('+json.dumps(official,ensure_ascii=False)+');\n'
        nav="""document.addEventListener('click',e=>{const el=e.target.closest('[data-demo-view], [data-calendar-nav]');if(!el)return;e.preventDefault();if(!IASDPISchedules.canLeave())return;state.page=el.dataset.demoView||'schedule-setup';render();document.querySelector('#app').focus();});"""
        js=runtime+'\n'+bootstrap+calendar+'\n'+module+'\n'+nav+'\nrender();\n'
    if management_preview:
        # A prévia B1 usa apenas cadastros fictícios e calendário fictício vazio.
        runtime=runtime.replace("page:'schedule-calendar'", "page:'schedule-build'",1)
        runtime=runtime.replace("state.page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page()", "state.page==='schedule-build'?IASDPIScheduleManagement.page():state.page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page()")
        bootstrap='window.IASDPICalendarSource=()=>[];window.IASDPICalendarOfficialSource=()=>({events:[]});\n'
        management=(ROOT/'frontend/schedule-management.js').read_text()
        adapter=(ROOT/'tests/fixtures/schedule-management-preview.js').read_text()
        nav="""document.addEventListener('click',e=>{const el=e.target.closest('[data-demo-view], [data-calendar-nav], [data-b1-nav]');if(!el)return;e.preventDefault();if(!IASDPISchedules.canLeave()||!IASDPIScheduleManagement.canLeave())return;state.page=el.dataset.demoView||el.dataset.b1Nav||el.getAttribute('href')?.slice(1)||'schedule-setup';render();document.querySelector('#app').focus();});"""
        if homologation_demo:
            # Copia o visual aprovado, mas nunca mistura registros históricos neste contexto.
            calendar=re.sub(r'<details class="scale-provenance">.*?</details>', '<p class="scale-provenance">DEMONSTRAÇÃO: somente escalas fictícias publicadas nesta aba. Rascunhos ficam em Montar escala. Consulte os registros históricos separadamente.</p>',calendar,count=1,flags=re.S)
            calendar=calendar.replace('15 registros manuais de outubro/início de novembro de 2026.','').replace('<h1>Calendário de escalas</h1>','<h1>Calendário demonstrativo</h1>')
            if not simplified_daily:management=management.replace("b('Publicar escala','publish'","b('Publicar demonstração','publish'")
            if not review_ready:management=management.replace('Publicar esta escala após validar todas as vagas e conflitos?','Simular publicação após validar vagas e conflitos? Os dados ficam somente na memória desta demonstração.')
            adapter+='\n'+(ROOT/'tests/fixtures/schedule-b1-homologation-demo.js').read_text()
            nav=(ROOT/'tests/fixtures/schedule-b1-demo-navigation.js').read_text()
            if daily_preview:
                adapter+='\n'+(ROOT/'tests/fixtures/schedule-daily-preview.js').read_text()
                if monthly_preview:adapter+='\n'+(ROOT/'tests/fixtures/schedule-monthly-preview.js').read_text()
                if rotation_ready:adapter+='\n'+(ROOT/'tests/fixtures/schedule-rotation-ready-preview.js').read_text()
                nav=nav.replace("'schedule-build','schedule-calendar','schedule-setup'","'schedule-build','schedule-calendar','schedule-setup','schedule-members','schedule-settings'")
                runtime=runtime.replace("state.page==='schedule-build'?IASDPIScheduleManagement.page():", "['schedule-members','schedule-settings'].includes(state.page)?IASDPIScheduleDailyAdmin.page(state.page):state.page==='schedule-build'?IASDPIScheduleManagement.page():")

        js=runtime+'\n'+bootstrap+calendar+'\n'+module+'\n'+adapter+'\n'+management+'\n'+nav+'\nrender();\n'
    if known_people:
        import importlib.util
        spec=importlib.util.spec_from_file_location('iasdpi_reference_preview',ROOT/'scripts/schedule_reference_preview.py');reference=importlib.util.module_from_spec(spec);spec.loader.exec_module(reference)
        data,legacy=reference.test_scenario() if confirmation_test else reference.catalog(ROOT,rows)
        if confirmation_test:rows=[];official={'events':[]}
        if simplified_daily:
            import uuid
            for department in data['departments']:
                data['roles'].append(dict(id=str(uuid.uuid5(uuid.NAMESPACE_URL,'iasdpi-local-daily-participation:'+department['id'])),department_id=department['id'],name='Participação no departamento',general_assignment=True,active=True,version=1))
        if elder_periods:data['availability_enabled']=False
        prefix='window.IASDPIKnownPreviewSeed='+json.dumps({'catalog':data,'legacy':legacy,'rows':rows,'simplified_daily':simplified_daily,'elder_periods':elder_periods,'review_ready':review_ready,'church_portal':church_portal},ensure_ascii=False)+';\n'
        runtime=(ROOT/'tests/fixtures/schedule-demo-runtime.js').read_text()
        start=runtime.index(' const id=n=>');end=runtime.index(' const details=',start)
        runtime=runtime[:start]+' const c=IASDPIKnownPreviewSeed.catalog;\n'+runtime[end:]
        runtime=re.sub(r"  if\(name==='iasdpi_find_account'\).*?;\n", "  if(name==='iasdpi_find_account')throw Error('Consulta a contas reais indisponível nesta prévia.');\n",runtime)
        runtime=runtime.replace("notes:'Observação fictícia.'","notes:''")
        runtime=runtime.replace("page:'schedule-setup'","page:'schedule-build'",1).replace("document.querySelector('#app').innerHTML=IASDPISchedules.page();", "document.querySelector('#app').innerHTML=['schedule-members','schedule-settings'].includes(state.page)?IASDPIScheduleDailyAdmin.page(state.page):state.page==='schedule-build'?IASDPIScheduleManagement.page():state.page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page();window.IASDPIScheduleCalendar?.mount();")
        a=module.index('  function sources(){');z=module.index('  async function openEditor',a)
        module=module[:a]+'''  function sources(){return '<section class="panel"><h2>Escalas manuais preservadas</h2><p>15 registros de Sonoplastia e 5 de Comunicação, com os nomes históricos originais. Nenhum compromisso é apagado ao editar cadastros.</p><a href="#schedule-calendar" data-b1-nav="schedule-calendar">Consultar calendário histórico</a></section>';}
'''+module[z:]
        module=module.replace("['sources','Fontes fictícias']","['sources','Fontes das escalas']")
        calendar=agenda[agenda.index('// Calendário de consulta:'):]
        bootstrap='window.IASDPICalendarOfficialSource=()=>('+json.dumps(official,ensure_ascii=False)+');\n'
        adapter=(ROOT/'tests/fixtures/schedule-known-preview.js').read_text()
        if simplified_daily:adapter+='\n'+(ROOT/'tests/fixtures/schedule-simple-daily-ready.js').read_text()
        if elder_periods:adapter+='\n'+(ROOT/'tests/fixtures/schedule-elder-periods-preview.js').read_text()
        elif confirmation_test and not simplified_daily:adapter+='\n'+(ROOT/'tests/fixtures/schedule-confirmation-scenario-ready.js').read_text()
        if confirmation_test:module=module.replace('15 registros de Sonoplastia e 5 de Comunicação, com os nomes históricos originais. Nenhum compromisso é apagado ao editar cadastros.','Dados e disponibilidades fictícios deste cenário isolado; nenhum nome ou histórico real.')
        js=prefix+runtime+'\n'+bootstrap+calendar+'\n'+module+'\n'+adapter+'\n'+management+'\n'+nav+'\nrender();\n'
        js=js.replace('DEMONSTRAÇÃO — DADOS FICTÍCIOS','PRÉVIA LOCAL — NOMES INFORMADOS').replace('Fontes fictícias','Fontes informadas')
        if confirmation_test:js=js.replace('PRÉVIA LOCAL — NOMES INFORMADOS','CENÁRIO DE TESTE — DADOS FICTÍCIOS')
    if church_portal:
        public_agenda=agenda[:agenda.index('// Calendário de consulta:')]
        start=public_agenda.index('function agendaProvenance(');end=public_agenda.index('function agendasPage()',start)
        public_agenda=public_agenda[:start]+"function agendaProvenance(area,source=agendaSource()){return IASDPIChurchPortal.agendaProvenance(area,source);\n}\n"+public_agenda[end:]
        public_agenda=public_agenda.replace('href="#schedule-calendar"','href="#schedule-calendar" data-demo-view="schedule-calendar"').replace('href="#schedule-setup"','href="#schedule-setup" data-demo-view="schedule-setup"')
        public_agenda=public_agenda.replace('<label for="agenda-month-picker">Mês e ano<input id="agenda-month-picker" type="month" value="${month}"></label>',"${IASDPIScheduleUI.monthPicker('agenda-month-picker',month)}")
        # Reutiliza os formatadores de datas/horas e as páginas públicas originais.
        public_data={k:snapshot.get(k) for k in ['status','syncedAt','fromMonth','toMonth']};public_data['events']=[{k:e.get(k) for k in ['id','title','kind','person','start','end','allDay','startDate','endDate','department','wholeDay','location']} for e in snapshot.get('events',[])]
        helpers="""const currentTime=()=>new Date();
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(currentTime());
const programDate=value=>recordDay(value)?recordDay(value).split('-').reverse().join('/'):'Data não informada';
const empty=(title,description)=>'<section class="empty"><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></section>';
const button=(label,action,id='',extra='')=>'<button type="button" data-action="'+esc(action)+'" data-id="'+esc(id)+'" '+extra+'>'+esc(label)+'</button>';
"""
        public_code=(ROOT/'frontend/record-time.js').read_text()+'\n'+helpers+'window.IASDPIAgendaData='+json.dumps(public_data,ensure_ascii=False)+';\n'+public_agenda+'\n'+(ROOT/'frontend/organization.js').read_text()+'\n'+(ROOT/'frontend/church-portal.js').read_text()
        nav=nav.replace("'schedule-build','schedule-calendar','schedule-setup'","'schedule-build','schedule-calendar','schedule-setup','church-home','agendas','organization'").replace(":'schedule-build',position:0}",":'church-home',position:0}",1)
        # O guard de saída e o histórico existentes continuam sendo usados.
        runtime=runtime.replace("document.querySelector('#app').innerHTML=['schedule-members','schedule-settings'].includes(state.page)?IASDPIScheduleDailyAdmin.page(state.page):state.page==='schedule-build'?IASDPIScheduleManagement.page():state.page==='schedule-calendar'?IASDPIScheduleCalendar.page():IASDPISchedules.page();", "document.querySelector('#app').innerHTML=IASDPIChurchPortal.page(state.page);")
        js=prefix+runtime+'\n'+bootstrap+calendar+'\n'+module+'\n'+adapter+'\n'+management+'\n'+public_code+'\n'+nav+'\nrender();\n'
    css=(ROOT/'frontend/styles.css').read_text()+'''\n.demo-label{background:#0f4c78;color:white;padding:18px;text-align:center;font-weight:700}.demo-description{text-align:center;padding:0 16px}.demo-header{padding:16px 5%;border-bottom:1px solid #d5dce1}.demo-header a{font-size:22px;font-weight:700}.demo-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.demo-header nav{display:flex;gap:8px;flex-wrap:wrap}.demo-header nav button{min-width:110px;white-space:normal}#app{max-width:1200px;margin:auto;padding:24px 16px}'''
    sri=lambda s:'sha256-'+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
    html=f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self'; form-action 'none'; base-uri 'none'; object-src 'none'">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>IASDPI — DEMONSTRAÇÃO — DADOS FICTÍCIOS</title>
<link rel="stylesheet" href="styles.css" integrity="{sri(css)}" crossorigin="anonymous">
<script src="demo.js" integrity="{sri(js)}" crossorigin="anonymous" defer></script></head><body>
<a class="skip-link" href="#app">Ir para os cadastros</a><header class="demo-header"><a href="#schedule-setup">IASDPI · Gestão de Escalas · Fase A</a></header>
<p class="demo-label" role="status">DEMONSTRAÇÃO — DADOS FICTÍCIOS</p>
<p class="demo-description">Perfil administrador simulado, sem login. Não use informações reais. Alterações ficam somente na memória desta aba e reiniciam ao atualizar.</p>
<main id="app" tabindex="-1"><p>Carregando demonstração…</p></main><div id="notice" role="status" hidden></div>
<footer>Ambiente isolado · Sem conexão com o banco da igreja</footer></body></html>'''
    if calendar_preview:
        html=html.replace('IASDPI — DEMONSTRAÇÃO — DADOS FICTÍCIOS','IASDPI — Prévia local do calendário').replace('DEMONSTRAÇÃO — DADOS FICTÍCIOS','PRÉVIA LOCAL — ESCALAS INFORMADAS, SEM GRAVAÇÃO')
        html=html.replace('Perfil administrador simulado, sem login. Não use informações reais. Alterações ficam somente na memória desta aba e reiniciam ao atualizar.','Sonoplastia e Comunicação: escalas manuais informadas. Anciãos: cópia da Agenda oficial. Sem atribuições inventadas e sem conexão com o banco; cadastros demonstrativos em memória.')
        html=html.replace('</header>','<nav aria-label="Módulo de escalas"><button type="button" data-demo-view="schedule-calendar">Calendário</button><button type="button" data-demo-view="schedule-setup">Cadastros</button></nav></header>')
    if management_preview:
        html=html.replace('IASDPI — Prévia local do calendário','IASDPI — Fase B1 — Demonstração').replace('PRÉVIA LOCAL — ESCALAS INFORMADAS, SEM GRAVAÇÃO','DEMONSTRAÇÃO — DADOS FICTÍCIOS · FASE B1').replace('IASDPI · Gestão de Escalas · Fase A','IASDPI · Gestão de Escalas · B1')
        html=html.replace('Sonoplastia e Comunicação: escalas manuais informadas. Anciãos: cópia da Agenda oficial. Sem atribuições inventadas e sem conexão com o banco; cadastros demonstrativos em memória.','Cadastro, eventos e escalas exclusivamente fictícios. Salvamento simulado na memória desta aba; reinicia ao recarregar. Sem conexão com o Supabase.')
        html=html.replace('<nav aria-label="Módulo de escalas">','<nav aria-label="Módulo de escalas"><button type="button" data-demo-view="schedule-build">Montar escala</button>')
    if homologation_demo:
        html=html.replace('</nav></header>','<a href="../" target="_blank" rel="noopener" data-demo-history>Calendário histórico separado (nova aba)</a></nav></header>')
        html=html.replace('Montagem manual disponível para administradores e gestores ministeriais autorizados.','Montagem manual fictícia, sem acesso ao banco.')
    if daily_preview:
        html=html.replace('FASE B1','FASE B1.1').replace('Gestão de Escalas · B1','Gestão de Escalas · B1.1')
        html=html.replace('Fase B1 — Demonstração','Fase B1.1 — Demonstração').replace('<a href="../" target="_blank" rel="noopener" data-demo-history>Calendário histórico separado (nova aba)</a>','')
        html=html.replace('<nav aria-label="Módulo de escalas">','<nav aria-label="Módulo de escalas"><button type="button" data-demo-view="schedule-members">Membros</button><button type="button" data-demo-view="schedule-settings">Configurações</button>')
    if monthly_preview:
        html=html.replace('B1.1','B1.2').replace('FASE B1.1','FASE B1.2')
    if known_people:
        html=html.replace('DEMONSTRAÇÃO — DADOS FICTÍCIOS','PRÉVIA LOCAL — NOMES INFORMADOS')
        html=html.replace('Cadastro, eventos e escalas exclusivamente fictícios. Salvamento simulado na memória desta aba; reinicia ao recarregar. Sem conexão com o Supabase.','Nomes e escalas históricas informados pela liderança. Disponibilidade, habilitação e limites: Pendente de confirmação. Mudanças somente nesta aba, sem conexão com o Supabase; reiniciam ao recarregar.')
        html=html.replace('</nav></header>','<a href="IASDPI-B12-cenario-teste.html" target="_blank" rel="noopener">Cenário de teste isolado — fictício</a></nav></header>')
    if confirmation_test:
        html=html.replace('PRÉVIA LOCAL — NOMES INFORMADOS','CENÁRIO DE TESTE — DADOS FICTÍCIOS').replace('Nomes e escalas históricas informados pela liderança. Disponibilidade, habilitação e limites: Pendente de confirmação. Mudanças somente nesta aba, sem conexão com o Supabase; reiniciam ao recarregar.','Pessoas, funções e disponibilidades inteiramente fictícias para testar o rodízio antes das confirmações reais. Nada é enviado ao Supabase. Recarregar reinicia este cenário.').replace('<a href="IASDPI-B12-cenario-teste.html" target="_blank" rel="noopener">Cenário de teste isolado — fictício</a>','')
    if simplified_daily:
        html=html.replace('Disponibilidade, habilitação e limites: Pendente de confirmação.','Disponibilidade padrão para o automático; restrições são preferências e não bloqueiam escolhas manuais. A participação geral utiliza o vínculo ao departamento, sem inventar habilitação técnica.')
    if elder_periods:
        data['availability_enabled']=False
        html=html.replace('Disponibilidade padrão para o automático; restrições são preferências e não bloqueiam escolhas manuais.','Disponibilidade temporariamente desativada, sem apagar os dados anteriores.')
    if simplified_daily:html=html.replace('A participação geral utiliza o vínculo ao departamento, sem inventar habilitação técnica.','')
    if review_ready:
        html=re.sub(r'<title>.*?</title>','<title>IASDPI · Gestão de escalas</title>',html,flags=re.S)
        header='<header class="demo-header schedule-review-header"><a class="schedule-brand" href="#schedule-build" data-demo-view="schedule-build" aria-label="IASDPI · Escalas da Parada Inglesa"><span class="schedule-brand-mark" aria-hidden="true">PI</span><span class="schedule-brand-copy"><strong>IASDPI</strong><small>Parada Inglesa · Escalas</small></span></a><nav class="schedule-primary-nav" aria-label="Módulo de escalas"><button type="button" data-demo-view="schedule-build">Montar escala</button><button type="button" data-demo-view="schedule-calendar">Calendário</button><button type="button" data-demo-view="schedule-members">Membros</button><details class="schedule-nav-more"><summary aria-label="Mais opções" title="Mais opções"><span aria-hidden="true">⋯</span></summary><div class="schedule-more-items" role="group" aria-label="Outras opções de escalas"><button type="button" data-demo-view="schedule-setup">Cadastros</button><button type="button" data-demo-view="schedule-settings">Configurações</button></div></details></nav><span class="scale-help-control schedule-help-control"><button type="button" class="scale-help-button" aria-label="Ajuda sobre o salvamento" aria-controls="schedule-storage-help" aria-describedby="schedule-storage-help" aria-expanded="false">?</button><span id="schedule-storage-help" role="tooltip" hidden>As alterações ficam somente nesta aba. Recarregar a página reinicia os dados. Salvar guarda o rascunho; publicar o mostra no calendário desta aba. As escalas anteriores são preservadas.</span></span></header>'
        html=re.sub(r'<header.*?</header>',lambda _:header,html,flags=re.S)
        html=re.sub(r'<p class="demo-(?:label|description)"[^>]*>.*?</p>','',html,flags=re.S)
        html=html.replace('<body>','<body class="schedule-review-ready">').replace('Carregando demonstração…','Carregando escalas…').replace('Ir para os cadastros','Ir para o conteúdo')
        html=re.sub(r'<footer>.*?</footer>','<footer>IASD Parada Inglesa</footer>',html,flags=re.S)
    if church_portal:
        html=html.replace('<title>IASDPI · Gestão de escalas</title>','<title>IASDPI · Parada Inglesa</title>')
        html=html.replace('href="#schedule-build" data-demo-view="schedule-build" aria-label="IASDPI · Escalas da Parada Inglesa"','href="#church-home" data-demo-view="church-home" aria-label="IASD Parada Inglesa · Início"',1).replace('<small>Parada Inglesa · Escalas</small>','<small>Parada Inglesa</small>',1)
        nav_html='<nav class="schedule-primary-nav" aria-label="Navegação da igreja"><button type="button" data-demo-view="church-home">Início</button><button type="button" data-demo-view="schedule-calendar">Escalas</button><button type="button" data-demo-view="organization">Organograma</button><details class="schedule-nav-more"><summary aria-label="Mais opções" title="Mais opções"><span aria-hidden="true">⋯</span></summary><div class="schedule-more-items" role="group" aria-label="Outras áreas da igreja"><button type="button" data-demo-view="agendas">Agenda</button><a href="https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/#home" target="_blank" rel="noopener noreferrer" aria-label="Cronoanálise · acesso com login, abre em outra aba">Cronoanálise <svg class="portal-external-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div></details></nav>'
        html=re.sub(r'<nav class="schedule-primary-nav".*?</nav>',lambda _:nav_html,html,count=1,flags=re.S)
        html=html.replace('aria-label="Ajuda sobre o salvamento"','aria-label="Sobre este portal"',1)
        html=html.replace('As alterações ficam somente nesta aba. Recarregar a página reinicia os dados. Salvar guarda o rascunho; publicar o mostra no calendário desta aba. As escalas anteriores são preservadas.','As escalas editadas ficam somente nesta aba; recarregar reinicia as alterações. Cronoanálise abre o módulo oficial em outra aba, com login. Organograma e agenda são cópias públicas dos arquivos do projeto.',1)
    contents={'index.html':html,'styles.css':css,'demo.js':js,'.nojekyll':''}
    for text in contents.values():
        if church_portal:text=text.replace('https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/#home','')
        if re.search(r'https?://|sb_publishable_|sb_secret_|eyJ[A-Za-z0-9_-]+\.',text):raise ValueError('Endereço externo ou credencial detectada.')
    output.mkdir(parents=True,exist_ok=True)
    for name,data in contents.items():(output/name).write_text(data)
    manifest={'review_ready':review_ready,'church_portal':church_portal,'environment':'confirmation-test' if confirmation_test else 'known-people-preview' if known_people else 'monthly-preview' if monthly_preview else 'daily-preview' if daily_preview else 'b1-homologation-demo' if homologation_demo else 'management-preview' if management_preview else 'calendar-preview' if calendar_preview else 'fictional-demo','database_connected':False,'remote_requests_allowed':False,'files':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in contents.items()}}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
def standalone(site, output):
    """Um HTML local autossuficiente, mantendo CSP sem conexões externas."""
    site=Path(site);js=(site/'demo.js').read_text().replace('</script','<\\/script');css=(site/'styles.css').read_text()
    digest=lambda value:base64.b64encode(hashlib.sha256(value.encode()).digest()).decode()
    html=(site/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet"[^>]+>',lambda _: '<style>'+css+'</style>',html)
    html=re.sub(r'<script src="demo.js"[^>]*></script>','',html)
    html=html.replace('</body>','<script>'+js+'</script></body>')
    html=html.replace("script-src 'self'", "script-src 'sha256-"+digest(js)+"'").replace("style-src 'self'", "style-src 'sha256-"+digest(css)+"'")
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():raise ValueError('HTML de destino já existe; escolha outro caminho.')
    output.write_text(html)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=ROOT/'dist/schedule-demo/site');p.add_argument('--calendar-preview',action='store_true',help='Calendário local com Sonoplastia, Comunicação e períodos da Agenda oficial, sem exemplos inventados.');p.add_argument('--management-preview',action='store_true',help='Montagem B1 fictícia em memória, sem banco.');p.add_argument('--homologation-demo',action='store_true',help='Demonstração B1 com quatro departamentos e pessoas fictícias compartilhadas.');p.add_argument('--daily-preview',action='store_true',help='B1.1 por dia, com configuração e planilha fictícias.');p.add_argument('--monthly-preview',action='store_true',help='B1.2 mensal com rodízio fictício.');p.add_argument('--rotation-ready',action='store_true',help='Exemplo mensal fictício com eventos e vagas prontos para testar rodízio.');p.add_argument('--known-people',action='store_true',help='Nomes informados, sem inferir habilitação ou disponibilidade.');p.add_argument('--confirmation-test',action='store_true',help='Cenário fictício isolado com as regras de confirmação e rascunhos da 009.');p.add_argument('--standalone',type=Path,help='HTML único local, com CSP e sem dependências de rede.');p.add_argument('--simplified-daily',action='store_true',help='Montagem diária direta, com nomes informados e disponibilidade padrão.');p.add_argument('--elder-periods',action='store_true',help='Anciãos por semana e mês; disponibilidade desativada na prévia.');p.add_argument('--review-ready',action='store_true',help='Apresentação de revisão com instruções compactas, sem alterar a persistência.');p.add_argument('--church-portal',action='store_true',help='Liga Início, Escalas, Organograma e Agenda; cronoanálise usa o acesso oficial.');args=p.parse_args();build(args.output,args.calendar_preview,args.management_preview,args.homologation_demo,args.daily_preview,args.monthly_preview,args.rotation_ready,args.known_people,args.confirmation_test,args.simplified_daily,args.elder_periods,args.review_ready,args.church_portal);standalone(args.output,args.standalone) if args.standalone else None;print('Pacote local preparado; nenhuma publicação realizada.')
