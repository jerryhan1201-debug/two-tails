import test from 'node:test';import assert from 'node:assert/strict';
import './studio-fixture';
import{Simulation}from'../src/simulation';import{createExplorationSave,validateExplorationSave}from'../src/exploration';import{freshSave,validateSave}from'../shared/save';import{validateSnapshotShape,resetSnapshotMovement}from'../shared/snapshot';import{petIntent,validPetCommand,validPetState,PET_HOME,PET_NEST}from'../shared/pet';import{PetFollower,petStanding,petSegment,petSpawn,restorePet}from'../src/pet-follow';import{villaMovementWorld as w}from'../src/villa-physics';
const idle={x:0,z:0,actions:[]};
function solo(){const e=createExplorationSave('gold',PET_HOME);e.position={x:-24,y:.26,z:8,yaw:0};return new Simulation(undefined,{mode:'exploration',exploration:e});}
function follow(s:Simulation){s.command('gold',{...idle,pet:{kind:'follow',revision:s.state.pet!.revision}});assert.equal(s.state.pet!.mode,'follow');}
test('old saves create a single stay-home intent; three modes never borrow pet state',()=>{
 const s=solo();assert.deepEqual(petIntent(s.state.pet),{id:'hashiha',mode:'home',owner:'gold',revision:0});follow(s);
 const e=s.exportExploration();assert.equal(e.pet!.mode,'follow');assert(!Object.hasOwn(e.pet!,'x'));validateExplorationSave(e);assert.equal(new Simulation(undefined,{mode:'exploration',exploration:e}).state.pet!.mode,'follow');
 for(const mode of ['adventure','coop-exploration']as const){const old={...freshSave('pet-'+mode),mode};const a=new Simulation(old);assert.equal(a.state.pet!.mode,'home');assert.equal(a.state.pet!.regionId,PET_HOME);const save=a.exportSave();validateSave(save);assert.equal(new Simulation(save).state.pet!.mode,'home');assert(!Object.hasOwn(save.world.snapshot as object,'pet'));}
});
test('pet uses real supports and cannot cross a villa wall, hole, floor or unsafe roof',()=>{
 assert(petStanding(w,PET_NEST));assert(petSegment(w,PET_NEST,{x:-24,y:.26,z:8}));assert(!petStanding(w,{x:-20,y:.26,z:9}));assert(!petSegment(w,PET_NEST,{x:-18,y:.3,z:8}));assert(!petSegment(w,{x:1.9,y:.3,z:8},{x:1.9,y:5.1,z:8}));assert(!petStanding(w,{x:1.9,y:100,z:8}));
});
test('revision arbiters reject simultaneous stale owner claims without moving a player',()=>{
 const s=new Simulation({...freshSave('pet-race'),mode:'coop-exploration'});assert(s.requestTravel('gold',PET_HOME));assert(s.respondTravel('white',true));
 Object.assign(s.state.players.gold,{x:-24,y:.26,z:8,grounded:true});Object.assign(s.state.players.white,{x:-22,y:.26,z:10,grounded:true});const before=structuredClone(s.state.players);
 s.command('gold',{...idle,pet:{kind:'follow',revision:0}});s.command('white',{...idle,pet:{kind:'follow',revision:0}});assert.equal(s.state.pet!.owner,'gold');assert.equal(s.state.pet!.revision,1);assert.deepEqual(s.state.players,before);
 s.command('white',{...idle,pet:{kind:'follow',revision:1}});assert.equal(s.state.pet!.owner,'white');assert.equal(s.state.pet!.revision,2);validateSnapshotShape(s.exportLiveSnapshot());
 const paused=resetSnapshotMovement(s.exportLiveSnapshot());assert.equal(paused.pet!.speed,0);assert.equal(paused.pet!.owner,'white');assert.equal(paused.pet!.pose,'idle');
});
test('owner flight freezes the pet on its supported point and landing resumes',()=>{
 const s=solo();follow(s);const p=s.state.players.gold,pet=s.state.pet!,f=new PetFollower(),before={x:pet.x,y:pet.y,z:pet.z};p.mounted=true;p.grounded=false;p.y=14;
 for(let i=0;i<100;i++){s.state.time+=.1;f.tick(.1,s.state,w,['gold']);}assert.deepEqual({x:pet.x,y:pet.y,z:pet.z},before);assert.equal(pet.waiting,'flight');assert.equal(pet.speed,0);
 p.mounted=false;p.grounded=true;p.y=.26;p.x=-26;p.z=8;
 for(let i=0;i<80;i++){s.state.time+=.1;f.tick(.1,s.state,w,['gold']);}assert.equal(pet.waiting,'none');assert(Math.hypot(pet.x-p.x,pet.z-p.z)<2.6);assert.equal(pet.relocations,0);
});
test('region prepare/cancel leaves pet in original world; committed arrival restores a legal shared pet',()=>{
 const s=solo();follow(s);const previous=structuredClone(s.state.pet);s.deferRegionTransitions=true;assert(s.requestTravel('gold','ch01-lantern-village','map'));assert(s.state.regionLoad);assert.deepEqual(s.state.pet,previous);
 s.command('gold',{...idle,regionLoad:{id:s.state.regionLoad!.id,result:'cancel'}});assert.deepEqual(s.state.pet,previous);
 assert(s.requestTravel('gold','ch01-lantern-village','map'));const id=s.state.regionLoad!.id;s.command('gold',{...idle,regionLoad:{id,result:'ready'}});assert.equal(s.state.pet!.regionId,s.state.regionId);assert.equal(s.state.pet!.id,'hashiha');assert.equal(s.state.pet!.owner,'gold');assert(validPetState(s.state.pet));
});
test('bounded commands and snapshot reject invalid owner, injected pet id, nonfinite or unbounded state',()=>{
 assert(validPetCommand({kind:'follow',revision:0}));for(const command of [{kind:'fly',revision:0},{kind:'follow',revision:-1},{kind:'follow',revision:0,owner:'white'}])assert(!validPetCommand(command));
 const pet=solo().state.pet!;assert(validPetState(pet));for(const patch of [{owner:'other'},{id:'pet2'},{x:NaN},{speed:50},{revision:Infinity},{pose:'attack'}])assert(!validPetState({...pet,...patch}));
});
test('continuous owner route across the real villa stairs preserves floor and never recalls',()=>{
 const s=solo(),owner=s.state.players.gold;Object.assign(owner,{x:8.3,y:.3,z:3.8,safeX:8.3,safeY:.3,safeZ:3.8});s.state.pet=restorePet({...petIntent(),mode:'follow'},PET_HOME,w,s.state.players,['gold']);const pet=s.state.pet!,f=new PetFollower();
 const waypoints=[{x:8.3,y:2.7,z:-3.5},{x:12.5,y:2.7,z:-3.5},{x:12.5,y:5.1,z:3.8},{x:9.5,y:5.1,z:5.5}];
 for(const goal of waypoints){const start={x:owner.x,y:owner.y,z:owner.z},steps=Math.ceil(Math.hypot(goal.x-start.x,goal.z-start.z)/.23);for(let i=1;i<=steps;i++){const t=i/steps,p=petStanding(w,{x:start.x+(goal.x-start.x)*t,y:owner.y,z:start.z+(goal.z-start.z)*t});assert(p,'owner fixture stays supported');Object.assign(owner,p);s.state.time+=.1;f.tick(.1,s.state,w,['gold']);}for(let i=0;i<15;i++){s.state.time+=.1;f.tick(.1,s.state,w,['gold']);}}
 for(let i=0;i<100;i++){s.state.time+=.1;f.tick(.1,s.state,w,['gold']);}assert(Math.abs(pet.y-5.1)<.1,JSON.stringify({pet,metrics:f.metrics}));assert(Math.hypot(pet.x-owner.x,pet.z-owner.z)<3);assert.equal(pet.relocations,0);assert(f.metrics.maxExpanded<=180);
});
test('a partial descending stride need not reach the final waypoint floor height',()=>{
 const s=solo(),owner=s.state.players.gold;Object.assign(owner,{x:8.29577,y:.3,z:6.612,grounded:true});
 Object.assign(s.state.pet!,{mode:'follow',owner:'gold',x:8.29577,y:.7799999714,z:2.0542,pose:'idle'});
 const f=new PetFollower();for(let i=0;i<80;i++){s.state.time+=.1;f.tick(.1,s.state,w,['gold']);assert(petStanding(w,s.state.pet!));}
 assert(Math.abs(s.state.pet!.y-.3)<.05);assert(s.state.pet!.z>4);assert.equal(s.state.pet!.relocations,0);
});
test('stay home upstairs rests on that floor and can settle without greet/roam oscillation',()=>{
 const s=solo(),p=s.state.players.gold;Object.assign(p,{x:9.5,y:5.1,z:7,grounded:true});
 Object.assign(s.state.pet!,{mode:'follow',x:9.5,y:5.1,z:5,revision:1});const f=new PetFollower();
 assert.match(f.command(s.state,'gold',{kind:'home',revision:1},w),/家里/);
 for(let i=0;i<200;i++){s.state.time+=.1;f.tick(.1,s.state,w,['gold']);}
 assert(Math.abs(s.state.pet!.y-5.1)<.05);assert.equal(s.state.pet!.pose,'lie');assert.equal(s.state.pet!.waiting,'none');assert.equal(s.state.pet!.relocations,0);
});
