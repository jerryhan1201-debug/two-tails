import {TownWorld} from './town-world';
import {geometryRetainedBytes} from './resource-cost';
import {StudioWorld} from './studio-world';
import{AmbientAnimals,ANIMAL_SITES}from'./ambient-animals';
import {animalReaction} from './animal-interactions';
import {UnderseaWorld} from './undersea-world';
import {studioRelease,TOWN,CITY,UNDERSEA} from './studio-regions';
import {studioData,studioGround} from './studio-physics';
import {buildFieldChainVisuals} from './world-field-chains';
import {
  Scene,
  type AbstractMesh,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  VertexData,
  TransformNode,
  DirectionalLight,
  PointLight,
  HemisphericLight,
  ShadowGenerator,
  DynamicTexture,
  Texture,
  ParticleSystem,
  Material,
  MultiMaterial,
  PBRMaterial,
  Curve3,
  VertexBuffer,
  Ray,
  InstancedMesh,
  Matrix,
  Quaternion,
} from "@babylonjs/core";
import { buildRegionalEnvironmentSteps, enrichStoryLandmarks, EXPLORATION_REGIONS, isExplorationInterior } from "./world-regions";
import { createRegionMovementWorld, getRegionChapter, getRegion, regionGroundHeight, canopySurface, canopyCameraGroundHeight, regionConnections, regionBounds,regionWoodland } from "./regions";
import type { MovementWorld } from "./movement";
import type { GameEvent } from "./simulation";
import type { Chapter, Landmark } from "./content";
import { buildVillageDistrictSteps } from "./world-village";
import { instantiateEnvironmentAsset, environmentAssetMeshes, environmentAssetStats, type EnvironmentAssetId, type EnvironmentLease } from "./environment-assets";
import { createVillager } from "./villagers";
import {buildFieldVisuals} from './world-fieldbook';
import type {Snapshot} from './simulation';
import {buildJourneyVisuals,type JourneyVisuals} from "./world-journeys";
import type {JourneyProgress} from "../shared/journeys";
import { EnvironmentMaterials, type Surface } from "./environment-materials";
import { buildLushUnderstorySteps } from "./lush-understory";
import {buildVilla} from './villa-world';
import {VILLA_REGION,villaCameraGround,villaInterior} from './villa-physics';

import { buildExplorationDistrict, buildWindmill, buildMemoryRuin } from "./world-exploration";
import { heightAt, landHeight, groundHeight, waterProfile, waterLevel, createChapterMovementWorld, resolveObstacles, sceneryTrees, type WorldObstacle } from "./world-surfaces";
export { heightAt } from "./world-surfaces";
const color = (s: string) => Color3.FromHexString(s);
const v3 = (x:number,y:number,z:number) => new Vector3(x,y,z);
export type Obstacle = WorldObstacle;

/** Rounded road joins. Dense samples around an unrounded polyline corner fold
 * the inner edge over itself; a radius larger than the half-width prevents it. */
