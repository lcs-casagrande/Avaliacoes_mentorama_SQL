"""Dados públicos fornecidos pela liderança; navegador e Auth/REST fictícios."""
from datetime import date
import shutil
import unittest

import test_frontend_access as base

MINISTRIES = {
    'Diaconato — Diaconisas':['Rose'], 'Diaconato — Diáconos':['Marciano'],
    'Ancionato':[], 'Ministério da Criança':['Luciana Abdias'],
    'Ministério dos Adolescentes':['Taislane'], 'Comunicação':['Henrique'],
    'Ministério da Família':['Luana','Raphael'], 'Ministério da Saúde':['Simone Cristina'],
    'Ministério de Publicações':['Glaucia'], 'Ministério da Música':['Alexandre'],
    'Escola Sabatina':['Renato'], 'Mordomia Cristã':['Samuel'], 'Ministério Pessoal':['Rosana'],
    'Ação Solidária Adventista (ASA)':['João Pedro'],
    'Ministério Adventista das Possibilidades':['João Pedro'],
    'Liberdade Religiosa':['João Pedro'], 'Ministério da Mulher':['Gislaine'],
    'Recepção':['Nilce'], 'Ministério Jovem':['Cauê'], 'Clube de Desbravadores':['Victoria'],
    'Clube de Aventureiros':['Valeska'], 'Terceira Idade':['Sandra'], 'Sonoplastia':['Luan'],
    'Patrimônio':['Sérgio'], 'Ministério dos Homens':['Paulo Scarpelini'], 'Gol da Esperança':['Nelson']
}
SOUND = [
    ('2026-10-03','Mini Lucas'),('2026-10-04','Rafa'),('2026-10-07','Samuel'),
    ('2026-10-10','Luan'),('2026-10-11','Macedo'),('2026-10-14','Paulitos'),
    ('2026-10-17','Mini Lucas'),('2026-10-18','Raphael'),('2026-10-21','Luan'),
    ('2026-10-24','Mini Lucas'),('2026-10-25','Rafa'),('2026-10-28','Luan'),
    ('2026-10-31','Raphael'),('2026-11-01','Raphael'),('2026-11-04','Paulitos')
]


