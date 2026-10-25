"""Exporta a demonstração como um HTML único para abrir sem servidor."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root / 'dist' / 'IASDPI-previa.html')
parser.add_argument('--read-only', action='store_true', help='Bloqueia gravações remotas na prévia e mantém os registros no navegador.')
args = parser.parse_args()
frontend = root / 'frontend'
html = (frontend / 'index.html').read_text(encoding='utf-8')
css = (frontend / 'styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
for name in ('config.js', 'storage.js', 'supabase-2.118.0.js', 'auth.js', 'record-time.js', 'demo.js', 'operational.js', 'actuals.js', 'agenda-data.js', 'agenda.js', 'archive.js', 'organization.js', 'users.js', 'trash.js', 'drafts.js', 'navigation.js', 'conflicts.js', 'history.js', 'app.js'):
    script = (frontend / name).read_text(encoding='utf-8')
    if name == 'config.js':
        mode = ",remoteReadOnly:true,environment:'validation'" if args.read_only else ''
        script += "\nwindow.IASDPIConfig=Object.freeze({...window.IASDPIConfig,storageMode:'browser'" + mode + "});\n"
    script = script.replace('</script', '<\\/script')
    html = html.replace(f'  <script src="{name}" defer></script>\n', '')
    # Scripts executam após os elementos da página existirem.
    html = html.replace('</body>', f'<script>\n{script}\n</script>\n</body>')
html = html.replace('<title>IASDPI · Programação do culto</title>', '<title>IASDPI · Prévia local</title>')
html = html.replace('</head>', '<script>if (!location.hash) location.hash = "organization";</script>\n</head>')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html, encoding='utf-8')
with ZipFile(args.output.with_suffix('.zip'), 'w', ZIP_DEFLATED) as archive:
    archive.write(args.output, args.output.name)
print(args.output)
print(args.output.with_suffix('.zip'))
