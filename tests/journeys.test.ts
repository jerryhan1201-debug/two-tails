import './studio-fixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyJourneys,newestJourneys,validateJourneys,type JourneyProgress} from '../shared/journeys';
import {JOURNEY_NODES,useJourney,journeyEntry,journeyJournal,type JourneyNode} from '../src/journeys';
import {Simulation} from '../src/simulation';
import {freshSave,validateSave,type DogRole,type JsonObject} from '../shared/save';
import {validateSnapshotShape,resetSnapshotMovement} from '../shared/snapshot';
import {prepareAdventureRecovery} from '../src/recovery';
import {createExplorationSave} from '../src/exploration';
import {createRegionMovementWorld,regionGroundHeight,RIVER_FOOTWAY,riverFootwayHeight,journeyPropObstacles} from '../src/regions';
import {CHAPTERS} from '../src/content';
import {castleLightPath} from '../src/journeys-later';

const node=(id:string)=>JOURNEY_NODES.find(n=>n.id===id)!;
function use(p:JourneyProgress,id:string,confirm=false){return useJourney(p,node(id),confirm);}
function riverReady(){let p=emptyJourneys();for(const id of ['river-maintenance-log','river-staff-gauge','river-intake-valve','river-intake-valve','river-outlet-valve','river-outlet-valve','river-outlet-valve'])p=use(p,id).progress;return p;}
function simAt(region:string,journeys=emptyJourneys()){
 const save=freshSave('journey-fixture'),chapter=CHAPTERS.find(c=>c.id===region)??CHAPTERS[1];save.chapterId=chapter.id;save.completedChapters=CHAPTERS.slice(0,chapter.index-1).map(c=>c.id);save.world.journeys=journeys as unknown as JsonObject;
 const sim=new Simulation(save);
 const scene=sim.exportLiveSnapshot();scene.regionId=region;scene.enemies=[];scene.flags=[];scene.journeys=journeys;delete scene.progress;sim.restoreSnapshot(scene);return sim;
}
function place(sim:Simulation,role:DogRole,n:JourneyNode,offset=0){const y=n.y??(n.surfaceId==='canopy-platform'?8:n.surfaceId==='mushroom-step-3'?1.4:regionGroundHeight(sim.state.regionId,n.x+offset,n.z));Object.assign(sim.state.players[role],{x:n.x+offset,z:n.z,y,safeX:n.x+offset,safeZ:n.z,safeY:y,grounded:true,mounted:false,flight:'grounded',vx:0,vz:0,vy:0,hp:100,action:'idle',actionTime:0});}
function press(sim:Simulation,role:DogRole){sim.command(role,{x:0,z:0,actions:['interact']});sim.tick(.01);}

test('every authored journey interaction has a legal nearby standing pose and wins the actual E target selection',()=>{
 for(const n of JOURNEY_NODES){
  const sim=simAt(n.regionId),world=createRegionMovementWorld(n.regionId);let reached=false;
  for(const d of [1.2,1.6,2.2,2.8])for(let step=0;step<16&&!reached;step++){
   const a=step*Math.PI/8,x=n.x+Math.cos(a)*d,z=n.z+Math.sin(a)*d,y=n.y??(n.surfaceId==='canopy-platform'?8:n.surfaceId==='mushroom-step-3'?1.4:regionGroundHeight(n.regionId,x,z)),surface=world.surfaceAt(x,z,y,.66),fixed=world.resolveAt(x,z,y,.66,2.1);
   if(!surface?.walkable||Math.abs(surface.y-y)>.12||Math.hypot(fixed.x-x,fixed.z-z)>.01)continue;
   Object.assign(sim.state.players.gold,{x,y,z,grounded:true,mounted:false,flight:'grounded',hp:100});
   if(sim.nearby('gold').includes(n.label))reached=true;
  }
  assert(reached,`${n.regionId}/${n.id} must be accessible beside its real prop without another item or doorway stealing E`);
 }
});

