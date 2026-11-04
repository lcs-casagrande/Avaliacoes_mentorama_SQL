"""G8.3: auditoria verificável e correções mínimas em PostgreSQL descartável."""
import json,unittest,uuid,subprocess
import test_registry_integration_sql as g82
import test_user_management_sql as base
import test_church_isolation_sql as g1
D=g82.D;M=g82.M
class ConsolidatedRegistryMixin(g82.RegistryMixin):
    @classmethod
    def setUpClass(cls):
        super().setUpClass();p=cls('runTest');p.sql((base.ROOT/'database/018_registry_search.sql').read_text(),database=cls.template16)

@unittest.skipUnless(base.CONTAINER,'Exige PostgreSQL descartável --network none')
class RegistryConsolidationSQLTests(ConsolidatedRegistryMixin,g82.RegistryIntegrationSQLTests):
    def test_search_preferred_name_accents_spaces_and_literal_wildcards(self):
        p=self.person();self.save(p,patch={'name':'Nome completo da pessoa','display_name':'  Apelido Árvore  '})
        for term in ['apelido arvore','ÁRVORE','  nome  completo ']:
            self.assertIn(p,[r['id'] for r in self.rpc('iasdpi_registry_people',[term])])
        self.assertEqual(self.rpc('iasdpi_registry_people',['%']),[]);self.rpc('iasdpi_registry_people',[None],fail=True)
    def test_active_status_and_unlinked_person_keep_identity_and_history(self):
        p=self.person();self.assertEqual(self.sql("select count(*) from public.schedule_memberships where person_id='%s'"%p),'0');self.save(p,patch={'active':False});inactive=next(r for r in self.rpc('iasdpi_registry_people',['']) if r['id']==p);self.assertFalse(inactive['active']);self.save(p,patch={'active':True});self.assertTrue(next(r for r in self.rpc('iasdpi_registry_people',['']) if r['id']==p)['active']);self.assertEqual(self.sql("select count(*) from public.schedule_people where id='%s'"%p),'1')
    def test_optional_contacts_admin_only_and_absent_from_all_projections(self):
        p=self.person();self.link(p);self.rpc('iasdpi_schedule_save',['person',p,1,{'contact':'contato-privado-ficticio','notes':'nota-privada-ficticia'},str(uuid.uuid4())]);self.assertEqual(self.rpc('iasdpi_schedule_person_details',[p])['contact'],'contato-privado-ficticio')
        self.grant(flags={'view':True,'members':True});self.rpc('iasdpi_schedule_person_details',[p],base.U,True);self.sql("select public.iasdpi_schedule_person_details('%s')"%p,anonymous=True,fail=True)
        for payload in [self.rpc('iasdpi_registry_people',[''],base.U),self.rpc('iasdpi_registry_catalog',[],base.U),self.rpc('iasdpi_registry_catalog',[]),json.loads(self.sql('select public.iasdpi_registry_public()',anonymous=True))]:
            self.assertNotIn('contato-privado-ficticio',json.dumps(payload));self.assertNotIn('nota-privada-ficticia',json.dumps(payload))
        self.sql('select * from iasdpi_schedule_private.person_details',actor=base.U,fail=True)
    def test_search_requires_authorization_and_does_not_cross_church(self):
        p=self.person();self.rpc('iasdpi_registry_people',[''],base.U,True);self.sql("select public.iasdpi_registry_people('')",anonymous=True,fail=True)
        self.sql("insert into public.iasdpi_churches(id,code,name,active,listed) values('%s','OTHER','Igreja fictícia',true,true);insert into public.iasdpi_access(church_id,user_id,role) values('%s','%s','admin')"%(g1.OTHER,g1.OTHER,base.B));self.church='OTHER';self.assertEqual(self.rpc('iasdpi_registry_people',[''],base.B),[]);self.rpc('iasdpi_schedule_person_details',[p],base.B)
        self.assertIsNone(self.rpc('iasdpi_schedule_person_details',[p],base.B));self.church='IASD_PI';self.assertIn(p,[r['id'] for r in self.rpc('iasdpi_registry_people',[''])])
    def test_018_preserves_all_existing_data_and_table_inventory(self):
        # Exercita a migração novamente: função idempotente, nenhum dado/tabela alterado.
        p=self.person();self.link(p);tables=self.sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth') or schemaname like 'iasdpi_%' order by 1").splitlines()
        digest=lambda t:self.sql("select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text) from "+t+' x')
        before={t:digest(t) for t in tables};self.sql((base.ROOT/'database/018_registry_search.sql').read_text());self.assertEqual(before,{t:digest(t) for t in tables})
        self.assertEqual(self.sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='schedule_people' and c.relkind='r'"),'1')
