import { Matrix, Mesh, Quaternion, Vector3, VertexData } from "@babylonjs/core";
import type { World } from "./world";
import { GIANT_MUSHROOMS, regionConnections } from "./regions";
import { inWater, bridgeLocal } from "./world-surfaces";
import {spatialCandidates} from "./spatial-candidates";
import { JOURNEY_NODES } from "./journeys";

type PlantKind = "grass" | "fern" | "wideleaf";
interface PlantGeometry { positions: number[]; indices: number[]; colors: number[] }
const kinds: PlantKind[] = ["grass", "fern", "wideleaf"];
const CELL = 24;
type UnderstoryChunk={x:number;z:number;kind:PlantKind;matrices:number[]};
let mushroomDerived:{chunks:Map<string,UnderstoryChunk>;counts:Record<PlantKind,number>;clusters:number}|undefined;

function leaf(data: PlantGeometry, yaw: number, length: number, height: number, width: number, x = 0, z = 0, y = 0, tipRise = .72, midRise = 1) {
  const offset = data.positions.length / 3, c = Math.cos(yaw), s = Math.sin(yaw);
  const sections = [[0, 0, width * .22], [length * .38, height * midRise, width], [length, height * tipRise, .0015]];
  for (const [step, rise, breadth] of sections) {
    for (const [across, ridge] of [[-breadth, 0], [0, .012], [breadth, 0]]) {
      data.positions.push(x + across * c + step * s, y + rise + ridge, z - across * s + step * c);
      const tint = .83 + .15 * Math.min(1, step / Math.max(.01, length));
      data.colors.push(tint, tint, tint, 1);
    }
  }
  for (let row = 0; row < 2; row++) for (let edge = 0; edge < 3; edge++) {
    const a = offset + row * 3 + edge, b = offset + row * 3 + (edge + 1) % 3;
    data.indices.push(a, a + 3, b, b, a + 3, b + 3);
  }
  data.indices.push(offset, offset + 1, offset + 2, offset + 6, offset + 8, offset + 7);
}

function plantGeometry(kind: PlantKind): VertexData {
  const data: PlantGeometry = { positions: [], indices: [], colors: [] };
  if (kind === "grass") {
    for (const [tuft, offset] of [[-.30, -.16], [.29, -.18], [.04, .31]].entries()) for (let i = 0; i < 5; i++) {
      const yaw = i * 2.399 + .31 + tuft * .83;
      leaf(data, yaw, .19 + (i % 3) * .055, .37 + (i % 3) * .080, .027 + (i % 2) * .010, offset[0] + Math.sin(yaw) * .045, offset[1] + Math.cos(yaw) * .045, 0, 1, .55);
    }
  } else if (kind === "wideleaf") {
    for (let i = 0; i < 4; i++) leaf(data, i * 2.399, .31 + (i % 2) * .09, .11 + (i % 2) * .055, .105 + (i % 2) * .018, 0, 0, .015);
  } else {
    for (let frond = 0; frond < 3; frond++) {
      const yaw = frond * 2.399 + .2, s = Math.sin(yaw), c = Math.cos(yaw);
      leaf(data, yaw, .49, .23, .022);
      for (let pair = 1; pair <= 3; pair++) {
        const distance = pair * .11, rise = .16 + .025 * pair;
        for (const side of [-1, 1]) leaf(data, yaw + side * 1.01, .14 - pair * .015, .035, .043 - pair * .005, s * distance, c * distance, rise);
      }
    }
  }
  const vd = new VertexData();
  vd.positions = data.positions; vd.indices = data.indices; vd.colors = data.colors; vd.normals = [];
  VertexData.ComputeNormals(data.positions, data.indices, vd.normals);
  // Bent leaf normals retain a broad sky response, matching existing foliage.
  for (let i = 0; i < vd.normals.length; i += 3) {
    const normal = new Vector3(vd.normals[i] * .55, Math.abs(vd.normals[i + 1]) * .55 + .45, vd.normals[i + 2] * .55).normalize();
    vd.normals[i] = normal.x; vd.normals[i + 1] = normal.y; vd.normals[i + 2] = normal.z;
  }
  return vd;
}

