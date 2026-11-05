import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccessAssistanceHandler} from '../supabase/functions/access-assistance/handler.mjs';
function fixture(mode='ok'){
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-test-only',SUPABASE_PUBLISHABLE_KEY:'public-test-only',IASDPI_GOVERNANCE_ENABLED:'true',IASDPI_INSTITUTIONAL_ENABLED:'true',IASDPI_GOVERNANCE_PEPPER:'synthetic-only-pepper-12345678901234567890',IASDPI_GOVERNANCE_ORIGINS:'https://iasdpi.example'};const calls=[];
 const handler=createAccessAssistanceHandler({readEnv:k=>env[k],randomBytes:n=>new Uint8Array(n).fill(33),wait:async()=>{},fetch:async(url,o)=>{
  calls.push({url,...o,body:o.body?JSON.parse(o.body):null});
  if(url.endsWith('_limit'))return Response.json(true);
  if(url.endsWith('/auth/v1/user'))return mode==='expired'?Response.json({},{status:401}):Response.json({id:'operator-synthetic',is_anonymous:false});
  if(url.endsWith('iasdpi_institutional_reset_request'))return mode==='denied'?Response.json({message:'private provider detail'},{status:403}):Response.json(mode==='self'?{self_change:true}:{request_id:'synthetic-request',version:1});
  if(url.endsWith('iasdpi_access_reset_issue'))return Response.json({expires_at:'2030-01-01T12:00:00Z'});
  throw Error('Operação inesperada');
 }});
 const call=(patch={},auth=true)=>handler(new Request('https://example.supabase.co/functions/v1/access-assistance',{method:'POST',headers:{Origin:'https://iasdpi.example','Content-Type':'application/json',...(auth?{Authorization:'Bearer synthetic-operator'}:{})},body:JSON.stringify({action:'institutional_reset',church:'IASD_PI',identifier:'sonoplastia',version:1,...patch})}));return {env,calls,call};
}
test('reset institucional revalida JWT e administrador via RPC, não cria Auth',async()=>{const f=fixture(),r=await f.call();assert.equal(r.status,200);const data=await r.json();assert.match(data.code,/^[a-f0-9]{64}$/);const intent=f.calls.find(c=>c.url.endsWith('_request')),issue=f.calls.find(c=>c.url.endsWith('_issue'));assert.equal(intent.headers.Authorization,'Bearer synthetic-operator');assert.equal(issue.headers.Authorization,'Bearer synthetic-operator');assert.notEqual(issue.body.p_hash,data.code);assert.equal(r.headers.get('cache-control'),'no-store');assert(!f.calls.some(c=>c.url.includes('/admin/')));});
test('flag institucional permanece opt-in no servidor',async()=>{const f=fixture();delete f.env.IASDPI_INSTITUTIONAL_ENABLED;assert.equal((await f.call()).status,503);assert(!f.calls.some(c=>c.url.includes('/auth/')));});
test('sem JWT ou com sessão expirada não emite redefinição',async()=>{for(const mode of ['ok','expired']){const f=fixture(mode),r=await f.call({},mode!=='ok');assert.equal(r.status,401);assert(!f.calls.some(c=>c.url.endsWith('_issue')));}});
test('líder ou membro rejeitado pelo backend não amplia autoridade pela UI',async()=>{const f=fixture('denied'),r=await f.call();assert(r.status>=400);assert(!f.calls.some(c=>c.url.endsWith('_issue')));assert(!(await r.text()).includes('private provider detail'));});
test('troca da própria senha usa fluxo pessoal sem link privilegiado',async()=>{const f=fixture('self'),r=await f.call();assert.deepEqual(await r.json(),{self_change:true});assert(!f.calls.some(c=>c.url.endsWith('_issue')));});
test('campos de privilégio, senha ou identidade forjada são rejeitados',async()=>{for(const patch of [{role:'admin'},{user_id:'attacker'},{password:'not-allowed'},{approve_general:true}]){const f=fixture();assert.equal((await f.call(patch)).status,400);assert.equal(f.calls.length,0);}});
test('login e versão de linha inválidos não executam RPC de redefinição',async()=>{for(const patch of [{identifier:'x'},{version:0},{version:1.2},{identifier:'../admin'}]){const f=fixture();assert.equal((await f.call(patch)).status,400);assert(!f.calls.some(c=>c.url.endsWith('_request')));}});
test('resposta nunca devolve senha, email, JWT ou segredo de servidor',async()=>{const f=fixture(),r=await f.call(),body=await r.text();for(const secret of ['password','email','synthetic-operator','server-test-only'])assert(!body.includes(secret));});
