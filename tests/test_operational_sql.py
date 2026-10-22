"""SQL operacional REAL em PostgreSQL descartável e sem rede. Sem Supabase real."""
import copy
import json
import os
import subprocess
import unittest
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import test_user_management_sql as base


@unittest.skipUnless(base.CONTAINER, 'Defina IASDPI_PG_TEST_CONTAINER para PostgreSQL isolado')
class OperationalSQLTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql

    def setUp(self):
        base.UserManagementSQLTests.setUp(self)
        self.sql((base.ROOT/'database/003_operational_storage.sql').read_text())
        plan=json.loads((base.ROOT/'backend/chronogram.json').read_text());plan['date']='2026-10-10'
        self.p={'id':'stable-local-id','version':7,'execution_mode':'manual','status':'Finalizada','plan':plan,'note':'Preservar','incident':'Ocorrência','custom':{'unknown':True},'actual_details':{},'executions':{},'extra_events':[]}
        for i in plan['items']:
            i['planned_start']=plan['date']+'T'+i['start']+':00-03:00';i['planned_end']=plan['date']+'T'+i['end']+':00-03:00'
            self.p['executions'][i['id']]={'started':i['planned_start'],'ended':i['planned_end']}
            self.p['actual_details'][i['id']]={'note':'Observação','responsible':'Min. Louvor','status':'realizada'}
        self.p.update(planned_start=plan['date']+'T09:30:00-03:00',planned_end=plan['date']+'T11:24:00-03:00')
        self.parent=plan['items'][0]['id']
        self.child={'id':'child','parent_id':self.parent,'title':'Subatividade','start':'09:31','end':'09:34','responsible':'Equipe','note':'Nota'}

    def call(self,p=None,version=0,actor=base.L,importing=False,request=None,fail=False):
        p=p or self.p
        statement="select public.iasdpi_save_program(%s,%s,%s::jsonb,%s::uuid,%s)" % tuple([self.quote(p['id']),str(version),self.quote(json.dumps(p)),self.quote(request or str(uuid.uuid4())),'true' if importing else 'false'])
        raw=self.sql(statement,actor=actor,fail=fail)
        return None if fail else json.loads(raw)

    @staticmethod
    def quote(value):return "'"+value.replace("'","''")+"'"

    def test_create_update_reopen_projection_revision_and_author(self):
        self.p['actual_details'][self.parent]['subactivities']=[self.child]
        saved=self.call()['document'];self.assertEqual(saved['version'],1)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_activities',actor=base.A),'16')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_subactivities',actor=base.A),'1')
        saved['note']='Nova nota';result=self.call(saved,version=1,actor=base.A)['document']
        self.assertEqual(result['id'],saved['id']);self.assertEqual(result['version'],2)
        self.assertEqual(result['custom'],{'unknown':True});self.assertEqual(result['executions'],self.p['executions'])
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.revisions'),'1')
        self.assertEqual(self.sql('select created_by from public.iasdpi_programs'),base.L)
        self.assertEqual(self.sql('select updated_by from public.iasdpi_programs'),base.A)
        self.assertEqual(json.loads(self.sql('select document from public.iasdpi_programs',actor=base.L)),result)

    def test_unauthorized_and_anonymous_read_write_private_and_direct_dml_denied(self):
        self.call()
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.U),'0')
        self.sql('select * from public.iasdpi_programs',anonymous=True,fail=True)
        for actor in (base.U,base.X):self.call(actor=actor,fail=True)
        for actor in (base.A,base.L,base.U):
            self.sql('delete from public.iasdpi_programs',actor=actor,fail=True)
            self.sql("update public.iasdpi_programs set document='{}'",actor=actor,fail=True)
            self.sql('select * from iasdpi_operational_private.revisions',actor=actor,fail=True)
            self.sql('select iasdpi_operational_private.require_access()',actor=actor,fail=True)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'),self.before_access)
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)
        self.assertEqual(self.sql("select oid from pg_class where oid in ('public.iasdpi_access'::regclass,'public.iasdpi_templates'::regclass,'public.culto_archives'::regclass) order by oid"),self.before_oids)

    def test_retry_receipt_concurrent_version_and_revocation(self):
        request=str(uuid.uuid4());saved=self.call(request=request)
        self.assertEqual(self.call(request=request),saved)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'1')
        first=copy.deepcopy(saved['document']);second=copy.deepcopy(first)
        first['note']='Primeiro';second['note']='Segundo'
        self.call(first,version=1);self.call(second,version=1,fail=True)
        self.sql("select public.iasdpi_set_access('%s','leader',false)"%base.L,actor=base.A)
        self.call(first,version=2,fail=True)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.L),'0')
        self.assertEqual(self.sql("select document->>'note' from public.iasdpi_programs"),'Primeiro')

    def test_invalid_child_fk_range_and_duplicate_roll_back(self):
        self.call()
        for child in [dict(self.child,parent_id='wrong'),dict(self.child,start='09:29'),dict(self.child,end='09:36')]:
            p=copy.deepcopy(self.p);p['actual_details'][self.parent]['subactivities']=[child]
            self.call(p,version=1,fail=True)
        p=copy.deepcopy(self.p);p['plan']['items'][1]['id']=self.parent
        self.call(p,version=1,fail=True)
        self.assertEqual(self.sql('select version from public.iasdpi_programs'),'1')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_activities'),'16')
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.revisions'),'0')

    def test_import_preview_optional_idempotent_conflict_and_content_dedup(self):
        source=self.quote(json.dumps([self.p]))
        preview=json.loads(self.sql('select public.iasdpi_preview_import('+source+'::jsonb)',actor=base.L))
        self.assertEqual(preview[0]['status'],'new')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'0')
        self.assertEqual(self.call(importing=True)['status'],'imported')
        self.assertEqual(self.call(importing=True)['status'],'exists')
        changed=copy.deepcopy(self.p);changed['note']='Outro navegador'
        self.call(changed,importing=True,fail=True)
        duplicate=copy.deepcopy(self.p);duplicate['id']='different-local-id'
        self.assertEqual(self.call(duplicate,importing=True)['status'],'duplicate')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'1')

    def test_templates_preserve_seed_admin_only_and_version_conflict(self):
        rows=json.loads(self.sql("select jsonb_agg(id order by id) from public.iasdpi_templates"))
        self.assertIn('liturgy-i',rows);self.assertIn('free',rows);self.assertIn('culto-03102026',rows)
        self.assertEqual(self.sql("select jsonb_array_length(plan->'items') from public.iasdpi_templates where id='liturgy-i'"),'16')
        args="'liturgy-ii',0,'Liturgia II',"+self.quote(json.dumps(self.p['plan']))+'::jsonb'
        self.sql('select public.iasdpi_save_template('+args+')',actor=base.L,fail=True)
        self.sql('select public.iasdpi_save_template('+args+')',actor=base.A)
        self.sql('select public.iasdpi_save_template('+args+')',actor=base.A,fail=True)

    def test_partial_top_level_update_does_not_clear_existing_fields(self):
        original=self.call()['document']
        saved=self.call({'id':original['id'],'note':'Só a nota'},version=1)['document']
        self.assertEqual(saved['note'],'Só a nota')
        for key in ('plan','executions','actual_details','incident','custom'):
            self.assertEqual(saved[key],original[key])

    def test_legacy_extra_sequence_and_raw_precision_preserved(self):
        self.p['extra_events']=[{'id':'legacy-extra','position':2,'activity':'Extra antigo','start':'09:40:00.123456','end':'09:41:00.654321','note':'Nota','responsible':'Equipe'}]
        self.p['executions'][self.parent]['started']='2026-10-10T12:30:00.123456Z'
        saved=self.call()['document']
        self.assertEqual(saved['extra_events'],self.p['extra_events'])
        self.assertEqual(saved['executions'],self.p['executions'])
        self.assertEqual(self.sql("select position from public.iasdpi_activities where id='legacy-extra'"),'2')
        third=self.p['plan']['items'][2]['id']
        self.assertEqual(self.sql('select position from public.iasdpi_activities where id='+self.quote(third)),'3')

    def test_kind_comes_from_source_with_interleaved_extras_and_repeated_saves(self):
        for item in self.p['plan']['items']:
            item['kind']='extra'  # Campo legado não deve determinar a origem.
        self.p['extra_events']=[dict(id='extra-'+str(n),position=position,
            activity='Extra '+str(n),kind='planned',start='09:40',end='09:41',note='',responsible='')
            for n,position in enumerate((0,6,18))]
        self.p['actual_details'][self.parent]['subactivities']=[self.child]
        saved=self.call()['document']
        for expected_version in (1,2):
            self.assertEqual(self.sql("select jsonb_object_agg(kind,n) from (select kind,count(*) n from public.iasdpi_activities group by kind) counts"),'{"extra": 3, "planned": 16}')
            for extra in self.p['extra_events']:
                self.assertEqual(self.sql('select kind from public.iasdpi_activities where id='+self.quote(extra['id'])),'extra')
                self.assertEqual(self.sql('select position from public.iasdpi_activities where id='+self.quote(extra['id'])),str(extra['position']))
            for item in self.p['plan']['items']:
                self.assertEqual(self.sql('select kind from public.iasdpi_activities where id='+self.quote(item['id'])),'planned')
            self.assertEqual(self.sql('select count(*) from public.iasdpi_subactivities'),'1')
            saved=self.call(saved,version=expected_version)['document']

    def test_historical_timezone_offsets_seconds_and_session_independence(self):
        # Conexões seguintes usam outro fuso: a interpretação civil deve continuar paulista.
        self.sql('alter database '+self.db+" set timezone='Asia/Tokyo'")
        zone=ZoneInfo('America/Sao_Paulo')
        for index,day in enumerate(('2018-01-20','2018-07-21','2026-10-10')):
            with self.subTest(day=day):
                p=copy.deepcopy(self.p);p['id']='historical-'+str(index);p['plan']['date']=day
                def stamp(clock):return datetime.fromisoformat(day+'T'+clock).replace(tzinfo=zone).isoformat()
                for item in p['plan']['items']:
                    item['planned_start']=stamp(item['start']);item['planned_end']=stamp(item['end'])
                    p['executions'][item['id']]={'started':item['planned_start'],'ended':item['planned_end']}
                p['planned_start']=stamp('09:30');p['planned_end']=stamp('11:24')
                del p['executions'][self.parent]
                p['actual_details'][self.parent]['partial_end']='09:35:17.123456'
                p['extra_events']=[dict(id='historical-extra',position=2,activity='Extra',start='09:40:18.123456',end='09:41:19.654321',note='',responsible='',subactivities=[dict(self.child,parent_id='historical-extra',start='09:40:30.111111',end='09:41:00.222222')])]
                saved=self.call(p)['document']
                self.assertEqual(saved['executions'],p['executions'])
                self.assertEqual(saved['extra_events'],p['extra_events'])
                for activity,column,clock in [(self.parent,'actual_end','09:35:17.123456'),('historical-extra','actual_start','09:40:18.123456'),('historical-extra','actual_end','09:41:19.654321')]:
                    expected=datetime.fromisoformat(stamp(clock)).astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')
                    actual=self.sql("select to_char("+column+" at time zone 'UTC','YYYY-MM-DD HH24:MI:SS.US') from public.iasdpi_activities where program_id="+self.quote(p['id'])+' and id='+self.quote(activity))
                    self.assertEqual(actual,expected)
                self.assertEqual(self.sql("select actual_start::text from public.iasdpi_subactivities where program_id="+self.quote(p['id'])),'09:40:30.111111')

    def test_invalid_root_and_template_fail_without_modifying_existing_data(self):
        for key in ('status','execution_mode','executions','plan'):
            p=copy.deepcopy(self.p);del p[key];self.call(p,fail=True)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'0')
        bad=copy.deepcopy(self.p['plan']);bad['items'][1]['start']='08:00'
        self.sql("select public.iasdpi_save_template('liturgy-i',1,'Inválido',"+self.quote(json.dumps(bad))+"::jsonb)",actor=base.A,fail=True)
        self.assertEqual(self.sql("select version from public.iasdpi_templates where id='liturgy-i'"),'1')
        overlap=copy.deepcopy(self.p);overlap['plan']['items'][1].update(start='09:31',end='09:35',parallel=True)
        self.call(overlap,fail=True)
        self.sql("select public.iasdpi_save_template('free',1,'Livre',"+self.quote(json.dumps(self.p['plan']))+"::jsonb)",actor=base.A,fail=True)

    def test_two_parallel_devices_only_one_update_succeeds(self):
        self.call()
        sessions=[]
        for note in ('Dispositivo A','Dispositivo B'):
            p=copy.deepcopy(self.p);p['note']=note
            statement="select public.iasdpi_save_program(%s,1,%s::jsonb,%s::uuid,false)"%(self.quote(p['id']),self.quote(json.dumps(p)),self.quote(str(uuid.uuid4())))
            proc=subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env)
            proc.stdin.write(self.command(statement,base.L));proc.stdin.close();sessions.append(proc)
        codes=[proc.wait(timeout=20) for proc in sessions]
        for proc in sessions:proc.stdout.close();proc.stderr.close()
        self.assertEqual(sorted(codes),[0,3]);self.assertEqual(self.sql('select version from public.iasdpi_programs'),'2')


