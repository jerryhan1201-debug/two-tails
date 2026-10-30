import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {createExplorationSave,allowedExplorationRegions} from '../src/exploration';
import {REGIONS} from '../src/regions';
import {freshSave,validateSave,makeBackup,parseBackup} from '../shared/save';
import {VILLA_REGION,villaMovementWorld as world} from '../src/villa-physics';

function fixture(role:'gold'|'white',position:number[]){const record=createExplorationSave(role,VILLA_REGION);record.position={x:position[0],y:position[1],z:position[2],yaw:0};return new Simulation(undefined,{mode:'exploration',exploration:record});}
const routes={
 entry:{start:[29.6,.26,38],points:[[25.7,.26,37],[23.2,.26,35.5],[23.2,.26,29],[23.2,.26,23],[21.3,.26,20.3],[12,.26,19],[2,.26,18],[1.9,.3,10]]},
 stairs:{start:[1.9,.3,10],points:[[5,.3,5],[8.3,.3,3.8],[8.3,2.7,-3.5],[12.5,2.7,-3.5],[12.5,5.1,3.8],[12.5,2.7,-3.5],[8.3,2.7,-3.5],[8.3,.3,3.8],[12.5,.3,3.8],[12.5,-2.1,-3.5],[8.3,-2.1,-3.5],[8.3,-4.5,3.8]]},
 basement:{start:[-11.3,-4.5,12],points:[[-11.3,-4.5,17],[-18,-4.5,23.9],[-22.4,-4.5,26.1],[-22.4,.26,13.4],[-26,.26,12]]},
 pool:{start:[25.7,.26,37],points:[[19,.26,38],[10,.26,38.5],[2,.26,36.4],[1.1,.26,30],[1.2,.26,23],[2,.26,18]]},
 hollow:{start:[30.5,.26,29],points:[[32,.26,25],[31,.26,23],[31,.26,20.5],[31,.26,16]]},
 tree:{start:[22.1,.3,15.4],points:[...Array.from({length:48},(_,i)=>{const a=Math.PI+Math.PI*1.5*(i+.5)/48;return [31+8.9*Math.cos(a),.3+(i+1)*.2,15+8.9*Math.sin(a)];}),[31,9.9,23.9],[31,9.9,21.3],[31,9.9,18.6]]},
};
for(const role of ['gold','white']as const)for(const[name,route]of Object.entries(routes))test(`RC3 main Simulation ${role} ${name}`,()=>{
 const sim=fixture(role,route.start),p=sim.state.players[role];
 for(const target of route.points){let n=0;while(Math.hypot(p.x-target[0],p.z-target[2])>.075&&n++<2500){const dx=target[0]-p.x,dz=target[2]-p.z,d=Math.hypot(dx,dz);sim.command(role,{x:dx/d,z:dz/d,actions:[]});sim.tick(1/120);}
  assert(Math.hypot(p.x-target[0],p.z-target[2])<.1&&Math.abs(p.y-target[1])<.12,JSON.stringify({target,actual:[p.x,p.y,p.z],grounded:p.grounded}));
 }
 const saved=sim.exportExploration(),restored=new Simulation(undefined,{mode:'exploration',exploration:saved}).state.players[role];assert(Math.abs(restored.y-p.y)<.03,'floor survives recovery');
});
test('all exploration entitlements match, with no formal rewards or damage',()=>{
 const solo=new Simulation(undefined,{mode:'exploration'}),save={...freshSave('a_free_test'),mode:'coop-exploration' as const},coop=new Simulation(save,{stories:true}),formal=new Simulation(freshSave('a_formal_test'),{stories:true});
 assert.deepEqual(allowedExplorationRegions().sort(),REGIONS.map(r=>r.id).sort());assert.deepEqual(coop.availableRegions,solo.availableRegions);assert(!coop.state.story?.active);assert(formal.state.story?.active);
 for(const s of [solo,coop]){for(const r of s.visibleRoles){s.command(r,{x:0,z:0,actions:[],weapon:'chime',skin:'moon',skills:['nova','shield']});assert.equal(s.state.players[r].weapon,'chime');assert.equal(s.state.players[r].skin,'moon');}
  (s as any).hurtPartner(s.state.players.gold,1000);assert.equal(s.state.players.gold.hp,100);
 }
 const stored=coop.exportSave();assert.deepEqual(stored.players.gold.unlockedEquipment,[]);assert.deepEqual(stored.quests,{});validateSave(stored);assert.equal(new Simulation(stored).mode,'coop-exploration');
 assert.throws(()=>validateSave({...stored,mode:'adventure'}),/模式/);assert.throws(()=>validateSave({...stored,completedChapters:['ch01']}),/奖励/);
 (formal as any).hurtPartner(formal.state.players.gold,20);assert(formal.state.players.gold.hp<100);
 const copy=parseBackup(makeBackup({adventureId:stored.adventureId,recoveryToken:'1'.repeat(64)},stored));assert.equal(copy.save.mode,'coop-exploration');
});
test('villa water, roof and excavations are physical, not safe landing surfaces',()=>{
 assert.equal(world.surfaceAt(13,29,.2,.66),null);assert.equal(world.isSafe!(13,29,.12,.66),false);
 assert.equal(world.surfaceAt(1,9,-4.4,.66)?.y,-4.5);
 const roof=world.surfaceAt(-10,0,24,.66);assert(roof&&roof.y>5);assert.equal(world.isSafe!(-10,0,roof!.y,.66),false);
 assert((world.ceilingAt!(-10,0,.3,.66)??99)<12);
});
test('home visit preserves formal chapter and village route is traversable',()=>{
 const sim=new Simulation(freshSave('a_home_visit'));sim.state.enemies=[];
 const before=sim.exportSave();assert(sim.requestTravel('gold',VILLA_REGION,'map'));assert(sim.respondTravel('white',true));
 assert.equal(sim.state.chapterId,before.chapterId);assert.equal(sim.state.regionId,VILLA_REGION);
 const restored=new Simulation(sim.exportSave());assert.equal(restored.state.regionId,VILLA_REGION);assert.equal(restored.state.mode,'adventure');
 assert.deepEqual(restored.exportSave().completedChapters,before.completedChapters);assert.deepEqual(restored.exportSave().quests,before.quests);
 const record=createExplorationSave('white');record.position={x:24,y:0,z:48,yaw:0};const solo=new Simulation(undefined,{mode:'exploration',exploration:record}),p=solo.state.players.white;
 // Isolate route geometry from the unchanged nearby orchard combat encounter.
 solo.state.enemies=[];
 for(const[x,z]of [[27,54],[31,59]]){let n=0;while(solo.state.regionId!==VILLA_REGION&&Math.hypot(p.x-x,p.z-z)>.15&&n++<2500){const d=Math.hypot(x-p.x,z-p.z);solo.command('white',{x:(x-p.x)/d,z:(z-p.z)/d,actions:[]});solo.tick(1/120);}}
 assert.equal(solo.state.regionId,VILLA_REGION);
});
test('broom starts outside and cannot rise through villa floors',()=>{
 const indoor=fixture('gold',[1,-4.5,9]);indoor.command('gold',{x:0,z:0,actions:['mount']});indoor.tick(1/60);assert.equal(indoor.state.players.gold.mounted,false);
 const p=indoor.state.players.gold;p.mounted=true;p.flight='flying';p.grounded=false;
 for(let i=0;i<600;i++){indoor.command('gold',{x:0,z:0,lift:1,actions:[]});indoor.tick(1/120);}
 assert(p.y<-.5,'existing floor blocks flight');
 const outside=fixture('gold',[29.6,.26,38]);outside.command('gold',{x:0,z:0,actions:['mount']});outside.tick(1/60);assert.equal(outside.state.players.gold.mounted,true);
});
