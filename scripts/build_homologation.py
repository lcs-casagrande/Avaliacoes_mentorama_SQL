"""Prepara somente arquivos estáticos revisáveis; não faz commit/push/deploy."""
import argparse
import hashlib
import base64
import json
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
import re
import subprocess
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ('index.html', 'styles.css', 'config.js', 'storage.js', 'supabase-2.118.0.js', 'supabase.LICENSE', 'auth.js',
          'record-time.js', 'demo.js', 'operational.js', 'actuals.js', 'agenda-data.js', 'agenda.js', 'archive.js',
          'organization.js', 'users.js', 'trash.js', 'drafts.js', 'navigation.js', 'conflicts.js', 'history.js', 'app.js', '.nojekyll')
DEFAULT_URL = 'https://lcs-casagrande.github.io/IASDPI-homologacao/'
IMMUTABLE = re.compile(r'assets/(?:app|loader|styles)-([a-f0-9]{64})\.(?:js|css)')
LEGACY_ASSETS = set(ASSETS) - {'drafts.js', 'navigation.js', 'conflicts.js', 'history.js'}


def _manifest_json(text):
    def unique(pairs):
        result = {}
        for name, value in pairs:
            if name in result:
                raise ValueError('Manifesto inválido: chave duplicada ' + name)
            result[name] = value
        return result
    try:
        return json.loads(text, object_pairs_hook=unique)
    except (json.JSONDecodeError, UnicodeError) as error:
        raise ValueError('Manifesto inválido: JSON não reconhecido.') from error


def _manifest_files(manifest):
    if not isinstance(manifest, dict) or not isinstance(manifest.get('files'), dict):
        raise ValueError('Manifesto inválido: inventário de arquivos obrigatório.')
    version = manifest.get('manifest_version', 1)
    if type(version) is not int or version != 1:
        raise ValueError('Manifesto inválido: versão não suportada.')
    if (not isinstance(manifest.get('environment'), str)
            or manifest['environment'] not in {'production', 'validation', 'homologation'}
            or not isinstance(manifest.get('storage_namespace'), str)
            or not isinstance(manifest.get('remote_read_only'), bool)
            or not re.fullmatch(r'https://[a-z0-9.-]+/[A-Za-z0-9_-]+/', str(manifest.get('site_url', '')))
            or not re.fullmatch(r'[a-f0-9]{40}', str(manifest.get('source_commit', '')))):
        raise ValueError('Manifesto inválido: versão de origem ou configuração incompleta.')
    strategy = manifest.get('asset_strategy')
    if strategy not in (None, 'immutable-bundle-sri-v1'):
        raise ValueError('Manifesto inválido: estratégia de recursos não suportada.')
    if strategy is None and 'entry' in manifest:
        raise ValueError('Manifesto inválido: entry sem estratégia de recursos.')
    files = manifest['files']
    required = set(ASSETS) if strategy else LEGACY_ASSETS
    missing = required - files.keys()
    if missing:
        raise ValueError('Integridade: arquivo obrigatório ausente do manifesto: ' + ', '.join(sorted(missing)))
    for name, digest in files.items():
        if not isinstance(name, str) or not (name in ASSETS or IMMUTABLE.fullmatch(name)):
            raise ValueError('Manifesto inválido: caminho de arquivo não permitido.')
        if not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise ValueError('Manifesto inválido: SHA-256 de ' + name)
    if manifest.get('mutable_assets', []) not in ([], ['agenda-data.js']):
        raise ValueError('Manifesto inválido: somente a agenda pode ser declarada mutável.')
    return files


def _agenda(data):
    try:
        text = data.decode('utf-8')
        prefix = 'window.IASDPIAgendaData = '
        if not text.startswith(prefix):
            raise ValueError()
        parsed = json.loads(text[len(prefix):].strip().rstrip(';'))
        if not isinstance(parsed, dict) or not isinstance(parsed.get('events'), list):
            raise ValueError()
    except (ValueError, UnicodeError) as error:
        raise ValueError('Snapshot da agenda inválido: esperado JSON com lista de eventos.') from error


