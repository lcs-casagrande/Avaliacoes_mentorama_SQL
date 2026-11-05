// Admin API somente no servidor. Nenhuma senha entra em RPC, tabela ou log.
import {temporaryPassword} from './credentials.mjs';
export async function createIndividualAccount({body,token,remote,rpc,readEnv,randomBytes}){
 if(readEnv('IASDPI_ACCOUNT_CREATION_ENABLED')!=='true')throw Error('disabled');
 const valid=/^[a-z][a-z0-9._-]{2,63}$/;
 if(typeof body.identifier!=='string'||!valid.test(body.identifier)||typeof body.person!=='string'||typeof body.request_id!=='string'||!Number.isSafeInteger(body.version)||body.version<1)throw Error('input');
 if(body.email!==undefined&&typeof body.email!=='string')throw Error('email');
 let email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!email){const domain=readEnv('IASDPI_ACCOUNT_EMAIL_DOMAIN')||'';if(!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain))throw Error('domain');email=body.identifier+'@'+domain;}
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('email');
 const context=await rpc('iasdpi_account_create_begin',{p_id:body.request_id,p_person:body.person,p_expected_version:body.version,p_identifier:body.identifier,p_email:email},token);
 if(context.completed)return {...context,credential_available:false};
 const password=temporaryPassword(randomBytes);
 const result=await remote('/auth/v1/admin/users',{admin:true,token:readEnv('SUPABASE_SERVICE_ROLE_KEY'),data:{email,password,email_confirm:true,user_metadata:{full_name:context.name},app_metadata:{iasdpi_provision_request:body.request_id}}});
 if(!result.ok)throw Error('auth');const user=await result.json();
 if(typeof user.id!=='string'||!user.id||user.email?.toLowerCase()!==email)throw Error('identity');
 const saved=await rpc('iasdpi_account_create_finish',{p_id:body.request_id,p_user:user.id},token);
 if(saved.completed!==true||saved.user_id!==user.id)throw Error('finish');
 return {...saved,identifier:body.identifier,password,credential_available:true,must_change_password:true};
}
