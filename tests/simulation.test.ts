import { PLAYER_RADIUS, enemyRadius } from "../src/combat-contact";
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, type Enemy } from "../src/simulation";
import { CHAPTERS, type BossPhase, type Point } from "../src/content";
import { freshSave } from "../shared/save";

const roles = ["gold", "white"] as const;
const command = (
  actions: ("attack" | "skill1" | "skill2" | "dodge" | "interact")[] = [],
) => ({ x: 0, z: 0, actions });
function fixture(index = 0) {
  const save = freshSave("test_adventure");
  save.chapterId = CHAPTERS[index].id;
  const sim = new Simulation(save);
  // These are progression/combat logic fixtures; terrain traversal is covered separately.
  sim.setMovementWorld({surfaceAt:()=>({y:0,walkable:true,id:"ground"}),resolveAt:(x,z)=>({x,z})});
  return sim;
}
function step(sim: Simulation, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) sim.tick(0.05);
}
function place(sim: Simulation, position: Point, together = true) {
  Object.assign(sim.state.players.gold, position);
  if (together)
    Object.assign(sim.state.players.white, {
      x: position.x + 0.4,
      z: position.z,
    });
  for (const role of roles) {
    sim.state.players[role].invincible = 1e5;
    sim.command(role, command());
  }
}
function defeat(sim: Simulation, enemy: Enemy) {
  // Teleport only removes traversal from this deterministic logic test. Damage
  // is delivered by the same command/skill/cooldown path used in the game.
  for (let i = 0; enemy.hp > 0 && i < 500; i++) {
    for (const [offset, role] of roles.entries()) {
      const player = sim.state.players[role];
      // Default partner damage means two attackers must flank the enemy, not
      // overlap each other in front of it. Enemy remains the nearest target.
      player.x = enemy.x;
      player.z = enemy.z + (offset ? -1 : 1) * (PLAYER_RADIUS + enemyRadius(enemy) + .1);
      player.invincible = 1e5;
      player.weapon = "staff";
      sim.command(role, command(["attack", "skill1"]));
    }
    sim.tick(0.05);
  }
  assert.equal(enemy.hp, 0, `could not defeat ${enemy.id}`);
  assert.equal(enemy.state, "dead");
}
function clearNear(sim: Simulation, position: Point, includeBoss = false) {
  // Combat may trigger an ambush or draw another guard into the objective.
  for (let pass = 0; pass < 80; pass++) {
    place(sim, position);
    sim.tick(0.05);
    const enemy = sim.state.enemies.find(
      (e) =>
        (includeBoss || !e.boss) &&
        e.hp > 0 &&
        Math.hypot(e.x - position.x, e.z - position.z) < 15,
    );
    if (!enemy) return;
    defeat(sim, enemy);
  }
  assert.fail("objective area failed to clear");
}
function interact(sim: Simulation, position: Point) {
  place(sim, position);
  sim.command("gold", command(["interact"]));
  sim.tick(0.05);
}
function finishObjectives(sim: Simulation) {
  const chapter = sim.chapter;
  for (const id of chapter.quest.steps) {
    if (sim.state.flags.includes(id)) continue;
    const item = chapter.interactions.find((i) => i.id === id)!;
    clearNear(sim, item, true);
    if (item.kind === "plate") {
      const plates = chapter.interactions.filter((i) => i.pair === item.pair);
      for (const p of plates) clearNear(sim, p, true);
      Object.assign(sim.state.players.gold, plates[0]);
      Object.assign(sim.state.players.white, plates[1]);
      step(sim, 1.65);
    } else interact(sim, item);
    assert(sim.state.flags.includes(id), `objective ${id} did not complete`);
  }
}

test("legacy chapter IDs resume the right chapter and unknown future IDs cannot silently reset progress", () => {
  const save = freshSave("legacy");
  save.chapterId = "ch03";
  const sim = new Simulation(save);
  assert.equal(sim.chapter.id, CHAPTERS[2].id);
  assert.equal(sim.exportSave().chapterId, CHAPTERS[2].id);
  save.chapterId = "ch99-future";
  assert.throws(() => new Simulation(save), /章节尚未安装/);
});

