import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';import{freshSave}from'../shared/save';import{createExplorationSave}from'../src/exploration';import{HOME_USES}from'../shared/home-use';import{homeExit,nearbyHomeUse}from'../src/home-use';import{villaMovementWorld as w}from'../src/villa-physics';import{validateSnapshotShape,resetSnapshotMovement}from'../shared/snapshot';
const idle={x:0,z:0,actions:[]};
function create(mode:'exploration'|'coop-exploration'|'adventure',role:'gold'|'white'='gold'){
 const s=mode==='exploration'?new Simulation(undefined,{mode,role,exploration:createExplorationSave(role,'player-home-villa')}):new Simulation({...freshSave('v14-furniture-'+mode),mode});
 if(s.state.regionId!=='player-home-villa'){assert(s.requestTravel('gold','player-home-villa'));assert(s.respondTravel('white',true));}s.setMovementWorld(w);s.state.enemies=[];for(const r of ['gold','white']as const)Object.assign(s.state.players[r],{x:2,y:.3,z:10,safeX:2,safeY:.3,safeZ:10,grounded:true,speed:0});return s;
}
function at(s:Simulation,role:'gold'|'white',f:typeof HOME_USES[number],slot:number){const p=s.state.players[role],exit=homeExit(f.id,slot,w,[])!;assert(exit,f.id+' exit');Object.assign(p,exit,{safeX:exit.x,safeY:exit.y,safeZ:exit.z,grounded:true,action:'idle',speed:0});assert.equal(nearbyHomeUse(s.state.regionId,p,w)?.id,f.id);}
function press(s:Simulation,r:'gold'|'white'){s.command(r,{...idle,actions:['interact']});s.tick(.02);}
function settle(s:Simulation){for(let i=0;i<30;i++){for(const r of ['gold','white']as const)s.command(r,idle);s.tick(.02);}}
for(const mode of ['exploration','coop-exploration','adventure']as const)test(mode+' both dogs use all five furniture groups and return to a safe same-floor point',()=>{
 for(const role of ['gold','white']as const)for(const f of HOME_USES){const s=create(mode,role);at(s,role,f,role==='gold'?0:1);press(s,role);assert.equal(s.state.players[role].homeUse?.id,f.id);settle(s);const p=s.state.players[role];assert.equal(p.homeUse?.phase,'rest');
  s.command(role,{...idle,actions:['attack','jump','dodge','mount']});s.tick(.02);assert(p.homeUse);assert(!p.mounted);assert.equal(p.speed,0);
  if(mode==='exploration'){const e=s.exportExploration();assert(Math.abs(e.position.y!-f.floor)<.03);assert(w.isSafe!(e.position.x,e.position.z,e.position.y!,.66));}else{const save=s.exportSave();const restored=new Simulation(save);assert(!restored.state.players[role].homeUse);assert(w.isSafe!(restored.state.players[role].x,restored.state.players[role].z,restored.state.players[role].y,.66));}
  press(s,role);settle(s);assert(!p.homeUse);assert(Math.abs(p.y-f.floor)<.03);assert(w.isSafe!(p.x,p.z,p.y,.66));
 }
});
test('host reserves two distinct places, keeps the first occupant, and releases on pause/disconnect',()=>{
 for(const f of HOME_USES){const s=create('coop-exploration');at(s,'gold',f,0);press(s,'gold');settle(s);const first=structuredClone(s.state.players.gold.homeUse);at(s,'white',f,1);press(s,'white');settle(s);assert(s.state.players.white.homeUse,f.id+' second dog');assert.notEqual(s.state.players.white.homeUse!.slot,first!.slot);assert.deepEqual(s.state.players.gold.homeUse,first);
  const snap=s.exportLiveSnapshot();validateSnapshotShape(snap);const reset=resetSnapshotMovement(snap);for(const r of ['gold','white']as const){assert(!reset.players[r].homeUse);assert(Math.abs(reset.players[r].y!-f.floor)<.03);}const bad=structuredClone(snap);bad.players.white.homeUse=structuredClone(bad.players.gold.homeUse);assert.throws(()=>validateSnapshotShape(bad));
  s.resetMovement(true,'gold');assert(!s.state.players.gold.homeUse);assert(s.state.players.white.homeUse);s.resetMovement(true,'white');assert(!s.state.players.white.homeUse);
 }
});
test('furniture prompt cannot cross a floor or a wall; directional exit finishes before walking',()=>{
 const s=create('exploration'),f=HOME_USES[1];at(s,'gold',f,0);const p=s.state.players.gold;p.y=.3;assert(!nearbyHomeUse(s.state.regionId,p,w));p.y=5.1;const wall={...w,resolveAt:(x:number,z:number)=>({x:x+1,z})};assert(!nearbyHomeUse(s.state.regionId,p,wall));press(s,'gold');settle(s);s.command('gold',{x:1,z:0,actions:['jump']});s.tick(.02);assert.equal(p.homeUse?.phase,'exit');assert.equal(p.speed,0);settle(s);assert(!p.homeUse);assert(w.isSafe!(p.x,p.z,p.y,.66));
});

test('both dogs already beside furniture can enter without blocking each other; curved sofa approach stays walkable',()=>{
 for(const f of HOME_USES){const s=create('coop-exploration');at(s,'gold',f,0);at(s,'white',f,1);s.command('gold',{...idle,actions:['interact']});s.command('white',{...idle,actions:['interact']});s.tick(.02);settle(s);assert.equal(s.state.players.gold.homeUse?.phase,'rest',f.id+' gold');assert.equal(s.state.players.white.homeUse?.phase,'rest',f.id+' white');assert.notEqual(s.state.players.gold.homeUse!.slot,s.state.players.white.homeUse!.slot);}
 for(let angle=.7;angle<=2.4;angle+=.05){const x=-12+Math.cos(angle)*2.18,z=6.7+Math.sin(angle)*2.18;assert(w.isSafe!(x,z,.314,.66),'continuous inner sofa approach '+angle);}
 const p=w.resolveAt!(-12,10,.314,.66,1.8);assert(Math.hypot(p.x+12,p.z-10)>.1,'sofa seat remains solid');
});
