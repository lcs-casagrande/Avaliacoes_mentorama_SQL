"""Inventário estático G6. Lê código local; grava somente o relatório indicado."""
import argparse
import hashlib
import json
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]

def inventory():
    steps=[]
    for number in range(5,16):
        paths=[p for p in (ROOT/'database').glob(f'{number:03d}_*.sql') if not p.name.endswith('_down.sql')]
        if len(paths)!=1:raise ValueError(f'Migração {number:03d}: esperado um arquivo forward; encontrados {len(paths)}.')
        p=paths[0];s=p.read_text();steps.append({'number':number,'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'lines':len(s.splitlines()),'declared_tables':re.findall(r'CREATE TABLE ([\w.]+)',s,re.I),'declared_functions':re.findall(r'CREATE (?:OR REPLACE )?FUNCTION ([\w.]+)',s,re.I),'declared_indexes':re.findall(r'CREATE (?:UNIQUE )?INDEX ([\w.]+)',s,re.I),'rollback_file':str(p.with_name(p.stem+'_down.sql').relative_to(ROOT)) if p.with_name(p.stem+'_down.sql').exists() else None})
    config=(ROOT/'frontend/config.js').read_text()
    return {'branch_expected':'feat/schedule-management-b1','production_queried':False,'steps':steps,'flags':{name:bool(re.search(r'[\"\']?'+name+r'[\"\']?\s*:\s*true',config)) for name in ['churchIsolationEnabled','aliasLoginEnabled','governanceEnabled','portalAccessEnabled']},'caveat':'Declarações estáticas não comprovam objeto instalado; consultar metadados locais e depois homologar no ambiente real autorizado.'}
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=ROOT/'dist/governance-g6/migration-inventory.json');args=parser.parse_args();result=inventory();args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');print(args.output)
