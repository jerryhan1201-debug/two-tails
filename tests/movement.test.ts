import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, type Command } from '../src/simulation';
import { PLAYER_RADIUS } from '../src/combat-contact';
import { PLAYER_HEIGHT, type MovementWorld } from '../src/movement';
import { freshSave, validateSave } from '../shared/save';
import { validateSnapshotShape } from '../shared/snapshot';
import { CHAPTERS } from '../src/content';
import { createChapterMovementWorld } from '../src/world-surfaces';
const flat: MovementWorld = {surfaceAt:()=>({y:0,walkable:true,id:'ground'}),resolveAt:(x,z)=>({x,z}),isSafe:()=>true};
function fixture(role:'gold'|'white'='gold', world:MovementWorld=flat) {
  const sim = new Simulation(undefined,{mode:'exploration',role}); sim.state.enemies=[]; sim.setMovementWorld(world);
  const p = sim.state.players[role];
  Object.assign(p,{x:0,z:0,y:0,vy:0,grounded:true,safeX:0,safeY:0,safeZ:0,invincible:0});
  return {sim,p,role};
}
function drive(sim:Simulation,role:'gold'|'white',seconds:number,cmd:Command) {
  for(let i=0;i<Math.ceil(seconds/.01);i++) {sim.command(role,{...cmd,actions:i===0?cmd.actions:[]});sim.tick(.01);}
}
for(const role of ['gold','white'] as const) test(`${role}: sprint is 1.5x, real jumping rises/falls, extra airborne presses cannot reset velocity`,()=>{
  const walk=fixture(role),sprint=fixture(role);
  drive(walk.sim,role,1,{x:1,z:0,actions:[]});drive(sprint.sim,role,1,{x:1,z:0,sprint:true,actions:[]});
  assert(Math.abs(sprint.p.x/walk.p.x-1.5)<.001);assert.equal(sprint.p.invincible,0);
  const {sim,p}=fixture(role);sim.command(role,{x:0,z:0,actions:['jump']});sim.tick(.01);
  const takeoff=p.vy;assert(!p.grounded&&p.y>0);
  let peak=0,flight=0;
  for(let i=0;i<100;i++){sim.command(role,{x:1,z:0,sprint:true,actions:i%5===0?['jump']:[]});sim.tick(.01);peak=Math.max(peak,p.y);flight++;if(p.grounded)break;assert(p.vy<takeoff);}
  assert(peak>1&&peak<1.2);assert(flight<80&&flight>60);assert.equal(p.y,0);assert.equal(p.vy,0);assert(p.x>4&&p.x<5);assert.equal(p.invincible,0);
});
test('attack stops sprint; Q dodge and jumping are separate; focus reset clears just the selected dog',()=>{
  const sim=new Simulation();sim.state.enemies=[];sim.setMovementWorld(flat);
  for(const [i,r]of(['gold','white'] as const).entries())Object.assign(sim.state.players[r],{x:i*10,z:0,y:0,safeX:i*10,safeY:0,safeZ:0});
  sim.command('gold',{x:1,z:0,sprint:true,actions:['attack']});sim.tick(.01);assert(!sim.state.players.gold.sprinting);assert.equal(sim.state.players.gold.action,'attack');
  sim.command('white',{x:0,z:1,sprint:true,actions:['jump']});sim.tick(.01);assert(!sim.state.players.white.grounded);assert.equal(sim.state.players.white.invincible,0);
  sim.resetMovement(true,'gold');assert(!sim.state.players.white.grounded,'a modal does not pull the partner down');
  sim.resetMovement(true);assert(sim.state.players.white.grounded);assert.equal(sim.state.players.white.vy,0);
  sim.command('white',{x:0,z:0,actions:['dodge']});sim.tick(.01);assert(sim.state.players.white.invincible>0);assert(sim.state.players.white.grounded);
});
function barrier(top:number):MovementWorld {return {
  surfaceAt:(x)=>({y:Math.abs(x-2)<.44?top:0,walkable:true,id:'ground'}),
  resolveAt:(x,z,y,r)=>y<top-.015&&Math.abs(x-2)<.45+r?{x:x<2?2-.45-r:2+.45+r,z}:{x,z},
  isSafe:(x,_z,y)=>Math.abs(x-2)>.45+PLAYER_RADIUS||y>=top,
};}
test('swept sprint jump crosses a low obstacle but cannot cross a high wall or an enemy body',()=>{
  const low=fixture('gold',barrier(.55));drive(low.sim,'gold',.75,{x:1,z:0,sprint:true,actions:['jump']});assert(low.p.x>4&&low.p.grounded);
  const high=fixture('gold',barrier(4));drive(high.sim,'gold',1,{x:1,z:0,sprint:true,actions:['jump']});assert(high.p.x<=2-.45-PLAYER_RADIUS+.001);
  const enemy=fixture();const source=new Simulation().state.enemies[0];enemy.sim.state.enemies=[{...source,x:2,z:0,homeX:2,homeZ:0,kind:'golem',state:'warning',timer:10,telegraphs:[{x:30,z:30,r:1,delay:10}]}];
  drive(enemy.sim,'gold',1,{x:1,z:0,sprint:true,actions:['jump']});assert(enemy.p.x<1);
});
test('a jump never descends through a small creature, including a leap from a high terrace',()=>{
  for (const startY of [0,2.5]) {
  const {sim,p}=fixture(),enemy=new Simulation().state.enemies[0];
  if(startY)Object.assign(p,{y:startY,grounded:false,vy:0});
  Object.assign(enemy,{x:2,z:0,homeX:2,homeZ:0,kind:'slime',state:'warning',timer:100,telegraphs:[{x:30,z:30,r:1,delay:100}]});sim.state.enemies=[enemy];
  for(let i=0;i<100;i++){sim.command('gold',{x:i<44?1:0,z:0,sprint:true,actions:i===0?['jump']:[]});sim.tick(.01);assert(Math.hypot(p.x-enemy.x,p.z-enemy.z)>=1.42-.001);}
  }
});
test('low ceiling stops the head, valid elevated surface catches descent, steep face is not a landing',()=>{
  const roof=fixture('gold',{...flat,ceilingAt:()=>PLAYER_HEIGHT+.3});drive(roof.sim,'gold',.25,{x:0,z:0,actions:['jump']});assert(roof.p.y<=.30001);drive(roof.sim,'gold',.6,{x:0,z:0,actions:[]});assert(roof.p.grounded);
  const terrace:MovementWorld={...barrier(.7),surfaceAt:(x,_z,y)=>Math.abs(x-2)<.8&&y>=.69?{y:.7,walkable:true,id:'terrace'}:{y:0,walkable:true,id:'ground'}};
  const landing=fixture('gold',terrace);drive(landing.sim,'gold',.42,{x:1,z:0,actions:['jump']});drive(landing.sim,'gold',.5,{x:0,z:0,actions:[]});assert(landing.p.grounded);assert.equal(landing.p.y,.7);
  const steep=fixture('gold',{...flat,surfaceAt:(x)=>x>1?{y:.8,walkable:true,normalY:.3}:flat.surfaceAt(0,0,0,.66),isSafe:x=>x<1});drive(steep.sim,'gold',1.6,{x:1,z:0,sprint:true,actions:['jump']});assert(steep.p.grounded);assert(steep.p.x<1);
});
test('water does not project to the far bank; a missed leap returns to its last safe ground without changing rewards',()=>{
  const water:MovementWorld={...flat,surfaceAt:x=>x>1?null:flat.surfaceAt(0,0,0,.66),isSafe:x=>x<=1};
  const {sim,p}=fixture('white',water),original=JSON.stringify(sim.save);
  drive(sim,'white',.5,{x:1,z:0,sprint:true,actions:[]});assert(p.x<=1);
  const safe=p.safeX;drive(sim,'white',1.5,{x:1,z:0,sprint:true,actions:['jump']});assert(p.grounded);assert(p.x<=1);assert(Math.abs(p.safeX-safe)<.2);assert.equal(JSON.stringify(sim.save),original);assert(sim.state.events.some(e=>e.type==='return'));
});
test('only thin ground waves can be jumped, volley and overhead attacks still damage at the apex',()=>{
  for(const [pattern,hit]of [['slam',false],['summon',false],['volley',true],['storm',true],['breath',true],['charge',true]] as const){
    const sim=new Simulation();sim.setMovementWorld(flat);const p=sim.state.players.gold;p.x=8;p.z=25;p.safeX=8;p.safeZ=25;p.y=1;p.vy=0;p.grounded=false;
    const e=new Simulation().state.enemies[0];Object.assign(e,{x:8,z:28,homeX:8,homeZ:28,state:'warning',pattern,telegraphs:[{x:8,z:25,r:2,delay:.005}]});sim.state.enemies=[e];sim.tick(.01);
    assert.equal(p.hp<100,hit,pattern);assert.equal(p.grounded,false);
  }
});
test('airborne players cannot hold pressure plates and one explorer cannot finish formal cooperation',()=>{
  const save=freshSave('v5-plate');save.chapterId=CHAPTERS[1].id;const sim=new Simulation(save);sim.setMovementWorld(flat);sim.state.enemies=[];
  const plates=sim.chapter.interactions.filter(i=>i.kind==='plate');sim.state.flags=[sim.chapter.quest.steps[0]];
  for(const [i,r]of(['gold','white']as const).entries())Object.assign(sim.state.players[r],{x:plates[i].x,z:plates[i].z,y:0,grounded:true});
  drive(sim,'gold',1.2,{x:0,z:0,actions:[]});assert(sim.state.coop>1);
  sim.command('gold',{x:0,z:0,actions:['jump']});sim.tick(.01);assert.equal(sim.state.coop,0);assert(!sim.state.flags.includes(plates[0].id));
  drive(sim,'gold',2.5,{x:0,z:0,actions:[]});assert(plates.every(i=>sim.state.flags.includes(i.id)));
});
test('save captures safe ground, live v2 preserves airborne state, v1 restores with finite defaults and rejects corrupt v2 heights',()=>{
  const sim=new Simulation();sim.state.enemies=[];sim.setMovementWorld(flat);const p=sim.state.players.gold;
  drive(sim,'gold',.2,{x:1,z:0,sprint:true,actions:['jump']});assert(!p.grounded);
  const live=structuredClone(sim.state),stored=sim.exportSave(),saved=(stored.world.snapshot as any).players.gold;
  assert(saved.grounded&&saved.vy===0&&!saved.sprinting);assert.equal(saved.x,p.safeX);assert.equal(live.players.gold.y,p.y);assert.doesNotThrow(()=>validateSave(stored));
  const partner=new Simulation();partner.setMovementWorld(flat);partner.restoreSnapshot(live);assert.equal(partner.state.players.gold.y,p.y);assert.equal(partner.state.players.gold.grounded,false);
  partner.restoreSnapshot(live,true);assert(partner.state.players.gold.grounded);assert.equal(partner.state.players.gold.x,p.safeX);
  const legacy=structuredClone(stored);const snap=legacy.world.snapshot as any;snap.v=1;for(const r of ['gold','white'])for(const key of ['y','vy','grounded','sprinting','safeX','safeY','safeZ','landing'])delete snap.players[r][key];
  const restored=new Simulation(legacy);assert.equal(restored.state.v,2);assert(Number.isFinite(restored.state.players.gold.y));assert(restored.state.players.gold.grounded);
  const bad=structuredClone(live);bad.players.white.vy=NaN;assert.throws(()=>validateSnapshotShape(bad),/移动高度/);
});
test('authored village bridge surface and rails keep a real sprint jump continuous',()=>{
  const world=createChapterMovementWorld(CHAPTERS[0]);const {sim,p}=fixture('gold',world);
  Object.assign(p,{x:25,z:31,y:world.surfaceAt(25,31,1e4,.66)!.y,grounded:true,safeX:25,safeZ:31});p.safeY=p.y;
  let previous={x:p.x,z:p.z};for(let i=0;i<190;i++) {sim.command('gold',{x:0,z:1,sprint:true,actions:i===55?['jump']:[]});sim.tick(.01);assert(Math.hypot(p.x-previous.x,p.z-previous.z)<.067);previous={x:p.x,z:p.z};}
  assert(p.z>42);assert(p.grounded);assert(Math.abs(p.y-world.surfaceAt(p.x,p.z,p.y+.05,.66)!.y)<.02);
});