@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium/Playwright')
class MinistryScheduleTests(unittest.TestCase):
    setUpClass=classmethod(base.FrontendAccessTests.setUpClass.__func__)
    tearDownClass=classmethod(base.FrontendAccessTests.tearDownClass.__func__)
    setUp=base.FrontendAccessTests.setUp
    tearDown=base.FrontendAccessTests.tearDown
    open=base.FrontendAccessTests.open
    login=base.FrontendAccessTests.login
    supabase=base.FrontendAccessTests.supabase

    def ministry(self,name):
        return self.page.locator('[data-ministry="'+name+'"]')

    def sound(self,month='2026-10',view='list'):
        self.open('#agendas')
        self.page.select_option('#agenda-area','sound')
        self.page.locator('#agenda-month-picker').fill(month)
        self.page.locator('#agenda-month-picker').dispatch_event('change')
        self.page.locator('[data-action="agenda-'+view+'"]').click()

    def test_twenty_six_ministries_and_exact_responsibles(self):
        self.open('#organization')
        actual=self.page.evaluate('churchMinistries')
        self.assertEqual(len(actual),26)
        self.assertEqual(len({m['name'] for m in actual}),26)
        self.assertEqual({m['name']:m['responsibles'] for m in actual},MINISTRIES)

    def test_each_updated_ministry_appears_exactly_once(self):
        self.open('#organization')
        for name in MINISTRIES:
            with self.subTest(ministry=name):
                self.assertEqual(self.ministry(name).count(),1)

    def test_deacons_and_deaconesses_have_separate_responsibles(self):
        self.open('#organization')
        self.assertEqual(self.ministry('Diaconato — Diaconisas').locator('strong').inner_text(),'Rose')
        self.assertEqual(self.ministry('Diaconato — Diáconos').locator('strong').inner_text(),'Marciano')
        self.assertEqual(self.ministry('Diaconato').count(),0)
        for name in ('Diaconato — Diaconisas','Diaconato — Diáconos'):
            self.assertEqual(self.ministry(name).evaluate('(e)=>e.closest(".organization-elder").querySelector("h2").textContent'),'Márcio')

    def test_family_supports_two_names_separate_from_elder(self):
        self.open('#organization')
        family=self.ministry('Ministério da Família')
        self.assertIn('Responsáveis:',family.inner_text())
        self.assertEqual(family.locator('strong').inner_text(),'Luana e Raphael')
        self.assertEqual(family.evaluate('(e)=>e.closest(".organization-elder").querySelector("h2").textContent'),'Márcia')

    def test_ancionato_unassigned_and_original_elders_and_pastor_preserved(self):
        self.open('#organization')
        self.assertEqual(self.ministry('Ancionato').locator('strong').inner_text(),'Não informado')
        self.assertEqual(self.page.locator('.organization-pastor h2').inner_text(),'Luciano')
        self.assertEqual(self.page.locator('.organization-elder h2').all_text_contents(),
                         ['Adriano','Lucas','Elmo','Márcia','Márcio','Raphael','Samuel','Victoria','Rosana'])
        self.assertEqual(self.page.evaluate('churchMinistries.find(m=>m.name==="Ancionato").responsibles'),[])

    def test_unmentioned_departments_preserved_without_invented_responsibles(self):
        self.open('#organization')
        for name in ('Tesouraria','Secretaria','Ministério Recuperação'):
            self.assertEqual(self.ministry(name).locator('strong').inner_text(),'Não informado')
        self.assertEqual(self.page.locator('[data-ministry]').count(),29)

    def test_ministry_head_not_replaced_by_roster_participants(self):
        self.open('#organization')
        self.assertEqual(self.ministry('Sonoplastia').locator('strong').inner_text(),'Luan')
        self.sound(view='calendar')
        self.assertEqual(self.page.locator('.calendar-day[data-id="2026-10-03"] .calendar-person').inner_text(),'Mini Lucas')

    def test_search_responsible_keeps_focus_and_filters_only_matching_ministry(self):
        self.open('#organization')
        self.page.locator('#organization-query').fill('Alexandre')
        self.assertEqual(self.page.locator('[data-ministry]').count(),1)
        self.assertTrue(self.ministry('Ministério da Música').is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'organization-query')
        self.assertIn('1 resultado',self.page.locator('#organization-count').inner_text())

    def test_search_is_case_accent_insensitive_and_recognizes_old_name(self):
        self.open('#organization')
        self.page.locator('#organization-query').fill('PUBLICACOES')
        self.assertTrue(self.ministry('Ministério de Publicações').is_visible())
        self.page.locator('#organization-query').fill('ministerio infantil')
        self.assertEqual(self.page.locator('[data-ministry]').count(),1)
        self.assertTrue(self.ministry('Ministério da Criança').is_visible())

    def test_search_empty_result_and_untrusted_text_are_safe(self):
        self.open('#organization')
        query='\"><img src=x onerror=alert(1)>'
        self.page.locator('#organization-query').fill(query)
        self.assertIn('Nenhum ministério encontrado',self.page.locator('#organization-results').inner_text())
        self.assertEqual(self.page.locator('#organization-results img').count(),0)
        self.assertEqual(self.page.locator('#organization-query').input_value(),query)

    def test_clear_search_by_keyboard_restores_hierarchy_and_focus(self):
        self.open('#organization')
        self.page.locator('#organization-query').fill('Alexandre')
        self.page.locator('#organization-clear').focus();self.page.keyboard.press('Enter')
        self.assertEqual(self.page.locator('#organization-query').input_value(),'')
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'organization-query')
        self.assertEqual(self.page.locator('.organization-elder').count(),9)
        self.assertEqual(self.page.locator('[data-ministry]').count(),29)

    def test_search_survives_page_navigation_without_affecting_other_pages(self):
        self.open('#organization')
        self.page.locator('#organization-query').fill('Alexandre')
        self.page.locator('nav [data-page="agendas"]').click()
        self.assertEqual(self.page.locator('#organization-results').count(),0)
        self.page.locator('nav [data-page="organization"]').click()
        self.assertEqual(self.page.locator('#organization-query').input_value(),'Alexandre')
        self.assertEqual(self.page.locator('[data-ministry]').count(),1)

    def test_sound_has_exact_fifteen_records_without_duplicates(self):
        self.open('#agendas')
        actual=self.page.evaluate('ministrySchedules.Sonoplastia')
        self.assertEqual([(e['date'],e['person']) for e in actual],SOUND)
        self.assertEqual(len({e['date'] for e in actual}),15)
        self.assertTrue(all(set(e)=={'date','person'} for e in actual))

    def test_dates_and_weekdays_match_independent_calendar(self):
        self.open('#agendas')
        labels={5:'Sábado',6:'Domingo',2:'Quarta-feira'}
        for day,_ in SOUND:
            with self.subTest(date=day):
                self.assertEqual(self.page.evaluate('d=>agendaWeekday(d)',day),labels[date.fromisoformat(day).weekday()])

    def test_month_and_department_filters_include_november_continuation(self):
        self.sound()
        self.assertEqual(self.page.locator('[data-schedule-date]').count(),13)
        self.assertEqual(self.page.locator('[data-schedule-date]').evaluate_all('(rows)=>rows.map(e=>e.dataset.scheduleDate)'),[d for d,_ in SOUND if d.startswith('2026-10')])
        self.assertIn('Escala de Sonoplastia — Outubro de 2026',self.page.locator('#app').inner_text())
        self.page.locator('#agenda-month-picker').fill('2026-11');self.page.locator('#agenda-month-picker').dispatch_event('change')
        self.assertEqual(self.page.locator('[data-schedule-date]').evaluate_all('(rows)=>rows.map(e=>e.dataset.scheduleDate)'),['2026-11-01','2026-11-04'])
        self.assertEqual(self.page.locator('.agenda-list strong').all_text_contents(),['Raphael','Paulitos'])
        self.page.select_option('#agenda-area','communication')
        self.assertEqual(self.page.locator('[data-schedule-date]').count(),0)

    def test_manual_list_prioritizes_date_weekday_ministry_and_person(self):
        self.sound()
        row=self.page.locator('[data-schedule-date="2026-10-04"]')
        self.assertEqual(row.locator('time').inner_text(),'04/10/2026')
        self.assertEqual(row.locator('small').inner_text(),'Domingo')
        self.assertEqual(row.locator('.ministry-shift-department').inner_text(),'Sonoplastia')
        self.assertEqual(row.locator('strong').inner_text(),'Rafa')

    def test_manual_origin_validity_guidance_and_no_phone(self):
        self.sound()
        source=self.page.locator('[data-source="manual"]').inner_text()
        for text in ('fornecida pela liderança','Não é sincronizada automaticamente','03/10/2026 a 04/11/2026','15 datas','01/11/2026','04/11/2026',
                     'Em caso de impedimento, avisar antecipadamente no grupo responsável.'):
            self.assertIn(text,source)
        self.assertNotIn('Fonte oficial consultada',source)
        self.assertEqual(self.page.locator('#app a[href^="tel:"]').count(),0)

    def test_hide_people_preserved_in_list_and_calendar(self):
        self.sound()
        self.page.locator('#agenda-show-people').uncheck()
        self.assertTrue(all(name=='Escala definida' for name in self.page.locator('.agenda-list strong').all_text_contents()))
        self.page.locator('[data-action="agenda-calendar"]').click()
        self.assertEqual(self.page.locator('.calendar-day[data-id="2026-10-04"] .calendar-person').inner_text(),'Escala definida')

    def test_official_agenda_and_communication_unchanged(self):
        self.open('#agendas')
        official=self.page.evaluate('JSON.stringify(agendaSource())')
        communication=self.page.evaluate('JSON.stringify(ministrySchedules.Comunicação)')
        self.page.select_option('#agenda-area','sound')
        self.page.locator('#agenda-month-picker').fill('2026-10');self.page.locator('#agenda-month-picker').dispatch_event('change')
        self.page.locator('[data-action="agenda-list"]').click()
        self.page.select_option('#agenda-area','church')
        self.assertEqual(self.page.evaluate('JSON.stringify(agendaSource())'),official)
        self.assertEqual(self.page.evaluate('JSON.stringify(ministrySchedules.Comunicação)'),communication)
        self.assertEqual(self.page.locator('[data-source="official"]').count(),1)
        self.assertEqual(self.page.locator('[data-source="manual"]').count(),0)

    def test_repeated_navigation_and_month_changes_do_not_duplicate_records(self):
        self.sound()
        for month in ('2026-11','2026-10','2026-11','2026-10'):
            self.page.locator('#agenda-month-picker').fill(month);self.page.locator('#agenda-month-picker').dispatch_event('change')
        self.assertEqual(self.page.locator('[data-schedule-date]').count(),13)
        self.assertEqual(self.page.evaluate('ministrySchedules.Sonoplastia.length'),15)
        self.page.reload();self.page.select_option('#agenda-area','sound')
        self.assertEqual(self.page.evaluate('ministrySchedules.Sonoplastia.length'),15)

    def test_public_updates_preserve_local_records_and_private_permissions(self):
        requests=[];self.page.on('request',lambda req:requests.append(req.url) if req.method!='GET' else None)
        self.open('#organization');self.page.locator('#organization-query').fill('Alexandre')
        self.sound()
        self.assertEqual(self.page.evaluate("localStorage.getItem('iasdpi-demo-v1')"),self.raw)
        self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.assertEqual(requests,[])
        self.open('#users');self.page.wait_for_selector('#auth-login-form')
        self.assertEqual(self.page.locator('.user-access-form').count(),0)

    def test_mobile_layout_and_touch_targets_for_public_views(self):
        self.open('#organization')
        for width in (360,390,768,1024,1440):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width,'height':900})
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                self.assertGreaterEqual(self.page.locator('#organization-query').bounding_box()['height'],44)
                self.assertGreaterEqual(self.page.locator('#organization-clear').bounding_box()['height'],44)
                self.assertTrue(self.ministry('Ministério Adventista das Possibilidades').is_visible())
        self.sound()
        for width in (360,390,768,1024,1440):
            with self.subTest(scale_width=width):
                self.page.set_viewport_size({'width':width,'height':900})
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                self.assertGreaterEqual(self.page.locator('[data-schedule-date]').first.bounding_box()['height'],44)
        self.page.locator('[data-action="agenda-calendar"]').click()
        self.page.set_viewport_size({'width':360,'height':900})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),360)
