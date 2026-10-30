import { FLIGHT_MAX_HEIGHT } from './movement';
export interface CloudBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface CloudCluster { id: number; x: number; y: number; z: number; radius: number; phase: number }
export const CLOUD_LAYOUT_VERSION = 'sky-1';
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function cloudLayout(region: string, bounds: CloudBounds, height: (x: number, z: number) => number, indoor = false): CloudCluster[] {
  if (indoor) return [];
  let seed = 2166136261;
  for (const c of region) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const clusters: CloudCluster[] = [];
  const add = (x: number, z: number, radius: number, phase: number) => {
    const ground = height(x, z);
    if (!Number.isFinite(ground) || ground > FLIGHT_MAX_HEIGHT - 6) return;
    const y = Math.min(FLIGHT_MAX_HEIGHT - 3, Math.max(13, ground + 9 + random() * 4));
    clusters.push({ id: clusters.length, x, y, z, radius, phase });
  };
  // A reachable bank above the central flight corridor, then broken wider banks.
  add(3, Math.min(bounds.maxZ - 12, Math.max(bounds.minZ + 12, 14)), 5.4, .3);
  for (let z = bounds.minZ + 30; z < bounds.maxZ - 6 && clusters.length < 96; z += 38) {
    for (let x = bounds.minX + 14; x < bounds.maxX - 6 && clusters.length < 96; x += 38) {
      const jx = x + (random() - .5) * 18, jz = z + (random() - .5) * 16;
      if (random() < .28 || Math.hypot(jx - 3, jz - 14) < 19) continue;
      add(jx, jz, 4.5 + random() * 3, random() * Math.PI * 2);
    }
  }
  return clusters;
}
/** Bounded drift derived only from shared simulation seconds; no wrap/pop or network traffic. */
export function cloudPosition(c: CloudCluster, time: number, out = { x: 0, y: 0, z: 0 }) {
  const t = Number.isFinite(time) ? time : 0;
  out.x = c.x + Math.sin(t * .012 + c.phase) * 3.2;
  out.z = c.z + Math.cos(t * .009 + c.phase) * 2.1;
  out.y = c.y + Math.sin(t * .016 + c.phase) * .35;
  return out;
}
export function cloudImmersion(c: CloudCluster, time: number, point: { x: number; y: number; z: number }) {
  const p = cloudPosition(c, time);
  return clamp(1 - Math.hypot((point.x - p.x) / c.radius, (point.y - p.y) / (c.radius * .44), (point.z - p.z) / (c.radius * .8)));
}
