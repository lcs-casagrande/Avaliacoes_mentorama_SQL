"""021 em PostgreSQL descartável: classificação independente e feeds autorizados."""
import json,uuid,unittest
import test_events_sql as events
import test_g9_lifecycle_sql as g9
import test_user_management_sql as base
import test_church_isolation_sql as g1
D=g9.D;M=g9.M
@unittest.skipUnless(base.CONTAINER,'Requer PostgreSQL descartável, sem rede')
class CalendarPrivacySQLTests(unittest.TestCase):
    setUpClass=classmethod(events.EventSQLTests.setUpClass.__func__)
    sql=events.EventSQLTests.sql;command=events.EventSQLTests.command;quote=staticmethod(events.EventSQLTests.quote);rpc=events.EventSQLTests.rpc;grant=events.EventSQLTests.grant;snapshot=events.EventSQLTests.snapshot;service=events.EventSQLTests.service
    event=events.EventSQLTests.event;save=events.EventSQLTests.save;public=events.EventSQLTests.public
    person=g9.G9LifecycleSQLTests.person;plan=g9.G9LifecycleSQLTests.plan
    def setUp(self):
        events.EventSQLTests.setUp(self);self.sql((base.ROOT/'database/021_calendar_classification_privacy.sql').read_text())
    test_concurrent_updates_only_one_wins_and_keeps_other_fields=events.EventSQLTests.test_concurrent_updates_only_one_wins_and_keeps_other_fields
    test_idempotent_retry_and_revocation_are_revalidated=events.EventSQLTests.test_idempotent_retry_and_revocation_are_revalidated
    def test_general_restricted_never_returns_title_location_description_to_anon(self):
        e=self.event({'program_category':'general','organizer_kind':'local_church','audience':'whole_church','is_restricted':True,'title':'SEGREDO fictício','location':'LOCAL PRIVADO','description':'DESCRIÇÃO PRIVADA','source_key':'ORIGEM-PRIVADA','source_url':'https://iasd-paradainglesa.netlify.app/'})
        e=self.save(e,{'status':'published'});pub=json.dumps(self.public());self.assertNotIn('SEGREDO',pub);self.assertNotIn('PRIVADO',pub);self.assertNotIn(e['id'],pub);self.assertNotIn('ORIGEM-PRIVADA',pub)
        self.assertEqual(self.rpc('iasdpi_events_visible',['2031-01-01'])['events'][0]['title'],'SEGREDO fictício')
        self.sql("select public.iasdpi_events_visible('2031-01-01')",anonymous=True,fail=True)
    def test_reserved_category_can_be_public_and_checkbox_is_independent(self):
        e=self.event({'program_category':'reserved','organizer_kind':'school','audience':'restricted'});self.save(e,{'status':'published'});self.assertEqual(self.public()['events'][0]['program_category'],'reserved')
    def test_restricting_draft_hides_previous_publication_and_unrestricting_needs_publish(self):
        e=self.save(self.event(),{'status':'published'});self.assertEqual(len(self.public()['events']),1)
        d=self.save(e,{'is_restricted':True,'status':'draft'});self.assertEqual(self.public()['events'],[])
        p=self.save(d,{'status':'published'});d=self.save(p,{'is_restricted':False,'status':'draft'});self.assertEqual(self.public()['events'],[])
        self.save(d,{'status':'published'});self.assertEqual(len(self.public()['events']),1);self.assertEqual(len(self.rpc('iasdpi_event_history',[e['id']])),6)
    def test_old_snapshots_and_unknown_classification_are_preserved(self):
        # Simula fotografia 020, anterior aos campos novos, sem alterar o original de produção.
        e=self.event();self.save(e,{'status':'published'});self.sql("update public.iasdpi_event_versions set snapshot=snapshot-'program_category'-'organizer_kind'-'audience'-'is_restricted'-'organizer_department_id'")
        row=self.public()['events'][0];self.assertNotIn('program_category',row);self.assertEqual(row['id'],e['id']);self.assertEqual(self.snapshot()['core_fingerprints'],self.before['core_fingerprints'])
    def test_classification_or_organizer_never_grants_another_department(self):
        self.grant(user=base.U,dept=D,flags={'view':True,'edit':True,'publish':True})
        e=self.event({'category':'department','department_id':D,'program_category':'general','organizer_kind':'association','is_restricted':True},base.U);e=self.save(e,{'status':'published'},base.U)
        self.assertEqual(len(self.rpc('iasdpi_events_visible',['2031-01-01'],base.U)['events']),1)
        self.save(e,{'department_id':M,'organizer_kind':'local_church'},base.U,True)
        self.grant(user=base.V,dept=M,flags={'view':True});self.assertEqual(self.rpc('iasdpi_events_visible',['2031-01-01'],base.V)['events'],[])
    def test_enums_null_restriction_cross_church_and_partial_precision(self):
        e=self.event({'start_time':'09:30:01.123456','is_restricted':True,'program_category':'departmental'})
        for patch in [{'program_category':'local'},{'organizer_kind':'invalid'},{'audience':'invalid'},{'is_restricted':None},{'organizer_kind':'school','organizer_department_id':D}]:self.save(e,patch,fail=True)
        e=self.save(e,{'title':'Alteração parcial'});self.assertEqual(e['start_time'],'09:30:01.123456');self.assertTrue(e['is_restricted'])
        g1.ChurchIsolationSQLTests.other(self);self.church='TEST_ONLY';self.assertEqual(self.rpc('iasdpi_events_visible',['2031-01-01'],base.B)['events'],[])
    def test_other_department_schedule_requires_authorized_login(self):
        p=self.person();plan=self.plan(p);self.rpc('iasdpi_schedule_plan_save',[plan['id'],1,{'status':'published'},str(uuid.uuid4())])
        pub=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertEqual(pub,[])
        self.sql("select public.iasdpi_schedule_visible('2031-01-01')",anonymous=True,fail=True)
        self.assertEqual(len(self.rpc('iasdpi_schedule_visible',['2031-01-01'])),1)
        self.grant(user=base.U,dept=M,flags={'view':True});self.assertEqual(self.rpc('iasdpi_schedule_visible',['2031-01-01'],base.U),[])
        self.grant(user=base.U,dept=D,flags={'view':True});self.assertEqual(len(self.rpc('iasdpi_schedule_visible',['2031-01-01'],base.U)),1)
    def test_elder_periods_remain_public(self):
        e=g9.E;p=self.person('Ancião sintético',(e,));w=self.rpc('iasdpi_schedule_elder_workspace',[e,'2031-01-01',2031]);r=next(r for r in w['periods'] if r['kind']=='weekly');row={k:r[k] for k in ['id','kind','starts_on','ends_on']};row.update(person_id=p,expected_version=r['version']);self.rpc('iasdpi_schedule_elder_save',[e,'published',[row],str(uuid.uuid4())])
        rows=json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True));self.assertEqual(rows[0]['person'],'Ancião sintético');self.assertEqual(rows[0]['kind'],'weekly')
    def test_legacy_rows_reuse_central_ids_and_are_not_public(self):
        p=self.person();row={'source_key':'legacy:synthetic:2031-01-01','person_id':p,'department_id':D,'date':'2031-01-01','original_name':'Nome histórico sintético'}
        self.rpc('iasdpi_schedule_register_legacy',[[row],str(uuid.uuid4())]);rows=self.rpc('iasdpi_schedule_visible',['2031-01-01']);self.assertEqual(rows[0]['id'],row['source_key']);self.assertEqual(rows[0]['person_id'],p)
        self.assertEqual(json.loads(self.sql("select public.iasdpi_schedule_published('2031-01-01')",anonymous=True)),[])
    def test_registry_public_no_longer_discloses_private_assignment_source_keys(self):
        p=self.person();self.rpc('iasdpi_registry_source_save',['legacy:Sonoplastia:2031-01-01:Privado',p,0,str(uuid.uuid4()),{}]);c=json.loads(self.sql('select public.iasdpi_registry_public()',anonymous=True));self.assertNotIn('legacy:Sonoplastia',json.dumps(c))
    def test_private_helpers_and_direct_writes_remain_denied(self):
        for sig in ['iasdpi_schedule_private.calendar_events_feed(date,boolean)','iasdpi_schedule_private.published_before_privacy(date)','iasdpi_schedule_private.registry_before_privacy()']:
            self.assertEqual(self.sql("select has_function_privilege('authenticated',%s,'execute')"%self.quote(sig)),'f')
        self.sql('select * from public.iasdpi_events',anonymous=True,fail=True);self.sql('update public.iasdpi_events set is_restricted=false',actor=base.A,fail=True)
        self.assertEqual(self.sql((base.ROOT/'database/check_calendar_privacy.sql').read_text()),'')
