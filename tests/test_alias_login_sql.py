"""G2: contas/aliases descartáveis em PostgreSQL --network none; nunca Supabase real."""
import json
import subprocess
import unittest
import uuid
import test_user_management_sql as base
import test_church_isolation_sql as g1

@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável sem rede')
class AliasLoginSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    sql=base.UserManagementSQLTests.sql
    command=g1.ChurchIsolationSQLTests.command
    rpc=g1.ChurchIsolationSQLTests.rpc
    quote=staticmethod(g1.ChurchIsolationSQLTests.quote)
    def setUp(self):
        self.church='IASD_PI';base.UserManagementSQLTests.setUp(self)
        self.sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN;END IF;END $$")
        for name in ['003_operational_storage.sql','004_culto_trash.sql']:self.sql((base.ROOT/'database'/name).read_text())
        if 'ministerial' in self._testMethodName:
            for name in ['005_schedule_foundation.sql','006_schedule_management.sql','007_daily_schedules.sql','008_monthly_rotation.sql','009_confirmed_schedule_conflicts.sql','010_simple_daily_schedules.sql']:self.sql((base.ROOT/'database'/name).read_text())
        self.sql((base.ROOT/'database/011_church_isolation.sql').read_text());self.users_before=self.sql('select count(*) from auth.users');self.access_before=self.sql('select jsonb_agg(to_jsonb(a) order by user_id) from public.iasdpi_access a')
        self.sql((base.ROOT/'database/012_alias_login.sql').read_text())
    def service(self,name,args,fail=False):
        def literal(value):
            if isinstance(value,list):return 'ARRAY['+','.join(self.quote(x) for x in value)+']::text[]'
            if isinstance(value,str):return self.quote(value)
            return str(value)
        call='select public.'+name+'('+','.join(map(literal,args))+')'
        query="begin;set local role service_role;set local request.jwt.claims='%s';set local request.headers='%s';%s;commit;"%(json.dumps({'role':'service_role'}),json.dumps({'x-iasdpi-church':self.church}),call)
        raw=self.sql(query,fail=fail);return None if fail or not raw else True if raw=='t' else False if raw=='f' else json.loads(raw)
    def bind(self,alias='sonoplastia',user=base.L,version=1,enabled=True,**kwargs):return self.rpc('iasdpi_alias_save',[alias,user,enabled,version,kwargs.pop('reason','')],**kwargs)
    def test_initial_identifiers_are_reserved_without_creating_users_or_changing_access(self):
        rows=self.rpc('iasdpi_alias_list',[]);self.assertEqual({r['identifier'] for r in rows},{'administrador','anciaos','sonoplastia','musica','diaconato','comunicacao'});self.assertTrue(all(r['user_id'] is None and not r['enabled'] for r in rows))
        self.assertEqual(self.sql('select count(*) from auth.users'),self.users_before);self.assertEqual(self.sql('select jsonb_agg(to_jsonb(a) order by user_id) from public.iasdpi_access a'),self.access_before)
        self.assertIsNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']))
        self.assertEqual(self.sql((base.ROOT/'database/check_church_isolation.sql').read_text()),'')
        self.assertEqual(self.sql((base.ROOT/'database/check_alias_login.sql').read_text()),'')
    def test_multiple_aliases_same_identity_never_change_role(self):
        self.bind('administrador');self.bind('sonoplastia');self.bind('musica');ids=[self.service('iasdpi_alias_login_lookup',[name])['user_id'] for name in ['administrador','sonoplastia','musica']];self.assertEqual(ids,[base.L]*3)
        self.assertEqual(self.sql("select role from public.iasdpi_access where user_id='%s'"%base.L),'leader');self.assertEqual(self.sql('select jsonb_agg(to_jsonb(a) order by user_id) from public.iasdpi_access a'),self.access_before)
    def test_public_and_admin_cannot_resolve_email_or_call_budget_service(self):
        self.bind()
        for role in [base.A,base.L,base.U]:
            for q in ["select public.iasdpi_alias_login_lookup('sonoplastia')","select public.iasdpi_alias_login_confirm(gen_random_uuid(),1,gen_random_uuid())","select public.iasdpi_alias_login_limit(ARRAY['global'])",'select * from iasdpi_admin_private.login_aliases','select * from iasdpi_login_private.budgets']:
                self.sql(q,actor=role,fail=True)
        self.sql("select public.iasdpi_alias_login_lookup('sonoplastia')",anonymous=True,fail=True)
        self.rpc('iasdpi_alias_list',[],actor=base.L,fail=True);self.bind(actor=base.L,fail=True)
    def test_unapproved_users_cannot_be_bound_or_auto_approve_themselves(self):
        self.bind(user=base.U,fail=True);self.bind(user=base.U,actor=base.U,fail=True);self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.U),'0')
    def test_stale_reassignment_requires_confirmation_and_old_version_is_not_accepted(self):
        row=self.bind();self.bind(user=base.A,version=2,fail=True);self.bind(user=base.A,version=1,reason='Motivo administrativo confirmado',fail=True)
        self.bind(user=base.A,version=2,reason='Motivo administrativo confirmado')
        self.assertFalse(self.service('iasdpi_alias_login_confirm',[row['id'],2,base.L]));self.assertTrue(self.service('iasdpi_alias_login_confirm',[row['id'],3,base.A]))
    def test_global_revocation_disables_lookup_even_when_alias_stays_enabled(self):
        self.bind();self.assertIsNotNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']));self.rpc('iasdpi_set_access',[base.L,'leader',False]);self.assertIsNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']))
    def test_church_header_cannot_use_another_church_alias_or_permissions(self):
        self.bind();self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente teste',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.B))
        self.church='TEST_ONLY';self.assertIsNone(self.service('iasdpi_alias_login_lookup',['sonoplastia']));self.bind(actor=base.A,fail=True)
        self.bind(user=base.B,version=0,actor=base.B);self.assertEqual(self.service('iasdpi_alias_login_lookup',['sonoplastia'])['user_id'],base.B)
        self.church='IASD_PI';self.assertEqual(self.service('iasdpi_alias_login_lookup',['sonoplastia'])['user_id'],base.L)
    def test_identifiers_generated_without_creating_duplicate_people_or_aliases(self):
        self.assertEqual(self.sql("select public.iasdpi_alias_identifier('Ministério da Família')",actor=base.A),'ministerio-da-familia');self.assertEqual(self.sql("select public.iasdpi_alias_identifier('Comunicação')",actor=base.A),'comunicacao')
        self.bind('familia.lider',version=0);self.bind('FAMILIA.LIDER',version=0,fail=True);self.assertEqual(self.sql('select count(*) from auth.users'),self.users_before)
    def test_ministerial_permissions_multiple_departments_remain_on_identity(self):
        for d in ['a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003']:
            self.rpc('iasdpi_schedule_save',['access',str(uuid.uuid4()),0,{'department_id':d,'user_id':base.U,'access_level':'manager','enabled':True},str(uuid.uuid4())])
        self.bind(user=base.U);self.bind('musica',user=base.U)
        catalog=self.rpc('iasdpi_schedule_catalog',[],actor=base.U);self.assertFalse(catalog['is_admin']);self.assertEqual(len([d for d in catalog['departments'] if d['can_manage']]),2)
        self.assertEqual(self.service('iasdpi_alias_login_lookup',['musica'])['user_id'],base.U);self.assertEqual(self.sql("select count(*) from public.iasdpi_access where user_id='%s'"%base.U),'0')
    def test_budget_is_atomic_and_counts_survive_rejection(self):
        keys=['global','alias:'+'a'*64];results=[];processes=[]
        for _ in range(8):
            q="begin;set local role service_role;set local request.jwt.claims='{\"role\":\"service_role\"}';select public.iasdpi_alias_login_limit(ARRAY['global','alias:%s']);commit;"%('a'*64)
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(q);p.stdin.close();p.stdin=None;processes.append(p)
        for p in processes:
            stdout,stderr=p.communicate(timeout=30);self.assertEqual(p.returncode,0,stderr);results.append(stdout.strip()=='t')
        self.assertEqual(sum(results),5);self.assertFalse(self.service('iasdpi_alias_login_limit',[keys]));self.assertGreaterEqual(int(self.sql("select attempts from iasdpi_login_private.budgets where bucket='alias:%s'"%('a'*64))),8)