test("append-only chapter registration retains an existing completed campaign and future world data", () => {
  const save = freshSave("extension");
  save.chapterId = CHAPTERS[2].id;
  save.completedChapters = CHAPTERS.slice(0, 2).map((c) => c.id);
  save.secrets = ["v-secret-paw"];
  save.world.futureData = { tide: 3 };
  const eighth = structuredClone(CHAPTERS[6]);
  eighth.id = "ch08-distant-lighthouse";
  eighth.index = 8;
  CHAPTERS.push(eighth);
  try {
    const resumed = new Simulation(save).exportSave();
    assert.equal(resumed.chapterId, CHAPTERS[2].id);
    assert.deepEqual(resumed.completedChapters, save.completedChapters);
    assert.deepEqual(resumed.secrets, save.secrets);
    assert.deepEqual(resumed.world.futureData, { tide: 3 });
    const future = structuredClone(resumed);
    future.chapterId = eighth.id;
    future.world = {};
    assert.equal(new Simulation(future).chapter.id, eighth.id);
  } finally {
    CHAPTERS.pop();
  }
});

test("attack cooldown and death settlement prevent repeated command damage or duplicate kills", () => {
  const sim = fixture();
  const enemy = sim.state.enemies[0];
  sim.state.enemies=[enemy]; // Isolate the one target whose exact cooldown damage this test asserts.
  place(sim, { x: enemy.x, z: enemy.z + 1 });
  sim.state.players.white.z=enemy.z-5; // Enemy-only cooldown assertion; keep ally outside the attack selection.
  sim.command("gold", command(["attack", "attack", "attack"]));
  sim.tick(0.01);
  assert.equal(enemy.hp, enemy.maxHp - 22);
  sim.command("gold", command(["attack"]));
  sim.tick(0.01);
  assert.equal(enemy.hp, enemy.maxHp - 22);
  defeat(sim, enemy);
  const deaths = sim.state.events.filter(
    (e) => e.type === "defeat" && e.x === enemy.x && e.z === enemy.z,
  ).length;
  sim.command("gold", command(["attack", "skill1"]));
  sim.tick(0.05);
  assert.equal(
    sim.state.events.filter(
      (e) => e.type === "defeat" && e.x === enemy.x && e.z === enemy.z,
    ).length,
    deaths,
  );
  assert.equal(enemy.hp, 0);
});

test("telegraphed enemy damage respects dodge invulnerability and actually hurts after it expires", () => {
  const sim = fixture();
  const enemy = sim.state.enemies[0];
  const p = sim.state.players.gold;
  p.x = enemy.x;
  p.z = enemy.z;
  p.invincible = 0;
  enemy.state = "warning";
  enemy.timer = 0.01;
  enemy.targetX = p.x;
  enemy.targetZ = p.z;
  enemy.telegraphs = [{ x: p.x, z: p.z, r: 2.5, delay: 0.01 }];
  sim.command("gold", command(["dodge"]));
  sim.tick(0.02);
  assert.equal(p.hp, 100);
  p.invincible = 0;
  p.action = "idle";
  p.actionTime = 0;
  enemy.state = "warning";
  enemy.timer = 0.01;
  enemy.targetX = p.x;
  enemy.targetZ = p.z;
  enemy.telegraphs = [{ x: p.x, z: p.z, r: 2.5, delay: 0.01 }];
  sim.tick(0.02);
  assert(p.hp < 100);
});

test("downed partner requires an actual nearby rescue and the rescue persists in a snapshot", () => {
  const sim = fixture();
  place(sim, sim.chapter.camp);
  sim.state.players.white.hp = 0;
  sim.command("gold", command(["interact"]));
  step(sim, 2.3);
  assert(sim.state.players.white.hp >= 65);
  assert(sim.state.players.white.invincible > 0);
  const resumed = new Simulation(sim.exportSave());
  assert.equal(resumed.state.players.white.hp, sim.state.players.white.hp);
});

test("main and side objectives cannot be skipped by visiting their reward first", () => {
  const sim = fixture();
  for (const id of [
    sim.chapter.quest.steps[2],
    sim.chapter.quest.side.steps[2],
  ]) {
    const item = sim.chapter.interactions.find((i) => i.id === id)!;
    clearNear(sim, item);
    interact(sim, item);
    assert(!sim.state.flags.includes(id));
  }
  assert(!sim.save.players.gold.unlockedSkins.includes("forest"));
});

test("side story rewards are awarded to both dogs once, after all three interactions", () => {
  const sim = fixture();
  const side = sim.chapter.quest.side;
  for (const id of side.steps) {
    const item = sim.chapter.interactions.find((i) => i.id === id)!;
    clearNear(sim, item);
    interact(sim, item);
  }
  assert(sim.state.flags.includes(side.id));
  for (const role of roles)
    assert.equal(
      sim.save.players[role].unlockedSkins.filter((s) => s === "forest").length,
      1,
    );
  const final = sim.chapter.interactions.find((i) => i.id === side.steps[2])!;
  interact(sim, final);
  assert.equal(sim.state.flags.filter((id) => id === side.id).length, 1);
});

