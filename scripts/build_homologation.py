"""Prepara somente arquivos estáticos revisáveis; não faz commit/push/deploy."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ('index.html', 'styles.css', 'config.js', 'storage.js', 'auth.js',
          'demo.js', 'actuals.js', 'agenda-data.js', 'agenda.js', 'archive.js',
          'organization.js', 'users.js', 'app.js', '.nojekyll')
DEFAULT_URL = 'https://lcs-casagrande.github.io/IASDPI-homologacao/'


def build(output, site_url=DEFAULT_URL, agenda=None, preserve_local=False):
    output = Path(output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError('Destino não vazio. Escolha outra pasta; nenhum arquivo será substituído.')
    if not re.fullmatch(r'https://[a-z0-9.-]+/[A-Za-z0-9_-]+/', site_url):
        raise ValueError('Informe a URL HTTPS completa de homologação, com barra final.')
    raw = (ROOT / 'frontend/config.js').read_text()
    match = re.search(r'Object\.freeze\((\{[\s\S]*\})\);', raw)
    if not match:
        raise ValueError('Configuração pública não reconhecida.')
    cfg = json.loads(match[1])
    if set(cfg) != {'supabaseUrl', 'supabasePublishableKey'}:
        raise ValueError('Revisar os campos da configuração antes de gerar o site.')
    if not re.fullmatch(r'https://[a-z0-9]+\.supabase\.co', cfg['supabaseUrl']):
        raise ValueError('URL Supabase inválida.')
    if not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]{20,100}', cfg['supabasePublishableKey']):
        raise ValueError('Somente chave publishable pode ser publicada. Não usar credencial injetada.')
    cfg.update(environment='validation' if preserve_local else 'homologation', storageMode='browser',
               storageNamespace='' if preserve_local else 'iasdpi-homologacao-v1',
               remoteReadOnly=True, siteUrl=site_url)
    contents = {name: (ROOT / 'frontend' / name).read_bytes() for name in ASSETS}
    contents['config.js'] = ("'use strict';\n// Configuração PÚBLICA da homologação; sem segredos administrativos.\nwindow.IASDPIConfig = Object.freeze(" + json.dumps(cfg, ensure_ascii=False, indent=2) + ');\n').encode()
    if agenda:
        contents['agenda-data.js'] = Path(agenda).read_bytes()
    agenda_text = contents['agenda-data.js'].decode()
    if not agenda_text.startswith('window.IASDPIAgendaData = '):
        raise ValueError('Snapshot da agenda inválido.')
    parsed = json.loads(agenda_text[len('window.IASDPIAgendaData = '):].strip().rstrip(';'))
    if not isinstance(parsed.get('events'), list):
        raise ValueError('Agenda sem lista de eventos válida.')
    # Falhar antes de escrever qualquer arquivo se um segredo reconhecível existir.
    for name, value in contents.items():
        text = value.decode()
        if re.search(r'sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----', text):
            raise ValueError('Material secreto detectado; publicação recusada: ' + name)
        for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', text):
            raise ValueError('JWT literal detectado; publicação recusada: ' + name)
    # Cada recurso possui URL própria por conteúdo: evita misturar JS antigo e novo
    # no mesmo caminho Pages, sem apagar cache ou dados locais do usuário.
    html = contents['index.html'].decode()
    csp = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
           "connect-src 'self' " + cfg['supabaseUrl'] + "; img-src 'self' data:; "
           "object-src 'none'; base-uri 'none'; form-action 'self'")
    html = html.replace('<meta name="viewport"', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n  <meta name="viewport"', 1)
    for name, value in contents.items():
        if name.endswith(('.js', '.css')):
            version = hashlib.sha256(value).hexdigest()[:16]
            html = html.replace('"' + name + '"', '"' + name + '?v=' + version + '"')
    contents['index.html'] = html.encode()
    manifest = {'environment': cfg['environment'], 'site_url': site_url,
                'remote_read_only': True, 'storage_namespace': cfg['storageNamespace'],
                'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'source_has_uncommitted_changes': bool(subprocess.check_output(['git', '--no-optional-locks', 'status', '--porcelain'], cwd=ROOT)),
                'files': {name: hashlib.sha256(value).hexdigest() for name, value in contents.items()}}
    output.mkdir(parents=True, exist_ok=True)
    for name, value in contents.items():
        (output / name).write_bytes(value)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist/homologacao')
    parser.add_argument('--site-url', default=DEFAULT_URL)
    parser.add_argument('--agenda-data', type=Path, help='Snapshot JSON/JS público validado da agenda publicada')
    args = parser.parse_args()
    build(args.output, args.site_url, args.agenda_data)
    print('Homologação preparada em', args.output)
    print('Nenhum commit, push ou publicação executado.')
