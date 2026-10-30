import {acquireAnimalRig,type AnimalRig} from './animal-rig';
import{AssetContainer,BoundingInfo,SceneLoader,Quaternion,TransformNode,Vector3,type AnimationGroup}from'@babylonjs/core';import type{World}from'./world';import assets from'./animal-assets.json';
import {ANIMAL_SITES,animalSample,type AnimalSite,type Spec,type AnimalId} from './animal-schedule';
import {animalClock,animalReaction} from './animal-interactions';
import type {Snapshot} from './simulation';
export {ANIMAL_SITES,animalSample} from './animal-schedule';
type Loaded={site:AnimalSite;root:TransformNode;asset:AnimalRig;groups:Map<string,AnimationGroup>;pose:string;visible:boolean;shadow:boolean};
export class AmbientAnimals{
 private loaded:Loaded[]=[];private disposed=false;error='';
 constructor(private w:World){}
 async prepare(){
  try{for(const site of ANIMAL_SITES.filter(a=>a.regionId===this.w.regionId&&a.id!=='golden-retriever')){
   let asset:AnimalRig|undefined;
   try{asset=await acquireAnimalRig(this.w.scene,site.id as AnimalId,site.id);if(this.disposed)throw Error('animal region released');const root=asset.root;root.parent=this.w.root;root.setEnabled(false);const groups=asset.groups;
    this.loaded.push({site,root,asset,groups,pose:'idle',visible:false,shadow:false});asset=undefined;
   }catch(e){asset?.dispose();throw e;}
  }}catch(e){this.error=String(e);this.dispose();throw e;}
 }
 update(time:number,focus:{x:number;y:number;z:number},quality:string,state?:Snapshot){
  for(const a of this.loaded){const {site,root,groups}=a,spec=assets[site.id as AnimalId] as Spec,reaction=state&&animalReaction(state,site.id),p=animalSample(site,state?animalClock(state,site.id):time);
   if(reaction){const elapsed=Math.max(0,time-reaction.start),original=animalSample(site,animalClock(state!,site.id)-elapsed);p.x=reaction.x;p.z=reaction.z;p.yaw=original.yaw+Math.atan2(Math.sin(reaction.yaw-original.yaw),Math.cos(reaction.yaw-original.yaw))*Math.min(1,elapsed/.4)*Math.min(1,(reaction.until-time)/.5);p.previous=original.clip;p.previousSeconds=original.seconds;p.blend=Math.min(1,elapsed/.25);p.speed=0;
    const remaining=reaction.until-time;p.clip=site.water?'swim':elapsed<1?'settle':remaining<1?'rise':'sit';p.seconds=p.clip==='settle'?elapsed:p.clip==='rise'?1-remaining:elapsed;
    if(site.water){p.blend=.8;p.previous='idle';p.previousSeconds=elapsed;}
   }
   const distance=Math.hypot(focus.x-p.x,focus.z-p.z),visible=distance<(a.visible?85:70);
   if(visible!==a.visible){root.setEnabled(visible);a.visible=visible;}if(!visible)continue;
   let y=site.y,pitch=0,roll=0;if(!site.water){const center=this.w.surfaceAt(p.x,p.z,site.y+.8,0);if(!center)throw Error('动物活动范围缺少支持面：'+site.id);y=center.y;
    const r=.35,c=Math.cos(p.yaw),s=Math.sin(p.yaw),fore=this.w.surfaceAt(p.x+s*r,p.z+c*r,y+.25,0),back=this.w.surfaceAt(p.x-s*r,p.z-c*r,y+.25,0),right=this.w.surfaceAt(p.x+c*r,p.z-s*r,y+.25,0),left=this.w.surfaceAt(p.x-c*r,p.z+s*r,y+.25,0);if(fore&&back&&right&&left){pitch=-Math.atan2(fore.y-back.y,r*2);roll=Math.atan2(right.y-left.y,r*2);}}
   root.position.set(p.x,y,p.z);root.rotation.set(pitch,p.yaw,roll+(reaction&&site.water?Math.sin((time-reaction.start)*3)*.10:0));a.pose=p.clip;
   const sample=(name:string,seconds:number,weight:number)=>{const g=groups.get(name)!;if(!g.isStarted){g.start(true);g.pause();}g.setWeightForAllAnimatables(weight);const c=spec.clips[name],t=c.loop?seconds%c.duration:Math.min(seconds,c.duration-1e-6);g.goToFrame(g.from+(g.to-g.from)*t/c.duration);};
   for(const[name,g]of groups){if(name===p.clip)sample(name,p.seconds,p.previous===p.clip?1:p.blend);else if(name===p.previous&&p.blend<1)sample(name,p.previousSeconds,1-p.blend);else if(g.isStarted){g.setWeightForAllAnimatables(0);g.stop();}}
   if(reaction?.kind==='play'&&['golden-retriever','malamute'].includes(site.id)){const tail=a.asset.skeletons[0].bones.find(b=>/tail/i.test(b.name))?.getTransformNode();if(tail?.rotationQuaternion)tail.rotationQuaternion=tail.rotationQuaternion.multiply(Quaternion.RotationAxis(Vector3.Forward(),Math.sin((time-reaction.start)*13)*.12));}
   const shadow=quality!=='low'&&distance<27;if(shadow!==a.shadow){for(const m of a.asset.meshes)if(m.getTotalVertices()){if(shadow)this.w.shadows.addShadowCaster(m);else this.w.shadows.removeShadowCaster(m);}a.shadow=shadow;}
  }
 }
 get metrics(){return this.loaded.map(a=>({id:a.site.id,version:assets[a.site.id as AnimalId].version,position:a.root.position.asArray(),yaw:a.root.rotation.y,pose:a.pose,visible:a.visible,scale:a.root.scaling.asArray(),bones:a.asset.skeletons[0].bones.length}));}
 dispose(){this.disposed=true;for(const a of this.loaded){for(const m of a.asset.meshes)this.w.shadows.removeShadowCaster(m);a.asset.dispose();a.root.dispose();}this.loaded=[];}
}
