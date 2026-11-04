'use strict';
// G6 SOMENTE: servidor em memória e dados demonstrativos. Nunca vai ao frontend publicado.
(()=>{
 const g=IASDPIG6Preview,copy=v=>structuredClone(v),aliasRows=new Map(),accessRows=new Map(),links=new Map();
 const deny=message=>{const e=Error(message);e.code='42501';throw e;},answer=value=>({handled:true,value});
 const uid=t=>{try{return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return {};}};
 const getAccount=token=>{const c=uid(token);return g.accounts.find(a=>a.id===c.sub&&a.enabled&&(!a.minimumIat||c.iat>a.minimumIat));};
 const flags=a=>Object.entries(a.caps).map(([department_id,f])=>({id:crypto.randomUUID(),user_id:a.id,department_id,status:a.enabled?'active':'revoked',enabled:a.enabled,version:1,...Object.fromEntries(Object.entries(f).map(([k,v])=>['can_'+({members:'manage_members',access:'manage_access',requests:'handle_requests'}[k]||k),v]))}));
 for(const a of g.accounts){aliasRows.set(a.alias,{identifier:a.alias,user_id:a.id,enabled:true,version:1});for(const row of flags(a))accessRows.set(row.user_id+':'+row.department_id,row);}
 const admin=a=>a?.globalRole==='admin'&&a.enabled;
 const audit=(a,action,target_id)=>g.audit.unshift({actor_id:a.id,action,target_id,created_at:new Date().toISOString()});
 const canReset=(a,r)=>r?.target_user_id&&r.target_user_id!==a.id&&(admin(a)||g.cap(a,r.department_id,'requests'))&&(!g.accounts.find(x=>x.id===r.target_user_id)?.globalRole||admin(a));
 g.rpc=async(a,name,b)=>{
  if(a.minimumIat){const identity=await IASDPIAuth.requireIdentity();if(uid(identity.token).iat<=a.minimumIat)deny('Sessão anterior à redefinição; entre novamente.');}
  if(name==='iasdpi_governance_catalog'){
   const c=await g.raw('iasdpi_schedule_catalog'),departments=c.departments.filter(d=>admin(a)||['members','access','requests'].some(k=>g.cap(a,d.id,k)));
   if(!admin(a)&&!departments.length)deny('Gestão não autorizada.');
   return answer({actor_id:a.id,is_admin:admin(a),church_id:'1a5d0000-0000-4000-8000-000000000001',departments:departments.map(d=>({id:d.id,name:d.name,can_access:g.cap(a,d.id,'access'),can_members:g.cap(a,d.id,'members'),can_requests:g.cap(a,d.id,'requests')})),users:g.accounts.filter(u=>admin(a)||Object.keys(u.caps).some(d=>departments.some(x=>x.id===d))).map(u=>({user_id:u.id,name:u.name,role:u.globalRole||null,status:u.enabled?'active':'revoked'})),aliases:admin(a)?[...aliasRows.values()].map(copy):[],access:[...accessRows.values()].filter(r=>admin(a)||departments.some(d=>d.id===r.department_id)).map(copy)});
  }
  if(name==='iasdpi_alias_list'){if(!admin(a))deny('Somente administrador.');return answer([...aliasRows.values()].map(copy));}
  if(name==='iasdpi_alias_save'){
   if(!admin(a))deny('Somente administrador.');const key=String(b.p_identifier||'').trim().toLowerCase(),old=aliasRows.get(key);
   if(!/^[a-z][a-z0-9._-]{2,63}$/.test(key)||(old?.version||0)!==b.p_expected_version)deny('Identificador ou versão inválida.');
   if(b.p_user_id&&!g.accounts.some(u=>u.id===b.p_user_id))deny('Conta não identificada.');
   const row={identifier:key,user_id:b.p_user_id||null,enabled:Boolean(b.p_enabled&&b.p_user_id),version:(old?.version||0)+1};aliasRows.set(key,row);audit(a,'alias_save',row.user_id);return answer(copy(row));
  }
  if(name==='iasdpi_department_access_save'){
   const old=accessRows.get(b.p_user+':'+b.p_department),target=g.accounts.find(u=>u.id===b.p_user);
   if(!target||!g.cap(a,b.p_department,'access')||(!admin(a)&&(a.id===b.p_user||target.globalRole||['access','requests'].some(k=>Object.hasOwn(b.p_flags,k)))))deny('Sem delegação para esta operação.');
   if((old?.version||0)!==b.p_expected_version)deny('Permissões alteradas em outra edição.');
   if(!admin(a)&&Object.entries(b.p_flags).some(([k,v])=>v&&!g.cap(a,b.p_department,k)))deny('Não conceda permissões que não possui.');
   if(!['active','suspended','revoked'].includes(b.p_status))deny('Situação inválida.');
   const f={...(target.caps[b.p_department]||{}),...b.p_flags};if(!f.view&&Object.entries(f).some(([k,v])=>k!=='view'&&v))deny('Habilite visualização.');target.caps[b.p_department]=b.p_status==='active'?f:{};
   const row={...old,id:old?.id||crypto.randomUUID(),user_id:b.p_user,department_id:b.p_department,status:b.p_status,version:b.p_expected_version+1,...Object.fromEntries(Object.entries(f).map(([k,v])=>['can_'+({members:'manage_members',access:'manage_access',requests:'handle_requests'}[k]||k),v]))};accessRows.set(b.p_user+':'+b.p_department,row);audit(a,'department_access_'+b.p_status,b.p_user);return answer(copy(row));
  }
  if(name==='iasdpi_access_requests')return answer(g.queue.filter(r=>admin(a)||g.cap(a,r.department_id,'requests')).map(r=>({...copy(r),can_reset:Boolean(canReset(a,r))})));
  if(name==='iasdpi_access_request_review'){
   const r=g.queue.find(r=>r.id===b.p_id);if(!r||!(admin(a)||g.cap(a,r.department_id,'requests'))||r.version!==b.p_expected_version||String(b.p_verification).trim().length<10)deny('Sem verificação, versão ou autorização válida.');
   Object.assign(r,{status:b.p_status,verification:b.p_verification,version:r.version+1});audit(a,'request_'+b.p_status,r.target_user_id);return answer(null);
  }
  return null;
 };
 const previousFetch=window.fetch;
 const session=a=>{const result=g.session(a),payload=uid(result.access_token);payload.iat=Math.max(payload.iat,(a.minimumIat||0)+1);const enc=v=>btoa(JSON.stringify(v)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');result.access_token=enc({alg:'HS256',typ:'JWT'})+'.'+enc(payload)+'.fictitious-signature';if(a.minimumIat)result.refresh_token+=':'+a.minimumIat;return result;};
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url);if(url.origin!=='https://g4demo.supabase.co')throw Error('Rede externa bloqueada.');
  const headers=new Headers(options.headers),token=(headers.get('authorization')||'').replace(/^Bearer /,''),a=getAccount(token),b=options.body?JSON.parse(options.body):{};
  if(url.pathname==='/auth/v1/token'&&url.search.includes('refresh_token')){const target=g.accounts.find(x=>x.enabled&&b.refresh_token==='fictitious-refresh-'+x.id+(x.minimumIat?':'+x.minimumIat:''));return target?Response.json(session(target)):Response.json({error:'Sessão expirada.'},{status:400});}
  if(url.pathname==='/functions/v1/alias-login'||(url.pathname==='/auth/v1/token'&&!url.search.includes('refresh_token'))){
   const row=aliasRows.get(String(b.identifier||'').trim().toLowerCase()),target=b.identifier?(row?.enabled?g.accounts.find(a=>a.id===row.user_id):null):g.accounts.find(a=>a.email===b.email);
   if(!target?.enabled||(b.identifier&&!target.globalRole&&!Object.values(target.caps).some(f=>f.view))||b.password!==(target.demoPassword||'Demonstracao#2026'))return Response.json({error:'Identificação ou senha inválida.'},{status:400});
   return Response.json(session(target));
  }
  if(token&&uid(token).sub&&!a)return Response.json({error:'Sessão expirada ou revogada.'},{status:401});
  if(url.pathname!=='/functions/v1/access-assistance')return previousFetch(input,options);
  try{
   if(b.church!=='IASD_PI')deny('Igreja inválida.');
   if(b.action==='submit'){
    if(!g.queue.some(r=>r.id===b.id)){const alias=aliasRows.get(String(b.identifier).trim().toLowerCase());g.queue.unshift({id:b.id,requester_name:b.name,identifier:b.identifier,kind:b.kind,message:b.message,department_id:b.department||null,target_user_id:alias?.enabled?alias.user_id:null,status:'pending',verification:'',version:1,created_at:new Date().toISOString()});}
    return Response.json({accepted:true},{status:202});
   }
   if(b.action==='issue'){
    const r=g.queue.find(r=>r.id===b.request_id);if(!a||!canReset(a,r)||r.status!=='verified'||r.version!==b.version)deny('Verifique a identidade e a autorização.');
    const code=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),expires_at=new Date(Date.now()+900000).toISOString();links.set(code,{request:r,expires:Date.now()+900000,used:false});r.version++;audit(a,'reset_issue',r.target_user_id);return Response.json({code,expires_at});
   }
   if(b.action==='complete'){
    const link=links.get(b.code);if(!link||link.used||Date.now()>=link.expires||typeof b.password!=='string'||b.password.length<12)deny('Link inválido ou expirado.');
    const target=g.accounts.find(a=>a.id===link.request.target_user_id);if(!target?.enabled)deny('Acesso revogado.');target.demoPassword=b.password;target.minimumIat=Math.floor(Date.now()/1000);link.used=true;link.request.status='resolved';link.request.version++;audit({id:target.id},'reset_complete',target.id);return Response.json({completed:true});
   }
   deny('Operação inválida.');
  }catch{return Response.json({error:'Não foi possível concluir. Confira o link ou procure a administração.'},{status:403});}
 };
 const ready=(async()=>{await IASDPIG4Demo.ready;for(const p of IASDPIB1Preview.plans.values())if(['00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007'].includes(p.department_id))p.requirements=p.requirements.filter(r=>new Date(IASDPIB1Preview.events.find(e=>e.id===r.event_id).scheduled_on+'T12:00:00Z').getUTCDay()===6);})();
 document.querySelector('.demo-banner').insertAdjacentHTML('beforeend','<p>Nomes e fontes históricas informados; contas, permissões, preferências, senhas e novas escalas são demonstrativos. Nada é enviado ao Supabase.</p><details><summary>Limites desta homologação</summary><p>Alterações reiniciam ao recarregar. Configuração de dias por departamento e recuperação aqui são simulações; a ativação real depende das pendências do relatório G6.</p></details>');
 window.IASDPIG6Demo={ready,aliases:()=>[...aliasRows.values()].map(copy),queue:()=>copy(g.queue),expireLinks:()=>{for(const link of links.values())link.expires=0;}};
})();
