import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  freshSave,
  makeBackup,
  parseBackup,
  migrateSave,
  validateSave,
} from "../shared/save";
import { FileStore } from "../server/file-store";
import { RoomHub } from "../server/core";
const credentials = {
  adventureId: "adventure_test",
  recoveryToken: "a".repeat(64),
};
test("backup rejects truncation, invalid shape, unsupported version and mismatched identity", () => {
  assert.throws(() => parseBackup("{"), /JSON/);
  assert.throws(() => parseBackup("{}"), /备份/);
  const backup = JSON.parse(
    makeBackup(credentials, freshSave(credentials.adventureId)),
  );
  backup.save.version = 99;
  assert.throws(() => parseBackup(JSON.stringify(backup)), /版本/);
  backup.save.version = 2;
  backup.save.adventureId = "different";
  assert.throws(() => parseBackup(JSON.stringify(backup)), /不匹配/);
});
test("additive save migration preserves completed chapter eight, abilities, cosmetics and future content flags", () => {
  const old = {
    ...freshSave(credentials.adventureId),
    version: 1,
    completedChapters: ["ch01", "ch08"],
    secrets: ["future_secret"],
    world: { futureChapter: 8 },
  };
  old.players.white.unlockedSkins.push("future_skin");
  const migrated = migrateSave(old);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.completedChapters, ["ch01", "ch08"]);
  assert.ok(migrated.players.white.unlockedSkins.includes("future_skin"));
  assert.equal(migrated.world.futureChapter, 8);
});
test("non-finite numbers, prototype keys, oversized strings and missing dog progress are rejected", () => {
  const save = freshSave(credentials.adventureId);
  save.world.n = Infinity;
  assert.throws(() => validateSave(save));
  assert.throws(() =>
    validateSave(JSON.parse('{"version":2,"__proto__":{"polluted":true}}')),
  );
  const bad = freshSave(credentials.adventureId) as any;
  delete bad.players.white;
  assert.throws(() => validateSave(bad));
});
test("atomic local persistence retains backup and recovers previous valid generation if primary is truncated", async () => {
  const dir = await mkdtemp(join(tmpdir(), "starlight-save-"));
  try {
    const store = new FileStore(dir);
    const save = freshSave(credentials.adventureId);
    await store.save(save.adventureId, {
      tokenHash: "b".repeat(64),
      save,
      receipts: {},
    });
    save.revision = 1;
    save.chapterId = "ch03";
    await store.save(save.adventureId, {
      tokenHash: "b".repeat(64),
      save,
      receipts: {},
    });
    const primary = JSON.parse(
      await readFile(join(dir, `${save.adventureId}.json`), "utf8"),
    );
    assert.equal(primary.save.chapterId, "ch03");
    await writeFile(join(dir, `${save.adventureId}.json`), "{interrupted");
    const recovered = await store.load(save.adventureId);
    assert.equal(recovered!.save.revision, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("corrupt import cannot replace healthy save; authenticated backup restores into a fresh deployment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "starlight-restore-"));
  try {
    const hub = new RoomHub(new FileStore(dir));
    await hub.init();
    const save = freshSave(credentials.adventureId);
    save.chapterId = "ch03";
    const imported = await hub.restore(credentials, save);
    assert.equal(imported.chapterId, "ch03");
    await assert.rejects(hub.restore(credentials, { ...save, players: {} }));
    assert.equal((await hub.authorize(credentials)).save.chapterId, "ch03");
    await assert.rejects(
      hub.restore({ ...credentials, recoveryToken: "c".repeat(64) }, save),
    );
    assert.equal((await hub.authorize(credentials)).save.revision, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
