"""G10.1: catálogo local de migrações; não conecta a serviços nem executa SQL."""
import argparse,datetime,hashlib,json,re,subprocess
from pathlib import Path
from audit_g9_migrations import NOTES as G9_NOTES
ROOT=Path(__file__).resolve().parents[1]
NOTES={**G9_NOTES,
1:'Base de acesso e modelos da Cronoanálise; cria tabelas/políticas e insere modelo inicial. Não reaplicar em banco existente.',
2:'Gestão de usuários, convites, auditoria e bloqueio administrativo; exige 001 e identidades existentes conferidas.',
3:'Cultos operacionais, projeções, revisões, recibos e versões de modelos. Migrações não substituem backup de dados.',
4:'Lixeira recuperável, colunas/índices/políticas e RPCs dos cultos; exige 001–003.',
20:'Eventos editoriais separados de schedule_events, versões e autorização; não importa a Agenda nem vincula automaticamente escalas.',
21:'Classificação, organizador, público-alvo e privacidade; muda feeds públicos. Novos campos desconhecidos permanecem pendentes.',
22:'Recorrência, locais e reservas exclusivas; integra alteração de RPCs. Introduziu aprovação que a 025 desativa.',
23:'Edição do mês atual e período futuro; preserva datas passadas e depende de implementações privadas anteriores.',
24:'Comunicação não bloqueia outros departamentos; publicação com vagas em aberto; ajusta kernels, constraint do Ancionato e feed.',
25:'Publicação direta de eventos autorizados, sem aprovação intermediária; preserva rascunhos, reservas, histórico e permissões.'}
RISKS={
1:'Não idempotente. IF NOT EXISTS em culto_archives não torna o arquivo reexecutável; políticas/modelo existentes exigem conciliação.',
2:'CREATE SCHEMA/TABLE/FUNCTION; não repetir. Depende de owners e RLS reconhecidos.',
3:'Novas estruturas e seed de modelos; não recriar ou substituir cultos/modelos já usados.',
4:'ADD COLUMN, troca de policies e kernels; reexecução/versão divergente exige plano específico.',
7:'Backfill de assigned_on e alteração temporária de trigger; conferir datas/tipos/precisão dos registros antigos.',
10:'Flexibilização manual não pode confirmar habilitações/disponibilidades desconhecidas na sugestão automática.',
11:'Backfill church_id, PKs/FKs/índices/RLS/owners de estruturas existentes, locks ACCESS EXCLUSIVE e leituras integrais para verificação. Caminho core-only não aceita 005–010 depois sem adaptação revisada.',
13:'Converte capacidades antigas de schedule_department_access; conferir privilégios resultantes, sem derivar acesso de liderança ou apelido.',
15:'Down somente elegível sem dados/receipts/histórico e sem migrações posteriores. Com uso, recuperação por backup; nunca CASCADE.',
16:'Copia dias globais existentes por departamento. Não presumir quarta/sábado/domingo se houver configuração própria.',
17:'Marca participação quando há habilitação prévia; revisar vínculos antigos. Cadastro e Auth continuam entidades distintas.',
18:'CREATE OR REPLACE da busca; reaplicar após 019 regride busca e filtragem de pessoas consolidadas.',
19:'Instalar não aplica padronização nem mescla nomes. Conciliação exige prévia administrativa, versão e confirmação por grupo.',
20:'Não duplicar eventos técnicos de escala, fontes oficiais e eventos editoriais; conferir possíveis associações antes de importar.',
21:'Reescreve funções existentes/feeds; não reaplicar após 022–025. Não reclassifica dados antigos automaticamente.',
22:'Move/renomeia funções e cria reservas. Não ativar só 022 com frontend atual: reapareceria aprovação intermediária.',
23:'Requer kernels privados esperados; difere de antigo planejamento somente a partir do próximo mês.',
24:'Up/down condicionados ao histórico e às regras de compatibilidade; down pode recusar com publicações incompletas ou sobreposições autorizadas.',
25:'Backups privados e patches exatos de funções; divergência aborta. Down recusa após gravações pelo fluxo 025; recuperar por backup.'}
def inventory():
 steps=[]
 for number in range(1,26):
  candidates=[p for p in (ROOT/'database').glob(f'{number:03d}_*.sql') if not p.name.endswith('_down.sql')]
  if len(candidates)!=1:raise ValueError(f'Forward ausente ou duplicado: {number:03d}')
  p=candidates[0];s=p.read_text();down=p.with_name(p.stem+'_down.sql')
  if not re.search(r'^begin;',s,re.M|re.I) or not re.search(r'^commit;',s,re.M|re.I):raise ValueError(f'Transação não identificada: {p.name}')
  steps.append({'number':number,'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
   'scope':'001–021 solicitado' if number<=21 else 'Dependência adicional da versão publicada',
   'remote_status':'indeterminada','reason':'Inventário real do IASD_Parada ainda não recebido. Presença de marcador não comprova instalação.',
   'review_order_only':number,'reviewed_predecessor':f'{number-1:03d}' if number>1 else 'Supabase Auth, papéis do provedor e estruturas existentes a inventariar',
   'purpose':NOTES[number],'reexecution_risk':RISKS.get(number,'Cria ou move objetos/versiona kernels; não é migração idempotente. Conferir estado real antes de planejar.'),
   'declared_tables':re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)',s,re.I),
   'down':str(down.relative_to(ROOT)) if down.exists() else None,
   'rollback':'Revisar condições do down e dependências; não executar nesta etapa.' if down.exists() else 'Sem down automático; recuperação por backup em destino separado.'})
 return {'format':'IASDPI_G10_1_LOCAL_REVIEW','version':1,'source_branch':subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip(),
  'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
  'prepared_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target_label_informed_by_user':'IASD_Parada',
  'target_project_identity_verified':False,'real_inventory_received':False,'definitive_installation_sql_prepared':False,
  'execution_plan_authorized':False,'steps':steps,
  'notes':['Não conectar nem migrar automaticamente.','001–025 é ordem de revisão da cadeia, não lista de migrações a executar.',
   'Supabase atual atende à Cronoanálise: frontend de homologação no mesmo banco não isola produção.',
   'Receber inventário antes de classificar instalada/pendente/divergente ou preparar SQL de instalação definitivo.']}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=ROOT/'docs/g10-1-migration-review.json');args=parser.parse_args();args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(inventory(),ensure_ascii=False,indent=2)+'\n');print(args.output)
