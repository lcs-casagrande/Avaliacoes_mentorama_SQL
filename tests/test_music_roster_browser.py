"""Equipe informada: catálogo único, seleção e conflitos em memória, sem Supabase."""
import json
import unittest
import test_calendar_privacy_browser as privacy
import test_frontend_access as base


class MusicRosterBrowserTests(unittest.TestCase):
    setUpClass = classmethod(privacy.CalendarPrivacyBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(privacy.CalendarPrivacyBrowserTests.tearDownClass.__func__)
    setUp = privacy.CalendarPrivacyBrowserTests.setUp
    tearDown = privacy.CalendarPrivacyBrowserTests.tearDown
    go = privacy.CalendarPrivacyBrowserTests.go
    choose = privacy.CalendarPrivacyBrowserTests.choose
    login = privacy.CalendarPrivacyBrowserTests.login

    def catalog(self):
        return self.page.evaluate("IASDPISchedules.request('iasdpi_registry_catalog')")

    def department(self, code):
        self.go('schedule-build')
        self.page.wait_for_selector('.monthly-departments')
        self.page.locator('.monthly-departments button').filter(has_text={
            'musica': 'Música', 'comunicacao': 'Comunicação', 'sonoplastia': 'Sonoplastia'
        }[code]).click()
        self.page.wait_for_selector('.monthly-calendar')

    def test_thirteen_members_share_existing_identities_without_invented_details(self):
        self.login()
        c = self.catalog()
        department = next(d['id'] for d in c['departments'] if d['code'] == 'musica')
        links = [m for m in c['memberships'] if m['department_id'] == department]
        people = {p['id']: p for p in c['people']}
        expected = json.loads((base.ROOT/'data/music-ministry-roster.json').read_text())['people']
        self.assertEqual({people[m['person_id']]['name'] for m in links}, {p['name'] for p in expected})
        self.assertEqual(len(links), 13)
        self.assertEqual(self.page.evaluate("IASDPIKnownPreviewSeed.catalog.people.map(p=>p.id)"), [p['id'] for p in c['people']])
        self.assertEqual(len({p['name'] for p in c['people']}), len(c['people']))
        self.assertEqual([people[m['person_id']]['name'] for m in links if m['is_ministry_head']], ['Alexandre'])
        self.assertTrue(all(m['participation_confirmed'] and m['max_monthly_count'] is None for m in links))
        self.assertFalse(any(q['membership_id'] in {m['id'] for m in links} for q in c['qualifications']))
        self.assertFalse(any(a['active'] and a.get('department_id') == department for a in c['availability']))
        for name in ['Henrique Franco', 'Izabelle Souza', 'Letícia Ferreira', 'Samuel Ferreira', 'Victória Scarpelini']:
            person = next(p for p in c['people'] if p['name'] == name)
            self.assertGreaterEqual(len([m for m in c['memberships'] if m['person_id'] == person['id']]), 2)
        self.department('musica')
        self.assertTrue(self.page.locator('[data-b1-action=prefill]').is_disabled())
        self.page.locator('[data-b1-action=prefill]').dispatch_event('click')
        self.assertEqual(self.page.locator('[data-music-volunteer]:checked').count(), 0)

    def test_music_multiple_selection_saves_and_reopens_same_central_ids(self):
        self.login()
        self.department('musica')
        team = self.page.locator('.music-team').first
        self.page.locator('.music-picker>summary').first.click()
        self.assertEqual(team.locator('[data-music-volunteer]').count(), 13)
        selected = [team.locator('[data-music-volunteer]').nth(i).get_attribute('value') for i in [0, 1]]
        for person in selected:
            self.page.locator('.music-team').first.locator('[value="'+person+'"]').check()
        self.page.locator('[data-b1-action=save]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
        self.page.locator('[data-b1-action=reload]').click()
        self.page.wait_for_selector('.music-picker')
        self.assertEqual(set(self.page.locator('.music-team').first.locator(':checked').evaluate_all('es=>es.map(e=>e.value)')), set(selected))

    def test_new_member_publishes_with_central_name_and_stays_private_without_login(self):
        self.login()
        self.department('musica')
        person = next(p for p in self.catalog()['people'] if p['name'] == 'Ana Julia')
        for index in range(self.page.locator('.music-team').count()):
            self.page.locator('.music-picker>summary').nth(index).click()
            self.page.locator('.music-team').nth(index).locator('[value="'+person['id']+'"]').check()
        month = self.page.locator('#schedule-month').input_value()
        self.page.once('dialog', lambda d: d.accept())
        self.page.locator('[data-b1-action=publish]').click()
        self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('publicada')")
        self.go('schedule-calendar')
        self.page.wait_for_selector('.scale-calendar')
        self.page.evaluate("month=>{IASDPIScheduleCalendar.show({month,department:'Música'});render();}", month)
        self.page.wait_for_function("()=>document.querySelector('.scale-calendar')?.textContent.includes('Ana Julia')")
        self.assertNotIn('Nome alterado nesta prévia', self.page.locator('.scale-calendar').inner_text())
        self.page.evaluate('async()=>IASDPIAuth.logout()')
        self.page.evaluate('render()')
        self.page.wait_for_function("()=>document.querySelectorAll('.scale-chip').length===0")

    def test_short_options_keep_conflicts_blocked_and_sonoplastia_visible(self):
        self.login()
        self.department('comunicacao')
        nav = self.page.locator('.monthly-departments')
        self.assertTrue(nav.get_by_role('button', name='Sonoplastia', exact=True).is_visible())
        self.assertEqual(nav.locator('details').count(), 0)
        options = self.page.locator('[data-calendar-volunteer]').first.locator('option:not([value=""])')
        self.assertEqual(set(options.all_text_contents()), {'Henrique Franco', 'Izabelle Souza', 'Simone Cristina', 'Gabriel Macedo', 'Letícia Ferreira'})
        self.page.evaluate("""async()=>{
          const c=await IASDPISchedules.request('iasdpi_registry_catalog'), person=c.people.find(p=>p.name==='Henrique Franco'),
            department=c.departments.find(d=>d.code==='musica');
          const day=document.querySelector('[data-calendar-volunteer]').closest('.monthly-cell').querySelector('[data-day]').dataset.day;
          IASDPIB1Preview.legacy.push({source_key:'test-only-conflict',person_id:person.id,department_id:department.id,date:day,original_name:person.name});
        }""")
        self.page.locator('[data-b1-action=reload]').click()
        self.page.wait_for_function("()=>[...document.querySelectorAll('[data-calendar-volunteer] option')].some(o=>o.textContent==='Henrique Franco'&&!o.disabled)")
        compatible=self.page.locator('[data-calendar-volunteer]').first.locator('option').filter(has_text='Henrique Franco')
        self.assertEqual(compatible.inner_text(),'Henrique Franco');self.assertFalse(compatible.evaluate('e=>e.disabled'))
        day=self.page.evaluate("IASDPIB1Preview.legacy.find(r=>r.source_key==='test-only-conflict').date")
        self.page.evaluate("""async()=>{const c=await IASDPISchedules.request('iasdpi_registry_catalog'),p=c.people.find(p=>p.name==='Henrique Franco'),d=c.departments.find(d=>d.code==='sonoplastia'),m=c.memberships.find(m=>m.person_id===p.id&&m.department_id===d.id);await IASDPISchedules.request('iasdpi_registry_save',{p_person:p.id,p_expected_person_version:p.version,p_person_patch:{},p_links:[{department_id:d.id,expected_version:m?.version||0,patch:{active:true}}],p_request_id:crypto.randomUUID()});}""")
        self.department('sonoplastia')
        option=self.page.locator('.monthly-cell:has([data-day="'+day+'"]) [data-calendar-volunteer]').first.locator('option').filter(has_text='Henrique Franco')
        self.assertEqual(option.inner_text(),'Henrique Franco · ⚠ Indisponível')
        self.assertTrue(option.evaluate('e=>e.disabled'))
        self.assertEqual(option.get_attribute('class'),'schedule-person-unavailable')

    def test_historical_sources_unchanged_and_five_widths_no_overflow(self):
        self.login()
        original = self.page.evaluate('({rows:IASDPIKnownPreviewSeed.rows,agenda:IASDPIAgendaData.events})')
        rows = original['rows']
        self.assertEqual(sum(r['department'] == 'Sonoplastia' for r in rows), 15)
        self.assertEqual(sum(r['department'] == 'Comunicação' for r in rows), 5)
        self.department('musica')
        for width in [360, 390, 768, 1024, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
        output = base.ROOT/'dist/music-roster'
        output.mkdir(parents=True, exist_ok=True)
        for width, label in [(390, 'mobile'), (1440, 'desktop')]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.page.screenshot(path=str(output/('musica-'+label+'.png')), full_page=True)
        self.assertEqual(original, self.page.evaluate('({rows:IASDPIKnownPreviewSeed.rows,agenda:IASDPIAgendaData.events})'))
