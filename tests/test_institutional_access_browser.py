"""Tabela institucional: provedor em memória e rede externa proibida. Sem SQL."""
from pathlib import Path
import os,shutil,subprocess,unittest
import test_g12_functional_browser as base
D=base.D;M=base.M
class InstitutionalAccessBrowserTests(base.G12FunctionalBrowserTests):
 @classmethod
 def setUpClass(cls):
  super().setUpClass()
  file=os.environ.get('IASDPI_INSTITUTIONAL_STATIC_HTML')
  if file:shutil.copyfile(file,Path(cls.tmp.name)/'index.html')
  else:subprocess.run(['python','scripts/export_preview.py','--institutional-access-preview','--output',str(Path(cls.tmp.name)/'index.html')],check=True,capture_output=True)
 def login(self,alias='admin.iasdpi'):
  self.choose();self.page.fill('#portal-login-form [name=email]',alias);self.page.fill('#portal-login-form [name=password]','Demonstracao#2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_function("()=>document.querySelector('.monthly-calendar,.elder-week-calendar,.scale-calendar,#own-password-form')")
 def gov(self):self.go('access-admin');self.page.wait_for_selector('[data-institutional-row]')
 def slot(self,key):return self.page.locator('[data-institutional-row="'+key+'"]')
 def open(self,locator):
  if not locator.evaluate('e=>e.open'):locator.locator('summary').click()
 def save_row(self,key):
  self.page.on('dialog',lambda d:d.accept());self.slot(key).locator('[data-slot-save]').click();self.page.wait_for_function("()=>[...document.querySelectorAll('#app [role=status]')].some(e=>/Permissões salvas|Salvo\\./.test(e.textContent))")
 def test_01_single_vertical_table_uses_all_central_departments(self):
  self.login('admin');self.gov();self.assertEqual(self.page.locator('.governance-tabs').count(),0)
  self.assertEqual(self.page.locator('.institutional-table thead').first.locator('th').all_text_contents(),['Login','Responsável','Permissões','Redefinir senha','Salvar'])
  c=self.page.evaluate("IASDPIKnownPreviewSeed.catalog.departments.filter(d=>d.active).length");self.assertGreaterEqual(self.page.locator('[data-institutional-row]').count(),c+3)
  for key in ['sonoplastia','musica','membro','admin','anciao_1']:self.assertEqual(self.slot(key).count(),1)
 def test_02_person_search_is_selection_from_registry_not_free_name(self):
  self.login();self.gov();d=self.slot('sonoplastia').locator('.institutional-people');self.open(d);d.locator('[data-slot-search]').fill('Luan Vaz');self.assertEqual(d.locator('option:not([hidden]):not([value=""])').all_text_contents(),['Luan Vaz'])
  self.assertTrue(d.locator('option:not([value=""])').evaluate_all("es=>es.map(e=>e.textContent).every((v,i,a)=>!i||a[i-1].localeCompare(v,'pt-BR')<=0)"));ids=self.page.evaluate('IASDPIKnownPreviewSeed.catalog.people.map(p=>p.id)');self.assertTrue(all(v in ids for v in d.locator('option:not([value=""])').evaluate_all('es=>es.map(e=>e.value)')))
 def test_03_non_elder_department_can_receive_multiple_scopes(self):
  self.login();self.gov();d=self.slot('sonoplastia').locator('.institutional-permissions');self.open(d);d.locator('[value="'+M+'"]').check();self.save_row('sonoplastia');self.page.wait_for_function("()=>IASDPIInstitutionalDemo.slots.get('sonoplastia').departments.length===2")
  self.logout();self.login('sonoplastia');self.assertEqual(set(self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents()),{'Música','Sonoplastia'})
  self.go('access-admin');self.assertEqual(self.page.locator('[data-slot-save]').count(),0)
 def test_04_member_only_published_calendar_no_admin_registry_or_editor(self):
  self.login('membro');self.page.wait_for_selector('.scale-calendar')
  for route in ['access-admin','access-audit','schedule-members','schedule-build','events','schedule-settings']:
   self.go(route);self.assertIn('Acesso restrito',self.page.locator('#app').inner_text())
  messages=self.page.evaluate("async()=>{const names=['iasdpi_registry_catalog','iasdpi_schedule_workspace','iasdpi_governance_catalog'];const out=[];for(const n of names){try{await IASDPISchedules.request(n,{p_department:'"+D+"',p_month:'2026-11-01'});out.push(false)}catch{out.push(true)}}return out}");self.assertEqual(messages,[True]*3)
 def test_05_handoff_blocks_old_token_and_preserves_history_actor(self):
  self.login();self.gov();before=self.page.evaluate("()=>{const u=IASDPIG11Demo.accounts.find(a=>a.alias==='som.iasdpi');return {uid:u.id,token:IASDPIG6Preview.jwt(u),count:IASDPIKnownPreviewSeed.catalog.people.length,history:structuredClone(IASDPIKnownPreviewSeed.rows)}}")
  r=self.slot('sonoplastia');d=r.locator('.institutional-people');self.open(d);p=self.page.evaluate("IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Lucas Borrego').id");d.locator('[data-slot-person]').select_option(p);self.save_row('sonoplastia');self.page.wait_for_function("()=>IASDPIInstitutionalDemo.slots.get('sonoplastia').credential_pending")
  self.assertFalse(self.page.evaluate("async token=>(await fetch('https://g4demo.supabase.co/rest/v1/rpc/iasdpi_portal_context',{method:'POST',headers:{Authorization:'Bearer '+token,'x-iasdpi-church':'IASD_PI','Content-Type':'application/json'},body:'{}'})).ok",before['token']))
  after=self.page.evaluate("({count:IASDPIKnownPreviewSeed.catalog.people.length,history:IASDPIKnownPreviewSeed.rows})");self.assertEqual(after['count'],before['count']);self.assertEqual(after['history'],before['history'])
 def test_06_safe_reset_link_and_login_with_new_individual_password(self):
  self.login();self.gov();p=self.page.evaluate("IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Lucas Borrego').id");d=self.slot('sonoplastia').locator('.institutional-people');self.open(d);d.locator('[data-slot-person]').select_option(p);self.save_row('sonoplastia');self.page.wait_for_function("()=>IASDPIInstitutionalDemo.slots.get('sonoplastia').credential_pending");self.slot('sonoplastia').locator('[data-slot-reset]').click();self.page.wait_for_selector('[data-institutional-reset-link]');url=self.page.locator('[data-institutional-reset-link]').input_value();self.assertNotIn('password=',url)
  self.logout();self.page.goto(url);self.page.wait_for_selector('[data-gov-form=reset]')
  for field in ['password','repeat']:self.page.fill('[data-gov-form=reset] [name='+field+']','NovaIndividual#G12-2026')
  self.page.locator('[data-gov-form=reset] button').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Senha redefinida')");self.choose();self.page.fill('#portal-login-form [name=email]','sonoplastia');self.page.fill('#portal-login-form [name=password]','NovaIndividual#G12-2026');self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('.monthly-calendar')
 def test_07_no_general_approval_or_admin_escalation_in_department_payload(self):
  self.login();self.gov();result=self.page.evaluate("async()=>{const r=IASDPIInstitutionalDemo.slots.get('sonoplastia');try{await IASDPISchedules.request('iasdpi_institutional_save',{p_identifier:r.identifier,p_expected_version:r.version,p_person:r.person_id,p_departments:r.departments,p_approve_general:true,p_confirm_elevated:true,p_confirm_reset:false,role:'admin'});return false}catch{return true}}")
  self.assertTrue(result);self.assertEqual(self.slot('sonoplastia').locator('[data-slot-approval]').count(),0)
 def test_08_create_archive_preserves_records_and_adds_department_everywhere(self):
  self.login();self.gov();details=self.page.locator('[data-institutional-department]').locator('..');self.open(details);f=self.page.locator('[data-institutional-department]');f.locator('[name=name]').fill('Departamento Sintético G12');f.locator('button').click();self.page.wait_for_function("()=>IASDPIKnownPreviewSeed.catalog.departments.some(d=>d.name==='Departamento Sintético G12')")
  dep=self.page.evaluate("IASDPIKnownPreviewSeed.catalog.departments.find(d=>d.name==='Departamento Sintético G12')");self.assertEqual(self.slot('departamento_sintetico_g12').count(),1)
  self.go('organization');self.page.wait_for_function("()=>document.querySelector('#organization-results')?.textContent.includes('Departamento Sintético G12')");self.go('schedule-members');self.page.wait_for_selector('#registry-department');self.assertEqual(self.page.locator('#registry-department option[value=\"'+dep['id']+'\"]').count(),1)
  self.go('events');self.page.wait_for_selector('[data-event-new]');self.page.locator('[data-event-new]').click();self.assertEqual(self.page.locator('#event-editor [name=event_organizer] option[value=\"department:'+dep['id']+'\"]').count(),1);self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-event-close]').click();self.go('schedule-build');self.page.wait_for_selector('.monthly-departments');self.assertEqual(self.page.locator('.monthly-departments [data-department=\"'+dep['id']+'\"]').count(),1);self.gov()
  self.open(self.page.locator('[data-institutional-department]').locator('..'));self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-institutional-archive="'+dep['id']+'"]').click();self.page.wait_for_function("id=>!IASDPIKnownPreviewSeed.catalog.departments.find(d=>d.id===id).active",arg=dep['id']);self.assertEqual(self.page.evaluate('IASDPIKnownPreviewSeed.rows.length'),20);self.go('organization');self.page.wait_for_function("()=>!document.querySelector('#organization-results')?.textContent.includes('Departamento Sintético G12')")
 def test_09_multiple_rows_keep_unsaved_choices_and_mobile_no_overflow(self):
  self.login();self.gov();d=self.slot('musica').locator('.institutional-permissions');self.open(d);d.locator('[value="'+D+'"]').check();self.save_row('sonoplastia');self.open(self.slot('musica').locator('.institutional-permissions'));self.assertTrue(self.slot('musica').locator('[value="'+D+'"]').is_checked())
  out=Path('dist/institutional-g12');out.mkdir(exist_ok=True,parents=True)
  for width in [360,390,768,1024,1440]:
   self.page.set_viewport_size({'width':width,'height':950});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
   if width in [390,1440]:self.page.screenshot(path=str(out/('usuarios-'+str(width)+'.png')),full_page=True)
 def test_10_elder_approval_requires_explicit_admin_confirmation(self):
  self.login();self.gov();key=self.page.evaluate("[...IASDPIInstitutionalDemo.slots.values()].find(r=>r.kind==='elder'&&!r.approve_general).identifier")
  d=self.slot(key).locator('.institutional-permissions');self.open(d);self.assertFalse(d.locator('[data-slot-approval]').is_checked());d.locator('[data-slot-approval]').check();self.page.on('dialog',lambda d:d.dismiss());self.slot(key).locator('[data-slot-save]').click();self.assertFalse(self.page.evaluate("key=>IASDPIInstitutionalDemo.slots.get(key).approve_general",key))
 def test_11_elder_profile_can_approve_without_becoming_admin(self):
  self.login('som.iasdpi');self.form(title='Geral para decisão institucional',public='general');self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Enviado para aprovação')");self.logout();self.login('anciao.iasdpi');self.go('events');self.page.wait_for_selector('[data-event-approve]');self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-event-approve]').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Evento aprovado e publicado')");self.go('access-admin');self.assertEqual(self.page.locator('[data-slot-save]').count(),0)
 def test_12_cannot_reuse_saved_version_and_member_cannot_escalate(self):
  self.login();self.gov();r=self.page.evaluate("structuredClone(IASDPIInstitutionalDemo.slots.get('sonoplastia'))");self.save_row('sonoplastia');self.page.wait_for_function("()=>IASDPIInstitutionalDemo.slots.get('sonoplastia').version===2")
  rejected=self.page.evaluate("async r=>{try{await IASDPISchedules.request('iasdpi_institutional_save',{p_identifier:r.identifier,p_expected_version:r.version,p_person:r.person_id,p_departments:r.departments,p_approve_general:false,p_confirm_reset:false,p_confirm_elevated:false});return false}catch{return true}}",r);self.assertTrue(rejected)
  self.logout();self.login('membro');self.page.wait_for_selector('.scale-calendar');self.assertTrue(self.page.evaluate("async()=>{try{await IASDPISchedules.request('iasdpi_institutional_catalog');return false}catch{return true}}"))

 def test_13_permission_removal_and_legacy_member_grants_are_enforced(self):
  self.login();self.gov();d=self.slot('sonoplastia').locator('.institutional-permissions');self.open(d);d.locator('[value="'+M+'"]').check();d.locator('[value="'+D+'"]').uncheck();self.save_row('sonoplastia');self.page.wait_for_function("()=>IASDPIInstitutionalDemo.slots.get('sonoplastia').version===2")
  blocked=self.page.evaluate("async()=>{const u=IASDPIG11Demo.accounts.find(a=>a.sharedReader);try{await IASDPISchedules.request('iasdpi_governance_permission_save',{p_user:u.id,p_department:'"+D+"',p_kind:'manual',p_flags:{view:true,edit:true},p_status:'active',p_expected_version:0,p_approve_general:false});return false}catch{return true}}")
  self.assertTrue(blocked);self.logout();self.login('sonoplastia');self.assertEqual(self.page.locator('.monthly-departments [data-b1-action=department]').all_text_contents(),['Música'])

 def test_14_member_sees_published_scales_but_no_drafts_or_restricted_events(self):
  self.login();self.go('schedule-build');self.page.wait_for_selector('.monthly-departments');self.page.locator('.monthly-departments [data-department="'+D+'"]').click();self.publish_scale()
  self.form(title='Evento Aberto Institucional',organizer='department:'+D);self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('confirmada')")
  self.form(title='Evento Restrito Institucional',organizer='department:'+D);self.page.locator('[name=is_restricted]').check();self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('confirmada')")
  self.form(title='Rascunho Institucional',organizer='department:'+D);self.save('draft');self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Rascunho salvo')")
  self.logout();self.login('membro');self.page.wait_for_selector('.scale-calendar');self.page.evaluate("()=>{IASDPIScheduleCalendar.show({month:'2026-11'});render()}");self.page.wait_for_function("()=>document.querySelector('.scale-calendar')?.textContent.includes('Evento Aberto Institucional')");text=self.page.locator('.scale-calendar').inner_text();self.assertNotIn('Evento Restrito Institucional',text);self.assertNotIn('Rascunho Institucional',text);self.assertGreater(self.page.locator('.scale-chip').count(),0)
 def test_15_same_person_two_institutional_logins_has_one_auth_identity(self):
  self.login();self.gov();before=self.page.evaluate("({accounts:IASDPIG11Demo.accounts.length,people:IASDPIKnownPreviewSeed.catalog.people.length,uid:IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Luan Vaz').auth_user_id})")
  person=self.page.evaluate("IASDPIKnownPreviewSeed.catalog.people.find(p=>p.name==='Luan Vaz').id");d=self.slot('musica').locator('.institutional-people');self.open(d);d.locator('[data-slot-person]').select_option(person);self.save_row('musica');self.page.wait_for_function("()=>IASDPIInstitutionalDemo.slots.get('musica').credential_pending")
  result=self.page.evaluate("({accounts:IASDPIG11Demo.accounts.length,people:IASDPIKnownPreviewSeed.catalog.people.length,uid:IASDPIInstitutionalDemo.slots.get('musica').user_id,sound:IASDPIInstitutionalDemo.slots.get('sonoplastia').user_id,caps:IASDPIG11Demo.accounts.find(a=>a.id===IASDPIInstitutionalDemo.slots.get('musica').user_id).caps})");self.assertEqual(result['accounts'],before['accounts']);self.assertEqual(result['people'],before['people']);self.assertEqual(result['uid'],before['uid']);self.assertEqual(result['sound'],before['uid']);self.assertTrue(result['caps'][D]['publish']);self.assertTrue(result['caps'][M]['publish'])

for n in dir(base.G12FunctionalBrowserTests):
 if n.startswith('test_') and n not in InstitutionalAccessBrowserTests.__dict__:setattr(InstitutionalAccessBrowserTests,n,None)
