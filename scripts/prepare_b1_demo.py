"""Monta pacote local /b1/ sem alterar o calendário histórico ou publicar."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
import build_schedule_demo as demo

FILES=('index.html','styles.css','demo.js','manifest.json','.nojekyll')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def prepare(output,historical_site):
    output=Path(output);historical_site=Path(historical_site)
    if output.exists():raise ValueError('Destino já existe; nenhum arquivo foi sobrescrito.')
    for name in FILES:
        if not (historical_site/name).is_file() or (historical_site/name).is_symlink():raise ValueError('Arquivo histórico obrigatório ausente ou irregular: '+name)
    manifest=json.loads((historical_site/'manifest.json').read_text())
    if manifest.get('environment')!='calendar-preview' or manifest.get('database_connected') is not False or manifest.get('remote_requests_allowed') is not False:
        raise ValueError('Use o pacote histórico isolado e aprovado, sem conexão com o banco.')
    if set(manifest['files'])!=set(FILES)-{'manifest.json'}:raise ValueError('Inventário histórico incompleto ou inesperado.')
    for name,digest in manifest['files'].items():
        if sha(historical_site/name)!=digest:raise ValueError('Integridade histórica inválida: '+name)
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='iasdpi-b1-prepare-',dir=output.parent) as temp:
        site=Path(temp)/'site';site.mkdir()
        for name in FILES:shutil.copyfile(historical_site/name,site/name)
        demo.build(site/'b1',homologation_demo=True)
        for file in site.rglob('*'):
            if file.is_file() and re.search(r'https?://|sb_publishable_|sb_secret_|postgresql://|gh[pousr]_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.',file.read_text()):raise ValueError('Endereço externo ou credencial detectada: '+file.name)
        inventory={str(p.relative_to(site)):sha(p) for p in site.rglob('*') if p.is_file()}
        if set(inventory)!=set(FILES)|{'b1/'+name for name in FILES}:raise ValueError('Pacote deve conter somente dez arquivos estáticos.')
        for name in FILES:
            if sha(site/name)!=sha(historical_site/name):raise ValueError('O calendário histórico foi alterado: '+name)
        site.rename(output)
    return {'historical_root_unchanged':True,'database_connected':False,'publishing_performed':False,'files':inventory,'new_paths':['b1/'+name for name in FILES]}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--historical-site',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--standalone',type=Path);args=parser.parse_args()
    result=prepare(args.output,args.historical_site)
    (args.output.parent/'package-integrity.json').write_text(json.dumps(result,indent=2)+'\n')
    if args.standalone:
        demo.standalone(args.output/'b1',args.standalone)
        args.standalone.write_text(args.standalone.read_text().replace('href="../"','href="site/index.html"'))
    print('Pacote local pronto. Histórico preservado; nenhum commit, push ou deploy realizado.')