test("pressure plates require prior objective, clear combat, two live dogs and uninterrupted simultaneous hold", () => {
  const sim = fixture(1);
  const plates = sim.chapter.interactions.filter((i) => i.kind === "plate");
  const stand = () => {
    Object.assign(sim.state.players.gold, plates[0]);
    Object.assign(sim.state.players.white, plates[1]);
    for (const r of roles) sim.state.players[r].invincible = 1e5;
  };
  stand();
  step(sim, 1.7);
  assert(!sim.state.flags.includes(plates[0].id));
  const first = sim.chapter.interactions.find(
    (i) => i.id === sim.chapter.quest.steps[0],
  )!;
  clearNear(sim, first);
  interact(sim, first);
  stand();
  step(sim, 0.5);
  assert(!sim.state.flags.includes(plates[0].id));
  for (const p of plates) clearNear(sim, p);
  stand();
  sim.state.players.white.hp = 0;
  step(sim, 1.7);
  assert(!sim.state.flags.includes(plates[0].id));
  sim.state.players.white.hp = 100;
  stand();
  step(sim, 0.7);
  sim.state.players.white.z += 5;
  step(sim, 0.1);
  assert.equal(sim.state.coop, 0);
  stand();
  step(sim, 1.65);
  assert(plates.every((p) => sim.state.flags.includes(p.id)));
});

test("world crisis spawns and settles once, with resolution preserved over reload", () => {
  const sim = fixture();
  place(sim, sim.chapter.event.trigger);
  sim.tick(0.05);
  const crisis = sim.chapter.event;
  const enemies = sim.state.enemies.filter((e) =>
    crisis.spawns.some((s) => e.id.startsWith(s.id + "-")),
  );
  assert.equal(
    enemies.length,
    crisis.spawns.reduce((n, e) => n + e.count, 0),
  );
  for (const enemy of enemies) defeat(sim, enemy);
  sim.tick(0.05);
  assert.equal(sim.save.quests[crisis.id + "-resolved"], true);
  const resumed = new Simulation(sim.exportSave());
  place(resumed, crisis.trigger);
  resumed.tick(0.05);
  assert.equal(
    resumed.state.enemies.filter((e) =>
      crisis.spawns.some((s) => e.id.startsWith(s.id + "-")),
    ).length,
    enemies.length,
  );
  assert.equal(
    resumed.state.flags.filter((id) => id === crisis.id + "-resolved").length,
    1,
  );
});

test("boss phase boundaries and hints are taken from the chapter data", () => {
  const sim = fixture(6);
  const boss = sim.state.enemies.find((e) => e.boss)!;
  place(sim, { x: boss.x, z: boss.z + 1 });
  boss.hp = boss.maxHp * 0.69;
  sim.tick(0.05);
  assert.equal(boss.phase, 2);
  assert(sim.state.events.some((e) => e.text?.includes("破碎的信任")));
  boss.hp = boss.maxHp * 0.39;
  sim.tick(0.05);
  assert.equal(boss.phase, 3);
  assert(sim.state.events.some((e) => e.text?.includes("最后的星暴")));
});

test("old snapshots gain empty telegraph arrays and duplicate enemy records are rejected", () => {
  const save = fixture().exportSave();
  const snapshot = save.world.snapshot as any;
  for (const enemy of snapshot.enemies) {
    delete enemy.telegraphs;
    delete enemy.attackSerial;
  }
  const resumed = new Simulation(save);
  assert(
    resumed.state.enemies.every(
      (e) =>
        Array.isArray(e.telegraphs) &&
        e.telegraphs.length === 0 &&
        e.attackSerial === 0,
    ),
  );
  snapshot.enemies.push(structuredClone(snapshot.enemies[0]));
  assert.throws(() => new Simulation(save), /敌人记录重复/);
});

function patternFixture(pattern: BossPhase["pattern"]) {
  const sim = fixture();
  sim.chapter = structuredClone(sim.chapter);
  const definition = sim.chapter.encounters.find((e) => e.boss)!;
  definition.phases = [
    { threshold: 1, label: "测试阶段", pattern, hint: "等待预兆后反击" },
  ];
  const boss = sim.state.enemies.find((e) => e.boss)!;
  sim.state.enemies = [boss];
  boss.timer = 0;
  boss.state = "chase";
  place(sim, { x: boss.x + (pattern === "charge" ? 6 : 2), z: boss.z + 1 });
  sim.state.players.white.x = boss.x + (pattern === "charge" ? 7 : -3);
  sim.tick(0.05);
  return { sim, boss };
}

