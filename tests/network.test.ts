import {PROTOCOL_VERSION} from '../shared/protocol';
import test from "node:test";
import { Simulation } from "../src/simulation";
import { prepareAdventureRecovery } from '../src/recovery';
import assert from "node:assert/strict";
import {
  RoomHub,
  type Peer,
  type Store,
  type StoredAdventure,
  type StoredRoom,
} from "../server/core";
import { freshSave, type AdventureSave } from "../shared/save";
class MemoryStore implements Store {
  saves = new Map<string, StoredAdventure>();
  rooms: StoredRoom[] = [];
  fail = false;
  async load(id: string) {
    return structuredClone(this.saves.get(id) || null);
  }
  async save(id: string, value: StoredAdventure) {
    if (this.fail) throw new Error("disk full");
    this.saves.set(id, structuredClone(value));
  }
  async loadRooms() {
    return structuredClone(this.rooms);
  }
  async saveRooms(rooms: StoredRoom[]) {
    this.rooms = structuredClone(rooms);
  }
}
class MockPeer implements Peer {
  messages: any[] = [];
  closed = false;
  send(s: string) {
    this.messages.push(JSON.parse(s));
  }
  close() {
    this.closed = true;
  }
  last(kind: string) {
    return this.messages.filter((m) => m.kind === kind).at(-1)?.payload;
  }
}
const hostToken = "a".repeat(64),
  guestToken = "b".repeat(64),
  thirdToken = "c".repeat(64);