def _reference(url, contents, origin='index.html', integrity=None):
    if not isinstance(url, str):
        raise ValueError('Dependência inválida em ' + origin)
    parsed = urlsplit(url)
    path = parsed.path
    if (parsed.scheme or parsed.netloc or parsed.fragment or path.startswith('/')
            or unquote(path) != path or '\\' in path or '..' in PurePosixPath(path).parts):
        raise ValueError('Dependência externa ou caminho inválido em ' + origin)
    name = str(PurePosixPath(origin).parent / path)
    if name not in contents:
        raise ValueError('Integridade: dependência ausente ou não declarada: ' + name + ' (em ' + origin + ')')
    if integrity is not None:
        actual = 'sha256-' + base64.b64encode(hashlib.sha256(contents[name]).digest()).decode()
        if integrity != actual:
            raise ValueError('Integridade SRI inválida: ' + name)
    return name


class _PackageHTML(HTMLParser):
    def __init__(self, contents):
        super().__init__()
        self.contents = contents
        self.resources = {}

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'base':
            raise ValueError('Dependência inválida: base URL não permitida no pacote.')
        key = 'src' if tag in {'script', 'img', 'iframe', 'source'} else 'href' if tag == 'link' else None
        if key and key in values:
            if len([name for name, _ in attrs if name in {key, 'integrity'}]) != len({name for name, _ in attrs if name in {key, 'integrity'}}):
                raise ValueError('Dependência inválida: atributos de recurso duplicados.')
            url = values[key]
            name = _reference(url, self.contents, integrity=values.get('integrity'))
            self.resources.setdefault(name, []).append(values.get('integrity'))


def _validate_contents(contents, manifest):
    files = _manifest_files(manifest)
    if set(contents) != set(files):
        raise ValueError('Integridade: arquivos ausentes ou não declarados no manifesto.')
    for name, digest in files.items():
        if hashlib.sha256(contents[name]).hexdigest() != digest:
            raise ValueError('Integridade SHA-256 inválida: ' + name)
        match = IMMUTABLE.fullmatch(name)
        if match and match[1] != digest:
            raise ValueError('Integridade do recurso imutável inválida: ' + name)
        if re.search(rb'sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', contents[name]):
            raise ValueError('Material secreto no pacote: ' + name)
    _agenda(contents['agenda-data.js'])
    html = _PackageHTML(contents)
    try:
        html.feed(contents['index.html'].decode('utf-8'))
        for name, data in contents.items():
            if name.endswith('.css'):
                text = data.decode('utf-8')
                refs = re.findall(r'url\(\s*[\'"]?([^\'"\s)]+)', text)
                refs += re.findall(r'@import\s+[\'"]([^\'"]+)', text)
                for url in refs:
                    _reference(url, contents, name)
            if name.startswith('assets/loader-'):
                match = re.search(r'const bundle=("[^"\n]+"),integrity=("[^"\n]+")', data.decode('utf-8'))
                if not match:
                    raise ValueError('Dependência inválida: loader sem bundle e SRI: ' + name)
                # URLs do loader são relativas ao documento, não ao próprio JS.
                _reference(json.loads(match[1]), contents, integrity=json.loads(match[2]))
    except UnicodeError as error:
        raise ValueError('Recurso textual inválido no pacote.') from error
    if not manifest.get('asset_strategy'):
        required_refs = {name for name in LEGACY_ASSETS if name.endswith(('.js', '.css'))}
        if not required_refs.issubset(html.resources):
            raise ValueError('Integridade: HTML legado não referencia todas as dependências obrigatórias.')
    if manifest.get('asset_strategy'):
        entry = manifest.get('entry')
        if not isinstance(entry, dict) or set(entry) != {'bundle', 'loader', 'styles'}:
            raise ValueError('Manifesto inválido: entry deve declarar bundle, loader e styles.')
        for kind, prefix, suffix in [('bundle', 'app', 'js'), ('loader', 'loader', 'js'), ('styles', 'styles', 'css')]:
            name = _reference(entry[kind], contents)
            match = IMMUTABLE.fullmatch(name)
            if not match or not name.startswith('assets/' + prefix + '-') or not name.endswith('.' + suffix):
                raise ValueError('Manifesto inválido: entry de ' + kind)
            if urlsplit(entry[kind]).query != 'v=' + match[1][:16]:
                raise ValueError('Manifesto inválido: versão de recurso divergente: ' + name)
            if kind != 'bundle':
                sri = 'sha256-' + base64.b64encode(hashlib.sha256(contents[name]).digest()).decode()
                if html.resources.get(name) != [sri]:
                    raise ValueError('Integridade: recurso entry ausente, duplicado ou sem SRI no HTML: ' + name)
        loader = contents[urlsplit(entry['loader']).path].decode('utf-8')
        if 'const bundle=' + json.dumps(entry['bundle']) + ',' not in loader:
            raise ValueError('Manifesto inválido: bundle do entry difere do loader.')


