"""Fluxo de privacidade simulado em Chromium; permissões reais são testadas em PostgreSQL isolado."""
from pathlib import Path
import json,subprocess,unittest
import test_events_browser as events
import test_frontend_access as base
class CalendarPrivacyBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        events.EventBrowserTests.setUpClass.__func__(cls)
        subprocess.run(['python','scripts/export_preview.py','--calendar-privacy-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.ROOT,check=True,capture_output=True)
    tearDownClass=classmethod(events.EventBrowserTests.tearDownClass.__func__)
    setUp=events.EventBrowserTests.setUp;tearDown=events.EventBrowserTests.tearDown
    go=events.EventBrowserTests.go;choose=events.EventBrowserTests.choose;login=events.EventBrowserTests.login;calendar=events.EventBrowserTests.calendar;manager=events.EventBrowserTests.manager;form=events.EventBrowserTests.form;save=events.EventBrowserTests.save
    def public(self):return self.page.evaluate("async()=>{const r=await fetch('https://g4demo.supabase.co/rest/v1/rpc/iasdpi_events_published',{method:'POST',headers:{'Content-Type':'application/json','x-iasdpi-church':'IASD_PI'},body:JSON.stringify({p_month:'2026-10-01'})});return r.json();}")
    def test_anonymous_calendar_only_elder_scales_and_published_events(self):
        self.calendar();self.assertEqual(self.page.locator('.scale-chip').count(),0);self.assertGreater(self.page.locator('.scale-band').count(),0);self.assertEqual(self.page.locator('.event-chip').count(),17)
        self.assertEqual(self.page.evaluate('IASDPIEvents.sources().length'),0);self.assertNotIn('Sonoplastia',self.page.locator('.scale-calendar').inner_text())
        self.page.locator('[data-calendar-mode=scales]').click();self.assertEqual(self.page.locator('[data-calendar-quick-department]').all_text_contents(),['Ancionato']);self.assertEqual(self.page.locator('[data-calendar-quick-all]').count(),0);self.assertEqual(self.page.get_by_role('link',name='Logar para demais escalas',exact=True).count(),1);self.page.locator('#calendar-filters-toggle').click();self.page.locator('#calendar-people-summary').click();self.assertEqual(self.page.get_by_label('Lucas Borrego',exact=True).count(),0)
    def test_login_loads_private_scales_logout_and_agenda_route_hide_them(self):
        self.login();self.calendar();self.assertEqual(self.page.locator('.scale-chip').count(),18);self.page.locator('[data-calendar-mode=scales]').click();self.assertGreater(self.page.locator('[data-calendar-quick-department]').count(),1);self.assertEqual(self.page.locator('.calendar-login-reminder').count(),0)
        self.page.evaluate('async()=>IASDPIAuth.logout()');self.calendar();self.assertEqual(self.page.locator('.scale-chip').count(),0)
        self.go('agendas');self.page.wait_for_selector('.scale-calendar');self.assertEqual(self.page.locator('.scale-chip').count(),0);self.page.locator('[data-calendar-mode=events]').click();self.assertEqual(self.page.locator('.scale-band').count(),0)
    def test_classification_organizer_audience_and_restriction_roundtrip(self):
        self.login();self.form('Reunião interna fictícia reservada');self.page.select_option('[name=program_category]','general');self.page.select_option('[name=organizer_kind]','school');self.page.select_option('[name=audience]','restricted');self.page.check('[name=is_restricted]');self.save('published')
        self.assertNotIn('Reunião interna fictícia reservada',json.dumps(self.public(),ensure_ascii=False))
        self.manager()
        row=self.page.evaluate("()=>[...IASDPIE1Demo.events.values()].find(e=>e.title==='Reunião interna fictícia reservada')")
        self.page.locator('[data-event-open="'+row['id']+'"]').click();self.assertTrue(self.page.locator('[name=is_restricted]').is_checked());self.assertEqual(self.page.locator('[name=organizer_kind]').input_value(),'school');self.assertEqual(self.page.locator('[name=program_category]').input_value(),'general')
        self.calendar();self.assertIn('Reunião interna fictícia reservada',self.page.locator('.scale-calendar').inner_text())
    def test_restricted_draft_hides_old_publication_and_unrestrict_requires_publish(self):
        self.login();self.form('Evento com privacidade revisada');self.save('published');self.assertIn('Evento com privacidade revisada',json.dumps(self.public(),ensure_ascii=False))
        self.page.check('[name=is_restricted]');self.save();self.assertNotIn('Evento com privacidade revisada',json.dumps(self.public(),ensure_ascii=False));self.save('published')
        self.page.uncheck('[name=is_restricted]');self.save();self.assertNotIn('Evento com privacidade revisada',json.dumps(self.public(),ensure_ascii=False));self.save('published');self.assertIn('Evento com privacidade revisada',json.dumps(self.public(),ensure_ascii=False))
    def test_reserved_category_does_not_implicitly_restrict_and_old_data_stays_pending(self):
        self.login();self.form('Reserva visível fictícia');self.page.select_option('[name=program_category]','reserved');self.save('published');self.assertIn('Reserva visível fictícia',json.dumps(self.public(),ensure_ascii=False))
        sources=self.page.evaluate("()=>[...IASDPIE1Demo.events.values()].filter(e=>e.source_key)");self.assertEqual(len([e for e in sources if e['date'].startswith('2026-10')]),17);self.assertTrue(all(e['program_category'] is None for e in sources))
    def test_private_endpoints_reject_anonymous_forgery(self):
        self.calendar()
        for name in ['iasdpi_schedule_visible','iasdpi_events_visible']:
            status=self.page.evaluate("async name=>(await fetch('https://g4demo.supabase.co/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json','x-iasdpi-church':'IASD_PI'},body:JSON.stringify({p_month:'2026-10-01'})})).status",name);self.assertGreaterEqual(status,400)
    def test_leader_sees_only_authorized_private_department(self):
        self.login('som.iasdpi');self.calendar();rows=self.page.evaluate('IASDPIScheduleCalendar.data()');self.assertTrue(all(r['department'] in ['Ancionato','Sonoplastia'] for r in rows));self.assertEqual(self.page.locator('.scale-chip').count(),13)
    def test_responsive_form_and_independent_organizer_department(self):
        self.login();self.form('Formulário fictício de conferência');self.page.select_option('[name=program_category]','general');self.page.select_option('[name=organizer_kind]','department');self.assertEqual(self.page.locator('[name=organizer_department_id]').count(),1)
        self.assertEqual(self.page.locator('[name=category]').input_value(),'church')
        out=base.ROOT/'dist/calendar-privacy';out.mkdir(parents=True,exist_ok=True)
        for width in [360,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            if width in [390,1440]:self.page.locator('#event-editor').screenshot(path=str(out/('event-form-'+str(width)+'.png')))

    def test_session_refresh_preserves_pending_event_form(self):
        self.login();self.form('Edição pendente fictícia');self.page.fill('[name=description]','Texto ainda não salvo')
        self.page.evaluate("()=>{window.dispatchEvent(new Event('iasdpi-auth-changed'));render();}");self.page.wait_for_selector('#event-editor')
        self.assertEqual(self.page.locator('[name=description]').input_value(),'Texto ainda não salvo');self.assertEqual(self.page.locator('[name=title]').input_value(),'Edição pendente fictícia')
    def test_revoked_identity_refresh_clears_private_calendar_rows(self):
        self.login('som.iasdpi');self.calendar();self.assertEqual(self.page.locator('.scale-chip').count(),13)
        self.page.evaluate("async()=>{const i=await IASDPIAuth.requireIdentity();IASDPIG6Preview.accounts.find(a=>a.id===i.user.id).enabled=false;await IASDPIPortalAccess.refreshFeed('2026-10');render();}")
        self.assertEqual(self.page.locator('.scale-chip').count(),0);self.assertGreater(self.page.locator('[role=alert]').count(),0)

    def test_admin_creates_saves_reopens_and_publishes_schedule_in_demo(self):
        self.login();self.page.locator('[data-portal-department="00000000-0000-4000-8000-000000000001"]').click();self.page.wait_for_selector('[data-b1-action=prefill]')
        self.go('schedule-members');self.page.wait_for_selector('#registry-department');self.page.select_option('#registry-department','00000000-0000-4000-8000-000000000001')
        member=self.page.evaluate("async()=>{const c=await IASDPISchedules.request('iasdpi_registry_catalog'),p=c.people.find(p=>p.name==='Luan Vaz');return c.memberships.find(m=>m.person_id===p.id&&m.department_id==='00000000-0000-4000-8000-000000000001');}")
        row=self.page.locator('[data-registry-member="'+member['id']+'"]');row.locator('[name=participation_confirmed]').check();row.locator('[name=role_ids]').first.check()
        for day in range(7):row.locator('[name=day_'+str(day)+']').select_option('available')
        self.page.once('dialog',lambda d:d.accept());row.locator('button[type=submit]').click();self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
        self.go('schedule-build');self.page.wait_for_selector('[data-b1-action=prefill]');self.page.locator('[data-b1-action=prefill]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('sugeridas')")
        selects=self.page.locator('[data-calendar-volunteer]');self.assertGreater(selects.count(),0);self.assertTrue(all(el.input_value() for el in selects.all()))
        for width in [360,390,768,1024,1440]:self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        month=self.page.locator('#schedule-month').input_value();self.page.locator('[data-b1-action=save]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('salvas nesta aba')")
        plans=self.page.evaluate("month=>[...IASDPIB1Preview.plans.values()].filter(p=>p.department_id==='00000000-0000-4000-8000-000000000001'&&p.month===month+'-01').map(p=>p.id)",month);self.assertEqual(len(plans),1)
        self.go('schedule-calendar');self.go('schedule-build');self.page.wait_for_selector('[data-calendar-volunteer]');self.assertTrue(all(el.input_value() for el in self.page.locator('[data-calendar-volunteer]').all()))
        self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').click();self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('publicada')")
        self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("month=>{IASDPIScheduleCalendar.show({month,department:'Sonoplastia'});render();}",month);self.page.wait_for_function("()=>document.querySelector('.scale-calendar')?.textContent.includes('Luan Vaz')")
        self.page.evaluate('async()=>IASDPIAuth.logout()');self.page.evaluate('render()');self.page.wait_for_function("()=>document.querySelectorAll('.scale-chip').length===0")
