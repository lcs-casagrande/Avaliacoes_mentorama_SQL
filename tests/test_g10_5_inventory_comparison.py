"""Provas offline do comparador: não usa Supabase, Auth ou rede."""
import copy
import hashlib
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import compare_g10_5_inventory as review


class G105InventoryComparisonTests(unittest.TestCase):
    def setUp(self):
        self.source = {'schema': 'public', 'name': 'f', 'arguments': '', 'source': '\nSELECT 1;\n'}
        self.source['definition'] = 'CREATE FUNCTION public.f() RETURNS int AS $function$\nSELECT 1;\n$function$ LANGUAGE sql;\n'
        function = {'schema': 'public', 'name': 'f', 'arguments': '',
                    'definition_md5': hashlib.md5(self.source['definition'].encode()).hexdigest(),
                    'acl': [], 'execute': {'anon': False}}
        self.expected = {'format': 'IASDPI_G10_1_SCHEMA_INVENTORY', 'version': 1,
                         'functions': [function], 'relations': [], 'auth_primitives': {},
                         'migration_ledger': {'present': False},
                         **{key: [] for key in ('roles', 'markers', 'schemas', 'extensions', 'dependencies',
                                               'role_memberships', 'default_privileges', 'publications')}}

    def run_compare(self, observed):
        return review.compare(self.expected, observed, [self.source])

    def test_body_crlf_requires_exact_hash_of_full_definition(self):
        observed = copy.deepcopy(self.expected)
        body = self.source['source'].replace('\n', '\r\n')
        definition = self.source['definition'].replace(self.source['source'], body)
        observed['functions'][0]['definition_md5'] = hashlib.md5(definition.encode()).hexdigest()
        result = self.run_compare(observed)
        self.assertEqual(result['function_definition_proofs'][0]['status'], 'exact_full_definition_with_body_crlf')
        self.assertEqual(result['unresolved_function_definitions'], [])

    def test_changed_body_is_unresolved_instead_of_silently_normalized(self):
        observed = copy.deepcopy(self.expected)
        observed['functions'][0]['definition_md5'] = hashlib.md5(b'different SQL').hexdigest()
        self.assertEqual(self.run_compare(observed)['unresolved_function_definitions'], ['public.f()'])

    def test_matching_body_does_not_hide_extra_execute_privilege(self):
        observed = copy.deepcopy(self.expected)
        observed['functions'][0]['execute']['anon'] = True
        result = self.run_compare(observed)
        self.assertEqual(result['function_definition_proofs'][0]['status'], 'exact')
        self.assertEqual(result['functions']['changed']['public.f()'][0]['path'], '/execute/anon')
        self.assertFalse(result['fully_identical'])

    def test_missing_and_extra_objects_remain_visible(self):
        observed = copy.deepcopy(self.expected)
        observed['functions'][0]['name'] = 'other'
        result = self.run_compare(observed)
        self.assertEqual(result['functions']['missing'], ['public.f()'])
        self.assertEqual(result['functions']['extra'], ['public.other()'])

    def test_only_system_oid_names_are_normalized_in_dependencies(self):
        self.expected['dependencies'] = [{'object': 'trigger RI_ConstraintTrigger_a_123 on table x',
                                         'references': 'constraint business_123', 'type': 'i'}]
        observed = copy.deepcopy(self.expected)
        observed['dependencies'][0]['object'] = 'trigger RI_ConstraintTrigger_a_987 on table x'
        self.assertTrue(self.run_compare(observed)['dependencies']['equal_after_system_oid_name_normalization'])
        observed['dependencies'][0]['references'] = 'constraint business_987'
        self.assertFalse(self.run_compare(observed)['dependencies']['equal_after_system_oid_name_normalization'])

    def test_column_order_is_not_erased_by_acl_array_normalization(self):
        self.expected['relations'] = [{'name': 'public.t', 'columns': [{'name': 'a'}, {'name': 'b'}],
                                      **{key: [] for key in ('constraints', 'indexes', 'policies', 'triggers')}}]
        observed = copy.deepcopy(self.expected)
        observed['relations'][0]['columns'].reverse()
        self.assertEqual(self.run_compare(observed)['column_order_changed'], ['public.t'])

    def test_default_grants_are_reported_not_treated_as_environment_noise(self):
        observed = copy.deepcopy(self.expected)
        observed['default_privileges'] = [{'owner': 'postgres', 'grantee': 'anon', 'privilege': 'EXECUTE'}]
        self.assertTrue(self.run_compare(observed)['default_privilege_differences'])
        self.assertFalse(self.run_compare(observed)['installation_authorized'])

    def test_incomplete_or_duplicate_inventory_is_rejected(self):
        observed = copy.deepcopy(self.expected)
        del observed['default_privileges']
        with self.assertRaises(ValueError):
            self.run_compare(observed)
        observed = copy.deepcopy(self.expected)
        observed['functions'] *= 2
        with self.assertRaises(ValueError):
            self.run_compare(observed)
