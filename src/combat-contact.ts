/** Ground-level body contact; ears, wings and weapons are intentionally excluded. */
export interface ContactBody { id: string; x: number; z: number; radius: number; y?: number; height?: number; reservesColumn?: boolean; fixed?:boolean }
export type WorldResolver = (x: number, z: number, radius?: number, feetY?: number, bodyHeight?: number) => { x: number; z: number };
export const PLAYER_RADIUS = 0.66;
export const CONTACT_GAP = 0.025;
export function enemyRadius(enemy: { kind: string; boss: boolean; elite: boolean }): number {
  const radius: Record<string, number> = { slime: 0.76, wolf: 1.02, sprite: 0.71, bat: 0.71, zombie: 0.74, golem: 0.86, dragon: 1.17 };
  return (radius[enemy.kind] ?? 0.76) * (enemy.boss ? 1.5 : enemy.elite ? 1.18 : 1);
}
function overlapsHeight(a: ContactBody, b: ContactBody) {
  // Living actors are never landing surfaces: reserve their horizontal clearance
  // throughout a jump so descending from a terrace cannot enter a small creature.
  if (!a.fixed&&!b.fixed&&(a.reservesColumn || b.reservesColumn)) return true;
  if (a.y === undefined || b.y === undefined) return true;
  return a.y < b.y + (b.height ?? 2) - .025 && b.y < a.y + (a.height ?? 2) - .025;
}
function normal(a: ContactBody, b: ContactBody): { x: number; z: number; distance: number } {
  const x = a.x - b.x, z = a.z - b.z, distance = Math.hypot(x, z);
  if (distance > 1e-7) return { x: x / distance, z: z / distance, distance };
  // Stable tie break also works for legacy saves with coincident centres.
  let hash = 0; for (const c of a.id + ':' + b.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const angle = hash / 0xffffffff * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle), distance: 0 };
}
/** A point projection may choose a distant river bank. It is not permission to teleport there. */
function worldStep(body: ContactBody, x: number, z: number, resolve: WorldResolver) {
  const step = Math.hypot(x - body.x, z - body.z);
  const projected = resolve(x, z, body.radius, body.y, body.height);
  if (Math.hypot(projected.x - body.x, projected.z - body.z) <= step + 1e-5)
    return projected;
  const start = resolve(body.x, body.z, body.radius, body.y, body.height);
  const oldError = Math.hypot(start.x - body.x, start.z - body.z);
  const newError = Math.hypot(projected.x - x, projected.z - z);
  // A legacy save can start inside an obstacle. Permit bounded progress out of it.
  if (oldError > 1e-4) {
    if (newError < oldError - 1e-5) return { x, z };
    // V2 permitted a wider bridge footprint. A short lookahead lets that old
    // position walk back onto the deck, without accepting new movement into water.
    if (step > 1e-7) {
      const probeX = body.x + (x - body.x) / step * body.radius;
      const probeZ = body.z + (z - body.z) / step * body.radius;
      const probe = resolve(probeX, probeZ, body.radius, body.y, body.height);
      if (Math.hypot(probe.x - probeX, probe.z - probeZ) < oldError - 1e-4) return { x, z };
    }
  }
  const candidates = [
    { point: resolve(x, body.z, body.radius, body.y, body.height), limit: Math.abs(x - body.x) },
    { point: resolve(body.x, z, body.radius, body.y, body.height), limit: Math.abs(z - body.z) },
  ].filter(({point, limit}) => Math.hypot(point.x - body.x, point.z - body.z) <= limit + 1e-5);
  candidates.sort((a,b) => Math.hypot(a.point.x - x, a.point.z - z) - Math.hypot(b.point.x - x, b.point.z - z));
  return candidates[0]?.point ?? { x: body.x, z: body.z };
}
/** Swept circles stop tunnelling, with tangential sliding and short world-constraint steps. */
export function moveBody(body: ContactBody, dx: number, dz: number, bodies: readonly ContactBody[], resolve: WorldResolver): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.14));
  for (let step = 0; step < steps; step++) {
    const destination = worldStep(body, body.x + dx / steps, body.z + dz / steps, resolve);
    let vx = destination.x - body.x, vz = destination.z - body.z;
    for (let slide = 0; slide < 3 && Math.hypot(vx, vz) > 1e-7; slide++) {
      let time = 1, obstacle: ContactBody | undefined;
      const a = vx * vx + vz * vz;
      for (const other of bodies) {
        if (other.id === body.id || !overlapsHeight(body, other)) continue;
        const rx = body.x - other.x, rz = body.z - other.z;
        const r = body.radius + other.radius + CONTACT_GAP;
        const dot = rx * vx + rz * vz, c = rx * rx + rz * rz - r * r;
        if (dot >= 0) continue; // Always permit escape from an old overlap.
        const disc = dot * dot - a * c;
        if (disc < 0) continue;
        const t = c <= 0 ? 0 : (-dot - Math.sqrt(disc)) / a;
        if (t >= 0 && t < time) { time = t; obstacle = other; }
      }
      const advance = Math.max(0, time - (obstacle ? 1e-5 : 0));
      const point = worldStep(body, body.x + vx * advance, body.z + vz * advance, resolve);
      body.x = point.x; body.z = point.z;
      if (!obstacle) break;
      const n = normal(body, obstacle), remaining = 1 - advance;
      vx *= remaining; vz *= remaining;
      const inward = Math.min(0, vx * n.x + vz * n.z);
      vx -= n.x * inward; vz -= n.z * inward;
    }
  }
}
/** Only spawn/load/world-projection overlaps need correction; normal movement never pushes another actor. */
export function settleBodies(bodies: ContactBody[], resolve: WorldResolver, maxCorrection = 0.22): void {
  const budgets = new Map(bodies.map(body => [body.id, body.fixed?0:maxCorrection]));
  function shift(body: ContactBody, nx: number, nz: number, amount: number): number {
    const budget = budgets.get(body.id)!;
    const n = Math.min(budget, amount);
    if (n <= 1e-6) return 0;
    const point = worldStep(body, body.x + nx * n, body.z + nz * n, resolve);
    const actual = Math.max(0, (point.x - body.x) * nx + (point.z - body.z) * nz);
    body.x = point.x; body.z = point.z;
    budgets.set(body.id, Math.max(0, budget - Math.hypot(nx * actual, nz * actual)));
    return actual;
  }
  for (let pass = 0; pass < 6; pass++) {
    let overlap = false;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if(a.fixed&&b.fixed||!overlapsHeight(a,b))continue;
      const n = normal(a, b);
      const depth = a.radius + b.radius + CONTACT_GAP - n.distance;
      if (depth < 1e-5) continue;
      overlap = true;
      const first = shift(a, n.x, n.z, depth / 2);
      const second = shift(b, -n.x, -n.z, depth - first);
      shift(a, n.x, n.z, depth - first - second);
    }
    if (!overlap) break;
  }
}
