"""Diagnóstico único: metadados completos, sem modificar dados, em PostgreSQL isolado."""
import json
import unittest
import test_user_management_sql as base
import test_culto_trash_sql as trash


@unittest.skipUnless(base.CONTAINER, 'Requer PostgreSQL isolado')
class CultoDiagnosticSQLTests(unittest.TestCase):
    setUpClass=classmethod(trash.CultoTrashSQLTests.setUpClass.__func__)
    setUp=trash.CultoTrashSQLTests.setUp
    command=trash.CultoTrashSQLTests.command
    sql=trash.CultoTrashSQLTests.sql
    quote=staticmethod(trash.CultoTrashSQLTests.quote)
    call=trash.CultoTrashSQLTests.call

    def test_single_result_contains_seven_sections_and_is_read_only(self):
        before=self.sql('select row_to_json(p) from public.iasdpi_programs p')
        query=(base.ROOT/'database/check_culto_trash_summary.sql').read_text()
        rows=self.sql('begin read only;\n'+query+'\ncommit;')
        report={key:json.loads(value) for key,value in (row.split('|',1) for row in rows.splitlines())}
        self.assertEqual(len(report),7)
        self.assertEqual(len(report['01_colunas']),3)
        self.assertEqual(len(report['02_funcoes']),13)
        for function in report['02_funcoes']:
            self.assertEqual(function['owner'],'postgres')
            self.assertTrue(function['security_definer'])
            self.assertIn('search_path=""',function['config'])
            self.assertFalse(function['anon_execute'])
            self.assertEqual(function['authenticated_execute'],function['schema']=='public')
        self.assertEqual(len(report['03_rls']),4)
        self.assertTrue(all(row['rls'] and row['owner']=='postgres' for row in report['03_rls']))
        self.assertEqual(len(report['04_politicas']),3)
        self.assertTrue(all(row['policyname']=='operational_read' and row['cmd']=='SELECT' and row['roles']==['authenticated'] for row in report['04_politicas']))
        self.assertEqual(len(report['05_privilegios_tabelas']),8)
        for row in report['05_privilegios_tabelas']:
            self.assertFalse(row['escrita_tabela']);self.assertFalse(row['escrita_coluna'])
            self.assertEqual(row['select'],row['role']=='authenticated' and row['schema']=='public')
        self.assertEqual(len(report['06_schemas_privados']),4)
        self.assertTrue(all(not row['usage'] and not row['create'] for row in report['06_schemas_privados']))
        self.assertEqual(report['07_contagens'],{'ativos':1,'lixeira':0})
        self.assertEqual(self.sql('select row_to_json(p) from public.iasdpi_programs p'),before)