def validate_package(site):
    """Valida o pacote inteiro sem escrever ou tolerar hashes defasados."""
    site = Path(site)
    if not site.is_dir() or site.is_symlink():
        raise ValueError('Pacote anterior inválido: diretório ausente ou link simbólico.')
    manifest_path = site / 'manifest.json'
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise ValueError('Manifesto obrigatório ausente ou inválido.')
    manifest = _manifest_json(manifest_path.read_text(encoding='utf-8'))
    files = _manifest_files(manifest)
    contents = {}
    for name in files:
        path = site / name
        if any(part.is_symlink() for part in [path, *path.parents] if part != site.parent):
            raise ValueError('Integridade: link simbólico não permitido: ' + name)
        if not path.is_file():
            raise ValueError('Integridade: arquivo obrigatório ausente: ' + name)
        contents[name] = path.read_bytes()
    actual = {str(path.relative_to(site)) for path in site.rglob('*') if path.is_file() or path.is_symlink()}
    if actual != set(files) | {'manifest.json'}:
        raise ValueError('Integridade: pacote contém arquivos não declarados no manifesto.')
    _validate_contents(contents, manifest)
    return manifest


def immutable_assets(previous_site):
    """Retém apenas recursos próprios, nomeados e conferidos pelo conteúdo."""
    result = {}
    if previous_site:
        for path in (Path(previous_site) / 'assets').glob('*'):
            if not path.is_file() or path.is_symlink():
                raise ValueError('Recurso anterior inválido.')
            match = re.fullmatch(r'(?:app|loader|styles)-([a-f0-9]{64})\.(?:js|css)', path.name)
            data = path.read_bytes()
            if not match or hashlib.sha256(data).hexdigest() != match[1]:
                raise ValueError('Integridade do recurso anterior inválida: ' + path.name)
            result['assets/' + path.name] = data
    return result


