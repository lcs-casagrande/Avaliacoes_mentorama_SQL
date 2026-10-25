"""Lote 5: navegador real, contas fictícias e Supabase inteiramente interceptado."""
import copy
import json
import re
import shutil
import unittest
from urllib.parse import urlsplit,parse_qs

import test_frontend_access as base
import test_data_reliability as reliable
import test_operational_browser as operational

@unittest.skipUnless(base.sync_playwright and shutil.which('chromium'),'Requer Chromium e Playwright')
class HistoryComplementaryTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(operational.OperationalBrowserTests.tearDownClass.__func__)
    tearDown=reliable.DataReliabilityTests.tearDown
    open=reliable.DataReliabilityTests.open
    login=reliable.DataReliabilityTests.login
    save=reliable.DataReliabilityTests.save

    def setUp(self):
        self.password_redirects=[];self.password_requests=[];self.password_updates=[];self.pkce_attempts=[];self.reset_unknown=False;self.reset_rate=False;self.reset_fail=False;self.code_invalid=False;self.update_fail=False;self.model_writes=[]
        reliable.DataReliabilityTests.setUp(self)
        self.original=copy.deepcopy(self.records['clock-fixture'])

    def supabase(self,route):
        request=route.request;url=urlsplit(request.url);path=url.path;query=parse_qs(url.query)
        if path=='/auth/v1/recover':
            self.password_requests.append(request.post_data_json);self.password_redirects.append(query.get('redirect_to',[''])[0])
            if self.reset_fail:return route.abort('failed')
            if self.reset_rate:return route.fulfill(status=429,json={'code':'over_email_send_rate_limit','msg':'Rate limit'})
            if self.reset_unknown:return route.fulfill(status=404,headers={'x-supabase-api-version':'2024-01-01'},json={'code':'user_not_found','msg':'User not found'})
            return route.fulfill(json={})
        if path=='/auth/v1/token' and query.get('grant_type')==['pkce']:
            self.pkce_attempts.append(request.post_data_json)
            if self.code_invalid:return route.fulfill(status=400,json={'code':'otp_expired','msg':'Invalid code'})
            return route.fulfill(json={'access_token':'valid.recovery.token','refresh_token':'fake-recovery-refresh','expires_in':3600,'token_type':'bearer','user':{'id':base.USER,'email':'test@example.invalid','is_anonymous':False}})
        if path=='/auth/v1/user' and request.method=='PUT':
            self.password_updates.append(request.post_data_json)
            if self.update_fail:return route.fulfill(status=401,json={'code':'session_not_found','msg':'Expired'})
            return route.fulfill(json={'id':base.USER,'email':'test@example.invalid','is_anonymous':False})
        if path=='/rest/v1/rpc/iasdpi_save_template':
            if self.role!='admin':return route.fulfill(status=403,json={'code':'42501','message':'Acesso administrativo necessário.'})
            body=request.post_data_json;self.model_writes.append(copy.deepcopy(body))
            old=next((m for m in self.models if m['id']==body['p_id']),None)
            if old and old['version']!=body['p_expected_version']:return route.fulfill(status=409,json={'code':'40001','message':'Modelo alterado; atualize.'})
            model={'id':body['p_id'],'display_name':body['p_name'],'version':body['p_expected_version']+1,'plan':body['p_plan']}
            if old:self.models[self.models.index(old)]=model
            else:self.models.append(model)
            return route.fulfill(json=model)
        if path=='/rest/v1/iasdpi_programs' and 'id' not in query and not (self.fail_list or self.hold_list or self.invalid_response):
            self.reads+=1;offset=int(query.get('offset',['0'])[0]);limit=int(query.get('limit',['500'])[0]);rows=sorted(self.records.values(),key=lambda p:p['id'])[offset:offset+limit]
            return route.fulfill(json=[{'document':p} for p in rows])
        return reliable.DataReliabilityTests.supabase(self,route)

    def enter(self):
        self.role='admin';self.open();self.login();self.page.wait_for_function('(count)=>IASDPIAuth.allowed()&&!state.busy&&!bootInProgress&&state.programs.length===count',arg=len(self.records))

    def history(self):
        self.enter();self.page.evaluate('navigate("history")');self.page.wait_for_selector('#history-filters')

    def fixtures(self):
        second=copy.deepcopy(self.original);second['id']='second';second['plan']['name']='Culto da Família';second['plan']['date']='2026-11-14'
        # Somente o nome/data são usados nestes filtros. O intervalo antigo deve ser considerado inválido.
        second['executions']={};second['actual_details']={}
        third=copy.deepcopy(self.original);third['id']='third';third['plan']['name']='Culto Jovem';third['plan']['date']='2026-10-24';third['status']='Planejamento'
        self.records.update(second=second,third=third)

    def apply(self,query='',start='',end=''):
        form=self.page.locator('#history-filters')
        for name,value in [('history-query',query),('history-from',start),('history-to',end)]:form.locator('[name="'+name+'"]').fill(value)
        form.locator('[type="submit"]').click()

    def request_reset(self,email='test@example.invalid'):
        self.page.goto(self.base+'#forgot-password');self.page.wait_for_selector('#password-request-form')
        self.page.locator('#password-request-form [name="email"]').fill(email);self.page.locator('#password-request-form button').click();self.page.wait_for_function('()=>!state.busy&&!bootInProgress')

    def recovery(self):
        self.request_reset();self.assertTrue(self.password_requests)
        self.page.goto(self.base+'?code=fake-valid-code#reset-password');self.page.wait_for_selector('#password-reset-form');self.page.wait_for_function('()=>!bootInProgress&&!state.busy')

    def test_history_search_by_name_without_accent_and_by_brazilian_or_iso_date(self):
        self.fixtures();self.history()
        self.apply(query='familia');self.assertIn('1 de 2 cultos',self.page.locator('.history-context').inner_text())
        self.assertNotIn('Culto 24 horas',self.page.locator('#history-results').inner_text())
        for date in ('10/10/2026','2026-10-10','10/2026'):
            self.apply(query=date);self.assertIn('Culto 24 horas',self.page.locator('#history-results').inner_text());self.assertNotIn('Culto da Família',self.page.locator('#history-results').inner_text())

    def test_combined_period_and_search_inclusive_limits(self):
        self.fixtures();self.history();self.apply(query='culto',start='10/10/2026',end='10/10/2026')
        self.assertIn('1 de 2 cultos',self.page.locator('.history-context').inner_text());self.assertIn('10/10/2026 a 10/10/2026',self.page.locator('.history-context').inner_text())
        self.apply(query='familia',start='01/10/2026',end='31/10/2026');self.assertIn('Nenhum culto corresponde',self.page.locator('#history-results').inner_text())
        self.assertEqual(self.page.locator('.adherence-section').count(),0)

    def test_clear_filters_restores_all_and_keyboard_focus(self):
        self.fixtures();self.history();self.apply(query='INEXISTENTE',start='01/10/2026')
        self.page.locator('[data-action="history-clear"]').click()
        self.assertIn('2 de 2 cultos',self.page.locator('.history-context').inner_text())
        self.assertEqual(self.page.evaluate('document.activeElement.name'),'history-query')
        self.assertEqual(self.page.locator('[name="history-from"]').input_value(),'')

    def test_live_search_keeps_input_focus_and_updates_filtered_metrics(self):
        self.fixtures();self.history();self.page.locator('[name="history-query"]').fill('Família')
        self.page.wait_for_function('()=>document.querySelector(".history-context").textContent.includes("1 de 2")')
        self.assertEqual(self.page.evaluate('document.activeElement.name'),'history-query')
        self.assertIn('0 considerados e 1 desconsiderados',self.page.locator('.history-context').inner_text())
        self.assertIn('Dados insuficientes',self.page.locator('.adherence-section').inner_text())
        self.assertNotIn('NaN',self.page.locator('#history-results').inner_text())

    def test_filtered_metrics_equal_single_cult_and_preserve_all_documents(self):
        self.fixtures();before=copy.deepcopy(self.records);self.history();self.apply(query='10/10/2026')
        self.assertIn('1 considerados e 0 desconsiderados',self.page.locator('.history-context').inner_text())
        metric=self.page.evaluate('()=>endStatistics(IASDPIHistory.filter(state.programs,{query:"10/10/2026",from:"",to:""}).rows)')
        self.assertEqual(metric['considered'],1);self.assertEqual(metric['excluded'],0)
        self.assertEqual(self.records,before)

    def test_invalid_period_is_not_used_to_display_positive_metrics(self):
        self.history();self.apply(start='31/02/2026')
        self.assertIn('indicadores não foram calculados',self.page.locator('#history-results').inner_text())
        self.assertEqual(self.page.locator('.adherence-section').count(),0)
        self.apply(start='20/10/2026',end='10/10/2026');self.assertIn('anterior',self.page.locator('#history-results').inner_text())

    def test_empty_history_distinguished_from_no_match(self):
        self.records={};self.open();self.login();self.page.wait_for_function('()=>!state.busy&&!bootInProgress&&IASDPIAuth.allowed()')
        self.page.evaluate('navigate("history")');self.assertIn('Ainda não há programações finalizadas',self.page.locator('#history-results').inner_text())
        self.assertIn('0 de 0 cultos',self.page.locator('.history-context').inner_text())

    def test_history_loading_failure_and_retry_keep_filters(self):
        self.history();self.apply(query='24 horas');self.fail_list=True
        self.page.evaluate('void guarded(()=>loadPrograms({renderState:true}))');self.page.wait_for_selector('[data-load-state="error"]');self.page.wait_for_function('()=>!state.busy')
        self.assertNotIn('Nenhum culto corresponde',self.page.locator('#app').inner_text())
        self.fail_list=False;self.page.locator('[data-action="retry-programs"]').click();self.page.wait_for_selector('#history-filters')
        self.assertEqual(self.page.locator('[name="history-query"]').input_value(),'24 horas')
        self.assertIn('1 de 1 cultos',self.page.locator('.history-context').inner_text())

    def test_history_filters_survive_back_forward_without_mutating_a_draft(self):
        self.fixtures();self.history();self.apply(query='Família');self.page.evaluate('navigate("programs")')
        self.page.go_back();self.page.wait_for_selector('#history-filters');self.assertEqual(self.page.locator('[name="history-query"]').input_value(),'Família')
        self.assertIn('1 de 2 cultos',self.page.locator('.history-context').inner_text())

    def test_history_escapes_search_and_handles_invalid_saved_dates(self):
        self.records['clock-fixture']['plan']['date']='data-inválida';self.history();self.apply(query='<img src=x onerror=alert(1)>')
        self.assertEqual(self.page.locator('#app img').count(),0)
        self.page.locator('[data-action="history-clear"]').click();self.assertIn('1 cultos com data inconsistente',self.page.locator('.history-context').inner_text())
        self.apply(start='01/10/2026');self.assertIn('Nenhum culto corresponde',self.page.locator('#history-results').inner_text())

    def test_forgot_link_and_generic_success_for_known_and_unknown_email(self):
        self.open('#login');self.page.locator('[data-auth-page="forgot-password"]').click();self.page.wait_for_selector('#password-request-form')
        self.request_reset();message=self.page.locator('.password-feedback').inner_text();self.assertIn('Se o e-mail estiver cadastrado',message)
        self.reset_unknown=True;self.page.clock.install();self.page.clock.fast_forward(61000)
        self.page.locator('[name="email"]').fill('unknown@example.invalid');self.page.locator('#password-request-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('.password-feedback').inner_text(),message)
        self.assertEqual(self.password_updates,[])

    def test_password_request_uses_pkce_current_origin_and_no_external_redirect(self):
        self.request_reset();body=self.password_requests[0]
        self.assertIn('code_challenge',body);self.assertEqual(body['code_challenge_method'],'s256')
        url=self.page.evaluate('IASDPIAuth.config().url');self.assertTrue(url.startswith('https://'))
        # redirect_to é conferido na URL real da requisição, não por configuração fornecida por query string.
        self.assertTrue(self.page.evaluate('location.hash==="#forgot-password"'))
        redirect=urlsplit(self.password_redirects[0]);baseurl=urlsplit(self.base)
        self.assertEqual((redirect.scheme,redirect.netloc,redirect.path),(baseurl.scheme,baseurl.netloc,baseurl.path));self.assertEqual(redirect.fragment,'reset-password')
        self.assertNotIn('password',body)

    def test_password_link_consumed_and_new_password_not_stored(self):
        before=copy.deepcopy(self.records);self.recovery();self.assertEqual(len(self.pkce_attempts),1)
        self.assertNotIn('code=',self.page.url);self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.page.locator('[name="password"]').fill('Nova-senha-teste-123');self.page.locator('[name="repeat"]').fill('Nova-senha-teste-123')
        self.page.locator('#password-reset-form button').click();self.page.wait_for_selector('#auth-login-form');self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(len(self.password_updates),1);self.assertEqual(self.records,before)
        self.assertNotIn('Nova-senha-teste-123',self.page.evaluate('JSON.stringify({...localStorage,...sessionStorage})'))
        self.assertIn('Senha redefinida',self.page.locator('#notice').inner_text())

    def test_password_mismatch_and_short_password_do_not_call_update(self):
        self.recovery();self.page.locator('[name="password"]').fill('senha-curta');self.page.locator('[name="repeat"]').fill('senha-curta')
        self.page.locator('#password-reset-form button').click();self.assertEqual(self.password_updates,[])
        self.page.locator('[name="password"]').fill('Senha-segura-123456');self.page.locator('[name="repeat"]').fill('Outra-segura-12345')
        self.page.locator('#password-reset-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('iguais',self.page.locator('.field-error').inner_text());self.assertEqual(self.password_updates,[])

    def test_expired_or_invalid_link_shows_request_again_and_cleans_url(self):
        self.request_reset();self.code_invalid=True
        self.page.goto(self.base+'?code=invalid&error_code=otp_expired#reset-password');self.page.wait_for_function('()=>!bootInProgress')
        self.assertEqual(self.page.locator('#password-reset-form').count(),0);self.assertIn('inválido',self.page.locator('#app').inner_text())
        self.assertNotIn('code=',self.page.url);self.assertEqual(self.password_updates,[])

    def test_server_rejects_pkce_link_without_exposing_provider_error(self):
        self.request_reset();self.code_invalid=True;self.page.goto(self.base+'?code=spent-code#reset-password');self.page.wait_for_function('()=>!bootInProgress')
        self.assertIn('já utilizado ou expirado',self.page.locator('#app').inner_text());self.assertNotIn('spent-code',self.page.locator('#app').inner_text())
        self.assertEqual(self.page.locator('#password-reset-form').count(),0)

    def test_missing_verifier_or_ordinary_login_cannot_open_reset_form(self):
        self.page.goto(self.base+'?code=someone-elses-code#reset-password');self.page.wait_for_function('()=>!bootInProgress')
        self.assertEqual(self.page.locator('#password-reset-form').count(),0);self.assertEqual(self.pkce_attempts,[])
        self.page.evaluate('navigate("login")');self.login();self.page.wait_for_function('()=>IASDPIAuth.allowed()&&!state.busy&&!bootInProgress')
        self.page.evaluate('navigate("reset-password")');self.assertEqual(self.page.locator('#password-reset-form').count(),0)

    def test_recovery_session_survives_reload_without_manual_tokens(self):
        self.recovery();self.page.reload();self.page.wait_for_selector('#password-reset-form');self.page.wait_for_function('()=>!bootInProgress')
        marker=self.page.evaluate('JSON.parse(sessionStorage.getItem(IASDPIStorage.authSession+":password-recovery-v1"))')
        self.assertEqual(set(marker),{'uid','until'});self.assertEqual(len(self.pkce_attempts),1)
        self.assertEqual(self.password_updates,[])

    def test_recovery_does_not_authorize_nonmember(self):
        self.role=None;self.recovery();self.assertFalse(self.page.evaluate('IASDPIAuth.allowed()'))
        self.page.evaluate('navigate("history")');self.assertEqual(self.page.locator('#history-filters').count(),0)
        self.assertEqual(self.model_writes,[]);self.assertEqual(self.records['clock-fixture'],self.original)

    def test_password_request_does_not_replace_authenticated_session(self):
        self.enter();before=self.page.evaluate('IASDPIAuth.session().access_token')
        self.page.evaluate('navigate("forgot-password")');self.page.locator('[name="email"]').fill('test@example.invalid');self.page.locator('#password-request-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.evaluate('IASDPIAuth.session().access_token'),before)
        self.assertTrue(self.page.evaluate('IASDPIAuth.allowed()'))

    def test_password_request_network_error_and_rate_limit_do_not_claim_sent(self):
        self.reset_rate=True;self.request_reset();self.assertIn('Aguarde',self.page.locator('.form-error').inner_text())
        self.assertEqual(self.page.locator('.password-feedback').inner_text(),'')
        self.page.clock.install();self.page.clock.fast_forward(61000);self.reset_rate=False;self.reset_fail=True
        self.page.locator('[name="email"]').fill('test@example.invalid');self.page.locator('#password-request-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('Não foi possível',self.page.locator('.form-error').inner_text());self.assertEqual(self.page.locator('.password-feedback').inner_text(),'')

    def test_expired_recovery_session_cannot_update_password(self):
        self.recovery();self.update_fail=True
        self.page.locator('[name="password"]').fill('Senha-segura-123456');self.page.locator('[name="repeat"]').fill('Senha-segura-123456')
        self.page.locator('#password-reset-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('#password-reset-form').count(),0);self.assertIn('expirado',self.page.locator('#app').inner_text())
        self.assertEqual(len(self.password_updates),1)

    def test_models_admin_access_reuses_existing_form_and_rpc(self):
        self.enter();self.page.evaluate('navigate("programs")');self.page.locator('[data-action="models-open"]').click();self.page.wait_for_selector('#operational-template-form');self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.evaluate('location.hash'),'#models');self.assertEqual(self.page.locator('#operational-template-form').count(),1)
        form=self.page.locator('#operational-template-form');form.locator('[name="model-id"]').fill('liturgia-nova');form.locator('[name="model-name"]').fill('Modelo de teste')
        form.locator('[type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(len(self.model_writes),1);self.assertEqual(self.model_writes[0]['p_id'],'liturgia-nova')
        self.assertEqual(self.model_writes[0]['p_expected_version'],0);self.assertEqual(len(self.records),1)
        self.page.evaluate('navigate("archive")');self.assertEqual(self.page.locator('#operational-template-form').count(),1)

    def test_models_leader_denied_and_admin_direct_link_available(self):
        self.role='leader';self.open();self.login();self.page.wait_for_function('()=>IASDPIAuth.allowed()&&!state.busy&&!bootInProgress')
        self.page.evaluate('navigate("models")');self.assertEqual(self.page.locator('#operational-template-form').count(),0)
        self.assertIn('Acesso restrito',self.page.locator('#app').inner_text());self.assertFalse(self.page.locator('nav [data-page="models"]').is_visible())
        self.role='admin';self.page.reload();self.page.wait_for_selector('#operational-template-form');self.assertEqual(self.page.evaluate('location.hash'),'#models')

    def test_models_updating_id_uses_version_and_confirmation_without_new_registration(self):
        self.enter();self.page.evaluate('navigate("models")');form=self.page.locator('#operational-template-form')
        form.locator('[name="model-id"]').fill('liturgy-i');form.locator('[name="model-name"]').fill('Nome atualizado')
        self.page.once('dialog',lambda d:d.dismiss());form.locator('[type="submit"]').click();self.page.wait_for_function('()=>!state.busy');self.assertEqual(self.model_writes,[])
        self.page.once('dialog',lambda d:d.accept());form.locator('[type="submit"]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(len(self.models),2);self.assertEqual(self.model_writes[0]['p_expected_version'],1);self.assertEqual(len(self.records),1)

    def test_manual_communication_source_not_marked_officially_synced(self):
        self.open('#agendas');self.page.select_option('#agenda-area','communication')
        source=self.page.locator('[data-source="manual"]').inner_text()
        self.assertIn('escala manual de Comunicação',source);self.assertIn('Última atualização da escala: não informada',source)
        self.assertIn('03/10/2026 a 31/10/2026',source);self.assertNotIn('Fonte oficial consultada',source)
        self.assertEqual(self.page.locator('[data-source="official"]').count(),0)

    def test_official_agenda_and_elders_show_snapshot_origin_and_period(self):
        self.open('#agendas');source=self.page.locator('[data-source="official"]').inner_text()
        self.assertIn('Google Calendar',source);self.assertIn('Período importado',source);self.assertIn('cópia publicada',source)
        self.assertIn('Fonte oficial consultada',source);self.page.select_option('#agenda-area','elders')
        self.assertEqual(self.page.locator('[data-source="official"]').count(),1)

    def test_empty_sound_schedule_has_no_invented_update_or_validity(self):
        self.open('#agendas');self.page.evaluate('ministrySchedules.Sonoplastia=[]');self.page.select_option('#agenda-area','sound')
        source=self.page.locator('[data-source="manual"]').inner_text()
        self.assertIn('não definida; nenhuma escala cadastrada',source);self.assertIn('não informada',source)
        self.assertNotIn('Fonte oficial consultada',source)

    def test_new_pages_fit_mobile_and_labels_keyboard_accessible(self):
        self.history()
        for route in ('history','models','forgot-password','reset-password','agendas'):
            self.page.evaluate('(page)=>navigate(page)',route)
            for width in (360,390,768,1024,1440):
                self.page.set_viewport_size({'width':width,'height':900});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width,(route,width))
        self.page.evaluate('navigate("history")');self.page.get_by_role('searchbox',name='Pesquisar por nome ou data').focus()
        self.page.keyboard.press('Tab');self.assertEqual(self.page.evaluate('document.activeElement.name'),'history-from')

    def test_password_recovery_error_fragment_and_implicit_tokens_cleaned(self):
        for fragment in ('error=access_denied&error_code=otp_expired','access_token=fake-private&refresh_token=fake-refresh&type=recovery'):
            self.page.goto(self.base+'#'+fragment);self.page.wait_for_function('()=>!bootInProgress')
            self.assertEqual(urlsplit(self.page.url).fragment,'reset-password')
            self.assertEqual(self.page.locator('#password-reset-form').count(),0)
            self.assertNotIn('fake-private',self.page.locator('#app').inner_text())
        self.assertEqual(self.password_updates,[])

    def test_duplicate_or_empty_callback_codes_are_rejected_and_removed(self):
        self.request_reset();self.page.goto(self.base+'?code=&code=secret-fake#reset-password');self.page.wait_for_function('()=>!bootInProgress')
        self.assertEqual(self.page.locator('#password-reset-form').count(),0);self.assertNotIn('code=',self.page.url)
        self.assertEqual(self.pkce_attempts,[])

    def test_recovery_request_in_readonly_preview_is_blocked(self):
        self.open('#forgot-password');self.page.wait_for_selector('#password-request-form')
        self.page.evaluate('window.IASDPIConfig=Object.freeze({...IASDPIConfig,remoteReadOnly:true})')
        self.page.locator('[name="email"]').fill('test@example.invalid');self.page.locator('#password-request-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertIn('bloqueado',self.page.locator('.form-error').inner_text());self.assertEqual(self.password_requests,[])

    def test_request_cooldown_and_malicious_redirect_query(self):
        self.page.goto(self.base+'?redirect_to=https://example.invalid/evil#forgot-password');self.page.wait_for_selector('#password-request-form')
        form=self.page.locator('#password-request-form');form.locator('[name="email"]').fill('test@example.invalid');form.locator('button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertNotIn('example.invalid/evil',self.password_redirects[0]);self.assertEqual(urlsplit(self.password_redirects[0]).query,'')
        form.locator('[name="email"]').fill('test@example.invalid');form.locator('button').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(len(self.password_requests),1);self.assertIn('um minuto',self.page.locator('.form-error').inner_text())

    def test_history_loading_state_never_shows_zero_metrics(self):
        self.history();self.hold_list=True;self.page.evaluate('void loadPrograms({renderState:true})')
        self.page.wait_for_selector('[data-load-state="loading"]');self.assertEqual(self.page.locator('.adherence-section').count(),0)
        self.hold_list=False
        for route in self.held:route.fulfill(json=[{'document':p} for p in self.records.values()])
        self.page.wait_for_selector('#history-filters');self.assertIn('1 de 1 cultos',self.page.locator('.history-context').inner_text())

    def test_formatter_reuse_keeps_timezone_fraction_and_dst(self):
        self.enter();result=self.page.evaluate('''()=>['2018-01-20T12:30:12.123456Z','2026-10-10T12:30:12.654321Z','horário inválido'].map(value=>({value,parsed:inspectRecordTime(value)}))''')
        self.assertEqual(result[0]['parsed']['clock'],'10:30:12.123456');self.assertEqual(result[1]['parsed']['clock'],'09:30:12.654321');self.assertFalse(result[2]['parsed']['valid'])
        self.assertEqual(self.records['clock-fixture'],self.original)

    def test_models_rpc_rejects_forged_leader_submission(self):
        self.role='leader';self.open();self.login();self.page.wait_for_function('()=>IASDPIAuth.allowed()&&!bootInProgress&&!state.busy')
        result=self.page.evaluate('''async()=>{const f=document.createElement('form');f.innerHTML='<input name="model-id" value="forged"><input name="model-name" value="Indevido"><input name="program-id" value="clock-fixture">';try{await IASDPIOperational.saveTemplate(f);return 'allowed';}catch(e){return e.message;}}''')
        self.assertIn('administrativo',result);self.assertEqual(self.model_writes,[])

    def test_z_growing_history_performance_with_paginated_reads_and_fake_data(self):
        from datetime import date,datetime,time,timedelta
        from zoneinfo import ZoneInfo
        from pathlib import Path
        self.enter();results=[];zone=ZoneInfo('America/Sao_Paulo')
        for n in (10,100,500,1000):
            fixtures={}
            for index in range(n):
                p=copy.deepcopy(self.original);p['id']=f'performance-{index:05d}';p['plan']['name']=f'Culto desempenho {index:05d}';day=date(2010,1,2)+timedelta(days=index*7);p['plan']['date']=day.isoformat()
                for object_,keys in [(p,('planned_start','planned_end')),*[(item,('planned_start','planned_end')) for item in p['plan']['items']],*[(execution,('started','ended')) for execution in p['executions'].values()]]:
                    for key in keys:
                        if object_.get(key):
                            clock=datetime.fromisoformat(object_[key]).astimezone(zone).time();object_[key]=datetime.combine(day,clock,zone).isoformat()
                fixtures[p['id']]=p
            self.records=fixtures
            measurement=self.page.evaluate('''async(n)=>{
              let start=performance.now();await loadPrograms();const load=performance.now()-start;
              const sample={query:'desempenho',from:'',to:''};const timing=[];
              for(let i=0;i<3;i++){start=performance.now();const r=IASDPIHistory.filter(state.programs,sample);const filtering=performance.now()-start;
                start=performance.now();const metrics={ends:endStatistics(r.rows),adherence:r.rows.map(adherence),medians:activityMedians(r.rows),transitions:r.rows.flatMap(transitions)};const calculation=performance.now()-start;
                timing.push({filter_ms:filtering,calculation_ms:calculation,considered:metrics.ends.considered});}
              start=performance.now();const html=adherenceOverview(state.programs);const overview=performance.now()-start;
              const drawStart=performance.now();navigate('history',undefined,{refresh:true});const applyRender=performance.now()-drawStart;
              return {n,activities:n*16,load_ms:load,runs:timing,overview_html_ms:overview,apply_and_render_ms:applyRender,loaded:state.programs.length,html_chars:html.length,document_width:document.documentElement.scrollWidth,viewport:innerWidth};}''',n)
            self.assertEqual(measurement['loaded'],n);self.assertEqual(len(self.records),n)
            self.assertTrue(all(run['considered']==n for run in measurement['runs']))
            self.assertTrue(all(run['filter_ms']<2000 for run in measurement['runs']))
            self.assertLessEqual(measurement['document_width'],measurement['viewport']);results.append(measurement)
            self.page.evaluate('navigate("organization")')
        out=Path(base.ROOT/'dist/lote5');out.mkdir(parents=True,exist_ok=True)
        (out/'performance.json').write_text(json.dumps({'environment':'Chromium headless; REST mock local; dados fictícios; três amostras de filtros/cálculos por volume; carregamento e renderização com uma amostra','results':results},ensure_ascii=False,indent=2))

    def test_invalid_recovery_fragment_preserves_existing_authenticated_session(self):
        self.enter();before=self.page.evaluate('IASDPIAuth.session().access_token')
        self.page.goto(self.base+'#error=access_denied&error_code=otp_expired');self.page.wait_for_function('()=>state.page==="reset-password"')
        self.assertTrue(self.page.evaluate('IASDPIAuth.allowed()'));self.assertEqual(self.page.evaluate('IASDPIAuth.session().access_token'),before)
        self.assertEqual(self.password_updates,[])

    def test_recovery_navigation_preserves_unsaved_registration_draft(self):
        self.enter();self.page.evaluate('navigate("actuals","clock-fixture")');self.page.locator('[name="note"]').fill('RASCUNHO PRESERVADO')
        self.page.once('dialog',lambda d:d.dismiss());self.page.evaluate('navigate("forgot-password")')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'RASCUNHO PRESERVADO')
        self.page.once('dialog',lambda d:d.accept());self.page.evaluate('navigate("forgot-password")')
        self.page.locator('[name="email"]').fill('test@example.invalid');self.page.locator('#password-request-form button').click();self.page.wait_for_function('()=>!state.busy')
        self.page.go_back();self.page.wait_for_selector('[data-draft-restore]');self.page.locator('[data-draft-restore]').click();self.page.wait_for_function('()=>!state.busy')
        self.assertEqual(self.page.locator('[name="note"]').input_value(),'RASCUNHO PRESERVADO');self.assertEqual(self.records['clock-fixture'],self.original)
