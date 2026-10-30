import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCESS_COOKIE,ACCESS_TTL_SECONDS,ACCESS_RATE_WINDOW_MS,accessDigest,accessConfigured,verifyAccessPassword,issueAccessSession,readAccessSession,accessCookie,privateAccessGate,advanceAccessRate,internalRateRequest,parseInternalRate,accessHmac,type AccessEnv,type RateRecord} from '../server/access';
const origin='https://goulai.example';
const env:AccessEnv={SITE_ACCESS_HASH:await accessDigest('fixture-forest-door'),SITE_SESSION_SECRET:'isolated-fixture-session-secret-'.repeat(2)};
const cookie=async(now?:number)=>`${ACCESS_COOKIE}=${await issueAccessSession(env,origin,now)}`;
const request=(path:string,headers:Record<string,string>={})=>new Request(origin+path,{headers});
const never={attempt:async()=>{throw new Error('Unexpected rate call');}};
function login(body='password=fixture-forest-door',headers:Record<string,string>={}){return new Request(origin+'/access/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded','CF-Connecting-IP':'192.0.2.9',...headers},body});}
test('missing or malformed server secrets fail closed for the document, private asset, API, WebSocket and status',async()=>{
 for(const invalid of [{},{SITE_ACCESS_HASH:'bad',SITE_SESSION_SECRET:'x'.repeat(40)},{SITE_ACCESS_HASH:env.SITE_ACCESS_HASH,SITE_SESSION_SECRET:'short'}]){
  assert(!accessConfigured(invalid));for(const path of ['/','/assets/game.js','/api/rooms','/ws','/api/access/status'])assert.equal((await privateAccessGate(request(path),invalid,never))!.status,503);
 }
});
test('private login page uses only its own form and styles; unauthenticated resources and service endpoints never pass the gate',async()=>{
 const page=await privateAccessGate(request('/'),env,never);assert.equal(page!.status,200);const html=await page!.text();assert.match(html,/<h1\b[^>]*aria-label="Two Tails"/);assert.match(html,/<form\b[^>]*method="post"[^>]*action="\/access\/login"/);assert(html.includes('type="password"'));assert(!html.includes('<script'));
 const sources=[...html.matchAll(/\bsrc="([^"]+)"/g)].map(m=>m[1]);assert.equal(sources.length,0); // Public code release has no embedded private artwork.
assert(page!.headers.get('Content-Security-Policy')!.includes('img-src data:'));assert(!html.includes('url(http'));assert(!html.includes('url(/assets/'));
 assert.equal(page!.headers.get('Referrer-Policy'),'same-origin','native browser form needs its same-origin Origin; no-referrer makes Chrome send Origin:null');
 for(const path of ['/assets/game.js','/assets/角色三视图.png','/manifest.webmanifest','/sw.js','/api/health','/ws?room=ABC123'])assert.equal((await privateAccessGate(request(path),env,never))!.status,401);
 assert.equal((await privateAccessGate(request('/__internal/access-rate'),env,never))!.status,404);
});
test('password matching, signed expiry, origin binding, hash rotation, duplicate cookies and mutation checks',async()=>{
 assert(await verifyAccessPassword(env,'fixture-forest-door'));assert(!await verifyAccessPassword(env,'wrong-forest-door'));assert(!await verifyAccessPassword(env,'x'.repeat(257)));
 const now=Date.now(),value=await cookie(now),valid=request('/assets/game.js',{Cookie:value});assert(await readAccessSession(valid,env,now));assert(!await readAccessSession(valid,env,now+ACCESS_TTL_SECONDS*1000+1000));
 assert(!await readAccessSession(new Request('https://other.example/',{headers:{Cookie:value}}),env,now));assert(!await readAccessSession(valid,{...env,SITE_ACCESS_HASH:await accessDigest('changed-private-password')},now));
 assert(!await readAccessSession(request('/',{Cookie:value+'; '+value}),env,now));const changed=value.slice(0,-1)+(value.endsWith('a')?'b':'a');assert(!await readAccessSession(request('/',{Cookie:changed}),env,now));
 const encoded=accessCookie(value.split('=')[1]);for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=1209600'])assert(encoded.includes(flag));assert(!encoded.includes('Domain='));
});
test('native form login checks origin/content/length, counts attempts, never reflects the password, and issues no-store cookie redirects',async()=>{
 let attempts=0;const gate={attempt:async(client:string)=>{attempts++;assert(/^[a-f0-9]{64}$/.test(client));assert(!client.includes('192.0.2.9'));return{allowed:true,retryAfter:0};}};
 assert.equal((await privateAccessGate(login(undefined,{Origin:'https://evil.example'}),env,gate))!.status,403);assert.equal(attempts,0);
 assert.equal((await privateAccessGate(login(undefined,{'Content-Type':'text/plain'}),env,gate))!.status,415);
 assert.equal((await privateAccessGate(login('password='+'x'.repeat(2050)),env,gate))!.status,413);
 const failed=await privateAccessGate(login('password=never-reflect-this-password'),env,gate);assert.equal(failed!.status,401);assert(!(await failed!.text()).includes('never-reflect-this-password'));
 const passed=await privateAccessGate(login(),env,gate);assert.equal(passed!.status,303);assert.equal(passed!.headers.get('Location'),'/');assert(passed!.headers.get('Cache-Control')!.includes('no-store'));assert(passed!.headers.get('Set-Cookie')!.includes('HttpOnly'));assert.equal(attempts,2);
 const unavailable=await privateAccessGate(login(),env,{attempt:async()=>{throw Error('storage down');}});assert.equal(unavailable!.status,503);assert(!unavailable!.headers.has('Set-Cookie'));
});
test('authenticated status, POST-only logout, and protected cross-origin mutation behave correctly',async()=>{
 const value=await cookie();const status=await privateAccessGate(request('/api/access/status',{Cookie:value}),env,never);assert.deepEqual(await status!.json(),{authenticated:true});assert(status!.headers.get('Cache-Control')!.includes('no-store'));
 assert.equal((await privateAccessGate(request('/api/access/status'),env,never))!.status,401);
 assert.equal((await privateAccessGate(request('/access/logout',{Cookie:value}),env,never))!.status,405);
 const bad=new Request(origin+'/access/logout',{method:'POST',headers:{Cookie:value,Origin:'https://evil.example'}});assert.equal((await privateAccessGate(bad,env,never))!.status,403);
 const logout=await privateAccessGate(new Request(origin+'/access/logout',{method:'POST',headers:{Cookie:value,Origin:origin}}),env,never);assert.equal(logout!.status,303);assert(logout!.headers.get('Set-Cookie')!.includes('Max-Age=0'));assert.equal(logout!.headers.get('Clear-Site-Data'),'"cache"');
 const csrf=new Request(origin+'/api/rooms',{method:'POST',headers:{Cookie:value,Origin:'https://evil.example'},body:'{}'});assert.equal((await privateAccessGate(csrf,env,never))!.status,403);
 assert.equal(await privateAccessGate(request('/assets/game.js',{Cookie:value}),env,never),null);
});
test('durable rate window bounds stored clients, rejects excess without more writes, and resets after the window',async()=>{
 let record:RateRecord|undefined;const start=Date.now(),client=await accessHmac(env,'client|192.0.2.9');for(let i=0;i<8;i++){const next=advanceAccessRate(record,client,start);assert(next.decision.allowed&&next.changed);record=next.record;}
 const blocked=advanceAccessRate(record,client,start+1);assert(!blocked.decision.allowed&&!blocked.changed);assert.equal(blocked.decision.retryAfter,900);
 const restored=structuredClone(record);assert(!advanceAccessRate(restored,client,start+20).decision.allowed);
 const expired=advanceAccessRate(record,client,start+ACCESS_RATE_WINDOW_MS);assert(expired.decision.allowed);assert.equal(expired.record.total,1);
 record=undefined;for(let i=0;i<48;i++){const next=advanceAccessRate(record,await accessHmac(env,'client|'+i),start);assert(next.decision.allowed);record=next.record;}
 assert.equal(Object.keys(record!.clients).length,48);assert(!advanceAccessRate(record,await accessHmac(env,'client|new'),start).decision.allowed);
 const ratePage=await privateAccessGate(login(),env,{attempt:async()=>blocked.decision});assert.equal(ratePage!.status,429);assert.equal(ratePage!.headers.get('Retry-After'),'900');
});
test('only a signed, short-lived internal call can consume the Durable Object limiter',async()=>{
 const client=await accessHmac(env,'client|192.0.2.9'),now=Date.now();assert.equal(await parseInternalRate(await internalRateRequest(env,client,now),env,now),client);
 assert.equal(await parseInternalRate(await internalRateRequest(env,client,now),env,now+31_000),null);
 assert.equal(await parseInternalRate(new Request(origin+'/__internal/access-rate',{method:'POST',body:'{}'}),env,now),null);
 const legitimate=await internalRateRequest(env,client,now),text=await legitimate.text();const bad=new Request(legitimate.url,{method:'POST',headers:legitimate.headers,body:text.replace(client,'a'.repeat(64))});assert.equal(await parseInternalRate(bad,env,now),null);
});
