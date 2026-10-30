import {SwimWake} from './swim-wake';
import {waterColumn,poolWaterPoint,SWIM_HEIGHT} from '../shared/swimming';
import {retainMaterialLightBudgets} from "./material-light-budget";
import {HomePetActors} from './home-pet-actors';
import {PetActor} from './pet-actor';
import {animalReaction} from './animal-interactions';
import{cameraRayDistance}from'./camera-ray-index';
import{ActorOcclusion}from'./actor-occlusion';
import {ensureStudioData,studioData} from './studio-physics';
import {studioRelease,TOWN,CITY} from './studio-regions';
import {homeUseDefinition} from '../shared/home-use';
import {
  Engine,
  EngineInstrumentation,
  Scene,
  FreeCamera,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  TransformNode,
  VertexData,
  VertexBuffer,
  Ray,
  DynamicTexture,
  DefaultRenderingPipeline,
  Curve3,
  ImageProcessingConfiguration,
} from "@babylonjs/core";
import {BEACH,beachCameraLegal} from '../shared/beach-swimming';
import {UNDERSEA,underseaLegal} from '../shared/undersea';
import {fieldHidesPartner} from '../shared/fieldbook';
import { WorldWeather } from "./world-weather";
import { WorldClouds } from "./world-clouds";
import { prepareEnvironmentAssets, disposeEnvironmentAssets } from "./environment-assets";
import {installRenderCandidates} from './render-candidates';
import {AutoResolution,AutoQuality,renderDensity} from './render-resolution';
import {prepareVillaAssets,villaAssetsReady} from './villa-world';
import {VILLA_REGION} from './villa-physics';
import { createDog, type DogActor } from "./actors";
import { createCreature, type Creature } from "./creatures";
import { World, heightAt } from "./world";
import { CHAPTERS, type Chapter } from "./content";
import type { Snapshot, Enemy, GameEvent } from "./simulation";
import type { DogRole } from "../shared/save";
const hex = (s: string) => Color3.FromHexString(s);
export class GameRenderer {
  loadingRegion = '';
  private stagedRegion:World|null=null;
  private stagedFromCache=false;
  private preparation:Promise<void>|null=null;
  private preparingShaders=false;
  async prepareRegion(ch:Chapter,id:string,arrival:{x:number;y?:number;z:number}){
    if(this.preparation){try{await this.preparation;}catch{}}if(this.stagedRegion?.regionId===id)return;if(this.stagedRegion)this.discardPreparedRegion();
    this.preparation=(async()=>{let next:World|undefined,fromCache=false;try{
      if((id===TOWN||id===CITY||id===UNDERSEA)){for(const w of this.roomCache.values())w.dispose();this.roomCache.clear();}await ensureStudioData(id);if(id===VILLA_REGION)await prepareVillaAssets(this.scene);
      next=this.roomCache.get(id);if(next){fromCache=true;this.roomCache.delete(id);}else{next=new World(this.scene,ch,id,true);next.studioStart={...arrival,y:arrival.y??0};await next.finishBuild();}
      if(fromCache&&next.studio)await next.studio.ensure({...arrival,y:arrival.y??0});
      // Compile with the same region-owned lights used after commit. Priming
      // under the outgoing region's lights produced another shader on first walk.
      this.preparingShaders=true;this.world.setActive(false);next.setActive(true);
      try{if(id===VILLA_REGION&&!fromCache){next.setQuality(this.effectiveQuality);await next.prepareVisibleEffects();}await this.scene.whenReadyAsync();}
      finally{next.setActive(false);this.world.setActive(true);this.preparingShaders=false;}
      next.setActive(false);this.world.setActive(true);this.stagedRegion=next;this.stagedFromCache=fromCache;
    }catch(e){if(next){if(fromCache){next.setActive(false);this.roomCache.set(id,next);this.trimRoomCache();}else next.dispose();}this.world.setActive(true);throw e;}finally{this.preparation=null;}})();return this.preparation;
  }
  discardPreparedRegion(){if(this.stagedRegion){if(this.stagedFromCache){this.stagedRegion.setActive(false);this.roomCache.set(this.stagedRegion.regionId,this.stagedRegion);this.trimRoomCache();}else this.stagedRegion.dispose();}this.stagedRegion=null;this.stagedFromCache=false;}


  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  world: World;
  dogs: Record<DogRole, DogActor>;
  pet:PetActor;
  golden:PetActor;
  homePets:HomePetActors;
  yaw = 0;
  pitch = 0.17;
  private actorOpacity=1;
  viewYaw = 0;
  private viewPitch = .17;
  menu = true;
  preview = false;
  characterPreview: DogRole | null = null;
  previewAngle = Math.PI;
  bare = true;
  visibleRoles: DogRole[] = ["gold", "white"];
  role: DogRole = "gold";
  creatures = new Map<string, Creature>();
  private contacts = new Map<DogRole, Mesh>();
  private brooms = new Map<DogRole, TransformNode>();
  private effects: {
    root: TransformNode;
    age: number;
    duration: number;
    type: string;
  }[] = [];
  private time = 0;
  private chapterId = "";
  private regionId = "";
  private frame = 0;
  private lastLook = 0;
  private cameraDistance = 9;
  private cameraSnap = false;
  zoomDistance = 8.8;
  private titleIdle = false;
  private quality = "auto";
  private pixelScale = 1;
  private performanceTime = 0;
  private autoResolution=new AutoResolution();
  private autoQuality=new AutoQuality();
  private gpuTelemetry:EngineInstrumentation;
  get effectiveQuality(){return this.quality==='auto'?this.autoQuality.tier:this.quality;}
  get qualityMetrics(){return{selected:this.quality,effective:this.effectiveQuality,density:1/this.pixelScale,cachedMiB:[...this.roomCache.values()].reduce((n,w)=>n+w.estimateRetainedBytes(),0)/1048576,gpuMs:this.gpuTelemetry.gpuFrameTimeCounter.current/1e6};}
  private resizeObserver:ResizeObserver;
  private resizeRendering=()=>this.applyRenderSize(true);
  private pipeline: DefaultRenderingPipeline;
  private weather: WorldWeather;private swimWake:SwimWake;
  private clouds: WorldClouds;
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: true,
        stencil: true,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
      },
      false,
    );
    this.autoQuality=new AutoQuality(this.engine.webGLVersion<2||this.engine.getCaps().maxTextureSize<4096||navigator.hardwareConcurrency<=4||((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)<=4);
    this.gpuTelemetry=new EngineInstrumentation(this.engine);
    this.applyRenderSize(true);
    this.scene = new Scene(this.engine);
    installRenderCandidates(this.scene);
    retainMaterialLightBudgets(this.scene);
    this.homePets=new HomePetActors(this.scene);this.pet = new PetActor(this.scene);this.golden=new PetActor(this.scene,{version:'golden-retriever-studio-01',rootUrl:'/assets/animals/golden-retriever/',file:'golden-retriever-studio01-6ea4664e.glb',walkSpeed:.3,trotSpeed:.58,trotEnter:1.1,trotLeave:.85},'golden-retriever',.55);
    // PBR uses the world's sky irradiance. Do not add another flat ambient wash.
    this.scene.ambientColor = Color3.Black();
    this.scene.imageProcessingConfiguration.exposure = 1.0;
    this.scene.imageProcessingConfiguration.contrast = 1.0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    this.camera = new FreeCamera(
      "adventure-camera",
      new Vector3(9, 5, -15),
      this.scene,
    );
    this.camera.minZ = 0.15;
    this.camera.maxZ = 320;
    this.camera.fov = 0.85;
    this.camera.inputs.clear();
    this.world = new World(this.scene, CHAPTERS[0]);
    this.weather = new WorldWeather(this.scene);this.swimWake=new SwimWake(this.scene);
    this.clouds = new WorldClouds(this.scene);
    this.clouds.load(CHAPTERS[0].id, false);
    this.chapterId = CHAPTERS[0].id;
    this.regionId = CHAPTERS[0].id;
    this.dogs = {
      gold: createDog(this.scene, "gold"),
      white: createDog(this.scene, "white"),
    };
    Object.entries(this.dogs).forEach(([role, d]) => {
      this.brooms.set(role as DogRole, this.createBroom(d.root, role));
      for(const material of new Set(d.root.getChildMeshes().map(m=>m.material).filter(m=>!!m)))new ActorOcclusion(material!,()=>role===this.role?this.actorOpacity:1);
      d.root.getChildMeshes().forEach((m) => {
        m.receiveShadows = true;
        this.world.shadows.addShadowCaster(m);
      });
      const texture = new DynamicTexture(
        "contact-shadow",
        64,
        this.scene,
        false,
      );
      const ctx = texture.getContext();
      const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
      grad.addColorStop(0, "rgba(0,0,0,.82)");
      grad.addColorStop(0.5, "rgba(0,0,0,.40)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      texture.hasAlpha = true;
      texture.update();
      const plane = MeshBuilder.CreateGround(
        "contact-shadow",
        { width: 1.65, height: 1.28, subdivisions: 4, updatable: true },
        this.scene,
      );
      this.contacts.set(role as DogRole, plane);
      plane.alphaIndex = 10;
      const material = new StandardMaterial("contact-shadow", this.scene);
      material.diffuseTexture = texture;
      material.useAlphaFromDiffuseTexture = true;
      material.disableLighting = true;
      material.disableDepthWrite = true;
      material.zOffset = -1;
      material.emissiveColor = Color3.Black();
      plane.material = material;
      plane.isPickable = false;
    });
    this.pipeline = new DefaultRenderingPipeline(
      "soft storybook light",
      true,
      this.scene,
      [this.camera],
    );
    this.pipeline.fxaaEnabled = true;
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.95;
    this.pipeline.bloomWeight = 0.035;
    this.pipeline.bloomKernel = 40;
    this.pipeline.bloomScale = 0.4;
    this.pipeline.samples = 1;
    window.addEventListener('resize',this.resizeRendering);
    document.addEventListener('fullscreenchange',this.resizeRendering);
    window.visualViewport?.addEventListener('resize',this.resizeRendering);
    this.resizeObserver=new ResizeObserver(this.resizeRendering);this.resizeObserver.observe(canvas);
  }
  prepareEnvironmentAssets() { return prepareEnvironmentAssets(this.scene); }
  private roomCache=new Map<string,World>();
  private trimRoomCache(){const ram=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??8,budget=(this.effectiveQuality==='low'||ram<=4?192:768)*1048576;let cost=[...this.roomCache.values()].reduce((n,w)=>n+w.estimateRetainedBytes(),0);for(const[id,w]of this.roomCache){if(cost<=budget&&this.roomCache.size<=2)break;cost-=w.estimateRetainedBytes();w.dispose();this.roomCache.delete(id);}}
  regionTimings:{region:string;cached:boolean;buildMs:number;disposeMs:number;totalMs:number}[]=[];
  load(ch: Chapter, regionId = ch.id,arrival?:{x:number;y:number;z:number}) {
    if(this.regionId===regionId){this.chapterId=ch.id;return;}
    if(this.loadingRegion)return;
    this.loadingRegion=regionId;document.dispatchEvent(new Event('goulai-input-block'));
    const overlay=document.createElement('section');overlay.id='region-loading';overlay.setAttribute('role','status');
    overlay.textContent=regionId==='mushroom-home'?'正在推开苔灯小屋的门…':regionId==='mushroom-grove'?'正在铺开伞下的林间小路…':'正在走向下一片风景…';document.body.append(overlay);
    const started=performance.now(),pair=(id:string)=>id==='mushroom-home'||id==='mushroom-grove';let next:World|undefined;
    void(async()=>{
      // Present input blocking before any geometry/GPU work begins.
      await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
      // Retain bounded recently visited worlds; a hot return must not rebuild the entire region.
      if((regionId===TOWN||regionId===CITY||regionId===UNDERSEA)){for(const w of this.roomCache.values())w.dispose();this.roomCache.clear();}
      await ensureStudioData(regionId);
      if(regionId===VILLA_REGION)await prepareVillaAssets(this.scene);
      const prepared=this.stagedRegion?.regionId===regionId;
      const cached=this.roomCache.has(regionId)||(this.stagedRegion?.regionId===regionId&&this.stagedFromCache),buildStart=performance.now();
      next=this.stagedRegion?.regionId===regionId?this.stagedRegion:this.roomCache.get(regionId);if(next===this.stagedRegion){this.stagedRegion=null;this.stagedFromCache=false;}const stale=this.roomCache.get(regionId);if(stale&&stale!==next)stale.dispose();this.roomCache.delete(regionId);
      if(!next){next=new World(this.scene,ch,regionId,true);if(arrival)next.studioStart={...arrival};await next.finishBuild();}else if(arrival&&next.studio)await next.studio.ensure(arrival);
      // Any optional shader preparation may fail: retain the prior world until it succeeds.
      if((regionId===VILLA_REGION||(regionId===TOWN||regionId===CITY||regionId===UNDERSEA))&&!prepared&&!cached){this.preparingShaders=true;this.world.setActive(false);next.setActive(true);try{next.setQuality(this.effectiveQuality);await next.prepareVisibleEffects();await this.scene.whenReadyAsync();}finally{next.setActive(false);this.world.setActive(true);this.preparingShaders=false;}}
      const buildMs=performance.now()-buildStart,disposeStart=performance.now();
      this.creatures.forEach(c=>c.dispose());this.creatures.clear();this.effects.forEach(e=>e.root.dispose(false,true));this.effects=[];
      const old=this.world;old.setActive(false);
      if((old.regionId===TOWN||old.regionId===CITY||old.regionId===UNDERSEA)||(regionId===TOWN||regionId===CITY||regionId===UNDERSEA)){old.dispose();if((regionId===TOWN||regionId===CITY||regionId===UNDERSEA)){for(const w of this.roomCache.values())w.dispose();this.roomCache.clear();}}else{this.roomCache.set(old.regionId,old);this.trimRoomCache();}
      this.world=next;this.world.setActive(true);this.world.setQuality(this.effectiveQuality);
      this.clouds.load(regionId,this.world.indoor);this.chapterId=ch.id;this.regionId=regionId;
      this.cameraDistance=this.world.indoor?6.2:9;this.cameraSnap=true;this.autoResolution.warmup();this.autoQuality.warmup();
      for(const d of Object.values(this.dogs))for(const m of d.root.getChildMeshes())if(m.name!=='contact-shadow')this.world.shadows.addShadowCaster(m);
      this.regionTimings.push({region:regionId,cached,buildMs,disposeMs:performance.now()-disposeStart,totalMs:performance.now()-started});if(this.regionTimings.length>24)this.regionTimings.shift();
      this.loadingRegion='';overlay.remove();document.dispatchEvent(new Event('goulai-region-ready'));
    })().catch(error=>{
      if(next&&next!==this.world)next.dispose();this.world.setActive(true);
      console.error('Region preparation failed',error);overlay.textContent='这片风景还没准备好，进度仍保留。';
      const retry=document.createElement('button');retry.textContent='重试';overlay.append(retry);retry.onclick=()=>{overlay.remove();this.loadingRegion='';this.load(ch,regionId,arrival);};const cancel=document.createElement('button');cancel.textContent='保存并返回主画面';cancel.onclick=()=>{overlay.remove();this.loadingRegion='';document.dispatchEvent(new Event('goulai-region-cancel'));};overlay.append(cancel);
    });
  }

  setQuality(value: string) {
    this.quality = ['auto','low','medium','high'].includes(value)?value:'auto';
    this.gpuTelemetry.captureGPUFrameTime=this.quality==='auto'&&!!this.engine.getCaps().timerQuery;
    this.autoQuality.warmup();this.applyQuality();
  }
  private applyQuality(){
    const value=this.effectiveQuality;
    this.world.setQuality(value);this.trimRoomCache();
    this.pipeline.bloomEnabled = value !== "low";
    const desktopAA = value === 'high' && matchMedia('(any-pointer: fine)').matches && this.engine.webGLVersion > 1;
    this.pipeline.samples = desktopAA ? 2 : 1;
    this.pipeline.fxaaEnabled = !desktopAA;
    this.applyRenderSize(true);
  }
  private applyRenderSize(reset=false){
    const canvas=this.engine.getRenderingCanvas()!,box=canvas.getBoundingClientRect();
    const density=renderDensity(box.width,box.height,window.devicePixelRatio||1,this.effectiveQuality);
    if(reset)this.autoResolution.reset(density);
    this.pixelScale=1/(this.quality==='auto'?this.autoResolution.density:density);
    this.engine.setHardwareScalingLevel(this.pixelScale);this.engine.resize();
  }
  private cameraClearDistance(target:Vector3,direction:Vector3,distance:number) {
    // A centre ray can pass beside an eave while the near-plane corners sit inside
    // it. Sweep a small camera volume, including diagonal corners, before and
    // after smoothing. The postman's roof is the regression case.
    const right=Vector3.Cross(direction,Vector3.Up()).normalize();
    const up=Vector3.Cross(right,direction).normalize();
    const radius=Math.min(.5,Math.max(.36,.36+(this.engine.getRenderWidth()/this.engine.getRenderHeight()-1.7)*.12));
    let clear=distance;
    const candidates=this.world.cameraCandidates.filter(m=>{
      if(!m.isEnabled()||!m.isVisible||m.metadata?.cameraObstacle!==true||(this.world.indoor&&m.metadata?.cameraCutaway&&direction.z<-.05))return false;
      const sphere=m.getBoundingInfo().boundingSphere;
      return Vector3.DistanceSquared(target,sphere.centerWorld)<(distance+sphere.radiusWorld+radius)**2;
    });
    for(const [x,y]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-.7,-.7],[-.7,.7],[.7,-.7],[.7,.7]]) {
      const origin=target.add(right.scale(x*radius)).add(up.scale(y*radius));
      const ray=new Ray(origin,direction,clear);let nearest:number|null=null;for(const mesh of candidates){const d=cameraRayDistance(ray,mesh);if(d!==null&&(nearest===null||d<nearest))nearest=d;}
      if(nearest!==null)clear=Math.max(.05,Math.min(clear,nearest-.28));
    }
    return clear;
  }
  resetAfterContextRestore(){this.autoResolution.warmup();this.autoQuality.warmup();this.cameraSnap=true;this.stopLook();}
  snapActor(role:DogRole,p:{x:number;y:number;z:number}){this.dogs[role].root.position.set(p.x,p.y,p.z);this.cameraSnap=true;}
  stopLook() { this.yaw=this.viewYaw;this.pitch=this.viewPitch; }
  look(x: number, y: number) {
    if (x || y) {
      this.yaw += x;
      this.pitch = Math.max(-1.12, Math.min(1.28, this.pitch + y));
      this.lastLook = this.time;
    }
  }
  zoom(delta: number) { this.zoomDistance = Math.max(6, Math.min(13, this.zoomDistance + delta * .012)); }
  get actorCoverage(){return this.actorOpacity;}
  get cloudMetrics() { return this.clouds.metrics; }
  render(dt: number, state: Snapshot | null) {
    // Travel already locks input. Keep the last canvas frame while target-region
    // effects are prepared; rendering the outgoing world re-enabled its lights.
    if(this.preparingShaders)return;
    this.time += dt;
    this.frame++;
    const titleCast = this.menu && !this.characterPreview;
    if (titleCast) {
      this.pet.root.setEnabled(false);this.golden.root.setEnabled(false);
      if (!this.titleIdle) {
        this.engine.getRenderingCanvas()!.style.visibility = 'hidden';
        this.world.root.setEnabled(false);
        Object.values(this.dogs).forEach(d => d.root.setEnabled(false));
        this.contacts.forEach(s => s.setEnabled(false));
        this.clouds.update(0, this.effectiveQuality, false);
        document.body.classList.add('title-cast');
      }
      this.titleIdle = true;
      return;
    }
    this.titleIdle = false;
    this.engine.getRenderingCanvas()!.style.visibility = '';
    if (this.characterPreview && this.regionId !== CHAPTERS[0].id) this.load(CHAPTERS[0]);
    this.world.update(
      this.time,
      state ? state.players[this.role] : { x: -4, z: 0 },
      state && !this.menu ? this.visibleRoles.map(role => state.players[role]) : [],
    );
    if (state && (state.chapterId !== this.chapterId || (state.regionId ?? state.chapterId) !== this.regionId))
      this.load(CHAPTERS.find((c) => c.id === state.chapterId) ?? CHAPTERS[0], state.regionId ?? state.chapterId,(state.regionId===TOWN||state.regionId===CITY)?state.players[this.role]:undefined);
    // The selected title is illustration-only; character selection below uses
    this.camera.maxZ=this.world.regionId===CITY?650:320;
    // the real actors in the world, never the studio's reference image cards.
    this.world.root.setEnabled(!titleCast);
    this.scene.clearColor.a = titleCast ? 0 : 1;
    document.body.classList.toggle('title-cast', titleCast);
    for (const creature of this.creatures.values()) creature.root.setEnabled(!titleCast);
    for (const effect of this.effects) effect.root.setEnabled(!titleCast);
    if(state){this.world.updateJourneyVisuals(state.journeys,this.time);this.scene.metadata={...this.scene.metadata,fieldViewRole:this.role};this.world.updateFieldVisuals(state,this.time);this.world.animals?.update(state.time,state.players[this.role],this.effectiveQuality,state);this.world.updateAnimalResponses(state);}
    if (this.menu || this.characterPreview) this.brooms.forEach(b=>b.setEnabled(false));
    if (this.menu || this.characterPreview)
      for (const actor of Object.values(this.dogs))
        for (const mesh of actor.root.getChildMeshes()) mesh.visibility = 1;
    if (this.characterPreview) {
      for (const r of ["gold", "white"] as DogRole[]) {
        const dog = this.dogs[r];
        dog.root.setEnabled(r === this.characterPreview);
        if (!dog.root.isEnabled()) continue;
        dog.root.position.set(-1, this.world.height(-1, -7), -7);
        dog.root.rotation.y = this.previewAngle;
        dog.showEquipment(false);
        dog.update(dt, { speed: 0, action: "idle", time: this.time });
      }
      // The controls occupy the lower part of a portrait phone. Frame the
      // whole same-source actor above them, without the desktop's left offset.
      const portrait = this.engine.getRenderHeight() > this.engine.getRenderWidth();
      const center = this.dogs[this.characterPreview].root.position.add(
        portrait ? new Vector3(0, 0.08, 0) : new Vector3(0.9, 1.15, 0),
      );
      this.camera.position = Vector3.Lerp(
        this.camera.position,
        center.add(portrait ? new Vector3(0, 1.65, -7) : new Vector3(0, 0.5, -5.5)),
        Math.min(1, dt * 6),
      );
      this.camera.setTarget(center);
    } else if (this.menu) {
      const center = new Vector3(-1.8, 1.65, 0);
      const targetPos = center.add(new Vector3(0, .55, -7.2));
      this.camera.position = Vector3.Lerp(
        this.camera.position,
        targetPos,
        Math.min(1, dt * 4),
      );
      this.camera.setTarget(center);
      this.dogs.gold.root.setEnabled(false);
      this.dogs.white.root.setEnabled(false);
      this.dogs.gold.showEquipment(false);
      this.dogs.white.showEquipment(false);
      this.dogs.gold.root.position.set(-.8, 0, .1);
      this.dogs.white.root.position.set(.7, 0, 0);
      for (const [i, r] of (["gold", "white"] as DogRole[]).entries()) {
        this.dogs[r].root.rotation.y = 3.15;
        this.dogs[r].update(dt, { speed: 0, action: "idle", time: this.time });
      }
    } else if (state) {
      for (const r of ["gold", "white"] as DogRole[]) {
        const p = state.players[r],
          dog = this.dogs[r];
        dog.root.setEnabled(this.visibleRoles.includes(r)&&!(state.fieldPlay?.kind==='hide'&&state.fieldPlay.phase==='prepare'&&state.fieldPlay.seeker===this.role&&r!==this.role));
        if (!dog.root.isEnabled()) continue;
        dog.showEquipment(
          p.weaponDrawn!==false,
          !this.bare,
        );
        const feetY = Number.isFinite(p.y) ? p.y : this.world.height(p.x, p.z);
        const goal = new Vector3(p.x, feetY, p.z);
        const before=dog.root.position.clone();
        dog.root.position = Vector3.Lerp(
          dog.root.position,
          goal,
          1-Math.exp(-dt*22),
        );
        let delta = p.yaw - dog.root.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        dog.root.rotation.y += delta * (1-Math.exp(-dt*22));
        const home=p.homeUse,homeProgress=home?Math.min(1,Math.max(0,(state.time-home.startedAt)/.42)):0;
        const homeBlend=home?(home.phase==='rest'?1:home.phase==='exit'?1-homeProgress*homeProgress*(3-2*homeProgress):homeProgress*homeProgress*(3-2*homeProgress)):0;
        dog.setLoadout(p.weapon, p.skin);
        dog.update(dt, {
          animalGesture:state.animalCare?.reactions.find(a=>a.role===r&&state.time<a.until)?(()=>{const a=state.animalCare!.reactions.find(a=>a.role===r&&state.time<a.until)!;return{kind:a.kind,elapsed:state.time-a.start,remaining:a.until-state.time};})():undefined,
          homePose:home?homeUseDefinition(home.id)!.pose:undefined,homeBlend,
          duo:state.duo?.phase==='active'?(state.duo.type==='cuddle'?'cuddle':r==='gold'?'rider':'carrier'):undefined,
          duoTime:state.duo?state.time-state.duo.startedAt:0,
          speed: p.mounted?p.speed:Math.min(10,Vector3.Distance(before,dog.root.position)/Math.max(.001,dt)),
          action: p.action,
          time: this.time,
          direction: p.yaw,
          actionTime: p.actionTime,
          sprinting: p.sprinting, grounded: p.grounded, vy: p.vy, landing: p.landing,
          swim:p.swim,mounted: p.mounted, flightSpeed: p.speed, flightTurn: delta, flightPhase: p.flight,
        });
        const broom=this.brooms.get(r)!;broom.setEnabled(p.mounted===true);
        broom.rotation.x=-Math.min(1,p.speed/11)*.06;
        broom.rotation.z=-Math.max(-1,Math.min(1,delta))*.07;

      }
      const p = state.players[this.role];
      const carrying=state.duo?.phase==='active'&&state.duo.type==='ride';
      const viewPlayer=carrying?state.players.white:p;
      // Angular damping and orbit use the same orientation, including across ±π.
      const turn=1-Math.exp(-dt*24);
      if(this.cameraSnap){this.viewYaw=this.yaw;this.viewPitch=this.pitch;}
      else{this.viewYaw+=Math.atan2(Math.sin(this.yaw-this.viewYaw),Math.cos(this.yaw-this.viewYaw))*turn;this.viewPitch+=(this.pitch-this.viewPitch)*turn;}
      this.camera.fov+=(.85-this.camera.fov)*(1-Math.exp(-dt*12));
      const indoor=this.world.interiorAt(viewPlayer.homeUse?{...viewPlayer,y:viewPlayer.homeUse.exit.y}:viewPlayer);
      const viewedDog=this.dogs[carrying?'white':this.role];
      const resting=viewPlayer.homeUse,lie=resting&&homeUseDefinition(resting.id)?.pose==='lie';
      const poseTime=resting?Math.max(0,Math.min(1,(state.time-resting.startedAt)/.42)):0;
      const poseEase=poseTime*poseTime*(3-2*poseTime);
      const lieBlend=lie?(resting.phase==='rest'?1:resting.phase==='exit'?1-poseEase:poseEase):0;
      // A lying dog's body extends behind its standing root. Follow the body
      // centre throughout the transition, rather than framing only its feet.
      const target = viewedDog.root.position.add(new Vector3(
        -Math.sin(viewedDog.root.rotation.y)*1.15*lieBlend,
        carrying?2:p.swim!=='land'?.75:1.55-.55*lieBlend,
        -Math.cos(viewedDog.root.rotation.y)*1.15*lieBlend,
      ));
      const followDistance = indoor ? Math.max(5.5, Math.min(8.2, this.zoomDistance * 7.1 / 8.8)) : this.zoomDistance + (p.mounted ? 1.8 : 0);
      // Upward look rotates the view above the shoulder. On foot the camera
      // boom stays at eye level rather than trying to orbit under the floor.
      const orbitPitch=p.mounted||p.swim!=='land'?this.viewPitch:Math.max(0,this.viewPitch);
      if(this.preview){
        const a=this.time*.16;this.camera.position.copyFrom(target.add(new Vector3(Math.sin(a)*5.5,1.1,Math.cos(a)*5.5)));this.camera.setTarget(target);
      }else{
        const goal=target.add(new Vector3(-Math.sin(this.viewYaw)*followDistance*Math.cos(orbitPitch),Math.sin(orbitPitch)*followDistance,-Math.cos(this.viewYaw)*followDistance*Math.cos(orbitPitch)));
        if((this.world.regionId===VILLA_REGION||studioRelease(this.world.regionId))&&indoor){const ceiling=this.world.ceilingAt(target.x,target.z,viewPlayer.y,.35);if(ceiling!==null)goal.y=Math.min(goal.y,ceiling-.45);}
        const column=p.swim!=='land'?waterColumn(state.regionId,p.x,p.z):null;
        if(column&&p.swim==='underwater')goal.y=Math.min(goal.y,column.surface-.15);
        else if(column)goal.y=Math.max(goal.y,column.surface+3.0);
        this.world.updateCameraCutaways(target,goal);
        let direction=goal.subtract(target),distance=direction.length();direction.normalize();
        const trace=(underwater:boolean)=>{
          let safe=this.cameraClearDistance(target,direction,distance);
          for(let d=.1;d<=safe;d+=.1){
            const probe=target.add(direction.scale(d));
            if(state.regionId===UNDERSEA){if(!underseaLegal(probe.x,probe.y-.2,probe.z,.2,.4)){safe=Math.max(.05,d-.1);break;}continue;}
            if(state.regionId===BEACH&&column&&underwater){if(!beachCameraLegal(probe.x,probe.y,probe.z)){safe=Math.max(.05,d-.1);break;}continue;}
            if(column&&underwater&&state.regionId===VILLA_REGION){const edge=poolWaterPoint(probe.x,probe.z);if(!edge.inside||edge.distance<.28){safe=Math.max(.05,d-.1);break;}}
            const waterFloor=p.swim!=='land'?waterColumn(state.regionId,probe.x,probe.z,0):null;
            const floor=waterFloor?.floor??this.world.cameraGroundHeight(probe.x,probe.z,probe.y,viewPlayer.y);
            const ceiling=indoor?this.world.ceilingAt(probe.x,probe.z,viewPlayer.y,.1):null;
            if(probe.y<floor+.3||(ceiling!==null&&probe.y>ceiling-.3)){safe=Math.max(.05,d-.1);break;}
          }
          return safe;
        };
        let safe=trace(!!column&&p.swim==='underwater');
        // A shallow basin cannot fit the normal boom behind a dog at its wall.
        // Lift the eye above the rim there; never put it through the bank or head.
        if(state.regionId===VILLA_REGION&&column&&p.swim==='underwater'&&safe<3.1){goal.y=column.surface+6.0;direction=goal.subtract(target);distance=direction.length();direction.normalize();safe=trace(false);this.cameraDistance=safe;}
        // Immediate contraction keeps geometry safe; bounded recovery prevents
        // a flicker at railings or door jambs from repeatedly extending the boom.
        if(this.cameraSnap||safe<this.cameraDistance)this.cameraDistance=safe;
        else if(safe>this.cameraDistance+.035)this.cameraDistance+=Math.min(safe-this.cameraDistance,(safe-this.cameraDistance)*(1-Math.exp(-dt*8)));
        this.camera.position.copyFrom(target.add(direction.scale(Math.min(safe,this.cameraDistance))));
        this.camera.rotationQuaternion=null;
        if(column)this.camera.setTarget(target);else this.camera.rotation.set(this.viewPitch,this.viewYaw,0);
      }
      this.camera.fov+=( (p.swim==='underwater'?1.12:.85)-this.camera.fov)*(1-Math.exp(-dt*8));
      this.cameraSnap=false;
      // At a wall the camera may need to move inside the dog's silhouette.
      // Fade only the local actor until there is enough space to see it again.
      const clearAvatar=Vector3.Distance(this.camera.position,target);
      const opacity=this.preview?1:Math.max(0,Math.min(1,(clearAvatar-1.25)/1.2));
      this.actorOpacity+=(opacity-this.actorOpacity)*(1-Math.exp(-dt*18));
      if(Math.abs(this.actorOpacity-opacity)<.002)this.actorOpacity=opacity;
      for (const [r, actor] of Object.entries(this.dogs))
        for (const mesh of actor.root.getChildMeshes())
          mesh.visibility = 1;
      const live = new Set<string>();
      for (const e of state.enemies) {
        if (e.hp <= 0) {
          const old = this.creatures.get(e.id);
          if (old) {
            old.dispose();
            this.creatures.delete(e.id);
          }
          continue;
        }
        live.add(e.id);
        let c = this.creatures.get(e.id);
        if (!c) {
          c = createCreature(this.scene, this.world, e);
          this.creatures.set(e.id, c);
        }
        const bob =
          e.kind === "bat" || e.kind === "sprite"
            ? 1.2 + Math.sin(this.time * 2 + e.homeX) * 0.25
            : e.state === "chase"
              ? Math.abs(Math.sin(this.time * 6)) * 0.12
              : Math.sin(this.time * 1.5) * 0.03;
        c.root.position = Vector3.Lerp(
          c.root.position,
          new Vector3(e.x, (e.y??this.world.height(e.x, e.z)) + bob, e.z),
          Math.min(1, dt * 16),
        );
        c.body.rotation.y = e.yaw;
        c.update(dt, this.time, e);
        const reaction=animalReaction(state,'creature:'+e.id);if(reaction){c.body.rotation.x=Math.sin((state.time-reaction.start)*5)*(reaction.kind==='play'?.08:.035);c.body.rotation.y=reaction.yaw;}
        c.body.rotation.z = e.hit > 0 ? 0.12 * Math.sin(this.time * 60) : 0;
        c.body.scaling.y =
          1 + (e.state === "warning" ? Math.sin(this.time * 12) * 0.035 : 0);
        const marks = e.state === "warning" ? (e.telegraphs ?? []) : [];
        while (c.warning.length < marks.length) {
          const i = c.warning.length, radius = marks[i].r;
          // Create at the real radius: scaling a torus used to enlarge its line width too.
          const ring = MeshBuilder.CreateTorus("danger telegraph", {
            diameter: radius * 2, thickness: .035, tessellation: 64,
          }, this.scene);
          ring.metadata = { radius };
          ring.isPickable = false;
          ring.material = this.material("warning amber", "#e8a052", .25, .68);
          (ring.material as StandardMaterial).disableDepthWrite = true;
          c.warning.push(ring);
        }
        c.warning.forEach((ring, i) => {
          const mark = marks[i]; ring.setEnabled(!!mark);
          if (mark) {
            ring.position.set(mark.x, (e.y??this.world.height(mark.x, mark.z)) + .055, mark.z);
            ring.scaling.set(mark.r / ring.metadata.radius, 1, mark.r / ring.metadata.radius);
            const material = ring.material as StandardMaterial;
            const groundWave = mark.height === "ground";
            material.diffuseColor = hex(groundWave ? "#88cbd5" : "#e8a052");
            material.emissiveColor = material.diffuseColor.scale(.25);
            material.alpha = .52 + Math.max(0, 1 - mark.delay / 1.4) * .25;
          }
        });
        c.bar.setEnabled(!e.boss && e.hp < e.maxHp && Math.hypot(e.x-p.x,e.z-p.z) < 11);
        c.bar.scaling.x = Math.max(0.001, e.hp / e.maxHp);
        c.phase.rotation.y = this.time;
        c.phase.setEnabled(e.boss && (e.state === "warning" || e.exposed > 0));
        c.phase.scaling.setAll(e.exposed > 0 ? 1.6 + Math.sin(this.time * 8) * .1 : 1);
      }
      for (const [id, c] of this.creatures)
        if (!live.has(id)) {
          c.dispose();
          this.creatures.delete(id);
        }
      for (const id of state.flags) this.world.markFound(id);
    }
    // Conform the small contact decal to the same walkable surface as the feet.
    // It stays above the blended path and follows bridge curvature without floating.
    for (const [r, shadow] of this.contacts) {
      const dog = this.dogs[r].root;
      shadow.setEnabled(dog.isEnabled());
      if (!dog.isEnabled()) continue;
      const x = dog.position.x,
        z = dog.position.z;
      shadow.position.set(x, 0, z);
      const support=this.world.surfaceAt(x,z,dog.position.y+.28,0);
      const groundY = titleCast ? 0 : support?.y;
      // The old height() query sampled the village terrain underneath the villa.
      // Its decal could cut through a dog's head. Project onto this floor only.
      if(groundY===undefined){shadow.setEnabled(false);continue;}
      const elevation = Math.max(0, dog.position.y - groundY);
      (shadow.material as StandardMaterial).alpha = Math.max(.14, .7 - elevation * .25);
      const positions = shadow.getVerticesData(VertexBuffer.PositionKind)!;
      for (let j = 0; j < positions.length; j += 3)
        positions[j + 1] =
          (titleCast ? 0 : this.world.surfaceAt(x + positions[j], z + positions[j + 2],dog.position.y+.28,0)?.y??groundY) + 0.025;
      shadow.updateVerticesData(VertexBuffer.PositionKind, positions);
    }
    const peaceful=state&&(state.mode==='exploration'||state.mode==='coop-exploration')&&this.visibleRoles.every(r=>state.players[r].weaponDrawn===false);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      if(peaceful&&fx.type==='impact'){fx.root.dispose(false,true);this.effects.splice(i,1);continue;}
      fx.age += dt;
      if (fx.age > fx.duration) {
        fx.root.dispose(false, true);
        this.effects.splice(i, 1);
        continue;
      }
      const t = fx.age / fx.duration;
      fx.root.scaling.setAll(1 + t * (fx.type === "land" ? .7 : 1.1));
      fx.root.rotation.y += dt * 2;
      for (const mesh of fx.root.getChildMeshes()) {
        const m = mesh.material as StandardMaterial;
        if (m) m.alpha = 1 - t;
      }
      if (fx.type === "discover" || fx.type === "heal")
        fx.root.position.y += dt * 0.5;
    }
    const adaptiveActive=!!state&&!this.menu&&!this.preview&&!document.hidden&&!this.loadingRegion&&!this.preparation&&!this.world.studio?.loading;
    if(this.quality==='auto')this.autoQuality.observe(this.engine.getDeltaTime(),adaptiveActive);
    this.performanceTime += dt;
    if (this.performanceTime > 4) {
      const elapsed=this.performanceTime;
      this.performanceTime = 0;
      if(this.quality==='auto'){const result=this.autoQuality.sample(elapsed);if(result.changed)this.applyQuality();const gpuMs=this.gpuTelemetry.gpuFrameTimeCounter.current/1e6;const pixelBound=this.effectiveQuality==='low'&&gpuMs>23;const recovering=gpuMs>0&&this.engine.getFps()>52;if(this.autoResolution.sample(this.engine.getFps(),elapsed,adaptiveActive&&(pixelBound||recovering)))this.applyRenderSize();}
    }
    const focus=state?.players[this.role]??{x:0,y:0,z:0},indoors=this.world.interiorAt(focus);
    this.weather.update(state?.time ?? 0, this.regionId, indoors, focus, this.effectiveQuality, !!state && !this.menu && !this.preview && !this.characterPreview);
    const submerged=state&&state.players[this.role].swim!=='land'&&waterColumn(this.regionId,this.camera.position.x,this.camera.position.z,0);
    if(submerged&&this.camera.position.y<submerged.surface-.06){this.scene.fogColor.set(.12,.36,.40);this.scene.fogStart=this.regionId===UNDERSEA?12:2;this.scene.fogEnd=this.regionId===UNDERSEA?90:22;}
    this.swimWake.update(state&&!this.menu&&!this.preview?state:null,this.visibleRoles);
    this.world.updateVillaLighting(state?.time??0,focus,state?.homeLights!==false);
    this.clouds.update(state?.time ?? 0, this.effectiveQuality, !!state && !this.menu && !this.characterPreview && !indoors && this.regionId!==UNDERSEA);
    if(state?.pet?.regionId===this.regionId&&!this.pet.ready&&!this.pet.error)void this.pet.prepare().catch(()=>{});
    if(state?.golden?.regionId===this.regionId&&!this.golden.ready&&!this.golden.error)void this.golden.prepare().catch(()=>{});
    this.golden.update(dt,state?.golden as any,this.regionId,!!state&&!this.menu&&!this.preview&&!this.characterPreview&&!this.loadingRegion,this.world.shadows,this.effectiveQuality,this.world,state?animalReaction(state,'golden-retriever'):undefined,state?.time??0);
    this.pet.update(dt,state?.pet,this.regionId,!!state&&!this.menu&&!this.preview&&!this.characterPreview&&!this.loadingRegion,this.world.shadows,this.effectiveQuality,this.world,state?animalReaction(state,'hashiha'):undefined,state?.time??0);
    this.homePets.update(state??undefined,this.regionId,!!state&&!this.menu&&!this.preview&&!this.characterPreview&&!this.loadingRegion,this.world.shadows,this.effectiveQuality,this.world,focus);
    this.scene.render();
  }
  private createBroom(parent:TransformNode, role:string) {
    const root=new TransformNode('willow magic broom '+role,this.scene);root.parent=parent;root.setEnabled(false);
    const materials=new Map<string,PBRMaterial>();
    const mat=(tint:string,roughness=.75,metallic=0)=>{const k=tint+roughness+metallic;let m=materials.get(k);if(!m){m=new PBRMaterial('broom '+k,this.scene);m.albedoColor=hex(tint).toLinearSpace();m.roughness=roughness;m.metallic=metallic;m.environmentIntensity=.5;materials.set(k,m);}return m;};
    const tube=(name:string,points:Vector3[],radius:number,tint:string,taper=false)=>{const m=MeshBuilder.CreateTube(name,{path:Curve3.CreateCatmullRomSpline(points,7).getPoints(),radius,tessellation:10,cap:Mesh.CAP_ALL,radiusFunction:taper?(i,distance)=>radius*(1-.8*i/((points.length-1)*7)):undefined},this.scene);m.parent=root;m.material=mat(tint);m.receiveShadows=true;return m;};
    tube('polished crooked willow broom handle',[new Vector3(0,.60,-1.2),new Vector3(.025,.66,-.3),new Vector3(0,.75,.6),new Vector3(0,.97,1.08),new Vector3(0,1.05,1.28)],.075,'#ad8557');
    for(let i=0;i<30;i++){const a=i*2.399,r=.09+.035*(i%7),endR=.20+.045*(i%7);tube('swept willow broom bristle',[new Vector3(Math.cos(a)*r,.59+Math.sin(a)*r,-.86),new Vector3(Math.cos(a)*endR,.52+Math.sin(a)*endR*.6,-1.52),new Vector3(Math.cos(a)*endR*.92,.64+Math.sin(a)*endR*.55,-2.05-(i%4)*.05)],.038,['#b99861','#d3bb81','#98774e'][i%3],true);}
    for(const z of [-.94,-1.08]){const m=MeshBuilder.CreateTorus('broom brass twig binding',{diameter:.40,thickness:.065,tessellation:24},this.scene);m.parent=root;m.position.set(0,.59,z);m.rotation.x=Math.PI/2;m.material=mat('#d6b774',.36,.58);}
    const saddle=MeshBuilder.CreateSphere('small woven broom saddle',{diameter:1,segments:20},this.scene);saddle.parent=root;saddle.position.set(0,.72,-.1);saddle.scaling.set(.47,.10,.57);saddle.material=mat('#73856e');
    for(const side of [-1,1]){tube('broom foot loop',[new Vector3(side*.17,.7,0),new Vector3(side*.40,.40,.13),new Vector3(side*.29,.34,.37)],.037,'#7e694c');}
    const charm=MeshBuilder.CreatePolyhedron('broom guiding star lantern',{type:1,size:.11},this.scene);charm.parent=root;charm.position.set(0,.91,1.34);charm.material=mat('#f1d49a',.32,.18);(charm.material as PBRMaterial).emissiveColor=hex('#d9b878').toLinearSpace().scale(.25);
    root.getChildMeshes().forEach(m=>{m.isPickable=false;m.metadata={cameraObstacle:false};});return root;
  }
  private material(name: string, c: string, emissive = 0, alpha = 1) {
    const m = new StandardMaterial(name, this.scene);
    // StandardMaterial performs its own gamma-to-linear conversion immediately
    // before image processing. PBR albedo is linear; this legacy shader is not.
    m.diffuseColor = hex(c);
    m.emissiveColor = hex(c).scale(emissive);
    m.specularColor = hex("#333333");
    m.alpha = alpha;
    return m;
  }
  effect(event: GameEvent) {
    // Both the host and the guest receive these authoritative interaction events.
    // The World checks the actual NPC dialogue and deduplicates replayed events.
    this.world.respondToInteraction(event);
    if (
      ![
        "slash",
        "magic",
        "hit",
        "defeat",
        "burst",
        "heal",
        "impact",
        "discover",
        "dodge",
        "ping",
        "land",
      ].includes(event.type)
    )
      return;
    const root = new TransformNode("effect", this.scene);
    root.position.set(
      event.x,
      (event.y ?? this.world.height(event.x, event.z)) + (event.type === "land" ? .055 : .3),
      event.z,
    );
    const c =
      event.type === "heal"
        ? "#b0ebcd"
        : event.type === "impact"
          ? "#dd9f8f"
          : event.type === "magic"
            ? "#b2e2ed"
            : "#ffe0a1";
    if (
      event.type === "slash" ||
      event.type === "impact" ||
      event.type === "heal" ||
      event.type === "dodge" || event.type === "land"
    ) {
      const ring = MeshBuilder.CreateTorus(
        "light arc",
        {
          diameter: event.type === "impact" ? 2.2 : event.type === "land" ? .75 : 1.5,
          thickness: event.type === "land" ? .02 : .04,
          tessellation: 24,
        },
        this.scene,
      );
      ring.parent = root;
      ring.material = this.material("light arc material", c, 0.8, 0.85);
      if (event.type === "slash") root.rotation.y = event.value ?? 0;
    } else
      for (let i = 0; i < 8; i++) {
        const shard = MeshBuilder.CreatePolyhedron(
          "starlight particle",
          { type: 1, size: 0.06 },
          this.scene,
        );
        shard.parent = root;
        shard.position.set(
          Math.sin(i * 2.4) * 0.55,
          0.3 + i * 0.13,
          Math.cos(i * 2.4) * 0.55,
        );
        shard.material = this.material("particle glow", c, 0.8);
      }
    this.effects.push({
      root,
      age: 0,
      duration: event.type === "discover" ? 1.1 : 0.5,
      type: event.type,
    });
  }
  dispose() {
    this.resizeObserver.disconnect();window.removeEventListener('resize',this.resizeRendering);document.removeEventListener('fullscreenchange',this.resizeRendering);window.visualViewport?.removeEventListener('resize',this.resizeRendering);
    this.homePets.dispose();this.pet.dispose();this.golden.dispose();
    this.weather.dispose();this.swimWake.dispose();
    this.clouds.dispose();
    this.world.dispose();
    for(const w of this.roomCache.values())w.dispose();this.roomCache.clear();
    this.gpuTelemetry.dispose();
    disposeEnvironmentAssets(this.scene);
    this.scene.dispose();
    this.engine.dispose();
  }
}