@unittest.skipUnless(base.CONTAINER, 'Defina IASDPI_PG_TEST_CONTAINER para PostgreSQL isolado')
class OperationalMigrationTransactionTests(unittest.TestCase):
    setUpClass=classmethod(base.UserManagementSQLTests.setUpClass.__func__)
    setUp=base.UserManagementSQLTests.setUp  # Apenas 001/002, antes da migração sob revisão.
    command=base.UserManagementSQLTests.command
    sql=base.UserManagementSQLTests.sql
    quote=staticmethod(OperationalSQLTests.quote)

    def assert_rollback(self,original):
        self.assertEqual(self.sql("select to_regnamespace('iasdpi_operational_private') is null"),'t')
        self.assertEqual(self.sql("select to_regclass('public.iasdpi_programs') is null"),'t')
        self.assertEqual(self.sql("select count(*) from information_schema.columns where table_schema='public' and table_name='iasdpi_templates' and column_name='version'"),'0')
        self.assertEqual(self.sql('select jsonb_agg(to_jsonb(t) order by id) from public.iasdpi_templates t'),original)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'),self.before_access)
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)

    def test_model_copy_preserves_all_sixteen_items_and_original_unknown_fields(self):
        self.sql("update public.iasdpi_templates set plan=jsonb_set(plan,'{items,0,unknown_legacy}', '{\"preserve\":true}') where id='culto-03102026'")
        original=json.loads(self.sql("select plan from public.iasdpi_templates where id='culto-03102026'"))
        self.sql((base.ROOT/'database/003_operational_storage.sql').read_text())
        copied=json.loads(self.sql("select plan from public.iasdpi_templates where id='liturgy-i'"))
        self.assertEqual(len(copied['items']),16)
        self.assertEqual(copied,{key:value for key,value in original.items() if key!='date'})
        self.assertEqual(json.loads(self.sql("select plan from public.iasdpi_templates where id='culto-03102026'")),original)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'),self.before_access)
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)

    def test_failure_just_before_commit_rolls_back_all_ddl_and_seeds(self):
        original=self.sql('select jsonb_agg(to_jsonb(t) order by id) from public.iasdpi_templates t')
        migration=(base.ROOT/'database/003_operational_storage.sql').read_text()
        self.assertTrue(migration.rstrip().endswith('commit;'))
        self.sql(migration.rsplit('commit;',1)[0]+'select 1/0;\ncommit;',fail=True)
        self.assert_rollback(original)

    def test_wrong_source_count_aborts_without_changing_existing_data(self):
        self.sql("update public.iasdpi_templates set plan=jsonb_set(plan,'{items}',(plan->'items')-15) where id='culto-03102026'")
        original=self.sql('select jsonb_agg(to_jsonb(t) order by id) from public.iasdpi_templates t')
        self.sql((base.ROOT/'database/003_operational_storage.sql').read_text(),fail=True)
        self.assert_rollback(original)

    def test_conflicting_existing_liturgy_is_never_overwritten(self):
        self.sql("insert into public.iasdpi_templates(id,plan) select 'liturgy-i',jsonb_set(plan-'date','{name}','\"Modelo preexistente\"') from public.iasdpi_templates where id='culto-03102026'")
        original=self.sql('select jsonb_agg(to_jsonb(t) order by id) from public.iasdpi_templates t')
        self.sql((base.ROOT/'database/003_operational_storage.sql').read_text(),fail=True)
        self.assert_rollback(original)
