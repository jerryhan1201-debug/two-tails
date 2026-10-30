import {recordedSkin} from "./recorded-skin";
import {
  Color3,
  Mesh,
  MeshBuilder,
  Matrix,
  Quaternion,
  PBRMaterial,
  RawTexture,
  Texture,
  Scene,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import goldModel from "../tools/gold-v6-blender.geometry.json";
import whiteModel from "../tools/white-v6-blender.geometry.json";
import goldMotion from "../tools/gold-studio-motion.json";
import whiteMotion from "../tools/white-studio-motion.json";
import { createBroomSpeedEffects } from "./broom-speed-effects";

export type DogKind = "gold" | "white";
export interface DogMotionState {
  animalGesture?:{kind:'greet'|'pet'|'play';elapsed:number;remaining:number};
  homePose?:'sit'|'lie';
  homeBlend?:number;
  duo?:'rider'|'carrier'|'cuddle';
  duoTime?:number;
  speed: number;
  action: string;
  time: number;
  direction?: number;
  /** Remaining action seconds from a synchronized snapshot, if available. */
  actionTime?: number;
  /** Authoritative movement state; the renderer owns world height. */
  sprinting?: boolean;
  grounded?: boolean;
  vy?: number;
  landing?: number;
  /** Render-only riding pose. World height and flight authority stay in simulation. */
  swim?:'land'|'surface'|'underwater';
  mounted?: boolean;
  flightSpeed?: number;
  flightTurn?: number;
  flightPhase?: "grounded" | "flying" | "landing";
}
export interface DogActor {
  root: TransformNode;
  update(dt: number, state: DogMotionState): void;
  setLoadout(weapon: string, skin: string): void;
  showEquipment(visible: boolean, clothingVisible?: boolean): void;
  dispose(): void;
}
interface SculptMesh {
  name: string;
  pivot: number[];
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
  /** Weights interpolated by Blender Subdivision from editable cage groups. */
  weights?: number[][][];
  uvs?: number[];
}

const TAU = Math.PI * 2;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
let serial = 0;

/** Reference-guided project-authored mesh; reference rights unchanged. +Z forward. */
export function createDog(scene: Scene, kind: DogKind): DogActor {
  const id = `${kind}-${++serial}`;
  const root = new TransformNode(`dog-${id}`, scene);
  const motion = new TransformNode(`dog-motion-${id}`, scene);
  motion.parent = root;
  const broomWake = createBroomSpeedEffects(scene, root);
  const head = new TransformNode(`dog-head-${id}`, scene);
  head.parent = motion;
  head.position.y = 1.22;
  const materials: PBRMaterial[] = [];
  const makeMaterial = (
    name: string,
    hex: string,
    roughness = 0.78,
    metal = 0,
    glow = 0,
  ) => {
    const mat = new PBRMaterial(`${id}-${name}`, scene);
    mat.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    mat.roughness = roughness;
    mat.metallic = metal;
    mat.backFaceCulling = false;
    if (glow) mat.emissiveColor = mat.albedoColor.scale(glow);
    materials.push(mat);
    return mat;
  };
  const plush = makeMaterial("satin-plush", "#ffffff", 0.87);
  plush.backFaceCulling = true;
  // Broad, restrained fiber sheen keeps the reference's soft toy response.
  // Vertex color is linear reflectance; world fill remains responsible for light.
  plush.directIntensity = kind === "white" ? 1.40 : 1.12;
  plush.indexOfRefraction = 1.26;
  plush.subSurface.isTranslucencyEnabled = true;
  plush.subSurface.translucencyIntensity = kind === "white" ? 0.10 : 0.065;
  plush.subSurface.tintColor = kind === "white" ? new Color3(1, .96, .91) : new Color3(1, .84, .62);
  plush.sheen.isEnabled = true;
  plush.sheen.intensity = kind === "white" ? 0.56 : 0.30;
  plush.sheen.color = kind === "gold" ? new Color3(1, 0.82, 0.57) : new Color3(1, 0.98, 0.94);
  plush.sheen.roughness = 0.84;
  plush.sheen.albedoScaling = true;
  // A tiny original tangent-normal fiber texture. Its amplitude is deliberately
  // below silhouette scale, so it cannot conceal curvature or normal defects.
  const fiberSize = 128, fiberPixels = new Uint8Array(fiberSize * fiberSize * 4);
  let fiberSeed = 7429;
  const fiberRandom = () => { fiberSeed = (Math.imul(fiberSeed, 1664525) + 1013904223) >>> 0; return fiberSeed / 4294967296; };
  for (let i = 0; i < fiberPixels.length; i += 4) {
    fiberPixels[i] = 128 + Math.round((fiberRandom() - 0.5) * 18);
    fiberPixels[i + 1] = 128 + Math.round((fiberRandom() - 0.5) * 18);
    fiberPixels[i + 2] = 255; fiberPixels[i + 3] = 255;
  }
  const fiberTexture = RawTexture.CreateRGBATexture(fiberPixels, fiberSize, fiberSize, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  fiberTexture.name = `${id}-original-microfiber-normal`;
  fiberTexture.wrapU = fiberTexture.wrapV = Texture.WRAP_ADDRESSMODE;
  fiberTexture.uScale = 5; fiberTexture.vScale = 5;
  fiberTexture.level = kind === "white" ? 0.38 : 0.18;
  plush.bumpTexture = fiberTexture;
  const features = makeMaterial("felt-charcoal", "#ffffff", 0.84);
  features.backFaceCulling = true;
  const leather = makeMaterial("warm-leather", "#634732", 0.87);
  const brass = makeMaterial("antique-gold", "#E4B768", 0.32, 0.55);
  const steel = makeMaterial("moon-silver", "#D5E4ED", 0.28, 0.6);
  const darkSteel = makeMaterial("blade-edge", "#A8C9D7", 0.36, 0.52);
  const green = makeMaterial("forest-velvet", "#416651", 0.95);
  const greenTrim = makeMaterial("sage-lining", "#91AC79", 0.9);
  const blue = makeMaterial("midnight-velvet", "#3A446C", 0.88);
  const blueTrim = makeMaterial("moon-lining", "#94AAC8", 0.78);
  const gem = makeMaterial("starlight", "#A8EFF1", 0.25, 0.18, 0.75);
  const amber = makeMaterial("amber-starlight", "#FFE8A0", 0.28, 0.22, 0.48);
  const red = makeMaterial("collar-red", "#DE5552", 0.68);

  const rigModel = kind === "gold" ? goldModel : whiteModel;
  // Preserve V7 choreography on the selected studio's own bind skeleton.
  const clips = { ...rigModel.clips, ...(kind === "gold" ? goldMotion : whiteMotion).clips };
  const ridingMatrices = clips.mount.frames[0].map(m => m.slice());
  for (const side of ["left", "right"] as const) {
    const arm = ridingMatrices[rigModel.bones.indexOf(`arm_${side}`)];
    arm[14] += kind === "white" ? .225 : .165;
    arm[13] -= kind === "white" ? .020 : .140;
  }
  const shoulderRide=ridingMatrices.map(m=>m.slice());
  for(const [side,sign]of [['left',-1],['right',1]] as const){const leg=shoulderRide[rigModel.bones.indexOf('leg_'+side)];leg[12]+=sign*.19;leg[14]-=.06;const arm=shoulderRide[rigModel.bones.indexOf('arm_'+side)];arm[12]+=sign*.06;arm[13]-=.12;arm[14]+=.10;}
  const sittingMatrices=clips.idle.frames[0].map(m=>m.slice());
  for(const side of ['left','right']){const i=rigModel.bones.indexOf('leg_'+side),bend=Matrix.Translation(0,-.44,0).multiply(Matrix.RotationX(-1.03)).multiply(Matrix.Translation(0,.43,.18));sittingMatrices[i]=Array.from(Matrix.FromArray(sittingMatrices[i]).multiply(bend).m);}
  for(const [side,sign]of [['left',-1],['right',1]] as const){const i=rigModel.bones.indexOf('arm_'+side);const shoulderX=kind==='gold'?.54:.4371,shoulderY=kind==='gold'?.985132:.801676;const bend=Matrix.Translation(-sign*shoulderX,-shoulderY,-.01).multiply(Matrix.RotationX(-.85)).multiply(Matrix.Translation(sign*(shoulderX-.06),shoulderY-.035,.16));sittingMatrices[i]=Array.from(Matrix.FromArray(sittingMatrices[i]).multiply(bend).m);}
  const geometry = rigModel.meshes as SculptMesh[];
  const parts = new Map<string, Mesh>();
  const skinBuffers = new Map<string, { part: SculptMesh; mesh: Mesh; positions: Float32Array; normals: Float32Array; gpu:ReturnType<typeof recordedSkin> }>();
  let bodyBase: number[] = [];
  let bodyDeformed = new Float32Array(0);
  let bodyBaseNormals: number[] = [];
  let bodyNormals = new Float32Array(0);
  const legOffsets: number[] = [];
  for (const part of geometry) {
    const mesh = new Mesh(`${id}-${part.name}`, scene);
    const data = new VertexData();
    data.positions = part.positions;
    data.normals = part.normals;
    // Sculpt/GLB data has glTF right-handed winding. Babylon defaults to left-handed.
    data.indices = part.indices.slice();
    if (!scene.useRightHandedSystem)
      for (let i = 0; i < data.indices.length; i += 3) {
        const b = data.indices[i + 1];
        data.indices[i + 1] = data.indices[i + 2];
        data.indices[i + 2] = b;
      }
    data.colors = part.colors;
    data.uvs = part.uvs?.slice() ?? [];
    for (let i = 0; !part.uvs && i < part.positions.length; i += 3) {
      const x = part.positions[i], y = part.positions[i + 1], z = part.positions[i + 2];
      data.uvs.push(Math.atan2(x, z) / TAU + 0.5, y * 0.62);
    }
    data.applyToMesh(mesh, part.name === "body" || !!part.weights);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.material = /^(eye|nose|mouth)/.test(part.name) ? features : plush;
    if (part.name.startsWith("fur_")) {
      mesh.parent = parts.get(part.name.slice(4))!;
      mesh.position.set(0, 0, 0);
    } else if (/^(head|eye|nose|mouth)/.test(part.name)) {
      mesh.parent = head;
      mesh.position.set(part.pivot[0], part.pivot[1] - 1.22, part.pivot[2]);
    } else if (part.name.startsWith("ear")) {
      mesh.parent = head;
      mesh.position.set(part.pivot[0], part.pivot[1] - 1.22, part.pivot[2]);
    } else {
      mesh.parent = motion;
      mesh.position.set(...(part.pivot as [number, number, number]));
    }
    parts.set(part.name, mesh);
    if (part.weights) skinBuffers.set(part.name, { part, mesh, positions: new Float32Array(part.positions), normals: new Float32Array(part.normals),gpu:recordedSkin(scene,mesh,rigModel.bones,part.weights,part.pivot) });
    if (part.name === "body") {
      bodyBase = part.positions;
      bodyBaseNormals = part.normals;
      bodyNormals = new Float32Array(part.normals);
      bodyDeformed = new Float32Array(bodyBase);
      for (let i = 0; i < bodyBase.length; i += 3)
        if (bodyBase[i + 1] < 0.68) legOffsets.push(i);
      // The original continuous torso and legs remain one mesh while walking.
      mesh.alwaysSelectAsActiveMesh = true;
    }
  }

  const meshWith = (
    mesh: Mesh,
    parent: TransformNode,
    material: PBRMaterial,
  ) => {
    mesh.parent = parent;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  };
  const tube = (
    name: string,
    points: Vector3[],
    radius: number,
    parent: TransformNode,
    material: PBRMaterial,
    tessellation = 8,
  ) =>
    meshWith(
      MeshBuilder.CreateTube(
        `${id}-${name}`,
        { path: points, radius, tessellation, cap: Mesh.CAP_ALL },
        scene,
      ),
      parent,
      material,
    );
  const ball = (
    name: string,
    position: Vector3,
    size: Vector3,
    parent: TransformNode,
    material: PBRMaterial,
    segments = 12,
  ) => {
    const m = meshWith(
      MeshBuilder.CreateSphere(
        `${id}-${name}`,
        { diameter: 1, segments },
        scene,
      ),
      parent,
      material,
    );
    m.position.copyFrom(position);
    m.scaling.copyFrom(size);
    return m;
  };
  const ring = (
    name: string,
    rx: number,
    rz: number,
    y: number,
    radius: number,
    parent: TransformNode,
    material: PBRMaterial,
  ) => {
    const points = Array.from(
      { length: 49 },
      (_, i) =>
        new Vector3(
          Math.sin((i * TAU) / 48) * rx,
          y - Math.cos((i * TAU) / 48) * (name.includes("neck") ? 0.040 : 0.014),
          Math.cos((i * TAU) / 48) * rz,
        ),
    );
    return tube(name, points, radius, parent, material);
  };
  const star = (
    name: string,
    radius: number,
    depth: number,
    parent: TransformNode,
    material: PBRMaterial,
  ) => {
    const positions: number[] = [],
      indices: number[] = [];
    for (const z of [-depth / 2, depth / 2]) {
      positions.push(0, 0, z);
      for (let j = 0; j < 10; j++) {
        const a = (j * Math.PI) / 5,
          r = radius * (j % 2 ? 0.47 : 1);
        positions.push(Math.sin(a) * r, Math.cos(a) * r, z);
      }
    }
    for (let j = 0; j < 10; j++) {
      const a = 1 + j,
        b = 1 + ((j + 1) % 10);
      indices.push(
        0,
        b,
        a,
        11,
        11 + a,
        11 + b,
        a,
        b,
        11 + a,
        b,
        11 + b,
        11 + a,
      );
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const v = new VertexData();
    v.positions = positions;
    v.indices = indices;
    v.normals = normals;
    const m = new Mesh(`${id}-${name}`, scene);
    v.applyToMesh(m);
    return meshWith(m, parent, material);
  };

  const wardrobe = new TransformNode(`${id}-wardrobe`, scene);
  wardrobe.parent = motion;
  const forest = new TransformNode(`${id}-forest`, scene);
  forest.parent = wardrobe;
  const moon = new TransformNode(`${id}-moon`, scene);
  moon.parent = wardrobe;
  const headAccessories = new TransformNode(`${id}-head-accessories`, scene);
  headAccessories.parent = head;
  const capeNeck = kind === "gold" ? 1.065 : .808;
  const capeLength = capeNeck - 0.59;
  const bodyShape = geometry.find(p => p.name === "body")!;
  const fittedSections = new Map<number, { x: number; z: number; front: number }>();
  const fittedSection = (height: number) => {
    const key = Math.round(height * 1000), cached = fittedSections.get(key);
    if (cached) return cached;
    let nearest = Infinity;
    for (let i = 1; i < bodyShape.positions.length; i += 3)
      nearest = Math.min(nearest, Math.abs(bodyShape.positions[i] + bodyShape.pivot[1] - height));
    let x = 0, z = 0, front = -Infinity;
    for (let i = 0; i < bodyShape.positions.length; i += 3) {
      if (Math.abs(bodyShape.positions[i + 1] + bodyShape.pivot[1] - height) > nearest + .035) continue;
      x = Math.max(x, Math.abs(bodyShape.positions[i] + bodyShape.pivot[0]));
      const depth = bodyShape.positions[i + 2] + bodyShape.pivot[2];
      z = Math.max(z, Math.abs(depth)); front = Math.max(front, depth);
    }
    const section = { x: x + .032, z: z + .032, front };
    fittedSections.set(key, section);
    return section;
  };
  const capes: Mesh[] = [];
  const capeData = new Map<Mesh, number[]>();
  const capeBuffers = new Map<Mesh, Float32Array>();
  const capeNormalData = new Map<Mesh, { base: Float32Array; normals: Float32Array }>();
  const capeAccessories = new Map<
    Mesh,
    { base: Float32Array; positions: Float32Array; baseNormals: Float32Array; normals: Float32Array; backOnly: boolean }
  >();
  const cape = (
    name: string,
    parent: TransformNode,
    material: PBRMaterial,
    trim: PBRMaterial,
  ) => {
    const positions: number[] = [],
      indices: number[] = [],
      normals: number[] = [],
      uvs: number[] = [];
    const rows = 12,
      cols = 20;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const fitted = fittedSection(capeNeck - t * capeLength);
      for (let col = 0; col <= cols; col++) {
        const a = (-0.62 + (col / cols) * 1.24) * Math.PI;
        // A fitted cloth surface that widens and falls behind the shoulders.
        const x = Math.sin(a) * (fitted.x + t * .016);
        const z = -Math.cos(a) * (fitted.z + Math.sin(t * Math.PI) * .032) - 0.025;
        const y =
          capeNeck -
          t * capeLength +
          Math.pow(Math.abs(Math.sin(a)), 2) * t * 0.08 +
          Math.sin((col / cols) * Math.PI * 6) * t * 0.012;
        positions.push(x, y, z);
        uvs.push(col / cols, t);
        if (row < rows && col < cols) {
          const i = row * (cols + 1) + col;
          indices.push(
            i,
            i + 1,
            i + cols + 1,
            i + 1,
            i + cols + 2,
            i + cols + 1,
          );
        }
      }
    }
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.uvs = uvs;
    const m = new Mesh(`${id}-${name}`, scene);
    data.applyToMesh(m, true);
    meshWith(m, parent, material);
    capes.push(m);
    capeData.set(m, positions);
    capeBuffers.set(m, new Float32Array(positions));
    capeNormalData.set(m, { base: new Float32Array(normals), normals: new Float32Array(normals) });
    const hem = positions.slice(rows * (cols + 1) * 3);
    tube(
      name + "-stitched-hem",
      Array.from(
        { length: cols + 1 },
        (_, i) => new Vector3(hem[i * 3], hem[i * 3 + 1], hem[i * 3 + 2]),
      ),
      0.012,
      parent,
      trim,
    );
    return m;
  };
  cape("fern-cape", forest, green, greenTrim);
  cape("constellation-cape", moon, blue, blueTrim);
  // The white neck is continuous; fit both existing costumes to its surface.
  const neckSection = fittedSection(capeNeck);
  const scarfX = neckSection.x;
  const scarfZ = neckSection.z;
  const claspOffset = neckSection.front + .030 - .48;
  ring("forest-neck-scarf", scarfX, scarfZ, capeNeck, 0.040, forest, greenTrim);
  ring("moon-neck-scarf", scarfX, scarfZ, capeNeck, 0.040, moon, blueTrim);
  const leaf = ball(
    "fern-clasp",
    new Vector3(0.15, capeNeck - 0.025, 0.48 + claspOffset),
    new Vector3(0.09, 0.15, 0.022),
    forest,
    brass,
  );
  leaf.rotation.z = -0.6;
  tube(
    "leaf-vein",
    [new Vector3(0.125, capeNeck - 0.08, 0.495 + claspOffset), new Vector3(0.173, capeNeck + 0.029, 0.495 + claspOffset)],
    0.004,
    forest,
    green,
  );
  const clasp = star("moon-clasp", 0.073, 0.024, moon, brass);
  clasp.position.set(0, capeNeck - 0.025, 0.512 + claspOffset);
  // Fitted belt and a little stitched satchel are real pieces on both costumes.
  const waistSection = fittedSection(.64);
  const satchelX = -(fittedSection(.56).x + .012);
  for (const outfit of [forest, moon]) {
    ring("belt", waistSection.x, waistSection.z, 0.64, 0.022, outfit, leather);
    const pouch = ball(
      "satchel",
      new Vector3(satchelX, 0.56, 0.22),
      new Vector3(0.17, 0.22, 0.17),
      outfit,
      leather,
    );
    pouch.rotation.z = 0.16;
    ball(
      "satchel-button",
      new Vector3(satchelX - .008, 0.599, 0.315),
      new Vector3(0.029, 0.029, 0.017),
      outfit,
      brass,
      8,
    );
  }
  // Fit the ornament to the same authored head surface used by the face.
  // A fixed Z plane floated after V4 moved the eyes around the rounded cheek.
  const headSurface = geometry.find(part => part.name === "head") ?? geometry.find(part => part.name === "body")!;
  const frontSurfaceZ = (x: number, y: number) => {
    const p = headSurface.positions, ids = headSurface.indices, pivot = headSurface.pivot;
    let front = -Infinity;
    for (let i = 0; i < ids.length; i += 3) {
      const a = ids[i] * 3, b = ids[i + 1] * 3, c = ids[i + 2] * 3;
      const ax = p[a] + pivot[0], ay = p[a + 1] + pivot[1];
      const bx = p[b] + pivot[0], by = p[b + 1] + pivot[1];
      const cx = p[c] + pivot[0], cy = p[c + 1] + pivot[1];
      if (x < Math.min(ax, bx, cx) || x > Math.max(ax, bx, cx) ||
          y < Math.min(ay, by, cy) || y > Math.max(ay, by, cy)) continue;
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(det) < 1e-10) continue;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
      const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
      const w = 1 - u - v;
      if (u >= -1e-5 && v >= -1e-5 && w >= -1e-5)
        front = Math.max(front, u * p[a + 2] + v * p[b + 2] + w * p[c + 2] + pivot[2]);
    }
    return Number.isFinite(front) ? front : 0.35;
  };
  const crescentPoints = Array.from({ length: 22 }, (_, i) => {
    const a = 0.56 + (i / 21) * (TAU - 1.12);
    const x = 0.31 + Math.cos(a) * 0.075, y = 1.92 - (kind==="gold"?.075:.055) + Math.sin(a) * 0.075;
    return new Vector3(x, y - 1.22, frontSurfaceZ(x, y) + 0.018);
  });
  tube("moon-crescent", crescentPoints, 0.014, headAccessories, brass);
  for (let i = 0; i < 8; i++) {
    const a = (i / 7 - 0.5) * 1.8,
      y = 0.66 + (i % 3) * 0.14;
    const s = star(
      "embroidered-star",
      0.019 + (i % 2) * 0.008,
      0.006,
      moon,
      brass,
    );
    const t = clamp((capeNeck - y) / (capeLength - 0.08 * Math.sin(a) ** 2));
    const fitted = fittedSection(capeNeck - t * capeLength);
    s.position.set(
      Math.sin(a) * (fitted.x + t * .016),
      y,
      -Math.cos(a) * (fitted.z + Math.sin(t * Math.PI) * .032) - 0.040,
    );
    s.rotation.y = -a;
  }
  forest.setEnabled(false);
  moon.setEnabled(false);

  const armRight = parts.get("arm_right")!;
  const armLeft = parts.get("arm_left")!;
  const hand = new TransformNode(`${id}-weapon-hand`, scene);
  hand.parent = armRight;
  // Grip runs through the lower paw volume. V2 placed it .30m forward,
  // which made the hilt visibly float above the paw during the swing.
  hand.position.set(0.15, kind === "gold" ? -0.310 : -0.420, 0.175);
  const weaponRoot = new TransformNode(`${id}-weapon`, scene);
  weaponRoot.parent = hand;
  const weapons = new Map<string, TransformNode>();
  for (const name of ["sword", "staff", "bow", "chime"]) {
    const node = new TransformNode(`${id}-${name}`, scene);
    node.parent = weaponRoot;
    weapons.set(name, node);
  }
  const sword = weapons.get("sword")!;
  tube(
    "sword-grip",
    [new Vector3(0, -0.13, 0), new Vector3(0, 0.1, 0)],
    0.027,
    sword,
    leather,
  );
  for (let i = 0; i < 5; i++)
    ring("grip-binding", 0.029, 0.029, -0.1 + i * 0.04, 0.006, sword, brass);
  const guard = tube(
    "sword-crossguard",
    [
      new Vector3(-0.12, 0.11, 0),
      new Vector3(-0.05, 0.14, 0),
      new Vector3(0.05, 0.14, 0),
      new Vector3(0.12, 0.11, 0),
    ],
    0.024,
    sword,
    brass,
  );
  guard.rotation.z = 0.05;
  const bladePos = [
    -0.071, 0.17, 0, 0, 0.17, -0.025, 0.071, 0.17, 0, 0, 0.17, 0.025, -0.057,
    0.6, 0, 0, 0.61, -0.023, 0.057, 0.6, 0, 0, 0.61, 0.023, 0, 0.79, 0,
  ];
  const bladeIndices = [
    0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4,
    8, 5, 5, 8, 6, 6, 8, 7, 7, 8, 4, 0, 1, 2, 0, 2, 3,
  ];
  const bladeNormals: number[] = [];
  VertexData.ComputeNormals(bladePos, bladeIndices, bladeNormals);
  const bladeData = new VertexData();
  bladeData.positions = bladePos;
  bladeData.indices = bladeIndices;
  bladeData.normals = bladeNormals;
  const blade = new Mesh(`${id}-bevelled-blade`, scene);
  bladeData.applyToMesh(blade);
  meshWith(blade, sword, steel);
  const rune = star("sword-rune", 0.027, 0.006, sword, gem);
  rune.position.set(0, 0.315, 0.028);
  ball(
    "pommel",
    new Vector3(0, -0.145, 0),
    new Vector3(0.069, 0.071, 0.063),
    sword,
    brass,
    8,
  );
  // A modest leaf-shaped buckler, carried by the other hand.
  const shieldRoot = new TransformNode(`${id}-shield`, scene);
  shieldRoot.parent = armLeft;
  shieldRoot.position.set(-0.12, kind === "gold" ? -0.172 : -0.15, 0.31);
  const shield = ball(
    "leaf-buckler",
    new Vector3(-0.015, 0, 0.022),
    new Vector3(0.35, 0.42, 0.09),
    shieldRoot,
    green,
    16,
  );
  shield.rotation.y = -0.5;
  const shieldStar = star("shield-star", 0.085, 0.025, shieldRoot, brass);
  shieldStar.position.set(-0.03, 0.008, 0.077);
  shieldStar.rotation.y = -0.5;

  const staff = weapons.get("staff")!;
  tube(
    "hazel-staff",
    [
      new Vector3(0.0, -0.36, 0),
      new Vector3(-0.03, -0.1, 0),
      new Vector3(0.015, 0.19, 0),
      new Vector3(-0.025, 0.48, 0),
      new Vector3(0.016, 0.71, 0),
    ],
    0.023,
    staff,
    leather,
    10,
  );
  const hook = Array.from({ length: 20 }, (_, i) => {
    const a = -0.9 + (i / 19) * 4.8;
    return new Vector3(Math.cos(a) * 0.12, 0.7 + Math.sin(a) * 0.13, 0);
  });
  tube("staff-crown", hook, 0.023, staff, brass, 8);
  ball(
    "staff-orb",
    new Vector3(0, 0.73, 0),
    new Vector3(0.15, 0.17, 0.15),
    staff,
    gem,
    12,
  );
  ring("staff-binding", 0.031, 0.031, 0.4, 0.016, staff, blueTrim);
  const staffStar = star("staff-hanging-star", 0.055, 0.016, staff, brass);
  staffStar.position.set(0.12, 0.57, 0);

  const bow = weapons.get("bow")!;
  const bowCurve = Array.from({ length: 28 }, (_, i) => {
    const t = (i / 27) * Math.PI;
    return new Vector3(Math.sin(t) * 0.22 - 0.05, Math.cos(t) * 0.48, 0);
  });
  tube("carved-bow", bowCurve, 0.023, bow, leather, 10);
  tube(
    "bow-gold-trim",
    bowCurve.map((p) => new Vector3(p.x + 0.014, p.y, p.z + 0.009)),
    0.007,
    bow,
    brass,
    6,
  );
  tube(
    "bow-string",
    [
      new Vector3(-0.05, -0.48, 0),
      new Vector3(-0.11, 0, 0.012),
      new Vector3(-0.05, 0.48, 0),
    ],
    0.003,
    bow,
    blueTrim,
    5,
  );
  tube(
    "nocked-arrow",
    [new Vector3(-0.105, 0, -0.25), new Vector3(-0.105, 0, 0.49)],
    0.009,
    bow,
    leather,
    6,
  );
  const arrowHead = star("arrowhead", 0.04, 0.022, bow, steel);
  arrowHead.position.set(-0.105, 0, 0.5);
  arrowHead.rotation.x = Math.PI / 2;
  const chime = weapons.get("chime")!;
  tube(
    "chime-handle",
    [new Vector3(0, -0.16, 0), new Vector3(0, 0.25, 0)],
    0.024,
    chime,
    brass,
  );
  const chimeStar = star("chime-star", 0.12, 0.048, chime, amber);
  chimeStar.position.set(0, 0.35, 0);
  const bell = meshWith(
    MeshBuilder.CreateLathe(
      `${id}-bell`,
      {
        shape: [
          new Vector3(0.022, 0, 0),
          new Vector3(0.035, -0.025, 0),
          new Vector3(0.047, -0.09, 0),
          new Vector3(0.075, -0.13, 0),
          new Vector3(0.08, -0.15, 0),
        ],
        tessellation: 18,
        sideOrientation: Mesh.DOUBLESIDE,
      },
      scene,
    ),
    chime,
    brass,
  );
  bell.position.set(0.13, 0.2, 0);
  tube(
    "bell-ribbon",
    [
      new Vector3(0, 0.26, 0),
      new Vector3(0.09, 0.29, 0),
      new Vector3(0.13, 0.2, 0),
    ],
    0.009,
    chime,
    red,
  );
  ball(
    "bell-clapper",
    new Vector3(0.13, 0.052, 0),
    new Vector3(0.028, 0.045, 0.028),
    chime,
    darkSteel,
    8,
  );

  // Merge only static siblings. Animated body, arms, ears, tail and cloth keep
  // their own meshes; setParent preserves the original local animation pivots.
  const animatedMeshes = new Set<Mesh>([
    parts.get("body")!,
    armLeft,
    armRight,
    parts.get("ear_left")!,
    parts.get("ear_right")!,
    parts.get("tail")!,
    ...capes,
    ...Array.from(parts.values()),
  ]);
  const staticGroups = new Map<TransformNode, Map<PBRMaterial, Mesh[]>>();
  for (const child of root.getChildMeshes()) {
    const mesh = child as Mesh;
    if (animatedMeshes.has(mesh)) continue;
    const parent = mesh.parent as TransformNode,
      mat = mesh.material as PBRMaterial;
    const byMaterial =
      staticGroups.get(parent) ?? new Map<PBRMaterial, Mesh[]>();
    const list = byMaterial.get(mat) ?? [];
    list.push(mesh);
    byMaterial.set(mat, list);
    staticGroups.set(parent, byMaterial);
  }
  for (const [parent, byMaterial] of staticGroups)
    for (const [mat, list] of byMaterial) {
      if (list.length < 2) continue;
      const needsUV = list.some((m) =>
        m.isVerticesDataPresent(VertexBuffer.UVKind),
      );
      const needsColor = list.some((m) =>
        m.isVerticesDataPresent(VertexBuffer.ColorKind),
      );
      for (const mesh of list) {
        if (needsUV && !mesh.isVerticesDataPresent(VertexBuffer.UVKind))
          mesh.setVerticesData(
            VertexBuffer.UVKind,
            new Float32Array(mesh.getTotalVertices() * 2),
          );
        if (needsColor && !mesh.isVerticesDataPresent(VertexBuffer.ColorKind))
          mesh.setVerticesData(
            VertexBuffer.ColorKind,
            new Float32Array(mesh.getTotalVertices() * 4).fill(1),
          );
      }
      parent.computeWorldMatrix(true);
      const merged = Mesh.MergeMeshes(
        list,
        true,
        true,
        undefined,
        false,
        false,
      );
      if (merged) {
        merged.name = `${id}-detail-${mat.name}`;
        merged.setParent(parent);
        merged.receiveShadows = true;
        merged.isPickable = false;
        if (
          (parent === moon && mat === brass) ||
          (parent === moon && mat === blueTrim) ||
          (parent === forest && mat === greenTrim)
        ) {
          const base = new Float32Array(
            merged.getVerticesData(VertexBuffer.PositionKind)!,
          );
          merged.markVerticesDataAsUpdatable(VertexBuffer.PositionKind, true);
          merged.markVerticesDataAsUpdatable(VertexBuffer.NormalKind, true);
          capeAccessories.set(merged, {
            base,
            positions: new Float32Array(base),
            baseNormals: new Float32Array(merged.getVerticesData(VertexBuffer.NormalKind)!),
            normals: new Float32Array(merged.getVerticesData(VertexBuffer.NormalKind)!),
            backOnly: mat === brass,
          });
        }
      }
    }

  // Small support clouds from the actual sculpt, not a cylindrical proxy. They
  // keep body/ears/paws above the root's ground plane through hit/dodge/down.
  // This corrects V2's foot-origin lean; terrain sampling still belongs to render.
  const groundSupports = ["body", "head", "arm_left", "arm_right", "ear_left", "ear_right", "tail"]
    .map(name => parts.get(name)).filter((mesh): mesh is Mesh => !!mesh && !mesh.isDisposed())
    .map(mesh => {
      const skin = Array.from(skinBuffers.values()).find(s => s.mesh === mesh);
      const positions = skin?.positions ?? (mesh === parts.get("body") ? bodyDeformed : mesh.getVerticesData(VertexBuffer.PositionKind)!);
      const offsets = new Set<number>();
      for (let j = 0; j < 64; j++) {
        const y = 1 - 2 * (j + 0.5) / 64, radius = Math.sqrt(1 - y * y), a = j * 2.39996323;
        const dx = Math.cos(a) * radius, dz = Math.sin(a) * radius;
        let best = Infinity, offset = 0;
        for (let i = 0; i < positions.length; i += 3) {
          const value = positions[i] * dx + positions[i + 1] * y + positions[i + 2] * dz;
          if (value < best) { best = value; offset = i; }
        }
        offsets.add(offset);
      }
      if (mesh === parts.get("body")) for (let i = 0; i < positions.length; i += 3)
        if (positions[i + 1] < 0.10) offsets.add(i);
      return { mesh, positions, offsets: Array.from(offsets) };
    });

  let currentWeapon = "",
    currentSkin = "";
  let equipmentVisible = true;
  let clothingVisible = true;
  let life = 0,
    phase = 0,
    actionClock = 0,
    actionDuration = 0.37,
    oldAction = "idle";
  let speedBlend = 0,
    downBlend = 0,
    stepLast = 0,
    lastRemaining = Infinity,
    sprintBlend = 0,
    airBlend = 0,
    mountBlend = 0,swimBlend=0,swimPhase=0,
    cuddleBlend=0,carrierBlend=0,
    poseLast = 0;
  let lastMountWasRide=false;
  const setLoadout = (weapon: string, skin: string) => {
    const nextWeapon = weapons.has(weapon) ? weapon : "sword";
    const nextSkin = skin === "forest" || skin === "moon" ? skin : "base";
    if (nextWeapon === currentWeapon && nextSkin === currentSkin) return;
    currentWeapon = nextWeapon;
    currentSkin = nextSkin;
    for (const [name, node] of weapons) node.setEnabled(name === currentWeapon);
    shieldRoot.setEnabled(equipmentVisible && currentWeapon === "sword");
    forest.setEnabled(currentSkin === "forest");
    moon.setEnabled(currentSkin === "moon");
    headAccessories.setEnabled(clothingVisible && currentSkin === "moon");
  };
  const showEquipment = (visible: boolean, showClothing = visible) => {
    if (equipmentVisible === visible && clothingVisible === showClothing) return;
    equipmentVisible = visible;
    clothingVisible = showClothing;
    weaponRoot.setEnabled(visible);
    wardrobe.setEnabled(showClothing);
    headAccessories.setEnabled(showClothing && currentSkin === "moon");
    shieldRoot.setEnabled(visible && currentWeapon === "sword");
  };
  setLoadout("sword", "base");

  const update = (dt: number, state: DogMotionState) => {
    if (!root.isEnabled()) return;
    dt = clamp(dt, 0, 0.06);
    life += dt;
    const action = state.action || "idle";
    const replay =
      state.actionTime !== undefined &&
      state.actionTime > lastRemaining + 0.025;
    if (action !== oldAction || replay) {
      actionClock = 0;
      oldAction = action;
      const defaults: Record<string, number> = {
        attack: 0.37,
        cast: 0.46,
        skill: 0.46,
        dodge: 0.34,
        hit: 0.3,
      };
      actionDuration = Math.max(
        0.12,
        state.actionTime ?? defaults[action] ?? 0.5,
      );
    } else actionClock += dt;
    lastRemaining = state.actionTime ?? Infinity;
    // Caller time is a global clock; every transient action gets a local phase.
    const act = actionClock;
    const home=state.homePose,homeBlend=state.homeBlend??0;
    const rider=state.duo==='rider',cuddling=state.duo==='cuddle',together=!!state.duo;
    const swimming=state.swim==='surface'||state.swim==='underwater';
    swimBlend+=(Number(swimming)-swimBlend)*(1-Math.exp(-dt*10));swimPhase+=dt*(3.5+Math.min(3,state.speed)*1.8);
    const mounted = state.mounted === true||rider;
    const affectionTarget=cuddling?Math.min(1,(state.duoTime??0)/.5)*Math.min(1,Math.max(0,6.5-(state.duoTime??0))/.6):0;
    cuddleBlend+=(affectionTarget-cuddleBlend)*(1-Math.exp(-dt*12));carrierBlend+=(Number(state.duo==='carrier')-carrierBlend)*(1-Math.exp(-dt*10));const affection=cuddleBlend;
    if(mounted)lastMountWasRide=rider;
    broomWake.update(dt, state.mounted===true, state.flightSpeed ?? state.speed, state.flightPhase === "landing");
    mountBlend += (Number(mounted) - mountBlend) * (1-Math.exp(-dt*9));
    const flight = clamp(Math.abs(state.flightSpeed ?? state.speed) / 8);
    const bank = clamp(state.flightTurn ?? 0, -1, 1);
    headAccessories.setEnabled(clothingVisible&&currentSkin==='moon'&&!swimming);
    weaponRoot.setEnabled(equipmentVisible && !mounted&&!together&&!home&&!swimming);
    shieldRoot.setEnabled(equipmentVisible && currentWeapon === "sword" && !mounted&&!together&&!home&&!swimming);
    const moving = clamp(Math.abs(state.speed) / 3.5) * (1 - mountBlend);
    speedBlend += (moving - speedBlend) * (1-Math.exp(-dt*10));
    const grounded = state.grounded !== false && !mounted && !home&&!swimming;
    const sprint = state.sprinting === true && !["attack", "cast", "skill", "dodge", "down", "dead"].includes(action);
    sprintBlend += (Number(sprint) - sprintBlend) * (1-Math.exp(-dt*9));
    airBlend += (Number(!grounded) - airBlend) * (1-Math.exp(-dt*16));
    const landing = clamp((state.landing ?? 0) / 0.20);
    const strideScale = 1 + sprintBlend * 0.38;
    const footMotion = speedBlend * (1 - airBlend);
    // Cadence follows travelled speed; the resting gait no longer keeps ticking.
    const strideLength = 1.80 + sprintBlend * .16;
    phase += dt * TAU * clamp(Math.abs(state.speed) / strideLength, 0, 4.8) * (1 - airBlend) * (1 - mountBlend);
    const gait = Math.sin(phase),
      breath = Math.sin(life * 2.6);
    const down = action === "down" || action === "dead";
    downBlend += (Number(down) - downBlend) * (1-Math.exp(-dt*7));
    const strike =
      action === "attack" ? Math.sin(clamp(act / actionDuration) * Math.PI) : 0;
    const cast =
      action === "cast" || action === "skill"
        ? Math.sin(clamp(act / actionDuration) * Math.PI)
        : 0;
    const dodge =
      action === "dodge" ? Math.sin(clamp(act / actionDuration) * Math.PI) : 0;
    const hit =
      action === "hit" ? Math.sin(clamp(act / actionDuration) * Math.PI) : 0;
    const interact =
      action === "interact" || action === "revive"
        ? 0.5 + 0.5 * Math.sin(life * 5)
        : 0;
    motion.position.y =
      (Math.abs(Math.sin(phase)) * speedBlend * 0.010 + breath * 0.004) *
        (1 - downBlend) +
      downBlend * 0.52 + mountBlend * .46;
    motion.rotation.x =
      -speedBlend * (0.07 + sprintBlend * 0.025) + airBlend * clamp((state.vy ?? 0) / 7, -1, 1) * 0.035 - strike * (kind === "white" ? 0.08 : 0.11) + hit * 0.08 + dodge * 0.20 - mountBlend * (.075 + flight * .035);
    const gesture=state.animalGesture,gestureBlend=gesture?Math.min(1,gesture.elapsed/.35,gesture.remaining/.35):0;
    motion.rotation.x+=gestureBlend*(gesture?.kind==='greet'?.06:.13);
    motion.rotation.z =
      -downBlend * 1.23 + gait * 0.025 * speedBlend + hit * 0.035 - bank * mountBlend * .10;
    motion.rotation.y = strike * (currentWeapon === "sword" ? -0.44 : 0.08);
    motion.rotation.x-=.065*carrierBlend;
    if(rider)motion.rotation.z=Math.sin(life*2.4)*.008;
    if(affection>.001)motion.rotation.z+=(kind==='white'?-.10:.10)*affection+Math.sin(life*1.8)*.008;
    motion.scaling.set(1 + dodge * 0.015, 1 - dodge * 0.13, 1);
    // Lean about the belly, keeping the actual torso within its gameplay footprint.
    // A foot-origin lean used to shift the whole abdomen into a blocked enemy.
    const leanPivot = 0.58 * (1 - downBlend);
    motion.position.z = -Math.sin(motion.rotation.x) * leanPivot;
    motion.position.x = Math.sin(motion.rotation.z) * leanPivot;
    if(homeBlend>0){
      // The pillow lifts the head slightly; the torso and heels still meet
      // the mattress. A perfectly horizontal rig left the back suspended.
      motion.rotation.x=motion.rotation.x*(1-homeBlend)+(home==='lie'?-Math.PI/2+.25:0)*homeBlend;
      motion.rotation.z*=1-homeBlend;motion.rotation.y*=1-homeBlend;
      motion.position.x*=1-homeBlend;motion.position.z*=1-homeBlend;
      motion.position.y=motion.position.y*(1-homeBlend)+(home==='lie'?.41:kind==='gold'?-.26:-.235)*homeBlend;
    }
    if(swimBlend>.001){
      // Rotate about the torso. Constant scale; a continuous alternating paddle.
      motion.rotation.x=motion.rotation.x*(1-swimBlend)+1.40*swimBlend;
      motion.rotation.z=motion.rotation.z*(1-swimBlend)+(Math.sin(swimPhase)*.028-bank*.07)*swimBlend;
      motion.position.y=motion.position.y*(1-swimBlend)+.60*swimBlend;
      motion.position.z=motion.position.z*(1-swimBlend)-.68*swimBlend;
    }
    head.rotation.x =
      breath * 0.012 +
      speedBlend * 0.035 +
      cast * 0.08 -
      interact * 0.12 -
      downBlend * 0.18;
    head.rotation.y =
      Math.sin(life * 0.83) * 0.025 * (1 - speedBlend) + strike * 0.13;
    head.rotation.z = gait * 0.022 * speedBlend + downBlend * 0.18;
    // The white reference has no neck seam: its head and torso are one sculpt.
    // It nods with the body while its ears and limbs retain independent motion.
    head.rotation.set(0, 0, 0);
    for (const [side, sign] of [
      ["left", -1],
      ["right", 1],
    ] as const) {
      const ear = parts.get(`ear_${side}`)!;
      ear.rotation.x =
        Math.sin(phase - 0.55) * footMotion * (0.15 + sprintBlend * 0.065) + airBlend * 0.085 + landing * 0.12 +
        Math.sin(life * 2.5) * 0.02;
      ear.rotation.z =
        sign *
        (Math.sin(phase - 0.4) * footMotion * (0.1 + sprintBlend * 0.04) + airBlend * 0.05 +
          Math.sin(life * 2) * 0.014 +
          dodge * 0.19 +
          hit * 0.12);
    }
    armRight.rotation.x =
      gait * 0.46 * footMotion * strideScale - airBlend * 0.26 -
      strike * 1.45 -
      cast * (currentWeapon === "bow" ? 0.25 : 1.24) -
      interact * 0.64;
    armRight.rotation.z = -strike * 0.32 - cast * 0.22;
    armRight.rotation.y = strike * 0.52;
    armRight.rotation.x = armRight.rotation.x * (1 - mountBlend) - mountBlend * 1.12;
    armRight.rotation.z = armRight.rotation.z * (1 - mountBlend) - mountBlend * .54;
    armLeft.rotation.x =
      -gait * 0.46 * footMotion * strideScale - airBlend * 0.26 - strike * 0.22 - cast * 0.68 - interact * 0.6;
    armLeft.rotation.z = cast * 0.19;
    armLeft.rotation.x = armLeft.rotation.x * (1 - mountBlend) - mountBlend * 1.12;
    armLeft.rotation.z = armLeft.rotation.z * (1 - mountBlend) + mountBlend * .54;
    // Raising a short arm rotates a vertical weapon toward the body; the wrist
    // counter-rotates so the blade/staff follows the forward strike instead.
    hand.rotation.x = currentWeapon === "sword" ? 0.30 + strike * 2.05
      : currentWeapon === "staff" ? 0.30 + cast * 1.5 : 0;
    hand.rotation.z =
      currentWeapon === "staff"
        ? -0.18
        : currentWeapon === "sword"
          ? -0.24
          : currentWeapon === "bow"
            ? -0.09
            : 0;
    const tail = parts.get("tail")!;
    tail.rotation.y =
      Math.sin(life * (speedBlend > 0.1 ? 13 : 7)) * 0.3 * (1 - downBlend);
    tail.rotation.x = speedBlend * 0.2 + cast * 0.1;
    const body = parts.get("body")!;
    // Smooth vertical weights move the feet without seams or detached limbs.
    if (!skinBuffers.size && (speedBlend > 0.005 || stepLast > 0.005 || airBlend > 0.005 || poseLast > 0.005)) {
      for (const i of legOffsets) {
        const x = bodyBase[i],
          y = bodyBase[i + 1],
          z = bodyBase[i + 2];
        const w = clamp((0.68 - y) / 0.60);
        const w2 = w * w * w * (w * (w * 6 - 15) + 10);
        // Continuous left/right weighting avoids a normal discontinuity at x=0.
        const side = Math.tanh(x / 0.12);
        const stride = Math.sin(phase) * side;
        const strideDx = Math.sin(phase) * (1 - side * side) / 0.12;
        const weightDy = w > 0 && w < 1 ? -30 * w * w * (1 - w) * (1 - w) / 0.60 : 0;
        const lift = Math.max(0, stride) * 0.075 * footMotion * strideScale + airBlend * (1 - mountBlend) * 0.09 + mountBlend * .105;
        const pawSweep = 0.13;
        const sweep = stride * pawSweep * footMotion * strideScale - airBlend * 0.055 + mountBlend * .125;
        bodyDeformed[i] = x;
        bodyDeformed[i + 1] = y + lift * w2;
        bodyDeformed[i + 2] = z + sweep * w2;
        // Inverse transpose of the same deformation Jacobian. The normal now
        // follows the moving paw instead of retaining V2's static idle lighting.
        const ay = lift * weightDy;
        const ax = stride > 0 ? strideDx * 0.075 * footMotion * strideScale * w2 : 0;
        const by = sweep * weightDy;
        const bx = strideDx * pawSweep * footMotion * strideScale * w2;
        const nz = bodyBaseNormals[i + 2];
        const ny = (bodyBaseNormals[i + 1] - by * nz) / (1 + ay);
        const nx = bodyBaseNormals[i] - ax * ny - bx * nz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        bodyNormals[i] = nx / nl; bodyNormals[i + 1] = ny / nl; bodyNormals[i + 2] = nz / nl;
      }
      body.updateVerticesData(VertexBuffer.PositionKind, bodyDeformed, false, false);
      body.updateVerticesData(VertexBuffer.NormalKind, bodyNormals, false, false);
    }
    if (skinBuffers.size) {
      // Same Blender subdivision geometry, weights and recorded bone matrices.
      // Both dogs bypass the legacy analytic foot warp above.
      type ClipName = keyof typeof clips;
      const sample = (name: ClipName, t: number, loop = true) => {
        const clip = clips[name];
        const f = (loop ? ((t % 1) + 1) % 1 : clamp(t)) * (clip.frames.length - 1);
        const a = Math.floor(f), b = Math.min(a + 1, clip.frames.length - 1), q = f - a;
        return clip.frames[a].map((m, bone) => m.map((v, i) => v + (clip.frames[b][bone][i] - v) * q));
      };
      const idlePose = sample("idle", life * .55), walkPose = sample("walk", phase / TAU);
      const mountPose = lastMountWasRide?shoulderRide:ridingMatrices, jumpPose = clips.jump.frames[0], landingPose = clips.land.frames[0];
      const actionPose = sample(action === "attack" ? "attack" : "cast", clamp(act / actionDuration), false);
      const actionWeight = (action === "attack" || action === "cast" || action === "skill") ? 1 : 0;
      const matrices = idlePose.map((m, b) => m.map((v, i) => {
        const moving = v + (walkPose[b][i] - v) * footMotion;
        const acting = moving + (actionPose[b][i] - moving) * actionWeight;
        const airborne = acting + (jumpPose[b][i] - acting) * airBlend * (1 - mountBlend);
        const landed = airborne + (landingPose[b][i] - airborne) * landing * (1 - mountBlend);
        const mountedPose=landed+(mountPose[b][i]-landed)*mountBlend;
        const resting=home==='sit'?sittingMatrices[b][i]:idlePose[b][i];
        return mountedPose+(resting-mountedPose)*homeBlend;
      }));
      if(swimBlend>.001){
        const swimPose=idlePose.map(m=>m.slice());
        for(const [side,sign] of [['left',-1],['right',1]] as const){
          const cycle=swimPhase+(side==='right'?Math.PI:0),sx=kind==='gold'?.54:.4371,sy=kind==='gold'?.985132:.801676;
          const ai=rigModel.bones.indexOf('arm_'+side),li=rigModel.bones.indexOf('leg_'+side);
          const arm=Matrix.Translation(-sign*sx,-sy,0).multiply(Matrix.RotationX(-.7+Math.sin(cycle)*.55)).multiply(Matrix.RotationZ(sign*(.32+Math.cos(cycle)*.20))).multiply(Matrix.Translation(sign*sx,sy,0));
          const leg=Matrix.Translation(-sign*.20,-.42,0).multiply(Matrix.RotationX(Math.sin(cycle)*.24)).multiply(Matrix.Translation(sign*.20,.42,0));
          swimPose[ai]=Array.from(Matrix.FromArray(idlePose[ai]).multiply(arm).m);swimPose[li]=Array.from(Matrix.FromArray(idlePose[li]).multiply(leg).m);
        }
        for(let b=0;b<matrices.length;b++)matrices[b]=matrices[b].map((v,i)=>v+(swimPose[b][i]-v)*swimBlend);
      }
      if(gesture&&gestureBlend>0){
        const side=gesture.kind==='greet'?'left':'right',sign=side==='right'?1:-1,index=rigModel.bones.indexOf('arm_'+side),sx=kind==='gold'?.54:.4371,sy=kind==='gold'?.985132:.801676;
        const angle=(-.90+Math.sin(gesture.elapsed*(gesture.kind==='play'?6:3.5))*.16)*gestureBlend;
        const lift=Matrix.Translation(-sign*sx,-sy,0).multiply(Matrix.RotationX(angle)).multiply(Matrix.RotationZ(gesture.kind==='greet'?sign*Math.sin(gesture.elapsed*5)*.28*gestureBlend:0)).multiply(Matrix.Translation(sign*sx,sy+.08*gestureBlend,.18*gestureBlend));
        matrices[index]=Array.from(Matrix.FromArray(matrices[index]).multiply(lift).m);
      }
      if(affection>.001){
        const side=kind==='white'?'right':'left',sign=kind==='white'?1:-1,index=rigModel.bones.indexOf('arm_'+side),angle=sign*1.05*affection;
        const transform=Matrix.Translation(-sign*.43,-.98,0).multiply(Matrix.RotationZ(angle)).multiply(Matrix.Translation(sign*.43,.98+.10*affection,.10*affection));
        matrices[index]=Array.from(Matrix.FromArray(matrices[index]).multiply(transform).m);
      }
      // Interpolated authored pose goes to a small GPU palette every frame.
      // Only finite sole/contact support samples need CPU positions for floor fit.
      for (const {mesh,gpu} of skinBuffers.values()) {mesh.rotation.set(0,0,0);gpu.update(matrices);}
      for(const support of groundSupports){
        const skin=skinBuffers.get(support.mesh.name.slice(id.length+1));if(!skin)continue;
        const {part,positions}=skin;
        for(const i of support.offsets){const v=i/3,x=part.positions[i]+part.pivot[0],y=part.positions[i+1]+part.pivot[1],z=part.positions[i+2]+part.pivot[2];let px=0,py=0,pz=0;
          for(const [bone,weight]of part.weights![v]){const m=matrices[bone];px+=(m[0]*x+m[4]*y+m[8]*z+m[12])*weight;py+=(m[1]*x+m[5]*y+m[9]*z+m[13])*weight;pz+=(m[2]*x+m[6]*y+m[10]*z+m[14])*weight;}
          positions[i]=px-part.pivot[0];positions[i+1]=py-part.pivot[1];positions[i+2]=pz-part.pivot[2];
        }
      }
      // Grip consumes the very same exported arm bone, so equipment follows skin.
      const right = matrices[rigModel.bones.indexOf("arm_right")];
      const grip = Vector3.TransformCoordinates(new Vector3(kind === "gold" ? .557 : .59, kind === "gold" ? .525132 : .414776, .15), Matrix.FromArray(right));
      hand.position.copyFrom(grip.subtract(armRight.position));
      const left = matrices[rigModel.bones.indexOf("arm_left")];
      const shieldGrip = Vector3.TransformCoordinates(new Vector3(kind === "gold" ? -.557 : -.59, kind === "gold" ? .555132 : .449776, .24), Matrix.FromArray(left));
      shieldRoot.position.copyFrom(shieldGrip.subtract(armLeft.position));
      shieldRoot.rotationQuaternion = Quaternion.FromRotationMatrix(Matrix.FromArray(left));
      const boneRotation = Quaternion.FromRotationMatrix(Matrix.FromArray(right));
      hand.rotationQuaternion = boneRotation.multiply(Quaternion.RotationYawPitchRoll(0, hand.rotation.x, hand.rotation.z));
    }
    stepLast = speedBlend;
    poseLast = Math.max(airBlend, mountBlend);
    const deformCloth = (base: ArrayLike<number>, positions: Float32Array,
      baseNormals: ArrayLike<number>, normals: Float32Array, backOnly: boolean) => {
      for (let i = 0; i < positions.length; i += 3) {
        if (backOnly && (base[i + 1] > capeNeck - 0.09 || base[i + 2] > -0.2)) continue;
        const fall = clamp((capeNeck - base[i + 1]) / capeLength);
        const fallDy = fall > 0 && fall < 1 ? -1 / capeLength : 0;
        const a = life * 5 + base[i] * 5;
        const strength = 0.016 + speedBlend * (0.035 + sprintBlend * 0.016) + airBlend * 0.022 + mountBlend * flight * .038;
        positions[i + 2] = base[i + 2] - Math.sin(a) * fall * fall * strength - speedBlend * fall * 0.055;
        const zx = -Math.cos(a) * 5 * fall * fall * strength;
        const zy = (-Math.sin(a) * 2 * fall * strength - speedBlend * 0.055) * fallDy;
        const nz = baseNormals[i + 2], nx = baseNormals[i] - zx * nz, ny = baseNormals[i + 1] - zy * nz;
        const n = Math.hypot(nx, ny, nz) || 1;
        normals[i] = nx / n; normals[i + 1] = ny / n; normals[i + 2] = nz / n;
      }
    };
    for (const c of capes) {
      if (!clothingVisible || !c.isEnabled()) continue;
      const base = capeData.get(c)!, positions = capeBuffers.get(c)!;
      const normalData = capeNormalData.get(c)!;
      deformCloth(base, positions, normalData.base, normalData.normals, false);
      c.updateVerticesData(VertexBuffer.PositionKind, positions, false, false);
      c.updateVerticesData(VertexBuffer.NormalKind, normalData.normals, false, false);
    }
    for (const [mesh, buffer] of capeAccessories) {
      if (!clothingVisible || !mesh.isEnabled()) continue;
      deformCloth(buffer.base, buffer.positions, buffer.baseNormals, buffer.normals, buffer.backOnly);
      mesh.updateVerticesData(VertexBuffer.PositionKind, buffer.positions, false, false);
      mesh.updateVerticesData(VertexBuffer.NormalKind, buffer.normals, false, false);
    }
    let lowest = Infinity;
    for (const support of groundSupports) {
      const matrix = support.mesh.computeWorldMatrix(true).m;
      for (const i of support.offsets) {
        const p = support.positions;
        lowest = Math.min(lowest, p[i] * matrix[1] + p[i + 1] * matrix[5] + p[i + 2] * matrix[9] + matrix[13]);
      }
    }
    const floorY = root.getAbsolutePosition().y + 0.008 * root.scaling.y;
    if (grounded && Number.isFinite(lowest)) motion.position.y += (floorY - lowest) / Math.max(0.001, root.scaling.y);

  };
  update(0, { speed: 0, action: "idle", time: 0 });
  return {
    root,
    update,
    setLoadout,
    showEquipment,
    dispose() {
      for(const {gpu}of skinBuffers.values())gpu.dispose();
      broomWake.dispose();
      root.dispose(false);
      for (const mat of materials) mat.dispose();
      fiberTexture.dispose();
    },
  };
}
