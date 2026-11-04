"""G6: fluxos no portal real com backend demonstrativo sem chamadas externas."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest
import test_portal_integration_browser as g4
import test_frontend_access as base

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium')
class GovernanceIntegrationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        g4.PortalIntegrationBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--governance-audit-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(g4.PortalIntegrationBrowserTests.tearDownClass.__func__)
    setUp=g4.PortalIntegrationBrowserTests.setUp
    tearDown=g4.PortalIntegrationBrowserTests.tearDown
    go=g4.PortalIntegrationBrowserTests.go
    choose=g4.PortalIntegrationBrowserTests.choose
    login=g4.PortalIntegrationBrowserTests.login
    prefill=g4.PortalIntegrationBrowserTests.prefill
    save=g4.PortalIntegrationBrowserTests.save
    def admin(self):
        self.login('admin.pi.teste');self.page.locator('[data-portal-department="00000000-0000-4000-8000-000000000001"]').click();self.page.wait_for_selector('.simple-daily-calendar')
    def tab(self,tab):self.page.locator('[data-gov-tab='+tab+']').click()
    def test_profile_matrix_and_public_compatibility(self):
        # Um navegador isolado por perfil evita herdar sessões ou direitos.
        for alias,expected in [('admin.geral.teste',7),('admin.pi.teste',7),('som.teste',1),('musica.teste',1),('anciao.teste',1),('multi.teste',2)]:
            with self.subTest(alias=alias):
                self.context.close();g4.PortalIntegrationBrowserTests.setUp(self)
                if alias=='anciao.teste':
                    self.choose();self.page.fill('#portal-login-form [name=email]',alias);self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.elder-week-calendar')
                else:self.login(alias)
                self.assertEqual(self.page.evaluate('IASDPIPortalAccess.departments().length'),expected)
                if alias in ['som.teste','musica.teste','anciao.teste']:self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.go('agendas');self.page.wait_for_selector('.agenda-calendar');self.go('organization');self.page.wait_for_selector('#organization-results')
    def test_shared_central_people_known_names_no_name_merging(self):
        self.admin();c=self.page.evaluate("IASDPISchedules.request('iasdpi_schedule_catalog')");names=[p['name'] for p in c['people']]
        self.assertIn('Rafa',names);self.assertIn('Raphael',names);self.assertIn('Raphael Moreira',names);self.assertEqual(len(c['people']),len({p['id'] for p in c['people']}));self.assertEqual(self.page.evaluate('IASDPIScheduleCalendar.legacy().length'),20)
        self.go('schedule-members');self.page.wait_for_selector('#daily-person');options=self.page.locator('#daily-person option').all_text_contents();self.assertIn('Mini Lucas',options);self.assertIn('Luan',options)
    def test_weekday_preferences_visible_saved_and_rotation_respects_them(self):
        self.admin();self.go('schedule-members');self.page.wait_for_selector('#daily-person');c=self.page.evaluate("IASDPISchedules.request('iasdpi_schedule_catalog')");p=next(p for p in c['people'] if p['name']=='Mini Lucas');self.page.select_option('#daily-person',p['id']);self.page.wait_for_selector('[data-member]')
        self.page.locator('[data-member] [name=unavailable_0]').check();self.page.locator('[data-member] button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('main [role=status]')?.textContent.includes('salvas nesta aba')")
        self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.prefill();self.assertFalse(self.page.evaluate("id=>[...document.querySelectorAll('[data-calendar-volunteer]')].some(s=>s.value===id&&new Date(s.closest('.monthly-cell').querySelector('[data-day]').dataset.day+'T12:00:00Z').getUTCDay()===0)",p['id']))
    def test_music_team_full_flow_and_draft_never_public(self):
        self.login('musica.teste');team=self.page.locator('.music-team').first;self.assertEqual(team.locator('[data-music-volunteer]').count(),1);team.locator('[data-music-volunteer]').check();self.prefill();month=self.page.locator('#schedule-month').input_value();self.save()
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate('(month)=>{IASDPIScheduleCalendar.show({month,department:"Música"});render();}',month);self.page.wait_for_function("()=>!document.querySelector('.portal-feed-state')?.textContent.includes('Carregando')");self.assertEqual(self.page.evaluate('(m)=>IASDPIPortalAccess.feedRows(m).length',month),0)
        self.go('schedule-build');self.page.wait_for_selector('.music-team');self.save(True);self.go('schedule-calendar');self.page.wait_for_function("()=>document.querySelector('.portal-feed-state')?.textContent.includes('atribuições publicadas')");self.assertGreater(self.page.evaluate('(m)=>IASDPIPortalAccess.feedRows(m).filter(r=>r.department==="Música").length',month),0)
    def test_two_person_music_team_and_cross_department_conflict(self):
        self.admin();self.page.evaluate("async()=>{const rpc=IASDPISchedules.request,c=await rpc('iasdpi_schedule_catalog'),p=c.people.find(p=>p.name==='Luan'),d=c.departments.find(d=>d.code==='musica');await rpc('iasdpi_schedule_save',{p_entity:'membership',p_id:crypto.randomUUID(),p_expected_version:0,p_data:{person_id:p.id,department_id:d.id,active:true,role_ids:[]},p_request_id:crypto.randomUUID()});}")
        self.page.locator('[data-b1-action=department]').filter(has_text='Música').click();self.page.wait_for_selector('.music-team');team=self.page.locator('.music-team').first;self.assertEqual(team.locator('[data-music-volunteer]').count(),2)
        for field in team.locator('[data-music-volunteer]').all():field.check()
        self.save();self.assertEqual(self.page.locator('.music-team').first.locator('[data-music-volunteer]:checked').count(),2)
        self.prefill();self.save(True);self.page.locator('[data-portal-department="00000000-0000-4000-8000-000000000001"]').click();self.page.wait_for_selector('[data-calendar-volunteer]');luan=self.page.evaluate("async()=> (await IASDPISchedules.request('iasdpi_schedule_catalog')).people.find(p=>p.name==='Luan').id");option=self.page.locator('[data-calendar-volunteer]').first.locator('option[value="'+luan+'"]');self.page.wait_for_function("id=>document.querySelector('[data-calendar-volunteer] option[value=\"'+id+'\"]')?.disabled",arg=luan);self.assertTrue(option.evaluate('e=>e.disabled'));self.assertIn('Conflito',option.inner_text())
    def test_alias_link_keeps_identity_permissions(self):
        self.admin();self.go('access-admin');self.page.wait_for_selector('.governance-tabs');self.tab('aliases');self.page.get_by_text('Novo identificador',exact=True).click();form=self.page.locator('[data-gov-form=alias]').last
        form.locator('[name=identifier]').fill('g6.som');target=self.page.evaluate("IASDPIG6Preview.accounts.find(a=>a.alias==='som.teste').id");form.locator('[name=user]').select_option(target);form.locator('[name=enabled]').check();form.locator('[name=reason]').fill('Vínculo de homologação fictício');form.locator('button').click();self.page.wait_for_function("()=>IASDPIG6Demo.aliases().some(a=>a.identifier==='g6.som')")
        self.page.locator('#auth-logout').click();self.page.wait_for_function('()=>!IASDPIAuth.session()');self.go('schedule-build');self.page.wait_for_selector('#portal-login-form');self.page.fill('#portal-login-form [name=email]','g6.som');self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.locator('[data-b1-action=department]').count(),1)
    def test_administrative_recovery_request_review_and_reset(self):
        self.admin();self.go('access-request');self.page.wait_for_selector('[data-gov-form=request]');form=self.page.locator('[data-gov-form=request]');form.locator('[name=name]').fill('Líder fictício de Sonoplastia');form.locator('[name=identifier]').fill('som.teste');form.locator('[name=kind]').select_option('password');form.locator('button').click();self.page.wait_for_function("()=>document.querySelector('[data-form-feedback]')?.textContent.includes('recebida')")
        self.go('access-admin');self.page.wait_for_selector('.governance-tabs');self.tab('requests');f=self.page.locator('[data-gov-form=review]').first;f.locator('[name=verification]').fill('Identidade fictícia verificada presencialmente para demonstração');f.locator('input[type=checkbox]').check();f.locator('button').click();self.page.wait_for_selector('[data-gov-action=issue]');self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-gov-action=issue]').click();self.page.wait_for_selector('input[readonly]');link=self.page.locator('input[readonly]').input_value();self.page.goto(link);self.page.wait_for_selector('[data-gov-form=reset]');f=self.page.locator('[data-gov-form=reset]');f.locator('[name=password]').fill('NovaDemonstracao#2026');f.locator('[name=repeat]').fill('NovaDemonstracao#2026');f.locator('button').click();self.page.wait_for_function("()=>document.querySelector('[data-form-feedback]')?.textContent.includes('Senha redefinida')");self.assertEqual(self.page.evaluate('IASDPIG6Demo.queue()[0].status'),'resolved');self.assertFalse(self.page.url.endswith(link.split('#')[-1]))
    def test_publication_calendar_mobile_and_chrono_original_gate(self):
        self.login('som.teste');self.prefill();self.save(True);self.go('home');self.page.wait_for_selector('#auth-login-form');self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar')
        out=base.ROOT/'dist/governance-g6';out.mkdir(parents=True,exist_ok=True)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            if width in [390,1440]:self.page.screenshot(path=str(out/('mobile.png' if width==390 else 'desktop.png')),full_page=True)

    def test_elders_week_and_month_independent_and_public(self):
        self.choose();self.page.fill('#portal-login-form [name=email]','anciao.teste');self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.elder-week-calendar');self.page.locator('[data-elder-action=prefill]').click();self.page.locator('[data-elder-action=save]').click();self.page.wait_for_function("()=>document.querySelector('#elder-feedback')?.textContent.includes('Rascunho salvo')");self.page.locator('[data-kind=monthly]').click();self.page.locator('[data-elder-action=prefill]').click();self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-elder-action=publish]').click();self.page.wait_for_function("()=>document.querySelector('#elder-feedback')?.textContent.includes('Escala publicada')")
        self.assertTrue(self.page.evaluate("[...IASDPIB1Preview.elderPeriods.values()].filter(r=>r.kind==='weekly').every(r=>r.status==='draft')"));self.go('schedule-calendar');self.page.wait_for_selector('.scale-month-responsibles');self.assertIn('Ancião do Mês',self.page.locator('.scale-month-responsibles').inner_text())
