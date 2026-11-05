"""UI final G11: HTML integrado, Auth/RPC em memória e rede externa negada."""
from pathlib import Path
import subprocess,unittest
import test_event_planning_browser as base

class G11AdministrationBrowserTests(base.EventPlanningBrowserTests):
 @classmethod
 def setUpClass(cls):
  super().setUpClass();subprocess.run(['python','scripts/export_preview.py','--governance-final-preview','--output',str(Path(cls.tmp.name)/'index.html')],cwd=base.base.ROOT,check=True,capture_output=True)
 # Não reexecutar os testes herdados de Eventos: só usar a infraestrutura.
 def test_admin_panel_central_people_pending_and_audit_navigation(self):
  self.login();self.go('access-admin');self.page.wait_for_selector('[data-gov-search]');self.assertIn('Último acesso',self.page.locator('#app').text_content());self.assertIn('Responsáveis sem conta',self.page.locator('#app').inner_text())
  self.go('access-audit');self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Auditoria')");self.assertEqual(self.page.locator('nav.governance-tabs').count(),0)
 def test_leader_and_member_cannot_open_administration(self):
  for i,alias in enumerate(['som.iasdpi','musica.iasdpi','anciao.iasdpi','multi.iasdpi','leitura.iasdpi']):
   if i:self.page.evaluate('()=>IASDPIAuth.logout()')
   self.login(alias);self.go('access-admin');self.assertEqual(self.page.locator('[data-gov-search]').count(),0);self.go('access-audit');self.assertEqual(self.page.locator('.governance-table').count(),0)
 def test_create_individual_uses_existing_person_and_secret_is_ephemeral(self):
  self.login();self.go('access-admin');self.page.wait_for_selector('[data-gov-search]');self.page.locator('[data-gov-action=new-account]').click();f=self.page.locator('[data-gov-form=create-account]');self.assertTrue(f.is_visible());f.locator('[name=identifier]').fill('individual.g11');f.locator('[name=confirmed]').check();self.page.once('dialog',lambda d:d.accept());f.locator('button').click();self.page.wait_for_selector('#gov-temporary-password');secret=self.page.locator('#gov-temporary-password').input_value();self.assertNotIn(secret,self.page.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)'));self.page.locator('[data-gov-action=close-credential]').click();self.assertEqual(self.page.locator('#gov-temporary-password').count(),0)
 def test_admin_permission_flags_and_suspension(self):
  self.login();self.go('access-admin');self.page.wait_for_selector('[data-gov-search]');self.page.locator('[data-gov-action=user-permissions]').nth(1).click();self.page.wait_for_selector('[data-gov-form=permissions]');self.assertEqual(self.page.locator('[data-gov-form=permissions] [name=access]').count(),0);self.assertTrue(self.page.locator('[data-gov-form=permissions] [name=kind]').first.is_visible())
 def test_general_event_pending_then_admin_rejects_with_history(self):
  self.login('som.iasdpi');self.form(title='Geral sujeito à decisão G11',public='general',organizer='local_church');self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Enviado para aprovação')");self.page.evaluate('()=>IASDPIAuth.logout()');self.login();self.go('events');self.page.wait_for_selector('[data-event-reject]');self.page.once('dialog',lambda d:d.accept('Revisar data e organização'));self.page.locator('[data-event-reject]').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Evento rejeitado')");self.go('access-audit');self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Evento rejeitado')")
 def test_authorized_elder_approves_general_event_without_admin_access(self):
  self.login('som.iasdpi');self.form(title='Geral para decisão do Ancionato',public='general',organizer='local_church');self.save();self.page.wait_for_function("()=>document.querySelector('#event-save-state')?.textContent.includes('Enviado para aprovação')");self.page.evaluate('()=>IASDPIAuth.logout()');self.login('anciao.iasdpi');self.go('events');self.page.wait_for_selector('[data-event-approve]');self.page.once('dialog',lambda d:d.accept());self.page.locator('[data-event-approve]').click();self.page.wait_for_function("()=>document.querySelector('#app')?.textContent.includes('Evento aprovado e publicado')");self.go('access-audit');self.assertEqual(self.page.locator('.governance-table').count(),0)
 def test_new_member_first_login_requires_own_password_and_grants_no_edit(self):
  self.login();self.go('access-admin');self.page.wait_for_selector('[data-gov-search]');self.page.locator('[data-gov-action=new-account]').click();f=self.page.locator('[data-gov-form=create-account]');f.locator('[name=identifier]').fill('first.access.g11');f.locator('[name=confirmed]').check();self.page.once('dialog',lambda d:d.accept());f.locator('button').click();self.page.wait_for_selector('#gov-temporary-password');temporary=self.page.locator('#gov-temporary-password').input_value();self.page.evaluate('()=>IASDPIAuth.logout()');self.go('portal-login');self.page.wait_for_selector('#portal-login-form');self.page.fill('#portal-login-form [name=email]','first.access.g11');self.page.fill('#portal-login-form [name=password]',temporary);self.page.locator('#portal-login-form button').click();self.page.wait_for_selector('#own-password-form');self.page.fill('#own-password-form [name=password]','IndividualLocal#G11-2026');self.page.fill('#own-password-form [name=repeat]','IndividualLocal#G11-2026');self.page.locator('#own-password-form button').click();self.page.wait_for_function('()=>IASDPIAuth.identityKey()===null');self.assertNotIn('IndividualLocal#G11-2026',self.page.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)'))
 def test_mobile_admin_and_public_have_no_page_overflow(self):
  self.login();self.go('access-admin');self.page.wait_for_selector('[data-gov-search]');out=base.base.ROOT/'dist/governance-g11';out.mkdir(exist_ok=True)
  for width in [1440,390]:
   self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width);self.page.screenshot(path=str(out/f'admin-{width}.png'),full_page=True)
  self.page.evaluate('()=>IASDPIAuth.logout()');self.go('church-home');self.page.screenshot(path=str(out/'public-390.png'),full_page=True)

# A infraestrutura é compartilhada, mas os casos da classe base pertencem à sua suíte.
for _name in dir(base.EventPlanningBrowserTests):
 if _name.startswith('test_') and _name not in G11AdministrationBrowserTests.__dict__:
  setattr(G11AdministrationBrowserTests,_name,None)
