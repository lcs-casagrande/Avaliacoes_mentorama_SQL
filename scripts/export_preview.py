"""Exporta a demonstração como um HTML único para abrir sem servidor."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root / 'dist' / 'IASDPI-previa.html')
parser.add_argument('--read-only', action='store_true', help='Bloqueia gravações remotas na prévia e mantém os registros no navegador.')
parser.add_argument('--schedule-preview', action='store_true', help='Cadastros fictícios em memória; sem acesso remoto ao Supabase.')
parser.add_argument('--daily-preview', action='store_true', help='B1.1 por dia, com membros e configurações fictícios, sem conexão externa.')
parser.add_argument('--monthly-preview', action='store_true', help='B1.2 mensal com rodízio fictício, sem conexão externa.')
parser.add_argument('--rotation-ready', action='store_true', help='Exemplo fictício pronto para testar o botão de rodízio.')
parser.add_argument('--known-people', action='store_true', help='Referências informadas e confirmações pendentes, sem conexão com Supabase.')
parser.add_argument('--confirmation-test', action='store_true', help='Cenário fictício isolado com a regra atual de rascunhos e publicação.')
parser.add_argument('--simplified-daily', action='store_true', help='Montagem direta por dia, com nomes informados e preferências do automático.')
parser.add_argument('--elder-periods', action='store_true', help='Anciãos por semana e mês; disponibilidade desativada na prévia.')
parser.add_argument('--review-ready', action='store_true', help='Interface compacta de escalas para revisão.')
parser.add_argument('--church-portal', action='store_true', help='Portal público integrado, com entrada para cronoanálise autenticada.')
parser.add_argument('--governance-preview', action='store_true', help='G3 com identidades fictícias e rede bloqueada; somente apresentação.')
parser.add_argument('--integrated-access-preview', action='store_true', help='G4: portal, contas fictícias e motor de escalas, sem Supabase.')
parser.add_argument('--elder-storage-preview', action='store_true', help='G5: Ancionato integrado com Auth e banco simulados; sem rede externa.')
parser.add_argument('--governance-audit-preview',action='store_true',help='G6: homologação integrada com nomes informados, contas fictícias e rede bloqueada.')
parser.add_argument('--department-days-preview',action='store_true',help='G7: dias persistidos na simulação por departamento; sem rede externa.')
parser.add_argument('--registry-preview',action='store_true',help='G8.2: cadastro central integrado em demonstração isolada.')
parser.add_argument('--registry-consolidation-preview',action='store_true',help='G8.3: auditoria e lacunas do cadastro central em prévia isolada.')
parser.add_argument('--registry-identities-preview',action='store_true',help='G8.4: nomes confirmados e conciliação administrativa, sem rede externa.')
parser.add_argument('--event-management-preview',action='store_true',help='Eventos com recorrência, locais e pendência; memória isolada, sem Supabase.')
parser.add_argument('--calendar-privacy-preview',action='store_true',help='Classificação e privacidade simuladas: eventos abertos e Ancionato públicos, demais escalas com login fictício.')
parser.add_argument('--events-preview',action='store_true',help='E1: calendário unificado e gestão de eventos com acesso simulado, sem Supabase real.')
args = parser.parse_args()
if args.event_management_preview:args.calendar_privacy_preview=True
if args.calendar_privacy_preview:args.events_preview=True
if args.events_preview:
    args.registry_identities_preview=True
if args.registry_identities_preview:
    args.registry_consolidation_preview=True
if args.registry_consolidation_preview:
    args.registry_preview=True
if args.registry_preview:
    args.department_days_preview=True
if args.department_days_preview:
    args.governance_audit_preview=True
if args.governance_audit_preview:
    args.integrated_access_preview=True
if args.elder_storage_preview:
    args.integrated_access_preview=True
if args.daily_preview or args.monthly_preview or args.rotation_ready or args.known_people or args.confirmation_test or args.simplified_daily or args.elder_periods or args.review_ready or args.church_portal:
    import tempfile
    import build_schedule_demo
    with tempfile.TemporaryDirectory(prefix='iasdpi-daily-preview-') as temp:
        build_schedule_demo.build(temp,daily_preview=True,monthly_preview=args.monthly_preview,rotation_ready=args.rotation_ready,known_people=args.known_people,confirmation_test=args.confirmation_test,simplified_daily=args.simplified_daily,elder_periods=args.elder_periods,review_ready=args.review_ready,church_portal=args.church_portal)
        build_schedule_demo.standalone(temp,args.output)
    print(args.output)
    raise SystemExit(0)
frontend = root / 'frontend'
html = (frontend / 'index.html').read_text(encoding='utf-8')
css = (frontend / 'styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
for name in ('config.js', 'churches.js', 'storage.js', 'supabase-2.118.0.js', 'auth.js', 'record-time.js', 'demo.js', 'operational.js', 'actuals.js', 'agenda-data.js', 'agenda.js', 'archive.js', 'organization.js', 'users.js', 'trash.js', 'drafts.js', 'navigation.js', 'conflicts.js', 'history.js', 'schedule-foundation.js', 'schedule-management.js', 'governance.js', 'church-portal.js', 'portal-access.js', 'app.js'):
    script = (frontend / name).read_text(encoding='utf-8')
    if name == 'app.js' and args.integrated_access_preview:
        if args.governance_audit_preview:
            from governance_audit_preview import fixture as g6_fixture
            fixture=g6_fixture(root)
            if args.department_days_preview:
                fixture+='\n'+(root/'tests/fixtures/department-days-preview.js').read_text()
                if args.registry_preview:
                    fixture+='\n'+(root/'tests/fixtures/registry-integration-preview.js').read_text()
                    if args.registry_identities_preview:
                        import json
                        fixture+='\nwindow.IASDPIConfirmedNames='+json.dumps(json.loads((root/'data/confirmed-person-names.json').read_text()),ensure_ascii=False)+';\n'
                        import uuid
                        roster=json.loads((root/'data/music-ministry-roster.json').read_text())
                        for person in roster['people']:
                            person['person_id']=str(uuid.uuid5(uuid.NAMESPACE_URL,'iasdpi-local-reference:person:'+person['name']))
                            person['membership_id']=str(uuid.uuid5(uuid.NAMESPACE_URL,'iasdpi-music-roster:membership:'+person['name']))
                        fixture+='window.IASDPIMusicRoster='+json.dumps(roster,ensure_ascii=False)+';\n'
                        fixture+=(root/'tests/fixtures/registry-identities-preview.js').read_text()
        else:
            runtime=(root/'tests/fixtures/schedule-demo-runtime.js').read_text()
            fixture=runtime[runtime.index('window.IASDPISchedulePreview='):]+ '\n'
            for fixture_name in ('schedule-management-preview.js','schedule-b1-homologation-demo.js','schedule-daily-preview.js','schedule-monthly-preview.js'):
                part=(root/'tests/fixtures'/fixture_name).read_text()
                if ' const draw=render;' in part:part=part[:part.index(' const draw=render;')]+'})();'
                fixture+=part+'\n'
            fixture+='window.IASDPIKnownPreview=IASDPIB1Preview;window.IASDPIKnownPreviewSeed={catalog:{people:[]}};window.IASDPICalendarOfficialSource=()=>window.IASDPIAgendaData;IASDPIB1Preview.scheduleCommitments=()=>[...IASDPIB1Preview.plans.values()].flatMap(p=>p.requirements.flatMap(r=>r.assignments.map(a=>({person_id:a.person_id,department_id:p.department_id,date:IASDPIB1Preview.events.find(e=>e.id===r.event_id)?.scheduled_on,status:p.status}))));\n'
            fixture+=(root/'tests/fixtures/schedule-elder-periods-preview.js').read_text()+'\n'
            fixture+=(root/'tests/fixtures/portal-integration-preview.js').read_text()
        script=fixture+'\n'+script
    if name == 'app.js' and args.governance_preview:
        script = (root / 'tests/fixtures/governance-preview.js').read_text(encoding='utf-8') + '\n' + script
    if name == 'config.js' and args.integrated_access_preview:
        script='window.IASDPIConfig=Object.freeze({storageMode:"browser",storageNamespace:"iasdpi-g4-preview-v1",supabaseUrl:"https://g4demo.supabase.co",supabasePublishableKey:"sb_publishable_fictitious_only_123456789",churchIsolationEnabled:true,aliasLoginEnabled:true,governanceEnabled:true,portalAccessEnabled:true});'
    if name == 'config.js' and args.governance_preview:
        script = 'window.IASDPIConfig=Object.freeze({storageMode:"browser",storageNamespace:"iasdpi-g3-preview-only"});'
    if name == 'schedule-foundation.js' and args.schedule_preview:
        script = (root / 'tests/fixtures/schedule-foundation-preview.js').read_text(encoding='utf-8') + '\n' + script
    if name == 'config.js':
        mode = ",remoteReadOnly:true,environment:'validation'" if args.read_only else ''
        if args.schedule_preview:
            mode = ",remoteReadOnly:true,environment:'validation',storageNamespace:'iasdpi-schedule-preview-v1'"
        script += "\nwindow.IASDPIConfig=Object.freeze({...window.IASDPIConfig,storageMode:'browser'" + mode + "});\n"
    if name == 'config.js' and args.events_preview:
        script+='\nwindow.IASDPIConfig=Object.freeze({...IASDPIConfig,eventsEnabled:true,calendarPrivacyEnabled:'+str(args.calendar_privacy_preview).lower()+'});'
    if name == 'app.js' and args.events_preview:
        script+='\n'+(root/'tests/fixtures/events-preview.js').read_text()
        if args.event_management_preview:script+='\n'+(root/'tests/fixtures/event-planning-preview.js').read_text()
    if name == 'app.js' and args.registry_identities_preview:script+='\n'+(root/'tests/fixtures/schedule-edit-window-preview.js').read_text()
    script = script.replace('</script', '<\\/script')
    html = html.replace(f'  <script src="{name}" defer></script>\n', '')
    # Scripts executam após os elementos da página existirem.
    html = html.replace('</body>', f'<script>\n{script}\n</script>\n</body>')
html = html.replace('<title>IASDPI · Programação do culto</title>', '<title>IASDPI · Prévia local</title>')
html = html.replace('</head>', '<script>if (!location.hash) location.hash = '+repr('church-home' if args.integrated_access_preview else 'access-admin' if args.governance_preview else 'schedule-setup' if args.schedule_preview else 'organization')+';</script>\n</head>')
if args.governance_preview or args.integrated_access_preview:
    html=html.replace('<head>', """<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">""")
