import './studio-fixture';
import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';import {createExplorationSave,validateExplorationSave} from '../src/exploration';import {freshSave,validateSave,type DogRole} from '../shared/save';import {FIELD_NODES,FIELD_CONTENT,FIELD_ROUTES,emptyFieldBook,validateFieldBook,validateFieldPlay,fieldHidesPartner} from '../shared/fieldbook';import {createRegionMovementWorld,regionGroundHeight} from '../src/regions';import {resetSnapshotMovement,validateSnapshotShape} from '../shared/snapshot';import {prepareAdventureRecovery} from '../src/recovery';
const node=(id:string,suffix:string)=>FIELD_NODES.find(n=>n.id===`field-${id}-${suffix}`)!;
function simAt(region:string,solo=true){const sim=solo?new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold',region)}):new Simulation({...freshSave('field-fixture'),mode:'coop-exploration'});if(!solo&&region!==sim.state.regionId){sim.requestTravel('gold',region);sim.respondTravel('white',true);}sim.state.enemies=[];return sim;}
function place(sim:Simulation,r:DogRole,n:{x:number;z:number},offset=1.2){const x=n.x+offset,z=n.z,y=regionGroundHeight(sim.state.regionId,x,z);Object.assign(sim.state.players[r],{x,y,z,safeX:x,safeY:y,safeZ:z,grounded:true,mounted:false,flight:'grounded',speed:0,action:'idle',actionTime:0,vx:0,vz:0,vy:0,hp:100});}
function use(sim:Simulation,id:string,suffix:string,r:DogRole='gold'){const n=node(id,suffix);place(sim,r,n);sim.command(r,{x:0,z:0,actions:['interact']});sim.tick(.01);}
function start(sim:Simulation,id:string,solo=false){const n=FIELD_NODES.find(n=>n.contentId===id&&n.index===0)!;place(sim,'gold',n,1.1);place(sim,'white',n,-1.1);sim.command('gold',{x:0,z:0,actions:[],field:{kind:'start',siteId:id,solo}});return sim.state.fieldPlay;}
function accept(sim:Simulation){sim.command('white',{x:0,z:0,actions:[],field:{kind:'accept',id:sim.state.fieldPlay!.id}});}
function wait(sim:Simulation,n:number){for(let i=0;i<n*20;i++)sim.tick(.05);}

test('six secrets and four events require their different sequences, save independently and award once',()=>{
 const village=simAt('ch01-lantern-village'),original=structuredClone(village.save);
 use(village,'root-window','leaf');assert(!village.state.fieldbook.completed.includes('root-window'));use(village,'root-window','leaf');
 use(village,'wind-shell','left');use(village,'wind-shell','right');
 use(village,'ribbon-return','start');use(village,'ribbon-return','ribbon');use(village,'ribbon-return','bouquet');assert(!village.state.fieldbook.completed.includes('ribbon-return'));use(village,'ribbon-return','start');
 assert.deepEqual(village.state.fieldbook.completed.sort(),['ribbon-return','root-window','wind-shell']);const revision=village.state.fieldbook.revision;use(village,'root-window','leaf');assert.equal(village.state.fieldbook.revision,revision);assert.deepEqual(village.save,original);
 const record=village.exportExploration();validateExplorationSave(record);const restored=new Simulation(undefined,{mode:'exploration',exploration:record});assert.deepEqual(restored.state.fieldbook,village.state.fieldbook);
 const grove=simAt('mushroom-grove');use(grove,'moon-dew','touch');assert(!grove.state.fieldbook.completed.includes('moon-dew'));grove.state.time=360;use(grove,'moon-dew','touch');
 use(grove,'cap-echo','1');assert.equal(grove.state.fieldbook.steps['cap-echo'],0);for(const n of ['0','2','1'])use(grove,'cap-echo',n);
 for(let i=0;i<5;i++)use(grove,'glow-procession',String(i));assert.deepEqual(grove.state.fieldbook.completed.sort(),['cap-echo','glow-procession','moon-dew']);
 const home=simAt('player-home-villa');for(let i=0;i<3;i++)use(home,'turning-stone','turn');for(let i=0;i<2;i++)use(home,'leaf-pocket','open');
 use(home,'woodland-lamps','start');for(let i=1;i<4;i++)use(home,'woodland-lamps',String(i));assert(!home.state.fieldbook.completed.includes('woodland-lamps'));use(home,'woodland-lamps','start');
 use(home,'wind-mobile','pull');for(let i=0;i<2;i++)use(home,'wind-mobile','leaf');for(let i=0;i<3;i++)use(home,'wind-mobile','weight');use(home,'wind-mobile','pull');assert.deepEqual(home.state.fieldbook.completed.sort(),['leaf-pocket','turning-stone','wind-mobile','woodland-lamps']);
});
test('every physical interaction has a reachable ground pose, no unseen far interaction and no formal chapter changes',()=>{
 for(const n of FIELD_NODES){const sim=simAt(n.regionId),world=createRegionMovementWorld(n.regionId);let found=false;
  for(const distance of [1.2,1.8,2.5])for(let i=0;i<16&&!found;i++){const a=i*Math.PI/8,x=n.x+Math.cos(a)*distance,z=n.z+Math.sin(a)*distance,y=n.y??regionGroundHeight(n.regionId,x,z);if(!world.isSafe?.(x,z,y,.66))continue;place(sim,'gold',{x,z},0);sim.state.players.gold.y=y;if(sim.nearby('gold')===n.label)found=true;}
  assert(found,n.id+' needs an ordinary E pose');
 }
 const formal=new Simulation(freshSave('field-adventure'));formal.state.enemies=[];const before=structuredClone(formal.save);use(formal,'root-window','leaf');use(formal,'root-window','leaf');assert.deepEqual(formal.save,before);assert.equal(formal.state.fieldbook.completed[0],'root-window');assert(!formal.requestTravel('gold','ch05-candle-castle'));
});
test('treasure needs both consent, distinct clues and both players beside the chest; records survive cold recovery',()=>{
 const s=simAt('ch01-lantern-village',false),a=start(s,'split-treasure')!;assert.equal(a.phase,'invited');assert(!fieldHidesPartner(a));s.command('gold',{x:0,z:0,actions:[],field:{kind:'accept',id:a.id}});assert.equal(a.phase,'invited');accept(s);assert.equal(a.phase,'active');assert(fieldHidesPartner(a));
 use(s,'split-treasure','gold','white');assert.equal(a.clues.length,0);use(s,'split-treasure','gold');use(s,'split-treasure','white','white');assert.equal(a.clues.length,2);use(s,'split-treasure','chest');assert.equal(a.phase,'active');place(s,'white',node('split-treasure','chest'),-1.2);use(s,'split-treasure','chest');assert.equal(a.phase,'result');assert(!fieldHidesPartner(a));
 const save=s.exportSave();validateSave(save);assert(!('fieldPlay' in (save.world.snapshot as object)));assert.deepEqual(new Simulation(save).state.fieldbook,s.state.fieldbook);
 const stale=s.exportLiveSnapshot();stale.fieldbook=emptyFieldBook();const recovered=new Simulation(prepareAdventureRecovery(save,stale));assert.deepEqual(recovered.state.fieldbook,s.state.fieldbook);
});
test('hide has preparation blackout/freeze, two alternating rounds, wall-safe discovery, bounds and disconnect cleanup',()=>{
 const s=simAt('player-home-villa',false),a=start(s,'woodland-hide')!;accept(s);assert.equal(a.phase,'prepare');const before={...s.state.players.gold};s.command('gold',{x:1,z:1,actions:['jump']});s.tick(.05);assert.equal(s.state.players.gold.x,before.x);assert(s.state.players.gold.grounded);wait(s,25.1);assert.equal(a.phase,'active');
 s.command('gold',{x:0,z:0,actions:['interact']});s.tick(.01);assert.equal(a.round,2);assert.equal(a.seeker,'white');assert.equal(a.phase,'prepare');wait(s,25.1);s.command('white',{x:0,z:0,actions:['interact']});s.tick(.01);assert.equal(a.phase,'result');assert(s.state.fieldbook.completed.includes('woodland-hide'));
 start(s,'woodland-hide');accept(s);s.state.players.white.x=-80;s.tick(.01);assert(!s.state.fieldPlay);
 start(s,'woodland-hide');accept(s);const snap=s.exportLiveSnapshot();validateSnapshotShape(snap);assert(!resetSnapshotMovement(snap).fieldPlay);s.resetMovement(true);assert(!s.state.fieldPlay);
});
test('flight counts only ordered swept checkpoints, both racers finish independently, best times persist and replay does not duplicate collection',()=>{
 const s=simAt('ch01-lantern-village',false),a=start(s,'village-sky')!;accept(s);wait(s,3.1);assert.equal(a.phase,'active');const route=FIELD_ROUTES[a.siteId];
 const fly=(r:DogRole,q:{x:number;y:number;z:number})=>{Object.assign(s.state.players[r],{...q,grounded:false,mounted:true,flight:'flying',action:'fly',vx:0,vz:0,vy:0});};
 // Skipping directly to the final ring cannot finish or advance ring 1.
 fly('gold',route.at(-1)!);s.tick(.01);assert.equal(a.next.gold,0);
 for(const role of ['gold','white'] as const)for(const q of route){fly(role,{...q,x:q.x-.5});s.tick(.01);fly(role,q);s.tick(.01);}
 assert.equal(a.next.gold,6);assert.equal(a.next.white,6);assert.equal(a.phase,'result');assert.equal(s.state.fieldbook.completed.filter(i=>i==='village-sky').length,1);assert(s.state.fieldbook.best['village-sky:gold']>0);
 const solo=simAt('mushroom-grove');const b=start(solo,'grove-sky',true)!;assert.deepEqual(b.participants,['gold']);assert.equal(b.phase,'countdown');solo.requestTravel('gold','mushroom-home');assert(!solo.state.fieldPlay);
});
test('strict state validation rejects bad clocks, roles, routes and reward records',()=>{
 const s=simAt('ch01-lantern-village',false);const a=start(s,'split-treasure')!;validateFieldPlay(a);validateFieldBook(s.state.fieldbook);
 for(const change of [{participants:['gold','gold']},{next:{gold:7,white:0}},{regionId:'uninstalled-map'},{expiresAt:NaN},{proposer:'intruder'}])assert.throws(()=>validateFieldPlay({...a,...change}));
 for(const change of [{found:['missing']},{completed:['root-window']},{best:{'village-sky:gold':-1}},{steps:{'__proto__':1,'root-window':Infinity}}])assert.throws(()=>validateFieldBook({...emptyFieldBook(),...change}));
});
test('a flying challenge survives passing above real ground enemies; death still clears it',()=>{
 const s=new Simulation(freshSave('formal-airborne-course'));s.state.broomOwned=true;
 const a=start(s,'village-sky',true)!;wait(s,3.1);assert.equal(a.phase,'active');
 const enemy=s.state.enemies.find(e=>e.kind==='wolf')!,p=s.state.players.gold;
 Object.assign(p,{x:enemy.x,y:18,z:enemy.z,mounted:true,grounded:false,flight:'flying',action:'fly'});enemy.state='chase';
 s.tick(.02);assert.equal(s.state.fieldPlay?.id,a.id,'nearby ground combat must not discard an airborne course');
 p.hp=0;s.tick(.02);assert(!s.state.fieldPlay,'flight creates no survival exemption');
});
test('free exploration discoveries do not require clearing nearby enemies; formal combat still blocks them',()=>{
 for(const mode of ['exploration','coop-exploration','adventure'] as const){
  const s=mode==='exploration'?new Simulation(undefined,{mode}):new Simulation({...freshSave('field-combat-'+mode),mode});
  const n=node('root-window','leaf');place(s,'gold',n);const e=s.state.enemies[0];e.state='chase';e.x=n.x+12;e.z=n.z;
  s.command('gold',{x:0,z:0,actions:['interact']});s.tick(.01);
  assert.equal(s.state.fieldbook.found.includes('root-window'),mode!=='adventure');
 }
});
