import animalAssets from './animal-assets.json';
import {AssetContainer,BoundingInfo,Scene,SceneLoader,TransformNode,Vector3,Quaternion,type AnimationGroup,type ShadowGenerator} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type {PetState} from '../shared/pet';
import {petAppearance,type PetAppearance} from './pet-appearance';
import type {MovementWorld} from './movement';
import {PET_RADIUS} from './pet-follow';
/** One GPU-skinned rig. Its resources never belong to a cached World. */
export class PetActor {
 private gait:'walk'|'trot'='walk';private locomotionSpeed=0;
 readonly root:TransformNode;private asset:AssetContainer|null=null;private pending:Promise<void>|null=null;
 private groups=new Map<string,AnimationGroup>();private weights=new Map<string,number>();private lastRegion='';private relocation=-1;private shadows:ShadowGenerator|null=null;private enabled=false;
 private wag:number|null=null;
 error='';
 constructor(private scene:Scene,private appearance:PetAppearance=petAppearance(),private id='hashiha',private radius=PET_RADIUS){this.root=new TransformNode('pet/'+id,scene);this.root.setEnabled(false);}
 prepare(){
  if(this.asset)return Promise.resolve();if(this.pending)return this.pending;
  this.pending=(async()=>{let asset:AssetContainer|undefined;try{
   asset=await SceneLoader.LoadAssetContainerAsync(this.appearance.rootUrl,this.appearance.file,this.scene,undefined,'.glb');
   if(asset.skeletons.length!==1||!['idle','walk','trot','sit','lie'].every(n=>asset!.animationGroups.some(g=>g.name===n)))throw Error('宠物模型或动作不完整');
   asset.addAllToScene();for(const n of asset.rootNodes)n.parent=this.root;
   for(const m of asset.meshes){m.isPickable=false;m.checkCollisions=false;m.receiveShadows=true;m.metadata={...m.metadata,...(this.id==='hashiha'?{pet:'hashiha'}:{ambientAnimal:this.id}),cameraObstacle:false};}
   if(this.id==='golden-retriever')for(const mesh of asset.meshes){if(!mesh.getTotalVertices())continue;const bounds=animalAssets['golden-retriever'].bounds,inv=mesh.computeWorldMatrix(true).clone().invert(),lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);for(let i=0;i<8;i++){const v=Vector3.TransformCoordinates(new Vector3(bounds[i&1?'max':'min'][0],bounds[i&2?'max':'min'][1],bounds[i&4?'max':'min'][2]),inv);lo.minimizeInPlace(v);hi.maximizeInPlace(v);}mesh.setBoundingInfo(new BoundingInfo(lo,hi));}
   for(const group of asset.animationGroups){group.stop();this.groups.set(group.name,group);this.weights.set(group.name,0);}
   const tail=asset.skeletons[0].bones.find(b=>/tail/i.test(b.name))?.getTransformNode();const observer=this.scene.onAfterAnimationsObservable.add(()=>{if(tail&&this.wag!==null&&tail.rotationQuaternion)tail.rotationQuaternion=tail.rotationQuaternion.multiply(Quaternion.RotationAxis(Vector3.Forward(),Math.sin(this.wag*12)*.30));});this.root.onDisposeObservable.add(()=>this.scene.onAfterAnimationsObservable.remove(observer));
   this.asset=asset;this.error='';
  }catch(e){asset?.dispose();this.error='哈士哈暂时没载入，靠近后可重试。';throw e;}finally{this.pending=null;}})();return this.pending;
 }
 update(dt:number,p:PetState|undefined,regionId:string,active:boolean,shadows:ShadowGenerator,quality:string,world:MovementWorld,reaction?:import('../shared/animal-care').AnimalReaction,time=0){
  this.wag=reaction?time-reaction.start:null;
  const visible=!!p&&p.regionId===regionId&&active;
  if(!visible||!this.asset){this.root.setEnabled(false);if(this.enabled){this.groups.forEach(g=>g.pause());this.enabled=false;}return;}
  if(!this.enabled){this.groups.forEach(g=>{if((this.weights.get(g.name)??0)>0)g.play(true);});this.enabled=true;}
  this.root.setEnabled(true);
  if(this.shadows!==shadows){if(this.shadows?.getShadowMap())this.asset.meshes.forEach(m=>this.shadows?.removeShadowCaster(m));this.shadows=shadows;}
  for(const m of this.asset.meshes){if(!m.getTotalVertices())continue;if(quality==='low')shadows.removeShadowCaster(m);else if(!shadows.getShadowMap()?.renderList?.includes(m))shadows.addShadowCaster(m);}
  const goal=new Vector3(p.x,p.y,p.z),teleport=this.lastRegion!==regionId||this.relocation!==p.relocations||Vector3.DistanceSquared(goal,this.root.position)>100;
  const before=this.root.position.clone();if(teleport){this.root.position.copyFrom(goal);this.root.rotation.y=p.yaw;}else this.root.position.copyFrom(Vector3.Lerp(this.root.position,goal,1-Math.exp(-dt*20)));
  // Interpolating feet height independently of x/z cuts into rising steps and
  // floats over descending ones. Project only onto the nearby legal support.
  const feet=this.root.position,support=world.surfaceAt(feet.x,feet.z,Math.max(feet.y,p.y)+.28,this.radius);
  if(support?.walkable&&(support.normalY??1)>=.65&&Math.abs(support.y-feet.y)<.5&&Math.abs(support.y-p.y)<.5)feet.y=support.y;
  this.lastRegion=regionId;this.relocation=p.relocations;
  let delta=p.yaw-this.root.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));this.root.rotation.y+=delta*(1-Math.exp(-dt*16));
  const measuredSpeed=teleport?0:Math.hypot(before.x-feet.x,before.z-feet.z)/Math.max(.001,dt);
  // The authority advances at 10 Hz. Filter its rendered velocity pulses so a
  // steady stride does not switch walk/trot or jerk its playback rate each tick.
  this.locomotionSpeed=teleport?0:this.locomotionSpeed+(measuredSpeed-this.locomotionSpeed)*(1-Math.exp(-dt*8));
  const speed=this.locomotionSpeed;
  this.gait=speed>(this.gait==='trot'?this.appearance.trotLeave:this.appearance.trotEnter)?'trot':'walk';
  const elapsed=reaction?time-reaction.start:0,remaining=reaction?reaction.until-time:0;
  const responseClip=reaction?(this.groups.has('settle')&&elapsed<1?'settle':this.groups.has('rise')&&remaining<1?'rise':'sit'):undefined;
  const clip=responseClip??(p.speed>.08&&speed>.1?this.gait:['walk','trot'].includes(p.pose)?'idle':p.pose);
  for(const[name,group]of this.groups){const target=name===clip?1:0,old=this.weights.get(name)??0,value=old+(target-old)*(1-Math.exp(-dt*16));
   if(value<.001&&!target){if(old>0)group.stop();this.weights.set(name,0);continue;}
   if(!group.isStarted){group.start(!['settle','rise'].includes(name));group.setWeightForAllAnimatables(0);}
   group.setWeightForAllAnimatables(value);group.speedRatio=name==='walk'?Math.max(.15,speed/this.appearance.walkSpeed):name==='trot'?Math.max(.15,speed/this.appearance.trotSpeed):1;this.weights.set(name,value);
  }
  // The delivered rig keeps its authored bones; only the tail's existing joint
  // receives a small additive wag after animation evaluation.

 }
 get ready(){return !!this.asset;}
 get metrics(){return {version:this.appearance.version,gait:this.gait,clips:[...this.groups].map(([name,g])=>({name,weight:this.weights.get(name)??0,rate:g.speedRatio,from:g.from,to:g.to,fps:g.targetedAnimations[0]?.animation.framePerSecond}))};}
 dispose(){this.asset?.dispose();this.asset=null;this.root.dispose();}
}