/** Three small leaf templates; each cullable cell owns its thin-instance buffer. */
export function* buildLushUnderstorySteps(w: World): Generator<void> {
  if (w.indoor) return;
  const bounds = w.bounds, chapter = w.chapter, biome = chapter.biome;
  let seed = 8317 + chapter.index * 701;
  for (const char of w.regionId) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cap = w.regionId === "mushroom-grove" ? 48000 : w.regionId === "canopy-garden" ? 2400 : biome === "forest" ? 3000 : biome === "village" ? 2600 : biome === "river" ? 2300 : biome === "graveyard" ? 1700 : 1400;
  const spacing = w.regionId === "mushroom-grove" ? 1.63 : biome === "forest" ? 1.66 : biome === "village" || biome === "river" ? 1.74 : 2.02;
  const links = regionConnections(w.regionId), nodes = JOURNEY_NODES.filter(n => n.regionId === w.regionId);
  const clearSpots = [chapter.spawn, chapter.camp, chapter.exit, ...chapter.interactions, ...chapter.secrets, ...links, ...nodes];
  const chunks = new Map<string, { x: number; z: number; kind: PlantKind; matrices: number[] }>();
  const counts = { grass: 0, fern: 0, wideleaf: 0 };
  let clusters = 0, candidates = 0;
  const placements: { x: number; z: number; kind: PlantKind; scale: number; yaw: number }[] = [];
  const nearbyObstacles=spatialCandidates(w.obstacles,o=>o.shape==='box'?Math.hypot(o.width??0,o.depth??0)/2+.6:o.r+.6);
  const nearbyMushrooms=spatialCandidates(GIANT_MUSHROOMS,m=>m.r+.65);
  const cached=w.regionId==='mushroom-grove'?mushroomDerived:undefined;
  const allowed = (x: number, z: number) => {
    if (inWater(chapter, x, z, .9) || clearSpots.some(p => Math.hypot(x - p.x, z - p.z) < 2.75)) return false;
    for (const path of chapter.paths) for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < path.width * .5 + .75) return false;
    }
    if ((chapter.terrain.platforms ?? []).some(p => Math.abs(x - p.x) < p.width / 2 + .75 && Math.abs(z - p.z) < p.depth / 2 + .75)) return false;
    if (biome === "castle" && Math.abs(x) < 25 && z > 8 && z < 102) return false;
    for (const landmark of chapter.landmarks) {
      const scale = landmark.scale ?? 1;
      if (["house", "windmill", "castle"].includes(landmark.kind) && Math.hypot(x - landmark.x, z - landmark.z) < 5.5 * scale + .8) return false;
      if (landmark.kind === "bridge") { const p = bridgeLocal(x, z, landmark); if (Math.abs(p.x) < 2.25 * scale + .5 && Math.abs(p.z) < 4.8 * scale + .5) return false; }
    }
    for (const obstacle of nearbyObstacles(x,z)) {
      if (obstacle.shape === "box") {
        const p = bridgeLocal(x, z, obstacle);
        if (Math.abs(p.x) < (obstacle.width ?? 0) / 2 + .6 && Math.abs(p.z) < (obstacle.depth ?? 0) / 2 + .6) return false;
      } else if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + .55) return false;
    }
    if (w.regionId === "mushroom-grove" && (Math.hypot(x, z - 65) < 11.8 || nearbyMushrooms(x,z).some(m => Math.hypot(x - m.x, z - m.z) < m.r + .65))) return false;
    const ground = w.renderedGroundHeight(x, z);
    if (Math.abs(w.height(x, z) - ground) > .19) return false;
    return true;
  };
  if(cached){for(const[k,v]of cached.chunks)chunks.set(k,v);Object.assign(counts,cached.counts);clusters=cached.clusters;}else{
  let scanned=0;
  for (let z = bounds.minZ + 1; z < bounds.maxZ - 1; z += spacing) for (let x = bounds.minX + 1; x < bounds.maxX - 1; x += spacing) {
    if(++scanned%180===0)yield;
    const px = x + (random() - .5) * spacing * .85, pz = z + (random() - .5) * spacing * .85;
    const patch = .5 + .21 * Math.sin(px * .21 + pz * .085) + .18 * Math.cos(pz * .19 - px * .10);
    if (random() > Math.min(.98, .73 + patch * .34) || !allowed(px, pz)) continue;
    const choice = random(), kind: PlantKind = choice < .78 ? "grass" : choice < .90 ? "wideleaf" : "fern";
    const scale = kind === "grass" ? .74 + random() * .42 : .70 + random() * .43;
    const placement = { x: px, z: pz, kind, scale, yaw: random() * Math.PI * 2 };
    candidates++;
    if (placements.length < cap) placements.push(placement);
    else { const slot = Math.floor(random() * candidates); if (slot < cap) placements[slot] = placement; }
  }
  let composed=0;for (const { x: px, z: pz, kind, scale, yaw } of placements) {
    if(++composed%300===0)yield;
    const cellX = Math.floor(px / CELL), cellZ = Math.floor(pz / CELL), key = `${cellX}:${cellZ}:${kind}`;
    const chunk = chunks.get(key) ?? { x: (cellX + .5) * CELL, z: (cellZ + .5) * CELL, kind, matrices: [] };
    const matrix = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(px - chunk.x, w.renderedGroundHeight(px, pz) - .008, pz - chunk.z));
    chunk.matrices.push(...matrix.m); chunks.set(key, chunk); counts[kind]++; clusters++;
  }
  if(w.regionId==='mushroom-grove')mushroomDerived={chunks,counts:{...counts},clusters};
  }
  const sources = new Map<PlantKind, Mesh>(), tints = biome === "mountain" ? ["#83a36c", "#759563", "#97b879"] : ["#699b47", "#629b50", "#8aba5c"];
  const beforeMeshes = w.scene.meshes.length, beforeMaterials = w.scene.materials.length;
  for (const [i, kind] of kinds.entries()) {
    if (!counts[kind]) continue;
    const source = new Mesh(`lush ${kind} shared source`, w.scene); plantGeometry(kind).applyToMesh(source); source.parent = w.root;
    const material = w.surfaces.paint(tints[i]); material.roughness = .96; material.metallic = 0; material.backFaceCulling = true; material.twoSidedLighting = false;
    source.material = material; source.isPickable = false; source.metadata = { cameraObstacle: false }; source.setEnabled(false); sources.set(kind, source);
  }
  let uploaded=0;
  for (const chunk of chunks.values()) {
    if(++uploaded%24===0)yield;
    const mesh = sources.get(chunk.kind)!.clone(`lush ${chunk.kind} grass groundcover cell`, w.root, true)!;
    // Babylon stores world0-3 instance attributes on Geometry, not on Mesh.
    mesh.makeGeometryUnique();
    mesh.position.set(chunk.x, 0, chunk.z); mesh.setEnabled(true); mesh.receiveShadows = true; mesh.isPickable = false;
    mesh.metadata = { cameraObstacle: false, lushUnderstory: true, kind: chunk.kind, instances: chunk.matrices.length / 16 };
    mesh.thinInstanceSetBuffer("matrix", new Float32Array(chunk.matrices), 16, true); mesh.thinInstanceRefreshBoundingInfo(true); mesh.freezeWorldMatrix();
    w.registerGroundDetail(mesh, chunk.x, chunk.z);
  }
  w.root.metadata = { ...(w.root.metadata ?? {}), lushUnderstory: { regionId: w.regionId, bounds, clusters, counts, cells: chunks.size, sourceGeometries: sources.size, gpuGeometries: sources.size + chunks.size, meshIncrement: w.scene.meshes.length - beforeMeshes, materialIncrement: w.scene.materials.length - beforeMaterials, instanceCap: cap, cellSize: CELL, collisionIncrement: 0, textureIncrement: 0 } };
}

export function buildLushUnderstory(w:World){for(const _ of buildLushUnderstorySteps(w)){} }