if args.elder_storage_preview:
    html=html.replace('HOMOLOGAÇÃO G4 —','HOMOLOGAÇÃO G5 —').replace('iasdpi-g4-preview-v1','iasdpi-g5-preview-v1').replace('<title>IASDPI · Prévia local</title>','<title>IASDPI · G5 Ancionato — homologação</title>')
if args.governance_audit_preview:
    html=html.replace('HOMOLOGAÇÃO G4 —','HOMOLOGAÇÃO G6 —').replace('iasdpi-g4-preview-v1','iasdpi-g6-preview-v1').replace('<title>IASDPI · Prévia local</title>','<title>IASDPI · G6 — homologação integrada</title>')
if args.department_days_preview:
    html=html.replace('HOMOLOGAÇÃO G6 —','HOMOLOGAÇÃO G7 —').replace('iasdpi-g6-preview-v1','iasdpi-g7-preview-v1').replace('G6 — homologação integrada','G7 — dias por departamento')
if args.registry_preview:
    html=html.replace('HOMOLOGAÇÃO G7 —','HOMOLOGAÇÃO G8.2 —').replace('G7 — dias por departamento','G8.2 — Cadastro Geral')
if args.registry_consolidation_preview:
    html=html.replace('HOMOLOGAÇÃO G8.2 —','HOMOLOGAÇÃO G8.3 —').replace('G8.2 — Cadastro Geral','G8.3 — Cadastro Geral').replace('iasdpi-registry-g82-preview-v1','iasdpi-registry-g83-preview-v1')
