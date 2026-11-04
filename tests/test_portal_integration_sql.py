"""G4: banco descartável sem rede, nunca Supabase real."""
import json
import unittest
import uuid
import test_access_governance_sql as g3
import test_user_management_sql as base
import test_church_isolation_sql as g1
D=g1.D
@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável --network none')
class PortalIntegrationSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    sql=base.UserManagementSQLTests.sql
    command=g3.AccessGovernanceSQLTests.command
    rpc=g1.ChurchIsolationSQLTests.rpc
    quote=staticmethod(g1.ChurchIsolationSQLTests.quote)
    grant=g3.AccessGovernanceSQLTests.grant
    def setUp(self):
        g3.AccessGovernanceSQLTests.setUp(self)
        self.before=self.sql('select coalesce(jsonb_agg(to_jsonb(x)),\'[]\') from public.iasdpi_access x')
        self.sql((base.ROOT/'database/014_portal_integration.sql').read_text())
    def feed(self,month='2031-01-01'):
        return json.loads(self.sql("select public.iasdpi_schedule_published('%s')"%month,anonymous=True))
    def plan(self):
        def save(entity,data,id=None,version=0):return self.rpc('iasdpi_schedule_save',[entity,id or str(uuid.uuid4()),version,data,str(uuid.uuid4())])
        person=save('person',{'name':'Pessoa fictícia','display_name':'Voluntário fictício','department_id':D,'contact':'PRIVATE CONTACT'})
        role=self.rpc('iasdpi_schedule_daily_role',[D]);m=self.rpc('iasdpi_schedule_catalog',[])['memberships'][0];save('membership',{'role_ids':[role['id']]},m['id'],m['version'])
        e=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':D,'title':'Evento fictício','date':'2031-01-01'},str(uuid.uuid4())])
        return self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':D,'month':'2031-01-01','title':'Plano fictício','requirements':[{'id':str(uuid.uuid4()),'event_id':e['id'],'role_id':role['id'],'required_count':1,'notes':'PRIVATE NOTES','assignments':[{'id':str(uuid.uuid4()),'person_id':person['id']}]}]},str(uuid.uuid4())])
    def save(self,plan,data,actor=base.A,fail=False):return self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],data,str(uuid.uuid4())],actor,fail)
    def test_migration_only_adds_functions_and_preserves_access(self):
        self.assertEqual(self.sql('select coalesce(jsonb_agg(to_jsonb(x)),\'[]\') from public.iasdpi_access x'),self.before)
        self.assertEqual(self.sql((base.ROOT/'database/check_church_isolation.sql').read_text()),'')
        self.assertEqual(self.sql((base.ROOT/'database/check_access_governance.sql').read_text()),'')
        self.assertEqual(self.sql((base.ROOT/'database/check_portal_integration.sql').read_text()),'')
        self.assertEqual(self.sql("select pg_get_userbyid(proowner) from pg_proc where oid='public.iasdpi_schedule_published(date)'::regprocedure"),'iasdpi_church_executor')
        self.assertEqual(self.sql("select pg_get_userbyid(proowner) from pg_proc where oid='public.iasdpi_my_churches()'::regprocedure"),'postgres')
    def test_public_feed_never_contains_drafts_or_private_fields(self):
        p=self.plan();self.assertEqual(self.feed(),[]);self.save(p,{'status':'published'});rows=self.feed();self.assertEqual(len(rows),1)
        self.assertEqual(set(rows[0]),{'id','date','department_id','department','person','role','event','starts_at','ends_at','version','published_at','origin'})
        self.assertNotIn('PRIVATE',json.dumps(rows));self.assertNotIn(base.A,json.dumps(rows));self.assertEqual(rows[0]['person'],'Voluntário fictício')
    def test_revision_in_draft_keeps_only_previously_published_version(self):
        p=self.save(self.plan(),{'status':'published'});public=self.feed();self.save(p,{'status':'draft','title':'PRIVATE DRAFT TITLE','requirements':[]})
        self.assertEqual(self.feed(),public)
    def test_publication_rechecks_permissions_and_revision(self):
        p=self.plan();self.grant(flags={'view':True,'edit':True});self.save(p,{'status':'published'},base.U,True)
        self.grant(flags={'publish':True},version=1);self.grant(status='revoked',version=2)
        self.save(p,{'status':'published'},base.U,True);self.assertEqual(self.feed(),[])
        self.sql("select public.iasdpi_schedule_plan_save('%s',1,'{\"status\":\"published\"}',gen_random_uuid())"%p['id'],anonymous=True,fail=True)
    def test_church_metadata_is_only_for_current_identity_and_role_remains_scoped(self):
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente teste',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','leader'),('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.A,g1.OTHER,base.B))
        rows=self.rpc('iasdpi_my_churches',[]);self.assertEqual({r['code'] for r in rows},{'IASD_PI','TEST_ONLY'});self.assertTrue(next(r for r in rows if r['code']=='IASD_PI')['is_admin']);self.assertFalse(next(r for r in rows if r['code']=='TEST_ONLY')['is_admin'])
        self.assertEqual(self.rpc('iasdpi_my_churches',[],base.U),[])
        self.church='TEST_ONLY';self.rpc('iasdpi_set_access',[base.U,'admin',True],base.A,True)
        self.sql('select public.iasdpi_my_churches()',anonymous=True,fail=True)
    def test_public_feed_cannot_read_other_church_or_write_tables(self):
        self.save(self.plan(),{'status':'published'});self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','TEST_ONLY','Somente teste',true,true)"%g1.OTHER)
        self.church='TEST_ONLY';self.assertEqual(self.feed(),[])
        for table in ['schedule_plans','schedule_assignments','schedule_people','schedule_versions']:
            self.sql('select * from public.'+table,anonymous=True,fail=True);self.sql('delete from public.'+table,actor=base.A,fail=True)
    def test_metadata_excludes_revoked_suspended_inactive_and_missing_session(self):
        self.grant();self.assertEqual(len(self.rpc('iasdpi_my_churches',[],base.U)),1)
        self.rpc('iasdpi_identity_state_save',[base.U,'suspended','Suspensão fictícia confirmada']);self.assertEqual(self.rpc('iasdpi_my_churches',[],base.U),[])
        self.rpc('iasdpi_my_churches',[],base.N,True);self.rpc('iasdpi_my_churches',[],base.X,True)
    def test_invalid_public_month_and_inactive_church_fail_closed(self):
        self.sql("select public.iasdpi_schedule_published('2031-01-02')",anonymous=True,fail=True)
        self.sql('select public.iasdpi_schedule_published(null)',anonymous=True,fail=True)
        self.sql("update public.iasdpi_churches set active=false where code='IASD_PI'")
        self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True,fail=True)
    def test_context_returns_scoped_capabilities_without_people_or_roles_inferred_from_names(self):
        self.grant(flags={'view':True,'members':True,'requests':True});c=self.rpc('iasdpi_portal_context',[],base.U)
        self.assertFalse(c['is_admin']);self.assertEqual(set(c),{'actor_id','is_admin','departments'});self.assertEqual(len(c['departments']),1);d=c['departments'][0];self.assertTrue(d['can_manage_members']);self.assertTrue(d['can_handle_requests']);self.assertFalse(d['can_publish']);self.assertFalse(d['can_manage_access'])
        self.sql('select public.iasdpi_portal_context()',anonymous=True,fail=True)
    def conflict_plans(self):
        first=self.plan();assignment=first['requirements'][0]['assignments'][0];music='a0000000-0000-4000-8000-000000000003';role=self.rpc('iasdpi_schedule_daily_role',[music])
        self.rpc('iasdpi_schedule_save',['membership',str(uuid.uuid4()),0,{'person_id':assignment['person_id'],'department_id':music,'active':True,'role_ids':[role['id']]},str(uuid.uuid4())])
        second=self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':music,'month':'2031-01-01','title':'Segunda escala fictícia','requirements':[{'id':str(uuid.uuid4()),'event_id':first['requirements'][0]['event_id'],'role_id':role['id'],'required_count':1,'notes':'','assignments':[{'id':str(uuid.uuid4()),'person_id':assignment['person_id']}]}]},str(uuid.uuid4())]);return first,second
    def test_publication_revalidates_cross_department_conflicts(self):
        first,second=self.conflict_plans();self.save(first,{'status':'published'});music=second['department_id'];self.grant(dept=music,flags={'view':True,'publish':True});self.save(second,{'status':'published'},base.U,True);self.assertEqual(len(self.feed()),1)
    def test_simultaneous_publications_have_only_one_winner(self):
        import subprocess
        first,second=self.conflict_plans();processes=[]
        for plan in [first,second]:
            q=self.command("select public.iasdpi_schedule_plan_save('%s',1,'{\"status\":\"published\"}',gen_random_uuid());select pg_sleep(0.1)"%plan['id'],actor=base.A)
            p=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env);p.stdin.write(q);p.stdin.close();p.stdin=None;processes.append(p)
        codes=[]
        for p in processes:p.communicate(timeout=30);codes.append(p.returncode)
        self.assertEqual(sorted(codes),[0,3]);self.assertEqual(len(self.feed()),1);self.assertEqual(self.sql('select count(*) from public.schedule_plans'),'2')
