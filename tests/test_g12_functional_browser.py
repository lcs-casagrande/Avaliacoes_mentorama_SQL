"""G12: jornadas completas na versão integrada; rede e Auth reais proibidos."""
from pathlib import Path
import os,shutil,unittest
import test_g11_administration_browser as g11

D='00000000-0000-4000-8000-000000000001'
M='00000000-0000-4000-8000-000000000003'
class G12FunctionalBrowserTests(g11.G11AdministrationBrowserTests):
 @classmethod
 def setUpClass(cls):
  g11.G11AdministrationBrowserTests.setUpClass.__func__(cls)
  if os.environ.get('IASDPI_G12_STATIC_HTML'):
   shutil.copyfile(os.environ['IASDPI_G12_STATIC_HTML'],Path(cls.tmp.name)/'index.html')
 tearDownClass=classmethod(g11.G11AdministrationBrowserTests.tearDownClass.__func__)
 def setUp(self):
  g11.G11AdministrationBrowserTests.setUp(self)
  self.page.set_default_timeout(8000)
 tearDown=g11.G11AdministrationBrowserTests.tearDown
 login=g11.G11AdministrationBrowserTests.login
 go=g11.G11AdministrationBrowserTests.go
 choose=g11.G11AdministrationBrowserTests.choose
 form=g11.G11AdministrationBrowserTests.form
 save=g11.G11AdministrationBrowserTests.save
 def registry(self):
  self.go('schedule-members');self.page.wait_for_selector('#registry-department')
 def gov(self):
  self.go('access-admin');self.page.wait_for_selector('[data-gov-search]')
 def catalog(self):return self.page.evaluate("IASDPISchedules.request('iasdpi_registry_catalog')")
 def submit(self,f):
  self.page.once('dialog',lambda d:d.accept());f.locator('button:not([type=button]),button[type=submit]').last.click()
 def registry_saved(self):self.page.wait_for_function("()=>document.querySelector('[data-registry-status]')?.textContent.includes('confirmadas')")
 def logout(self):self.page.evaluate('()=>IASDPIAuth.logout()')
 def audit(self):
  self.go('access-audit');self.page.wait_for_selector('.governance-table')
  return self.page.evaluate("async()=>{const a=await IASDPIAuth.requireIdentity();return IASDPIAuth.jsonRequest('/rest/v1/rpc/iasdpi_governance_history',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify({p_offset:0})});}")
 def publish_scale(self):
  self.page.wait_for_selector('[data-calendar-volunteer]');select=self.page.locator('[data-calendar-volunteer]').first
  select.select_option(select.locator('option:not([value=""])').first.get_attribute('value'))
  self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-b1-action=publish]').first.click()
  self.page.wait_for_function("()=>document.querySelector('#b1-feedback')?.textContent.includes('publicada')")
 def test_01_new_person_two_ministries_individual_account_first_login_and_access(self):
  self.login();self.registry();before=len(self.catalog()['people'])
  f=self.page.locator('#registry-person');f.evaluate("e=>e.closest('details').open=true");f.locator('[name=name]').fill('Pessoa Sintética G12');self.submit(f);self.registry_saved()
  c=self.catalog();p=next(p for p in c['people'] if p['name']=='Pessoa Sintética G12');self.assertEqual(len(c['people']),before+1)
  f=self.page.locator('#registry-add-links');f.evaluate("e=>e.closest('details').open=true");f.locator('[name=person]').select_option(p['id'])
  for dep in [D,M]:f.locator('[name=departments][value="'+dep+'"]').check()
  self.submit(f);self.registry_saved();self.gov();self.page.locator('[data-gov-action=new-account]').click()
  f=self.page.locator('[data-gov-form=create-account]');f.locator('[name=person]').select_option(p['id']);f.locator('[name=identifier]').fill('pessoa.g12');f.locator('[name=confirmed]').check();self.submit(f);self.page.wait_for_selector('#gov-temporary-password');password=self.page.locator('#gov-temporary-password').input_value()
  c=self.catalog();person=next(x for x in c['people'] if x['id']==p['id']);uid=person['auth_user_id'];self.assertEqual(len(c['people']),before+1);self.assertEqual(sum(m['person_id']==p['id'] for m in c['memberships']),2)
  self.page.locator('[data-gov-action=close-credential]').click();self.page.locator('[data-gov-action=user-permissions][data-user="'+uid+'"]').click()
  for dep in [D,M]:
   f=self.page.locator('[data-gov-form=permissions][data-version="0"]');f.locator('[name=department]').select_option(dep)
   for cap in ['view','edit','publish']:f.locator('[name='+cap+']').check()
   self.submit(f);self.page.wait_for_function("count=>document.querySelectorAll('[data-gov-form=permissions][data-version=\"1\"]').length>=count",arg=1 if dep==D else 2)
  self.logout();self.choose();self.page.fill('#portal-login-form [name=email]','pessoa.g12');self.page.fill('#portal-login-form [name=password]',password);self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('#own-password-form')
  for field in ['password','repeat']:self.page.fill('#own-password-form [name='+field+']','IndividualG12#2026')
  self.page.locator('#own-password-form button').click();self.page.wait_for_function('()=>IASDPIAuth.identityKey()===null')
  self.choose();self.page.fill('#portal-login-form [name=email]','pessoa.g12');self.page.fill('#portal-login-form [name=password]','IndividualG12#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.monthly-calendar')
  self.assertEqual(set(self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents()),{'Sonoplastia','Música'})
 def test_02_leader_only_own_department_publishes_scale(self):
  self.login('som.iasdpi');self.assertEqual(self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents(),['Sonoplastia']);self.publish_scale()
  self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.assertGreater(self.page.evaluate("[...IASDPIB1Preview.plans.values()].filter(p=>p.status==='published'&&p.department_id==='"+D+"').length"),0)
 def test_03_department_event_publication_reaches_public_calendar_and_audit(self):
  self.login('som.iasdpi');self.form(title='Evento Departamental G12',organizer='department:'+D);self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('confirmada')")
  self.logout();self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-11'});render()}");self.page.wait_for_function("()=>document.querySelector('.scale-calendar')?.textContent.includes('Evento Departamental G12')")
  self.login();rows=self.audit();self.assertTrue(any(r.get('details',{}).get('entity')=='event' for r in rows))
 def test_04_general_submission_authorized_elder_decision_and_public_calendar(self):
  self.login('som.iasdpi');self.form(title='Geral G12 para aprovação',public='general');self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Enviado para aprovação')")
  self.assertTrue(self.page.evaluate("[...IASDPIE1Demo.events.values()].find(e=>e.title==='Geral G12 para aprovação').status==='draft'"))
  self.logout();self.login('anciao.iasdpi');self.go('events');self.page.wait_for_selector('[data-event-approve]');self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-event-approve]').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Evento aprovado e publicado')")
  self.logout();self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-11'});render()}");self.page.wait_for_function("()=>document.querySelector('.scale-calendar')?.textContent.includes('Geral G12 para aprovação')")
 def test_05_rejection_preserves_version_and_admin_audit(self):
  g11.G11AdministrationBrowserTests.test_general_event_pending_then_admin_rejects_with_history(self)
  rows=self.audit();self.assertTrue(any(r['action']=='event_rejected' and r.get('target_id') for r in rows))
 def test_06_multi_ministry_same_identity_and_no_crono_privilege(self):
  self.login('multi.iasdpi');uid=self.page.evaluate('(async()=> (await IASDPIAuth.requireIdentity()).user.id)()')
  for dep in [D,M,D]:
   self.page.locator('.monthly-departments [data-department="'+dep+'"]').click();self.page.wait_for_selector('.monthly-calendar');self.assertEqual(self.page.evaluate('(async()=> (await IASDPIAuth.requireIdentity()).user.id)()'),uid)
  self.go('home');self.page.wait_for_selector('#auth-login-form');self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
 def test_07_admin_suspends_account_through_form_and_login_is_denied(self):
  self.login();self.gov();uid=self.page.evaluate("IASDPIG11Demo.accounts.find(a=>a.alias==='som.iasdpi').id");self.page.evaluate("()=>window.g12OldToken=IASDPIG6Preview.jwt(IASDPIG11Demo.accounts.find(a=>a.alias==='som.iasdpi'))");self.page.locator('[data-gov-action=edit-user][data-user="'+uid+'"]').click();f=self.page.locator('[data-gov-form=identity]');f.locator('[name=status]').select_option('suspended');f.locator('[name=reason]').fill('Suspensão funcional sintética G12');self.submit(f)
  self.page.wait_for_function("()=>document.querySelector('[data-gov-user-row]')&&[...document.querySelectorAll('[data-gov-user-row]')].some(r=>r.textContent.includes('som.iasdpi')&&r.textContent.includes('Suspenso'))")
  self.assertFalse(self.page.evaluate("async()=> (await fetch('https://g4demo.supabase.co/rest/v1/rpc/iasdpi_portal_context',{method:'POST',headers:{Authorization:'Bearer '+window.g12OldToken,'x-iasdpi-church':'IASD_PI','Content-Type':'application/json'},body:'{}'})).ok"));self.logout();self.choose();self.page.fill('#portal-login-form [name=email]','som.iasdpi');self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Não foi possível entrar')");self.assertEqual(self.page.locator('.monthly-calendar').count(),0)
 def test_08_suspended_department_loses_general_submission_and_status_is_truthful(self):
  self.login();self.gov();uid=self.page.evaluate("IASDPIG11Demo.accounts.find(a=>a.alias==='som.iasdpi').id");self.page.locator('[data-gov-action=user-permissions][data-user="'+uid+'"]').click();f=self.page.locator('[data-gov-form=permissions][data-version="1"]');f.locator('[name=status]').select_option('suspended');self.submit(f);self.page.wait_for_selector('[data-gov-form=permissions][data-version="2"]')
  self.page.locator('[data-gov-tab=users]').click();row=self.page.locator('[data-gov-user-row]').filter(has_text='som.iasdpi');self.assertIn('Sonoplastia · Suspenso',row.inner_text())
  allowed=self.page.evaluate("async()=>{const a=IASDPIG11Demo.accounts.find(a=>a.alias==='som.iasdpi');return (await fetch('https://g4demo.supabase.co/rest/v1/rpc/iasdpi_event_preview',{method:'POST',headers:{Authorization:'Bearer '+IASDPIG6Preview.jwt(a),'x-iasdpi-church':'IASD_PI','Content-Type':'application/json'},body:JSON.stringify({p_data:{program_category:'general',date:'2026-11-07',recurrence:'none'}})})).ok}");self.assertFalse(allowed)
 def test_09_audit_contains_central_creation_scale_and_access_differences(self):
  self.login();self.registry();f=self.page.locator('#registry-person');f.evaluate("e=>e.closest('details').open=true");f.locator('[name=name]').fill('Pessoa Auditoria Sintética G12');self.submit(f);self.registry_saved();self.go('schedule-build');self.page.wait_for_selector('.monthly-calendar');self.page.locator('.monthly-departments [data-department="'+D+'"]').click();self.publish_scale()
  rows=self.audit();self.assertTrue(any(r.get('details',{}).get('entity')=='person' for r in rows));self.assertTrue(any(r.get('details',{}).get('entity')=='schedule' for r in rows));self.assertTrue(all(r.get('target_id') for r in rows if r.get('details',{}).get('entity') in ['person','schedule']))
 def test_10_public_and_crono_regression_navigation_and_mobile(self):
  self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.assertEqual(self.page.locator('.scale-chip').count(),0);self.assertEqual(self.page.evaluate('IASDPIKnownPreviewSeed.rows.length'),20)
  self.go('home');self.page.wait_for_selector('#auth-login-form');self.page.fill('#auth-login-form [name=email]','crono.iasdpi');self.page.fill('#auth-login-form [name=password]','Demonstracao#2026');self.page.locator('#auth-login-form button').click();self.page.wait_for_function('()=>IASDPIAuth.allowed()')
  for route in ['home','new','history']:
   self.go(route);self.assertFalse(self.page.evaluate('!!document.querySelector("#auth-login-form")'))
  self.logout();self.login();out=Path('dist/governance-g12');out.mkdir(parents=True,exist_ok=True)
  for route,selector in [('church-home','.church-portal-cards'),('schedule-build','.monthly-calendar'),('events','[data-event-new]'),('organization','#organization-results'),('access-admin','[data-gov-search]'),('access-audit','.governance-table')]:
   self.go(route);self.page.wait_for_selector(selector)
   for width in [360,390,768,1024,1440]:
    self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width,route)
   if route in ['access-admin','access-audit']:self.page.screenshot(path=str(out/(route+'.png')),full_page=True)
 def test_11_invalid_form_duplicate_alias_and_network_failure_preserve_input(self):
  self.login();self.gov();self.page.locator('[data-gov-action=new-account]').click();f=self.page.locator('[data-gov-form=create-account]');f.locator('[name=identifier]').fill('som.iasdpi');f.locator('[name=confirmed]').check();self.submit(f);self.page.wait_for_function("()=>document.querySelector('[data-form-feedback]')?.textContent.includes('Não foi possível concluir')");self.assertEqual(f.locator('[name=identifier]').input_value(),'som.iasdpi');self.assertEqual(self.page.locator('#gov-temporary-password').count(),0)
  self.form(title='Rascunho preservado G12');self.page.evaluate("()=>{const prior=window.fetch;window.fetch=(url,opts)=>String(url).includes('iasdpi_event_submit')?Promise.reject(Error('Falha sintética G12')):prior(url,opts)}");self.save('draft');self.page.wait_for_function("()=>document.querySelector('[role=alert]')?.textContent.includes('Falha sintética')");self.assertEqual(self.page.locator('#event-editor [name=title]').input_value(),'Rascunho preservado G12')
 def test_12_general_event_series_also_requires_approval(self):
  self.login('som.iasdpi');self.form(title='Série Geral G12',public='general');self.page.select_option('#event-editor [name=recurrence]','weekly');self.page.select_option('#event-editor [name=recurrence_weekday]','6');self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Enviado para aprovação')")
  self.assertTrue(self.page.evaluate("[...IASDPIE1Demo.events.values()].filter(e=>e.title==='Série Geral G12').every(e=>e.status==='draft'&&e.approval_status==='pending')"))
 def test_13_department_suspension_preserves_other_ministry_and_old_session_denied(self):
  self.login();self.gov();uid=self.page.evaluate("IASDPIG11Demo.accounts.find(a=>a.alias==='multi.iasdpi').id")
  self.page.locator('[data-gov-action=user-permissions][data-user="'+uid+'"]').click();f=self.page.locator('[data-gov-form=permissions][data-version="1"]').filter(has=self.page.locator('[name=department] option[value="'+D+'"][selected]'));f.locator('[name=status]').select_option('revoked');self.submit(f);self.page.wait_for_selector('[data-gov-form=permissions][data-version="2"]');rows=self.audit();self.assertTrue(any(r['action']=='department_access_revoked' and r.get('details',{}).get('after',{}).get('status')=='revoked' for r in rows))
  self.logout();self.login('multi.iasdpi');self.assertEqual(self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents(),['Música'])
  denied=self.page.evaluate("async()=>{try{await IASDPISchedules.request('iasdpi_schedule_workspace',{p_department:'"+D+"',p_month:'2026-11-01'});return false;}catch{return true;}}");self.assertTrue(denied)
 def test_14_pending_and_restricted_events_never_leak_to_public(self):
  self.login('som.iasdpi');self.form(title='Geral Privado G12',public='general');self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Enviado para aprovação')")
  self.form(title='Departamento Restrito G12',organizer='department:'+D);self.page.locator('#event-editor [name=is_restricted]').check();self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('confirmada')")
  self.logout();self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-11'});render()}");self.page.wait_for_function("()=>![...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('Carregando eventos'))");self.assertNotIn('Geral Privado G12',self.page.locator('.scale-calendar').inner_text());self.assertNotIn('Departamento Restrito G12',self.page.locator('.scale-calendar').inner_text())
 def test_15_audit_understands_real_rpc_action_names_and_registry_fields(self):
  self.login();self.page.evaluate("()=>{const actor_id=IASDPIG11Demo.accounts.find(a=>a.alias==='admin.iasdpi').id;IASDPIG6Preview.audit.unshift({actor_id,action:'schedule_department_access_update',target_id:actor_id,created_at:new Date().toISOString(),details:{before:{can_publish:true},after:{can_publish:false}}},{actor_id,action:'person_changed',target_id:actor_id,created_at:new Date().toISOString(),details:{entity:'person',changed_fields:['name','active']}})}")
  self.audit();text=self.page.locator('#app').inner_text();self.assertIn('Permissões ministeriais alteradas',text);self.assertIn('Nome',text);self.assertIn('Ativo',text)
 def test_16_empty_states_and_invalid_password_are_clear(self):
  self.choose();self.page.fill('#portal-login-form [name=email]','admin.iasdpi');self.page.fill('#portal-login-form [name=password]','senha-errada');self.page.locator('#portal-login-form button').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Não foi possível entrar')");self.assertEqual(self.page.locator('[data-gov-search]').count(),0)
  self.login();self.audit();self.assertIn('Nenhuma alteração registrada',self.page.locator('#app').inner_text());self.gov();self.page.fill('[data-gov-search]','Não existe este usuário G12');self.assertIn('Nenhum usuário corresponde',self.page.locator('[data-gov-search-status]').inner_text());self.registry();self.page.fill('#registry-search','Nenhuma pessoa possui este nome G12');self.assertIn('Nenhuma pessoa corresponde',self.page.locator('#registry-people-results').inner_text());self.page.locator('[data-registry-clear-filters]').click();self.assertGreater(self.page.locator('[data-registry-person-row]').count(),0)

 def test_17_ancionato_week_and_month_publish_independently_and_are_public(self):
  self.login('anciao.iasdpi');self.page.wait_for_selector('.elder-week-calendar');select=self.page.locator('[data-elder-person]:not([disabled])').first;value=select.locator('option:not([value=""]):not([disabled])').first.get_attribute('value');select.select_option(value)
  self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-elder-action=publish]').click();self.page.wait_for_function("()=>document.querySelector('#elder-feedback')?.textContent.includes('publicada')")
  self.page.locator('[data-elder-action=kind][data-kind=monthly]').click();self.page.wait_for_selector('.elder-month-card');self.assertEqual(self.page.locator('.elder-month-card').count(),12)
  select=self.page.locator('[data-elder-person]:not([disabled])').first;select.select_option(value);self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-elder-action=publish]').click();self.page.wait_for_function("()=>document.querySelector('#elder-feedback')?.textContent.includes('publicada')")
  periods=self.page.evaluate("[...IASDPIB1Preview.elderPeriods.values()].filter(p=>p.status==='published'&&p.person_id).map(p=>p.kind)");self.assertIn('weekly',periods);self.assertIn('monthly',periods)
  self.logout();self.go('schedule-calendar');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-11'});render()}");self.page.wait_for_function("()=>document.querySelectorAll('.scale-band.scale-weekly').length>0");self.assertGreater(self.page.locator('.scale-monthly').count(),0)

# Executar somente as jornadas G12; a suíte G11 permanece independente.
for _name in dir(g11.G11AdministrationBrowserTests):
 if _name.startswith("test_") and _name not in G12FunctionalBrowserTests.__dict__:
  setattr(G12FunctionalBrowserTests,_name,None)
