"""Lote 6: versões reais de assets públicos, falhas controladas e dados fictícios.

Nenhuma chamada a Supabase real. A fixture ZIP contém somente o Pages público
do commit 2ca4ebd, sem registros operacionais nem banco de dados.
"""
import copy
from functools import partial
import hashlib
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit
import zipfile

import test_frontend_access as base
import test_pages_release as release
import test_operational_browser as operational
import test_hour_format as hours
import test_navigation_conflicts as navigation
import test_data_reliability as reliable

ROOT=base.ROOT
SITE_URL='https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/'


def versions(directory):
    directory=Path(directory);legacy=directory/'legacy';legacy.mkdir()
    with zipfile.ZipFile(ROOT/'tests/fixtures/pages-2ca4ebd.zip') as fixture:
        fixture.extractall(legacy)
    # O cron publicou a agenda sem renovar o manifesto legado. Somente esta
    # cópia descartável da fixture é atestada; o ZIP público original é imutável.
    manifest_path=legacy/'manifest.json'
    manifest=json.loads(manifest_path.read_text())
    manifest['files']['agenda-data.js']=hashlib.sha256((legacy/'agenda-data.js').read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    one=directory/'version-one';two=directory/'version-two';rollback=directory/'rollback'
    first=release.builder.build(one,SITE_URL,preserve_local=True,operational=True,previous_site=legacy,agenda=legacy/'agenda-data.js')
    read=Path.read_bytes
    def variant(path):
        value=read(path)
        return value+b'\nwindow.IASDPITestVersion="two";\n' if path==ROOT/'frontend/app.js' else value
    with patch.object(Path,'read_bytes',variant):
        second=release.builder.build(two,SITE_URL,preserve_local=True,operational=True,previous_site=one,agenda=legacy/'agenda-data.js')
    release.builder.build_rollback(rollback,legacy,two)
    return legacy,one,two,rollback,first,second


class StabilizationPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory=tempfile.TemporaryDirectory(prefix='iasdpi-lote6-package-')
        cls.root=Path(cls.directory.name)
        cls.legacy,cls.one,cls.two,cls.rollback,cls.first,cls.second=versions(cls.root)

    @classmethod
    def tearDownClass(cls):cls.directory.cleanup()

    def test_content_named_bundle_has_all_modules_in_order_and_integrity(self):
        html=(self.one/'index.html').read_text();manifest=self.first
        bundle=manifest['entry']['bundle'].split('?')[0];data=(self.one/bundle).read_bytes()
        self.assertIn(hashlib.sha256(data).hexdigest(),bundle)
        self.assertIn('integrity="sha256-',html)
        self.assertIn('crossorigin="anonymous"',html)
        self.assertTrue(manifest['legacy_compatibility_ready'])
        self.assertLess(data.index(b'window.IASDPINavigation='),data.index(b'function navigate(page,id,options)'))
        self.assertIn(b'window.IASDPIDrafts',data);self.assertIn(b'window.IASDPIConflicts',data);self.assertIn(b'window.IASDPIHistory',data)
        for name,digest in manifest['files'].items():self.assertEqual(hashlib.sha256((self.one/name).read_bytes()).hexdigest(),digest)

    def test_legacy_aliases_and_previous_immutable_cohorts_are_preserved(self):
        for path in self.legacy.iterdir():
            if path.suffix in ('.js','.css') and path.name!='agenda-data.js':self.assertEqual(path.read_bytes(),(self.two/path.name).read_bytes())
        for path in (self.one/'assets').iterdir():self.assertEqual(path.read_bytes(),(self.two/'assets'/path.name).read_bytes())
        self.assertNotEqual(self.first['entry']['bundle'],self.second['entry']['bundle'])
        self.assertEqual((self.legacy/'agenda-data.js').read_bytes(),(self.two/'agenda-data.js').read_bytes())

    def test_rollback_retains_new_assets_and_current_public_agenda(self):
        self.assertEqual((self.rollback/'index.html').read_bytes(),(self.legacy/'index.html').read_bytes())
        for path in (self.two/'assets').iterdir():self.assertEqual(path.read_bytes(),(self.rollback/'assets'/path.name).read_bytes())
        self.assertEqual((self.rollback/'agenda-data.js').read_bytes(),(self.two/'agenda-data.js').read_bytes())

    def test_previous_asset_corruption_is_rejected_before_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=Path(tmp)/'previous';shutil.copytree(self.one,previous)
            path=next((previous/'assets').glob('app-*'));path.write_bytes(b'corrupted')
            output=Path(tmp)/'site'
            with self.assertRaisesRegex(ValueError,'Integridade'):release.builder.build(output,SITE_URL,preserve_local=True,operational=True,previous_site=previous)
            self.assertFalse(output.exists())

    def test_previous_alias_corruption_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=Path(tmp)/'previous';shutil.copytree(self.legacy,previous);(previous/'app.js').write_text('corrupted')
            with self.assertRaisesRegex(ValueError,'Integridade'):release.builder.build(Path(tmp)/'site',SITE_URL,preserve_local=True,operational=True,previous_site=previous)

    def test_missing_previous_dependency_is_rejected_before_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=Path(tmp)/'previous';shutil.copytree(self.legacy,previous);(previous/'auth.js').unlink()
            output=Path(tmp)/'site'
            with self.assertRaisesRegex(ValueError,'Integridade'):release.builder.build(output,SITE_URL,preserve_local=True,operational=True,previous_site=previous)
            self.assertFalse(output.exists())

    def test_current_agenda_is_kept_by_default_instead_of_local_old_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'site';release.builder.build(output,SITE_URL,preserve_local=True,operational=True,previous_site=self.legacy)
            self.assertEqual((output/'agenda-data.js').read_bytes(),(self.legacy/'agenda-data.js').read_bytes())

    def test_secret_in_retained_legacy_file_is_rejected_even_with_updated_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=Path(tmp)/'previous';shutil.copytree(self.legacy,previous)
            data=b'// sb_secret_fake_not_a_real_key';(previous/'app.js').write_bytes(data)
            manifest=json.loads((previous/'manifest.json').read_text());manifest['files']['app.js']=hashlib.sha256(data).hexdigest();(previous/'manifest.json').write_text(json.dumps(manifest))
            output=Path(tmp)/'out'
            with self.assertRaisesRegex(ValueError,'Material secreto'):release.builder.build(output,SITE_URL,preserve_local=True,operational=True,previous_site=previous)
            self.assertFalse(output.exists())

    def test_previous_site_and_namespace_must_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,'mesmo site'):release.builder.build(Path(tmp)/'site',previous_site=self.one)

    def test_rollback_rejects_nonempty_destination_and_other_environment(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'target';target.mkdir();(target/'preserve').write_text('unchanged')
            with self.assertRaisesRegex(ValueError,'não vazio'):release.builder.build_rollback(target,self.legacy,self.two)
            self.assertEqual((target/'preserve').read_text(),'unchanged')
            previous=Path(tmp)/'previous';shutil.copytree(self.two,previous)
            manifest=json.loads((previous/'manifest.json').read_text());manifest['site_url']='https://example.invalid/test/'
            (previous/'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'outro site'):release.builder.build_rollback(Path(tmp)/'out',self.legacy,previous)


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class ReleaseVersionBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory=tempfile.TemporaryDirectory(prefix='iasdpi-lote6-versions-');cls.root=Path(cls.directory.name)
        cls.legacy,cls.one,cls.two,cls.rollback,cls.first,cls.second=versions(cls.root)
        cls.site=cls.root/'Avaliacoes_mentorama_SQL'
        cls.http=ThreadingHTTPServer(('127.0.0.1',0),partial(base.QuietHandler,directory=str(cls.root)))
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.http.server_port)+'/Avaliacoes_mentorama_SQL/'
        cls.pw=base.sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):operational.OperationalBrowserTests.tearDownClass.__func__(cls)

    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    enter=hours.HourFormatBrowserTests.enter
    supabase=operational.OperationalBrowserTests.supabase

    def setUp(self):
        if self.site.exists():shutil.rmtree(self.site)
        shutil.copytree(self.one,self.site)
        hours.HourFormatBrowserTests.setUp(self)
        self.before=copy.deepcopy(self.records);self.console=[]
        self.page.on('console',lambda m:self.console.append({'type':m.type,'text':m.text}) if m.type=='error' else None)
        self.page.on('dialog',lambda d:d.accept())

    def tearDown(self):
        self.assertEqual(self.records,self.before)
        operational.OperationalBrowserTests.tearDown(self)

    def assertPublic(self):
        self.page.wait_for_selector('.organization-elder');self.assertEqual(self.page.locator('.organization-elder').count(),9)
        self.page.locator('nav [data-page="agendas"]').click();self.page.wait_for_selector('.agenda-toolbar')

    def ready(self):self.page.wait_for_function('()=>window.IASDPIRelease?.status()==="ready"')

    def editDraft(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")')
        self.page.locator('.actual-row').first.locator('[name="activity-note"]').fill('RASCUNHO DURANTE ATUALIZAÇÃO')
        self.page.evaluate('async()=>await IASDPIDrafts.flush()')

    def recoverDraft(self):
        self.page.wait_for_selector('[data-draft-restore]');self.page.locator('[data-draft-restore]').click()
        self.page.wait_for_function('()=>!state.busy&&document.querySelector(".actual-row [name=activity-note]")?.value==="RASCUNHO DURANTE ATUALIZAÇÃO"')
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'RASCUNHO DURANTE ATUALIZAÇÃO')

    def test_old_published_html_with_new_package_runs_frozen_legacy_aliases(self):
        self.page.route(self.base,lambda r:r.fulfill(content_type='text/html',body=(self.legacy/'index.html').read_text()))
        self.open('#organization');self.assertPublic()
        self.assertEqual(self.page.evaluate('typeof IASDPINavigation'),'undefined')
        self.assertFalse(self.errors)

    def test_new_html_with_old_javascript_is_blocked_by_sri_and_retry_recovers(self):
        url=self.base+self.first['entry']['bundle']
        self.page.route(url,lambda r:r.fulfill(content_type='text/javascript',body=(self.legacy/'app.js').read_bytes()))
        self.page.goto(self.base+'#organization');self.page.wait_for_selector('[data-release-retry]:visible')
        self.assertEqual(self.page.evaluate('typeof IASDPIAuth'),'undefined')
        self.assertIn('não foram apagados',self.page.locator('#release-recovery').inner_text())
        self.page.unroute(url);self.page.locator('[data-release-retry]').click();self.ready();self.assertPublic()
        self.assertTrue(any('integrity' in e['text'].lower() for e in self.console))

    def test_old_bootstrap_bytes_cannot_execute_under_new_integrity(self):
        url=self.base+self.first['entry']['loader']
        self.page.route(url,lambda r:r.fulfill(content_type='text/javascript',body='throw Error("must not execute");'))
        self.page.goto(self.base+'#organization');self.page.wait_for_load_state('load')
        self.assertTrue(self.page.locator('#release-recovery').is_visible());self.assertEqual(self.page.evaluate('typeof IASDPIAuth'),'undefined')
        self.page.unroute(url);self.page.locator('[data-release-reload]').click();self.ready();self.assertPublic()

    def test_transient_bootstrap_network_failure_keeps_static_recovery_available(self):
        url=self.base+self.first['entry']['loader'];self.page.route(url,lambda r:r.abort('failed'))
        self.page.goto(self.base+'#organization');self.page.wait_for_load_state('load')
        self.assertTrue(self.page.locator('[data-release-reload]').is_visible())
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        self.page.unroute(url);self.page.locator('[data-release-reload]').click();self.ready();self.assertPublic()

    def test_transient_bundle_failure_explicit_retry_preserves_original_storage(self):
        url=self.base+self.first['entry']['bundle'];self.page.route(url,lambda r:r.abort('failed'))
        self.page.goto(self.base+'#organization');self.page.wait_for_selector('[data-release-retry]:visible')
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        self.page.unroute(url);self.page.locator('[data-release-retry]').click();self.ready();self.assertPublic()

    def test_stylesheet_failure_shows_safe_recovery(self):
        url=self.base+self.first['entry']['styles'];self.page.route(url,lambda r:r.abort('failed'))
        self.page.goto(self.base+'#organization');self.page.wait_for_selector('[data-release-retry]:visible')
        self.assertEqual(self.page.locator('[data-release-retry]').inner_text(),'Recarregar versão')
        self.page.unroute(url);self.page.locator('[data-release-retry]').click();self.ready();self.assertPublic()

    def test_partial_mutable_agenda_failure_is_reported_without_private_writes(self):
        self.page.route('**/agenda-data.js*',lambda r:r.abort('failed'))
        self.page.goto(self.base+'#organization');self.page.wait_for_selector('[data-release-retry]:visible')
        self.assertTrue(self.page.locator('#release-recovery').is_visible())

    def test_open_tab_survives_update_then_recovers_encrypted_draft_on_reload(self):
        self.editDraft();shutil.copytree(self.two,self.site,dirs_exist_ok=True)
        self.assertIsNone(self.page.evaluate('window.IASDPITestVersion'))
        self.assertEqual(self.page.locator('.actual-row').first.locator('[name="activity-note"]').input_value(),'RASCUNHO DURANTE ATUALIZAÇÃO')
        self.page.reload();self.page.wait_for_selector('#actuals-form');self.ready();self.recoverDraft()
        self.assertEqual(self.page.evaluate('window.IASDPITestVersion'),'two')

    def test_reload_during_partial_publication_missing_new_bundle_keeps_draft(self):
        self.editDraft();shutil.copytree(self.two,self.site,dirs_exist_ok=True)
        name=self.second['entry']['bundle'].split('?')[0];(self.site/name).unlink()
        self.page.reload();self.page.wait_for_selector('[data-release-retry]:visible')
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        shutil.copyfile(self.two/name,self.site/name);self.page.locator('[data-release-retry]').click()
        self.page.wait_for_selector('#actuals-form');self.recoverDraft()

    def test_cached_previous_html_runs_previous_complete_bundle_after_update(self):
        shutil.copytree(self.two,self.site,dirs_exist_ok=True)
        self.page.route(self.base,lambda r:r.fulfill(content_type='text/html',body=(self.one/'index.html').read_text()))
        self.open('#organization');self.ready();self.assertPublic()
        self.assertIsNone(self.page.evaluate('window.IASDPITestVersion'))

    def test_rollback_to_legacy_keeps_cached_new_html_operational(self):
        shutil.copytree(self.rollback,self.site,dirs_exist_ok=True)
        self.page.route(self.base,lambda r:r.fulfill(content_type='text/html',body=(self.two/'index.html').read_text()))
        self.open('#organization');self.ready();self.assertPublic()
        self.assertEqual(self.page.evaluate('window.IASDPITestVersion'),'two')

    def test_fresh_rollback_uses_original_public_html_and_agenda(self):
        shutil.copytree(self.rollback,self.site,dirs_exist_ok=True)
        self.open('#organization');self.assertPublic()
        self.assertEqual(self.page.evaluate('typeof IASDPINavigation'),'undefined')

    def test_rollback_does_not_clear_new_encrypted_draft_recovered_after_reupgrade(self):
        self.editDraft();shutil.copytree(self.rollback,self.site,dirs_exist_ok=True)
        self.page.reload();self.page.wait_for_selector('#actuals-form')
        self.assertEqual(self.page.evaluate('typeof IASDPIDrafts'),'undefined')
        shutil.copytree(self.one,self.site,dirs_exist_ok=True);self.page.reload()
        self.page.wait_for_selector('#actuals-form');self.recoverDraft()

    def test_partial_alias_update_does_not_affect_new_html_bundle(self):
        for name in ('auth.js','navigation.js','app.js'):(self.site/name).write_text('throw Error("alias must not execute");')
        self.open('#organization');self.ready();self.assertPublic()


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class NavigationStabilizationTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    setUp=navigation.NavigationConflictTests.setUp
    tearDown=operational.OperationalBrowserTests.tearDown
    supabase=navigation.NavigationConflictTests.supabase
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    enter=hours.HourFormatBrowserTests.enter

    def test_100_fast_forward_cancel_confirm_attempts_no_retries_or_delays(self):
        self.enter();results=[];out=ROOT/'dist/lote6';out.mkdir(parents=True,exist_ok=True)
        try:
            for index in range(100):
                start=time.perf_counter();self.page.evaluate('navigate("actuals","clock-fixture");navigate("history")')
                length=self.page.evaluate('history.length')
                self.page.go_back();self.page.wait_for_selector('#actuals-form')
                self.page.locator('[name="note"]').fill('PENDENTE AO AVANÇAR '+str(index))
                self.page.once('dialog',lambda d:d.dismiss());self.page.go_forward()
                self.page.wait_for_function('()=>location.hash==="#actuals/clock-fixture"')
                self.assertEqual(self.page.locator('[name="note"]').input_value(),'PENDENTE AO AVANÇAR '+str(index))
                self.page.once('dialog',lambda d:d.accept());self.page.go_forward()
                self.page.wait_for_function('()=>state.page==="history"&&!IASDPINavigation.pending()')
                self.assertEqual(self.page.evaluate('history.length'),length)
                self.assertEqual(self.records['clock-fixture'],self.original)
                results.append({'attempt':index+1,'status':'passed','seconds':time.perf_counter()-start})
        except Exception as error:
            results.append({'attempt':len(results)+1,'status':'failed','error':str(error)});raise
        finally:
            (out/'navigation-100.json').write_text(json.dumps({'automatic_retries':0,'artificial_delays':False,'results':results},indent=2))

    def test_restoration_issues_only_one_go_for_popstate_and_hashchange(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture");navigate("history")')
        self.page.go_back();self.page.wait_for_selector('#actuals-form');self.page.locator('[name="note"]').fill('preservar')
        self.page.evaluate('()=>{window.auditGo=[];window.originalGo=history.go.bind(history);history.go=n=>{auditGo.push(n);return originalGo(n)};}')
        self.page.once('dialog',lambda d:d.dismiss());self.page.go_forward()
        self.page.wait_for_function('()=>location.hash==="#actuals/clock-fixture"&&!IASDPINavigation.pending()')
        self.assertEqual(self.page.evaluate('auditGo'),[-1]);self.assertEqual(self.page.locator('[name="note"]').input_value(),'preservar')

    def test_repeated_hash_cancel_has_one_confirmation_and_no_duplicate_entry(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")');self.page.locator('[name="note"]').fill('Preservar no hash')
        dialogs=[];self.page.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
        for _ in range(10):
            self.page.evaluate('location.hash="history"');self.page.wait_for_function('()=>location.hash==="#actuals/clock-fixture"&&!IASDPINavigation.pending()')
        self.assertEqual(len(dialogs),10);self.assertEqual(self.page.locator('[name="note"]').input_value(),'Preservar no hash')


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class LoginNavigationStabilizationTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    setUp=reliable.DataReliabilityTests.setUp
    tearDown=operational.OperationalBrowserTests.tearDown
    supabase=reliable.DataReliabilityTests.supabase
    open=operational.OperationalBrowserTests.open
    login=operational.OperationalBrowserTests.login
    enter=hours.HourFormatBrowserTests.enter

    def release(self):
        self.hold_list=False
        for route in self.held:route.fulfill(json=[{'document':p} for p in self.records.values()])
        self.held.clear()

    def test_click_immediately_after_auth_while_list_is_loading_is_not_lost(self):
        self.hold_list=True;self.open();self.login();self.page.wait_for_selector('[data-load-state="loading"]')
        self.page.wait_for_function('()=>IASDPIAuth.allowed()&&state.busy')
        self.page.locator('nav [data-page="actuals"]').click()
        self.assertEqual(self.page.evaluate('pendingNavigation'),'actuals')
        self.release();self.page.wait_for_selector('#new-record-form')
        self.assertFalse(self.page.evaluate('state.busy||bootInProgress'));self.assertEqual(len(self.records),1)

    def test_last_navigation_intent_during_boot_wins_without_duplicate_history(self):
        self.hold_list=True;self.open();self.login();self.page.wait_for_selector('[data-load-state="loading"]')
        self.page.locator('nav [data-page="actuals"]').click();self.page.locator('nav [data-page="history"]').click()
        self.assertEqual(self.page.evaluate('pendingNavigation'),'history')
        self.release();self.page.wait_for_function('()=>state.page==="history"&&!state.busy&&!bootInProgress')
        self.assertEqual(self.page.locator('#new-record-form').count(),0)

    def test_boot_callers_share_completion_instead_of_early_return(self):
        self.enter();self.hold_list=True;self.page.evaluate('()=>{window.bootFinished=0;boot().then(()=>bootFinished++);boot().then(()=>bootFinished++);}')
        self.page.wait_for_function('()=>bootInProgress')
        self.assertEqual(self.page.evaluate('bootFinished'),0)
        self.release();self.page.wait_for_function('()=>bootFinished===2&&!bootInProgress')

    def test_revocation_clears_queued_private_navigation(self):
        self.enter();self.page.evaluate('state.busy=true');self.page.locator('nav [data-page="actuals"]').click()
        self.assertEqual(self.page.evaluate('pendingNavigation'),'actuals')
        self.role='';self.page.evaluate('async()=>{try{await IASDPIAuth.requireAccess()}catch(_){}}')
        self.assertIsNone(self.page.evaluate('pendingNavigation'))
        self.page.evaluate('state.busy=false;drainNavigation()');self.assertEqual(self.page.locator('#new-record-form').count(),0)
