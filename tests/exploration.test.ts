import './studio-fixture';
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { CHAPTERS } from "../src/content";
import {
  freshSave,
  validateSave,
  type AdventureSave,
  type DogRole,
} from "../shared/save";
import {
  createExplorationSave,
  validateExplorationSave,
  allowedExplorationRegions,
  exportExplorationBackup,
  parseExplorationBackup,
  readExploration,
  writeExploration,
  EXPLORATION_STORAGE_KEY,
  LEGACY_PRACTICE_KEY,
  type ExplorationStorage,
} from "../src/exploration";
class MemoryStorage implements ExplorationStorage {
  values = new Map<string, string>();
  writes: string[] = [];
  failKey = "";
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (key.includes(this.failKey) && this.failKey)
      throw new Error("storage quota");
    this.values.set(key, value);
    this.writes.push(key);
  }
}
test("appended installed chapters remain available to inherited exploration and developer preview without touching campaign progress", () => {
  const chapter = structuredClone(CHAPTERS[6]);
  chapter.id = "ch08-exploration-extension";
  chapter.index = 8;
  CHAPTERS.push(chapter);
  try {
    const inherited = freshSave("exploration-extension-fixture");
    inherited.chapterId = chapter.id;
    const before = JSON.stringify(inherited);
    assert(allowedExplorationRegions().includes(chapter.id));
    assert(allowedExplorationRegions(inherited).includes(chapter.id));
    assert(allowedExplorationRegions(undefined, true).includes(chapter.id));
    const seed = createExplorationSave("white", "ch08");
    const sim = new Simulation(undefined, {mode: "exploration", exploration: seed, inheritedAdventure: inherited});
    assert.equal(sim.state.regionId, chapter.id);
    assert.equal(sim.exportExploration().regionId, chapter.id);
    assert.equal(JSON.stringify(inherited), before);
  } finally { CHAPTERS.pop(); }
});
const command = (actions: ("interact" | "attack" | "skill1")[] = []) => ({
  x: 0,
  z: 0,
  actions,
});
function officialFixture(): AdventureSave {
  const save = freshSave("a_official_pair");
  save.chapterId = CHAPTERS[2].id;
  save.completedChapters = CHAPTERS.slice(0, 2).map((c) => c.id);
  save.checkpointId = "official-ruins-checkpoint";
  save.quests = { "miller-helped": true, "castle-rumor": 2 };
  save.secrets = ["v-secret-paw"];
  save.players.gold.skinId = "forest";
  save.players.gold.unlockedSkins.push("forest");
  save.players.white.weaponId = "staff";
  save.players.white.inventory = ["family-medal"];
  save.world.futureCampaignData = { homesRestored: 2 };
  return new Simulation(save).exportSave();
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
function advance(sim: Simulation, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) sim.tick(0.05);
}
for (const role of ["gold", "white"] as const) {
  test(`${role}: exploration move/interact/boss death/exit/save/refresh never changes the same formal adventure`, () => {
    const original = freezeDeep(officialFixture()),
      originalText = JSON.stringify(original),
      storage = new MemoryStorage();
    const credentials = JSON.stringify({
      adventureId: original.adventureId,
      recoveryToken: "a".repeat(64),
    });
    storage.values.set("starlight-adventure", credentials);
    storage.values.set(`starlight-save:${original.adventureId}`, originalText);
    storage.values.set(
      `starlight-pending:${original.adventureId}`,
      "pending-formal-record",
    );
    const seed = createExplorationSave(role);
    const sim = new Simulation(undefined, {
      mode: "exploration",
      exploration: seed,
      inheritedAdventure: original,
    });
    assert.equal(sim.mode, "exploration");
    assert.deepEqual(sim.visibleRoles, [role]);
    assert.equal(sim.state.mode, "exploration");
    const p = sim.state.players[role],
      before = { x: p.x, z: p.z };
    for (let i = 0; i < 20; i++) {
      sim.command(role, { x: 0.6, z: 0.8, actions: [] });
      sim.tick(0.05);
    }
    assert.ok(Math.hypot(p.x - before.x, p.z - before.z) > 2);
    // Deterministic unit fixtures remove traversal only; actions and damage use real simulation commands.
    for (const item of [...sim.chapter.interactions, ...sim.chapter.secrets]) {
      Object.assign(p, { x: item.x, z: item.z, invincible: 1e5 });
      sim.command(role, command(["interact"]));
      sim.tick(0.05);
    }
    const beforeEnemies = sim.state.enemies.length;
    Object.assign(p, sim.chapter.event.trigger);
    sim.tick(0.05);
    assert.equal(
      sim.state.enemies.length,
      beforeEnemies,
      "exploration must not trigger region crisis",
    );
    const boss = sim.state.enemies.find((e) => e.boss)!;
    boss.hp = 1;
    Object.assign(p, { x: boss.x, z: boss.z + 1, invincible: 1e5 });
    sim.command(role, command(["attack"]));
    sim.tick(0.05);
    assert.equal(boss.hp, 0);
    assert.equal(boss.state, "dead");
    assert.ok(
      sim.state.events.some(
        (e) => e.type === "defeat" && e.text?.includes("不结算"),
      ),
    );
    const region = sim.chapter.id;
    Object.assign(p, sim.chapter.exit);
    advance(sim, 2);
    assert.equal(sim.chapter.id, region);
    assert.equal(sim.state.ended, false);
    assert.deepEqual(sim.state.flags, []);
    assert.deepEqual(sim.save.quests, {});
    assert.deepEqual(sim.save.completedChapters, []);
    assert.deepEqual(sim.save.secrets, []);
    assert.deepEqual(sim.save.world, {});
    assert.throws(() => sim.exportSave(), /不能提交双人/);
    const standalone = sim.exportExploration({
      camera: { yaw: 0.5, pitch: 0.3, distance: 9 },
      preferences: { music: 0.2, showEquipment: true },
    });
    writeExploration(storage, standalone);
    const loaded = readExploration(storage, original);
    assert.equal(loaded.status, "loaded");
    const refreshed = new Simulation(undefined, {
      mode: "exploration",
      exploration: loaded.save!,
      inheritedAdventure: original,
    });
    assert.deepEqual(refreshed.state.players[role].x, p.x);
    assert.deepEqual(refreshed.state.flags, []);
    assert.ok(
      refreshed.state.enemies.some((e) => e.boss && e.hp === e.maxHp),
      "sandbox boss results are not persistent progress",
    );
    assert.equal(JSON.stringify(original), originalText);
    assert.equal(storage.getItem("starlight-adventure"), credentials);
    assert.equal(
      storage.getItem(`starlight-save:${original.adventureId}`),
      originalText,
    );
    assert.equal(
      storage.getItem(`starlight-pending:${original.adventureId}`),
      "pending-formal-record",
    );
    assert.deepEqual(storage.writes, [EXPLORATION_STORAGE_KEY]);
    assert.throws(() => validateSave(standalone), /版本|基本信息|格式/);
    const wronglyWrapped = structuredClone(original);
    wronglyWrapped.chapterId = sim.chapter.id;
    wronglyWrapped.world.snapshot = sim.state as any;
    assert.throws(
      () => validateSave(wronglyWrapped),
      /单人探索快照不能写入双人冒险/,
    );
  });
}
test("only the selected dog acts, is targeted and respawns; the hidden dog never supplies an AI teammate", () => {
  const sim = new Simulation(undefined, {
    mode: "exploration",
    exploration: createExplorationSave("white"),
  });
  const inactive = structuredClone(sim.state.players.gold),
    white = sim.state.players.white;
  sim.command("gold", { x: 1, z: 1, actions: ["attack", "interact"] });
  sim.tick(0.05, true);
  assert.deepEqual(sim.state.players.gold, inactive);
  const enemy = sim.state.enemies[0];
  Object.assign(white, { x: enemy.x, z: enemy.z + 1 });
  Object.assign(sim.state.players.gold, { x: enemy.x, z: enemy.z });
  enemy.kind = "sprite";
  enemy.timer = 0;
  white.weaponDrawn = true;
  sim.tick(0.05);
  assert.equal(enemy.targetX, white.x);
  assert.equal(enemy.targetZ, white.z);
  white.hp = 0;
  advance(sim, 2.7);
  assert.equal(white.hp, 100);
  assert.equal(sim.state.players.gold.hp, 100);
  assert.equal(sim.state.players.gold.action, "idle");
});
test("all loadouts are sandbox previews, editable away from camp and persisted without unlock lists", () => {
  const sim = new Simulation(undefined, {
    mode: "exploration",
    exploration: createExplorationSave("white"),
  });
  Object.assign(sim.state.players.white, { x: 25, z: 45 });
  sim.command("white", {
    ...command(),
    weapon: "chime",
    skin: "moon",
    skills: ["nova", "shield"],
  });
  const result = sim.exportExploration();
  assert.equal(result.loadouts.white.weaponId, "chime");
  assert.equal(result.loadouts.white.skinId, "moon");
  assert.deepEqual(result.loadouts.white.skillIds, ["nova", "shield"]);
  assert.equal("unlockedSkins" in result.loadouts.white, false);
  assert.equal("quests" in result, false);
  assert.equal("world" in result, false);
  const restored = new Simulation(undefined, {
    mode: "exploration",
    exploration: parseExplorationBackup(exportExplorationBackup(result)),
  });
  assert.equal(restored.state.players.white.weapon, "chime");
  assert.equal(restored.state.players.white.skin, "moon");
});
test("free exploration opens installed regions without changing the formal adventure", () => {
  const official = freezeDeep(officialFixture()),
    before = JSON.stringify(official);
  assert.deepEqual(allowedExplorationRegions(), [...CHAPTERS.map(c=>c.id), "studio-manhattan", "studio-europe-town", "mushroom-grove", "mushroom-home", "canopy-garden", "canopy-home", "player-home-villa", "studio-tideglass-cove", "studio-winter-lantern"]);
  assert.deepEqual(
    allowedExplorationRegions(official),
    allowedExplorationRegions(),
  );
  const normal = new Simulation(undefined, {
    mode: "exploration",
    inheritedAdventure: official,
  });
  normal.setExplorationRegion(CHAPTERS[2].id);
  assert.equal(normal.chapter.id, CHAPTERS[2].id);
  normal.setExplorationRegion(CHAPTERS[6].id);
  assert.equal(normal.state.regionId,CHAPTERS[6].id);
  const inspector = new Simulation(undefined, {
    mode: "exploration",
    developerPreview: true,
    inheritedAdventure: official,
  });
  for (const chapter of CHAPTERS) {
    inspector.setExplorationRegion(chapter.id);
    const p = inspector.state.players.gold;
    Object.assign(p, chapter.exit);
    advance(inspector, 0.1);
    assert.equal(inspector.chapter.id, chapter.id);
    assert.deepEqual(inspector.state.flags, []);
  }
  assert.deepEqual(inspector.save.completedChapters, []);
  assert.equal(JSON.stringify(official), before);
  const normalAgain = new Simulation(undefined, {
    mode: "exploration",
    exploration: inspector.exportExploration(),
    inheritedAdventure: official,
  });
  assert.equal(normalAgain.chapter.id, CHAPTERS[6].id);
  assert.equal(normalAgain.notice, '');
  assert.throws(
    () => new Simulation(official).setExplorationRegion(CHAPTERS[6].id),
    /合作冒险/,
  );
});
test("offline exploration construction, movement and local save require no network service", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("No network permitted");
  }) as typeof fetch;
  try {
    const storage = new MemoryStorage(),
      sim = new Simulation(undefined, { mode: "exploration", role: "white" });
    sim.command("white", { x: 1, z: 0, actions: ["attack"] });
    sim.tick(0.05);
    writeExploration(storage, sim.exportExploration());
    assert.equal(readExploration(storage).save?.role, "white");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("legacy migration backs up exact raw value before writing and leaves all old/formal records untouched", () => {
  const storage = new MemoryStorage(),
    legacy = officialFixture();
  legacy.adventureId = "practice-old";
  const raw = JSON.stringify(legacy);
  storage.values.set(LEGACY_PRACTICE_KEY, raw);
  storage.values.set("starlight-adventure", "formal-owner");
  const result = readExploration(storage, legacy);
  assert.equal(result.status, "migrated");
  assert.ok(result.backupKey);
  assert.equal(storage.writes[0], result.backupKey);
  assert.equal(storage.writes[1], EXPLORATION_STORAGE_KEY);
  assert.equal(storage.getItem(result.backupKey!), raw);
  assert.equal(storage.getItem(LEGACY_PRACTICE_KEY), raw);
  assert.equal(storage.getItem("starlight-adventure"), "formal-owner");
  assert.equal(result.save?.regionId, CHAPTERS[2].id);
  assert.equal(result.save?.loadouts.gold.skinId, "forest");
  assert.equal("completedChapters" in result.save!, false);
  const writes = storage.writes.length;
  assert.equal(readExploration(storage, legacy).status, "loaded");
  assert.equal(storage.writes.length, writes);
});
test("legacy practice migrates its installed region without requiring formal progress", () => {
  const storage = new MemoryStorage(),
    legacy = officialFixture();
  legacy.adventureId = "practice-old";
  storage.values.set(LEGACY_PRACTICE_KEY, JSON.stringify(legacy));
  const result = readExploration(storage);
  assert.equal(result.status, "migrated");
  assert.equal(result.save?.regionId, CHAPTERS[2].id);
});
test("corrupt legacy data and storage failure preserve original values and never write formal keys", () => {
  for (const raw of [
    "{truncated",
    JSON.stringify({ ...freshSave("practice-old"), version: 999 }),
  ]) {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_PRACTICE_KEY, raw);
    const result = readExploration(storage);
    assert.equal(result.status, "migration-failed");
    assert.equal(storage.getItem(LEGACY_PRACTICE_KEY), raw);
    assert.equal(storage.getItem(EXPLORATION_STORAGE_KEY), null);
    assert.equal(storage.getItem(result.backupKey!), raw);
  }
  for (const failKey of [
    "starlight-practice-backup-v1",
    EXPLORATION_STORAGE_KEY,
  ]) {
    const storage = new MemoryStorage(),
      raw = JSON.stringify(freshSave("practice-old"));
    storage.values.set(LEGACY_PRACTICE_KEY, raw);
    storage.failKey = failKey;
    const result = readExploration(storage);
    assert.equal(result.status, "migration-failed");
    assert.equal(storage.getItem(LEGACY_PRACTICE_KEY), raw);
    assert.equal(storage.getItem(EXPLORATION_STORAGE_KEY), null);
  }
});
test("damaged exploration is preserved, no silent fallback over it, and backups reject campaign fields", () => {
  const storage = new MemoryStorage();
  storage.values.set(EXPLORATION_STORAGE_KEY, "broken");
  storage.values.set(
    LEGACY_PRACTICE_KEY,
    JSON.stringify(freshSave("practice-old")),
  );
  assert.equal(readExploration(storage).status, "invalid");
  assert.equal(storage.getItem(EXPLORATION_STORAGE_KEY), "broken");
  assert.deepEqual(storage.writes, []);
  const valid = createExplorationSave();
  assert.throws(
    () => validateExplorationSave({ ...valid, quests: { reward: true } }),
    /格式/,
  );
  assert.throws(
    () =>
      validateExplorationSave({ ...valid, position: { x: NaN, z: 1, yaw: 0 } }),
    /格式|位置/,
  );
  assert.throws(
    () =>
      parseExplorationBackup(JSON.stringify(freshSave("a_actual_campaign"))),
    /格式/,
  );
});
test("older exploration preferences default to unarmed base preview; camera and explicit equipment preference round-trip", () => {
  const old = createExplorationSave();
  delete old.preferences.showEquipment;
  const loaded = validateExplorationSave(old);
  assert.equal(loaded.preferences.showEquipment, false);
  const sim = new Simulation(undefined, {
    mode: "exploration",
    exploration: loaded,
  });
  const saved = sim.exportExploration({
    camera: { yaw: 1.2, pitch: 0.5 },
    preferences: { showEquipment: true, music: 0.1 },
  });
  assert.equal(saved.camera.distance, 8.8);
  assert.equal(saved.preferences.showEquipment, true);
  assert.deepEqual(
    parseExplorationBackup(exportExplorationBackup(saved)),
    saved,
  );
  assert.throws(
    () => new Simulation(freshSave("adventure_only")).exportExploration(),
    /双人冒险不能写入/,
  );
});
test("starting a new visit over a damaged exploration record first preserves exact bad bytes; backup failure blocks overwrite", () => {
  const storage = new MemoryStorage(),
    bad = "{corrupt but worth preserving";
  storage.values.set(EXPLORATION_STORAGE_KEY, bad);
  writeExploration(storage, createExplorationSave("white"));
  assert.match(storage.writes[0], /^starlight-exploration-corrupt-backup-v1:/);
  assert.equal(storage.getItem(storage.writes[0]), bad);
  assert.equal(readExploration(storage).save?.role, "white");
  const blocked = new MemoryStorage();
  blocked.values.set(EXPLORATION_STORAGE_KEY, bad);
  blocked.failKey = "starlight-exploration-corrupt-backup-v1";
  assert.throws(
    () => writeExploration(blocked, createExplorationSave()),
    /quota/,
  );
  assert.equal(blocked.getItem(EXPLORATION_STORAGE_KEY), bad);
});

test("failed or silently dropped exploration writes preserve the healthy record, export latest state, and permit retry", () => {
  for (const failure of ["throw", "drop"] as const) {
    const storage = new MemoryStorage();
    const initial = createExplorationSave("white");
    writeExploration(storage, initial);
    const healthy = storage.getItem(EXPLORATION_STORAGE_KEY);
    const latest = { ...initial, position: { x: 4, z: 8, yaw: 1 } };
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = () => { if (failure === "throw") throw new Error("quota"); };
    assert.throws(() => writeExploration(storage, latest), /quota|写入/);
    assert.equal(storage.getItem(EXPLORATION_STORAGE_KEY), healthy);
    assert.deepEqual(parseExplorationBackup(exportExplorationBackup(latest)).position, latest.position);
    storage.setItem = originalSet;
    writeExploration(storage, latest);
    assert.deepEqual(readExploration(storage).save?.position, latest.position);
  }
});
