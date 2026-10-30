import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSnapshotShape } from "../shared/snapshot";
import {
  freshSave,
  makeBackup,
  parseBackup,
  validateSave,
  type JsonValue,
} from "../shared/save";
import { Simulation } from "../src/simulation";
import { FileStore } from "../server/file-store";
import { RoomHub } from "../server/core";

const credentials = {
  adventureId: "snapshot_test",
  recoveryToken: "d".repeat(64),
};
function fullSave() {
  const sim = new Simulation(freshSave(credentials.adventureId));
  sim.emit("message", 1, 2, "有效场景事件", 3);
  sim.state.enemies[0].state = "warning";
  sim.state.enemies[0].telegraphs = [{ x: 1, z: 2, r: 2.5, delay: 0.8 }];
  return sim.exportSave();
}
type Mutate = (snapshot: any) => void;
const corruptions: Record<string, Mutate> = {
  "string position": (s) => {
    s.players.gold.x = "bad";
  },
  "null position after non-finite JSON serialization": (s) => {
    s.players.white.z = null;
  },
  "missing cooldowns": (s) => {
    delete s.players.gold.cooldowns;
  },
  "string cooldown member": (s) => {
    s.players.gold.cooldowns[1] = "0";
  },
  "truncated cooldowns": (s) => {
    s.players.gold.cooldowns = [0];
  },
  "wrong skill shape": (s) => {
    s.players.gold.skills = {};
  },
  "wrong role": (s) => {
    s.players.white.role = "gold";
  },
  "negative health": (s) => {
    s.players.gold.hp = -1;
  },
  "zero maximum health": (s) => {
    s.players.gold.maxHp = 0;
  },
  "missing action timer": (s) => {
    delete s.players.gold.actionTime;
  },
  "enemy array replaced with object": (s) => {
    s.enemies = {};
  },
  "enemy null": (s) => {
    s.enemies[0] = null;
  },
  "enemy duplicate ID": (s) => {
    s.enemies.push(structuredClone(s.enemies[0]));
  },
  "enemy invalid phase": (s) => {
    s.enemies[0].phase = 0;
  },
  "enemy missing home coordinate": (s) => {
    delete s.enemies[0].homeX;
  },
  "enemy invalid state": (s) => {
    s.enemies[0].state = {};
  },
  "enemy invalid boolean": (s) => {
    s.enemies[0].boss = "false";
  },
  "telegraph wrong collection": (s) => {
    s.enemies[0].telegraphs = {};
  },
  "telegraph string coordinate": (s) => {
    s.enemies[0].telegraphs[0].x = "1";
  },
  "telegraph negative radius": (s) => {
    s.enemies[0].telegraphs[0].r = -2;
  },
  "telegraph missing delay": (s) => {
    delete s.enemies[0].telegraphs[0].delay;
  },
  "invalid attack sequence": (s) => {
    s.enemies[0].attackSerial = 0.2;
  },
  "invalid checkpoint": (s) => {
    s.checkpoint.z = "far";
  },
  "invalid event sequence": (s) => {
    s.events[0].id = s.eventSerial + 1;
  },
  "invalid event coordinate": (s) => {
    s.events[0].x = "1";
  },
  "invalid event value": (s) => {
    s.events[0].value = null;
  },
  "duplicate progress flag": (s) => {
    s.flags = ["known_flag", "known_flag"];
  },
  "invalid elapsed time": (s) => {
    s.time = -1;
  },
  "invalid completion flag": (s) => {
    s.ended = "false";
  },
};

test("full v2 snapshot validates without dropping current state or extension metadata", () => {
  const save = fullSave();
  save.world.futureSystems = { tide: 4, unlockedArea: "ch08-island" };
  const snapshot = save.world.snapshot as any;
  snapshot.futureDetail = { weather: "sun" };
  const original = JSON.stringify(save);
  assert.doesNotThrow(() => validateSnapshotShape(snapshot));
  const checked = validateSave(save);
  assert.equal(JSON.stringify(save), original);
  assert.deepEqual(checked, save);
  assert.notEqual(checked, save);
  assert.equal(new Simulation(checked).state.enemies[0].telegraphs.length, 1);
});

