import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NullEngine, Scene, Vector3, VertexBuffer } from '@babylonjs/core';
import { createDog, type DogMotionState } from '../src/actors';

for (const [role, expected] of [
  ['white', '680db497446fdaffc91dbb497a73e179c1be8b1e01d875edb5d063b85d26b5b0'],
  ['gold', '4d317ef39651b40c4faad422cf0acf492e52abc7ab9e3bb55ced06bbe3c1652f'],
] as const) test(`${role}: retained studio topology, V14 local neck/chest edit and source rig motion and GPU skin deformation`, () => {
  const bytes = readFileSync(`tools/${role}-v6-blender.geometry.json`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  const model = JSON.parse(bytes.toString());
  const motion = JSON.parse(readFileSync(`tools/${role}-studio-motion.json`, 'utf8'));
  assert.deepEqual(motion.bones, model.bones);
  assert.equal(model.bones.length, 9);
  for (const clip of ['walk', 'mount', 'jump', 'land']) {
    assert.equal(motion.clips[clip].frames.length, 25);
    assert.ok(motion.clips[clip].frames.flat(2).every(Number.isFinite));
  }
  const engine = new NullEngine({ renderWidth: 64, renderHeight: 64, textureSize: 64, deterministicLockstep: false, lockstepMaxSteps: 1 });
  const scene = new Scene(engine), dog = createDog(scene, role);
  const poses: Partial<DogMotionState>[] = [
    {}, {speed: 3.5}, {speed: 6.2, sprinting: true},
    {grounded: false, vy: 4}, {landing: .2}, {action: 'attack'},
    {action: 'cast'}, {action: 'hit'}, {duo:'cuddle',duoTime:2}, {duo:'rider'}, {duo:'carrier'}, {homePose:'sit',homeBlend:1}, {homePose:'lie',homeBlend:1}, {mounted: true, flightSpeed: 8, flightTurn: .6},
  ];
  try {
    dog.setLoadout('staff', 'forest');
    const rendered = Object.fromEntries(model.meshes.map((part: any) => [part.name, dog.root.getChildMeshes().find(m => m.name.endsWith('-' + part.name))!]));
    const base = model.meshes.find((p: any) => p.name === 'body');
    const basePoints = new Map<string, number>();
    for (let i = 0; i < base.positions.length; i += 3)
      basePoints.set(base.positions.slice(i, i + 3).map((v: number, k: number) => (v + base.pivot[k]).toFixed(5)).join(','), i);
    const seams: {name: string; a: number; b: number}[] = [];
    for (const name of ['ear_left', 'ear_right']) {
      const part = model.meshes.find((p: any) => p.name === name);
      for (let i = 0; i < part.positions.length; i += 3) {
        const key = part.positions.slice(i, i + 3).map((v: number, k: number) => (v + part.pivot[k]).toFixed(5)).join(',');
        const b = basePoints.get(key);
        if (b !== undefined) seams.push({name, a: i, b});
      }
    }
    assert.ok(seams.length > 20);
    for (const pose of poses) {
      for (let i = 0; i < 24; i++) dog.update(1 / 60, {time: i / 60, speed: 0, action: 'idle', grounded: true, ...pose});
      let lowest = Infinity, highest = -Infinity;
      for (const part of model.meshes) {
        const mesh = rendered[part.name], positions = mesh.getPositionData(true,false)!;
        const matrix = mesh.computeWorldMatrix(true);
        assert.ok(positions.every(Number.isFinite), part.name);
        for (let i = 0; i < positions.length; i += 3) {
          const v = Vector3.TransformCoordinates(Vector3.FromArray(positions, i), matrix);
          lowest = Math.min(lowest, v.y); highest = Math.max(highest, v.y);
        }
      }
      assert.ok(highest - lowest > (pose.homePose==='lie'?1:1.3) && highest - lowest < 3.3, JSON.stringify(pose));
      if(pose.homePose==='lie'){
        const mesh=rendered.body,positions=mesh.getPositionData(true,false)!,matrix=mesh.computeWorldMatrix(true);
        let back=Infinity;
        for(let i=0;i<positions.length;i+=3)if(base.positions[i+1]+base.pivot[1]<1.1)
          back=Math.min(back,Vector3.TransformCoordinates(Vector3.FromArray(positions,i),matrix).y);
        assert(back>=-.025&&back<.06,`lying torso meets mattress without sinking or hovering: ${back}`);
      }
      if (!pose.mounted && !pose.homePose && pose.duo!=='rider' && pose.grounded !== false) assert.ok(lowest >= -.025, `foot penetration ${lowest}`);
      for (const pair of seams) {
        const ear = rendered[pair.name], body = rendered.body;
        const a = Vector3.TransformCoordinates(Vector3.FromArray(ear.getPositionData(true,false)!, pair.a), ear.computeWorldMatrix(true));
        const b = Vector3.TransformCoordinates(Vector3.FromArray(body.getPositionData(true,false)!, pair.b), body.computeWorldMatrix(true));
        assert.ok(Vector3.Distance(a, b) < .003, `ear seam ${pair.name}`);
      }
    }
    dog.dispose();
    assert.equal(scene.getTransformNodeByName(dog.root.name), null);
  } finally { scene.dispose(); engine.dispose(); }
});
