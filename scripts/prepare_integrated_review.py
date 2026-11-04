"""Prepara homologação estática integrada sem publicar nem conectar ao Supabase."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = 'iasdpi-integrated-review-v1'
FAKE_KEY = 'sb_publishable_fictitious_only_123456789'
FILES = {'index.html', 'LEIA-ME.md'}
GUIDE = '''# IASDPI — Homologação integrada

Portal, Agenda, Organograma, Cadastro Geral, Escalas e acessos demonstrativos.
E1 (Gestão de Eventos) não está implementada nesta candidata.

As alterações ficam em memória e reiniciam ao recarregar. Não inserir dados privados.
Não há conexão com Supabase, envio de e-mails ou contas reais.

1. Consulte Agenda, Organograma e Calendário sem login.
2. Abra Montar escala e escolha IASD_PI.
3. Entre com uma identidade fictícia abaixo. Senha fictícia: `Demonstracao#2026`.
4. Para testar o rodízio no Cadastro Geral integrado, confirme explicitamente
   a participação, habilitação e dias de uma pessoa de teste. Informação pendente
   não significa disponível. Responsabilidade ministerial não concede habilitação.
5. Salve rascunho; publique separadamente e confira o Calendário na mesma aba.
6. Confira Cadastro Geral e Gestão de Acessos com o administrador fictício.

| Identificador fictício | Alcance |
| --- | --- |
| admin.teste | Administração demonstrativa da IASD_PI |
| som.teste | Sonoplastia |
| musica.teste | Música |
| anciao.teste | Ancionato semanal e mensal |
| multi.teste | Sonoplastia e Música |
| leitura.teste | Consulta sem gravação |
| editor.teste | Edição sem publicação |
| crono.teste | Cronoanálise demonstrativa |

A mesma senha acima serve apenas ao simulador público. Nunca utilizá-la em contas reais.
Fontes históricas autorizadas permanecem separadas dos dados editados na demonstração.
Os exemplos fictícios anteriores de rodízio também permanecem em ../b12/.
'''
BANNER = '''<aside class="review-banner" aria-label="Ambiente de homologação">
<strong>HOMOLOGAÇÃO — DEMONSTRAÇÃO INTEGRADA</strong>
<p>Alterações temporárias: reiniciam ao recarregar. Sem conexão com o Supabase.</p>
<a href="../">Demonstrações anteriores</a> · <a href="LEIA-ME.md">Roteiro e contas fictícias</a>
<details><summary>Contas para avaliação</summary><p>Use <b>admin.teste</b>, <b>som.teste</b>, <b>musica.teste</b>, <b>anciao.teste</b>, <b>multi.teste</b> ou <b>leitura.teste</b>. Senha exclusivamente fictícia: <b>Demonstracao#2026</b>.</p><p>Abra Montar escala para entrar. Habilitações e dias pendentes precisam ser confirmados no Cadastro Geral antes do rodízio.</p></details>
</aside>'''
STYLE = '''<style>.review-banner{padding:12px 16px;border-bottom:2px solid #176a8a;background:#edf6fb;color:#123c50;font-size:14px;overflow-wrap:break-word}.review-banner p{margin:5px 0}.review-banner a{display:inline-flex;align-items:center;min-height:44px;color:#07517c}.review-banner summary{cursor:pointer;min-height:44px;display:list-item;align-content:center}.review-banner details p{max-width:80ch}.review-banner a:focus-visible,.review-banner summary:focus-visible{outline:3px solid #07517c;outline-offset:2px}</style>'''


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class Dependencies(HTMLParser):
    def __init__(self):
        super().__init__()
        self.policy = ''
        self.external = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy':
            self.policy = a.get('content', '')
        key = 'src' if tag in {'script', 'iframe', 'img', 'source'} else 'href' if tag == 'link' else None
        if tag == 'base' or key and a.get(key) and not a[key].startswith('data:'):
            self.external.append(tag)


def validate(folder):
    folder = Path(folder)
    manifest = json.loads((folder / 'manifest.json').read_text())
    if (manifest.get('environment') != 'isolated-demo' or manifest.get('database_connected') is not False
            or manifest.get('remote_requests_allowed') is not False or set(manifest.get('files', {})) != FILES
            or {p.name for p in folder.iterdir()} != FILES | {'manifest.json'}):
        raise ValueError('Pacote integrado incompleto ou configuração insegura.')
    for name, digest in manifest['files'].items():
        p = folder / name
        if p.is_symlink() or not p.is_file() or sha(p) != digest:
            raise ValueError('Integridade inválida: ' + name)
    text = (folder / 'index.html').read_text()
    parsed = Dependencies();parsed.feed(text)
    if parsed.external or "connect-src 'none'" not in parsed.policy or "form-action 'none'" not in parsed.policy:
        raise ValueError('Demonstração deve ser independente e bloquear conexões/formulários externos.')
    forbidden = r'sb_secret_[A-Za-z0-9_-]+|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]+|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|postgres(?:ql)?://|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
    if re.search(forbidden, text) or any(x in text for x in ['pwbxksxxmnblqwpvlheu', 'chzltoqifqgylgkxbwuk']):
        raise ValueError('Credencial ou referência ao Supabase real no pacote.')
    if set(re.findall(r'sb_publishable_[A-Za-z0-9_-]+', text)) != {FAKE_KEY}:
        raise ValueError('Somente o identificador explicitamente fictício do simulador é permitido.')
    if NAMESPACE not in text or 'Alterações temporárias: reiniciam ao recarregar' not in text:
        raise ValueError('Isolamento ou identificação da demonstração ausente.')
    return manifest


def prepare(output, historical_site):
    output, historical_site = Path(output), Path(historical_site)
    if output.exists():
        raise ValueError('Destino já existe; nenhum arquivo será sobrescrito.')
    files = [p for p in subprocess.check_output(['git', 'ls-files', '-z'], cwd=historical_site).decode().split('\0') if p]
    if not files or 'index.html' not in files or 'manifest.json' not in files:
        raise ValueError('Site anterior não reconhecido.')
    for name in files:
        p = historical_site / name
        if p.is_symlink() or p.suffix not in {'', '.html', '.css', '.js', '.json', '.md'} or any(part.startswith('.') and part != '.nojekyll' for part in p.relative_to(historical_site).parts):
            raise ValueError('Arquivo não estático no site anterior: ' + name)
    before = {name: sha(historical_site / name) for name in files}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='iasdpi-integrated-review-', dir=output.parent) as temp:
        stage = Path(temp) / 'site';stage.mkdir()
        for name in files:
            target = stage / name;target.parent.mkdir(parents=True, exist_ok=True);shutil.copyfile(historical_site / name, target)
        target = stage / 'integrada';target.mkdir()
        subprocess.run([sys.executable, str(ROOT / 'scripts/export_preview.py'), '--registry-identities-preview', '--output', str(target / 'index.html')], cwd=ROOT, check=True, capture_output=True)
        # O ZIP local de revisão não pertence à publicação estática.
        (target / 'index.zip').unlink()
        text = (target / 'index.html').read_text().replace('iasdpi-registry-g84-preview-v1', NAMESPACE)
        text = text.replace('</head>', STYLE + '</head>').replace('<body>', '<body>' + BANNER, 1)
        (target / 'index.html').write_text(text)
        (target / 'LEIA-ME.md').write_text(GUIDE)
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        manifest = {'environment': 'isolated-demo', 'database_connected': False, 'remote_requests_allowed': False,
                    'temporary_edits': True, 'source_branch': 'feat/schedule-management-b1', 'source_commit': commit,
                    'source_dirty': bool(subprocess.check_output(['git', '--no-optional-locks', 'status', '--porcelain'], cwd=ROOT)),
                    'features': ['portal', 'agenda', 'organograma', 'cadastro-geral', 'escalas', 'rodizio', 'conflitos', 'acessos-demonstrativos'],
                    'excluded': ['E1'], 'files': {name: sha(target / name) for name in sorted(FILES)}}
        (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        validate(target)
        root = stage / 'index.html';html = root.read_text()
        if 'href="integrada/"' in html:
            raise ValueError('A entrada integrada já existe; revisar atualização explicitamente.')
        root.write_text(html.replace('</nav></header>', '<a href="integrada/">Homologação integrada</a></nav></header>', 1))
        if root.read_text() == html:
            raise ValueError('Cabeçalho anterior não reconhecido.')
        old_manifest = json.loads((stage / 'manifest.json').read_text());old_manifest['files']['index.html'] = sha(root)
        (stage / 'manifest.json').write_text(json.dumps(old_manifest, ensure_ascii=False, indent=2) + '\n')
        for name, digest in before.items():
            if name not in {'index.html', 'manifest.json'} and sha(stage / name) != digest:
                raise ValueError('Demonstração anterior foi alterada: ' + name)
        if before != {name: sha(historical_site / name) for name in files}:
            raise ValueError('Site anterior sofreu alteração externa durante a preparação.')
        stage.rename(output)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--historical-site', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.output, args.historical_site)
    print(args.output / 'integrada/')
