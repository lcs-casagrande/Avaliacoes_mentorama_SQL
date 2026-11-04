"""Nomes informados e restrições visíveis por pessoa; somente a prévia em memória."""
import shutil
import unittest
import test_frontend_access as base
import test_schedule_known_people as known


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'), 'Requer Chromium')
class PersonDaysTests(unittest.TestCase):
    setUpClass=classmethod(known.KnownPeoplePreviewTests.setUpClass.__func__)
    tearDownClass=classmethod(known.KnownPeoplePreviewTests.tearDownClass.__func__)
    setUp=known.KnownPeoplePreviewTests.setUp
    tearDown=known.KnownPeoplePreviewTests.tearDown
    catalog=known.KnownPeoplePreviewTests.catalog

    def open_person(self,name='Luan'):
        person=next(p for p in self.catalog()['people'] if p['name']==name)
        self.page.get_by_role('link',name='Dias e restrições por voluntário',exact=True).click()
        self.page.wait_for_selector('#daily-person')
        self.page.locator('#daily-person').select_option(person['id'])
        return person,self.page.locator('.daily-person-days')

    def test_exact_department_rosters_no_invented_eleventh_elder_or_leader(self):
        c=self.catalog()
        expected={
            'Sonoplastia': ['Mini Lucas','Rafa','Samuel','Luan','Macedo','Paulitos','Raphael'],
            'Comunicação': ['Henrique','Izabelle PI Souza','Simone/Profª de Pilates','macedo Logos','Letícia PI'],
            'Ancionato': ['Adriano Borrego','David Cavalcanti','Elmo Carneiro','Lucas Casagrande','Marcia Isabel','Marcio Mendes','Raphael Moreira','Rosana Bianchini','Samuel Ferreira','Victória Scarpelini'],
        }
        for name,names in expected.items():
            dept=next(d for d in c['departments'] if d['name']==name)
            members=[m for m in c['memberships'] if m['department_id']==dept['id']]
            self.assertCountEqual([p['name'] for p in c['people'] if any(m['person_id']==p['id'] for m in members)],names)
            heads=[p['name'] for p in c['people'] if any(m['person_id']==p['id'] and m['is_ministry_head'] for m in members)]
            self.assertEqual(heads,{'Sonoplastia':['Luan'],'Comunicação':['Henrique'],'Ancionato':[]}[name])
        people={p['name']:p['id'] for p in c['people']}
        self.assertNotEqual(people['Samuel'],people['Samuel Ferreira'])
        self.assertNotEqual(people['Raphael'],people['Raphael Moreira'])
        self.assertEqual(c['availability'],[])
        self.assertEqual(c['qualifications'],[])

    def test_compact_restrictions_save_reopen_and_feed_rotation_context(self):
        before=self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)')
        person,panel=self.open_person()
        self.assertEqual(panel.locator('[name^=available_]:checked,[name^=unavailable_]:checked').count(),0)
        panel.locator('[name=available_0]').check()
        panel.locator('[name=unavailable_6]').check()
        panel.locator('[name=dates]').fill('01/11/2026')
        panel.locator('button[type=submit]').click()
        self.page.wait_for_function("document.querySelector('main [role=status]').textContent.includes('simulada')")
        self.page.locator('#daily-person').select_option('')
        row=self.page.locator('[data-member="'+person['id']+'"]')
        self.assertTrue(row.locator('[name=available_0]').is_checked())
        self.assertTrue(row.locator('[name=unavailable_6]').is_checked())
        self.assertEqual(row.locator('[name=dates]').input_value(),'01/11/2026')
        self.page.get_by_role('link',name='Montar escala',exact=True).click()
        self.page.wait_for_selector('.monthly-calendar')
        result=self.page.evaluate("""async id=>{const c=await IASDPISchedulePreview.request('iasdpi_schedule_catalog'),d=c.departments.find(d=>d.code==='sonoplastia'),context=await IASDPISchedulePreview.request('iasdpi_schedule_rotation_context',{p_department:d.id,p_month:'2026-11-01'});return context.people.find(p=>p.person_id===id).days;}""",person['id'])
        states={d['date']:d['state'] for d in result}
        self.assertEqual(states['2026-11-01'],'unavailable')
        self.assertEqual(states['2026-11-08'],'available')
        self.assertEqual(states['2026-11-07'],'unavailable')
        self.assertEqual(states['2026-11-04'],'unknown')
        self.assertEqual(before,self.page.evaluate('JSON.stringify(IASDPIKnownPreview.legacy)'))
        self.assertEqual(self.catalog()['qualifications'],[])

    def test_switch_person_preserves_unsaved_and_mutually_exclusive_flags(self):
        person,panel=self.open_person()
        panel.locator('[name=available_3]').check()
        panel.locator('[name=unavailable_3]').check()
        self.assertFalse(panel.locator('[name=available_3]').is_checked())
        other=next(p for p in self.catalog()['people'] if p['name']=='Rafa')
        self.page.locator('#daily-person').select_option(other['id'])
        self.assertEqual(panel.locator('[name^=unavailable_]:checked').count(),0)
        self.page.locator('#daily-person').select_option(person['id'])
        self.assertTrue(panel.locator('[name=unavailable_3]').is_checked())
        self.assertIn('Alterações pendentes',panel.locator('[role=status]').inner_text())
        self.page.once('dialog',lambda d:d.dismiss())
        self.page.get_by_role('link',name='Montar escala',exact=True).click()
        self.assertTrue(panel.is_visible())

    def test_invalid_dates_retained_and_mobile_controls_accessible(self):
        person,panel=self.open_person()
        panel.locator('[name=dates]').fill('31/02/2026')
        panel.locator('button[type=submit]').click()
        self.page.wait_for_function("document.querySelector('.daily-person-days [role=status]').textContent.includes('Revise')")
        self.assertEqual(self.catalog()['availability'],[])
        self.assertEqual(panel.locator('[name=dates]').input_value(),'31/02/2026')
        labels=[node.get_attribute('aria-label') for node in panel.locator('[type=checkbox][aria-label]').all()]
        self.assertEqual(len(labels),14)
        self.assertEqual(len(set(labels)),14)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        panel.locator('[name=dates]').fill('')
        panel.locator('button[type=submit]').click()
        self.page.wait_for_function("document.querySelector('main [role=status]').textContent.includes('simulada')")
        self.page.set_viewport_size({'width':390,'height':1000})
        panel.scroll_into_view_if_needed()
        self.page.screenshot(path=str(base.ROOT/'dist/schedule-person-days/restricoes-mobile.png'),full_page=True)
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.page.screenshot(path=str(base.ROOT/'dist/schedule-person-days/restricoes-desktop.png'),full_page=True)
