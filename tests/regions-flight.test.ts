import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,type Command} from '../src/simulation';
import {CHAPTERS} from '../src/content';
import {createExplorationSave} from '../src/exploration';
import {createRegionMovementWorld,regionConnections,getRegionChapter,REGIONS,GIANT_MUSHROOMS,regionGroundHeight,regionBounds,CANOPY_ROOF,canopyRoofHeight,MUSHROOM_CAPS} from '../src/regions';
import {mushroomSurface,ANCIENT_TREE_BRANCHES} from '../src/forest-physics';
import {freshSave,validateSave} from '../shared/save';
import {validateSnapshotShape,resetSnapshotMovement} from '../shared/snapshot';
import {prepareAdventureRecovery} from '../src/recovery';
import {PLAYER_HEIGHT,type MovementWorld} from '../src/movement';
import {residentReply} from '../src/resident-dialogue';
const flat:MovementWorld={surfaceAt:()=>({y:0,walkable:true,id:'ground'}),resolveAt:(x,z)=>({x,z}),isSafe:()=>true};
test('editable mushroom cap uses its real curved crown, underside and finite rim for walking and flight',()=>{
 const world=createRegionMovementWorld('mushroom-grove'),m=MUSHROOM_CAPS[0];
 const crown=world.surfaceAt(m.x,m.z,30,.66)!,shoulder=world.surfaceAt(m.x+m.cap*.8,m.z,30,.66)!;
 assert((crown.y-m.base)/m.h>.99&&(crown.y-m.base)/m.h<=1,'RC1 crown comes from the delivered GLB, normalized by its height');assert(crown.y-shoulder.y>1,'the curved top is not a flat collider');assert(shoulder.normalY!<.9&&shoulder.walkable);
 assert(world.isSafe!(m.x+m.cap*.8,m.z,shoulder.y,.66));
 const below=world.ceilingAt!(m.x+m.cap*.5,m.z,m.base+2,.66)!;assert(below>m.base+m.h*.88&&below<m.base+m.h*.93);
 assert.notDeepEqual(world.resolveAt(m.x+m.cap*.8,m.z,shoulder.y-1,.66,PLAYER_HEIGHT),{x:m.x+m.cap*.8,z:m.z},'thick cap side is solid');
 assert.deepEqual(world.resolveAt(m.x+m.cap*1.1,m.z,crown.y+2,.66,PLAYER_HEIGHT),{x:m.x+m.cap*1.1,z:m.z},'air above the rim is free');
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold','mushroom-grove')});
 place(sim,'gold',m.x+m.cap*.7,m.z,m.base);Object.assign(sim.state.players.gold,{y:18,safeX:0,safeZ:-8,safeY:regionGroundHeight('mushroom-grove',0,-8),mounted:true,grounded:false,flight:'landing'});
 drive(sim,'gold',3,{x:0,z:0,actions:[]});const p=sim.state.players.gold;assert(p.grounded&&!p.mounted);assert.equal(p.y,mushroomSurface(m,p.x,p.z,30)!.y);
 walkTo(sim,m.x+m.cap*.5,m.z);assert(p.y>shoulder.y);assert(world.isSafe!(p.x,p.z,p.y,.66));
 const house=MUSHROOM_CAPS.at(-1)!;const outer=world.surfaceAt(house.x+5,house.z,20,.66)!,middle=world.surfaceAt(house.x,house.z,20,.66)!;assert(middle.y>outer.y+.6);assert(world.isSafe!(house.x+5,house.z,outer.y,.66));
});
test('ancient tree main wood blocks flight at authored branches while taper leaves genuine high-altitude air',()=>{
 const world=createRegionMovementWorld('canopy-garden'),base=regionGroundHeight('canopy-garden',7,43),s=ANCIENT_TREE_BRANCHES.find(b=>b.x>14&&b.z<49)!;
 assert(s);assert.notDeepEqual(world.resolveAt(s.x,s.z,base+s.y-1,.66,PLAYER_HEIGHT),{x:s.x,z:s.z});
 const ceiling=world.ceilingAt!(s.x,s.z,base+s.y-5,.66)!;assert(ceiling>base+s.y-2&&ceiling<base+s.y);
 assert.deepEqual(world.resolveAt(s.x,s.z,base+s.y+2,.66,PLAYER_HEIGHT),{x:s.x,z:s.z});
 assert.notDeepEqual(world.resolveAt(9.6,43,base+5,.66,PLAYER_HEIGHT),{x:9.6,z:43});
 assert.deepEqual(world.resolveAt(9.6,43,base+24,.66,PLAYER_HEIGHT),{x:9.6,z:43},'tapered trunk cannot retain a three-metre invisible upper cylinder');
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold','canopy-garden')});
 place(sim,'gold',s.x,s.z,base+s.y-6);Object.assign(sim.state.players.gold,{mounted:true,grounded:false,flight:'flying',safeX:0,safeZ:39,safeY:8});
 drive(sim,'gold',2,{x:0,z:0,actions:[],lift:1});assert(sim.state.players.gold.y+PLAYER_HEIGHT<=ceiling+.01,'actual lift stops before the branch underside');
});
test('automatic vertical landing slides around a real branch tip instead of hanging or passing through its body',()=>{
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold','canopy-garden')}),world=createRegionMovementWorld('canopy-garden'),p=sim.state.players.gold;
 // Exact horizontal column from the real GLB browser proof03 failure.
 Object.assign(p,{x:-3.13975,z:47.474,y:23,safeX:0,safeY:8,safeZ:39,grounded:false,mounted:true,flight:'landing',vx:0,vz:0,vy:0});
 let maxOverlap=0;
 for(let i=0;i<600&&!p.grounded;i++){sim.command('gold',{x:0,z:0,actions:[]});sim.tick(.02);const legal=world.resolveAt(p.x,p.z,p.y,.66,PLAYER_HEIGHT);maxOverlap=Math.max(maxOverlap,Math.hypot(legal.x-p.x,legal.z-p.z));}
 assert(p.grounded&&!p.mounted,'automatic landing must finish without another B or lateral input');
 assert(Math.hypot(p.x+3.13975,p.z-47.474)>.5,'descent must go around the authored branch rather than through it');
 assert(maxOverlap<.005,`body remains outside solid wood during descent: ${maxOverlap}`);
 assert.equal(p.y,canopyRoofHeight(p.x,p.z));assert(world.isSafe!(p.x,p.z,p.y,.66));
});
function drive(sim:Simulation,role:'gold'|'white',seconds:number,c:Command){for(let i=0;i<Math.ceil(seconds/.02);i++){sim.command(role,{...c,actions:i?[]:c.actions});sim.tick(.02);}}
function place(sim:Simulation,role:'gold'|'white',x:number,z:number,y=0){Object.assign(sim.state.players[role],{x,z,y,safeX:x,safeZ:z,safeY:y,grounded:true,mounted:false,flight:'grounded',vx:0,vz:0,vy:0,action:'idle'});}
function walkTo(sim:Simulation,x:number,z:number,region=sim.state.regionId){
 for(let i=0;i<2000;i++){if(sim.state.regionId!==region)return;const p=sim.state.players[sim.controlledRole],dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.12)return;sim.command(sim.controlledRole,{x:dx/Math.max(.2,d),z:dz/Math.max(.2,d),actions:[]});sim.tick(.02);}
 assert.fail('normal movement route stuck at '+JSON.stringify({region:sim.state.regionId,x:sim.state.players[sim.controlledRole].x,z:sim.state.players[sim.controlledRole].z,target:[x,z]}));
}
for(const role of ['gold','white'] as const)test(`${role}: the enlarged mushroom forest is walkable beyond its old boundary and safely resumes there`,()=>{
 const inherited=freshSave('expanded-forest-'+role);inherited.chapterId=CHAPTERS[2].id;inherited.completedChapters=CHAPTERS.slice(0,2).map(c=>c.id);
 const sim=new Simulation(undefined,{mode:'exploration',inheritedAdventure:inherited,exploration:createExplorationSave(role,'mushroom-grove')});
 const route=[[-5,12],[4,30],[22,49],[30,65],[31,85],[27,108],[38,125],[33,151]];
 for(const [x,z] of route){walkTo(sim,x,z,'mushroom-grove');assert.equal(sim.state.regionId,'mushroom-grove');}
 const p=sim.state.players[role],bounds=regionBounds('mushroom-grove');assert(p.z>140);assert(sim.resolve(50,145).x>40,'body separation must use the expanded bounds as well');
 const stored=sim.exportExploration();const restored=new Simulation(undefined,{mode:'exploration',inheritedAdventure:inherited,exploration:stored});
 assert.equal(restored.state.regionId,'mushroom-grove');assert(Math.hypot(restored.state.players[role].x-p.x,restored.state.players[role].z-p.z)<.01);
 const world=createRegionMovementWorld('mushroom-grove');assert(world.isSafe!(p.x,p.z,p.y,.66));
 drive(restored,role,12,{x:1,z:0,actions:[]});assert(restored.state.players[role].x<=bounds.maxX-.66+.01);assert(restored.state.players[role].x>40);
 assert.equal(restored.save.completedChapters.length,0,'the independent exploration adapter never advances the formal campaign');
});
test('the complete deep-forest loop remains in the mushroom region for a player with all old exits unlocked',()=>{
 const inherited=freshSave('expanded-loop');inherited.chapterId=CHAPTERS[6].id;inherited.completedChapters=CHAPTERS.map(c=>c.id);
 const sim=new Simulation(undefined,{mode:'exploration',inheritedAdventure:inherited,exploration:createExplorationSave('gold','mushroom-grove')});
 for(const [x,z] of [[-5,12],[4,30],[0,55],[-7,60],[-27,60]])walkTo(sim,x,z,'mushroom-grove');
 const loop=getRegionChapter('mushroom-grove').paths.find(p=>p.id==='mushroom-north-loop')!;
 for(const [x,z] of loop.points){walkTo(sim,x,z,'mushroom-grove');assert.equal(sim.state.regionId,'mushroom-grove','the forest loop must not accidentally cross an old portal');}
 assert(Math.hypot(sim.state.players.gold.x,sim.state.players.gold.z-55)<.15);
});
for(const role of ['gold','white'] as const)test(`${role}: flight crosses both former forest limits without falling back to the launch point`,()=>{
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave(role,'mushroom-grove')});
 const p=sim.state.players[role];drive(sim,role,1.3,{x:0,z:0,actions:['mount'],lift:1});assert(p.mounted);
 const launch={x:p.safeX,z:p.safeZ};
 for(const [x,z] of [[-5,12],[4,30],[22,49],[30,65],[31,85],[27,108],[38,125],[33,151],[50,151]]){walkTo(sim,x,z,'mushroom-grove');assert(p.mounted,'must remain flying past the old recovery limit');}
 assert(p.x>44&&p.z>140);assert.deepEqual({x:p.safeX,z:p.safeZ},launch,'air travel cannot silently move the last safe landing');
 drive(sim,role,5,{x:0,z:0,actions:['mount']});assert(p.grounded&&!p.mounted);assert(p.x>44&&p.z>140);
 const restored=new Simulation(undefined,{mode:'exploration',exploration:sim.exportExploration()});assert(restored.state.players[role].x>44&&restored.state.players[role].z>140);
});
test('flight from a mushroom crown can descend more than five metres and land below its takeoff height',()=>{
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold','mushroom-grove')}),world=createRegionMovementWorld('mushroom-grove'),m=MUSHROOM_CAPS[0];
 const top=world.surfaceAt(m.x,m.z,30,.66)!;place(sim,'gold',m.x,m.z,top.y);const p=sim.state.players.gold;
 drive(sim,'gold',2,{x:1,z:0,actions:['mount']});assert(p.mounted);assert(p.x>m.x+m.cap+1);const landingX=p.x;
 drive(sim,'gold',6,{x:0,z:0,actions:['mount']});assert(p.grounded&&!p.mounted);assert(Math.abs(p.x-landingX)<4,'landing must not teleport to the crown safe point');assert(p.y<top.y-8);assert(world.isSafe!(p.x,p.z,p.y,.66));
});
for(const role of ['gold','white']as const)test(`${role}: broom accelerates, ascends, hovers, caps height, lands and leaves old controls intact`,()=>{
 const sim=new Simulation(undefined,{mode:'exploration',role});sim.state.enemies=[];sim.setMovementWorld(flat);place(sim,role,0,0);const p=sim.state.players[role];
 drive(sim,role,.2,{x:1,z:0,actions:['mount'],lift:1});assert(p.mounted&&!p.grounded&&p.y>0&&p.vx>1&&p.vx<8.2);assert.equal(p.invincible,0);
 drive(sim,role,1,{x:0,z:0,actions:[],lift:1});const y=p.y;assert(y>3);
 drive(sim,role,1,{x:0,z:0,actions:[]});const hover=p.y;drive(sim,role,1,{x:0,z:0,actions:[]});assert.equal(p.y,hover);assert(p.y>=y);
 drive(sim,role,8,{x:0,z:0,actions:[],lift:1});assert.equal(p.y,24);assert.equal(p.vy,0);
 const hp=p.hp;drive(sim,role,.1,{x:0,z:0,actions:['attack','skill1','dodge','jump']});assert.equal(p.action,'fly');assert.equal(p.hp,hp);assert.equal(p.invincible,0);
 drive(sim,role,9,{x:0,z:0,actions:['mount']});assert(p.grounded&&!p.mounted&&p.flight==='grounded');assert.equal(p.y,0);
 drive(sim,role,.12,{x:0,z:0,actions:['jump']});assert(!p.grounded&&!p.mounted&&p.y>0);
});
test('flight sweeps walls and ceilings; interior blocks mounting and giant caps stop upward passage',()=>{
 const sim=new Simulation(undefined,{mode:'exploration'});sim.state.enemies=[];sim.setMovementWorld({...flat,ceilingAt:()=>4,resolveAt:(x,z,y,r)=>x>3-r?{x:3-r,z}:{x,z}});place(sim,'gold',0,0);
 drive(sim,'gold',2,{x:1,z:0,actions:['mount'],lift:1});const p=sim.state.players.gold;assert(p.x<=2.34+.001);assert(p.y<=4-PLAYER_HEIGHT+.001);
 sim.setExplorationRegion('mushroom-home');drive(sim,'gold',1,{x:0,z:0,actions:['mount'],lift:1});assert(!sim.state.players.gold.mounted);assert.equal(sim.state.players.gold.y,0);
 const world=createRegionMovementWorld('mushroom-grove'),m=GIANT_MUSHROOMS[0],base=regionGroundHeight('mushroom-grove',m.x,m.z);assert(world.ceilingAt!(m.x+3,m.z,base+2,.66)!>base+2);assert(world.ceilingAt!(m.x+3,m.z,base+2,.66)!<base+m.h);
});
test('normal exploration walks and flies connected regions, while map destinations are open immediately',()=>{
 const initial=createExplorationSave('gold','mushroom-grove');const sim=new Simulation(undefined,{mode:'exploration',exploration:initial});
 assert.equal(sim.requestTravel('gold','canopy-garden','map'),true);
 assert.equal(sim.requestTravel('gold','mushroom-grove','map'),true);
 for(const [x,z]of [[-5,12],[4,30],[24,36],[29,36]])walkTo(sim,x,z,'mushroom-grove');
 assert.equal(sim.state.regionId,'canopy-garden');assert(sim.state.discoveredRegions.includes('mushroom-grove'));
 assert(sim.requestTravel('gold','mushroom-grove','map'));assert.equal(sim.state.regionId,'mushroom-grove');
 drive(sim,'gold',2,{x:0,z:0,actions:['mount'],lift:1});
 for(const [x,z]of [[-5,12],[4,30],[24,36],[29,36]])walkTo(sim,x,z,'mushroom-grove');
 assert.equal(sim.state.regionId,'canopy-garden');assert(sim.state.players.gold.grounded,'region transition ends at the advertised outdoor safe landing');
 assert(sim.requestTravel('gold','mushroom-grove','map'));assert.equal(sim.state.regionId,'mushroom-grove');
});
test('treehouse stairs are continuously walkable to the platform, door entry, indoor visit and return',()=>{
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('white','canopy-garden')});
 for(const[x,z]of [[-5.5,8],[-5.5,24.5],[.5,24.5],[.5,39],[0,42]])walkTo(sim,x,z);
 assert(Math.abs(sim.state.players.white.y-8)<.01);assert(sim.requestTravel('white','canopy-home','walk'));assert.equal(sim.state.regionId,'canopy-home');
 walkTo(sim,-1.5,3);walkTo(sim,-1.5,6);walkTo(sim,-1.5,3);walkTo(sim,0,-3.5);assert(sim.requestTravel('white','canopy-garden','walk'));assert.equal(sim.state.regionId,'canopy-garden');assert.equal(sim.state.players.white.y,8);
});
test('formal region proposal requires the other partner, supports cancel, refuses battle and never unlocks a future story chapter',()=>{
 const sim=new Simulation();sim.state.enemies=[];const gate=regionConnections(sim.state.regionId).find(c=>c.to==='mushroom-grove')!;place(sim,'gold',gate.x,gate.z);place(sim,'white',0,0);
 assert(!sim.requestTravel('gold',CHAPTERS[1].id,'map'));assert(!sim.requestTravel('gold','mushroom-grove','map'));
 assert(sim.requestTravel('gold','mushroom-grove','walk'));assert.equal(sim.state.regionId,CHAPTERS[0].id);assert(!sim.respondTravel('gold',true));assert(sim.respondTravel('white',false));assert(!sim.state.travel);
 assert(sim.requestTravel('gold','mushroom-grove','walk'));sim.state.players.white.action='attack';assert(!sim.respondTravel('white',true));assert.equal(sim.state.regionId,CHAPTERS[0].id);sim.state.players.white.action='idle';assert(sim.respondTravel('white',true));assert.equal(sim.state.regionId,'mushroom-grove');
 assert.deepEqual(sim.save.completedChapters,[]);assert(!sim.requestTravel('gold',CHAPTERS[6].id,'map'));
});
test('visiting and cold recovering new regions preserves original enemies, exact rewards, discovered places and broom ownership',()=>{
 const base=freshSave('v6-region-recovery'),sim=new Simulation(base);const original=sim.state.enemies[0];original.hp=0;original.state='dead';sim.state.flags.push('v-secret-orchard-lookout');sim.save.secrets.push('v-secret-orchard-lookout');sim.save.players.gold.unlockedSkills.push('shield');sim.state.broomOwned=true;
 const gate=regionConnections(sim.state.regionId).find(c=>c.to==='mushroom-grove')!;place(sim,'gold',gate.x,gate.z);assert(sim.requestTravel('gold','mushroom-grove','walk'));assert(sim.respondTravel('white',true));
 const live=sim.exportLiveSnapshot();validateSnapshotShape(live);const recovered=prepareAdventureRecovery(base,live);validateSave(recovered);const restored=new Simulation(recovered);assert(restored.state.broomOwned);assert(restored.state.discoveredRegions.includes('mushroom-grove'));assert(restored.save.players.gold.unlockedSkills.includes('shield'));
 assert(restored.requestTravel('gold',CHAPTERS[0].id,'map'));assert(restored.respondTravel('white',true));assert.equal(restored.state.enemies.find(e=>e.id===original.id)!.hp,0);assert(restored.state.flags.includes('v-secret-orchard-lookout'));assert.equal(restored.save.secrets.filter(id=>id==='v-secret-orchard-lookout').length,1);
 assert(JSON.stringify(restored.exportSave()).length<25000);
});
test('flight snapshots preserve active height but persistence/pause restore a legal safe point with no held flight command',()=>{
 const sim=new Simulation();sim.state.enemies=[];sim.setMovementWorld(flat);place(sim,'gold',0,0);sim.state.broomOwned=true;drive(sim,'gold',1,{x:1,z:0,actions:['mount'],lift:1});
 const live=sim.exportLiveSnapshot(),stored=sim.exportSave(),active=live.players.gold;assert(active.mounted&&active.y>1&&active.vx>1);const guest=new Simulation();guest.setMovementWorld(flat);guest.restoreSnapshot(live);assert.equal(guest.state.players.gold.y,active.y);assert(guest.state.players.gold.mounted);
 const persisted=(stored.world.snapshot as any).players.gold;assert(!persisted.mounted&&persisted.grounded&&persisted.vy===0);assert.equal(persisted.x,active.safeX);
 const paused=resetSnapshotMovement(live);assert(!paused.players.gold.mounted&&paused.players.gold.grounded);assert.equal(paused.players.gold.y,active.safeY);
 const bad=structuredClone(live);bad.players.gold.vx=NaN;assert.throws(()=>validateSnapshotShape(bad),/飞行速度/);
});
test('an old save acquires no invented story rewards and later-chapter players inherit the broom without replaying early content',()=>{
 const old=freshSave('v6-old');old.chapterId=CHAPTERS[3].id;old.completedChapters=CHAPTERS.slice(0,3).map(c=>c.id);old.world.futureMetadata={kept:true};const sim=new Simulation(old);assert(sim.state.broomOwned);const restored=sim.exportSave();assert.deepEqual(restored.world.futureMetadata,{kept:true});assert.deepEqual(restored.players,old.players);assert.deepEqual(restored.secrets,old.secrets);
 for(const r of REGIONS)assert.equal(getRegionChapter(r.id).id,r.chapterId);
});
test('visiting a new region or an earlier chapter preserves the third-chapter continuation pointer and never settles an old chapter twice',()=>{
 const source=freshSave('v6-story-pointer');source.chapterId=CHAPTERS[2].id;source.completedChapters=CHAPTERS.slice(0,2).map(c=>c.id);source.world.regionProgress={discoveredRegions:[CHAPTERS[0].id,CHAPTERS[2].id,'mushroom-grove','mushroom-home'],broomOwned:true};
 const sim=new Simulation(source);sim.state.enemies=[];assert(sim.requestTravel('gold','mushroom-home','map'));assert(sim.respondTravel('white',true));assert.equal(sim.state.chapterId,CHAPTERS[2].id);assert.equal(sim.save.chapterId,CHAPTERS[2].id);assert.equal(sim.chapter.id,CHAPTERS[0].id);
 const stored=sim.exportSave();assert.equal(stored.chapterId,CHAPTERS[2].id);validateSave(stored);const recovered=new Simulation(prepareAdventureRecovery(source,sim.exportLiveSnapshot()));assert.equal(recovered.state.regionId,'mushroom-home');assert.equal(recovered.state.chapterId,CHAPTERS[2].id);
 assert(recovered.requestTravel('gold',CHAPTERS[0].id,'map'));assert(recovered.respondTravel('white',true));recovered.state.enemies=[];recovered.state.flags=[...recovered.chapter.quest.steps,recovered.chapter.event.id];for(const role of ['gold','white']as const)place(recovered,role,recovered.chapter.exit.x+(role==='gold'?-1:1),recovered.chapter.exit.z);recovered.setMovementWorld(flat);recovered.tick(.05);assert.equal(recovered.state.chapterId,CHAPTERS[2].id);assert.equal(recovered.save.chapterId,CHAPTERS[2].id);assert.deepEqual(recovered.save.completedChapters,source.completedChapters);
});
test('completed ending can visit and restore both indoor regions without resetting completion',()=>{
 const source=freshSave('v6-after-ending');source.chapterId=CHAPTERS[6].id;source.completedChapters=CHAPTERS.map(c=>c.id);source.world.regionProgress={discoveredRegions:REGIONS.map(r=>r.id),broomOwned:true};const sim=new Simulation(source);sim.state.enemies=[];sim.state.ended=true;
 for(const region of ['mushroom-home','canopy-home']){assert(sim.requestTravel('gold',region,'map'));assert(sim.respondTravel('white',true));const saved=sim.exportSave(),restored=new Simulation(saved);assert.equal(saved.chapterId,CHAPTERS[6].id);assert.equal(restored.state.regionId,region);assert.deepEqual(restored.save.completedChapters,source.completedChapters);}
});
test('pending invitations expire, cancel on full-room pause, and recover neither an airborne dog nor an unaccepted transition',()=>{
 const sim=new Simulation();sim.state.enemies=[];sim.setMovementWorld(flat);sim.state.broomOwned=true;sim.state.discoveredRegions.push('mushroom-grove');place(sim,'gold',0,0);drive(sim,'gold',1,{x:0,z:0,actions:['mount'],lift:1});assert(sim.requestTravel('gold','mushroom-grove','map'));
 const saved=sim.exportSave(),paused=resetSnapshotMovement(sim.exportLiveSnapshot());assert(!paused.travel);assert(!(saved.world.snapshot as any).travel);assert(!(saved.world.snapshot as any).players.gold.mounted);assert.equal((saved.world.snapshot as any).regionId,CHAPTERS[0].id);
 sim.resetMovement(true);assert(!sim.state.travel);assert(!sim.state.players.gold.mounted);assert(!sim.respondTravel('white',true));
 assert(sim.requestTravel('gold','mushroom-grove','map'));drive(sim,'gold',30.5,{x:0,z:0,actions:[]});assert(!sim.state.travel);assert.equal(sim.state.regionId,CHAPTERS[0].id);
});
test('an old scene checkpoint and a newer regional packet merge only the matching regions, never placing story flags into an interior',()=>{
 const source=freshSave('v6-region-packets');source.chapterId=CHAPTERS[2].id;source.completedChapters=CHAPTERS.slice(0,2).map(c=>c.id);const host=new Simulation(source);host.state.enemies=[];host.state.flags=['f-story-proof'];host.state.discoveredRegions.push('mushroom-home');const durable=host.exportSave();
 assert(host.requestTravel('gold','mushroom-home','map'));assert(host.respondTravel('white',true));host.state.flags.push('mushroom-home-memory');const recovered=new Simulation(prepareAdventureRecovery(durable,host.exportLiveSnapshot()));
 assert.deepEqual(recovered.state.flags,['mushroom-home-memory']);assert(recovered.state.regionArchive[CHAPTERS[2].id].flags.includes('f-story-proof'));assert.equal(recovered.save.chapterId,CHAPTERS[2].id);
 const bad=structuredClone(durable);(bad.world.snapshot as any).regionId=CHAPTERS[6].id;assert.throws(()=>new Simulation(bad),/尚未由故事解锁/);
});
test('opening a modal clears only held flight controls without moving the proposer away from a live boundary',()=>{
 const sim=new Simulation();sim.state.enemies=[];sim.state.broomOwned=true;const gate=regionConnections(sim.state.regionId).find(c=>c.to==='mushroom-grove')!;place(sim,'gold',gate.x,gate.z);Object.assign(sim.state.players.gold,{mounted:true,flight:'flying',grounded:false,y:5,vy:2,vx:3,vz:2,safeX:0,safeZ:-11,safeY:0});
 assert(sim.requestTravel('gold','mushroom-grove','fly'));sim.resetMovement(false,'gold');const p=sim.state.players.gold;assert.equal(p.x,gate.x);assert.equal(p.z,gate.z);assert.equal(p.y,5);assert(p.mounted&&!p.grounded);assert.equal(p.vx,0);assert.equal(p.vy,0);assert(sim.state.travel);assert(sim.respondTravel('white',true));assert.equal(sim.state.regionId,'mushroom-grove');
});
test('a battle-rejected boundary retries in place after combat, while an explicit cancellation stays dismissed until leaving the boundary',()=>{
 const sim=new Simulation();sim.setMovementWorld(flat);const gate=regionConnections(sim.state.regionId).find(c=>c.to==='mushroom-grove')!;place(sim,'gold',gate.x,gate.z);place(sim,'white',0,0);
 const enemy=sim.state.enemies[0];Object.assign(enemy,{x:gate.x+5,z:gate.z,state:'chase'});sim.state.enemies=[enemy];sim.tick(.02);assert.equal(sim.state.travel,undefined);
 sim.state.enemies=[];drive(sim,'gold',3.1,{x:0,z:0,actions:[]});assert.equal(sim.exportLiveSnapshot().travel?.to,'mushroom-grove');assert.equal(sim.state.players.gold.x,gate.x);
 assert(sim.respondTravel('white',false));drive(sim,'gold',5,{x:0,z:0,actions:[]});assert.equal(sim.state.travel,undefined,'a consciously dismissed proposal must not reopen while standing still');
 place(sim,'gold',gate.x+5,gate.z);sim.tick(.02);place(sim,'gold',gate.x,gate.z);sim.tick(.02);assert.equal(sim.exportLiveSnapshot().travel?.to,'mushroom-grove');
});
for(const mode of ['exploration','adventure']as const)for(const outside of ['mushroom-grove','canopy-garden'])test(`${mode}: real interact command enters and leaves ${outside} at its authored doorway height, not a roof`,()=>{
 const indoor=outside==='mushroom-grove'?'mushroom-home':'canopy-home',source=freshSave('door-height-'+mode+'-'+outside);
 source.world.regionProgress={discoveredRegions:[CHAPTERS[0].id,outside],broomOwned:true};
 const sim=mode==='exploration'?new Simulation(undefined,{mode,exploration:createExplorationSave('gold',outside)}):new Simulation(source);
 if(mode==='adventure'){sim.state.enemies=[];assert(sim.requestTravel('gold',outside,'map'));assert(sim.respondTravel('white',true));}
 const waypoints=outside==='mushroom-grove'?[[-5,12],[4,30],[0,58]]:[[-5.5,8],[-5.5,24.5],[.5,24.5],[.5,39],[0,42]];
 for(const[x,z]of waypoints)walkTo(sim,x,z);
 const door=regionConnections(outside).find(c=>c.to===indoor)!,ground=door.y??regionGroundHeight(outside,door.x,door.z);
 assert(Math.abs(sim.state.players.gold.y-ground)<.3);assert(sim.state.players.gold.grounded);
 if(outside==='mushroom-grove')assert(createRegionMovementWorld(outside).surfaceAt(door.x,door.z,1e4,.66)!.y>ground+5,'the fixture must include the roof that previously masked the ground doorway');
 sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.02);
 if(mode==='adventure'){assert.equal(sim.state.travel?.to,indoor);sim.command('white',{x:0,z:0,actions:[],travelResponse:'accept'});sim.tick(.02);}
 assert.equal(sim.state.regionId,indoor);assert.equal(sim.state.players.gold.y,0);
 sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.02);
 if(mode==='adventure'){assert.equal(sim.state.travel?.to,outside);sim.command('white',{x:0,z:0,actions:[],travelResponse:'accept'});sim.tick(.02);}
 assert.equal(sim.state.regionId,outside);if(outside==='canopy-garden')assert.equal(sim.state.players.gold.y,8);else assert(sim.state.players.gold.y<1);
});
for(const mode of ['exploration','adventure']as const)test(`${mode}: elevated reading and treehouse door use the same reachable nearest target for the prompt and E`,()=>{
 const source=freshSave('regional-surface-'+mode);source.world.regionProgress={discoveredRegions:[CHAPTERS[0].id,'canopy-garden'],broomOwned:true};
 const sim=mode==='exploration'?new Simulation(undefined,{mode,exploration:createExplorationSave('gold','canopy-garden')}):new Simulation(source);
 if(mode==='adventure'){sim.state.enemies=[];assert(sim.requestTravel('gold','canopy-garden','map'));assert(sim.respondTravel('white',true));}
 const memory=sim.chapter.interactions.find(i=>i.id==='canopy-garden-memory')!,door=regionConnections('canopy-garden').find(c=>c.to==='canopy-home')!;
 assert.equal(memory.surfaceId,'canopy-platform');
 for(const point of [memory,door]){
  place(sim,'gold',point.x,point.z,regionGroundHeight('canopy-garden',point.x,point.z));
  assert.equal(sim.nearby('gold'),'','the ground below an elevated target must not show an E prompt');
  sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.02);assert(!sim.state.flags.includes(memory.id));assert(!sim.state.travel);assert.equal(sim.state.regionId,'canopy-garden');
 }
 // This point is in both radii: the unread wind-chime is nearer than the door.
 place(sim,'gold',-2.5,40.5,8);assert(sim.nearby('gold').includes('低音风铃'));
 sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.02);assert(sim.state.flags.includes(memory.id));assert.equal(sim.state.regionId,'canopy-garden');assert(!sim.state.travel);
 assert.equal(sim.state.flags.filter(id=>id===memory.id).length,1);assert.deepEqual(sim.save.secrets,source.secrets);assert.deepEqual(sim.save.completedChapters,source.completedChapters);
 assert(sim.nearby('gold').startsWith('前往 · '),'the found reading must no longer mask the next valid target');
 sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.02);
 if(mode==='adventure'){assert.equal(sim.exportLiveSnapshot().travel?.to,'canopy-home');assert(sim.respondTravel('white',true));}
 assert.equal(sim.state.regionId,'canopy-home');
});
test('revisiting a completed resident gives the current reunion reply without another reward, flag or checkpoint',()=>{
 const sim=new Simulation(freshSave('resident-reunion'));sim.setMovementWorld(flat);sim.state.enemies=[];sim.state.flags.push(sim.chapter.event.id);
 const [post,bag,home]=sim.chapter.quest.side.steps.map(id=>sim.chapter.interactions.find(i=>i.id===id)!);
 const talk=(item:typeof post)=>{place(sim,'gold',item.x,item.z);sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.02);};
 talk(post);const firstReply=residentReply(post,sim.chapter,sim.state.flags);talk(post);assert.equal(sim.state.events.at(-1)?.type,'dialogue');assert.equal(sim.state.events.at(-1)?.text,firstReply);
 talk(bag);talk(post);assert.notEqual(sim.state.events.at(-1)?.text,firstReply,'the same resident follows the recovered parcel');
 talk(home);assert(sim.state.flags.includes(sim.chapter.quest.side.id));assert(sim.save.players.gold.unlockedSkins.includes('forest'));
 const before=structuredClone({players:sim.save.players,quests:sim.save.quests,flags:sim.state.flags,checkpoint:sim.state.checkpoint,checkpointId:sim.save.checkpointId,secrets:sim.save.secrets});
 sim.state.events=[];sim.dirty=false;
 for(let i=0;i<3;i++){talk(home);assert.equal(sim.nearby('gold'),'和这位居民再说几句');assert.equal(sim.state.players.gold.action,'interact');}
 talk(post);assert.equal(sim.state.events.at(-1)?.text,residentReply(post,sim.chapter,sim.state.flags));
 assert(sim.state.events.every(e=>e.type==='dialogue'));assert.equal(sim.dirty,false);
 assert.deepEqual({players:sim.save.players,quests:sim.save.quests,flags:sim.state.flags,checkpoint:sim.state.checkpoint,checkpointId:sim.save.checkpointId,secrets:sim.save.secrets},before);
 const preview=new Simulation(undefined,{mode:'exploration'});preview.setMovementWorld(flat);preview.state.flags.push(post.id);place(preview,'gold',post.x,post.z);const original=structuredClone(preview.save);preview.command('gold',{x:0,z:0,actions:['interact']});preview.tick(.02);assert.equal(preview.state.events.at(-1)?.type,'dialogue');assert.deepEqual(preview.save,original,'exploration conversations never write official rewards');
});
test('the treehouse roof is a true two-slope landing surface with clear eave air, solid sides and its actual underside',()=>{
 const world=createRegionMovementWorld('canopy-garden'),roof=CANOPY_ROOF,r=.66;
 assert.equal(canopyRoofHeight(0,48),14);assert.equal(canopyRoofHeight(roof.halfWidth,48),12.1);assert.equal(canopyRoofHeight(-roof.halfWidth,48),12.1);assert.equal(canopyRoofHeight(4.26,48),null);
 for(const x of [-4,-2,0,2,4]){const top=canopyRoofHeight(x,48)!,s=world.surfaceAt(x,48,20,r)!;assert.equal(s.y,top);assert.equal(s.id,roof.surfaceId);assert(s.normalY!>.9&&s.normalY!<1);assert(world.isSafe!(x,48,top,r));assert.deepEqual(world.resolveAt(x,48,top,r,PLAYER_HEIGHT),{x,z:48});}
 assert.deepEqual(world.resolveAt(3.6,48,13,r,PLAYER_HEIGHT),{x:3.6,z:48},'air above the eaves cannot retain the old 14m box');
 assert.notDeepEqual(world.resolveAt(3.4,48,9,r,PLAYER_HEIGHT),{x:3.4,z:48},'the cabin side wall remains solid');
 assert.notDeepEqual(world.resolveAt(0,43.8,12,r,PLAYER_HEIGHT),{x:0,z:43.8},'the gable-end roof slab remains solid');
 const expectedLow=canopyRoofHeight(2+r,44)!-roof.thickness;assert(Math.abs(world.ceilingAt!(2,44,9,r)!-expectedLow)<1e-9,'ceiling uses the lowest underside across the player radius');
 for(const [x,z]of [[0,44],[2,44],[-4,44],[0,roof.minZ]])assert(Math.abs(world.ceilingAt!(x,z,9,0)!-(canopyRoofHeight(x,z)!-roof.thickness))<1e-9,'a zero-radius vertical ray still finds the roof underside, including its closed front edge');
 assert.equal(world.ceilingAt!(-4.8,43.1,9,r),null,'a body outside the clear roof corner has no invisible overhead slab (the opposite corner now has an authored tree branch above it)');
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold','canopy-garden')});
 // z=50 starts in clear air; the previous z=48 fixture intersected the newly authored upper branch.
 place(sim,'gold',-2.5,50,8);Object.assign(sim.state.players.gold,{y:18,safeX:0,safeZ:39,safeY:8,mounted:true,grounded:false,flight:'landing'});
 drive(sim,'gold',3,{x:0,z:0,actions:[]});assert(sim.state.players.gold.grounded&&!sim.state.players.gold.mounted);assert.equal(sim.state.players.gold.y,canopyRoofHeight(-2.5,50));
 walkTo(sim,0,50);assert(sim.state.players.gold.y>13.94);walkTo(sim,2.5,50);assert(Math.abs(sim.state.players.gold.y-canopyRoofHeight(sim.state.players.gold.x,50)!)<1e-9);assert.equal(sim.state.players.gold.safeY,sim.state.players.gold.y);
 // The overhanging front slope is reachable from outside; ordinary lift must stop below it.
 place(sim,'gold',2,43.7,8);drive(sim,'gold',2,{x:0,z:0,actions:['mount'],lift:1});const p=sim.state.players.gold;assert(p.mounted);assert(p.y+PLAYER_HEIGHT<=world.ceilingAt!(p.x,p.z,8,r)!+.001);
});