if args.registry_identities_preview:
    html=html.replace('HOMOLOGAÇÃO G8.3 —','HOMOLOGAÇÃO G8.4 —').replace('G8.3 — Cadastro Geral','G8.4 — Cadastro Geral de Membros').replace('iasdpi-registry-g83-preview-v1','iasdpi-registry-g84-preview-v1')
    html=html.replace('iasdpi-g7-preview-v1', 'iasdpi-registry-g84-preview-v1')
    html=html.replace('Cadastro Geral G8.2:', 'Cadastro Geral:')
if args.events_preview:
    for alias in ['admin.geral','admin.pi','anciao.editor','anciao.leitura','admin','som','musica','anciao','multi','leitura','editor','crono']:
        html=html.replace(alias+'.teste',alias+'.iasdpi')
    for old,new in [('Administrador fictício','Administrador · homologação'),('Administrador geral fictício','Administrador geral · homologação'),('Líder fictício de Sonoplastia','Sonoplastia'),('Líder fictício de Música','Música'),('Gestor fictício do Ancionato','Ancionato'),('Líder fictício de dois ministérios','Múltiplos ministérios'),('Visualizador fictício','Consulta'),('Editor fictício sem publicação','Edição sem publicação'),('Líder fictício da Cronoanálise','Cronoanálise')]:
        html=html.replace(old,new)
    html=html.replace('iasdpi-registry-g84-preview-v1','iasdpi-events-e1-preview-v1')
    html=html.replace('IASDPI · G8.4 — Cadastro Geral de Membros','IASDPI · Calendário e Eventos')
if args.calendar_privacy_preview:html=html.replace('iasdpi-events-e1-preview-v1','iasdpi-calendar-privacy-preview-v1')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html, encoding='utf-8')
with ZipFile(args.output.with_suffix('.zip'), 'w', ZIP_DEFLATED) as archive:
    archive.write(args.output, args.output.name)
print(args.output)
print(args.output.with_suffix('.zip'))
