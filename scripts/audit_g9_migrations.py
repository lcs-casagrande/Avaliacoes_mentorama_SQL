"""Inventário 005–019 e diferenças esperadas; não executa SQL ou acessa serviços."""
import argparse,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NOTES={
5:'Fundação: pessoas, departamentos, vínculos, funções, disponibilidade, contatos privados e RPCs.',
6:'Eventos, planos, requisitos, atribuições, versões, validação transacional e índices.',
7:'Escalas por dia, configuração global, limites, exceções administrativas e compatibilidade temporal.',
8:'Contexto de rodízio e workspace, preservando implementação anterior.',
9:'Compromissos históricos, conflitos cruzados e contexto central de distribuição.',
10:'Participação geral e edição manual; preferências não são proibição retroativa.',
11:'Igreja IASD_PI, backfill, FKs por igreja, RLS restritiva e executor sem BYPASSRLS. Também suporta core sem Escalas, caminho que exige plano diferente para adicionar 005–010 depois.',
12:'Aliases Auth e orçamento de login; aliases institucionais reservados sem criar contas.',
13:'Governança, capacidades por departamento, estado de identidade, fila e recuperação controlada.',
14:'Feed público da última versão publicada e contexto de acesso do portal.',
15:'Ancionato semanal/mensal, histórico e proteção da versão publicada durante revisão.',
16:'Dias persistentes por departamento, CAS e configuração autorizada.',
17:'Cadastro central, perfis por vínculo, fontes conciliadas e projeções públicas.',
18:'Busca por nome preferido; substitui RPC existente. Não reaplicar depois da 019: regride busca/filtragem de pessoas consolidadas.',
19:'Aliases históricos privados, conciliação administrativa, IDs aposentados, auditoria e fechamento da RPC antiga de pessoas; instalação não mescla dados.'}
def inventory():
    steps=[]
    for number in range(5,20):
        files=[p for p in (ROOT/'database').glob(f'{number:03d}_*.sql') if not p.name.endswith('_down.sql')]
        if len(files)!=1:raise ValueError('Arquivo forward ausente ou duplicado: '+str(number))
        p=files[0];s=p.read_text();down=p.with_name(p.stem+'_down.sql')
        steps.append({'number':number,'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'transactional':bool(re.search(r'^BEGIN;',s,re.M|re.I) and re.search(r'^COMMIT;',s,re.M|re.I)),'note':NOTES[number],'requires_reviewed_predecessor':f'{number-1:03d}','declared_tables':re.findall(r'CREATE TABLE ([\w.]+)',s,re.I),'declared_indexes':re.findall(r'CREATE (?:UNIQUE )?INDEX ([\w.]+)',s,re.I),'down':str(down.relative_to(ROOT)) if down.exists() else None,'rollback_policy':'Somente etapa elegível/vazia, sem dependências, após revisão.' if down.exists() else 'Sem down automático; preservar banco e recuperar em destino separado.'})
    return {'branch':'feat/schedule-management-b1','production_schema_confirmed':False,'steps':steps,'markers_are_not_execution_ledger':True,'database_auth_is_stub_in_local_tests':True}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=ROOT/'dist/governance-g9/migration-review.json');a=p.parse_args();result=inventory();a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(a.output)
