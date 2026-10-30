import { Color3, Constants, Mesh, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer, VertexData } from "@babylonjs/core";

const SAMPLES = 16, STRANDS = 2, LIFE = .32;
export const broomWakeStrength = (mounted: boolean, speed: number, landing: boolean) =>
  mounted && !landing && Number.isFinite(speed) ? Math.max(0, Math.min(1, (Math.abs(speed) - 1.4) / 8.6)) : 0;

/** One reusable world-space ribbon buffer; no particles or per-frame meshes. */
export function createBroomSpeedEffects(scene: Scene, rider: TransformNode) {
  const mesh = new Mesh("broom short speed wake", scene);
  mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = false;
  mesh.metadata = { cameraObstacle: false, broomSpeedEffect: true };
  const material = new StandardMaterial("broom pale air wake", scene);
  material.disableLighting = true; material.emissiveColor = Color3.FromHexString("#cce9db").toLinearSpace();
  material.diffuseColor = Color3.Black(); material.specularColor = Color3.Black();
  material.backFaceCulling = false; material.alphaMode = Constants.ALPHA_ADD; material.disableDepthWrite = true;
  mesh.useVertexColors = true; mesh.hasVertexAlpha = true; mesh.material = material;
  const count = SAMPLES * STRANDS * 2 + 4 * 4;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 4), indices: number[] = [];
  for (let s = 0; s < STRANDS; s++) for (let i = 0; i < SAMPLES - 1; i++) {
    const a = (s * SAMPLES + i) * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  for (let i = 0; i < 4; i++) { const a = SAMPLES * STRANDS * 2 + i * 4; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const data = new VertexData(); data.positions = positions; data.colors = colors; data.indices = indices; data.applyToMesh(mesh, true);
  const points = Array.from({ length: STRANDS }, () => Array.from({ length: SAMPLES }, () => Vector3.Zero()));
  const ages = new Float32Array(SAMPLES).fill(LIFE), energies = new Float32Array(SAMPLES);
  const anchors = [new Vector3(-.18, .61, -2.07), new Vector3(.18, .61, -2.07)];
  const current = [Vector3.Zero(), Vector3.Zero()], direction = Vector3.Zero(), view = Vector3.Zero(), width = Vector3.Zero();
  const scratch = Vector3.Zero(), streakA = Vector3.Zero(), streakB = Vector3.Zero();
  let strength = 0, clock = 0, sampleClock = 0;
  const vertex = (index: number, point: Vector3, alpha: number) => {
    const p = index * 3, c = index * 4;
    positions[p] = point.x; positions[p + 1] = point.y; positions[p + 2] = point.z;
    colors[c] = colors[c + 1] = colors[c + 2] = 1; colors[c + 3] = alpha;
  };
  return {
    update(dt: number, mounted: boolean, speed: number, landing = false) {
      dt = Math.max(0, Math.min(.06, dt)); clock += dt; sampleClock += dt;
      const target = rider.isEnabled() ? broomWakeStrength(mounted, speed, landing) : 0;
      strength += (target - strength) * Math.min(1, dt * (target > strength ? 12 : 24));
      for (let i = 0; i < SAMPLES; i++) ages[i] += dt;
      const matrix = rider.computeWorldMatrix(true);
      for (let s = 0; s < STRANDS; s++) Vector3.TransformCoordinatesToRef(anchors[s], matrix, current[s]);
      if (ages[0] < LIFE && Vector3.DistanceSquared(current[0], points[0][0]) > 64) { ages.fill(LIFE); energies.fill(0); }
      if (target > .01 && sampleClock >= .02) {
        for (let i = SAMPLES - 1; i > 0; i--) {
          ages[i] = ages[i - 1]; energies[i] = energies[i - 1];
          for (let s = 0; s < STRANDS; s++) points[s][i].copyFrom(points[s][i - 1]);
        }
        ages[0] = 0; energies[0] = strength; sampleClock = 0;
        for (let s = 0; s < STRANDS; s++) points[s][0].copyFrom(current[s]);
      }
      const camera = scene.activeCamera?.globalPosition;
      for (let s = 0; s < STRANDS; s++) for (let i = 0; i < SAMPLES; i++) {
        const point = ages[i] < LIFE ? points[s][i] : current[s];
        const next = points[s][Math.max(0, i - 1)]; next.subtractToRef(point, direction);
        if (direction.lengthSquared() < .0001) Vector3.TransformNormalToRef(Vector3.Forward(), matrix, direction);
        direction.normalize();
        if (camera) camera.subtractToRef(point, view); else view.set(0, 1, 0);
        Vector3.CrossToRef(direction, view, width); if (width.lengthSquared() < .0001) width.set(1, 0, 0);
        width.normalize().scaleInPlace((.024 + strength * .046) * (1 - i / SAMPLES));
        const fade = Math.max(0, 1 - ages[i] / LIFE), alpha = fade * fade * energies[i] * Math.min(1, strength * 3) * .32;
        point.subtractToRef(width, scratch); vertex((s * SAMPLES + i) * 2, scratch, alpha);
        point.addToRef(width, scratch); vertex((s * SAMPLES + i) * 2 + 1, scratch, alpha);
      }
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1, phase = (clock * (1.5 + strength * 2) + i * .27) % 1;
        const x = side * (.52 + (i > 1 ? .23 : 0)), y = .62 + (i > 1 ? .34 : -.16), z = -.25 - phase * 2.1;
        Vector3.TransformCoordinatesToRef(new Vector3(x, y, z), matrix, streakA);
        Vector3.TransformCoordinatesToRef(new Vector3(x, y, z - .20 - strength * .65), matrix, streakB);
        Vector3.TransformNormalToRef(new Vector3(.013 + strength * .012, 0, 0), matrix, width);
        const alpha = Math.sin(phase * Math.PI) * strength * .23, a = SAMPLES * STRANDS * 2 + i * 4;
        streakA.subtractToRef(width, scratch); vertex(a, scratch, alpha); streakA.addToRef(width, scratch); vertex(a + 1, scratch, alpha);
        streakB.subtractToRef(width, scratch); vertex(a + 2, scratch, 0); streakB.addToRef(width, scratch); vertex(a + 3, scratch, 0);
      }
      mesh.setEnabled(strength > .004);
      if (mesh.isEnabled()) {
        mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true, false);
        mesh.updateVerticesData(VertexBuffer.ColorKind, colors, false, false);
      }
    },
    dispose() { mesh.dispose(); material.dispose(); },
  };
}
