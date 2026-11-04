"""G5: PostgreSQL descartável sem rede; nenhuma consulta à produção."""
import json
import subprocess
import unittest
import uuid
import test_portal_integration_sql as g4
import test_user_management_sql as base
import test_access_governance_sql as g3
import test_church_isolation_sql as g1
D='a0000000-0000-4000-8000-000000000004'
@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável --network none')
class ElderStorageSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    sql=base.UserManagementSQLTests.sql
    command=g3.AccessGovernanceSQLTests.command
    rpc=g1.ChurchIsolationSQLTests.rpc
    quote=staticmethod(g1.ChurchIsolationSQLTests.quote)
    grant=g3.AccessGovernanceSQLTests.grant
    def setUp(self):
        g4.PortalIntegrationSQLTests.setUp(self)
        self.sql((base.ROOT/'database/015_elder_period_storage.sql').read_text())
    def workspace(self,month='2031-01-01',actor=base.A,fail=False):return self.rpc('iasdpi_schedule_elder_workspace',[D,month,int(month[:4])],actor,fail)
    def person(self):
        p=self.rpc('iasdpi_schedule_save',['person',str(uuid.uuid4()),0,{'name':'Ancião fictício '+str(uuid.uuid4())[:8],'display_name':'Ancião fictício','department_id':D},str(uuid.uuid4())])
        return p['id']
    def row(self,kind='weekly',person=None,month='2031-01-01'):
        r=next(x for x in self.workspace(month)['periods'] if x['kind']==kind);return {k:r[k] for k in ['id','kind','starts_on','ends_on']}|{'person_id':person,'expected_version':r['version']}
    def save(self,rows,status='draft',actor=base.A,fail=False,request=None):return self.rpc('iasdpi_schedule_elder_save',[D,status,rows,request or str(uuid.uuid4())],actor,fail)
    def feed(self,month='2031-01-01'):return json.loads(self.sql("select public.iasdpi_schedule_published('%s')"%month,anonymous=True))
    def test_installation_security_and_no_historical_mutations(self):
        self.assertEqual(self.sql((base.ROOT/'database/check_church_isolation.sql').read_text()),'')
        self.assertEqual(self.sql("select count(*) from public.schedule_elder_periods"),'0')
        self.assertEqual(self.sql('select count(*) from public.culto_archives'),'1')
        self.assertEqual(self.sql((base.ROOT/'database/check_elder_period_storage.sql').read_text()),'')
        for name in ['check_alias_login.sql','check_access_governance.sql','check_portal_integration.sql']:self.assertEqual(self.sql((base.ROOT/'database'/name).read_text()),'')
        for table in ['schedule_elder_periods','schedule_elder_versions']:
            self.sql('select * from public.'+table,actor=base.A,fail=True);self.sql('delete from public.'+table,anonymous=True,fail=True)
        self.assertTrue(self.rpc('iasdpi_schedule_settings_get',[])['elder_periods'])
    def test_workspace_read_does_not_insert_and_boundary_identity_is_stable(self):
        a=self.workspace('2031-01-01');b=self.workspace('2030-12-01');first=next(r for r in a['periods'] if r['kind']=='weekly')
        self.assertEqual(first['id'],next(r for r in b['periods'] if r['starts_on']==first['starts_on'] and r['kind']=='weekly')['id'])
        self.assertEqual(self.sql('select count(*) from public.schedule_elder_periods'),'0');self.assertEqual(len([r for r in a['periods'] if r['kind']=='monthly']),12)
        changed=json.loads(self.sql("set local datestyle='SQL, DMY';select public.iasdpi_schedule_elder_workspace('%s','2031-01-01',2031)"%D,actor=base.A))
        self.assertEqual(a['periods'],changed['periods'])
    def test_draft_reopen_and_separate_modes(self):
        p=self.person();week=self.row(person=p);month=self.row('monthly',p);self.save([week]);self.save([month],'published')
        rows=self.workspace()['periods'];self.assertEqual({r['kind']:r['status'] for r in rows if r['version']}, {'weekly':'draft','monthly':'published'})
        self.assertEqual(len(self.feed()),1);self.assertEqual(self.feed()[0]['kind'],'monthly')
    def test_publication_history_revisions_and_whitelist(self):
        p=self.person();r=self.row(person=p);self.save([r],'published');published=self.feed();r['expected_version']=1;r['person_id']=None;self.save([r])
        self.assertEqual(self.feed(),published);versions=self.rpc('iasdpi_schedule_elder_versions',[D,'weekly',r['starts_on']]);self.assertEqual([v['version'] for v in versions],[2,1])
        self.assertEqual(versions[0]['snapshot']['status'],'draft');self.assertNotIn('actor_id',published[0]);self.assertNotIn('person_id',published[0]);self.assertEqual(self.sql("select count(*) from iasdpi_schedule_private.audit_logs where entity='elder-weekly'"),'2')
        self.assertEqual(self.sql("set timezone='America/Sao_Paulo';"+(base.ROOT/'database/check_elder_period_storage.sql').read_text()),'')
    def test_publication_blocked_for_unfilled_and_atomic_batch(self):
        p=self.person();rows=[self.row(person=p),self.row('monthly',p)];self.save(rows,fail=True)
        self.save([self.row()],status='published',fail=True);r=self.row(person=p);r['ends_on']='2031-02-01';self.save([r],fail=True)
        self.assertEqual(self.sql('select count(*) from public.schedule_elder_periods'),'0')
    def test_permissions_rechecked_revocation_and_non_admin_scope(self):
        p=self.person();r=self.row(person=p);self.workspace(actor=base.U,fail=True);self.grant(dept=D,flags={'view':True,'edit':True});self.save([r],actor=base.U)
        r['expected_version']=1;self.save([r],'published',base.U,True);self.grant(dept=D,flags={'publish':True},version=1);self.save([r],'published',base.U)
        self.grant(dept=D,status='revoked',version=2);r['expected_version']=2;self.save([r],actor=base.U,fail=True);self.workspace(actor=base.U,fail=True)
        self.sql("select public.iasdpi_schedule_elder_workspace('%s','2031-01-01',2031)"%D,anonymous=True,fail=True)
    def test_stale_edit_and_idempotent_retry(self):
        r=self.row(person=self.person());request=str(uuid.uuid4());a=self.save([r],request=request);self.assertEqual(a,self.save([r],request=request));self.save([r],fail=True)
        r['person_id']=None;self.save([r],request=request,fail=True);self.assertEqual(self.sql('select count(*) from public.schedule_elder_versions'),'1')
    def daily(self,p,day='2031-01-01'):
        d=g1.D;self.rpc('iasdpi_schedule_save',['membership',str(uuid.uuid4()),0,{'person_id':p,'department_id':d,'active':True,'role_ids':[]},str(uuid.uuid4())]);role=self.rpc('iasdpi_schedule_daily_role',[d])
        event=self.rpc('iasdpi_schedule_event_create',[str(uuid.uuid4()),{'department_id':d,'title':'Conflito fictício','date':day},str(uuid.uuid4())])
        return self.rpc('iasdpi_schedule_plan_save',[str(uuid.uuid4()),0,{'department_id':d,'month':'2031-01-01','title':'Som fictício','requirements':[{'id':str(uuid.uuid4()),'event_id':event['id'],'role_id':role['id'],'required_count':1,'assignments':[{'id':str(uuid.uuid4()),'person_id':p}]}]},str(uuid.uuid4())])
    def daily_publish(self,plan,fail=False):return self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())],fail=fail)
    def test_cross_department_conflicts_in_both_directions_and_month_exemption(self):
        p=self.person();plan=self.daily(p);self.daily_publish(plan);self.save([self.row(person=p)],'published',fail=True)
        self.save([self.row('monthly',p)],'published');self.assertEqual(self.feed()[-1]['kind'],'monthly')
        p2=self.person();r=self.row(person=p2);self.save([r],'published')
    def test_week_publication_blocks_other_department_draft_and_revision_keeps_commitment(self):
        p=self.person();r=self.row(person=p);self.save([r],'published');r['expected_version']=1;r['person_id']=None;self.save([r])
        with self.assertRaisesRegex(AssertionError,'Conflito'):self.daily(p)
        self.assertEqual(len(self.feed()),1)
    def test_different_drafts_do_not_reserve_but_publication_revalidates(self):
        p=self.person();plan=self.daily(p);r=self.row(person=p);self.save([r]);self.daily_publish(plan);r['expected_version']=1;self.save([r],'published',fail=True)
    def test_concurrent_weekly_save_has_one_winner(self):
        r=self.row(person=self.person());source="select public.iasdpi_schedule_elder_save(%s,'draft',%s,%s)"%(self.quote(D),self.quote(json.dumps([r])),self.quote(str(uuid.uuid4())))
        processes=[subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env) for _ in range(2)]
        for process in processes:
            process.stdin.write(self.command(source.replace(source[source.rfind(',')+1:source.rfind(')')],self.quote(str(uuid.uuid4()))),base.A));process.stdin.close();process.stdin=None
        results=[p.communicate() for p in processes];self.assertEqual(sum(p.returncode==0 for p in processes),1);self.assertIn('mudou',' '.join(err for out,err in results))
    def test_church_isolation_and_direct_foreign_keys(self):
        p=self.person();r=self.row(person=p);self.save([r]);self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','OTHER','Igreja fictícia',true,true)"%g1.OTHER)
        self.church='OTHER';self.workspace(fail=True);self.save([r],fail=True);self.assertEqual(self.feed(),[]);self.church='IASD_PI'
        self.assertEqual(len([x for x in self.workspace()['periods'] if x['version']]),1)

    def test_actual_cross_department_concurrent_publications(self):
        p=self.person();daily=self.daily(p);r=self.row(person=p);self.save([r]);r['expected_version']=1
        sources=["select public.iasdpi_schedule_elder_save(%s,'published',%s::jsonb,%s)"%(self.quote(D),self.quote(json.dumps([r])),self.quote(str(uuid.uuid4()))),
            "select public.iasdpi_schedule_plan_save(%s,%d,'{\"status\":\"published\"}',%s)"%(self.quote(daily['id']),daily['version'],self.quote(str(uuid.uuid4()))) ]
        processes=[subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env) for _ in sources]
        for process,source in zip(processes,sources):process.stdin.write(self.command(source,base.A));process.stdin.close();process.stdin=None
        outputs=[process.communicate() for process in processes]
        self.assertEqual(sum(process.returncode==0 for process in processes),1);self.assertIn('Conflito',' '.join(err for out,err in outputs))
    def test_authorized_exception_and_audited_revocation_cannot_break_publication(self):
        p=self.person();plan=self.daily(p);self.daily_publish(plan)
        ex=self.rpc('iasdpi_schedule_exception_save',[str(uuid.uuid4()),0,{'person_id':p,'day':'2031-01-01','department_a':g1.D,'department_b':D,'reason':'Exceção fictícia autorizada pelo administrador'}])
        self.save([self.row(person=p)],'published')
        self.rpc('iasdpi_schedule_exception_save',[ex['id'],ex['version'],{'enabled':False}],fail=True)
        self.assertEqual(len(self.feed()),2)
    def test_public_boundary_week_in_both_months_and_no_double_rows(self):
        p=self.person();self.save([self.row(person=p)],'published');a=self.feed();b=self.feed('2030-12-01')
        self.assertEqual(len(a),1);self.assertEqual(len(b),1);self.assertEqual(a[0]['id'],b[0]['id'])
        self.assertEqual(a[0]['startDate'],'2030-12-29');self.assertEqual(a[0]['endDate'],'2031-01-04')
    def test_rotation_sees_published_week_and_does_not_block_month(self):
        p=self.person();self.daily(p);self.save([self.row(person=p)],'published')
        c=self.rpc('iasdpi_schedule_rotation_context',[g1.D,'2031-01-01']);person=next(x for x in c['people'] if x['person_id']==p)
        self.assertTrue(next(d for d in person['days'] if d['date']=='2031-01-01')['conflict']);self.assertIn('2031-01-01',person['global_days'])
    def test_published_daily_revision_keeps_commitment_for_elders(self):
        p=self.person();plan=self.daily_publish(self.daily(p));self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'draft','requirements':[]},str(uuid.uuid4())])
        self.save([self.row(person=p)],'published',fail=True)
    def test_non_member_inactive_and_forged_ids_are_rejected(self):
        p=self.person();r=self.row(person=p);r['id']=str(uuid.uuid4());self.save([r],fail=True);r=self.row(person=p)
        self.sql("update public.schedule_memberships set active=false where person_id='%s'"%p);self.save([r],fail=True)
        self.assertEqual(self.sql('select count(*) from public.schedule_elder_periods'),'0')
    def test_readonly_minister_can_open_workspace_but_cannot_save(self):
        self.grant(dept=D);self.workspace(actor=base.U);self.save([self.row(person=self.person())],actor=base.U,fail=True)
    def test_duplicate_migration_rolls_back_and_preserves_versions(self):
        self.save([self.row(person=self.person())]);before=self.sql('select jsonb_agg(to_jsonb(v)) from public.schedule_elder_versions v')
        self.sql((base.ROOT/'database/015_elder_period_storage.sql').read_text(),fail=True)
        self.assertEqual(before,self.sql('select jsonb_agg(to_jsonb(v)) from public.schedule_elder_versions v'))

    def test_repeatable_read_old_snapshot_cannot_bypass_new_publication(self):
        p=self.person();r=self.row(person=p);self.save([r]);r['expected_version']=1
        query="select public.iasdpi_schedule_elder_workspace(%s,'2031-01-01',2031)"%self.quote(D)
        process=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env)
        initial=self.command(query,base.A).replace('begin;','begin isolation level repeatable read;').replace(';commit;',';')
        process.stdin.write(initial+'\n');process.stdin.flush();self.assertTrue(process.stdout.readline().strip())
        self.save([r],'published')
        source="select public.iasdpi_schedule_elder_save(%s,'draft',%s::jsonb,%s);commit;"%(self.quote(D),self.quote(json.dumps([r])),self.quote(str(uuid.uuid4())))
        process.stdin.write(source+'\n');process.stdin.close();process.stdin=None;out,err=process.communicate(timeout=20)
        self.assertNotEqual(process.returncode,0);self.assertIn('could not serialize',err);self.assertEqual(len(self.feed()),1)

    def test_migration_preserves_preexisting_operational_and_historical_records(self):
        # Outro banco descartável, com 014 e registros anteriores à 015.
        g4.PortalIntegrationSQLTests.setUp(self)
        plan=g4.PortalIntegrationSQLTests.plan(self)
        self.rpc('iasdpi_schedule_plan_save',[plan['id'],plan['version'],{'status':'published'},str(uuid.uuid4())])
        person=plan['requirements'][0]['assignments'][0]['person_id']
        self.sql("insert into public.schedule_legacy_commitments(source_key,person_id,department_id,scheduled_on,original_name,created_by) values('ficticio-historico','%s','%s','2025-01-01','Nome histórico fictício','%s')"%(person,g1.D,base.A))
        tables=['schedule_plans','schedule_versions','schedule_assignments','schedule_events','schedule_legacy_commitments','iasdpi_programs','culto_archives','schedule_people','schedule_memberships','iasdpi_access']
        digest=lambda table:self.sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text) from public."+table+' t')
        before={table:digest(table) for table in tables}
        self.sql((base.ROOT/'database/015_elder_period_storage.sql').read_text())
        self.assertEqual(before,{table:digest(table) for table in tables})
        self.assertEqual(len(self.feed()),1)

    def test_omitted_person_cannot_silently_clear_a_saved_draft(self):
        r=self.row(person=self.person());self.save([r]);r['expected_version']=1;person=r.pop('person_id');self.save([r],fail=True)
        saved=next(p for p in self.workspace()['periods'] if p['id']==r['id']);self.assertEqual(saved['person_id'],person);self.assertEqual(saved['version'],1)
        r['person_id']=None;self.save([r]);saved=next(p for p in self.workspace()['periods'] if p['id']==r['id']);self.assertIsNone(saved['person_id']);self.assertEqual(saved['version'],2)
