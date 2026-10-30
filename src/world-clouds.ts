import { Color3, DynamicTexture, Mesh, StandardMaterial, Vector3, VertexBuffer, VertexData, type Scene } from '@babylonjs/core';
import { cloudLayout, cloudPosition, cloudImmersion, CLOUD_LAYOUT_VERSION, type CloudCluster } from './cloud-layout';
import { regionBounds, regionGroundHeight } from './regions';
import { weatherAt } from './world-weather';
const CAPACITY = 16 * 5;
const PUFFS = [[-.52, -.06, -.05, .58], [.05, .16, .08, .68], [.58, -.04, .03, .51], [-.17, -.1, .42, .54], [.30, -.13, -.43, .56]];
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
/** One shared soft texture, one bounded billboard mesh, no physical or picking proxy. */
export class WorldClouds {
  private mesh: Mesh;
  private material: StandardMaterial;
  private texture: DynamicTexture;
  private clusters: CloudCluster[] = [];
  private region = '';
  private positions = new Float32Array(CAPACITY * 12);
  private colors = new Float32Array(CAPACITY * 16);
  private center = { x: 0, y: 0, z: 0 };
  private right = new Vector3();
  private up = new Vector3();
  private visible = 0;
  private immersion = 0;
  private time = 0;
  private visibleClusters: { c: CloudCluster; distance: number }[] = [];
  constructor(private scene: Scene) {
    this.texture = new DynamicTexture('shared soft cloud light', 128, scene, false);
    const ctx = this.texture.getContext(), image = ctx.getImageData(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const nx = (x - 63.5) / 63.5, ny = (63.5 - y) / 63.5, r = Math.hypot(nx, ny), i = (y * 128 + x) * 4;
      const light = Math.max(0, -.32 * nx + .72 * ny + .60 * Math.sqrt(Math.max(0, 1 - r * r)));
      const shade = .78 + light * .22;
      image.data[i] = shade * 249; image.data[i + 1] = shade * 252; image.data[i + 2] = Math.min(255, shade * 255 + 5);
      image.data[i + 3] = 215 * smooth((1 - r) / .38);
    }
    ctx.putImageData(image, 0, 0); this.texture.hasAlpha = true; this.texture.update();
    this.material = new StandardMaterial('cloud soft daylight', scene);
    this.material.diffuseTexture = this.texture; this.material.useAlphaFromDiffuseTexture = true;
    this.material.disableLighting = true; this.material.emissiveColor = Color3.White();
    this.material.backFaceCulling = false; this.material.disableDepthWrite = true;
    this.material.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    this.mesh = new Mesh('reachable cloud banks', scene); this.mesh.material = this.material;
    this.mesh.isPickable = false; this.mesh.metadata = { cameraObstacle: false, visualOnly: true };
    this.mesh.alwaysSelectAsActiveMesh = true; this.mesh.hasVertexAlpha = true;
    const data = new VertexData(), indices: number[] = [], uvs: number[] = [];
    for (let i = 0; i < CAPACITY; i++) { const n = i * 4; indices.push(n, n + 1, n + 2, n, n + 2, n + 3); uvs.push(0, 0, 1, 0, 1, 1, 0, 1); }
    data.positions = this.positions; data.colors = this.colors; data.indices = indices; data.uvs = uvs; data.applyToMesh(this.mesh, true);
    this.mesh.setEnabled(false);
  }
  load(region: string, indoor: boolean) {
    this.region = region; this.clusters = cloudLayout(region, regionBounds(region), (x, z) => regionGroundHeight(region, x, z), indoor);
    this.visibleClusters = []; this.visible = this.immersion = 0; this.mesh.setEnabled(false);
  }
  update(time: number, quality: string, active: boolean) {
    this.time = time;
    const camera = this.scene.activeCamera;
    this.mesh.setEnabled(active && this.clusters.length > 0 && !!camera);
    if (!active || !camera || !this.clusters.length) { this.visible = this.immersion = 0; return; }
    const max = quality === 'low' ? 8 : quality === 'high' ? 16 : 12;
    this.visibleClusters.length = 0;
    for (const c of this.clusters) {
      const p = cloudPosition(c, time, this.center), distance = Math.hypot(p.x - camera.position.x, p.y - camera.position.y, p.z - camera.position.z);
      if (distance < 158) this.visibleClusters.push({ c, distance });
    }
    // Keep nearest banks, draw them back-to-front within a single draw call.
    this.visibleClusters.sort((a, b) => a.distance - b.distance);
    this.visibleClusters.length = Math.min(max, this.visibleClusters.length);
    this.visibleClusters.reverse(); this.visible = this.visibleClusters.length;
    const rotation = camera.getWorldMatrix(); Vector3.TransformNormalToRef(Vector3.Right(), rotation, this.right); Vector3.TransformNormalToRef(Vector3.Up(), rotation, this.up);
    this.right.normalize(); this.up.normalize();
    const weather = weatherAt(time, this.region), day = weather.daylight, storm = weather.intensity * .12;
    let count = 0; this.immersion = 0;
    for (const { c, distance } of this.visibleClusters) {
      const p = cloudPosition(c, time, this.center);
      const inside = cloudImmersion(c, time, camera.position);
      this.immersion = Math.max(this.immersion, inside);
      for (let i = 0; i < PUFFS.length; i++) {
        const puff = PUFFS[i], x = p.x + puff[0] * c.radius, y = p.y + puff[1] * c.radius, z = p.z + puff[2] * c.radius;
        const size = c.radius * puff[3], near = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z);
        // Individual lobes soften continuously close to the near plane; the bank remains.
        const alpha = .66 * (1 - .75 * smooth(inside)) * smooth((158 - distance) / 32) * (.12 + .88 * smooth((near - .2) / (size * .9)));
        for (let v = 0; v < 4; v++) {
          const sx = v === 0 || v === 3 ? -1 : 1, sy = v < 2 ? -1 : 1, o = count * 12 + v * 3, k = count * 16 + v * 4;
          this.positions[o] = x + this.right.x * sx * size + this.up.x * sy * size * .72;
          this.positions[o + 1] = y + this.right.y * sx * size + this.up.y * sy * size * .72;
          this.positions[o + 2] = z + this.right.z * sx * size + this.up.z * sy * size * .72;
          this.colors[k] = .22 + day * .78 - storm; this.colors[k + 1] = .30 + day * .70 - storm; this.colors[k + 2] = .45 + day * .55 - storm;
          this.colors[k + 3] = alpha;
        }
        count++;
      }
    }
    this.positions.fill(0, count * 12); this.colors.fill(0, count * 16);
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors, false, false);
    // Weather restores its baseline first every frame, including on exit/indoors.
    const haze = this.immersion * .22;
    this.scene.fogStart *= 1 - haze;
    this.scene.fogEnd += (90 - this.scene.fogEnd) * haze;
  }
  get metrics() { return { version: CLOUD_LAYOUT_VERSION, region: this.region, total: this.clusters.length, visible: this.visible, immersion: this.immersion, time: this.time, first: this.clusters[0] ?? null, firstPosition: this.clusters[0] ? cloudPosition(this.clusters[0], this.time) : null }; }
  dispose() { this.mesh.dispose(); this.material.dispose(); this.texture.dispose(); this.clusters = []; this.visibleClusters = []; }
}