test('rain mail requires the terrace, drying and actual bell order; wrong notes reset only the sequence',()=>{
 let p=emptyJourneys();assert.equal(use(p,'canopy-home-memory').progress.entries['rain-post'].stage,0);
 for(const id of ['mushroom-grove-memory','mail-wet-satchel','mushroom-home-memory'])p=use(p,id).progress;
 assert.equal(journeyEntry(p,'rain-post').stage,3);
 p=use(p,'canopy-garden-memory').progress;p=use(p,'mail-chime-middle').progress;
 assert.equal(journeyEntry(p,'rain-post').values.bellStep,0);assert.equal(journeyEntry(p,'rain-post').stage,3);
 for(const id of ['canopy-garden-memory','mail-chime-high','mail-chime-middle','canopy-home-memory'])p=use(p,id).progress;
 assert.equal(journeyEntry(p,'rain-post').stage,5);const proposal=use(p,'mail-delivery');assert(proposal.confirmation);assert(!journeyEntry(proposal.progress,'rain-post').completed);
 const done=use(proposal.progress,'mail-delivery',true);assert(done.completedNow);assert.equal(journeyJournal(done.progress)[0].status,'complete');
 const repeat=use(done.progress,'mail-delivery',true);assert(!repeat.completedNow&&!repeat.changed);assert.equal(repeat.progress.revision,done.progress.revision);
});
test('all three real bell strikes emit their own synchronized tone, including the completing middle note',()=>{
 let p=emptyJourneys();for(const id of ['mushroom-grove-memory','mail-wet-satchel','mushroom-home-memory'])p=use(p,id).progress;
 const sim=simAt('canopy-garden',p);
 for(const id of ['canopy-garden-memory','mail-chime-high','mail-chime-middle']){place(sim,'gold',node(id));press(sim,'gold');}
 assert.equal(journeyEntry(sim.state.journeys,'rain-post').stage,4);
 assert.deepEqual(sim.state.events.filter(e=>e.type==='journey-chime').map(e=>e.value),[0,2,1]);
 assert(sim.state.events.some(e=>e.type==='discover'),'final strike also gives discovery feedback');
});
test('river valves are reversible and feedback does not grant the passage before inspection and cooperation',()=>{
 let p=emptyJourneys();for(let i=0;i<4;i++)p=use(p,'river-intake-valve').progress;
 assert.equal(journeyEntry(p,'river-levels').values.intake,0);
 let result=use(p,'river-check-lever');assert(!result.confirmation);assert.match(result.text,/先读尺/);
 p=use(p,'river-staff-gauge').progress;result=use(p,'river-check-lever');assert.match(result.text,/进水0格、回水0格/);assert.equal(journeyEntry(result.progress,'river-levels').stage,1);
 p=riverReady();result=use(p,'river-check-lever');assert(result.confirmation&&!result.completedNow);assert.equal(journeyEntry(result.progress,'river-levels').stage,1);
 p=use(result.progress,'river-check-lever',true).progress;assert.equal(journeyEntry(p,'river-levels').stage,2);
 const fixed=use(p,'river-intake-valve');assert.equal(journeyEntry(fixed.progress,'river-levels').values.intake,2);
 assert(use(p,'river-dry-chest').completedNow);
});
test('visible mechanism bodies block their finite volume but remain reachable beside them',()=>{
 const region=CHAPTERS[1].id,world=createRegionMovementWorld(region),n=node('river-intake-valve'),body=journeyPropObstacles(region).find(o=>o.x===n.x&&o.z===n.z)!;
 const floor=regionGroundHeight(region,n.x,n.z),solid=world.resolveAt(n.x,n.z,floor,.66,2.1),above=world.resolveAt(n.x,n.z,body.top!+.02,.66,2.1);
 assert(Math.hypot(solid.x-n.x,solid.z-n.z)>.9,'walkers cannot pass through the actual wheel base');
 assert(Math.hypot(above.x-n.x,above.z-n.z)<1e-6,'finite mechanism height permits flight above it');
 const sim=simAt(region);place(sim,'gold',n,1.3);assert.match(sim.nearby('gold'),/进水轮/);press(sim,'gold');
 assert.equal(journeyEntry(sim.state.journeys,'river-levels').values.intake,1,'ordinary side E operates the wheel');
 assert(!journeyPropObstacles('mushroom-grove').some(o=>o.x===21&&o.z===43),'small satchel does not consume the landing platform');
});
test('repair shelter has two solid posts and a thin pitched ceiling with a genuinely open walking corridor',()=>{
 const n=node('shelter-draft'),world=createRegionMovementWorld(n.regionId),base=regionGroundHeight(n.regionId,n.x,n.z);
 for(const dz of [-.8,-.4,0,.4,.8]){const x=n.x,z=n.z+dz,y=regionGroundHeight(n.regionId,x,z),p=world.resolveAt(x,z,y,.66,2.1);assert(Math.hypot(p.x-x,p.z-z)<.01,'normal-height dog can pass between the posts and below the beam');}
 const atPost=world.resolveAt(n.x+.88,n.z+.32,base,.66,2.1);assert(Math.hypot(atPost.x-(n.x+.88),atPost.z-(n.z+.32))>.65);
 const underside=world.ceilingAt!(n.x,n.z,base,0);assert(underside!==null&&underside-base>2.3&&underside-base<2.4,'ceiling queries find the actual thin pitched cover');
 const above=world.resolveAt(n.x,n.z,base+2.65,.66,2.1);assert(Math.hypot(above.x-n.x,above.z-n.z)<1e-6,'clear air above the finite shelter stays open');
});
test('authoritative E requires the second living partner, preserves confirmation across safe input release, and clears it on cold save',()=>{
 const sim=simAt(CHAPTERS[1].id,riverReady()),lever=node('river-check-lever');place(sim,'gold',lever,-.8);place(sim,'white',lever,.8);
 assert.match(sim.nearby('gold'),/试水杆/);press(sim,'gold');assert.equal(sim.state.journeyProposal?.proposer,'gold');assert.equal(journeyEntry(sim.state.journeys,'river-levels').stage,1);
 sim.resetMovement(false,'gold');assert(sim.state.journeyProposal);press(sim,'gold');assert.equal(journeyEntry(sim.state.journeys,'river-levels').stage,1,'one role cannot approve twice');
 const durable=sim.exportSave();assert(!('journeyProposal' in (durable.world.snapshot as JsonObject)));assert(!new Simulation(durable).state.journeyProposal);
 sim.state.players.white.hp=0;press(sim,'white');assert.equal(journeyEntry(sim.state.journeys,'river-levels').stage,1);
 place(sim,'white',lever,.8);press(sim,'white');assert.equal(journeyEntry(sim.state.journeys,'river-levels').stage,2);assert(!sim.state.journeyProposal);assert(sim.state.flags.includes('journey-river-footway'));
 const chest=node('river-dry-chest');place(sim,'gold',chest);press(sim,'gold');assert.equal(sim.save.quests['journey-river-levels'],true);
 const completed=structuredClone(sim.exportSave()),revision=sim.state.journeys.revision;sim.dirty=false;press(sim,'gold');assert.equal(sim.state.journeys.revision,revision);assert.equal(sim.dirty,false);assert.deepEqual(sim.save.players,completed.players);assert.deepEqual(sim.save.quests,completed.quests);
});
test('cooperative confirmation expires, cancels on leaving and is stripped by transport pause without resetting valves',()=>{
 const sim=simAt(CHAPTERS[1].id,riverReady()),lever=node('river-check-lever');place(sim,'gold',lever,-.8);place(sim,'white',lever,.8);press(sim,'gold');
 const before=structuredClone(sim.state.journeys);sim.state.players.gold.x+=5;sim.tick(.01);assert(!sim.state.journeyProposal);assert.deepEqual(sim.state.journeys,before);
 place(sim,'gold',lever,-.8);press(sim,'gold');sim.state.time+=21;sim.tick(.01);assert(!sim.state.journeyProposal);
 press(sim,'gold');const paused=resetSnapshotMovement(sim.exportLiveSnapshot());assert(!paused.journeyProposal);assert.deepEqual(paused.journeys,sim.state.journeys);
});
test('cold recovery chooses the latest whole puzzle revision, keeps future IDs, and rejects malformed mechanism state',()=>{
 const sim=simAt(CHAPTERS[1].id,riverReady()),durable=sim.exportSave(),stale=sim.exportLiveSnapshot();
 sim.state.journeys=use(sim.state.journeys,'river-intake-valve').progress;const latest=sim.exportSave();
 const recovered=prepareAdventureRecovery(latest,stale);assert.equal((recovered.world.journeys as unknown as JourneyProgress).entries['river-levels'].values.intake,3,'stale relay cannot overwrite a confirmed turn');
 const next=structuredClone(sim.exportLiveSnapshot());next.journeys=use(next.journeys,'river-intake-valve').progress;assert.equal(new Simulation(prepareAdventureRecovery(durable,next)).state.journeys.entries['river-levels'].values.intake,0,'newer live zero is not unioned with old three');
 const future=structuredClone(next.journeys);future.entries['future-journey']={stage:1,known:['future-clue'],values:{dial:2},completed:false};assert.deepEqual(newestJourneys(future),future);
 for(const corrupt of [{...future,revision:-1},{...future,entries:{broken:{stage:1,known:[],values:{dial:NaN},completed:false}}}])assert.throws(()=>validateJourneys(corrupt));
 const invalid=structuredClone(latest);invalid.world.journeys={v:1,revision:2,entries:{broken:{stage:0,known:[],values:{a:-1},completed:false}}};assert.throws(()=>validateSave(invalid));
 const bad=sim.exportLiveSnapshot();bad.journeyProposal={journeyId:'river-levels',nodeId:'river-check-lever',proposer:'gold',revision:0,expiresAt:10};assert.throws(()=>validateSnapshotShape(bad));
});
test('new stone crossing is physically absent before release, walkable after it, and does not bypass story flags',()=>{
 const off=createRegionMovementWorld(CHAPTERS[1].id),on=createRegionMovementWorld(CHAPTERS[1].id,CHAPTERS[1],()=>['journey-river-footway']);
 assert.equal(off.surfaceAt(-27,65,2,.66),null);assert.equal(on.surfaceAt(-27,65,2,.66)?.id,'journey-river-footway');
 for(let z=RIVER_FOOTWAY.minZ;z<=RIVER_FOOTWAY.maxZ;z+=.25){const y=riverFootwayHeight(-27,z)!;assert(on.isSafe!(-27,z,y,.66),`safe stone/ramp at ${z}`);assert(Math.abs(on.surfaceAt(-27,z,y,.66)!.y-y)<1e-7);}
 const sim=simAt(CHAPTERS[1].id,riverReady());const progress=use(sim.state.journeys,'river-check-lever',true).progress;sim.state.journeys=progress;
 const before=sim.save.completedChapters.slice();const restored=new Simulation(sim.exportSave());assert(restored.state.flags.includes('journey-river-footway'));assert.deepEqual(restored.save.completedChapters,before);assert(!restored.state.flags.includes('r-plate-east'));assert(!restored.state.flags.includes('r-flow'));
});
test('solo exploration can rehearse mechanisms while formal save, chapter rewards and exported exploration schema stay isolated',()=>{
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('white','mushroom-grove')}),formal=structuredClone(sim.save);
 const n=node('mushroom-grove-memory');place(sim,'white',n);press(sim,'white');assert.equal(journeyEntry(sim.state.journeys,'rain-post').stage,1);assert(sim.state.flags.includes(n.id));assert.deepEqual(sim.save,formal);
 assert.deepEqual(sim.exportExploration().journeys,sim.state.journeys);assert.throws(()=>sim.exportSave());assert.throws(()=>sim.exportLiveSnapshot());
});
test('memorial objects establish three distinct identities; wrong symbols preserve clues and remain correctable',()=>{
 let p=emptyJourneys();for(const id of ['memorial-weaver-candle','memorial-ferryman-candle','memorial-ferryman-candle'])p=use(p,id).progress;
 assert.match(use(p,'memorial-lighting').text,/三件旧物/);assert(!use(p,'memorial-lighting').confirmation);
 for(const id of ['memorial-weaver-note','memorial-ferryman-note','memorial-gardener-note'])p=use(p,id).progress;
 p=use(p,'memorial-gardener-candle').progress;assert.match(use(p,'memorial-lighting').text,/缝针.*小船.*叶/);
 p=use(p,'memorial-gardener-candle').progress;p=use(p,'memorial-gardener-candle').progress;
 assert(use(p,'memorial-lighting').confirmation);p=use(p,'memorial-lighting',true).progress;
 assert(journeyEntry(p,'memorial-names').completed);assert.equal(journeyEntry(p,'memorial-names').known.filter(k=>['weaver','ferryman','gardener'].includes(k)).length,3);
});
test('castle light follows real mirror positions and arrows, detects return loops and requires a lit receiver',()=>{
 let p=emptyJourneys();assert.equal(castleLightPath(journeyEntry(p,'castle-window')).reached,false);
 assert(!use(p,'window-clamp',true).completedNow);
 p=use(p,'window-mirror-west').progress;p=use(p,'window-mirror-north').progress;
 const path=castleLightPath(journeyEntry(p,'castle-window'));assert(path.reached);assert.equal(path.segments.length,4);assert.deepEqual(path.segments.at(-1)?.to,{x:2,z:99});
 p=use(p,'window-mirror-centre').progress;p=use(p,'window-mirror-centre').progress;p=use(p,'window-mirror-centre').progress;
 const loop=castleLightPath(journeyEntry(p,'castle-window'));assert(!loop.reached);assert.equal(loop.segments.at(-1)?.hit,'window-mirror-west');
 p=use(p,'window-mirror-centre').progress;assert(use(p,'window-clamp').confirmation);assert(use(p,'window-clamp',true).completedNow);
 const bad=structuredClone(p);bad.entries['castle-window'].values.west=4;assert.throws(()=>validateJourneys(bad),'invalid arrows cannot reach the light tracer');
});
test('mountain repairs require the appropriate tool; retries keep repairs and rescuing the nest does not finish delivery',()=>{
 let p=emptyJourneys();assert.match(use(p,'shelter-draft').text,/毡布/);assert(!use(p,'shelter-lost-nest',true).completedNow);
 p=use(p,'shelter-tool-cart').progress;p=use(p,'shelter-draft').progress;
 assert.equal(journeyEntry(p,'mountain-shelters').values.draft,1);assert.match(use(p,'shelter-beam').text,/绳索/);assert.equal(journeyEntry(p,'mountain-shelters').values.beam,undefined);
 p=use(p,'shelter-tool-cart').progress;p=use(p,'shelter-beam').progress;p=use(p,'shelter-tool-cart').progress;p=use(p,'shelter-lamp').progress;
 assert(use(p,'shelter-lost-nest').confirmation);p=use(p,'shelter-lost-nest',true).progress;assert.equal(journeyEntry(p,'mountain-shelters').values.carried,1);assert(!journeyEntry(p,'mountain-shelters').completed);
 p=newestJourneys(structuredClone(p));assert(use(p,'shelter-homecoming').completedNow);assert.equal(use(p,'shelter-homecoming').progress.entries['mountain-shelters'].values.carried,0);
});
test('post-ending restoration cannot unlock the original ending and three light portions remain bounded and reversible',()=>{
 let p=emptyJourneys();const send=(id:string,confirm=false)=>{const result=useJourney(p,node(id),confirm,{endingRestored:true});p=result.progress;return result;};
 assert.match(use(p,'home-restoration',true).text,/主线归途结束/);assert(!use(p,'home-restoration',true).completedNow);
 send('home-light-village');send('home-light-village');send('home-light-forest');const exceeded=send('home-light-mountain');assert.match(exceeded.text,/只有三份/);assert.equal(journeyEntry(p,'home-lights').values.mountain,undefined);
 send('home-light-village');send('home-light-village');send('home-light-mountain');assert.match(send('home-restoration').text,/5段支线/);
 for(const [id,stage]of [['rain-post',6],['river-levels',3],['memorial-names',2],['castle-window',2],['mountain-shelters',3]] as const)p.entries[id]={stage,known:[],values:{},completed:true};
 assert(send('home-restoration').confirmation);assert(send('home-restoration',true).completedNow);const revision=p.revision;assert(!send('home-restoration',true).changed);assert.equal(p.revision,revision);validateJourneys(p);
});
