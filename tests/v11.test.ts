import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {freshSave,validateSave} from '../shared/save';
import {resetSnapshotMovement,validateSnapshotShape} from '../shared/snapshot';
import {createExplorationSave,validateExplorationSave} from '../src/exploration';
import {VILLA_REGION,villaMovementWorld as world,villaObstacles} from '../src/villa-physics';
import {COURTYARD_WALLS,HOME_FOREST_PATH,HOME_FOREST,VILLA_SITE_BOUNDS} from '../src/villa-site';
import {OUTDOOR_BOUNDS} from '../shared/world-bounds';
import {createRegionMovementWorld,getRegionChapter,regionBounds} from '../src/regions';
import {duoAvailable,canCarry} from '../src/duo-interactions';
import {advanceMovement} from '../src/movement';
import {regionGroundHeight} from '../src/regions';
import {retiredVillaObstacle} from '../src/villa-repair-data';
function pair(mode:'adventure'|'coop-exploration'='coop-exploration',region=VILLA_REGION){
 const sim=new Simulation({...freshSave('v11_fixture'),mode});sim.state.enemies=[];if(sim.state.regionId!==region){sim.requestTravel('gold',region);sim.respondTravel('white',true);}
 for(const [r,x]of [['white',0],['gold',2]]as const){const z=region===VILLA_REGION?39:-10,y=regionGroundHeight(region,x,z);Object.assign(sim.state.players[r],{x,y,z,yaw:0,safeX:x,safeY:y,safeZ:z,grounded:true,speed:0,action:'idle'});}
 return sim;
}
function invite(sim:Simulation,type:'ride'|'cuddle'){
 sim.command('gold',{x:0,z:0,actions:[],duo:{kind:'invite',type}});
 if(type==='cuddle'){assert.equal(sim.state.duo?.phase,'invited');sim.command('white',{x:0,z:0,actions:[],duo:{kind:'accept',id:sim.state.duo!.id}});}assert.equal(sim.state.duo?.phase,'active');
}
const pendingId=(sim:Simulation)=>sim.state.duo!.id;
test('home lights default on, isolated solo/coop/formal persist and travel retain choice',()=>{
 for(const mode of ['adventure','coop-exploration']as const){const sim=pair(mode);assert.equal(sim.state.homeLights,true);sim.command('white',{x:0,z:0,actions:[],homeLights:false});const save=sim.exportSave();validateSave(save);const restored=new Simulation(save);assert.equal(restored.state.homeLights,false);
 restored.requestTravel('gold','ch01-lantern-village');restored.respondTravel('white',true);assert.equal(restored.state.homeLights,false);
 restored.command('gold',{x:0,z:0,actions:[],homeLights:true});assert.equal(restored.state.homeLights,false,'outside-home command ignored');
 }
 const seed=createExplorationSave('gold',VILLA_REGION),sim=new Simulation(undefined,{mode:'exploration',exploration:seed});sim.command('gold',{x:0,z:0,actions:[],homeLights:false});const s=validateExplorationSave(sim.exportExploration());assert.equal(s.homeLights,false);assert.equal(new Simulation(undefined,{mode:'exploration',exploration:s}).state.homeLights,false);assert.equal(seed.homeLights,undefined);
});
test('cuddle consent/reject/cancel/timeout and obstructions remain authoritative',()=>{
 const sim=pair();assert(duoAvailable(sim.state,world));sim.command('gold',{x:0,z:0,actions:[],duo:{kind:'invite',type:'cuddle'}});const id=sim.state.duo!.id;
 sim.command('gold',{x:0,z:0,actions:[],duo:{kind:'accept',id}});assert.equal(sim.state.duo?.phase,'invited');sim.command('white',{x:0,z:0,actions:[],duo:{kind:'reject',id}});assert(!sim.state.duo);
 sim.command('white',{x:0,z:0,actions:[],duo:{kind:'invite',type:'cuddle'}});sim.command('gold',{x:0,z:0,actions:[],duo:{kind:'cancel',id:pendingId(sim)}});assert(!sim.state.duo);
 sim.command('white',{x:0,z:0,actions:[],duo:{kind:'invite',type:'cuddle'}});for(let i=0;i<410;i++)sim.tick(.05);assert(!sim.state.duo);
 const w=sim.state.players.white,g=sim.state.players.gold;Object.assign(w,{x:41.8,y:.26,z:0});Object.assign(g,{x:44.2,y:.26,z:0});assert.equal(duoAvailable(sim.state,world),false);
});
test('gold owns shared locomotion; attacks/jumps ignored, safe detach and persistent state has no rider',()=>{
 const sim=pair('coop-exploration','ch01-lantern-village');invite(sim,'ride');const white=sim.state.players.white,gold=sim.state.players.gold,z=white.z;
 for(let i=0;i<20;i++){sim.command('white',{x:0,z:-1,actions:['jump','attack','skill1']});sim.tick(.02);}assert.equal(white.z,z);
 for(let i=0;i<50;i++){sim.command('gold',{x:-1,z:0,sprint:true,actions:['jump','attack']});sim.tick(.02);}
 assert(white.x<-3);assert(Math.abs(gold.y-white.y-1.28)<.001);assert.equal(white.hp,100);assert(gold.cooldowns[0]===0);assert.equal(white.grounded,true);
 validateSnapshotShape(sim.exportLiveSnapshot());const save=sim.exportSave();assert.equal((save.world.snapshot as any).duo,undefined);assert.equal((save.world.snapshot as any).players.gold.grounded,true);
 const cold=new Simulation(save);assert(!cold.state.duo);assert(Math.abs(cold.state.players.gold.y-regionGroundHeight(cold.state.regionId,cold.state.players.gold.x,cold.state.players.gold.z))<.03);assert(Math.hypot(cold.state.players.gold.x-cold.state.players.white.x,cold.state.players.gold.z-cold.state.players.white.z)>1.3);
 const reset=resetSnapshotMovement(sim.exportLiveSnapshot());assert(!reset.duo);assert.equal(reset.players.gold.grounded,true);
 sim.command('white',{x:0,z:0,actions:[],duo:{kind:'cancel',id:sim.state.duo!.id}});assert(!sim.state.duo);assert(createRegionMovementWorld(sim.state.regionId).isSafe!(gold.x,gold.z,gold.y,.66));
});
test('cuddle transitions have a real pose, time out and restore control; combat/region/blur end ride',()=>{
 let sim=pair('adventure');invite(sim,'cuddle');for(let i=0;i<30;i++)sim.tick(.02);assert.equal(sim.state.players.gold.action,'cuddle');assert(Math.abs(sim.state.players.gold.x-sim.state.players.white.x)>1.5);
 for(let i=0;i<330;i++)sim.tick(.02);assert(!sim.state.duo);assert.equal(sim.state.players.white.action,'idle');
 sim=pair('adventure','ch01-lantern-village');invite(sim,'ride');sim.resetMovement(true,'gold');assert(!sim.state.duo);assert.equal(sim.state.players.gold.grounded,true);
 invite(sim,'ride');assert(sim.requestTravel('white',VILLA_REGION));assert(!sim.state.duo);sim.respondTravel('gold',true);assert.equal(sim.state.regionId,VILLA_REGION);
});
test('whole carried height rejects low door, wall and stairs retain solids',()=>{
 assert.equal(canCarry(world,{x:1.9,y:.3,z:14,yaw:0}),false);
 assert(canCarry(world,{x:0,y:.26,z:39,yaw:0}));
 for(const o of COURTYARD_WALLS.filter(o=>!retiredVillaObstacle(o.id))){const[x,y,z]=o.center,p=world.resolveAt(x,z,.26,.66,2.1);assert(Math.hypot(p.x-x,p.z-z)>.65);const air=world.resolveAt(x,z,3.3,.66,2.1);assert(Math.hypot(air.x-x,air.z-z)<.03,'finite wall');}
 assert(Math.hypot(world.resolveAt(28,46,.26,.66,2.1).x-28,world.resolveAt(28,46,.26,.66,2.1).z-46)<.03,'gate opening');
 const low=world.ceilingAt!(1.9,14,.3,.66);assert(low&&low<4,'door lintel prevents jumping into its solid');
 assert(villaObstacles.some(o=>o.kind==='support-solid'));
});
test('expanded bounds share physical ground and recovery; forest path really traversable',()=>{
 for(const[id,b]of Object.entries(OUTDOOR_BOUNDS)){
  const w=createRegionMovementWorld(id,getRegionChapter(id));assert.deepEqual(w.bounds,b);
  for(const[x,z]of [[b.minX+2,0],[b.maxX-2,0],[0,b.maxZ-2]])assert(w.surfaceAt(x,z,100,.66),'new edge has support '+id);
 }
 assert.deepEqual(regionBounds(VILLA_REGION),VILLA_SITE_BOUNDS);assert(HOME_FOREST.length>100);
 for(const [x,z]of HOME_FOREST_PATH){assert(world.surfaceAt(x,z,.4,.66));assert(world.isSafe!(x,z,.26,.66),JSON.stringify([x,z]));}
 for(let i=1;i<HOME_FOREST_PATH.length;i++)for(let t=0;t<=1;t+=.01){const a=HOME_FOREST_PATH[i-1],b=HOME_FOREST_PATH[i],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;assert(world.isSafe!(x,z,.26,.66),'continuous forest loop '+[x,z]);}
});