def build_rollback(output, target_site, current_site):
    """Retorna ao HTML anterior sem remover recursos usados por abas abertas."""
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Destino não vazio; rollback não preparado.')
    target, current = Path(target_site), Path(current_site)
    before = validate_package(target)
    now = validate_package(current)
    for name in ('site_url', 'environment', 'storage_namespace'):
        if before.get(name) != now.get(name):
            raise ValueError('Rollback de outro site/ambiente recusado.')
    contents = {name: (target / name).read_bytes() for name in before['files']}
    contents.update(immutable_assets(target))
    contents.update(immutable_assets(current))
    # A publicação de código não deve reverter a agenda oficial.
    contents['agenda-data.js'] = (current / 'agenda-data.js').read_bytes()
    for name, data in contents.items():
        if re.search(rb'sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', data):
            raise ValueError('Material secreto no rollback: ' + name)
    manifest = {**before, 'manifest_version': 1, 'rollback_from': now.get('source_commit'),
                'mutable_assets': ['agenda-data.js'],
                'files': {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}}
    _validate_contents(contents, manifest)
    for name, data in contents.items():
        (output / name).parent.mkdir(parents=True, exist_ok=True)
        (output / name).write_bytes(data)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def build(output, site_url=DEFAULT_URL, agenda=None, preserve_local=False, operational=False, previous_site=None):
    output = Path(output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError('Destino não vazio. Escolha outra pasta; nenhum arquivo será substituído.')
    old_manifest = validate_package(previous_site) if previous_site else None
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
    if operational:
        if not preserve_local:
            raise ValueError('Modo operacional exige o destino Pages principal.')
        cfg.update(environment='production', storageMode='supabase', remoteReadOnly=False)
    contents = {name: (ROOT / 'frontend' / name).read_bytes() for name in ASSETS}
    contents['config.js'] = ("'use strict';\n// Configuração PÚBLICA da homologação; sem segredos administrativos.\nwindow.IASDPIConfig = Object.freeze(" + json.dumps(cfg, ensure_ascii=False, indent=2) + ');\n').encode()
    if previous_site and agenda is None:
        agenda = Path(previous_site) / 'agenda-data.js'
    if agenda:
        contents['agenda-data.js'] = Path(agenda).read_bytes()
    _agenda(contents['agenda-data.js'])
    legacy = {}
    retained = immutable_assets(previous_site)
    if previous_site:
        previous = Path(previous_site)
        if old_manifest.get('site_url') != site_url or old_manifest.get('environment') != cfg['environment']:
            raise ValueError('O pacote anterior deve pertencer ao mesmo site e ambiente.')
        if old_manifest.get('storage_namespace') != cfg['storageNamespace']:
            raise ValueError('Namespace do pacote anterior incompatível.')
        for name in ASSETS:
            if name.endswith(('.js', '.css')) and name != 'agenda-data.js' and (previous / name).is_file():
                legacy[name] = (previous / name).read_bytes()
    # Um único script mantém o conjunto completo de dependências. A agenda é
    # dado público mutável: o workflow existente continua atualizando esse arquivo.
    bundle = b"'use strict';\nwindow.IASDPIRelease?.executing();\n" + b'\n;\n'.join(
        value for name, value in contents.items() if name.endswith('.js') and name != 'agenda-data.js')
    def resource(kind, data, suffix):
        digest = hashlib.sha256(data).hexdigest()
        name = 'assets/' + kind + '-' + digest + suffix
        retained[name] = data
        return name + '?v=' + digest[:16], 'sha256-' + base64.b64encode(hashlib.sha256(data).digest()).decode()
    bundle_url, bundle_sri = resource('app', bundle, '.js')
    loader = (ROOT / 'frontend/release-loader.js').read_text().replace('__IASDPI_BUNDLE__', json.dumps(bundle_url)).replace('__IASDPI_INTEGRITY__', json.dumps(bundle_sri)).encode()
    loader_url, loader_sri = resource('loader', loader, '.js')
    style_url, style_sri = resource('styles', contents['styles.css'] + b'\n:root{--iasdpi-release-style:ready}\n', '.css')
    # Confere também os aliases e recursos retidos antes de escrever o pacote.
    for name, value in {**contents, **legacy, **retained}.items():
        text = value.decode()
        if re.search(r'sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----', text):
            raise ValueError('Material secreto detectado; publicação recusada: ' + name)
        for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', text):
            raise ValueError('JWT literal detectado; publicação recusada: ' + name)
    html = contents['index.html'].decode()
    csp = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
           "connect-src 'self' " + cfg['supabaseUrl'] + "; img-src 'self' data:; "
           "object-src 'none'; base-uri 'none'; form-action 'self'")
    html = html.replace('<meta name="viewport"', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n  <meta name="viewport"', 1)
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" data-release-style href="' + style_url + '" integrity="' + style_sri + '" crossorigin="anonymous">')
    html = re.sub(r'  <script src="[^"]+" defer></script>\n', '', html)
    agenda_version = hashlib.sha256(contents['agenda-data.js']).hexdigest()[:16]
    html = html.replace('</head>', '<script src="agenda-data.js?v=' + agenda_version + '" defer></script>\n  <script src="' + loader_url + '" integrity="' + loader_sri + '" crossorigin="anonymous" defer></script>\n</head>')
    recovery = '<section id="release-recovery" class="panel" role="status" aria-live="polite"><h2>Preparando IASDPI</h2><p data-release-message>Carregando a aplicação. Se a conexão falhar, tente recarregar; seus registros e rascunhos serão preservados.</p><button type="button" data-release-retry hidden>Tentar novamente</button> <a data-release-reload href="./?iasdpi-update=1">Recarregar página</a></section>\n'
    html = html.replace('  <main id="app"', '  ' + recovery + '  <main id="app"')
    contents.update(legacy)
    contents.update(retained)
    contents['index.html'] = html.encode()
    manifest = {'manifest_version': 1, 'environment': cfg['environment'], 'site_url': site_url,
                'remote_read_only': cfg['remoteReadOnly'], 'storage_namespace': cfg['storageNamespace'],
                'asset_strategy': 'immutable-bundle-sri-v1', 'legacy_compatibility_ready': bool(previous_site),
                'mutable_assets': ['agenda-data.js'],
                'entry': {'bundle': bundle_url, 'loader': loader_url, 'styles': style_url},
                'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'source_has_uncommitted_changes': bool(subprocess.check_output(['git', '--no-optional-locks', 'status', '--porcelain'], cwd=ROOT)),
                'files': {name: hashlib.sha256(value).hexdigest() for name, value in contents.items()}}
    _validate_contents(contents, manifest)
    output.mkdir(parents=True, exist_ok=True)
    for name, value in contents.items():
        (output / name).parent.mkdir(parents=True, exist_ok=True)
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