for (const pattern of [
  "slam",
  "charge",
  "volley",
  "breath",
  "tail",
  "storm",
] as const)
  test(`boss ${pattern} has fair visible warning, real damage and a recovery window`, () => {
    const { sim, boss } = patternFixture(pattern);
    assert.equal(boss.state, "warning");
    assert.equal(boss.pattern, pattern);
    assert(
      boss.telegraphs.length > 0 &&
        boss.telegraphs.every((t) => t.delay >= 1 && t.r > 0),
    );
    const first = structuredClone(boss.telegraphs[0]);
    const gold = sim.state.players.gold;
    gold.x = first.x;
    gold.z = first.z;
    gold.invincible = 0;
    step(sim, 0.6);
    assert.equal(
      gold.hp,
      100,
      "cannot damage before the visible warning finishes",
    );
    step(sim, 0.65);
    assert(
      gold.hp < 100 || boss.telegraphs[0]?.delay > 0,
      "the target circle should either still warn or actually hit",
    );
    step(sim, 1.2);
    assert(gold.hp < 100, "standing in a telegraph must cause actual damage");
    assert.equal(boss.telegraphs.length, 0);
    assert(
      ["attack", "chase"].includes(boss.state),
      "after an attack there must be a safe recovery",
    );
  });

test("charge sweeps a corridor then changes boss position; breath covers three forward circles", () => {
  const charge = patternFixture("charge");
  const boss = charge.boss;
  assert.equal(boss.telegraphs.length, 3);
  const endpoint = { x: boss.targetX, z: boss.targetZ };
  const start = { x: boss.x, z: boss.z };
  step(charge.sim, 1.7);
  assert(Math.hypot(boss.x - start.x, boss.z - start.z) > 0.1, "charge visibly traverses its lane");
  assert(Math.hypot(boss.x - endpoint.x, boss.z - endpoint.z) >= PLAYER_RADIUS + enemyRadius(boss) - 0.01, "charge stops outside the occupied endpoint");
  const breath = patternFixture("breath");
  assert.equal(breath.boss.telegraphs.length, 3);
  const ranges = breath.boss.telegraphs.map((t) =>
    Math.hypot(t.x - breath.boss.x, t.z - breath.boss.z),
  );
  assert(ranges[0] < ranges[1] && ranges[1] < ranges[2]);
  assert(breath.boss.telegraphs[0].r < breath.boss.telegraphs[2].r);
});

test("volley and storm scatter sequential warnings, while tail warns a wide circle around the boss", () => {
  const volley = patternFixture("volley").boss;
  assert.equal(volley.telegraphs.length, 3);
  assert(
    volley.telegraphs[0].delay < volley.telegraphs[1].delay &&
      volley.telegraphs[1].delay < volley.telegraphs[2].delay,
  );
  assert(new Set(volley.telegraphs.map((t) => `${t.x},${t.z}`)).size > 1);
  const storm = patternFixture("storm").boss;
  assert.equal(storm.telegraphs.length, 5);
  assert(storm.telegraphs[4].delay - storm.telegraphs[0].delay >= 1.19);
  assert(new Set(storm.telegraphs.map((t) => `${t.x},${t.z}`)).size === 5);
  const tail = patternFixture("tail").boss;
  assert.equal(tail.telegraphs.length, 1);
  assert.equal(tail.telegraphs[0].x, tail.x);
  assert.equal(tail.telegraphs[0].z, tail.z);
  assert(tail.telegraphs[0].r > 5);
});

test("summon phase creates one distinct sprite batch and never repeats it after ticks or reload", () => {
  const sim = fixture();
  const boss = sim.state.enemies.find((e) => e.boss)!;
  sim.state.enemies = [boss];
  place(sim, { x: boss.x + 1, z: boss.z + 1 });
  boss.hp = boss.maxHp * 0.49;
  sim.tick(0.05);
  const summons = sim.state.enemies.filter((e) =>
    e.id.includes("-phase-2-guard-"),
  );
  assert.equal(summons.length, 2);
  assert(summons.every((e) => e.kind === "sprite"));
  step(sim, 0.5);
  assert.equal(
    sim.state.enemies.filter((e) => e.id.includes("-phase-2-guard-")).length,
    2,
  );
  for (const enemy of summons) defeat(sim, enemy);
  const resumed = new Simulation(sim.exportSave());
  step(resumed, 0.5);
  assert.equal(
    resumed.state.enemies.filter((e) => e.id.includes("-phase-2-guard-"))
      .length,
    2,
  );
  assert(
    resumed.state.enemies
      .filter((e) => e.id.includes("-phase-2-guard-"))
      .every((e) => e.hp === 0),
  );
});

