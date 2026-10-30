import './studio-fixture';import test from'node:test';import assert from'node:assert/strict';
import{CASTLE_JOURNEY_NODES as N}from'../src/journeys-castle';import{emptyJourneys,validateJourneys}from'../shared/journeys';import{useJourney}from'../src/journeys';import{castleLightningAt}from'../src/castle-weather';
import{Simulation}from'../src/simulation';import{createExplorationSave,validateExplorationSave}from'../src/exploration';import{studioWorld}from'../src/studio-physics';import{selectInteractionTarget}from'../src/interaction-target';
const n=(part:string)=>N.find(n=>n.id==='castle-story-'+part)!;
const route=['coffin','locket','key','letter','coffin','coffin','coffin','clocknote','batwindow','bell','bell'];
test('castle stories allow retry, preserve mirror progress, finish independently and never re-award',()=>{
 let p=emptyJourneys();p.entries['castle-window']={stage:2,known:['window-clamp'],values:{west:1,centre:2,north:3},completed:true};const mirror=structuredClone(p.entries['castle-window']);
 for(const id of ['locket','key','letter','batwindow','bell'])assert(!useJourney(p,n(id)).changed);
 for(const id of route){const r=useJourney(p,n(id));assert(!r.confirmation);p=r.progress;validateJourneys(p);}
 assert(p.entries['count-sleep'].completed&&p.entries['last-bell'].completed);assert.deepEqual(p.entries['castle-window'],mirror);
 for(const node of N){const again=useJourney(p,node);assert(!again.changed&&!again.completedNow);}
});
for(const role of ['gold','white'] as const)test(role+' can use each castle story point with real reach selection and restore isolated saves',()=>{
 let sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave(role,'ch05-candle-castle')});const w=studioWorld('ch05-candle-castle');
 for(const part of route){const node=n(part);let found=false;
  for(const d of[1.35,1.9,2.5,3.1])for(let i=0;i<32&&!found;i++){const x=node.x+Math.cos(i*Math.PI/16)*d,z=node.z+Math.sin(i*Math.PI/16)*d,y=node.y!;if(!w.isSafe!(x,z,y,.66))continue;const p=sim.state.players[role];Object.assign(p,{x,z,y,safeX:x,safeZ:z,safeY:y,grounded:true,vx:0,vz:0,vy:0});found=selectInteractionTarget({state:sim.state,world:w},p).item?.id===node.id;}
  assert(found,'reachable '+part);sim.command(role,{x:0,z:0,actions:['interact']});sim.tick(.01);const before=structuredClone(sim.state.journeys),save=sim.exportExploration();validateExplorationSave(save);sim=new Simulation(undefined,{mode:'exploration',exploration:save});assert.deepEqual(sim.state.journeys,before);assert(!sim.state.journeyProposal);
 }
 assert(sim.state.journeys.entries['count-sleep'].completed&&sim.state.journeys.entries['last-bell'].completed);assert.deepEqual(sim.save.quests,{});
});
test('distant castle lightning is bounded and thunder follows once 2.1 seconds later',()=>{
 const at=castleLightningAt(350.7);assert(at.eligible);assert(Math.abs(at.flash-.11)<1e-8);assert.equal(at.thunderAt,352.1);assert.equal(castleLightningAt(352.1).flash,0);assert.equal(castleLightningAt(60).eligible,false);
 for(let t=0;t<1000;t+=.02){const v=castleLightningAt(t);assert(v.flash>=0&&v.flash<=.111);assert(v.thunderAt>v.start);}
});
