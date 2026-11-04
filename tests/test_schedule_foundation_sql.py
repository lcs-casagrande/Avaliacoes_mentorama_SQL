"""Fase A: PostgreSQL real isolado, sem conexão com produção."""
import json
import subprocess
import unittest
import uuid
import test_user_management_sql as base

D='a0000000-0000-4000-8000-000000000001'
E='a0000000-0000-4000-8000-000000000002'

@unittest.skipUnless(base.CONTAINER, 'Requer PostgreSQL descartável sem rede')
class ScheduleFoundationSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    def setUp(self):
        base.UserManagementSQLTests.setUp(self)
        for name in ['003_operational_storage.sql','004_culto_trash.sql','005_schedule_foundation.sql']:
            self.sql((base.ROOT/'database'/name).read_text())
    def call(self,entity,data,actor=base.A,id=None,version=0,request=None,fail=False):
        query="select public.iasdpi_schedule_save('%s','%s',%s,'%s'::jsonb,'%s')"%(entity,id or uuid.uuid4(),version,json.dumps(data).replace("'","''"),request or uuid.uuid4())
        raw=self.sql(query,actor=actor,fail=fail)
        return None if fail else json.loads(raw)
    def catalog(self,actor=base.A):return json.loads(self.sql('select public.iasdpi_schedule_catalog()',actor=actor))
    def person(self,name='Pessoa fictícia',**kwargs):return self.call('person',dict(name=name,display_name=name,department_id=D),**kwargs)
    def grant(self,actor=base.L,dept=D,level='manager'):
        return self.call('access',dict(department_id=dept,user_id=actor,access_level=level))
    def test_initial_departments_only_no_assumed_roles_or_people(self):
        c=self.catalog();self.assertEqual({d['code'] for d in c['departments']},{'sonoplastia','diaconato','musica','ancionato'})
        for key in ['people','roles','memberships','qualifications','availability','access']:self.assertEqual(c[key],[])
    def test_legacy_objects_preserved(self):
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'),self.before_access)
    def test_anonymous_unapproved_and_global_leader_denied(self):
        for actor in [base.L,base.U,base.X,base.N]:self.sql('select public.iasdpi_schedule_catalog()',actor=actor,fail=True)
        self.sql('select public.iasdpi_schedule_catalog()',anonymous=True,fail=True)
    def test_no_direct_table_or_private_function_access(self):
        for actor in [base.A,base.L,base.U]:
            for table in ['departments','people','memberships','roles','qualifications','availability','department_access']:
                self.sql('select * from public.schedule_'+table,actor=actor,fail=True)
                self.sql('delete from public.schedule_'+table,actor=actor,fail=True)
            self.sql('select iasdpi_schedule_private.actor()',actor=actor,fail=True)
            self.sql('select * from iasdpi_schedule_private.person_details',actor=actor,fail=True)
    def test_rls_owner_search_path_and_acl(self):
        self.assertEqual(self.sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' and c.relname like 'schedule_%' or n.nspname='iasdpi_schedule_private') and c.relkind='r' and not c.relrowsecurity"),'0')
        self.assertEqual(self.sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'iasdpi_schedule_%' and (p.proowner<>'postgres'::regrole or not p.prosecdef or not ('search_path=\"\"'=any(p.proconfig)))"),'0')
    def test_multiple_departments_and_qualifications(self):
        p=self.person();r=self.call('role',dict(department_id=E,name='Diácono'))
        m=self.call('membership',dict(person_id=p['id'],department_id=E,role_ids=[r['id']]))
        c=self.catalog();self.assertEqual(len(c['memberships']),2);self.assertEqual(c['qualifications'][0]['membership_id'],m['id'])
    def test_cross_department_qualification_rejected_atomically(self):
        p=self.person();m=self.catalog()['memberships'][0];r=self.call('role',dict(department_id=E,name='Diaconisa'))
        self.call('membership',dict(role_ids=[r['id']]),id=m['id'],version=1,fail=True)
        self.assertEqual(self.catalog()['memberships'][0]['version'],1)
    def test_rafa_and_raphael_are_distinct_no_auto_merge(self):
        self.person('Rafa');self.person('Raphael');self.assertEqual(len(self.catalog()['people']),2)
    def test_duplicate_names_need_explicit_admin_homonym_reason(self):
        self.person('José Silva');self.person('  JOSE SILVA  ',fail=True)
        self.person('Jose Silva',fail=True)
        data=dict(name='Jose Silva',display_name='José 2',confirm_homonym=True,reason='Pessoa distinta confirmada pela liderança.')
        self.call('person',data);self.assertEqual(len(self.catalog()['people']),2)
    def test_manager_scope_and_shared_identity_protection(self):
        self.grant();p=self.person(actor=base.L)
        self.call('person',dict(name='Renomear'),actor=base.L,id=p['id'],version=1,fail=True)
        self.call('role',dict(department_id=E,name='Diácono'),actor=base.L,fail=True)
        self.call('role',dict(department_id=D,name='Áudio'),actor=base.L)
        self.assertEqual(len(self.catalog(base.L)['departments']),1)
    def test_managers_cannot_grant_privileges_or_link_auth(self):
        self.grant()
        self.call('access',dict(department_id=D,user_id=base.U,access_level='manager'),actor=base.L,fail=True)
        self.call('person',dict(name='Alguém',display_name='Alguém',department_id=D,auth_user_id=base.L),actor=base.L,fail=True)
        self.call('person',dict(name='Alguém',display_name='Alguém',department_id=D,role='admin'),fail=True)
    def test_viewer_is_read_only_and_private_data_redacted(self):
        self.grant(base.U,level='viewer');p=self.person()
        self.call('person',dict(contact='privado',notes='privado',auth_user_id=base.V),id=p['id'],version=1)
        m=self.catalog()['memberships'][0];self.call('membership',dict(preferences='privado'),id=m['id'],version=1)
        c=self.catalog(base.U);self.assertNotIn('privado',json.dumps(c));self.assertNotIn('auth_user_id',c['people'][0])
        self.sql("select public.iasdpi_schedule_person_details('%s')"%p['id'],actor=base.U,fail=True)
        self.person('Nova pessoa',actor=base.U,fail=True)
    def test_participant_only_self_and_no_global_culto_access(self):
        p=self.person();self.person('Outra pessoa')
        self.call('person',dict(auth_user_id=base.U),id=p['id'],version=1)
        c=self.catalog(base.U);self.assertEqual([r['id'] for r in c['people']],[p['id']]);self.assertEqual(len(c['memberships']),1)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.U),'0')
        self.sql("select public.iasdpi_save_program('forbidden',0,'{}',gen_random_uuid())",actor=base.U,fail=True)
    def test_global_revocation_overrides_department_grant(self):
        self.grant();self.catalog(base.L)
        self.sql("select public.iasdpi_set_access('%s','leader',false)"%base.L,actor=base.A)
        self.sql('select public.iasdpi_schedule_catalog()',actor=base.L,fail=True)
        self.person(actor=base.L,fail=True)
    def test_access_cannot_target_unconfirmed_accounts(self):
        self.call('access',dict(department_id=D,user_id=base.N,access_level='manager'),fail=True)
    def test_partial_updates_preserve_private_data_and_identity(self):
        p=self.person();self.call('person',dict(contact='telefone privado',notes='nota'),id=p['id'],version=1)
        self.call('person',dict(display_name='Exibição alterada'),id=p['id'],version=2)
        details=json.loads(self.sql("select public.iasdpi_schedule_person_details('%s')"%p['id'],actor=base.A))
        self.assertEqual(details['contact'],'telefone privado');self.assertEqual(details['notes'],'nota')
        self.assertEqual(len(self.catalog()['people']),1)
    def test_idempotent_request_and_stale_version(self):
        p=self.person();req=str(uuid.uuid4());data={'display_name':'Nova exibição'}
        a=self.call('person',data,id=p['id'],version=1,request=req)
        b=self.call('person',data,id=p['id'],version=1,request=req);self.assertEqual(a,b)
        self.call('person',dict(name='Antigo'),id=p['id'],version=1,fail=True)
        self.call('person',dict(name='Fraude'),id=p['id'],version=2,request=req,fail=True)
    def test_availability_period_weekly_and_integrity(self):
        p=self.person();base_data=dict(person_id=p['id'],department_id=D,kind='unavailable')
        self.call('availability',dict(base_data,pattern='period',starts_on='2026-10-28',ends_on='2026-11-01'))
        self.call('availability',dict(base_data,pattern='weekly',weekdays=[0,3,6],start_time='09:30',end_time='11:30'))
        for data in [dict(pattern='period',starts_on='2026-10-28'),dict(pattern='weekly',weekdays=[]),dict(pattern='weekly',weekdays=[6,6]),dict(pattern='weekly',weekdays=[7]),dict(pattern='period',starts_on='2026-10-28',ends_on='2026-10-27'),dict(pattern='weekly',weekdays=[6],start_time='11:00',end_time='09:00')]:
            self.call('availability',dict(base_data,**data),fail=True)
        self.assertEqual(len(self.catalog()['availability']),2)
    def test_membership_zero_is_not_missing_and_limits_consistent(self):
        self.person();m=self.catalog()['memberships'][0]
        self.call('membership',dict(desired_monthly_count=0,max_monthly_count=0),id=m['id'],version=1)
        self.call('membership',dict(desired_monthly_count=5,max_monthly_count=1),id=m['id'],version=2,fail=True)
        self.assertEqual(self.catalog()['memberships'][0]['desired_monthly_count'],0)
    def test_existing_membership_cannot_move_department(self):
        self.person();m=self.catalog()['memberships'][0]
        self.call('membership',dict(department_id=E),id=m['id'],version=1,fail=True)
    def test_down_empty_installation_preserves_existing_tables(self):
        self.sql((base.ROOT/'database/005_schedule_foundation_down.sql').read_text())
        self.assertEqual(self.sql("select to_regclass('public.schedule_people') is null"),'t')
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)
    def test_down_refuses_any_user_data(self):
        self.person();self.sql((base.ROOT/'database/005_schedule_foundation_down.sql').read_text(),fail=True)
        self.assertEqual(len(self.catalog()['people']),1)
    def test_audit_does_not_copy_contacts(self):
        self.call('person',dict(name='Privado',display_name='Privado',contact='SEGREDO-CONTATO',notes='SEGREDO-NOTA'))
        audit=self.sql('select row_to_json(a) from iasdpi_schedule_private.audit_logs a')
        self.assertNotIn('SEGREDO',audit);self.assertIn('contact',audit)
    def test_manager_create_retry_is_idempotent(self):
        self.grant();identifier=str(uuid.uuid4());req=str(uuid.uuid4())
        p=self.person(actor=base.L,id=identifier,request=req)
        repeat=self.person(actor=base.L,id=identifier,request=req)
        self.assertEqual(p,repeat);self.assertEqual(len(self.catalog()['people']),1)
    def test_concurrent_updates_one_winner(self):
        from concurrent.futures import ThreadPoolExecutor
        p=self.person()
        def attempt(name):
            query="select public.iasdpi_schedule_save('person','%s',1,'%s',gen_random_uuid())"%(p['id'],json.dumps({'display_name':name}))
            return subprocess.run(self.exec+['-d',self.db],input=self.command(query,base.A),text=True,capture_output=True,env=self.env)
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(attempt,['Concorrente A','Concorrente B']))
        self.assertEqual(sum(r.returncode==0 for r in results),1)
        self.assertTrue(any('mudou em outro dispositivo' in r.stderr for r in results))
        self.assertEqual(self.catalog()['people'][0]['version'],2)
    def test_revocation_during_pending_write_is_respected(self):
        self.grant()
        source="begin;update iasdpi_admin_private.control set revision=revision+1 where singleton;update public.schedule_department_access set enabled=false where user_id='%s';select 'locked';select pg_sleep(1);commit;"%base.L
        proc=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env)
        proc.stdin.write(source);proc.stdin.close()
        self.assertEqual(proc.stdout.readline().strip(),'locked')
        self.person('Não deve gravar',actor=base.L,fail=True)
        self.assertEqual(proc.wait(timeout=5),0)
        proc.stdout.close();proc.stderr.close()
        self.assertEqual(len(self.catalog()['people']),0)
    def test_used_receipt_cannot_bypass_revoked_permission(self):
        grant=self.grant();req=str(uuid.uuid4());p=self.person(actor=base.L,request=req)
        self.call('access',dict(enabled=False),id=grant['id'],version=1)
        self.person(actor=base.L,id=p['id'],request=req,fail=True)
    def test_down_handles_old_operational_receipts_without_touching_them(self):
        self.sql("insert into iasdpi_operational_private.receipts values(gen_random_uuid(),'%s',repeat('a',64),'{}',now())"%base.A)
        self.sql((base.ROOT/'database/005_schedule_foundation_down.sql').read_text())
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.receipts'),'1')
    def test_installation_is_not_reapplied_over_existing_module(self):
        p=self.person();self.sql((base.ROOT/'database/005_schedule_foundation.sql').read_text(),fail=True)
        self.assertEqual(self.catalog()['people'][0]['id'],p['id'])
    def test_manager_cannot_hijack_global_availability(self):
        self.grant();p=self.person()
        rule=self.call('availability',dict(person_id=p['id'],kind='unavailable',pattern='period',starts_on='2026-10-28',ends_on='2026-11-01'))
        self.call('availability',dict(department_id=D,active=False),id=rule['id'],version=1,actor=base.L,fail=True)
        self.assertIsNone(self.catalog()['availability'][0]['department_id'])
        self.assertTrue(self.catalog()['availability'][0]['active'])
    def test_manager_can_reactivate_own_inactive_membership(self):
        self.grant();self.person(actor=base.L);m=self.catalog(base.L)['memberships'][0]
        self.call('membership',dict(active=False),actor=base.L,id=m['id'],version=1)
        self.assertEqual(len(self.catalog(base.L)['memberships']),1)
        self.call('membership',dict(active=True),actor=base.L,id=m['id'],version=2)
        self.assertTrue(self.catalog(base.L)['memberships'][0]['active'])
    def test_readonly_installation_check_has_no_irregularities(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_schedule_foundation.sql').read_text()),'')
    def test_duplicate_department_and_role_names_rejected(self):
        self.call('department',dict(code='sonoplastia-outra',name='SONOPLASTIA'),fail=True)
        self.call('role',dict(department_id=D,name='Operador de áudio'))
        self.call('role',dict(department_id=D,name='OPERADOR DE AUDIO'),fail=True)
