import test from 'node:test';
import assert from 'node:assert/strict';
import {createAliasLoginHandler} from '../supabase/functions/alias-login/handler.mjs';
const UID='11111111-1111-4111-8111-111111111111',ALIAS='22222222-2222-4222-8222-222222222222',ORIGIN='https://iasdpi.example';
function fixture(mode='success') {
 const env={SUPABASE_URL:'https://preview.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-key-example-only',SUPABASE_ANON_KEY:'public-example-only',IASDPI_ALIAS_LOGIN_ENABLED:'true',IASDPI_ALIAS_LOGIN_PEPPER:'test-only-pepper-never-use-in-production-123',IASDPI_ALIAS_ALLOWED_ORIGINS:ORIGIN};
 const calls=[],delays=[];
 const send=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,body,headers:options.headers,redirect:options.redirect});
  if(mode==='network')throw Error('do not expose provider diagnostic '+UID);
  if(url.endsWith('iasdpi_alias_login_limit'))return Response.json(!(['limited','identity-limited'].includes(mode)&&(mode==='limited'||body.p_keys[0].startsWith('identity:'))));
  if(url.endsWith('iasdpi_alias_login_lookup'))return Response.json(['unknown','disabled','inactive','no-permission'].includes(mode)?null:{alias_id:ALIAS,user_id:UID,email:'private-account@example.invalid',version:4});
  if(url.includes('/token?'))return mode==='wrong-password'||['unknown','disabled','inactive','no-permission'].includes(mode)?Response.json({email:'MUST NOT LEAK',user_id:UID,error:'invalid credentials'},{status:400}):Response.json({access_token:'user-access-test-only',refresh_token:'user-refresh-test-only',user:{id:UID,email:'must-not-return@example.invalid'}});
  if(url.endsWith('/user'))return Response.json({id:mode==='wrong-user'?'33333333-3333-4333-8333-333333333333':UID,is_anonymous:false,email:'private-account@example.invalid'});
  if(url.endsWith('iasdpi_alias_login_confirm'))return Response.json(mode!=='revoked-during-login');
  if(url.includes('/logout?'))return new Response(null,{status:204});
  throw Error('Unexpected test URL');
 };
 const handler=createAliasLoginHandler({readEnv:k=>env[k],fetch:send,now:()=>100,random:()=>0,wait:async ms=>delays.push(ms)});
 const request=(overrides={},headers={})=>new Request('https://preview.supabase.co/functions/v1/alias-login',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json',...headers},body:JSON.stringify({church:'IASD_PI',identifier:'Sonoplastia',password:'test-password-not-real',...overrides})});
 return {env,calls,delays,handler,request};
}
test('sucesso devolve apenas tokens de usuário, sem resolução pública',async()=>{
 const f=fixture(),r=await f.handler(f.request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{access_token:'user-access-test-only',refresh_token:'user-refresh-test-only'});
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),ORIGIN);
 assert(f.calls.filter(c=>c.url.includes('/rest/')).every(c=>c.headers['x-iasdpi-church']==='IASD_PI'&&c.headers.Authorization==='Bearer server-key-example-only'));
 assert.equal(f.calls.find(c=>c.url.includes('/token?')).headers.apikey,'public-example-only');assert(f.calls.every(c=>c.redirect==='error'));
});
test('apelido desconhecido, desativado, sem permissão, senha errada e limites têm a mesma resposta',async()=>{
 let baseline;
 for(const mode of ['unknown','disabled','inactive','no-permission','wrong-password','limited','identity-limited']){
  const f=fixture(mode),r=await f.handler(f.request()),body=await r.text();assert.equal(r.status,401,mode);assert(!body.includes(UID));assert(!body.includes('@'));if(baseline)assert.equal(body,baseline);baseline=body;assert.deepEqual(f.delays,[1000]);
 }
});
test('identificador desconhecido também passa pelo Auth, sem devolver o endereço substituto',async()=>{
 const f=fixture('unknown'),r=await f.handler(f.request());assert(f.calls.some(c=>c.url.includes('/token?')));assert(! (await r.text()).includes('accounts.invalid'));
});
test('revogação concorrente ou identidade divergente revoga somente a sessão recém-emitida',async()=>{
 for(const mode of ['revoked-during-login','wrong-user']){
  const f=fixture(mode),r=await f.handler(f.request());assert.equal(r.status,401);assert.equal(f.calls.filter(c=>c.url.includes('/logout?scope=local')).length,1);
 }
});
test('limites não enviam senha ao RPC e usam HMAC, inclusive identidade compartilhada por apelidos',async()=>{
 const f=fixture();await f.handler(f.request());const budget=f.calls.filter(c=>c.url.endsWith('_limit'));assert.equal(budget.length,2);
 assert(budget[0].body.p_keys.includes('global'));assert(budget[0].body.p_keys.filter(k=>k!=='global').every(k=>/^(alias|church):[a-f0-9]{64}$/.test(k)));assert.match(budget[1].body.p_keys[0],/^identity:[a-f0-9]{64}$/);
 assert(f.calls.filter(c=>c.url.includes('/rpc/')).every(c=>!JSON.stringify(c.body).includes('test-password')));
});
test('não confia em x-forwarded-for sem gateway configurado',async()=>{
 const f=fixture();await f.handler(f.request({}, {'x-forwarded-for':'spoofed'}));assert(!f.calls[0].body.p_keys.some(k=>k.startsWith('ip:')));
 const other=fixture();other.env.IASDPI_ALIAS_TRUSTED_IP_HEADER='x-trusted-client-ip';await other.handler(other.request({}, {'x-trusted-client-ip':'192.0.2.1'}));assert(other.calls[0].body.p_keys.some(k=>/^ip:[a-f0-9]{64}$/.test(k)));
});
test('origem não liberada, configuração ausente e método incorreto falham fechados',async()=>{
 const f=fixture();let r=await f.handler(f.request({}, {origin:'https://untrusted.example'}));assert.equal(r.status,403);assert.equal(f.calls.length,0);
 f.env.IASDPI_ALIAS_LOGIN_PEPPER='';r=await f.handler(f.request());assert.equal(r.status,503);assert.equal(f.calls.length,0);
 r=await f.handler(new Request('https://preview.supabase.co/',{method:'GET',headers:{origin:ORIGIN}}));assert.equal(r.status,405);
});
test('preflight CORS não consulta contas nem retorna credenciais',async()=>{
 const f=fixture(),r=await f.handler(new Request('https://preview.supabase.co/',{method:'OPTIONS',headers:{origin:ORIGIN}}));assert.equal(r.status,204);assert.equal(f.calls.length,0);assert.notEqual(r.headers.get('access-control-allow-origin'),'*');
});
test('payload excessivo, campos desconhecidos e entrada inválida são recusados antes da resolução',async()=>{
 for(const patch of [{identifier:'a@b.invalid'},{church:'wrong code'},{password:'x'.repeat(9000)},{user_id:UID},{password:''}]){
  const f=fixture(),r=await f.handler(f.request(patch));assert.equal(r.status,400);assert.equal(f.calls.length,0);
 }
});
test('exceções do provedor não expõem conteúdo, IDs ou segredos',async()=>{
 const f=fixture('network'),r=await f.handler(f.request()),body=await r.text();assert.equal(r.status,503);assert(!body.includes(UID));assert(!body.includes('server-key'));assert(!body.includes('provider'));assert.deepEqual(f.delays,[1000]);
});
test('CAPTCHA, quando fornecido, é repassado ao Auth sem desativar verificações',async()=>{
 const f=fixture();await f.handler(f.request({captchaToken:'fictitious-captcha'}));assert.deepEqual(f.calls.find(c=>c.url.includes('/token?')).body.gotrue_meta_security,{captcha_token:'fictitious-captcha'});
});
