"""G10.4: manifesto e pacote de REVISÃO offline; nunca conecta ou instala em banco."""
import argparse,datetime,hashlib,json,re,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHECKS={
5:['check_schedule_foundation.sql'],6:['check_schedule_management.sql'],7:['check_daily_schedules.sql'],8:['check_monthly_rotation.sql'],
9:['check_confirmed_schedule_conflicts.sql'],10:['check_daily_schedules.sql'],11:['check_church_isolation.sql'],12:['check_alias_login.sql'],
13:['check_access_governance.sql'],14:['check_portal_integration.sql'],15:['check_elder_period_storage.sql','check_governance_integration.sql'],
16:['check_department_schedule_days.sql'],17:['check_central_registry.sql'],18:['check_central_registry.sql'],19:['check_registry_identities.sql'],
20:['check_calendar_events.sql'],21:['check_calendar_privacy.sql'],22:['check_event_planning.sql'],23:['check_schedule_edit_window.sql'],
24:['check_schedule_publication_rules.sql'],25:['check_event_direct_publication.sql'],26:['check_governance_responsibilities.sql']}
PURPOSE={5:'Cadastro central e ministérios',6:'Planos, atribuições e histórico',7:'Datas e configuração de planejamento',8:'Montagem mensal e rodízio',9:'Conflitos e compromissos históricos',10:'Montagem manual simplificada',11:'Igreja, backfill, chaves, RLS e executor',12:'Login por apelido',13:'Capacidades e recuperação administrativa',14:'Portal e feeds publicados',15:'Ancionato semanal e mensal',16:'Dias de escala por departamento',17:'Integração central de pessoas e vínculos',18:'Busca do Cadastro Geral',19:'Identidades, aliases históricos e conciliação',20:'Eventos editoriais',21:'Classificação e privacidade',22:'Recorrência e reservas',23:'Mês atual e janela de edição',24:'Comunicação e vagas pendentes',25:'Kernel de publicação direta',26:'Governança final G10.3 e aprovação geral'}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def inventory():
 steps=[]
 for n in range(5,27):
  candidates=[p for p in (ROOT/'database').glob(f'{n:03d}_*.sql') if not p.name.endswith('_down.sql')]
  if len(candidates)!=1:raise ValueError(f'Forward ausente ou duplicado: {n:03d}')
  p=candidates[0];s=p.read_text()
  if not re.search(r'^BEGIN;',s,re.M|re.I) or not re.search(r'^COMMIT;',s,re.M|re.I):raise ValueError('Transação não identificada: '+p.name)
  checks=[{'file':'database/'+f,'sha256':sha(ROOT/'database'/f)} for f in CHECKS[n]]
  steps.append({'order':n-4,'migration':n,'file':str(p.relative_to(ROOT)),'sha256':sha(p),'purpose':PURPOSE[n],'predecessor':f'{n-1:03d}',
   'execute_after_authorization_only':True,'transaction':'BEGIN/COMMIT próprios, um arquivo por etapa','checks':checks,
   'expected_check_result':'Zero irregularidades ou DO concluído sem erro. Não basta retornar HTTP 200.','on_failure':'Interromper, registrar resultado, não executar a próxima etapa nem reaplicar a etapa commitada.'})
 return {'format':'IASDPI_G10_4_INSTALLATION_REVIEW','version':1,'prepared_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'branch':subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),'base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
  'worktree_has_uncommitted_changes':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT)),
  'mode':'review-only','target_label_informed_by_user':'IASD_Parada','remote_schema_independently_validated':False,
  'input_evidence':'Resumo G10.1 fornecido pelo usuário: 001–004 compatíveis; 005–025 ausentes; 12 tabelas, 22 funções, RLS ativa, sem executor/ledger.',
  'g10_2_report_available':False,'g10_2_audit_repeated':False,'existing_migrations_to_skip':['001','002','003','004'],
  'required_forward_count':len(steps),'steps':steps,
  'runtime_components':[{'file':f,'sha256':sha(ROOT/f)} for f in ['frontend/auth.js','frontend/agenda.js','frontend/governance.js','frontend/portal-access.js','frontend/config.js','scripts/build_homologation.py','supabase/config.toml','supabase/functions/alias-login/index.ts','supabase/functions/alias-login/handler.mjs','supabase/functions/access-assistance/index.ts','supabase/functions/access-assistance/handler.mjs','supabase/functions/access-assistance/credentials.mjs']],
  'final_checks':['database/check_church_isolation.sql','database/check_governance_responsibilities.sql'],
  'authorization_granted_for_real_database':False,'supabase_accessed':False,'deployment_executed':False,
  'stop_gates':['Antes de iniciar: projeto/ponto de recuperação/delta e papel operador confirmados.','Antes de 011: backup validado, janela de locks e DCL do provedor confirmados.','Não liberar novos módulos na etapa 025; concluir 026 para aplicar a regra de aprovação da G10.3.','Após 026: Auth/Edge/frontend e contas exigem autorizações próprias; não marcar troca de senha antes de disponibilizar o fluxo seguro.']}
def prepare(output,package=None):
 if package and Path(package).exists():raise ValueError('Pacote já existe; nenhum arquivo sobrescrito.')
 data=inventory();output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 if package:
  package=Path(package)
  if package.exists():raise ValueError('Pacote já existe; nenhum arquivo sobrescrito.')
  package.parent.mkdir(parents=True,exist_ok=True)
  paths={step['file'] for step in data['steps']}|{check['file'] for step in data['steps'] for check in step['checks']}|set(data['final_checks'])
  with zipfile.ZipFile(package,'x',compression=zipfile.ZIP_DEFLATED) as z:
   for path in sorted(paths):z.write(ROOT/path,path)
   z.writestr('manifest.json',json.dumps(data,ensure_ascii=False,indent=2)+'\n')
   z.writestr('LEIA-ME.md','# IASDPI — revisão G10.4\n\nNÃO EXECUTAR sem autorização específica. Pacote offline, sem instalador automático. Não contém 001–004. Executar somente as etapas aprovadas de 005–026, um arquivo por vez, com checks na ordem do manifesto; parar em qualquer erro/irregularidade. Não usar checks antigos fora da etapa indicada. Não é backup. Consultar o relatório único docs/governance-g10-4-readiness.md no projeto.\n')
 return data
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=ROOT/'docs/governance-g10-4-migrations.json');p.add_argument('--package',type=Path);a=p.parse_args();prepare(a.output,a.package);print(a.output)
