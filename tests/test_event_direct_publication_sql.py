"""025: publicação direta, sem reduzir permissões ou proteção das reservas."""
import json,unittest,uuid
import test_event_planning_sql as old
import test_schedule_publication_rules_sql as rules
import test_user_management_sql as base
D=old.D;M=old.M
@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável sem rede')
class EventDirectPublicationSQLTests(unittest.TestCase):
 setUpClass=classmethod(rules.SchedulePublicationRulesSQLTests.setUpClass.__func__)
 sql=old.EventPlanningSQLTests.sql;command=old.EventPlanningSQLTests.command;quote=staticmethod(old.EventPlanningSQLTests.quote);rpc=old.EventPlanningSQLTests.rpc;grant=old.EventPlanningSQLTests.grant;public=old.EventPlanningSQLTests.public;snapshot=old.EventPlanningSQLTests.snapshot;service=old.EventPlanningSQLTests.service
 data=old.EventPlanningSQLTests.data;event=old.EventPlanningSQLTests.event;series=old.EventPlanningSQLTests.series
 def setUp(self):
  rules.SchedulePublicationRulesSQLTests.setUp(self);self.install()
 def install(self):self.sql((base.ROOT/'database/025_event_direct_publication.sql').read_text())
 def undo(self,fail=False):self.sql((base.ROOT/'database/025_event_direct_publication_down.sql').read_text(),fail=fail)
 def test_general_publishes_directly_and_remains_visible_after_draft_revision(self):
  e=self.event(program_category='general',category='church',department_id=None,organizer_kind='local_church',organizer_department_id=None)
  self.assertEqual((e['status'],e['approval_status']),('published','not_required'));self.assertEqual(self.public(e['date'][:7]+'-01')['events'][0]['id'],e['id'])
  self.rpc('iasdpi_event_submit',[e['id'],e['version'],{'title':'Revisão privada','status':'draft'},str(uuid.uuid4()),False]);self.assertNotEqual(self.public(e['date'][:7]+'-01')['events'][0]['title'],'Revisão privada')
 def test_pending_event_can_publish_explicitly_preserving_old_snapshot(self):
  self.undo();e=self.event(program_category='general');self.assertEqual(e['status'],'draft');before=self.sql("select snapshot::text from public.iasdpi_event_versions where event_id='%s'"%e['id']);self.install()
  self.assertEqual(self.public(e['date'][:7]+'-01')['events'],[]);self.assertEqual(before,self.sql("select snapshot::text from public.iasdpi_event_versions where event_id='%s'"%e['id']))
  p=self.rpc('iasdpi_event_submit',[e['id'],1,{'status':'published'},str(uuid.uuid4()),False])['event'];self.assertEqual(p['status'],'published');self.assertEqual(p['id'],e['id']);self.assertEqual(len(self.rpc('iasdpi_event_history',[e['id']])),2)
 def test_pending_series_can_publish_without_losing_occurrence_ids(self):
  self.undo();s=self.series(self.data(program_category='general',recurrence='weekly',recurrence_weekday=6));self.assertTrue(all(e['status']=='draft' for e in s['events']));self.install()
  p=self.series({'status':'published'},identity=s['series']['id'],version=1);self.assertEqual(p['series']['approval_status'],'not_required');self.assertEqual({e['id'] for e in p['events']},{e['id'] for e in s['events']});self.assertTrue(all(e['status']=='published' for e in p['events']));self.assertTrue(self.public(p['events'][0]['date'][:7]+'-01')['events'])
 def test_department_leader_can_publish_general_for_own_department_only(self):
  self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True});e=self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(program_category='general'),str(uuid.uuid4()),False],base.U)['event'];self.assertEqual(e['status'],'published')
  for patch in [self.data(department_id=M),self.data(category='church',department_id=None)]:self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,patch,str(uuid.uuid4()),False],base.U,True)
 def test_edit_only_cannot_publish_or_forge_approval(self):
  self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':False});e=self.rpc('iasdpi_event_submit',[str(uuid.uuid4()),0,self.data(status='draft',program_category='general'),str(uuid.uuid4()),False],base.U)['event']
  for patch in [{'status':'published'},{'approval_status':'approved'}]:self.rpc('iasdpi_event_submit',[e['id'],1,patch,str(uuid.uuid4()),True],base.U,True)
 def test_draft_with_conflict_can_save_but_never_reserve_or_publish(self):
  e=self.event();draft=self.event(title='Rascunho conflitante',status='draft',program_category='general');self.assertEqual(draft['status'],'draft');self.assertTrue(draft['reservation_conflicts']);self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'1')
  self.rpc('iasdpi_event_submit',[draft['id'],draft['version'],{'status':'published'},str(uuid.uuid4()),True],fail=True)
  self.assertEqual(len(self.public(e['date'][:7]+'-01')['events']),1)
 def test_series_conflict_draft_then_resolved_publication_is_atomic(self):
  self.event();data=self.data(title='Série conflitante 025',recurrence='weekly',recurrence_weekday=6)
  self.rpc('iasdpi_event_series_save',[str(uuid.uuid4()),0,data,str(uuid.uuid4()),'all',None,True],fail=True);self.assertEqual(self.sql('select count(*) from public.iasdpi_event_series'),'0')
  data['status']='draft';draft=self.series(data);self.assertGreater(draft['conflict_count'],0);self.assertTrue(all(e['status']=='draft' for e in draft['events']));self.assertEqual(self.sql('select count(*) from public.iasdpi_event_reservations'),'1')
  p=self.series({'spaces':['salas'],'status':'published'},identity=draft['series']['id'],version=1);self.assertTrue(all(e['status']=='published' for e in p['events']))
 def test_self_overlap_blocks_series_even_with_accept_conflicts(self):
  data=self.data(end_date=self.data()['date'][:8]+'20',recurrence='weekly',recurrence_weekday=6,program_category='general')
  self.rpc('iasdpi_event_series_save',[str(uuid.uuid4()),0,data,str(uuid.uuid4()),'all',None,True],fail=True);self.assertEqual(self.sql('select count(*) from public.iasdpi_events'),'0')
 def test_restricted_general_event_stays_private_after_direct_publication(self):
  e=self.event(program_category='general',is_restricted=True);self.assertEqual(e['status'],'published');self.assertEqual(self.public(e['date'][:7]+'-01')['events'],[])
 def test_rollback_empty_restores_previous_behavior_and_refuses_after_writes(self):
  before=self.snapshot()['core_fingerprints'];self.undo();self.assertEqual(before,self.snapshot()['core_fingerprints']);self.assertNotIn('event_approval_required',self.rpc('iasdpi_events_catalog',[]));self.install();e=self.event(program_category='general');self.undo(fail=True);self.assertEqual(self.public(e['date'][:7]+'-01')['events'][0]['id'],e['id'])
 def test_catalog_capability_and_private_backups(self):
  self.assertFalse(self.rpc('iasdpi_events_catalog',[])['event_approval_required']);self.assertEqual(self.sql((base.ROOT/'database/check_event_direct_publication.sql').read_text()),'')
 test_concurrent_saves_cannot_double_reserve_same_space=old.EventPlanningSQLTests.test_concurrent_saves_cannot_double_reserve_same_space
 test_edit_following_all_and_cancel_one_preserve_ids_history=old.EventPlanningSQLTests.test_edit_following_all_and_cancel_one_preserve_ids_history
 test_conflict_does_not_leak_unpublished_revision_title=old.EventPlanningSQLTests.test_conflict_does_not_leak_unpublished_revision_title
 test_other_church_cannot_access_series_events_or_reservations=old.EventPlanningSQLTests.test_other_church_cannot_access_series_events_or_reservations
 test_microsecond_boundary_blocks_overlap_and_allows_exact_adjacency=old.EventPlanningSQLTests.test_microsecond_boundary_blocks_overlap_and_allows_exact_adjacency