test('chapter six storm shelter protects a grounded dog but jumping leaves that protection',()=>{
  for(const airborne of [false,true]){
    const save=freshSave('shelter');save.chapterId=CHAPTERS[5].id;const sim=new Simulation(save);sim.setMovementWorld(flat);
    const shelter=sim.chapter.terrain.shelters![0],p=sim.state.players.gold,boss=sim.state.enemies.find(e=>e.boss)!;
    sim.state.enemies=[boss];Object.assign(p,{x:shelter.x,z:shelter.z,y:airborne?1:0,grounded:!airborne,vy:0,invincible:0});
    Object.assign(boss,{x:shelter.x+5,z:shelter.z,state:'warning',pattern:'storm',telegraphs:[{x:p.x,z:p.z,r:3,delay:.001}]});sim.tick(.01);
    assert.equal(p.hp<100,airborne);if(!airborne)assert(sim.state.events.some(e=>e.type==='shelter'));
  }
});

test('recovery selects nearby safe ground when an enemy has occupied the remembered landing point',()=>{
  const {sim,p}=fixture(),enemy=new Simulation().state.enemies[0];
  Object.assign(enemy,{x:0,z:0,homeX:0,homeZ:0,state:'warning',timer:100,telegraphs:[{x:30,z:30,r:1,delay:100}]});sim.state.enemies=[enemy];
  Object.assign(p,{x:6,y:-6,z:0,grounded:false,vy:-10});sim.resetMovement(true,'gold');
  assert(p.grounded);assert(Math.hypot(p.x,p.z)>=1.42);assert(Math.hypot(p.x,p.z)<=2.5);assert.equal(p.hp,100);
});
