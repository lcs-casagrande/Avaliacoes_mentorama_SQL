"""Migração 004 em PostgreSQL descartável, sem rede e sem credenciais reais."""
import copy
import json
import subprocess
import unittest
import uuid

import test_user_management_sql as base
import test_operational_sql as operational


@unittest.skipUnless(base.CONTAINER, 'Requer PostgreSQL isolado')
class CultoTrashSQLTests(unittest.TestCase):
    setUpClass=classmethod(operational.OperationalSQLTests.setUpClass.__func__)
    command=operational.OperationalSQLTests.command
    sql=operational.OperationalSQLTests.sql
    quote=staticmethod(operational.OperationalSQLTests.quote)
    call=operational.OperationalSQLTests.call

    def setUp(self):
        operational.OperationalSQLTests.setUp(self)
        self.original=self.call()['document']
        self.before_program=self.sql('select row_to_json(p) from public.iasdpi_programs p')
        self.sql((base.ROOT/'database/004_culto_trash.sql').read_text())

    def change(self,restore=False,version=1,actor=base.A,request=None,fail=False,identifier=None):
        rpc='iasdpi_restore_program' if restore else 'iasdpi_trash_program'
        args=','.join([self.quote(identifier or self.p['id']),str(version),self.quote(request or str(uuid.uuid4()))+'::uuid'])
        if not restore:args+=",'Teste descartável'"
        source='select public.'+rpc+'('+args+')'
        value=self.sql(source,actor=actor,fail=fail)
        return None if fail else json.loads(value)

    def test_migration_preserves_documents_projections_authorizations_and_old_tables(self):
        self.assertEqual(json.loads(self.sql('select document from public.iasdpi_programs')),self.original)
        self.assertEqual(self.sql('select version from public.iasdpi_programs'),'1')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_activities'),'16')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs where deleted_at is not null'),'0')
        self.sql((base.ROOT/'database/check_culto_trash.sql').read_text())
        self.assertEqual(json.loads(self.sql('select document from public.iasdpi_programs')),self.original)
        self.assertEqual(self.sql('select row_to_json(a) from public.iasdpi_access a order by user_id'),self.before_access)
        self.assertEqual(self.sql('select row_to_json(a) from public.culto_archives a'),self.before_archive)
        self.assertEqual(self.sql("select jsonb_array_length(plan->'items') from public.iasdpi_templates where id='liturgy-i'"),'16')

    def test_admin_trash_list_detail_restore_no_double_count_no_data_loss(self):
        other=copy.deepcopy(self.p);other['id']='other-culto';self.call(other)
        trashed=self.change()
        self.assertEqual(trashed['status'],'trashed');self.assertEqual(trashed['deleted_by'],base.A)
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.L),'1')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_activities',actor=base.A),'16')
        rows=json.loads(self.sql('select public.iasdpi_list_trash()',actor=base.A))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['deleted_by_email'],'admin@example.invalid')
        details=json.loads(self.sql('select public.iasdpi_trash_detail('+self.quote(self.p['id'])+')',actor=base.A))
        self.assertEqual(details['document']['plan'],self.original['plan']);self.assertEqual(len(details['audit']),1)
        restored=self.change(restore=True,version=2)
        expected=dict(self.original,version=3)
        self.assertEqual(restored['document'],expected)
        self.assertIsNone(restored['deleted_at']);self.assertEqual(self.sql('select count(*) from public.iasdpi_programs',actor=base.L),'2')
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.trash_audit'),'2')
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.revisions'),'2')
        self.assertEqual(json.loads(self.sql("select document from public.iasdpi_programs where id='other-culto'")),dict(other,version=1))

    def test_nonadmin_anonymous_revoked_and_direct_access_blocked(self):
        for actor in (base.L,base.U,base.X):
            self.change(actor=actor,fail=True)
            self.sql('select public.iasdpi_list_trash()',actor=actor,fail=True)
            self.sql('select public.iasdpi_trash_detail('+self.quote(self.p['id'])+')',actor=actor,fail=True)
        self.change()
        for actor in (base.L,base.U,base.X):self.change(restore=True,version=2,actor=actor,fail=True)
        self.sql('select public.iasdpi_list_trash()',anonymous=True,fail=True)
        for actor in (base.A,base.L):
            for table in ('iasdpi_programs','iasdpi_activities','iasdpi_subactivities'):
                self.sql('delete from public.'+table,actor=actor,fail=True)
            self.sql('update public.iasdpi_programs set deleted_at=null',actor=actor,fail=True)
            self.sql('select * from iasdpi_operational_private.trash_audit',actor=actor,fail=True)
            self.sql('select iasdpi_operational_private.preview_import_003(\'[]\')',actor=actor,fail=True)
        self.sql("update public.iasdpi_access set enabled=false where user_id='%s'"%base.A)
        self.change(restore=True,version=2,fail=True)

    def test_deleted_write_import_and_old_receipt_cannot_resurrect_or_leak(self):
        imported=copy.deepcopy(self.p);imported['id']='imported';request=str(uuid.uuid4())
        saved=self.call(imported,importing=True,request=request)
        self.change(identifier='imported')
        self.call(imported,importing=True,request=request,fail=True)
        duplicate=copy.deepcopy(imported);duplicate['id']='other-import-id'
        self.call(duplicate,importing=True,fail=True)
        self.call(saved['document'],version=2,fail=True)
        self.call(self.original,version=2,fail=True) # Wrong version on active record.
        rows=json.loads(self.sql('select public.iasdpi_preview_import('+self.quote(json.dumps([duplicate,imported]))+'::jsonb)',actor=base.L))
        self.assertTrue(all(row['status']=='unavailable' and 'remote_id' not in row for row in rows))
        self.assertEqual(self.sql("select version from public.iasdpi_programs where id='imported'"),'2')
        self.assertEqual(self.sql("select count(*) from public.iasdpi_programs where id='other-import-id'"),'0')

    def test_idempotent_retry_and_cas_stale_restore(self):
        request=str(uuid.uuid4());first=self.change(request=request)
        self.assertEqual(self.change(request=request),first)
        self.change(fail=True)
        restoreid=str(uuid.uuid4());restored=self.change(restore=True,version=2,request=restoreid)
        self.assertEqual(self.change(restore=True,version=2,request=restoreid),restored)
        self.change(restore=True,version=2,fail=True)
        self.change(version=3,request=request,fail=True)
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.trash_audit'),'2')
        self.assertEqual(self.sql('select version from public.iasdpi_programs'),'3')

    def test_concurrent_restore_only_one_operation_is_applied(self):
        self.change()
        def source():return self.command("select public.iasdpi_restore_program(%s,2,'%s')"%(self.quote(self.p['id']),uuid.uuid4()),actor=base.A)
        commands=[source(),source()]
        procs=[subprocess.Popen(self.exec+['-d',self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=self.env) for _ in commands]
        for proc,command in zip(procs,commands):proc.stdin.write(command);proc.stdin.close();proc.stdin=None
        results=[proc.communicate(timeout=20) for proc in procs]
        self.assertEqual(sorted(proc.returncode for proc in procs),[0,3],results)
        self.assertEqual(self.sql('select version from public.iasdpi_programs'),'3')
        self.assertEqual(self.sql('select count(*) from iasdpi_operational_private.trash_audit'),'2')

    def test_definer_ownership_empty_search_path_and_no_helper_grants(self):
        self.assertEqual(self.sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('iasdpi_save_program','iasdpi_preview_import','iasdpi_trash_program','iasdpi_restore_program','iasdpi_list_trash','iasdpi_trash_detail','change_trash','save_program_003','preview_import_003') and (pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or not ('search_path=\"\"'=any(p.proconfig)))"),'0')
        self.assertEqual(self.sql("select has_schema_privilege('authenticated','iasdpi_operational_private','USAGE')"),'f')
        self.assertEqual(self.sql("select has_function_privilege('authenticated','iasdpi_operational_private.save_program_003(text,bigint,jsonb,uuid,boolean)','EXECUTE')"),'f')
        self.assertEqual(self.sql("select has_function_privilege('anon','public.iasdpi_trash_program(text,bigint,uuid,text)','EXECUTE')"),'f')

    def test_inconsistent_import_remains_recoverable_without_reprojection(self):
        self.sql("update public.iasdpi_programs set document=jsonb_set(document,array['executions',%s,'started'],'\"valor do PDF\"')"%self.quote(self.parent))
        original=json.loads(self.sql('select document from public.iasdpi_programs'))
        self.change();self.change(restore=True,version=2)
        self.assertEqual(json.loads(self.sql('select document from public.iasdpi_programs')),dict(original,version=3))

    def test_explicit_repair_save_and_finalize_imported_16_item_copy_same_id(self):
        self.sql("update public.iasdpi_programs set document=jsonb_set(jsonb_set(document,'{status}','\"Em andamento\"'),array['executions',%s,'started'],'\"09:??\"')"%self.quote(self.parent))
        opened=json.loads(self.sql('select document from public.iasdpi_programs',actor=base.L))
        self.assertEqual(opened['executions'][self.parent]['started'],'09:??')
        corrected=copy.deepcopy(opened)
        corrected['executions'][self.parent]['started']=self.p['executions'][self.parent]['started']
        saved=self.call(corrected,version=1)['document']
        saved['status']='Finalizada'
        finalized=self.call(saved,version=2)['document']
        self.assertEqual(finalized['id'],opened['id'])
        self.assertEqual(finalized['plan'],opened['plan'])
        self.assertEqual(finalized['actual_details'],opened['actual_details'])
        self.assertEqual(finalized['note'],opened['note'])
        self.assertEqual(len(finalized['plan']['items']),16)
        self.assertEqual(self.sql("select count(*) from public.iasdpi_programs where document->>'status'='Finalizada'",actor=base.L),'1')
        self.assertEqual(self.sql('select count(*) from public.iasdpi_programs'),'1')

    def test_failure_before_commit_rolls_back_all_trash_changes(self):
        # First undo this fixture's 004 by using a fresh, independently created database.
        previous=self.db
        base.UserManagementSQLTests.setUp(self)
        self.sql((base.ROOT/'database/003_operational_storage.sql').read_text())
        migration=(base.ROOT/'database/004_culto_trash.sql').read_text()
        self.sql(migration.rsplit('commit;',1)[0]+'select 1/0; commit;',fail=True)
        self.assertEqual(self.sql("select count(*) from information_schema.columns where table_schema='public' and table_name='iasdpi_programs' and column_name='deleted_at'"),'0')
        self.assertEqual(self.sql("select to_regprocedure('iasdpi_operational_private.save_program_003(text,bigint,jsonb,uuid,boolean)') is null"),'t')
        self.assertEqual(self.sql("select to_regprocedure('public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean)') is not null"),'t')
        self.db=previous
