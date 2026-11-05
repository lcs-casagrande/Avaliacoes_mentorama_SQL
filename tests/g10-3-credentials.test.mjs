import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccessAssistanceHandler} from '../supabase/functions/access-assistance/handler.mjs';
import {temporaryPassword} from '../supabase/functions/access-assistance/credentials.mjs';
const ORIGIN='https://iasdpi.example',UID='11111111-1111-4111-8111-111111111111';
function fixture(mode='ok'){
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-test-only',SUPABASE_ANON_KEY:'public-test-only',IASDPI_GOVERNANCE_ENABLED:'true',IASDPI_GOVERNANCE_PEPPER:'test-only-pepper-never-use-in-production-123',IASDPI_GOVERNANCE_ORIGINS:ORIGIN};
 const calls=[],state={must_change_password:false};
 const handler=createAccessAssistanceHandler({readEnv:k=>env[k],wait:async()=>{},fetch:async(url,o)=>{
  const data=o.body?JSON.parse(o.body):null;calls.push({url,...o,data});
  if(url.endsWith('_limit'))return Response.json(mode!=='limited');
  if(url.endsWith('/user')&&o.method==='GET')return Response.json({id:UID,is_anonymous:false},{status:mode==='expired'?401:200});
  if(url.endsWith('_context'))return Response.json({must_change_password:true,aliases:['pessoa-individual.iasdpi']});
  if(url.endsWith('_begin')){state.must_change_password=true;return new Response(null,{status:204});}
  if(url.endsWith('/user')&&o.method==='PUT')return Response.json({id:UID},{status:mode==='provider-failed'?422:200});
  if(url.endsWith('scope=global'))return new Response(null,{status:mode==='logout-failed'?503:204});
  if(url.endsWith('_confirm')){state.must_change_password=false;return new Response(null,{status:204});}
  throw Error('Unexpected synthetic call');
 }});
 const request=(body={},headers={})=>new Request('https://example.supabase.co/functions/v1/access-assistance',{method:'POST',headers:{origin:ORIGIN,'Content-Type':'application/json',authorization:'Bearer individual-test-token',...headers},body:JSON.stringify({action:'change_password',church:'IASD_PI',password:'SyntheticUnique#2026',...body})});return {handler,request,calls,state};
}
test('senha provisória tem 192 bits aleatórios e classes obrigatórias, sem usar nome/apelido',()=>{let draw;const p=temporaryPassword(n=>{draw=n;return new Uint8Array(n).fill(255);});assert.equal(draw,24);assert.match(p,/^T!9a[0-9a-f]{48}$/);assert.equal(p.length,52);});
test('cada emissão chama novamente a fonte criptográfica; não há senha compartilhada ou cache',()=>{let calls=0;const source=n=>new Uint8Array(n).fill(++calls),a=temporaryPassword(source),b=temporaryPassword(source);assert.notEqual(a,b);assert.equal(calls,2);assert.throws(()=>temporaryPassword(()=>new Uint8Array(4)));});
test('troca própria verifica identidade; senha só segue ao Auth e confirmação ocorre após logout global',async()=>{const f=fixture(),r=await f.handler(f.request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{completed:true,login_required:true});const auth=f.calls.find(c=>c.method==='PUT');assert.deepEqual(auth.data,{password:'SyntheticUnique#2026'});assert(!JSON.stringify(f.calls.filter(c=>c.url.includes('/rest/'))).includes('SyntheticUnique#2026'));assert.equal(f.calls.find(c=>c.url.endsWith('_begin')).data.p_user,UID);assert(f.calls.findIndex(c=>c.url.endsWith('scope=global'))<f.calls.findIndex(c=>c.url.endsWith('_confirm')));assert.equal(f.state.must_change_password,false);assert.equal(r.headers.get('cache-control'),'no-store');});
test('apelido como senha é recusado antes de bloquear sessão ou gravar no provedor',async()=>{const f=fixture(),r=await f.handler(f.request({password:'pessoa-individual.iasdpi'}));assert.equal(r.status,400);assert(!f.calls.some(c=>c.method==='PUT'||c.url.endsWith('_begin')));});
test('não aceita alvo informado pelo cliente, origem externa nem credencial ausente/expirada',async()=>{for(const [mode,body,headers] of [['ok',{user_id:'other'},{}],['ok',{}, {origin:'https://attacker.example'}],['ok',{}, {authorization:''}],['expired',{},{}]]){const f=fixture(mode),r=await f.handler(f.request(body,headers));assert(r.status>=400);assert(!f.calls.some(c=>c.method==='PUT'||c.url.endsWith('_begin')));assert(!(await r.text()).includes('individual-test-token'));}});
test('falhas de senha ou revogação não liberam o bloqueio e não anunciam sucesso',async()=>{for(const mode of ['provider-failed','logout-failed']){const f=fixture(mode),r=await f.handler(f.request());assert.equal(r.status,503);assert.equal(f.state.must_change_password,true);assert(!f.calls.some(c=>c.url.endsWith('_confirm')));assert(!(await r.text()).includes('SyntheticUnique#2026'));}});
test('limites bloqueiam antes de qualquer gravação; limite por identidade não depende do apelido',async()=>{const f=fixture('limited'),r=await f.handler(f.request());assert.equal(r.status,429);assert(!f.calls.some(c=>c.method==='PUT'));const good=fixture();await good.handler(good.request());assert(good.calls.some(c=>c.data?.p_keys?.some(k=>/^identity:[a-f0-9]{64}$/.test(k))));});