export function roadCenterline(points: number[][], width: number): Vector3[] {
  const result: Vector3[] = [];
  let cursor = new Vector3(points[0][0], 0, points[0][1]);
  result.push(cursor);
  const lineTo = (end: Vector3) => {
    const start = cursor, n = Math.max(1, Math.ceil(Vector3.Distance(start, end) / .3));
    for (let i = 1; i <= n; i++) result.push(Vector3.Lerp(start, end, i / n));
    cursor = end;
  };
  for (let i = 1; i < points.length - 1; i++) {
    const a = new Vector3(points[i-1][0], 0, points[i-1][1]);
    const b = new Vector3(points[i][0], 0, points[i][1]);
    const c = new Vector3(points[i+1][0], 0, points[i+1][1]);
    const incoming = b.subtract(a), outgoing = c.subtract(b), inLength = incoming.length(), outLength = outgoing.length();
    incoming.normalize();outgoing.normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(incoming, outgoing))));
    if (angle < .025 || angle > Math.PI - .025) { lineTo(b); continue; }
    const turn = Math.sign(incoming.x * outgoing.z - incoming.z * outgoing.x);
    const trim = Math.min(width * .9 * Math.tan(angle / 2), inLength * .35, outLength * .35);
    const radius = trim / Math.tan(angle / 2), start = b.subtract(incoming.scale(trim)), end = b.add(outgoing.scale(trim));
    const center = start.add(new Vector3(-incoming.z, 0, incoming.x).scale(turn * radius));
    lineTo(start);
    const first = Math.atan2(start.z-center.z, start.x-center.x), n = Math.max(3, Math.ceil(radius * angle / .3));
    for(let j=1;j<=n;j++){const t=first+turn*angle*j/n;result.push(new Vector3(center.x+Math.cos(t)*radius,0,center.z+Math.sin(t)*radius));}
    cursor = end;
  }
  lineTo(new Vector3(points.at(-1)![0],0,points.at(-1)![1]));
  return result;
}
const roomWallDerived=new WeakMap<object,Map<string,{key:string;data:VertexData}[]>>();
export class World {
  scene: Scene;
  chapter: Chapter;
  root: TransformNode;
  shadows: ShadowGenerator;
  obstacles: Obstacle[] = [];
  interactMeshes = new Map<string, TransformNode>();
  private residents = new Map<string, TransformNode>();
  private animalResponses=new Set<number>();private animalNestIds=new Set<string>();
  updateAnimalResponses(s:Snapshot){
    for(const[id,resident]of this.residents){const r=animalReaction(s,'resident:'+id);if(!r)continue;const p=s.players[r.role];resident.metadata?.lookAt?.(new Vector3(p.x,p.y+1.15,p.z));
      if(!this.animalResponses.has(r.serial)){resident.metadata?.respond?.();this.animalResponses.add(r.serial);}
    }
    for(const r of s.animalCare?.reactions??[])if(r.id.startsWith('nest:')&&s.time<r.until){const root=this.scene.getTransformNodeByName('journey/'+r.id.slice(5));if(root){this.animalNestIds.add(r.id);for(const bird of root.getChildMeshes().filter(m=>m.name==='sheltered tiny nestling')){bird.rotation.y=r.yaw;bird.scaling.y=1.2+Math.sin((s.time-r.start)*8)*.12;}}}
    for(const id of this.animalNestIds)if(!animalReaction(s,id)){const root=this.scene.getTransformNodeByName('journey/'+id.slice(5));if(root)for(const bird of root.getChildMeshes().filter(m=>m.name==='sheltered tiny nestling'))bird.scaling.y=1.2;this.animalNestIds.delete(id);}
    if(this.animalResponses.size>64)this.animalResponses.delete(this.animalResponses.values().next().value!);
  }
  private environmentLeases: EnvironmentLease[] = [];
  private cameraCutaways: Mesh[] = [];
  private mushroomVariants = new Map<string, MultiMaterial>();
  private rangedAssets: {root:TransformNode;x:number;z:number;radius:number;tree?:boolean}[] = [];
  private batchedEnvironment:Mesh[]=[];
  private directMushrooms=new Map<string,{source:Mesh;matrices:number[];x:number;z:number;giant:boolean;cameraObstacle:boolean}>();
  private residentEvents = new Set<number>();
  readonly foundFlags = new Set<string>();
  private movementWorld: MovementWorld;
  private chainVisuals?:ReturnType<typeof buildFieldChainVisuals>;
  private fieldVisuals?:ReturnType<typeof buildFieldVisuals>;
  updateFieldVisuals(s:Snapshot,time:number){this.fieldVisuals?.update(s,time);this.chainVisuals?.update(s);this.studio?.update(s);}
  private journeyVisuals?: JourneyVisuals;
  readonly regionId: string;
  readonly indoor: boolean;
  get bounds() { return regionBounds(this.regionId); }
  private mats = new Map<string, StandardMaterial>();
  private staticMeshes: Mesh[] = [];
  private animated: ((t: number) => void)[] = [];
  private light: DirectionalLight;
  private hemi: HemisphericLight;
  surfaces: EnvironmentMaterials;
  private sky: Mesh | null = null;
  private detailMeshes: { mesh: Mesh; x: number; z: number; radius?:number }[] = [];
  private quality: "low" | "auto" | "high" = "auto";
  private skyTexture: DynamicTexture | null = null;
  private contactTexture: DynamicTexture | null = null;
  studio:StudioWorld|TownWorld|UnderseaWorld|null=null;
  animals:AmbientAnimals|null=null;
  studioStart?:{x:number;y:number;z:number};
  get recoveryFloor(){return this.movementWorld.recoveryFloor;}
  canSaveAt(x:number,z:number,y:number){return this.movementWorld.canSaveAt?.(x,z,y)??true;}
  private villa: ReturnType<typeof buildVilla> | null = null;
  interiorAt(p:{x:number;y:number;z:number}) { return this.indoor || !!studioData(this.regionId)?.interior(p.x,p.y,p.z) || this.regionId===VILLA_REGION&&villaInterior(p.x,p.y,p.z); }
  updateVillaLighting(t:number,p:{x:number;y:number;z:number},enabled=true) {this.villa?.lights(t,p,enabled);this.studio?.lights(t,p);}
  private campLight: PointLight | null = null;
  private nightLanternSources: {position:Vector3;power:number;range:number;tint:Color3}[] = [];
  private nightLanternPools: PointLight[] = [];
  private nightWindowMaterials = new Map<number,PBRMaterial>();
  private nightWindowTextures = new Set<ReturnType<PBRMaterial['getActiveTextures']>[number]>();
  private buildIterator:Generator<void>|null=null;
  constructor(scene: Scene, chapter: Chapter, regionId = chapter.id, deferred=false) {
    this.regionId = regionId;
    this.indoor = isExplorationInterior(regionId);
    chapter = getRegionChapter(regionId, chapter);
    this.scene = scene;
    this.chapter = chapter;
    this.movementWorld = createRegionMovementWorld(regionId, chapter, () => [...this.foundFlags]);
    this.root = new TransformNode("chapter-" + chapter.id, scene);
    const night = ["graveyard", "castle", "dragon"].includes(chapter.biome);
    this.surfaces = new EnvironmentMaterials(scene, chapter.biome);
    scene.clearColor = Color4.FromHexString(chapter.palette.sky + "ff");
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = night ? 44 : chapter.biome === "forest" ? 82 : 110;
    scene.fogEnd = regionId===CITY?430:night ? 165 : 285;
    scene.fogColor = color(night ? "#69758d" : "#bed8e4");
    this.hemi = new HemisphericLight("sky", new Vector3(0.1, 1, 0), scene);
    this.hemi.intensity = this.indoor ? .48 : night ? 0.58 : 0.33;
    this.hemi.groundColor = color(night ? "#394756" : "#b4ac90");
    this.hemi.diffuse = color(night ? "#b8cafa" : "#e5edff");
    this.light = new DirectionalLight(
      "sun",
      new Vector3(-0.85, -1, 0.48),
      scene,
    );
    this.light.position.set(38.25, 45, -21.6);
    this.light.intensity = this.indoor ? 1.3 : night ? 1.05 : 2.95;
    this.light.diffuse = color(night ? "#bdcff8" : "#fff1db");
    this.light.shadowMinZ = 1;
    this.light.shadowMaxZ = 150;
    this.light.autoCalcShadowZBounds = false;
    this.light.shadowFrustumSize = 45;
    this.shadows = new ShadowGenerator(1536, this.light);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = 0.0006;
    this.shadows.normalBias = 0.05;
    this.shadows.setDarkness(0.18);
    this.buildIterator=this.buildSteps();
    this.setActive(false);
    if(!deferred){for(const _ of this.buildIterator){}this.buildIterator=null;this.setActive(true);}
  }
  cameraCandidates:AbstractMesh[]=[];
  refreshCameraIndex(){this.cameraCandidates=this.root.getChildMeshes().filter(m=>m.metadata?.cameraObstacle===true||m.metadata?.indoorWallSection===true);}
  buildStage='begin';
  buildSlices:{stage:string;ms:number}[]=[];
  async finishBuild(){
    if(!this.buildIterator)return;
    try{let done=false;while(!done){const start=performance.now();do{const t=performance.now();done=this.buildIterator.next().done===true;const ms=performance.now()-t;if(ms>12)this.buildSlices.push({stage:this.buildStage,ms});}while(!done&&performance.now()-start<12);if(!done)await new Promise<void>(r=>requestAnimationFrame(()=>r()));}}
    finally{this.buildIterator=null;}
    if(studioRelease(this.regionId)){this.studio=this.regionId===UNDERSEA?new UnderseaWorld(this):(this.regionId===TOWN||this.regionId===CITY)?new TownWorld(this):new StudioWorld(this);await this.studio.init(this.studioStart??studioRelease(this.regionId).spawn);}
    if(ANIMAL_SITES.some(a=>a.regionId===this.regionId)){this.animals=new AmbientAnimals(this);await this.animals.prepare();}
  }
  private retainedBytes:number|undefined;
  estimateRetainedBytes(){
    if(this.retainedBytes!==undefined)return this.retainedBytes;
    const geometries=new Set<any>(),textures=new Set<any>();let bytes=0,meshes=0;
    for(const mesh of this.root.getChildMeshes()){meshes++;const g=(mesh as Mesh).geometry;if(g)geometries.add(g);for(const t of mesh.material?.getActiveTextures()??[])textures.add(t);}
    bytes+=geometryRetainedBytes(geometries);
    for(const t of textures){const s=t.getSize();bytes+=s.width*s.height*4*4/3*(t.isCube?6:1);}
    // Account for scene nodes in addition to CPU/GPU geometry and mip chains.
    return this.retainedBytes=bytes+meshes*4096;
  }
  async prepareVisibleEffects(){await this.villa?.prepareVisibleEffects();}
  setActive(active:boolean){
    this.root.setEnabled(active);if(this.studio instanceof TownWorld||this.studio instanceof UnderseaWorld)this.studio.setActive(active);this.light.setEnabled(active);this.hemi.setEnabled(active);
    this.light.name=active?'sun':'cached sun';this.hemi.name=active?'sky':'cached sky';
    const sky=this.sky?.material;if(sky)sky.name=active?'sky daylight gradient':'cached sky gradient';
    if(active){
      if(!this.cameraCandidates.length)this.refreshCameraIndex();
      const night=['graveyard','castle','dragon'].includes(this.chapter.biome);
      this.light.intensity=this.indoor?1.3:night?1.05:2.95;this.light.diffuse=color(night?'#bdcff8':'#fff1db');
      this.hemi.intensity=this.indoor?.48:night?.58:.33;this.hemi.diffuse=color(night?'#b8cafa':'#e5edff');
      this.scene.clearColor=Color4.FromHexString(this.chapter.palette.sky+'ff');this.scene.fogMode=Scene.FOGMODE_LINEAR;
      this.scene.fogStart=night?44:this.chapter.biome==='forest'?82:110;this.scene.fogEnd=this.regionId===CITY?430:night?165:285;this.scene.fogColor=color(night?'#69758d':'#bed8e4');this.surfaces.activate();if(this.regionId===UNDERSEA){this.scene.fogStart=12;this.scene.fogEnd=90;this.scene.fogColor=color('#245966');this.light.intensity=1.8;this.light.diffuse=color('#b9dcdb');this.hemi.intensity=.55;}
    }
  }
  private *buildSteps():Generator<void>{
    const {regionId,chapter,scene}=this,night=['graveyard','castle','dragon'].includes(chapter.biome);
    if(studioRelease(regionId)){if(regionId!==UNDERSEA)this.atmosphere(night);this.regionWaymarks();return;}
    if(regionId===VILLA_REGION){this.villa=buildVilla(this);this.atmosphere(false);this.regionWaymarks();this.fieldVisuals=buildFieldVisuals(this);this.chainVisuals=buildFieldChainVisuals(this);return;}
    const regional = EXPLORATION_REGIONS.includes(regionId);
    if (!this.indoor) { this.buildStage='terrain';yield* this.terrainSteps(); yield;this.buildStage='paths'; yield* this.pathsSteps(); yield; }
    if (!regional){this.buildStage='scenery';yield* this.scenerySteps();}
    if (!regional) {
      if (chapter.biome === "village"){this.buildStage='village';yield* buildVillageDistrictSteps(this);}
      this.biomeDetails(); buildExplorationDistrict(this);
      enrichStoryLandmarks(this);
    } else {yield* buildRegionalEnvironmentSteps(this, regionId);}
    yield;
    for (const l of chapter.landmarks) this.landmark(l);
    if (!regional) this.camp(chapter.camp.x, chapter.camp.z);
    for (const it of [...chapter.interactions, ...chapter.secrets])
      this.marker(it.id, it.kind, it.x, it.z);
    if (!regional) this.exit(chapter.exit.x, chapter.exit.z);
    if (!this.indoor) this.atmosphere(night);
    this.regionWaymarks();
    if(!this.indoor&&this.nightLanternSources.length)for(let slot=0;slot<2;slot++){
      const pool=new PointLight('bounded night lantern pool '+slot,Vector3.Zero(),scene);pool.parent=this.root;pool.diffuse=color('#ffc58d');pool.radius=.55;pool.intensity=0;pool.setEnabled(false);
      pool.metadata={nightLanternPool:true,slot,sources:this.nightLanternSources};this.nightLanternPools.push(pool);
    }
    if (!this.indoor) {
      if(environmentAssetStats(scene).loaded)for(const t of regionWoodland(regionId,chapter)){
        const root=this.editableAsset(t.species,v3(t.x,this.groundHeight(t.x,t.z),t.z),v3(t.scale,t.scale,t.scale));root.rotation.y+=t.yaw;
        for(let i=0;i<3;i++){const x=t.x+Math.sin(t.seed+i*2.4)*1.8,z=t.z+Math.cos(t.seed+i*2.4)*1.8,scale=.45+i*.1;this.editableAsset((['shrub','grass','bluebell'] as const)[i],v3(x,this.groundHeight(x,z),z),v3(scale,scale,scale));}
      }
      this.buildStage='ground-details';yield* this.reusedGroundDetailSteps(); yield;this.buildStage='lush'; yield* buildLushUnderstorySteps(this);
    }
    yield;this.buildStage='merge'; yield* this.mergeSteps(); yield;
    this.journeyVisuals=buildJourneyVisuals(this);
    this.fieldVisuals=buildFieldVisuals(this);this.chainVisuals=buildFieldChainVisuals(this);
  }
  mat(hex: string, emissive = 0, alpha = 1) {
    const key = hex + ":" + emissive + ":" + alpha;
    if (this.mats.has(key)) return this.mats.get(key)!;
    const m = new StandardMaterial("paint-" + key, this.scene);
    // StandardMaterial decodes its final gamma-domain diffuse result before
    // image processing. PBR pigments below are linear; do not double-decode here.
    m.diffuseColor = color(hex);
    m.specularColor = new Color3(0.07, 0.07, 0.07);
    m.emissiveColor = color(hex).scale(emissive);
    m.alpha = alpha;
    this.mats.set(key, m);
    return m;
  }
  add(mesh: Mesh, hex: string, staticMesh = true, emissive = 0) {
    const name = mesh.name;
    const surface: Surface | null = /\btree\b|trunk|branch|root/.test(name)
      ? "bark"
      : /timber|beam|wood|door|bench|log|plank|handrail|post|sail/.test(name)
        ? "timber"
        : /roof|shingle/.test(name)
          ? "terracotta"
          : /plaster|limewash/.test(name)
            ? "plaster"
            : /castle|chimney|gallery stone|column|arch|headstone|altar|pier|capital|mosaic|floor/.test(
                  name,
                )
              ? "masonry"
              : /stone|rock/.test(name)
                ? "stone"
                : null;
    mesh.material = emissive
      ? this.mat(hex, emissive)
      : /linen|canvas/.test(name)
        ? this.surfaces.fabric(hex)
      : surface
        ? this.surfaces.surface(surface)
        : this.surfaces.paint(hex);
    mesh.parent = this.root;
    mesh.receiveShadows = true;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      cameraObstacle:
        /trunk|branch|cottage|wall|castle|tower|stone|rock|roof|beam|arch|column/.test(
          name,
        ) && !/terrain|path|cobble/.test(name),
    };
    if (staticMesh) this.staticMeshes.push(mesh);
    if (!/terrain|water|grass|fern|worn path|ridge|sky|cobble/.test(name))
      this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  textured(
    mesh: Mesh,
    kind: Surface,
    staticMesh = true,
    castShadow = true,
    tint = "#ffffff",
  ) {
    mesh.material = this.surfaces.surface(kind, tint);
    mesh.parent = this.root;
    mesh.receiveShadows = true;
    mesh.metadata = {
      cameraObstacle: [
        "bark",
        "stone",
        "limestone",
        "masonry",
        "plaster",
        "terracotta",
      ].includes(kind),
    };
    if (staticMesh) this.staticMeshes.push(mesh);
    if (castShadow) this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    hex: string,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    m.position.set(x, y, z);
    // Cuboid UVs retain a common physical texel scale; wide furniture no longer
    // stretches one wood-grain tile over every differently sized face.
    const p=m.getVerticesData(VertexBuffer.PositionKind)!,n=m.getVerticesData(VertexBuffer.NormalKind)!,uv:number[]=[];
    for(let i=0;i<p.length;i+=3){const nx=Math.abs(n[i]),ny=Math.abs(n[i+1]);
      if(ny>.8)uv.push(p[i+2]/1.8,p[i]/3.2);
      else if(nx>.8)uv.push(p[i+1]/1.8,p[i+2]/3.2);
      else uv.push(p[i+1]/1.8,p[i]/3.2);
    }m.setVerticesData(VertexBuffer.UVKind,uv);
    return this.add(m, hex);
  }
  tube(name: string, pts: Vector3[], r: number, hex: string, taper = true, staticMesh = true) {
    const m = MeshBuilder.CreateTube(
      name,
      {
        path: pts,
        radius: r,
        tessellation: 12,
        radiusFunction: taper
          ? (i) => r * (1 - (i / (pts.length - 1)) * 0.78)
          : undefined,
        cap: Mesh.CAP_ALL,
      },
      this.scene,
    );
    return this.add(m, hex, staticMesh);
  }
  rock(x: number, z: number, s: number, tint = "#e6e7dc", yy?: number) {
    const m = MeshBuilder.CreateSphere(
      "weathered mossy stone",
      { diameter: 2, segments: s > 2 ? 22 : 16 },
      this.scene,
    );
    const positions = m.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < positions.length; i += 3) {
      const px = positions[i],
        py = positions[i + 1],
        pz = positions[i + 2];
      const r =
        1 +
        Math.sin(px * 5.1 + pz * 3.8 + x) * 0.065 +
        Math.sin(py * 6.2 - pz * 4.4 + z) * 0.08;
      positions[i] *= r;
      positions[i + 1] *= r;
      positions[i + 2] *= r;
    }
    m.setVerticesData(VertexBuffer.PositionKind, positions);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, m.getIndices()!, normals);
    m.setVerticesData(VertexBuffer.NormalKind, normals);
    m.scaling.set(s, s * 0.68, s * 0.85);
    m.position.set(x, yy ?? this.landHeight(x, z) + s * 0.23, z);
    m.rotation.set(0.07 * Math.sin(x), z * 0.61, 0.1 * Math.sin(z));
    this.textured(
      m,
      "stone",
      true,
      s > 0.35,
      tint === "#d8dfd2" ? "#f6f3e7" : "#ffffff",
    );
    m.metadata.cameraObstacle = s > 0.7;
    if(s>.35 && yy===undefined) this.ambientPatch(x,z,s*1.95,s*1.75,.27);
    return m;
  }
  /** Shared soft ground occlusion for static roots/foundations; conformed to terrain. */
  private ambientPatch(x:number,z:number,width:number,depth:number,opacity:number){
    if(!this.contactTexture){
      const texture=new DynamicTexture("shared soft ground contact",64,this.scene,false),ctx=texture.getContext();
      const gradient=ctx.createRadialGradient(32,32,5,32,32,31);gradient.addColorStop(0,"rgba(0,0,0,.8)");gradient.addColorStop(.55,"rgba(0,0,0,.4)");gradient.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);texture.hasAlpha=true;texture.update();this.contactTexture=texture;
    }
    const key="ground-contact-"+opacity;let mat=this.mats.get(key);
    if(!mat){mat=new StandardMaterial(key,this.scene);mat.diffuseTexture=this.contactTexture;mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.emissiveColor=Color3.Black();mat.alpha=opacity;mat.disableDepthWrite=true;mat.zOffset=-1;this.mats.set(key,mat);}
    const patch=MeshBuilder.CreateGround("ambient ground contact",{width,height:depth,subdivisions:4,updatable:true},this.scene);
    const points=patch.getVerticesData(VertexBuffer.PositionKind)!;
    for(let i=0;i<points.length;i+=3)points[i+1]=this.height(x+points[i],z+points[i+2])+.052;
    patch.updateVerticesData(VertexBuffer.PositionKind,points);patch.position.set(x,0,z);patch.parent=this.root;patch.material=mat;patch.metadata={cameraObstacle:false};patch.isPickable=false;this.staticMeshes.push(patch);
  }
  private waterProfile(w: { x: number; z: number; width: number; depth: number }, x: number) { return waterProfile(this.chapter, w, x); }
  private onBridge(x:number,z:number,margin=.2) {return this.chapter.landmarks.some(l=>{if(l.kind!=="bridge")return false;const p=this.bridgeLocal(x,z,l),scale=l.scale??1;return Math.abs(p.x)<1.7*scale+margin&&Math.abs(p.z)<4.2*scale+margin;});}
  private inWater(x: number, z: number, margin = 0) {
    return (this.chapter.terrain.water ?? []).some((w) => {
      const p = this.waterProfile(w, x);
      return (
        Math.abs(x - w.x) < w.width / 2 + margin &&
        Math.abs(z - p.z) < p.half + margin
      );
    });
  }
  private waterLevel(x: number, z: number) { return waterLevel(this.chapter,x,z); }
  private landHeight(x: number, z: number) { return this.indoor ? 0 : this.regionId==='mushroom-grove'?regionGroundHeight(this.regionId,x,z):landHeight(this.chapter,x,z); }
  private groundHeight(x: number, z: number) { return this.indoor ? 0 : this.regionId==='mushroom-grove'?regionGroundHeight(this.regionId,x,z):groundHeight(this.chapter,x,z); }
  /** Sample the actual two terrain triangles for conforming decal heights.
   * The V3 bridge-approach dark triangles were inverted road joins, verified
   * separately; this sampler protects the narrower V4 road cells at the bank. */
  renderedGroundHeight(x: number, z: number) {
    const cols = ["village","river","forest"].includes(this.chapter.biome) ? 292 : 146;
    const rows = ["village","river","forest"].includes(this.chapter.biome) ? 368 : 184;
    const terrainWidth=this.regionId==='mushroom-grove'?370:146,terrainDepth=this.regionId==='mushroom-grove'?673:196;
    const dx = terrainWidth / cols, dz = terrainDepth / rows;
    const gx = (x + terrainWidth/2) / dx, gz = (z + 40) / dz;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
    const h = (a: number, b: number) => this.groundHeight(-terrainWidth/2 + a * dx, -40 + b * dz) - .035;
    const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  terrain() {for(const _ of this.terrainSteps()){} }
  private *terrainSteps():Generator<void> {
    const w = this.regionId==='mushroom-grove'?370:146,
      d = this.regionId==='mushroom-grove'?673:196,
      cols = ["village","river","forest"].includes(this.chapter.biome) ? 292 : 146,
      rows = ["village","river","forest"].includes(this.chapter.biome) ? 368 : 184;
    const positions: number[] = [],
      indices: number[] = [],
      colors: number[] = [],
      uvs: number[] = [];
    const biomeTint = (["graveyard", "castle"].includes(this.chapter.biome)
      ? color("#bac3d5")
      : this.chapter.biome === "mountain"
        ? color("#e6e1c9")
        : this.chapter.biome === "dragon"
          ? color("#c2c6df")
          : color(this.chapter.biome === "village" ? "#f3f8ed" : "#f6f3dc")).toLinearSpace();
    for (let j = 0; j <= rows; j++){
      if(j%16===15)yield;
      for (let i = 0; i <= cols; i++) {
        const x = (i / cols - 0.5) * w,
          z = (j / rows) * d - 40;
        const bounds=regionBounds(this.regionId);
        const beyond = Math.max(0, x-bounds.maxX-4, bounds.minX-4-x, z-bounds.maxZ-7, bounds.minZ-7-z);
        const hill =
          beyond > 0
            ? Math.pow(beyond / 9, 1.35) *
              (1.1 + 0.35 * Math.sin(x * 0.08 + z * 0.065))
            : 0;
        positions.push(x, this.groundHeight(x, z) - 0.035 + hill, z);
        const v =
          0.93 +
          Math.sin(x * 0.115 + z * 0.087) * 0.045 +
          Math.cos(x * 0.21 - z * 0.12) * 0.025;
        colors.push(biomeTint.r * v, biomeTint.g * v, biomeTint.b * v, 1);
        uvs.push(x / 5.5, z / 5.5);
        if (i < cols && j < rows) {
          const a = j * (cols + 1) + i;
          indices.push(
            a,
            a + 1,
            a + cols + 1,
            a + 1,
            a + cols + 2,
            a + cols + 1,
          );
        }
      }
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    data.uvs = uvs;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    const ground = new Mesh("terrain meadow soil", this.scene);
    data.applyToMesh(ground);
    this.textured(ground, "meadow", true, false);
    if (EXPLORATION_REGIONS.includes(this.regionId)) ground.material=this.surfaces.moss();
    ground.metadata.cameraObstacle = false;
    for (const water of this.chapter.terrain.water ?? []) {
      const level = this.waterLevel(water.x, water.z);
      for (const side of [-1, 1]) {
        const p: number[] = [],
          uv: number[] = [],
          ix: number[] = [],
          steps = Math.ceil(water.width * 2);
        for (let i = 0; i <= steps; i++) {
          const x = water.x - water.width / 2 + (i / steps) * water.width;
          for (const offset of [-0.35, 0.85]) {
            const profile = this.waterProfile(water, x),
              z = profile.z + side * (profile.half + offset);
            p.push(x, this.groundHeight(x, z) + 0.023, z);
            uv.push(x / 2, (offset + 0.35) / 1.2);
          }
          if (i < steps) {
            const a = i * 2;
            ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
        const data = new VertexData();
        data.positions = p;
        data.uvs = uv;
        data.indices = ix;
        data.normals = [];
        VertexData.ComputeNormals(p, ix, data.normals);
        if (data.normals[1] < 0)
          for (let n = 0; n < data.normals.length; n++) data.normals[n] *= -1;
        const bank = new Mesh("damp earthen creek bank", this.scene);
        data.applyToMesh(bank);
        this.textured(bank, "earth", true, false);
        bank.metadata.cameraObstacle = false;
        (bank.material as PBRMaterial).backFaceCulling = false;
      }
      const wp: number[] = [],
        waterColors: number[] = [],
        bedPositions: number[] = [],
        wu: number[] = [],
        wi: number[] = [],
        steps = Math.ceil(water.width * 2.5),
        rows = 8;
      for (let i = 0; i <= steps; i++) {
        const x = water.x - water.width / 2 + (i / steps) * water.width,
          profile = this.waterProfile(water, x);
        for (let j = 0; j <= rows; j++) {
          const z = profile.z + (j / rows - 0.5) * profile.half * 2;
          wp.push(x, level, z);
          const depth = Math.pow(Math.sin(j / rows * Math.PI), .65);
          bedPositions.push(x, level - .09 - depth * (.74 + .08 * Math.sin(x * .4)), z);
          waterColors.push(.80 - depth * .31, .98 - depth * .13, .86 - depth * .03, 1);
          wu.push(x / 7, z / 4);
          if (i < steps && j < rows) {
            const a = i * (rows + 1) + j;
            wi.push(a, a + rows + 1, a + 1, a + 1, a + rows + 1, a + rows + 2);
          }
        }
      }
      const waterData = new VertexData();
      waterData.positions = wp;
      waterData.colors = waterColors;
      waterData.indices = wi;
      waterData.uvs = wu;
      waterData.normals = [];
      VertexData.ComputeNormals(wp, wi, waterData.normals);
      const bedData = new VertexData();bedData.positions = bedPositions;bedData.indices = wi;bedData.uvs = wu;bedData.normals=[];
      VertexData.ComputeNormals(bedPositions,wi,bedData.normals);
      const bed=new Mesh("submerged earthen creek bed",this.scene);bedData.applyToMesh(bed);this.textured(bed,"earth",true,false);bed.metadata.cameraObstacle=false;
      const surface = new Mesh("water flowing creek", this.scene);
      waterData.applyToMesh(surface);
      this.textured(surface, "water", false, false);
      surface.metadata.cameraObstacle = false;
      const mat = surface.material as PBRMaterial;
      this.animated.push((t) => {
        if (mat.bumpTexture) {
          (mat.bumpTexture as Texture).uOffset = t * 0.017;
          (mat.bumpTexture as Texture).vOffset = t * -0.008;
        }
        surface.position.y = Math.sin(t * 0.85) * 0.015;
      });
      // Shallow submerged stones follow the bank profile and share the existing stone material.
      if(["village","river","forest"].includes(this.chapter.biome)) for(let i=0;i<48;i++) {
        const xx=water.x-water.width*.48+i*water.width*.96/48,profile=this.waterProfile(water,xx),side=i%2?1:-1;
        const zz=profile.z+side*profile.half*(.74+.12*Math.sin(i*3.1));
        this.rock(xx,zz,.13+.08*Math.abs(Math.sin(i*2.7)),"#c1bba0",level-.16-.04*Math.sin(i));
      }
      // Fine current streaks at the bank. These replace the old isolated rings.
      for (let i = 0; i < Math.floor(water.width / 2.6); i++) {
        const xx = water.x - water.width * 0.46 + i * 2.6,
          profile = this.waterProfile(water, xx),
          zz = profile.z + Math.sin(i * 9.1) * profile.half * 0.75;
        const curve = Curve3.CreateCatmullRomSpline(
          [
            new Vector3(xx, level + 0.025, zz),
            new Vector3(xx + 0.65, level + 0.025, zz + 0.07),
            new Vector3(xx + 1.25, level + 0.025, zz - 0.03),
          ],
          4,
        ).getPoints();
        const foam = this.tube(
          "water delicate current",
          curve,
          0.013,
          "#c9ded1",
          false,
        );
        foam.material = this.mat("#c9ded1", 0.12, 0.37);
        foam.metadata.cameraObstacle = false;
        this.shadows.removeShadowCaster(foam);
      }
      for (const side of [-1, 1])
        for (let i = 0; i < Math.floor(water.width / 1.9); i++) {
          if (i % 5 === 2) continue;
          const x =
              water.x -
              water.width * 0.49 +
              i * 1.9 +
              Math.sin(i * 9.83 + side) * 0.65,
            profile = this.waterProfile(water, x),
            z =
              profile.z +
              side * (profile.half + 0.13 + Math.sin(i * 2.8) * 0.35);
          if (this.pathDistance(x, z) < 2.1 || this.onBridge(x,z,.5)) continue;
          this.rock(
            x,
            z,
            0.16 + Math.abs(Math.sin(i * 3.62 + side)) * 0.51,
            "#d6d9be",
          );
          for (let reed = 0; reed < 3; reed++)
            this.grassTuft(
              x + 0.25 + Math.sin(reed * 6 + i) * 0.46,
              z + side * (0.38 + reed * 0.15),
              0.65 + Math.abs(Math.sin(i + reed)) * 0.5,
              i * 7 + reed,
            );
        }
    }
  }
  paths() {for(const _ of this.pathsSteps()){} }
  private *pathsSteps():Generator<void> {
    for (const path of this.chapter.paths) {
      if (path.kind === "bridge") continue;
      const pts = roadCenterline(path.points, path.width);
      const vertices: number[] = [],
        indices: number[] = [],
        uvs: number[] = [];
      let distance = 0;
      const across = Math.max(6, Math.ceil(path.width / .28));
      for (let i = 0; i < pts.length; i++) {
        if(i%48===47)yield;
        const p = pts[i],
          next = pts[Math.min(i + 1, pts.length - 1)],
          prev = pts[Math.max(0, i - 1)],
          dx = next.x - prev.x,
          dz = next.z - prev.z,
          length = Math.hypot(dx, dz) || 1;
        if (i) distance += Vector3.Distance(pts[i - 1], p);
        for (let column = 0; column <= across; column++) {
          const side = column / across * 2 - 1;
          const width = path.width * (0.52 + 0.015 * Math.sin(i * 0.225));
          const x = p.x + ((side * dz) / length) * width,
            z = p.z - ((side * dx) / length) * width;
          // Keep above both the exact terrain triangles and the analytic water
          // shoulder. At sharp bank transitions either surface may be higher.
          vertices.push(x, Math.max(this.renderedGroundHeight(x, z) + 0.025, this.groundHeight(x, z) + .02), z);
          uvs.push(
            column / across,
            distance / (path.kind === "stone" ? 4.6 : 5),
          );
        }
        if (
          i < pts.length - 1 &&
          !this.inWater(p.x, p.z, 0.05) &&
          !this.inWater(next.x, next.z, 0.05)
        ) {
          for (let column = 0; column < across; column++) {
            const a = i * (across + 1) + column, nextRow = a + across + 1;
            indices.push(a, a + 1, nextRow, a + 1, nextRow + 1, nextRow);
          }
        }
      }
      const data = new VertexData();
      data.positions = vertices;
      data.indices = indices;
      data.uvs = uvs;
      data.normals = [];
      VertexData.ComputeNormals(vertices, indices, data.normals);
      const road = new Mesh("worn path embedded cobbles", this.scene);
      data.applyToMesh(road);
      this.textured(
        road,
        path.kind === "stone" ? "path" : "trail",
        true,
        false,
      );
      road.metadata.cameraObstacle = false;
      road.material = this.surfaces.lane();
      if (path.kind === 'stone' && ['village','river','forest'].includes(this.chapter.biome)) yield* this.cobbledLaneSteps(pts,path.width);
      for (let i = 4; i < pts.length - 4; i += 8) {
        if(i%64===4)yield;
        const p = pts[i],
          detailIndex = i / 2,
          next = pts[i + 1],
          dx = next.x - p.x,
          dz = next.z - p.z,
          len = Math.hypot(dx, dz) || 1;
        for (const side of [-1, 1]) {
          const x = p.x + ((side * dz) / len) * (path.width * 0.56 + 0.18),
            z = p.z - ((side * dx) / len) * (path.width * 0.56 + 0.18);
          if (this.inWater(x, z, 0.65)) continue;
          this.grassTuft(x, z, 0.4 + (detailIndex % 5) * 0.08, detailIndex + side * 3);
          if (detailIndex % 12 === 2) this.fern(x + side * 0.5, z + 0.3, 0.65, detailIndex);
          if (detailIndex % 20 === 2) this.flower(x + side * 0.6, z - 0.3, detailIndex);
          if (detailIndex % 28 === 2)
            this.rock(x - side * 0.15, z + 0.4, 0.13 + (detailIndex % 3) * 0.035);
        }
      }
    }
  }
  private *cobbledLaneSteps(pts:Vector3[],width:number):Generator<void> {
    const pos:number[]=[],ix:number[]=[],uv:number[]=[],col:number[]=[];
    let travel=0,row=0;
    for(let i=1;i<pts.length-1;i++){
      if(i%24===23)yield;
      travel+=Vector3.Distance(pts[i-1],pts[i]);if(travel<.58)continue;travel=0;row++;
      const p=pts[i],d=pts[i+1].subtract(pts[i-1]).normalize();if(this.inWater(p.x,p.z,.3))continue;
      const across=Math.floor(width/.65);
      for(let c=0;c<across;c++){
        const offset=(c-(across-1)/2)*.64+(row%2?.16:-.16),xx=p.x+d.z*offset,zz=p.z-d.x*offset,seed=row*71+c*31;
        if(Math.abs(offset)>width*.38&&Math.sin(seed)>.4)continue;
        const y=this.renderedGroundHeight(xx,zz)+.045,base=pos.length/3,h=.035+.015*Math.sin(seed),halfX=.275+.028*Math.sin(seed*3),halfZ=.24+.025*Math.sin(seed*5),a=Math.atan2(d.x,d.z)+Math.sin(seed)*.055;
        const ring=[[-halfX+.055,-halfZ],[halfX-.045,-halfZ],[halfX,-halfZ+.05],[halfX,halfZ-.05],[halfX-.05,halfZ],[-halfX+.05,halfZ],[-halfX,halfZ-.04],[-halfX,-halfZ+.045]];
        const tint=color(['#f3efdf','#ece9d8','#eee6d1','#f5efdf','#e8e5d3'][Math.abs(seed)%5]).toLinearSpace();
        for(let level=0;level<2;level++)for(let k=0;k<8;k++){const scale=level===0?1:.91,[u,v]=ring[k];const rx=(u*Math.cos(a)+v*Math.sin(a))*scale,rz=(-u*Math.sin(a)+v*Math.cos(a))*scale;pos.push(xx+rx,this.renderedGroundHeight(xx+rx,zz+rz)+.027+level*h,zz+rz);uv.push((xx+rx)/1.8,(zz+rz)/1.8);col.push(tint.r,tint.g,tint.b,1);if(level===0){const q=base+k,b=base+(k+1)%8;ix.push(q,b,q+8,b,b+8,q+8);}}
        const center=pos.length/3;pos.push(xx,y+h,zz);uv.push(xx/1.8,zz/1.8);col.push(tint.r,tint.g,tint.b,1);for(let k=0;k<8;k++)ix.push(center,base+8+k,base+8+(k+1)%8);
      }
    }
    const vd=new VertexData();vd.positions=pos;vd.indices=ix;vd.uvs=uv;vd.colors=col;vd.normals=[];VertexData.ComputeNormals(pos,ix,vd.normals);const mesh=new Mesh('individually bevelled worn cobble lane',this.scene);vd.applyToMesh(mesh);this.add(mesh,'#ffffff');mesh.material=this.surfaces.surface('limestone','#ffffff');mesh.metadata.cameraObstacle=false;
  }
  private cards(
    name: string,
    cards: {
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      yaw: number;
      pitch: number;
      roll: number;
      tint: number;
    }[],
    atlas: "foliage" | "fern" | "grass-blades",
    cast = false,
  ) {
    const positions: number[] = [],
      normals: number[] = [],
      uvs: number[] = [],
      indices: number[] = [],
      colors: number[] = [];
    const center = cards.reduce((v,c)=>v.addInPlace(new Vector3(c.x,c.y,c.z)),Vector3.Zero()).scale(1/Math.max(1,cards.length));
    for (const card of cards) {
      const right=new Vector3(Math.cos(card.yaw),0,-Math.sin(card.yaw));
      const up=new Vector3(Math.sin(card.yaw)*Math.sin(card.pitch),Math.cos(card.pitch),Math.cos(card.yaw)*Math.sin(card.pitch));
      const rr=right.scale(Math.cos(card.roll)).add(up.scale(Math.sin(card.roll))), uu=up.scale(Math.cos(card.roll)).subtract(right.scale(Math.sin(card.roll)));
      const planeNormal=Vector3.Cross(uu,rr).normalize(), offset=positions.length/3;
      const volume=new Vector3(card.x-center.x,(card.y-center.y)*1.8+.5,card.z-center.z).normalize();
      for(let j=0;j<=2;j++)for(let i=0;i<=2;i++){
        const u=i/2,v=j/2,bend=atlas==="foliage"?Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*card.width*.12:0;
        const p=new Vector3(card.x,card.y,card.z).add(rr.scale((u-.5)*card.width)).add(uu.scale((v-.5)*card.height)).add(planeNormal.scale(bend));
        const n=atlas==="foliage"?volume.scale(.8).add(planeNormal.scale(.2)).normalize():planeNormal.scale(.28).add(Vector3.Up().scale(.92)).normalize();
        positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uvs.push(u,1-v);colors.push(card.tint,card.tint,card.tint,1);
        if(i<2&&j<2){const a=offset+j*3+i;indices.push(a,a+1,a+3,a+1,a+4,a+3);}
      }
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.uvs = uvs;
    data.colors = colors;
    const mesh = new Mesh(name, this.scene);
    data.applyToMesh(mesh);
    mesh.parent = this.root;
    mesh.material = this.surfaces.foliage(atlas);
    mesh.receiveShadows = true;
    mesh.metadata = { cameraObstacle: false };
    this.staticMeshes.push(mesh);
    if (cast) this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  grassTuft(x: number, z: number, size: number, seed: number) {
    if (this.inWater(x, z, 0.18) || this.onBridge(x, z, 0.15 + size * 0.7)) return;
    const y = this.groundHeight(x, z),
      cards = [];
    for (let i = 0; i < 3; i++)
      cards.push({
        x: x + Math.sin(seed + i * 2) * 0.12,
        y: y + size * 0.4,
        z: z + Math.cos(seed + i * 2) * 0.1,
        width: size * 1.2,
        height: size,
        yaw: seed + (i * Math.PI) / 3,
        pitch: 0.08 * Math.sin(seed),
        roll: 0.07 * Math.cos(seed + i),
        tint: 0.83 + (i % 3) * 0.075,
      });
    this.cards("grass varied fine blades", cards, "grass-blades");
  }
  fern(x: number, z: number, s: number, seed: number) {
    if (this.inWater(x, z, 0.25) || this.onBridge(x, z, s)) return;
    if(!environmentAssetStats(this.scene).loaded){this.grassTuft(x,z,s*.7,seed);return;}
    const y = this.groundHeight(x, z);
    const root=this.editableAsset('fern',new Vector3(x,y,z),new Vector3(s,s,s));root.rotation.y+=seed;
  }
  /** Reuse three small plant/pebble clusters; no textures, AI, or colliders added. */
  private reusedGroundDetails() {for(const _ of this.reusedGroundDetailSteps()){} }
  private *reusedGroundDetailSteps():Generator<void> {
    let seed=9203+this.chapter.index*113+this.regionId.length*997;
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const templates:{x:number;z:number;y:number;meshes:Mesh[]}[]=[];
    let groups=0;
    for(let attempt=0;attempt<360&&groups<32;attempt++){
      const x=(rand()-.5)*69,z=-9+rand()*114;
      if((this.regionId==='ch01-lantern-village'&&x>-20&&x<20&&z<25)||this.pathDistance(x,z)<3||this.inWater(x,z,1.1)||this.onBridge(x,z,1.3)||Math.hypot(x-this.chapter.camp.x,z-this.chapter.camp.z)<5||
        [...this.chapter.interactions,...this.chapter.secrets,...regionConnections(this.regionId)].some(p=>Math.hypot(p.x-x,p.z-z)<4.5)||
        this.chapter.landmarks.some(p=>Math.hypot(p.x-x,p.z-z)<5*(p.scale??1))||
        this.obstacles.some(p=>Math.hypot(p.x-x,p.z-z)<Math.max(p.r||0,p.width??0,p.depth??0)/2+2))continue;
      const y=this.groundHeight(x,z);
      if(templates.length<3){const start=this.scene.meshes.length;
        this.rock(x,z,.17+(groups%3)*.035);
        this.fern(x+.42,z+.25,.45+(groups%3)*.07,groups+31);
        this.grassTuft(x-.35,z+.35,.48,groups+43);
        templates.push({x,z,y,meshes:this.scene.meshes.slice(start).filter((m):m is Mesh=>m instanceof Mesh)});
      }else{
        const source=templates[groups%3],delta=new Vector3(x-source.x,y-source.y,z-source.z);
        for(const mesh of source.meshes){if(!mesh.geometry)continue;const clone=mesh.createInstance('shared understory '+mesh.name);clone.parent=this.root;clone.position.copyFrom(mesh.position).addInPlace(delta);clone.rotation.copyFrom(mesh.rotation);clone.scaling.copyFrom(mesh.scaling);if(mesh.rotationQuaternion)clone.rotationQuaternion=mesh.rotationQuaternion.clone();clone.isPickable=false;clone.receiveShadows=true;clone.metadata={cameraObstacle:false};}
      }
      groups++;if(groups%3===0)yield;
    }
  }
  treeCopies(trees: readonly {x:number;z:number;s:number;seed:number;templateSeed?:number}[]) {for(const _ of this.treeCopiesSteps(trees)){} }
  *treeCopiesSteps(trees: readonly {x:number;z:number;s:number;seed:number;templateSeed?:number}[]):Generator<void> {
    let built=0;
    if(environmentAssetStats(this.scene).loaded&&!['graveyard','castle'].includes(this.chapter.biome)){for(const t of trees){this.tree(t.x,t.z,t.s,t.templateSeed??t.seed);if(++built%6===0)yield;}return;}
    const templates=new Map<number,{x:number;z:number;base:number;meshes:Mesh[]}>();
    for(const t of trees){
      if(++built%6===0)yield;
      const original=t.templateSeed===undefined?undefined:templates.get(t.templateSeed);
      if(!original){const start=this.scene.meshes.length;this.tree(t.x,t.z,t.s,t.seed);templates.set(t.seed,{x:t.x,z:t.z,base:this.groundHeight(t.x,t.z),meshes:this.scene.meshes.slice(start).filter((m):m is Mesh=>m instanceof Mesh)});continue;}
      const delta=new Vector3(t.x-original.x,this.groundHeight(t.x,t.z)-original.base,t.z-original.z);
      for(const mesh of original.meshes){if(!mesh.geometry)continue;const copy=mesh.createInstance(mesh.name+' density instance');copy.parent=this.root;copy.position.copyFrom(mesh.position).addInPlace(delta);copy.rotation.copyFrom(mesh.rotation);copy.scaling.copyFrom(mesh.scaling);if(mesh.rotationQuaternion)copy.rotationQuaternion=mesh.rotationQuaternion.clone();copy.metadata={...mesh.metadata};copy.isPickable=mesh.isPickable;copy.receiveShadows=mesh.receiveShadows;this.shadows.addShadowCaster(copy);}
    }
  }
  tree(x: number, z: number, s: number, seed: number) {
    if (this.inWater(x, z, 1.1)) return;
    if(environmentAssetStats(this.scene).loaded&&!['graveyard','castle'].includes(this.chapter.biome)){
      const id=this.chapter.biome==='river'?'willow':Math.abs(Math.floor(seed))%3===1?'birch':'oak';
      const factor=s*.51,root=this.editableAsset(id,new Vector3(x,this.groundHeight(x,z),z),new Vector3(factor,factor,factor));root.rotation.y+=seed;
      this.ambientPatch(x,z,s*1.65,s*1.55,.30);
      if(Math.abs(x)<39)this.obstacles.push({x,z,r:s*.3,top:this.groundHeight(x,z)+s*5.5});
      return;
    }
    const base = this.groundHeight(x, z),
      night = ["graveyard", "castle"].includes(this.chapter.biome),
      lean = Math.sin(seed * 4.13) * s * 0.34;
    const trunkPath = Curve3.CreateCatmullRomSpline(
      [
        new Vector3(x, base - 0.03, z),
        new Vector3(x + lean * 0.28, base + s * 1.4, z + s * 0.1),
        new Vector3(x + lean, base + s * 3.05, z - s * 0.13),
        new Vector3(x + lean * 0.82, base + s * 5.15, z + s * 0.08),
      ],
      5,
    ).getPoints();
    this.ambientPatch(x,z,s*1.65,s*1.55,.30);
    const trunk = this.tube(
      "living tree trunk bark",
      trunkPath,
      s * 0.32,
      "#89735c",
    );
    trunk.metadata.cameraObstacle = true;
    const habit = Math.abs(Math.floor(seed)) % 3;
    const branchCount = habit === 0 ? 3 : habit === 1 ? 5 : 4;
    for (let branch = 0; branch < branchCount; branch++) {
      const angle = seed * 0.71 + branch * 2.39,
        reach = s * (habit === 0 ? .85 + (branch % 3)*.17 : habit === 1 ? 1.4+(branch%3)*.2 : 1.08+(branch%3)*.2),
        top = s * (habit === 0 ? 4.05+(branch%3)*.57 : 3.4+(branch%3)*.47),
        bx = Math.cos(angle) * reach,
        bz = Math.sin(angle) * reach;
      const points = Curve3.CreateCatmullRomSpline(
        [
          new Vector3(x + lean * 0.5, base + s * (1.8 + branch * 0.17), z),
          new Vector3(x + bx * 0.48, base + top * 0.74, z + bz * 0.4),
          new Vector3(x + bx, base + top, z + bz),
        ],
        4,
      ).getPoints();
      const b = this.tube(
        "living tree branch bark",
        points,
        s * (0.105 - branch * 0.008),
        "#88725b",
      );
      b.metadata.cameraObstacle = true;
      const twig = this.tube(
        "fine tree branch",
        [
          points[Math.floor(points.length * 0.6)],
          new Vector3(x + bx * 1.14, base + top + s * 0.25, z + bz * 0.65),
        ],
        s * 0.025,
        "#8d7961",
      );
      twig.metadata.cameraObstacle = false;
      if (!night || seed % 4 !== 0)
        this.crown(
          x + bx * 0.82,
          base + top + s * 0.52,
          z + bz * 0.82,
          s * (1.2 + (branch % 2) * 0.15),
          seed * 7 + branch,
        );
    }
    if (!night || seed % 3 !== 0)
      this.crown(x + lean, base + s * 5.2, z, s * 1.22, seed + 41);
    if (Math.abs(x) < 39) this.obstacles.push({ x, z, r: s * 0.3,top:base+s*5.5 });
    for (let i = 0; i < 5; i++) {
      const a = seed + i * 1.256;
      const ex = x + Math.cos(a) * s * 0.92,
        ez = z + Math.sin(a) * s * 0.92;
      const root = this.tube(
        "embedded tree root",
        Curve3.CreateCatmullRomSpline(
          [
            new Vector3(x, base + s * 0.35, z),
            new Vector3(
              x + Math.cos(a) * s * 0.46,
              base + 0.1,
              z + Math.sin(a) * s * 0.46,
            ),
            new Vector3(ex, this.groundHeight(ex, ez) - 0.02, ez),
          ],
          3,
        ).getPoints(),
        s * 0.13,
        "#86765b",
      );
      root.metadata.cameraObstacle = false;
    }
  }
  crown(x: number, y: number, z: number, s: number, seed: number) {
    // Near crowns use folded leaves with a separated upper/lower surface. The older alpha sprays remain
    // only on the outer tree belt, where their screen footprint is genuinely small.
    if (Math.abs(x) < 37 && z < 108) {
      const positions:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
      const dark=["graveyard","castle"].includes(this.chapter.biome);
      const pigments=(dark?["#607769","#7d9280","#9aab8d"]:["#617d45","#829d55","#a2b86d","#749448"]).map(c=>color(c).toLinearSpace());
      const count=30,flatten=.58+.055*(Math.abs(Math.floor(seed))%4);
      for(let cluster=0;cluster<count;cluster++){
        const f=(cluster+.5)/count,theta=cluster*2.399963+seed*.7,vertical=1-2*f,radial=Math.sqrt(1-vertical*vertical);
        const cx=x+Math.cos(theta)*radial*s*.87,cy=y+vertical*s*flatten,cz=z+Math.sin(theta)*radial*s*.87;
        for(let leaf=0;leaf<4;leaf++){
          const a=theta+leaf*1.256+Math.sin(cluster)*.5,pitch=Math.sin(cluster*1.7+leaf)*.75;
          const len=Math.min(.92,s*(.30+leaf*.018)),width=len*.39;
          const center=v3(cx+Math.cos(a)*len*.35,cy+Math.sin(leaf*2.8)*len*.20,cz+Math.sin(a)*len*.35);
          const forward=v3(Math.cos(a)*Math.cos(pitch),Math.sin(pitch),Math.sin(a)*Math.cos(pitch));
          const side=v3(-Math.sin(a),0,Math.cos(a)),up=Vector3.Cross(side,forward).normalize();
          const pigment=pigments[(cluster+leaf)%pigments.length],base=positions.length/3;
          for(let face=0;face<2;face++)for(let j=0;j<4;j++)for(let k=0;k<3;k++){
            const t=j/3,edge=k-1,wid=Math.sin(t*Math.PI)*width;
            const ridge=(1-Math.abs(edge))*.07*len*Math.sin(t*Math.PI),bend=Math.sin(t*Math.PI)*len*.11;
            const p=center.add(forward.scale((t-.5)*len)).add(side.scale(edge*wid)).add(up.scale(bend+ridge+(face===0?.004:-.004)));
            positions.push(p.x,p.y,p.z);uvs.push(t,k/2);const shade=face===0?1:.81;colors.push(pigment.r*shade,pigment.g*shade,pigment.b*shade,1);
            if(j<3&&k<2){const q=base+face*12+j*3+k;if(face===0)indices.push(q,q+3,q+1,q+1,q+3,q+4);else indices.push(q,q+1,q+3,q+1,q+4,q+3);}
          }
        }
      }
      const data=new VertexData();data.positions=positions;data.indices=indices;data.colors=colors;data.uvs=uvs;data.normals=[];VertexData.ComputeNormals(positions,indices,data.normals);
      const mesh=new Mesh('dimensional folded broadleaf canopy',this.scene);data.applyToMesh(mesh);this.add(mesh,'#ffffff');mesh.material=this.surfaces.paint('#ffffff',.83);(mesh.material as PBRMaterial).subSurface.isTranslucencyEnabled=true;(mesh.material as PBRMaterial).subSurface.translucencyIntensity=.14;mesh.metadata.cameraObstacle=false;return;
    }
    const cards = [];
    const count = Math.abs(x) > 42 ? 24 : 48;
    const flatten=.52+.08*(Math.abs(Math.floor(seed))%4);
    for (let i = 0; i < count; i++) {
      const f = (i + 0.5) / count,
        theta = i * 2.399963 + seed * 0.7,
        vertical = 1 - 2 * f;
      const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical)),
        spread = 0.65 + 0.35 * Math.abs(Math.sin(i * 7.13 + seed));
      cards.push({
        x: x + Math.cos(theta) * radial * s * spread,
        y: y + vertical * s * flatten,
        z: z + Math.sin(theta) * radial * s * spread,
        width: s * (0.75 + 0.12 * Math.sin(i * 2.8)),
        height: s * 0.84,
        yaw: theta + Math.sin(seed + i) * 0.8,
        pitch: Math.sin(i * 3.7) * 1.1,
        roll: Math.sin(i * 7.8) * 0.5,
        tint: 0.83 + (Math.sin(i * 9 + seed) + 1) * 0.12,
      });
    }
    const mesh = this.cards(
      "leaf canopy sprays",
      cards,
      "foliage",
      Math.abs(x) < 44,
    );
    if (["graveyard", "castle"].includes(this.chapter.biome))
      mesh.material = this.surfaces.foliage("foliage", "#afc2d1");
  }
  flower(x: number, z: number, seed: number) {
    if (this.inWater(x, z, 0.2) || this.onBridge(x, z, 0.55)) return;
    const y = this.landHeight(x, z);
    const s = 0.08 + (seed % 3) * 0.023;
    this.tube(
      "flower stem",
      [new Vector3(x, y, z), new Vector3(x + 0.06, y + s * 2.6, z)],
      0.015,
      "#52795b",
      false,
    );
    const palette = ["#eee0aa", "#fbdec9", "#b6a7d9", "#f3c676"];
    for (let k = 0; k < 5; k++) {
      const angle = (k * Math.PI * 2) / 5;
      const p = MeshBuilder.CreateSphere(
        "flower petal",
        { diameter: s, segments: 8 },
        this.scene,
      );
      p.scaling.set(1, 0.3, 0.55);
      p.position.set(
        x + Math.cos(angle) * s * 0.47,
        y + s * 2.6,
        z + Math.sin(angle) * s * 0.47,
      );
      p.rotation.y = -angle;
      this.add(p, palette[Math.floor(seed) % 4]);
    }
  }
  scenery() {for(const _ of this.scenerySteps()){} }
  private *scenerySteps():Generator<void> {
    let r = 523 + this.chapter.index * 731;
    const rand = () => {
      r = (r * 1664525 + 1013904223) >>> 0;
      return r / 4294967296;
    };
    const biome = this.chapter.biome,
      count =
        biome === "forest"
          ? 175
          : biome === "mountain" || biome === "dragon"
            ? 72
            : 135;
    const protectedPoint = (x: number, z: number, radius: number) =>
      [...this.chapter.interactions, ...this.chapter.secrets].some(
        (it) => Math.hypot(it.x - x, it.z - z) < radius,
      );
    yield* this.treeCopiesSteps(sceneryTrees(this.chapter));
    for (let i = 0; i < 2200; i++) {
      if(i%80===79)yield;
      const x = (rand() - 0.5) * 82,
        z = -18 + rand() * 136;
      const density =
        0.55 +
        0.2 * Math.sin(x * 0.27 + z * 0.17) +
        0.15 * Math.sin(z * 0.41 - x * 0.19);
      if (
        rand() > density ||
        this.inWater(x, z, 0.35) ||
        (biome === "village" && x > -18 && x < 19 && z < 21) ||
        this.pathDistance(x, z) < 2.2 ||
        protectedPoint(x, z, 1.1) ||
        (biome === "castle" && Math.abs(x) < 23)
      )
        continue;
      const size = 0.32 + rand() * 0.38;
      if (i % 17 === 0) this.fern(x, z, size * 1.45, i);
      else if (i % 29 === 0) this.flower(x, z, i);
      else {
        for (let tuft = 0; tuft < 3 + (i % 4); tuft++) {
          const a = rand() * Math.PI * 2,
            r = rand() * 0.8,
            tx = x + Math.cos(a) * r,
            tz = z + Math.sin(a) * r;
          if (this.pathDistance(tx, tz) > 2)
            this.grassTuft(
              tx,
              tz,
              size * (0.65 + rand() * 0.55),
              i + tuft * 11,
            );
        }
      }
      if (i % 43 === 0) this.rock(x + 0.7, z - 0.4, 0.24 + rand() * 0.42);
    }
    // Rounded mountain belts with connected slopes, rather than vertical silhouette walls.
    for(let layer=0;layer<3;layer++){
      const positions:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
      const n=128,rings=10,tint=color(["#91ac86","#acbdac","#c3d7d6"][layer]).toLinearSpace();
      for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){
        const a=i/n*Math.PI*2,t=j/rings,r=68+layer*25+t*42;
        const peak=12+layer*4+5*Math.sin(a*5+layer)+3*Math.sin(a*11+layer);
        const y=-2+Math.pow(Math.sin(t*Math.PI),1.4)*peak+Math.sin(a*19+t*7)*Math.sin(t*Math.PI)*1.2;
        const x=Math.cos(a)*r,z=48+Math.sin(a)*(r*1.27);
        positions.push(x,y,z);uvs.push(x/10,z/10);
        const shade=.9+Math.sin(a*5)*.06;colors.push(tint.r*shade,tint.g*shade,tint.b*shade,1);
        if(i<n&&j<rings){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
      }
      const d=new VertexData();d.positions=positions;d.indices=indices;d.colors=colors;d.uvs=uvs;d.normals=[];VertexData.ComputeNormals(positions,indices,d.normals);
      const mesh=new Mesh("distant rolling wooded foothills",this.scene);d.applyToMesh(mesh);this.textured(mesh,"meadow",true,false);mesh.metadata.cameraObstacle=false;
    }
  }
  house(x: number, z: number, s = 1, rot = 0) {
    this.ambientPatch(x,z,6.2*s,5.2*s,.30);
    const group = new TransformNode("cottage", this.scene);
    group.parent = this.root;
    group.position.set(x, this.groundHeight(x, z), z);
    group.rotation.y = rot;
    const place = (m: Mesh) => {
      m.parent = group;
      return m;
    };
    const box = (
      name: string,
      px: number,
      py: number,
      pz: number,
      w: number,
      h: number,
      d: number,
      hex = "#ffffff",
    ) =>
      place(this.box(name, px * s, py * s, pz * s, w * s, h * s, d * s, hex));
    const walls = box("limewash cottage walls", 0, 1.77, 0, 4.6, 3.36, 3.8);
    walls.material = this.surfaces.surface("plaster", x < 0 ? "#fff7e8" : "#eef2e6");
    box("cottage stone foundation", 0, 0.18, 0, 4.72, 0.42, 3.92);
    this.obstacles.push({
      // Include projecting window sills / front step, not just the plaster box.
      x: x - Math.sin(rot) * .12 * s,
      z: z - Math.cos(rot) * .12 * s,
      r: 0,
      shape: "box",
      width: 5.24 * s,
      depth: 4.78 * s,
      rotation: rot,
      top:this.groundHeight(x,z)+6.5*s,
    });
    for (const side of [-1, 1]) {
      const data = new VertexData();
      data.positions = [
        -2.3 * s,
        3.45 * s,
        side * 1.9 * s,
        2.3 * s,
        3.45 * s,
        side * 1.9 * s,
        0,
        5.56 * s,
        side * 1.9 * s,
      ];
      data.indices = side < 0 ? [0, 1, 2] : [0, 2, 1];
      data.uvs = [0, 0, 2, 0, 1, 1];
      data.normals = [];
      VertexData.ComputeNormals(data.positions, data.indices, data.normals);
      const gable = new Mesh("limewash gable", this.scene);
      data.applyToMesh(gable);
      this.add(gable, "#eee0c0");
      place(gable);
      place(
        this.tube(
          "gable oak beam",
          [
            new Vector3(-2.38 * s, 3.4 * s, side * 1.98 * s),
            new Vector3(0, 5.61 * s, side * 1.98 * s),
            new Vector3(2.38 * s, 3.4 * s, side * 1.98 * s),
          ],
          0.095 * s,
          "#8e7455",
          false,
        ),
      );
      box("timber gable tie", 0, 3.44, side * 1.99, 4.66, 0.18, 0.18);
      box("timber king post", 0, 4.48, side * 1.98, 0.16, 2.0, 0.17);
      for (const xx of [-2.23, 2.23])
        box("cottage oak corner beam", xx, 1.85, side * 1.91, 0.17, 3.35, 0.19);
    }
    // Overlapping curved clay tiles sit on a continuous roof with a real eave thickness.
    for (const side of [-1, 1]) {
      const angle = -side * 0.64;
      const roof = box(
        "roof timber underlay",
        side * 1.48,
        4.57,
        0,
        3.78,
        0.16,
        4.72,
      );
      roof.rotation.z = angle;
      for (let row = 0; row < 9; row++)
        for (let col = 0; col < 10; col++) {
          // A curved clay patch follows the roof slope. The V3 half-cylinder
          // pieces exposed regular strips of the timber underlay between tiles.
          const positions:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];
          for(let i=0;i<=2;i++)for(let j=0;j<=6;j++){
            const t=i/2,v=j/6,u=(row-.07+t*1.15)/9;
            positions.push(side*u*2.98*s,(4.57+1.48*Math.tan(.64)+.08/Math.cos(.64)+.035-u*2.98*Math.tan(.64)+.057*Math.sin(v*Math.PI)+.014*(1-t))*s,(-2.36+(col+v)*.472)*s);
            uvs.push(v,t);
            if(i<2&&j<6){const a=i*7+j;indices.push(a,a+1,a+7,a+1,a+8,a+7);}
          }
          VertexData.ComputeNormals(positions,indices,normals);
          if(normals[1]<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];VertexData.ComputeNormals(positions,indices,normals);}
          const tile=new Mesh("overlapping curved clay roof tile",this.scene),vd=new VertexData();vd.positions=positions;vd.indices=indices;vd.uvs=uvs;vd.normals=normals;vd.applyToMesh(tile);
          this.textured(tile,"terracotta",true,true, ["#fff9ee","#f4e7d8","#ffffff"][(row*3+col)%3]);place(tile);
        }
      box("timber eave fascia", side * 2.91, 3.42, 0, 0.14, 0.25, 4.87);
    }
    for (let i = 0; i < 11; i++) {
      const cap = MeshBuilder.CreateCylinder(
        "roof ridge cap",
        {
          height: 0.47 * s,
          diameter: 0.36 * s,
          tessellation: 10,
          arc: 0.5,
          cap: Mesh.NO_CAP,
        },
        this.scene,
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.set(0, 5.75 * s, (-2.34 + i * 0.46) * s);
      this.textured(cap, "terracotta");
      place(cap);
    }
    for (const xx of [-1.37, 1.37]) {
      box("window timber surround", xx, 1.95, -1.96, 1.13, 1.36, 0.14);
      const pane = box(
        "rippled window glass",
        xx,
        1.96,
        -2.047,
        0.91,
        1.1,
        0.03,
      );
      pane.material = this.surfaces.glass();
      pane.metadata.cameraObstacle = false;
      box("window wood muntin", xx, 1.96, -2.09, 0.06, 1.12, 0.065);
      box("window wood cross", xx, 1.96, -2.09, 0.94, 0.06, 0.065);
      for (const side of [-1, 1]) {
        const shutter = box(
          "timber window shutter",
          xx + side * 0.69,
          1.95,
          -2.03,
          0.22,
          1.24,
          0.1,
        );
        shutter.rotation.y = side * 0.25;
      }
      box("window timber sill", xx, 1.33, -2.1, 1.3, 0.12, 0.36);
      const planter = box(
        "timber flower planter",
        xx,
        1.18,
        -2.19,
        1.14,
        0.22,
        0.39,
      );
      planter.metadata.cameraObstacle = false;
      for (let i = 0; i < 7; i++) {
        const bush = MeshBuilder.CreateSphere(
          "window geranium leaf",
          { diameter: 0.16 * s, segments: 6 },
          this.scene,
        );
        bush.scaling.set(1, 0.35, 1);
        bush.position.set(
          (xx - 0.46 + i * 0.15) * s,
          (1.33 + Math.sin(i * 8) * 0.05) * s,
          -2.24 * s,
        );
        this.add(bush, "#637750");
        place(bush);
        bush.metadata.cameraObstacle = false;
        const petal = MeshBuilder.CreateSphere(
          "window geranium blossom",
          { diameter: 0.105 * s, segments: 8 },
          this.scene,
        );
        petal.position.set(
          (xx - 0.44 + i * 0.14) * s,
          (1.43 + Math.sin(i * 8) * 0.05) * s,
          -2.25 * s,
        );
        this.add(petal, i % 2 ? "#d9968e" : "#edd2b3");
        place(petal);
        petal.metadata.cameraObstacle = false;
      }
    }
    // Side and rear elevations share the same real jamb/sill depth as the front.
    // Turning the camera no longer exposes an entirely blank box wall.
    for (const side of [-1, 1]) {
      for (const zz of [-.78,.78]) {
        box("side window dark reveal",side*2.315,1.9,zz,.035,1.11,.82,"#514633");
        const glass=box("side cottage glass",side*2.344,1.92,zz,.035,.89,.63);
        glass.material=this.surfaces.glass();glass.metadata.cameraObstacle=false;
        for(const offset of [-.49,.49])box("side window timber jamb",side*2.375,1.92+offset,zz,.13,.09,.94);
        for(const offset of [-.40,.40])box("side window timber jamb",side*2.375,1.92,zz+offset,.13,1.07,.085);
        box("side window oak mullion",side*2.39,1.92,zz,.13,.92,.045);
        box("side window stone sill",side*2.43,1.34,zz,.38,.12,1.03);
      }
      box("side wall oak upper beam",side*2.315,3.31,0,.17,.16,3.9);
      // Bottom wall courses produce a credible meeting of plaster and damp stone.
      for(let k=0;k<7;k++)box("cottage foundation limestone course",side*2.33,.32,-1.65+k*.55,.16,.30,.52);
    }
    box("rear window timber surround",0,2.04,1.96,1.16,1.29,.15);
    const rearPane=box("rear cottage glass",0,2.05,2.046,.94,1.07,.03);
    rearPane.material=this.surfaces.glass();rearPane.metadata.cameraObstacle=false;
    box("rear window wood mullion",0,2.05,2.084,.06,1.1,.065);
    box("rear window wood cross",0,2.05,2.084,.96,.06,.065);
    box("rear window stone sill",0,1.39,2.10,1.29,.12,.34);
    // Flat-backed arched door: only the upper half is curved, with no floating full ring.
    const outline = [
      [-0.5, 0],
      [0.5, 0],
      [0.5, 1.53],
    ];
    for (let i = 1; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      outline.push([Math.cos(a) * 0.5, 1.53 + Math.sin(a) * 0.5]);
    }
    const data = new VertexData();
    data.positions = [0, 1 * s, -1.973 * s];
    data.uvs = [0.5, 0.5];
    for (const [px, py] of outline) {
      data.positions.push(px * s, py * s, -1.974 * s);
      data.uvs.push(px + 0.5, py / 2.1);
    }
    data.indices = [];
    for (let i = 0; i < outline.length; i++)
      data.indices.push(0, i + 1, ((i + 1) % outline.length) + 1);
    data.normals = [];
    VertexData.ComputeNormals(data.positions, data.indices, data.normals);
    const door = new Mesh("arched timber door", this.scene);
    data.applyToMesh(door);
    this.add(door, "#826442");
    place(door);
    (door.material as PBRMaterial).backFaceCulling = false;
    const archPts = [
      new Vector3(-0.59 * s, 0.15 * s, -2.01 * s),
      new Vector3(-0.59 * s, 1.55 * s, -2.01 * s),
    ];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI - (i / 20) * Math.PI;
      archPts.push(
        new Vector3(
          Math.cos(a) * 0.59 * s,
          (1.55 + Math.sin(a) * 0.59) * s,
          -2.01 * s,
        ),
      );
    }
    archPts.push(new Vector3(0.59 * s, 0.15 * s, -2.01 * s));
    place(
      this.tube("door oak architrave", archPts, 0.064 * s, "#97835d", false),
    );
    box("door stone step", 0, 0.1, -2.18, 1.29, 0.2, 0.65);
    const handle = MeshBuilder.CreateSphere(
      "bronze door handle",
      { diameter: 0.085 * s, segments: 10 },
      this.scene,
    );
    handle.position.set(0.31 * s, 1.0 * s, -2.06 * s);
    this.add(handle, "#b69358");
    place(handle);
    box("masonry chimney", 1.34, 5.45, 0.66, 0.64, 1.94, 0.69);
    box("chimney stone crown", 1.34, 6.44, 0.66, 0.85, 0.16, 0.87);
    // Curved shallow porch and hanging trade signs break the repeated gable boxes.
    const porchProfile:Vector3[]=[];for(let i=0;i<=12;i++){const t=i/12;porchProfile.push(new Vector3((t-.5)*1.85*s,(2.33+Math.sin(t*Math.PI)*.22)*s,-2.24*s));}
    place(this.tube('cottage porch carved wood arch',porchProfile,.08*s,'#9c7d54',false));
    for(const side of [-1,1]){place(this.tube('cottage porch shaped wood bracket',Curve3.CreateCatmullRomSpline([new Vector3(side*.84*s,1.93*s,-1.96*s),new Vector3(side*.84*s,2.16*s,-2.18*s),new Vector3(side*.84*s,2.36*s,-2.45*s)],5).getPoints(),.055*s,'#a78b62',false));}
    const awning=box('cottage porch timber eave',0,2.50,-2.22,2.04,.095,.67,'#b0936b');awning.rotation.x=-.1;
    const sign=box('cottage hanging handpainted shop sign',-1.92,2.47,-2.30,.62,.48,.10,'#a8b69a');sign.material=this.surfaces.paint(x<0?'#809279':'#bda274');
    for(const xx of [-2.12,-1.72])place(this.tube('cottage brass shop sign hanger',[new Vector3(xx*s,2.7*s,-2.3*s),new Vector3(xx*s,2.95*s,-2.3*s)],.017*s,'#b79862',false));

  }
  private bridgeLocal(
    x: number,
    z: number,
    l: { x: number; z: number; rotation?: number },
  ) {
    const a = l.rotation ?? 0,
      dx = x - l.x,
      dz = z - l.z;
    return {
      x: dx * Math.cos(a) - dz * Math.sin(a),
      z: dx * Math.sin(a) + dz * Math.cos(a),
    };
  }
  private bridgeDeck(x: number, z: number, s: number, rot: number, d: number) {
    const end = 4 * s,
      ax = x - Math.sin(rot) * end,
      az = z - Math.cos(rot) * end,
      bx = x + Math.sin(rot) * end,
      bz = z + Math.cos(rot) * end,
      t = Math.max(0, Math.min(1, (d + end) / (end * 2)));
    return (
      this.groundHeight(ax, az) * (1 - t) +
      this.groundHeight(bx, bz) * t +
      0.08 +
      Math.sin(t * Math.PI) * 0.38 * s
    );
  }
  bridge(x: number, z: number, s = 1, rot = 0) {
    for (let i = 0; i < 23; i++) {
      const d = (i - 11) * 0.35 * s,
        xx = x + Math.sin(rot) * d,
        zz = z + Math.cos(rot) * d,
        y = this.bridgeDeck(x, z, s, rot, d);
      const plank = this.box(
        "bridge seasoned wood planks",
        xx,
        y - 0.065,
        zz,
        3.26 * s,
        0.13,
        0.335 * s,
        "#bfa177",
      );
      plank.rotation.y = rot;
      plank.metadata.cameraObstacle = false;
      for (const side of [-1, 1]) {
        const nail = MeshBuilder.CreateSphere(
          "bridge iron pin",
          { diameter: 0.028, segments: 4 },
          this.scene,
        );
        nail.position.set(
          xx + Math.cos(rot) * side * 1.28 * s,
          y + 0.007,
          zz - Math.sin(rot) * side * 1.28 * s,
        );
        this.add(nail, "#5c5b4f");
        nail.metadata.cameraObstacle = false;
      }
    }
    for (const side of [-1, 1]) {
      const points: Vector3[] = [];
      for (let j = 0; j < 5; j++) {
        const d = (j - 2) * 1.85 * s,
          xx = x + Math.cos(rot) * side * 1.54 * s + Math.sin(rot) * d,
          zz = z - Math.sin(rot) * side * 1.54 * s + Math.cos(rot) * d,
          y = this.bridgeDeck(x, z, s, rot, d);
        const post = this.box(
          "bridge oak posts",
          xx,
          y + 0.49,
          zz,
          0.105,
          0.98,
          0.105,
          "#957e60",
        );
        post.metadata.cameraObstacle = false;
        points.push(new Vector3(xx, y + 0.94, zz));
      }
      const rail = this.tube(
        "bridge wood handrail",
        Curve3.CreateCatmullRomSpline(points, 5).getPoints(),
        0.052,
        "#9c8666",
        false,
      );
      rail.metadata.cameraObstacle = false;
      const beam = this.tube(
        "bridge timber support",
        points.map((p) => new Vector3(p.x, p.y - 1.14, p.z)),
        0.12,
        "#7e745e",
        false,
      );
      beam.metadata.cameraObstacle = false;
    }
  }
  arch(x: number, z: number, s: number, hex = "#aaab98") {
    const y = this.landHeight(x, z);
    for (const side of [-1, 1]) {
      const col = MeshBuilder.CreateCylinder(
        "carved column",
        { height: 4 * s, diameter: 1 * s, tessellation: 9 },
        this.scene,
      );
      col.position.set(x + side * 2 * s, y + 2 * s, z);
      this.add(col, hex);
      for (const yy of [0.3, 3.8])
        this.box(
          "column capital",
          x + side * 2 * s,
          y + yy * s,
          z,
          1.3 * s,
          0.3 * s,
          1.3 * s,
          hex,
        );
    }
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (Math.PI * i) / 16;
      pts.push(
        new Vector3(
          x + Math.cos(a) * 2 * s,
          y + 4 * s + Math.sin(a) * 1.5 * s,
          z,
        ),
      );
    }
    this.tube("curved arch", pts, 0.38 * s, hex, false);
  }
  castle(x: number, z: number, s: number) {
    const y = this.landHeight(x, z);
    this.box("castle hall", x, y + 4 * s, z, 10 * s, 8 * s, 6 * s, "#89909d");
    for (const side of [-1, 1]) {
      const tower = MeshBuilder.CreateCylinder(
        "castle tower",
        { height: 11 * s, diameter: 3 * s, tessellation: 14 },
        this.scene,
      );
      tower.position.set(x + side * 5.6 * s, y + 5.5 * s, z);
      this.add(tower, "#989ca8");
      const cap = MeshBuilder.CreateCylinder(
        "slate tower roof",
        {
          height: 5 * s,
          diameterBottom: 4 * s,
          diameterTop: 0.05,
          tessellation: 14,
        },
        this.scene,
      );
      cap.position.set(x + side * 5.6 * s, y + 13 * s, z);
      this.add(cap, "#535979");
      for (let i = 0; i < 4; i++) {
        const win = this.box(
          "gold castle window",
          x + side * 5.6 * s,
          y + (3 + i * 2) * s,
          z - 1.51 * s,
          0.5 * s,
          1.1 * s,
          0.07,
          "#ffd696",
        );
        win.material = this.mat("#ffd696", 0.8);
      }
    }
    for (let i = -3; i <= 3; i++)
      this.box(
        "parapet",
        x + i * 1.4 * s,
        y + 8.4 * s,
        z - 3 * s,
        0.65 * s,
        0.9 * s,
        0.65 * s,
        "#a7a9b3",
      );
    this.arch(x, z - 2.8 * s, 1.2 * s, "#b6b3c0");
    this.obstacles.push({ x, z, r: 5 * s,top:y+16*s });
  }
  landmark(l: Landmark) {
    const { x, z } = l,
      s = l.scale ?? 1,
      y = this.landHeight(x, z);
    switch (l.kind) {
      case "house":
        this.house(x, z, s, l.rotation ?? 0);
        break;
      case "windmill":
        buildWindmill(this,l);
        break;
      case "bridge":
        this.bridge(x, z, s, l.rotation ?? 0);
        break;
      case "ruin":
        buildMemoryRuin(this,l);
        break;
      case "arch":
        this.arch(x, z, s);
        break;
      case "castle":
        this.castle(x, z, s);
        break;
      case "grave":
        {
          const slab = this.box(
            "old headstone",
            x,
            y + 0.65 * s,
            z,
            0.9 * s,
            1.25 * s,
            0.3 * s,
            "#92999d",
          );
          slab.rotation.z = 0.07 * Math.sin(x);
          this.box(
            "headstone engraving",
            x,
            y + 0.75 * s,
            z - 0.17 * s,
            0.4 * s,
            0.05,
            0.03,
            "#c2c5b9",
          );
          this.rock(x, z + 1, s * 0.6, "#717c78");
        }
        break;
      case "tree":
        this.tree(x, z, s * 2, 7);
        break;
      case "rock":
        this.rock(x, z, s * 2);
        break;
      case "crystal":
        {
          for (let i = 0; i < 5; i++) {
            const c = MeshBuilder.CreateCylinder(
              "star crystal",
              {
                height: (2 + (i % 3)) * s,
                diameterBottom: 0.7 * s,
                diameterTop: 0,
                tessellation: 5,
              },
              this.scene,
            );
            c.position.set(
              x + Math.cos(i * 2) * s,
              y + s,
              z + Math.sin(i * 2) * s,
            );
            c.rotation.z = Math.sin(i) * 0.25;
            this.add(c, "#9ee1d8", true, 0.38);
          }
        }
        break;
      case "dragonNest":
        {
          for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI) / 6;
            this.rock(
              x + Math.cos(a) * 6 * s,
              z + Math.sin(a) * 6 * s,
              s * 1.5,
              "#7e7d91",
            );
          }
          this.arch(x, z + 7 * s, 2 * s, "#808298");
        }
        break;
      case "lantern":
        this.lantern(x, z, s);
        break;
      case "camp":
        break;
      case "water":
        break;
    }
  }
  lantern(x: number, z: number, s = 1) {
    const y=this.landHeight(x,z),iron="#48504b";
    this.box("lantern timber upright",x,y+1.28*s,z,.14*s,2.56*s,.14*s,"#97816b");
    this.tube("lantern curved iron bracket",Curve3.CreateCatmullRomSpline([new Vector3(x,y+2.3*s,z),new Vector3(x+.2*s,y+2.75*s,z),new Vector3(x+.53*s,y+2.7*s,z),new Vector3(x+.56*s,y+2.45*s,z)],5).getPoints(),.028*s,iron,false);
    const cx=x+.56*s,cy=y+2.12*s;
    this.registerNightLanternSource(new Vector3(cx,cy,z),6.5*Math.max(.65,s),8.5*Math.max(.75,s));
    const pane=this.box("amber lantern glass",cx,cy,z,.32*s,.48*s,.32*s,"#ffe2a6");pane.material=this.mat("#ffe0a0",.6);pane.metadata.cameraObstacle=false;
    for(const dx of [-.2,.2])for(const dz of [-.2,.2])this.box("lantern iron cage",cx+dx*s,cy,z+dz*s,.032*s,.58*s,.032*s,iron);
    for(const yy of [-.30,.30])this.box("lantern iron rim",cx,cy+yy*s,z,.48*s,.06*s,.48*s,iron);
    const cap=MeshBuilder.CreateCylinder("lantern pitched iron cap",{diameterTop:.12*s,diameterBottom:.66*s,height:.23*s,tessellation:4},this.scene);cap.position.set(cx,cy+.44*s,z);cap.rotation.y=Math.PI/4;this.add(cap,iron);
    this.box("lantern stone foot",x,y+.07,z,.38*s,.14,.38*s,"#b6b0a0");
  }
  camp(x: number, z: number) {
    const y = this.landHeight(x, z);
    if (this.chapter.biome === "village") {
      // One bounded local light for the authored square, with no extra shadow
      // map. It lights the nearby logs, stones, benches and moving character.
      this.campLight = new PointLight("village hearth bounce", new Vector3(x,y+.72,z), this.scene);
      this.campLight.parent=this.root;
      this.campLight.diffuse = color("#ffc888");
      this.campLight.intensity = 2.2;
      this.campLight.range = 6.5;
      this.campLight.radius = .6;
      this.campLight.metadata={nightReplacedHearth:true};
      this.registerNightLanternSource(this.campLight.position.clone(),2.2,6.5);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      this.rock(
        x + Math.cos(a) * 0.88,
        z + Math.sin(a) * 0.88,
        0.22,
        "#989d89",
      );
    }
    for (let i = 0; i < 3; i++) {
      const log = this.box(
        "campfire logs",
        x,
        y + 0.16,
        z,
        0.19,
        0.23,
        1.35,
        "#73614e",
      );
      log.rotation.y = (i * Math.PI) / 3;
    }
    for(let i=0;i<5;i++){
      const points:number[]=[],indices:number[]=[];
      const h=.58+(i%3)*.14,angle=i*2.4;
      for(let j=0;j<=9;j++){const t=j/9,r=.18*Math.sin(Math.PI*Math.pow(t,.7))+.008;
        for(let k=0;k<=12;k++){const a=k/12*Math.PI*2;points.push(Math.cos(a)*r+Math.sin(t*4+i)*t*.12,t*h,Math.sin(a)*r);if(j<9&&k<12){const n=j*13+k;indices.push(n,n+13,n+1,n+1,n+13,n+14);}}
      }
      const vd=new VertexData();vd.positions=points;vd.indices=indices;vd.normals=[];VertexData.ComputeNormals(points,indices,vd.normals);const flame=new Mesh("curved amber camp flame",this.scene);vd.applyToMesh(flame);flame.position.set(x+Math.sin(angle)*.16,y+.19,z+Math.cos(angle)*.16);this.add(flame,i%2?"#fbb564":"#ffdf98",false,.7);this.shadows.removeShadowCaster(flame);flame.metadata.cameraObstacle=false;
      this.animated.push(t=>{flame.scaling.set(1+Math.sin(t*6+i)*.08,.82+Math.sin(t*8+i)*.16,1);flame.rotation.y=t*.5+i;});
    }
    this.lantern(x - 3, z - 1);
    this.lantern(x + 3, z - 1);
    for (const side of [-1, 1]) {
      this.box(
        "camp bench",
        x + side * 2.3,
        y + 0.42,
        z - 0.4,
        0.5,
        0.4,
        2.3,
        "#907958",
      );
    }
  }
  marker(id: string, kind: string, x: number, z: number) {
    const group = new TransformNode("discovery-" + id, this.scene);
    group.parent = this.root;
    group.metadata = { interactionId: id, kind, completed: false };
    const interaction=[...this.chapter.interactions,...this.chapter.secrets].find(i=>i.id===id);
    const platform=this.chapter.terrain.platforms?.find(p=>p.id===interaction?.surfaceId);
    group.position.set(x, platform?.height ?? this.height(x, z), z);
    let m: Mesh;
    if (kind === "npc") {
      const resident = createVillager(
        this.scene,
        this.chapter.biome === "river"
          ? "frog"
          : ["graveyard", "castle"].includes(this.chapter.biome)
            ? "mouse"
            : "badger",
        x + z,
        id,
      );
      resident.parent = group;
      resident.rotation.y = Math.PI;
      this.residents.set(id, resident);
      resident
        .getChildMeshes()
        .forEach((mesh) => this.shadows.addShadowCaster(mesh));
      m = resident.getChildMeshes()[0] as Mesh;
    } else if (["mushroom-grove-memory", "mushroom-home-memory", "canopy-garden-memory", "canopy-home-memory"].includes(id)) {
      // The saved environment contains the actual journal, correspondence and chime.
      // Only this small unread cue disappears; a generic stone shrine would obstruct them.
      m = MeshBuilder.CreatePolyhedron("unread correspondence glint", {type:1,size:.055}, this.scene);
      m.parent = group; m.position.y = id === "canopy-garden-memory" ? 2.0 : .26;
      m.material = this.mat("#f0d6a0", .28); m.isPickable = false;
      this.animated.push(t => { m.rotation.y=t*.4; });
    } else if (kind === "plate") {
      m = MeshBuilder.CreateCylinder(
        "moon plate",
        { height: 0.1, diameter: 2, tessellation: 24 },
        this.scene,
      );
      m.position.y = 0.09;
      m.parent = group;
      m.material = this.mat("#c4b890", 0.12);
    } else {
      const own=(mesh:Mesh,mat:Material)=>{mesh.parent=group;mesh.material=mat;mesh.receiveShadows=true;this.shadows.addShadowCaster(mesh);return mesh;};
      const plinth=own(MeshBuilder.CreateCylinder("weathered shrine stone foot",{height:.14,diameter:1.02,tessellation:24},this.scene),this.surfaces.surface("stone"));plinth.position.y=.07;
      const base=own(MeshBuilder.CreateCylinder("carved shrine limestone",{height:.64,diameterBottom:.60,diameterTop:.53,tessellation:20},this.scene),this.surfaces.surface(kind==="supply"?"timber":"masonry"));base.position.y=.43;
      const rim=own(MeshBuilder.CreateTorus("shrine bronze band",{diameter:.60,thickness:.04,tessellation:24},this.scene),this.mat("#bd9d61"));rim.position.y=.70;
      const bowl=own(MeshBuilder.CreateCylinder("shrine scalloped stone bowl",{height:.13,diameterBottom:.65,diameterTop:.81,tessellation:20},this.scene),this.surfaces.surface("stone"));bowl.position.y=.78;
      m=own(MeshBuilder.CreatePolyhedron("small floating star ember",{type:1,size:.145},this.scene),this.mat("#ffe8b3",.56));m.position.y=1.18;
      this.animated.push(t=>{m.rotation.y=t*.4;m.position.y=1.18+Math.sin(t*1.5+x)*.055;});
    }
    if(platform?.requiresFlag){group.setEnabled(false);this.animated.push(()=>{if(!this.foundFlags.has(id))group.setEnabled(this.foundFlags.has(platform.requiresFlag!));});}
    this.interactMeshes.set(id, group);
  }
  exit(x: number, z: number) {
    this.arch(x, z, 1.3, "#b9b8a1");
    for (let i = 0; i < 8; i++) {
      const star = MeshBuilder.CreatePolyhedron(
        "arch star",
        { type: 1, size: 0.1 },
        this.scene,
      );
      star.position.set(
        x + Math.cos(i * 0.7) * 1.3,
        this.landHeight(x, z) + 1.1 + i * 0.4,
        z,
      );
      this.add(star, "#f6d492", false, 0.65);
      this.animated.push((t) => (star.rotation.y = t + i));
    }
  }
  atmosphere(night: boolean) {
    const tex = new DynamicTexture(
      "painted atmospheric sky",
      { width: 1024, height: 512 },
      this.scene,
      false,
    );
    this.skyTexture = tex;
    const ctx = tex.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, night ? "#1e304e" : "#75b4df");
    gradient.addColorStop(0.5, night ? "#556681" : "#aed6ea");
    gradient.addColorStop(0.68, night ? "#768395" : "#f1e8cb");
    gradient.addColorStop(1, night ? "#7a8290" : "#c1ccbc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    for (let c = 0; c < 18; c++) {
      const x = (c * 217.7) % 1024,
        y = 92 + (Math.sin(c * 8.7) + 1) * 74;
      for (let j = 0; j < 6; j++) {
        const xx = x + j * 14 - 35,
          yy = y + Math.sin(j * 3 + c) * 9,
          r = 22 + (j % 3) * 8;
        const cloud = ctx.createRadialGradient(xx, yy, 0, xx, yy, r);
        cloud.addColorStop(
          0,
          night ? "rgba(197,202,218,.07)" : "rgba(255,250,231,.23)",
        );
        cloud.addColorStop(1, "rgba(255,250,231,0)");
        ctx.fillStyle = cloud;
        ctx.fillRect(xx - r, yy - r, r * 2, r * 2);
      }
    }
    tex.update(false);
    const skyMat = new StandardMaterial("sky daylight gradient", this.scene);
    skyMat.disableLighting = true;
    skyMat.emissiveTexture = tex;
    skyMat.diffuseColor = Color3.Black();
    skyMat.backFaceCulling = false;
    skyMat.fogEnabled = false;
    const sky = MeshBuilder.CreateSphere(
      "sky gradient dome",
      { diameter: this.regionId===CITY?1000:350, segments: 32 },
      this.scene,
    );
    sky.material = skyMat;
    sky.parent = this.root;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.metadata = { cameraObstacle: false };
    this.sky = sky;
    const sun = MeshBuilder.CreateSphere(
      "distant sun disk",
      { diameter: night ? 5 : 4, segments: 24 },
      this.scene,
    );
    sun.position.set(76.05, 117, -40.95);
    this.add(sun, night ? "#e6e6e1" : "#fff5dd", false, 1);
    sun.isPickable = false;
    sun.metadata.cameraObstacle = false;
    this.shadows.removeShadowCaster(sun);
    for (let i = 0; i < (night ? 18 : 8); i++) {
      const spark = MeshBuilder.CreateSphere(
        "drifting firefly",
        { diameter: night ? 0.05 : 0.025, segments: 4 },
        this.scene,
      );
      const x = Math.sin(i * 45.7) * 28,
        z = i * 6.8 + 9,
        y = 1.4 + (i % 5) * 0.4;
      this.add(spark, night ? "#f3dba2" : "#fff3be", false, 0.65);
      spark.metadata.cameraObstacle = false;
      this.shadows.removeShadowCaster(spark);
      this.animated.push((t) =>
        spark.position.set(
          x + Math.sin(t * 0.3 + i) * 0.6,
          y + Math.sin(t * 0.6 + i) * 0.22,
          z,
        ),
      );
    }
  }
  merge(){for(const _ of this.mergeSteps()){} }
  private *mergeSteps():Generator<void> {
    yield* this.buildDirectMushrooms();
    yield* this.batchUnderstoryAssets();
    for(const lease of this.environmentLeases){lease.root.computeWorldMatrix(true);lease.root.freezeWorldMatrix();for(const node of lease.root.getDescendants())if(node instanceof TransformNode){node.computeWorldMatrix(true);node.freezeWorldMatrix();}}
    const groups = new Map<string, Mesh[]>();
    const cast = new Set(this.shadows.getShadowMap()?.renderList ?? []);
    for (const mesh of this.staticMeshes) {
      if (!mesh.parent || mesh.isDisposed()) continue;
      // A live source must survive batching while its density instances share it.
      if(mesh.instances.length){mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();continue;}
      mesh.computeWorldMatrix(true);
      const center = mesh.getBoundingInfo().boundingBox.centerWorld;
      const detail = /grass|fern/.test(mesh.name),
        cell = detail ? 22 : 40;
      const key = [
        mesh.material?.uniqueId,
        mesh.getVerticesDataKinds().sort().join(","),
        !!mesh.metadata?.cameraObstacle,
        cast.has(mesh),
        detail,
        Math.floor(center.x / cell),
        Math.floor(center.z / cell),
      ].join(":");
      const list = groups.get(key) ?? [];
      list.push(mesh);
      groups.set(key, list);
    }
    let mergedCount=0;
    for (const list of groups.values()) {
      if(++mergedCount%12===0)yield;
      const cameraObstacle = !!list[0].metadata?.cameraObstacle,
        casts = cast.has(list[0]),
        detail = /grass|fern/.test(list[0].name),
        name = list[0].name;
      const merged =
        list.length > 1
          ? Mesh.MergeMeshes(list, true, true, undefined, false, false)
          : list[0];
      if (merged) {
        if (list.length > 1) merged.parent = this.root;
        merged.name = "env-v4-" + name;
        merged.metadata = { cameraObstacle };
        merged.receiveShadows = true;
        if (casts) this.shadows.addShadowCaster(merged);
        else this.shadows.removeShadowCaster(merged);
        merged.computeWorldMatrix(true);
        merged.freezeWorldMatrix();
        if (detail) {
          const c = merged.getBoundingInfo().boundingBox.centerWorld;
          this.detailMeshes.push({ mesh: merged, x: c.x, z: c.z });
        }
      }
    }
    this.staticMeshes = [];
    this.mats.forEach((m) => m.freeze());
  }
  queueMushroom(id:'giant'|'medium',position:Vector3,scale:Vector3,stemFactor:number){
    const placement=Matrix.Compose(scale,Quaternion.RotationAxis(Vector3.Up(),Math.PI),position),mirror=Matrix.Scaling(-1,1,1),giant=id==='giant',cell=giant?64:32;
    for(const original of environmentAssetMeshes(this.scene,id)){
      const source=original as Mesh,local=source.computeWorldMatrix(true);
      const shape=source.name.endsWith('| stem')?Matrix.Scaling(stemFactor,1,stemFactor).multiply(local):local;
      const matrix=shape.multiply(placement).multiply(mirror),x=Math.floor(position.x/cell),z=Math.floor(position.z/cell),key=source.uniqueId+':'+x+':'+z;
      const cameraObstacle=giant&&!/glass|gill|leaf|fleck/i.test(source.name);
      let g=this.directMushrooms.get(key);if(!g){g={source,matrices:[],x:(x+.5)*cell,z:(z+.5)*cell,giant,cameraObstacle};this.directMushrooms.set(key,g);}
      g.matrices.push(...matrix.m);
    }
  }
  private *buildDirectMushrooms():Generator<void>{
    let count=0;for(const [key,g]of this.directMushrooms){
      const m=g.source.clone('direct mushroom cell '+key,this.root,true)!;m.position.setAll(0);m.rotation.setAll(0);m.rotationQuaternion=null;m.scaling.set(-1,1,1);
      m.metadata={cameraObstacle:g.cameraObstacle,studioUnderstory:!g.giant,studioGiant:g.giant,instances:g.matrices.length/16};m.isPickable=g.cameraObstacle;m.thinInstanceEnablePicking=g.cameraObstacle;m.setEnabled(true);m.receiveShadows=true;
      // Thin-instance vertex buffers belong to Geometry; each cell must own them.
      m.makeGeometryUnique();m.thinInstanceSetBuffer('matrix',new Float32Array(g.matrices),16,true);m.thinInstanceRefreshBoundingInfo(true);m.freezeWorldMatrix();this.batchedEnvironment.push(m);
      if(g.giant){this.rangedAssets.push({root:m,x:m.getBoundingInfo().boundingBox.centerWorld.x,z:m.getBoundingInfo().boundingBox.centerWorld.z,radius:Math.hypot(m.getBoundingInfo().boundingBox.extendSizeWorld.x,m.getBoundingInfo().boundingBox.extendSizeWorld.z)});this.shadows.addShadowCaster(m);}else this.registerGroundDetail(m,g.x,g.z);
      if(++count%8===0)yield;
    }this.directMushrooms.clear();
  }
  private *batchUnderstoryAssets():Generator<void>{
    let processed=0;
    const ids=['giant','medium','young','fern','grass','bluebell','groundcover','shrub'];
    const groups=new Map<string,{source:Mesh;matrices:number[];x:number;z:number;giant:boolean;cameraObstacle:boolean}>(),removed=new Set<TransformNode>();
    const mirror=Matrix.Scaling(-1,1,1);
    for(const lease of this.environmentLeases){
      if(++processed%40===0)yield;
      if(!ids.includes(lease.root.name.replace('editable-environment/','')))continue;
      const giant=lease.root.name==='editable-environment/giant',cell=giant?64:32;
      for(const m of lease.root.getChildMeshes()){
        if(!m.getTotalVertices())continue;
        const source=m instanceof InstancedMesh?m.sourceMesh:m as Mesh,world=m.computeWorldMatrix(true),p=m.getBoundingInfo().boundingBox.centerWorld;
        const x=Math.floor(p.x/cell),z=Math.floor(p.z/cell),key=source.uniqueId+':'+m.material?.uniqueId+':'+x+':'+z;
        const group=groups.get(key)??{source,matrices:[],x:(x+.5)*cell,z:(z+.5)*cell,giant,cameraObstacle:giant&&m.metadata?.cameraObstacle===true};
        group.matrices.push(...world.multiply(mirror).m);groups.set(key,group);
        this.shadows.removeShadowCaster(m);
      }
      removed.add(lease.root);
    }
    for(const [key,g]of groups){
      if(++processed%20===0)yield;
      const mesh=g.source.clone('studio understory cell '+key,this.root,true)!;
      mesh.position.setAll(0);mesh.rotation.setAll(0);mesh.rotationQuaternion=null;mesh.scaling.set(-1,1,1);
      mesh.metadata={cameraObstacle:g.cameraObstacle,studioUnderstory:!g.giant,studioGiant:g.giant,instances:g.matrices.length/16};mesh.isPickable=g.cameraObstacle;mesh.thinInstanceEnablePicking=g.cameraObstacle;mesh.setEnabled(true);mesh.receiveShadows=true;
      mesh.makeGeometryUnique();mesh.thinInstanceSetBuffer('matrix',new Float32Array(g.matrices),16,true);mesh.thinInstanceRefreshBoundingInfo(true);mesh.freezeWorldMatrix();
      this.batchedEnvironment.push(mesh);
      if(g.giant){this.rangedAssets.push({root:mesh,x:mesh.getBoundingInfo().boundingBox.centerWorld.x,z:mesh.getBoundingInfo().boundingBox.centerWorld.z,radius:Math.hypot(mesh.getBoundingInfo().boundingBox.extendSizeWorld.x,mesh.getBoundingInfo().boundingBox.extendSizeWorld.z)});this.shadows.addShadowCaster(mesh);}
      else this.registerGroundDetail(mesh,g.x,g.z);
    }
    this.rangedAssets=this.rangedAssets.filter(a=>!removed.has(a.root));
    const remaining:EnvironmentLease[]=[];for(const lease of this.environmentLeases){if(removed.has(lease.root))lease.dispose();else remaining.push(lease);if(++processed%40===0)yield;}this.environmentLeases=remaining;
  }
  setQuality(value: string) {
    this.quality = value === "low" ? "low" : value === "high" ? "high" : "auto";
    this.shadows.filteringQuality =
      value === "low"
        ? ShadowGenerator.QUALITY_LOW
        : value === "high" ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.usePercentageCloserFiltering = value !== "low";
    this.shadows.usePoissonSampling = value === "low";
    const size=value==='low'?512:value==='high'?1536:1024;if(this.shadows.mapSize!==size)this.shadows.mapSize=size;
    this.villa?.setQuality(value);
  }
  registerGroundDetail(mesh:Mesh,x:number,z:number) { const bb=mesh.getBoundingInfo().boundingBox;this.detailMeshes.push({mesh,x:bb.centerWorld.x,z:bb.centerWorld.z,radius:Math.hypot(bb.extendSizeWorld.x,bb.extendSizeWorld.z)}); }
  registerNightLanternSource(position:Vector3,power:number,range:number,tint='#ffc58d') { this.nightLanternSources.push({position,power,range,tint:color(tint)}); }
  update(t: number, focus?: { x: number; z: number }, players: readonly { x: number; z: number; y?: number; hp?: number }[] = []) {
    this.animated.forEach((fn) => fn(t));
    for (const resident of this.residents.values()) {
      if (!resident.isEnabled() || resident.metadata?.attentionMode === "none" || typeof resident.metadata?.lookAt !== "function") continue;
      const origin = resident.getAbsolutePosition();
      const nearby = players.filter(p => (p.hp ?? 1) > 0 && Math.abs((p.y ?? 0) - origin.y) < 3.2)
        .map(p => ({ p, distance: Math.hypot(p.x - origin.x, p.z - origin.z) }))
        .filter(({ distance }) => distance < 10).sort((a, b) => a.distance - b.distance)[0]?.p;
      // Passing a neutral point also clears the old target when a player leaves;
      // residents must not fall back to watching the spectator camera.
      resident.metadata.lookAt(nearby
        ? new Vector3(nearby.x, (nearby.y ?? 0) + 1.15, nearby.z)
        : origin.add(resident.getDirection(Vector3.Forward()).scale(16)));
    }
    if (focus) {
      this.light.position.set(focus.x + 38.25, 45, focus.z - 21.6);
      const range =
        this.quality === "low" ? 28 : this.quality === "high" ? 68 : 46;
      for (const item of this.detailMeshes)
        item.mesh.setEnabled(
          Math.hypot(item.x - focus.x, item.z - focus.z) < range + (item.radius??12),
        );
      for(const asset of this.rangedAssets){
        const range=asset.tree?(this.quality==='low'?65:this.quality==='high'?115:88):asset.radius<2?(this.quality==='low'?35:this.quality==='high'?72:52):(this.quality==='low'?125:this.quality==='high'?220:175);
        asset.root.setEnabled(Math.hypot(asset.x-focus.x,asset.z-focus.z)<range+asset.radius);
      }
    }
  }
  private regionWaymarks() {
    for(const link of regionConnections(this.regionId)) {
      if (link.id.startsWith('story-')) continue;
      const x=link.x+2.5,z=link.z,y=link.y??this.height(x,z);
      const post=this.box('regional trail timber waypost',x,y+.9,z,.13,1.8,.13,'#aa9169');post.metadata.cameraObstacle=false;
      const sign=this.box('regional carved wooden arrow',x-.3,y+1.52,z,1.35,.36,.1,'#baa379');sign.metadata.cameraObstacle=false;
      const emblem=MeshBuilder.CreateTorus('regional bronze waymark ring',{diameter:.23,thickness:.028,tessellation:16},this.scene);emblem.position.set(x-.3,y+1.52,z-.06);emblem.rotation.x=Math.PI/2;this.add(emblem,'#e2c585');emblem.metadata.cameraObstacle=false;
      if(!this.indoor&&this.regionId!==UNDERSEA) this.lantern(link.x-2.5,link.z,.5);
    }
  }
  editableAsset(id: EnvironmentAssetId, position = Vector3.Zero(), scale = Vector3.One(), forceClone = false) {
    const lease = instantiateEnvironmentAsset(this.scene, id, this.root, position, scale, forceClone);
    this.environmentLeases.push(lease);
    if(['giant-mushroom','giant','medium','young','fern','grass','shrub','bluebell','groundcover','oak','birch','willow'].includes(id))this.rangedAssets.push({root:lease.root,x:position.x,z:position.z,radius:['giant','oak','birch','willow'].includes(id)?scale.x*8:scale.x,tree:['oak','birch','willow'].includes(id)});
    for (const mesh of lease.root.getChildMeshes()) if (mesh.getTotalVertices()) this.shadows.addShadowCaster(mesh);
    return lease.root;
  }
  mushroomCapVariant(original:MultiMaterial,tint:string) {
    const key=original.uniqueId+':'+tint,cached=this.mushroomVariants.get(key);if(cached)return cached;
    const variant=new MultiMaterial('forest cap variant '+key,this.scene);
    variant.subMaterials=original.subMaterials.map(material=>material?.name.includes('Russet')?this.surfaces.organic('cap',tint):material);
    this.mushroomVariants.set(key,variant);return variant;
  }
  configureIndoorCutaways(root:TransformNode) {
    const centerZ=this.regionId==='mushroom-home'?0:4;
    // Keep the saved wall surface and shading, but allow only the obstructing
    // architectural sector to cut away as the free camera crosses that wall.
    for(const source of root.getChildMeshes()){
      if(source.material instanceof PBRMaterial&&(/window view/.test(source.name)||/translucent window daylight/.test(source.material.name))){
        const original=source.material;let local=this.nightWindowMaterials.get(original.uniqueId);
        if(!local){
          local=original.clone('night-responsive window view '+original.name)!;
          const shared=new Set(original.getActiveTextures());
          for(const texture of local.getActiveTextures())if(!shared.has(texture))this.nightWindowTextures.add(texture);
          local.metadata={nightWindowView:true,dayAlbedo:local.albedoColor.clone(),dayEmissive:local.emissiveColor.clone()};this.nightWindowMaterials.set(original.uniqueId,local);
        }
        source.material=local;
      }
      if(!/01_front_cutaway|01_shell.*plaster|02_cap|03_joinery|04_glass|CUTAWAY_FRONT|inner curved back wall|interior .*wall|fitted architecture|wall post supports beam|continuous wall ledger|cross tie beam|visible locking pin|window.*(?:frame|mull|project|curtain)/.test(source.name))continue;
      const positions=source.getVerticesData(VertexBuffer.PositionKind),indices=source.getIndices();
      if(!positions||!indices)continue;
      const matrix=source.computeWorldMatrix(true),geometry=source instanceof InstancedMesh?source.sourceMesh.geometry:(source as Mesh).geometry;
      const cacheKey=this.regionId+':'+source.name+':'+Array.from(matrix.m).map(v=>v.toFixed(5)).join(',');
      const cache=geometry?(roomWallDerived.get(geometry)??new Map<string,{key:string;data:VertexData}[]>()):undefined;
      let pieces=cache?.get(cacheKey);
      if(!pieces){
       const groups=new Map<string,number[]>();
       for(let i=0;i<indices.length;i+=3){
        const center=Vector3.Zero();
        for(let k=0;k<3;k++){const j=indices[i+k]*3;center.addInPlace(Vector3.TransformCoordinates(new Vector3(positions[j],positions[j+1],positions[j+2]),matrix));}
        center.scaleInPlace(1/3);
        const sector=Math.floor((Math.atan2(center.z-centerZ,center.x)+Math.PI)/(Math.PI/4))%8;
        const materialIndex=source.subMeshes?.find(s=>i>=s.indexStart&&i<s.indexStart+s.indexCount)?.materialIndex??0,key=sector+':'+materialIndex;
        const triangles=groups.get(key)??[];triangles.push(indices[i],indices[i+1],indices[i+2]);groups.set(key,triangles);
       }
       pieces=[];
       for(const [key,triangles]of groups){
        const data=new VertexData(),map=new Map<number,number>(),subset:number[]=[];
        for(const old of triangles){if(!map.has(old))map.set(old,map.size);subset.push(map.get(old)!);}
        const copy=(kind:string,size:number)=>{const values=source.getVerticesData(kind);return values?Array.from(map.keys()).flatMap(i=>Array.from(values.slice(i*size,i*size+size))):null;};
        data.positions=copy(VertexBuffer.PositionKind,3);data.normals=copy(VertexBuffer.NormalKind,3);data.uvs=copy(VertexBuffer.UVKind,2);data.uvs2=copy(VertexBuffer.UV2Kind,2);data.colors=copy(VertexBuffer.ColorKind,4);data.tangents=copy(VertexBuffer.TangentKind,4);data.indices=subset;
        pieces.push({key,data});
       }
       if(geometry&&cache){cache.set(cacheKey,pieces);roomWallDerived.set(geometry,cache);}
      }
      for(const {key,data}of pieces){
        const section=new Mesh(source.name+' | camera wall sector '+key,this.scene);data.applyToMesh(section);
        section.parent=source.parent;section.position.copyFrom(source.position);section.scaling.copyFrom(source.scaling);section.rotation.copyFrom(source.rotation);section.rotationQuaternion=source.rotationQuaternion?.clone()??null;
        const materialIndex=Number(key.split(':')[1]);section.material=source.material instanceof MultiMaterial?source.material.subMaterials[materialIndex]:source.material;
        section.computeWorldMatrix(true);const center=section.getBoundingInfo().boundingBox.centerWorld;
        const normal=new Vector3(center.x,0,center.z-centerZ).normalize();
        section.receiveShadows=true;section.metadata={cameraObstacle:true,indoorWallSection:true,wallNormal:normal};this.shadows.addShadowCaster(section);this.cameraCutaways.push(section);
      }
      source.isVisible=false;source.metadata={...source.metadata,cameraObstacle:false};this.shadows.removeShadowCaster(source);
    }
  }
  updateCameraCutaways(target:Vector3,desired:Vector3) {
    if(this.villa){this.villa.cutaway(target,desired);return;}
    if(!this.cameraCutaways.length)return;
    for(const section of this.cameraCutaways){section.isVisible=true;section.metadata.cameraObstacle=true;}
    const outside=this.regionId==='mushroom-home'?Math.hypot(desired.x,desired.z)>4.25:Math.abs(desired.x)>7.75||desired.z<-4.75||desired.z>11.75;
    if(outside){
      const outward=new Vector3(desired.x,0,desired.z-(this.regionId==='mushroom-home'?0:4)).normalize();
      for(const section of this.cameraCutaways)if(Vector3.Dot(section.metadata.wallNormal,outward)>.65){section.isVisible=false;section.metadata.cameraObstacle=false;}
    }
    for(const cameraPoint of [desired,this.scene.activeCamera?.position??desired]){
      const direction=cameraPoint.subtract(target),distance=direction.length();if(distance<.1)continue;direction.normalize();
      const right=Vector3.Cross(direction,Vector3.Up()).normalize();
      for(const offset of [-.44,0,.44]){
        const hits=this.scene.multiPickWithRay(new Ray(target.add(right.scale(offset)),direction,distance+.3),m=>m.metadata?.indoorWallSection===true);
        for(const hit of hits??[])if(hit.pickedMesh){hit.pickedMesh.isVisible=false;hit.pickedMesh.metadata.cameraObstacle=false;}
      }
    }
  }
  updateJourneyVisuals(progress:JourneyProgress|undefined,time:number) { if(progress){this.journeyVisuals?.update(progress,time);this.villa?.updateJourneys(progress,time);} }
  animate(fn: (t:number)=>void) { this.animated.push(fn); }
  markFound(id: string) {
    this.foundFlags.add(id);
    const group = this.interactMeshes.get(id);
    if (!group) return;
    if (this.residents.has(id)) {
      // Completion closes the quest cue in the UI, not the living resident.
      group.metadata = { ...group.metadata, completed: true };
      group.setEnabled(true);
    } else group.setEnabled(false);
  }
  respondToInteraction(event: GameEvent) {
    if (!["message", "dialogue"].includes(event.type) || this.residentEvents.has(event.id)) return;
    const item = this.chapter.interactions.find(it => it.kind === "npc" &&
      Math.hypot(it.x - event.x, it.z - event.z) < .12 &&
      (event.type === "dialogue" || event.text === it.text || event.text?.startsWith("探索预览 · " + it.label + "。")));
    if (!item) return;
    const resident = this.residents.get(item.id);
    if (!resident || resident.metadata?.responseMode === "none" || typeof resident.metadata?.respond !== "function") return;
    this.residentEvents.add(event.id);
    if (this.residentEvents.size > 128) this.residentEvents.delete(this.residentEvents.values().next().value!);
    resident.metadata.respond();
  }
  swimLegalAt(x:number,y:number,z:number,radius=1.75,height=1.53){return this.movementWorld.swimLegalAt?.(x,y,z,radius,height)??true;}
  waterAt(x:number,z:number,radius?:number){return this.movementWorld.waterAt?.(x,z,radius)??null;}
  resolveSwimAt(x:number,z:number,y:number,radius:number,height:number){const p=this.movementWorld.resolveSwimAt?.(x,z,y,radius,height)??this.movementWorld.resolveAt(x,z,y,radius,height);return resolveObstacles(this.obstacles,p.x,p.z,radius,y,height,regionBounds(this.regionId));}
  surfaceAt(x:number,z:number,feetY:number,radius=.66) { return this.movementWorld.surfaceAt(x,z,feetY,radius); }
  resolveAt(x:number,z:number,feetY:number,radius=.66,bodyHeight=2.1) {
    const p=this.movementWorld.resolveAt(x,z,feetY,radius,bodyHeight);
    return resolveObstacles(this.obstacles,p.x,p.z,radius,feetY,bodyHeight,regionBounds(this.regionId));
  }
  ceilingAt(x:number,z:number,feetY:number,radius=.66) { return this.movementWorld.ceilingAt?.(x,z,feetY,radius) ?? null; }
  isSafe(x:number,z:number,y:number,radius=.66) {
    const p=this.resolveAt(x,z,y,radius); return (this.movementWorld.isSafe?.(x,z,y,radius) ?? true)&&Math.hypot(p.x-x,p.z-z)<.05;
  }
  pathDistance(x: number, z: number) {
    let best = 999;
    for (const path of this.chapter.paths) {
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
            ),
          );
        best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
      }
    }
    return best;
  }
  height(x: number, z: number) {
    if(studioRelease(this.regionId))return studioGround(this.regionId,x,z);
    if (this.indoor) return 0;
    if (this.regionId === 'canopy-garden') return canopySurface(x,z)?.y ?? regionGroundHeight(this.regionId,x,z);
    for(const p of this.chapter.terrain.platforms??[])if((!p.requiresFlag||this.foundFlags?.has(p.requiresFlag))&&Math.abs(x-p.x)<p.width/2&&Math.abs(z-p.z)<p.depth/2)return p.height;
    for (const bridge of this.chapter.landmarks.filter(
      (l) => l.kind === "bridge",
    )) {
      const scale = bridge.scale ?? 1,
        local = this.bridgeLocal(x, z, bridge);
      if (Math.abs(local.x) < 1.65 * scale && Math.abs(local.z) < 4 * scale)
        return this.bridgeDeck(
          bridge.x,
          bridge.z,
          scale,
          bridge.rotation ?? 0,
          local.z,
        );
    }
    return this.groundHeight(x, z);
  }
  cameraGroundHeight(x:number,z:number,cameraY:number,feetY=cameraY) {
    if(studioRelease(this.regionId))return this.surfaceAt(x,z,Math.min(cameraY,feetY+1.3),0)?.y??-20;
    // A camera following B1 must not be lifted by F1/F2 while interpolating down stairs.
    if(this.regionId===VILLA_REGION)return villaCameraGround(x,z,Math.min(cameraY,feetY+1.3));
    return this.regionId==='canopy-garden'?canopyCameraGroundHeight(x,z,cameraY):this.height(x,z);
  }
  resolvePosition(x: number, z: number, radius = 0.66) {
    const bounds=regionBounds(this.regionId);
    x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x));
    z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z));
    for (const o of this.obstacles) {
      const dx = x - o.x,
        dz = z - o.z;
      if (o.shape === "box") {
        const a = o.rotation ?? 0,
          c = Math.cos(a),
          s = Math.sin(a);
        let lx = dx * c - dz * s,
          lz = dx * s + dz * c;
        const hw = (o.width ?? 0) / 2 + radius,
          hd = (o.depth ?? 0) / 2 + radius;
        if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
          if (hw - Math.abs(lx) < hd - Math.abs(lz))
            lx = (lx >= 0 ? 1 : -1) * hw;
          else lz = (lz >= 0 ? 1 : -1) * hd;
          x = o.x + lx * c + lz * s;
          z = o.z - lx * s + lz * c;
        }
      } else {
        const d = Math.hypot(dx, dz),
          r = o.r + radius;
        if (d < r) {
          x = o.x + (d ? dx / d : 1) * r;
          z = o.z + (d ? dz / d : 0) * r;
        }
      }
    }
    const bridges = this.chapter.landmarks.filter((l) => l.kind === "bridge");
    for (const water of this.chapter.terrain.water ?? []) {
      const profile = this.waterProfile(water, x);
      if (
        Math.abs(x - water.x) < water.width / 2 + radius &&
        Math.abs(z - profile.z) < profile.half + radius
      ) {
        const bridge = bridges.some((l) => {
          const local = this.bridgeLocal(x, z, l),
            s = l.scale ?? 1;
          return Math.abs(local.x) < Math.max(.2,1.63 * s - radius + .02) && Math.abs(local.z) < 4.3 * s;
        });
        if (!bridge) {
          const dx = water.width / 2 + radius - Math.abs(x - water.x),
            dz = profile.half + radius - Math.abs(z - profile.z);
          if (dx < dz)
            x = water.x + (x >= water.x ? 1 : -1) * (water.width / 2 + radius + 0.01);
          else
            z = profile.z + (z >= profile.z ? 1 : -1) * (profile.half + radius + 0.01);
        }
      }
    }
    return { x: Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x)), z: Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z)) };
  }
  biomeDetails() {
    const biome = this.chapter.biome;
    if (biome === "castle") {
      // A walkable, roof-open candlelit gallery: all passages retain clear lines of movement.
      for (let z = 12; z < 96; z += 9) {
        for (const side of [-1, 1]) {
          const x = side * 24,
            y = this.landHeight(x, z);
          if (![21,48,75].includes(z)) this.box(
            "gallery stone wall",
            x,
            y + 3.6,
            z,
            0.8,
            7.2,
            8.8,
            "#74758d",
          );
          if (![21,48,75].includes(z)) this.box(
            "gallery panel inset",
            x - side * 0.45,
            y + 3.4,
            z,
            0.05,
            3.2,
            3.0,
            "#515e79",
          );
          if (![21,48,75].includes(z)) this.box(
            "gallery glowing window",
            x - side * 0.5,
            y + 4.2,
            z,
            0.05,
            2.5,
            1.4,
            "#e4c58f",
          ).material = this.mat("#e4c58f", 0.5);
          for (const zz of [-3.6, 3.6]) {
            const column = MeshBuilder.CreateCylinder(
              "gallery column",
              { height: 7.6, diameter: 0.65, tessellation: 12 },
              this.scene,
            );
            column.position.set(x - side * 0.8, y + 3.8, z + zz);
            this.add(column, "#9c9aad");
          }
          this.lantern(x - side * 2, z, 1);
        }
        const floor = this.box(
          "gallery inlaid floor",
          0,
          this.landHeight(0, z) - 0.06,
          z,
          45,
          0.1,
          8.8,
          "#767b89",
        );
        for (let i = -3; i <= 3; i++) {
          this.box(
            "floor mosaic",
            i * 6,
            this.landHeight(i * 6, z) + 0.02,
            z,
            4.4,
            0.045,
            5.6,
            (i + (z % 2)) % 2 ? "#959a9e" : "#838998",
          );
        }
      }
      for (const z of [24, 54, 84]) {
        for (const side of [-1, 1]) {
          const x = side * 20;
          this.box(
            "portrait gilt frame",
            x,
            this.landHeight(x, z) + 2.4,
            z,
            0.18,
            2.2,
            1.6,
            "#c0a778",
          );
          this.box(
            "portrait velvet",
            x - side * 0.11,
            this.landHeight(x, z) + 2.4,
            z,
            0.06,
            1.85,
            1.27,
            "#697389",
          );
        }
        this.arch(0, z, 1.4, "#a0a1b3");
      }
    }
    if (biome === "graveyard") {
      for (let z = 9; z < 100; z += 10)
        for (const x of [-35, 35]) {
          this.box(
            "cemetery pier",
            x,
            this.landHeight(x, z) + 0.7,
            z,
            0.5,
            1.4,
            0.5,
            "#7a8690",
          );
          for (let j = 1; j < 5; j++) {
            const zz = z + j * 1.8;
            this.box(
              "cemetery ironwork",
              x,
              this.landHeight(x, zz) + 0.6,
              zz,
              0.06,
              1.2,
              0.05,
              "#657680",
            );
          }
          this.tube(
            "cemetery rail",
            [
              new Vector3(x, this.landHeight(x, z) + 0.9, z),
              new Vector3(x, this.landHeight(x, z + 9) + 0.9, z + 9),
            ],
            0.045,
            "#657680",
            false,
          );
        }
      for (let i = 0; i < 28; i++) {
        const x = Math.sin(i * 11.9) * 30,
          z = 15 + i * 2.9;
        this.landmark({
          id: "extra-grave-" + i,
          kind: "grave",
          x,
          z,
          scale: 0.7 + (i % 3) * 0.15,
        });
        if (i % 3 === 0) this.lantern(x + 0.7, z, 0.65);
      }
    }
    if (biome === "mountain" || biome === "dragon") {
      for (let z = 0; z < 116; z += 9)
        for (const side of [-1, 1]) {
          const x = side * (33 + Math.sin(z) * 3);
          const r = this.rock(
            x,
            z,
            4.4 + (z % 3),
            biome === "mountain" ? "#a3b1aa" : "#768699",
          );
          r.scaling.y *= 1.8;
          if (biome === "mountain") {
            const snow = this.rock(
              x,
              z,
              4.3,
              "#d8dfd2",
              r.position.y + r.scaling.y * 0.63,
            );
            snow.scaling.y *= 0.19;
          }
        }
      if (biome === "dragon")
        for (let i = 0; i < 18; i++)
          this.landmark({
            id: "nest-crystal" + i,
            kind: "crystal",
            x: Math.sin(i * 4.4) * 30,
            z: 25 + i * 4,
            scale: 0.5 + (i % 4) * 0.15,
          });
    }
  }

  dispose() {
    this.animals?.dispose();this.animals=null;
    this.studio?.dispose();this.studio=null;
    this.villa?.dispose();this.villa=null;
    this.journeyVisuals?.dispose();this.fieldVisuals?.dispose();this.chainVisuals?.dispose();
    this.shadows.dispose();
    this.environmentLeases.forEach(lease => lease.dispose());
    this.environmentLeases = [];
    for(const mesh of this.batchedEnvironment){mesh.parent=null;mesh.dispose(false,false);}this.batchedEnvironment=[];
    this.mushroomVariants.forEach(material=>material.dispose(false,false));this.mushroomVariants.clear();
    this.nightWindowMaterials.forEach(material=>material.dispose(false,false));this.nightWindowMaterials.clear();
    this.nightWindowTextures.forEach(texture=>texture.dispose());this.nightWindowTextures.clear();
    this.nightLanternPools.forEach(light=>light.dispose());this.nightLanternPools=[];this.nightLanternSources=[];
    this.rangedAssets=[];
    this.root.dispose(false, true);
    this.skyTexture?.dispose();
    this.contactTexture?.dispose();
    this.surfaces.dispose();
    this.detailMeshes = [];
    this.animated = [];
    this.light.dispose();
    this.hemi.dispose();
    this.campLight?.dispose();
    this.mats.forEach((m) => m.dispose());
  }
}
