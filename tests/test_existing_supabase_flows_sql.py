"""Fluxos integrados sobre 026 em PostgreSQL descartável, Auth e dados sintéticos."""
import json
import unittest
import uuid
import test_g10_3_governance_sql as governance
import test_g9_lifecycle_sql as lifecycle
import test_user_management_sql as base


@unittest.skipUnless(base.CONTAINER, 'Exige PostgreSQL descartável sem rede')
class ExistingSupabaseFlowsSQLTests(unittest.TestCase):
    setUpClass = classmethod(governance.G103GovernanceSQLTests.setUpClass.__func__)
    setUp = governance.G103GovernanceSQLTests.setUp
    sql = governance.G103GovernanceSQLTests.sql
    command = governance.G103GovernanceSQLTests.command
    quote = staticmethod(governance.G103GovernanceSQLTests.quote)
    rpc = governance.G103GovernanceSQLTests.rpc
    grant = governance.G103GovernanceSQLTests.grant
    service = governance.G103GovernanceSQLTests.service
    snapshot = governance.G103GovernanceSQLTests.snapshot
    install = governance.G103GovernanceSQLTests.install
    data = governance.G103GovernanceSQLTests.data
    public = governance.G103GovernanceSQLTests.public

    def test_central_person_three_departments_draft_publish_rename_and_stale_edit(self):
        person = lifecycle.G9LifecycleSQLTests.person(self, 'Pessoa sintética da integração',
                                                   (lifecycle.D, lifecycle.M, lifecycle.E))
        self.assertEqual(self.sql(f"select count(*) from public.schedule_memberships where person_id='{person}'"), '3')
        plan = lifecycle.G9LifecycleSQLTests.plan(self, person, day=str(self.today))
        self.assertEqual(plan['status'], 'draft')
        self.assertEqual(self.rpc('iasdpi_schedule_visible', [str(self.first)]), [])
        published = self.rpc('iasdpi_schedule_plan_save',
                             [plan['id'], plan['version'], {'status': 'published'}, str(uuid.uuid4())])
        self.assertTrue(self.rpc('iasdpi_schedule_visible', [str(self.first)]))
        self.rpc('iasdpi_schedule_plan_save',
                 [plan['id'], plan['version'], {'title': 'Edição desatualizada'}, str(uuid.uuid4())], fail=True)
        version = int(self.sql(f"select version from public.schedule_people where id='{person}'"))
        self.rpc('iasdpi_registry_save', [person, version, {'name': 'Nome sintético atualizado'}, [], str(uuid.uuid4())])
        feed = self.rpc('iasdpi_schedule_visible', [str(self.first)])
        self.assertTrue(any(row['person'] == 'Nome sintético atualizado' for row in feed))
        self.assertEqual(self.sql(f"select count(*) from public.schedule_memberships where person_id='{person}'"), '3')
        self.assertEqual(self.sql(f"select version from public.schedule_plans where id='{published['id']}'"), str(published['version']))
        self.assertTrue(self.rpc('iasdpi_registry_history', [person, lifecycle.D])['versions'])
        self.assertEqual(self.snapshot()['core_fingerprints'], self.before)
        self.assertEqual(self.sql('select count(*) from auth.users'), '7')

    def test_event_draft_publication_private_revision_cancellation_and_audit(self):
        identity = str(uuid.uuid4())
        data = self.data(title='Evento sintético integrado', status='draft')
        event = self.rpc('iasdpi_event_submit', [identity, 0, data, str(uuid.uuid4()), False])['event']
        month = event['date'][:7] + '-01'
        self.assertFalse(any(row['id'] == identity for row in self.public(month)['events']))
        event = self.rpc('iasdpi_event_submit', [identity, event['version'], {'status': 'published'}, str(uuid.uuid4()), False])['event']
        self.assertTrue(any(row['id'] == identity for row in self.public(month)['events']))
        event = self.rpc('iasdpi_event_submit', [identity, event['version'],
                         {'status': 'draft', 'title': 'Revisão sintética privada'}, str(uuid.uuid4()), False])['event']
        self.assertNotIn('Revisão sintética privada', json.dumps(self.public(month)))
        event = self.rpc('iasdpi_event_submit', [identity, event['version'], {'status': 'cancelled'}, str(uuid.uuid4()), False])['event']
        self.assertEqual(event['status'], 'cancelled')
        self.assertFalse(any(row['id'] == identity for row in self.public(month)['events']))
        self.assertGreaterEqual(len(self.rpc('iasdpi_event_history', [identity])), 4)
        self.assertTrue(self.rpc('iasdpi_governance_history', [0]))
        self.rpc('iasdpi_event_history', [identity], base.U, True)
        self.assertEqual(self.snapshot()['core_fingerprints'], self.before)
