import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, TransformNode, VertexBuffer } from "@babylonjs/core";
import { broomWakeStrength, createBroomSpeedEffects } from "../src/broom-speed-effects";

test("broom wake scales with speed and excludes ground, landing and invalid input", () => {
  assert.equal(broomWakeStrength(false, 11, false), 0);
  assert.equal(broomWakeStrength(true, 11, true), 0);
  assert.equal(broomWakeStrength(true, 0, false), 0);
  assert.equal(broomWakeStrength(true, NaN, false), 0);
  assert.ok(broomWakeStrength(true, 4, false) < broomWakeStrength(true, 9, false));
  assert.equal(broomWakeStrength(true, 20, false), 1);
});

test("broom wake reuses bounded geometry, fades quickly, survives teleport and disposes", () => {
  const engine = new NullEngine(), scene = new Scene(engine), root = new TransformNode("rider", scene);
  const effects = createBroomSpeedEffects(scene, root), mesh = scene.getMeshByName("broom short speed wake")!;
  const resources = { meshes: scene.meshes.length, materials: scene.materials.length, geometries: scene.geometries.length };
  for (let i = 0; i < 300; i++) { root.position.z += 11 / 60; effects.update(1 / 60, true, 11); }
  assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, geometries: scene.geometries.length }, resources);
  assert.equal(mesh.getTotalVertices(), 80); assert.equal(mesh.getTotalIndices() / 3, 68);
  assert.ok(mesh.isEnabled());
  const colors = mesh.getVerticesData(VertexBuffer.ColorKind)!;
  assert.ok(colors.some((v, i) => i % 4 === 3 && v > .1));
  const before = [...mesh.getVerticesData(VertexBuffer.PositionKind)!];
  root.position.z += 100; effects.update(1 / 60, true, 11);
  assert.ok(mesh.getVerticesData(VertexBuffer.PositionKind)!.every(Number.isFinite));
  assert.ok(before.some((v, i) => v !== mesh.getVerticesData(VertexBuffer.PositionKind)![i]));
  for (let i = 0; i < 20; i++) effects.update(1 / 60, true, 11, true);
  assert.equal(mesh.isEnabled(), false);
  for (let i = 0; i < 30; i++) { root.position.z += .15; effects.update(1 / 60, true, 9); }
  for (let i = 0; i < 20; i++) effects.update(1 / 60, true, 0);
  assert.equal(mesh.isEnabled(), false);
  effects.update(.06, false, 0);
  effects.dispose(); root.dispose();
  assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0);
  scene.dispose(); engine.dispose();
});
