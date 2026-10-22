"""Consulta temporal de produção validada somente em PostgreSQL descartável."""
import copy
import json
import unittest
import test_user_management_sql as base
import test_culto_trash_sql as trash


@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL isolado')
class SavedTimeCompatibilitySQLTests(unittest.TestCase):
    setUpClass=classmethod(trash.CultoTrashSQLTests.setUpClass.__func__)
    setUp=trash.CultoTrashSQLTests.setUp
    command=trash.CultoTrashSQLTests.command
    sql=trash.CultoTrashSQLTests.sql
    quote=staticmethod(trash.CultoTrashSQLTests.quote)
    call=trash.CultoTrashSQLTests.call
    change=trash.CultoTrashSQLTests.change

    def test_temporal_export_preserves_raw_values_includes_trash_and_no_personal_fields(self):
        first=copy.deepcopy(self.original)
        first['executions'][self.parent]['started']='2026-10-10T12:30:12.123456Z'
        first['actual_details'][self.parent]['subactivities']=[dict(self.child,start='09:31:17.123456',end='09:32:18.654321')]
        self.call(first,version=1)
        second=copy.deepcopy(first);second['id']='discardable-22';second['status']='Planejamento';second['plan']['date']='2026-10-22'
        second['executions']={};second['actual_details']={}
        for item in second['plan']['items']:
            item['planned_start']=item['planned_start'].replace('2026-10-10','2026-10-22')
            item['planned_end']=item['planned_end'].replace('2026-10-10','2026-10-22')
        second['planned_start']=second['planned_start'].replace('2026-10-10','2026-10-22')
        second['planned_end']=second['planned_end'].replace('2026-10-10','2026-10-22')
        self.call(second);self.change(identifier=second['id'])
        before=self.sql('select jsonb_agg(to_jsonb(p) order by id) from public.iasdpi_programs p')
        query=(base.ROOT/'database/check_saved_time_compatibility.sql').read_text().rstrip().rstrip(';')
        result=self.sql('begin read only;select jsonb_agg(to_jsonb(snapshot)) from ('+query+') snapshot;commit;')
        rows=json.loads(result);self.assertEqual(len(rows),2)
        a,b=rows
        self.assertEqual((a['data_culto'],a['status'],a['na_lixeira']),('2026-10-10','Finalizada',False))
        self.assertEqual((b['data_culto'],b['status'],b['na_lixeira']),('2026-10-22','Planejamento',True))
        times={tuple(field['caminho']):field['valor'] for field in a['campos_temporais']}
        self.assertEqual(times[('executions',self.parent,'started')],'2026-10-10T12:30:12.123456Z')
        self.assertEqual(times[('actual_details',self.parent,'subactivities','0','start')],'09:31:17.123456')
        self.assertEqual(len(a['assinatura_conteudo']),64)
        self.assertNotIn('responsible',result);self.assertNotIn('Observação',result)
        self.assertEqual(self.sql('select jsonb_agg(to_jsonb(p) order by id) from public.iasdpi_programs p'),before)
