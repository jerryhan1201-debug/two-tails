import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {freshSave} from '../shared/save';
import {CHAPTERS} from '../src/content';
import {createRegionMovementWorld,regionGroundHeight} from '../src/regions';
import {nearbyInteraction,selectInteractionTarget} from '../src/interaction-target';
import {JOURNEY_NODES,useJourney} from '../src/journeys';
import {emptyJourneys} from '../shared/journeys';
const node=(id:string)=>JOURNEY_NODES.find(n=>n.id===id)!;
function make(region:string){const save=freshSave('prompt-regression');save.chapterId=CHAPTERS[1].id;save.completedChapters=[CHAPTERS[0].id];const sim=new Simulation(save);const s=sim.exportLiveSnapshot();s.regionId=region;s.flags=[];s.enemies=[];delete s.progress;sim.restoreSnapshot(s);return sim;}
function guestContext(sim:Simulation){const state=sim.exportLiveSnapshot();return{state,world:createRegionMovementWorld(state.regionId,undefined,()=>state.flags)};}
test('guest touch prompt uses the same journey selection as authority and does not read upper-floor clues from below',()=>{
 const sim=make('canopy-garden'),n=node('canopy-garden-memory');let progress=emptyJourneys();for(const id of ['mushroom-grove-memory','mail-wet-satchel','mushroom-home-memory'])progress=useJourney(progress,node(id)).progress;sim.state.journeys=progress;
 const p=sim.state.players.white;Object.assign(p,{x:n.x,z:n.z,y:regionGroundHeight('canopy-garden',n.x,n.z),grounded:true});assert.equal(sim.nearby('white'),'');assert.equal(nearbyInteraction(guestContext(sim),'white'),'');
 p.y=8;const context=guestContext(sim),before=JSON.stringify(context.state);assert.equal(nearbyInteraction(context,'white'),sim.nearby('white'));assert.match(nearbyInteraction(context,'white'),/铃/);assert.equal(selectInteractionTarget(context,context.state.players.white).item?.id,n.id);assert.equal(JSON.stringify(context.state),before,'prompt query does not mutate the snapshot');sim.command('white',{x:0,z:0,actions:['interact']});sim.tick(.01);assert.equal(sim.state.journeys.entries['rain-post'].values.bellStep,1);
});
test('guest door prompt shares platform height and completed NPC conversation remains available',()=>{
 const sim=make('canopy-garden'),p=sim.state.players.white;Object.assign(p,{x:0,z:41,y:regionGroundHeight('canopy-garden',0,41),grounded:true});assert.equal(nearbyInteraction(guestContext(sim),'white'),'');p.y=8;assert.equal(nearbyInteraction(guestContext(sim),'white'),sim.nearby('white'));assert.match(sim.nearby('white'),/树梢暖阁/);
 const village=new Simulation(),npc=village.chapter.interactions.find(i=>i.kind==='npc')!;village.state.flags.push(npc.id);Object.assign(village.state.players.white,{x:npc.x,z:npc.z,y:regionGroundHeight(village.state.regionId,npc.x,npc.z),grounded:true});assert.equal(nearbyInteraction(guestContext(village),'white'),village.nearby('white'));assert.match(village.nearby('white'),/再说几句/);
});
test('guest sees the same pending mechanism confirmation as the authority',()=>{
 const sim=make(CHAPTERS[1].id),n=node('river-check-lever');let progress=emptyJourneys();for(const id of ['river-staff-gauge','river-intake-valve','river-intake-valve','river-outlet-valve','river-outlet-valve','river-outlet-valve'])progress=useJourney(progress,node(id)).progress;sim.state.journeys=progress;for(const[r,offset]of [['gold',-1.3],['white',1.3]]as const)Object.assign(sim.state.players[r],{x:n.x+offset,z:n.z,y:regionGroundHeight(sim.state.regionId,n.x+offset,n.z),grounded:true});sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.01);assert.equal(nearbyInteraction(guestContext(sim),'white'),sim.nearby('white'));assert.match(sim.nearby('white'),/确认合作/);
});
