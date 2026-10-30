import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CHAPTERS } from "../src/content";

test("campaign has seven uniquely identified chapters and seven distinct biomes", () => {
  assert.equal(CHAPTERS.length, 7);
  assert.equal(new Set(CHAPTERS.map((c) => c.id)).size, 7);
  assert.equal(new Set(CHAPTERS.map((c) => c.biome)).size, 7);
  assert.deepEqual(
    CHAPTERS.map((c) => c.index),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test("all interactive, encounter, path and landmark save keys are globally unique", () => {
  const keys = new Set<string>();
  for (const c of CHAPTERS)
    for (const entry of [
      c,
      ...c.interactions,
      ...c.secrets,
      ...c.encounters,
      ...c.event.spawns,
      ...c.landmarks,
      ...c.paths,
      ...(c.terrain.platforms ?? []),
      c.event,
      c.quest.side,
    ]) {
      assert(!keys.has(entry.id), `duplicate content key ${entry.id}`);
      assert.match(entry.id, /^[a-zA-Z0-9_-]+$/);
      keys.add(entry.id);
    }
});

test("every chapter has a complete main route, three-step side story, at least two secrets and an encounter event", () => {
  for (const c of CHAPTERS) {
    const interactions = new Map(c.interactions.map((i) => [i.id, i]));
    assert(c.quest.steps.length >= 3);
    assert.equal(c.quest.side.steps.length, 3);
    for (const id of c.quest.steps)
      assert.equal(interactions.get(id)?.questRole, "main");
    for (const id of c.quest.side.steps)
      assert.equal(interactions.get(id)?.questRole, "side");
    assert(c.secrets.length >= 2);
    assert(c.secrets.every((s) => s.hint.length > 10 && s.text.length > 10));
    assert(
      c.event.spawns.length > 0 &&
        c.event.description.length > 10 &&
        c.event.resolution.length > 10,
    );
    assert(c.intro.length >= 2 && c.ending.length >= 2);
  }
});

test("only river and castle use simultaneous paired pressure plates", () => {
  for (const c of CHAPTERS) {
    const plates = c.interactions.filter((i) => i.kind === "plate");
    assert.equal(plates.length, [2, 5].includes(c.index) ? 2 : 0);
    if (plates.length) {
      assert.equal(plates[0].pair, plates[1].pair);
      assert(
        Math.hypot(plates[0].x - plates[1].x, plates[0].z - plates[1].z) > 3.2,
      );
      assert(c.quest.steps.indexOf(plates[0].id) > 0);
    }
  }
});

test("interaction positions are navigable, in bounds and separated from the initial camp", () => {
  for (const c of CHAPTERS)
    for (const p of [...c.interactions, ...c.secrets]) {
      assert(Math.abs(p.x) < 39 && p.z >= -20 && p.z <= 112, p.id);
      if (p.questRole === "main")
        assert(Math.hypot(p.x - c.camp.x, p.z - c.camp.z) > 12, p.id);
      assert(
        !!p.surfaceId || !(c.terrain.water ?? []).some(
          (w) =>
            Math.abs(p.x - w.x) < w.width / 2 &&
            Math.abs(p.z - w.z) < w.depth / 2,
        ),
        `interaction submerged: ${p.id}`,
      );
    }
  const river = CHAPTERS[1];
  for (const water of river.terrain.water!)
    assert(
      river.paths.some(
        (p) =>
          p.kind === "bridge" &&
          p.points.some(([x, z]) => z < water.z - water.depth / 2) &&
          p.points.some(([x, z]) => z > water.z + water.depth / 2),
      ),
    );
});

test("map layouts have genuinely different branch geometry and phased bosses", () => {
  assert.equal(
    new Set(CHAPTERS.map((c) => JSON.stringify(c.paths.map((p) => p.points))))
      .size,
    7,
  );
  for (const c of CHAPTERS) {
    assert(
      c.paths.length >= 3 &&
        c.paths.every((p) => p.points.length >= 2 && p.width > 1),
    );
    const bosses = c.encounters.filter((e) => e.boss);
    assert.equal(bosses.length, 1);
    assert(bosses[0].z >= 85 && bosses[0].z < c.exit.z);
    const phases = bosses[0].phases!;
    assert(phases.length >= 2 && phases[0].threshold === 1);
    for (let i = 1; i < phases.length; i++)
      assert(phases[i].threshold < phases[i - 1].threshold);
    assert(phases.every((p) => p.hint && p.label && p.threshold > 0));
  }
});

test("all data rewards reference equipment, skills and cosmetics implemented by the simulation", () => {
  for (const c of CHAPTERS)
    for (const r of [...c.interactions, ...c.secrets, c.quest.side, c.event]
      .map((v) => v.reward)
      .filter(Boolean)) {
      if (r!.weapon)
        assert(["sword", "staff", "bow", "chime"].includes(r!.weapon));
      if (r!.skill)
        assert(["spark", "heal", "nova", "shield"].includes(r!.skill));
      if (r!.skin) assert(["base", "forest", "moon"].includes(r!.skin));
    }
});

test("eight original WAV files match their declared format, size, length and safe peak", async () => {
  const dir = new URL("../public/assets/audio/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", dir), "utf8"),
  );
  assert.equal(manifest.tracks.length, 8);
  for (const track of manifest.tracks) {
    const bytes = await readFile(new URL(track.file, dir));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.readUInt16LE(20), 1);
    assert.equal(bytes.readUInt16LE(22), 2);
    assert.equal(track.sampleRate, 24000);
    assert.equal(bytes.readUInt32LE(24), track.sampleRate);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.length, track.bytes);
    assert(
      Math.abs((bytes.length - 44) / (track.sampleRate * 4) - track.duration) < 0.001,
    );
    assert(track.peak > 0.1 && track.peak < 1 && track.rms > 0.01);
  }
});
