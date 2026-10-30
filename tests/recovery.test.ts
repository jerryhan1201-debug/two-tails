import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAdventureRecovery } from '../src/recovery';
import { Simulation } from '../src/simulation';
import { CHAPTERS } from '../src/content';
import { freshSave } from '../shared/save';
import { createChapterMovementWorld } from '../src/world-surfaces';
import { validateSnapshotShape } from '../shared/snapshot';

test('cold welcome accepts a later chapter scene without dropping durable unlocks or mutating its source', () => {
  const durable = freshSave('a_cold_recovery');
  durable.players.gold.unlockedSkills.push('shield');
  durable.players.white.unlockedSkins.push('moon');
  durable.quests['v-lamp-market'] = true;
  durable.world.keptMetadata = 'preserve';
  const liveSave = freshSave(durable.adventureId); liveSave.chapterId = CHAPTERS[1].id;
  const live = new Simulation(liveSave); live.state.flags = ['r-plate-east'];
  const original = structuredClone(durable);
  const recovered = new Simulation(prepareAdventureRecovery(durable, live.state));
  assert.equal(recovered.chapter.id, CHAPTERS[1].id);
  assert.deepEqual(recovered.state.flags, ['r-plate-east']);
  assert(recovered.save.players.gold.unlockedSkills.includes('shield'));
  assert(recovered.save.players.white.unlockedSkins.includes('moon'));
  assert.equal(recovered.save.quests['v-lamp-market'], true);
  assert.equal(recovered.save.world.keptMetadata, 'preserve');
  assert.deepEqual(durable, original);
});

test('hot host rebuild preserves newer earned progress instead of replaying an older relay snapshot', () => {
  const server = freshSave('a_hot_recovery'); server.revision = 4;
  const previous = new Simulation(server); previous.state.flags = ['v-lamp-market'];
  const currentSave = structuredClone(server); currentSave.chapterId = CHAPTERS[1].id;
  currentSave.completedChapters = [CHAPTERS[0].id]; currentSave.players.gold.unlockedSkills.push('shield');
  const current = new Simulation(currentSave); current.state.flags = ['r-plate-east'];
  current.save.quests['r-plate-east'] = true;
  const p = current.state.players.gold;
  p.y += .8; p.vy = 2; p.grounded = false; p.sprinting = true;
  const safeExport = current.exportSave(); safeExport.revision = 3;
  const recovered = new Simulation(prepareAdventureRecovery(server, previous.state, safeExport));
  assert.equal(recovered.save.revision, 4);
  assert.equal(recovered.chapter.id, CHAPTERS[1].id);
  assert.deepEqual(recovered.state.flags, ['r-plate-east']);
  assert(recovered.save.completedChapters.includes(CHAPTERS[0].id));
  assert(recovered.save.players.gold.unlockedSkills.includes('shield'));
  assert.equal(recovered.save.quests['r-plate-east'], true);
  assert.equal(recovered.state.players.gold.grounded, true);
  assert.equal(recovered.state.players.gold.vy, 0);
  assert.equal(recovered.state.players.gold.sprinting, false);
  assert.equal(safeExport.revision, 3);
});

test('cold host reload between a real secret interaction and its checkpoint retains the reward exactly once', () => {
  const durable = freshSave('a_unsaved_reward'); durable.world.keptMetadata = 'preserve';
  const host = new Simulation(durable), secret = host.chapter.secrets.find(it=>it.id==='v-secret-orchard-lookout')!;
  host.state.enemies = [];
  Object.assign(host.state.players.gold,{x:secret.x,z:secret.z,y:host.chapter.terrain.platforms!.find(p=>p.id===secret.surfaceId)!.height,grounded:true});
  host.setMovementWorld(createChapterMovementWorld(host.chapter,()=>host.state.flags));
  host.command('gold',{x:0,z:0,actions:['interact']}); host.tick(.01);
  assert(host.state.flags.includes(secret.id)); assert(host.save.players.gold.unlockedSkills.includes('shield'));
  const live = host.exportLiveSnapshot(), recovered = new Simulation(prepareAdventureRecovery(durable,live));
  assert.equal(recovered.save.revision,durable.revision);
  assert(recovered.save.secrets.includes(secret.id)); assert.equal(recovered.save.quests[secret.id],true);
  for(const role of ['gold','white'] as const) assert(recovered.save.players[role].unlockedSkills.includes('shield'));
  assert.equal(recovered.save.world.keptMetadata,'preserve');
  const before = recovered.state.events.filter(e=>e.type==='unlock').length;
  recovered.command('gold',{x:0,z:0,actions:['interact']}); recovered.tick(.01);
  assert.equal(recovered.save.secrets.filter(id=>id===secret.id).length,1);
  assert.equal(recovered.state.events.filter(e=>e.type==='unlock').length,before);
  assert.deepEqual(durable.secrets,[]); assert(!durable.players.gold.unlockedSkills.includes('shield'));
});

test('cold chapter-transition recovery preserves completed chapters and awards without recursive progress growth', () => {
  const durable = freshSave('a_unsaved_transition'), host = new Simulation(durable);
  host.state.enemies = []; host.state.flags = [...host.chapter.quest.steps,host.chapter.event.id];
  for(const [i,role] of (['gold','white'] as const).entries()) Object.assign(host.state.players[role],{x:host.chapter.exit.x+i*1.5,z:host.chapter.exit.z,grounded:true});
  host.setMovementWorld(createChapterMovementWorld(host.chapter,()=>host.state.flags)); host.tick(.01);
  assert.equal(host.chapter.id,CHAPTERS[1].id);
  let recovered = prepareAdventureRecovery(durable,host.exportLiveSnapshot());
  const firstSize = JSON.stringify(recovered).length;
  for(let i=0;i<20;i++) {
    const sim = new Simulation(recovered);
    const live = sim.exportLiveSnapshot(); validateSnapshotShape(live);
    assert(live.progress!.completedChapters.includes(CHAPTERS[0].id));
    assert(live.progress!.players.gold.unlockedSkills.includes('nova'));
    assert(!('world' in live.progress!)); assert(!('credentials' in live.progress!));
    recovered = prepareAdventureRecovery(sim.exportSave(),live);
    assert(!('progress' in (recovered.world.snapshot as any)));
  }
  assert(JSON.stringify(recovered).length < firstSize+200,'repeated reconnect must not nest save/snapshot copies');
});

test('live progress cannot erase confirmed unlocks or smuggle credentials, nested saves or another adventure', () => {
  const durable = freshSave('a_progress_bounds'); durable.players.gold.unlockedSkills.push('shield');durable.secrets.push('confirmed-secret');
  const live = new Simulation(freshSave(durable.adventureId)).exportLiveSnapshot();
  const recovered = prepareAdventureRecovery(durable,live);
  assert(recovered.players.gold.unlockedSkills.includes('shield'));assert(recovered.secrets.includes('confirmed-secret'));
  for(const mutate of [
    (s:any)=>s.progress.world={snapshot:s},
    (s:any)=>s.progress.credentials={recoveryToken:'private'},
    (s:any)=>s.progress.players.gold.unlockedSkills=[null],
    (s:any)=>s.progress.quests.bad=Infinity,
    (s:any)=>s.progress.chapterId='ch02',
  ]) {const bad=structuredClone(live);mutate(bad);assert.throws(()=>validateSnapshotShape(bad));}
  live.progress!.adventureId='another-adventure';
  assert.throws(()=>prepareAdventureRecovery(durable,live),/不属于/);
});
