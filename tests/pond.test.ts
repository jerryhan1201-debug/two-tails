import './studio-fixture';
import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {createExplorationSave,validateExplorationSave} from '../src/exploration';
import {villaMovementWorld as world} from '../src/villa-physics';
import {HOME_POND as P,pondBridgeHeight,pondWaterPoint} from '../src/villa-pond-layout';
import {GARDEN_JOURNEY_NODES} from '../src/journeys-garden';
import {emptyJourneys,validateJourneys} from '../shared/journeys';
import {useJourney} from '../src/journeys';
const n=(id:string)=>GARDEN_JOURNEY_NODES.find(n=>n.id==='pond-'+id)!;
const use=(p:ReturnType<typeof emptyJourneys>,id:string)=>useJourney(p,n(id));
test('pond reducer tolerates wrong order and wrong dial, completes once, and preserves prior journeys',()=>{
 let p=emptyJourneys();p.entries['castle-window']={stage:2,completed:true,known:['castle-receiver'],values:{west:1,centre:2,north:3}};
 const old=structuredClone(p.entries['castle-window']);
 for(const id of ['case','wheel','reply','iris'])assert.equal(use(p,id).changed,false);
 p=use(p,'album').progress;for(let i=0;i<4;i++)p=use(p,'wheel').progress;
 assert.equal(p.entries['pond-reply'].values.flow,0);assert.equal(p.entries['pond-reply'].stage,1);
 p=use(p,'iris').progress;p=use(p,'wheel').progress;assert.equal(p.entries['pond-reply'].stage,1);
 p=use(p,'wheel').progress;assert.equal(p.entries['pond-reply'].stage,2);assert(!use(p,'case').confirmation);
 p=use(p,'case').progress;const done=use(p,'reply');assert(done.completedNow);p=done.progress;
 assert.deepEqual(p.entries['castle-window'],old);assert.doesNotThrow(()=>validateJourneys(p));
 for(const id of ['album','wheel','case','reply']){const again=use(p,id);assert(!again.changed&&!again.completedNow);assert.equal(again.progress,p);}
});
for(const role of ['gold','white'] as const)test(role+' walks the continuous bridge both ways without safety teleport, and solo story resumes at every stage',()=>{
 const seed=createExplorationSave(role,'player-home-villa');seed.position={x:-20,y:.26,z:P.z,yaw:0};let sim=new Simulation(undefined,{mode:'exploration',exploration:seed});
 const player=sim.state.players[role];let peak=0;
 for(const target of [-36.4,-20])for(let i=0;i<900;i++){
  const dx=target-player.x;if(Math.abs(dx)<.1)break;sim.command(role,{x:Math.sign(dx),z:0,sprint:false,actions:[]});sim.tick(.01);peak=Math.max(peak,player.y);
  assert(Math.abs(player.z-P.z)<.03,JSON.stringify({x:player.x,y:player.y,z:player.z}));assert(player.y>=.24);assert(!sim.state.events.some(e=>e.type==='return'));if(i===899)assert.fail('bridge route stalled at '+JSON.stringify({x:player.x,y:player.y,z:player.z}));
 }
 assert(peak>.80&&peak<.92,'lower natural bridge arch stays traversable');assert(Math.abs(player.x+20)<.15);
 for(const id of ['album','iris','wheel','wheel','case','reply']){
  const node=n(id);let stood=false;
  for(const d of [1.4,2,2.6,3.2])for(let i=0;i<24&&!stood;i++){
   const x=node.x+Math.cos(i*Math.PI/12)*d,z=node.z+Math.sin(i*Math.PI/12)*d;
   if(!world.isSafe!(x,z,.26,.66))continue;
   Object.assign(sim.state.players[role],{x,z,y:.26,safeX:x,safeZ:z,safeY:.26,grounded:true,vx:0,vz:0,vy:0});
   if(sim.nearby(role).includes(node.label))stood=true;
  }
  assert(stood,'reachable actual E '+id);sim.command(role,{x:0,z:0,actions:['interact']});sim.tick(.01);
  const before=structuredClone(sim.state.journeys),save=sim.exportExploration();validateExplorationSave(save);
  sim=new Simulation(undefined,{mode:'exploration',exploration:save});assert.deepEqual(sim.state.journeys,before);assert(!sim.state.journeyProposal);
 }
 assert(sim.state.journeys.entries['pond-reply'].completed);assert.deepEqual(sim.save.quests,{});
});
test('water is not a hidden floor, edge safety is finite, bridge rail and original excavations remain real',()=>{
 for(const [x,z]of [[P.x,P.z+2.7],[P.x-2,P.z-2.6]]){
  assert(pondWaterPoint(x,z).inside);assert.equal(world.surfaceAt(x,z,.26,.66),null);
  const shore=world.resolveAt(x,z,.26,.66,2.1);assert(!pondWaterPoint(shore.x,shore.z).inside);
  assert.deepEqual(world.resolveAt(x,z,4,.66,2.1),{x,z});
 }
 const h=pondBridgeHeight(P.x),rail=world.resolveAt(P.x,P.z+1.5,h,.66,2.1);assert(rail.z<P.z+1);
 assert(world.ceilingAt!(P.x,P.z,-1,.1)!<h);
 assert.equal(world.surfaceAt(12,28,.26,.66),null,'existing pool stays open');
 assert(world.surfaceAt(-12,19,.26,.66)!.y<0,'sunken courtyard stays excavated');
});