test("defeating a boss cancels every pending dangerous telegraph", () => {
  const { sim, boss } = patternFixture("storm");
  assert(boss.telegraphs.length > 0);
  boss.hp = 1;
  place(sim, { x: boss.x, z: boss.z + 1 });
  sim.state.players.white.z=boss.z-5;
  sim.command("gold", command(["attack"]));
  sim.tick(0.05);
  assert.equal(boss.hp, 0);
  assert.deepEqual(boss.telegraphs, []);
  for (const role of roles) sim.state.players[role].invincible = 0;
  step(sim, 3);
  assert(roles.every((role) => sim.state.players[role].hp === 100));
});

test("loadout changes require a camp and unlocked choices; both dogs follow the same rule", () => {
  const sim = fixture();
  for (const role of roles) {
    const p = sim.state.players[role];
    Object.assign(p, sim.chapter.camp);
    sim.command(role, {
      ...command(),
      weapon: "bow",
      skin: "moon",
      skills: ["nova", "shield"],
    });
    assert.equal(p.weapon, "sword");
    assert.equal(p.skin, "base");
    sim.command(role, { ...command(), weapon: "staff" });
    assert.equal(p.weapon, "staff");
    p.z += 20;
    sim.command(role, { ...command(), weapon: "sword" });
    assert.equal(p.weapon, "staff");
  }
});

test("both dogs failing returns to checkpoint while keeping confirmed discoveries and growth", () => {
  const sim = fixture();
  // This checkpoint test uses flat ground; the separate jump-route test covers platform discoveries.
  const secret = sim.chapter.secrets.find(s => s.id === "v-secret-bell")!;
  interact(sim, secret);
  sim.state.checkpoint = { x: -6, z: 25 };
  for (const r of roles) sim.state.players[r].hp = 0;
  step(sim, 2.7);
  assert(roles.every((r) => sim.state.players[r].hp === 100));
  assert(sim.save.secrets.includes(secret.id));
  assert(sim.save.players.gold.unlockedSkills.includes("shield"));
  assert(Math.hypot(sim.state.players.gold.x + 6, sim.state.players.gold.z - 25) < 1, "return close to the checkpoint, allowing body clearance from its resident slime");
  step(sim, 0.3);
  for (const enemy of sim.state.enemies.filter(e => e.hp > 0))
    assert(Math.hypot(sim.state.players.gold.x - enemy.x, sim.state.players.gold.z - enemy.z) >= PLAYER_RADIUS + enemyRadius(enemy) - 0.01);
});

for (let index = 0; index < 7; index++)
  test(`chapter ${index + 1} completes through commands only after objectives, boss defeat and both-player gathering`, () => {
    // Isolate the boss gate with an objective-complete fixture before running
    // the real command-driven chapter below. Bosses can chase toward beacons.
    const gate = fixture(index);
    gate.state.flags = [...gate.chapter.quest.steps];
    place(gate, gate.chapter.exit);
    gate.tick(0.05);
    assert.equal(
      gate.chapter.id,
      CHAPTERS[index].id,
      "living boss must block exit",
    );
    const sim = fixture(index);
    const chapter = sim.chapter;
    place(sim, chapter.exit);
    sim.tick(0.05);
    assert.equal(sim.chapter.id, chapter.id);
    finishObjectives(sim);
    const boss = sim.state.enemies.find((e) => e.boss)!;
    defeat(sim, boss);
    const returnLight = chapter.interactions.find(i=>i.afterBoss);
    if (returnLight) interact(sim,returnLight);
    Object.assign(sim.state.players.gold, chapter.exit);
    Object.assign(sim.state.players.white, chapter.spawn);
    sim.tick(0.05);
    assert.equal(
      sim.chapter.id,
      chapter.id,
      "one dog alone must not transition",
    );
    place(sim, chapter.exit);
    sim.tick(0.05);
    assert(sim.save.completedChapters.includes(chapter.id));
    if (index < 6) assert.equal(sim.chapter.id, CHAPTERS[index + 1].id);
    else {
      assert.equal(sim.state.ended, true);
      const endingCount = sim.state.events.filter(
        (e) => e.type === "ending",
      ).length;
      step(sim, 1);
      assert.equal(
        sim.state.events.filter((e) => e.type === "ending").length,
        endingCount,
      );
      assert.equal(
        sim.save.completedChapters.filter((id) => id === chapter.id).length,
        1,
      );
    }
  });
