import {createIndividualAccount} from './accounts.mjs';
const INVALID='Não foi possível concluir. Confira os dados ou procure a administração.';
async function boundedBody(req){
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error();
 const reader=req.body?.getReader();if(!reader)throw Error();let length=0;const parts=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();throw Error();}parts.push(value);}
 const raw=new Uint8Array(length);let offset=0;for(const p of parts){raw.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder().decode(raw));
}
export function createAccessAssistanceHandler({readEnv,fetch:send=globalThis.fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),randomBytes=n=>crypto.getRandomValues(new Uint8Array(n))}={}){
 return async req=>{
  const origin=req.headers.get('origin')||'',origins=(readEnv('IASDPI_GOVERNANCE_ORIGINS')||'').split(',').map(s=>s.trim()).filter(s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.origin===s;}catch{return false;}});
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache','Vary':'Origin','Referrer-Policy':'no-referrer',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  const response=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(!origins.includes(origin))return response(403,{error:INVALID});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, authorization, content-type, x-iasdpi-church'}});
  if(req.method!=='POST')return response(405,{error:INVALID});
  let b;try{b=await boundedBody(req);}catch{return response(400,{error:INVALID});}
  const fields={submit:['action','church','id','name','identifier','department','kind','message'],issue:['action','church','request_id','version'],institutional_reset:['action','church','identifier','version'],complete:['action','church','code','password'],change_password:['action','church','password'],create_account:['action','church','request_id','person','version','identifier','email']};
  if(!b||typeof b.action!=='string'||!Object.hasOwn(fields,b.action)||Object.keys(b).some(k=>!fields[b.action].includes(k))||typeof b.church!=='string'||!/^[A-Z][A-Z0-9_]{2,39}$/.test(b.church))return response(400,{error:INVALID});
  const url=(readEnv('SUPABASE_URL')||'').replace(/\/$/,''),service=readEnv('SUPABASE_SERVICE_ROLE_KEY'),publicKey=readEnv('SUPABASE_PUBLISHABLE_KEY')||readEnv('SUPABASE_ANON_KEY'),pepper=readEnv('IASDPI_GOVERNANCE_PEPPER');
  if(readEnv('IASDPI_GOVERNANCE_ENABLED')!=='true'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!service||!publicKey||!pepper||pepper.length<32)return response(503,{error:INVALID});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  const hash=async v=>hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(v))));
  async function remote(path,{data,token,admin=false,method}={}){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{return await send(url+path,{method:method||(data===undefined?'GET':'POST'),redirect:'error',signal:controller.signal,headers:{apikey:admin?service:publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(path.startsWith('/rest/')?{'x-iasdpi-church':b.church}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});}finally{clearTimeout(timer);}
  }
  async function rpc(name,data,token=service){const r=await remote('/rest/v1/rpc/'+name,{data,token,admin:token===service});if(!r.ok)throw Error('rpc');return r.status===204?null:r.json();}
  let lease=null,userToken=null;
  try{
   const keys=['global','church:'+await hash('governance:'+b.church),...(b.action==='change_password'?[]:['alias:'+await hash(b.church+':'+b.action+':'+String(b.identifier||b.request_id||b.code||''))])];
   const ipHeader=readEnv('IASDPI_GOVERNANCE_TRUSTED_IP_HEADER'),ip=ipHeader?req.headers.get(ipHeader):null;if(ip)keys.push('ip:'+await hash(ip));
   if(await rpc('iasdpi_alias_login_limit',{p_keys:keys})!==true){await wait(500);return response(429,{error:INVALID});}
   if(b.action==='submit'){
    if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>100||typeof b.identifier!=='string'||!b.identifier.trim()||b.identifier.length>254||!['access','password'].includes(b.kind)||typeof b.message!=='string'||b.message.length>1000)return response(400,{error:INVALID});
    await rpc('iasdpi_access_request_submit',{p_id:b.id,p_name:b.name,p_identifier:b.identifier,p_department:b.department||null,p_kind:b.kind,p_message:b.message});
    return response(202,{accepted:true});
   }
   if(b.action==='create_account'){
    const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return response(401,{error:INVALID});const token=authorization.slice(7);
    const userResponse=await remote('/auth/v1/user',{token});if(!userResponse.ok)return response(401,{error:INVALID});const identity=await userResponse.json();if(!identity.id||identity.is_anonymous!==false)return response(401,{error:INVALID});
    return response(200,await createIndividualAccount({body:b,token,remote,rpc,readEnv,randomBytes}));
   }
   if(b.action==='institutional_reset'){
    if(readEnv('IASDPI_INSTITUTIONAL_ENABLED')!=='true')return response(503,{error:INVALID});
    if(typeof b.identifier!=='string'||!/^[a-z][a-z0-9._-]{2,63}$/.test(b.identifier)||!Number.isInteger(b.version)||b.version<1)return response(400,{error:INVALID});
    const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return response(401,{error:INVALID});const token=authorization.slice(7);
    const user=await remote('/auth/v1/user',{token});if(!user.ok)return response(401,{error:INVALID});const identity=await user.json();if(!identity.id||identity.is_anonymous!==false)return response(401,{error:INVALID});
    const intent=await rpc('iasdpi_institutional_reset_request',{p_identifier:b.identifier,p_expected_version:b.version},token);
    if(intent.self_change===true)return response(200,{self_change:true});
    const code=hex(randomBytes(32)),issued=await rpc('iasdpi_access_reset_issue',{p_request:intent.request_id,p_expected_version:intent.version,p_hash:await hash('reset:'+b.church+':'+code)},token);
    return response(200,{code,expires_at:issued.expires_at});
   }
   if(b.action==='change_password'){
    const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return response(401,{error:INVALID});const token=authorization.slice(7);
    const userResponse=await remote('/auth/v1/user',{token});if(!userResponse.ok)return response(401,{error:INVALID});const identity=await userResponse.json();if(!identity.id||identity.is_anonymous!==false)return response(401,{error:INVALID});
    if(await rpc('iasdpi_alias_login_limit',{p_keys:['identity:'+await hash('password-change:'+identity.id)]})!==true)return response(429,{error:INVALID});
    const context=await rpc('iasdpi_password_change_context',{},token);
    if(typeof b.password!=='string'||b.password.length<12||b.password.length>256||(context.aliases||[]).some(alias=>alias.toLowerCase()===b.password.trim().toLowerCase()))return response(400,{error:INVALID});
    // Só o provedor Auth recebe a senha. Nunca incluir senha em RPC, log ou auditoria.
    await rpc('iasdpi_password_change_begin',{p_user:identity.id});
    const changed=await remote('/auth/v1/user',{token,method:'PUT',data:{password:b.password}});if(!changed.ok)throw Error();
    const logout=await remote('/auth/v1/logout?scope=global',{token,data:{}});if(!logout.ok)throw Error();
    await rpc('iasdpi_password_change_confirm',{p_user:identity.id});
    return response(200,{completed:true,login_required:true});
   }
   if(b.action==='issue'){
    const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return response(401,{error:INVALID});const token=authorization.slice(7);
    const user=await remote('/auth/v1/user',{token});if(!user.ok)return response(401,{error:INVALID});const identity=await user.json();if(!identity.id||identity.is_anonymous!==false)return response(401,{error:INVALID});
    const code=hex(randomBytes(32)),result=await rpc('iasdpi_access_reset_issue',{p_request:b.request_id,p_expected_version:b.version,p_hash:await hash('reset:'+b.church+':'+code)},token);
    return response(200,{code,expires_at:result.expires_at});
   }
   if(typeof b.code!=='string'||!/^[a-f0-9]{64}$/.test(b.code)||typeof b.password!=='string'||b.password.length<12||b.password.length>256)return response(400,{error:INVALID});
   const claim=await rpc('iasdpi_access_reset_claim',{p_hash:await hash('reset:'+b.church+':'+b.code)});lease=claim.lease;
   // generate_link não envia mensagem. Endereço/OTP nunca saem do servidor.
   const linkResponse=await remote('/auth/v1/admin/generate_link',{admin:true,token:service,data:{type:'recovery',email:claim.email}});if(!linkResponse.ok)throw Error();const link=await linkResponse.json();if(!link.hashed_token)throw Error();
   const otpResponse=await remote('/auth/v1/verify',{data:{token_hash:link.hashed_token,type:'recovery'}});if(!otpResponse.ok)throw Error();const session=await otpResponse.json();userToken=session.access_token;if(!userToken)throw Error();
   const identityResponse=await remote('/auth/v1/user',{token:userToken});if(!identityResponse.ok)throw Error();const identity=await identityResponse.json();if(identity.id!==claim.user_id||identity.is_anonymous!==false)throw Error();
   const changed=await remote('/auth/v1/user',{token:userToken,method:'PUT',data:{password:b.password}});if(!changed.ok)throw Error();
   const logout=await remote('/auth/v1/logout?scope=global',{token:userToken,data:{}});if(!logout.ok)throw Error();
   await rpc('iasdpi_access_reset_finish',{p_lease:lease,p_success:true});lease=null;userToken=null;
   if(readEnv('IASDPI_INSTITUTIONAL_ENABLED')==='true')await rpc('iasdpi_password_change_confirm',{p_user:claim.user_id});
   return response(200,{completed:true});
  }catch{
   if(userToken)try{await remote('/auth/v1/logout?scope=global',{token:userToken,data:{}});}catch{}
   if(lease)try{await rpc('iasdpi_access_reset_finish',{p_lease:lease,p_success:false});}catch{}
   await wait(500);return response(b.action==='complete'&&!lease?401:503,{error:INVALID});
  }
 };
}
