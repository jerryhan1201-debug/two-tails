import {goldenIntent,type GoldenIntent,type GoldenState} from '../shared/golden';
import type {Snapshot,Player} from './simulation';import type {DogRole} from '../shared/save';import type {MovementWorld} from './movement';
import {PetFollower,petSpawn,petStanding,petSegment} from './pet-follow';import {ANIMAL_SITES,animalSample} from './animal-schedule';import {animalClock,animalReaction,animalTargets,reachableAnimal} from './animal-interactions';
const HOME='player-home-villa',site=ANIMAL_SITES.find(a=>a.id==='golden-retriever')!;
export function restoreGolden(intent:GoldenIntent,regionId:string,w:MovementWorld,players:Record<DogRole,Player>,roles:DogRole[],time=0):GoldenState{
 const a=animalSample(site,time),p:GoldenState={...intent,regionId:HOME,x:a.x,y:site.y,z:a.z,yaw:a.yaw,speed:0,pose:'idle',waiting:'none',relocations:0};
 if(regionId==='studio-undersea-atlantis'&&intent.anchor){Object.assign(p,intent.anchor,{pose:'sit',waiting:'path'});return p;}
 if(intent.mode==='follow'){const owner=players[roles.includes(intent.owner)?intent.owner:roles[0]],point=petSpawn(w,owner,roles.map(r=>players[r]),.55,1.6);if(point)Object.assign(p,point,{regionId,owner:owner.role});}
 else if(intent.anchor){p.regionId=intent.anchor.regionId;Object.assign(p,intent.anchor);if(regionId===p.regionId){const point=petStanding(w,p,.55,1.6);if(point)Object.assign(p,point);}p.pose='sit';}
 return p;
}
export class GoldenFollower{
 private follower=new PetFollower(s=>s.golden as any,'golden-retriever',.55,1.6);
 reset(){this.follower.reset();}
 command(s:Snapshot,w:MovementWorld,role:DogRole,kind:'follow'|'stay',revision:number){
  const p=s.golden,a=animalTargets(s,w).find(a=>a.id==='golden-retriever');if(!p||!a||!reachableAnimal(s,w,s.players[role],a))return '靠近金毛，在安全的位置站稳后再安排。';
  if(animalReaction(s,a.id))return '金毛正在回应，稍等它站稳再安排。';if(p.revision!==revision)return '金毛刚收到伙伴的安排，请再选一次。';
  Object.assign(p,{x:a.x,y:a.y,z:a.z,yaw:a.yaw,regionId:s.regionId,mode:kind==='follow'?'follow':'home',owner:role,revision:p.revision+1,speed:0,pose:'idle',waiting:'none'});
  if(kind==='stay')p.anchor={regionId:s.regionId,x:a.x,y:a.y,z:a.z};else delete p.anchor;this.reset();return kind==='follow'?'金毛跟着你出发。':'金毛在这里休息，等你回来。';
 }
 tick(dt:number,s:Snapshot,w:MovementWorld,roles:DogRole[]){
  const p=s.golden;if(!p)return;if(p.mode==='follow'){
   const before={x:p.x,y:p.y,z:p.z};this.follower.tick(dt,s,w,roles);const peer=s.pet;
   if(peer?.regionId===p.regionId&&Math.abs(peer.y-p.y)<1){const dx=p.x-peer.x,dz=p.z-peer.z,d=Math.hypot(dx,dz);if(d<1.15){const owner=s.players[p.owner],angle=d>.01?Math.atan2(dx,dz):owner.yaw+Math.PI/2,point=petStanding(w,{x:peer.x+Math.sin(angle)*1.16,y:p.y,z:peer.z+Math.cos(angle)*1.16},.55,1.6);if(point&&petSegment(w,before,point,true,.55,1.6))Object.assign(p,point);else Object.assign(p,before,{speed:0,pose:'sit',waiting:'path'});}}
   return;
  }if(p.anchor){p.speed=0;p.pose='sit';return;}
  if(s.regionId===HOME){const a=animalSample(site,animalClock(s,site.id)),y=w.surfaceAt(a.x,a.z,site.y+.8,0)?.y??site.y;Object.assign(p,{x:a.x,y,z:a.z,yaw:a.yaw,regionId:HOME,speed:a.speed,pose:a.clip==='walk'?'walk':a.clip==='sit'?'sit':a.clip==='lie'?'lie':'idle'});}
 }
}
