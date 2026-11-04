"""Regressão completa em cópia isolada; exige PostgreSQL descartável sem rede."""
import argparse,json,os,re,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHILD=r'''
import collections,json,sys,unittest
from pathlib import Path
out=Path(sys.argv[1]);selected=json.loads(sys.argv[2]);suite=unittest.defaultTestLoader.loadTestsFromNames(selected) if selected else unittest.defaultTestLoader.discover('tests',pattern='test_*.py')
def cases(s):
 for t in s:
  if isinstance(t,unittest.TestSuite):yield from cases(t)
  else:yield t.id()
ids=list(cases(suite));(out/'discovery.json').write_text(json.dumps({'collected':len(ids),'unique_ids':len(set(ids)),'by_module':dict(collections.Counter(i.split('.')[0] for i in ids)),'ids':ids},indent=2)+'\n')
class Result(unittest.TextTestResult):
 def __init__(self,*a,**k):super().__init__(*a,**k);self.passed=[]
 def checkpoint(self):
  d={'passed':self.passed,'failures':[{'id':t.id(),'traceback':s} for t,s in self.failures],'errors':[{'id':t.id(),'traceback':s} for t,s in self.errors],'skipped':[{'id':t.id(),'reason':s} for t,s in self.skipped]};p=out/'checkpoint.tmp';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');p.replace(out/'checkpoint.json')
 def addSuccess(self,t):super().addSuccess(t);self.passed.append(t.id());self.checkpoint()
 def addError(self,t,e):super().addError(t,e);self.checkpoint()
 def addFailure(self,t,e):super().addFailure(t,e);self.checkpoint()
 def addSkip(self,t,r):super().addSkip(t,r);self.checkpoint()
runner=unittest.TextTestRunner(verbosity=2,resultclass=Result);result=None
try:
 result=runner.run(suite)
finally:
 if result is not None:
  data={'collected':len(ids),'run':result.testsRun,'passed':result.passed,'failures':[{'id':t.id(),'traceback':s} for t,s in result.failures],'errors':[{'id':t.id(),'traceback':s} for t,s in result.errors],'skipped':[{'id':t.id(),'reason':s} for t,s in result.skipped],'expected_failures':[t.id() for t,_ in result.expectedFailures],'unexpected_successes':[t.id() for t in result.unexpectedSuccesses],'successful':result.wasSuccessful()}
  (out/'python-results.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
sys.exit(0 if result and result.wasSuccessful() else 1)
'''
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--container',required=True);parser.add_argument('--output',type=Path,default=ROOT/'dist/governance-g9');parser.add_argument('--modules',nargs='*',default=[],help='IDs/módulos opcionais para uma rodada de revalidação; vazio descobre toda a suíte.');args=parser.parse_args()
    env=dict(os.environ)
    for k in list(env):
        if k.startswith('SUPABASE') or k.startswith('PG') or k in ('DATABASE_URL','DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'):env.pop(k,None)
    docker=['docker','--host=unix:///var/run/docker.sock']
    mode=subprocess.check_output(docker+['inspect','--format','{{.HostConfig.NetworkMode}}',args.container],text=True,env=env).strip()
    if mode!='none':raise SystemExit('Recusado: container deve usar --network none.')
    env.update(IASDPI_PG_TEST_CONTAINER=args.container,PYTHONDONTWRITEBYTECODE='1',PYTHONPATH='tests')
    out=args.output.resolve();out.mkdir(parents=True,exist_ok=True);copy=Path(tempfile.mkdtemp(prefix='iasdpi-g9-suite-'))
    for folder in ['backend','frontend','database','scripts','tests','docs','supabase','data','.github']:
        shutil.copytree(ROOT/folder,copy/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc','.env*','*.sqlite3*','*.db','*.log','node_modules'))
    for name in ['README.md','.gitignore','AGENTS.md']:
        if (ROOT/name).exists():shutil.copy2(ROOT/name,copy/name)
    for directory in (ROOT/'dist').rglob('*'):
        if directory.is_dir():(copy/directory.relative_to(ROOT)).mkdir(parents=True,exist_ok=True)
    gitdir=subprocess.check_output(['git','rev-parse','--absolute-git-dir'],cwd=ROOT,text=True,env=env).strip();(copy/'.git').write_text('gitdir: '+gitdir+'\n');env['GIT_OPTIONAL_LOCKS']='0'
    (copy/'dist').mkdir(exist_ok=True);(out/'runner-workspace.json').write_text(json.dumps({'path':str(copy),'source_branch':'feat/schedule-management-b1','container_network':mode,'production_credentials_excluded':True,'prior_artifacts_preserved':True},indent=2)+'\n')
    with (out/'full-regression.log').open('w') as log:r=subprocess.run([sys.executable,'-c',CHILD,str(out),json.dumps(args.modules)],cwd=copy,env=env,stdout=log,stderr=subprocess.STDOUT)
    with (out/'node-regression.log').open('w') as log:n=subprocess.run(['node','--test','--test-reporter=spec',*[str(p.relative_to(copy)) for p in sorted((copy/'tests').glob('*.test.mjs'))]],cwd=copy,env=env,stdout=log,stderr=subprocess.STDOUT)
    (out/'runner-exits.json').write_text(json.dumps({'python':r.returncode,'node':n.returncode},indent=2)+'\n');print(out)
    return 0 if r.returncode==n.returncode==0 else 1
if __name__=='__main__':raise SystemExit(main())
