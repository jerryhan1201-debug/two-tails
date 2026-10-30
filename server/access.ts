import {renderAccessPage} from './access-page';
/** Private two-person site gate. No access secret, digest, recovery token or IP enters client assets/logs. */
export interface AccessEnv { SITE_ACCESS_HASH?:string;SITE_SESSION_SECRET?:string }
export const ACCESS_COOKIE='__Host-goulai-access';
export const ACCESS_TTL_SECONDS=14*24*60*60;
export const ACCESS_RATE_WINDOW_MS=15*60*1000;
export const ACCESS_RATE_PER_CLIENT=8;
export const ACCESS_RATE_TOTAL=48;
const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(s:string)=>new Uint8Array(s.match(/.{2}/g)!.map(v=>parseInt(v,16)));
export const accessConfigured=(env:AccessEnv)=>/^[a-f0-9]{64}$/i.test(env.SITE_ACCESS_HASH??'')&&(env.SITE_SESSION_SECRET?.length??0)>=32&&(env.SITE_SESSION_SECRET?.length??0)<=512;
export async function accessDigest(text:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));}
async function key(env:AccessEnv){return crypto.subtle.importKey('raw',encoder.encode(env.SITE_SESSION_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function accessHmac(env:AccessEnv,text:string){return hex(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(text)));}
async function verifyHmac(env:AccessEnv,text:string,signature:string){return /^[a-f0-9]{64}$/.test(signature)&&crypto.subtle.verify('HMAC',await key(env),unhex(signature),encoder.encode(text));}
/** Fixed length digest comparison; never compares the submitted password itself. */
function digestEquals(a:string,b:string){if(a.length!==64||b.length!==64)return false;let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function verifyAccessPassword(env:AccessEnv,password:string){return accessConfigured(env)&&encoder.encode(password).length>=8&&encoder.encode(password).length<=256&&digestEquals(await accessDigest(password),env.SITE_ACCESS_HASH!.toLowerCase());}
export async function issueAccessSession(env:AccessEnv,origin:string,now=Date.now()):Promise<string>{
 if(!accessConfigured(env))throw new Error('Private access is not configured');
 const issued=Math.floor(now/1000),expires=issued+ACCESS_TTL_SECONDS,nonce=hex(crypto.getRandomValues(new Uint8Array(16))),body=`v1.${issued}.${expires}.${nonce}`;
 return body+'.'+await accessHmac(env,`session|${origin}|${body}|${env.SITE_ACCESS_HASH!.toLowerCase()}`);
}
export async function readAccessSession(request:Request,env:AccessEnv,now=Date.now()):Promise<{expires:number}|null>{
 if(!accessConfigured(env))return null;
 const matches=(request.headers.get('Cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(ACCESS_COOKIE+'='));
 if(matches.length!==1)return null;
 const token=matches[0].slice(ACCESS_COOKIE.length+1);if(token.length>220)return null;
 const m=/^(v1\.(\d{10,12})\.(\d{10,12})\.([a-f0-9]{32}))\.([a-f0-9]{64})$/.exec(token);if(!m)return null;
 const issued=Number(m[2]),expires=Number(m[3]),seconds=Math.floor(now/1000);
 if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(expires)||issued>seconds+60||expires<=seconds||expires-issued!==ACCESS_TTL_SECONDS)return null;
 if(!await verifyHmac(env,`session|${new URL(request.url).origin}|${m[1]}|${env.SITE_ACCESS_HASH!.toLowerCase()}`,m[5]))return null;
 return {expires};
}
export function accessCookie(token:string){return `${ACCESS_COOKIE}=${token}; Path=/; Max-Age=${ACCESS_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;}
export function expiredAccessCookie(){return `${ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;}
export const accessHeaders={
 'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow, noarchive',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
};
export function accessJson(value:unknown,status=200,extra:Record<string,string>={}){return new Response(JSON.stringify(value),{status,headers:{...accessHeaders,'Content-Type':'application/json; charset=utf-8',...extra}});}
export function accessPage(message='',status=200):Response{
 // Standalone markup embeds only its own optimized forest art. Strict Origin checks remain below.
 return new Response(renderAccessPage(message),{status,headers:{...accessHeaders,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
export interface RateRecord {start:number;total:number;clients:Record<string,number>}
export interface RateDecision {allowed:boolean;retryAfter:number}
export function advanceAccessRate(previous:RateRecord|undefined,client:string,now=Date.now()):{record:RateRecord;decision:RateDecision;changed:boolean}{
 if(!/^[a-f0-9]{64}$/.test(client))return {record:previous??{start:now,total:0,clients:{}},decision:{allowed:false,retryAfter:900},changed:false};
 const record=previous&&now>=previous.start&&now-previous.start<ACCESS_RATE_WINDOW_MS?structuredClone(previous):{start:now,total:0,clients:{}};
 const count=record.clients[client]??0,retryAfter=Math.max(1,Math.ceil((record.start+ACCESS_RATE_WINDOW_MS-now)/1000));
 if(count>=ACCESS_RATE_PER_CLIENT||record.total>=ACCESS_RATE_TOTAL)return {record,decision:{allowed:false,retryAfter},changed:false};
 record.total++;record.clients[client]=count+1;return {record,decision:{allowed:true,retryAfter:0},changed:true};
}
export async function internalRateRequest(env:AccessEnv,client:string,now=Date.now()):Promise<Request>{
 const seconds=Math.floor(now/1000),payload=JSON.stringify({client,seconds});
 return new Request('https://private.internal/__internal/access-rate',{method:'POST',headers:{'Content-Type':'application/json','X-Goulai-Internal':await accessHmac(env,'rate|'+payload)},body:payload});
}
export async function parseInternalRate(request:Request,env:AccessEnv,now=Date.now()):Promise<string|null>{
 if(!accessConfigured(env)||request.method!=='POST'||new URL(request.url).hostname!=='private.internal')return null;
 const text=await request.text();if(text.length>180)return null;
 if(!await verifyHmac(env,'rate|'+text,request.headers.get('X-Goulai-Internal')??''))return null;
 try{const data=JSON.parse(text);return Object.keys(data).length===2&&/^[a-f0-9]{64}$/.test(data.client)&&Number.isSafeInteger(data.seconds)&&Math.abs(now/1000-data.seconds)<30?data.client:null;}catch{return null;}
}
async function limitedBody(request:Request):Promise<string|null>{
 const claimed=Number(request.headers.get('Content-Length')??0);if(!Number.isFinite(claimed)||claimed>2048||claimed<0||!request.body)return null;
 const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>2048){await reader.cancel();return null;}chunks.push(chunk.value);}const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(all);}catch{return null;}
}
export interface AccessGateDependencies { attempt:(clientHash:string)=>Promise<RateDecision> }
/** Returns null only for a valid cookie. Everything else is handled before ASSETS/API/WS routing. */
export async function privateAccessGate(request:Request,env:AccessEnv,deps:AccessGateDependencies):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname;
 if(path.startsWith('/__internal/'))return accessJson({code:'NOT_FOUND'},404);
 if(!accessConfigured(env))return path==='/api/access/status'?accessJson({authenticated:false,configured:false},503):accessPage('这扇小门还在准备中，请稍后再来。',503);
 const session=await readAccessSession(request,env);
 if(path==='/api/access/status')return request.method==='GET'?accessJson({authenticated:!!session},session?200:401):accessJson({code:'METHOD'},405);
 if(path==='/access/logout'){
   if(request.method!=='POST')return accessJson({code:'METHOD'},405);
   if(request.headers.get('Origin')!==url.origin)return accessJson({code:'ORIGIN'},403);
   return new Response(null,{status:303,headers:{...accessHeaders,'Set-Cookie':expiredAccessCookie(),'Clear-Site-Data':'"cache"','Location':'/access'}});
 }
 if(path==='/access/login'){
   if(request.method!=='POST')return accessJson({code:'METHOD'},405);
   if(request.headers.get('Origin')!==url.origin)return accessPage('请从这扇小门重新输入口令。',403);
   if((request.headers.get('Content-Type')??'').split(';')[0]!=='application/x-www-form-urlencoded')return accessPage('请使用上方的口令框进入。',415);
   const body=await limitedBody(request);if(body===null)return accessPage('口令太长，请检查后再试。',413);
   const fields=new URLSearchParams(body),passwords=fields.getAll('password');if(passwords.length!==1||[...fields.keys()].some(k=>k!=='password'))return accessPage('请重新输入口令。',400);
   try{
     const client=await accessHmac(env,'client|'+(request.headers.get('CF-Connecting-IP')??'unknown'));
     const rate=await deps.attempt(client);if(!rate.allowed){const result=accessPage('试得有些频繁，请稍后再来。',429);result.headers.set('Retry-After',String(rate.retryAfter));return result;}
     if(!await verifyAccessPassword(env,passwords[0]))return accessPage('口令没有对上，再轻轻试一次。',401);
     return new Response(null,{status:303,headers:{...accessHeaders,'Set-Cookie':accessCookie(await issueAccessSession(env,url.origin)),'Location':'/'}});
   }catch{return accessPage('小门暂时没有回应，过一会儿再试。',503);}
 }
 if(path==='/access'&&(request.method==='GET'||request.method==='HEAD'))return session?new Response(null,{status:303,headers:{...accessHeaders,'Location':'/'}}):accessPage();
 if(session){if((path==='/ws'||path.startsWith('/api/')&&!['GET','HEAD'].includes(request.method))&&request.headers.get('Origin')!==url.origin)return accessJson({code:'ORIGIN'},403);return null;}
 if((request.method==='GET'||request.method==='HEAD')&&(path==='/'||path==='/index.html')&&(request.headers.get('Accept')??'text/html').includes('text/html'))return accessPage();
 return accessJson({code:'PRIVATE_ACCESS_REQUIRED',message:'请先输入私人口令。'},401);
}
