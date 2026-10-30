import {buildTurtleLanding} from './turtle-landing';
import {villaLawn,buildLawnEdges} from './villa-lawn';
import {carvePondOpening} from './villa-pond-carve';
import {buildVillaPond} from './villa-pond';
import type {JourneyProgress} from '../shared/journeys';
import {previewTrees,TREE_PROTOTYPE_ROOT} from './tree-prototype';
import {transitionLight,setLightEnabled} from './light-transition';
import {buildHomeStillLife} from './villa-still-life';
import {buildHomeV13} from './villa-home-v13';
import {AssetContainer,Mesh,Matrix,Quaternion,Scene,SceneLoader,TransformNode,Vector3,Ray,PointLight,SpotLight,InstancedMesh,Color3,ShadowGenerator,MeshBuilder,type AbstractMesh} from '@babylonjs/core';
import catalog from '../source-assets/environment/villa-rc3/catalog.json';
import layout from '../source-assets/environment/villa-rc3/layout.json';
import lighting from '../source-assets/environment/villa-rc3/lighting.json';
import physics from '../source-assets/environment/villa-rc3/physics.json';
import {weatherAt} from './world-weather';
import type {World} from './world';
import {furnishVilla} from './villa-interiors';
import {buildTreeTransition} from './villa-tree-transition';
import {villaFinishes} from './villa-materials';
import {buildHomeGarden} from './villa-garden';
import {isRetiredVillaPart,repairVillaSurfaces} from './villa-repairs';
import {HOME_FOREST,WALL_LIGHTS,homePathDistance} from './villa-site';
const cache=new WeakMap<Scene,Map<string,AssetContainer>>();
const pending=new WeakMap<Scene,Promise<void>>();
export const villaAssetsReady=(scene:Scene)=>cache.get(scene)?.size===catalog.assets.length;
export function prepareVillaAssets(scene:Scene){
 if(villaAssetsReady(scene))return Promise.resolve();
 const prior=pending.get(scene);if(prior)return prior;
 const task=(async()=>{const staged=new Map<string,AssetContainer>();try{
  for(const asset of catalog.assets){const prototype=previewTrees&&['reuse-oak','reuse-birch'].includes(asset.id);const c=await SceneLoader.LoadAssetContainerAsync(prototype?TREE_PROTOTYPE_ROOT:['villa-interiors','villa-treehouse'].includes(asset.id)?'/assets/environment/v14/':asset.id==='villa-f2'?'/assets/environment/v13/':asset.id==='villa-f1'?'/assets/environment/v12/':'/assets/environment/villa-rc3/',prototype?asset.id.slice(6)+'.glb':asset.file,scene,undefined,'.glb');staged.set(asset.id,c);}
  cache.set(scene,staged);
 }catch(error){for(const c of staged.values())c.dispose();throw error;}finally{pending.delete(scene);}})();pending.set(scene,task);return task;
}
export function buildVilla(world:World){
 const scene=world.scene,containers=cache.get(scene);if(!containers)throw Error('家园素材尚未载入');
 const finishes=villaFinishes(scene,world.surfaces),lawn=villaLawn(scene);
 const placements:TransformNode[]=[],entries:ReturnType<AssetContainer['instantiateModelsToScene']>[]=[],meshes:AbstractMesh[]=[],cuts=new Set<AbstractMesh>();
 const batches=new Map<string,{source:Mesh;asset:string;matrices:number[];backdrop:boolean;role:string;cast:boolean}>();
 const instantiate=(id:string,name:string,position:number[],scale:number[],rotation:number,reuse:boolean,backdrop=false)=>{
  if(reuse){
   const placement=Matrix.Compose(Vector3.FromArray(scale),Quaternion.RotationAxis(Vector3.Up(),rotation),Vector3.FromArray(position)),mirror=Matrix.Scaling(-1,1,1);
   for(const source of containers.get(id)!.meshes as Mesh[]){if(!source.getTotalVertices())continue;
    const role=source.metadata?.gltf?.extras?.role??source.name.split('__')[1],key=source.uniqueId+':'+Math.floor(position[0]/32)+':'+Math.floor(position[2]/32);
    let g=batches.get(key);if(!g){g={source,asset:id,matrices:[],backdrop,role,cast:!backdrop&&/oak|birch|bench/.test(id)};batches.set(key,g);}
    g.matrices.push(...source.computeWorldMatrix(true).multiply(placement).multiply(mirror).m);
   }return;
  }
  const root=new TransformNode(name,scene);root.parent=world.root;root.position=Vector3.FromArray(position);root.scaling=Vector3.FromArray(scale);root.rotation.y=rotation;placements.push(root);
  const instance=containers.get(id)!.instantiateModelsToScene(n=>n,false,{doNotInstantiate:!reuse});entries.push(instance);
  for(const n of instance.rootNodes)n.parent=root;
  for(const m of root.getChildMeshes())if(m.getTotalVertices()){
   const extras=m.metadata?.gltf?.extras??m.metadata??{},parts=m.name.split('__'),role=extras.role??parts[1];
   // The new perimeter replaces these three old low walls, including its side gate.
   if(isRetiredVillaPart(m.name,extras)){m.setEnabled(false);m.isPickable=false;continue;}
   const architectural=!reuse&&['wall','column','frame','slab','roof','stairs','trunk','glass','railing','furniture'].includes(role);
   m.metadata={...m.metadata,villa:true,villaRole:role,villaBackdrop:backdrop,cameraObstacle:architectural,villaCutaway:!reuse&&['wall','frame','slab','roof','trunk','stairs'].includes(role)};
   m.isPickable=architectural;m.receiveShadows=!['glass','water','emissive'].includes(role);meshes.push(m);
   if(!backdrop&&m.receiveShadows&&(!reuse||/oak|birch|bench/.test(id)))world.shadows.addShadowCaster(m);
   if(m.material&&'maxSimultaneousLights'in m.material)(m.material as any).maxSimultaneousLights=4;
   if(!reuse){finishes.apply(m);if(m.material?.name==='RC3 meadow grass'){lawn.apply(m);carvePondOpening(m);}}
  }
 };
 for(const id of layout.buildingModules)instantiate(id,id,[0,0,0],[1,1,1],0,false);
 for(const s of layout.instances)instantiate(s.asset,s.id,s.position,s.scale,s.rotation,true);
 // Outside-only strips continue the authored lawn without filling its excavations.
 const grass=containers.get('villa-courtyard')!.materials.find(m=>m.name==='RC3 meadow grass')!;
 for(const [x,z,w,h]of [[-104,5,128,342],[110,5,128,342],[3,-102,86,128],[3,112,86,128]]){
  const ground=MeshBuilder.CreateGround('villa-forest-outskirts',{width:w,height:h,subdivisions:24},scene);ground.parent=world.root;ground.position.set(x,.26,z);ground.material=grass;ground.receiveShadows=true;ground.isPickable=false;ground.metadata={cameraObstacle:false};lawn.apply(ground);
 }
 for(const [i,t]of HOME_FOREST.entries()){
  instantiate(t.asset,t.id,[t.x,.26,t.z],[t.scale,t.scale,t.scale],t.yaw,true,true);
  for(let k=0;k<3;k++){const x=t.x+Math.cos(i+k*2.1)*2,z=t.z+Math.sin(i+k*2.1)*2;if(homePathDistance(x,z)<2)continue;const s=.7+(i%4)*.13;instantiate(k===0?'reuse-shrub':k===1?'reuse-fern':'reuse-groundcover',t.id+'-under-'+k,[x,.26,z],[s,s,s],i+k,true,true);}
 }
 for(const [id,g]of batches){const m=g.source.clone('home shared cell '+id,world.root,true)!;
  m.position.setAll(0);m.rotation.setAll(0);m.rotationQuaternion=null;m.scaling.set(-1,1,1);m.isPickable=false;m.setEnabled(true);m.receiveShadows=true;
  m.metadata={villa:true,villaSourceAsset:g.asset,villaBackdrop:g.backdrop,villaRole:g.role,cameraObstacle:false,instances:g.matrices.length/16};
  m.makeGeometryUnique();m.thinInstanceSetBuffer('matrix',new Float32Array(g.matrices),16,true);m.thinInstanceRefreshBoundingInfo(true);m.freezeWorldMatrix();meshes.push(m);
  if(g.cast)world.shadows.addShadowCaster(m);if(m.material&&'maxSimultaneousLights'in m.material)(m.material as any).maxSimultaneousLights=4;
 }
 batches.clear();
 const priorTrunk=meshes.find(m=>m.name==='site__trunk__courtyard oak__bark warm umber');
 if(priorTrunk){priorTrunk.setEnabled(false);priorTrunk.isPickable=false;world.shadows.removeShadowCaster(priorTrunk);const trunk=buildTreeTransition(scene,world.root,priorTrunk.material!);meshes.push(trunk);world.shadows.addShadowCaster(trunk);}
 const repairs=repairVillaSurfaces(world,meshes);
 const furnishing=furnishVilla(world,meshes,finishes.detail);meshes.push(...furnishing.meshes);
 const garden=buildHomeGarden(world,finishes);buildLawnEdges(world);
 const pond=buildVillaPond(world);meshes.push(...pond.meshes);meshes.push(buildTurtleLanding(world));
 const additions=buildHomeV13(world);meshes.push(...additions.meshes);
 const stillLife=buildHomeStillLife(world,meshes);meshes.push(...stillLife.meshes);
 for(const node of world.root.getDescendants())if(node instanceof TransformNode){node.computeWorldMatrix(true);node.freezeWorldMatrix();}
 const emissives=[...new Set(meshes.map(m=>m.material))].filter((m):m is any=>!!m&&'emissiveColor'in m).map(m=>({m,color:m.emissiveColor.clone()}));
 let lightsEnabled:boolean|undefined;
 const key=new SpotLight('villa-room-key',Vector3.Zero(),Vector3.Down(),1.6,1.2,scene);key.parent=world.root;key.diffuse=Color3.FromHexString('#fff0db');
 const pools=[0,1].map(i=>{const l=new PointLight('villa-light-pool-'+i,Vector3.Zero(),scene);l.parent=world.root;l.diffuse=Color3.FromHexString('#ffdbaf');l.radius=.6;return l;});
 const keyFade=transitionLight(key),poolFades=pools.map(transitionLight);let lastLightTime=0;
 key.excludedMeshes=additions.artPlanes;pools.forEach(l=>l.excludedMeshes=additions.artPlanes);
 const shadow=new ShadowGenerator(1024,key);shadow.usePercentageCloserFiltering=true;shadow.bias=.0007;shadow.normalBias=.03;shadow.setDarkness(.16);
 for(const m of meshes)if(m.receiveShadows&&!m.metadata.noAccentShadow&&!m.metadata.villaBackdrop&&!['plant','foliage'].includes(m.metadata.villaRole))shadow.addShadowCaster(m);
 for(const m of scene.meshes)if(!m.metadata?.villa&&!m.metadata?.homePond&&m.name!=='contact-shadow'&&m.getTotalVertices()&&m.isEnabled())shadow.addShadowCaster(m);
 return {
  updateJourneys(progress:JourneyProgress,time:number){pond.update(progress,time);},
  async prepareVisibleEffects(){
   // Prime the two existing light-type combinations while input is still locked.
   // Material compilation otherwise first occurs on crossing the living-room door.
   const saved=[key,...pools].map(l=>({l,enabled:l.isEnabled(),intensity:l.intensity}));
   const unique=new Map<string,AbstractMesh>();
   const instances=(m:AbstractMesh)=>m instanceof InstancedMesh||m instanceof Mesh&&(m.hasThinInstances||m.instances.length>0);
   for(const m of [...world.root.getChildMeshes(),...scene.meshes.filter(m=>!m.metadata?.villa&&(m.skeleton||/^(gold|white)-\d+-/.test(m.name)))])if(m.material&&m.getTotalVertices()){
    const source=m instanceof InstancedMesh?m.sourceMesh:m;
    unique.set(m.material.uniqueId+':'+!!m.skeleton+':'+instances(m)+':'+m.receiveShadows+':' +(source instanceof Mesh?source.getVerticesDataKinds().join(','):''),m);
   }
   try{for(const inside of [false,true])for(const count of [0,1,2]){key.setEnabled(inside);pools[0].setEnabled(count>0);pools[1].setEnabled(count>1);key.intensity=pools[0].intensity=pools[1].intensity=.1;let batch=0;for(const m of unique.values()){await m.material!.forceCompilationAsync(m,{useInstances:instances(m)});if(++batch%8===0)await new Promise<void>(r=>requestAnimationFrame(()=>r()));}}await shadow.forceCompilationAsync();}
   finally{for(const x of saved){x.l.intensity=x.intensity;x.l.setEnabled(x.enabled);}}
  },
  setQuality(value:string){finishes.setQuality(value);furnishing.setQuality(value);const size=value==='low'?512:1024;if(shadow.mapSize!==size)shadow.mapSize=size;shadow.usePercentageCloserFiltering=value!=='low';shadow.usePoissonSampling=value==='low';},
  cutaway(target:Vector3,desired:Vector3){
   // Solid walls and current-floor slabs stay visible and remain camera barriers.
   // The camera sweep shortens the boom inside the actual room instead of cutting
   // a whole batched floor/room away on every mouse movement.
  },
  lights(time:number,p:{x:number;y:number;z:number},enabled=true){
   if(enabled!==lightsEnabled){lightsEnabled=enabled;garden.setLights(enabled);pond.setLights(enabled);additions.setLights(enabled);for(const e of emissives)e.m.emissiveColor.copyFrom(enabled?e.color:Color3.Black());}
   if(!enabled){setLightEnabled(key,false);pools.forEach(l=>setLightEnabled(l,false));return;}
   const dt=lastLightTime?Math.min(.1,Math.max(.001,time-lastLightTime)):1/60;lastLightTime=time;additions.update(p,dt);
   const day=weatherAt(time,'player-home-villa',false).daylight;
   const room=lighting.rooms.find(r=>p.x>=r.boundsXZ[0]&&p.x<=r.boundsXZ[1]&&p.z>=r.boundsXZ[2]&&p.z<=r.boundsXZ[3]&&p.y>=r.floorY-.1&&p.y<r.floorY+(r.id==='living'?4.7:4.3));
   keyFade(room?.id??'',room?room.key.dayPower*.75+room.key.nightPower*(.2+.35*(1-day)):0,dt,()=>{if(room){const k=room.key;key.position.copyFromFloats(...k.position as [number,number,number]);key.direction=Vector3.FromArray(k.target).subtract(key.position).normalize();key.angle=k.angle;key.range=k.range;}});
   if(room){poolFades[0](room.id,room.fill.dayPower*.7+room.fill.nightPower*.35,dt,()=>{pools[0].position=Vector3.FromArray(room.fill.position);pools[0].range=room.fill.range;});poolFades[1]('',0,dt,()=>{});
   }else{const sources=[...pond.lights,...physics.nightSources.map(s=>s.position[0]===22&&s.position[2]===15?{...s,position:[20.9,s.position[1],13.3]}:s),...WALL_LIGHTS.map(l=>({position:[l.x+l.dx*.4,l.y,l.z+l.dz*.4],range:7,power:8}))];
    const chosen=sources.map(s=>({s,d:Math.hypot(s.position[0]-p.x,s.position[1]-p.y,s.position[2]-p.z)})).filter(s=>s.d<20).sort((a,b)=>a.d-b.d).slice(0,2);
    pools.forEach((l,i)=>{const s=chosen[i]?.s;poolFades[i](s?s.position.join(','):'',s?s.power*(.3+.7*(1-day)):0,dt,()=>{if(s){l.position=Vector3.FromArray(s.position);l.range=s.range;}});});
   }
  },
  dispose(){shadow.dispose();key.dispose();pools.forEach(l=>l.dispose());garden.dispose();pond.dispose();furnishing.dispose();repairs.dispose();stillLife.dispose();additions.dispose();finishes.dispose();lawn.dispose();for(const p of placements)p.parent=null;entries.forEach(e=>e.dispose());placements.forEach(p=>p.dispose());for(const c of containers.values())c.dispose();cache.delete(scene);},
 };
}
