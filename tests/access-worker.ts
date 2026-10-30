/** Run only against an isolated local Wrangler instance configured with the explicit fixture secrets. */
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { Simulation } from '../src/simulation';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PROTOCOL_VERSION } from '../shared/protocol';
const origin=process.env.TEST_ACCESS_SERVER??'http://127.0.0.1:8896';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))throw new Error('Access fixture may only target an isolated local Worker');
if(['5173','8787'].includes(new URL(origin).port))throw new Error('Never target the user development services');
const finalBuild=process.env.FINAL_BUILD==='1',directory=resolve(process.env.GAME_DIST_DIR??'dist');
const packageVersion=JSON.parse(await readFile(resolve(process.env.GAME_SOURCE_DIR??'.','package.json'),'utf8')).version;
const preflight=process.env.GAME_PREFLIGHT==='1';assert(!(preflight&&finalBuild),'Preflight and final release evidence are mutually exclusive');
const report:Record<string,unknown>={server:origin,fixture:'isolated-local-only',finalBuild,preflight,scope:finalBuild?'frozen '+packageVersion+' private gate integration':preflight?'temporary '+packageVersion+' production snapshot private gate preflight; not final release acceptance':'compatibility fixture; not final release validation'};
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const req=async(path:string,method='GET',body?:unknown,cookie?:string)=>fetch(origin+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
for(const path of ['/assets/game.js','/api/health','/ws?room=ABC123','/sw.js','/api/access/status']){const r=await req(path);assert.equal(r.status,401);assert(r.headers.get('Cache-Control')?.includes('no-store'));assert(r.headers.get('X-Robots-Tag')?.includes('noindex'));}report.unauthorizedResources=true;
const wrongOrigin=await fetch(origin+'/access/login',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Origin:'https://unrelated.invalid','Content-Type':'application/x-www-form-urlencoded'},body:'password=fixture-forest-door'});assert.equal(wrongOrigin.status,403);
const enter=async()=>{const r=await fetch(origin+'/access/login',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'password=fixture-forest-door'});assert.equal(r.status,303);const cookie=r.headers.get('Set-Cookie')!;for(const attribute of ['Path=/','Max-Age=1209600','HttpOnly','Secure','SameSite=Strict'])assert(cookie.includes(attribute));return cookie.split(';')[0];};
const cookies=[await enter(),await enter()];
const html=await req('/','GET',undefined,cookies[0]);assert.equal(html.status,200);assert(html.headers.get('Cache-Control')!.includes('no-store'));assert.equal(html.headers.get('Referrer-Policy'),'same-origin','native game logout must retain its same-origin Origin');const text=await html.text();assert(text.includes('<script'));report.authenticatedGame=true;
const asset=/src="([^"]+\.js)"/.exec(text)?.[1];assert(asset,'Built document must reference its real entry');assert.equal((await req(asset)).status,401);const entry=await req(asset,'GET',undefined,cookies[0]);assert.equal(entry.status,200);assert(entry.headers.get('Cache-Control')!.includes('no-store'));report.realBuiltAssetProtected=true;report.servedDocumentTitle=/<title>([^<]+)<\/title>/.exec(text)?.[1];report.servedEntry=asset;report.servedEntrySha256=hash(new Uint8Array(await entry.arrayBuffer()));
const status=await req('/api/access/status','GET',undefined,cookies[0]);assert.equal(status.status,200);assert(status.headers.get('Cache-Control')?.includes('no-store'));assert.deepEqual(await status.json(),{authenticated:true});
assert.equal(status.headers.get('Referrer-Policy'),'no-referrer','non-HTML responses retain the stricter privacy policy');
const forged=cookies[0].slice(0,-1)+(cookies[0].endsWith('0')?'1':'0');assert.equal((await req('/api/access/status','GET',undefined,forged)).status,401);report.sessionHeadersAndStatus=true;
async function files(dir:string,prefix=''):Promise<string[]>{const names:string[]=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())names.push(...await files(join(dir,e.name),prefix+e.name+'/'));else if(e.isFile())names.push(prefix+e.name);}return names;}
const runtimeFiles=(await files(directory)).sort(),runtimeEvidence=[];
const frozen=finalBuild||preflight?JSON.parse(await readFile(resolve(process.env.GAME_FREEZE_PATH??'artifacts/v6/final/build.json'),'utf8')):undefined;
if(frozen)assert.equal(frozen.preflight===true,preflight,'Identity must explicitly distinguish preflight from final freeze');
if(frozen){assert.equal(frozen.version,packageVersion,'Freeze must match the explicitly selected source package');assert.match(frozen.cache,new RegExp('^starlight-shell-v'+packageVersion.split('.')[1]+'-'));assert.equal(frozen.entry,asset);assert.equal(report.servedEntrySha256,frozen.sha256);assert.deepEqual(runtimeFiles,Object.keys(frozen.distFiles).sort());}
if(process.env.GAME_EXPECTED_SHA256)assert.equal(report.servedEntrySha256,process.env.GAME_EXPECTED_SHA256);
for(const name of runtimeFiles){
 const local=await readFile(join(directory,name)),sha256=hash(local);if(frozen)assert.equal(sha256,frozen.distFiles[name].sha256,'local dist differs from freeze: '+name);
 let response=await req('/'+name,'GET',undefined,cookies[0]);let canonicalRedirect:string|undefined;
 // Workers Assets canonicalizes this one file. Inspect before sending any cookie onward.
 if(name==='index.html'&&response.status===307){
  const location=response.headers.get('Location');assert(location,'index canonical redirect needs Location');
  const destination=new URL(location,origin);assert.equal(destination.href,origin+'/','Only same-origin index.html -> / canonicalization is permitted');
  assert(response.headers.get('Cache-Control')?.includes('no-store'));canonicalRedirect=destination.pathname;
  response=await req('/','GET',undefined,cookies[0]);
 }
 assert.equal(response.status,200,'protected runtime missing: '+name);assert(response.headers.get('Cache-Control')?.includes('no-store'),'protected runtime must not persist in HTTP cache: '+name);assert.equal(hash(new Uint8Array(await response.arrayBuffer())),sha256,'served runtime differs from local dist: '+name);runtimeEvidence.push({name,bytes:local.length,sha256,...(canonicalRedirect?{canonicalRedirect}:{})});
 const anonymous=await req('/'+name);assert(anonymous.status===401||(name==='index.html'&&anonymous.status===200),'runtime escaped private gate: '+name);assert(anonymous.headers.get('Cache-Control')?.includes('no-store'),'anonymous runtime must not be cached: '+name);
 if(anonymous.status===200){const gate=await anonymous.text();assert(gate.includes('id="password"')&&!gate.includes('<script'),'anonymous index must contain only the native gate');}
 if(name==='assets/ui/portraits/gold.png'||name==='assets/ui/portraits/white.png'||name==='assets/environment/v6-core/giant-mushroom.glb'){const revised='/'+name+'?rev=v'+packageVersion.split('.')[1]+'-20261010';assert.equal((await req(revised)).status,401);const versioned=await req(revised,'GET',undefined,cookies[0]);assert.equal(versioned.status,200);assert(versioned.headers.get('Cache-Control')?.includes('no-store'));assert.equal(hash(new Uint8Array(await versioned.arrayBuffer())),sha256,'versioned fixed-name asset differs: '+name);}
}
report.runtimeEvidence=runtimeEvidence;report.runtimeFingerprint=hash(JSON.stringify(runtimeEvidence));report.frozenRuntimeVerified=!!frozen&&!preflight;report.productionSnapshotBytesVerified=!!frozen;report.anonymousRuntimeResourceCount=runtimeFiles.length;report.versionedFixedNameResourcesVerified=runtimeFiles.filter(name=>['assets/ui/portraits/gold.png','assets/ui/portraits/white.png','assets/environment/v6-core/giant-mushroom.glb'].includes(name));
assert.equal((await req('/api/health','GET',undefined,cookies[0])).status,200);assert.equal((await req('/__internal/access-rate','GET',undefined,cookies[0])).status,404);
const hostToken='d'.repeat(64),guestToken='e'.repeat(64);
const createdResponse=await req('/api/rooms','POST',{clientToken:hostToken},cookies[0]);assert.equal(createdResponse.status,200);const created:any=await createdResponse.json();
assert.equal((await req('/api/join','POST',{code:created.room.code,clientToken:guestToken},cookies[1])).status,200);
const sockets:WebSocket[]=[],messages:any[][]=[[],[]],seq=[0,0];
const waitFor=async(i:number,kind:string,predicate:(payload:any)=>boolean=()=>true)=>{for(let n=0;n<200;n++){const found=messages[i].filter(m=>m.kind===kind&&predicate(m.payload)).at(-1);if(found)return found.payload;await new Promise(r=>setTimeout(r,20));}throw new Error('Missing WebSocket event: '+kind);};
try{
 for(const i of [0,1]){const socket=new WebSocket(origin.replace('http:','ws:')+'/ws?room='+created.room.code,{headers:{Cookie:cookies[i],Origin:origin}});sockets.push(socket);socket.on('message',raw=>messages[i].push(JSON.parse(raw.toString())));await new Promise<void>((resolve,reject)=>{socket.once('open',()=>resolve());socket.once('error',reject);});socket.send(JSON.stringify({v:PROTOCOL_VERSION,seq:seq[i]++,kind:'hello',payload:{clientToken:i?guestToken:hostToken}}));await waitFor(i,'welcome');}
 const send=(i:number,kind:string,payload:unknown={})=>sockets[i].send(JSON.stringify({v:PROTOCOL_VERSION,seq:seq[i]++,kind,payload}));
 send(0,'ready',{ready:true});send(1,'ready',{ready:true});await waitFor(0,'room',room=>room.players.length===2&&room.players.every((p:any)=>p.ready));send(0,'start');await waitFor(1,'started');
 send(1,'input',{input:{x:0,z:0,lift:1,actions:['mount']}});const forwarded=await waitFor(0,'input');assert.equal(forwarded.input.actions[0],'mount');assert.equal(forwarded.input.lift,1);
 const sim=new Simulation(created.save);sim.state.enemies=[];sim.command('gold',{x:0,z:0,actions:['mount'],lift:1});sim.tick(.05);const live=sim.exportLiveSnapshot();assert(live.players.gold.mounted);send(0,'snapshot',{snapshot:live});const mirrored=await waitFor(1,'snapshot');assert.equal(mirrored.players.gold.y,live.players.gold.y);assert.equal(mirrored.players.gold.mounted,true);
 send(0,'save',{save:sim.exportSave(),expectedRevision:0,requestId:'isolated-private-gate'});assert.equal((await waitFor(0,'saved')).revision,1);report.authenticatedApiAndTwoWebSockets=true;report.flightForwardAndDurableAck=true;
}finally{for(const s of sockets)s.terminate();}
const logout=await fetch(origin+'/access/logout',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Origin:origin,Cookie:cookies[0]}});assert.equal(logout.status,303);assert(logout.headers.get('Set-Cookie')!.includes('Max-Age=0'));assert(logout.headers.get('Cache-Control')?.includes('no-store'));assert.equal(logout.headers.get('Clear-Site-Data'),'"cache"');report.logout=true;
let blocked=false;for(let i=0;i<9;i++){const response=await fetch(origin+'/access/login',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'password=fixture-wrong-password'});if(response.status===429){assert(response.headers.has('Retry-After'));blocked=true;break;}assert.equal(response.status,401);}assert(blocked);report.durableLimiter=true;
console.log(JSON.stringify(report,null,2));
process.exit(0);
