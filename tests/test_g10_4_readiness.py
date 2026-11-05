"""G10.4: sequência de revisão e pacote seguro, sem acesso a banco ou rede."""
import hashlib,json,sys,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import prepare_g10_4_installation as prep
class G104ReadinessTests(unittest.TestCase):
 def test_exact_delta_005_026_excludes_existing_core(self):
  d=prep.inventory();self.assertEqual([x['migration'] for x in d['steps']],list(range(5,27)));self.assertEqual(d['existing_migrations_to_skip'],['001','002','003','004']);self.assertEqual(d['required_forward_count'],22);self.assertFalse(d['remote_schema_independently_validated']);self.assertFalse(d['authorization_granted_for_real_database'])
 def test_each_step_has_existing_check_hash_and_predecessor(self):
  for s in prep.inventory()['steps']:
   self.assertEqual(s['predecessor'],f"{s['migration']-1:03d}");self.assertTrue(s['checks']);self.assertEqual(prep.sha(ROOT/s['file']),s['sha256'])
   for c in s['checks']:self.assertEqual(prep.sha(ROOT/c['file']),c['sha256'])
 def test_policy_is_not_released_at_025_and_latest_governance_is_included(self):
  d=prep.inventory();self.assertEqual(d['steps'][-1]['file'],'database/026_governance_responsibilities.sql');self.assertTrue(any('025' in s and '026' in s for s in d['stop_gates']))
 def test_review_package_contains_only_exact_sql_and_metadata_not_credentials_or_core(self):
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp)/'manifest.json';package=Path(tmp)/'review.zip';d=prep.prepare(out,package)
   with zipfile.ZipFile(package) as z:
    files=z.namelist();self.assertIn('manifest.json',files);self.assertIn('LEIA-ME.md',files);self.assertFalse(any('/001_' in s or '/004_' in s or s.endswith('_down.sql') for s in files));self.assertTrue(all(s in ['manifest.json','LEIA-ME.md'] or s.startswith('database/') and s.endswith('.sql') for s in files))
    for s in d['steps']:self.assertEqual(hashlib.sha256(z.read(s['file'])).hexdigest(),s['sha256'])
 def test_existing_package_is_not_silently_replaced(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'review.zip';p.write_bytes(b'preserve');
   with self.assertRaises(ValueError):prep.prepare(Path(tmp)/'manifest.json',p)
   self.assertEqual(p.read_bytes(),b'preserve')
