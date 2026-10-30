import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/castle-stair-mouth-data.json';
test('trimmed stair-mouth flagstones retain closed volumes and never cross the real excavation', () => {
  let triangles = 0;
  for (const patch of Object.values(data)) {
    const p = patch.geometry.positions, ix = patch.geometry.indices;
    const point = (j: number) => p.slice(j * 3, j * 3 + 3).map(v => v.toFixed(5)).join(',');
    for (const volume of patch.volumes) {
      const edges = new Map<string, number>();
      for (let i = volume.start; i < volume.start + volume.count; i += 3) {
        const a = p.slice(ix[i] * 3, ix[i] * 3 + 3), b = p.slice(ix[i + 1] * 3, ix[i + 1] * 3 + 3), c = p.slice(ix[i + 2] * 3, ix[i + 2] * 3 + 3);
        for (const q of [a, b, c, [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]]) assert(!(q[0] > 26.00001 && q[0] < 31.49999 && q[2] > 21.00001), 'no unsupported slab in opening');
        for (const [j, k] of [[0, 1], [1, 2], [2, 0]]) {
          const key = [point(ix[i + j]), point(ix[i + k])].sort().join('|');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
        triangles++;
      }
      assert([...edges.values()].every(n => n === 2), 'each partition is a closed stone volume');
    }
    assert(p.every(Number.isFinite));
    assert(patch.removedTriangles.length > 0);
  }
  assert(triangles > 50);
});