async function setup(start = true,mode: 'adventure'|'coop-exploration'='adventure') {
  const store = new MemoryStore();
  const hub = new RoomHub(store);
  await hub.init();
  const created = await hub.create(hostToken,undefined,mode);
  await hub.join(created.room.code, guestToken);
  const h = new MockPeer(),
    g = new MockPeer();
  const hs = hub.connect(created.room.code, h),
    gs = hub.connect(created.room.code, g);
  let hi = 0,
    gi = 0;
  const sendH = (kind: string, payload: unknown = {}, seq?: number) =>
    hub.receive(hs, JSON.stringify({ v: PROTOCOL_VERSION, seq: seq ?? hi++, kind, payload }));
  const sendG = (kind: string, payload: unknown = {}, seq?: number) =>
    hub.receive(gs, JSON.stringify({ v: PROTOCOL_VERSION, seq: seq ?? gi++, kind, payload }));
  await sendH("hello", { clientToken: hostToken });
  await sendG("hello", { clientToken: guestToken });
  if (start) {
    await sendH("ready", { ready: true });
    await sendG("ready", { ready: true });
    await sendH("start");
  }
  return { hub, store, created, h, g, hs, gs, sendH, sendG };
}
test("room requires two unique roles, ready players and host start; third player denied", async () => {
  const t = await setup(false);
  await assert.rejects(t.hub.join(t.created.room.code, thirdToken), /两位/);
  await t.sendH("start");
  assert.equal(t.h.last("error").code, "NOT_READY");
  await t.sendG("role", { role: "gold" });
  assert.equal(t.g.last("error").code, "ROLE_TAKEN");
  await t.sendG("start");
  assert.equal(t.g.last("error").code, "HOST_ONLY");
  await t.sendH("ready", { ready: true });
  await t.sendG("ready", { ready: true });
  await t.sendH("start");
  assert.equal(t.g.last("room").started, true);
  assert.equal(t.g.last("room").players[1].role, "white");
});
test('expanded live limits and authenticated carrier control use the existing room authority',async()=>{
 const t=await setup(true,'coop-exploration'),sim=new Simulation(t.created.save);
 sim.state.enemies=[];
 const w=sim.state.players.white,g=sim.state.players.gold;
 Object.assign(w,{x:0,y:0,z:-10,safeX:0,safeY:0,safeZ:-10,grounded:true});Object.assign(g,{x:2,y:0,z:-10,safeX:2,safeY:0,safeZ:-10,grounded:true});
 sim.command('gold',{x:0,z:0,actions:[],duo:{kind:'invite',type:'ride'}});sim.command('white',{x:0,z:0,actions:[],duo:{kind:'accept',id:sim.state.duo!.id}});
 await t.sendH('snapshot',{snapshot:sim.exportLiveSnapshot()});
 await t.sendG('input',{input:{x:1,z:1,sprint:true,lift:1,actions:[]}});const input=t.h.last('input');assert.equal(input.role,'white');assert.equal(input.input.x,0);assert.equal(input.input.z,0);assert.equal(input.input.lift,0);
 sim.requestTravel('gold','player-home-villa');sim.respondTravel('white',true);const live=sim.exportLiveSnapshot();delete live.duo;Object.assign(live.players.gold,{x:-80,z:-60,safeX:-80,safeZ:-60});await t.sendH('snapshot',{snapshot:live});assert.equal(t.g.last('snapshot').players.gold.x,-80);
 live.players.gold.x=-1000;await t.sendH('snapshot',{snapshot:live});assert.equal(t.h.last('error').code,'BOUNDS');
});
test('co-op exploration preserves mode through save readback, cold hub restore and rejects mode crossing',async()=>{
 const t=await setup(true,'coop-exploration'),sim=new Simulation(t.created.save);
 assert(sim.requestTravel('gold','player-home-villa','map'));sim.command('white',{x:0,z:0,actions:[],travelResponse:'accept'});assert.equal(sim.state.regionId,'player-home-villa');
 Object.assign(sim.state.players.gold,{x:1,y:-4.5,z:9,safeX:1,safeY:-4.5,safeZ:9});
 await t.sendH('snapshot',{snapshot:sim.exportLiveSnapshot()});assert.equal(t.g.last('snapshot').mode,'coop-exploration');
 await t.sendH('save',{save:sim.exportSave(),expectedRevision:0,requestId:'v10_floor'});assert.equal(t.h.last('saved').revision,1);
 await t.hub.disconnect(t.hs);await t.hub.disconnect(t.gs);
 const cold=new RoomHub(t.store);await cold.init();const restored=await cold.create(hostToken,t.created.credentials,'coop-exploration');assert.equal(restored.room.mode,'coop-exploration');
 assert.equal(new Simulation(restored.save).state.players.gold.y,-4.5);
 await assert.rejects(cold.create(hostToken,t.created.credentials,'adventure'),/模式/);
 const wrong={...restored.save,mode:'adventure' as const};delete wrong.world.snapshot;
 await assert.rejects(cold.restore(t.created.credentials,wrong),/模式/);
});
test("guest input reaches host; only host can broadcast authoritative world or save", async () => {
  const t = await setup();
  await t.sendG("input", { input: { actions: ["jump"], x: 1, z: 0, sprint: true } });
  assert.equal(t.h.last("input").role, "white");
  await t.sendH("snapshot", {
    snapshot: new Simulation(t.created.save).state,
  });
  assert.equal(t.g.last("snapshot").players.gold.grounded, true);
  await t.sendG("snapshot", { snapshot: { hp: 999 } });
  assert.equal(t.g.last("error").code, "HOST_ONLY");
  await t.sendG("save", {
    save: t.created.save,
    expectedRevision: 0,
    requestId: "evil",
  });
  assert.equal(t.g.last("error").code, "HOST_ONLY");
  assert.equal((await t.hub.authorize(t.created.credentials)).save.revision, 0);
});
test("replayed sequence and repeated save operation commit only once", async () => {
  const t = await setup();
  const payload = {
    save: t.created.save,
    expectedRevision: 0,
    requestId: "save_unique",
  };
  await t.sendH("save", payload, 40);
  await t.sendH("save", payload, 40);
  await t.sendH("save", payload, 41);
  assert.equal(t.h.last("saved").revision, 1);
  assert.equal((await t.hub.authorize(t.created.credentials)).save.revision, 1);
  assert.equal(t.h.messages.filter((m) => m.kind === "saved").length, 2);
});
test("failed durable write never emits saved acknowledgement", async () => {
  const t = await setup();
  t.store.fail = true;
  await t.sendH("save", {
    save: t.created.save,
    expectedRevision: 0,
    requestId: "failed_save",
  });
  assert.equal(t.h.last("saved"), undefined);
  assert.equal(t.h.last("error").code, "SAVE_FAILED");
  assert.equal((await t.hub.authorize(t.created.credentials)).save.revision, 0);
  t.store.fail = false;
  await t.sendH("save", {
    save: t.created.save,
    expectedRevision: 0,
    requestId: "failed_save",
  });
  assert.equal(t.h.last("saved").revision, 1);
});
test("host disconnect pauses guest and stable identity restores host without promotion", async () => {
  const t = await setup();
  await t.hub.disconnect(t.hs);
  assert.equal(t.g.last("room").paused, true);
  await t.sendG("input", { input: { x: 0, z: 0, actions: ["attack"] } });
  assert.equal(t.g.last("error").code, "PAUSED");
  const peer = new MockPeer(),
    socket = t.hub.connect(t.created.room.code, peer);
  await t.hub.receive(
    socket,
    JSON.stringify({
      v: PROTOCOL_VERSION,
      seq: 0,
      kind: "hello",
      payload: { clientToken: hostToken },
    }),
  );
  assert.equal(peer.last("welcome").clientId, t.created.room.hostId);
  assert.equal(t.g.last("room").paused, false);
});
test("closed room does not own progress: chapter three, both builds and secrets recover in new room", async () => {
  const t = await setup();
  const save = structuredClone(t.created.save);
  save.chapterId = "ch03";
  save.checkpointId = "ruins";
  save.completedChapters = ["ch01", "ch02"];
  save.players.white.weaponId = "bow";
  save.players.gold.skinId = "forest";
  save.secrets = ["owl-library"];
  save.quests = { "miller-family": "complete" };
  save.world = { bridgeBroken: true, chapterEightFlag: "preserve" };
  await t.sendH("save", {
    save,
    expectedRevision: 0,
    requestId: "chapter_three",
  });
  await t.sendH("close");
  await assert.rejects(t.hub.join(t.created.room.code, guestToken), /不存在/);
  const resumed = await t.hub.create(hostToken, t.created.credentials);
  assert.notEqual(resumed.room.code, t.created.room.code);
  assert.equal(resumed.save.chapterId, "ch03");
  assert.equal(resumed.save.players.white.weaponId, "bow");
  assert.equal(resumed.save.players.gold.skinId, "forest");
  assert.equal(resumed.save.world.chapterEightFlag, "preserve");
});
test("unknown player token, wrong recovery token, wrong adventure and incompatible protocol are rejected", async () => {
  const t = await setup();
  const peer = new MockPeer(),
    socket = t.hub.connect(t.created.room.code, peer);
  await t.hub.receive(
    socket,
    JSON.stringify({
      v: PROTOCOL_VERSION,
      seq: 0,
      kind: "hello",
      payload: { clientToken: thirdToken },
    }),
  );
  assert.equal(peer.last("error").code, "AUTH");
  await assert.rejects(
    t.hub.authorize({ ...t.created.credentials, recoveryToken: thirdToken }),
    /凭证/,
  );
  await t.sendH("save", {
    save: freshSave("someone_else"),
    expectedRevision: 0,
    requestId: "wrong_owner",
  });
  assert.equal(t.h.last("error").code, "AUTH");
  await t.hub.receive(
    t.hs,
    JSON.stringify({ v: 999, seq: 100, kind: "snapshot", payload: {} }),
  );
  assert.equal(t.h.last("error").code, "VERSION");
});
test("parallel conflicting checkpoints serialize revision check and preserve first successful write", async () => {
  const t = await setup();
  await Promise.all([
    t.sendH("save", {
      save: { ...t.created.save, checkpointId: "first" },
      expectedRevision: 0,
      requestId: "first_commit",
    }),
    t.sendH("save", {
      save: { ...t.created.save, checkpointId: "second" },
      expectedRevision: 0,
      requestId: "second_commit",
    }),
  ]);
  assert.equal(t.h.last("error").code, "CONFLICT");
  assert.equal(
    (await t.hub.authorize(t.created.credentials)).save.checkpointId,
    "first",
  );
});
test("service restart restores durable room identity and latest checkpoint", async () => {
  const t = await setup();
  await t.sendH("save", {
    save: { ...t.created.save, chapterId: "ch03" },
    expectedRevision: 0,
    requestId: "restart_save",
  });
  const newHub = new RoomHub(t.store);
  await newHub.init();
  const recreated = await newHub.create(hostToken, t.created.credentials);
  assert.equal(recreated.room.code, t.created.room.code);
  assert.equal(recreated.room.paused, true);
  assert.equal(recreated.save.chapterId, "ch03");
});
test("malformed and oversized messages cannot change world or storage", async () => {
  const t = await setup();
  await t.hub.receive(t.hs, "{bad");
  assert.equal(t.h.last("error").code, "FORMAT");
  await t.hub.receive(t.hs, " ".repeat(230001));
  assert.equal(t.h.last("error").code, "SIZE");
  await t.sendH("snapshot", { snapshot: { invalid: "x".repeat(24001) } });
  assert.equal(t.h.last("error").code, "FORMAT");
  assert.equal(t.g.last("snapshot"), undefined);
});
test("hibernated socket restores authenticated role and sequence without resetting game with welcome", async () => {
  const t = await setup();
  const restoredHub = new RoomHub(t.store);
  await restoredHub.init();
  const peer = new MockPeer();
  const restored = await restoredHub.restoreConnection(
    t.created.room.code,
    peer,
    hostToken,
    50,
  );
  await restoredHub.restoreConnection(
    t.created.room.code,
    new MockPeer(),
    guestToken,
    20,
  );
  assert.equal(peer.last("welcome"), undefined);
  await restoredHub.receive(
    restored,
    JSON.stringify({
      v: PROTOCOL_VERSION,
      seq: 49,
      kind: "save",
      payload: {
        save: t.created.save,
        expectedRevision: 0,
        requestId: "stale_after_sleep",
      },
    }),
  );
  assert.equal(
    (await restoredHub.authorize(t.created.credentials)).save.revision,
    0,
  );
  await restoredHub.receive(
    restored,
    JSON.stringify({
      v: PROTOCOL_VERSION,
      seq: 51,
      kind: "save",
      payload: {
        save: t.created.save,
        expectedRevision: 0,
        requestId: "wake_checkpoint",
      },
    }),
  );
  assert.equal(peer.last("saved").revision, 1);
});
test("host background presence pauses immediately, guest and ping cannot unpause, visible host resumes", async () => {
  const t = await setup();
  await t.sendH("presence", { active: false });
  assert.equal(t.g.last("room").paused, true);
  await t.sendG("presence", { active: true });
  assert.equal(t.g.last("error").code, "HOST_ONLY");
  await t.sendH("ping");
  assert.equal(t.h.last("pong") !== undefined, true);
  assert.equal(t.g.last("room").paused, true);
  await t.sendG("input", { input: { x: 0, z: 0, actions: ["attack"] } });
  assert.equal(t.g.last("error").code, "PAUSED");
  await t.sendH("snapshot", { snapshot: { incorrectlyRunning: true } });
  assert.equal(t.h.last("error").code, "PAUSED");
  await t.sendH("presence", { active: true });
  assert.equal(t.g.last("room").paused, false);
  await t.sendG("input", { input: { x: 0, z: 0, actions: ["attack"] } });
  assert.equal(t.h.last("input").input.actions[0], "attack");
});
test("host presence cannot override a disconnected identity and survives service restart", async () => {
  const t = await setup();
  await t.sendH("presence", { active: false });
  const restoredHub = new RoomHub(t.store);
  await restoredHub.init();
  const restored = await restoredHub.create(hostToken, t.created.credentials);
  assert.equal(restored.room.paused, true);
  await t.hub.disconnect(t.hs);
  await t.sendH("presence", { active: true });
  assert.equal(t.g.last("room").paused, true);
});
test("guest disconnect also pauses authoritative simulation and reconnect restores it", async () => {
  const t = await setup();
  await t.hub.disconnect(t.gs);
  assert.equal(t.h.last("room").paused, true);
  await t.sendH("presence", { active: true });
  assert.equal(t.h.last("room").paused, true);
  await t.sendH("snapshot", { snapshot: { ghostMovement: true } });
  assert.equal(t.h.last("error").code, "PAUSED");
  const guest = new MockPeer(),
    session = t.hub.connect(t.created.room.code, guest);
  await t.hub.receive(
    session,
    JSON.stringify({
      v: PROTOCOL_VERSION,
      seq: 0,
      kind: "hello",
      payload: { clientToken: guestToken },
    }),
  );
  assert.equal(t.h.last("room").paused, false);
});
test("authenticated host may flush last checkpoint while paused without resuming world", async () => {
  const t = await setup();
  await t.sendH("presence", { active: false });
  await t.sendH("save", {
    save: { ...t.created.save, checkpointId: "before_background" },
    expectedRevision: 0,
    requestId: "background_flush",
  });
  assert.equal(t.h.last("saved").revision, 1);
  assert.equal(t.g.last("room").paused, true);
  await t.sendH("snapshot", { snapshot: { stillPaused: false } });
  assert.equal(t.h.last("error").code, "PAUSED");
});

