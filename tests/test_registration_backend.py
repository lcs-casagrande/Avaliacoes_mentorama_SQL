"""Contrato de edição: SQLite temporário, sem rede, sem bancos reais."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import server

class RegistrationBackendTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(prefix='iasdpi-edit-db-')
        self.patcher=patch.object(server,'DB_PATH',Path(self.directory.name)/'test.sqlite3')
        self.patcher.start();server.initialize()
        model=json.loads((server.ROOT/'backend/chronogram.json').read_text())
        model['date']='2026-10-10';model['items'][7]['activity']='Doxologia I'
        self.plan=server.validate_plan(model)
        with server.database() as con:
            con.execute('INSERT INTO programs(id,plan,status,execution_mode) VALUES (?,?,?,?)',('record-10',json.dumps(self.plan),'Planejamento','manual'))
            self.original=server.load(con,'record-10')
        self.parent=self.plan['items'][0]['id']
        self.body={'version':1,'executions':{i['id']:{'start':i['start'],'end':i['end']} for i in self.plan['items']},'finalize':True}
        self.child={'id':'child','parent_id':self.parent,'title':'Detalhe','start':'09:31:17','end':'09:34:18','note':'Nota','responsible':'Equipe'}

    def tearDown(self):
        self.patcher.stop();self.directory.cleanup()

    def save(self,body):
        with server.database() as con:return server.save_actuals(con,server.load(con,'record-10'),body)

    def read(self):
        with server.database() as con:return server.load(con,'record-10')

    def test_edit_keeps_identifier_model_order_and_optional_metadata(self):
        self.body['executions'][self.parent]['subactivities']=[self.child]
        self.body.update(record_name='Culto revisado',record_info='Complemento',plan={'items':[]},start='00:00')
        saved=self.save(self.body)
        self.assertEqual(saved['id'],'record-10');self.assertEqual(saved['plan']['items'],self.original['plan']['items'])
        self.assertEqual(saved['plan']['start'],'09:30');self.assertEqual(saved['plan']['items'][7]['activity'],'Doxologia I')
        self.assertEqual(saved['actual_details'][self.parent]['subactivities'],[self.child])
        self.assertEqual(saved['record_info'],'Complemento');self.assertEqual(saved['plan']['name'],'Culto revisado')
        self.assertEqual(self.read(),saved)

    def test_invalid_child_range_parent_and_parent_change_roll_back_everything(self):
        saved=self.save(self.body)
        for update in [{'parent_id':'other'},{'start':'09:29:59'},{'end':'09:35:01'}]:
            body=copy.deepcopy(self.body);body['version']=saved['version'];child=dict(self.child,**update)
            body['executions'][self.parent]['subactivities']=[child]
            with self.assertRaises(server.Problem):self.save(body)
            self.assertEqual(self.read(),saved)
        body=copy.deepcopy(self.body);body['version']=saved['version'];body['executions'][self.parent].update(end='09:32',subactivities=[self.child])
        with self.assertRaises(server.Problem):self.save(body)
        self.assertEqual(self.read(),saved)

    def test_child_delete_and_old_client_omission_are_distinct(self):
        self.body['executions'][self.parent]['subactivities']=[self.child]
        saved=self.save(self.body)
        body=copy.deepcopy(self.body);body['version']=saved['version'];del body['executions'][self.parent]['subactivities']
        saved=self.save(body)
        self.assertEqual(saved['actual_details'][self.parent]['subactivities'],[self.child])
        body['version']=saved['version'];body['executions'][self.parent]['subactivities']=[]
        saved=self.save(body);self.assertEqual(saved['actual_details'][self.parent]['subactivities'],[])

    def test_same_record_date_correction_and_stale_version_no_duplicate(self):
        body=copy.deepcopy(self.body);body['record_date']='2026-10-17'
        saved=self.save(body)
        self.assertEqual(saved['id'],'record-10');self.assertEqual(saved['plan']['date'],'2026-10-17')
        self.assertTrue(all(e['started'].startswith('2026-10-17') for e in saved['executions'].values()))
        self.assertEqual([i['start'] for i in saved['plan']['items']],[i['start'] for i in self.original['plan']['items']])
        with self.assertRaises(server.Problem):self.save(body)
        with server.database() as con:self.assertEqual(con.execute('select count(*) from programs').fetchone()[0],1)

    def test_not_performed_and_optional_child_times(self):
        self.body['executions'][self.parent]={'start':'','end':'','status':'nao_realizada','subactivities':[dict(self.child,start='',end='')]}
        with self.assertRaises(server.Problem):self.save(self.body)
        self.body['finalize']=False
        saved=self.save(self.body)
        self.assertNotIn(self.parent,saved['executions'])
        self.assertEqual(saved['actual_details'][self.parent]['status'],'nao_realizada')
        self.assertEqual(saved['status'],'Em andamento')

    def test_exact_fractional_timestamps_status_and_children_survive_unrelated_save(self):
        saved=self.save(self.body)
        first='2026-10-10T12:30:00.123456Z';last='2026-10-10T09:35:00.654321-03:00'
        with server.database() as con:
            con.execute('UPDATE executions SET started=?,ended=? WHERE program_id=? AND item_id=?',(first,last,'record-10',self.parent))
            details=saved['actual_details'];details[self.parent]['status']='nao_realizada'
            con.execute('UPDATE programs SET actual_details=? WHERE id=?',(json.dumps(details),'record-10'))
        self.body['version']=saved['version']
        self.body['executions'][self.parent].update(start='09:30:00.123456',end='09:35:00.654321',note='Edição')
        self.body['executions'][self.parent]['subactivities']=[dict(self.child,start='09:31:17.123456',end='09:34:18.654321')]
        saved=self.save(self.body)
        self.assertEqual(saved['executions'][self.parent],{'item_id':self.parent,'started':first,'ended':last})
        self.assertEqual(saved['actual_details'][self.parent]['status'],'nao_realizada')
        self.assertEqual(saved['actual_details'][self.parent]['subactivities'][0]['start'],'09:31:17.123456')

    def test_end_only_partial_record_survives_reload_without_fake_start(self):
        self.body['finalize']=False
        self.body['executions'][self.parent]={'start':'','end':'09:35:17'}
        saved=self.save(self.body)
        self.assertNotIn(self.parent,saved['executions'])
        self.assertEqual(saved['actual_details'][self.parent]['partial_end'],'09:35:17')
        self.assertEqual(self.read(),saved)
        self.body.update(version=saved['version'],finalize=True)
        with self.assertRaises(server.Problem):self.save(self.body)
        self.assertEqual(self.read(),saved)

    def test_free_empty_program_can_save_but_cannot_finalize(self):
        body={'name':'Livre','date':'2026-10-21','execution_mode':'manual','template_id':'free','start':'','end':'','items':[],'team':{}}
        plan=server.validate_plan(body)
        self.assertEqual(plan['items'],[])
        with server.database() as con:
            con.execute('INSERT INTO programs(id,plan,status,execution_mode) VALUES (?,?,?,?)',('free-record',json.dumps(plan),'Planejamento','manual'))
            p=server.load(con,'free-record')
            self.assertIsNone(p['planned_start']);self.assertIsNone(p['planned_end'])
            saved=server.save_actuals(con,p,{'version':1,'executions':{},'record_date':'2026-10-10'})
            self.assertEqual(saved['id'],'free-record');self.assertEqual(saved['plan']['date'],'2026-10-10')
            self.assertEqual(saved['plan']['items'],[])
        with self.assertRaises(server.Problem),server.database() as con:
            server.save_actuals(con,server.load(con,'free-record'),{'version':saved['version'],'executions':{},'finalize':True})
        with server.database() as con:
            self.assertEqual(server.load(con,'free-record')['version'],2)
        for invalid in [dict(body,execution_mode='live'),dict(body,template_id='unknown'),dict(body,start='09:30')]:
            with self.assertRaises(server.Problem):server.validate_plan(invalid)
