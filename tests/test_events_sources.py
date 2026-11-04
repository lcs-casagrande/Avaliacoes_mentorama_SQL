"""IDs reais autorizados, conciliação exata e pacote E1 sem rede externa."""
import copy,json,subprocess,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import sync_agenda
import prepare_integrated_review as review
import build_schedule_demo

class EventSourceTests(unittest.TestCase):
    def source(self):return json.loads((ROOT/'frontend/agenda-data.js').read_text().split('=',1)[1].strip().rstrip(';'))
    def test_checked_source_preserves_all_existing_ids_and_october_events(self):
        v=json.loads((ROOT/'data/e1-source-review.json').read_text());source=self.source()
        self.assertEqual(v['records_checked'],len(source['events']));self.assertTrue(v['content_matches_existing_snapshot']);self.assertEqual(v['october_2026_events'],17)
        self.assertEqual(v['source'],'https://iasd-paradainglesa.netlify.app/');self.assertFalse(v['database_import_executed'])
        self.assertEqual(len({e['id'] for e in source['events']}),len(source['events']))
    def test_exact_equivalent_new_uids_reuse_previous_ids_without_changing_times(self):
        old=self.source();new=copy.deepcopy(old)
        for i,e in enumerate(new['events']):e['id']='new-source-id-'+str(i)
        sync_agenda.preserve_event_ids(new,old);self.assertEqual(new['events'],old['events'])
    def test_ambiguous_correspondence_is_not_guessed(self):
        source=self.source();row=copy.deepcopy(source['events'][0]);other={**row,'id':'another-id'}
        original=copy.deepcopy(source)
        with self.assertRaisesRegex(ValueError,'ambígua'):sync_agenda.preserve_event_ids({'events':[copy.deepcopy(row)]},{'events':[row,other]})
        self.assertEqual(source,original)
    def test_changed_time_is_not_silently_matched(self):
        old=self.source();new=copy.deepcopy(old);new['events'][0]['id']='different';new['events'][0]['title']='Mudança efetiva da origem'
        sync_agenda.preserve_event_ids(new,old);self.assertEqual(new['events'][0]['id'],'different');self.assertEqual(old,self.source())
    def test_source_review_aliases_only_reference_existing_ids(self):
        v=json.loads((ROOT/'data/e1-source-review.json').read_text());ids={e['id'] for e in self.source()['events']}
        self.assertEqual(len(v['ids_changed_in_source_but_exactly_matched']),21)
        self.assertTrue(all(e['preserved_id'] in ids for e in v['ids_changed_in_source_but_exactly_matched']))
    def test_e1_package_preserves_previous_integrated_preview_and_has_only_fake_auth(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);old=root/'old';build_schedule_demo.build(old,calendar_preview=True)
            subprocess.run(['git','init','-q',str(old)],check=True,capture_output=True);subprocess.run(['git','add','.'],cwd=old,check=True,capture_output=True)
            previous=root/'previous';review.prepare(previous,old)
            subprocess.run(['git','init','-q',str(previous)],check=True,capture_output=True);subprocess.run(['git','add','.'],cwd=previous,check=True,capture_output=True)
            final=root/'final';m=review.prepare(final,previous,events=True);review.validate(final/'integrada')
            self.assertTrue(m['events']);self.assertEqual(m['excluded'],[]);self.assertIn('events',m['features'])
            for name in ['index.html','LEIA-ME.md','manifest.json']:self.assertEqual((previous/'integrada'/name).read_bytes(),(final/'integrada-g84'/name).read_bytes())
            for name in ['styles.css','demo.js','.nojekyll']:self.assertEqual((old/name).read_bytes(),(final/name).read_bytes())
            html=(final/'integrada/index.html').read_text()
            for name in ['admin','som','musica','anciao','multi','leitura']:self.assertIn(name+'.iasdpi',html);self.assertNotIn(name+'.teste',html)
            self.assertIn("connect-src 'none'",html);self.assertIn('Acesso simulado',html);self.assertNotIn('pwbxksxxmnblqwpvlheu',html)
