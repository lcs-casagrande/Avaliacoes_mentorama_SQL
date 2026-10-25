"""Preflight de publicação/rollback: cópias descartáveis, sem Git ou Supabase remotos."""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import test_stabilization as stabilization

b = stabilization.release.builder
ROOT = stabilization.ROOT


def digest(data):
    return hashlib.sha256(data).hexdigest()


class PackageValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = tempfile.TemporaryDirectory(prefix='iasdpi-valid-packages-')
        cls.legacy, cls.one, cls.two, cls.rollback, _, _ = stabilization.versions(cls.fixtures.name)

    @classmethod
    def tearDownClass(cls):
        cls.fixtures.cleanup()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='iasdpi-preflight-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.site = self.root / 'previous'
        shutil.copytree(self.one, self.site)

    def manifest(self):
        return json.loads((self.site / 'manifest.json').read_text())

    def write_manifest(self, value):
        (self.site / 'manifest.json').write_text(json.dumps(value, indent=2) + '\n')

    def replace(self, name, data):
        if isinstance(data, str):
            data = data.encode()
        (self.site / name).write_bytes(data)
        manifest = self.manifest()
        manifest['files'][name] = digest(data)
        self.write_manifest(manifest)

    def rehash_loader(self, transform):
        manifest = self.manifest()
        old = manifest['entry']['loader'].split('?')[0]
        data = transform((self.site / old).read_text()).encode()
        new = 'assets/loader-' + digest(data) + '.js'
        new_url = new + '?v=' + digest(data)[:16]
        html = (self.site / 'index.html').read_text().replace(manifest['entry']['loader'], new_url)
        html = html.replace('sha256-' + base64.b64encode((hashlib.sha256((self.site / old).read_bytes()).digest())).decode(),
                            'sha256-' + base64.b64encode(hashlib.sha256(data).digest()).decode())
        (self.site / old).unlink()
        (self.site / new).write_bytes(data)
        (self.site / 'index.html').write_text(html)
        del manifest['files'][old]
        manifest['files'][new] = digest(data)
        manifest['files']['index.html'] = digest(html.encode())
        manifest['entry']['loader'] = new_url
        self.write_manifest(manifest)

    def reject(self, message, rollback=False, current=False):
        output = self.root / 'output'
        with self.assertRaisesRegex(ValueError, message):
            if rollback:
                b.build_rollback(output, self.legacy if current else self.site, self.site if current else self.one)
            else:
                b.build(output, stabilization.SITE_URL, preserve_local=True, operational=True, previous_site=self.site)
        self.assertFalse(output.exists(), 'Pacote inválido criou saída parcial')

    def test_valid_legacy_modern_retained_cohorts_and_rollback(self):
        for site in (self.legacy, self.one, self.two, self.rollback):
            with self.subTest(site=site.name):
                manifest = b.validate_package(site)
                self.assertTrue(manifest['files'])

    def test_missing_manifest_rejected_before_output(self):
        (self.site / 'manifest.json').unlink()
        self.reject('Manifesto obrigatório')

    def test_invalid_manifest_json_and_duplicate_keys_rejected(self):
        original = (self.site / 'manifest.json').read_text()
        for text in ('{incomplete', original.replace('"files": {', '"files": {}, "files": {')):
            with self.subTest(text=text[:20]):
                (self.site / 'manifest.json').write_text(text)
                self.reject('Manifesto inválido')

    def test_unknown_manifest_version_rejected(self):
        original = self.manifest()
        for value in (2, True, '1', None):
            with self.subTest(version=value):
                self.write_manifest({**original, 'manifest_version': value})
                self.reject('versão não suportada')

    def test_missing_origin_version_rejected(self):
        manifest = self.manifest()
        del manifest['source_commit']
        self.write_manifest(manifest)
        self.reject('origem ou configuração')

    def test_invalid_manifest_types_rejected_with_clear_message(self):
        original = self.manifest()
        for key, value in [('files', []), ('environment', {}), ('storage_namespace', None), ('remote_read_only', 'false')]:
            with self.subTest(key=key):
                self.write_manifest({**original, key: value})
                self.reject('Manifesto inválido')

    def test_missing_required_manifest_entry_rejected_even_when_file_exists(self):
        manifest = self.manifest()
        del manifest['files']['auth.js']
        self.write_manifest(manifest)
        self.reject('arquivo obrigatório ausente do manifesto: auth.js')

    def test_required_javascript_missing_on_disk_rejected(self):
        (self.site / 'auth.js').unlink()
        self.reject('arquivo obrigatório ausente: auth.js')

    def test_required_stylesheet_missing_rejected(self):
        (self.site / 'styles.css').unlink()
        self.reject('arquivo obrigatório ausente: styles.css')

    def test_missing_active_immutable_bundle_rejected(self):
        name = self.manifest()['entry']['bundle'].split('?')[0]
        (self.site / name).unlink()
        self.reject('arquivo obrigatório ausente: assets/app-')

    def test_missing_retained_bundle_is_not_ignored(self):
        shutil.rmtree(self.site)
        shutil.copytree(self.two, self.site)
        old = b.validate_package(self.one)['entry']['bundle'].split('?')[0]
        (self.site / old).unlink()
        self.reject('arquivo obrigatório ausente: assets/app-')

    def test_root_hash_tampering_rejected(self):
        (self.site / 'app.js').write_text('modified')
        self.reject('SHA-256 inválida: app.js')

    def test_stylesheet_hash_tampering_rejected(self):
        (self.site / 'styles.css').write_text('modified')
        self.reject('SHA-256 inválida: styles.css')

    def test_immutable_tampering_rejected_even_with_updated_manifest_hash(self):
        name = self.manifest()['entry']['bundle'].split('?')[0]
        self.replace(name, (self.site / name).read_bytes() + b'\nmodified')
        self.reject('recurso imutável inválida')

    def test_hash_format_is_validated(self):
        manifest = self.manifest()
        manifest['files']['app.js'] = 'invalid-hash'
        self.write_manifest(manifest)
        self.reject('SHA-256 de app.js')

    def test_manifest_path_traversal_rejected(self):
        manifest = self.manifest()
        manifest['files']['../outside.js'] = '0' * 64
        self.write_manifest(manifest)
        self.reject('caminho de arquivo não permitido')

    def test_undeclared_extra_file_rejected(self):
        (self.site / 'database.sqlite').write_bytes(b'fictitious-test-content')
        self.reject('arquivos não declarados')

    def test_symlink_file_or_assets_directory_rejected(self):
        (self.site / 'auth.js').unlink()
        (self.site / 'auth.js').symlink_to(self.one / 'auth.js')
        self.reject('link simbólico')
        (self.site / 'auth.js').unlink()
        shutil.copyfile(self.one / 'auth.js', self.site / 'auth.js')
        shutil.rmtree(self.site / 'assets')
        (self.site / 'assets').symlink_to(self.one / 'assets', target_is_directory=True)
        self.reject('link simbólico')

    def test_html_missing_dependency_rejected_with_updated_html_hash(self):
        self.replace('index.html', (self.site / 'index.html').read_text().replace('</head>', '<script src="missing.js"></script></head>'))
        self.reject('dependência ausente ou não declarada: missing.js')

    def test_external_and_traversing_html_dependencies_rejected(self):
        original = (self.site / 'index.html').read_text()
        for url in ('https://example.invalid/app.js', '//example.invalid/app.js', '../app.js', '%61pp.js', '/app.js'):
            with self.subTest(url=url):
                self.replace('index.html', original.replace('</head>', '<script src="' + url + '"></script></head>'))
                self.reject('Dependência externa ou caminho inválido')

    def test_duplicate_resource_attributes_rejected(self):
        self.replace('index.html', (self.site / 'index.html').read_text().replace('</head>', '<script src="app.js" src="auth.js"></script></head>'))
        self.reject('atributos de recurso duplicados')

    def test_missing_css_url_dependency_rejected(self):
        self.replace('styles.css', 'body { background: url(missing.png); }')
        self.reject('dependência ausente ou não declarada: missing.png')

    def test_missing_css_import_dependency_rejected(self):
        self.replace('styles.css', '@import "missing.css";')
        self.reject('dependência ausente ou não declarada: missing.css')

    def test_html_sri_tampering_rejected_even_with_updated_html_hash(self):
        self.replace('index.html', re_sri((self.site / 'index.html').read_text()))
        self.reject('SRI inválida')

    def test_dynamic_loader_missing_bundle_rejected(self):
        self.rehash_loader(lambda text: text.replace(self.manifest()['entry']['bundle'], 'assets/missing.js'))
        self.reject('dependência ausente ou não declarada: assets/missing.js')

    def test_dynamic_loader_bundle_sri_tampering_rejected(self):
        self.rehash_loader(re_sri)
        self.reject('SRI inválida')

    def test_dynamic_loader_empty_bundle_sri_rejected(self):
        import re
        self.rehash_loader(lambda text: re.sub(r'integrity="[^"]+"', 'integrity=""', text, count=1))
        self.reject('loader sem bundle e SRI')

    def test_missing_loader_dependency_metadata_rejected(self):
        self.rehash_loader(lambda text: text.replace('const bundle=', 'const renamed='))
        self.reject('loader sem bundle e SRI')

    def test_manifest_entry_must_match_loader_bundle(self):
        shutil.rmtree(self.site)
        shutil.copytree(self.two, self.site)
        manifest = self.manifest()
        manifest['entry']['bundle'] = b.validate_package(self.one)['entry']['bundle']
        self.write_manifest(manifest)
        self.reject('bundle do entry difere do loader')

    def test_entry_resources_and_versions_required(self):
        original = self.manifest()
        for entry in ({}, {**original['entry'], 'loader': original['entry']['loader'].split('?')[0]}):
            with self.subTest(entry=entry):
                self.write_manifest({**original, 'entry': entry})
                self.reject('Manifesto inválido')

    def test_duplicate_or_missing_entry_tag_in_html_rejected(self):
        original = (self.site / 'index.html').read_text()
        loader = self.manifest()['entry']['loader']
        tag = next(line for line in original.splitlines() if 'src="' + loader + '"' in line)
        for html in (original.replace(tag, ''), original.replace(tag, tag + '\n' + tag)):
            with self.subTest(duplicated=html.count(loader)):
                self.replace('index.html', html)
                self.reject('recurso entry ausente, duplicado ou sem SRI')

    def test_agenda_hash_mismatch_is_never_silently_accepted(self):
        data = (self.site / 'agenda-data.js').read_bytes()
        (self.site / 'agenda-data.js').write_bytes(data + b'\n')
        self.reject('SHA-256 inválida: agenda-data.js')

    def test_malformed_agenda_rejected_even_with_matching_hash(self):
        self.replace('agenda-data.js', 'window.IASDPIAgendaData = {"events":null};')
        self.reject('Snapshot da agenda inválido')

    def test_arbitrary_mutable_assets_not_allowed(self):
        manifest = self.manifest()
        manifest['mutable_assets'] = ['app.js']
        self.write_manifest(manifest)
        self.reject('somente a agenda')

    def test_rollback_rejects_incomplete_target(self):
        (self.site / 'auth.js').unlink()
        self.reject('arquivo obrigatório ausente: auth.js', rollback=True)

    def test_rollback_rejects_incomplete_current_package(self):
        (self.site / self.manifest()['entry']['bundle'].split('?')[0]).unlink()
        self.reject('arquivo obrigatório ausente: assets/app-', rollback=True, current=True)

    def test_legacy_html_cannot_omit_boot_dependencies(self):
        shutil.rmtree(self.site)
        shutil.copytree(self.legacy, self.site)
        html = (self.site / 'index.html').read_text()
        tag = next(line for line in html.splitlines() if 'src="auth.js?' in line)
        self.replace('index.html', html.replace(tag, ''))
        self.reject('HTML legado não referencia')

    def test_generated_package_validated_before_any_output(self):
        read = Path.read_bytes
        def modified(path):
            value = read(path)
            return value + b'\n@import "missing.css";' if path == ROOT / 'frontend/styles.css' else value
        output = self.root / 'output'
        with patch.object(Path, 'read_bytes', modified), self.assertRaisesRegex(ValueError, 'dependência ausente'):
            b.build(output)
        self.assertFalse(output.exists())

    def test_validate_cli_is_readonly_and_returns_nonzero_on_invalid_package(self):
        before = {str(p.relative_to(self.site)): digest(p.read_bytes()) for p in self.site.rglob('*') if p.is_file()}
        command = [sys.executable, '-B', str(ROOT / 'scripts/build_pages.py'), '--validate-site', str(self.site)]
        good = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(good.returncode, 0, good.stderr)
        after = {str(p.relative_to(self.site)): digest(p.read_bytes()) for p in self.site.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        (self.site / 'auth.js').unlink()
        bad = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(bad.returncode, 1)
        self.assertIn('auth.js', bad.stderr)
        self.assertNotIn('Traceback', bad.stderr)


def re_sri(text):
    import re
    return re.sub(r'sha256-[A-Za-z0-9+/=]+', 'sha256-' + base64.b64encode(bytes(32)).decode(), text, count=1)
