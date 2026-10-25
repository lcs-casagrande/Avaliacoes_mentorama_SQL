'use strict';
window.IASDPIRelease?.executing();
'use strict';
// Configuração PÚBLICA da homologação; sem segredos administrativos.
window.IASDPIConfig = Object.freeze({
  "supabaseUrl": "https://pwbxksxxmnblqwpvlheu.supabase.co",
  "supabasePublishableKey": "sb_publishable_E26yqWE3oQMzuS2gjrOCrA_Pd0iuDlJ",
  "environment": "production",
  "storageMode": "supabase",
  "storageNamespace": "",
  "remoteReadOnly": false,
  "siteUrl": "https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/"
});

;
'use strict';
// Paths de GitHub Pages da mesma conta compartilham a origem. Nunca reutilizar
// as chaves do site principal na homologação, nem mesmo para ler configuração.
window.IASDPIStorage = (() => {
  const namespace=window.IASDPIConfig?.storageNamespace || '';
  if(namespace&&!/^[a-z0-9-]{1,80}$/.test(namespace))throw Error('Namespace de armazenamento inválido.');
  const key=name=>namespace?namespace+':'+name:name;
  return Object.freeze({programs:key('iasdpi-demo-v1'),safety:key('iasdpi-last-safety-copy-v1'),
    beforeRestore:key('iasdpi-before-restore-v1'),cloudConfig:key('iasdpi-cloud-config'),pending:key('iasdpi-cloud-pending'),
    authSession:key('iasdpi-supabase-auth-v1'),dateCorrections:key('iasdpi-date-correction-backups-v1')});
})();

;
var supabase=(function(e){function t(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(e!=null&&typeof Object.getOwnPropertySymbols==`function`)for(var i=0,r=Object.getOwnPropertySymbols(e);i<r.length;i++)t.indexOf(r[i])<0&&Object.prototype.propertyIsEnumerable.call(e,r[i])&&(n[r[i]]=e[r[i]]);return n}function n(e,t,n,r){function i(e){return e instanceof n?e:new n(function(t){t(e)})}return new(n||=Promise)(function(n,a){function o(e){try{c(r.next(e))}catch(e){a(e)}}function s(e){try{c(r.throw(e))}catch(e){a(e)}}function c(e){e.done?n(e.value):i(e.value).then(o,s)}c((r=r.apply(e,t||[])).next())})}let r=e=>e?(...t)=>e(...t):(...e)=>fetch(...e);var i=class extends Error{constructor(e,t=`FunctionsError`,n){super(e),this.name=t,this.context=n}toJSON(){return{name:this.name,message:this.message,context:this.context}}},a=class extends i{constructor(e){super(`Failed to send a request to the Edge Function`,`FunctionsFetchError`,e)}},o=class extends i{constructor(e){super(`Relay Error invoking the Edge Function`,`FunctionsRelayError`,e)}},s=class extends i{constructor(e){super(`Edge Function returned a non-2xx status code`,`FunctionsHttpError`,e)}},c;(function(e){e.Any=`any`,e.ApNortheast1=`ap-northeast-1`,e.ApNortheast2=`ap-northeast-2`,e.ApSouth1=`ap-south-1`,e.ApSoutheast1=`ap-southeast-1`,e.ApSoutheast2=`ap-southeast-2`,e.CaCentral1=`ca-central-1`,e.EuCentral1=`eu-central-1`,e.EuWest1=`eu-west-1`,e.EuWest2=`eu-west-2`,e.EuWest3=`eu-west-3`,e.SaEast1=`sa-east-1`,e.UsEast1=`us-east-1`,e.UsWest1=`us-west-1`,e.UsWest2=`us-west-2`})(c||={});var l=class{constructor(e,{headers:t={},customFetch:n,region:i=c.Any}={}){this.url=e,this.headers=t,this.region=i,this.fetch=r(n)}setAuth(e){this.headers.Authorization=`Bearer ${e}`}invoke(e){return n(this,arguments,void 0,function*(e,t={}){var n;let r,i,c;try{let{headers:n,method:l,body:u,signal:d,timeout:f}=t,p={},{region:m}=t;m||=this.region;let h=new URL(`${this.url}/${e}`);m&&m!==`any`&&(p[`x-region`]=m,h.searchParams.set(`forceFunctionRegion`,m));let g,ee=!!n&&Object.keys(n).some(e=>e.toLowerCase()===`content-type`);u&&!ee?typeof Blob<`u`&&u instanceof Blob||u instanceof ArrayBuffer?(p[`Content-Type`]=u.type||`application/octet-stream`,g=u):typeof u==`string`?(p[`Content-Type`]=`text/plain`,g=u):typeof FormData<`u`&&u instanceof FormData?g=u:(p[`Content-Type`]=`application/json`,g=JSON.stringify(u)):g=u&&typeof u!=`string`&&!(typeof Blob<`u`&&u instanceof Blob)&&!(u instanceof ArrayBuffer)&&!(typeof FormData<`u`&&u instanceof FormData)?JSON.stringify(u):u;let te=d;f&&(i=new AbortController,r=setTimeout(()=>i.abort(),f),d?(te=i.signal,c=()=>i.abort(),d.addEventListener(`abort`,c)):te=i.signal);let _=yield this.fetch(h.toString(),{method:l||`POST`,headers:Object.assign(Object.assign(Object.assign({},p),this.headers),n),body:g,signal:te}).catch(e=>{throw new a(e)}),ne=_.headers.get(`x-relay-error`);if(ne&&ne===`true`)throw new o(_);if(!_.ok)throw new s(_);let re=(_.headers.get(`Content-Type`)??`text/plain`).split(`;`)[0].trim().toLowerCase(),ie;return ie=re===`application/json`?yield _.json():re===`application/octet-stream`||re===`application/pdf`?yield _.blob():re===`text/event-stream`?_:re===`multipart/form-data`?yield _.formData():yield _.text(),{data:ie,error:null,response:_}}catch(e){return{data:null,error:e,response:e instanceof s||e instanceof o?e.context:void 0}}finally{r&&clearTimeout(r),c&&((n=t.signal)==null||n.removeEventListener(`abort`,c))}})}},u=class extends Error{constructor(e){super(e.message),this.name=`PostgrestError`,this.details=e.details,this.hint=e.hint,this.code=e.code}toJSON(){return{name:this.name,message:this.message,details:this.details,hint:this.hint,code:this.code}}};let d=e=>Math.min(1e3*2**e,3e4),f=[520,503],p=[`GET`,`HEAD`,`OPTIONS`];function m(e){"@babel/helpers - typeof";return m=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},m(e)}function h(e,t){if(m(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(m(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function g(e){var t=h(e,`string`);return m(t)==`symbol`?t:t+``}function ee(e,t,n){return(t=g(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function te(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function _(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?te(Object(n),!0).forEach(function(t){ee(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):te(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}function ne(e,t){return new Promise(n=>{if(t?.aborted){n();return}let r=setTimeout(()=>{t?.removeEventListener(`abort`,i),n()},e);function i(){clearTimeout(r),n()}t?.addEventListener(`abort`,i)})}function re(e,t,n,r){return!(!r||n>=3||!p.includes(e)||!f.includes(t))}async function ie(e,t,n,r){let i=0;for(;;){let a=_({},n.headers);i>0&&(a[`X-Retry-Count`]=String(i));let o;try{o=await e(t,{method:n.method,headers:a,body:n.body,signal:n.signal})}catch(e){if(e?.name===`AbortError`||e?.code===`ABORT_ERR`||e?.name===`TimeoutError`&&n.signal?.aborted||!p.includes(n.method))throw e;if(r&&i<3){let e=d(i);i++,await ne(e,n.signal);continue}throw e}if(re(n.method,o.status,i,r)){let e=o.headers?.get(`Retry-After`)??null,t=e===null?d(i):Math.max(0,parseInt(e,10)||0)*1e3;await o.text(),i++,await ne(t,n.signal);continue}return o}}var ae=class{constructor(e){this.shouldThrowOnError=!1,this.retryEnabled=!0,this.method=e.method,this.url=e.url,this.headers=new Headers(e.headers),this.schema=e.schema,this.body=e.body,this.shouldThrowOnError=e.shouldThrowOnError??!1,this.signal=e.signal,this.isMaybeSingle=e.isMaybeSingle??!1,this.shouldStripNulls=e.shouldStripNulls??!1,this.urlLengthLimit=e.urlLengthLimit??8e3,this.retryEnabled=e.retry??!0,e.fetch?this.fetch=e.fetch:this.fetch=fetch}throwOnError(){return this.shouldThrowOnError=!0,this}stripNulls(){if(this.headers.get(`Accept`)===`text/csv`)throw Error(`stripNulls() cannot be used with csv()`);return this.shouldStripNulls=!0,this}setHeader(e,t){return this.headers=new Headers(this.headers),this.headers.set(e,t),this}retry(e){return this.retryEnabled=e,this}then(e,t){var n=this;if(this.schema===void 0||([`GET`,`HEAD`].includes(this.method)?this.headers.set(`Accept-Profile`,this.schema):this.headers.set(`Content-Profile`,this.schema)),this.method!==`GET`&&this.method!==`HEAD`&&this.headers.set(`Content-Type`,`application/json`),this.shouldStripNulls){let e=this.headers.get(`Accept`);e===`application/vnd.pgrst.object+json`?this.headers.set(`Accept`,`application/vnd.pgrst.object+json;nulls=stripped`):(!e||e===`application/json`)&&this.headers.set(`Accept`,`application/vnd.pgrst.array+json;nulls=stripped`)}let r=this.fetch,i=(async()=>{let e={};n.headers.forEach((t,n)=>{e[n]=t});let t=await ie(r,n.url.toString(),{method:n.method,headers:e,body:JSON.stringify(n.body,(e,t)=>typeof t==`bigint`?t.toString():t),signal:n.signal},n.retryEnabled);return await n.processResponse(t)})();return this.shouldThrowOnError||(i=i.catch(e=>{let t=``,n=``,r=``,i=e?.cause;if(i){let n=i?.message??``,r=i?.code??``;t=`${e?.name??`FetchError`}: ${e?.message}`,t+=`\n\nCaused by: ${i?.name??`Error`}: ${n}`,r&&(t+=` (${r})`),i?.stack&&(t+=`\n${i.stack}`)}else t=e?.stack??``;let a=this.url.toString().length;return e?.name===`AbortError`||e?.code===`ABORT_ERR`?(r=``,n=`Request was aborted (timeout or manual cancellation)`,a>this.urlLengthLimit&&(n+=`. Note: Your request URL is ${a} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)):(i?.name===`HeadersOverflowError`||i?.code===`UND_ERR_HEADERS_OVERFLOW`)&&(r=``,n=`HTTP headers exceeded server limits (typically 16KB)`,a>this.urlLengthLimit&&(n+=`. Your request URL is ${a} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)),{success:!1,error:{message:`${e?.name??`FetchError`}: ${e?.message}`,details:t,hint:n,code:r},data:null,count:null,status:0,statusText:``}})),i.then(e,t)}async processResponse(e){var t=this;let n=null,r=null,i=null,a=e.status,o=e.statusText;if(e.ok){if(t.method!==`HEAD`){let i=await e.text();if(i!==``)if(t.headers.get(`Accept`)===`text/csv`)r=i;else if(t.headers.get(`Accept`)&&t.headers.get(`Accept`)?.includes(`application/vnd.pgrst.plan+text`))r=i;else try{r=JSON.parse(i)}catch{if(n={message:i},r=null,t.shouldThrowOnError)throw new u({message:i,details:``,hint:``,code:``})}}let s=t.headers.get(`Prefer`)?.match(/count=(exact|planned|estimated)/),c=e.headers.get(`content-range`)?.split(`/`);if(s&&c&&c.length>1&&(i=parseInt(c[1])),t.isMaybeSingle&&Array.isArray(r))if(r.length>1){if(n={code:`PGRST116`,details:`Results contain ${r.length} rows, application/vnd.pgrst.object+json requires 1 row`,hint:null,message:`JSON object requested, multiple (or no) rows returned`},r=null,i=null,a=406,o=`Not Acceptable`,t.shouldThrowOnError)throw new u(_(_({},n),{},{hint:n.hint??``}))}else r=r.length===1?r[0]:null}else{let i=await e.text();try{n=JSON.parse(i),Array.isArray(n)&&e.status===404&&(r=[],n=null,a=200,o=`OK`)}catch{e.status===404&&i===``?(a=204,o=`No Content`):n={message:i}}if(n&&t.shouldThrowOnError)throw new u(n)}return{success:n===null,error:n,data:r,count:i,status:a,statusText:o}}returns(){return this}overrideTypes(){return this}},oe=class extends ae{throwOnError(){return super.throwOnError()}select(e){let t=!1,n=(e??`*`).split(``).map(e=>/\s/.test(e)&&!t?``:(e===`"`&&(t=!t),e)).join(``);return this.url.searchParams.set(`select`,n),this.headers.append(`Prefer`,`return=representation`),this}order(e,{ascending:t=!0,nullsFirst:n,foreignTable:r,referencedTable:i=r}={}){let a=i?`${i}.order`:`order`,o=this.url.searchParams.get(a);return this.url.searchParams.set(a,`${o?`${o},`:``}${e}.${t?`asc`:`desc`}${n===void 0?``:n?`.nullsfirst`:`.nullslast`}`),this}limit(e,{foreignTable:t,referencedTable:n=t}={}){let r=n===void 0?`limit`:`${n}.limit`;return this.url.searchParams.set(r,`${e}`),this}range(e,t,{foreignTable:n,referencedTable:r=n}={}){let i=r===void 0?`offset`:`${r}.offset`,a=r===void 0?`limit`:`${r}.limit`;return this.url.searchParams.set(i,`${e}`),this.url.searchParams.set(a,`${t-e+1}`),this}abortSignal(e){return this.signal=e,this}single(){return this.headers.set(`Accept`,`application/vnd.pgrst.object+json`),this}maybeSingle(){return this.isMaybeSingle=!0,this}csv(){return this.headers.set(`Accept`,`text/csv`),this}geojson(){return this.headers.set(`Accept`,`application/geo+json`),this}explain({analyze:e=!1,verbose:t=!1,settings:n=!1,buffers:r=!1,wal:i=!1,format:a=`text`}={}){let o=[e?`analyze`:null,t?`verbose`:null,n?`settings`:null,r?`buffers`:null,i?`wal`:null].filter(Boolean).join(`|`),s=this.headers.get(`Accept`)??`application/json`;return this.headers.set(`Accept`,`application/vnd.pgrst.plan+${a}; for="${s}"; options=${o};`),this}rollback(){return this.headers.append(`Prefer`,`tx=rollback`),this}returns(){return this}maxAffected(e){return this.headers.append(`Prefer`,`handling=strict`),this.headers.append(`Prefer`,`max-affected=${e}`),this}};let se=RegExp(`[,()]`);var ce=class extends oe{throwOnError(){return super.throwOnError()}eq(e,t){return this.url.searchParams.append(e,`eq.${t}`),this}neq(e,t){return this.url.searchParams.append(e,`neq.${t}`),this}gt(e,t){return this.url.searchParams.append(e,`gt.${t}`),this}gte(e,t){return this.url.searchParams.append(e,`gte.${t}`),this}lt(e,t){return this.url.searchParams.append(e,`lt.${t}`),this}lte(e,t){return this.url.searchParams.append(e,`lte.${t}`),this}like(e,t){return this.url.searchParams.append(e,`like.${t}`),this}likeAllOf(e,t){return this.url.searchParams.append(e,`like(all).{${t.join(`,`)}}`),this}likeAnyOf(e,t){return this.url.searchParams.append(e,`like(any).{${t.join(`,`)}}`),this}ilike(e,t){return this.url.searchParams.append(e,`ilike.${t}`),this}ilikeAllOf(e,t){return this.url.searchParams.append(e,`ilike(all).{${t.join(`,`)}}`),this}ilikeAnyOf(e,t){return this.url.searchParams.append(e,`ilike(any).{${t.join(`,`)}}`),this}regexMatch(e,t){return this.url.searchParams.append(e,`match.${t}`),this}regexIMatch(e,t){return this.url.searchParams.append(e,`imatch.${t}`),this}is(e,t){return this.url.searchParams.append(e,`is.${t}`),this}isDistinct(e,t){return this.url.searchParams.append(e,`isdistinct.${t}`),this}in(e,t){let n=Array.from(new Set(t)).map(e=>typeof e==`string`&&se.test(e)?`"${e}"`:`${e}`).join(`,`);return this.url.searchParams.append(e,`in.(${n})`),this}notIn(e,t){let n=Array.from(new Set(t)).map(e=>typeof e==`string`&&se.test(e)?`"${e}"`:`${e}`).join(`,`);return this.url.searchParams.append(e,`not.in.(${n})`),this}contains(e,t){return typeof t==`string`?this.url.searchParams.append(e,`cs.${t}`):Array.isArray(t)?this.url.searchParams.append(e,`cs.{${t.join(`,`)}}`):this.url.searchParams.append(e,`cs.${JSON.stringify(t)}`),this}containedBy(e,t){return typeof t==`string`?this.url.searchParams.append(e,`cd.${t}`):Array.isArray(t)?this.url.searchParams.append(e,`cd.{${t.join(`,`)}}`):this.url.searchParams.append(e,`cd.${JSON.stringify(t)}`),this}rangeGt(e,t){return this.url.searchParams.append(e,`sr.${t}`),this}rangeGte(e,t){return this.url.searchParams.append(e,`nxl.${t}`),this}rangeLt(e,t){return this.url.searchParams.append(e,`sl.${t}`),this}rangeLte(e,t){return this.url.searchParams.append(e,`nxr.${t}`),this}rangeAdjacent(e,t){return this.url.searchParams.append(e,`adj.${t}`),this}overlaps(e,t){return typeof t==`string`?this.url.searchParams.append(e,`ov.${t}`):this.url.searchParams.append(e,`ov.{${t.join(`,`)}}`),this}textSearch(e,t,{config:n,type:r}={}){let i=``;r===`plain`?i=`pl`:r===`phrase`?i=`ph`:r===`websearch`&&(i=`w`);let a=n===void 0?``:`(${n})`;return this.url.searchParams.append(e,`${i}fts${a}.${t}`),this}match(e){return Object.entries(e).filter(([e,t])=>t!==void 0).forEach(([e,t])=>{this.url.searchParams.append(e,`eq.${t}`)}),this}not(e,t,n){return this.url.searchParams.append(e,`not.${t}.${n}`),this}or(e,{foreignTable:t,referencedTable:n=t}={}){let r=n?`${n}.or`:`or`;return this.url.searchParams.append(r,`(${e})`),this}filter(e,t,n){return this.url.searchParams.append(e,`${t}.${n}`),this}},le=class{constructor(e,{headers:t={},schema:n,fetch:r,urlLengthLimit:i=8e3,retry:a}){this.url=e,this.headers=new Headers(t),this.schema=n,this.fetch=r,this.urlLengthLimit=i,this.retry=a}cloneRequestState(){return{url:new URL(this.url.toString()),headers:new Headers(this.headers)}}select(e,t){let{head:n=!1,count:r}=t??{},i=n?`HEAD`:`GET`,a=!1,o=(e??`*`).split(``).map(e=>/\s/.test(e)&&!a?``:(e===`"`&&(a=!a),e)).join(``),{url:s,headers:c}=this.cloneRequestState();return s.searchParams.set(`select`,o),r&&c.append(`Prefer`,`count=${r}`),new ce({method:i,url:s,headers:c,schema:this.schema,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}insert(e,{count:t,defaultToNull:n=!0}={}){let{url:r,headers:i}=this.cloneRequestState();if(t&&i.append(`Prefer`,`count=${t}`),n||i.append(`Prefer`,`missing=default`),Array.isArray(e)){let t=e.reduce((e,t)=>e.concat(Object.keys(t)),[]);if(t.length>0){let e=[...new Set(t)].map(e=>`"${e}"`);r.searchParams.set(`columns`,e.join(`,`))}}return new ce({method:`POST`,url:r,headers:i,schema:this.schema,body:e,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}upsert(e,{onConflict:t,ignoreDuplicates:n=!1,count:r,defaultToNull:i=!0}={}){let{url:a,headers:o}=this.cloneRequestState();if(o.append(`Prefer`,`resolution=${n?`ignore`:`merge`}-duplicates`),t!==void 0&&a.searchParams.set(`on_conflict`,t),r&&o.append(`Prefer`,`count=${r}`),i||o.append(`Prefer`,`missing=default`),Array.isArray(e)){let t=e.reduce((e,t)=>e.concat(Object.keys(t)),[]);if(t.length>0){let e=[...new Set(t)].map(e=>`"${e}"`);a.searchParams.set(`columns`,e.join(`,`))}}return new ce({method:`POST`,url:a,headers:o,schema:this.schema,body:e,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}update(e,{count:t}={}){let{url:n,headers:r}=this.cloneRequestState();return t&&r.append(`Prefer`,`count=${t}`),new ce({method:`PATCH`,url:n,headers:r,schema:this.schema,body:e,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}delete({count:e}={}){let{url:t,headers:n}=this.cloneRequestState();return e&&n.append(`Prefer`,`count=${e}`),new ce({method:`DELETE`,url:t,headers:n,schema:this.schema,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}};function ue(e,t){try{let t=JSON.parse(e);if(t&&typeof t==`object`&&!Array.isArray(t))return new u({message:String(t.message??e),details:t.details??``,hint:t.hint??``,code:t.code??``})}catch{}return new u({message:e||t,details:``,hint:``,code:``})}function de(e,t,n){let r=e;return{success:!1,error:new u({message:`${r?.name??`FetchError`}: ${r?.message}`,details:``,hint:``,code:``}),data:null,count:null,status:t,statusText:n}}var fe=class e{constructor(e,{headers:t={},schema:n,fetch:r,timeout:i,urlLengthLimit:a=8e3,retry:o}={}){this.url=e,this.headers=new Headers(t),this.schemaName=n,this.urlLengthLimit=a;let s=r??globalThis.fetch;i!==void 0&&i>0?this.fetch=(e,t)=>{let n=new AbortController,r=setTimeout(()=>n.abort(),i),a=t?.signal;if(a){if(a.aborted)return clearTimeout(r),s(e,t);let i=()=>{clearTimeout(r),n.abort()};return a.addEventListener(`abort`,i,{once:!0}),s(e,_(_({},t),{},{signal:n.signal})).finally(()=>{clearTimeout(r),a.removeEventListener(`abort`,i)})}return s(e,_(_({},t),{},{signal:n.signal})).finally(()=>clearTimeout(r))}:this.fetch=s,this.retry=o}from(e){if(!e||typeof e!=`string`||e.trim()===``)throw Error(`Invalid relation name: relation must be a non-empty string.`);return new le(new URL(`${this.url}/${e}`),{headers:new Headers(this.headers),schema:this.schemaName,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}schema(t){return new e(this.url,{headers:this.headers,schema:t,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}async getOpenApiSpec(){var e=this;let t=new Headers(e.headers);t.set(`Accept`,`application/openapi+json`),e.schemaName&&t.set(`Accept-Profile`,e.schemaName);let n={};t.forEach((e,t)=>{n[t]=e});let r=e.fetch??globalThis.fetch,i;try{i=await ie(r,`${e.url}/`,{method:`GET`,headers:n},e.retry??!0)}catch(e){return de(e,0,``)}let a;try{a=await i.text()}catch(e){return de(e,i.status,i.statusText)}if(i.ok)try{return{success:!0,error:null,data:JSON.parse(a),count:null,status:i.status,statusText:i.statusText}}catch{}return{success:!1,error:ue(a,i.statusText),data:null,count:null,status:i.status,statusText:i.statusText}}rpc(e,t={},{head:n=!1,get:r=!1,count:i}={}){let a,o=new URL(`${this.url}/rpc/${e}`),s,c=e=>typeof e==`object`&&!!e&&(!Array.isArray(e)||e.some(c)),l=n&&Object.values(t).some(c);l?(a=`POST`,s=t):n||r?(a=n?`HEAD`:`GET`,Object.entries(t).filter(([e,t])=>t!==void 0).map(([e,t])=>[e,Array.isArray(t)?`{${t.join(`,`)}}`:`${t}`]).forEach(([e,t])=>{o.searchParams.append(e,t)})):(a=`POST`,s=t);let u=new Headers(this.headers);return l?u.set(`Prefer`,i?`count=${i},return=minimal`:`return=minimal`):i&&u.set(`Prefer`,`count=${i}`),new ce({method:a,url:o,headers:u,schema:this.schemaName,body:s,fetch:this.fetch??fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}},pe=class{constructor(){}static detectEnvironment(){if(typeof WebSocket<`u`)return{type:`native`,wsConstructor:WebSocket};let e=globalThis;if(typeof globalThis<`u`&&e.WebSocket!==void 0)return{type:`native`,wsConstructor:e.WebSocket};let t=typeof global<`u`?global:void 0;if(t&&t.WebSocket!==void 0)return{type:`native`,wsConstructor:t.WebSocket};if(typeof globalThis<`u`&&e.WebSocketPair!==void 0&&globalThis.WebSocket===void 0)return{type:`cloudflare`,error:`Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.`,workaround:`Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime.`};if(typeof globalThis<`u`&&e.EdgeRuntime||typeof navigator<`u`&&navigator.userAgent?.includes(`Vercel-Edge`))return{type:`unsupported`,error:`Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.`,workaround:`Use serverless functions or a different deployment target for WebSocket functionality.`};let n=globalThis.process;if(n){let e=n.versions;if(e&&e.node)return{type:`unsupported`,error:`Node.js detected but native WebSocket not found.`,workaround:`Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option.`}}return{type:`unsupported`,error:`Unknown JavaScript runtime without WebSocket support.`,workaround:`Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.`}}static getWebSocketConstructor(){let e=this.detectEnvironment();if(e.wsConstructor)return e.wsConstructor;let t=e.error||`WebSocket not supported in this environment.`;throw e.workaround&&(t+=`\n\nSuggested solution: ${e.workaround}`),Error(t)}static isWebSocketSupported(){try{return this.detectEnvironment().type===`native`}catch{return!1}}};let v={closed:`closed`,errored:`errored`,joined:`joined`,joining:`joining`,leaving:`leaving`},me={close:`phx_close`,error:`phx_error`,join:`phx_join`,reply:`phx_reply`,leave:`phx_leave`,access_token:`access_token`},he={connecting:`connecting`,open:`open`,closing:`closing`,closed:`closed`};var ge=class{constructor(e){this.HEADER_LENGTH=1,this.USER_BROADCAST_PUSH_META_LENGTH=6,this.KINDS={userBroadcastPush:3,userBroadcast:4},this.BINARY_ENCODING=0,this.JSON_ENCODING=1,this.BROADCAST_EVENT=`broadcast`,this.allowedMetadataKeys=[],this.allowedMetadataKeys=e??[]}encode(e,t){if(e.event===this.BROADCAST_EVENT&&!(e.payload instanceof ArrayBuffer)&&typeof e.payload.event==`string`)return t(this._binaryEncodeUserBroadcastPush(e));let n=[e.join_ref,e.ref,e.topic,e.event,e.payload];return t(JSON.stringify(n))}_binaryEncodeUserBroadcastPush(e){return this._isArrayBuffer(e.payload?.payload)?this._encodeBinaryUserBroadcastPush(e):this._encodeJsonUserBroadcastPush(e)}_encodeBinaryUserBroadcastPush(e){let t=e.payload?.payload??new ArrayBuffer(0);return this._encodeUserBroadcastPush(e,this.BINARY_ENCODING,t)}_encodeJsonUserBroadcastPush(e){let t=e.payload?.payload??{},n=new TextEncoder().encode(JSON.stringify(t)).buffer;return this._encodeUserBroadcastPush(e,this.JSON_ENCODING,n)}_encodeUserBroadcastPush(e,t,n){let r=new TextEncoder,i=r.encode(e.topic),a=r.encode(e.ref??``),o=r.encode(e.join_ref??``),s=r.encode(e.payload.event),c=this.allowedMetadataKeys?this._pick(e.payload,this.allowedMetadataKeys):{},l=r.encode(Object.keys(c).length===0?``:JSON.stringify(c));if(o.length>255)throw Error(`joinRef length ${o.length} exceeds maximum of 255`);if(a.length>255)throw Error(`ref length ${a.length} exceeds maximum of 255`);if(i.length>255)throw Error(`topic length ${i.length} exceeds maximum of 255`);if(s.length>255)throw Error(`userEvent length ${s.length} exceeds maximum of 255`);if(l.length>255)throw Error(`metadata length ${l.length} exceeds maximum of 255`);let u=this.USER_BROADCAST_PUSH_META_LENGTH+o.length+a.length+i.length+s.length+l.length,d=new ArrayBuffer(this.HEADER_LENGTH+u),f=new DataView(d),p=new Uint8Array(d),m=0;f.setUint8(m++,this.KINDS.userBroadcastPush),f.setUint8(m++,o.length),f.setUint8(m++,a.length),f.setUint8(m++,i.length),f.setUint8(m++,s.length),f.setUint8(m++,l.length),f.setUint8(m++,t),p.set(o,m),m+=o.length,p.set(a,m),m+=a.length,p.set(i,m),m+=i.length,p.set(s,m),m+=s.length,p.set(l,m),m+=l.length;var h=new Uint8Array(d.byteLength+n.byteLength);return h.set(new Uint8Array(d),0),h.set(new Uint8Array(n),d.byteLength),h.buffer}decode(e,t){if(this._isArrayBuffer(e))return t(this._binaryDecode(e));if(typeof e==`string`){let[n,r,i,a,o]=JSON.parse(e);return t({join_ref:n,ref:r,topic:i,event:a,payload:o})}return t({})}_binaryDecode(e){let t=new DataView(e),n=t.getUint8(0),r=new TextDecoder;switch(n){case this.KINDS.userBroadcast:return this._decodeUserBroadcast(e,t,r)}}_decodeUserBroadcast(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=t.getUint8(3),o=t.getUint8(4),s=this.HEADER_LENGTH+4,c=n.decode(e.slice(s,s+r));s+=r;let l=n.decode(e.slice(s,s+i));s+=i;let u=n.decode(e.slice(s,s+a));s+=a;let d=e.slice(s,e.byteLength),f=o===this.JSON_ENCODING?JSON.parse(n.decode(d)):d,p={type:this.BROADCAST_EVENT,event:l,payload:f};return a>0&&(p.meta=JSON.parse(u)),{join_ref:null,ref:null,topic:c,event:this.BROADCAST_EVENT,payload:p}}_isArrayBuffer(e){return e instanceof ArrayBuffer||e?.constructor?.name===`ArrayBuffer`}_pick(e,t){return!e||typeof e!=`object`?{}:Object.fromEntries(Object.entries(e).filter(([e])=>t.includes(e)))}},y;(function(e){e.abstime=`abstime`,e.bool=`bool`,e.date=`date`,e.daterange=`daterange`,e.float4=`float4`,e.float8=`float8`,e.int2=`int2`,e.int4=`int4`,e.int4range=`int4range`,e.int8=`int8`,e.int8range=`int8range`,e.json=`json`,e.jsonb=`jsonb`,e.money=`money`,e.numeric=`numeric`,e.oid=`oid`,e.reltime=`reltime`,e.text=`text`,e.time=`time`,e.timestamp=`timestamp`,e.timestamptz=`timestamptz`,e.timetz=`timetz`,e.tsrange=`tsrange`,e.tstzrange=`tstzrange`})(y||={});let _e=(e,t,n={})=>{let r=n.skipTypes??[];return t?Object.keys(t).reduce((n,i)=>(n[i]=ve(i,e,t,r),n),{}):{}},ve=(e,t,n,r)=>{let i=t.find(t=>t.name===e)?.type,a=n[e];return i&&!r.includes(i)?ye(i,a):be(a)},ye=(e,t)=>{if(e.charAt(0)===`_`)return we(t,e.slice(1,e.length));switch(e){case y.bool:return xe(t);case y.float4:case y.float8:case y.int2:case y.int4:case y.int8:case y.numeric:case y.oid:return Se(t);case y.json:case y.jsonb:return Ce(t);case y.timestamp:return Te(t);case y.abstime:case y.date:case y.daterange:case y.int4range:case y.int8range:case y.money:case y.reltime:case y.text:case y.time:case y.timestamptz:case y.timetz:case y.tsrange:case y.tstzrange:return be(t);default:return be(t)}},be=e=>e,xe=e=>{switch(e){case`t`:return!0;case`f`:return!1;default:return e}},Se=e=>{if(typeof e==`string`){let t=parseFloat(e);if(!Number.isNaN(t))return t}return e},Ce=e=>{if(typeof e==`string`)try{return JSON.parse(e)}catch{return e}return e},we=(e,t)=>{if(typeof e!=`string`)return e;let n=e.length-1,r=e[n];if(e[0]===`{`&&r===`}`){let r,i=e.slice(1,n);try{r=JSON.parse(`[`+i+`]`)}catch{r=i?i.split(`,`):[]}return r.map(e=>ye(t,e))}return e},Te=e=>typeof e==`string`?e.replace(` `,`T`):e,Ee=e=>{let t=new URL(e);return t.protocol=t.protocol.replace(/^ws/i,`http`),t.pathname=t.pathname.replace(/\/+$/,``).replace(/\/socket\/websocket$/i,``).replace(/\/socket$/i,``).replace(/\/websocket$/i,``),t.pathname===``||t.pathname===`/`?t.pathname=`/api/broadcast`:t.pathname+=`/api/broadcast`,t.href};var b=e=>typeof e==`function`?e:function(){return e},De=typeof self<`u`?self:null,Oe=typeof window<`u`?window:null,x=De||Oe||globalThis,ke=`2.0.0`,Ae=1e4,je=1e3,Me=100,S={connecting:0,open:1,closing:2,closed:3},C={closed:`closed`,errored:`errored`,joined:`joined`,joining:`joining`,leaving:`leaving`},w={close:`phx_close`,error:`phx_error`,join:`phx_join`,reply:`phx_reply`,leave:`phx_leave`},Ne={longpoll:`longpoll`,websocket:`websocket`},Pe={complete:4},Fe=`base64url.bearer.phx.`,Ie=class{constructor(e,t,n,r){this.channel=e,this.event=t,this.payload=n||function(){return{}},this.receivedResp=null,this.timeout=r,this.timeoutTimer=null,this.recHooks=[],this.sent=!1,this.ref=void 0}resend(e){this.timeout=e,this.reset(),this.send()}send(){this.hasReceived(`timeout`)||(this.startTimeout(),this.sent=!0,this.channel.socket.push({topic:this.channel.topic,event:this.event,payload:this.payload(),ref:this.ref,join_ref:this.channel.joinRef()}))}receive(e,t){return this.hasReceived(e)&&t(this.receivedResp.response),this.recHooks.push({status:e,callback:t}),this}reset(){this.cancelRefEvent(),this.ref=null,this.refEvent=null,this.receivedResp=null,this.sent=!1}destroy(){this.cancelRefEvent(),this.cancelTimeout()}matchReceive({status:e,response:t,_ref:n}){this.recHooks.filter(t=>t.status===e).forEach(e=>e.callback(t))}cancelRefEvent(){this.refEvent&&this.channel.off(this.refEvent)}cancelTimeout(){clearTimeout(this.timeoutTimer),this.timeoutTimer=null}startTimeout(){this.timeoutTimer&&this.cancelTimeout(),this.ref=this.channel.socket.makeRef(),this.refEvent=this.channel.replyEventName(this.ref),this.channel.on(this.refEvent,e=>{this.cancelRefEvent(),this.cancelTimeout(),this.receivedResp=e,this.matchReceive(e)}),this.timeoutTimer=setTimeout(()=>{this.trigger(`timeout`,{})},this.timeout)}hasReceived(e){return this.receivedResp&&this.receivedResp.status===e}trigger(e,t){this.channel.trigger(this.refEvent,{status:e,response:t})}},Le=class{constructor(e,t){this.callback=e,this.timerCalc=t,this.timer=void 0,this.tries=0}reset(){this.tries=0,clearTimeout(this.timer)}scheduleTimeout(){clearTimeout(this.timer),this.timer=setTimeout(()=>{this.tries+=1,this.callback()},this.timerCalc(this.tries+1))}},Re=class{constructor(e,t,n){this.state=C.closed,this.topic=e,this.params=b(t||{}),this.socket=n,this.bindings=[],this.bindingRef=0,this.timeout=this.socket.timeout,this.joinedOnce=!1,this.joinPush=new Ie(this,w.join,this.params,this.timeout),this.pushBuffer=[],this.stateChangeRefs=[],this.rejoinTimer=new Le(()=>{this.socket.isConnected()&&this.rejoin()},this.socket.rejoinAfterMs),this.stateChangeRefs.push(this.socket.onError(()=>this.rejoinTimer.reset())),this.stateChangeRefs.push(this.socket.onOpen(()=>{this.rejoinTimer.reset(),this.isErrored()&&this.rejoin()})),this.joinPush.receive(`ok`,()=>{this.state=C.joined,this.rejoinTimer.reset(),this.pushBuffer.forEach(e=>e.send()),this.pushBuffer=[]}),this.joinPush.receive(`error`,e=>{this.state=C.errored,this.socket.hasLogger()&&this.socket.log(`channel`,`error ${this.topic}`,e),this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.onClose(()=>{this.rejoinTimer.reset(),this.socket.hasLogger()&&this.socket.log(`channel`,`close ${this.topic}`),this.state=C.closed,this.socket.remove(this)}),this.onError(e=>{this.socket.hasLogger()&&this.socket.log(`channel`,`error ${this.topic}`,e),this.isJoining()&&this.joinPush.reset(),this.state=C.errored,this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.joinPush.receive(`timeout`,()=>{this.socket.hasLogger()&&this.socket.log(`channel`,`timeout ${this.topic}`,this.joinPush.timeout),new Ie(this,w.leave,b({}),this.timeout).send(),this.state=C.errored,this.joinPush.reset(),this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.on(w.reply,(e,t)=>{this.trigger(this.replyEventName(t),e)})}join(e=this.timeout){if(this.joinedOnce)throw Error(`tried to join multiple times. 'join' can only be called a single time per channel instance`);return this.timeout=e,this.joinedOnce=!0,this.rejoin(),this.joinPush}teardown(){this.pushBuffer.forEach(e=>e.destroy()),this.pushBuffer=[],this.rejoinTimer.reset(),this.joinPush.destroy(),this.state=C.closed,this.bindings=[]}onClose(e){this.on(w.close,e)}onError(e){return this.on(w.error,t=>e(t))}on(e,t){let n=this.bindingRef++;return this.bindings.push({event:e,ref:n,callback:t}),n}off(e,t){this.bindings=this.bindings.filter(n=>!(n.event===e&&(t===void 0||t===n.ref)))}canPush(){return this.socket.isConnected()&&this.isJoined()}push(e,t,n=this.timeout){if(t||={},!this.joinedOnce)throw Error(`tried to push '${e}' to '${this.topic}' before joining. Use channel.join() before pushing events`);let r=new Ie(this,e,function(){return t},n);return this.canPush()?r.send():(r.startTimeout(),this.pushBuffer.push(r)),r}leave(e=this.timeout){this.rejoinTimer.reset(),this.joinPush.cancelTimeout(),this.state=C.leaving;let t=()=>{this.socket.hasLogger()&&this.socket.log(`channel`,`leave ${this.topic}`),this.trigger(w.close,`leave`)},n=new Ie(this,w.leave,b({}),e);return n.receive(`ok`,()=>t()).receive(`timeout`,()=>t()),n.send(),this.canPush()||n.trigger(`ok`,{}),n}onMessage(e,t,n){return t}filterBindings(e,t,n){return!0}isMember(e,t,n,r){return this.topic===e?r&&r!==this.joinRef()?(this.socket.hasLogger()&&this.socket.log(`channel`,`dropping outdated message`,{topic:e,event:t,payload:n,joinRef:r}),!1):!0:!1}joinRef(){return this.joinPush.ref}rejoin(e=this.timeout){this.isLeaving()||(this.socket.leaveOpenTopic(this.topic),this.state=C.joining,this.joinPush.resend(e))}trigger(e,t,n,r){let i=this.onMessage(e,t,n,r);if(t&&!i)throw Error(`channel onMessage callbacks must return the payload, modified or unmodified`);let a=this.bindings.filter(r=>r.event===e&&this.filterBindings(r,t,n));for(let e=0;e<a.length;e++)a[e].callback(i,n,r||this.joinRef())}replyEventName(e){return`chan_reply_${e}`}isClosed(){return this.state===C.closed}isErrored(){return this.state===C.errored}isJoined(){return this.state===C.joined}isJoining(){return this.state===C.joining}isLeaving(){return this.state===C.leaving}},ze=class{static request(e,t,n,r,i,a,o){if(x.XDomainRequest){let n=new x.XDomainRequest;return this.xdomainRequest(n,e,t,r,i,a,o)}else if(x.XMLHttpRequest){let s=new x.XMLHttpRequest;return this.xhrRequest(s,e,t,n,r,i,a,o)}else if(x.fetch&&x.AbortController)return this.fetchRequest(e,t,n,r,i,a,o);else throw Error(`No suitable XMLHttpRequest implementation found`)}static fetchRequest(e,t,n,r,i,a,o){let s={method:e,headers:n,body:r},c=null;return i&&(c=new AbortController,setTimeout(()=>c.abort(),i),s.signal=c.signal),x.fetch(t,s).then(e=>e.text()).then(e=>this.parseJSON(e)).then(e=>o&&o(e)).catch(e=>{e.name===`AbortError`&&a?a():o&&o(null)}),c}static xdomainRequest(e,t,n,r,i,a,o){return e.timeout=i,e.open(t,n),e.onload=()=>{let t=this.parseJSON(e.responseText);o&&o(t)},a&&(e.ontimeout=a),e.onprogress=()=>{},e.send(r),e}static xhrRequest(e,t,n,r,i,a,o,s){e.open(t,n,!0),e.timeout=a;for(let[t,n]of Object.entries(r))e.setRequestHeader(t,n);return e.onerror=()=>s&&s(null),e.onreadystatechange=()=>{e.readyState===Pe.complete&&s&&s(this.parseJSON(e.responseText))},o&&(e.ontimeout=o),e.send(i),e}static parseJSON(e){if(!e||e===``)return null;try{return JSON.parse(e)}catch{return console&&console.log(`failed to parse JSON response`,e),null}}static serialize(e,t){let n=[];for(var r in e){if(!Object.prototype.hasOwnProperty.call(e,r))continue;let i=t?`${t}[${r}]`:r,a=e[r];typeof a==`object`?n.push(this.serialize(a,i)):n.push(encodeURIComponent(i)+`=`+encodeURIComponent(a))}return n.join(`&`)}static appendParams(e,t){return Object.keys(t).length===0?e:`${e}${e.match(/\?/)?`&`:`?`}${this.serialize(t)}`}},Be=e=>{let t=``,n=new Uint8Array(e),r=n.byteLength;for(let e=0;e<r;e++)t+=String.fromCharCode(n[e]);return btoa(t)},Ve=class{constructor(e,t){t&&t.length===2&&t[1].startsWith(Fe)&&(this.authToken=atob(t[1].slice(Fe.length))),this.endPoint=null,this.token=null,this.skipHeartbeat=!0,this.reqs=new Set,this.awaitingBatchAck=!1,this.currentBatch=null,this.currentBatchTimer=null,this.batchBuffer=[],this.onopen=function(){},this.onerror=function(){},this.onmessage=function(){},this.onclose=function(){},this.pollEndpoint=this.normalizeEndpoint(e),this.readyState=S.connecting,setTimeout(()=>this.poll(),0)}normalizeEndpoint(e){return e.replace(`ws://`,`http://`).replace(`wss://`,`https://`).replace(RegExp(`(.*)/`+Ne.websocket),`$1/`+Ne.longpoll)}endpointURL(){return ze.appendParams(this.pollEndpoint,{token:this.token})}closeAndRetry(e,t,n){this.close(e,t,n),this.readyState=S.connecting}ontimeout(){this.onerror(`timeout`),this.closeAndRetry(1005,`timeout`,!1)}isActive(){return this.readyState===S.open||this.readyState===S.connecting}poll(){let e={Accept:`application/json`};this.authToken&&(e[`X-Phoenix-AuthToken`]=this.authToken),this.ajax(`GET`,e,null,()=>this.ontimeout(),e=>{if(e){var{status:t,token:n,messages:r}=e;if(t===410&&this.token!==null){this.onerror(410),this.closeAndRetry(3410,`session_gone`,!1);return}this.token=n}else t=0;switch(t){case 200:r.forEach(e=>{setTimeout(()=>this.onmessage({data:e}),0)}),this.poll();break;case 204:this.poll();break;case 410:this.readyState=S.open,this.onopen({}),this.poll();break;case 403:this.onerror(403),this.close(1008,`forbidden`,!1);break;case 0:case 500:this.onerror(500),this.closeAndRetry(1011,`internal server error`,500);break;default:throw Error(`unhandled poll status ${t}`)}})}send(e){typeof e!=`string`&&(e=Be(e)),this.currentBatch?this.currentBatch.push(e):this.awaitingBatchAck?this.batchBuffer.push(e):(this.currentBatch=[e],this.currentBatchTimer=setTimeout(()=>{this.batchSend(this.currentBatch),this.currentBatch=null},0))}batchSend(e,t=0){this.awaitingBatchAck=!0;let n=t+Me,r=e.slice(t,n);this.ajax(`POST`,{"Content-Type":`application/x-ndjson`},r.join(`
`),()=>this.onerror(`timeout`),t=>{!t||t.status!==200?(this.awaitingBatchAck=!1,this.onerror(t&&t.status),this.closeAndRetry(1011,`internal server error`,!1)):n<e.length?this.batchSend(e,n):this.batchBuffer.length>0?(this.batchSend(this.batchBuffer),this.batchBuffer=[]):this.awaitingBatchAck=!1})}close(e,t,n){for(let e of this.reqs)e.abort();this.readyState=S.closed;let r=Object.assign({code:1e3,reason:void 0,wasClean:!0},{code:e,reason:t,wasClean:n});this.batchBuffer=[],clearTimeout(this.currentBatchTimer),this.currentBatchTimer=null,typeof CloseEvent<`u`?this.onclose(new CloseEvent(`close`,r)):this.onclose(r)}ajax(e,t,n,r,i){let a;a=ze.request(e,this.endpointURL(),t,n,this.timeout,()=>{this.reqs.delete(a),r()},e=>{this.reqs.delete(a),this.isActive()&&i(e)}),this.reqs.add(a)}},He=class e{constructor(t,n={}){let r=n.events||{state:`presence_state`,diff:`presence_diff`};this.state=Object.create(null),this.pendingDiffs=[],this.channel=t,this.joinRef=null,this.caller={onJoin:function(){},onLeave:function(){},onSync:function(){}},this.channel.on(r.state,t=>{let{onJoin:n,onLeave:r,onSync:i}=this.caller;this.joinRef=this.channel.joinRef(),this.state=e.syncState(this.state,t,n,r),this.pendingDiffs.forEach(t=>{this.state=e.syncDiff(this.state,t,n,r)}),this.pendingDiffs=[],i()}),this.channel.on(r.diff,t=>{let{onJoin:n,onLeave:r,onSync:i}=this.caller;this.inPendingSyncState()?this.pendingDiffs.push(t):(this.state=e.syncDiff(this.state,t,n,r),i())})}onJoin(e){this.caller.onJoin=e}onLeave(e){this.caller.onLeave=e}onSync(e){this.caller.onSync=e}list(t){return e.list(this.state,t)}inPendingSyncState(){return!this.joinRef||this.joinRef!==this.channel.joinRef()}static syncState(e,t,n,r){let i=this.toNullProtoObj(this.clone(e));t=this.toNullProtoObj(t);let a=Object.create(null),o=Object.create(null);return this.map(i,(e,n)=>{t[e]||(o[e]=n)}),this.map(t,(e,t)=>{let n=i[e];if(n){let r=t.metas.map(e=>e.phx_ref),i=n.metas.map(e=>e.phx_ref),s=t.metas.filter(e=>i.indexOf(e.phx_ref)<0),c=n.metas.filter(e=>r.indexOf(e.phx_ref)<0);s.length>0&&(a[e]=t,a[e].metas=s),c.length>0&&(o[e]=this.clone(n),o[e].metas=c)}else a[e]=t}),this.syncDiff(i,{joins:a,leaves:o},n,r)}static syncDiff(e,t,n,r){e=this.toNullProtoObj(e);let{joins:i,leaves:a}=this.clone(t);return n||=function(){},r||=function(){},this.map(i,(t,r)=>{let i=e[t];if(e[t]=this.clone(r),i){let n=e[t].metas.map(e=>e.phx_ref),r=i.metas.filter(e=>n.indexOf(e.phx_ref)<0);e[t].metas.unshift(...r)}n(t,i,r)}),this.map(a,(t,n)=>{let i=e[t];if(!i)return;let a=n.metas.map(e=>e.phx_ref);i.metas=i.metas.filter(e=>a.indexOf(e.phx_ref)<0),r(t,i,n),i.metas.length===0&&delete e[t]}),e}static list(e,t){return t||=function(e,t){return t},this.map(e,(e,n)=>t(e,n))}static map(e,t){return Object.getOwnPropertyNames(e).map(n=>t(n,e[n]))}static toNullProtoObj(e){if(Object.getPrototypeOf(e)===null)return e;let t=Object.create(null);return Object.getOwnPropertyNames(e).forEach(n=>{t[n]=e[n]}),t}static clone(e){return JSON.parse(JSON.stringify(e))}},Ue={HEADER_LENGTH:1,META_LENGTH:4,KINDS:{push:0,reply:1,broadcast:2},encode(e,t){if(e.payload.constructor===ArrayBuffer)return t(this.binaryEncode(e));{let n=[e.join_ref,e.ref,e.topic,e.event,e.payload];return t(JSON.stringify(n))}},decode(e,t){if(e.constructor===ArrayBuffer)return t(this.binaryDecode(e));{let[n,r,i,a,o]=JSON.parse(e);return t({join_ref:n,ref:r,topic:i,event:a,payload:o})}},binaryEncode(e){let{join_ref:t,ref:n,event:r,topic:i,payload:a}=e,o=new TextEncoder,s=o.encode(t),c=o.encode(n),l=o.encode(i),u=o.encode(r);this.assertFieldSize(s.byteLength,`join_ref`),this.assertFieldSize(c.byteLength,`ref`),this.assertFieldSize(l.byteLength,`topic`),this.assertFieldSize(u.byteLength,`event`);let d=this.META_LENGTH+s.byteLength+c.byteLength+l.byteLength+u.byteLength,f=new ArrayBuffer(this.HEADER_LENGTH+d),p=new Uint8Array(f),m=new DataView(f),h=0;m.setUint8(h++,this.KINDS.push),m.setUint8(h++,s.byteLength),m.setUint8(h++,c.byteLength),m.setUint8(h++,l.byteLength),m.setUint8(h++,u.byteLength),p.set(s,h),h+=s.byteLength,p.set(c,h),h+=c.byteLength,p.set(l,h),h+=l.byteLength,p.set(u,h),h+=u.byteLength;var g=new Uint8Array(f.byteLength+a.byteLength);return g.set(p,0),g.set(new Uint8Array(a),f.byteLength),g.buffer},assertFieldSize(e,t){if(e>255)throw Error(`unable to convert ${t} to binary: must be less than or equal to 255 bytes, but is ${e} bytes`)},binaryDecode(e){let t=new DataView(e),n=t.getUint8(0),r=new TextDecoder;switch(n){case this.KINDS.push:return this.decodePush(e,t,r);case this.KINDS.reply:return this.decodeReply(e,t,r);case this.KINDS.broadcast:return this.decodeBroadcast(e,t,r)}},decodePush(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=t.getUint8(3),o=this.HEADER_LENGTH+this.META_LENGTH-1,s=n.decode(e.slice(o,o+r));o+=r;let c=n.decode(e.slice(o,o+i));o+=i;let l=n.decode(e.slice(o,o+a));return o+=a,{join_ref:s,ref:null,topic:c,event:l,payload:e.slice(o,e.byteLength)}},decodeReply(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=t.getUint8(3),o=t.getUint8(4),s=this.HEADER_LENGTH+this.META_LENGTH,c=n.decode(e.slice(s,s+r));s+=r;let l=n.decode(e.slice(s,s+i));s+=i;let u=n.decode(e.slice(s,s+a));s+=a;let d=n.decode(e.slice(s,s+o));s+=o;let f={status:d,response:e.slice(s,e.byteLength)};return{join_ref:c,ref:l,topic:u,event:w.reply,payload:f}},decodeBroadcast(e,t,n){let r=t.getUint8(1),i=t.getUint8(2),a=this.HEADER_LENGTH+2,o=n.decode(e.slice(a,a+r));a+=r;let s=n.decode(e.slice(a,a+i));return a+=i,{join_ref:null,ref:null,topic:o,event:s,payload:e.slice(a,e.byteLength)}}},We=class{constructor(e,t={}){this.stateChangeCallbacks={open:[],close:[],error:[],message:[]},this.channels=[],this.sendBuffer=[],this.ref=0,this.fallbackRef=null,this.timeout=t.timeout||Ae,this.transport=t.transport||x.WebSocket||Ve,this.conn=void 0,this.primaryPassedHealthCheck=!1,this.longPollFallbackMs=t.longPollFallbackMs,this.fallbackTimer=null;let n=null;try{n=x&&x.sessionStorage}catch{}this.sessionStore=t.sessionStorage||n,this.establishedConnections=0,this.defaultEncoder=Ue.encode.bind(Ue),this.defaultDecoder=Ue.decode.bind(Ue),this.closeWasClean=!0,this.disconnecting=!1,this.binaryType=t.binaryType||`arraybuffer`,this.connectClock=1,this.pageHidden=!1,this.encode=void 0,this.decode=void 0,this.transport===Ve?(this.encode=this.defaultEncoder,this.decode=this.defaultDecoder):(this.encode=t.encode||this.defaultEncoder,this.decode=t.decode||this.defaultDecoder);let r=null;Oe&&Oe.addEventListener&&(Oe.addEventListener(`pagehide`,e=>{this.conn&&(this.disconnect(),r=this.connectClock)}),Oe.addEventListener(`pageshow`,e=>{r===this.connectClock&&(r=null,this.connect())}),Oe.addEventListener(`visibilitychange`,()=>{document.visibilityState===`hidden`?this.pageHidden=!0:(this.pageHidden=!1,!this.isConnected()&&!this.closeWasClean&&this.teardown(()=>this.connect()))})),this.heartbeatIntervalMs=t.heartbeatIntervalMs||3e4,this.autoSendHeartbeat=t.autoSendHeartbeat??!0,this.heartbeatCallback=t.heartbeatCallback??(()=>{}),this.rejoinAfterMs=e=>t.rejoinAfterMs?t.rejoinAfterMs(e):[1e3,2e3,5e3][e-1]||1e4,this.reconnectAfterMs=e=>t.reconnectAfterMs?t.reconnectAfterMs(e):[10,50,100,150,200,250,500,1e3,2e3][e-1]||5e3,this.logger=t.logger||null,!this.logger&&t.debug&&(this.logger=(e,t,n)=>{console.log(`${e}: ${t}`,n)}),this.longpollerTimeout=t.longpollerTimeout||2e4,this.params=b(t.params||{}),this.endPoint=`${e}/${Ne.websocket}`,this.vsn=t.vsn||ke,this.heartbeatTimeoutTimer=null,this.heartbeatTimer=null,this.heartbeatSentAt=null,this.pendingHeartbeatRef=null,this.reconnectTimer=new Le(()=>{if(this.pageHidden){this.log(`Not reconnecting as page is hidden!`),this.teardown();return}this.teardown(async()=>{t.beforeReconnect&&await t.beforeReconnect(),this.connect()})},this.reconnectAfterMs),this.authToken=t.authToken&&b(t.authToken)}getLongPollTransport(){return Ve}replaceTransport(e){this.connectClock++,this.closeWasClean=!0,clearTimeout(this.fallbackTimer),this.reconnectTimer.reset(),this.conn&&=(this.conn.close(),null),this.transport=e}protocol(){return location.protocol.match(/^https/)?`wss`:`ws`}endPointURL(){let e=ze.appendParams(ze.appendParams(this.endPoint,this.params()),{vsn:this.vsn});return e.charAt(0)===`/`?e.charAt(1)===`/`?`${this.protocol()}:${e}`:`${this.protocol()}://${location.host}${e}`:e}disconnect(e,t,n){this.connectClock++,this.disconnecting=!0,this.closeWasClean=!0,clearTimeout(this.fallbackTimer),this.reconnectTimer.reset(),this.teardown(()=>{this.disconnecting=!1,e&&e()},t,n)}connect(e){e&&(console&&console.log(`passing params to connect is deprecated. Instead pass :params to the Socket constructor`),this.params=b(e)),!(this.conn&&!this.disconnecting)&&(this.longPollFallbackMs&&this.transport!==Ve?this.connectWithFallback(Ve,this.longPollFallbackMs):this.transportConnect())}log(e,t,n){this.logger&&this.logger(e,t,n)}hasLogger(){return this.logger!==null}onOpen(e){let t=this.makeRef();return this.stateChangeCallbacks.open.push([t,e]),t}onClose(e){let t=this.makeRef();return this.stateChangeCallbacks.close.push([t,e]),t}onError(e){let t=this.makeRef();return this.stateChangeCallbacks.error.push([t,e]),t}onMessage(e){let t=this.makeRef();return this.stateChangeCallbacks.message.push([t,e]),t}onHeartbeat(e){this.heartbeatCallback=e}ping(e){if(!this.isConnected())return!1;let t=this.makeRef(),n=Date.now();this.push({topic:`phoenix`,event:`heartbeat`,payload:{},ref:t});let r=this.onMessage(i=>{i.ref===t&&(this.off([r]),e(Date.now()-n))});return!0}transportName(e){switch(e){case Ve:return`LongPoll`;default:return e.name}}transportConnect(){this.connectClock++,this.closeWasClean=!1;let e;this.authToken&&(e=[`phoenix`,`${Fe}${btoa(this.authToken()).replace(/=/g,``)}`]),this.conn=new this.transport(this.endPointURL(),e),this.conn.binaryType=this.binaryType,this.conn.timeout=this.longpollerTimeout,this.conn.onopen=()=>this.onConnOpen(),this.conn.onerror=e=>this.onConnError(e),this.conn.onmessage=e=>this.onConnMessage(e),this.conn.onclose=e=>this.onConnClose(e)}getSession(e){return this.sessionStore&&this.sessionStore.getItem(e)}storeSession(e,t){this.sessionStore&&this.sessionStore.setItem(e,t)}connectWithFallback(e,t=2500){clearTimeout(this.fallbackTimer);let n=!1,r=!0,i,a=this.transportName(e),o=t=>{this.log(`transport`,`falling back to ${a}...`,t),this.off([void 0,i]),r=!1,this.replaceTransport(e),this.transportConnect()};if(this.getSession(`phx:fallback:${a}`))return o(`memorized`);this.fallbackTimer=setTimeout(o,t),i=this.onError(e=>{this.log(`transport`,`error`,e),r&&!n&&(clearTimeout(this.fallbackTimer),o(e))}),this.fallbackRef&&this.off([this.fallbackRef]),this.fallbackRef=this.onOpen(()=>{if(n=!0,!r){let t=this.transportName(e);return this.primaryPassedHealthCheck||this.storeSession(`phx:fallback:${t}`,`true`),this.log(`transport`,`established ${t} fallback`)}clearTimeout(this.fallbackTimer),this.fallbackTimer=setTimeout(o,t),this.ping(e=>{this.log(`transport`,`connected to primary after`,e),this.primaryPassedHealthCheck=!0,clearTimeout(this.fallbackTimer)})}),this.transportConnect()}clearHeartbeats(){clearTimeout(this.heartbeatTimer),clearTimeout(this.heartbeatTimeoutTimer)}onConnOpen(){this.hasLogger()&&this.log(`transport`,`connected to ${this.endPointURL()}`),this.closeWasClean=!1,this.disconnecting=!1,this.establishedConnections++,this.flushSendBuffer(),this.reconnectTimer.reset(),this.autoSendHeartbeat&&this.resetHeartbeat(),this.triggerStateCallbacks(`open`)}heartbeatTimeout(){if(this.pendingHeartbeatRef){this.pendingHeartbeatRef=null,this.heartbeatSentAt=null,this.hasLogger()&&this.log(`transport`,`heartbeat timeout. Attempting to re-establish connection`);try{this.heartbeatCallback(`timeout`)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}this.triggerChanError(Error(`heartbeat timeout`)),this.closeWasClean=!1,this.teardown(()=>this.reconnectTimer.scheduleTimeout(),je,`heartbeat timeout`)}}resetHeartbeat(){this.conn&&this.conn.skipHeartbeat||(this.pendingHeartbeatRef=null,this.clearHeartbeats(),this.heartbeatTimer=setTimeout(()=>this.sendHeartbeat(),this.heartbeatIntervalMs))}teardown(e,t,n){if(!this.conn)return e&&e();let r=this.conn;this.waitForBufferDone(r,()=>{t?r.close(t,n||``):r.close(),this.waitForSocketClosed(r,()=>{this.conn===r&&(this.conn.onopen=function(){},this.conn.onerror=function(){},this.conn.onmessage=function(){},this.conn.onclose=function(){},this.conn=null),e&&e()})})}waitForBufferDone(e,t,n=1){if(n===5||!e.bufferedAmount){t();return}setTimeout(()=>{this.waitForBufferDone(e,t,n+1)},150*n)}waitForSocketClosed(e,t,n=1){if(n===5||e.readyState===S.closed){t();return}setTimeout(()=>{this.waitForSocketClosed(e,t,n+1)},150*n)}onConnClose(e){this.conn&&(this.conn.onclose=()=>{}),this.hasLogger()&&this.log(`transport`,`close`,e),this.triggerChanError(e),this.clearHeartbeats(),this.closeWasClean||this.reconnectTimer.scheduleTimeout(),this.triggerStateCallbacks(`close`,e)}onConnError(e){this.hasLogger()&&this.log(`transport`,`error`,e);let t=this.transport,n=this.establishedConnections;this.triggerStateCallbacks(`error`,e,t,n),(t===this.transport||n>0)&&this.triggerChanError(e)}triggerChanError(e){this.channels.forEach(t=>{t.isErrored()||t.isLeaving()||t.isClosed()||t.trigger(w.error,e)})}connectionState(){switch(this.conn&&this.conn.readyState){case S.connecting:return`connecting`;case S.open:return`open`;case S.closing:return`closing`;default:return`closed`}}isConnected(){return this.connectionState()===`open`}remove(e){this.off(e.stateChangeRefs),this.channels=this.channels.filter(t=>t!==e)}off(e){for(let t in this.stateChangeCallbacks)this.stateChangeCallbacks[t]=this.stateChangeCallbacks[t].filter(([t])=>e.indexOf(t)===-1)}channel(e,t={}){let n=new Re(e,t,this);return this.channels.push(n),n}push(e){if(this.hasLogger()){let{topic:t,event:n,payload:r,ref:i,join_ref:a}=e;this.log(`push`,`${t} ${n} (${a}, ${i})`,r)}this.isConnected()?this.encode(e,e=>this.conn.send(e)):this.sendBuffer.push(()=>this.encode(e,e=>this.conn.send(e)))}makeRef(){let e=this.ref+1;return e===this.ref?this.ref=0:this.ref=e,this.ref.toString()}sendHeartbeat(){if(!this.isConnected()){try{this.heartbeatCallback(`disconnected`)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}return}if(this.pendingHeartbeatRef){this.heartbeatTimeout();return}this.pendingHeartbeatRef=this.makeRef(),this.heartbeatSentAt=Date.now(),this.push({topic:`phoenix`,event:`heartbeat`,payload:{},ref:this.pendingHeartbeatRef});try{this.heartbeatCallback(`sent`)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}this.heartbeatTimeoutTimer=setTimeout(()=>this.heartbeatTimeout(),this.heartbeatIntervalMs)}flushSendBuffer(){this.isConnected()&&this.sendBuffer.length>0&&(this.sendBuffer.forEach(e=>e()),this.sendBuffer=[])}onConnMessage(e){this.decode(e.data,e=>{let{topic:t,event:n,payload:r,ref:i,join_ref:a}=e;if(i&&i===this.pendingHeartbeatRef){let e=this.heartbeatSentAt?Date.now()-this.heartbeatSentAt:void 0;this.clearHeartbeats();try{this.heartbeatCallback(r.status===`ok`?`ok`:`error`,e)}catch(e){this.log(`error`,`error in heartbeat callback`,e)}this.pendingHeartbeatRef=null,this.heartbeatSentAt=null,this.autoSendHeartbeat&&(this.heartbeatTimer=setTimeout(()=>this.sendHeartbeat(),this.heartbeatIntervalMs))}this.hasLogger()&&this.log(`receive`,`${r.status||``} ${t} ${n} ${i&&`(`+i+`)`||``}`.trim(),r);for(let e=0;e<this.channels.length;e++){let o=this.channels[e];o.isMember(t,n,r,a)&&o.trigger(n,r,i,a)}this.triggerStateCallbacks(`message`,e)})}triggerStateCallbacks(e,...t){try{this.stateChangeCallbacks[e].forEach(([n,r])=>{try{r(...t)}catch(t){this.log(`error`,`error in ${e} callback`,t)}})}catch(t){this.log(`error`,`error triggering ${e} callbacks`,t)}}leaveOpenTopic(e){let t=this.channels.find(t=>t.topic===e&&(t.isJoined()||t.isJoining()));t&&(this.hasLogger()&&this.log(`transport`,`leaving duplicate topic "${e}"`),t.leave())}},Ge=class e{constructor(t,n){let r=Je(n);this.presence=new He(t.getChannel(),r),this.presence.onJoin((n,r,i)=>{let a=e.onJoinPayload(n,r,i);t.getChannel().trigger(`presence`,a)}),this.presence.onLeave((n,r,i)=>{let a=e.onLeavePayload(n,r,i);t.getChannel().trigger(`presence`,a)}),this.presence.onSync(()=>{t.getChannel().trigger(`presence`,{event:`sync`})})}get state(){return e.transformState(this.presence.state)}static transformState(e){return e=qe(e),Object.getOwnPropertyNames(e).reduce((t,n)=>{let r=e[n];return t[n]=Ke(r),t},{})}static onJoinPayload(e,t,n){return{event:`join`,key:e,currentPresences:Ye(t),newPresences:Ke(n)}}static onLeavePayload(e,t,n){return{event:`leave`,key:e,currentPresences:Ye(t),leftPresences:Ke(n)}}};function Ke(e){return e.metas.map(e=>{let t=Object.getOwnPropertyDescriptors(e),n=Object.defineProperties({},t);return n.presence_ref=n.phx_ref,delete n.phx_ref,delete n.phx_ref_prev,n})}function qe(e){return JSON.parse(JSON.stringify(e))}function Je(e){return e?.events&&{events:e.events}}function Ye(e){return e?.metas?Ke(e):[]}var Xe;(function(e){e.SYNC=`sync`,e.JOIN=`join`,e.LEAVE=`leave`})(Xe||={});var Ze=class{get state(){return this.presenceAdapter.state}constructor(e,t){this.channel=e,this.presenceAdapter=new Ge(this.channel.channelAdapter,t)}};function Qe(e){if(e instanceof Error)return e;if(typeof e==`string`)return Error(e);if(e&&typeof e==`object`){let t=e;if(typeof t.code==`number`){let n=typeof t.reason==`string`&&t.reason?` (${t.reason})`:``;return Error(`socket closed: ${t.code}${n}`,{cause:e})}return Error(`channel error: transport failure`,{cause:e})}return Error(`channel error: connection lost`)}var $e=class{constructor(e,t,n){let r=et(n);this.channel=e.getSocket().channel(t,r),this.socket=e}get state(){return this.channel.state}set state(e){this.channel.state=e}get joinedOnce(){return this.channel.joinedOnce}get joinPush(){return this.channel.joinPush}get rejoinTimer(){return this.channel.rejoinTimer}on(e,t){return this.channel.on(e,t)}off(e,t){this.channel.off(e,t)}subscribe(e){return this.channel.join(e)}unsubscribe(e){return this.channel.leave(e)}teardown(){this.channel.teardown()}onClose(e){this.channel.onClose(e)}onError(e){return this.channel.onError(e)}push(e,t,n){let r;try{r=this.channel.push(e,t,n)}catch{throw Error(`tried to push '${e}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`)}if(this.channel.pushBuffer.length>100){let e=this.channel.pushBuffer.shift();e.cancelTimeout(),this.socket.log(`channel`,`discarded push due to buffer overflow: ${e.event}`,e.payload())}return r}updateJoinPayload(e){let t=this.channel.joinPush.payload();this.channel.joinPush.payload=()=>Object.assign(Object.assign({},t),e)}canPush(){return this.socket.isConnected()&&this.state===v.joined}isJoined(){return this.state===v.joined}isJoining(){return this.state===v.joining}isClosed(){return this.state===v.closed}isLeaving(){return this.state===v.leaving}updateFilterBindings(e){this.channel.filterBindings=e}updatePayloadTransform(e){this.channel.onMessage=e}getChannel(){return this.channel}};function et(e){return{config:Object.assign({broadcast:{ack:!1,self:!1},presence:{key:``,enabled:!1},private:!1},e.config)}}let tt=/[,()"\\]/,nt=e=>tt.test(e)||e!==e.trim(),rt=e=>`"${e.replace(/\\/g,`\\\\`).replace(/"/g,`\\"`)}"`,it=e=>{let t=e===null?`null`:String(e);return nt(t)?rt(t):t},at=e=>e===null?`null`:String(e),ot=(e,t)=>{if(e===`in`){let e=Array.isArray(t)?t:[t];if(e.length===0)throw Error("Realtime `in` filter requires at least one value.");return`in.(${Array.from(new Set(e)).map(e=>it(e)).join(`,`)})`}return e===`is`?`is.${at(t)}`:`${e}.${it(t)}`};var st=class{constructor(){this.filters=[]}add(e,t,n,r=!1){let i=r?`not.`:``;return this.filters.push(`${e}=${i}${ot(t,n)}`),this}eq(e,t){return this.add(e,`eq`,t)}neq(e,t){return this.add(e,`neq`,t)}gt(e,t){return this.add(e,`gt`,t)}gte(e,t){return this.add(e,`gte`,t)}lt(e,t){return this.add(e,`lt`,t)}lte(e,t){return this.add(e,`lte`,t)}in(e,t){return this.add(e,`in`,t)}like(e,t){return this.add(e,`like`,t)}ilike(e,t){return this.add(e,`ilike`,t)}match(e,t){return this.add(e,`match`,t)}imatch(e,t){return this.add(e,`imatch`,t)}is(e,t){return this.add(e,`is`,t)}isDistinct(e,t){return this.add(e,`isdistinct`,t)}not(e,t,n){return this.add(e,t,n,!0)}build(){return this.filters.join(`,`)}toString(){return this.build()}};let ct=()=>new st;var lt;(function(e){e.ALL=`*`,e.INSERT=`INSERT`,e.UPDATE=`UPDATE`,e.DELETE=`DELETE`})(lt||={});var T;(function(e){e.BROADCAST=`broadcast`,e.PRESENCE=`presence`,e.POSTGRES_CHANGES=`postgres_changes`,e.SYSTEM=`system`})(T||={});var E;(function(e){e.SUBSCRIBED=`SUBSCRIBED`,e.TIMED_OUT=`TIMED_OUT`,e.CLOSED=`CLOSED`,e.CHANNEL_ERROR=`CHANNEL_ERROR`})(E||={});let ut=v;var dt=class e{get state(){return this.channelAdapter.state}set state(e){this.channelAdapter.state=e}get joinedOnce(){return this.channelAdapter.joinedOnce}get timeout(){return this.socket.timeout}get joinPush(){return this.channelAdapter.joinPush}get rejoinTimer(){return this.channelAdapter.rejoinTimer}constructor(e,t={config:{}},n){if(this.topic=e,this.params=t,this.socket=n,this.bindings={},this.subTopic=e.replace(/^realtime:/i,``),this.params.config=Object.assign({broadcast:{ack:!1,self:!1},presence:{key:``,enabled:!1},private:!1},t.config),this.channelAdapter=new $e(this.socket.socketAdapter,e,this.params),this.presence=new Ze(this),this._onClose(()=>{this.socket._remove(this)}),this._updateFilterTransform(),this.broadcastEndpointURL=Ee(this.socket.socketAdapter.endPointURL()),this.private=this.params.config.private||!1,!this.private&&this.params.config?.broadcast?.replay)throw Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`)}subscribe(e,t=this.timeout){if(this.socket.isConnected()||this.socket.connect(),this.channelAdapter.isClosed()){let{config:{broadcast:n,presence:r,private:i,postgres_changes_options:a}}=this.params,o=this.bindings.postgres_changes?.map(e=>e.filter)??[],s=!!this.bindings[T.PRESENCE]&&this.bindings[T.PRESENCE].length>0||this.params.config.presence?.enabled===!0,c={},l=Object.assign({broadcast:n,presence:Object.assign(Object.assign({},r),{enabled:s}),postgres_changes:o,private:i},a?{postgres_changes_options:a}:{});this.socket.accessTokenValue&&(c.access_token=this.socket.accessTokenValue),this._onError(t=>{e?.(E.CHANNEL_ERROR,Qe(t))}),this._onClose(()=>e?.(E.CLOSED)),this.updateJoinPayload(Object.assign({config:l},c)),this._updateFilterMessage();let u=a?.wait&&o.length>0?Math.max(t,(a.timeout??15e3)+1e4):t;this.channelAdapter.subscribe(u).receive(`ok`,async({postgres_changes:t})=>{if(this.socket._isManualToken()||this.socket.setAuth(),t===void 0){e?.(E.SUBSCRIBED);return}this._updatePostgresBindings(t,e)}).receive(`error`,t=>{this.state=v.errored;let n=Object.values(t).join(`, `)||`error`;e?.(E.CHANNEL_ERROR,Error(n,{cause:t}))}).receive(`timeout`,()=>{e?.(E.TIMED_OUT)})}return this}_updatePostgresBindings(t,n){let r=this.bindings.postgres_changes,i=r?.length??0,a=[];for(let o=0;o<i;o++){let i=r[o],{filter:{event:s,schema:c,table:l,filter:u}}=i,d=t&&t[o];if(d&&d.event===s&&e.isFilterValueEqual(d.schema,c)&&e.isFilterValueEqual(d.table,l)&&e.isFilterValueEqual(d.filter,u))a.push(Object.assign(Object.assign({},i),{id:d.id}));else{this.unsubscribe(),this.state=v.errored,n?.(E.CHANNEL_ERROR,Error(`mismatch between server and client bindings for postgres changes`));return}}this.bindings.postgres_changes=a,this.state!=v.errored&&n&&n(E.SUBSCRIBED)}presenceState(){return this.presence.state}async track(e,t={}){return await this.send({type:`presence`,event:`track`,payload:e},t)}async untrack(e={}){return await this.send({type:`presence`,event:`untrack`},e)}on(e,t,n){let r=this.channelAdapter.isJoined()||this.channelAdapter.isJoining(),i=e===T.PRESENCE||e===T.POSTGRES_CHANGES;if(r&&i)throw this.socket.log(`channel`,`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`),Error(`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`);return this._on(e,t,n)}async httpSend(e,t,n={}){if(t==null)return Promise.reject(Error(`Payload is required for httpSend()`));let r=t instanceof ArrayBuffer||ArrayBuffer.isView(t),i={apikey:this.socket.apiKey?this.socket.apiKey:``,"Content-Type":r?`application/octet-stream`:`application/json`};this.socket.accessTokenValue&&(i.Authorization=`Bearer ${this.socket.accessTokenValue}`);let a=new URL(this.broadcastEndpointURL);a.pathname+=`/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(e)}`,this.private&&a.searchParams.set(`private`,`true`);let o={method:`POST`,headers:i,body:r?t:JSON.stringify(t)},s=await this._fetchWithTimeout(a.toString(),o,n.timeout??this.timeout);if(s.status===202)return{success:!0};if(s.status===404)return Promise.reject(Error(`httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404. Update your Supabase CLI to a recent version, or upgrade the Realtime server in your self-hosted setup. See https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/migrations/httpsend-server-version.md`));let c=s.statusText;try{let e=await s.json();c=e.error||e.message||c}catch{}return Promise.reject(Error(c))}async send(e,t={}){if(!this.channelAdapter.canPush()&&e.type===`broadcast`){let n=`Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.`;this.socket.hasLogger()?this.socket.log(`channel`,n):console.warn(n);let{event:r,payload:i}=e,a={apikey:this.socket.apiKey?this.socket.apiKey:``,"Content-Type":`application/json`};this.socket.accessTokenValue&&(a.Authorization=`Bearer ${this.socket.accessTokenValue}`);let o={method:`POST`,headers:a,body:JSON.stringify({messages:[{topic:this.subTopic,event:r,payload:i,private:this.private}]})};try{let e=await this._fetchWithTimeout(this.broadcastEndpointURL,o,t.timeout??this.timeout);return await e.body?.cancel(),e.ok?`ok`:`error`}catch(e){return e instanceof Error&&e.name===`AbortError`?`timed out`:`error`}}else return new Promise(n=>{let r=this.channelAdapter.push(e.type,e,t.timeout||this.timeout);e.type===`broadcast`&&!this.params?.config?.broadcast?.ack&&n(`ok`),r.receive(`ok`,()=>n(`ok`)),r.receive(`error`,()=>n(`error`)),r.receive(`timeout`,()=>n(`timed out`))})}updateJoinPayload(e){this.channelAdapter.updateJoinPayload(e)}async unsubscribe(e=this.timeout){return new Promise(t=>{this.channelAdapter.unsubscribe(e).receive(`ok`,()=>t(`ok`)).receive(`timeout`,()=>t(`timed out`)).receive(`error`,()=>t(`error`))})}teardown(){this.channelAdapter.teardown()}async _fetchWithTimeout(e,t,n){let r=new AbortController,i=setTimeout(()=>r.abort(),n),a=await this.socket.fetch(e,Object.assign(Object.assign({},t),{signal:r.signal}));return clearTimeout(i),a}_on(t,n,r){let i=t.toLocaleLowerCase(),a=n?.filter;if((a instanceof st||typeof a==`object`&&a&&typeof a.build==`function`)&&(n=Object.assign(Object.assign({},n),{filter:a.build()})),i===T.POSTGRES_CHANGES&&this.bindings[i]?.find(t=>e.isSamePostgresFilter(t.filter,n)))return this.socket.log(`error`,`duplicate \`postgres_changes\` binding for ${this.topic} ignored`,n),this;let o=this.channelAdapter.on(t,r),s={type:i,filter:n,callback:r,ref:o};return this.bindings[i]?this.bindings[i].push(s):this.bindings[i]=[s],this._updateFilterMessage(),this}_onClose(e){this.channelAdapter.onClose(e)}_onError(e){this.channelAdapter.onError(e)}_updateFilterMessage(){this.channelAdapter.updateFilterBindings((e,t,n)=>{let r=e.event.toLocaleLowerCase();if(this._notThisChannelEvent(r,n))return!1;let i=this.bindings[r]?.find(t=>t.ref===e.ref);if(!i)return!0;if([`broadcast`,`presence`,`postgres_changes`].includes(r))if(`id`in i){let e=i.id,n=i.filter?.event;return e&&t.ids?.includes(e)&&(n===`*`||n?.toLocaleLowerCase()===t.data?.type.toLocaleLowerCase())}else{let e=(i?.filter?.event)?.toLocaleLowerCase();return e===`*`||e===(t?.event)?.toLocaleLowerCase()}else return i.type.toLocaleLowerCase()===r})}_notThisChannelEvent(e,t){let{close:n,error:r,leave:i,join:a}=me;return t&&[n,r,i,a].includes(e)&&t!==this.joinPush.ref}_updateFilterTransform(){this.channelAdapter.updatePayloadTransform((e,t,n)=>{if(typeof t==`object`&&`ids`in t){let e=t.data,{schema:n,table:r,commit_timestamp:i,type:a,errors:o}=e,s={schema:n,table:r,commit_timestamp:i,eventType:a,new:{},old:{},errors:o};return Object.assign(Object.assign({},s),this._getPayloadRecords(e))}return t})}copyBindings(e){if(this.joinedOnce)throw Error(`cannot copy bindings into joined channel`);for(let t in e.bindings)for(let n of e.bindings[t])this._on(n.type,n.filter,n.callback)}static isFilterValueEqual(e,t){return(e??void 0)===(t??void 0)}static isSamePostgresFilter(t,n){let r=(t?.select)?.join()??void 0,i=(n?.select)?.join()??void 0;return t?.event===n?.event&&e.isFilterValueEqual(t?.schema,n?.schema)&&e.isFilterValueEqual(t?.table,n?.table)&&e.isFilterValueEqual(t?.filter,n?.filter)&&r===i}_getPayloadRecords(e){let t={new:{},old:{}};return(e.type===`INSERT`||e.type===`UPDATE`)&&(t.new=_e(e.columns,e.record)),(e.type===`UPDATE`||e.type===`DELETE`)&&(t.old=_e(e.columns,e.old_record)),t}},ft=class{constructor(e,t){this.socket=new We(e,t)}get timeout(){return this.socket.timeout}get endPoint(){return this.socket.endPoint}get transport(){return this.socket.transport}get heartbeatIntervalMs(){return this.socket.heartbeatIntervalMs}get heartbeatCallback(){return this.socket.heartbeatCallback}set heartbeatCallback(e){this.socket.heartbeatCallback=e}get heartbeatTimer(){return this.socket.heartbeatTimer}get pendingHeartbeatRef(){return this.socket.pendingHeartbeatRef}get reconnectTimer(){return this.socket.reconnectTimer}get vsn(){return this.socket.vsn}get encode(){return this.socket.encode}get decode(){return this.socket.decode}get reconnectAfterMs(){return this.socket.reconnectAfterMs}get sendBuffer(){return this.socket.sendBuffer}get stateChangeCallbacks(){return this.socket.stateChangeCallbacks}connect(){this.socket.connect()}disconnect(e,t,n,r=1e4){return new Promise(i=>{setTimeout(()=>i(`timeout`),r),this.socket.disconnect(()=>{e(),i(`ok`)},t,n)})}push(e){this.socket.push(e)}log(e,t,n){this.socket.log(e,t,n)}hasLogger(){return this.socket.hasLogger()}makeRef(){return this.socket.makeRef()}onOpen(e){this.socket.onOpen(e)}onClose(e){this.socket.onClose(e)}onError(e){this.socket.onError(e)}onMessage(e){this.socket.onMessage(e)}isConnected(){return this.socket.isConnected()}isConnecting(){return this.socket.connectionState()==he.connecting}isDisconnecting(){return this.socket.connectionState()==he.closing}connectionState(){return this.socket.connectionState()}endPointURL(){return this.socket.endPointURL()}sendHeartbeat(){this.socket.sendHeartbeat()}getSocket(){return this.socket}};let pt={HEARTBEAT_INTERVAL:25e3,RECONNECT_DELAY:10,HEARTBEAT_TIMEOUT_FALLBACK:100},mt=[1e3,2e3,5e3,1e4];function ht(){let e=new Map;return{get length(){return e.size},clear(){e.clear()},getItem(t){return e.has(t)?e.get(t):null},key(t){return Array.from(e.keys())[t]??null},removeItem(t){e.delete(t)},setItem(t,n){e.set(t,String(n))}}}function gt(){try{if(typeof globalThis<`u`&&globalThis.sessionStorage)return globalThis.sessionStorage}catch{}return ht()}var _t=class{get endPoint(){return this.socketAdapter.endPoint}get timeout(){return this.socketAdapter.timeout}get transport(){return this.socketAdapter.transport}get heartbeatCallback(){return this.socketAdapter.heartbeatCallback}get heartbeatIntervalMs(){return this.socketAdapter.heartbeatIntervalMs}get heartbeatTimer(){return this.worker?this._workerHeartbeatTimer:this.socketAdapter.heartbeatTimer}get pendingHeartbeatRef(){return this.worker?this._pendingWorkerHeartbeatRef:this.socketAdapter.pendingHeartbeatRef}get reconnectTimer(){return this.socketAdapter.reconnectTimer}get vsn(){return this.socketAdapter.vsn}get encode(){return this.socketAdapter.encode}get decode(){return this.socketAdapter.decode}get reconnectAfterMs(){return this.socketAdapter.reconnectAfterMs}get sendBuffer(){return this.socketAdapter.sendBuffer}get stateChangeCallbacks(){return this.socketAdapter.stateChangeCallbacks}constructor(e,t){if(this.channels=[],this.accessTokenValue=null,this.accessToken=null,this.apiKey=null,this.httpEndpoint=``,this.headers={},this.params={},this.ref=0,this.serializer=new ge,this._manuallySetToken=!1,this._authPromise=null,this._authGeneration=0,this._workerHeartbeatTimer=void 0,this._pendingWorkerHeartbeatRef=null,this._pendingDisconnectTimer=null,this._disconnectOnEmptyChannelsAfterMs=0,this._resolveFetch=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),!t?.params?.apikey)throw Error(`API key is required to connect to Realtime`);this.apiKey=t.params.apikey,this.socketAdapter=new ft(e,this._initializeOptions(t)),this.httpEndpoint=Ee(e),this.fetch=this._resolveFetch(t?.fetch)}connect(){if(!(this.isConnecting()||this.isDisconnecting()||this.isConnected())){this.accessToken&&!this._authPromise&&this._setAuthSafely(`connect`),this._setupConnectionHandlers();try{this.socketAdapter.connect()}catch(e){let t=e.message;throw Error(`WebSocket not available: ${t}`)}this._handleNodeJsRaceCondition()}}endpointURL(){return this.socketAdapter.endPointURL()}async disconnect(e,t){return this._cancelPendingDisconnect(),this.isDisconnecting()?`ok`:await this.socketAdapter.disconnect(()=>{clearInterval(this._workerHeartbeatTimer),this._terminateWorker()},e,t)}getChannels(){return this.channels}async removeChannel(e){let t=await e.unsubscribe();return t===`ok`&&e.teardown(),t}async removeAllChannels(){let e=this.channels.map(async e=>{let t=await e.unsubscribe();return e.teardown(),t}),t=await Promise.all(e);return await this.disconnect(),t}log(e,t,n){this.socketAdapter.log(e,t,n)}hasLogger(){return this.socketAdapter.hasLogger()}connectionState(){return this.socketAdapter.connectionState()||he.closed}isConnected(){return this.socketAdapter.isConnected()}isConnecting(){return this.socketAdapter.isConnecting()}isDisconnecting(){return this.socketAdapter.isDisconnecting()}channel(e,t={config:{}}){let n=`realtime:${e}`,r=this.getChannels().find(e=>e.topic===n);if(r)return r;{let n=new dt(`realtime:${e}`,t,this);return this._cancelPendingDisconnect(),this.channels.push(n),n}}push(e){this.socketAdapter.push(e)}async setAuth(e=null){let t=++this._authGeneration,n=this._performAuth(e,t);t===this._authGeneration&&(this._authPromise=n);try{await n}finally{this._authPromise===n&&(this._authPromise=null)}}_isManualToken(){return this._manuallySetToken}async sendHeartbeat(){this.socketAdapter.sendHeartbeat()}onHeartbeat(e){this.socketAdapter.heartbeatCallback=this._wrapHeartbeatCallback(e)}_makeRef(){return this.socketAdapter.makeRef()}_remove(e){this.channels=this.channels.filter(t=>t.topic!==e.topic),this.channels.length===0&&(this.log(`transport`,`no channels remaining, scheduling disconnect`),this._schedulePendingDisconnect())}_schedulePendingDisconnect(){if(this._cancelPendingDisconnect(),this._disconnectOnEmptyChannelsAfterMs===0){this.log(`transport`,`disconnecting immediately - no channels`),this.disconnect();return}this._pendingDisconnectTimer=setTimeout(()=>{this._pendingDisconnectTimer=null,this.channels.length===0&&(this.log(`transport`,`deferred disconnect fired - no channels, disconnecting`),this.disconnect())},this._disconnectOnEmptyChannelsAfterMs),this.log(`transport`,`deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`)}_cancelPendingDisconnect(){this._pendingDisconnectTimer!==null&&(this.log(`transport`,`pending disconnect cancelled - channel activity detected`),clearTimeout(this._pendingDisconnectTimer),this._pendingDisconnectTimer=null)}async _performAuth(e,t){let n,r=!1;if(e)n=e,r=!0;else if(this.accessToken)try{n=await this.accessToken()}catch(e){this.log(`error`,`Error fetching access token from callback`,e),n=this.accessTokenValue}else n=this.accessTokenValue;t===this._authGeneration&&(this.accessToken?this._manuallySetToken=!1:r&&(this._manuallySetToken=!0),this.accessTokenValue!=n&&(this.accessTokenValue=n,this.channels.forEach(e=>{let t={access_token:n,version:`realtime-js/2.118.0`};e.updateJoinPayload(t),e.joinedOnce&&e.channelAdapter.isJoined()&&e.channelAdapter.push(me.access_token,{access_token:n})})))}async _waitForAuthIfNeeded(){this._authPromise&&await this._authPromise}_setAuthSafely(e=`general`){this._isManualToken()||this.setAuth().catch(t=>{this.log(`error`,`Error setting auth in ${e}`,t)})}_setupConnectionHandlers(){this.socketAdapter.onOpen(()=>{(this._authPromise||(this.accessToken&&!this.accessTokenValue?this.setAuth():Promise.resolve())).catch(e=>{this.log(`error`,`error waiting for auth on connect`,e)}),this.worker&&!this.workerRef&&this._startWorkerHeartbeat()}),this.socketAdapter.onClose(()=>{this.worker&&this.workerRef&&this._terminateWorker()}),this.socketAdapter.onMessage(e=>{e.ref&&e.ref===this._pendingWorkerHeartbeatRef&&(this._pendingWorkerHeartbeatRef=null)})}_handleNodeJsRaceCondition(){this.socketAdapter.isConnected()&&this.socketAdapter.getSocket().onConnOpen()}_wrapHeartbeatCallback(e){return(t,n)=>{t!==`disconnected`&&(t==`sent`&&this._setAuthSafely(),e&&e(t,n))}}_startWorkerHeartbeat(){this.workerUrl?this.log(`worker`,`starting worker for from ${this.workerUrl}`):this.log(`worker`,`starting default worker`);let e=this._workerObjectUrl(this.workerUrl);this.workerRef=new Worker(e),this.workerRef.onerror=e=>{this.log(`worker`,`worker error`,e.message),this._terminateWorker(),this.disconnect()},this.workerRef.onmessage=e=>{e.data.event===`keepAlive`&&this.sendHeartbeat()},this.workerRef.postMessage({event:`start`,interval:this.heartbeatIntervalMs})}_terminateWorker(){this.workerRef&&=(this.log(`worker`,`terminating worker`),this.workerRef.terminate(),void 0)}_workerObjectUrl(e){let t;if(e)t=e;else{let e=new Blob([`
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`],{type:`application/javascript`});t=URL.createObjectURL(e)}return t}_initializeOptions(e){this.worker=e?.worker??!1,this.accessToken=e?.accessToken??null;let t={};t.timeout=e?.timeout??1e4,t.heartbeatIntervalMs=e?.heartbeatIntervalMs??pt.HEARTBEAT_INTERVAL,this._disconnectOnEmptyChannelsAfterMs=e?.disconnectOnEmptyChannelsAfterMs??2*(e?.heartbeatIntervalMs??pt.HEARTBEAT_INTERVAL),t.transport=e?.transport??pe.getWebSocketConstructor(),t.params=e?.params,t.logger=e?.logger,t.heartbeatCallback=this._wrapHeartbeatCallback(e?.heartbeatCallback),t.sessionStorage=e?.sessionStorage??gt(),t.reconnectAfterMs=e?.reconnectAfterMs??(e=>mt[e-1]||1e4);let n,r,i=e?.vsn??`2.0.0`;switch(i){case`1.0.0`:n=(e,t)=>t(JSON.stringify(e)),r=(e,t)=>t(JSON.parse(e));break;case`2.0.0`:n=this.serializer.encode.bind(this.serializer),r=this.serializer.decode.bind(this.serializer);break;default:throw Error(`Unsupported serializer version: ${t.vsn}`)}if(t.vsn=i,t.encode=e?.encode??n,t.decode=e?.decode??r,t.beforeReconnect=this._reconnectAuth.bind(this),(e?.logLevel||e?.log_level)&&(this.logLevel=e.logLevel||e.log_level,t.params=Object.assign(Object.assign({},t.params),{log_level:this.logLevel})),this.worker){if(typeof window<`u`&&!window.Worker)throw Error(`Web Worker is not supported`);this.workerUrl=e?.workerUrl,t.autoSendHeartbeat=!this.worker}return t}async _reconnectAuth(){await this._waitForAuthIfNeeded(),this.isConnected()||this.connect()}},vt=class extends Error{constructor(e,t){super(e),this.name=`IcebergError`,this.status=t.status,this.icebergType=t.icebergType,this.icebergCode=t.icebergCode,this.details=t.details,this.isCommitStateUnknown=t.icebergType===`CommitStateUnknownException`||[500,502,504].includes(t.status)&&t.icebergType?.includes(`CommitState`)===!0}isNotFound(){return this.status===404}isConflict(){return this.status===409}isAuthenticationTimeout(){return this.status===419}};function yt(e,t,n){let r=new URL(t,e);if(n)for(let[e,t]of Object.entries(n))t!==void 0&&r.searchParams.set(e,t);return r.toString()}async function bt(e){return!e||e.type===`none`?{}:e.type===`bearer`?{Authorization:`Bearer ${e.token}`}:e.type===`header`?{[e.name]:e.value}:e.type===`custom`?await e.getHeaders():{}}function xt(e){let t=e.fetchImpl??globalThis.fetch;return{async request({method:n,path:r,query:i,body:a,headers:o}){let s=yt(e.baseUrl,r,i),c=await bt(e.auth),l=await t(s,{method:n,headers:{...a?{"Content-Type":`application/json`}:{},...c,...o},body:a?JSON.stringify(a):void 0}),u=await l.text(),d=(l.headers.get(`content-type`)||``).includes(`application/json`),f=d&&u?JSON.parse(u):u;if(!l.ok){let e=d?f:void 0,t=e?.error;throw new vt(t?.message??`Request failed with status ${l.status}`,{status:l.status,icebergType:t?.type,icebergCode:t?.code,details:e})}return{status:l.status,headers:l.headers,data:f}}}}function St(e){return e.join(``)}var Ct=class{constructor(e,t=``){this.client=e,this.prefix=t}async listNamespaces(e){let t=e?{parent:St(e.namespace)}:void 0;return(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces`,query:t})).data.namespaces.map(e=>({namespace:e}))}async createNamespace(e,t){let n={namespace:e.namespace,properties:t?.properties};return(await this.client.request({method:`POST`,path:`${this.prefix}/namespaces`,body:n})).data}async dropNamespace(e){await this.client.request({method:`DELETE`,path:`${this.prefix}/namespaces/${St(e.namespace)}`})}async loadNamespaceMetadata(e){return{properties:(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces/${St(e.namespace)}`})).data.properties}}async namespaceExists(e){try{return await this.client.request({method:`HEAD`,path:`${this.prefix}/namespaces/${St(e.namespace)}`}),!0}catch(e){if(e instanceof vt&&e.status===404)return!1;throw e}}async createNamespaceIfNotExists(e,t){try{return await this.createNamespace(e,t)}catch(e){if(e instanceof vt&&e.status===409)return;throw e}}};function wt(e){return e.join(``)}var Tt=class{constructor(e,t=``,n){this.client=e,this.prefix=t,this.accessDelegation=n}async listTables(e){return(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables`})).data.identifiers}async createTable(e,t){let n={};return this.accessDelegation&&(n[`X-Iceberg-Access-Delegation`]=this.accessDelegation),(await this.client.request({method:`POST`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables`,body:t,headers:n})).data.metadata}async updateTable(e,t){let n=await this.client.request({method:`POST`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,body:t});return{"metadata-location":n.data[`metadata-location`],metadata:n.data.metadata}}async dropTable(e,t){await this.client.request({method:`DELETE`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,query:{purgeRequested:String(t?.purge??!1)}})}async loadTable(e){let t={};return this.accessDelegation&&(t[`X-Iceberg-Access-Delegation`]=this.accessDelegation),(await this.client.request({method:`GET`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,headers:t})).data.metadata}async tableExists(e){let t={};this.accessDelegation&&(t[`X-Iceberg-Access-Delegation`]=this.accessDelegation);try{return await this.client.request({method:`HEAD`,path:`${this.prefix}/namespaces/${wt(e.namespace)}/tables/${e.name}`,headers:t}),!0}catch(e){if(e instanceof vt&&e.status===404)return!1;throw e}}async createTableIfNotExists(e,t){try{return await this.createTable(e,t)}catch(n){if(n instanceof vt&&n.status===409)return await this.loadTable({namespace:e.namespace,name:t.name});throw n}}},Et=class{constructor(e){let t=`v1`;e.catalogName&&(t+=`/${e.catalogName}`),this.client=xt({baseUrl:e.baseUrl.endsWith(`/`)?e.baseUrl:`${e.baseUrl}/`,auth:e.auth,fetchImpl:e.fetch}),this.accessDelegation=e.accessDelegation?.join(`,`),this.namespaceOps=new Ct(this.client,t),this.tableOps=new Tt(this.client,t,this.accessDelegation)}async listNamespaces(e){return this.namespaceOps.listNamespaces(e)}async createNamespace(e,t){return this.namespaceOps.createNamespace(e,t)}async dropNamespace(e){await this.namespaceOps.dropNamespace(e)}async loadNamespaceMetadata(e){return this.namespaceOps.loadNamespaceMetadata(e)}async listTables(e){return this.tableOps.listTables(e)}async createTable(e,t){return this.tableOps.createTable(e,t)}async updateTable(e,t){return this.tableOps.updateTable(e,t)}async dropTable(e,t){await this.tableOps.dropTable(e,t)}async loadTable(e){return this.tableOps.loadTable(e)}async namespaceExists(e){return this.namespaceOps.namespaceExists(e)}async tableExists(e){return this.tableOps.tableExists(e)}async createNamespaceIfNotExists(e,t){return this.namespaceOps.createNamespaceIfNotExists(e,t)}async createTableIfNotExists(e,t){return this.tableOps.createTableIfNotExists(e,t)}};function Dt(e){"@babel/helpers - typeof";return Dt=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},Dt(e)}function Ot(e,t){if(Dt(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(Dt(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function kt(e){var t=Ot(e,`string`);return Dt(t)==`symbol`?t:t+``}function At(e,t,n){return(t=kt(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function jt(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function D(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?jt(Object(n),!0).forEach(function(t){At(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):jt(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}var Mt=class extends Error{constructor(e,t=`storage`,n,r){super(e),this.__isStorageError=!0,this.namespace=t,this.name=t===`vectors`?`StorageVectorsError`:`StorageError`,this.status=n,this.statusCode=r}toJSON(){return{name:this.name,message:this.message,status:this.status,statusCode:this.statusCode}}};function Nt(e){return typeof e==`object`&&!!e&&`__isStorageError`in e}var Pt=class extends Mt{constructor(e,t,n,r=`storage`,i){super(e,r,t,n),this.name=r===`vectors`?`StorageVectorsApiError`:`StorageApiError`,this.status=t,this.statusCode=n,this.code=i}toJSON(){return D(D({},super.toJSON()),{},{code:this.code})}},Ft=class extends Mt{constructor(e,t,n=`storage`){super(e,n),this.name=n===`vectors`?`StorageVectorsUnknownError`:`StorageUnknownError`,this.originalError=t}};function It(e,t,n){let r=D({},e),i=t.toLowerCase();for(let e of Object.keys(r))e.toLowerCase()===i&&delete r[e];return r[i]=n,r}function Lt(e){let t={};for(let[n,r]of Object.entries(e))t[n.toLowerCase()]=r;return t}let Rt=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),zt=e=>{if(typeof e!=`object`||!e)return!1;let t=Object.getPrototypeOf(e);return(t===null||t===Object.prototype||Object.getPrototypeOf(t)===null)&&!(Symbol.toStringTag in e)&&!(Symbol.iterator in e)},Bt=e=>{if(Array.isArray(e))return e.map(e=>Bt(e));if(typeof e==`function`||e!==Object(e))return e;let t={};return Object.entries(e).forEach(([e,n])=>{let r=e.replace(/([-_][a-z])/gi,e=>e.toUpperCase().replace(/[-_]/g,``));t[r]=Bt(n)}),t},Vt=e=>!e||typeof e!=`string`||e.length===0||e.length>100||e.trim()!==e||e.includes(`/`)||e.includes(`\\`)?!1:/^[\w!.\*'() &$@=;:+,?-]+$/.test(e),Ht=e=>e.split(`/`).map(encodeURIComponent).join(`/`),Ut=e=>{if(typeof e==`object`&&e){let t=e;if(typeof t.msg==`string`)return t.msg;if(typeof t.message==`string`)return t.message;if(typeof t.error_description==`string`)return t.error_description;if(typeof t.error==`string`)return t.error;if(typeof t.error==`object`&&t.error!==null){let e=t.error;if(typeof e.message==`string`)return e.message}}return JSON.stringify(e)},Wt=async(e,t,n,r)=>{if(typeof e==`object`&&e&&`json`in e&&typeof e.json==`function`){let n=e,i=parseInt(String(n.status),10);Number.isFinite(i)||(i=500),n.json().then(e=>{let n=e?.statusCode||e?.code||i+``;t(new Pt(Ut(e),i,n,r,e?.code))}).catch(()=>{let e=i+``;t(new Pt(n.statusText||`HTTP ${i} error`,i,e,r))})}else t(new Ft(Ut(e),e,r))},Gt=(e,t,n,r)=>{let i={method:e,headers:t?.headers||{}};if(e===`GET`||e===`HEAD`||!r)return D(D({},i),n);if(zt(r)){let e=t?.headers||{},n;for(let[t,r]of Object.entries(e))t.toLowerCase()===`content-type`&&(n=r);i.headers=It(e,`Content-Type`,n??`application/json`),i.body=JSON.stringify(r)}else i.body=r;return t?.duplex&&(i.duplex=t.duplex),D(D({},i),n)};async function Kt(e,t,n,r,i,a,o){return new Promise((s,c)=>{e(n,Gt(t,r,i,a)).then(e=>{if(!e.ok)throw e;if(r?.noResolveJson)return e;if(o===`vectors`){let t=e.headers.get(`content-type`);if(e.headers.get(`content-length`)===`0`||e.status===204||!t||!t.includes(`application/json`))return{}}return e.json()}).then(e=>s(e)).catch(e=>Wt(e,c,r,o))})}function qt(e=`storage`){return{get:async(t,n,r,i)=>Kt(t,`GET`,n,r,i,void 0,e),post:async(t,n,r,i,a)=>Kt(t,`POST`,n,i,a,r,e),put:async(t,n,r,i,a)=>Kt(t,`PUT`,n,i,a,r,e),head:async(t,n,r,i)=>Kt(t,`HEAD`,n,D(D({},r),{},{noResolveJson:!0}),i,void 0,e),remove:async(t,n,r,i,a)=>Kt(t,`DELETE`,n,i,a,r,e)}}let{get:O,post:k,put:Jt,head:Yt,remove:A}=qt(`storage`),j=qt(`vectors`);var Xt=class{constructor(e,t={},n,r=`storage`){this.shouldThrowOnError=!1,this.url=e,this.headers=Lt(t),this.fetch=Rt(n),this.namespace=r}throwOnError(){return this.shouldThrowOnError=!0,this}setHeader(e,t){return this.headers=It(this.headers,e,t),this}async handleOperation(e){var t=this;try{return{data:await e(),error:null}}catch(e){if(t.shouldThrowOnError)throw e;if(Nt(e))return{data:null,error:e};throw e}}};let Zt;Zt=Symbol.toStringTag;var Qt=class{constructor(e,t){this.downloadFn=e,this.shouldThrowOnError=t,this[Zt]=`StreamDownloadBuilder`,this.promise=null}then(e,t){return this.getPromise().then(e,t)}catch(e){return this.getPromise().catch(e)}finally(e){return this.getPromise().finally(e)}getPromise(){return this.promise||=this.execute(),this.promise}async execute(){var e=this;try{return{data:(await e.downloadFn()).body,error:null}}catch(t){if(e.shouldThrowOnError)throw t;if(Nt(t))return{data:null,error:t};throw t}}};let $t;$t=Symbol.toStringTag;var en=class{constructor(e,t){this.downloadFn=e,this.shouldThrowOnError=t,this[$t]=`BlobDownloadBuilder`,this.promise=null}asStream(){return new Qt(this.downloadFn,this.shouldThrowOnError)}then(e,t){return this.getPromise().then(e,t)}catch(e){return this.getPromise().catch(e)}finally(e){return this.getPromise().finally(e)}getPromise(){return this.promise||=this.execute(),this.promise}async execute(){var e=this;try{return{data:await(await e.downloadFn()).blob(),error:null}}catch(t){if(e.shouldThrowOnError)throw t;if(Nt(t))return{data:null,error:t};throw t}}};let tn={limit:100,offset:0,sortBy:{column:`name`,order:`asc`}},nn={cacheControl:`3600`,contentType:`text/plain;charset=UTF-8`,upsert:!1};var rn=class extends Xt{constructor(e,t={},n,r){super(e,t,r,`storage`),this.bucketId=n}async uploadOrUpdate(e,t,n,r){var i=this;return i.handleOperation(async()=>{let a,o=D(D({},nn),r),s=D(D({},i.headers),e===`POST`&&{"x-upsert":String(o.upsert)}),c=o.metadata;if(typeof Blob<`u`&&n instanceof Blob||typeof FormData<`u`&&n instanceof FormData?a=i.prepareUploadFormData(n,o):(a=n,s[`cache-control`]=`max-age=${o.cacheControl}`,s[`content-type`]=o.contentType,o.contentEncoding&&(s[`content-encoding`]=o.contentEncoding),c&&(s[`x-metadata`]=i.toBase64(i.encodeMetadata(c))),(typeof ReadableStream<`u`&&a instanceof ReadableStream||a&&typeof a==`object`&&`pipe`in a&&typeof a.pipe==`function`)&&!o.duplex&&(o.duplex=`half`)),r?.headers)for(let[e,t]of Object.entries(r.headers))s=It(s,e,t);let l=i._removeEmptyFolders(t),u=i._getFinalPath(l),d=await(e==`PUT`?Jt:k)(i.fetch,`${i.url}/object/${u}`,a,D({headers:s},o?.duplex?{duplex:o.duplex}:{}));return{path:l,id:d.Id,fullPath:d.Key}})}async upload(e,t,n){return this.uploadOrUpdate(`POST`,e,t,n)}async uploadToSignedUrl(e,t,n,r){var i=this;let a=i._removeEmptyFolders(e),o=i._getFinalPath(a),s=new URL(i.url+`/object/upload/sign/${o}`);return s.searchParams.set(`token`,t),i.handleOperation(async()=>{let e,t=D(D({},nn),r),o=D(D({},i.headers),{"x-upsert":String(t.upsert)}),c=t.metadata;if(typeof Blob<`u`&&n instanceof Blob||typeof FormData<`u`&&n instanceof FormData?e=i.prepareUploadFormData(n,t):(e=n,o[`cache-control`]=`max-age=${t.cacheControl}`,o[`content-type`]=t.contentType,t.contentEncoding&&(o[`content-encoding`]=t.contentEncoding),c&&(o[`x-metadata`]=i.toBase64(i.encodeMetadata(c))),(typeof ReadableStream<`u`&&e instanceof ReadableStream||e&&typeof e==`object`&&`pipe`in e&&typeof e.pipe==`function`)&&!t.duplex&&(t.duplex=`half`)),r?.headers)for(let[e,t]of Object.entries(r.headers))o=It(o,e,t);return{path:a,fullPath:(await Jt(i.fetch,s.toString(),e,D({headers:o},t?.duplex?{duplex:t.duplex}:{}))).Key}})}async createSignedUploadUrl(e,t){var n=this;return n.handleOperation(async()=>{let r=n._getFinalPath(e),i=D({},n.headers);t?.upsert&&(i[`x-upsert`]=`true`);let a=await k(n.fetch,`${n.url}/object/upload/sign/${r}`,{},{headers:i}),o=new URL(n.url+a.url),s=o.searchParams.get(`token`);if(!s)throw new Mt(`No token returned by API`);return{signedUrl:o.toString(),path:e,token:s}})}async update(e,t,n){return this.uploadOrUpdate(`PUT`,e,t,n)}async move(e,t,n){var r=this;return r.handleOperation(async()=>await k(r.fetch,`${r.url}/object/move`,{bucketId:r.bucketId,sourceKey:e,destinationKey:t,destinationBucket:n?.destinationBucket,sourceVersionId:n?.sourceVersionId},{headers:r.headers}))}async copy(e,t,n){var r=this;return r.handleOperation(async()=>{let i=n;return{path:(await k(r.fetch,`${r.url}/object/copy`,{bucketId:r.bucketId,sourceKey:e,destinationKey:t,destinationBucket:n?.destinationBucket,sourceVersionId:n?.sourceVersionId,copyMetadata:typeof i?.copyMetadata==`boolean`?i.copyMetadata:void 0,metadata:i?.copyMetadata===!1?i.metadata:void 0},{headers:r.headers})).Key}})}async createSignedUrl(e,t,n){var r=this;return r.handleOperation(async()=>{let i=r._getFinalPath(e),a=typeof n?.transform==`object`&&n.transform!==null&&Object.keys(n.transform).length>0,o=await k(r.fetch,`${r.url}/object/sign/${i}`,D(D({expiresIn:t},a?{transform:n.transform}:{}),n?.versionId==null?{}:{versionId:n.versionId}),{headers:r.headers}),s=new URLSearchParams;n?.download&&s.set(`download`,n.download===!0?``:n.download),n?.cacheNonce!=null&&s.set(`cacheNonce`,String(n.cacheNonce));let c=s.toString();return{signedUrl:encodeURI(`${r.url}${o.signedURL}${c?`&${c}`:``}`)}})}async createSignedUrls(e,t,n){var r=this;return r.handleOperation(async()=>{let i=await k(r.fetch,`${r.url}/object/sign/${r.bucketId}`,{expiresIn:t,paths:e},{headers:r.headers}),a=new URLSearchParams;n?.download&&a.set(`download`,n.download===!0?``:n.download),n?.cacheNonce!=null&&a.set(`cacheNonce`,String(n.cacheNonce));let o=a.toString();return i.map(e=>D(D({},e),{},{signedUrl:e.signedURL?encodeURI(`${r.url}${e.signedURL}${o?`&${o}`:``}`):null}))})}download(e,t,n){let r=typeof t?.transform==`object`&&t.transform!==null&&Object.keys(t.transform).length>0?`render/image/authenticated`:`object`,i=new URLSearchParams;t?.transform&&this.applyTransformOptsToQuery(i,t.transform),t?.cacheNonce!=null&&i.set(`cacheNonce`,String(t.cacheNonce)),t?.versionId!=null&&i.set(`versionId`,String(t.versionId));let a=i.toString(),o=this._getFinalPath(e);return new en(()=>O(this.fetch,`${this.url}/${r}/${o}${a?`?${a}`:``}`,{headers:this.headers,noResolveJson:!0},n),this.shouldThrowOnError)}async info(e,t){var n=this;let r=n._getFinalPath(e),i=new URLSearchParams;t?.versionId!=null&&i.set(`versionId`,String(t.versionId));let a=i.toString();return n.handleOperation(async()=>Bt(await O(n.fetch,`${n.url}/object/info/${r}${a?`?${a}`:``}`,{headers:n.headers})))}async exists(e){var t=this;let n=t._getFinalPath(e);try{return await Yt(t.fetch,`${t.url}/object/${n}`,{headers:t.headers}),{data:!0,error:null}}catch(e){if(t.shouldThrowOnError)throw e;if(Nt(e)){let t=e instanceof Pt?e.status:e instanceof Ft?e.originalError?.status:void 0;if(t!==void 0&&[400,404].includes(t))return{data:!1,error:e}}throw e}}getPublicUrl(e,t){let n=this._getFinalPath(e),r=new URLSearchParams;t?.download&&r.set(`download`,t.download===!0?``:t.download),t?.transform&&this.applyTransformOptsToQuery(r,t.transform),t?.cacheNonce!=null&&r.set(`cacheNonce`,String(t.cacheNonce)),t?.versionId!=null&&r.set(`versionId`,String(t.versionId));let i=r.toString(),a=typeof t?.transform==`object`&&t.transform!==null&&Object.keys(t.transform).length>0?`render/image`:`object`;return{data:{publicUrl:encodeURI(`${this.url}/${a}/public/${n}`)+(i?`?${i}`:``)}}}async remove(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,`${t.url}/object/${t.bucketId}`,{prefixes:e},{headers:t.headers}))}async purgeCache(e,t,n){var r=this;return r.handleOperation(async()=>{let i=Ht(r._getFinalPath(e)),a=new URLSearchParams;t?.transformations&&a.set(`transformations`,`true`);let o=a.toString();return await A(r.fetch,`${r.url}/cdn/${i}${o?`?${o}`:``}`,{},{headers:r.headers},n)})}async list(e,t,n){var r=this;return r.handleOperation(async()=>{let i=t?.sortBy?D(D({},tn.sortBy),t.sortBy):tn.sortBy,a=D(D(D({},tn),t),{},{sortBy:i,prefix:e||``});return await k(r.fetch,`${r.url}/object/list/${r.bucketId}`,a,{headers:r.headers},n)})}async listV2(e,t){var n=this;return n.handleOperation(async()=>{let r=D({},e);return await k(n.fetch,`${n.url}/object/list-v2/${n.bucketId}`,r,{headers:n.headers},t)})}prepareUploadFormData(e,t){let n=new FormData,r=[];e instanceof FormData?e.forEach((e,t)=>{typeof e==`string`?n.append(t,e):r.push([t,e])}):r.push([``,e]),n.has(`cacheControl`)||n.append(`cacheControl`,t.cacheControl),t.metadata&&!n.has(`metadata`)&&n.append(`metadata`,this.encodeMetadata(t.metadata)),t.contentEncoding&&!n.has(`contentEncoding`)&&n.append(`contentEncoding`,t.contentEncoding);for(let[e,t]of r)n.append(e,t);return n}encodeMetadata(e){return JSON.stringify(e)}toBase64(e){return typeof Buffer<`u`?Buffer.from(e).toString(`base64`):btoa(e)}_getFinalPath(e){return`${this.bucketId}/${e.replace(/^\/+/,``)}`}_removeEmptyFolders(e){return e.replace(/^\/|\/$/g,``).replace(/\/+/g,`/`)}applyTransformOptsToQuery(e,t){return t.width&&e.set(`width`,t.width.toString()),t.height&&e.set(`height`,t.height.toString()),t.resize&&e.set(`resize`,t.resize),t.format&&e.set(`format`,t.format),t.quality&&e.set(`quality`,t.quality.toString()),e}};let an={"X-Client-Info":`storage-js/2.118.0`};var on=class extends Xt{constructor(e,t={},n,r){let i=new URL(e);r?.useNewHostname&&/supabase\.(co|in|red)$/.test(i.hostname)&&!i.hostname.includes(`storage.supabase.`)&&(i.hostname=i.hostname.replace(`supabase.`,`storage.supabase.`));let a=i.href.replace(/\/$/,``),o=D(D({},an),t);super(a,o,n,`storage`)}async listBuckets(e){var t=this;return t.handleOperation(async()=>{let n=t.listBucketOptionsToQueryString(e);return await O(t.fetch,`${t.url}/bucket${n}`,{headers:t.headers})})}async getBucket(e){var t=this;return t.handleOperation(async()=>await O(t.fetch,`${t.url}/bucket/${e}`,{headers:t.headers}))}async createBucket(e,t={public:!1}){var n=this;return n.handleOperation(async()=>await k(n.fetch,`${n.url}/bucket`,{id:e,name:e,type:t.type,public:t.public,file_size_limit:t.fileSizeLimit,allowed_mime_types:t.allowedMimeTypes,versioning_status:t.versioningStatus},{headers:n.headers}))}async updateBucket(e,t){var n=this;return n.handleOperation(async()=>await Jt(n.fetch,`${n.url}/bucket/${e}`,{id:e,name:e,public:t.public,file_size_limit:t.fileSizeLimit,allowed_mime_types:t.allowedMimeTypes,versioning_status:t.versioningStatus},{headers:n.headers}))}async emptyBucket(e){var t=this;return t.handleOperation(async()=>await k(t.fetch,`${t.url}/bucket/${e}/empty`,{},{headers:t.headers}))}async deleteBucket(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,`${t.url}/bucket/${e}`,{},{headers:t.headers}))}async getBucketLifecycle(e){var t=this;return t.handleOperation(async()=>await O(t.fetch,t.bucketLifecycleUrl(e),{headers:t.headers}))}async updateBucketLifecycle(e,t){var n=this;return n.handleOperation(async()=>await Jt(n.fetch,n.bucketLifecycleUrl(e),t,{headers:n.headers}))}async deleteBucketLifecycle(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,t.bucketLifecycleUrl(e),{},{headers:t.headers}))}async purgeBucketCache(e,t,n){var r=this;return r.handleOperation(async()=>{let i=new URLSearchParams;t?.transformations&&i.set(`transformations`,`true`);let a=i.toString();return await A(r.fetch,`${r.url}/cdn/${Ht(e)}${a?`?${a}`:``}`,{},{headers:r.headers},n)})}bucketLifecycleUrl(e){return`${this.url}/bucket/${Ht(e)}/lifecycle`}listBucketOptionsToQueryString(e){let t={};return e&&(`limit`in e&&(t.limit=String(e.limit)),`offset`in e&&(t.offset=String(e.offset)),e.search&&(t.search=e.search),e.sortColumn&&(t.sortColumn=e.sortColumn),e.sortOrder&&(t.sortOrder=e.sortOrder)),Object.keys(t).length>0?`?`+new URLSearchParams(t).toString():``}},sn=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),t);super(r,i,n,`storage`)}async createBucket(e){var t=this;return t.handleOperation(async()=>await k(t.fetch,`${t.url}/bucket`,{name:e},{headers:t.headers}))}async listBuckets(e){var t=this;return t.handleOperation(async()=>{let n=new URLSearchParams;e?.limit!==void 0&&n.set(`limit`,e.limit.toString()),e?.offset!==void 0&&n.set(`offset`,e.offset.toString()),e?.sortColumn&&n.set(`sortColumn`,e.sortColumn),e?.sortOrder&&n.set(`sortOrder`,e.sortOrder),e?.search&&n.set(`search`,e.search);let r=n.toString(),i=r?`${t.url}/bucket?${r}`:`${t.url}/bucket`;return await O(t.fetch,i,{headers:t.headers})})}async deleteBucket(e){var t=this;return t.handleOperation(async()=>await A(t.fetch,`${t.url}/bucket/${e}`,{},{headers:t.headers}))}from(e){var t=this;if(!Vt(e))throw new Mt(`Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.`);let n=new Et({baseUrl:this.url,catalogName:e,auth:{type:`custom`,getHeaders:async()=>t.headers},fetch:this.fetch}),r=this.shouldThrowOnError;return new Proxy(n,{get(e,t){let n=e[t];return typeof n==`function`?async(...t)=>{try{return{data:await n.apply(e,t),error:null}}catch(e){if(r)throw e;return{data:null,error:e}}}:n}})}},cn=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),{},{"Content-Type":`application/json`},t);super(r,i,n,`vectors`)}async createIndex(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/CreateIndex`,e,{headers:t.headers})||{})}async getIndex(e,t){var n=this;return n.handleOperation(async()=>await j.post(n.fetch,`${n.url}/GetIndex`,{vectorBucketName:e,indexName:t},{headers:n.headers}))}async listIndexes(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/ListIndexes`,e,{headers:t.headers}))}async deleteIndex(e,t){var n=this;return n.handleOperation(async()=>await j.post(n.fetch,`${n.url}/DeleteIndex`,{vectorBucketName:e,indexName:t},{headers:n.headers})||{})}},ln=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),{},{"Content-Type":`application/json`},t);super(r,i,n,`vectors`)}async putVectors(e){var t=this;if(e.vectors.length<1||e.vectors.length>500)throw Error(`Vector batch size must be between 1 and 500 items`);return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/PutVectors`,e,{headers:t.headers})||{})}async getVectors(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/GetVectors`,e,{headers:t.headers}))}async listVectors(e){var t=this;if(e.segmentCount!==void 0){if(e.segmentCount<1||e.segmentCount>16)throw Error(`segmentCount must be between 1 and 16`);if(e.segmentIndex!==void 0&&(e.segmentIndex<0||e.segmentIndex>=e.segmentCount))throw Error(`segmentIndex must be between 0 and ${e.segmentCount-1}`)}return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/ListVectors`,e,{headers:t.headers}))}async queryVectors(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/QueryVectors`,e,{headers:t.headers}))}async deleteVectors(e){var t=this;if(e.keys.length<1||e.keys.length>500)throw Error(`Keys batch size must be between 1 and 500 items`);return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/DeleteVectors`,e,{headers:t.headers})||{})}},un=class extends Xt{constructor(e,t={},n){let r=e.replace(/\/$/,``),i=D(D({},an),{},{"Content-Type":`application/json`},t);super(r,i,n,`vectors`)}async createBucket(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/CreateVectorBucket`,{vectorBucketName:e},{headers:t.headers})||{})}async getBucket(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/GetVectorBucket`,{vectorBucketName:e},{headers:t.headers}))}async listBuckets(e={}){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/ListVectorBuckets`,e,{headers:t.headers}))}async deleteBucket(e){var t=this;return t.handleOperation(async()=>await j.post(t.fetch,`${t.url}/DeleteVectorBucket`,{vectorBucketName:e},{headers:t.headers})||{})}},dn=class extends un{constructor(e,t={}){super(e,t.headers||{},t.fetch)}from(e){return new fn(this.url,this.headers,e,this.fetch)}async createBucket(e){var t=()=>super.createBucket,n=this;return t().call(n,e)}async getBucket(e){var t=()=>super.getBucket,n=this;return t().call(n,e)}async listBuckets(e={}){var t=()=>super.listBuckets,n=this;return t().call(n,e)}async deleteBucket(e){var t=()=>super.deleteBucket,n=this;return t().call(n,e)}},fn=class extends cn{constructor(e,t,n,r){super(e,t,r),this.vectorBucketName=n}async createIndex(e){var t=()=>super.createIndex,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName}))}async listIndexes(e={}){var t=()=>super.listIndexes,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName}))}async getIndex(e){var t=()=>super.getIndex,n=this;return t().call(n,n.vectorBucketName,e)}async deleteIndex(e){var t=()=>super.deleteIndex,n=this;return t().call(n,n.vectorBucketName,e)}index(e){return new pn(this.url,this.headers,this.vectorBucketName,e,this.fetch)}},pn=class extends ln{constructor(e,t,n,r,i){super(e,t,i),this.vectorBucketName=n,this.indexName=r}async putVectors(e){var t=()=>super.putVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async getVectors(e){var t=()=>super.getVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async listVectors(e={}){var t=()=>super.listVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async queryVectors(e){var t=()=>super.queryVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}async deleteVectors(e){var t=()=>super.deleteVectors,n=this;return t().call(n,D(D({},e),{},{vectorBucketName:n.vectorBucketName,indexName:n.indexName}))}},mn=class extends on{constructor(e,t={},n,r){super(e,t,n,r)}from(e){return new rn(this.url,this.headers,e,this.fetch)}get vectors(){return new dn(this.url+`/vector`,{headers:this.headers,fetch:this.fetch})}get analytics(){return new sn(this.url+`/iceberg`,this.headers,this.fetch)}};let hn=``,gn;typeof Deno<`u`?(hn=`deno`,gn=Deno.version?.deno):typeof document<`u`?hn=`web`:typeof navigator<`u`&&navigator.product===`ReactNative`?hn=`react-native`:(hn=`node`,gn=globalThis.process?.version?.replace(/^v/,``));let _n=[`runtime=${hn}`];gn&&_n.push(`runtime-version=${gn}`);let vn={headers:{"X-Client-Info":`supabase-js/2.118.0; ${_n.join(`; `)}`}},yn={schema:`public`},bn={autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,flowType:`implicit`},xn={},Sn={enabled:!1,respectSamplingDecision:!0};function Cn(e){if(!e||typeof e!=`string`)return null;let t=e.split(`-`);if(t.length!==4)return null;let[n,r,i,a]=t;if(n.length!==2||r.length!==32||i.length!==16||a.length!==2)return null;let o=/^[0-9a-f]+$/i;return!o.test(n)||!o.test(r)||!o.test(i)||!o.test(a)||r===`00000000000000000000000000000000`||i===`0000000000000000`?null:{version:n,traceId:r,parentId:i,traceFlags:a,isSampled:(parseInt(a,16)&1)==1}}function wn(e,t){if(!e||!t||t.length===0)return!1;let n;if(e instanceof URL)n=e;else try{n=new URL(e)}catch{return!1}for(let e of t)try{if(typeof e==`string`){if(Tn(n.hostname,e))return!0}else if(e instanceof RegExp){if(e.test(n.hostname))return!0}else if(typeof e==`function`&&e(n))return!0}catch{continue}return!1}function Tn(e,t){if(t===e)return!0;if(t.startsWith(`*.`)){let n=t.slice(2);if(e.endsWith(n)&&(e===n||e.endsWith(`.`+n)))return!0}return!1}function En(e){let t=[];try{let n=new URL(e);t.push(n.hostname)}catch{}return t.push(`*.supabase.co`,`*.supabase.in`),t.push(`localhost`,`127.0.0.1`,`[::1]`),t}let Dn=Symbol.for(`@supabase/supabase-js.traceContextExtractor`);function On(){return globalThis[Dn]}let kn=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),An=()=>Headers,jn=e=>e.startsWith(`sb_publishable_`)||e.startsWith(`sb_secret_`),Mn=new Set,Nn=e=>{if(!e.startsWith(`sb_`)||jn(e)||e.startsWith(`sb_temp_`))return;let t=e.match(/^sb_[a-zA-Z0-9]+_/)?.[0]??`unknown`;Mn.has(t)||(Mn.add(t),console.warn(`@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed and send this key as-is; if you see authentication errors you may need to upgrade @supabase/supabase-js to a version that recognizes this key type.`))},Pn=(e,t,n,r,i,a)=>{let o=kn(r),s=An(),c=i?.enabled===!0,l=i?.respectSamplingDecision!==!1,u=c?En(t):null,d=!(a?.omitApiKeyAsBearer&&jn(e));return async(t,r)=>{let i=await n(),a=new s(r?.headers);if(a.has(`apikey`)||a.set(`apikey`,e),!a.has(`Authorization`)){let t=i??(d?e:null);t&&a.set(`Authorization`,`Bearer ${t}`)}if(u){let e=Ln(t,u,l);e&&(e.traceparent&&!a.has(`traceparent`)&&a.set(`traceparent`,e.traceparent),e.tracestate&&!a.has(`tracestate`)&&a.set(`tracestate`,e.tracestate),e.baggage&&!a.has(`baggage`)&&a.set(`baggage`,e.baggage))}return o(t,{...r,headers:a})}},Fn=!1,In=!1;function Ln(e,t,n){let r=On();if(!r)return Fn||(Fn=!0,console.warn("@supabase/supabase-js: tracePropagation is enabled but the tracing runtime is not loaded, so trace headers will not be attached. Add `import '@supabase/supabase-js/tracing'` at your application entry point (requires the OpenTelemetry API package to be installed). The CDN/UMD build does not support trace propagation.")),null;if(!wn(typeof e==`string`||e instanceof URL?e:e.url,t))return null;let i=r();if(!i||!i.traceparent){if(i?.carrierKeys?.length&&!In){In=!0;let e=i.carrierKeys.includes(`sentry-trace`)?" Sentry detected: set `propagateTraceparent: true` in Sentry.init() to emit it.":` Configure your tracing SDK to emit W3C trace context on outgoing requests.`;console.warn(`@supabase/supabase-js: tracePropagation is enabled and a tracing SDK is active, but its propagator wrote [${i.carrierKeys.join(`, `)}] and no W3C traceparent header, so trace headers will not be attached.`+e)}return null}if(n){let e=Cn(i.traceparent);if(e&&!e.isSampled)return{traceparent:i.traceparent}}return i}function Rn(e){return typeof e==`boolean`?{enabled:e}:e}function zn(e){return e.endsWith(`/`)?e:e+`/`}let Bn=!1;function Vn(e){Bn||typeof e!=`object`||!e||!(`schema`in e)||e.schema===void 0||(Bn=!0,console.warn(`@supabase/supabase-js: The "schema" option must be nested under "db", e.g. createClient(url, key, { db: { schema: 'myschema' } }). A top-level "schema" is ignored and queries go to the default schema.`))}function Hn(e,t){let{db:n,auth:r,realtime:i,global:a}=e,{db:o,auth:s,realtime:c,global:l}=t,u=Rn(e.tracePropagation),d=Rn(t.tracePropagation),f={db:{...o,...n},auth:{...s,...r},realtime:{...c,...i},storage:{},global:{...l,...a,headers:{...l?.headers??{},...a?.headers??{}}},tracePropagation:{enabled:u?.enabled??d?.enabled??!1,respectSamplingDecision:u?.respectSamplingDecision??d?.respectSamplingDecision??!0},accessToken:async()=>``};return e.accessToken?f.accessToken=e.accessToken:delete f.accessToken,f}function Un(e){let t=e?.trim();if(!t)throw Error(`supabaseUrl is required.`);if(!t.match(/^https?:\/\//i))throw Error(`Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`);try{return new URL(zn(t))}catch{throw Error(`Invalid supabaseUrl: Provided URL is malformed.`)}}let Wn=`2.118.0`,M=30*1e3,Gn=3*M;2*M;let Kn={"X-Client-Info":`gotrue-js/${Wn}`},qn=`X-Supabase-Api-Version`,Jn={"2024-01-01":{timestamp:Date.parse(`2024-01-01T00:00:00.0Z`),name:`2024-01-01`}},Yn=/^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i,N=`sb_flow_id`;var Xn=class extends Error{constructor(e,t,n){super(e),this.__isAuthError=!0,this.name=`AuthError`,this.status=t,this.code=n}toJSON(){return{name:this.name,message:this.message,status:this.status,code:this.code}}};function P(e){return typeof e==`object`&&!!e&&`__isAuthError`in e}var Zn=class extends Xn{constructor(e,t,n){super(e,t,n),this.name=`AuthApiError`,this.status=t,this.code=n}};function Qn(e){return P(e)&&e.name===`AuthApiError`}var F=class extends Xn{constructor(e,t){super(e),this.name=`AuthUnknownError`,this.originalError=t}},I=class extends Xn{constructor(e,t,n,r){super(e,n,r),this.name=t,this.status=n}},L=class extends I{constructor(){super(`Auth session missing!`,`AuthSessionMissingError`,400,void 0)}};function $n(e){return P(e)&&e.name===`AuthSessionMissingError`}var R=class extends I{constructor(){super(`Auth session or user missing`,`AuthInvalidTokenResponseError`,500,void 0)}},er=class extends I{constructor(e){super(e,`AuthInvalidCredentialsError`,400,void 0)}},tr=class extends I{constructor(e,t=null){super(e,`AuthImplicitGrantRedirectError`,500,void 0),this.details=null,this.details=t}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{details:this.details})}};function nr(e){return P(e)&&e.name===`AuthImplicitGrantRedirectError`}var rr=class extends I{constructor(e,t=null){super(e,`AuthPKCEGrantCodeExchangeError`,500,void 0),this.details=null,this.details=t}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{details:this.details})}},ir=class extends I{constructor(){super(`PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.`,`AuthPKCECodeVerifierMissingError`,400,`pkce_code_verifier_not_found`)}};function ar(e){return P(e)&&e.name===`AuthPKCECodeVerifierMissingError`}var or=class extends I{constructor(e,t){super(e,`AuthRetryableFetchError`,t,void 0)}};function sr(e){return P(e)&&e.name===`AuthRetryableFetchError`}var cr=class extends I{constructor(e=`Refresh result discarded: session state changed mid-flight (e.g., concurrent signOut)`){super(e,`AuthRefreshDiscardedError`,409,void 0)}};function lr(e){return P(e)&&e.name===`AuthRefreshDiscardedError`}var ur=class extends I{constructor(e,t,n){super(e,`AuthWeakPasswordError`,t,`weak_password`),this.reasons=n}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{reasons:this.reasons})}};function dr(e){return P(e)&&e.name===`AuthWeakPasswordError`}var fr=class extends I{constructor(e){super(e,`AuthInvalidJwtError`,400,`invalid_jwt`)}};let pr=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`.split(``),mr=` 	
\r=`.split(``),hr=(()=>{let e=Array(128);for(let t=0;t<e.length;t+=1)e[t]=-1;for(let t=0;t<mr.length;t+=1)e[mr[t].charCodeAt(0)]=-2;for(let t=0;t<pr.length;t+=1)e[pr[t].charCodeAt(0)]=t;return e})();function gr(e,t,n){if(e!==null)for(t.queue=t.queue<<8|e,t.queuedBits+=8;t.queuedBits>=6;)n(pr[t.queue>>t.queuedBits-6&63]),t.queuedBits-=6;else if(t.queuedBits>0)for(t.queue<<=6-t.queuedBits,t.queuedBits=6;t.queuedBits>=6;)n(pr[t.queue>>t.queuedBits-6&63]),t.queuedBits-=6}function _r(e,t,n){let r=hr[e];if(r>-1)for(t.queue=t.queue<<6|r,t.queuedBits+=6;t.queuedBits>=8;)n(t.queue>>t.queuedBits-8&255),t.queuedBits-=8;else if(r===-2)return;else throw Error(`Invalid Base64-URL character "${String.fromCharCode(e)}"`)}function vr(e){let t=[],n=e=>{t.push(String.fromCodePoint(e))},r={utf8seq:0,codepoint:0},i={queue:0,queuedBits:0},a=e=>{xr(e,r,n)};for(let t=0;t<e.length;t+=1)_r(e.charCodeAt(t),i,a);return t.join(``)}function yr(e,t){if(e<=127){t(e);return}else if(e<=2047){t(192|e>>6),t(128|e&63);return}else if(e<=65535){t(224|e>>12),t(128|e>>6&63),t(128|e&63);return}else if(e<=1114111){t(240|e>>18),t(128|e>>12&63),t(128|e>>6&63),t(128|e&63);return}throw Error(`Unrecognized Unicode codepoint: ${e.toString(16)}`)}function br(e,t){for(let n=0;n<e.length;n+=1){let r=e.charCodeAt(n);if(r>55295&&r<=56319){let t=(r-55296)*1024&65535;r=(e.charCodeAt(n+1)-56320&65535|t)+65536,n+=1}yr(r,t)}}function xr(e,t,n){if(t.utf8seq===0){if(e<=127){n(e);return}for(let n=1;n<6;n+=1)if(!(e>>7-n&1)){t.utf8seq=n;break}if(t.utf8seq===2)t.codepoint=e&31;else if(t.utf8seq===3)t.codepoint=e&15;else if(t.utf8seq===4)t.codepoint=e&7;else throw Error(`Invalid UTF-8 sequence`);--t.utf8seq}else if(t.utf8seq>0){if(e<=127)throw Error(`Invalid UTF-8 sequence`);t.codepoint=t.codepoint<<6|e&63,--t.utf8seq,t.utf8seq===0&&n(t.codepoint)}}function Sr(e){let t=[],n={queue:0,queuedBits:0},r=e=>{t.push(e)};for(let t=0;t<e.length;t+=1)_r(e.charCodeAt(t),n,r);return new Uint8Array(t)}function Cr(e){let t=[];return br(e,e=>t.push(e)),new Uint8Array(t)}function z(e){let t=[],n={queue:0,queuedBits:0},r=e=>{t.push(e)};return e.forEach(e=>gr(e,n,r)),gr(null,n,r),t.join(``)}function wr(e){return Math.round(Date.now()/1e3)+e}function Tr(){return Symbol(`auth-callback`)}let B=()=>typeof window<`u`&&typeof document<`u`,V={tested:!1,writable:!1},Er=()=>{if(!B())return!1;try{if(typeof globalThis.localStorage!=`object`)return!1}catch{return!1}if(V.tested)return V.writable;let e=`lswt-${Math.random()}${Math.random()}`;try{globalThis.localStorage.setItem(e,e),globalThis.localStorage.removeItem(e),V.tested=!0,V.writable=!0}catch{V.tested=!0,V.writable=!1}return V.writable};function Dr(e){let t={},n=new URL(e);if(n.hash&&n.hash[0]===`#`)try{new URLSearchParams(n.hash.substring(1)).forEach((e,n)=>{t[n]=e})}catch{}return n.searchParams.forEach((e,n)=>{t[n]=e}),t}let Or=e=>e?(...t)=>e(...t):(...e)=>fetch(...e),kr=e=>typeof e==`object`&&!!e&&`status`in e&&`ok`in e&&`json`in e&&typeof e.json==`function`,H=async(e,t,n)=>{await e.setItem(t,JSON.stringify(n))},U=async(e,t)=>{let n=await e.getItem(t);if(!n)return null;try{return JSON.parse(n)}catch{return null}},W=async(e,t)=>{await e.removeItem(t)};var Ar=class e{constructor(){this.promise=new e.promiseConstructor((e,t)=>{this.resolve=e,this.reject=t})}};Ar.promiseConstructor=Promise;function jr(e){let t=e.split(`.`);if(t.length!==3)throw new fr(`Invalid JWT structure`);for(let e=0;e<t.length;e++)if(!Yn.test(t[e]))throw new fr(`JWT not in base64url format`);return{header:JSON.parse(vr(t[0])),payload:JSON.parse(vr(t[1])),signature:Sr(t[2]),raw:{header:t[0],payload:t[1]}}}async function Mr(e){return await new Promise(t=>{setTimeout(()=>t(null),e)})}function Nr(e,t){return new Promise((n,r)=>{(async()=>{for(let i=0;i<1/0;i++)try{let r=await e(i);if(!t(i,null,r)){n(r);return}}catch(e){if(!t(i,e)){r(e);return}}})()})}function Pr(e){return(`0`+e.toString(16)).substr(-2)}function Fr(){let e=new Uint32Array(56);if(typeof crypto>`u`){let e=``;for(let t=0;t<56;t++)e+=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~`.charAt(Math.floor(Math.random()*66));return e}return crypto.getRandomValues(e),Array.from(e,Pr).join(``)}async function Ir(e){let t=new TextEncoder().encode(e),n=await crypto.subtle.digest(`SHA-256`,t),r=new Uint8Array(n);return Array.from(r).map(e=>String.fromCharCode(e)).join(``)}async function Lr(e){if(!(typeof crypto<`u`&&crypto.subtle!==void 0&&typeof TextEncoder<`u`))return console.warn(`WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.`),e;let t=await Ir(e);return btoa(t).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``)}let Rr=/^[a-zA-Z0-9_-]{8,64}$/;function zr(e){return typeof e==`string`&&Rr.test(e)?e:null}function Br(){if(typeof crypto<`u`&&typeof crypto.getRandomValues==`function`){let e=new Uint8Array(16);return crypto.getRandomValues(e),Array.from(e,Pr).join(``)}let e=``;for(let t=0;t<32;t++)e+=Math.floor(Math.random()*16).toString(16);return e}let Vr=(e,t)=>`${e}-flow-${t}-code-verifier`,Hr=e=>`${e}-flows-code-verifier`;async function Ur(e,t){let n=await U(e,Hr(t));return Array.isArray(n)?n.filter(e=>zr(e)!==null):[]}async function Wr(e,t,n,r,i){await H(e,Vr(t,n),r);let a=(await Ur(e,t)).filter(e=>e!==n);for(a.push(n);a.length>5;){let n=a.shift();await W(e,Vr(t,n)),i?.(n)}await H(e,Hr(t),a),await H(e,`${t}-code-verifier`,r)}async function Gr(e,t,n){if(n){let r=await U(e,Vr(t,n));return{verifier:typeof r==`string`?r:null,flowId:n}}let r=await U(e,`${t}-code-verifier`);return{verifier:typeof r==`string`?r:null,flowId:null}}async function G(e,t,n){let r=`${t}-code-verifier`;if(!n){await W(e,r);return}let i=Vr(t,n),a=await U(e,i);await W(e,i);let o=await Ur(e,t),s=o.filter(e=>e!==n);s.length!==o.length&&(s.length>0?await H(e,Hr(t),s):await W(e,Hr(t))),a!=null&&a===await U(e,r)&&await W(e,r)}async function Kr(e,t){let n=await Ur(e,t);for(let r of n)await W(e,Vr(t,r));await W(e,Hr(t)),await W(e,`${t}-code-verifier`)}function qr(e,t){let n=e.indexOf(`#`),r=n===-1?e:e.slice(0,n),i=n===-1?``:e.slice(n),a=r.indexOf(`?`);if(a!==-1){let e=r.slice(0,a),t=r.slice(a+1).split(`&`).filter(e=>e!==``&&e!==N&&!e.startsWith(`${N}=`));r=t.length>0?`${e}?${t.join(`&`)}`:e}let o=r.includes(`?`)?`&`:`?`;return`${r}${o}${N}=${encodeURIComponent(t)}${i}`}async function Jr(e,t,n=!1,r){let i=Fr(),a=i;n&&(a+=`/recovery`);let o=Br();await Wr(e,t,o,a,r);let s=await Lr(i);return[s,i===s?`plain`:`s256`,o]}let Yr=/^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;function Xr(e){let t=e.headers.get(qn);if(!t||!t.match(Yr))return null;try{return new Date(`${t}T00:00:00.0Z`)}catch{return null}}function Zr(e){if(!e)throw Error(`Missing exp claim`);if(e<=Math.floor(Date.now()/1e3))throw Error(`JWT has expired`)}function Qr(e){switch(e){case`RS256`:return{name:`RSASSA-PKCS1-v1_5`,hash:{name:`SHA-256`}};case`ES256`:return{name:`ECDSA`,namedCurve:`P-256`,hash:{name:`SHA-256`}};default:throw Error(`Invalid alg claim`)}}let $r=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;function K(e){if(!$r.test(e))throw Error(`@supabase/auth-js: Expected parameter to be UUID but is not`)}function ei(e){if(!e.recoveryCodes)throw Error("@supabase/auth-js: the MFA recovery codes API is experimental and disabled by default. Enable it by passing `auth: { experimental: { recoveryCodes: true } }` to createClient (or to the GoTrueClient constructor).")}function ti(){return new Proxy({},{get:(e,t)=>{if(t===`__isUserNotAvailableProxy`)return!0;if(typeof t==`symbol`){let e=t.toString();if(e===`Symbol(Symbol.toPrimitive)`||e===`Symbol(Symbol.toStringTag)`||e===`Symbol(util.inspect.custom)`)return}throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${t}" property of the session object is not supported. Please use getUser() instead.`)},set:(e,t)=>{throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`)},deleteProperty:(e,t)=>{throw Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`)}})}function ni(e,t){return new Proxy(e,{get:(e,n,r)=>{if(n===`__isInsecureUserWarningProxy`)return!0;if(typeof n==`symbol`){let t=n.toString();if(t===`Symbol(Symbol.toPrimitive)`||t===`Symbol(Symbol.toStringTag)`||t===`Symbol(util.inspect.custom)`||t===`Symbol(nodejs.util.inspect.custom)`)return Reflect.get(e,n,r)}return!t.value&&typeof n==`string`&&(console.warn(`Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.`),t.value=!0),Reflect.get(e,n,r)}})}function ri(e){return JSON.parse(JSON.stringify(e))}let q=e=>{if(typeof e==`object`&&e){let t=e;if(typeof t.msg==`string`)return t.msg;if(typeof t.message==`string`)return t.message;if(typeof t.error_description==`string`)return t.error_description;if(typeof t.error==`string`)return t.error}return JSON.stringify(e)},ii=[500,501,502,503,504,520,521,522,523,524,525,526,527,528,529,530];async function ai(e){if(!kr(e))throw new or(q(e),0);let t;try{t=await e.json()}catch(t){throw ii.includes(e.status)?new or(e.statusText||`HTTP ${e.status}`,e.status):new F(q(t),t)}if(ii.includes(e.status))throw new or(q(t),e.status);let n,r=Xr(e);if(r&&r.getTime()>=Jn[`2024-01-01`].timestamp&&typeof t==`object`&&t&&typeof t.code==`string`?n=t.code:typeof t==`object`&&t&&typeof t.error_code==`string`&&(n=t.error_code),n){if(n===`weak_password`)throw new ur(q(t),e.status,t.weak_password?.reasons||[]);if(n===`session_not_found`)throw new L}else if(typeof t==`object`&&t&&typeof t.weak_password==`object`&&t.weak_password&&Array.isArray(t.weak_password.reasons)&&t.weak_password.reasons.length&&t.weak_password.reasons.reduce((e,t)=>e&&typeof t==`string`,!0))throw new ur(q(t),e.status,t.weak_password.reasons);throw new Zn(q(t),e.status||500,n)}let oi=(e,t,n,r)=>{let i={method:e,headers:t?.headers||{}};return e===`GET`?i:(i.headers=Object.assign({"Content-Type":`application/json;charset=UTF-8`},t?.headers),i.body=JSON.stringify(r),Object.assign(Object.assign({},i),n))};async function J(e,t,n,r){let i=Object.assign({},r?.headers);i[qn]||(i[qn]=Jn[`2024-01-01`].name),r?.jwt&&(i.Authorization=`Bearer ${r.jwt}`);let a=r?.query??{};r?.redirectTo&&(a.redirect_to=r.redirectTo);let o=await si(e,t,n+(Object.keys(a).length?`?`+new URLSearchParams(a).toString():``),{headers:i,noResolveJson:r?.noResolveJson},{},r?.body);return r?.xform?r?.xform(o):{data:Object.assign({},o),error:null}}async function si(e,t,n,r,i,a){let o=oi(t,r,i,a),s;try{s=await e(n,Object.assign({},o))}catch(e){throw new or(q(e),0)}if(s.ok||await ai(s),r?.noResolveJson)return s;try{return await s.json()}catch(e){await ai(e)}}function Y(e){let t=null;fi(e)&&(t=Object.assign({},e),e.expires_at||(t.expires_at=wr(e.expires_in)));let n=e.user??(typeof e?.id==`string`?e:null);return{data:{session:t,user:n},error:null}}function ci(e){let t=Y(e);return!t.error&&e.weak_password&&typeof e.weak_password==`object`&&Array.isArray(e.weak_password.reasons)&&e.weak_password.reasons.length&&e.weak_password.message&&typeof e.weak_password.message==`string`&&e.weak_password.reasons.reduce((e,t)=>e&&typeof t==`string`,!0)&&(t.data.weak_password=e.weak_password),t}function X(e){return{data:{user:e.user??e},error:null}}function li(e){return{data:e,error:null}}function ui(e){let{action_link:n,email_otp:r,hashed_token:i,redirect_to:a,verification_type:o}=e,s=t(e,[`action_link`,`email_otp`,`hashed_token`,`redirect_to`,`verification_type`]);return{data:{properties:{action_link:n,email_otp:r,hashed_token:i,redirect_to:a,verification_type:o},user:Object.assign({},s)},error:null}}function di(e){return e}function fi(e){return!!e.access_token&&!!e.refresh_token&&!!e.expires_in}let pi=[`global`,`local`,`others`];var mi=class{constructor({url:e=``,headers:t={},fetch:n,experimental:r}){this.url=e,this.headers=t,this.fetch=Or(n),this.experimental=r??{},this.mfa={listFactors:this._listFactors.bind(this),deleteFactor:this._deleteFactor.bind(this)},this.oauth={listClients:this._listOAuthClients.bind(this),createClient:this._createOAuthClient.bind(this),getClient:this._getOAuthClient.bind(this),updateClient:this._updateOAuthClient.bind(this),deleteClient:this._deleteOAuthClient.bind(this),regenerateClientSecret:this._regenerateOAuthClientSecret.bind(this)},this.customProviders={listProviders:this._listCustomProviders.bind(this),createProvider:this._createCustomProvider.bind(this),getProvider:this._getCustomProvider.bind(this),updateProvider:this._updateCustomProvider.bind(this),deleteProvider:this._deleteCustomProvider.bind(this)},this.passkey={listPasskeys:this._adminListPasskeys.bind(this),deletePasskey:this._adminDeletePasskey.bind(this)}}async signOut(e,t=pi[0]){if(pi.indexOf(t)<0)throw Error(`@supabase/auth-js: Parameter scope must be one of ${pi.join(`, `)}`);try{return await J(this.fetch,`POST`,`${this.url}/logout?scope=${t}`,{headers:this.headers,jwt:e,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async inviteUserByEmail(e,t={}){try{return await J(this.fetch,`POST`,`${this.url}/invite`,{body:{email:e,data:t.data},headers:this.headers,redirectTo:t.redirectTo,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async generateLink(e){try{let{options:n}=e,r=t(e,[`options`]),i=Object.assign(Object.assign({},r),n);return`newEmail`in r&&(i.new_email=r?.newEmail,delete i.newEmail),await J(this.fetch,`POST`,`${this.url}/admin/generate_link`,{body:i,headers:this.headers,xform:ui,redirectTo:n?.redirectTo})}catch(e){if(P(e))return{data:{properties:null,user:null},error:e};throw e}}async createUser(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/users`,{body:e,headers:this.headers,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async listUsers(e){try{let t={nextPage:null,lastPage:0,total:0},n=await J(this.fetch,`GET`,`${this.url}/admin/users`,{headers:this.headers,noResolveJson:!0,query:{page:(e?.page)?.toString()??``,per_page:(e?.perPage)?.toString()??``},xform:di});if(n.error)throw n.error;let r=await n.json(),i=n.headers.get(`x-total-count`)??0,a=n.headers.get(`link`)?.split(`,`)??[];return a.length>0&&(a.forEach(e=>{let n=parseInt(e.split(`;`)[0].split(`=`)[1].substring(0,1)),r=JSON.parse(e.split(`;`)[1].split(`=`)[1]);t[`${r}Page`]=n}),t.total=parseInt(i)),{data:Object.assign(Object.assign({},r),t),error:null}}catch(e){if(P(e))return{data:{users:[]},error:e};throw e}}async getUserById(e){K(e);try{return await J(this.fetch,`GET`,`${this.url}/admin/users/${e}`,{headers:this.headers,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async updateUserById(e,t){K(e);try{return await J(this.fetch,`PUT`,`${this.url}/admin/users/${e}`,{body:t,headers:this.headers,xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async deleteUser(e,t=!1){K(e);try{return await J(this.fetch,`DELETE`,`${this.url}/admin/users/${e}`,{headers:this.headers,body:{should_soft_delete:t},xform:X})}catch(e){if(P(e))return{data:{user:null},error:e};throw e}}async _listFactors(e){K(e.userId);try{let{data:t,error:n}=await J(this.fetch,`GET`,`${this.url}/admin/users/${e.userId}/factors`,{headers:this.headers,xform:e=>({data:{factors:e},error:null})});return{data:t,error:n}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _deleteFactor(e){K(e.userId),K(e.id);try{return{data:await J(this.fetch,`DELETE`,`${this.url}/admin/users/${e.userId}/factors/${e.id}`,{headers:this.headers}),error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _listOAuthClients(e){try{let t={nextPage:null,lastPage:0,total:0},n=await J(this.fetch,`GET`,`${this.url}/admin/oauth/clients`,{headers:this.headers,noResolveJson:!0,query:{page:(e?.page)?.toString()??``,per_page:(e?.perPage)?.toString()??``},xform:di});if(n.error)throw n.error;let r=await n.json(),i=n.headers.get(`x-total-count`)??0,a=n.headers.get(`link`)?.split(`,`)??[];return a.length>0&&(a.forEach(e=>{let n=parseInt(e.split(`;`)[0].split(`=`)[1].substring(0,1)),r=JSON.parse(e.split(`;`)[1].split(`=`)[1]);t[`${r}Page`]=n}),t.total=parseInt(i)),{data:Object.assign(Object.assign({},r),t),error:null}}catch(e){if(P(e))return{data:{clients:[]},error:e};throw e}}async _createOAuthClient(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/oauth/clients`,{body:e,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _getOAuthClient(e){try{return await J(this.fetch,`GET`,`${this.url}/admin/oauth/clients/${e}`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _updateOAuthClient(e,t){try{return await J(this.fetch,`PUT`,`${this.url}/admin/oauth/clients/${e}`,{body:t,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _deleteOAuthClient(e){try{return await J(this.fetch,`DELETE`,`${this.url}/admin/oauth/clients/${e}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _regenerateOAuthClientSecret(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/oauth/clients/${e}/regenerate_secret`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _listCustomProviders(e){try{let t={};return e?.type&&(t.type=e.type),await J(this.fetch,`GET`,`${this.url}/admin/custom-providers`,{headers:this.headers,query:t,xform:e=>({data:{providers:e?.providers??[]},error:null})})}catch(e){if(P(e))return{data:{providers:[]},error:e};throw e}}async _createCustomProvider(e){try{return await J(this.fetch,`POST`,`${this.url}/admin/custom-providers`,{body:e,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _getCustomProvider(e){try{return await J(this.fetch,`GET`,`${this.url}/admin/custom-providers/${e}`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _updateCustomProvider(e,t){try{return await J(this.fetch,`PUT`,`${this.url}/admin/custom-providers/${e}`,{body:t,headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _deleteCustomProvider(e){try{return await J(this.fetch,`DELETE`,`${this.url}/admin/custom-providers/${e}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}async _adminListPasskeys(e){K(e.userId);try{return await J(this.fetch,`GET`,`${this.url}/admin/users/${e.userId}/passkeys`,{headers:this.headers,xform:e=>({data:e,error:null})})}catch(e){if(P(e))return{data:null,error:e};throw e}}async _adminDeletePasskey(e){K(e.userId),K(e.passkeyId);try{return await J(this.fetch,`DELETE`,`${this.url}/admin/users/${e.userId}/passkeys/${e.passkeyId}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(e){if(P(e))return{data:null,error:e};throw e}}};function hi(e={}){return{getItem:t=>e[t]||null,setItem:(t,n)=>{e[t]=n},removeItem:t=>{delete e[t]}}}let Z={debug:!!(globalThis&&Er()&&globalThis.localStorage&&globalThis.localStorage.getItem(`supabase.gotrue-js.locks.debug`)===`true`)};var gi=class extends Error{constructor(e){super(e),this.isAcquireTimeout=!0}},_i=class extends gi{},vi=class extends gi{};async function yi(e,t,n){Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: acquire lock`,e,t);let r=new globalThis.AbortController,i;t>0&&(i=setTimeout(()=>{r.abort(),Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock acquire timed out`,e)},t)),await Promise.resolve();try{return await globalThis.navigator.locks.request(e,t===0?{mode:`exclusive`,ifAvailable:!0}:{mode:`exclusive`,signal:r.signal},async r=>{if(r){clearTimeout(i),Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: acquired`,e,r.name);try{return await n()}finally{Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: released`,e,r.name)}}else if(t===0)throw Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: not immediately available`,e),new _i(`Acquiring an exclusive Navigator LockManager lock "${e}" immediately failed`);else{if(Z.debug)try{let e=await globalThis.navigator.locks.query();console.log(`@supabase/gotrue-js: Navigator LockManager state`,JSON.stringify(e,null,`  `))}catch(e){console.warn(`@supabase/gotrue-js: Error when querying Navigator LockManager state`,e)}return console.warn(`@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request`),clearTimeout(i),await n()}})}catch(a){if(clearTimeout(i),typeof a==`object`&&a&&`name`in a&&a.name===`AbortError`){if(r.signal.aborted)return Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock`,e),console.warn(`@supabase/gotrue-js: Lock "${e}" was not released within ${t}ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`),await Promise.resolve().then(()=>globalThis.navigator.locks.request(e,{mode:`exclusive`,steal:!0},async t=>{if(t){Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: recovered (stolen)`,e,t.name);try{return await n()}finally{Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: released (stolen)`,e,t.name)}}else return console.warn(`@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true`),await n()}));throw Z.debug&&console.log(`@supabase/gotrue-js: navigatorLock: lock was stolen by another request`,e),new _i(`Lock "${e}" was released because another request stole it`)}throw a}}let bi={};async function xi(e,t,n){let r=bi[e]??Promise.resolve(),i=(async()=>{try{return await r,null}catch{return null}})(),a=(async()=>{let r=null;try{let n=t>=0?new Promise((n,i)=>{r=setTimeout(()=>{console.warn(`@supabase/gotrue-js: Lock "${e}" acquisition timed out after ${t}ms. This may be caused by another operation holding the lock. Consider increasing lockAcquireTimeout or checking for stuck operations.`),i(new vi(`Acquiring process lock with name "${e}" timed out`))},t)}):null;await Promise.race([i,n].filter(e=>e)),r!==null&&clearTimeout(r)}catch(e){if(r!==null&&clearTimeout(r),e instanceof gi)throw e}return await n()})();return bi[e]=(async()=>{try{return await a}catch(e){if(e instanceof gi){try{await r}catch{}return null}throw e}})(),await a}function Si(){if(typeof globalThis!=`object`)try{Object.defineProperty(Object.prototype,`__magic__`,{get:function(){return this},configurable:!0}),__magic__.globalThis=__magic__,delete Object.prototype.__magic__}catch{typeof self<`u`&&(self.globalThis=self)}}function Ci(e){if(!/^0x[a-fA-F0-9]{40}$/.test(e))throw Error(`@supabase/auth-js: Address "${e}" is invalid.`);return e.toLowerCase()}function wi(e){return parseInt(e,16)}function Ti(e){let t=new TextEncoder().encode(e);return`0x`+Array.from(t,e=>e.toString(16).padStart(2,`0`)).join(``)}function Ei(e){let{chainId:t,domain:n,expirationTime:r,issuedAt:i=new Date,nonce:a,notBefore:o,requestId:s,resources:c,scheme:l,uri:u,version:d}=e;if(!Number.isInteger(t))throw Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${t}`);if(!n)throw Error(`@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.`);if(a&&a.length<8)throw Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${a}`);if(!u)throw Error(`@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.`);if(d!==`1`)throw Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${d}`);if(e.statement?.includes(`
`))throw Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${e.statement}`);let f=Ci(e.address),p=`${l?`${l}://${n}`:n} wants you to sign in with your Ethereum account:\n${f}\n\n${e.statement?`${e.statement}\n`:``}`,m=`URI: ${u}\nVersion: ${d}\nChain ID: ${t}${a?`\nNonce: ${a}`:``}\nIssued At: ${i.toISOString()}`;if(r&&(m+=`\nExpiration Time: ${r.toISOString()}`),o&&(m+=`\nNot Before: ${o.toISOString()}`),s&&(m+=`\nRequest ID: ${s}`),c){let e=`
Resources:`;for(let t of c){if(!t||typeof t!=`string`)throw Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${t}`);e+=`\n- ${t}`}m+=e}return`${p}\n${m}`}var Q=class extends Error{constructor({message:e,code:t,cause:n,name:r}){super(e,{cause:n}),this.__isWebAuthnError=!0,this.name=r??(n instanceof Error?n.name:void 0)??`Unknown Error`,this.code=t}toJSON(){return{name:this.name,message:this.message,code:this.code}}},Di=class extends Q{constructor(e,t){super({code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:t,message:e}),this.name=`WebAuthnUnknownError`,this.originalError=t}};function Oi({error:e,options:t}){let{publicKey:n}=t;if(!n)throw Error(`options was missing required publicKey property`);if(e.name===`AbortError`){if(t.signal instanceof AbortSignal)return new Q({message:`Registration ceremony was sent an abort signal`,code:`ERROR_CEREMONY_ABORTED`,cause:e})}else if(e.name===`ConstraintError`){if(n.authenticatorSelection?.requireResidentKey===!0)return new Q({message:`Discoverable credentials were required but no available authenticator supported it`,code:`ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT`,cause:e});if(t.mediation===`conditional`&&n.authenticatorSelection?.userVerification===`required`)return new Q({message:`User verification was required during automatic registration but it could not be performed`,code:`ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE`,cause:e});if(n.authenticatorSelection?.userVerification===`required`)return new Q({message:`User verification was required but no available authenticator supported it`,code:`ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT`,cause:e})}else if(e.name===`InvalidStateError`)return new Q({message:`The authenticator was previously registered`,code:`ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`,cause:e});else if(e.name===`NotAllowedError`)return new Q({message:e.message,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e});else if(e.name===`NotSupportedError`)return n.pubKeyCredParams.filter(e=>e.type===`public-key`).length===0?new Q({message:`No entry in pubKeyCredParams was of type "public-key"`,code:`ERROR_MALFORMED_PUBKEYCREDPARAMS`,cause:e}):new Q({message:`No available authenticator supported any of the specified pubKeyCredParams algorithms`,code:`ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG`,cause:e});else if(e.name===`SecurityError`){let t=window.location.hostname;if(Fi(t)){if(n.rp.id!==t)return new Q({message:`The RP ID "${n.rp.id}" is invalid for this domain`,code:`ERROR_INVALID_RP_ID`,cause:e})}else return new Q({message:`${window.location.hostname} is an invalid domain`,code:`ERROR_INVALID_DOMAIN`,cause:e})}else if(e.name===`TypeError`){if(n.user.id.byteLength<1||n.user.id.byteLength>64)return new Q({message:`User ID was not between 1 and 64 characters`,code:`ERROR_INVALID_USER_ID_LENGTH`,cause:e})}else if(e.name===`UnknownError`)return new Q({message:`The authenticator was unable to process the specified options, or could not create a new credential`,code:`ERROR_AUTHENTICATOR_GENERAL_ERROR`,cause:e});return new Q({message:`a Non-Webauthn related error has occurred`,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e})}function ki({error:e,options:t}){let{publicKey:n}=t;if(!n)throw Error(`options was missing required publicKey property`);if(e.name===`AbortError`){if(t.signal instanceof AbortSignal)return new Q({message:`Authentication ceremony was sent an abort signal`,code:`ERROR_CEREMONY_ABORTED`,cause:e})}else if(e.name===`NotAllowedError`)return new Q({message:e.message,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e});else if(e.name===`SecurityError`){let t=window.location.hostname;if(Fi(t)){if(n.rpId!==t)return new Q({message:`The RP ID "${n.rpId}" is invalid for this domain`,code:`ERROR_INVALID_RP_ID`,cause:e})}else return new Q({message:`${window.location.hostname} is an invalid domain`,code:`ERROR_INVALID_DOMAIN`,cause:e})}else if(e.name===`UnknownError`)return new Q({message:`The authenticator was unable to process the specified options, or could not create a new assertion signature`,code:`ERROR_AUTHENTICATOR_GENERAL_ERROR`,cause:e});return new Q({message:`a Non-Webauthn related error has occurred`,code:`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`,cause:e})}let Ai=new class{createNewAbortSignal(){if(this.controller){let e=Error(`Cancelling existing WebAuthn API call for new one`);e.name=`AbortError`,this.controller.abort(e)}let e=new AbortController;return this.controller=e,e.signal}cancelCeremony(){if(this.controller){let e=Error(`Manually cancelling existing WebAuthn API call`);e.name=`AbortError`,this.controller.abort(e),this.controller=void 0}}};function ji(e){if(!e)throw Error(`Credential creation options are required`);if(typeof PublicKeyCredential<`u`&&`parseCreationOptionsFromJSON`in PublicKeyCredential&&typeof PublicKeyCredential.parseCreationOptionsFromJSON==`function`)return PublicKeyCredential.parseCreationOptionsFromJSON(e);let{challenge:n,user:r,excludeCredentials:i}=e,a=t(e,[`challenge`,`user`,`excludeCredentials`]),o=Sr(n).buffer,s=Object.assign(Object.assign({},r),{id:Sr(r.id).buffer}),c=Object.assign(Object.assign({},a),{challenge:o,user:s});if(i&&i.length>0){c.excludeCredentials=Array(i.length);for(let e=0;e<i.length;e++){let t=i[e];c.excludeCredentials[e]=Object.assign(Object.assign({},t),{id:Sr(t.id).buffer,type:t.type||`public-key`,transports:t.transports})}}return c}function Mi(e){if(!e)throw Error(`Credential request options are required`);if(typeof PublicKeyCredential<`u`&&`parseRequestOptionsFromJSON`in PublicKeyCredential&&typeof PublicKeyCredential.parseRequestOptionsFromJSON==`function`)return PublicKeyCredential.parseRequestOptionsFromJSON(e);let{challenge:n,allowCredentials:r}=e,i=t(e,[`challenge`,`allowCredentials`]),a=Sr(n).buffer,o=Object.assign(Object.assign({},i),{challenge:a});if(r&&r.length>0){o.allowCredentials=Array(r.length);for(let e=0;e<r.length;e++){let t=r[e];o.allowCredentials[e]=Object.assign(Object.assign({},t),{id:Sr(t.id).buffer,type:t.type||`public-key`,transports:t.transports})}}return o}function Ni(e){if(`toJSON`in e&&typeof e.toJSON==`function`)return e.toJSON();let t=e;return{id:e.id,rawId:e.id,response:{attestationObject:z(new Uint8Array(e.response.attestationObject)),clientDataJSON:z(new Uint8Array(e.response.clientDataJSON))},type:`public-key`,clientExtensionResults:e.getClientExtensionResults(),authenticatorAttachment:t.authenticatorAttachment??void 0}}function Pi(e){if(`toJSON`in e&&typeof e.toJSON==`function`)return e.toJSON();let t=e,n=e.getClientExtensionResults(),r=e.response;return{id:e.id,rawId:e.id,response:{authenticatorData:z(new Uint8Array(r.authenticatorData)),clientDataJSON:z(new Uint8Array(r.clientDataJSON)),signature:z(new Uint8Array(r.signature)),userHandle:r.userHandle?z(new Uint8Array(r.userHandle)):void 0},type:`public-key`,clientExtensionResults:n,authenticatorAttachment:t.authenticatorAttachment??void 0}}function Fi(e){return e===`localhost`||/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(e)}function Ii(){return!!(B()&&`PublicKeyCredential`in window&&window.PublicKeyCredential&&`credentials`in navigator&&typeof(navigator==null?void 0:navigator.credentials)?.create==`function`&&typeof(navigator==null?void 0:navigator.credentials)?.get==`function`)}async function Li(e){try{let t=await navigator.credentials.create(e);return t?t instanceof PublicKeyCredential?{data:t,error:null}:{data:null,error:new Di(`Browser returned unexpected credential type`,t)}:{data:null,error:new Di(`Empty credential response`,t)}}catch(t){return{data:null,error:Oi({error:t,options:e})}}}async function Ri(e){try{let t=await navigator.credentials.get(e);return t?t instanceof PublicKeyCredential?{data:t,error:null}:{data:null,error:new Di(`Browser returned unexpected credential type`,t)}:{data:null,error:new Di(`Empty credential response`,t)}}catch(t){return{data:null,error:ki({error:t,options:e})}}}let zi={hints:[`security-key`],authenticatorSelection:{authenticatorAttachment:`cross-platform`,requireResidentKey:!1,userVerification:`preferred`,residentKey:`discouraged`},attestation:`direct`},Bi={userVerification:`preferred`,hints:[`security-key`],attestation:`direct`};function Vi(...e){let t=e=>typeof e==`object`&&!!e&&!Array.isArray(e),n=e=>e instanceof ArrayBuffer||ArrayBuffer.isView(e),r={};for(let i of e)if(i)for(let e in i){let a=i[e];if(a!==void 0)if(Array.isArray(a))r[e]=a;else if(n(a))r[e]=a;else if(t(a)){let n=r[e];t(n)?r[e]=Vi(n,a):r[e]=Vi(a)}else r[e]=a}return r}function Hi(e,t){return Vi(zi,e,t||{})}function Ui(e,t){return Vi(Bi,e,t||{})}var Wi=class{constructor(e){this.client=e,this.enroll=this._enroll.bind(this),this.challenge=this._challenge.bind(this),this.verify=this._verify.bind(this),this.authenticate=this._authenticate.bind(this),this.register=this._register.bind(this)}async _enroll(e){return this.client.mfa.enroll(Object.assign(Object.assign({},e),{factorType:`webauthn`}))}async _challenge({factorId:e,webauthn:t,friendlyName:n,signal:r},i){try{let{data:a,error:o}=await this.client.mfa.challenge({factorId:e,webauthn:t});if(!a)return{data:null,error:o};let s=r??Ai.createNewAbortSignal();if(a.webauthn.type===`create`){let{user:e}=a.webauthn.credential_options.publicKey;if(!e.name){let t=n;if(t)e.name=`${e.id}:${t}`;else{let t=(await this.client.getUser()).data.user,n=t?.user_metadata?.name||t?.email||t?.id||`User`;e.name=`${e.id}:${n}`}}e.displayName||=e.name}switch(a.webauthn.type){case`create`:{let{data:t,error:n}=await Li({publicKey:Hi(a.webauthn.credential_options.publicKey,i?.create),signal:s});return t?{data:{factorId:e,challengeId:a.id,webauthn:{type:a.webauthn.type,credential_response:t}},error:null}:{data:null,error:n}}case`request`:{let t=Ui(a.webauthn.credential_options.publicKey,i?.request),{data:n,error:r}=await Ri(Object.assign(Object.assign({},a.webauthn.credential_options),{publicKey:t,signal:s}));return n?{data:{factorId:e,challengeId:a.id,webauthn:{type:a.webauthn.type,credential_response:n}},error:null}:{data:null,error:r}}}}catch(e){return P(e)?{data:null,error:e}:{data:null,error:new F(`Unexpected error in challenge`,e)}}}async _verify({challengeId:e,factorId:t,webauthn:n}){return this.client.mfa.verify({factorId:t,challengeId:e,webauthn:n})}async _authenticate({factorId:e,webauthn:{rpId:t=typeof window<`u`?window.location.hostname:void 0,rpOrigins:n=typeof window<`u`?[window.location.origin]:void 0,signal:r}={}},i){if(!t)return{data:null,error:new Xn(`rpId is required for WebAuthn authentication`)};try{if(!Ii())return{data:null,error:new F(`Browser does not support WebAuthn`,null)};let{data:a,error:o}=await this.challenge({factorId:e,webauthn:{rpId:t,rpOrigins:n},signal:r},{request:i});if(!a)return{data:null,error:o};let{webauthn:s}=a;return this._verify({factorId:e,challengeId:a.challengeId,webauthn:{type:s.type,rpId:t,rpOrigins:n,credential_response:s.credential_response}})}catch(e){return P(e)?{data:null,error:e}:{data:null,error:new F(`Unexpected error in authenticate`,e)}}}async _register({friendlyName:e,webauthn:{rpId:t=typeof window<`u`?window.location.hostname:void 0,rpOrigins:n=typeof window<`u`?[window.location.origin]:void 0,signal:r}={}},i){if(!t)return{data:null,error:new Xn(`rpId is required for WebAuthn registration`)};try{if(!Ii())return{data:null,error:new F(`Browser does not support WebAuthn`,null)};let{data:a,error:o}=await this._enroll({friendlyName:e});if(!a)return await this.client.mfa.listFactors().then(t=>t.data?.all.find(t=>t.factor_type===`webauthn`&&t.friendly_name===e&&t.status===`unverified`)).then(e=>e?this.client.mfa.unenroll({factorId:e?.id}):void 0),{data:null,error:o};let{data:s,error:c}=await this._challenge({factorId:a.id,friendlyName:a.friendly_name,webauthn:{rpId:t,rpOrigins:n},signal:r},{create:i});return s?this._verify({factorId:a.id,challengeId:s.challengeId,webauthn:{rpId:t,rpOrigins:n,type:s.webauthn.type,credential_response:s.webauthn.credential_response}}):{data:null,error:c}}catch(e){return P(e)?{data:null,error:e}:{data:null,error:new F(`Unexpected error in register`,e)}}}};Si();let Gi={url:`http://localhost:9999`,storageKey:`supabase.auth.token`,autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,headers:Kn,flowType:`implicit`,debug:!1,hasCustomAuthorizationHeader:!1,throwOnError:!1,lockAcquireTimeout:5e3,skipAutoInitialize:!1,experimental:{}},$={},Ki=!1;var qi=class e{get jwks(){return $[this.storageKey]?.jwks??{keys:[]}}set jwks(e){$[this.storageKey]=Object.assign(Object.assign({},$[this.storageKey]),{jwks:e})}get jwks_cached_at(){return $[this.storageKey]?.cachedAt??-(2**53-1)}set jwks_cached_at(e){$[this.storageKey]=Object.assign(Object.assign({},$[this.storageKey]),{cachedAt:e})}constructor(t){var n;this.userStorage=null,this.memoryStorage=null,this.stateChangeEmitters=new Map,this.autoRefreshTicker=null,this.autoRefreshTickTimeout=null,this.visibilityChangedCallback=null,this.refreshingDeferred=null,this.lastRefreshFailure=null,this._sessionRemovalEpoch=0,this.initializePromise=null,this._pendingInitNotifications=null,this.detectSessionInUrl=!0,this.hasCustomAuthorizationHeader=!1,this.suppressGetSessionWarning=!1,this.lock=null,this.lockAcquired=!1,this.pendingInLock=[],this.broadcastChannel=null,this.logger=console.log;let r=Object.assign(Object.assign({},Gi),t);if(this.storageKey=r.storageKey,this.instanceID=e.nextInstanceID[this.storageKey]??0,e.nextInstanceID[this.storageKey]=this.instanceID+1,this.logDebugMessages=!!r.debug,typeof r.debug==`function`&&(this.logger=r.debug),this.instanceID>0&&B()){let e=`${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;console.warn(e),this.logDebugMessages&&console.trace(e)}if(this.persistSession=r.persistSession,this.autoRefreshToken=r.autoRefreshToken,this.experimental=r.experimental??{},this.admin=new mi({url:r.url,headers:r.headers,fetch:r.fetch,experimental:this.experimental}),this.url=r.url,this.headers=r.headers,this.fetch=Or(r.fetch),this.detectSessionInUrl=r.detectSessionInUrl,this.flowType=r.flowType,this.hasCustomAuthorizationHeader=r.hasCustomAuthorizationHeader,this.throwOnError=r.throwOnError,this.lockAcquireTimeout=r.lockAcquireTimeout,r.lock!=null&&(this.lock=r.lock,Ki||(Ki=!0,console.warn(`${this._logPrefix()} The "lock" option is deprecated and will be removed in v3. The client now coordinates session refreshes without a lock, so most apps can drop the option. See https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md`))),this.jwks||(this.jwks={keys:[]},this.jwks_cached_at=-(2**53-1)),this.mfa={verify:this._verify.bind(this),enroll:this._enroll.bind(this),unenroll:this._unenroll.bind(this),challenge:this._challenge.bind(this),listFactors:this._listFactors.bind(this),challengeAndVerify:this._challengeAndVerify.bind(this),getAuthenticatorAssuranceLevel:this._getAuthenticatorAssuranceLevel.bind(this),webauthn:new Wi(this),recoveryCodes:{getStatus:this._getRecoveryCodesStatus.bind(this),generate:this._generateRecoveryCodes.bind(this),verify:this._verifyRecoveryCode.bind(this),regenerate:this._regenerateRecoveryCodes.bind(this),unenroll:this._unenrollRecoveryCodes.bind(this)}},this.oauth={getAuthorizationDetails:this._getAuthorizationDetails.bind(this),approveAuthorization:this._approveAuthorization.bind(this),denyAuthorization:this._denyAuthorization.bind(this),listGrants:this._listOAuthGrants.bind(this),revokeGrant:this._revokeOAuthGrant.bind(this)},this.passkey={startRegistration:this._startPasskeyRegistration.bind(this),verifyRegistration:this._verifyPasskeyRegistration.bind(this),startAuthentication:this._startPasskeyAuthentication.bind(this),verifyAuthentication:this._verifyPasskeyAuthentication.bind(this),list:this._listPasskeys.bind(this),update:this._updatePasskey.bind(this),delete:this._deletePasskey.bind(this)},this.persistSession?(r.storage?this.storage=r.storage:Er()?this.storage=globalThis.localStorage:(this.memoryStorage={},this.storage=hi(this.memoryStorage)),r.userStorage&&(this.userStorage=r.userStorage)):(this.memoryStorage={},this.storage=hi(this.memoryStorage)),B()&&globalThis.BroadcastChannel&&this.persistSession&&this.storageKey){try{this.broadcastChannel=new globalThis.BroadcastChannel(this.storageKey)}catch(e){console.error(`Failed to create a new BroadcastChannel, multi-tab state changes will not be available`,e)}(n=this.broadcastChannel)==null||n.addEventListener(`message`,async e=>{this._debug(`received broadcast notification from other tab or client`,e),(e.data.event===`TOKEN_REFRESHED`||e.data.event===`SIGNED_IN`)&&(this.lastRefreshFailure=null);try{await this._notifyAllSubscribers(e.data.event,e.data.session,!1)}catch(e){this._debug(`#broadcastChannel`,`error`,e)}})}r.skipAutoInitialize||this.initialize().catch(e=>{this._debug(`#initialize()`,`error`,e)})}isThrowOnErrorEnabled(){return this.throwOnError}_returnResult(e){if(this.throwOnError&&e&&e.error)throw e.error;return e}_logPrefix(){return`GoTrueClient@${this.storageKey}:${this.instanceID} (${Wn}) ${new Date().toISOString()}`}_debug(...e){return this.logDebugMessages&&this.logger(this._logPrefix(),...e),this}async initialize(){if(this.initializePromise)return await this.initializePromise;this._pendingInitNotifications=[],this.initializePromise=(async()=>this.lock==null?await this._initialize():await this._acquireLock(this.lockAcquireTimeout,async()=>await this._initialize()))();let e=await this.initializePromise,t=this._pendingInitNotifications??[];this._pendingInitNotifications=null;for(let e of t)await this._notifyAllSubscribers(e.event,e.session,e.broadcast);return e}async _initialize(){try{let e={},t=`none`;if(B()&&(e=Dr(window.location.href),this._isImplicitGrantCallback(e)?t=`implicit`:await this._isPKCECallback(e)&&(t=`pkce`)),B()&&this.detectSessionInUrl&&t!==`none`){let{data:n,error:r}=await this._getSessionFromURL(e,t);if(r){if(this._debug(`#_initialize()`,`error detecting session from URL`,r),nr(r)){let e=r.details?.code;if(e===`identity_already_exists`||e===`identity_not_found`||e===`single_identity_not_deletable`)return{error:r}}return{error:r}}let{session:i,redirectType:a}=n;return this._debug(`#_initialize()`,`detected session in URL`,i,`redirect type`,a),await this._saveSession(i),setTimeout(async()=>{a===`recovery`?await this._notifyAllSubscribers(`PASSWORD_RECOVERY`,i):await this._notifyAllSubscribers(`SIGNED_IN`,i)},0),{error:null}}return await this._recoverAndRefresh(),{error:null}}catch(e){return P(e)?this._returnResult({error:e}):this._returnResult({error:new F(`Unexpected error during initialization`,e)})}finally{await this._handleVisibilityChange(),this._debug(`#_initialize()`,`end`)}}async signInAnonymously(e){try{let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/signup`,{headers:this.headers,body:{data:e?.options?.data??{},gotrue_meta_security:{captcha_token:e?.options?.captchaToken}},xform:Y});if(n||!t)return this._returnResult({data:{user:null,session:null},error:n});let r=t.session,i=t.user;return t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers(`SIGNED_IN`,r)),this._returnResult({data:{user:i,session:r},error:null})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signUp(e){let t=null;try{let n;if(`email`in e){let{email:r,password:i,options:a}=e,o=null,s=null;this.flowType===`pkce`&&([o,s,t]=await this._getCodeChallengeAndMethod()),n=await J(this.fetch,`POST`,`${this.url}/signup`,{headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo,t),body:{email:r,password:i,data:a?.data??{},gotrue_meta_security:{captcha_token:a?.captchaToken},code_challenge:o,code_challenge_method:s},xform:Y})}else if(`phone`in e){let{phone:t,password:r,options:i}=e;n=await J(this.fetch,`POST`,`${this.url}/signup`,{headers:this.headers,body:{phone:t,password:r,data:i?.data??{},channel:i?.channel??`sms`,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:Y})}else throw new er(`You must provide either an email or phone number and a password`);let{data:r,error:i}=n;if(i||!r)return await G(this.storage,this.storageKey,t),this._returnResult({data:{user:null,session:null},error:i});let a=r.session,o=r.user;return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers(`SIGNED_IN`,a)),this._returnResult({data:{user:o,session:a},error:null})}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithPassword(e){try{let t;if(`email`in e){let{email:n,password:r,options:i}=e;t=await J(this.fetch,`POST`,`${this.url}/token?grant_type=password`,{headers:this.headers,body:{email:n,password:r,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:ci})}else if(`phone`in e){let{phone:n,password:r,options:i}=e;t=await J(this.fetch,`POST`,`${this.url}/token?grant_type=password`,{headers:this.headers,body:{phone:n,password:r,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:ci})}else throw new er(`You must provide either an email or phone number and a password`);let{data:n,error:r}=t;if(r)return this._returnResult({data:{user:null,session:null},error:r});if(!n||!n.session||!n.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return n.session&&(await this._saveSession(n.session),await this._notifyAllSubscribers(`SIGNED_IN`,n.session)),this._returnResult({data:Object.assign({user:n.user,session:n.session},n.weak_password?{weakPassword:n.weak_password}:null),error:r})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithOAuth(e){return await this._handleProviderSignIn(e.provider,{redirectTo:e.options?.redirectTo,scopes:e.options?.scopes,queryParams:e.options?.queryParams,skipBrowserRedirect:e.options?.skipBrowserRedirect})}async exchangeCodeForSession(e,t){return await this.initializePromise,this.lock==null?this._exchangeCodeForSession(e,t):this._acquireLock(this.lockAcquireTimeout,async()=>this._exchangeCodeForSession(e,t))}async signInWithWeb3(e){let{chain:t}=e;switch(t){case`ethereum`:return await this.signInWithEthereum(e);case`solana`:return await this.signInWithSolana(e);default:throw Error(`@supabase/auth-js: Unsupported chain "${t}"`)}}async signInWithEthereum(e){let t,n;if(`message`in e)t=e.message,n=e.signature;else{let{chain:r,wallet:i,statement:a,options:o}=e,s;if(B())if(typeof i==`object`)s=i;else{let e=window;if(`ethereum`in e&&typeof e.ethereum==`object`&&`request`in e.ethereum&&typeof e.ethereum.request==`function`)s=e.ethereum;else throw Error(`@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.`)}else{if(typeof i!=`object`||!o?.url)throw Error(`@supabase/auth-js: Both wallet and url must be specified in non-browser environments.`);s=i}let c=new URL(o?.url??window.location.href),l=await s.request({method:`eth_requestAccounts`}).then(e=>e).catch(()=>{throw Error(`@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid`)});if(!l||l.length===0)throw Error(`@supabase/auth-js: No accounts available. Please ensure the wallet is connected.`);let u=Ci(l[0]),d=o?.signInWithEthereum?.chainId;d||=wi(await s.request({method:`eth_chainId`})),t=Ei({domain:c.host,address:u,statement:a,uri:c.href,version:`1`,chainId:d,nonce:o?.signInWithEthereum?.nonce,issuedAt:o?.signInWithEthereum?.issuedAt??new Date,expirationTime:o?.signInWithEthereum?.expirationTime,notBefore:o?.signInWithEthereum?.notBefore,requestId:o?.signInWithEthereum?.requestId,resources:o?.signInWithEthereum?.resources}),n=await s.request({method:`personal_sign`,params:[Ti(t),u]})}try{let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=web3`,{headers:this.headers,body:Object.assign({chain:`ethereum`,message:t,signature:n},e.options?.captchaToken?{gotrue_meta_security:{captcha_token:e.options?.captchaToken}}:null),xform:Y});if(i)throw i;if(!r||!r.session||!r.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers(`SIGNED_IN`,r.session)),this._returnResult({data:Object.assign({},r),error:i})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithSolana(e){let t,n;if(`message`in e)t=e.message,n=e.signature;else{let{chain:r,wallet:i,statement:a,options:o}=e,s;if(B())if(typeof i==`object`)s=i;else{let e=window;if(`solana`in e&&typeof e.solana==`object`&&(`signIn`in e.solana&&typeof e.solana.signIn==`function`||`signMessage`in e.solana&&typeof e.solana.signMessage==`function`))s=e.solana;else throw Error(`@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.`)}else{if(typeof i!=`object`||!o?.url)throw Error(`@supabase/auth-js: Both wallet and url must be specified in non-browser environments.`);s=i}let c=new URL(o?.url??window.location.href);if(`signIn`in s&&s.signIn){let e=await s.signIn(Object.assign(Object.assign(Object.assign({issuedAt:new Date().toISOString()},o?.signInWithSolana),{version:`1`,domain:c.host,uri:c.href}),a?{statement:a}:null)),r;if(Array.isArray(e)&&e[0]&&typeof e[0]==`object`)r=e[0];else if(e&&typeof e==`object`&&`signedMessage`in e&&`signature`in e)r=e;else throw Error(`@supabase/auth-js: Wallet method signIn() returned unrecognized value`);if(`signedMessage`in r&&`signature`in r&&(typeof r.signedMessage==`string`||r.signedMessage instanceof Uint8Array)&&r.signature instanceof Uint8Array)t=typeof r.signedMessage==`string`?r.signedMessage:new TextDecoder().decode(r.signedMessage),n=r.signature;else throw Error(`@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields`)}else{if(!(`signMessage`in s)||typeof s.signMessage!=`function`||!(`publicKey`in s)||typeof s!=`object`||!s.publicKey||!(`toBase58`in s.publicKey)||typeof s.publicKey.toBase58!=`function`)throw Error(`@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API`);t=[`${c.host} wants you to sign in with your Solana account:`,s.publicKey.toBase58(),...a?[``,a,``]:[``],`Version: 1`,`URI: ${c.href}`,`Issued At: ${o?.signInWithSolana?.issuedAt??new Date().toISOString()}`,...o?.signInWithSolana?.notBefore?[`Not Before: ${o.signInWithSolana.notBefore}`]:[],...o?.signInWithSolana?.expirationTime?[`Expiration Time: ${o.signInWithSolana.expirationTime}`]:[],...o?.signInWithSolana?.chainId?[`Chain ID: ${o.signInWithSolana.chainId}`]:[],...o?.signInWithSolana?.nonce?[`Nonce: ${o.signInWithSolana.nonce}`]:[],...o?.signInWithSolana?.requestId?[`Request ID: ${o.signInWithSolana.requestId}`]:[],...o?.signInWithSolana?.resources?.length?[`Resources`,...o.signInWithSolana.resources.map(e=>`- ${e}`)]:[]].join(`
`);let e=await s.signMessage(new TextEncoder().encode(t),`utf8`);if(!e||!(e instanceof Uint8Array))throw Error(`@supabase/auth-js: Wallet signMessage() API returned an recognized value`);n=e}}try{let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=web3`,{headers:this.headers,body:Object.assign({chain:`solana`,message:t,signature:z(n)},e.options?.captchaToken?{gotrue_meta_security:{captcha_token:e.options?.captchaToken}}:null),xform:Y});if(i)throw i;if(!r||!r.session||!r.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers(`SIGNED_IN`,r.session)),this._returnResult({data:Object.assign({},r),error:i})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async _exchangeCodeForSession(e,t){let n=t?.flowId!=null,r=n?zr(t?.flowId):B()?zr(Dr(window.location.href)[N]):null;n&&!r&&this._debug(`#_exchangeCodeForSession()`,`provided flowId is not a valid flow id`,t?.flowId);let{verifier:i,flowId:a}=n&&!r?{verifier:null,flowId:null}:await Gr(this.storage,this.storageKey,r),[o,s]=(i??``).split(`/`);try{if(!o&&this.flowType===`pkce`)throw new ir;let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=pkce`,{headers:this.headers,body:{auth_code:e,code_verifier:o},xform:Y});if(await G(this.storage,this.storageKey,a),n)throw n;if(!t||!t.session||!t.user){let e=new R;return this._returnResult({data:{user:null,session:null,redirectType:null},error:e})}return t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers(s===`recovery`?`PASSWORD_RECOVERY`:`SIGNED_IN`,t.session)),this._returnResult({data:Object.assign(Object.assign({},t),{redirectType:s??null}),error:n})}catch(e){if(await G(this.storage,this.storageKey,a),P(e))return this._returnResult({data:{user:null,session:null,redirectType:null},error:e});throw e}}async signInWithIdToken(e){try{let{options:t,provider:n,token:r,access_token:i,nonce:a}=e,{data:o,error:s}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=id_token`,{headers:this.headers,body:{provider:n,id_token:r,access_token:i,nonce:a,gotrue_meta_security:{captcha_token:t?.captchaToken}},xform:Y});if(s)return this._returnResult({data:{user:null,session:null},error:s});if(!o||!o.session||!o.user){let e=new R;return this._returnResult({data:{user:null,session:null},error:e})}return o.session&&(await this._saveSession(o.session),await this._notifyAllSubscribers(`SIGNED_IN`,o.session)),this._returnResult({data:o,error:s})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithOtp(e){let t=null;try{if(`email`in e){let{email:n,options:r}=e,i=null,a=null;this.flowType===`pkce`&&([i,a,t]=await this._getCodeChallengeAndMethod());let{error:o}=await J(this.fetch,`POST`,`${this.url}/otp`,{headers:this.headers,body:{email:n,data:r?.data??{},create_user:r?.shouldCreateUser??!0,gotrue_meta_security:{captcha_token:r?.captchaToken},code_challenge:i,code_challenge_method:a},redirectTo:this._maybeAppendFlowIdToRedirect(r?.emailRedirectTo,t)});return this._returnResult({data:{user:null,session:null},error:o})}if(`phone`in e){let{phone:t,options:n}=e,{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/otp`,{headers:this.headers,body:{phone:t,data:n?.data??{},create_user:n?.shouldCreateUser??!0,gotrue_meta_security:{captcha_token:n?.captchaToken},channel:n?.channel??`sms`}});return this._returnResult({data:{user:null,session:null,messageId:r?.message_id},error:i})}throw new er(`You must provide either an email or phone number.`)}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async verifyOtp(e){try{let t,n;`options`in e&&(t=e.options?.redirectTo,n=e.options?.captchaToken);let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/verify`,{headers:this.headers,body:Object.assign(Object.assign({},e),{gotrue_meta_security:{captcha_token:n}}),redirectTo:t,xform:Y});if(i)throw i;if(!r)throw Error(`An error occurred on token verification.`);let a=r.session,o=r.user;return a?.access_token&&(await this._saveSession(a),await this._notifyAllSubscribers(e.type==`recovery`?`PASSWORD_RECOVERY`:`SIGNED_IN`,a)),this._returnResult({data:{user:o,session:a},error:null})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async signInWithSSO(e){let t=null;try{let n=null,r=null;this.flowType===`pkce`&&([n,r,t]=await this._getCodeChallengeAndMethod());let i=await J(this.fetch,`POST`,`${this.url}/sso`,{body:Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({},`providerId`in e?{provider_id:e.providerId}:null),`domain`in e?{domain:e.domain}:null),{redirect_to:this._maybeAppendFlowIdToRedirect(e.options?.redirectTo,t)}),e?.options?.captchaToken?{gotrue_meta_security:{captcha_token:e.options.captchaToken}}:null),{skip_http_redirect:!0,code_challenge:n,code_challenge_method:r}),headers:this.headers,xform:li});return i.data?.url&&B()&&!e.options?.skipBrowserRedirect&&window.location.assign(i.data.url),this._returnResult(i)}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:null,error:e});throw e}}async reauthenticate(){return await this.initializePromise,this.lock==null?await this._reauthenticate():await this._acquireLock(this.lockAcquireTimeout,async()=>await this._reauthenticate())}async _reauthenticate(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;if(n)throw n;if(!t)throw new L;let{error:r}=await J(this.fetch,`GET`,`${this.url}/reauthenticate`,{headers:this.headers,jwt:t.access_token});return this._returnResult({data:{user:null,session:null},error:r})})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async resend(e){let t=null;try{let n=`${this.url}/resend`;if(`email`in e){let{email:r,type:i,options:a}=e,o=null,s=null;this.flowType===`pkce`&&([o,s,t]=await this._getCodeChallengeAndMethod());let{error:c}=await J(this.fetch,`POST`,n,{headers:this.headers,body:{email:r,type:i,gotrue_meta_security:{captcha_token:a?.captchaToken},code_challenge:o,code_challenge_method:s},redirectTo:this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo,t)});return c&&await G(this.storage,this.storageKey,t),this._returnResult({data:{user:null,session:null},error:c})}else if(`phone`in e){let{phone:t,type:r,options:i}=e,{data:a,error:o}=await J(this.fetch,`POST`,n,{headers:this.headers,body:{phone:t,type:r,gotrue_meta_security:{captcha_token:i?.captchaToken}}});return this._returnResult({data:{user:null,session:null,messageId:a?.message_id},error:o})}throw new er(`You must provide either an email or phone number and a type`)}catch(e){if(await G(this.storage,this.storageKey,t),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async getSession(){return await this.initializePromise,this.lock==null?await this._useSession(async e=>e):await this._acquireLock(this.lockAcquireTimeout,async()=>this._useSession(async e=>e))}async _acquireLock(e,t){this._debug(`#_acquireLock`,`begin`,e);try{if(this.lockAcquired){let e=this.pendingInLock.length?this.pendingInLock[this.pendingInLock.length-1]:Promise.resolve(),n=(async()=>(await e,await t()))();return this.pendingInLock.push((async()=>{try{await n}catch{}})()),n}return await this.lock(`lock:${this.storageKey}`,e,async()=>{this._debug(`#_acquireLock`,`lock acquired for storage key`,this.storageKey);try{this.lockAcquired=!0;let e=t();for(this.pendingInLock.push((async()=>{try{await e}catch{}})()),await e;this.pendingInLock.length;){let e=[...this.pendingInLock];await Promise.all(e),this.pendingInLock.splice(0,e.length)}return await e}finally{this._debug(`#_acquireLock`,`lock released for storage key`,this.storageKey),this.lockAcquired=!1}})}finally{this._debug(`#_acquireLock`,`end`)}}async _useSession(e){this._debug(`#_useSession`,`begin`);try{return await e(await this.__loadSession())}finally{this._debug(`#_useSession`,`end`)}}async __loadSession(){this._debug(`#__loadSession()`,`begin`),this.lock!=null&&!this.lockAcquired&&this._debug(`#__loadSession()`,`used outside of an acquired lock!`,Error().stack);try{let e=null,t=await U(this.storage,this.storageKey);if(this._debug(`#getSession()`,`session from storage`,t),t!==null&&(this._isValidSession(t)?e=t:(this._debug(`#getSession()`,`session from storage is not valid`),await this._removeSession())),!e)return{data:{session:null},error:null};let n=e.expires_at?e.expires_at*1e3-Date.now()<Gn:!1;if(this._debug(`#__loadSession()`,`session has${n?``:` not`} expired`,`expires_at`,e.expires_at),!n)return{data:{session:await this._hydrateSessionUser(e)},error:null};let{data:r,error:i}=await this._callRefreshToken(e.refresh_token);if(i){let e=await U(this.storage,this.storageKey);return e&&this._isValidSession(e)&&e.expires_at&&e.expires_at*1e3>Date.now()?this._returnResult({data:{session:await this._hydrateSessionUser(e)},error:null}):this._returnResult({data:{session:null},error:i})}return this._returnResult({data:{session:r},error:null})}finally{this._debug(`#__loadSession()`,`end`)}}async _hydrateSessionUser(e){if(this.userStorage){let t=await U(this.userStorage,this.storageKey+`-user`);e.user=t?.user?t.user:ti()}if(this.storage.isServer&&e.user&&!e.user.__isUserNotAvailableProxy){let t={value:this.suppressGetSessionWarning};e.user=ni(e.user,t),t.value&&(this.suppressGetSessionWarning=!0)}return e}async getUser(e){if(e)return await this._getUser(e);await this.initializePromise;let t;return t=this.lock==null?await this._getUser():await this._acquireLock(this.lockAcquireTimeout,async()=>await this._getUser()),t.data.user&&(this.suppressGetSessionWarning=!0),t}async _getUser(e){try{return e?await J(this.fetch,`GET`,`${this.url}/user`,{headers:this.headers,jwt:e,xform:X}):await this._useSession(async e=>{let{data:t,error:n}=e;if(n)throw n;return!t.session?.access_token&&!this.hasCustomAuthorizationHeader?{data:{user:null},error:new L}:await J(this.fetch,`GET`,`${this.url}/user`,{headers:this.headers,jwt:t.session?.access_token??void 0,xform:X})})}catch(e){if(P(e))return $n(e)&&await this._removeSession(),this._returnResult({data:{user:null},error:e});throw e}}async updateUser(e,t={}){return await this.initializePromise,this.lock==null?await this._updateUser(e,t):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._updateUser(e,t))}async _updateUser(e,t={}){let n=null;try{return await this._useSession(async r=>{let{data:i,error:a}=r;if(a)throw a;if(!i.session)throw new L;let o=i.session,s=null,c=null;this.flowType===`pkce`&&e.email!=null&&([s,c,n]=await this._getCodeChallengeAndMethod());let{data:l,error:u}=await J(this.fetch,`PUT`,`${this.url}/user`,{headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(t?.emailRedirectTo,n),body:Object.assign(Object.assign({},e),{code_challenge:s,code_challenge_method:c}),jwt:o.access_token,xform:X});if(u)throw u;return o.user=l.user,await this._saveSession(o),await this._notifyAllSubscribers(`USER_UPDATED`,o),this._returnResult({data:{user:o.user},error:null})})}catch(e){if(await G(this.storage,this.storageKey,n),P(e))return this._returnResult({data:{user:null},error:e});throw e}}async setSession(e){return await this.initializePromise,this.lock==null?await this._setSession(e):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._setSession(e))}async _setSession(e){try{if(!e.access_token||!e.refresh_token)throw new L;let t=Date.now()/1e3,n=t,r=!0,i=null,{payload:a}=jr(e.access_token);if(a.exp&&(n=a.exp,r=n<=t),r){let{data:t,error:n}=await this._callRefreshToken(e.refresh_token);if(n)return this._returnResult({data:{user:null,session:null},error:n});if(!t)return{data:{user:null,session:null},error:null};i=t}else{let{data:r,error:a}=await this._getUser(e.access_token);if(a)return this._returnResult({data:{user:null,session:null},error:a});i={access_token:e.access_token,refresh_token:e.refresh_token,user:r.user,token_type:`bearer`,expires_in:n-t,expires_at:n},await this._saveSession(i),await this._notifyAllSubscribers(`SIGNED_IN`,i)}return this._returnResult({data:{user:i.user,session:i},error:null})}catch(e){if(P(e))return this._returnResult({data:{session:null,user:null},error:e});throw e}}async refreshSession(e){return await this.initializePromise,this.lock==null?await this._refreshSession(e):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._refreshSession(e))}async _refreshSession(e){try{return await this._useSession(async t=>{if(!e){let{data:n,error:r}=t;if(r)throw r;e=n.session??void 0}if(!e?.refresh_token)throw new L;let{data:n,error:r}=await this._callRefreshToken(e.refresh_token);return r?this._returnResult({data:{user:null,session:null},error:r}):n?this._returnResult({data:{user:n.user,session:n},error:null}):this._returnResult({data:{user:null,session:null},error:null})})}catch(e){if(P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async _getSessionFromURL(e,t){try{if(!B())throw new tr(`No browser detected.`);if(e.error||e.error_description||e.error_code)throw new tr(e.error_description||`Error in URL with unspecified error_description`,{error:e.error||`unspecified_error`,code:e.error_code||`unspecified_code`});switch(t){case`implicit`:if(this.flowType===`pkce`)throw new rr(`Not a valid PKCE flow url.`);break;case`pkce`:if(this.flowType===`implicit`)throw new tr(`Not a valid implicit grant flow url.`);break;default:}if(t===`pkce`){if(this._debug(`#_initialize()`,`begin`,`is PKCE flow`,!0),!e.code)throw new rr(`No code detected.`);let{data:t,error:n}=await this._exchangeCodeForSession(e.code,{flowId:e[N]});if(n)throw n;let r=new URL(window.location.href);return r.searchParams.delete(`code`),r.searchParams.delete(N),window.history.replaceState(window.history.state,``,r.toString()),{data:{session:t.session,redirectType:t.redirectType??null},error:null}}let{provider_token:n,provider_refresh_token:r,access_token:i,refresh_token:a,expires_in:o,expires_at:s,token_type:c}=e;if(!i||!o||!a||!c)throw new tr(`No session defined in URL`);let l=Math.round(Date.now()/1e3),u=parseInt(o),d=l+u;s&&(d=parseInt(s));let f=d-l;f*1e3<=M&&console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${f}s, should have been closer to ${u}s`);let p=d-u;l-p>=120?console.warn(`@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale`,p,d,l):l-p<0&&console.warn(`@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew`,p,d,l);let{data:m,error:h}=await this._getUser(i);if(h)throw h;let g={provider_token:n,provider_refresh_token:r,access_token:i,expires_in:u,expires_at:d,refresh_token:a,token_type:c,user:m.user};return window.location.hash=``,this._debug(`#_getSessionFromURL()`,`clearing window.location.hash`),this._returnResult({data:{session:g,redirectType:e.type},error:null})}catch(e){if(P(e))return this._returnResult({data:{session:null,redirectType:null},error:e});throw e}}_isImplicitGrantCallback(e){return typeof this.detectSessionInUrl==`function`?this.detectSessionInUrl(new URL(window.location.href),e):!!(e.access_token||e.error||e.error_description||e.error_code)}async _isPKCECallback(e){if(!e.code)return!1;let t=zr(e[N]);return t&&await U(this.storage,Vr(this.storageKey,t))?!0:!!await U(this.storage,`${this.storageKey}-code-verifier`)}async signOut(e={scope:`global`}){return await this.initializePromise,this.lock==null?await this._signOut(e):await this._acquireLock(this.lockAcquireTimeout,async()=>await this._signOut(e))}async _signOut({scope:e}={scope:`global`}){return await this._useSession(async t=>{let n=async()=>{await this._removeSession()},{data:r,error:i}=t;if(i&&!$n(i))return this._returnResult({error:i});let a=r.session?.access_token;if(a){let{error:t}=await this.admin.signOut(a,e);if(t&&!(Qn(t)&&(t.status===404||t.status===401||t.status===403)||$n(t)))return e!==`others`&&await n(),this._returnResult({error:t})}return e!==`others`&&await n(),this._returnResult({error:null})})}onAuthStateChange(e){let t=Tr(),n={id:t,callback:e,unsubscribe:()=>{this._debug(`#unsubscribe()`,`state change callback with id removed`,t),this.stateChangeEmitters.delete(t)}};return this._debug(`#onAuthStateChange()`,`registered callback with id`,t),this.stateChangeEmitters.set(t,n),(async()=>{await this.initializePromise,this.lock==null?await this._emitInitialSession(t):await this._acquireLock(this.lockAcquireTimeout,async()=>{this._emitInitialSession(t)})})(),{data:{subscription:n}}}async _emitInitialSession(e){return await this._useSession(async t=>{try{let{data:{session:n},error:r}=t;if(r)throw r;await this.stateChangeEmitters.get(e)?.callback(`INITIAL_SESSION`,n),this._debug(`INITIAL_SESSION`,`callback id`,e,`session`,n)}catch(t){if(await this.stateChangeEmitters.get(e)?.callback(`INITIAL_SESSION`,null),this._debug(`INITIAL_SESSION`,`callback id`,e,`error`,t),lr(t))return;$n(t)||sr(t)||Qn(t)&&(t.code===`refresh_token_not_found`||t.code===`refresh_token_already_used`||t.code===`session_expired`)?console.warn(t):console.error(t)}})}async resetPasswordForEmail(e,t={}){let n=null,r=null,i=null;this.flowType===`pkce`&&([n,r,i]=await this._getCodeChallengeAndMethod(!0));try{return await J(this.fetch,`POST`,`${this.url}/recover`,{body:{email:e,code_challenge:n,code_challenge_method:r,gotrue_meta_security:{captcha_token:t.captchaToken}},headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(t.redirectTo,i)})}catch(e){if(await G(this.storage,this.storageKey,i),P(e))return this._returnResult({data:null,error:e});throw e}}async getUserIdentities(){try{let{data:e,error:t}=await this.getUser();if(t)throw t;return this._returnResult({data:{identities:e.user.identities??[]},error:null})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async linkIdentity(e){return`token`in e?this.linkIdentityIdToken(e):this.linkIdentityOAuth(e)}async linkIdentityOAuth(e){let t=null;try{let{data:n,error:r}=await this._useSession(async n=>{let{data:r,error:i}=n;if(i)throw i;let{url:a,flowId:o}=await this._getUrlForProvider(`${this.url}/user/identities/authorize`,e.provider,{redirectTo:e.options?.redirectTo,scopes:e.options?.scopes,queryParams:e.options?.queryParams,skipBrowserRedirect:!0});return t=o,await J(this.fetch,`GET`,a,{headers:this.headers,jwt:r.session?.access_token??void 0})});if(r)throw r;return B()&&!e.options?.skipBrowserRedirect&&window.location.assign(n?.url),this._returnResult({data:{provider:e.provider,url:n?.url,flowId:t},error:null})}catch(n){if(P(n))return this._returnResult({data:{provider:e.provider,url:null,flowId:t},error:n});throw n}}async linkIdentityIdToken(e){return await this._useSession(async t=>{try{let{error:n,data:{session:r}}=t;if(n)throw n;let{options:i,provider:a,token:o,access_token:s,nonce:c}=e,{data:l,error:u}=await J(this.fetch,`POST`,`${this.url}/token?grant_type=id_token`,{headers:this.headers,jwt:r?.access_token??void 0,body:{provider:a,id_token:o,access_token:s,nonce:c,link_identity:!0,gotrue_meta_security:{captcha_token:i?.captchaToken}},xform:Y});return u?this._returnResult({data:{user:null,session:null},error:u}):!l||!l.session||!l.user?this._returnResult({data:{user:null,session:null},error:new R}):(l.session&&(await this._saveSession(l.session),await this._notifyAllSubscribers(`USER_UPDATED`,l.session)),this._returnResult({data:l,error:u}))}catch(e){if(await G(this.storage,this.storageKey,null),P(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}})}async unlinkIdentity(e){try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)throw r;return await J(this.fetch,`DELETE`,`${this.url}/user/identities/${e.identity_id}`,{headers:this.headers,jwt:n.session?.access_token??void 0})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _refreshAccessToken(e){let t=`#_refreshAccessToken()`;this._debug(t,`begin`);try{let n=Date.now();return await Nr(async n=>(n>0&&await Mr(200*2**(n-1)),this._debug(t,`refreshing attempt`,n),await J(this.fetch,`POST`,`${this.url}/token?grant_type=refresh_token`,{body:{refresh_token:e},headers:this.headers,xform:Y})),(e,t)=>{let r=200*2**e;return t&&sr(t)&&Date.now()+r-n<M})}catch(e){if(this._debug(t,`error`,e),P(e))return this._returnResult({data:{session:null,user:null},error:e});throw e}finally{this._debug(t,`end`)}}_isValidSession(e){return typeof e==`object`&&!!e&&`access_token`in e&&`refresh_token`in e&&`expires_at`in e}async _handleProviderSignIn(e,t){let{url:n,flowId:r}=await this._getUrlForProvider(`${this.url}/authorize`,e,{redirectTo:t.redirectTo,scopes:t.scopes,queryParams:t.queryParams});return this._debug(`#_handleProviderSignIn()`,`provider`,e,`options`,t,`url`,n),B()&&!t.skipBrowserRedirect&&window.location.assign(n),{data:{provider:e,url:n,flowId:r},error:null}}async _recoverAndRefresh(){let e=`#_recoverAndRefresh()`;this._debug(e,`begin`);try{let t=await U(this.storage,this.storageKey);if(t&&this.userStorage){let e=await U(this.userStorage,this.storageKey+`-user`);!this.storage.isServer&&Object.is(this.storage,this.userStorage)&&!e&&(e={user:t.user},await H(this.userStorage,this.storageKey+`-user`,e)),t.user=e?.user??ti()}else if(t&&!t.user&&!t.user){let e=await U(this.storage,this.storageKey+`-user`);e&&e?.user?(t.user=e.user,await W(this.storage,this.storageKey+`-user`),await H(this.storage,this.storageKey,t)):t.user=ti()}if(this._debug(e,`session from storage`,t),!this._isValidSession(t)){this._debug(e,`session is not valid`),t!==null&&await this._removeSession();return}let n=(t.expires_at??1/0)*1e3-Date.now()<Gn;if(this._debug(e,`session has${n?``:` not`} expired with margin of ${Gn}s`),n){if(this.autoRefreshToken&&t.refresh_token){let{error:n}=await this._callRefreshToken(t.refresh_token);n&&(lr(n)?this._debug(e,`refresh discarded by commit guard`,n):this._debug(e,`refresh failed`,n))}}else if(t.user&&t.user.__isUserNotAvailableProxy===!0)try{let{data:n,error:r}=await this._getUser(t.access_token);!r&&n?.user?(t.user=n.user,await this._saveSession(t),await this._notifyAllSubscribers(`SIGNED_IN`,t)):this._debug(e,`could not get user data, skipping SIGNED_IN notification`)}catch(t){console.error(`Error getting user data:`,t),this._debug(e,`error getting user data, skipping SIGNED_IN notification`,t)}else await this._notifyAllSubscribers(`SIGNED_IN`,t)}catch(t){this._debug(e,`error`,t),sr(t)?console.warn(t):console.error(t);return}finally{this._debug(e,`end`)}}async _callRefreshToken(e){var t,n;if(!e)throw new L;if(this.refreshingDeferred)return this.refreshingDeferred.promise;if(this.lastRefreshFailure&&this.lastRefreshFailure.refreshToken===e&&Date.now()<this.lastRefreshFailure.expiresAt)return this._debug(`#_callRefreshToken()`,`returning cached failure (cooldown active)`),this.lastRefreshFailure.result;let r=`#_callRefreshToken()`;this._debug(r,`begin`);try{this.refreshingDeferred=new Ar,this.refreshingDeferred.promise.then(void 0,()=>{});let t=await U(this.storage,this.storageKey),{data:n,error:i}=await this._refreshAccessToken(e);if(i)throw i;if(!n.session)throw new L;let a=await U(this.storage,this.storageKey);if(t!==null&&(a===null||a.refresh_token!==t.refresh_token)){this._debug(r,`commit guard: storage changed since refresh started, discarding rotated tokens`,{startedWith:`present`,nowHolds:a?`replaced`:`cleared`});let e={data:null,error:new cr};return this.refreshingDeferred.resolve(e),e}let o=this._sessionRemovalEpoch;if(await this._saveSession(n.session),this._sessionRemovalEpoch!==o){this._debug(r,`commit guard (post-save): _removeSession ran during _saveSession, undoing write`),await W(this.storage,this.storageKey),this.userStorage&&await W(this.userStorage,this.storageKey+`-user`);let e={data:null,error:new cr};return this.refreshingDeferred.resolve(e),e}await this._notifyAllSubscribers(`TOKEN_REFRESHED`,n.session);let s={data:n.session,error:null};return this.lastRefreshFailure=null,this.refreshingDeferred.resolve(s),s}catch(i){if(this._debug(r,`error`,i),P(i)){let n={data:null,error:i};if(!sr(i)){let e=await U(this.storage,this.storageKey);e?.expires_at&&e.expires_at*1e3>Date.now()?this._debug(r,`proactive refresh failed, access token still valid — preserving session`):await this._removeSession()}return this.lastRefreshFailure={refreshToken:e,result:n,expiresAt:Date.now()+6e4},(t=this.refreshingDeferred)==null||t.resolve(n),n}throw(n=this.refreshingDeferred)==null||n.reject(i),i}finally{this.refreshingDeferred=null,this._debug(r,`end`)}}async _notifyAllSubscribers(e,t,n=!0){if(this._pendingInitNotifications!==null&&n){this._pendingInitNotifications.push({event:e,session:t,broadcast:n});return}let r=`#_notifyAllSubscribers(${e})`;this._debug(r,`begin`,t,`broadcast = ${n}`);try{this.broadcastChannel&&n&&this.broadcastChannel.postMessage({event:e,session:t});let r=[],i=Array.from(this.stateChangeEmitters.values()).map(async n=>{try{await n.callback(e,t)}catch(e){r.push(e)}});if(await Promise.all(i),r.length>0){for(let e=0;e<r.length;e+=1)console.error(r[e]);throw r[0]}}finally{this._debug(r,`end`)}}async _saveSession(e){this._debug(`#_saveSession()`,e),this.suppressGetSessionWarning=!0;let t=Object.assign({},e),n=t.user&&t.user.__isUserNotAvailableProxy===!0;if(this.userStorage){!n&&t.user&&await H(this.userStorage,this.storageKey+`-user`,{user:t.user});let e=Object.assign({},t);delete e.user;let r=ri(e);await H(this.storage,this.storageKey,r)}else{let e=ri(t);await H(this.storage,this.storageKey,e)}}async _removeSession(){this._sessionRemovalEpoch+=1,this._debug(`#_removeSession()`),this.lastRefreshFailure=null,this.suppressGetSessionWarning=!1,await W(this.storage,this.storageKey),await Kr(this.storage,this.storageKey),await W(this.storage,this.storageKey+`-user`),this.userStorage&&await W(this.userStorage,this.storageKey+`-user`),await this._notifyAllSubscribers(`SIGNED_OUT`,null)}_removeVisibilityChangedCallback(){this._debug(`#_removeVisibilityChangedCallback()`);let e=this.visibilityChangedCallback;this.visibilityChangedCallback=null;try{e&&B()&&window!=null&&window.removeEventListener&&window.removeEventListener(`visibilitychange`,e)}catch(e){console.error(`removing visibilitychange callback failed`,e)}}async _startAutoRefresh(){await this._stopAutoRefresh(),this._debug(`#_startAutoRefresh()`);let e=setInterval(()=>this._autoRefreshTokenTick(),M);this.autoRefreshTicker=e,e&&typeof e==`object`&&typeof e.unref==`function`?e.unref():typeof Deno<`u`&&typeof Deno.unrefTimer==`function`&&Deno.unrefTimer(e);let t=setTimeout(async()=>{await this.initializePromise,await this._autoRefreshTokenTick()},0);this.autoRefreshTickTimeout=t,t&&typeof t==`object`&&typeof t.unref==`function`?t.unref():typeof Deno<`u`&&typeof Deno.unrefTimer==`function`&&Deno.unrefTimer(t)}async _stopAutoRefresh(){this._debug(`#_stopAutoRefresh()`);let e=this.autoRefreshTicker;this.autoRefreshTicker=null,e&&clearInterval(e);let t=this.autoRefreshTickTimeout;this.autoRefreshTickTimeout=null,t&&clearTimeout(t)}async startAutoRefresh(){this._removeVisibilityChangedCallback(),await this._startAutoRefresh()}async stopAutoRefresh(){this._removeVisibilityChangedCallback(),await this._stopAutoRefresh()}async dispose(){var e;this._removeVisibilityChangedCallback(),await this._stopAutoRefresh(),(e=this.broadcastChannel)==null||e.close(),this.broadcastChannel=null,this.stateChangeEmitters.clear()}async _autoRefreshTokenTick(){if(this._debug(`#_autoRefreshTokenTick()`,`begin`),this.lock!=null){try{await this._acquireLock(0,async()=>{try{let e=Date.now();try{return await this._useSession(async t=>{let{data:{session:n}}=t;if(!n||!n.refresh_token||!n.expires_at){this._debug(`#_autoRefreshTokenTick()`,`no session`);return}let r=Math.floor((n.expires_at*1e3-e)/M);this._debug(`#_autoRefreshTokenTick()`,`access token expires in ${r} ticks, a tick lasts ${M}ms, refresh threshold is 3 ticks`),r<=3&&await this._callRefreshToken(n.refresh_token)})}catch(e){console.error(`Auto refresh tick failed with error. This is likely a transient error.`,e)}}finally{this._debug(`#_autoRefreshTokenTick()`,`end`)}})}catch(e){if(e instanceof gi)this._debug(`auto refresh token tick lock not available`);else throw e}return}if(this.refreshingDeferred!==null){this._debug(`#_autoRefreshTokenTick()`,`refresh already in flight, skipping`);return}try{let e=Date.now();try{await this._useSession(async t=>{let{data:{session:n}}=t;if(!n||!n.refresh_token||!n.expires_at){this._debug(`#_autoRefreshTokenTick()`,`no session`);return}let r=Math.floor((n.expires_at*1e3-e)/M);this._debug(`#_autoRefreshTokenTick()`,`access token expires in ${r} ticks, a tick lasts ${M}ms, refresh threshold is 3 ticks`),r<=3&&await this._callRefreshToken(n.refresh_token)})}catch(e){console.error(`Auto refresh tick failed with error. This is likely a transient error.`,e)}}finally{this._debug(`#_autoRefreshTokenTick()`,`end`)}}async _handleVisibilityChange(){if(this._debug(`#_handleVisibilityChange()`),!B()||!(window!=null&&window.addEventListener))return this.autoRefreshToken&&this.startAutoRefresh(),!1;try{this.visibilityChangedCallback=async()=>{try{await this._onVisibilityChanged(!1)}catch(e){this._debug(`#visibilityChangedCallback`,`error`,e)}},window==null||window.addEventListener(`visibilitychange`,this.visibilityChangedCallback),await this._onVisibilityChanged(!0)}catch(e){console.error(`_handleVisibilityChange`,e)}}async _onVisibilityChanged(e){let t=`#_onVisibilityChanged(${e})`;if(this._debug(t,`visibilityState`,document.visibilityState),document.visibilityState===`visible`){if(this.autoRefreshToken&&this._startAutoRefresh(),!e)if(await this.initializePromise,this.lock!=null)await this._acquireLock(this.lockAcquireTimeout,async()=>{if(document.visibilityState!==`visible`){this._debug(t,`acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting`);return}await this._recoverAndRefresh()});else{if(document.visibilityState!==`visible`){this._debug(t,`visibilityState is no longer visible, skipping recovery`);return}await this._recoverAndRefresh()}}else document.visibilityState===`hidden`&&this.autoRefreshToken&&this._stopAutoRefresh()}async _getUrlForProvider(e,t,n){let r=n?.redirectTo,i=null,a=null,o=null;this.flowType===`pkce`&&([i,a,o]=await this._getCodeChallengeAndMethod(),r=this._maybeAppendFlowIdToRedirect(r,o));let s=[`provider=${encodeURIComponent(t)}`];if(r&&s.push(`redirect_to=${encodeURIComponent(r)}`),n?.scopes&&s.push(`scopes=${encodeURIComponent(n.scopes)}`),i!=null&&a!=null){let e=new URLSearchParams({code_challenge:`${encodeURIComponent(i)}`,code_challenge_method:`${encodeURIComponent(a)}`});s.push(e.toString())}if(n?.queryParams){let e=new URLSearchParams(n.queryParams);s.push(e.toString())}return n?.skipBrowserRedirect&&s.push(`skip_http_redirect=${n.skipBrowserRedirect}`),{url:`${e}?${s.join(`&`)}`,flowId:o}}_maybeAppendFlowIdToRedirect(e,t){return!e||!t||!this.experimental.appendPkceFlowIdToRedirects?e??void 0:qr(e,t)}async _getCodeChallengeAndMethod(e=!1){return Jr(this.storage,this.storageKey,e,e=>this._debug(`#_getCodeChallengeAndMethod()`,`evicted oldest pending PKCE verifier slot`,e))}async _unenroll(e){try{return await this._useSession(async t=>{let{data:n,error:r}=t;return r?this._returnResult({data:null,error:r}):await J(this.fetch,`DELETE`,`${this.url}/factors/${e.factorId}`,{headers:this.headers,jwt:n?.session?.access_token})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _enroll(e){try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let i=Object.assign({friendly_name:e.friendlyName,factor_type:e.factorType},e.factorType===`phone`?{phone:e.phone}:e.factorType===`totp`?{issuer:e.issuer}:{}),{data:a,error:o}=await J(this.fetch,`POST`,`${this.url}/factors`,{body:i,headers:this.headers,jwt:n?.session?.access_token});return o?this._returnResult({data:null,error:o}):(e.factorType===`totp`&&a.type===`totp`&&a?.totp?.qr_code&&(a.totp.qr_code=`data:image/svg+xml;utf-8,${a.totp.qr_code}`),this._returnResult({data:a,error:null}))})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verify(e){let t=async()=>{try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let i=Object.assign({challenge_id:e.challengeId},`webauthn`in e?{webauthn:Object.assign(Object.assign({},e.webauthn),{credential_response:e.webauthn.type===`create`?Ni(e.webauthn.credential_response):Pi(e.webauthn.credential_response)})}:{code:e.code}),{data:a,error:o}=await J(this.fetch,`POST`,`${this.url}/factors/${e.factorId}/verify`,{body:i,headers:this.headers,jwt:n?.session?.access_token});return o?this._returnResult({data:null,error:o}):(await this._saveSession(Object.assign({expires_at:Math.round(Date.now()/1e3)+a.expires_in},a)),await this._notifyAllSubscribers(`MFA_CHALLENGE_VERIFIED`,a),this._returnResult({data:a,error:o}))})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}};return this.lock==null?t():this._acquireLock(this.lockAcquireTimeout,t)}async _challenge(e){let t=async()=>{try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let i=await J(this.fetch,`POST`,`${this.url}/factors/${e.factorId}/challenge`,{body:e,headers:this.headers,jwt:n?.session?.access_token});if(i.error)return i;let{data:a}=i;if(a.type!==`webauthn`)return{data:a,error:null};switch(a.webauthn.type){case`create`:return{data:Object.assign(Object.assign({},a),{webauthn:Object.assign(Object.assign({},a.webauthn),{credential_options:Object.assign(Object.assign({},a.webauthn.credential_options),{publicKey:ji(a.webauthn.credential_options.publicKey)})})}),error:null};case`request`:return{data:Object.assign(Object.assign({},a),{webauthn:Object.assign(Object.assign({},a.webauthn),{credential_options:Object.assign(Object.assign({},a.webauthn.credential_options),{publicKey:Mi(a.webauthn.credential_options.publicKey)})})}),error:null}}})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}};return this.lock==null?t():this._acquireLock(this.lockAcquireTimeout,t)}async _challengeAndVerify(e){let{data:t,error:n}=await this._challenge({factorId:e.factorId});return n?this._returnResult({data:null,error:n}):await this._verify({factorId:e.factorId,challengeId:t.id,code:e.code})}async _listFactors(){let{data:{user:e},error:t}=await this.getUser();if(t)return{data:null,error:t};let n={all:[],phone:[],totp:[],webauthn:[],recovery_code:[]};for(let t of e?.factors??[])n.all.push(t),t.status===`verified`&&t.factor_type in n&&Array.isArray(n[t.factor_type])&&n[t.factor_type].push(t);return{data:n,error:null}}async _getAuthenticatorAssuranceLevel(e){if(e)try{let{payload:t}=jr(e),n=null;t.aal&&(n=t.aal);let r=n,{data:{user:i},error:a}=await this.getUser(e);if(a)return this._returnResult({data:null,error:a});((i?.factors)?.filter(e=>e.status===`verified`)??[]).length>0&&(r=`aal2`);let o=t.amr||[];return{data:{currentLevel:n,nextLevel:r,currentAuthenticationMethods:o},error:null}}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}let{data:{session:t},error:n}=await this.getSession();if(n)return this._returnResult({data:null,error:n});if(!t)return{data:{currentLevel:null,nextLevel:null,currentAuthenticationMethods:[]},error:null};let{payload:r}=jr(t.access_token),i=null;r.aal&&(i=r.aal);let a=i;(t.user.factors?.filter(e=>e.status===`verified`)??[]).length>0&&(a=`aal2`);let o=r.amr||[];return{data:{currentLevel:i,nextLevel:a,currentAuthenticationMethods:o},error:null}}async _getRecoveryCodesStatus(){ei(this.experimental);try{return await this._useSession(async e=>{let{data:t,error:n}=e;if(n)return this._returnResult({data:null,error:n});let{data:r,error:i}=await J(this.fetch,`GET`,`${this.url}/factors/recovery-codes`,{headers:this.headers,jwt:t?.session?.access_token});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _generateRecoveryCodes(e){ei(this.experimental);try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let{data:i,error:a}=await J(this.fetch,`POST`,`${this.url}/factors/recovery-codes`,{body:e?.friendlyName?{friendly_name:e.friendlyName}:void 0,headers:this.headers,jwt:n?.session?.access_token});return a?this._returnResult({data:null,error:a}):this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verifyRecoveryCode(e){ei(this.experimental);let t=async()=>{try{return await this._useSession(async t=>{let{data:n,error:r}=t;if(r)return this._returnResult({data:null,error:r});let{data:i,error:a}=await J(this.fetch,`POST`,`${this.url}/factors/recovery-codes/verify`,{body:{code:e.code},headers:this.headers,jwt:n?.session?.access_token});if(a)return this._returnResult({data:null,error:a});let o=Object.assign({expires_at:wr(i.expires_in)},i);return await this._saveSession(o),await this._notifyAllSubscribers(`MFA_CHALLENGE_VERIFIED`,o),this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}};return this.lock==null?t():this._acquireLock(this.lockAcquireTimeout,t)}async _regenerateRecoveryCodes(){ei(this.experimental);try{return await this._useSession(async e=>{let{data:t,error:n}=e;if(n)return this._returnResult({data:null,error:n});let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/factors/recovery-codes/regenerate`,{headers:this.headers,jwt:t?.session?.access_token});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _unenrollRecoveryCodes(){ei(this.experimental);try{return await this._useSession(async e=>{let{data:t,error:n}=e;if(n)return this._returnResult({data:null,error:n});let{data:r,error:i}=await J(this.fetch,`DELETE`,`${this.url}/factors/recovery-codes`,{headers:this.headers,jwt:t?.session?.access_token});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _getAuthorizationDetails(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;return r?this._returnResult({data:null,error:r}):n?await J(this.fetch,`GET`,`${this.url}/oauth/authorizations/${e}`,{headers:this.headers,jwt:n.access_token,xform:e=>({data:e,error:null})}):this._returnResult({data:null,error:new L})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _approveAuthorization(e,t){try{return await this._useSession(async n=>{let{data:{session:r},error:i}=n;if(i)return this._returnResult({data:null,error:i});if(!r)return this._returnResult({data:null,error:new L});let a=await J(this.fetch,`POST`,`${this.url}/oauth/authorizations/${e}/consent`,{headers:this.headers,jwt:r.access_token,body:{action:`approve`},xform:e=>({data:e,error:null})});return a.data&&a.data.redirect_url&&B()&&!t?.skipBrowserRedirect&&window.location.assign(a.data.redirect_url),a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _denyAuthorization(e,t){try{return await this._useSession(async n=>{let{data:{session:r},error:i}=n;if(i)return this._returnResult({data:null,error:i});if(!r)return this._returnResult({data:null,error:new L});let a=await J(this.fetch,`POST`,`${this.url}/oauth/authorizations/${e}/consent`,{headers:this.headers,jwt:r.access_token,body:{action:`deny`},xform:e=>({data:e,error:null})});return a.data&&a.data.redirect_url&&B()&&!t?.skipBrowserRedirect&&window.location.assign(a.data.redirect_url),a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _listOAuthGrants(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;return n?this._returnResult({data:null,error:n}):t?await J(this.fetch,`GET`,`${this.url}/user/oauth/grants`,{headers:this.headers,jwt:t.access_token,xform:e=>({data:e,error:null})}):this._returnResult({data:null,error:new L})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _revokeOAuthGrant(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;return r?this._returnResult({data:null,error:r}):n?(await J(this.fetch,`DELETE`,`${this.url}/user/oauth/grants`,{headers:this.headers,jwt:n.access_token,query:{client_id:e.clientId},noResolveJson:!0}),{data:{},error:null}):this._returnResult({data:null,error:new L})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async fetchJwk(e,t={keys:[]}){let n=t.keys.find(t=>t.kid===e);if(n)return n;let r=Date.now();if(n=this.jwks.keys.find(t=>t.kid===e),n&&this.jwks_cached_at+6e5>r)return n;let{data:i,error:a}=await J(this.fetch,`GET`,`${this.url}/.well-known/jwks.json`,{headers:this.headers});if(a)throw a;return!i.keys||i.keys.length===0||(this.jwks=i,this.jwks_cached_at=r,n=i.keys.find(t=>t.kid===e),!n)?null:n}async getClaims(e,t={}){try{let n=e;if(!n){let{data:e,error:t}=await this.getSession();if(t||!e.session)return this._returnResult({data:null,error:t});n=e.session.access_token}let{header:r,payload:i,signature:a,raw:{header:o,payload:s}}=jr(n);if(!t?.allowExpired)try{Zr(i.exp)}catch(e){throw new fr(e instanceof Error?e.message:`JWT validation failed`)}let c=!r.alg||r.alg.startsWith(`HS`)||!r.kid||!(`crypto`in globalThis&&`subtle`in globalThis.crypto)?null:await this.fetchJwk(r.kid,t?.keys?{keys:t.keys}:t?.jwks);if(!c){let{error:e}=await this.getUser(n);if(e)throw e;return{data:{claims:i,header:r,signature:a},error:null}}let l=Qr(r.alg),u=await crypto.subtle.importKey(`jwk`,c,l,!0,[`verify`]);if(!await crypto.subtle.verify(l,u,a,Cr(`${o}.${s}`)))throw new fr(`Invalid JWT signature`);return{data:{claims:i,header:r,signature:a},error:null}}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async signInWithPasskey(e){try{if(!Ii())return this._returnResult({data:null,error:new F(`Browser does not support WebAuthn`,null)});let{data:t,error:n}=await this._startPasskeyAuthentication({options:{captchaToken:e?.options?.captchaToken}});if(n||!t)return this._returnResult({data:null,error:n});let{data:r,error:i}=await Ri({publicKey:Mi(t.options),signal:e?.options?.signal??Ai.createNewAbortSignal(),mediation:e?.options?.mediation});if(i||!r)return this._returnResult({data:null,error:i??new F(`WebAuthn ceremony failed`,null)});let a=Pi(r);return this._verifyPasskeyAuthentication({challengeId:t.challenge_id,credential:a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async registerPasskey(e){try{if(!Ii())return this._returnResult({data:null,error:new F(`Browser does not support WebAuthn`,null)});let{data:t,error:n}=await this._startPasskeyRegistration();if(n||!t)return this._returnResult({data:null,error:n});let{data:r,error:i}=await Li({publicKey:ji(t.options),signal:e?.options?.signal??Ai.createNewAbortSignal()});if(i||!r)return this._returnResult({data:null,error:i??new F(`WebAuthn ceremony failed`,null)});let a=Ni(r);return this._verifyPasskeyRegistration({challengeId:t.challenge_id,credential:a})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _startPasskeyRegistration(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;if(n)return this._returnResult({data:null,error:n});if(!t)return this._returnResult({data:null,error:new L});let{data:r,error:i}=await J(this.fetch,`POST`,`${this.url}/passkeys/registration/options`,{headers:this.headers,jwt:t.access_token,body:{}});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verifyPasskeyRegistration(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;if(r)return this._returnResult({data:null,error:r});if(!n)return this._returnResult({data:null,error:new L});let{data:i,error:a}=await J(this.fetch,`POST`,`${this.url}/passkeys/registration/verify`,{headers:this.headers,jwt:n.access_token,body:{challenge_id:e.challengeId,credential:e.credential}});return a?this._returnResult({data:null,error:a}):this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _startPasskeyAuthentication(e){try{let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/passkeys/authentication/options`,{headers:this.headers,body:{gotrue_meta_security:{captcha_token:e?.options?.captchaToken}}});return n?this._returnResult({data:null,error:n}):this._returnResult({data:t,error:null})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _verifyPasskeyAuthentication(e){try{let{data:t,error:n}=await J(this.fetch,`POST`,`${this.url}/passkeys/authentication/verify`,{headers:this.headers,body:{challenge_id:e.challengeId,credential:e.credential},xform:Y});return n?this._returnResult({data:null,error:n}):(t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers(`SIGNED_IN`,t.session)),this._returnResult({data:t,error:null}))}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _listPasskeys(){try{return await this._useSession(async e=>{let{data:{session:t},error:n}=e;if(n)return this._returnResult({data:null,error:n});if(!t)return this._returnResult({data:null,error:new L});let{data:r,error:i}=await J(this.fetch,`GET`,`${this.url}/passkeys`,{headers:this.headers,jwt:t.access_token,xform:e=>({data:e,error:null})});return i?this._returnResult({data:null,error:i}):this._returnResult({data:r,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _updatePasskey(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;if(r)return this._returnResult({data:null,error:r});if(!n)return this._returnResult({data:null,error:new L});let{data:i,error:a}=await J(this.fetch,`PATCH`,`${this.url}/passkeys/${e.passkeyId}`,{headers:this.headers,jwt:n.access_token,body:{friendly_name:e.friendlyName}});return a?this._returnResult({data:null,error:a}):this._returnResult({data:i,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}async _deletePasskey(e){try{return await this._useSession(async t=>{let{data:{session:n},error:r}=t;if(r)return this._returnResult({data:null,error:r});if(!n)return this._returnResult({data:null,error:new L});let{error:i}=await J(this.fetch,`DELETE`,`${this.url}/passkeys/${e.passkeyId}`,{headers:this.headers,jwt:n.access_token,noResolveJson:!0});return i?this._returnResult({data:null,error:i}):this._returnResult({data:null,error:null})})}catch(e){if(P(e))return this._returnResult({data:null,error:e});throw e}}};qi.nextInstanceID={};var Ji=qi,Yi=mi,Xi=Ji,Zi=class extends Xi{constructor(e){super(e)}},Qi=class{constructor(e,t,n){this.supabaseUrl=e,this.supabaseKey=t;let r=Un(e);if(!t)throw Error(`supabaseKey is required.`);Nn(t),Vn(n),this.realtimeUrl=new URL(`realtime/v1`,r),this.realtimeUrl.protocol=this.realtimeUrl.protocol.replace(`http`,`ws`),this.authUrl=new URL(`auth/v1`,r),this.storageUrl=new URL(`storage/v1`,r),this.functionsUrl=new URL(`functions/v1`,r);let i=`sb-${r.hostname.split(`.`)[0]}-auth-token`,a={db:yn,realtime:xn,auth:{...bn,storageKey:i},global:vn,tracePropagation:Sn},o=Hn(n??{},a);this.settings=o,this.storageKey=o.auth.storageKey??``,this.headers=o.global.headers??{},o.accessToken?(this.accessToken=o.accessToken,this.auth=new Proxy({},{get:(e,t)=>{throw Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(t)} is not possible`)}})):this.auth=this._initSupabaseAuthClient(o.auth??{},this.headers,o.global.fetch),this.fetch=Pn(t,e,this._getSessionToken.bind(this),o.global.fetch,o.tracePropagation),this.functionsFetch=Pn(t,e,this._getSessionToken.bind(this),o.global.fetch,o.tracePropagation,{omitApiKeyAsBearer:!0}),this.realtime=this._initRealtimeClient({headers:this.headers,accessToken:this._getAccessToken.bind(this),fetch:this.fetch,...o.realtime}),this.accessToken&&Promise.resolve(this.accessToken()).then(e=>this.realtime.setAuth(e)).catch(e=>console.warn(`Failed to set initial Realtime auth token:`,e)),this.rest=new fe(new URL(`rest/v1`,r).href,{headers:this.headers,schema:o.db.schema,fetch:this.fetch,timeout:o.db.timeout,urlLengthLimit:o.db.urlLengthLimit,retry:o.db.retry}),this.storage=new mn(this.storageUrl.href,this.headers,this.fetch,n?.storage),o.accessToken||this._listenForAuthEvents()}get functions(){return new l(this.functionsUrl.href,{headers:this.headers,customFetch:this.functionsFetch})}from(e){return this.rest.from(e)}schema(e){return this.rest.schema(e)}getOpenApiSpec(){return this.rest.getOpenApiSpec()}rpc(e,t={},n={head:!1,get:!1,count:void 0}){return this.rest.rpc(e,t,n)}channel(e,t={config:{}}){return this.realtime.channel(e,t)}getChannels(){return this.realtime.getChannels()}removeChannel(e){return this.realtime.removeChannel(e)}removeAllChannels(){return this.realtime.removeAllChannels()}async _getSessionToken(){if(this.accessToken)return await this.accessToken();let{data:e}=await this.auth.getSession();return e.session?.access_token??null}async _getAccessToken(){return await this._getSessionToken()??this.supabaseKey}_initSupabaseAuthClient({autoRefreshToken:e,persistSession:t,detectSessionInUrl:n,storage:r,userStorage:i,storageKey:a,flowType:o,lock:s,debug:c,throwOnError:l,experimental:u,lockAcquireTimeout:d,skipAutoInitialize:f},p,m){let h={Authorization:`Bearer ${this.supabaseKey}`,apikey:`${this.supabaseKey}`};return new Zi({url:this.authUrl.href,headers:{...h,...p},storageKey:a,autoRefreshToken:e,persistSession:t,detectSessionInUrl:n,storage:r,userStorage:i,flowType:o,lock:s,debug:c,throwOnError:l,experimental:u,fetch:m,lockAcquireTimeout:d,skipAutoInitialize:f,hasCustomAuthorizationHeader:Object.keys(this.headers).some(e=>e.toLowerCase()===`authorization`)})}_initRealtimeClient(e){return new _t(this.realtimeUrl.href,{...e,params:{apikey:this.supabaseKey,...e?.params}})}_listenForAuthEvents(){return this.auth.onAuthStateChange((e,t)=>{this._handleTokenChanged(e,`CLIENT`,t?.access_token)})}_handleTokenChanged(e,t,n){(e===`TOKEN_REFRESHED`||e===`SIGNED_IN`||e===`INITIAL_SESSION`)&&this.changedAccessToken!==n?(this.changedAccessToken=n,this.realtime.setAuth(n)):e===`SIGNED_OUT`&&(this.realtime.setAuth(),t==`STORAGE`&&this.auth.signOut(),this.changedAccessToken=void 0)}};let $i=(e,t,n)=>new Qi(e,t,n);function ea(){if(typeof window<`u`||globalThis.Deno!==void 0)return!1;let e=globalThis.process;if(!e)return!1;let t=e.version;if(t==null)return!1;let n=t.match(/^v(\d+)\./);return n?parseInt(n[1],10)<=20:!1}return ea()&&console.warn(`⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715`),e.AuthAdminApi=Yi,e.AuthApiError=Zn,e.AuthClient=Xi,e.AuthError=Xn,e.AuthImplicitGrantRedirectError=tr,e.AuthInvalidCredentialsError=er,e.AuthInvalidJwtError=fr,e.AuthInvalidTokenResponseError=R,e.AuthPKCECodeVerifierMissingError=ir,e.AuthPKCEGrantCodeExchangeError=rr,e.AuthRefreshDiscardedError=cr,e.AuthRetryableFetchError=or,e.AuthSessionMissingError=L,e.AuthUnknownError=F,e.AuthWeakPasswordError=ur,e.CustomAuthError=I,Object.defineProperty(e,`FunctionRegion`,{enumerable:!0,get:function(){return c}}),e.FunctionsError=i,e.FunctionsFetchError=a,e.FunctionsHttpError=s,e.FunctionsRelayError=o,e.GoTrueAdminApi=mi,e.GoTrueClient=Ji,e.NavigatorLockAcquireTimeoutError=_i,e.PostgrestError=u,e.REALTIME_CHANNEL_STATES=ut,Object.defineProperty(e,`REALTIME_LISTEN_TYPES`,{enumerable:!0,get:function(){return T}}),Object.defineProperty(e,`REALTIME_POSTGRES_CHANGES_LISTEN_EVENT`,{enumerable:!0,get:function(){return lt}}),Object.defineProperty(e,`REALTIME_PRESENCE_LISTEN_EVENTS`,{enumerable:!0,get:function(){return Xe}}),Object.defineProperty(e,`REALTIME_SUBSCRIBE_STATES`,{enumerable:!0,get:function(){return E}}),e.RealtimeChannel=dt,e.RealtimeClient=_t,e.RealtimePostgresFilterBuilder=st,e.RealtimePresence=Ze,e.SIGN_OUT_SCOPES=pi,e.StorageApiError=Pt,e.SupabaseClient=Qi,e.WebSocketFactory=pe,e.createClient=$i,e.isAuthApiError=Qn,e.isAuthError=P,e.isAuthImplicitGrantRedirectError=nr,e.isAuthPKCECodeVerifierMissingError=ar,e.isAuthRefreshDiscardedError=lr,e.isAuthRetryableFetchError=sr,e.isAuthSessionMissingError=$n,e.isAuthWeakPasswordError=dr,e.lockInternals=Z,e.navigatorLock=yi,e.postgresChangesFilter=ct,e.processLock=xi,e})({});
;
'use strict';
window.IASDPIAuth = (() => {
  let client=null, session=null, access=null, verification=null, generation=0, recovery=null;
  let phase='recovering', statusMessage='Recuperando sessão…', signingIn=false, expiryTimer=null;
  const publicPages=new Set(['organization','agendas','login','invite','forgot-password','reset-password']);
  function config(){
    let saved={};try{saved=JSON.parse(localStorage.getItem(IASDPIStorage.cloudConfig)||'{}');}catch(_){}
    return {url:window.IASDPIConfig?.supabaseUrl || '',key:window.IASDPIConfig?.supabasePublishableKey || saved.key || ''};
  }
  function validateConfig(value){
    const parsed=new URL(value.url);
    if(parsed.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(parsed.host)||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Configure a URL pública do Supabase.');
    if(!value.key.startsWith('sb_publishable_')&&!value.key.startsWith('eyJ'))throw Error('Configure somente a chave pública publishable/anon.');
    if(value.key.startsWith('eyJ')){try{if(JSON.parse(atob(value.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon')throw Error();}catch(_){throw Error('Use somente a chave pública anon, nunca service_role.');}}
  }
  function remoteRequestAllowed(path,method='GET'){
    if(!window.IASDPIConfig?.remoteReadOnly)return true;
    if(method==='GET')return /^\/auth\/v1\/(health|settings|user)$/.test(path)||/^\/rest\/v1\/(iasdpi_access|iasdpi_templates|culto_archives)(?:\?|$)/.test(path);
    if(method!=='POST')return false;
    return path==='/auth/v1/token?grant_type=password'||path==='/auth/v1/token?grant_type=refresh_token'||path==='/auth/v1/logout?scope=local'||
      ['/rest/v1/rpc/iasdpi_list_users','/rest/v1/rpc/iasdpi_list_invites','/rest/v1/rpc/iasdpi_find_account'].includes(path);
  }
  async function jsonRequest(path,options={}){
    if(!remoteRequestAllowed(path,(options.method||'GET').toUpperCase()))throw Error('Homologação em modo de consulta: alterações remotas estão bloqueadas.');
    const cfg=config();validateConfig(cfg);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(cfg.url+path,{...options,signal:controller.signal,headers:{apikey:cfg.key,...options.headers}});
      if(!response.ok){
        if(path.startsWith('/rest/v1/rpc/')){
          let error={};try{error=await response.json();}catch(_){}
          if(['42501','23514','22023','40001'].includes(error.code)){const failure=Error(String(error.message).slice(0,250));failure.code=error.code;throw failure;}
        }
        throw Error(response.status===401?'Sessão inválida ou expirada. Entre novamente.':'Não foi possível confirmar o acesso. Verifique a conexão e a configuração do Supabase.');
      }
      return response.status===204?null:await response.json();
    }finally{clearTimeout(timer);}
  }

  function status(next,message){phase=next;statusMessage=message;window.dispatchEvent(new Event('iasdpi-session-status'));}
  function allowed(){return Boolean(session&&access&&session.expires_at*1000>Date.now());}
  function invalidate(next='expired',message='Sessão expirada. Entre novamente.',dropSession=false){
    generation++;access=null;verification=null;clearTimeout(expiryTimer);
    if(dropSession)session=null;
    status(next,message);window.dispatchEvent(new Event('iasdpi-auth-changed'));
  }
  function adopt(value){
    if(session?.access_token!==value?.access_token){generation++;verification=null;}
    session=value;
    clearTimeout(expiryTimer);
    if(value)expiryTimer=setTimeout(()=>{void restore().catch(()=>{});},Math.max(100,Math.min(value.expires_at*1000-Date.now()+50,2147483647)));
  }
  function getClient(){
    if(client)return client;
    const cfg=config();validateConfig(cfg);
    if(!window.supabase?.createClient)throw Error('Não foi possível carregar a autenticação. Recarregue a página.');
    client=window.supabase.createClient(cfg.url,cfg.key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
        storageKey:IASDPIStorage.authSession,flowType:'pkce'},
      global:{fetch:async(input,options={})=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.origin!==cfg.url||!remoteRequestAllowed(url.pathname+url.search,(options.method||'GET').toUpperCase()))throw Error('Operação remota bloqueada no modo de consulta.');
        return fetch(input,options);
      }}
    });
    client.auth.onAuthStateChange((event,value)=>{
      // Callback síncrono: chamadas Auth dentro deste callback podem bloquear o SDK.
      if(event==='PASSWORD_RECOVERY'){
        adopt(value);access=null;recoveryMetadata({uid:value.user.id,until:Math.min(Date.now()+900000,value.expires_at*1000)});status('recovering','Defina sua nova senha.');
      }else if(event==='SIGNED_OUT'){
        recoveryMetadata(null);
        const existed=Boolean(session);adopt(null);
        invalidate(existed?'expired':'anonymous',existed?'Sessão expirada. Entre novamente.':'Entre com uma conta autorizada.',true);
      }else{
        const changed=session?.access_token!==value?.access_token;adopt(value);
        if(value&&changed&&!signingIn&&!passwordRecoveryActive())setTimeout(()=>{void restore().catch(()=>{});},0);
      }
    });
    return client;
  }
  async function verify(){
    if(!session||session.expires_at*1000<=Date.now())throw Error('Sessão expirada. Entre novamente.');
    if(verification)return verification;
    const ticket=generation,token=session.access_token;
    verification=(async()=>{
      try{
        const headers={Authorization:'Bearer '+token};
        const user=await jsonRequest('/auth/v1/user',{headers});
        if(user.is_anonymous!==false||!user.id)throw Error('Conta sem autorização.');
        const rows=await jsonRequest('/rest/v1/iasdpi_access?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,role,enabled&limit=1',{headers});
        if(!Array.isArray(rows)||rows.length!==1||rows[0].user_id!==user.id||rows[0].enabled!==true||!['admin','leader'].includes(rows[0].role))throw Error('Conta sem autorização. Solicite acesso à administração.');
        if(ticket!==generation)throw Error('Sessão alterada. Tente novamente.');
        const previousRole=access?.role;access=rows[0];session.user=user;status('authenticated','Sessão ativa.');
        if(previousRole&&previousRole!==access.role)window.dispatchEvent(new Event('iasdpi-role-changed'));
        return {token,role:access.role,user};
      }catch(error){if(ticket===generation)invalidate('unavailable',error.message);throw error;}
      finally{if(ticket===generation)verification=null;}
    })();
    return verification;
  }
  async function restore(){
    if(recovery)return recovery;
    recovery=Promise.resolve().then(async()=>{
      if(!allowed())status('recovering','Recuperando sessão…');
      try{
        const {data,error}=await getClient().auth.getSession();
        if(error)throw error;
        adopt(data.session);
        if(!session){invalidate('anonymous','Entre com uma conta autorizada.',true);return null;}
        if(passwordRecoveryActive()){status('recovering','Defina sua nova senha.');return null;}
        return await verify();
      }catch(error){
        const expired=error.status===400||error.status===401||/refresh_token|expirada/i.test(error.code||error.message||'');
        const denied=/Conta sem autorização/.test(error.message||'');
        invalidate(denied?'unauthorized':expired?'expired':'unavailable',denied?error.message:expired?'Sessão expirada. Entre novamente.':'Não foi possível recuperar a sessão. Verifique sua conexão e tente novamente.');
        throw error;
      }finally{recovery=null;}
    });
    return recovery;
  }
  async function requireAccess(){
    if(passwordRecoveryActive())throw Error('Conclua a recuperação de senha antes de acessar os registros.');
    if(!session||session.expires_at*1000<=Date.now())await restore();
    return verify();
  }
  async function login(email,password,key,inviteToken){
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    if(client&&cfg.key!==config().key)throw Error('Recarregue a página após alterar a chave pública.');
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    signingIn=true;status('recovering','Confirmando acesso…');
    try{
      const {data,error}=await getClient().auth.signInWithPassword({email,password});
      if(error)throw Error('Não foi possível entrar. Confira e-mail, senha e conexão.');
      adopt(data.session);
      if(inviteToken)await jsonRequest('/rest/v1/rpc/iasdpi_accept_invite',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_token:inviteToken})});
      await verify();window.dispatchEvent(new Event('iasdpi-auth-changed'));
    }catch(error){invalidate('unavailable',error.message);throw error;}
    finally{signingIn=false;}
  }
  async function signup(email,password,key){
    if(!remoteRequestAllowed('/auth/v1/signup','POST'))throw Error('Cadastro bloqueado no modo de consulta.');
    const cfg=config();if(key)cfg.key=key.trim();validateConfig(cfg);
    localStorage.setItem(IASDPIStorage.cloudConfig,JSON.stringify(cfg));
    const {error}=await getClient().auth.signUp({email,password});if(error)throw Error('Não foi possível concluir o cadastro. Verifique sua conexão.');
  }
  async function logout(){
    if(window.IASDPIDrafts&&!await IASDPIDrafts.confirmLogout())return false;
    const draftOwner=session?.user.id;
    const {error}=await getClient().auth.signOut({scope:'local'});
    if(error)throw Error('Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.');
    await window.IASDPIDrafts?.clearUser(draftOwner);
    adopt(null);invalidate('anonymous','Sessão encerrada.',true);
    return true;
  }
  // O SDK guarda o verificador PKCE e a sessão. Aqui só há metadados temporários.
  const passwordMarker=IASDPIStorage.authSession+':password-recovery-v1';
  let passwordContext=null,passwordRequestAt=0,passwordMessage='Link ausente, inválido ou expirado. Solicite um novo e abra no mesmo navegador.';
  function recoveryMetadata(value){
    passwordContext=value;
    try{if(value)sessionStorage.setItem(passwordMarker,JSON.stringify(value));else sessionStorage.removeItem(passwordMarker);}catch(_){}
  }
  function passwordRecoveryActive(){
    if(!passwordContext)try{passwordContext=JSON.parse(sessionStorage.getItem(passwordMarker)||'null');}catch(_){}
    return Boolean(session&&passwordContext?.uid===session.user.id&&passwordContext.until>Date.now()&&session.expires_at*1000>Date.now());
  }
  function passwordRedirect(){
    const url=new URL(location.href);
    if(!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('A recuperação exige o site HTTPS ou uma prévia local autorizada.');
    url.search='';url.hash='reset-password';
    if(url.origin!==location.origin||url.username||url.password)throw Error('Endereço de recuperação inválido.');
    return url.href;
  }
  async function requestPasswordReset(email){
    if(!remoteRequestAllowed('/auth/v1/recover','POST'))throw Error('Envio de e-mail bloqueado nesta prévia de consulta. Use o ambiente de testes autorizado.');
    const redirectTo=passwordRedirect();
    if(Date.now()-passwordRequestAt<60000)throw Error('Aguarde um minuto antes de solicitar outro link.');
    passwordRequestAt=Date.now();
    const {error}=await getClient().auth.resetPasswordForEmail(email,{redirectTo});
    if(error&&error.status===429)throw Error('Muitas solicitações. Aguarde antes de tentar novamente.');
    if(error&&!['user_not_found','email_not_found'].includes(error.code))throw Error('Não foi possível solicitar a recuperação agora. Verifique a conexão e tente novamente mais tarde.');
    return 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha. Verifique também o spam. Abra o link neste mesmo navegador.';
  }
  async function handlePasswordCallback(){
    const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
    const recoveryRoute=url.hash==='#reset-password',implicit=hash.get('type')==='recovery';
    if(!recoveryRoute&&!implicit&&!hash.has('error')&&!hash.has('error_code'))return false;
    const codes=url.searchParams.getAll('code'),code=codes[0],hasError=url.searchParams.has('error')||hash.has('error')||url.searchParams.has('error_code')||hash.has('error_code');
    const flowId=url.searchParams.get('sb_flow_id');
    // Remover códigos/erros antes de qualquer navegação, consulta ou mensagem.
    if(codes.length||hasError||implicit){url.search='';url.hash='reset-password';window.history.replaceState(null,'',url.pathname+url.hash);}
    if(!codes.length&&!hasError&&!implicit)return false;
    recoveryMetadata(null);
    passwordMessage='Conferindo o link de recuperação…';signingIn=true;
    try{
      if(hasError||implicit||codes.length!==1||!code||code.length>2048)throw Error();
      const {data,error}=await getClient().auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
      if(error||data?.redirectType!=='recovery'||!data.session)throw Error();
      adopt(data.session);recoveryMetadata({uid:session.user.id,until:Math.min(Date.now()+900000,session.expires_at*1000)});
      passwordMessage='Link confirmado. Defina sua nova senha.';status('recovering',passwordMessage);
    }catch(_){recoveryMetadata(null);passwordMessage='Link inválido, já utilizado ou expirado. Solicite outro e abra no mesmo navegador da solicitação.';}
    finally{signingIn=false;}
    return true;
  }
  async function updatePassword(password){
    const sdk=getClient(),{data,error}=await sdk.auth.getSession();
    if(error||!data.session){recoveryMetadata(null);passwordMessage='A recuperação expirou. Solicite um novo link.';throw Error(passwordMessage);}
    adopt(data.session);
    if(!passwordRecoveryActive())throw Error('Link inválido ou expirado. Solicite um novo link.');
    if(typeof password!=='string'||password.length<12)throw Error('Use uma senha com pelo menos 12 caracteres.');
    const result=await sdk.auth.updateUser({password});
    if(result.error){if([401,403].includes(result.error.status)){recoveryMetadata(null);passwordMessage='Link expirado. Solicite um novo link.';}throw Error('Não foi possível redefinir a senha. Verifique a conexão, a validade do link e os requisitos de senha do projeto.');}
    recoveryMetadata(null);passwordMessage='Senha redefinida. Entre novamente com a nova senha.';
    const signedOut=await sdk.auth.signOut({scope:'local'});
    adopt(null);invalidate('anonymous',passwordMessage,true);
    if(signedOut.error)throw Error('Senha alterada, mas não foi possível encerrar a sessão local. Recarregue e entre com a nova senha.');
  }
  function forgotPasswordPage(){
    if(bootInProgress)return heading('ACESSO','Recuperar senha')+'<p role="status">Preparando formulário de recuperação…</p>';
    return heading('ACESSO','Recuperar senha','Informe seu e-mail. Esta solicitação não concede autorização de acesso à igreja.')+`<section class="panel auth-panel"><form id="password-request-form">${field('E-mail','email','','email',true,'autocomplete="email"')}<button type="submit" class="primary">Enviar link de recuperação</button><p class="password-feedback" role="status" aria-live="polite"></p></form><p><a href="#login" data-auth-page="login">Voltar para Entrar</a></p></section>`;
  }
  function resetPasswordPage(){
    if(bootInProgress)return heading('ACESSO','Definir nova senha')+'<p role="status">Conferindo sessão de recuperação…</p>';
    return heading('ACESSO','Definir nova senha','A redefinição usa uma sessão de recuperação do Supabase e não altera as permissões da conta.')+`<section class="panel auth-panel"><p role="status">${esc(passwordRecoveryActive()?'Link confirmado. Defina sua nova senha.':passwordMessage)}</p>${passwordRecoveryActive()?`<form id="password-reset-form">${field('Nova senha','password','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}${field('Confirmar nova senha','repeat','','password',true,'minlength="12" maxlength="256" autocomplete="new-password"')}<button type="submit" class="primary">Definir nova senha</button></form>`:`<p><a href="#forgot-password" data-auth-page="forgot-password">Solicitar novo link</a></p>`}<p><a href="#login" data-auth-page="login">Voltar para Entrar</a></p></section>`;
  }

  function loginPage(){
    return heading('ACESSO RESTRITO','Entrar no IASDPI','Cronogramas, registros, histórico e backups são exclusivos de administradores e líderes autorizados.')+
      `<section class="panel auth-panel"><p role="status">${esc(statusMessage)}</p><form id="auth-login-form">${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${`<details ${config().key?'':'open'}><summary>Configuração da conexão</summary><p class="muted">Informe somente a chave pública do projeto.</p>${field('Chave pública publishable/anon','public-key','','text',!config().key,'autocomplete="off"')}</details>`}<button class="primary" type="submit">Entrar</button><p><a href="#forgot-password" data-auth-page="forgot-password">Esqueci minha senha</a></p><p class="muted">A sessão é mantida pelo Supabase neste navegador. Use Sair em dispositivos compartilhados. A autorização depende da administração da igreja.</p></form></section>`;
  }
  document.addEventListener('visibilitychange',()=>{
    if(!client)return;
    if(document.hidden)client.auth.stopAutoRefresh();
    else{client.auth.startAutoRefresh();void restore().catch(()=>{});}
  });
  setInterval(()=>{if(session&&!document.hidden)void requireAccess().catch(()=>{});},60000);
  return {config,remoteRequestAllowed,allowed,isAdmin:()=>allowed()&&access.role==='admin',requireAccess,jsonRequest,login,signup,logout,loginPage,restore,requestPasswordReset,handlePasswordCallback,updatePassword,passwordRecoveryActive,forgotPasswordPage,resetPasswordPage,
    status:()=>({phase,message:statusMessage}),isPublic:page=>publicPages.has(page),session:()=>allowed()?session:null};
})();

;
'use strict';
// Leitura tolerante, sem mutações. Valores desconhecidos não viram horários fictícios.
const recordClockPattern=/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/;
function validRecordClock(value){return typeof value==='string'&&recordClockPattern.test(value);}
function recordDay(value){
  if(typeof value!=='string')return '';
  let day=value;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(day))day=day.split('/').reverse().join('-');
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)){
    const date=new Date(day+'T12:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:'';
  }
  if(/^\d{4}-\d{2}-\d{2}[T ]/.test(day)){
    const instant=inspectRecordTime(day);
    return instant.valid?instant.day:'';
  }
  return '';
}
const recordFormatters=Object.freeze({
  civil:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),
  clock:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),
  day:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'})
});
function saoPauloInstant(day,clock){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!recordClockPattern.test(clock||''))return null;
  const full=clock.length===5?clock+':00':clock;
  const target=Date.parse(day+'T'+full.slice(0,8)+'Z');if(!Number.isFinite(target))return null;
  let epoch=target;
  const formatter=recordFormatters.civil;
  for(let n=0;n<4;n++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
    const shown=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if(shown===target){
      const offset=(target-epoch)/60000,absolute=Math.abs(offset);
      return day+'T'+full+(offset>=0?'+':'-')+String(Math.floor(absolute/60)).padStart(2,'0')+':'+String(absolute%60).padStart(2,'0');
    }
    epoch+=target-shown;
  }
  return null; // Horário civil inexistente na mudança de fuso: revisão manual.
}
function inspectRecordTime(value,day){
  const empty=value===null||value===undefined||value==='';
  if(empty)return {valid:false,empty:true,clock:'',epoch:null,iso:null};
  if(value instanceof Date){if(!Number.isFinite(value.getTime()))return {valid:false,empty:false,clock:'',epoch:null,iso:null};value=value.toISOString();}
  if(typeof value!=='string')return {valid:false,empty:false,clock:String(value),epoch:null,iso:null};
  if(recordClockPattern.test(value)){
    const iso=saoPauloInstant(day,value);
    return {valid:true,empty:false,clock:value.length===5?value+':00':value,epoch:iso?Date.parse(iso):null,iso,day,absolute:false};
  }
  const match=value.match(/^(\d{4}-\d{2}-\d{2})[T ]((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if(!match||!recordDay(match[1]))return {valid:false,empty:false,clock:value,epoch:null,iso:null};
  const full=match[2].length===5?match[2]+':00':match[2];
  let offset=match[3]||'';
  if(/^[+-]\d{2}$/.test(offset))offset+=':00';
  if(/^[+-]\d{4}$/.test(offset))offset=offset.slice(0,3)+':'+offset.slice(3);
  const iso=offset?match[1]+'T'+full+offset.toUpperCase():saoPauloInstant(match[1],full);
  const epoch=iso?Date.parse(iso):NaN;
  if(!Number.isFinite(epoch))return {valid:false,empty:false,clock:value,epoch:null,iso:null};
  const clock=recordFormatters.clock.format(new Date(epoch))+(full.match(/\.\d+$/)?.[0]||'');
  return {valid:true,empty:false,clock,epoch,iso,absolute:Boolean(offset),day:recordFormatters.day.format(new Date(epoch))};
}
function recordClock(value,day){const parsed=inspectRecordTime(value,day);return parsed.empty?'':parsed.valid?parsed.clock:String(value);}
function recordEpoch(value,day){const result=inspectRecordTime(value,day);return result.valid?result.epoch:null;}
// Validação compartilhada por backups e indicadores; não normaliza o documento.
function recordInterval(start,end,day){
  const a=inspectRecordTime(start,day),b=inspectRecordTime(end,day);
  const invalid=[a,b].some(v=>!v.empty&&(!v.valid||v.epoch===null||(day&&v.day!==day)));
  if(invalid)return {state:'invalid',minutes:null};
  if(a.empty||b.empty)return {state:'missing',minutes:null};
  if(b.epoch<a.epoch)return {state:'invalid',minutes:null};
  return {state:'valid',minutes:(b.epoch-a.epoch)/60000,start:a.iso,end:b.iso};
}
function activitySamples(original){
  const p=programForMetrics(original),day=recordDay(p.plan.date);
  return p.plan.items.map((item,index)=>{
    const raw=original.plan.items[index],e=original.executions?.[item.id]||{};
    const actual=recordInterval(e.started,e.ended??original.actual_details?.[item.id]?.partial_end,day);
    const planned=recordInterval(raw.planned_start||raw.start,raw.planned_end||raw.end,day);
    const state=actual.state==='invalid'||planned.state==='invalid'?'invalid':actual.state==='missing'||planned.state==='missing'?'missing':'valid';
    return {item,actual,planned,state};
  });
}
function sampleCounts(samples){
  return {considered:samples.filter(s=>s.state==='valid').length,missing:samples.filter(s=>s.state==='missing').length,invalid:samples.filter(s=>s.state==='invalid').length,total:samples.length};
}
function recordInstant(day,clock){
  const parsed=inspectRecordTime(clock,recordDay(day));
  if(!parsed.valid||!parsed.iso)throw Error('Horário ou data inconsistente. Corrija o campo antes de salvar.');
  return parsed.iso;
}
function plannedClock(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d:00(?:\.0+)?$/.test(value)?value.slice(0,5):value;}
function programForMetrics(original){
  const p={...original},rawPlan=original?.plan||{},day=recordDay(rawPlan.date);
  const instant=(value,fallback)=>value===null||value===undefined||value===''?(fallback?saoPauloInstant(day,fallback):null):inspectRecordTime(value,day).iso;
  p.plan={...rawPlan,items:(Array.isArray(rawPlan.items)?rawPlan.items:[]).map(item=>({...item,planned_start:instant(item.planned_start,item.start),planned_end:instant(item.planned_end,item.end)}))};
  p.executions=Object.fromEntries(Object.entries(original?.executions||{}).map(([id,e])=>[id,{...e,started:instant(e?.started),ended:instant(e?.ended)}]));
  p.planned_start=instant(original?.planned_start,rawPlan.start);p.planned_end=instant(original?.planned_end,rawPlan.end);
  return p;
}
function importedTimeWarning(value,day){
  const parsed=inspectRecordTime(value,recordDay(day));
  if(parsed.empty)return '';
  if(!parsed.valid)return 'Horário importado inválido. Revise o valor original e digite HH:mm:ss.';
  if(parsed.day&&recordDay(day)&&parsed.day!==recordDay(day))return 'Horário em outra data. Confira a data do culto e corrija este horário manualmente.';
  return '';
}

// Formatação de apresentação: nunca altera os documentos ou sua precisão original.
function displayPlannedTime(value){
  const parsed=inspectRecordTime(value);
  return parsed.empty?'':parsed.valid?parsed.clock.slice(0,5):String(value);
}
function displayRecordTimestamp(value){
  const parsed=inspectRecordTime(value);
  return parsed.valid&&parsed.day?parsed.day.split('-').reverse().join('/')+' '+parsed.clock.slice(0,8):'Data não informada';
}

;
'use strict';
// Motor compartilhado de regras; o adaptador local continua disponível para rollback.
window.IASDPILocalAdapter = (() => {
    const key = IASDPIStorage.programs;
    const zone = 'America/Sao_Paulo';
    const clone = data => JSON.parse(JSON.stringify(data));
    const date = time => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date(time));
    const time = stamp => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(stamp));
    const instant = (day, clock) => recordInstant(day,clock);
    const stamp = () => new Date().toISOString();
    const id = () => crypto.randomUUID();
    function prepare(input) {
      const p = clone(input);
      if (!p.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || date(instant(p.date, '12:00')) !== p.date) throw Error('Informe nome e data válidos.');
      const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
      const emptyFree=p.execution_mode==='manual'&&p.template_id==='free'&&Array.isArray(p.items)&&!p.items.length;
      if (!(emptyFree&&!p.start&&!p.end)&&(!validTime(p.start) || !validTime(p.end) || p.end <= p.start)) throw Error('Informe horários válidos, com término depois do início.');
      if (!Array.isArray(p.items) || (!p.items.length&&!emptyFree) || p.items.length > 100) throw Error('Cadastre entre 1 e 100 atividades.');
      let previous = p.start, previousItem = null;
      const ids = new Set();
      p.items = p.items.map((item, index) => {
        const parallel = p.execution_mode === 'manual' && item.parallel && previousItem?.parallel && item.start === previousItem.start && item.end === previousItem.end;
        if (!validTime(item.start) || !validTime(item.end) || (item.start < previous && !parallel) || item.end <= item.start || item.end > p.end) throw Error(`Atividade ${index+1}: horários sobrepostos, fora de ordem ou fora da programação.`);
        if (!item.activity?.trim() || !item.block?.trim()) throw Error('Informe atividade e bloco.');
        previous = item.end; previousItem = item;
        const identifier = item.id || id();
        if (ids.has(identifier)) throw Error('Identificador de atividade duplicado.');
        ids.add(identifier);
        return {...item, id:identifier, order:index+1, planned_start:instant(p.date,item.start), planned_end:instant(p.date,item.end)};
      });
      return {name:p.name, date:p.date, start:p.start, end:p.end, items:p.items, team:p.team || {},...(p.template_id?{template_id:p.template_id}:{})};
    }
    function make(input, status = 'Planejamento') {
      const plan = prepare(input);
      return {id:id(), execution_mode:input.execution_mode || 'live', plan, status, version:1, note:'', incident:'', paused:false, executions:{}, planned_start:plan.start?instant(plan.date,plan.start):null, planned_end:plan.end?instant(plan.date,plan.end):null};
    }
    function isTestProgram(p) {
      return p.sample_set === 'adherence-v1' ||
        ['Culto · demonstração', 'Próximo culto · exemplo', 'Culto de sábado · exemplo'].includes(p.plan?.name);
    }
    // Não carregar nem modificar registros antes da autorização.
    let memory = [], storageAvailable = true, simulation=false;
    function save(writeSafety=true) {
      if(simulation)return;
      try { const previous=localStorage.getItem(key);if(writeSafety&&previous!==null)localStorage.setItem(IASDPIStorage.safety,previous);localStorage.setItem(key,JSON.stringify(memory)); storageAvailable=true; }
      catch (_) { throw Error('O navegador não permitiu salvar a demonstração. Libere o armazenamento local.'); }
    }
    function performRequest(path, method, body = {}) {
      if (path === 'health') return {status:'ok',timezone:zone,server_time:stamp()};
      if (path === 'programs' && method === 'GET') return clone(memory);
      if (path === 'programs' && method === 'POST') {
        const p=make(body); memory.unshift(p); save(); return clone(p);
      }
      const [,identifier,route] = path.split('/');
      const p = memory.find(p => p.id === identifier);
      if (!p) throw Error('Programação não encontrada.');
      if (method === 'GET') return clone(p);
      if (route === 'duplicate') {
        const plan=clone(p.plan); plan.date=body.date; plan.execution_mode=p.execution_mode || 'live';
        plan.items.forEach(i => {i.id=id();});
        const copy=make(plan); memory.unshift(copy); save(); return clone(copy);
      }
      if(body.version!==p.version){const error=Error('Esta programação mudou. Atualize antes de continuar.');error.code='40001';throw error;}
      if (route === 'correct-date') {
        if(simulation)throw Error('Corrija a data pela edição do registro.');
        if(body.expected!==JSON.stringify(p))throw Error('O registro mudou após a conferência. Reabra a prévia antes de confirmar.');
        const corrected=correctedCultoDate(p);corrected.version++;
        const raw=localStorage.getItem(IASDPIStorage.dateCorrections);
        const backups=raw===null?{version:1,records:[]}:JSON.parse(raw);
        if(backups?.version!==1||!Array.isArray(backups.records))throw Error('Cópia de segurança de data inválida. Nada foi alterado.');
        if(!backups.records.some(entry=>entry.id===p.id)){
          backups.records.push({id:p.id,captured_at:stamp(),program:clone(p)});
          localStorage.setItem(IASDPIStorage.dateCorrections,JSON.stringify(backups));
        }
        memory[memory.indexOf(p)]=corrected;save(false);return clone(corrected);
      }
      if (route === 'actuals') {
        if (p.execution_mode !== 'manual') throw Error('Use uma programação de registro manual.');
        const records = body.executions;
        if (!records || Object.keys(records).length !== p.plan.items.length) throw Error('Envie todos os itens.');
        const nextPlan=recordEditPlan(p,body);
        const executions = {}, details = structuredClone(p.actual_details||{});
        for (const item of p.plan.items) {
          const e=records[item.id];
          if(!e || typeof e.start!=='string' || typeof e.end!=='string') throw Error('Registro de horário inválido.');
          const note=e.note ?? p.actual_details?.[item.id]?.note ?? '', responsible=e.responsible ?? p.actual_details?.[item.id]?.responsible ?? '';
          if(typeof note!=='string'||note.length>2000||typeof responsible!=='string'||responsible.length>200)throw Error('Observação ou responsável inválido.');
          const old=p.actual_details?.[item.id]||{};
          const checked=validateActivityRecord({...e,subactivities:e.subactivities??old.subactivities??[]},item.id);
          details[item.id]={...old,note,responsible,subactivities:checked.subactivities};
          // Status histórico é metadado, nunca requisito ou critério de conclusão.
          if(old.status===undefined&&e.status!==undefined)details[item.id].status=e.status;
          delete details[item.id].partial_end;
          if(!e.start){if(e.end)details[item.id].partial_end=e.end;continue;}
          const prior=p.executions?.[item.id];
          const preserve=(clock,raw)=>raw&&recordDay(nextPlan.date)===recordDay(p.plan.date)&&inspectRecordTime(raw,nextPlan.date).absolute&&inspectRecordTime(raw,nextPlan.date).day===nextPlan.date&&clock===storedActualClock(raw)?raw:instant(nextPlan.date,clock);
          executions[item.id]={...(prior||{}),started:preserve(e.start,prior?.started),ended:e.end?preserve(e.end,prior?.ended):null};
        }
        const complete = p.plan.items.every(item=>executions[item.id]?.started&&executions[item.id]?.ended);
        if(body.finalize&&!p.plan.items.length)throw Error('Adicione atividades antes de finalizar.');
        if(body.finalize && !complete) throw Error('Preencha todas as atividades antes de finalizar.');
        const extraEvents=validateExtraEvents(p,body.extra_events ?? p.extra_events ?? [],Boolean(body.finalize));
        const info=body.record_info??p.record_info??'';if(typeof info!=='string'||info.length>5000)throw Error('Informações complementares inválidas.');
        const wasFinished=p.status==='Finalizada';p.plan=nextPlan;p.planned_start=nextPlan.start?instant(nextPlan.date,nextPlan.start):null;p.planned_end=nextPlan.end?instant(nextPlan.date,nextPlan.end):null;p.record_info=info;
        p.extra_events=extraEvents;p.executions=executions;p.actual_details=details;p.note=body.note??p.note??'';p.incident=body.incident??p.incident??'';
        p.status=body.finalize||wasFinished?'Finalizada':(Object.keys(executions).length||extraEvents.some(e=>e.start))?'Em andamento':'Planejamento';p.paused=false;
      }
      else if (route === 'notes') { p.note=body.note ?? p.note ?? ''; p.incident=body.incident ?? p.incident ?? ''; }
      else if (!route && method === 'PUT') {
        if (!['Planejamento','Pronta'].includes(p.status)) throw Error('O plano fica protegido após o início.');
        const incoming={...body,execution_mode:p.execution_mode || 'live',team:{...p.plan.team,...body.team},items:Array.isArray(body.items)?body.items.map(item=>({...p.plan.items.find(old=>old.id===item.id),...item})):body.items};
        const plan={...p.plan,...prepare(incoming)};p.plan=plan;p.planned_start=plan.start?instant(plan.date,plan.start):null;p.planned_end=plan.end?instant(plan.date,plan.end):null;p.status='Planejamento';
      } else if (route === 'action') {
        if(p.execution_mode==='manual')throw Error('Use o formulário de realizado.');
        const active = p.plan.items.find(i => p.executions[i.id] && !p.executions[i.id].ended);
        const next = p.plan.items.find(i => !p.executions[i.id]);
        const now=stamp();
        if (body.action==='ready' && p.status==='Planejamento') p.status='Pronta';
        else if (body.action==='start' && p.status==='Pronta') {
          if(p.plan.date!==date(new Date())) throw Error('O acompanhamento só pode começar na data da programação.');
          p.executions[p.plan.items[0].id]={started:now,ended:null};p.status='Em andamento';
        } else if (body.action==='next' && active && !p.paused) {
          p.executions[active.id].ended=now;
          if(next) p.executions[next.id]={started:now,ended:null}; else p.status='Finalizada';
        } else if (['pause','resume'].includes(body.action) && p.status==='Em andamento') p.paused=body.action==='pause';
        else throw Error('Ação indisponível para o estado atual.');
      } else throw Error('Operação indisponível.');
      p.version++; save(); return clone(p);
    }
    async function request(path, method, body = {}) {
      if (path === 'health') return performRequest(path, method, body);
      await window.IASDPIAuth.requireAccess();
      if(path==='chronogram'&&method==='GET'){
        const rows=await window.IASDPIAuth.jsonRequest('/rest/v1/iasdpi_templates?id=eq.culto-03102026&select=plan',{headers:{Authorization:'Bearer '+window.IASDPIAuth.session().access_token}});
        if(!rows[0]?.plan)throw Error('Cronograma não configurado. Os registros existentes permanecem preservados.');
        return rows[0].plan;
      }
      const apply=()=>{
      let before;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          const stored = JSON.parse(raw);
          if (!Array.isArray(stored)) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
          memory = stored;
        }else memory=[];
        before = clone(memory);
        return performRequest(path, method, body);
      } catch (error) {
        if (before) memory = before;
        if (error instanceof SyntaxError) throw Error('Os dados salvos estão inválidos. Não serão sobrescritos.');
        if (error.name === 'SecurityError') throw Error('O navegador bloqueou o armazenamento local. Libere-o para salvar os dados.');
        throw error;
      }
      };
      if(method!=='GET'&&navigator.locks)return navigator.locks.request('iasdpi-records:'+key,apply);
      return apply();
    }

    document.addEventListener('DOMContentLoaded', () => {
      if(!window.IASDPIDemo)return;
      const banner=document.createElement('aside');banner.className='demo-banner';
      banner.textContent='ARMAZENAMENTO LOCAL · Os registros permanecem neste navegador. Guarde uma cópia em Arquivo e banco.' + (storageAvailable ? '' : ' O salvamento está bloqueado neste navegador.');
      document.querySelector('.header').after(banner);
    });
    window.addEventListener('iasdpi-auth-changed',()=>{if(!window.IASDPIAuth.allowed())memory=[];});
    function apply(programs,path,method,body){
      const previous=memory;memory=clone(programs);simulation=true;
      try{return performRequest(path,method,body);}finally{memory=previous;simulation=false;}
    }
    return {request,apply};
})();
if(window.IASDPIConfig?.storageMode!=='supabase'&&(location.hostname.endsWith('.github.io')||new URLSearchParams(location.search).get('demo')==='1'||window.IASDPIConfig?.storageMode==='browser'))window.IASDPIDemo=window.IASDPILocalAdapter;

;
'use strict';
// Banco operacional. Nunca usa localStorage como fallback para leituras/gravações.
if(window.IASDPIConfig?.storageMode==='supabase')window.IASDPIOperational=(()=>{
  const pending=new Map();let templates=[],preview=null,recoveries=[],lastActor=null;
  async function remote(path,method='GET',body,expectedActor=null){
    const access=await IASDPIAuth.requireAccess();
    if(expectedActor&&access.user.id!==expectedActor)throw Error('Este envio pertence a outra sessão. Reentre com a conta original.');
    lastActor=access.user.id;
    try{
      const result=await IASDPIAuth.jsonRequest('/rest/v1/'+path,{method,headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(IASDPIAuth.session()?.access_token!==access.token)throw Error('Sessão alterada. Entre novamente para consultar o resultado.');
      return result;
    }catch(error){
      if(error.code==='40001')throw error;
      throw Error(error.message+(method==='GET'?' Não foi possível concluir a consulta. Os dados já carregados foram preservados.':' Os campos não foram descartados. Nenhuma confirmação de gravação foi recebida.'));
    }
  }
  function outboxDb(){return new Promise((resolve,reject)=>{
    const opening=indexedDB.open('iasdpi-pending-writes-v1',1);
    opening.onupgradeneeded=()=>opening.result.createObjectStore('writes',{keyPath:'key'});
    opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(Error('Não foi possível preservar o envio pendente neste dispositivo.'));
  });}
  async function outbox(mode,value,actor=null){
    const db=await outboxDb(),uid=actor||IASDPIAuth.session()?.user.id;
    if(!uid){db.close();throw Error('Entre novamente.');}
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('writes',mode==='list'?'readonly':'readwrite'),store=tx.objectStore('writes');
      const op=mode==='list'?store.getAll():mode==='put'?store.put({...value,key:uid+':'+value.args.p_request_id,uid}):store.delete(uid+':'+value);
      let result;op.onsuccess=()=>result=op.result;
      tx.oncomplete=()=>{db.close();resolve(mode==='list'?result.filter(row=>row.uid===uid):result);};
      tx.onerror=()=>{db.close();reject(Error('Não foi possível atualizar a recuperação local do envio.'));};
    });
  }
  async function commit(document,expected,importing=false,key=document.id){
    const uid=IASDPIAuth.session()?.user.id||lastActor,signature=JSON.stringify([document,expected,importing]);
    let entry=pending.get(key);
    if(entry&&(entry.signature!==signature||entry.uid!==uid)){
      throw Error('Há um envio anterior sem confirmação. Abra Arquivo e banco para conferir ou recuperar esse envio antes de alterar seu conteúdo.');
    }
    if(!entry){entry={uid,signature,args:{p_id:document.id,p_expected_version:expected,p_document:document,p_request_id:crypto.randomUUID(),p_import:importing}};pending.set(key,entry);}
    // Fila de recuperação, não banco operacional. Falha aqui não impede gravar no servidor.
    let recoveryAvailable=true;try{await outbox('put',entry,uid);}catch(_){recoveryAvailable=false;}
    let result;
    try{result=await remote('rpc/iasdpi_save_program','POST',entry.args,entry.uid);}
    catch(error){
      const failure=Error(error.message+(recoveryAvailable?' Envio pendente disponível em Arquivo e banco.':' Recuperação local indisponível: mantenha esta aba aberta para não perder as alterações.'));
      if(error.code==='40001'){failure.code='40001';failure.conflict={id:document.id,expectedVersion:expected,requestId:entry.args.p_request_id,uid:entry.uid,document:structuredClone(document)};}
      throw failure;
    }
    pending.delete(key);try{await outbox('delete',entry.args.p_request_id);}catch(_){/* RPC idempotente permite reconferir após uma resposta confirmada. */}
    return result;
  }
  async function list(){
    const all=[];
    for(let offset=0;;offset+=500){
      const rows=await remote('iasdpi_programs?select=document&deleted_at=is.null&order=id&limit=500&offset='+offset);
      all.push(...rows.map(row=>row.document));if(rows.length<500)break;
    }
    return all;
  }
  async function get(id){
    const rows=await remote('iasdpi_programs?id=eq.'+encodeURIComponent(id)+'&select=document&deleted_at=is.null');
    if(!rows[0])throw Error('Registro não encontrado no Supabase.');return rows[0].document;
  }
  async function request(path,method='GET',body={}){
    if(path==='health')return {timezone:'America/Sao_Paulo',server_time:new Date().toISOString()};
    if(method==='GET')await IASDPIAuth.requireAccess();
    if(path==='chronogram')path='templates/liturgy-i';
    if(path.startsWith('templates/')){
      const id=path.slice(10),rows=await remote('iasdpi_templates?id=eq.'+encodeURIComponent(id)+'&select=plan');
      if(!rows[0])throw Error('Modelo não configurado. Confira a migração 003.');return rows[0].plan;
    }
    if(path==='programs'&&method==='GET')return list();
    const [,id,route]=path.split('/');
    if(id&&method==='GET')return get(id);
    if(route==='correct-date')throw Error('Altere a data pela edição do registro, preservando o mesmo ID.');
    const key=id&&route!=='duplicate'?id:'create:'+path;
    let candidate,expected;
    if(!pending.has(key)){
      try{const queued=(await outbox('list',null,lastActor)).find(row=>row.source===JSON.stringify([path,body]));if(queued)pending.set(key,queued);}catch(_){/* Sem fila local, a confirmação continua dependendo do servidor. */}
    }
    const existingPending=pending.get(key);
    if(existingPending){
      if(existingPending.source!==JSON.stringify([path,body])){
        const failure=Error('Há um envio pendente. Confira-o em Arquivo e banco antes de continuar.');
        if((state.programs.find(p=>p.id===id)?.version||0)>existingPending.args.p_expected_version){failure.code='40001';failure.conflict={id,expectedVersion:existingPending.args.p_expected_version,requestId:existingPending.args.p_request_id,uid:existingPending.uid,document:structuredClone(existingPending.args.p_document)};}
        throw failure;
      }
      candidate=existingPending.args.p_document;expected=existingPending.args.p_expected_version;
    }else{
      const current=id?(state.programs.find(p=>p.id===id)||await get(id)):null;
      candidate=IASDPILocalAdapter.apply(current?[current]:[],path,method,body);
      expected=(path==='programs'||route==='duplicate')?0:body.version;
    }
    const saving=commit(candidate,expected,false,key);
    if(pending.has(key))pending.get(key).source=JSON.stringify([path,body]);
    const saved=await saving;return saved.document;
  }
  async function releaseConflict(info,version){
    const access=await IASDPIAuth.requireAccess();
    if(info.uid!==access.user.id)throw Error('O envio pertence a outra conta.');
    const latest=await get(info.id);
    if(latest.version!==version||latest.version<=info.expectedVersion)throw Error('O registro mudou novamente. Reabra a comparação antes de reaplicar.');
    const queued=(await outbox('list',null,info.uid)).find(row=>row.args.p_request_id===info.requestId&&row.args.p_id===info.id&&row.args.p_expected_version===info.expectedVersion);
    if(queued)await outbox('delete',info.requestId,info.uid);
    for(const [key,value] of pending)if(value.uid===info.uid&&value.args.p_request_id===info.requestId&&value.args.p_id===info.id)pending.delete(key);
  }
  async function refreshTemplates(){
    templates=await remote('iasdpi_templates?select=id,plan,version,display_name&order=id');
    const visible=templates.filter(t=>t.display_name);
    if(!visible.some(t=>t.id==='liturgy-i')||!visible.some(t=>t.id==='free'))throw Error('Modelos Liturgia I/Livre indisponíveis; confira a migração 003.');
    cultoTemplates=visible.sort((a,b)=>(a.id==='liturgy-i'?-1:b.id==='liturgy-i'?1:a.id==='free'?-1:b.id==='free'?1:a.display_name.localeCompare(b.display_name))).map(t=>({id:t.id,label:t.display_name,name:t.plan.name||t.display_name,source:'templates/'+t.id}));
  }
  function panel(){
    return `<section class="panel"><h2>Persistência centralizada</h2><p>Registros e revisões ficam no Supabase e podem ser abertos em outro dispositivo autorizado. As cópias em culto_archives são independentes. Backup manual do navegador não é necessário a cada publicação.</p><div class="actions">${button('Atualizar registros do banco','operational-refresh')}${button('Conferir registros antigos deste navegador','operational-preview')}${button('Conferir envios pendentes','operational-pending')}</div>
    ${preview?`<h3>Prévia de importação opcional</h3>${preview.adjustments.length?`<p class="form-note" role="status">Compatibilidade: ${preview.adjustments.length} registros exigem adaptação explícita de formato para o banco (previstos HH:mm; horários reais associados à data em America/Sao_Paulo). Nenhum instante é deslocado. O documento original integral também será preservado no campo backup_source, além do backup de origem.</p><details><summary>Conferir adaptações antes de confirmar</summary><ul>${preview.adjustments.map(a=>`<li>${esc(a.id)}: ${esc([...new Set(a.changes)].join('; '))}</li>`).join('')}</ul></details>`:''}<p>Nenhum registro existente será sobrescrito. A cópia local será mantida integralmente.</p><div class="table-scroll"><table><thead><tr><th>Importar</th><th>Culto</th><th>Data / ID</th><th>Situação</th></tr></thead><tbody>${preview.rows.map(row=>`<tr><td>${row.status==='new'?`<input type="checkbox" data-import-id="${esc(row.id)}" checked aria-label="Importar ${esc(row.name)}">`:'—'}</td><td>${esc(row.name)}</td><td>${esc(displayDate(row.date))}<small>${esc(row.id)}</small></td><td>${esc({unavailable:'Indisponível: consulte um administrador',new:'Novo',exists:'Já importado',conflict:'Conflito: versão do banco preservada',duplicate:'Duplicado: já existe com outro ID',imported:'Importação confirmada'}[row.status]||row.status)}${row.reason?`<small>${esc(row.reason)}</small>`:''}</td></tr>`).join('')}</tbody></table></div>${button('Confirmar importação dos selecionados','operational-import','','class="primary"')}`:''}
    ${recoveries.length?`<h3>Envios pendentes neste dispositivo</h3><p>Reenviar reconfirma a mesma operação. Em caso de conflito, a versão do banco será preservada.</p><ul>${recoveries.map(row=>`<li>${esc(row.args.p_document.plan.name)} · ${esc(displayDate(row.args.p_document.plan.date))} ${button('Reenviar / conferir','operational-retry',row.args.p_request_id)} ${button('Descartar somente este envio','operational-discard',row.args.p_request_id)}</li>`).join('')}</ul>`:''}</section>
    ${templatePanel()}`;
  }
  function templatePanel(){
    if(!IASDPIAuth.isAdmin())return '';
    return `<section class="panel"><h2>Modelos de liturgia</h2><p>Administradores podem salvar a programação prevista de um culto como modelo. A execução real não é copiada.</p><form id="operational-template-form">${field('ID do modelo','model-id','','text',true,'pattern="[a-z0-9_-]{1,100}" placeholder="ex.: liturgia-ii"')}${field('Nome na lista','model-name','','text',true,'maxlength="200"')}<label>Programação de referência<select name="program-id">${state.programs.map(p=>`<option value="${esc(p.id)}">${esc(p.plan.name)} · ${esc(displayDate(p.plan.date))}</option>`).join('')}</select></label><button type="submit">Salvar modelo</button></form></section>`;
  }

  async function prepareImport(documents,raw=null){
    backupValidate({format:'IASDPI-backup',version:1,programs:documents});
    const candidates=[],blocked=[],adjustments=[];
    for(const original of documents){
      try{const candidate=operationalImportCandidate(original);candidates.push(candidate.document);if(candidate.changes.length)adjustments.push({id:original.id,changes:candidate.changes});}
      catch(error){blocked.push({id:original.id,name:original.plan.name,date:original.plan.date,status:'unavailable',reason:error.message});}
    }
    const rows=candidates.length?await remote('rpc/iasdpi_preview_import','POST',{p_documents:candidates}):[];
    preview={documents:candidates,rows:[...rows,...blocked],raw,adjustments};render();
  }
  async function importDocuments(documents){await prepareImport(documents);return {added:0,copies:0,preview:true};}
  async function action(action,id){
    await IASDPIAuth.requireAccess();
    if(action==='operational-refresh'){await loadPrograms();render();toast('Registros atualizados do Supabase.');}
    else if(action==='operational-preview'){
      const raw=localStorage.getItem('iasdpi-demo-v1');
      if(!raw)throw Error('Não há registros antigos neste navegador. Você pode cadastrar novos cultos normalmente.');
      await prepareImport(JSON.parse(raw),raw);
    }else if(action==='operational-import'){
      if(!preview)throw Error('Confira a prévia primeiro.');
      if(preview.raw!==null&&localStorage.getItem('iasdpi-demo-v1')!==preview.raw)throw Error('Os dados locais mudaram. Reabra a prévia.');
      const ids=[...document.querySelectorAll('[data-import-id]:checked')].map(input=>input.dataset.importId);
      for(const id of ids){
        const row=preview.rows.find(row=>row.id===id);if(row.status!=='new')continue;
        const result=await commit(preview.documents.find(p=>p.id===id),0,true,'import:'+id);
        row.status=result.status;render();
      }
      await loadPrograms();render();toast('Importações selecionadas confirmadas no Supabase. A cópia local foi preservada.');
    }else if(action==='operational-pending'){
      recoveries=await outbox('list');render();if(!recoveries.length)toast('Nenhum envio pendente neste dispositivo.');
    }else if(action==='operational-retry'){
      const row=recoveries.find(row=>row.args.p_request_id===id);if(!row)throw Error('Envio não encontrado.');
      await remote('rpc/iasdpi_save_program','POST',row.args);
      await outbox('delete',id);for(const [key,value] of pending)if(value.args.p_request_id===id)pending.delete(key);
      recoveries=await outbox('list');await loadPrograms();render();toast('Gravação reconfirmada pelo Supabase.');
    }else if(action==='operational-discard'){
      if(!confirm('Descartar apenas este envio pendente? O registro no Supabase não será alterado.'))return;
      await outbox('delete',id);for(const [key,value] of pending)if(value.args.p_request_id===id)pending.delete(key);
      recoveries=await outbox('list');render();
    }
  }
  async function saveTemplate(form){
    await refreshTemplates();
    const id=form.elements['model-id'].value,prior=templates.find(t=>t.id===id),program=await get(form.elements['program-id'].value);
    if(prior&&!confirm('Atualizar o modelo existente? Os cultos já registrados não serão alterados.'))return;
    await remote('rpc/iasdpi_save_template','POST',{p_id:id,p_expected_version:prior?.version||0,p_name:form.elements['model-name'].value,p_plan:program.plan});
    await refreshTemplates();toast('Modelo confirmado no Supabase.');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const banner=document.createElement('aside');banner.className='demo-banner';banner.textContent='SUPABASE · Registros compartilhados da IASD Parada Inglesa. Alterações são confirmadas pelo banco.';document.querySelector('.header').after(banner);
  });
  window.addEventListener('iasdpi-auth-changed',()=>{if(!IASDPIAuth.allowed()){pending.clear();templates=[];preview=null;recoveries=[];lastActor=null;}});
  return {request,refreshTemplates,panel,action,importDocuments,saveTemplate,releaseConflict,templatePanel};
})();

;
'use strict';
// Carregado somente por uma fonte autorizada, nunca incluído no HTML público.
window.IASDPIChronogram = null;
function cultoForDate(template,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!recordDay(date))throw Error('Selecione uma data válida para o culto.');
  const plan=structuredClone(template);plan.date=date;
  plan.name=plan.name.replace(/03\/10\/2026|2026-10-03/g,'').replace(/\s*[·—-]\s*$/,'').trim()||'Culto de sábado';
  for(const item of plan.items){delete item.planned_start;delete item.planned_end;}
  delete plan.planned_start;delete plan.planned_end;
  return plan;
}
function correctedCultoDate(original){
  if(original.execution_mode!=='manual'||original.plan.date!=='2026-10-03')throw Error('Este registro não corresponde à correção de 03/10 para 10/10/2026.');
  backupValidate({format:'IASDPI-backup',version:1,programs:[original]});
  const p=structuredClone(original),zone='America/Sao_Paulo';
  const shift=value=>{
    if(value==null)return value;
    if(typeof value!=='string'||!Number.isFinite(new Date(value).getTime()))throw Error('Há um horário inválido; nada será alterado.');
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date(value));
    if(day==='2026-10-10')return value;
    if(day!=='2026-10-03')throw Error('Há horários em outra data. Revise o registro antes de corrigir; nada foi alterado.');
    const prefix=new Date(new Date(value.slice(0,10)+'T12:00:00Z').getTime()+7*86400000).toISOString().slice(0,10);
    return prefix+value.slice(10);
  };
  p.plan.date='2026-10-10';
  p.plan.name=p.plan.name.replace(/03\/10\/2026/g,'10/10/2026').replace(/2026-10-03/g,'2026-10-10');
  for(const field of ['planned_start','planned_end'])if(p[field]!=null)p[field]=shift(p[field]);
  for(const item of p.plan.items)for(const field of ['planned_start','planned_end'])if(item[field]!=null)item[field]=shift(item[field]);
  for(const execution of Object.values(p.executions))for(const field of ['started','ended'])if(execution[field]!=null)execution[field]=shift(execution[field]);
  return p;
}
let cultoTemplates=[
  {id:'liturgy-i',label:'Liturgia I — Padrão',source:'chronogram',name:'Culto · Liturgia I'},
  {id:'free',label:'Livre — Sem atividades',source:null,name:'Culto livre'}
];
function saoPauloToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());}
async function draftFromTemplate(id){
  const model=cultoTemplates.find(model=>model.id===id);if(!model)throw Error('Selecione um modelo válido.');
  const date=saoPauloToday();
  const draft=window.IASDPIOperational?cultoForDate(await api('templates/'+id),date):model.source?cultoForDate(await api(model.source),date):{date,start:'',end:'',items:[],team:{}};
  return {...draft,name:model.name,template_id:model.id,execution_mode:'manual'};
}
function newCultoForm(){
  return heading('REGISTRO DO CULTO','Registro do Culto','Escolha um modelo e crie um registro com a data atual de São Paulo. A data poderá ser alterada.')+
    `<form id="new-record-form" class="panel"><label>Modelo da programação<select name="template-id">${cultoTemplates.map(model=>`<option value="${model.id}">${esc(model.label)}</option>`).join('')}</select></label><button class="primary" type="submit">Novo registro</button></form>`+
    `${state.programs.some(p=>p.execution_mode==='manual')?`<form id="open-record-form" class="panel"><label>Registro existente<select name="record-id">${state.programs.filter(p=>p.execution_mode==='manual').map(p=>`<option value="${esc(p.id)}">${esc(p.plan.name)} · ${esc(displayDate(p.plan.date))}</option>`).join('')}</select></label><button type="submit">Editar registro</button></form>`:''}`;
}
function actualClock(value) {
  const parsed=inspectRecordTime(value);return parsed.valid?parsed.clock.slice(0,8):'';
}
// Frações antigas são preservadas no dado; a interface sempre mostra HH:mm:ss.
const validActualTime=validRecordClock;
const displayActualTime=value=>{const parsed=inspectRecordTime(value);return parsed.empty?'':parsed.valid?parsed.clock.slice(0,8):String(value);};
const timeSeconds=value=>value?value.split(':').reduce((sum,part)=>sum*60+Number(part),0)*(value.length===5?60:1):null;
function storedActualClock(value){return recordClock(value);}
function actualRecordTimes(p,id){
  const extra=p?.extra_events?.find(e=>e.id===id),e=p?.executions?.[id];
  return extra?{...extra,start:recordClock(extra.start,p?.plan?.date),end:recordClock(extra.end,p?.plan?.date)}:{start:recordClock(e?.started,p?.plan?.date),end:recordClock(e?.ended,p?.plan?.date)||recordClock(p?.actual_details?.[id]?.partial_end,p?.plan?.date)};
}
function readActualTime(input,previous=''){
  const value=input.value.trim();
  if(input.dataset.timeEdited!=='true'&&validRecordClock(input.dataset.conflictClock)&&value===displayActualTime(input.dataset.conflictClock))return input.dataset.conflictClock;
  if(input.dataset.timeEdited!=='true'&&value===displayActualTime(previous)){
    const day=tryReadDate(input.closest('form')?.elements['record-date']?.value||'');
    if(importedTimeWarning(previous)||((!day||day===input.dataset.originalDay)&&importedTimeWarning(input.dataset.originalTime,day)))throw fieldError(input,'Corrija o horário importado inválido antes de salvar.');
    return previous;
  }
  if(value&&!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value))throw fieldError(input,'Use o formato 24 horas HH:mm:ss, com segundos (ex.: 14:05:35).');
  return displayActualTime(value);
}
function actualTimeField(label,name,value,index=0,day,context=`atividade ${index+1}`) {
  const warning=importedTimeWarning(value,day),warningId='time-warning-'+crypto.randomUUID();
  const control=field(label,name,displayActualTime(value),'text',false,`maxlength="8" placeholder="HH:mm:ss" inputmode="text" data-real-time="true" data-original-time="${esc(value??'')}" data-original-day="${esc(recordDay(day))}" autocomplete="off" aria-label="${label} — ${context}" ${warning?`aria-invalid="true" aria-describedby="${warningId}"`:''}`);
  return `<div class="actual-time-field">${control.replace('</label>',`${warning?`<span class="field-error" id="${warningId}" role="alert">${esc(warning)}</span>`:''}</label>`)}<button type="button" data-action="time-now" data-field="${name}" aria-label="Preencher ${label.toLowerCase()} — ${context} com a hora atual">Agora</button></div>`;
}
function transitions(p) {
  const original=p,day=recordDay(p.plan.date);
  const edge=(item,key)=>{
    const extra=original.extra_events?.find(e=>e.id===item.id);
    const raw=extra?{started:extra.start,ended:extra.end}:original.executions?.[item.id]||{};
    const parsed=inspectRecordTime(raw[key],day);
    return recordInterval(raw.started,raw.ended,day).state==='invalid'||!day||parsed.day!==day?null:parsed.epoch;
  };
  p=programForMetrics(p);
  if(p.extra_events?.length)p={...p,...registrationData(p)};
  const groups=[];
  for (const item of p.plan.items) {
    const previous=groups.at(-1);
    if(item.parallel && previous?.items[0].parallel && previous.items[0].start===item.start && previous.items[0].end===item.end)previous.items.push(item);
    else groups.push({items:[item]});
  }
  return groups.slice(1).map((group,index)=>{
    const prior=groups[index];
    const ends=prior.items.map(i=>edge(i,'ended'));
    const starts=group.items.map(i=>edge(i,'started'));
    const seconds=ends.every(v=>v!==null&&Number.isFinite(v))&&starts.every(v=>v!==null&&Number.isFinite(v))?(Math.min(...starts)-Math.max(...ends))/1000:null;
    return {from:prior.items.map(i=>i.activity).join(' / '),to:group.items.map(i=>i.activity).join(' / '),seconds};
  });
}
function transitionView(programs) {
  const all=programs.flatMap(p=>transitions(p).map(t=>({...t,event:p.plan.name}))),rows=all.filter(t=>t.seconds!==null&&Number.isFinite(t.seconds));
  return `<section class="section"><h2>Transição entre atividades</h2><p class="muted">Do término da atividade anterior ao início da próxima. Alerta acima de 30 segundos. Itens simultâneos formam um único grupo. ${rows.length} transições consideradas; ${all.length-rows.length} desconsideradas por horários ausentes ou inválidos.</p>${rows.length?`<div class="table-scroll"><table><thead><tr><th>Evento</th><th>De → Para</th><th>Transição</th><th>Situação</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.event)}</td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${Math.round(Math.abs(t.seconds))} s</td><td><span class="badge ${t.seconds>30?'critical':t.seconds<0?'warning':'good'}">${t.seconds>30?'Alerta: acima de 30 s':t.seconds<0?'Sobreposição':'Dentro de 30 s'}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Preencha o término de uma atividade e o início da próxima para calcular a transição.</p>'}</section>`;
}
const ministryOptions=['Min. Louvor','Min. Mordomia','Min. Louvor e/ou Ancianato'];
function activityLabel(plan,index) {
  const name=String(plan.items[index].activity||'Atividade sem título').replace(/^(Música Congregacional[^:]*):.*$/, '$1');
  if(!name.startsWith('Música Congregacional'))return name;
  const number=plan.items.slice(0,index+1).filter(i=>String(i.activity||'').startsWith('Música Congregacional')).length;
  return `${number}ª ${name}`;
}
function activityDetailsField(p,item,index) {
  const detail=p?.actual_details?.[item.id] || {};
  const defaultMinistry={'Ministério de Louvor':'Min. Louvor','Ministério Louvor':'Min. Louvor','Ministério da Mordomia':'Min. Mordomia','Ministério de Louvor e/ou Ancianato':'Min. Louvor e/ou Ancianato'}[item.responsible] || '';
  const responsible=detail.responsible ?? (defaultMinistry || item.responsible || '');
  const custom=responsible && !ministryOptions.includes(responsible);
  return `<div class="activity-details"><label>Observação<textarea name="activity-note" maxlength="2000" rows="1" placeholder="Observação da atividade" aria-label="Observação da atividade ${index+1}">${esc(detail.note ?? item.note ?? '')}</textarea></label><div><label>Responsável<select name="responsible-option" aria-label="Responsável da atividade ${index+1}"><option value="">Selecionar</option>${ministryOptions.map(name=>`<option value="${esc(name)}" ${responsible===name?'selected':''}>${esc(name)}</option>`).join('')}<option value="other" ${custom?'selected':''}>Outro responsável</option></select></label><input name="responsible-name" value="${esc(custom?responsible:'')}" maxlength="200" placeholder="Nome do responsável" aria-label="Nome do responsável da atividade ${index+1}" ${custom?'':'hidden'}></div></div>`;
}
function validateExtraEvents(p,input,finalize) {
  if(!Array.isArray(input)||input.length+p.plan.items.length>100)throw Error('Lista de eventos inválida ou maior que 100 atividades.');
  const ids=new Set(p.plan.items.map(i=>i.id)),positions=new Set();
  return input.map(e=>{
    if(!e || typeof e.id!=='string'||!e.id||e.id.length>200||ids.has(e.id)||!Number.isInteger(e.position)||e.position<0||e.position>=p.plan.items.length+input.length||positions.has(e.position))throw Error('Identificador ou posição de evento inválido.');
    ids.add(e.id);positions.add(e.position);
    for(const [name,limit] of [['activity',200],['note',2000],['responsible',200]])if(typeof e[name]!=='string'||e[name].length>limit)throw Error('Tema, observação ou responsável inválido.');
    if(!e.activity.trim())throw Error('Informe o tema do evento.');
    const valid=validActualTime;
    if(typeof e.start!=='string'||typeof e.end!=='string'||(e.start&&!valid(e.start))||(e.end&&(!valid(e.end)||(e.start&&timeSeconds(e.end)<timeSeconds(e.start)))))throw Error('Informe horários reais válidos para o evento.');
    const detail=validateActivityRecord(e,e.id);
    if(finalize&&(!e.start||!e.end))throw Error('Resolva os eventos extras antigos antes de finalizar.');
    return {...e,...detail,activity:e.activity,note:e.note,responsible:e.responsible};
  });
}
function registrationData(p) {
  const view=p?programForMetrics(p):{plan:IASDPIChronogram,executions:{}};
  const plan=structuredClone(view.plan),executions={...view.executions};
  for(const extra of [...(p?.extra_events || [])].sort((a,b)=>a.position-b.position)){
    plan.items.splice(Math.min(extra.position,plan.items.length),0,{id:extra.id,activity:extra.activity,block:'Culto',unplanned:true});
    if(extra.start)executions[extra.id]={started:inspectRecordTime(extra.start,recordDay(plan.date)).iso,ended:inspectRecordTime(extra.end,recordDay(plan.date)).iso};
  }
  return {plan,executions};
}
function actualRow(p,plan,i,index,executions) {
  const e=executions[i.id];
  const extra=(p?.extra_events || []).find(event=>event.id===i.id);
  const details=extra?{actual_details:{[i.id]:extra}}:p;
  return `<fieldset class="actual-row" data-id="${esc(i.id)}" ${i.unplanned?'data-extra="true"':`data-planned="${(validActualTime(i.start)&&validActualTime(i.end)?(timeSeconds(i.end)-timeSeconds(i.start))/60:'')}"`}><legend><span class="actual-number">${index+1}</span>. ${esc(i.block)}</legend><div class="actual-description">${i.unplanned?field('Tema do evento','extra-theme',i.activity,'text',true,'maxlength="200" placeholder="Ex.: 4ª música — tema"'):`<h3>${esc(activityLabel(plan,index))}</h3>`}<span class="muted">Previsto: ${i.unplanned?'Fora da liturgia':esc(displayPlannedTime(i.start))+' → '+(i.end_inferred?'não informado (referência: '+esc(displayPlannedTime(i.end))+')':esc(displayPlannedTime(i.end)))}</span>${activityDetailsField(details,i,index)}</div><div class="actual-inputs">${actualTimeField('Início real','start',extra?.start??p?.executions?.[i.id]?.started??'',index,plan.date)}${actualTimeField('Término real','end',extra?.end??p?.executions?.[i.id]?.ended??p?.actual_details?.[i.id]?.partial_end??'',index,plan.date)}<output class="actual-difference muted">Aguardando horários</output></div><div class="actual-row-actions">${button('Adicionar subatividade','add-subactivity')}${i.unplanned?button('Remover evento','remove-extra','','class="danger-text"'):''}</div><div class="subactivities" aria-label="Subatividades de ${esc(i.activity)}">${(details?.actual_details?.[i.id]?.subactivities||[]).map(child=>subactivityRow(child,i.id,plan.date)).join('')}</div></fieldset>`;
}
function addExtraEvent(target) {
  const form=document.querySelector('#actuals-form'),rows=form.querySelectorAll('.actual-row');
  if(rows.length>=100)throw Error('Limite de 100 atividades por culto.');
  const item={id:crypto.randomUUID(),activity:'',block:'Culto',unplanned:true};
  const row=target.closest('.actual-row');
  const html=actualRow(null,{items:[item]},item,0,{});
  if(row)row.insertAdjacentHTML('afterend',html);else form.querySelector('.actuals-list').insertAdjacentHTML('beforeend',html);
  const added=row?row.nextElementSibling:form.querySelector('.actuals-list').lastElementChild;
  form.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);
  added.querySelector('[name="extra-theme"]').focus();updateActuals();
}
function summaryActivityRows(p){
  const {plan,executions}=registrationData(p);
  return plan.items.map((i,index)=>{
    const e=executions[i.id],extra=p.extra_events?.find(x=>x.id===i.id),details=extra||p.actual_details?.[i.id]||{};
    const source=extra?{started:extra.start,ended:extra.end}:p.executions?.[i.id]||{};
    const actual=recordInterval(source.started,source.ended??details.partial_end,recordDay(p.plan.date));
    const planned=i.unplanned?null:recordInterval(i.planned_start,i.planned_end,recordDay(p.plan.date)).minutes,real=actual.minutes;
    return `<tr><td>${esc(activityLabel(plan,index))}${i.unplanned?'<small>Fora da liturgia</small>':''}<small>${esc(details.responsible??i.responsible??'')}</small>${details.note?`<small>${esc(details.note)}</small>`:''}${subactivitiesSummary(details)}</td><td>${i.unplanned?'Fora da liturgia':esc(displayPlannedTime(i.start))+' → '+esc(displayPlannedTime(i.end))}</td><td>${displayActualTime(actualClock(e?.started))||'—'} → ${displayActualTime(actualClock(e?.ended))||'—'}</td><td>${planned===null?'—':duration(planned)}</td><td>${real===null?'—':duration(real)}</td><td>${real===null||planned===null?'—':badge(real-planned,signed(real-planned))}</td></tr>`;
  }).join('');
}
function extraEventsSummary(p) {
  if(!p.extra_events?.length)return '';
  return `<section class="section"><h2>Eventos fora da liturgia</h2><div class="table-scroll"><table><thead><tr><th>Tema</th><th>Horários reais</th><th>Responsável / observação</th></tr></thead><tbody>${p.extra_events.map(e=>`<tr><td>${esc(e.activity)}<small>Previsto: Fora da liturgia</small></td><td>${esc(displayActualTime(e.start) || '—')} → ${esc(displayActualTime(e.end) || '—')}</td><td>${esc(e.responsible)}${e.note?`<small>${esc(e.note)}</small>`:''}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function actualsForm(p) {
  if(!p&&!window.IASDPIChronogram)return newCultoForm();
  const {plan,executions}=registrationData(p);
  return heading('REGISTRO DO CULTO', 'Registrar culto', `${esc(dateLabel(plan.date))} · ${esc(plan.name)}`, `<div class="actions">${p?button('Editar registro','edit-record',p.id):''}${!p||['Planejamento','Pronta'].includes(p.status)?button('Editar programação prevista','edit-record-plan',p?.id||''):''}${button('Voltar às programações','programs')}</div>`) +
    `<section class="planned-bar"><span>Previsto <strong>${esc(displayPlannedTime(plan.start||'—'))} → ${esc(displayPlannedTime(plan.end||'—'))}</strong></span><span class="badge neutral">Registro manual</span></section>
    <details class="panel"><summary>Equipe da programação</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role==='Responsável pela programação'?'Ministração do Culto':role)}</dt><dd>${esc((plan.team||{})[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>
    ${plan.items.some(i=>i.end_inferred) ? '<p class="form-note">O término dos anúncios não foi informado no cronograma. A referência de 10:05, início do próximo item, será usada apenas para comparar a duração. Os itens das 10:10 são simultâneos.</p>' : ''}
    <form id="actuals-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="registration-savebar" data-state="${p?'saved':'dirty'}" role="region" aria-label="Salvar registro do culto">
        <p id="registration-save-status" role="status" aria-live="polite" aria-atomic="true">${p?(window.IASDPIOperational?'Registro existente · salvo no Supabase.':window.IASDPIDemo?'Registro existente · salvo neste navegador.':'Registro existente · salvo no servidor local.'):'Novo registro · ainda não salvo.'}</p>
        <button type="submit" name="save" formnovalidate class="primary">Salvar alterações</button>
      </section>
      <div class="notes-grid">${field('Nome do culto','record-name',plan.name,'text',true,'maxlength="200"')}${field('Data do culto','record-date',plan.date,'date',true)}${!recordDay(plan.date)?'<span class="field-error" role="alert">Data importada inválida. Informe a data do culto para salvar.</span>':''}</div>

      <div class="section-heading"><h2>O que aconteceu no culto?</h2><span id="actuals-progress" class="muted"></span></div>
      <p class="muted">Para finalizar, preencha início e término de cada atividade no formato 24 horas HH:mm:ss. Durante o culto, os horários podem ficar em branco. Subatividades não alteram o planejamento nem somam duração. Responsável e observação são opcionais. Salvar registro permite guardar o preenchimento parcial e continuar depois.</p>
      <div class="actuals-list">${plan.items.map((i,index)=>actualRow(p,plan,i,index,executions)).join('')}</div>

      <div id="actual-transitions"></div>
      <section class="section"><h2>Observações</h2><div class="notes-grid"><div><label for="manual-note">Observações do culto</label><textarea id="manual-note" name="note" maxlength="5000" rows="3">${esc(p?.note || '')}</textarea></div><div><label for="manual-incident">Ocorrência não prevista</label><textarea id="manual-incident" name="incident" maxlength="5000" rows="3">${esc(p?.incident || '')}</textarea></div></div></section>
      <section class="section"><label>Informações complementares<textarea name="record-info" rows="2" maxlength="5000">${esc(p?.record_info||'')}</textarea></label></section>
      <div class="actions manual-actions">${button('Cancelar edição','cancel-record',p?.id||'')}<button type="submit" class="primary" name="finalize">Finalizar e ver resumo</button></div>
    </form>`;
}
function updateActuals() {
  const form=document.querySelector('#actuals-form');if(!form)return;
  refreshSubactivityLabels();
  let completed=0;
  const rows=[...form.querySelectorAll('.actual-row')];
  rows.forEach(row=>{
    const start=row.querySelector('[name="start"]').value, end=row.querySelector('[name="end"]').value;
    const output=row.querySelector('output');output.className='actual-difference muted';
    if(start && end && validActualTime(start) && validActualTime(end)){
      const real=(timeSeconds(end)-timeSeconds(start))/60;
      if(real<0){output.textContent='Término anterior ao início';output.className='actual-difference critical';}
      else if(row.dataset.extra){completed++;output.textContent=`${duration(real)} realizados · Fora da liturgia`;}
      else if(row.dataset.planned===''){output.textContent='Horário previsto inconsistente. Revise a programação.';}
      else{completed++;const diff=real-Number(row.dataset.planned);output.textContent=`${duration(real)} realizados · ${signed(diff)} de diferença`;output.className=`actual-difference ${statusTone(diff)}`;}
    }else output.textContent=end&&!start?'Informe o início real':start?'Falta o término real':'Aguardando horários';
  });
  const originalPlan=selected()?.plan || window.IASDPIChronogram;if(!originalPlan)return;
  const plan=structuredClone(originalPlan);plan.date=tryReadDate(form.elements['record-date'].value)||plan.date;
  plan.items=rows.map(row=>plan.items.find(i=>i.id===row.dataset.id)||{id:row.dataset.id,activity:row.querySelector('[name="extra-theme"]').value || 'Novo evento',unplanned:true});
  const executions=Object.fromEntries(rows.map(row=>[row.dataset.id,Object.fromEntries([['start','started'],['end','ended']].map(([name,key])=>{const v=row.querySelector(`[name="${name}"]`).value;return [key,v&&validActualTime(v)?inspectRecordTime(v,recordDay(plan.date)).iso:null];}))]));
  document.querySelector('#actual-transitions').innerHTML=transitionView([{plan,executions}]);
  document.querySelector('#actuals-progress').textContent=`${completed} de ${rows.length} atividades completas`;
  refreshScrollableTables();
}
async function saveActuals(form,finalize,draftSave=window.IASDPIDrafts?.beginSave(form)){
  let p=state.programs.find(record=>record.id===form.dataset.id)||null;
  const base=p||{plan:window.IASDPIChronogram};
  const date=readDateField(form.elements['record-date']);
  let recordPlan;try{recordPlan=recordEditPlan(base,{record_name:form.elements['record-name'].value,record_date:date});}
  catch(error){throw fieldError(form.elements['record-name'],error.message);}
  if(finalize&&!recordPlan.items.length)throw Error('Adicione atividades na edição da programação prevista antes de finalizar.');
  const records={},extra_events=[];
  const rows=[...form.querySelectorAll('.actual-row')];
  for(const [position,row] of rows.entries()){
    const id=row.dataset.id,previous=actualRecordTimes(p,id);
    for(const title of row.querySelectorAll('.subactivity [name="sub-title"]'))if(!title.value.trim())throw fieldError(title,'Informe o título da subatividade.');
    const subactivities=[...row.querySelectorAll('.subactivity')].map(child=>({...((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)||{}),id:child.dataset.subId,parent_id:child.dataset.parentId,title:child.querySelector('[name="sub-title"]').value,responsible:child.querySelector('[name="sub-responsible"]').value,note:child.querySelector('[name="sub-note"]').value,start:readActualTime(child.querySelector('[name="sub-start"]'),recordClock((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)?.start,p?.plan?.date)),end:readActualTime(child.querySelector('[name="sub-end"]'),recordClock((p?.actual_details?.[id]||p?.extra_events?.find(e=>e.id===id))?.subactivities?.find(s=>s.id===child.dataset.subId)?.end,p?.plan?.date))}));
    let record={start:readActualTime(row.querySelector('[name="start"]'),previous.start),end:readActualTime(row.querySelector('[name="end"]'),previous.end),note:row.querySelector('[name="activity-note"]').value,responsible:row.querySelector('[name="responsible-option"]').value==='other'?row.querySelector('[name="responsible-name"]').value:row.querySelector('[name="responsible-option"]').value,subactivities};
    if(record.start&&record.end&&timeSeconds(record.end)<timeSeconds(record.start))throw fieldError(row.querySelector('[name="end"]'),'O término real não pode ser anterior ao início.');
    record=validateActivityRecord(record,id);
    if(finalize&&(!record.start||!record.end))throw fieldError(row.querySelector(record.start?'[name="end"]':'[name="start"]'),'Preencha início e término desta atividade para finalizar.');
    if(row.dataset.extra){
      const previous=p?.extra_events?.find(e=>e.id===id)||{};
      extra_events.push({...previous,id,position,activity:row.querySelector('[name="extra-theme"]').value,...record});
    }else records[id]=record;
  }
  // Todas as validações precedem a criação de um registro novo.
  validateExtraEvents({plan:recordPlan},extra_events,finalize);
  if(!form.dataset.id){
    p=await api('programs','POST',{...structuredClone(window.IASDPIChronogram),name:recordPlan.name,date:recordPlan.date});
    replaceProgram(p);state.selected=p.id;form.dataset.id=p.id;form.dataset.version=p.version;
    await window.IASDPIDrafts?.bind(form,p,draftSave?.context);
    IASDPINavigation.identify('actuals',p.id);
  }
  p=await api(`programs/${form.dataset.id}/actuals`,'PUT',{version:Number(form.dataset.version),executions:records,extra_events,record_name:recordPlan.name,record_date:recordPlan.date,record_info:form.elements['record-info'].value,note:form.elements.note.value,incident:form.elements.incident.value,finalize});
  const newer=await window.IASDPIDrafts?.saved(draftSave,p);
  if(!newer)registrationDirty=false;
  const stillEditing=form.isConnected,previousSelected=state.selected;replaceProgram(p);
  if(!stillEditing)state.selected=previousSelected;else if(!newer)navigate(finalize?'summary':'actuals',p.id,{replace:!finalize,refresh:true});
  const message=window.IASDPIOperational?'Alterações confirmadas e salvas no Supabase.':window.IASDPIDemo?'Alterações salvas neste navegador. Nenhuma gravação na nuvem.':'Alterações salvas no servidor local.';
  const currentForm=stillEditing&&!newer&&!finalize?document.querySelector('#actuals-form'):form;
  setRegistrationSaveState(currentForm,newer?'dirty':'saved',newer?'Envio confirmado. Alterações mais recentes continuam em rascunho local.':message);
  toast(message);
}
let registrationDirty=false;
function validateSubactivities(input,parentId,start,end){
  if(!Array.isArray(input)||input.length>50)throw Error('Limite de 50 subatividades por atividade.');
  const ids=new Set();const valid=validActualTime;
  return input.map(s=>{
    if(!s||typeof s.id!=='string'||!s.id||s.id.length>200||ids.has(s.id)||s.parent_id!==parentId)throw Error('Vínculo de subatividade inválido.');ids.add(s.id);
    for(const [key,limit] of [['title',200],['responsible',200],['note',2000]])if(typeof s[key]!=='string'||s[key].length>limit)throw Error('Dados da subatividade inválidos.');
    if(!s.title.trim())throw Error('Informe o título da subatividade.');
    if(typeof s.start!=='string'||typeof s.end!=='string'||(s.start&&!valid(s.start))||(s.end&&!valid(s.end)))throw Error('Horários da subatividade inválidos.');
    if((s.start||s.end)&&(!start||!end))throw Error('Preencha o intervalo real completo da atividade principal antes de informar horários da subatividade.');
    if((s.start&&(timeSeconds(s.start)<timeSeconds(start)||timeSeconds(s.start)>timeSeconds(end)))||(s.end&&(timeSeconds(s.end)<timeSeconds(start)||timeSeconds(s.end)>timeSeconds(end)))||(s.start&&s.end&&timeSeconds(s.end)<timeSeconds(s.start)))throw Error('Os horários da subatividade devem ficar dentro do intervalo real da atividade principal.');
    return {...s};
  });
}
function validateActivityRecord(record,id){
  if(record.partial_end!==undefined&&(typeof record.partial_end!=='string'||(record.partial_end&&!validActualTime(record.partial_end))))throw Error('Horário parcial inválido.');
  if((record.start&&!validActualTime(record.start))||(record.end&&!validActualTime(record.end)))throw Error('Horários reais inválidos.');
  if(record.start&&record.end&&timeSeconds(record.end)<timeSeconds(record.start))throw Error('Término anterior ao início.');
  const subactivities=validateSubactivities(record.subactivities??[],id,record.start,record.end);
  return {...record,subactivities};
}
function recordEditPlan(p,body){
  const plan=structuredClone(p.plan),date=recordDay(body.record_date??plan.date),name=body.record_name??plan.name;
  plan.start=plannedClock(plan.start);plan.end=plannedClock(plan.end);
  for(const item of plan.items){item.start=plannedClock(item.start);item.end=plannedClock(item.end);}
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!recordDay(date))throw Error('Data do culto inválida.');
  if(typeof name!=='string'||!name.trim()||name.length>200)throw Error('Nome do culto inválido.');
  if(date!==plan.date)for(const item of plan.items){item.planned_start=recordInstant(date,item.start);item.planned_end=recordInstant(date,item.end);}
  plan.date=date;plan.name=name===p.plan.name?name:name.trim();return plan;
}
function subactivityRow(s={},parentId,day){
  return `<fieldset class="subactivity" data-sub-id="${esc(s.id||crypto.randomUUID())}" data-parent-id="${esc(s.parent_id??parentId)}"><legend>Subatividade</legend><div class="notes-grid">${field('Título','sub-title',s.title||'','text',true,'maxlength="200"')}${field('Responsável','sub-responsible',s.responsible||'','text',false,'maxlength="200"')}${actualTimeField('Início real (opcional)','sub-start',s.start||'',0,day)}${actualTimeField('Término real (opcional)','sub-end',s.end||'',0,day)}</div><label>Observação<textarea name="sub-note" rows="2" maxlength="2000">${esc(s.note||'')}</textarea></label><button type="button" data-action="remove-subactivity" class="danger-text">Excluir subatividade</button></fieldset>`;
}
function refreshSubactivityLabels(){
  document.querySelectorAll('#actuals-form .actual-row').forEach((row,parentIndex)=>{
    const activity=row.querySelector('.actual-description h3')?.textContent||row.querySelector('[name="extra-theme"]')?.value||'Atividade sem título';
    row.querySelectorAll('.subactivity').forEach((child,index)=>{
      const title=child.querySelector('[name="sub-title"]')?.value||'sem título';
      const context=`Atividade ${parentIndex+1}: ${activity} / Subatividade ${index+1}: ${title}`;
      child.querySelector('legend').textContent=`Subatividade ${index+1}`;
      const labels={'sub-title':'Título','sub-responsible':'Responsável','sub-note':'Observação','sub-start':'Início real (opcional)','sub-end':'Término real (opcional)'};
      for(const [name,label] of Object.entries(labels))child.querySelector(`[name="${name}"]`)?.setAttribute('aria-label',`${label} — ${context}`);
      child.querySelectorAll('[data-action="time-now"]').forEach(button=>button.setAttribute('aria-label',`Preencher ${labels[button.dataset.field]} — ${context} com a hora atual`));
      child.querySelector('[data-action="remove-subactivity"]')?.setAttribute('aria-label',`Excluir ${context}`);
    });
  });
}
function subactivitiesSummary(detail){
  if(!detail?.subactivities?.length)return '';
  return `<ul class="subactivities-summary">${detail.subactivities.map(s=>`<li><strong>${esc(s.title)}</strong>${s.start||s.end?` · ${esc(displayActualTime(s.start)||'—')} → ${esc(displayActualTime(s.end)||'—')}`:''}${s.responsible?`<small>${esc(s.responsible)}</small>`:''}${s.note?`<small>${esc(s.note)}</small>`:''}</li>`).join('')}</ul>`;
}
function markRegistrationDirty(){registrationDirty=true;const form=document.querySelector('#actuals-form');const saving=form?.querySelector('.registration-savebar')?.dataset.state==='saving';setRegistrationSaveState(form,saving?'saving':'dirty',saving?'Envio em andamento. Há alterações mais recentes pendentes.':'Alterações pendentes · ainda não salvas.');}
function canLeaveRegistration(){
  if(window.IASDPIDrafts)return IASDPIDrafts.canLeave();
  if(!registrationDirty)return true;
  if(!window.confirm('Descartar as alterações não salvas deste registro?'))return false;
  registrationDirty=false;return true;
}
window.addEventListener('beforeunload',event=>{if(!window.IASDPIDrafts&&registrationDirty){event.preventDefault();event.returnValue='';}});

// Somente apresentação: o envio continua no mesmo formulário e nas mesmas RPCs.
function setRegistrationSaveState(form,phase,message){
  const bar=form?.querySelector('.registration-savebar'),status=bar?.querySelector('#registration-save-status');
  if(!bar||!status)return;
  bar.dataset.state=phase;bar.setAttribute('aria-busy',String(phase==='saving'));
  status.setAttribute('aria-live',phase==='error'?'assertive':'polite');
  status.textContent=message;
}
function refreshScrollableTables(){
  for(const wrapper of document.querySelectorAll('.table-scroll')){
    const scrollable=wrapper.scrollWidth>wrapper.clientWidth+1;
    if(scrollable){
      wrapper.tabIndex=0;wrapper.setAttribute('role','region');
      const title=wrapper.closest('section')?.querySelector('h2')?.textContent||wrapper.querySelector('th')?.textContent||'Dados';
      wrapper.setAttribute('aria-label',`Tabela: ${title}. Rolagem horizontal disponível.`);
    }else{wrapper.removeAttribute('tabindex');wrapper.removeAttribute('role');wrapper.removeAttribute('aria-label');}
  }
}
const pageLayout=(()=>{
  let resizeObserver=null,draftObserver=null;
  function floating(){const candidate=document.querySelector('.registration-savebar,.execution-actions .big');return candidate&&getComputedStyle(candidate).position==='fixed'?candidate:null;}
  function measure(){
    const bar=floating(),root=document.documentElement;
    if(!bar){root.style.removeProperty('--registration-bar-height');root.style.removeProperty('--registration-viewport-inset');return;}
    const viewport=window.visualViewport;
    const inset=viewport&&viewport.scale===1?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
    root.style.setProperty('--registration-viewport-inset',inset+'px');
    root.style.setProperty('--registration-bar-height',Math.ceil(bar.getBoundingClientRect().height)+'px');
  }
  function revealField(){
    const input=document.activeElement,bar=floating();
    if(!bar||!input?.matches('input,select,textarea')||!input.closest('#actuals-form,#notes-form'))return;
    const bounds=input.getBoundingClientRect(),top=(window.visualViewport?.offsetTop||0)+12,bottom=bar.getBoundingClientRect().top-12;
    if(bounds.bottom>bottom)window.scrollBy({top:bounds.bottom-bottom,behavior:'instant'});
    else if(bounds.top<top)window.scrollBy({top:bounds.top-top,behavior:'instant'});
  }
  function resized(){measure();refreshScrollableTables();requestAnimationFrame(revealField);}
  function mount(){
    resizeObserver?.disconnect();draftObserver?.disconnect();
    const form=document.querySelector('#actuals-form'),bar=form?.querySelector('.registration-savebar');
    const control=floating();if(control){resizeObserver=new ResizeObserver(measure);resizeObserver.observe(control);}
    if(bar){
      draftObserver=new MutationObserver(()=>{
        if(form.isConnected&&registrationDirty&&bar.dataset.state==='saved'&&form.querySelector('.draft-feedback'))
          setRegistrationSaveState(form,'dirty','Rascunho recuperado ou alterado · ainda não salvo.');
      });
      draftObserver.observe(form,{childList:true,subtree:true});
    }
    measure();refreshScrollableTables();
  }
  window.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('resize',resized);
  window.visualViewport?.addEventListener('scroll',measure);
  document.addEventListener('focusin',()=>requestAnimationFrame(revealField));
  return {mount};
})();

;
'use strict';
const agendaInitialDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const agendaState={month:agendaInitialDate.slice(0,7),area:'church',department:'all',view:'calendar',showPeople:true,day:agendaInitialDate};
const ministrySchedules={'Comunicação':[
  {date:'2026-10-03',person:'Henrique'},{date:'2026-10-10',person:'Izabelle PI Souza'},
  {date:'2026-10-17',person:'Simone/Profªde Pilates 🧘'},{date:'2026-10-24',person:'macedo Logos'},
  {date:'2026-10-31',person:'Letícia PI'}
], 'Sonoplastia':[
  {date:'2026-10-03',person:'Mini Lucas'},{date:'2026-10-04',person:'Rafa'},
  {date:'2026-10-07',person:'Samuel'},{date:'2026-10-10',person:'Luan'},
  {date:'2026-10-11',person:'Macedo'},{date:'2026-10-14',person:'Paulitos'},
  {date:'2026-10-17',person:'Mini Lucas'},{date:'2026-10-18',person:'Raphael'},
  {date:'2026-10-21',person:'Luan'},{date:'2026-10-24',person:'Mini Lucas'},
  {date:'2026-10-25',person:'Rafa'},{date:'2026-10-28',person:'Luan'},
  {date:'2026-10-31',person:'Raphael'},{date:'2026-11-01',person:'Raphael'},
  {date:'2026-11-04',person:'Paulitos'}
]};
const soundScheduleInfo={title:'Escala de Sonoplastia — Outubro de 2026',instruction:'Em caso de impedimento, avisar antecipadamente no grupo responsável.'};
function agendaWeekday(date){const name=new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));return name[0].toLocaleUpperCase('pt-BR')+name.slice(1);}
function agendaSource(){return window.IASDPIAgendaData || {status:'pending',events:[]};}
const agendaDateAdd=(day,amount)=>new Date(new Date(day+'T12:00:00Z').getTime()+amount*86400000).toISOString().slice(0,10);
function agendaPeriod(e){return e.startDate===e.endDate?programDate(e.startDate):`${programDate(e.startDate)} → ${programDate(e.endDate)}`;}
function agendaOverlaps(e,start,end){return e.startDate<=end && e.endDate>=start;}
function agendaMonthBounds(month){const first=month+'-01',date=new Date(first+'T12:00:00Z');return [first,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).toISOString().slice(0,10)];}
function agendaEvents(){
  const grouped=[];
  for(const e of agendaSource().events.filter(e=>e.kind==='event').sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title))){
    const previous=grouped.findLast(p=>(p.allDay||p.wholeDay)&&(e.allDay||e.wholeDay)&&p.title===e.title&&p.department===e.department&&p.location===e.location&&agendaDateAdd(p.endDate,1)===e.startDate);
    if(previous){previous.end=e.end;previous.endDate=e.endDate;previous.sourceIds.push(e.id);}
    else grouped.push({...e,sourceIds:[e.id]});
  }
  return grouped.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
function agendaIssues(e,events){
  const flags=[];
  if(!(e.allDay||e.wholeDay)&&events.some(other=>other.id!==e.id&&!(other.allDay||other.wholeDay)&&new Date(e.start)<new Date(other.end)&&new Date(e.end)>new Date(other.start)))flags.push('Horários simultâneos · conferir');
  if(events.some(other=>other.id!==e.id&&e.title===other.title&&e.startDate===other.startDate&&e.start!==other.start))flags.push('Mesmo nome em horários diferentes');
  const anniversary=e.title.match(/(\d+)\s*Anos da Escola Sabatina/i);
  if(anniversary&&events.some(other=>{const match=other.title.match(/(\d+)\s*Anos da Escola Sabatina/i);return match&&match[1]!==anniversary[1]&&other.startDate===e.startDate;}))flags.push('Número do aniversário divergente');
  return flags;
}
function agendaEventList(events,allMonth){
  if(!events.length)return empty('Nenhum evento neste período','Escolha outro departamento, dia ou mês.');
  return `<ul class="church-events">${events.map(e=>`<li><div class="church-event-date"><span>${esc(agendaPeriod(e))}</span><strong>${e.allDay||e.wholeDay?'Dia inteiro':esc(displayPlannedTime(e.start)+' → '+displayPlannedTime(e.end))}</strong></div><div class="church-event-body"><h3>${esc(e.title)}</h3><p>${esc(e.department || 'Departamento não informado')}${e.location?' · '+esc(e.location):''}</p>${e.sourceIds.length>1?`<small class="muted">Período agrupado · ${e.sourceIds.length} registros da fonte preservados</small>`:''}<div class="agenda-flags">${agendaIssues(e,allMonth).map(flag=>`<span class="badge warning">${esc(flag)}</span>`).join('')}</div></div></li>`).join('')}</ul>`;
}
function agendaResponsibles(start,end){
  const month=agendaSource().events.filter(e=>e.kind==='monthly'&&agendaOverlaps(e,start,end));
  const weekly=agendaSource().events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start));
  const selected=weekly.filter(e=>agendaOverlaps(e,agendaState.day,agendaState.day));
  const names=e=>agendaState.showPeople?esc(e.person):'Escala definida';
  return `<section class="agenda-responsibles" aria-label="Anciãos responsáveis"><div class="panel"><p class="eyebrow">ANCIÃO DO MÊS</p>${month.length?month.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado no calendário para este mês.</p>'}</div><div class="panel"><p class="eyebrow">ANCIÃO DA SEMANA · DATA SELECIONADA</p>${selected.length?selected.map(e=>`<h2>${names(e)}</h2><p class="muted">${esc(agendaPeriod(e))}</p>`).join(''):'<p>Não informado para a data selecionada.</p>'}</div></section>
  <details class="panel agenda-weeks" ${agendaState.month!==today().slice(0,7)?'open':''}><summary>Escalas semanais do mês · ${weekly.length}</summary>${weekly.length?`<ul>${weekly.map(e=>`<li><strong>${names(e)}</strong><span>${esc(agendaPeriod(e))}</span></li>`).join('')}</ul>`:'<p class="muted">Nenhuma escala semanal neste período.</p>'}</details>`;
}
// Origem dos dados, sem atribuir uma sincronização oficial às escalas manuais.
function agendaProvenance(area,source=agendaSource()){
  if(area==='communication'||area==='sound'){
    const ministry=area==='communication'?'Comunicação':'Sonoplastia',dates=ministrySchedules[ministry].map(e=>e.date).sort();
    return `<section class="agenda-source form-note" aria-label="Fonte da escala" data-source="manual"><strong>Origem: escala manual de ${esc(ministry)}${area==='sound'?' fornecida pela liderança':''}</strong><p>${area==='sound'?'Fornecida pela liderança.':'Informada à aplicação e mantida no código.'} Não é sincronizada automaticamente com o calendário oficial.</p><p>Última atualização da escala: não informada. Vigência: ${dates.length?esc(displayDate(dates[0])+' a '+displayDate(dates.at(-1))):'não definida; nenhuma escala cadastrada'}.</p>${area==='sound'&&dates.length?`<p>Documento: Outubro de 2026 · ${dates.length} datas. Inclui também 01/11/2026 e 04/11/2026; selecione novembro para consultar essas datas.</p><p class="schedule-instruction">${esc(soundScheduleInfo.instruction)}</p>`:''}</section>`;
  }
  const valid=source.syncedAt&&inspectRecordTime(source.syncedAt).valid,stale=valid&&currentTime()-new Date(source.syncedAt)>86400000;
  return `<section class="agenda-source muted" aria-label="Fonte da agenda" data-source="official"><strong>Origem: calendário oficial da igreja (Google Calendar)</strong><p>${source.status==='synced'&&valid?`Fonte oficial consultada em ${esc(displayRecordTimestamp(source.syncedAt))}.${stale?' A última sincronização tem mais de 24 horas.':''}`:'Aguardando sincronização com o calendário oficial.'} Esta página usa uma cópia publicada; abrir ou atualizar o navegador não consulta novamente o calendário.</p><p>Período importado: ${source.fromMonth&&source.toMonth?esc(source.fromMonth.split('-').reverse().join('/')+' a '+source.toMonth.split('-').reverse().join('/')):'não informado'}. <a href="https://iasd-paradainglesa.netlify.app/" target="_blank" rel="noopener noreferrer">Consultar fonte oficial ↗</a></p></section>`;
}
function agendasPage(){
  const {month,area,department,view,day,showPeople}=agendaState,[start,end]=agendaMonthBounds(month);
  const source=agendaSource(),allMonth=agendaEvents().filter(e=>agendaOverlaps(e,start,end));
  const events=allMonth.filter(e=>department==='all'||e.department===department);
  const departments=[...new Set(agendaSource().events.filter(e=>e.kind==='event').map(e=>e.department||'Não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const ministry=area==='elders'?'Anciãos':area==='communication'?'Comunicação':'Sonoplastia';
  const scale=area==='elders'?source.events.filter(e=>e.kind==='weekly'&&agendaOverlaps(e,start,end)).sort((a,b)=>a.start.localeCompare(b.start)).map(e=>({...e,date:e.startDate<start?start:e.startDate})):area==='church'?[]:ministrySchedules[ministry].filter(e=>e.date.startsWith(month));
  const monthDate=new Date(start+'T12:00:00Z'),monthTitle=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthDate);
  return heading('ORGANIZAÇÃO','Escalas e agendas','Anciãos, programação da igreja e escalas dos ministérios.')+
    `${agendaProvenance(area,source)}${!['communication','sound'].includes(area)&&source.fromMonth && (month<source.fromMonth||month>source.toMonth)?'<p class="form-note">Este mês está fora do período importado. Uma nova sincronização é necessária para verificar os registros.</p>':''}
    <section class="panel agenda-filters"><label for="agenda-area">Consultar<select id="agenda-area"><option value="church" ${area==='church'?'selected':''}>Agenda da igreja</option><option value="communication" ${area==='communication'?'selected':''}>Escala de Comunicação</option><option value="elders" ${area==='elders'?'selected':''}>Escala de Anciãos</option><option value="sound" ${area==='sound'?'selected':''}>Escala de Sonoplastia</option></select></label>${area==='church'?`<label for="agenda-department">Departamento<select id="agenda-department"><option value="all">Todos os departamentos</option>${departments.map(name=>`<option value="${esc(name)}" ${name===department?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`:''}<label class="checkbox"><input id="agenda-show-people" type="checkbox" ${showPeople?'checked':''}> Mostrar pessoa escalada</label></section>
    <section class="panel agenda-toolbar"><div class="agenda-month"><button type="button" data-action="agenda-previous" aria-label="Mês anterior">‹</button><h2 id="agenda-month-title">${esc(monthTitle)}</h2><button type="button" data-action="agenda-next" aria-label="Próximo mês">›</button></div><div class="agenda-controls"><label for="agenda-month-picker">Mês e ano<input id="agenda-month-picker" type="month" value="${month}"></label>${button('Mês atual','agenda-current')}<div class="agenda-view" aria-label="Visualização">${button('Calendário','agenda-calendar','','aria-pressed="'+(view==='calendar')+'"')}${button('Lista','agenda-list','','aria-pressed="'+(view==='list')+'"')}</div></div></section>
    ${area==='church'||area==='elders'?agendaResponsibles(start,end):''}
    ${view==='calendar'?`<section class="agenda-calendar" aria-label="Calendário de ${esc(monthTitle)}"><div class="calendar-weekdays" aria-hidden="true">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days">${Array.from({length:monthDate.getUTCDay()},()=>'<span aria-hidden="true"></span>').join('')}${Array.from({length:Number(end.slice(-2))},(_,index)=>{
      const date=month+'-'+String(index+1).padStart(2,'0'),appointments=events.filter(e=>agendaOverlaps(e,date,date)),entry=scale.find(e=>e.startDate?agendaOverlaps(e,date,date):e.date===date);
      const count=area==='church'?appointments.length:entry?1:0;
      return `<button type="button" class="calendar-day ${count?'scheduled':''} ${date===day?'selected-day':''}" data-action="agenda-day" data-id="${date}" aria-pressed="${date===day}" ${date===today()?'aria-current="date"':''} aria-label="${esc(programDate(date))} · ${count} ${area==='church'?'eventos':'escalas'}"><span class="calendar-number">${index+1}</span>${area==='church'?appointments.length?`<span class="calendar-person">${appointments.length} evento${appointments.length>1?'s':''}</span><span class="calendar-event-title">${esc(appointments[0].title)}${appointments[0].startDate!==date?' · continuação':''}</span>`:'':entry?`<span class="calendar-person">${showPeople?esc(entry.person):'Escala definida'}</span>`:''}</button>`;
    }).join('')}</div></section>`:''}
    <section class="section"><div class="section-heading"><h2>${area==='church'?view==='calendar'?'Eventos · '+esc(programDate(day)):'Programação da igreja':area==='sound'?esc(soundScheduleInfo.title):`Escala de ${esc(ministry)}`}</h2><span class="muted">${area==='church'?events.length+' eventos no mês':scale.length+' datas com escala'}</span></div>${area==='church'?agendaEventList(view==='calendar'?events.filter(e=>agendaOverlaps(e,day,day)):events,allMonth):scale.length?`<ul class="agenda-list">${scale.map(e=>`<li><button type="button" ${e.startDate?'':'class="ministry-shift" data-schedule-date="'+e.date+'"'} data-action="agenda-day" data-id="${e.date}">${e.startDate?`<span>${esc(agendaPeriod(e))}</span>`:`<span class="ministry-shift-date"><time datetime="${e.date}">${esc(displayDate(e.date))}</time><small>${esc(agendaWeekday(e.date))}</small></span><span class="ministry-shift-department">${esc(ministry)}</span>`}<strong>${showPeople?esc(e.person):'Escala definida'}</strong></button></li>`).join('')}</ul>`:empty('Nenhuma escala cadastrada neste mês',`Ainda não há nomes informados para ${esc(ministry)} neste período.`)}</section>`;
}
function selectAgendaMonth(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1000)throw Error('Selecione um mês e ano válidos.');
  agendaState.month=month;agendaState.day=month===today().slice(0,7)?today():month+'-01';render();
}
function changeAgendaMonth(amount){const date=new Date(agendaState.month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+amount);selectAgendaMonth(date.toISOString().slice(0,7));document.querySelector(`[data-action="${amount>0?'agenda-next':'agenda-previous'}"]`).focus();}

;
'use strict';
const archiveKey=IASDPIStorage.programs;
const cloudState={session:null,archives:[],loaded:false,loading:false,error:'',busy:false,dirty:false};
function backupValidate(data){
  if(!data || data.format!=='IASDPI-backup'||data.version!==1||!Array.isArray(data.programs))throw Error('Arquivo de backup incompatível. Nada foi alterado.');
  const ids=new Set();
  for(const p of data.programs){
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||!p.plan||typeof p.plan.name!=='string'||!Array.isArray(p.plan.items)||!p.executions||typeof p.executions!=='object'||!Number.isInteger(p.version)||p.version<1)throw Error('Registro inválido no backup. Nada foi alterado.');
    ids.add(p.id);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.plan.date)||p.plan.items.some(i=>!i||typeof i.id!=='string'||typeof i.activity!=='string'))throw Error('Cronograma inválido no backup. Nada foi alterado.');
    const day=recordDay(p.plan.date),clock={test:validRecordClock};
    const validTime=value=>typeof value==='string'&&inspectRecordTime(value,day).valid;
    const emptyFree=p.execution_mode==='manual'&&p.plan.template_id==='free'&&!p.plan.items.length&&p.plan.start===''&&p.plan.end===''&&p.planned_start===null&&p.planned_end===null;
    if(!day||(!emptyFree&&(!clock.test(p.plan.start)||!clock.test(p.plan.end)||!validTime(p.planned_start)||!validTime(p.planned_end)))||!['Planejamento','Pronta','Em andamento','Finalizada'].includes(p.status))throw Error('Datas, horários ou status inválidos no backup.');
    const itemIds=new Set();
    for(const item of p.plan.items){if(itemIds.has(item.id)||!clock.test(item.start)||!clock.test(item.end)||typeof item.block!=='string'||!validTime(item.planned_start)||!validTime(item.planned_end))throw Error('Atividade inválida no backup.');itemIds.add(item.id);}
    if(Array.isArray(p.executions))throw Error('Execução inválida no backup.');
    for(const [id,e] of Object.entries(p.executions)){if(!itemIds.has(id)||!e||(e.started!=null&&e.started!==''&&!validTime(e.started))||(e.ended!=null&&e.ended!==''&&!validTime(e.ended)))throw Error('Horários realizados inválidos no backup.');}
    for(const item of p.plan.items){const detail=p.actual_details?.[item.id];if(detail&&(detail.status!==undefined||detail.subactivities!==undefined||detail.partial_end!==undefined)){const e=p.executions[item.id];validateActivityRecord({...detail,start:storedActualClock(e?.started),end:storedActualClock(e?.ended)||detail.partial_end||''},item.id);}}
    if(p.extra_events)validateExtraEvents(p,p.extra_events,false);
  }
  return data;
}
async function backupPayload(){
  await IASDPIAuth.requireAccess();
  const raw=window.IASDPIDemo?localStorage.getItem(archiveKey):null;
  const programs=window.IASDPIDemo?(raw===null?[]:JSON.parse(raw)):await api('programs');
  return backupValidate({format:'IASDPI-backup',version:1,programs,
    dateCorrectionBackupsRaw:window.IASDPIDemo?localStorage.getItem(IASDPIStorage.dateCorrections):null});
}
// O schema operacional exige previstos HH:mm e execuções com data. A adaptação
// só ocorre na importação confirmada; exportação/restauração local são exatas.
function operationalImportCandidate(original){
  const document=structuredClone(original),changes=[],day=recordDay(document.plan.date);
  const planned=(object,key)=>{
    const value=object[key],converted=plannedClock(value);
    if(converted!==value){object[key]=converted;changes.push('previsto '+value+' → '+converted);}
    if(value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(converted))throw Error('Horário previsto com segundos não nulos: revise a programação antes de importar. O backup original foi preservado.');
  };
  for(const object of [document.plan,...document.plan.items])for(const key of ['start','end'])planned(object,key);
  for(const e of Object.values(document.executions))for(const key of ['started','ended']){
    const value=e[key];
    if(validRecordClock(value)){e[key]=recordInstant(day,value);changes.push('horário real associado à data do culto, no fuso America/Sao_Paulo');}
  }
  if(changes.length)document.backup_source={format:'IASDPI-backup',version:1,document:structuredClone(original)};
  return {document,changes};
}
const toBase64=bytes=>{let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);};
const fromBase64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function backupCipher(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptBackup(data,password){
  if(password.length<10)throw Error('Use uma senha de backup com pelo menos 10 caracteres.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await backupCipher(password,salt);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
  return {format:'IASDPI-encrypted-backup',version:1,salt:toBase64(salt),iv:toBase64(iv),data:toBase64(new Uint8Array(bytes))};
}
async function decryptBackup(data,password){
  if(data.format!=='IASDPI-encrypted-backup')return backupValidate(data);
  if(data.version!==1)throw Error('Versão de backup incompatível.');
  try{const key=await backupCipher(password,fromBase64(data.salt));const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(data.iv)},key,fromBase64(data.data));return backupValidate(JSON.parse(new TextDecoder().decode(bytes)));}
  catch(_){throw Error('Senha incorreta ou arquivo danificado. Nada foi alterado.');}
}
async function downloadBackup(data){
  await IASDPIAuth.requireAccess();
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='IASDPI-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function restoreBackup(data){
  await IASDPIAuth.requireAccess();
  backupValidate(data);
  if(window.IASDPIOperational)return IASDPIOperational.importDocuments(data.programs);
  if(!window.IASDPIDemo)throw Error('A restauração pelo navegador está disponível no Pages/HTML local. A base SQLite não foi alterada.');
  const raw=localStorage.getItem(archiveKey),current=raw?JSON.parse(raw):[];
  backupValidate({format:'IASDPI-backup',version:1,programs:current});
  const merged=structuredClone(current),ids=new Set(current.map(p=>p.id));let added=0,copies=0;
  for(const p of data.programs){const existing=merged.find(e=>e.id===p.id);if(existing&&JSON.stringify(existing)===JSON.stringify(p))continue;const copy=structuredClone(p);if(ids.has(copy.id)){copy.id=crypto.randomUUID();copy.plan.name+=' (cópia restaurada)';copies++;}ids.add(copy.id);merged.push(copy);added++;}
  if(raw!==null)localStorage.setItem(IASDPIStorage.beforeRestore,raw);
  localStorage.setItem(archiveKey,JSON.stringify(merged));
  state.programs=merged;return {added,copies};
}
function cloudConfig(){return IASDPIAuth.config();}
function archivePage(){
  const account=IASDPIAuth.session();
  if(!account)return IASDPIAuth.loginPage();
  return heading('PROTEÇÃO DOS REGISTROS','Arquivo e banco',window.IASDPIOperational?'Supabase é a fonte principal. Publicações do site não substituem os registros do banco.':'Guarde uma cópia fora do celular. Os registros existentes permanecem no navegador.')+
  (window.IASDPIOperational?IASDPIOperational.panel():'')+
  `<section class="panel"><h2>${window.IASDPIOperational?'Backup adicional opcional':'Baixar backup protegido'}</h2><p class="muted">Inclui programações, horários, atividades extras, responsáveis e observações. Guarde o arquivo no Drive/OneDrive e mantenha a senha em local separado. Sem essa senha, o arquivo não poderá ser recuperado.</p><form id="backup-export-form"><div class="notes-grid">${field('Senha do backup','password','','password',true,'minlength="10" autocomplete="new-password"')}${field('Repetir senha','repeat','','password',true,'minlength="10" autocomplete="new-password"')}</div><button type="submit" class="primary">Baixar backup</button></form></section>
  <section class="panel"><h2>Restaurar uma cópia</h2><p class="muted">${window.IASDPIOperational?'Registros existentes no Supabase nunca serão substituídos pela restauração; conflitos serão informados.':'Os registros atuais não são substituídos. Versões diferentes do mesmo culto entram como cópias identificadas.'}</p><form id="backup-restore-form"><label>Arquivo de backup<input type="file" name="file" accept=".json,application/json" required></label>${field('Senha do arquivo protegido','password','','password',false,'autocomplete="off"')}<button type="submit">Restaurar sem substituir registros</button></form></section>
  <section class="panel"><h2>Arquivos históricos · Supabase</h2><p class="muted">${window.IASDPIOperational?'Cópias imutáveis adicionais em culto_archives, independentes do banco operacional. Não é necessário arquivar manualmente cada edição ou publicação.':'Conecte um projeto com a tabela culto_archives e políticas de acesso instaladas. Administradores e líderes autorizados acessam as cópias da igreja; as versões arquivadas não podem ser alteradas ou apagadas pelo site.'}</p><p>Conectado como ${esc(account.user.email)}.</p><div class="actions">${button('Arquivar registros no banco','cloud-save','','class="primary"')}${button('Consultar arquivos','cloud-list')}${button('Sair','cloud-signout')}</div><div class="section">${cloudState.loading?'<p role="status">Carregando arquivos…</p>':cloudState.error?`<p role="alert" class="form-error">Erro ao carregar arquivos: ${esc(cloudState.error)} ${button('Tentar novamente','cloud-list')}</p>`:cloudState.archives.length?`<ul class="agenda-list">${cloudState.archives.map(row=>`<li>${button('Restaurar cópia de '+displayRecordTimestamp(row.created_at),'cloud-restore',row.id)}</li>`).join('')}</ul>`:cloudState.loaded?'<p>Nenhum arquivo histórico encontrado.</p>':'<p>Use Consultar arquivos para carregar as cópias históricas.</p>'}</div></section>`;
}
async function refreshArchives(){
  cloudState.loading=true;cloudState.error='';render();
  try{
    const rows=await cloudRequest('/rest/v1/culto_archives?select=id,created_at&order=created_at.desc&limit=30');
    if(!Array.isArray(rows))throw Error('Resposta inválida ao consultar arquivos.');
    cloudState.archives=rows;cloudState.loaded=true;
  }catch(error){cloudState.error=error.message;throw error;}
  finally{cloudState.loading=false;render();}
}
async function cloudRequest(path,options={}){
  const authorization=await IASDPIAuth.requireAccess();
  if(!IASDPIAuth.remoteRequestAllowed(path,(options.method||'GET').toUpperCase()))throw Error('Homologação em modo de consulta: arquivamento remoto bloqueado.');
  const config=cloudConfig();
  const response=await fetch(config.url+path,{...options,headers:{apikey:config.key,Authorization:'Bearer '+authorization.token,'Content-Type':'application/json',...options.headers}});
  if(IASDPIAuth.session()?.access_token!==authorization.token)throw Error('Sessão encerrada.');
  if(!response.ok)throw Error(response.status===401?'Sessão expirada. Saia e conecte novamente.':'O banco não confirmou a operação. Verifique a tabela e as políticas de acesso. Os dados locais foram preservados.');
  return response.status===204?null:response.json();
}
async function cloudSave(){
  const {user}=await IASDPIAuth.requireAccess();
  const payload=await backupPayload(),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));const digest=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
  await cloudRequest('/rest/v1/culto_archives?on_conflict=owner_id,digest',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({digest,payload})});
  const rows=await cloudRequest('/rest/v1/culto_archives?owner_id=eq.'+encodeURIComponent(user.id)+'&digest=eq.'+digest+'&select=id,digest,payload');
  const comparable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  if(!Array.isArray(rows)||!rows.some(r=>r.digest===digest&&comparable(r.payload)===comparable(payload)))throw Error('Não foi possível confirmar o conteúdo da cópia no banco. Os dados locais permanecem preservados.');
  localStorage.removeItem(IASDPIStorage.pending);toast('Cópia arquivada e confirmada no banco.');
}
async function cloudAutoArchive(){
  if(window.IASDPIOperational||!cloudState.session||window.IASDPIConfig?.remoteReadOnly)return;cloudState.dirty=true;if(cloudState.busy)return;cloudState.busy=true;
  try{while(cloudState.dirty){cloudState.dirty=false;await cloudSave();}}
  catch(_){try{localStorage.setItem(IASDPIStorage.pending,'true');}catch(_){}toast('Registro local preservado. Arquivamento no banco pendente; tente novamente em Arquivo e banco.',true);}
  finally{cloudState.busy=false;}
}

;
'use strict';
const churchOrganization = [
  {name:'Adriano', departments:['Tesouraria','Desbravadores','Escola Sabatina']},
  {name:'Lucas', departments:['Adolescente','Vida e Saúde','Ministério 3ª Idade']},
  {name:'Elmo', departments:['Mordomia','ASA','Publicações']},
  {name:'Márcia', departments:['Família','Ministério da Mulher','Recepção']},
  {name:'Márcio', departments:['Patrimônio','Diaconato','Secretaria']},
  {name:'Raphael', departments:['Sonoplastia','Liberdade Religiosa','Ministério das Possibilidades']},
  {name:'Samuel', departments:['Ministério Pessoal','Música','Ministério dos Homens']},
  {name:'Victoria', departments:['Aventureiros','Gol da Esperança','Ministério Infantil']},
  {name:'Rosana', departments:['Comunicação','Ministério Recuperação','Jovens']}
];

// Responsáveis dos ministérios, separados do acompanhamento pelos anciãos.
const churchMinistries = [
  {name:'Diaconato — Diaconisas',responsibles:['Rose']},
  {name:'Diaconato — Diáconos',responsibles:['Marciano']},
  {name:'Ancionato',responsibles:[]},
  {name:'Ministério da Criança',responsibles:['Luciana Abdias']},
  {name:'Ministério dos Adolescentes',responsibles:['Taislane']},
  {name:'Comunicação',responsibles:['Henrique']},
  {name:'Ministério da Família',responsibles:['Luana','Raphael']},
  {name:'Ministério da Saúde',responsibles:['Simone Cristina']},
  {name:'Ministério de Publicações',responsibles:['Glaucia']},
  {name:'Ministério da Música',responsibles:['Alexandre']},
  {name:'Escola Sabatina',responsibles:['Renato']},
  {name:'Mordomia Cristã',responsibles:['Samuel']},
  {name:'Ministério Pessoal',responsibles:['Rosana']},
  {name:'Ação Solidária Adventista (ASA)',responsibles:['João Pedro']},
  {name:'Ministério Adventista das Possibilidades',responsibles:['João Pedro']},
  {name:'Liberdade Religiosa',responsibles:['João Pedro']},
  {name:'Ministério da Mulher',responsibles:['Gislaine']},
  {name:'Recepção',responsibles:['Nilce']},
  {name:'Ministério Jovem',responsibles:['Cauê']},
  {name:'Clube de Desbravadores',responsibles:['Victoria']},
  {name:'Clube de Aventureiros',responsibles:['Valeska']},
  {name:'Terceira Idade',responsibles:['Sandra']},
  {name:'Sonoplastia',responsibles:['Luan']},
  {name:'Patrimônio',responsibles:['Sérgio']},
  {name:'Ministério dos Homens',responsibles:['Paulo Scarpelini']},
  {name:'Gol da Esperança',responsibles:['Nelson']}
];
const organizationDepartmentNames = {
  'Desbravadores':'Clube de Desbravadores','Adolescente':'Ministério dos Adolescentes',
  'Vida e Saúde':'Ministério da Saúde','Ministério 3ª Idade':'Terceira Idade',
  'Mordomia':'Mordomia Cristã','ASA':'Ação Solidária Adventista (ASA)',
  'Publicações':'Ministério de Publicações','Família':'Ministério da Família',
  'Ministério das Possibilidades':'Ministério Adventista das Possibilidades',
  'Música':'Ministério da Música','Aventureiros':'Clube de Aventureiros',
  'Ministério Infantil':'Ministério da Criança','Jovens':'Ministério Jovem'
};
const organizationState = {query:''};
const organizationSearchText = value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const ministryPeople = ministry=>ministry.responsibles.length?new Intl.ListFormat('pt-BR',{type:'conjunction'}).format(ministry.responsibles):'Não informado';
const organizationCountText = count=>`${count} ${count===1?'resultado encontrado':'resultados encontrados'}.`;
function organizationDepartments(elder){
  return elder.departments.flatMap(original=>{
    const names=original==='Diaconato'?['Diaconato — Diaconisas','Diaconato — Diáconos']:[organizationDepartmentNames[original]||original];
    return names.map(name=>{const ministry=churchMinistries.find(entry=>entry.name===name);return {name,original,responsibles:ministry?.responsibles||[]};});
  });
}
function organizationResults(){
  const query=organizationSearchText(organizationState.query);
  const matches=ministry=>!query||organizationSearchText([ministry.name,ministry.original||'',ministryPeople(ministry)].join(' ')).includes(query);
  const ancionato=churchMinistries.find(ministry=>ministry.name==='Ancionato');
  const showAncionato=matches(ancionato);
  const groups=churchOrganization.map(elder=>({...elder,departments:organizationDepartments(elder).filter(matches)})).filter(elder=>elder.departments.length);
  const count=groups.reduce((total,elder)=>total+elder.departments.length,0)+Number(showAncionato);
  const ministryHtml=ministry=>`<h3 class="organization-ministry-name">${esc(ministry.name)}</h3><p class="organization-responsible"><span class="muted">${ministry.responsibles.length>1?'Responsáveis':'Responsável'}:</span> <strong>${esc(ministryPeople(ministry))}</strong></p>`;
  return {count,html:count?`${showAncionato?`<section class="organization-ancionato" data-ministry="Ancionato">${ministryHtml(ancionato)}</section>`:''}
    ${groups.length?`<p class="organization-level">Anciãos e departamentos sob seu acompanhamento</p><ul class="organization-elders">${groups.map(elder=>`<li class="organization-elder"><div class="organization-elder-heading"><span class="eyebrow">${['Márcia','Victoria','Rosana'].includes(elder.name)?'ANCIÃ':'ANCIÃO'} · ACOMPANHAMENTO</span><h2>${esc(elder.name)}</h2></div><ul class="organization-departments">${elder.departments.map(ministry=>`<li data-ministry="${esc(ministry.name)}">${ministryHtml(ministry)}</li>`).join('')}</ul></li>`).join('')}</ul>`:''}`:empty('Nenhum ministério encontrado','Revise o nome do ministério ou responsável, ou limpe a pesquisa.')};
}
function organizationPage() {
  const results=organizationResults();
  return heading('NOSSA IGREJA','Organograma da igreja','Ministérios, seus responsáveis e o acompanhamento pastoral e dos anciãos.') +
    `<section class="panel organization-search" role="search" aria-label="Pesquisa de ministérios"><label for="organization-query">Pesquisar ministério ou responsável<input type="search" id="organization-query" maxlength="200" autocomplete="off" placeholder="Ex.: Música ou Alexandre" value="${esc(organizationState.query)}" aria-controls="organization-results"></label><button type="button" id="organization-clear">Limpar pesquisa</button><p id="organization-count" class="muted" role="status" aria-live="polite">${organizationCountText(results.count)}</p></section>`+
    `<section class="organization" aria-label="Hierarquia da liderança da igreja">
      <div class="organization-pastor"><span class="eyebrow">PASTOR</span><h2>Luciano</h2><p>Acompanhamento de todos os anciãos</p></div>
      <div id="organization-results">${results.html}</div>
    </section>`;
}
function updateOrganizationSearch(){
  const target=document.getElementById('organization-results');if(!target)return;
  const results=organizationResults();target.innerHTML=results.html;
  document.getElementById('organization-count').textContent=organizationCountText(results.count);
}
document.addEventListener('input',event=>{if(event.target.id==='organization-query'){organizationState.query=event.target.value;updateOrganizationSearch();}});
document.addEventListener('click',event=>{if(event.target.closest('#organization-clear')){organizationState.query='';const input=document.getElementById('organization-query');input.value='';updateOrganizationSearch();input.focus();}});

;
'use strict';
const usersState={rows:[],invites:[],offset:0,loaded:false,loading:false,error:'',found:null,inviteLink:'',inviteToken:''};
function resetUsers(){usersState.rows=[];usersState.invites=[];usersState.found=null;usersState.loaded=false;usersState.loading=false;usersState.error='';usersState.offset=0;usersState.inviteLink='';}
async function usersRpc(name,body={}){
  const authorization=await IASDPIAuth.requireAccess();
  if(authorization.role!=='admin')throw Error('Acesso exclusivo de administradores.');
  const result=await IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+authorization.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(IASDPIAuth.session()?.access_token!==authorization.token||!IASDPIAuth.isAdmin())throw Error('Acesso administrativo encerrado.');
  return result;
}
async function refreshUsers(){
  usersState.loading=true;usersState.error='';render();
  try{
    const [rows,invites]=await Promise.all([usersRpc('iasdpi_list_users',{p_offset:usersState.offset}),usersRpc('iasdpi_list_invites')]);
    if(!Array.isArray(rows)||!Array.isArray(invites))throw Error('Resposta inválida ao consultar usuários.');
    usersState.rows=rows;usersState.invites=invites;usersState.loaded=true;
  }catch(error){usersState.error=error.message;throw error;}
  finally{usersState.loading=false;render();}
}
function usersPage(){
  if(!IASDPIAuth.isAdmin())return heading('ADMINISTRAÇÃO','Acesso restrito','Somente administradores podem gerenciar usuários.');
  return heading('ADMINISTRAÇÃO','Usuários','IASD Parada Inglesa · autorizações e convites.',button('Atualizar lista','users-refresh'))+
    (window.IASDPIConfig?.remoteReadOnly?'<p class="form-note">Modo de consulta: listagem e busca disponíveis; alterações de acesso e convites bloqueadas nesta interface.</p>':'')+
    `<section class="panel"><h2>Autorizar conta existente</h2><p class="muted">Busque pelo e-mail exato. A conta precisa ter o e-mail confirmado.</p><form id="users-find-form" class="users-inline">${field('E-mail','email','','email',true)}<button type="submit">Buscar conta</button></form>${usersState.found?`<div class="users-result"><p>${esc(usersState.found.email)} · ${usersState.found.confirmed?'E-mail confirmado':'E-mail ainda não confirmado'}</p>${usersState.found.confirmed&&!usersState.found.authorized?button('Autorizar como líder','users-authorize',usersState.found.user_id,'class="primary"'):'<p class="muted">Se a conta já está na lista, altere seu perfil abaixo.</p>'}</div>`:''}</section>
    <section class="panel"><h2>Convidar novo líder</h2><p class="muted">O convite é individual, válido por 48 horas e só pode ser aceito pela conta com o e-mail confirmado correspondente. Não concede perfil administrador.</p><form id="users-invite-form" class="users-inline">${field('E-mail do convidado','email','','email',true)}<button type="submit">Gerar convite</button></form>${usersState.inviteLink?`<label>Link do convite<input id="users-invite-link" readonly value="${esc(usersState.inviteLink)}"></label><p class="muted">Copie e envie por um canal privado. Este link não será exibido novamente ao recarregar.</p>${button('Copiar link','users-copy')}`:''}</section>
    <section class="section"><h2>Usuários autorizados</h2><p class="muted">Administrador pode gerenciar acessos. Líder pode operar cultos e backups. Desmarcar “Acesso ativo” revoga a autorização. O último administrador não pode ser removido ou rebaixado.</p>${usersState.loading?'<p role="status">Carregando usuários…</p>':usersState.error?`<p role="alert" class="form-error">Erro ao carregar usuários: ${esc(usersState.error)} ${button('Tentar novamente','users-refresh')}</p>`:usersState.loaded?usersState.rows.length?`<ul class="users-list">${usersState.rows.map(row=>`<li><form class="user-access-form" data-user-id="${esc(row.user_id)}"><div><strong>${esc(row.email)}</strong><small>${row.user_id===IASDPIAuth.session()?.user.id?'Sua conta':'Conta autorizada'}</small></div><label>Perfil<select name="role"><option value="leader" ${row.role==='leader'?'selected':''}>Líder</option><option value="admin" ${row.role==='admin'?'selected':''}>Administrador</option></select></label><label class="checkbox"><input name="enabled" type="checkbox" ${row.enabled?'checked':''}> Acesso ativo</label><button type="submit">Salvar acesso</button></form></li>`).join('')}</ul>`:'<p>Nenhum usuário nesta página.</p>':'<p class="muted">Atualize a lista para consultar as autorizações.</p>'}<div class="actions">${button('Anterior','users-previous','',''+(usersState.offset===0?'disabled':''))}${button('Próxima','users-next','',''+(usersState.rows.length<50?'disabled':''))}</div></section>
    <section class="section"><h2>Convites pendentes</h2>${usersState.loading?'<p role="status">Carregando convites…</p>':usersState.error?'<p>Não foi possível consultar os convites. Tente novamente.</p>':usersState.invites.length?`<ul class="users-list">${usersState.invites.map(i=>`<li class="users-inline"><div><strong>${esc(i.email)}</strong><small>Expira em ${esc(displayRecordTimestamp(i.expires_at))}</small></div>${button('Revogar convite','users-revoke-invite',i.id)}</li>`).join('')}</ul>`:usersState.loaded?'<p class="muted">Nenhum convite pendente.</p>':'<p class="muted">Atualize a lista para consultar os convites.</p>'}</section>`;
}
function captureInvite(fragment){
  if(/(?:^|&)(?:error|error_code)=/.test(fragment)||/(?:^|&)type=recovery(?:&|$)/.test(fragment)){void IASDPIAuth.handlePasswordCallback();return;}
  // Confirmação de e-mail pode redirecionar com tokens no fragmento.
  // Este fluxo usa login por senha: não importar nem deixar tokens na URL.
  if(/(?:^|&)(?:access_token|refresh_token)=/.test(fragment)){
    window.history.replaceState(null,'','#organization');return;
  }
  const [page,token]=fragment.split('/');
  if(page==='invite'&&token){
    usersState.inviteToken=/^[a-f0-9]{64}$/.test(token)?token:'';
    window.history.replaceState(null,'','#invite');
  }
}
function invitePage(){
  return heading('CONVITE','Acesso à IASD Parada Inglesa','Confirme seu e-mail antes de aceitar. O convite só autoriza a conta indicada pelo administrador.')+
    (usersState.inviteToken?`<section class="panel auth-panel"><form id="invite-login-form"><h2>Já tenho uma conta</h2>${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Senha','password','','password',true,'autocomplete="current-password"')}${IASDPIAuth.config().key?'':field('Chave pública da conexão','public-key','','text',true)}<button type="submit" class="primary">Entrar e aceitar convite</button></form><hr><form id="invite-signup-form"><h2>Criar minha conta</h2>${field('E-mail','email','','email',true,'autocomplete="username"')}${field('Nova senha','password','','password',true,'minlength="12" autocomplete="new-password"')}${IASDPIAuth.config().key?'':field('Chave pública da conexão','public-key','','text',true)}<button type="submit">Cadastrar e confirmar e-mail</button><p class="muted">Após confirmar pelo e-mail recebido, reabra o convite original e entre com sua senha. O cadastro sozinho não autoriza o acesso.</p></form></section>`:'<p class="panel">Abra o link individual enviado pelo administrador. Se o convite expirou, solicite outro.</p>');
}
async function handleUsersAction(action,id){
  if(action==='users-copy'){await navigator.clipboard.writeText(usersState.inviteLink);toast('Link copiado. Envie apenas ao convidado.');return;}
  if(action==='users-authorize'){
    await usersRpc('iasdpi_set_access',{p_user_id:id,p_role:'leader',p_enabled:true});usersState.found=null;toast('Líder autorizado.');
  }else if(action==='users-revoke-invite'){
    await usersRpc('iasdpi_revoke_invite',{p_id:id});usersState.inviteLink='';toast('Convite revogado.');
  }else if(action==='users-next')usersState.offset+=50;
  else if(action==='users-previous')usersState.offset=Math.max(0,usersState.offset-50);
  await refreshUsers();
}
async function submitUsersForm(form){
  if(form.id==='users-find-form'){
    const rows=await usersRpc('iasdpi_find_account',{p_email:form.elements.email.value});
    usersState.found=rows[0]||null;render();if(!usersState.found)toast('Conta não encontrada. Você pode gerar um convite.');
  }else if(form.id==='users-invite-form'){
    if(location.protocol==='file:')throw Error('Gere convites no endereço do site. Um link de arquivo local não pode ser enviado ao convidado.');
    const [invite]=await usersRpc('iasdpi_create_invite',{p_email:form.elements.email.value});
    usersState.inviteLink=location.href.split('#')[0]+'#invite/'+invite.token;await refreshUsers();
  }else if(form.classList.contains('user-access-form')){
    await usersRpc('iasdpi_set_access',{p_user_id:form.dataset.userId,p_role:form.elements.role.value,p_enabled:form.elements.enabled.checked});
    await IASDPIAuth.requireAccess();toast('Acesso atualizado.');
    if(IASDPIAuth.isAdmin())await refreshUsers();else{resetUsers();navigate('home');}
  }
}

;
'use strict';
// Ações administrativas confirmadas por RPC; nunca excluem definitivamente.
const trashState={rows:null,detail:null,error:'',loading:false,requests:new Map()};
async function trashRPC(name,args={}){
  const access=await IASDPIAuth.requireAccess();
  if(!IASDPIAuth.isAdmin())throw Error('Acesso administrativo necessário.');
  return IASDPIAuth.jsonRequest('/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify(args)}).then(result=>{
    if(IASDPIAuth.session()?.access_token!==access.token)throw Error('Sessão alterada. Entre novamente e atualize a lista.');
    return result;
  });
}
async function refreshTrash(){
  trashState.loading=true;trashState.error='';if(state.page==='trash')render();
  try{
    const rows=[];
    for(let offset=0;;offset+=100){const page=await trashRPC('iasdpi_list_trash',{p_offset:offset});rows.push(...page);if(page.length<100)break;}
    trashState.rows=rows;trashState.error='';
  }catch(error){trashState.error=error.message+' Confira se a migração 004 foi instalada.';}
  trashState.loading=false;if(state.page==='trash')render();
}
function trashWhen(value){const parsed=inspectRecordTime(value);return parsed.valid?`${displayDate(parsed.day)} ${displayActualTime(value)}`:'Data não informada';}
function trashPage(){
  if(!IASDPIAuth.isAdmin())return empty('Acesso administrativo necessário','Somente administradores podem consultar e restaurar cultos da lixeira.');
  const detail=trashState.detail,p=detail?.document;
  return heading('ADMINISTRAÇÃO','Lixeira de cultos','Os registros permanecem recuperáveis. Não existe exclusão definitiva.',`<div class="actions">${button('Atualizar lixeira','trash-refresh')}${button('Voltar às programações','programs')}</div>`)+
    (trashState.error?`<p class="form-error" role="alert">${esc(trashState.error)} ${button('Tentar novamente','trash-refresh')}</p>`:'')+
    (p?`<section class="panel"><h2>${esc(p.plan?.name)}</h2><p>${esc(displayDate(p.plan?.date))} · ID: ${esc(p.id)}</p><p>Movido em ${esc(trashWhen(detail.deleted_at))} por ${esc(detail.deleted_by_email||detail.deleted_by)}.</p><p>Motivo: ${esc(detail.deletion_reason||'Não informado')}</p><p>Status anterior: ${esc(p.status)} · Versão ${esc(detail.version)}</p><p>Observações: ${esc(p.note||'—')}</p><p>Ocorrências: ${esc(p.incident||'—')}</p><p>Informações complementares: ${esc(p.record_info||'—')}</p><div class="table-scroll"><table><thead><tr><th>Atividade / responsável / observações</th><th>Previsto</th><th>Real</th><th>Duração prevista</th><th>Duração real</th><th>Diferença</th></tr></thead><tbody>${summaryActivityRows(p)}</tbody></table></div><div class="actions">${button('Restaurar culto','trash-restore',p.id,'class="primary"')}${button('Fechar detalhes','trash-close')}</div><details><summary>Histórico da lixeira</summary><ul>${(detail.audit||[]).map(a=>`<li>${esc(a.action==='trash'?'Movido para a lixeira':'Restaurado')} · ${esc(trashWhen(a.happened_at))} · ${esc(a.actor_id)} · versão ${esc(a.to_version)}${a.reason?' · '+esc(a.reason):''}</li>`).join('')}</ul></details></section>`:'')+
    (trashState.loading?'<p role="status">Carregando lixeira…</p>':trashState.error?'':trashState.rows===null?'<p>Use Atualizar lixeira para consultar o Supabase.</p>':trashState.rows.length?`<div class="table-scroll"><table><thead><tr><th>Culto</th><th>Excluído em / por</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>${trashState.rows.map(row=>`<tr><td>${esc(row.document.plan?.name)}<small>${esc(displayDate(row.document.plan?.date))} · ${esc(row.id)}</small></td><td>${esc(trashWhen(row.deleted_at))}<small>${esc(row.deleted_by_email||row.deleted_by)}</small></td><td>${esc(row.deletion_reason||'—')}</td><td>${button('Ver detalhes','trash-detail',row.id)}${button('Restaurar','trash-restore',row.id)}</td></tr>`).join('')}</tbody></table></div>`:empty('Lixeira vazia','Nenhum culto foi movido para a lixeira.'));
}
async function handleTrashAction(action,id){
  await IASDPIAuth.requireAccess();if(!IASDPIAuth.isAdmin())throw Error('Acesso administrativo necessário.');
  if(!window.IASDPIOperational)throw Error('A lixeira exige persistência Supabase e a migração 004.');
  if(action==='trash-refresh'){trashState.detail=null;await refreshTrash();return;}
  if(action==='trash-open'){if(navigate('trash')===false)return;await refreshTrash();return;}
  if(action==='trash-detail'){trashState.detail=await trashRPC('iasdpi_trash_detail',{p_id:id});render();return;}
  if(action==='trash-close'){trashState.detail=null;render();return;}
  if(action==='trash-move'){
    const p=state.programs.find(row=>row.id===id);if(!p)throw Error('Atualize as programações antes de continuar.');
    if(!confirm(`Mover para a lixeira o culto “${p.plan.name}” de ${displayDate(p.plan.date)}?\nID: ${p.id}\nAs atividades e os horários serão preservados e poderão ser restaurados.`))return;
    const reason=prompt('Motivo da exclusão (opcional, até 2000 caracteres):','');if(reason===null)return;
    if(reason.length>2000)throw Error('O motivo deve ter até 2000 caracteres.');
    await trashChange('iasdpi_trash_program',p.id,p.version,reason);
    toast('Supabase confirmou: culto movido para a lixeira.');
  }else if(action==='trash-restore'){
    const row=trashState.detail?.id===id?trashState.detail:trashState.rows?.find(row=>row.id===id);
    if(!row)throw Error('Atualize a lixeira antes de continuar.');
    if(!confirm(`Restaurar “${row.document.plan.name}” de ${displayDate(row.document.plan.date)}?\nID: ${id}`))return;
    await trashChange('iasdpi_restore_program',id,row.version);
    toast('Supabase confirmou: culto restaurado nas programações.');
  }
}
async function trashChange(rpc,id,version,reason){
  const key=JSON.stringify([IASDPIAuth.session()?.user.id,rpc,id,version,reason]);
  const request=trashState.requests.get(key)||crypto.randomUUID();trashState.requests.set(key,request);
  await trashRPC(rpc,{p_id:id,p_expected_version:version,p_request_id:request,...(reason===undefined?{}:{p_reason:reason})});
  trashState.requests.delete(key);trashState.detail=null;
  await loadPrograms();if(state.selected===id)state.selected=null;
  if(state.page==='trash')await refreshTrash();else render();
}
window.addEventListener('iasdpi-auth-changed',()=>{if(!IASDPIAuth.isAdmin()){trashState.rows=null;trashState.detail=null;trashState.error='';trashState.requests.clear();}});

;
'use strict';
// Recuperação local de edição; nunca substitui confirmação do servidor.
window.IASDPIDrafts=(()=>{
  const ttl=24*60*60*1000, forms=new Set(['actuals-form','program-form','notes-form']);
  const scope=JSON.stringify([location.pathname,IASDPIConfig.supabaseUrl,IASDPIConfig.storageNamespace||'',IASDPIConfig.storageMode||'browser']);
  let active=null, observer=null, queue=Promise.resolve(), preferred=null, memoryOnly=false;
  const memory=new Map(),keys=new Map(),labels={'actuals-form':'Registro do culto','program-form':'Programação','notes-form':'Observações do resumo'};
  let tab;
  try{tab=sessionStorage.getItem('iasdpi-draft-tab-v1')||crypto.randomUUID();sessionStorage.setItem('iasdpi-draft-tab-v1',tab);}catch(_){tab=crypto.randomUUID();}
  const actor=()=>IASDPIAuth.session()?.user.id||null;
  const group=uid=>JSON.stringify([scope,uid]);
  const draftKey=(uid,kind,id)=>JSON.stringify([scope,uid,kind,id,tab]);
  const aad=row=>new TextEncoder().encode(JSON.stringify([row.key,row.revision,row.baseVersion,row.expiresAt]));
  function enqueue(job){const task=queue.then(job);queue=task.catch(()=>{});return task;}
  function open(){return new Promise((resolve,reject)=>{
    const request=indexedDB.open('iasdpi-edit-drafts-v1',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'key'});request.result.createObjectStore('keys',{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Armazenamento local indisponível.'));
  });}
  async function storage(store,mode,operation){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));
      tx.oncomplete=()=>{db.close();resolve(request.result);};
      tx.onabort=tx.onerror=()=>{db.close();reject(Error('Não foi possível preservar o rascunho neste navegador.'));};
    });
  }
  async function keyFor(uid){
    const id=group(uid);if(keys.has(id))return keys.get(id);
    let row;
    if(!memoryOnly)try{row=await storage('keys','readonly',s=>s.get(id));}catch(_){memoryOnly=true;}
    if(!row){
      row={key:id,value:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])};
      // add, e não put: duas abas não podem trocar a chave que cifra o mesmo usuário.
      if(!memoryOnly)try{await storage('keys','readwrite',s=>s.add(row));}
      catch(_){try{row=await storage('keys','readonly',s=>s.get(id))||row;}catch(_){memoryOnly=true;}}
    }
    keys.set(id,row.value);return row.value;
  }
  async function rows(){
    if(!memoryOnly)try{return await storage('drafts','readonly',s=>s.getAll());}catch(_){memoryOnly=true;}
    return [...memory.values()];
  }
  async function write(row){
    memory.set(row.key,row);
    if(!memoryOnly)try{await storage('drafts','readwrite',s=>s.put(row));}catch(_){memoryOnly=true;}
  }
  async function remove(key,revision=null){
    if(!revision||memory.get(key)?.revision===revision)memory.delete(key);
    if(memoryOnly)return;
    const db=await open();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),read=store.get(key);
      read.onsuccess=()=>{if(read.result&&(!revision||read.result.revision===revision))store.delete(key);};
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(Error('Não foi possível limpar o rascunho local.'));};
    });
  }
  async function owned(uid){
    const all=await rows(),now=Date.now(),valid=[];
    for(const row of all){
      if(row.scope!==scope)continue;
      if(row.expiresAt<=now){await remove(row.key,row.revision);continue;}
      if(row.uid===uid)valid.push(row);
    }
    return valid.sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  function controls(root,exclude){
    return [...root.querySelectorAll('input,select,textarea')].filter(e=>e.name&&!['password','file'].includes(e.type)&&(!exclude||!e.closest(exclude))).map(e=>({
      name:e.name,value:e.value,checked:e.type==='checkbox'?e.checked:undefined,
      edited:e.dataset.timeEdited,original:e.dataset.originalTime,day:e.dataset.originalDay,reapplied:e.dataset.conflictClock
    }));
  }
  function snapshot(form){
    const kind=form.id,rowSelector=kind==='actuals-form'?'.actual-row':kind==='program-form'?'.item-editor':null;
    const data={fields:controls(form,rowSelector),rows:[]};
    if(rowSelector)data.rows=[...form.querySelectorAll(rowSelector)].map(row=>({
      id:kind==='actuals-form'?row.dataset.id:row.dataset.itemId,extra:row.dataset.extra==='true',
      fields:controls(row,kind==='actuals-form'?'.subactivity':null),
      children:[...row.querySelectorAll('.subactivity')].map(child=>({id:child.dataset.subId,parent:child.dataset.parentId,fields:controls(child)}))
    }));
    return data;
  }
  function feedback(message,error=false){
    if(!active?.form.isConnected)return;
    let target=active.form.querySelector('.draft-feedback');
    if(!target){target=document.createElement('p');target.className='draft-feedback form-note';target.setAttribute('role','status');active.form.prepend(target);}
    target.textContent=message;target.classList.toggle('form-error',error);
  }
  function persist(context,required=false){
    const row={key:context.key,scope,uid:context.uid,kind:context.kind,id:context.id,page:context.page,baseVersion:context.version,
      revision:context.revision,updatedAt:Date.now(),expiresAt:Date.now()+ttl};
    const data=structuredClone(context.data);
    return enqueue(async()=>{
      row.iv=crypto.getRandomValues(new Uint8Array(12));
      row.cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(row)},await keyFor(row.uid),new TextEncoder().encode(JSON.stringify(data)));
      await write(row);
      if(required&&memoryOnly)throw Error('Cópia de recuperação persistente indisponível. Mantenha esta edição aberta.');
      if(active?.key===row.key&&active.revision===row.revision){
        feedback(memoryOnly?'Rascunho somente nesta aba: recuperação após recarregar indisponível. Mantenha a aba aberta.':'Rascunho local protegido por até 24 horas. Ainda não salvo no servidor.');
      }
      await refreshNotice();
    }).catch(error=>{if(active?.key===row.key)feedback('Falha ao preservar o rascunho. Mantenha esta aba aberta. '+error.message,true);if(required)throw Error('Não foi possível preservar a cópia anterior. Nenhuma seleção foi reaplicada. '+error.message);});
  }
  function changed(){
    if(!active?.form.isConnected)return;
    const data=snapshot(active.form),serial=JSON.stringify(data);
    if(serial===active.serial)return;
    active.data=data;active.serial=serial;active.revision=crypto.randomUUID();active.dirty=true;active.leaving=false;
    if(active.kind==='actuals-form')registrationDirty=true;
    feedback('Alterações não salvas. Preservando rascunho local…');
    void persist(active);
  }
  function suspend(){
    changed();observer?.disconnect();active=null;
    const notice=document.querySelector('#drafts-notice');if(notice)notice.replaceChildren();
    if(notice)notice.hidden=true;
  }
  async function refreshNotice(){
    const uid=actor();let host=document.querySelector('#drafts-notice');
    if(!uid){if(host)host.hidden=true;return;}
    const list=await owned(uid);if(actor()!==uid)return;
    if(!host){host=document.createElement('aside');host.id='drafts-notice';host.className='drafts-notice';document.querySelector('#app').before(host);}
    host.replaceChildren();host.hidden=!list.length;if(!list.length)return;
    const details=document.createElement('details'),title=document.createElement('summary');
    title.textContent='Rascunhos locais ('+list.length+') · não enviados ao servidor';details.append(title);
    const explanation=document.createElement('p');explanation.textContent='Disponíveis por até 24 horas neste navegador. Sair da conta remove estes rascunhos.';details.append(explanation);
    for(const row of list){
      const button=document.createElement('button');button.type='button';
      button.textContent='Retomar '+labels[row.kind]+(row.id?' · '+row.id.slice(0,12):' · novo')+' · '+new Date(row.updatedAt).toLocaleString('pt-BR',{hourCycle:'h23'});
      button.onclick=()=>guarded(async()=>{
        await IASDPIAuth.requireAccess();if(actor()!==uid)throw Error('Entre com a conta original.');
        if(!canLeave())return;
        if(row.id&&!state.programs.some(p=>p.id===row.id))throw Error('Este registro não está disponível. O rascunho foi preservado.');
        preferred=row.key;state.selected=row.id||null;navigate(row.page,row.id||undefined,{refresh:true});
      },button);
      details.append(button);
    }
    host.append(details);
  }
  function formContext(form){
    const uid=actor(),kind=form?.id;if(!uid||!forms.has(kind))return null;
    const id=form.dataset.id||'';
    return {uid,kind,id,key:draftKey(uid,kind,id),page:state.page,version:Number(form.dataset.version||0),form,
      baseline:JSON.stringify(snapshot(form)),serial:JSON.stringify(snapshot(form)),data:snapshot(form),revision:null,dirty:false,leaving:false,source:null};
  }
  function mount(){
    if(active?.form.isConnected)return;
    observer?.disconnect();
    const form=document.querySelector('#actuals-form,#program-form,#notes-form');
    active=formContext(form);
    if(active){observer=new MutationObserver(()=>changed());observer.observe(form,{childList:true,subtree:true});}
    const context=active;
    void enqueue(async()=>{
      await refreshNotice();if(!context||active!==context||actor()!==context.uid)return;
      const list=await owned(context.uid);
      const row=list.find(r=>r.key===preferred&&r.kind===context.kind&&r.id===context.id)||list.find(r=>r.key===context.key)||list.find(r=>r.kind===context.kind&&r.id===context.id);
      preferred=null;if(!row||active!==context||actor()!==context.uid||context.dirty)return;
      const panel=document.createElement('section');panel.className='draft-offer form-note';
      const message=document.createElement('p');
      message.textContent=row.baseVersion===context.version?'Existe um rascunho local. A recuperação não grava no servidor.':'A versão do registro mudou. O rascunho foi preservado para consulta; não será aplicado sobre a versão atual.';
      panel.append(message);
      const restore=document.createElement('button');restore.type='button';restore.dataset.draftRestore='true';restore.textContent='Recuperar rascunho';restore.disabled=row.baseVersion!==context.version;
      restore.onclick=()=>guarded(()=>recover(row,context),restore);panel.append(restore);
      if(row.baseVersion!==context.version){const compare=document.createElement('button');compare.type='button';compare.textContent='Comparar com versão atual';compare.dataset.draftCompare='true';compare.onclick=()=>guarded(async()=>{const data=await unlock(row,context);await IASDPIConflicts.openDraft(context.form,{data,version:row.baseVersion,uid:row.uid});},compare);panel.append(compare);}
      const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Consultar rascunho';
      inspect.onclick=()=>guarded(async()=>{
        const data=await unlock(row,context);const pre=document.createElement('pre');pre.className='draft-preview';pre.textContent=JSON.stringify(data,null,2);panel.append(pre);inspect.remove();
      },inspect);panel.append(inspect);
      const discard=document.createElement('button');discard.type='button';discard.textContent='Descartar este rascunho';
      discard.onclick=()=>guarded(async()=>{
        await IASDPIAuth.requireAccess();if(actor()!==row.uid)throw Error('Entre com a conta original.');
        if(!confirm('Descartar somente este rascunho local? O registro salvo não será alterado.'))return;
        await enqueue(()=>remove(row.key,row.revision));panel.remove();await refreshNotice();
      },discard);panel.append(discard);context.form.prepend(panel);
    }).catch(error=>feedback(error.message,true));
  }
  async function unlock(row,context){
    await IASDPIAuth.requireAccess();
    if(actor()!==row.uid||active!==context||row.scope!==scope)throw Error('Rascunho indisponível para esta sessão.');
    const current=(await owned(row.uid)).find(r=>r.key===row.key&&r.revision===row.revision);
    if(!current)throw Error('Rascunho expirou ou foi atualizado. Reabra a edição.');
    const value=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(row)},await keyFor(row.uid),row.cipher);
    if(actor()!==row.uid||active!==context)throw Error('Sessão alterada.');
    return JSON.parse(new TextDecoder().decode(value));
  }
  function fill(root,fields,exclude){
    if(!Array.isArray(fields))throw Error('Rascunho incompatível.');
    const inputs=[...root.querySelectorAll('input,select,textarea')].filter(e=>!exclude||!e.closest(exclude));
    for(const saved of fields){
      const input=inputs.find(e=>e.name===saved.name);if(!input||typeof saved.value!=='string'||['password','file'].includes(input.type))continue;
      input.value=saved.value;if(input.type==='checkbox')input.checked=Boolean(saved.checked);
      for(const [name,value] of [['timeEdited',saved.edited],['originalTime',saved.original],['originalDay',saved.day],['conflictClock',saved.reapplied]]){
        if(typeof value==='string')input.dataset[name]=value;else delete input.dataset[name];
      }
    }
  }
  const values=fields=>Object.fromEntries(fields.map(f=>[f.name,f.value]));
  async function recover(row,context){
    const data=await unlock(row,context);
    if(row.baseVersion!==context.version)throw Error('A versão do registro mudou. Consulte o rascunho antes de reaplicar seus dados.');
    applyData(context,data,{key:row.key,revision:row.revision});
  }
  function applyData(context,data,source=null){
    if(!Array.isArray(data.rows)||!Array.isArray(data.fields))throw Error('Rascunho incompatível.');
    if(context.kind==='actuals-form'){
      const rows=[...context.form.querySelectorAll('.actual-row')],planned=rows.filter(r=>!r.dataset.extra).map(r=>r.dataset.id).sort();
      if(JSON.stringify(planned)!==JSON.stringify(data.rows.filter(r=>!r.extra).map(r=>r.id).sort()))throw Error('As atividades da programação mudaram. O rascunho permanece disponível para consulta.');
      const list=context.form.querySelector('.actuals-list'),fragment=document.createDocumentFragment();
      for(const saved of data.rows){
        let target=rows.find(r=>r.dataset.id===saved.id);
        if(!target&&saved.extra){
          const item={id:saved.id,activity:values(saved.fields)['extra-theme']||'',block:'Culto',unplanned:true};
          const holder=document.createElement('div');holder.innerHTML=actualRow(null,{items:[item]},item,0,{});target=holder.firstElementChild;
        }
        if(!target)throw Error('Atividade não encontrada. Rascunho preservado.');
        fill(target,saved.fields,'.subactivity');
        target.querySelector('.subactivities').innerHTML=saved.children.map(child=>subactivityRow({...values(child.fields),id:child.id,parent_id:child.parent,title:values(child.fields)['sub-title'],responsible:values(child.fields)['sub-responsible'],note:values(child.fields)['sub-note'],start:'',end:''},saved.id)).join('');
        [...target.querySelectorAll('.subactivity')].forEach((child,index)=>fill(child,saved.children[index].fields));
        fragment.append(target);
      }
      list.replaceChildren(fragment);list.querySelectorAll('.actual-number').forEach((e,i)=>e.textContent=i+1);
    }else if(context.kind==='program-form'){
      context.form.querySelector('#items-editor').innerHTML=data.rows.map((r,i)=>itemEditor({...values(r.fields),id:r.id},i)).join('');
    }
    fill(context.form,data.fields,context.kind==='actuals-form'?'.actual-row':context.kind==='program-form'?'.item-editor':null);
    context.form.querySelector('.draft-offer')?.remove();
    context.source=source;context.serial='';changed();
    for(const select of context.form.querySelectorAll('[name="responsible-option"]'))select.closest('.actual-row').querySelector('[name="responsible-name"]').hidden=select.value!=='other';
    updateWeekday();updateActuals();feedback('Rascunho recuperado localmente, ainda não salvo no servidor. Revise os campos e salve para enviar.');
  }
  function comparison(form){
    if(!IASDPIAuth.allowed()||active?.form!==form||active.uid!==actor())throw Error('Edição indisponível para esta conta.');
    changed();return {uid:active.uid,version:active.version,baseline:JSON.parse(active.baseline),data:snapshot(form)};
  }
  async function preserveConflict(form,data,version,pendingDocument){
    const access=await IASDPIAuth.requireAccess(),context=active;
    if(context?.form!==form||context.uid!==access.user.id)throw Error('Edição indisponível para esta conta.');
    const copy=structuredClone(data);if(pendingDocument)copy.pendingDocument=structuredClone(pendingDocument);
    await persist({...context,key:context.key+':conflict:'+crypto.randomUUID(),version,data:copy,revision:crypto.randomUUID()},true);
  }
  function rebase(form,data){
    if(!IASDPIAuth.allowed()||active?.form!==form||active.uid!==actor())throw Error('Edição indisponível para esta conta.');
    applyData(active,data);feedback('Seleção reaplicada somente nesta edição. Revise e salve para gravar. O rascunho anterior foi preservado para consulta.');
  }
  function canLeave(){
    changed();if(!active?.dirty||active.leaving)return true;
    if(!confirm('Há alterações não salvas. Sair desta edição mantendo um rascunho local para recuperação? Nada será enviado ao servidor.'))return false;
    active.leaving=true;registrationDirty=false;return true;
  }
  function beforeRender(){changed();observer?.disconnect();active=null;}
  function beginSave(form){
    if(!forms.has(form.id))return null;
    changed();if(active?.form!==form)return null;
    return {context:active,key:active.key,revision:active.revision,uid:active.uid,source:active.source};
  }
  async function bind(form,program,context=active){
    if(context?.form!==form)return;
    const oldKey=context.key,revision=context.revision;
    context.version=program.version;context.id=program.id;context.key=draftKey(context.uid,context.kind,program.id);
    form.dataset.version=program.version;form.dataset.id=program.id;
    if(context.dirty)await persist(context);
    if(oldKey!==context.key&&revision)await enqueue(()=>remove(oldKey,revision));
  }
  async function saved(ticket,program){
    if(!ticket)return false;
    const context=ticket.context;
    await enqueue(async()=>{
      if(ticket.revision)await remove(ticket.key,ticket.revision);
      if(context.key!==ticket.key&&ticket.revision)await remove(context.key,ticket.revision);
      if(ticket.source)await remove(ticket.source.key,ticket.source.revision);
    });
    if(context.revision!==ticket.revision){
      await bind(context.form,program,context);return true;
    }
    context.version=program.version;context.dirty=false;context.baseline=context.serial;context.leaving=true;
    if(context.kind==='actuals-form')registrationDirty=false;
    await refreshNotice();return false;
  }
  async function discardCurrent(){
    changed();if(!active?.dirty)return true;
    if(!confirm('Descartar somente as alterações não salvas desta edição? O registro salvo não será alterado.'))return false;
    const context=active;observer?.disconnect();active=null;registrationDirty=false;
    await enqueue(async()=>{await remove(context.key,context.revision);if(context.source)await remove(context.source.key,context.source.revision);});
    await refreshNotice();return true;
  }
  async function clearUser(uid){
    if(!uid)return;suspend();
    await enqueue(async()=>{
      for(const row of memory.values())if(row.scope===scope&&row.uid===uid)memory.delete(row.key);
      keys.delete(group(uid));
      // Tentar também quando houve fallback em memória: pode haver uma cópia
      // persistida de antes da falha. Não afirmar limpeza se o navegador a negar.
      try{
        const db=await open();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(['drafts','keys'],'readwrite'),store=tx.objectStore('drafts'),read=store.getAll();
          read.onsuccess=()=>{for(const row of read.result)if(row.scope===scope&&row.uid===uid)store.delete(row.key);};
          tx.objectStore('keys').delete(group(uid));
          tx.oncomplete=()=>{db.close();resolve();};
          tx.onabort=tx.onerror=()=>{db.close();reject(Error('Limpeza local indisponível.'));};
        });
      }catch(_){throw Error('Sessão encerrada, mas o navegador impediu a limpeza dos rascunhos cifrados. Em dispositivo compartilhado, limpe os dados deste site no navegador.');}
    });
  }
  async function confirmLogout(){
    changed();const uid=actor();if(!uid)return true;
    const list=await enqueue(()=>owned(uid));
    return !list.length&&!active?.dirty||confirm('Sair da conta removerá os rascunhos locais deste usuário neste site. Alterações ainda não enviadas serão descartadas. Salve no servidor antes de sair se quiser mantê-las. Continuar?');
  }
  document.addEventListener('input',event=>{if(forms.has(event.target.closest('form')?.id))changed();});
  document.addEventListener('change',event=>{if(forms.has(event.target.closest('form')?.id))changed();});
  window.addEventListener('iasdpi-auth-changed',()=>{if(!actor()||(active&&active.uid!==actor()))suspend();});
  window.addEventListener('beforeunload',event=>{changed();if(active?.dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)changed();});
  return {mount,beforeRender,changed,canLeave,beginSave,bind,saved,discardCurrent,clearUser,confirmLogout,comparison,preserveConflict,rebase,capture:form=>{if(!IASDPIAuth.allowed()||!forms.has(form?.id))throw Error('Acesso necessário.');return snapshot(form);},flush:()=>queue};
})();

;
'use strict';
// Histórico da interface; autorização e dados continuam nos serviços existentes.
window.IASDPINavigation=(()=>{
  const pages=new Set(['home','programs','tracking','history','edit','summary','actuals','agendas','archive','organization','login','users','invite','plan-edit','trash','models','forgot-password','reset-password']);
  const records=new Set(['edit','summary','tracking','actuals','plan-edit']);
  let current=null,restoring=null;
  function parse(){
    captureInvite(location.hash.slice(1));
    const parts=location.hash.slice(1).split('/');let id;
    try{id=parts[1]?decodeURIComponent(parts[1]):null;}catch(_){return null;}
    return pages.has(parts[0])&&parts.length<=2?{page:parts[0],id:records.has(parts[0])?id:null}:null;
  }
  function route(page,id){return '#'+page+(records.has(page)&&id?'/'+encodeURIComponent(id):'');}
  function entry(){return window.history.state?.iasdpiNavigation;}
  function stamp(position,hash,scroll=0){window.history.replaceState({...window.history.state,iasdpiNavigation:{position,hash,scroll}},'',hash);}
  function choose(page,id){
    state.page=page;
    if(id)state.selected=id;
    else if(['actuals','edit','plan-edit','summary'].includes(page))state.selected=null;
    else if(page==='tracking'&&!selected())state.selected=state.programs.find(p=>p.status==='Em andamento')?.id||state.programs.find(p=>p.status==='Pronta')?.id||null;
  }
  function display(page,id,scroll=0){
    window.IASDPIConflicts?.close();choose(page,id);render();app.focus({preventScroll:true});window.scrollTo({top:scroll,behavior:'instant'});
    if(page==='users'&&IASDPIAuth.isAdmin()&&!usersState.loaded)void guarded(()=>refreshUsers());
    if(page==='trash'&&IASDPIAuth.isAdmin()&&trashState.rows===null)void guarded(()=>refreshTrash());
  }
  function start(){
    let parsed=parse()||{page:state.page,id:null};
    if(parsed.page==='login'&&IASDPIAuth.allowed())parsed={page:'home',id:null};
    choose(parsed.page,parsed.id);
    const hash=route(parsed.page,parsed.id),position=Number.isInteger(entry()?.position)?entry().position:current?.position||0;
    current={position,hash};restoring=null;stamp(position,hash,entry()?.scroll||0);
  }
  function navigate(page,id,{replace=false,refresh=false}={}){
    if(restoring)return false;
    if(!pages.has(page))return false;
    const recordId=id||(records.has(page)&&!['actuals','edit'].includes(page)?state.selected:null);
    const hash=route(page,recordId);
    if(current?.hash===hash&&!refresh){app.focus({preventScroll:true});return true;}
    if(!canLeaveRegistration())return false;
    if(!current)start();
    stamp(current.position,current.hash,window.scrollY);
    const replaceEntry=replace||current.hash===hash,position=replaceEntry?current.position:current.position+1;
    if(replaceEntry)stamp(position,hash);else window.history.pushState({iasdpiNavigation:{position,hash,scroll:0}},'',hash);
    current={position,hash};display(page,recordId);return true;
  }
  function identify(page,id){
    const hash=route(page,id),position=current?.position??entry()?.position??0;
    current={position,hash};stamp(position,hash,window.scrollY);
  }
  function traversed(){
    if(!current)return;
    const parsed=parse()||{page:IASDPIAuth.allowed()?'home':'organization',id:null};
    const hash=route(parsed.page,parsed.id),metadata=entry();
    if(restoring){
      if(metadata?.position===restoring.position&&hash===restoring.hash){restoring=null;return;}
      // Uma única travessia de retorno está em trânsito. Não enfileirar outro go.
      return;
    }
    if(hash===current.hash&&metadata?.position===current.position)return;
    const position=Number.isInteger(metadata?.position)?metadata.position:current.position+1;
    if(!canLeaveRegistration()){
      restoring={...current};
      const delta=current.position-position;
      if(delta)window.history.go(delta);else{stamp(current.position,current.hash,window.scrollY);restoring=null;}
      return;
    }
    current={position,hash};stamp(position,hash,metadata?.scroll||0);display(parsed.page,parsed.id,metadata?.scroll||0);
  }
  window.addEventListener('popstate',traversed);
  // Travessias e alterações de fragmento já disparam popstate. hashchange da
  // mesma travessia não representa outra intenção do usuário.
  document.querySelector('.skip-link')?.addEventListener('click',event=>{event.preventDefault();app.focus({preventScroll:true});app.scrollIntoView({block:'start'});});
  return {start,navigate,identify,pending:()=>Boolean(restoring)};
})();

;
'use strict';
// Compara controles por IDs estáveis. Reaplicar prepara uma edição; nunca grava.
window.IASDPIConflicts=(()=>{
  let current=null,dialog=null;
  const kinds=new Set(['actuals-form','program-form','notes-form']);
  const captions={'record-name':'Nome do culto','record-date':'Data do culto','record-info':'Informações complementares',note:'Observação',incident:'Ocorrência',name:'Nome da programação',date:'Data',start:'Início',end:'Término',activity:'Atividade',block:'Bloco',responsible:'Responsável',ready:'Marcar como pronta','extra-theme':'Tema da atividade extra','activity-note':'Observação da atividade','sub-title':'Título','sub-responsible':'Responsável','sub-note':'Observação','sub-start':'Início real','sub-end':'Término real',responsavel:'Responsável'};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function groups(fields=[]){
    const result=new Map();
    for(const field of fields||[]){const key=['responsible-option','responsible-name'].includes(field.name)?'responsavel':field.name;if(!result.has(key))result.set(key,[]);result.get(key).push(field);}
    return result;
  }
  function semantic(fields){return fields?.map(f=>({name:f.name,value:f.value,checked:f.checked??null,precision:f.original===undefined?null:f.edited==='true'?'editado':f.reapplied||f.original}));}
  function text(fields){
    if(!fields)return 'Não existe nesta versão';
    if(fields.some(f=>f.name==='responsible-option')){const option=fields.find(f=>f.name==='responsible-option')?.value;return option==='other'?fields.find(f=>f.name==='responsible-name')?.value||'Em branco':option||'Em branco';}
    return fields.map(f=>f.checked!==undefined?(f.checked?'Sim':'Não'):(f.value||'Em branco')+(f.original&&f.edited!=='true'&&/\.\d+/.test(f.reapplied||f.original)?' (precisão original: '+(f.reapplied||f.original)+')':'')).join(' · ');
  }
  function describeRows(rows=[]){return rows.map(row=>text(row.fields)).join('\n');}
  function differences(baseline,mine,remote,kind,latest,blocked){
    const changes=[];
    function controls(base,local,saved,path,label){
      const old=groups(base),a=groups(local),b=groups(saved);
      for(const key of new Set([...a.keys(),...b.keys()])){
        const source=a.get(key),target=b.get(key);if(equal(semantic(source),semantic(target)))continue;
        const localChange=base===null||!equal(semantic(source),semantic(old.get(key)));
        changes.push({type:'fields',path,key,label:label+(key.startsWith('team-')?roles[Number(key.slice(5))]:captions[key]||key),mine:source,remote:target,local:localChange,enabled:!blocked&&localChange&&Boolean(source&&target),reason:!localChange?'Alterado somente no banco; será mantido.':!target?'Campo removido no banco; ajuste manual necessário.':blocked?'A programação prevista está protegida após o início.':''});
      }
    }
    function collection(base,local,saved,path,isChild=false){
      const old=new Map((base||[]).map(r=>[r.id,r])),a=new Map(local.map(r=>[r.id,r])),b=new Map(saved.map(r=>[r.id,r]));
      const title=row=>row?.fields?.find(f=>['activity','extra-theme','sub-title'].includes(f.name))?.value||latest.plan.items.find(i=>i.id===row?.id)?.activity||row?.id||'Sem título';
      for(const id of new Set([...a.keys(),...b.keys()])){
        const source=a.get(id),target=b.get(id),previous=old.get(id),index=local.findIndex(r=>r.id===id)+1;
        const label=(isChild?'Subatividade ':'Atividade ')+(index||saved.findIndex(r=>r.id===id)+1)+': '+title(source||target)+' / ';
        if(source&&target){
          controls(previous?.fields??(baseline===null?null:[]),source.fields,target.fields,[...path,id],label);
          if(!isChild)collection(previous?.children??(baseline===null?null:[]),source.children||[],target.children||[],[...path,id,'children'],true);
        }else{
          const addition=Boolean(source&&!previous),removal=Boolean(!source&&previous),allowed=isChild||kind==='program-form'||(source||previous)?.extra;
          changes.push({type:addition?'add':removal?'remove':'unavailable',path,id,label:label+(addition?'Adicionar':removal?'Excluir':'Removida ou adicionada no banco'),mine:source,remote:target,local:addition||removal,enabled:!blocked&&allowed&&(addition||removal),reason:blocked?'A programação prevista está protegida após o início.':!addition&&!removal?'Estrutura alterada no banco; será preservada.':!allowed?'Atividades previstas só podem mudar na edição da programação.':''});
        }
      }
      const ordered=rows=>(rows||[]).map(r=>r.id).filter(id=>a.has(id)&&b.has(id));
      if(base&& !equal(ordered(base),ordered(local)))changes.push({type:'order',path,label:'Ordem das atividades / subatividades',mine:local,remote:saved,local:true,enabled:false,reason:'Reordene manualmente após comparar; a ordem recente não será substituída.'});
    }
    controls(baseline?.fields??null,mine.fields,remote.fields,[],'');
    collection(baseline?.rows??null,mine.rows,remote.rows,[]);
    return changes;
  }
  function snapshotFor(program,kind){
    const protectedPlan=kind==='program-form'&&!['Planejamento','Pronta'].includes(program.status);
    const template=document.createElement('template');
    template.innerHTML=kind==='actuals-form'?actualsForm(program):kind==='notes-form'?notes(program):editor(protectedPlan?{...program,status:'Planejamento'}:program,true);
    const form=template.content.querySelector('#'+kind);if(!form)throw Error('O tipo de registro mudou; reabra a programação para editar.');
    return {data:IASDPIDrafts.capture(form),blocked:protectedPlan||kind==='actuals-form'&&program.execution_mode!=='manual'};
  }
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.dataset.conflictDialog='true';dialog.className='conflict-dialog';dialog.setAttribute('aria-labelledby','conflict-title');document.body.append(dialog);
    dialog.addEventListener('close',()=>{if(dialog.open)return;const target=current?.form;current=null;dialog.replaceChildren();if(document.activeElement===document.body&&target?.isConnected)target.querySelector('button[type="submit"]')?.focus();});
  }
  function run(task,button){return guarded(async()=>{try{await task();}catch(error){const target=dialog?.querySelector('.conflict-feedback');if(dialog?.open&&target){target.setAttribute('role','alert');target.textContent=error.message;}throw error;}},button);}
  function draw(notice=''){
    const review=current;if(!review)return;
    const value=change=>change.type==='fields'?text(change.mine):change.mine?describeRows(Array.isArray(change.mine)?change.mine:[change.mine]):'Removida nesta edição';
    const saved=change=>change.type==='fields'?text(change.remote):change.remote?describeRows(Array.isArray(change.remote)?change.remote:[change.remote]):'Não existe nesta versão';
    dialog.innerHTML=`<h2 id="conflict-title">Comparar versões do registro</h2><p><strong>Banco: versão ${review.latest.version}</strong> · Sua edição: versão ${review.version}. ${esc(review.latest.plan.name)}</p><p>Nada será gravado nesta janela. Selecione somente as alterações que deseja reaplicar, confirme e depois revise e salve o formulário. Campos não selecionados manterão a versão do banco. A cópia local anterior será preservada como rascunho protegido.</p>${review.baseline===null?'<p class="form-note">Rascunho antigo: não há uma base confiável para identificar quais campos foram alterados originalmente. Revise cada diferença; nenhuma seleção é automática.</p>':''}${notice?`<p role="alert" class="form-error">${esc(notice)}</p>`:''}${review.blocked?'<p class="form-error" role="status">A programação prevista está protegida após o início. As diferenças são apenas para consulta.</p>':''}
      <p id="conflict-scroll-hint" class="muted">Se as colunas não couberem, deslize a tabela na horizontal. Com teclado, foque a tabela e use as setas para consultar as duas versões.</p><div class="table-scroll" tabindex="0" role="region" aria-describedby="conflict-scroll-hint" aria-label="Diferenças entre sua edição e a versão salva no banco"><table><thead><tr><th>Reaplicar</th><th>Campo</th><th>Versão salva no banco</th><th>Sua edição local</th></tr></thead><tbody>${review.changes.map((change,index)=>`<tr><td><label class="conflict-choice"><input type="checkbox" data-conflict-choice="${index}" ${change.enabled?'':'disabled'} aria-label="Reaplicar ${esc(change.label)}"></label></td><th scope="row">${esc(change.label)}<small>${esc(change.reason)}</small></th><td><pre>${esc(saved(change))}</pre></td><td><pre>${esc(value(change))}</pre></td></tr>`).join('')}</tbody></table></div>${!review.changes.length?'<p role="status">Não há campos divergentes. Você pode carregar a versão atual para continuar.</p>':''}
      <p class="conflict-feedback" role="status" aria-live="polite">Nenhuma alteração selecionada.</p><div class="actions conflict-actions"><button type="button" data-conflict-close>Voltar à edição</button><button type="button" data-conflict-refresh>Atualizar comparação</button><button type="button" data-conflict-load>Usar versão atual do banco</button><button type="button" class="primary" data-conflict-apply disabled>Reaplicar seleção na edição</button></div>`;
    dialog.querySelectorAll('[data-conflict-choice]').forEach(input=>input.addEventListener('change',()=>{const count=dialog.querySelectorAll('[data-conflict-choice]:checked').length;dialog.querySelector('[data-conflict-apply]').disabled=!count;dialog.querySelector('.conflict-feedback').textContent=count?`${count} alterações selecionadas. Ainda não reaplicadas.`:'Nenhuma alteração selecionada.';}));
    dialog.querySelector('[data-conflict-close]').onclick=close;
    dialog.querySelector('[data-conflict-refresh]').onclick=event=>run(()=>refresh(review),event.currentTarget);
    dialog.querySelector('[data-conflict-apply]').onclick=event=>run(()=>apply(review,false),event.currentTarget);
    dialog.querySelector('[data-conflict-load]').onclick=event=>run(()=>apply(review,true),event.currentTarget);
  }
  async function load(form,error,source=null,notice=''){
    const access=await IASDPIAuth.requireAccess(),context=IASDPIDrafts.comparison(form),uid=source?.uid||context.uid;
    if(uid!==access.user.id)throw Error('A edição pertence a outra conta.');
    const id=form.dataset.id;if(!id)throw Error('O registro precisa existir para comparar versões.');
    const fingerprint=JSON.stringify(IASDPIDrafts.capture(form)),latest=await api('programs/'+encodeURIComponent(id));
    if(!form.isConnected||IASDPIAuth.session()?.user.id!==uid)throw Error('A edição ou a sessão mudou.');
    const reference=snapshotFor(latest,form.id);
    current={form,page:state.page,kind:form.id,id,uid,error,source,version:source?.version??context.version,baseline:source?null:context.baseline,mine:structuredClone(source?.data||context.data),fingerprint,latest,remote:reference.data,blocked:reference.blocked};
    current.changes=differences(current.baseline,current.mine,current.remote,current.kind,latest,current.blocked);
    ensureDialog();draw(notice);if(!dialog.open)dialog.showModal();dialog.querySelector('[data-conflict-close]').focus();
  }
  async function open(form,error){await load(form,error);}
  async function openDraft(form,source){await load(form,null,source);}
  async function refresh(review,notice='Comparação atualizada. Revise novamente as seleções.'){
    if(current!==review||!dialog.open)return;
    await load(review.form,review.error,review.source,notice);
  }
  function fieldsAt(snapshot,path){
    if(!path.length)return snapshot;
    const row=snapshot.rows.find(r=>r.id===path[0]);
    return path.length===1?row:row?.children?.find(c=>c.id===path[2]);
  }
  function collectionAt(snapshot,path){return !path.length?snapshot.rows:snapshot.rows.find(r=>r.id===path[0])?.children;}
  function copiedField(field){const copy=structuredClone(field);if(copy.original&&copy.edited!=='true'){const clock=recordClock(copy.reapplied||copy.original);if(validRecordClock(clock))copy.reapplied=clock;}return copy;}
  function copiedRow(row){return {...structuredClone(row),fields:row.fields.map(copiedField),children:(row.children||[]).map(copiedRow)};}
  function patch(snapshot,change){
    if(change.type==='fields'){
      const target=fieldsAt(snapshot,change.path);if(!target)throw Error('A estrutura mudou; reabra a comparação.');
      for(const field of change.mine){
        const copy=copiedField(field);
        const index=target.fields.findIndex(f=>f.name===copy.name);if(index>=0)target.fields[index]=copy;
      }
    }else if(change.type==='add'||change.type==='remove'){
      const target=collectionAt(snapshot,change.path);if(!target)throw Error('A atividade principal foi removida.');
      if(change.type==='add'){if(target.some(r=>r.id===change.id))throw Error('Identificador já existente.');target.push(copiedRow(change.mine));}
      else{const index=target.findIndex(r=>r.id===change.id);if(index>=0)target.splice(index,1);}
    }
  }
  async function apply(review,remoteOnly){
    if(current!==review||!dialog.open)throw Error('Comparação encerrada.');
    const selected=remoteOnly?[]:[...dialog.querySelectorAll('[data-conflict-choice]:checked')].map(input=>review.changes[Number(input.dataset.conflictChoice)]);
    if(!remoteOnly&&(!selected.length||selected.some(c=>!c.enabled)))throw Error('Selecione alterações válidas.');
    if(!confirm(remoteOnly?'Carregar a versão atual sem reaplicar alterações? Sua cópia local será preservada para consulta. Nada será gravado no banco.':`Reaplicar ${selected.length} alterações selecionadas sobre a versão ${review.latest.version}? As demais informações do banco serão mantidas. Você ainda deverá revisar e salvar.`))return;
    const access=await IASDPIAuth.requireAccess();if(access.user.id!==review.uid)throw Error('A conta mudou.');
    if(!review.form.isConnected||JSON.stringify(IASDPIDrafts.capture(review.form))!==review.fingerprint)throw Error('A edição local mudou. Atualize a comparação antes de reaplicar.');
    const latest=await api('programs/'+encodeURIComponent(review.id));
    if(latest.version!==review.latest.version){await refresh(review,'O banco mudou novamente. Nenhuma seleção foi reaplicada. Revise a nova versão.');return;}
    const data=structuredClone(review.remote);for(const change of selected)patch(data,change);
    await IASDPIDrafts.preserveConflict(review.form,review.mine,review.version,review.error?.conflict?.document);
    if(review.error?.conflict&&window.IASDPIOperational)await IASDPIOperational.releaseConflict(review.error.conflict,latest.version);
    if(current!==review||!dialog.open||IASDPIAuth.session()?.user.id!==review.uid||!IASDPIAuth.allowed())throw Error('A comparação ou sessão foi encerrada.');
    state.page=review.kind==='actuals-form'?(latest.execution_mode==='manual'?'actuals':'tracking'):review.kind==='program-form'?'plan-edit':review.page;
    replaceProgram(latest);IASDPINavigation.identify(state.page,latest.id);render();
    const form=document.querySelector('#'+review.kind);if(!form){if(remoteOnly){close();app.focus({preventScroll:true});toast('Versão atual carregada para consulta. Nenhuma gravação foi realizada.');return;}throw Error('A programação mudou de estado; reabra o registro.');}
    if(!remoteOnly){IASDPIDrafts.rebase(form,data);if(review.kind==='actuals-form')setRegistrationSaveState(form,'dirty','Seleção reaplicada nesta edição · ainda não salva.');}
    close();form.querySelector('input,textarea,select')?.focus();toast(remoteOnly?'Versão atual carregada. Nenhuma gravação foi realizada.':'Seleção reaplicada somente na edição. Revise e clique em Salvar.');
  }
  function close(){if(dialog?.open)dialog.close();}
  window.addEventListener('iasdpi-auth-changed',()=>{if(current&&(!IASDPIAuth.allowed()||IASDPIAuth.session()?.user.id!==current.uid))close();});
  return {open,openDraft,close};
})();

;
'use strict';
// Apenas consulta: os mesmos registros e cálculos dos Lotes 1–4.
window.IASDPIHistory=(()=>{
  let owner=null,filters={query:'',from:'',to:''},timer=null;
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
  function filter(programs,values=filters){
    const from=values.from?recordDay(values.from):'',to=values.to?recordDay(values.to):'',query=normalize(values.query);
    const error=values.from&&!from?{field:'history-from',message:'Informe uma data inicial válida em dd/mm/aaaa.'}:values.to&&!to?{field:'history-to',message:'Informe uma data final válida em dd/mm/aaaa.'}:from&&to&&from>to?{field:'history-to',message:'A data final não pode ser anterior à inicial.'}:null;
    const all=programs.filter(p=>p.status==='Finalizada');
    if(error)return {error,all,rows:[],excluded:all.length};
    const rows=all.filter(p=>{const day=recordDay(p.plan.date);return (!from||day&&day>=from)&&(!to||day&&day<=to)&&(!query||normalize(p.plan.name).includes(query)||normalize(displayDate(p.plan.date)).includes(query)||String(p.plan.date||'').includes(query));}).sort((a,b)=>String(b.plan.date||'').localeCompare(String(a.plan.date||'')));
    return {error:null,all,rows,excluded:all.length-rows.length,from,to};
  }
  function results(){
    const result=filter(state.programs);
    if(result.error)return `<p role="alert" class="form-error">${esc(result.error.message)} Os indicadores não foram calculados com filtros inválidos.</p>`;
    const {rows,all,excluded,from,to}=result,days=rows.map(p=>recordDay(p.plan.date)).filter(Boolean).sort();
    const period=from||to?`${from?displayDate(from):'Sem limite inicial'} a ${to?displayDate(to):'sem limite final'}`:days.length?`${displayDate(days[0])} a ${displayDate(days.at(-1))}`:'Todos os períodos';
    const ends=endStatistics(rows),badDates=all.filter(p=>!recordDay(p.plan.date)).length;
    const info=`<p class="history-context" role="status" aria-live="polite">Período analisado: <strong>${esc(period)}</strong>. ${rows.length} de ${all.length} cultos finalizados neste recorte; ${excluded} fora dos filtros. Indicadores de término: ${ends.considered} considerados e ${ends.excluded} desconsiderados por dados insuficientes ou inválidos.${badDates?` ${badDates} cultos com data inconsistente${from||to?', excluídos do filtro por período':''}.`:''}</p>`;
    if(!rows.length)return info+empty(all.length?'Nenhum culto corresponde aos filtros':'Ainda não há programações finalizadas',all.length?'Revise a pesquisa ou use Limpar filtros.':'Os registros aparecerão aqui após a finalização.');
    return info+adherenceOverview(rows)+programTable(rows,true);
  }
  function page(){
    const uid=IASDPIAuth.session()?.user.id;if(owner!==uid){owner=uid;filters={query:'',from:'',to:''};}
    return heading('MEMÓRIA','Histórico','Pesquise cultos finalizados e analise os indicadores do período selecionado.')+
      `<form id="history-filters" class="panel"><div class="history-filters-grid"><label>Pesquisar por nome ou data<input type="search" name="history-query" value="${esc(filters.query)}" maxlength="200" placeholder="Ex.: sábado ou 10/10/2026" autocomplete="off"></label>${field('De','history-from',filters.from,'text',false,'data-date-input placeholder="dd/mm/aaaa" inputmode="numeric"')}${field('Até','history-to',filters.to,'text',false,'data-date-input placeholder="dd/mm/aaaa" inputmode="numeric"')}</div><div class="actions"><button type="submit" class="primary">Aplicar filtros</button><button type="button" data-action="history-clear">Limpar filtros</button></div><p class="muted">A pesquisa por nome ou data é combinada com o período. Os limites de data são inclusivos.</p></form><section id="history-results" aria-label="Resultados do Histórico">${results()}</section>`;
  }
  function apply(form=document.querySelector('#history-filters')){
    clearTimeout(timer);if(!form?.isConnected)return;
    filters={query:form.elements['history-query'].value,from:form.elements['history-from'].value.trim(),to:form.elements['history-to'].value.trim()};
    form.querySelectorAll('[aria-invalid="true"]').forEach(clearFieldError);
    const result=filter(state.programs),target=document.querySelector('#history-results');
    if(target)target.innerHTML=results();
    if(result.error)fieldError(form.elements[result.error.field],result.error.message);else pageLayout.mount();
  }
  function input(input){
    if(input.closest('form')?.id!=='history-filters')return;
    clearTimeout(timer);const form=input.form;timer=setTimeout(()=>apply(form),180);
  }
  function clear(){
    clearTimeout(timer);filters={query:'',from:'',to:''};
    const form=document.querySelector('#history-filters');if(!form)return;
    for(const input of form.querySelectorAll('input')){input.value='';clearFieldError(input);}
    apply(form);form.elements['history-query'].focus();
  }
  return {page,apply,input,clear,filter};
})();

;
'use strict';
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const state = { programs: [], selected: null, page: 'home', busy: false, zone: 'America/Sao_Paulo', offset: 0, duplicate: null, programsLoad: {status:'idle',error:''} };
let programsLoadGeneration=0;
let bootInProgress=false,sessionWasAuthorized=false;
let bootTask=null,pendingNavigation=null;
const thresholds = { onTime: 1, attention: 5 };
const roles = ['Ancião do mês', 'Recepção', 'Diácono', 'Diaconisa', 'Diretor de culto', 'Sonoplastia', 'Equipe de louvor', 'Responsável pela programação'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const minutes = (end,start,day) => {const a=recordEpoch(end,day),b=recordEpoch(start,day);return a===null||b===null?null:(a-b)/60000;};
const currentTime = () => new Date(Date.now() + state.offset);
const clock = value => actualClock(value)||'—';
const dateLabel = value => {const day=recordDay(value);return day?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(day+'T12:00:00Z')):'Data inconsistente — corrija no registro';};
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: state.zone }).format(currentTime());
const signed = value => { if(value===null||!Number.isFinite(value))return '—';const n = Math.round(value); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} min`; };
const duration = value => value==null||!Number.isFinite(value)?'—':`${Math.round(value)} min`;
const elapsed = start => { if(recordEpoch(start)===null)return '—';const seconds = Math.max(0, Math.floor((currentTime() - new Date(start)) / 1000)); return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2, '0')}`; };
function statusTone(value) { if(value===null||!Number.isFinite(value))return 'neutral';const n = Math.round(value); return n <= thresholds.onTime ? 'good' : n <= thresholds.attention ? 'warning' : 'critical'; }
function delayLabel(value) { if(value===null||!Number.isFinite(value))return 'Dados insuficientes';const n = Math.round(value); return n < 0 ? `${Math.abs(n)} min adiantado` : n <= 1 ? 'No horário' : `${n} min de atraso`; }
function toast(message, error = false) {
  notice.textContent = message; notice.className = error ? 'error' : ''; notice.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}
async function api(path = '', method = 'GET', body) {
  if(window.IASDPIOperational)return window.IASDPIOperational.request(path,method,body);
  const authorization=path==='health'?null:await IASDPIAuth.requireAccess();
  if (window.IASDPIDemo){const result=await window.IASDPIDemo.request(path,method,body);if(method!=='GET'&&cloudState.session)void cloudAutoArchive();return result;}
  const response = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authorization?{Authorization:'Bearer '+authorization.token}:{}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if(authorization&&IASDPIAuth.session()?.access_token!==authorization.token)throw Error('Sessão encerrada.');
  if (!response.ok) {if(response.status===401||response.status===403)void IASDPIAuth.restore().catch(()=>{});const failure=new Error(result.error||'Não foi possível concluir a operação.');if(response.status===409)failure.code='40001';throw failure;}
  if(method!=='GET'&&cloudState.session)void cloudAutoArchive();
  return result;
}
async function loadPrograms({renderState=false}={}){
  const generation=++programsLoadGeneration;
  state.programsLoad={status:'loading',error:''};if(renderState)render();
  try{
    const rows=await api('programs');
    if(!Array.isArray(rows)||rows.some(p=>!p||typeof p.id!=='string'||!p.plan||!Array.isArray(p.plan.items))||new Set(rows.map(p=>p.id)).size!==rows.length)throw Error('Resposta inválida ao consultar as programações.');
    if(generation!==programsLoadGeneration||!IASDPIAuth.allowed())return null;
    state.programs=rows;state.programsLoad={status:rows.length?'records':'empty',error:''};
    return rows;
  }catch(error){
    if(generation===programsLoadGeneration&&IASDPIAuth.allowed())state.programsLoad={status:'error',error:error.message};
    throw error;
  }finally{if(renderState&&generation===programsLoadGeneration)render();}
}
function programsLoadView(){
  const {status,error}=state.programsLoad;
  if(status==='error')return `<section class="empty" role="alert" data-load-state="error"><h2>Erro ao carregar os registros</h2><p>${esc(error)}</p><p>Não foi possível confirmar os dados. Isso não significa que não existam registros. Os dados já carregados e os rascunhos foram preservados.</p>${button('Tentar novamente','retry-programs','','class="primary"')}</section>`;
  return '<section class="empty" role="status" data-load-state="loading"><h2>Carregando registros…</h2><p>Aguarde a confirmação da consulta.</p></section>';
}
function selected() { return state.programs.find(p => p.id === state.selected); }
function replaceProgram(program) {
  const i = state.programs.findIndex(p => p.id === program.id);
  if (i < 0) state.programs.unshift(program); else state.programs[i] = program;
  state.selected = program.id;
  if(['records','empty'].includes(state.programsLoad.status))state.programsLoad={status:'records',error:''};
}
function executionInfo(p) {
  const source=p,samples=activitySamples(source),counts=sampleCounts(samples),day=recordDay(source.plan.date);
  const extraSamples=(source.extra_events||[]).map(e=>recordInterval(e.start,e.end,day));
  const extraCounts=sampleCounts(extraSamples);
  const actualComplete=counts.total>0&&samples.every(s=>s.actual.state==='valid')&&extraSamples.every(e=>e.state==='valid');
  let complete=actualComplete&&counts.considered===counts.total;
  p=programForMetrics(p);
  const items = p.plan.items;
  const active = p.execution_mode === 'manual' ? null : items.find(i => p.executions[i.id]?.started && !p.executions[i.id].ended);
  const pending = items.find(i => !p.executions[i.id]?.started);
  const finished = samples.filter(s=>s.actual.state==='valid').map(s=>s.item);
  const records = Object.values(p.extra_events?.length?registrationData(p).executions:p.executions).filter(e=>e?.started);
  const first = [...records].sort((a,b) => new Date(a.started)-new Date(b.started))[0];
  const last = records.filter(e => e.ended).sort((a,b) => new Date(b.ended)-new Date(a.ended))[0];
  let shift = null;
  const plannedInterval=recordInterval(source.planned_start||source.plan.start,source.planned_end||source.plan.end,day);
  complete &&= plannedInterval.state==='valid';
  if (p.status === 'Finalizada') {if(complete&&last&&plannedInterval.state==='valid')shift = minutes(last.ended, p.planned_end);}
  else if (active) {
    const e = p.executions[active.id];
    const plannedDuration = minutes(active.planned_end, active.planned_start);
    const delta=minutes(e.started,active.planned_start);
    shift=delta===null||plannedDuration===null?null:delta+Math.max(0,minutes(currentTime(),e.started)-plannedDuration);
  } else if (p.plan.date === today() && p.status === 'Pronta') {
    const delta=minutes(currentTime(),p.planned_start);shift=delta===null?null:Math.max(0,delta);
  }
  const origin = items.find(i => {
    const e = p.executions[i.id];
    return e && (minutes(e.started, i.planned_start) > thresholds.onTime || (e.ended && minutes(e.ended, i.planned_end) > thresholds.onTime));
  }) || (active && shift > thresholds.onTime ? active : null);
  const expected = items.find(i => currentTime() >= new Date(i.planned_start) && currentTime() < new Date(i.planned_end));
  const forecast = p.planned_end&&shift!==null?new Date(new Date(p.planned_end).getTime() + shift * 60000):null;
  const actualDuration=actualComplete&&first&&last?minutes(last.ended,first.started):null;
  return { active, pending, finished, first, last, shift, origin, expected, forecast, complete, counts, extraCounts, actualDuration };
}
function badge(value, label = delayLabel(value)) { return `<span class="badge ${statusTone(value)}">${esc(label)}</span>`; }
function heading(eyebrow, title, description = '', action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}</div>${action}</div>`;
}
function empty(title, description, action = '') { return `<div class="empty"><h2>${title}</h2><p>${description}</p>${action}</div>`; }
function button(label, action, id = '', extra = '') { return `<button type="button" data-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`; }
function programDate(value){return dateLabel(value);}
function programStatus(p) {
  const tone={'Planejamento':'neutral','Pronta':'good','Em andamento':'warning','Finalizada':'complete'}[p.status] || 'neutral';
  return `<span class="badge ${tone}">${esc(p.status==='Planejamento'?'Rascunho':p.status)}</span>`;
}
function programRow(p, historic = false) {
  const m = executionInfo(p);
  const view=programForMetrics(p);const planned = recordInterval(view.planned_start,view.planned_end,recordDay(p.plan.date)).minutes;
  const actual = m.actualDuration;
  return `<tr><td><strong>${esc(p.plan.name)}</strong><small>${esc(programDate(p.plan.date))}</small></td>
    <td>${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}${historic ? `<small>${duration(planned)} previstos · ${actual === null ? '—' : duration(actual)} realizados</small>` : ''}</td>
    <td>${historic ? badge(m.shift, signed(m.shift)) : `${programStatus(p)}`}</td>
    <td class="row-actions">${button(historic || p.status==='Finalizada' ? 'Ver resumo' : ['Planejamento','Pronta'].includes(p.status) ? 'Editar' : 'Ver programação', historic || p.status==='Finalizada' ? 'summary' : 'edit', p.id)}${button('Duplicar', 'duplicate', p.id)}${!historic&&window.IASDPIOperational&&IASDPIAuth.isAdmin()?button('Mover para a lixeira','trash-move',p.id,'class="danger-text"'):''}${!historic ? button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"') : ''}</td></tr>`;
}
function programTable(programs, historic = false) {
  return `<div class="table-scroll"><table><thead><tr><th>Programação</th><th>Horário ${historic ? '/ duração' : 'previsto'}</th><th>${historic ? 'Desvio do término' : 'Status'}</th><th>Ações</th></tr></thead><tbody>${programs.map(p => programRow(p, historic)).join('')}</tbody></table></div>`;
}
function home() {
  const upcoming = state.programs.filter(p => p.status !== 'Finalizada' && p.plan.date >= today())
    .sort((a, b) => `${a.plan.date} ${a.plan.start}`.localeCompare(`${b.plan.date} ${b.plan.start}`))[0];
  const running = state.programs.find(p => p.status === 'Em andamento');
  const featured = running || upcoming;
  const recent = state.programs.filter(p => p.status === 'Finalizada').sort((a,b) => String(b.plan.date||'').localeCompare(String(a.plan.date||''))).slice(0, 5);
  return heading('BEM-VINDO', 'Cada momento, no seu tempo.', 'Uma programação clara. Um acompanhamento tranquilo.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto', 'chronogram')}</div>`) +
    (featured ? `<section class="featured"><div><p class="eyebrow">${running ? 'EM ANDAMENTO' : 'PRÓXIMO CULTO'}</p><h2>${esc(featured.plan.name)}</h2><div class="featured-meta"><p class="date">${esc(programDate(featured.plan.date))}</p>${programStatus(featured)}</div><p class="large-time">${esc(displayPlannedTime(featured.plan.start||'—'))} <span>→</span> ${esc(displayPlannedTime(featured.plan.end||'—'))}</p><div class="actions">${button('Abrir programação', 'edit', featured.id)}${button(featured.execution_mode==='manual'?'Registrar culto':running?'Continuar acompanhamento':'Acompanhar culto', featured.execution_mode==='manual'?'actuals':'track', featured.id, 'class="primary"')}</div></div><div class="featured-aside"><span class="eyebrow">PLANEJAMENTO</span><strong>${featured.plan.items.length}</strong><span>momentos organizados</span></div></section>` : empty('Vamos preparar a próxima programação?', 'Use Nova programação para planejar ou Registrar culto para informar o que aconteceu.')) +
    `<section class="section"><div class="section-heading"><h2>Últimas programações</h2>${recent.length ? `<span class="muted">Desvio médio do término: ${signed(endStatistics(recent).mean)} · ${endStatistics(recent).considered} considerados / ${endStatistics(recent).excluded} desconsiderados</span>` : ''}</div>${recent.length ? programTable(recent, true) : '<p class="muted">Os resumos aparecerão aqui após finalizar uma programação.</p>'}</section>`;
}
function programsPage() {
  const list = [...state.programs].sort((a,b) => String(b.plan.date||'').localeCompare(String(a.plan.date||'')));
  return heading('PLANEJAMENTO', 'Programações', 'Organize horários, atividades e responsáveis.', `<div class="actions">${button('Nova programação', 'new', '', 'class="primary"')} ${button('Registrar culto', 'chronogram')}</div>`) +
    (window.IASDPIOperational&&IASDPIAuth.isAdmin()?`<div class="actions">${button('Gerenciar modelos','models-open')}${button('Lixeira de cultos','trash-open')}</div>`:'') +
    (list.length ? programTable(list) : empty('Nenhuma programação cadastrada', 'Use Nova programação para cadastrar os horários e as atividades.'));
}
function displayDate(value){const day=recordDay(value);return day?day.split('-').reverse().join('/'):value||'';}
function readDate(value){const day=recordDay(value);if(!day)throw Error('Informe uma data válida no formato dd/mm/aaaa.');return day;}
function readDateField(input){try{return readDate(input.value);}catch(error){throw fieldError(input,error.message);}}
function tryReadDate(value){try{return readDate(value);}catch(_){return '';}}
function field(label, name, value = '', type = 'text', required = false, extra = '') {
  if(type==='date'){value=displayDate(value);type='text';extra+=' data-date-input inputmode="numeric" placeholder="dd/mm/aaaa"';}
  if(type==='time'){value=displayPlannedTime(value);type='text';extra+=' data-planned-time maxlength="5" placeholder="HH:mm" inputmode="text" autocomplete="off" pattern="([01][0-9]|2[0-3]):[0-5][0-9]"';}
  return `<label><span class="field-label">${label}${required?' <span class="required-marker" aria-hidden="true">*</span><span class="sr-only"> (obrigatório)</span>':''}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${extra}></label>`;
}
function itemEditor(i = {}, index = 0) {
  const complete=Boolean(i.activity && i.start && i.end);
  return `<fieldset class="item-editor" data-item-id="${esc(i.id || crypto.randomUUID())}"><legend>Atividade <span class="item-number">${index+1}</span></legend>
    <details class="item-details" ${complete?'':'open'}><summary><span class="item-overview"><strong class="item-overview-title">${esc(displayPlannedTime(i.start || '—'))} → ${esc(displayPlannedTime(i.end || '—'))} · ${esc(i.activity || 'Nova atividade')}</strong><small class="item-overview-responsible">${esc(i.responsible || 'Responsável opcional')}</small></span><span class="item-edit-label">Editar</span></summary>
    <div class="item-fields">${field('Bloco', 'block', i.block || 'Culto', 'text', true, 'maxlength="200" list="blocks"')}${field('Atividade', 'activity', i.activity, 'text', true, 'maxlength="200"')}${field('Responsável', 'responsible', i.responsible, 'text', false, 'maxlength="200"')}${field('Início previsto', 'start', i.start, 'time', true)}${field('Término previsto', 'end', i.end, 'time', true)}${field('Observação', 'note', i.note, 'text', false, 'maxlength="2000"')}</div></details>
    <div class="item-controls">${button('↑ Subir', 'up')}${button('↓ Descer', 'down')}${button('Excluir atividade', 'remove-item', '', 'class="danger-text"')}</div></fieldset>`;
}
function updateItemOverview(row) {
  const get=name=>row.querySelector(`[name="${name}"]`).value;
  row.querySelector('.item-overview-title').textContent=`${get('start') || '—'} → ${get('end') || '—'} · ${get('activity') || 'Nova atividade'}`;
  row.querySelector('.item-overview-responsible').textContent=get('responsible') || 'Responsável opcional';
}
function fieldError(input,message) {
  input.setAttribute('aria-invalid','true');
  let error=input.parentElement.querySelector('.field-error');
  if(!error){error=document.createElement('span');error.className='field-error';error.id='error-'+crypto.randomUUID();input.after(error);}
  error.textContent=message;input.setAttribute('aria-describedby',error.id);
  for(let parent=input.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  input.disabled=false;input.focus();
  return Error(message);
}
function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const error=input.parentElement.querySelector('.field-error');
  if(error){input.removeAttribute('aria-describedby');error.remove();}
}
function validateProgramForm(form,plan) {
  if(plan.template_id==='free'&&!plan.items.length&&!plan.start&&!plan.end)return;
  const check=(input,message)=>{throw fieldError(input,message);};
  for(const input of form.querySelectorAll('[data-planned-time]'))if((input.required||input.value)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.value))check(input,'Use o formato 24 horas HH:mm (ex.: 14:05).');
  if(plan.end<=plan.start)check(form.querySelector('.form-grid [name="end"]'),'O término deve ser depois do início.');
  if(!plan.name.trim())check(form.querySelector('[name="name"]'),'Informe o nome da programação.');
  const rows=[...form.querySelectorAll('.item-editor')];
  if(!rows.length&&plan.template_id!=='free'){form.querySelector('[data-action="add-item"]').focus();throw Error('Adicione pelo menos uma atividade.');}
  let previous=plan.start;
  plan.items.forEach((item,index)=>{
    const row=rows[index];
    for(const name of ['activity','block'])if(!item[name].trim())check(row.querySelector(`[name="${name}"]`),'Preencha este campo obrigatório.');
    if(item.end<=item.start)check(row.querySelector('[name="end"]'),'O término deve ser depois do início.');
    if(item.start<previous)check(row.querySelector('[name="start"]'),'A atividade deve começar após a anterior e dentro da programação.');
    if(item.end>plan.end)check(row.querySelector('[name="end"]'),'O término ultrapassa o horário da programação.');
    previous=item.end;
  });
}
function editor(p,plannedOnly=false) {
  if (p?.execution_mode === 'manual'&&!plannedOnly) return actualsForm(p);
  if (p && !['Planejamento', 'Pronta'].includes(p.status)) return planView(p);
  const plan = p?.plan || { name: 'Culto de sábado', date: today(), start: '09:30', end: '12:25', team: {}, items: [] };
  return heading('PLANEJAMENTO', p ? 'Editar programação' : 'Nova programação', 'Planeje os horários. Campos com * são obrigatórios; a equipe é opcional.', button('Voltar', 'programs')) +
    `<form id="program-form" data-id="${esc(p?.id || '')}" data-version="${p?.version || ''}">
      <section class="panel form-grid">${field('Nome da programação', 'name', plan.name, 'text', true, 'maxlength="200"')}${field('Data', 'date', plan.date, 'date', true)}${field('Início previsto', 'start', plan.start, 'time', !(plan.template_id==='free'&&!plan.items.length))}${field('Término previsto', 'end', plan.end, 'time', !(plan.template_id==='free'&&!plan.items.length))}<p id="weekday" class="muted"></p></section>
      <details class="panel"><summary>Equipe <span class="muted">· preenchimento opcional</span></summary><div class="form-grid team">${roles.map((role,i) => field(role, `team-${i}`, plan.team[role], 'text', false, 'maxlength="200"')).join('')}</div></details>
      <div class="section-heading"><h2>Itens da programação</h2>${button('+ Adicionar atividade', 'add-item')}</div><p class="muted">A ordem deve acompanhar os horários. Intervalos são permitidos; sobreposições, não.</p>
      <datalist id="blocks"><option value="Culto"><option value="Escola Sabatina"></datalist>
      <div id="items-editor">${(plan.items.length ? plan.items : plan.template_id==='free'?[]:[{}]).map(itemEditor).join('')}</div>
      <div class="actions form-footer"><button class="primary" type="submit">Salvar programação</button><label class="checkbox" ${p?.execution_mode==='manual'?'hidden':''}><input name="ready" type="checkbox" ${p?.status === 'Pronta'&&p.execution_mode!=='manual' ? 'checked' : ''}> Liberar para acompanhamento após salvar</label><p class="muted ready-help" ${p?.execution_mode==='manual'?'hidden':''}>Ao marcar, o sistema salva o planejamento e depois altera o status para Pronta.</p></div>
    </form>`;
}
function planView(p) {
  return heading('PROGRAMAÇÃO', esc(p.plan.name), esc(dateLabel(p.plan.date)), `${button('Duplicar', 'duplicate', p.id)}${window.IASDPIOperational&&IASDPIAuth.isAdmin()?button('Mover para a lixeira','trash-move',p.id,'class="danger-text"'):''} ${button(p.execution_mode === 'manual' ? 'Registrar culto' : 'Acompanhar', p.execution_mode === 'manual' ? 'actuals' : 'track', p.id, 'class="primary"')}`) +
    `<p class="muted">Planejamento protegido após o início. Horário previsto: ${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}.</p>` + timeline(p) +
    `<details class="panel"><summary>Equipe</summary><dl class="team-read">${roles.map(role => `<div><dt>${esc(role)}</dt><dd>${esc((p.plan.team||{})[role] || 'Não informado')}</dd></div>`).join('')}</dl></details>`;
}
function timeline(p) {
  p=programForMetrics(p);
  let block = '';
  return `<section class="section"><div class="section-heading"><h2>Linha da programação</h2><span class="muted">✓ Finalizado · ● Em andamento · ○ Pendente</span></div><ol class="timeline">${p.plan.items.map(i => {
    const e = p.executions[i.id];
    const done = Boolean(e?.ended), active = e && !done;
    const diff = done ? minutes(e.ended, i.planned_end) : e ? minutes(e.started, i.planned_start) : 0;
    const blockLabel = block !== i.block ? `<li class="block-label">${esc(i.block)}</li>` : ''; block = i.block;
    return `${blockLabel}<li class="timeline-row ${active ? 'active' : ''}"><span class="timeline-symbol" aria-label="${done ? 'Finalizado' : active ? 'Em andamento' : 'Pendente'}">${done ? '✓' : active ? '●' : '○'}</span><div class="timeline-time">${esc(displayPlannedTime(i.start))}<small>${esc(displayPlannedTime(i.end))}</small></div><div class="timeline-content"><strong>${esc(i.activity)}</strong><span>${esc(i.responsible || 'Responsável não informado')}</span><small>Previsto: ${esc(displayPlannedTime(i.start))} → ${esc(displayPlannedTime(i.end))}${e ? ` · Real: ${clock(e.started)} → ${e.ended ? clock(e.ended) : 'em andamento'}` : ''}</small>${i.note ? `<small>${esc(i.note)}</small>` : ''}</div>${e ? badge(diff, done ? `${signed(diff)} no término` : `${signed(diff)} no início`) : '<span class="badge neutral">Pendente</span>'}</li>`;
  }).join('')}</ol></section>`;
}
function notes(p) {
  return `<section class="section"><h2>Observações e ocorrências</h2><form id="notes-form" data-id="${esc(p.id)}" data-version="${p.version}"><div class="notes-grid"><div><label for="execution-note">Observações</label><textarea id="execution-note" name="note" maxlength="5000" rows="3" placeholder="Registre o que ajudou ou afetou a programação.">${esc(p.note)}</textarea></div><div><label for="execution-incident">Ocorrência não prevista</label><textarea id="execution-incident" name="incident" maxlength="5000" rows="3" placeholder="Ex.: comunicação adicionada após os anúncios.">${esc(p.incident)}</textarea></div></div><button type="submit">Salvar observações</button></form></section>`;
}
function tracking(p) {
  if (p?.execution_mode === 'manual') return actualsForm(p);
  if (!p) return heading('EXECUÇÃO', 'Acompanhar culto', 'Use esta tela durante o culto para iniciar, avançar e pausar as atividades.') + empty('Escolha uma programação', 'Abra uma programação pronta para acompanhar.', button('Ver programações', 'programs', '', 'class="primary"'));
  if (p.status === 'Finalizada') return summary(p);
  p=programForMetrics(p);
  const m = executionInfo(p);
  const focus = m.active || m.expected || m.pending;
  const index = focus ? p.plan.items.findIndex(item=>item.id===focus?.id) : -1;
  const next = p.plan.items[index + 1];
  const e = focus && p.executions[focus.id];
  const dateMismatch = p.plan.date !== today();
  return heading('EXECUÇÃO', 'Acompanhar culto', `${esc(dateLabel(p.plan.date))} · ${esc(p.plan.name)} · Controle durante a execução.`, button('Atualizar', 'refresh')) +
    `<div class="planned-bar"><span>Previsto <strong>${esc(displayPlannedTime(p.plan.start||'—'))} → ${esc(displayPlannedTime(p.plan.end||'—'))}</strong></span>${programStatus(p)}</div>
    <section class="metrics" aria-label="Situação da programação"><div><span>HORÁRIO ATUAL</span><strong data-live="clock">${clock(currentTime())}</strong></div><div><span>DESVIO DO HORÁRIO</span><strong data-live="shift" class="${statusTone(m.shift)}">${signed(m.shift)}</strong><small data-live="status">${delayLabel(m.shift)}</small></div><div><span>PREVISÃO DE TÉRMINO</span><strong data-live="forecast">${p.status === 'Planejamento' ? '—' : (displayPlannedTime(m.forecast)||'—')}</strong></div></section>
    <p class="context-line">Pelo plano, agora: <strong data-live="expected">${esc(m.expected?.activity || (dateMismatch ? 'outra data' : 'intervalo ou fora da programação'))}</strong></p>
    <section class="current-activity"><p class="eyebrow" data-live="focus-label">${m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE'}</p><h2 data-live="activity">${esc(focus?.activity || 'Sem atividades')}</h2><p class="responsible" data-live="responsible">${esc(focus?.responsible || 'Responsável não informado')}</p><div class="current-details"><div><span>Planejado</span><strong data-live="period">${esc(displayPlannedTime(focus?.start || '—'))} → ${esc(displayPlannedTime(focus?.end || '—'))}</strong></div><div><span>Início real</span><strong>${clock(e?.started)}</strong></div><div><span>Tempo transcorrido</span><strong data-live="elapsed">${e ? elapsed(e.started) : '—'}</strong></div></div><p data-live="item-note">${esc(focus?.note || '')}</p><p class="muted" data-live="origin">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'}</p></section>
    ${next ? `<section class="next-activity" data-next><span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(displayPlannedTime(next.start))}</strong></section>` : '<p class="muted" data-next>Última atividade da programação.</p>'}
    <div class="execution-actions">${p.status === 'Planejamento' ? button('Marcar programação como pronta', 'ready', p.id, 'class="primary big"') : m.active ? (p.paused ? button('Retomar acompanhamento', 'resume', p.id, 'class="primary big"') : button(m.pending ? 'Finalizar e avançar' : 'Finalizar programação', 'next', p.id, 'class="primary big"')) : button(`Iniciar atividade${m.expected && m.expected.id !== m.pending?.id ? ` · ${esc(m.pending.activity)}` : ''}`, 'start', p.id, `class="primary big" ${dateMismatch ? 'disabled' : ''}`)}${m.active && !p.paused ? button('Pausar acompanhamento', 'pause', p.id) : ''}${button('Voltar', 'programs')}</div>
    ${dateMismatch ? '<p class="muted">O início será liberado na data da programação. Para testar hoje, duplique com a data de hoje.</p>' : ''}${p.paused ? '<p class="pause-note">Acompanhamento pausado. O tempo real continua contando; a pausa não altera o planejamento nem exclui tempo do culto.</p>' : ''}
    ${timeline(p)}${notes(p)}`;
}
function summary(p) {
  const m = executionInfo(p);
  const view=programForMetrics(p);const plannedDuration = recordInterval(view.planned_start,view.planned_end,recordDay(p.plan.date)).minutes;
  const actualDuration = m.actualDuration;
  return heading('PLANEJADO × REALIZADO', 'Resumo da programação', `${esc(p.plan.name)} · ${esc(dateLabel(p.plan.date))}`, `${button('Duplicar programação', 'duplicate', p.id)} ${p.execution_mode === 'manual' ? button('Editar registro', 'actuals', p.id) : ''} ${window.IASDPIDemo&&p.execution_mode==='manual'&&p.plan.date==='2026-10-03'?button('Conferir correção para 10/10/2026','correct-date',p.id):''}`) +
    `<section class="summary-grid">${[['Início planejado', displayPlannedTime(p.plan.start)], ['Início real', actualClock(m.first?.started)||'—'], ['Término planejado', displayPlannedTime(p.plan.end)], ['Término real', actualClock(m.last?.ended)||'—'], ['Duração planejada', duration(plannedDuration)], ['Duração real', actualDuration === null ? '—' : duration(actualDuration)], ['Desvio da duração', actualDuration === null || plannedDuration === null ? '—' : signed(actualDuration - plannedDuration)], ['Desvio do término', signed(m.shift)]].map(([label,value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}</section>
    <p class="muted">Desvio do término compara o relógio. Desvio da duração compara o tempo total entre o primeiro início e o último término, incluindo intervalos. ${metricsCountLabel(m.counts)}.${m.extraCounts.total?` Atividades extras: ${m.extraCounts.considered} consideradas; ${m.extraCounts.missing} com dados ausentes; ${m.extraCounts.invalid} com dados inválidos.`:''} Duração total e pontualidade exigem horários completos das atividades principais e extras; subatividades não são somadas novamente.</p>
    <p class="context-line">${m.origin ? `Primeiro atraso observado: ${esc(m.origin.activity)}. Veja as observações para entender a causa.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'}</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade / bloco</th><th>Horários previstos</th><th>Horários reais</th><th>Duração prevista</th><th>Duração real</th><th>Diferença de duração</th></tr></thead><tbody>${summaryActivityRows(p)}</tbody></table></div>${transitionView([p])}${notes(p)}`;
}
const adherenceTolerance = 2;
function metricsCountLabel(c){return `${c.considered} atividades consideradas; ${c.total-c.considered} desconsideradas (${c.missing} com dados ausentes; ${c.invalid} com dados inválidos)`;}
function endStatistics(programs){
  const shifts=programs.map(p=>executionInfo(p).shift).filter(v=>v!==null&&Number.isFinite(v));
  return {considered:shifts.length,excluded:programs.length-shifts.length,mean:shifts.length?shifts.reduce((s,v)=>s+v,0)/shifts.length:null,onTime:shifts.filter(v=>Math.abs(v)<=adherenceTolerance).length};
}
function adherence(p) {
  const samples=activitySamples(p),counts=sampleCounts(samples),completed=samples.filter(s=>s.state==='valid');
  const conforming=completed.filter(({item,actual,planned})=>Math.abs(minutes(actual.start,planned.start))<=adherenceTolerance&&(item.end_inferred||Math.abs(minutes(actual.end,planned.end))<=adherenceTolerance)).length;
  return {...counts,total:counts.considered,expected:counts.total,excluded:counts.total-counts.considered,conforming,percent:completed.length?Math.round(conforming/completed.length*100):null};
}
function median(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return !sorted.length?null:sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}
function activityMedians(programs) {
  const groups=new Map();
  programs.forEach(p=>activitySamples(p).forEach(({item,actual,planned,state})=>{
    const name=String(item.activity||'Atividade sem título').startsWith('Música Congregacional') ? 'Música Congregacional' : item.activity;
    if(!groups.has(name))groups.set(name,{name,values:[],events:new Set(),estimated:false,missing:0,invalid:0});
    const group=groups.get(name);
    if(state!=='valid'){group[state]++;return;}
    group.values.push(actual.minutes-planned.minutes);
    group.events.add(p.id);group.estimated ||= Boolean(item.end_inferred);
  }));
  return [...groups.values()].map(group=>({...group,median:median(group.values)}));
}
function medianView(programs) {
  const groups=activityMedians(programs);
  const label=value=>value===null?'Dados insuficientes':`${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString('pt-BR',{maximumFractionDigits:1})} min`;
  return `<section class="section median-section"><div class="section-heading"><h2>Mediana do desvio por atividade</h2><span class="muted">${programs.length} programações finalizadas</span></div>
    <p class="muted">Diferença entre duração realizada e prevista em cada registro de atividade. Positivo = durou mais; negativo = durou menos. As músicas congregacionais estão agrupadas, incluindo sentados e em pé.</p>
    <div class="table-scroll"><table><thead><tr><th>Atividade</th><th>Mediana do desvio</th><th>Registros comparados / desconsiderados</th><th>Programações</th></tr></thead><tbody>${groups.map(group=>`<tr><td>${esc(group.name)}${group.estimated?' *':''}</td><td><span class="badge ${statusTone(group.median)}">${label(group.median)}</span></td><td>${group.values.length} considerados; ${group.missing+group.invalid} desconsiderados<small>${group.missing} ausentes · ${group.invalid} inválidos</small></td><td>${group.events.size}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">${groups.some(g=>g.estimated)?'* Atividades marcadas usam um término de referência. ':''}A mediana considera somente intervalos válidos, inclusive quando a atividade se repete no mesmo culto.</p></section>`;
}
function adherenceOverview(programs=state.programs) {
  const examples=programs.filter(p=>p.status==='Finalizada').sort((a,b)=>String(a.plan.date||'').localeCompare(String(b.plan.date||'')));
  if(!examples.length)return '';
  const counts=examples.map(adherence),ends=endStatistics(examples);
  const conforming=counts.reduce((sum,a)=>sum+a.conforming,0),total=counts.reduce((sum,a)=>sum+a.total,0),excluded=counts.reduce((sum,a)=>sum+a.excluded,0);
  const percent=total?Math.round(conforming/total*100)+'%':'Dados insuficientes';
  return `<section class="section adherence-section"><div class="section-heading"><h2>Aderência à programação</h2><span class="badge neutral">${examples.length} eventos finalizados</span></div>
    <p class="muted">Aderência = atividades com início e término até ${adherenceTolerance} minutos antes ou depois do previsto. Atividades com término de referência são avaliadas somente pelo início. Dados incompletos não permitem classificar o culto inteiro.</p>
    <div class="metrics"><div><span>ATIVIDADES ADERENTES</span><strong>${percent}</strong><small>${conforming} de ${total} atividades consideradas; ${excluded} desconsideradas (${counts.reduce((s,a)=>s+a.missing,0)} ausentes; ${counts.reduce((s,a)=>s+a.invalid,0)} inválidas)</small></div><div><span>EVENTOS COM TÉRMINO ADERENTE</span><strong>${ends.considered?ends.onTime+'/'+ends.considered:'Dados insuficientes'}</strong><small>${ends.considered} cultos considerados; ${ends.excluded} desconsiderados · tolerância ±${adherenceTolerance} min</small></div><div><span>DESVIO MÉDIO DO TÉRMINO</span><strong>${signed(ends.mean)}</strong><small>${ends.considered} cultos considerados; ${ends.excluded} desconsiderados. Atrasos positivos · adiantamentos negativos</small></div></div>
    <div class="table-scroll"><table><thead><tr><th>Evento</th><th>Aderência</th><th>Atividades aderentes / consideradas</th><th>Desvio do término</th><th>Detalhes</th></tr></thead><tbody>${examples.map(p=>{
      const a=adherence(p),m=executionInfo(p);const tone=a.percent===null||!m.complete?'neutral':a.percent>=90?'good':a.percent>=70?'warning':'critical';
      return `<tr><td>${esc(p.plan.name)}<small>${esc(programDate(p.plan.date))}</small></td><td><span class="badge ${tone}">${a.percent===null?'Dados insuficientes':a.percent+'%'+(!m.complete?' · parcial':'')}</span></td><td>${a.conforming} / ${a.total}<small>${a.excluded} desconsideradas (${a.missing} ausentes; ${a.invalid} inválidas)</small></td><td>${badge(m.shift,signed(m.shift))}</td><td>${button('Ver realizado','summary',p.id)}</td></tr>`;
    }).join('')}</tbody></table></div><p class="muted">Cultos completos: verde a partir de 90%, amarelo de 70% a 89%, vermelho abaixo de 70%. Dados parciais: classificação neutra. A duração total considera o intervalo do evento, sem duplicar os itens simultâneos ou as subatividades.</p>${medianView(examples)}${transitionView(examples)}</section>`;
}
function modelsPage(){return heading('ADMINISTRAÇÃO','Modelos de liturgia','Use o mesmo cadastro de modelos da igreja. Atualizar um modelo não altera cultos já registrados.')+(!IASDPIAuth.isAdmin()?empty('Acesso restrito','Somente administradores podem gerenciar modelos.'):window.IASDPIOperational?IASDPIOperational.templatePanel():empty('Gerenciamento disponível no modo Supabase','Esta prévia local preserva os dados e não altera modelos no banco.'));}
function historyPage(){return IASDPIHistory.page();}

function render() {
  window.IASDPIDrafts?.beforeRender();
  const allowed=IASDPIAuth.allowed();
  if(!allowed&&!IASDPIAuth.isPublic(state.page))state.page='login';
  document.querySelectorAll('nav a').forEach(a=>{a.hidden=['users','trash','models'].includes(a.dataset.page)?!IASDPIAuth.isAdmin():a.dataset.page==='login'?allowed:!allowed&&!IASDPIAuth.isPublic(a.dataset.page);});
  document.querySelector('#auth-logout').hidden=!allowed;

  const activePage=state.page==='summary'?'history':['edit','tracking'].includes(state.page)&&selected()?.execution_mode==='manual'?'actuals':['edit','plan-edit'].includes(state.page)?'programs':state.page;
  document.querySelectorAll('nav a').forEach(a => {const active=a.dataset.page===activePage;a.classList.toggle('selected',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const missingRecord=['edit','plan-edit','actuals','tracking','summary'].includes(state.page)&&state.selected&&!selected();
  const needsPrograms=['home','programs','history','edit','plan-edit','actuals','tracking','summary','models'].includes(state.page);
  app.innerHTML = allowed&&needsPrograms&&!['records','empty'].includes(state.programsLoad.status)?programsLoadView():allowed&&missingRecord?empty('Registro não encontrado','Este identificador não está entre os cultos ativos disponíveis. Confira o link ou as programações.',button('Ver programações','programs')):({home, models:modelsPage, trash: trashPage, users: usersPage, invite: invitePage, login: IASDPIAuth.loginPage, 'forgot-password':IASDPIAuth.forgotPasswordPage,'reset-password':IASDPIAuth.resetPasswordPage, organization: organizationPage, archive: archivePage, agendas: agendasPage, programs: programsPage, history: historyPage, edit: () => editor(selected()), 'plan-edit':()=>editor(selected(),true), actuals: () => actualsForm(selected()), tracking: () => tracking(selected()), summary: () => selected() ? summary(selected()) : historyPage()}[state.page] || home)();
  updateWeekday(); updateActuals(); tick(); window.IASDPIDrafts?.mount(); pageLayout.mount();
}
function navigate(page,id,options){return IASDPINavigation.navigate(page,id,options);}
function updateWeekday() {
  const form = document.querySelector('#program-form');
  const target = document.querySelector('#weekday');
  if (form && target) { const value = tryReadDate(form.elements.date.value); target.textContent = value ? dateLabel(value) : ''; }
}
function tick() {
  const p = selected(); if (!p || state.page !== 'tracking' || p.status === 'Finalizada') return;
  const m = executionInfo(p), e = m.active && programForMetrics(p).executions[m.active.id];
  const focus = m.active || m.expected || m.pending;
  const next = p.plan.items[p.plan.items.findIndex(item=>item.id===focus?.id) + 1];
  const nextElement = document.querySelector('[data-next]');
  if (nextElement && nextElement.dataset.item !== (next?.id || '')) {
    nextElement.dataset.item = next?.id || '';
    nextElement.className = 'next-activity';
    nextElement.innerHTML = next ? `<span class="eyebrow">PRÓXIMO</span><div><h3>${esc(next.activity)}</h3><p>${esc(next.responsible || 'Responsável não informado')}</p></div><strong>${esc(displayPlannedTime(next.start))}</strong>` : '<span class="muted">Última atividade da programação.</span>';
  }
  const values = {'focus-label': m.active ? 'EM ANDAMENTO' : m.expected ? 'AGORA · PELO PLANEJAMENTO' : 'PRIMEIRA ATIVIDADE', activity: focus?.activity || 'Sem atividades', responsible: focus?.responsible || 'Responsável não informado', period: `${displayPlannedTime(focus?.start)||'—'} → ${displayPlannedTime(focus?.end)||'—'}`, 'item-note': focus?.note || '', clock: clock(currentTime()), shift: signed(m.shift), status: delayLabel(m.shift), forecast: p.status === 'Planejamento' ? '—' : (displayPlannedTime(m.forecast)||'—'), elapsed: e ? elapsed(e.started) : '—', expected: m.expected?.activity || (p.plan.date !== today() ? 'outra data' : 'intervalo ou fora da programação'), origin: m.origin ? `Primeiro atraso observado: ${m.origin.activity}.` : m.complete?'Nenhum atraso observado nos horários válidos.':'Dados incompletos ou inválidos: não é possível concluir a pontualidade.'};
  for (const [key, value] of Object.entries(values)) {
    const element = document.querySelector(`[data-live="${key}"]`);
    if (element) { element.textContent = value; if (key === 'shift') element.className = statusTone(m.shift); }
  }
}
async function handleAction(target) {
  const {action, id} = target.dataset;
  if(['chronogram','new','actuals','summary','programs','edit','track','duplicate','correct-date','edit-record-plan'].includes(action)&&!canLeaveRegistration())return;
  if(!action.startsWith('agenda-'))await IASDPIAuth.requireAccess();
  if(action.startsWith('trash-')){await handleTrashAction(action,id);return;}
  if(action.startsWith('users-')){await handleUsersAction(action,id);return;}
  if(action.startsWith('operational-')){await IASDPIOperational.action(action,id);return;}
  if(action==='cloud-save')await cloudSave();
  else if(action==='cloud-list')await refreshArchives();
  else if(action==='cloud-signout'){await IASDPIAuth.logout();}
  else if(action==='cloud-restore'){const [row]=await cloudRequest('/rest/v1/culto_archives?id=eq.'+encodeURIComponent(id)+'&select=payload');if(!row)throw Error('Arquivo não encontrado.');const result=await restoreBackup(row.payload);render();toast(result.preview?'Confira e confirme a prévia de importação.':`${result.added} registros restaurados sem substituir os atuais.`);}
  else if(action==='agenda-current'){selectAgendaMonth(today().slice(0,7));document.querySelector('[data-action="agenda-current"]').focus();}
  else if(action==='agenda-calendar'||action==='agenda-list'){agendaState.view=action==='agenda-calendar'?'calendar':'list';render();document.querySelector(`[data-action="${action}"]`).focus();}
  else if(action==='agenda-previous'||action==='agenda-next')changeAgendaMonth(action==='agenda-next'?1:-1);
  else if(action==='agenda-day'){agendaState.day=id;render();document.querySelector(`.calendar-day[data-id="${id}"]`)?.focus();}
  else if(action==='add-subactivity'){
    const row=target.closest('.actual-row'),list=row.querySelector('.subactivities');
    if(list.children.length>=50)throw Error('Limite de 50 subatividades por atividade.');
    list.insertAdjacentHTML('beforeend',subactivityRow({},row.dataset.id));markRegistrationDirty();refreshSubactivityLabels();list.lastElementChild.querySelector('input').focus();
  }
  else if(action==='remove-subactivity'){
    if(window.confirm('Excluir esta subatividade? A exclusão só será aplicada ao salvar o registro.')){target.closest('.subactivity').remove();markRegistrationDirty();refreshSubactivityLabels();}
  }
  else if(action==='edit-record-plan'){
    const form=document.querySelector('#actuals-form');
    if(!form.dataset.id)await saveActuals(form,false);
    navigate('plan-edit',selected().id);
  }
  else if(action==='edit-record'){document.querySelector('#actuals-form [name="record-name"]')?.focus();}
  else if(action==='cancel-record'){
    if(window.IASDPIDrafts?!await IASDPIDrafts.discardCurrent():!canLeaveRegistration())return;
    if(id){replaceProgram(await api('programs/'+id));navigate('summary',id);}else navigate('programs');
  }
  else if(action==='add-extra')throw Error('Novos detalhes devem ser adicionados como subatividades.');
  else if(action==='remove-extra'){if(!window.confirm('Remover esta atividade extra antiga ao salvar?'))return;target.closest('.actual-row').remove();markRegistrationDirty();document.querySelectorAll('.actual-number').forEach((n,index)=>n.textContent=index+1);updateActuals();}
  else if (action === 'time-now') {
    const input=target.closest('.subactivity, .actual-row').querySelector(`[name="${target.dataset.field}"]`);
    input.value=displayActualTime(actualClock(currentTime()));input.dataset.timeEdited='true';
    markRegistrationDirty();updateActuals();
  }
  else if (action === 'chronogram') {
    if(window.IASDPIOperational)await IASDPIOperational.refreshTemplates();
    window.IASDPIChronogram=null;state.selected=null;navigate('actuals',undefined,{refresh:true});
  }
  else if (action === 'actuals') navigate('actuals', id);
  else if(action==='correct-date'){
    if(!window.IASDPIDemo)throw Error('A correção está disponível apenas para registros locais deste navegador.');
    const original=await api('programs/'+id),corrected=correctedCultoDate(original);
    dateCorrection={id:original.id,version:original.version,expected:JSON.stringify(original)};
    document.querySelector('#correct-date-preview').innerHTML=`<h2 id="correct-date-title">Conferir correção de data</h2><p>Origem: localStorage deste navegador. Somente este registro será alterado.</p><p><strong>${esc(original.plan.name)}</strong> · ID: ${esc(original.id)}</p><p>03/10/2026 → <strong>10/10/2026</strong> · ${original.plan.items.length} atividades e ${original.extra_events?.length||0} eventos extras. Horários, responsáveis e observações preservados. Não cria cópia nem altera o Supabase.</p><details><summary>Ver todos os dados atuais do registro afetado</summary><pre class="date-correction-json">${esc(JSON.stringify(original,null,2))}</pre></details><h3>Prévia das atividades após a correção</h3><div class="table-scroll"><table><tbody>${summaryActivityRows(corrected)}</tbody></table></div>`;
    document.querySelector('#correct-date-dialog').showModal();
  }
  else if (action === 'new') { state.selected = null; navigate('edit'); }
  else if (action === 'models-open') {if(!IASDPIAuth.isAdmin())throw Error('Acesso exclusivo de administradores.');if(window.IASDPIOperational)await IASDPIOperational.refreshTemplates();navigate('models');}

  else if (action === 'programs') navigate('programs');
  else if (['edit','summary','track'].includes(action)) navigate(action === 'track' ? 'tracking' : action, id);
  else if (action === 'duplicate') {
    state.duplicate = id;
    document.querySelector('#duplicate-form').elements.date.value = displayDate(today());
    document.querySelector('#duplicate-dialog').showModal();
  } else if (action === 'close-dialog') document.querySelector('#duplicate-dialog').close();
  else if (action === 'add-item') {
    const container = document.querySelector('#items-editor');
    container.insertAdjacentHTML('beforeend', itemEditor({}, container.children.length));
    document.querySelectorAll('#program-form .form-grid [name="start"],#program-form .form-grid [name="end"]').forEach(input=>input.required=true);
    container.lastElementChild.querySelector('[name="activity"]').focus();
  } else if (['remove-item','up','down'].includes(action)) {
    const row = target.closest('.item-editor');
    if (action === 'remove-item') {row.remove();toast('Atividade removida. Salve a programação para confirmar a alteração.');}
    if (action === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
    if (action === 'down' && row.nextElementSibling) row.nextElementSibling.after(row);
    document.querySelectorAll('.item-number').forEach((n,i) => { n.textContent = i+1; });
  } else if (action === 'refresh'||action==='retry-programs') { await loadPrograms({renderState:true}); render(); toast('Registros carregados.'); }
  else if (['ready','start','next','pause','resume'].includes(action)) {
    let p = state.programs.find(p => p.id === id);
    const notesForm = document.querySelector('#notes-form');
    if (notesForm?.dataset.id === id && (notesForm.elements.note.value !== p.note || notesForm.elements.incident.value !== p.incident)) {
      p = await api(`programs/${id}/notes`, 'PUT', {version:Number(notesForm.dataset.version), note:notesForm.elements.note.value, incident:notesForm.elements.incident.value});
      replaceProgram(p); notesForm.dataset.version = p.version;
    }
    const updated = await api(`programs/${id}/action`, 'POST', {action, version:p.version});
    replaceProgram(updated); navigate(updated.status === 'Finalizada' ? 'summary' : 'tracking', id,{refresh:true});
    toast({'ready':'Programação pronta para acompanhar.','start':'Culto iniciado.','pause':'Acompanhamento pausado.','resume':'Acompanhamento retomado.','next':updated.status==='Finalizada'?'Programação finalizada. Resumo disponível.':'Atividade finalizada. Próxima atividade iniciada.'}[action]);
  }
}
async function guarded(task, trigger) {
  if (state.busy) return;
  state.busy = true;
  app.setAttribute('aria-busy','true');
  const originalLabel=trigger?.textContent;
  if(trigger)trigger.textContent='Processando…';
  const pending=setTimeout(()=>toast('Processando…'),200);
  const buttons = [...document.querySelectorAll('button, input, textarea, select')].filter(b => !b.disabled);
  buttons.forEach(b => { b.disabled = true; });
  try { await task(); } catch (error) {
    toast(error.message, true);
    const form=trigger?.closest('form');
    if(form?.id==='actuals-form'&&trigger?.type==='submit')setRegistrationSaveState(form,'error','Não foi possível '+(trigger.name==='finalize'?'finalizar':'salvar')+'. Alterações preservadas; revise a mensagem no formulário e tente novamente.');
    if(form){let feedback=form.querySelector('.form-error');if(!feedback){feedback=document.createElement('p');feedback.className='form-error';feedback.setAttribute('role','alert');form.prepend(feedback);}feedback.textContent=error.message;}
    if(error.code==='40001'&&['actuals-form','program-form','notes-form'].includes(form?.id))try{await IASDPIConflicts.open(form,error);}catch(comparisonError){toast('Comparação indisponível. Os campos e rascunhos foram preservados. '+comparisonError.message,true);}
    // Atualiza a versão em memória sem substituir campos que o usuário está editando.
    if(IASDPIAuth.allowed()&&!['password-request-form','password-reset-form'].includes(form?.id)&&state.programsLoad.status!=='error')try { await loadPrograms(); } catch (_) { /* preservar campos e exibir erro ao consultar as listas */ }
  } finally { clearTimeout(pending);if(notice.textContent==='Processando…')notice.hidden=true;state.busy=false;app.removeAttribute('aria-busy');if(trigger?.isConnected)trigger.textContent=originalLabel;buttons.forEach(b=>{b.disabled=false;});if(trigger?.isConnected&&document.activeElement===document.body)trigger.focus();drainNavigation(); }
}
app.addEventListener('click', event => { const link=event.target.closest('[data-auth-page]');if(link){event.preventDefault();navigate(link.dataset.authPage);return;}const target = event.target.closest('[data-action]'); if(target?.dataset.action==='history-clear'&&IASDPIAuth.allowed()){IASDPIHistory.clear();return;}if (target) guarded(() => handleAction(target), target); });
app.addEventListener('toggle',event=>{if(event.target.matches('.item-details'))event.target.querySelector('.item-edit-label').textContent=event.target.open?'Recolher':'Editar';},true);
app.addEventListener('input', event => {IASDPIHistory.input(event.target);if(event.target.dataset.realTime){event.target.dataset.timeEdited='true';delete event.target.dataset.conflictClock;}clearFieldError(event.target);event.target.closest('form')?.querySelector('.form-error')?.remove();if(event.target.closest('#actuals-form')){markRegistrationDirty();updateActuals();}const row=event.target.closest('.item-editor');if(row)updateItemOverview(row);});
 document.addEventListener('invalid',event=>{if(event.target.matches('input,textarea,select')){event.preventDefault();if(event.target.closest('#actuals-form'))setRegistrationSaveState(event.target.closest('form'),'error','Revise o campo indicado. O registro ainda não foi finalizado.');fieldError(event.target,event.target.validity.valueMissing?'Preencha este campo obrigatório.':event.target.hasAttribute('data-planned-time')?'Use o formato 24 horas HH:mm (ex.: 14:05).':event.target.validationMessage);}},true);
app.addEventListener('change', event => {if(event.target.closest('#actuals-form')){markRegistrationDirty();updateActuals();}if(['agenda-area','agenda-department','agenda-show-people','agenda-month-picker'].includes(event.target.id)){const id=event.target.id;if(id==='agenda-area')agendaState.area=event.target.value;else if(id==='agenda-department')agendaState.department=event.target.value;else if(id==='agenda-show-people')agendaState.showPeople=event.target.checked;else if(event.target.value)selectAgendaMonth(event.target.value);render();document.getElementById(id)?.focus();return;} if (event.target.name === 'date') updateWeekday(); if(event.target.name==='responsible-option'){const input=event.target.closest('.actual-row').querySelector('[name="responsible-name"]');input.hidden=event.target.value!=='other';if(!input.hidden)input.focus();} });
document.querySelector('#duplicate-dialog').addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (target) guarded(()=>handleAction(target),target); });
app.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if(form.id==='history-filters'){IASDPIHistory.apply(form);return;}
  const finalize = event.submitter?.name === 'finalize';
  const draftSave=window.IASDPIDrafts?.beginSave(form);
  const actionButton=event.submitter||(form.id==='actuals-form'?form.querySelector('[name="save"]'):null);
  if(form.id==='actuals-form'&&!state.busy)setRegistrationSaveState(form,'saving',finalize?'Finalizando registro… Aguarde a confirmação.':'Salvando alterações… Aguarde a confirmação.');
  guarded(async () => {
    if(form.id==='password-request-form'){const message=await IASDPIAuth.requestPasswordReset(form.elements.email.value.trim());form.querySelector('.password-feedback').textContent=message;form.reset();return;}
    if(form.id==='password-reset-form'){if(form.elements.password.value!==form.elements.repeat.value)throw fieldError(form.elements.repeat,'As senhas devem ser iguais.');const password=form.elements.password.value;form.reset();try{await IASDPIAuth.updatePassword(password);}catch(error){if(!IASDPIAuth.passwordRecoveryActive())render();throw error;}navigate('login',undefined,{replace:true,refresh:true});toast('Senha redefinida. Entre com sua nova senha.');return;}
    if(form.id==='invite-signup-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.signup(form.elements.email.value,password,form.elements['public-key']?.value);
      toast('Se o cadastro puder ser concluído, siga as instruções do e-mail. Após confirmar, reabra o convite e entre.');return;
    }
    if(form.id==='invite-login-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.login(form.elements.email.value,password,form.elements['public-key']?.value,usersState.inviteToken);
      usersState.inviteToken='';cloudState.session=IASDPIAuth.session();navigate('home');await boot();return;
    }
    if(form.id==='auth-login-form'){
      const password=form.elements.password.value;form.elements.password.value='';
      await IASDPIAuth.login(form.elements.email.value,password,form.elements['public-key']?.value);
      cloudState.session=IASDPIAuth.session();state.page='home';await boot();return;
    }
    if(form.id==='actuals-form'&&window.IASDPIOperational){await saveActuals(form,finalize,draftSave);return;}
    if(!(window.IASDPIOperational&&['program-form','notes-form'].includes(form.id)))await IASDPIAuth.requireAccess();
    if(form.id.startsWith('users-')||form.classList.contains('user-access-form')){await submitUsersForm(form);return;}
    if(form.id==='operational-template-form'){await IASDPIOperational.saveTemplate(form);return;}
    if(form.id==='backup-export-form'){if(form.elements.password.value!==form.elements.repeat.value)throw fieldError(form.elements.repeat,'As senhas devem ser iguais.');await downloadBackup(await encryptBackup(await backupPayload(),form.elements.password.value));form.reset();toast('Backup preparado para download. Confira o arquivo na pasta Downloads.');return;}
    if(form.id==='backup-restore-form'){const file=form.elements.file.files[0];if(!file||file.size>20971520)throw Error('Escolha um backup JSON de até 20 MB.');const data=await decryptBackup(JSON.parse(await file.text()),form.elements.password.value);const result=await restoreBackup(data);render();toast(result.preview?'Confira a prévia e confirme os registros que deseja importar.':`${result.added} registros restaurados; ${result.copies} cópias diferentes preservadas.`);return;}
    if(form.id==='open-record-form'){navigate('actuals',form.elements['record-id'].value);return;}
    if(form.id==='new-record-form'){
      window.IASDPIChronogram=await draftFromTemplate(form.elements['template-id'].value);
      if(window.IASDPIOperational){const p=await api('programs','POST',window.IASDPIChronogram);replaceProgram(p);navigate('actuals',p.id,{replace:true,refresh:true});toast('Novo registro confirmado no Supabase.');}
      else{state.selected=null;navigate('actuals',undefined,{refresh:true});}return;
    }
    if (form.id === 'actuals-form') { await saveActuals(form, finalize); return; }
    const id = form.dataset.id;
    if (form.id === 'program-form') {
      const get = name => form.querySelector(`[name="${name}"]`).value;
      const plan = {name:get('name'), date:readDateField(form.querySelector('[name="date"]')),template_id:selected()?.plan.template_id, start:get('start'), end:get('end'), team:Object.fromEntries(roles.map((role,i) => [role,get(`team-${i}`)])), items: [...form.querySelectorAll('.item-editor')].map(row => ({id:row.dataset.itemId, ...Object.fromEntries([...row.querySelectorAll('input')].map(input => [input.name,input.value]))}))};
      validateProgramForm(form,plan);
      if (id) plan.version = Number(form.dataset.version);
      let p = await api(id ? `programs/${id}` : 'programs', id ? 'PUT' : 'POST', plan);
      await window.IASDPIDrafts?.bind(form,p,draftSave?.context);
      if (form.elements.ready.checked) p = await api(`programs/${p.id}/action`, 'POST', {action:'ready', version:p.version});
      const newer=await window.IASDPIDrafts?.saved(draftSave,p);
      const stillEditing=form.isConnected,previousSelected=state.selected;replaceProgram(p);
      if(!stillEditing)state.selected=previousSelected;else if(!newer)navigate(p.execution_mode==='manual'?'actuals':'programs',p.id);
      toast(newer?'Envio confirmado. Há alterações mais recentes preservadas em rascunho.':'Programação salva.');
    } else if (form.id === 'notes-form') {
      const p = await api(`programs/${id}/notes`, 'PUT', {version:Number(form.dataset.version), note:form.elements.note.value, incident:form.elements.incident.value});
      const newer=await window.IASDPIDrafts?.saved(draftSave,p);
      const previousSelected=state.selected;replaceProgram(p);if(!form.isConnected)state.selected=previousSelected;
      form.dataset.version = p.version; toast(newer?'Envio confirmado. Há alterações mais recentes preservadas em rascunho.':'Observações salvas.');
    }
  }, actionButton);
});
document.querySelector('#duplicate-form').addEventListener('submit', event => {
  event.preventDefault();
  guarded(async () => {
    const p = await api(`programs/${state.duplicate}/duplicate`, 'POST', {date:readDateField(event.target.elements.date)});
    document.querySelector('#duplicate-dialog').close(); replaceProgram(p); navigate('edit', p.id); toast('Planejamento duplicado.');
  }, event.submitter);
});
function openNavigation(page){
  if(state.busy||bootInProgress){pendingNavigation=page;toast('Carregando… A página escolhida abrirá em seguida.');return;}
  if(page==='actuals')void guarded(()=>handleAction({dataset:{action:'chronogram'}}));
  else navigate(page);
}
function drainNavigation(){
  if(!pendingNavigation||state.busy||bootInProgress)return;
  const page=pendingNavigation;pendingNavigation=null;
  if(IASDPIAuth.allowed()||IASDPIAuth.isPublic(page))openNavigation(page);
}
document.querySelector('nav').addEventListener('click', event => { const link = event.target.closest('a[data-page]'); if(link){event.preventDefault();openNavigation(link.dataset.page);} });

function boot(){
  if(!bootTask)bootTask=performBoot().finally(()=>{bootTask=null;drainNavigation();});
  return bootTask;
}
async function performBoot() {
  bootInProgress=true;
  await IASDPIAuth.handlePasswordCallback();
  if(!IASDPIAuth.allowed()){
    pendingNavigation=null;
    const requested=location.hash.slice(1).split('/')[0]||'organization';
    state.page=IASDPIAuth.isPublic(requested)?requested:'login';render();
  }
  if(window.IASDPIConfig?.environment==='validation'&&!document.querySelector('#validation-banner')){
    const banner=document.createElement('aside');banner.id='validation-banner';banner.className='demo-banner';
    banner.textContent='VALIDAÇÃO DO LOGIN · Supabase somente para login e consultas. Registros continuam neste navegador; exporte um backup em Arquivo e banco.';
    document.querySelector('.header').after(banner);
  }
  if(window.IASDPIConfig?.environment==='homologation'&&!document.querySelector('#homologation-banner')){
    const banner=document.createElement('aside');banner.id='homologation-banner';banner.className='demo-banner';
    banner.textContent='HOMOLOGAÇÃO · Login e consultas. Alterações no Supabase bloqueadas nesta interface; registros locais separados do site principal.';
    document.querySelector('.header').after(banner);
  }
  try {
    try{await IASDPIAuth.restore();}catch(_){}
    const health = await api('health'); state.zone = health.timezone; state.offset = new Date(health.server_time).getTime() - Date.now();
    captureInvite(location.hash.slice(1));const requested=location.hash.slice(1).split('/');
    state.page=requested[0]&&requested[0]!=='login'?requested[0]:IASDPIAuth.allowed()?'home':'organization';
    if(requested[1])state.selected=requested[1];
    if(IASDPIAuth.allowed())await loadPrograms({renderState:true});
    state.selected = state.programs.find(p => p.status === 'Em andamento')?.id || state.programs.find(p => p.status === 'Pronta')?.id || null;
    captureInvite(location.hash.slice(1)); const [page,id] = location.hash.slice(1).split('/');
    if(id)state.selected=id;
    if (page === 'actuals' && !id) state.selected = null;
    // A rota atual é restaurada; novos cultos escolhem modelo e usam a data de São Paulo.
    state.page = ['home','programs','tracking','history','edit','summary','actuals','agendas','archive','organization','login','users','invite','plan-edit','trash','models','forgot-password','reset-password'].includes(page) ? (page==='login'&&IASDPIAuth.allowed()?'home':page) : IASDPIAuth.allowed()?'home':'organization'; bootInProgress=false;IASDPINavigation.start();render();
  } catch (error) {
    bootInProgress=false;
    if(IASDPIAuth.allowed())state.programsLoad={status:'error',error:error.message};
    render();toast(error.message,true);
  } finally {bootInProgress=false;}
}
window.addEventListener('iasdpi-auth-changed',()=>{
  cloudState.session=IASDPIAuth.session();cloudState.archives=[];cloudState.loaded=false;cloudState.loading=false;cloudState.error='';resetUsers();
  if(!IASDPIAuth.allowed()){
    programsLoadGeneration++;state.programsLoad={status:'idle',error:''};
    pendingNavigation=null;
    registrationDirty=false;state.programs=[];state.selected=null;state.duplicate=null;window.IASDPIChronogram=null;
    dateCorrection=null;document.querySelector('#correct-date-dialog').close();document.querySelector('#correct-date-preview').replaceChildren();
    document.querySelector('#duplicate-dialog').close();
    render();
  }
});
window.addEventListener('iasdpi-role-changed',()=>{resetUsers();render();});
document.querySelector('#auth-logout').addEventListener('click',()=>{
  guarded(async()=>{if(await IASDPIAuth.logout()===false)return;state.page='organization';navigate('organization');});
});
setInterval(tick, 1000);
let dateCorrection=null;
document.querySelector('#correct-date-dialog').addEventListener('close',()=>{dateCorrection=null;document.querySelector('#correct-date-preview').replaceChildren();});
document.querySelector('#correct-date-cancel').addEventListener('click',()=>{dateCorrection=null;document.querySelector('#correct-date-dialog').close();});
document.querySelector('#correct-date-confirm').addEventListener('click',()=>guarded(async()=>{
  if(!dateCorrection||!window.IASDPIDemo)throw Error('Reabra a prévia do registro local.');
  const p=await api('programs/'+dateCorrection.id+'/correct-date','PUT',dateCorrection);
  dateCorrection=null;document.querySelector('#correct-date-dialog').close();replaceProgram(p);navigate('summary',p.id,{refresh:true});
  toast('Data corrigida para 10/10/2026 neste navegador. Nenhum culto foi duplicado. Exporte um novo backup.');
}));
window.addEventListener('iasdpi-session-status',()=>{
  let banner=document.querySelector('#session-status');
  if(!banner){banner=document.createElement('aside');banner.id='session-status';banner.className='demo-banner';banner.setAttribute('role','status');document.querySelector('.header').after(banner);}
  const status=IASDPIAuth.status();banner.hidden=status.phase==='authenticated'||status.phase==='anonymous';banner.textContent=status.message;
  const recovered=IASDPIAuth.allowed()&&!sessionWasAuthorized;sessionWasAuthorized=IASDPIAuth.allowed();
  if(recovered&&!state.busy&&!bootInProgress)void boot();
});
boot();

document.addEventListener('focusout',event=>{if(event.target.matches('[data-date-input]')){const iso=tryReadDate(event.target.value);if(iso)event.target.value=displayDate(iso);}});
