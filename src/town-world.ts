import {AssetContainer,Color3,Material,PBRMaterial,PointLight,SceneLoader,TransformNode,Vector3,type AbstractMesh,type BaseTexture} from '@babylonjs/core';
import type {World} from './world';
import type {Snapshot} from './simulation';
import {studioAssetBase,CITY} from './studio-regions';
import {studioData,releaseStudioData} from './studio-physics';
import {weatherAt} from './world-weather';
import {layerCitySkyline} from './city-skyline-layer';
import {CityRoadSurface} from './city-road-surface';
const extras=(m:any)=>m.metadata?.gltf?.extras??m.metadata?.extras??{};
type Placement={root:TransformNode;entry:ReturnType<AssetContainer['instantiateModelsToScene']>;asset:string};
type Pack={container:AssetContainer;materials:Set<Material>};
/** Pool is region-local. Containers lease canonical materials; materials lease
 * shared URI textures. No globally mutable materials or unbounded town cache. */
export class TownWorld {
 readonly data:NonNullable<ReturnType<typeof studioData>>;
 private packs=new Map<string,Pack>();private placements=new Map<string,Placement>();
 private materials=new Map<string,{value:Material;refs:number}>();private textures=new Map<string,{value:BaseTexture;refs:number}>();
 private pending:Promise<void>|null=null;private disposed=false;private signature='';private fill:PointLight;private shadowMeshes=new Set<AbstractMesh>();private shadowVisible=new Set<AbstractMesh>();private shadowFocus:{x:number;z:number}|null=null;private shadowDirty=true;
 skylineAdaptation:any[]=[];zone='';error='';calibration:any[]=[];timings:{zone:string;ms:number;assets:number;instances:number}[]=[];
 private roadSurface:CityRoadSurface|undefined;
 get roadMetrics(){return this.roadSurface?.metrics;}
 private get city(){return this.w.regionId===CITY;}
 constructor(private w:World){this.data=studioData(w.regionId)!;this.fill=new PointLight('town inn pooled fill',new Vector3(-16,4.4,14),w.scene);this.fill.parent=w.root;this.fill.diffuse=new Color3(1,.76,.4);this.fill.range=13;this.fill.intensity=0;if(this.city)this.fill.position.set(-24,4.2,-19);}
 get loading(){return!!this.pending;}
 get ready(){return this.zone?['street',...Object.entries(this.data.scene.layout.optionalGroups??{}).filter(([,ids])=>(ids as string[]).every(id=>this.packs.has(id))).map(([id])=>id),...(this.packs.has('town-inn-interior')?['town-inn']:[])]:[];}
 zoneAt(p:{x:number;y:number;z:number}){if(this.city){if(p.x>-34&&p.x<-10&&p.z>-35&&p.z<-3)return p.y>12?'roof':p.y<7?'cafe':'street';return p.z>65||this.zone==='north'&&p.z>55?'north':'street';}return p.x<-8&&p.x>-26&&p.z>4&&p.z<24&&p.y<6?'town-inn':'street';}
 readyAt(p:{x:number;y:number;z:number}){if(this.city)return!!this.zone&&[...(this.data.scene.layout.optionalGroups[this.zoneAt(p)]??[])].every(id=>this.packs.has(id));return!!this.zone&&(this.zoneAt(p)!=='town-inn'||this.packs.has('town-inn-interior'));}
 private selected(p:{x:number;y:number;z:number}){const l=this.data.scene.layout,zone=this.zoneAt(p),needed=new Set<string>(l.loading[zone]??l.loading.street);for(const house of l.houseLODs??[]){needed.delete(house.near);const d=Math.hypot(p.x-house.position[0],p.z-house.position[2]);needed.add(d<27||zone==='town-inn'&&house.near==='town-inn-shell'?house.near:house.far);}for(const id of this.city?l.instances.map((i:any)=>i.prototype):['vehicle-coach','vehicle-horse','npc-guard','npc-knight'])needed.add(id);return{zone,needed,signature:zone+'|'+[...needed].sort().join(',')};}
 needs(p:{x:number;y:number;z:number}){return this.selected(p).signature!==this.signature;}
 private textureKey(t:BaseTexture){return (t as any).url??t.name;}
 private async load(id:string){const a=this.data.scene.catalog.assets.find((a:any)=>a.id===id);if(!a)throw Error('小镇模块缺失 '+id);const file=a.file,cut=file.lastIndexOf('/');const c=await SceneLoader.LoadAssetContainerAsync(studioAssetBase(this.w.regionId)+file.slice(0,cut+1),file.slice(cut+1),this.w.scene,undefined,'.glb');
 if(this.disposed){c.dispose();throw Error('已离开小镇');}for(const g of c.animationGroups)g.stop();const leased=new Set<Material>(),oldMaterials=[...c.materials],oldTextures=[...c.textures];
 for(const m of oldMaterials){const key=m.name;let owned=this.materials.get(key);if(!owned){(m as any).maxSimultaneousLights=4;(m as any).environmentIntensity=.18;
  for(const slot of ['albedoTexture','bumpTexture','metallicTexture','ambientTexture','emissiveTexture','opacityTexture']){const t=(m as any)[slot] as BaseTexture|undefined;if(!t)continue;const k=this.textureKey(t);let shared=this.textures.get(k);if(!shared)this.textures.set(k,shared={value:t,refs:0});(m as any)[slot]=shared.value;}
  for(const t of new Set(m.getActiveTextures()))this.textures.get(this.textureKey(t))!.refs++;
  this.materials.set(key,owned={value:m,refs:0});if(!this.w.scene.materials.includes(m))this.w.scene.addMaterial(m);
 }if(!leased.has(owned.value))owned.refs++;leased.add(owned.value);for(const mesh of c.meshes)if(mesh.material===m)mesh.material=owned.value;}
 c.materials=[];c.textures=[];for(const m of oldMaterials)if(this.materials.get(m.name)?.value!==m)m.dispose(false,false);for(const t of oldTextures)if(this.textures.get(this.textureKey(t))?.value!==t)t.dispose();for(const shared of this.textures.values())if(!this.w.scene.textures.includes(shared.value))this.w.scene.addTexture(shared.value);
 return{container:c,materials:leased};}
 private release(id:string){const pack=this.packs.get(id);if(!pack)return;pack.container.dispose();for(const m of pack.materials){const owned=this.materials.get(m.name)!;if(--owned.refs===0){for(const t of new Set(m.getActiveTextures())){const k=this.textureKey(t),shared=this.textures.get(k)!;if(--shared.refs===0){shared.value.dispose();this.textures.delete(k);}}m.dispose(false,false);this.materials.delete(m.name);}}this.packs.delete(id);}
 private remove(name:string){const p=this.placements.get(name);if(!p)return;for(const m of p.root.getChildMeshes()){this.w.shadows.removeShadowCaster(m);this.shadowMeshes.delete(m);this.shadowVisible.delete(m);}this.shadowDirty=true;for(const g of p.entry.animationGroups)g.stop();p.entry.dispose();p.root.dispose();this.placements.delete(name);}
 private place(name:string,asset:string,position:number[],scale=[1,1,1],yaw=0,instance=false){if(this.placements.has(name))return;const c=this.packs.get(asset)!.container,root=new TransformNode((this.city?'city placement ':'town placement ')+name,this.w.scene);root.parent=this.w.root;root.position=Vector3.FromArray(position);root.scaling=Vector3.FromArray(scale);root.rotation.y=yaw;const entry=c.instantiateModelsToScene(n=>name+'::'+n,false,{doNotInstantiate:!instance});for(const n of entry.rootNodes)n.parent=root;if(this.city&&asset==='city-skyline'){this.skylineAdaptation=layerCitySkyline(root.getChildMeshes());for(const n of root.getChildMeshes()){n.applyFog=true;n.metadata={...n.metadata};}}
 for(const m of root.getChildMeshes())if(this.city&&['asphalt','asphalt-repair'].includes(m.material?.name??'')&&m.material instanceof PBRMaterial){this.roadSurface??=new CityRoadSurface(this.w.scene,m.material,'all');this.roadSurface.apply(m,asset);}
 const backdrop=name.startsWith('city-layer-cafe-');
 const dynamic=asset.startsWith('npc-')||asset.startsWith('vehicle-')||entry.animationGroups.length>0;
 for(const m of root.getChildMeshes()){if(!m.getTotalVertices())continue;const e=extras(m);m.metadata={...m.metadata,studio:true,studioRole:e.role,studioZone:e.zoneId,studioBackdrop:backdrop,semanticId:e.semanticId,cameraObstacle:!backdrop&&asset!=='city-skyline'&&(!!e.cameraObstacle||asset.startsWith('vehicle-')||asset==='prop-taxi'),sourceExtras:e};m.isPickable=!backdrop&&asset!=='city-skyline'&&(!!e.cameraObstacle||asset.startsWith('vehicle-')||asset==='prop-taxi');m.receiveShadows=!['water','state','emissive'].includes(e.role);if(!dynamic){m.computeWorldMatrix(true);m.freezeWorldMatrix();}const material=m.material?.name??'',name=m.name,driven=asset==='vehicle-coach'?(name.includes('wheel')?material==='oak':['oak-light','green-cloth'].includes(material)):asset==='vehicle-horse'?material==='horse':asset.startsWith('npc-')?(name.includes('torso')&&['red-cloth','steel'].includes(material)||name.includes('head')&&['black','skin','steel'].includes(material)||name.includes('leg')&&['black','hair'].includes(material)):false;if(!backdrop&&(driven||['q-ochrecloth','q-sagecloth'].includes(material)||e.cameraObstacle&&!e.backdrop&&!['ground','floor'].includes(e.role))){this.shadowMeshes.add(m);this.shadowDirty=true;}}
 this.placements.set(name,{root,entry,asset});}
 async init(p:{x:number;y:number;z:number}){const c=(await this.load('calibration')).container;try{for(const[id,expected]of Object.entries(this.data.scene.calibration.points) as [string,number[]][]){const m=c.meshes.find(m=>extras(m).semanticId===id);if(!m)throw Error('小镇坐标校准点缺失');m.computeWorldMatrix(true);const actual=m.getBoundingInfo().boundingBox.centerWorld,error=Vector3.Distance(actual,Vector3.FromArray(expected));this.calibration.push({id,expected,actual:actual.asArray(),error});if(error>.001)throw Error('小镇坐标转换错误');}}finally{c.dispose();for(const owned of this.materials.values())owned.value.dispose(false,false);for(const owned of this.textures.values())owned.value.dispose();this.materials.clear();this.textures.clear();}await this.ensure(p);this.shadowAt(p);}
 ensure(p:{x:number;y:number;z:number}):Promise<void>{if(this.pending)return this.pending;const selection=this.selected(p);if(selection.signature===this.signature)return Promise.resolve();this.pending=this.switchPack(selection).finally(()=>this.pending=null);return this.pending;}
 private async switchPack({zone,needed,signature}:{zone:string;needed:Set<string>;signature:string}){const started=performance.now();this.error='';try{
  if(this.city){for(const[name,p]of this.placements)if(!needed.has(p.asset))this.remove(name);for(const[id]of this.packs)if(!needed.has(id))this.release(id);}
  // Only complementary house representations and the optional inn are retired;
  // common street prototypes stay leased. At most 27 live models + 1 incoming.
  for(const[name,p]of this.placements)if(!needed.has(p.asset)&&p.asset.startsWith('town-inn-')&&!p.asset.endsWith('shell')&&!p.asset.endsWith('lod'))this.remove(name);for(const[id]of this.packs)if(!needed.has(id)&&id.startsWith('town-inn-')&&!id.endsWith('shell')&&!id.endsWith('lod'))this.release(id);
  for(const id of needed)if(!this.packs.has(id)){const pack=await this.load(id);if(this.disposed)throw Error('已离开小镇');this.packs.set(id,pack);const module=this.data.scene.layout.modules.find((m:any)=>m.id===id);if(module)this.place(id,id,module.position,module.scale,module.rotationY);else if(this.city&&id.startsWith('city-'))this.place(id,id,[0,0,0]);const counterpart=this.data.scene.layout.houseLODs?.find((h:any)=>h.near===id||h.far===id);if(counterpart){const old=counterpart.near===id?counterpart.far:counterpart.near;this.remove(old);this.release(old);this.w.refreshCameraIndex();}await new Promise<void>(r=>requestAnimationFrame(()=>r()));}
  const l=this.data.scene.layout;for(const id of needed){const module=l.modules.find((m:any)=>m.id===id);if(module)this.place(id,id,module.position,module.scale,module.rotationY);else if(this.city&&id.startsWith('city-'))this.place(id,id,[0,0,0]);}
  for(const i of l.instances)this.place(i.id,i.prototype,i.position,i.scale,i.rotationY,true);
  // Existing exterior prototypes add detailed low street walls beyond z=193.
  // They remain visual-only beyond the authored playable boundary, with shared leases.
  if(this.city){this.place('city-layer-cafe-west','city-cafe',[-4.7,0,183.2],[.7,.7,.7],Math.PI/2,true);this.place('city-layer-cafe-east','city-cafe',[31.3,0,184.2],[.7,.7,.7],Math.PI/2,true);}
  this.roadSurface?.placeServices(this.w.root,(x,z)=>this.data.world.surfaceAt(x,z,10,0)?.y??0);
  const a=this.data.scene['animation-maps'];for(const n of a.npcPlacements??[])this.place(n.id,n.prototype,n.position,[1,1,1],n.rotationY,true);
  if(!this.city){this.place('town-coach-01','vehicle-coach',a.vehicle.stationAnchors.end);this.place('town-coach-01-horse','vehicle-horse',[9,.64,55.1]);}
  if(this.packs.size>29)throw Error('小镇模型缓存超过契约');this.zone=zone;this.signature=signature;this.w.refreshCameraIndex();this.timings.push({zone,ms:performance.now()-started,assets:this.packs.size,instances:this.placements.size});if(this.timings.length>20)this.timings.shift();
 }catch(e){this.error=String(e);throw e;}}
 private shadowAt(p:{x:number;z:number}){if(!this.shadowDirty&&this.shadowFocus&&Math.hypot(p.x-this.shadowFocus.x,p.z-this.shadowFocus.z)<.8)return;this.shadowFocus={x:p.x,z:p.z};this.shadowDirty=false;for(const m of this.shadowMeshes){const at=m.getBoundingInfo().boundingBox.centerWorld,visible=m.isEnabled()&&Math.hypot(at.x-p.x,at.z-p.z)<23;if(visible&&!this.shadowVisible.has(m)){this.w.shadows.addShadowCaster(m,false);this.shadowVisible.add(m);}else if(!visible&&this.shadowVisible.has(m)){this.w.shadows.removeShadowCaster(m);this.shadowVisible.delete(m);}}}
 update(s:Snapshot){this.shadowAt(s.players[(this.w.scene.metadata?.fieldViewRole??'gold') as 'gold'|'white']);}
 lights(time:number,p:{x:number;y:number;z:number}){this.fill.intensity=this.data.interior(p.x,p.y,p.z)?30:0;if(this.city){const n=1-weatherAt(time,this.w.regionId,false).daylight;for(const owned of this.materials.values())if(owned.value.name==='skyline-shared-facade')(owned.value as any).emissiveColor.set(n,n,n);}}
 setActive(active:boolean){this.shadowDirty=true;this.fill.setEnabled(active);if(active&&this.shadowFocus)this.shadowAt(this.shadowFocus);for(const p of this.placements.values())for(const g of p.entry.animationGroups)g.stop();}
 dispose(){this.disposed=true;this.setActive(false);for(const name of [...this.placements.keys()])this.remove(name);this.roadSurface?.dispose();this.roadSurface=undefined;for(const id of [...this.packs.keys()])this.release(id);this.shadowMeshes.clear();this.shadowVisible.clear();this.fill.dispose();releaseStudioData(this.w.regionId);}
}