test("29 structurally JSON-valid corruptions reject before backup import and direct simulation load", () => {
  for (const [name, mutate] of Object.entries(corruptions)) {
    const save = fullSave();
    mutate(save.world.snapshot);
    const raw = JSON.parse(JSON.stringify(save));
    assert.throws(() => validateSave(raw), /快照/, name);
    assert.throws(() => new Simulation(raw), /快照/, name);
    const backup = {
      format: "starlight-dogs",
      formatVersion: 1,
      credentials,
      save: raw,
    };
    assert.throws(() => parseBackup(JSON.stringify(backup)), /快照/, name);
  }
});

test("non-finite numbers never enter snapshot state, including null produced by JSON encoding", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const save = fullSave();
    (save.world.snapshot as any).players.gold.x = bad;
    assert.throws(() => validateSnapshotShape(save.world.snapshot), /快照/);
    assert.throws(() => validateSave(save));
    assert.throws(() => validateSave(JSON.parse(JSON.stringify(save))), /快照/);
  }
});

test("legacy v1 snapshot without telegraphs or attackSerial remains importable and normalizes on load", () => {
  const save = fullSave();
  const snapshot = save.world.snapshot as any;
  snapshot.v = 1;
  for (const enemy of snapshot.enemies) {
    delete enemy.telegraphs;
    delete enemy.attackSerial;
  }
  const restored = parseBackup(makeBackup(credentials, save));
  const sim = new Simulation(restored.save);
  assert(
    sim.state.enemies.every(
      (e) =>
        Array.isArray(e.telegraphs) &&
        e.telegraphs.length === 0 &&
        e.attackSerial === 0,
    ),
  );
  assert.doesNotThrow(() => validateSave(sim.exportSave()));
});

test("future content identifiers survive save validation while unsupported snapshot versions are rejected", () => {
  const save = fullSave();
  const snapshot = save.world.snapshot as any;
  save.chapterId = snapshot.chapterId = "ch08-distant-lighthouse";
  save.completedChapters = ["ch01-lantern-village", "ch07-star-dragon"];
  snapshot.players.gold.weapon = "future_weapon";
  snapshot.players.white.skills = ["future_skill", "heal"];
  save.world.futureChapter = { tide: 3 };
  const checked = validateSave(save);
  assert.deepEqual(checked, save);
  assert.throws(() => new Simulation(checked), /章节尚未安装/);
  snapshot.v = 99;
  assert.throws(() => validateSave(save), /场景版本/);
});

test("mismatched save/snapshot chapters reject, while matching legacy chapter aliases migrate together", () => {
  const save = fullSave();
  const snapshot = save.world.snapshot as any;
  snapshot.chapterId = "ch03";
  assert.throws(() => validateSave(save), /章节与场景快照不一致/);
  assert.throws(() => new Simulation(save), /章节与场景快照不一致/);
  save.chapterId = snapshot.chapterId = "ch01";
  snapshot.players.gold.x = 12;
  assert.doesNotThrow(() => validateSave(save));
  const sim = new Simulation(save);
  assert.equal(sim.state.chapterId, "ch01-lantern-village");
  assert.equal(sim.state.players.gold.x, 12);
  assert.doesNotThrow(() => validateSave(sim.exportSave()));
});

test("null, partial and mismatched-event snapshots cannot be mistaken for an absent snapshot", () => {
  const invalidSnapshots: JsonValue[] = [null, {}, { v: 1 }, []];
  for (const snapshot of invalidSnapshots) {
    const save = fullSave();
    save.world.snapshot = snapshot;
    assert.throws(() => validateSave(save), /快照/);
    assert.throws(() => new Simulation(save), /快照/);
  }
  const save = fullSave();
  const snapshot = save.world.snapshot as any;
  snapshot.events.push(structuredClone(snapshot.events[0]));
  assert.throws(() => validateSave(save), /事件序号/);
});

test("server refuses corrupted scene imports and preserves the exact healthy persisted revision", async () => {
  const dir = await mkdtemp(join(tmpdir(), "starlight-snapshot-restore-"));
  try {
    const hub = new RoomHub(new FileStore(dir));
    await hub.init();
    await hub.restore(credentials, fullSave());
    const before = (await hub.authorize(credentials)).save;
    for (const name of [
      "string position",
      "missing cooldowns",
      "enemy duplicate ID",
      "telegraph missing delay",
      "invalid event value",
    ]) {
      const bad = structuredClone(before);
      corruptions[name](bad.world.snapshot);
      await assert.rejects(
        hub.restore(credentials, JSON.parse(JSON.stringify(bad))),
        /快照/,
      );
    }
    const after = (await hub.authorize(credentials)).save;
    assert.deepEqual(after, before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
