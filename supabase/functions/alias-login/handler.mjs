// Sem SDK remoto ou dependências. Segredos existem exclusivamente no Edge Runtime.
const INVALID = 'Não foi possível entrar. Confira a identificação e a senha ou tente mais tarde.';
const UNAVAILABLE = 'Login institucional indisponível. Tente novamente mais tarde.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Error('input');
  const reader = request.body?.getReader(); if (!reader) throw Error('input');
  const chunks = []; let size = 0;
  for (;;) { const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw Error('input'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || Array.isArray(body) || Object.keys(body).some(k=>!['church','identifier','password','captchaToken'].includes(k))) throw Error('input');
  if (typeof body.church !== 'string' || !/^[A-Z][A-Z0-9_]{2,39}$/.test(body.church) || typeof body.identifier !== 'string' || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 1024) throw Error('input');
  body.identifier = body.identifier.trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(body.identifier) || (body.captchaToken!==undefined && (typeof body.captchaToken!=='string'||body.captchaToken.length>4096))) throw Error('input');
  return body;
}
export function createAliasLoginHandler({readEnv, fetch: send=globalThis.fetch, now=()=>Date.now(), wait=ms=>new Promise(r=>setTimeout(r,ms)), random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32}={}) {
  return async request => {
    const started = now(), origin = request.headers.get('origin') || '';
    const allowed = (readEnv('IASDPI_ALIAS_ALLOWED_ORIGINS') || '').split(',').map(x=>x.trim()).filter(x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.origin===x;}catch{return false;}});
    const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache','Vary':'Origin','Referrer-Policy':'no-referrer'};
    if (allowed.includes(origin)) headers['Access-Control-Allow-Origin']=origin;
    const reply=(status,error)=>new Response(JSON.stringify({error}),{status,headers});
    if (!origin || !allowed.includes(origin)) return reply(403,UNAVAILABLE);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, content-type, x-client-info, x-iasdpi-church'}});
    if (request.method!=='POST') return reply(405,UNAVAILABLE);
    // O piso também se aplica a apelido ausente, revogado, senha errada e limite.
    const reject = async (status=401) => { await wait(Math.max(0,1000-(now()-started))+Math.floor(random()*80)); return reply(status,status===401?INVALID:UNAVAILABLE); };
    let body; try { body=await readBody(request); } catch { return reject(400); }
    const url=(readEnv('SUPABASE_URL')||'').replace(/\/$/,''), serviceKey=readEnv('SUPABASE_SERVICE_ROLE_KEY'), publicKey=readEnv('SUPABASE_PUBLISHABLE_KEY')||readEnv('SUPABASE_ANON_KEY'), pepper=readEnv('IASDPI_ALIAS_LOGIN_PEPPER');
    if (readEnv('IASDPI_ALIAS_LOGIN_ENABLED')!=='true' || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !serviceKey || !publicKey || !pepper || pepper.length<32) return reject(503);
    const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',secret,new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
    async function remote(path, key, data, token) {
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try { return await send(url+path,{method:data===undefined?'GET':'POST',redirect:'error',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(path.startsWith('/rest/')?{'x-iasdpi-church':body.church}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:controller.signal}); }
      finally {clearTimeout(timer);}
    }
    async function rpc(name,data) { const response=await remote('/rest/v1/rpc/'+name,serviceKey,data,serviceKey); if (!response.ok) throw Error('rpc'); return response.json(); }
    let tokens=null;
    async function revoke() { if(tokens?.access_token)try { await remote('/auth/v1/logout?scope=local',publicKey,{},tokens.access_token); } catch {} }
    try {
      // Gateway deve sobrescrever este header. Sem configuração, não confiamos em IP enviado pelo cliente.
      const trustedHeader=readEnv('IASDPI_ALIAS_TRUSTED_IP_HEADER'),ip=trustedHeader?request.headers.get(trustedHeader):null;
      const keys=['global','church:'+await hash('church:'+body.church),'alias:'+await hash(body.church+':alias:'+body.identifier)];
      if (ip) keys.push('ip:'+await hash('ip:'+ip));
      if (await rpc('iasdpi_alias_login_limit',{p_keys:keys})!==true) return reject();
      let binding=null;
      try { binding=await rpc('iasdpi_alias_login_lookup',{p_identifier:body.identifier}); } catch { /* contexto inválido usa o mesmo fluxo de senha inválida */ }
      const valid=Boolean(binding && UUID.test(binding.user_id) && UUID.test(binding.alias_id) && Number.isInteger(binding.version) && typeof binding.email==='string');
      if (valid && await rpc('iasdpi_alias_login_limit',{p_keys:['identity:'+await hash(body.church+':identity:'+binding.user_id)]})!==true) return reject();
      const email=valid?binding.email:'invalid-alias-login@accounts.invalid';
      const response=await remote('/auth/v1/token?grant_type=password',publicKey,{email,password:body.password,...(body.captchaToken?{gotrue_meta_security:{captcha_token:body.captchaToken}}:{})});
      if (!response.ok) return reject();
      tokens=await response.json();
      if (!valid || typeof tokens.access_token!=='string' || typeof tokens.refresh_token!=='string' || !tokens.access_token || !tokens.refresh_token || tokens.access_token.length>16384 || tokens.refresh_token.length>8192) {await revoke();return reject();}
      const userResponse=await remote('/auth/v1/user',publicKey,undefined,tokens.access_token);
      const user=userResponse.ok?await userResponse.json():null;
      if (!user || user.id!==binding.user_id || user.is_anonymous!==false || await rpc('iasdpi_alias_login_confirm',{p_alias_id:binding.alias_id,p_version:binding.version,p_user_id:user.id})!==true) {await revoke();return reject();}
      // Só tokens de usuário. Nunca retornar e-mail, vínculo, versão ou erro do provedor.
      return new Response(JSON.stringify({access_token:tokens.access_token,refresh_token:tokens.refresh_token}),{status:200,headers});
    } catch {await revoke();return reject(503);}
  };
}
