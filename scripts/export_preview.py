"""Exporta a demonstração como um HTML único para abrir sem servidor."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root / 'dist' / 'IASDPI-previa.html')
args = parser.parse_args()
frontend = root / 'frontend'
html = (frontend / 'index.html').read_text(encoding='utf-8')
css = (frontend / 'styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
for name in ('demo.js', 'actuals.js', 'agenda-data.js', 'agenda.js', 'app.js'):
    script = (frontend / name).read_text(encoding='utf-8')
    if name == 'demo.js':
        # A prévia sempre usa o navegador, inclusive quando aberta via file://.
        script = script.replace("if (location.hostname.endsWith('.github.io') || new URLSearchParams(location.search).get('demo') === '1') {", 'if (true) {', 1)
        script = script.replace('DEMONSTRAÇÃO · Sem envio de dados.', 'PRÉVIA LOCAL · Sem envio de dados.')
    script = script.replace('</script', '<\\/script')
    html = html.replace(f'  <script src="{name}" defer></script>\n', '')
    # Scripts executam após os elementos da página existirem.
    html = html.replace('</body>', f'<script>\n{script}\n</script>\n</body>')
html = html.replace('<title>IASDPI · Programação do culto</title>', '<title>IASDPI · Prévia local</title>')
html = html.replace('</head>', '<script>if (!location.hash) location.hash = "actuals";</script>\n</head>')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html, encoding='utf-8')
with ZipFile(args.output.with_suffix('.zip'), 'w', ZIP_DEFLATED) as archive:
    archive.write(args.output, args.output.name)
print(args.output)
print(args.output.with_suffix('.zip'))