test("v2 forwards sprint/jump, preserves live height and normalizes airborne state on reconnect; corrupt heights cannot replace snapshot", async () => {
  const t = await setup();
  const sim = new Simulation(t.created.save);
  sim.state.enemies = [];
  await t.sendG("input", { input: { x: 1, z: 0, sprint: true, actions: ["jump"] } });
  const received = t.h.last("input");
  sim.command(received.role, received.input); sim.tick(.05);
  const p = sim.state.players.white;
  assert.equal(p.grounded, false); assert.equal(p.sprinting, true);
  await t.sendH("snapshot", { snapshot: sim.state });
  const remote = t.g.last("snapshot");
  assert.equal(remote.v, 2); assert.equal(remote.players.white.y, p.y); assert.equal(remote.players.white.vy, p.vy);
  const corrupt = structuredClone(sim.state) as any; corrupt.players.white.y = "sky";
  await t.sendH("snapshot", { snapshot: corrupt }); assert.equal(t.h.last("error").code, "SNAPSHOT");
  assert.equal(t.g.last("snapshot").players.white.y, p.y);
  await t.hub.disconnect(t.gs);
  const peer = new MockPeer(), socket = t.hub.connect(t.created.room.code, peer);
  await t.hub.receive(socket, JSON.stringify({ v: PROTOCOL_VERSION, seq: 0, kind: "hello", payload: { clientToken: guestToken } }));
  const restored = peer.last("welcome").snapshot.players.white;
  assert.equal(restored.grounded,true);assert.equal(restored.sprinting,false);assert.equal(restored.vy,0);assert.equal(restored.x,p.safeX);assert.equal(restored.y,p.safeY);
  await t.sendH("hello",{clientToken:hostToken}); // Already authenticated; cannot mutate a room through a second handshake.
  assert.equal(t.h.last("error").code,"AUTH");
});

