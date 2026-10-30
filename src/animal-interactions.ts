import {HOME_PET_IDS} from '../shared/home-pets';import {HOME_PET_SITES,HOME_ANIMAL_SITES} from './home-pet-sites';
import {ANIMAL_NAMES,type AnimalCare,type AnimalReaction,type AnimalSpecies,type AnimalCommand} from '../shared/animal-care';
import {ANIMAL_SITES,animalSample} from './animal-schedule';
import {getRegionChapter,regionGroundHeight} from './regions';
import {journeyNodes,journeyEntry} from './journeys';
import {clearDuoPath} from './duo-interactions';
import type {MovementWorld} from './movement';
import type {Snapshot,Player} from './simulation';
import type {DogRole} from '../shared/save';
export type AnimalTarget={id:string;species:AnimalSpecies;label:string;x:number;y:number;z:number;yaw:number;radius:number;water?:boolean;voiceY?:number;source:'ambient'|'pet'|'resident'|'creature'|'nest'|'flock'};
export function residentSpecies(id:string,biome:string):AnimalSpecies|null{
 if(/seed|portrait|ghost/.test(id))return null;
 if(/moth/.test(id))return 'moth';if(/cat/.test(id))return 'cat';if(/bird/.test(id))return 'bird';
 return biome==='river'?'frog':['castle','graveyard'].includes(biome)?'mouse':'badger';
}
export function animalReaction(s:Snapshot,id:string){return s.animalCare?.regionId===s.regionId?s.animalCare.reactions.find(r=>r.id===id&&s.time<r.until):undefined;}
export function animalClock(s:Pick<Snapshot,'animalCare'|'regionId'|'time'>,id:string){return s.time-(s.animalCare?.regionId===s.regionId?s.animalCare.delays[id]??0:0);}
export function animalTargets(s:Snapshot,w:MovementWorld):AnimalTarget[]{
 const out:AnimalTarget[]=[],chapter=getRegionChapter(s.regionId);
 for(const a of ANIMAL_SITES.filter(a=>a.regionId===s.regionId)){
  if(a.id==='golden-retriever'&&s.golden&&(s.golden.mode==='follow'||s.golden.anchor)&&s.golden.regionId!==s.regionId)continue;
  const r=animalReaction(s,a.id),p=animalSample(a,animalClock(s,a.id)),follow=a.id==='golden-retriever'&&s.golden?.regionId===s.regionId&&(s.golden.mode==='follow'||s.golden.anchor)?s.golden:undefined,x=r?.x??follow?.x??p.x,z=r?.z??follow?.z??p.z,y=follow?.y??(a.water?a.y:w.surfaceAt(x,z,a.y+.8,0)?.y);
  if(y!==undefined)out.push({id:a.id,species:a.id as AnimalSpecies,label:ANIMAL_NAMES[a.id as AnimalSpecies],x,y,z,yaw:r?.yaw??p.yaw,radius:a.id==='kangaroo'?.95:a.clearance,water:a.water,source:'ambient'});
 }
 if(s.golden?.mode==='follow'&&s.golden.regionId===s.regionId&&!out.some(a=>a.id==='golden-retriever'))out.push({...s.golden,id:'golden-retriever',species:'golden-retriever',label:'金毛',radius:1.1,source:'ambient'});
 if(s.golden?.anchor&&s.golden.regionId===s.regionId&&!out.some(a=>a.id==='golden-retriever'))out.push({...s.golden,id:'golden-retriever',species:'golden-retriever',label:'金毛',radius:1.1,source:'ambient'});
 for(const id of HOME_PET_IDS){const p=s.homePets?.[id],a=HOME_PET_SITES[id];if(p?.regionId===s.regionId)out.push({...p,id,species:a.species,label:'家园宠物 · '+ANIMAL_NAMES[a.species],radius:a.clearance,water:p.water,source:'ambient'});}
 if(s.pet?.regionId===s.regionId)out.push({...s.pet,id:'hashiha',species:'hashiha',label:'哈士哈',radius:.52,source:'pet'});
 for(const n of chapter.interactions.filter(n=>n.kind==='npc')){const species=residentSpecies(n.id,chapter.biome);if(!species)continue;const platform=chapter.terrain.platforms?.find(p=>p.id===n.surfaceId);out.push({id:'resident:'+n.id,species,label:n.speaker??ANIMAL_NAMES[species],x:n.x,y:platform?.height??regionGroundHeight(s.regionId,n.x,n.z),z:n.z,yaw:Math.PI,radius:.55,source:'resident'});}
 if(s.mode==='exploration'||s.mode==='coop-exploration')for(const e of (s.enemies??[]).filter(e=>e.hp>0&&['wolf','bat','sprite','dragon'].includes(e.kind)))out.push({id:'creature:'+e.id,species:e.kind==='sprite'?'moth':e.kind as AnimalSpecies,label:e.name,x:e.x,y:e.y??regionGroundHeight(s.regionId,e.x,e.z),z:e.z,yaw:e.yaw,radius:e.kind==='dragon'?2.4: e.kind==='wolf'?1:.75,source:'creature'});
 for(const n of journeyNodes(s.regionId).filter(n=>n.visual==='nest'&&journeyEntry(s.journeys,n.journeyId).stage<2))out.push({id:'nest:'+n.id,species:'bird',label:'巢里的雏鸟',x:n.x,y:regionGroundHeight(s.regionId,n.x,n.z),z:n.z,yaw:0,radius:.45,source:'nest'});
 if(s.regionId==='ch05-candle-castle'){out.push({id:'castle-window-bats',species:'bat',label:'窗边小蝙蝠',x:-45.1,y:-3.6,z:73.75,voiceY:1.5,yaw:0,radius:.45,source:'flock'});out.push({id:'castle-arch-bat',species:'bat',label:'拱梁上的蝙蝠',x:7,y:2.4,z:39,voiceY:12,yaw:0,radius:.45,source:'flock'});}
 return out;
}
export function reachableAnimal(s:Snapshot,w:MovementWorld,p:Player,a:AnimalTarget){
 if(!p.grounded||p.mounted||p.homeUse||p.hp<=0||s.regionLoad||s.travel||s.duo||s.fieldPlay||s.story?.active||['attack','cast','hit','dodge','revive'].includes(p.action))return false;
 const d=Math.hypot(a.x-p.x,a.z-p.z);if(d<(a.species==='kangaroo'?.66:a.radius+.55)||d>a.radius+(a.water?(a.id==='home-sea-turtle'?4.6:3.4):2.4)||Math.abs(a.y-p.y)>(a.water?2.8:.65)||w.isSafe&&!w.isSafe(p.x,p.z,p.y,.66))return false;
 // Rays sample the actual world's wall/ceiling resolver. Water is never used
 // as player support, and neither participant is moved toward the other.
 return clearDuoPath(w,{...p,y:p.y+1.5},{...a,y:a.source==='flock'?a.voiceY??a.y+1.5:a.y+1.5},.06,.15);
}
export function nearbyAnimal(s:Snapshot,w:MovementWorld,role:DogRole){const p=s.players[role];return animalTargets(s,w).filter(a=>reachableAnimal(s,w,p,a)).sort((a,b)=>Math.round((Math.hypot(a.x-p.x,a.z-p.z)-a.radius)*4)-Math.round((Math.hypot(b.x-p.x,b.z-p.z)-b.radius)*4)||a.id.localeCompare(b.id))[0];}
export class AnimalInteractions{
 private cooldown=new Map<string,number>();private nextCall=0;private region='';
 reset(s:Snapshot){delete s.animalCare;this.cooldown.clear();this.nextCall=s.time+16;this.region=s.regionId;}
 command(s:Snapshot,w:MovementWorld,role:DogRole,c:AnimalCommand,emit:(a:AnimalTarget,r:AnimalReaction)=>void){
  if(this.region!==s.regionId)this.reset(s);
  if(['follow','stay','home'].includes(c.kind))return '请选择金毛的跟随安排。';
  const a=animalTargets(s,w).find(a=>a.id===c.id),p=s.players[role];
  if(!a||!reachableAnimal(s,w,p,a))return '靠近它，在同层安全的位置站稳后再试。';
  const care=s.animalCare??(s.animalCare={regionId:s.regionId,delays:{},reactions:[]});
  if(care.reactions.some(r=>r.id===a.id||r.role===role)||(this.cooldown.get(a.id)??0)>s.time)return a.label+'正在回应，稍等一会儿再招呼。';
  const duration=c.kind==='greet'?4.8:6.2,r:AnimalReaction={id:a.id,species:a.species,role,kind:c.kind as AnimalReaction['kind'],serial:++s.eventSerial,start:s.time,until:s.time+duration,x:a.x,y:a.y,z:a.z,yaw:Math.atan2(p.x-a.x,p.z-a.z)};
  care.reactions.push(r);this.cooldown.set(a.id,r.until+1);p.yaw=Math.atan2(a.x-p.x,a.z-p.z);p.action='interact';p.actionTime=duration;p.speed=0;emit(a,r);return '';
 }
 cancel(s:Snapshot,role?:DogRole){const care=s.animalCare;if(!care)return;for(const r of [...care.reactions])if(!role||r.role===role){const site=[...ANIMAL_SITES,...HOME_ANIMAL_SITES].find(a=>a.id===r.id);if(site)care.delays[r.id]=((care.delays[r.id]??0)+Math.max(0,Math.min(s.time,r.until)-r.start))%animalSample(site,0).total;care.reactions.splice(care.reactions.indexOf(r),1);}}
 tick(s:Snapshot,w:MovementWorld,roles:DogRole[],call:(a:AnimalTarget)=>void){
  if(this.region!==s.regionId){this.reset(s);return;}
  const care=s.animalCare;
  if(care){for(const r of [...care.reactions]){
   const p=s.players[r.role];if(s.time<r.until&&roles.includes(r.role)&&p.grounded&&!p.mounted&&p.hp>0&&!p.homeUse&&!s.duo&&!s.fieldPlay&&!s.travel&&!s.regionLoad&&!s.story?.active&&Math.hypot(p.x-r.x,p.z-r.z)<8)continue;
   const site=[...ANIMAL_SITES,...HOME_ANIMAL_SITES].find(a=>a.id===r.id);if(site){const total=animalSample(site,0).total;care.delays[r.id]=((care.delays[r.id]??0)+Math.min(s.time,r.until)-r.start)%total;}care.reactions.splice(care.reactions.indexOf(r),1);
  }}
  for(const[k,t]of this.cooldown)if(t<s.time)this.cooldown.delete(k);
  if(s.time<this.nextCall)return;this.nextCall=s.time+22;
  if(s.regionLoad||s.travel||s.story?.active)return;
  const candidates=animalTargets(s,w).filter(a=>!animalReaction(s,a.id)&&roles.some(r=>Math.hypot(s.players[r].x-a.x,s.players[r].z-a.z)<18&&Math.abs(s.players[r].y-a.y)<3));
  if(candidates.length)call(candidates[Math.floor(s.time/22)%candidates.length]);
 }
}
