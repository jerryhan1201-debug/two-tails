import './studio-fixture';import test from'node:test';import assert from'node:assert/strict';import{emptyJourneys,validateJourneys}from'../shared/journeys';import{COAST_WINTER_NODES as N}from'../src/journeys-coast-winter';import{useJourney}from'../src/journeys';import{Simulation}from'../src/simulation';import{createExplorationSave,validateExplorationSave}from'../src/exploration';import{studioWorld}from'../src/studio-physics';import{selectInteractionTarget}from'../src/interaction-target';
const n=(id:string)=>N.find(n=>n.id===id)!;
const routes={
 'studio-tideglass-cove':['cove-logbook','cove-log-page','cove-log-signal','cove-logbook','cove-echo-low','cove-echo-high','cove-echo-middle'],
 'studio-winter-lantern':['winter-house-letter','winter-path-lamp','winter-path-lamp','winter-turn-lamp','winter-lost-mitten','winter-house-letter','winter-scarf-note','winter-gift-tracks','winter-gift-box'],
};
test('coast and winter stories tolerate wrong order, finish without mandatory duo confirmation and retain older journeys',()=>{
 let p=emptyJourneys();p.entries['pond-reply']={stage:4,known:['pond-reply'],values:{flow:2},completed:true};const old=structuredClone(p.entries['pond-reply']);
 for(const id of ['cove-log-page','cove-log-signal','winter-path-lamp','winter-lost-mitten','winter-gift-box'])assert(!useJourney(p,n(id)).changed);
 p=useJourney(p,n('cove-echo-low')).progress;p=useJourney(p,n('cove-echo-middle')).progress;assert.equal(p.entries['shell-echo'].stage,0);
 for(const route of Object.values(routes))for(const id of route){const r=useJourney(p,n(id));assert(!r.confirmation);p=r.progress;validateJourneys(p);}
 for(const id of ['unsent-log','shell-echo','winter-lamps','snowman-gift'])assert(p.entries[id].completed,id);
 assert.deepEqual(p.entries['pond-reply'],old);for(const node of N){const r=useJourney(p,node);assert(!r.changed&&!r.completedNow);}
});
for(const role of ['gold','white'] as const)for(const[region,route]of Object.entries(routes))test(role+' reachable E and independent cold saves in '+region,()=>{
 let sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave(role,region)});const w=studioWorld(region);
 for(const id of route){const node=n(id);let found=false;for(const d of[1.4,1.9,2.5,3.1])for(let i=0;i<32&&!found;i++){const x=node.x+Math.cos(i*Math.PI/16)*d,z=node.z+Math.sin(i*Math.PI/16)*d,y=w.surfaceAt(x,z,node.y!+.8,.66)?.y;if(y===undefined||Math.abs(y-node.y!)>.8||!w.isSafe!(x,z,y,.66))continue;const p=sim.state.players[role];Object.assign(p,{x,z,y,safeX:x,safeZ:z,safeY:y,grounded:true,vx:0,vz:0,vy:0});found=selectInteractionTarget({state:sim.state,world:w},p).item?.id===id;}
  assert(found,'reachable '+id);sim.command(role,{x:0,z:0,actions:['interact']});sim.tick(.01);const before=structuredClone(sim.state.journeys),save=sim.exportExploration();validateExplorationSave(save);sim=new Simulation(undefined,{mode:'exploration',exploration:save});assert.deepEqual(sim.state.journeys,before);assert(!sim.state.journeyProposal);
 }
 assert(Object.values(sim.state.journeys.entries).every(e=>e.completed));assert.deepEqual(sim.save.quests,{});
});