test('authoritative live progress survives a cold host reconnect before a durable save and rejects guest or cross-adventure replacement', async () => {
  const t=await setup(), sim=new Simulation(t.created.save);
  sim.state.flags.push('v-secret-orchard-lookout');sim.save.quests['v-secret-orchard-lookout']=true;
  sim.save.secrets.push('v-secret-orchard-lookout');sim.save.players.gold.unlockedSkills.push('shield');
  const live=sim.exportLiveSnapshot();
  await t.sendH('snapshot',{snapshot:live});assert.equal(t.g.last('snapshot').progress.quests['v-secret-orchard-lookout'],true);
  await t.sendG('snapshot',{snapshot:live});assert.equal(t.g.last('error').code,'HOST_ONLY');
  const foreign=structuredClone(live);foreign.progress!.adventureId='foreign-adventure';
  await t.sendH('snapshot',{snapshot:foreign});assert.equal(t.h.last('error').code,'AUTH');
  const nested=structuredClone(live) as any;nested.progress.world={snapshot:live};
  await t.sendH('snapshot',{snapshot:nested});assert.equal(t.h.last('error').code,'SNAPSHOT');
  assert.deepEqual((await t.store.load(t.created.save.adventureId))!.save.secrets,[],'the relay has no unearned durable acknowledgement');
  await t.hub.disconnect(t.hs);
  const peer=new MockPeer(), socket=t.hub.connect(t.created.room.code,peer);
  await t.hub.receive(socket,JSON.stringify({v: PROTOCOL_VERSION,seq:0,kind:'hello',payload:{clientToken:hostToken}}));
  const welcome=peer.last('welcome'), recovered=prepareAdventureRecovery(welcome.save,welcome.snapshot);
  assert(recovered.secrets.includes('v-secret-orchard-lookout'));assert(recovered.players.gold.unlockedSkills.includes('shield'));
  assert.equal(recovered.revision,0);assert.equal(welcome.snapshot.progress.adventureId,t.created.save.adventureId);
});

test('same-identity live socket takeover clears movement before its welcome snapshot',async()=>{const t=await setup(),sim=new Simulation(t.created.save);Object.assign(sim.state.players.gold,{vx:1,speed:1,action:'run'});await t.sendH('snapshot',{snapshot:sim.exportLiveSnapshot()});const peer=new MockPeer(),session=t.hub.connect(t.created.room.code,peer);await t.hub.receive(session,JSON.stringify({v:PROTOCOL_VERSION,seq:0,kind:'hello',payload:{clientToken:hostToken}}));assert(t.h.closed);const p=peer.last('welcome').snapshot.players.gold;assert.equal(p.vx,0);assert.equal(p.vy,0);assert.equal(p.speed,0);assert.equal(p.x,sim.state.players.gold.x);});
