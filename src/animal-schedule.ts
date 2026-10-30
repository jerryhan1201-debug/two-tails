import assets from './animal-assets.json';
export type AnimalId=keyof typeof assets;
type Clip={duration:number;loop:boolean;nominalSpeedMps:number;from?:string;to?:string;translationProfile?:{airbornePhase:number[];distancePerCycleMetres:number}};
export type Spec={url:string;version:string;sha256:string;bones:number;bounds:{min:number[];max:number[]};clips:Record<string,Clip>};
export type AnimalSite={id:string;species?:AnimalId;regionId:string;x:number;z:number;y:number;clearance:number;height:number;cycles:number;offset:number;water?:boolean};
export const ANIMAL_SITES:AnimalSite[]=[
 {id:'kangaroo',regionId:'ch02-windmill-river',x:-23,z:24,y:.6,clearance:2.7,height:4,cycles:20,offset:0},
 {id:'koala',regionId:'mushroom-grove',x:-14,z:60,y:-.81,clearance:.72,height:1.5,cycles:24,offset:7},
 {id:'golden-retriever',regionId:'player-home-villa',x:-33,z:5,y:.26,clearance:1.48,height:1.4,cycles:24,offset:12},
 {id:'malamute',regionId:'studio-winter-lantern',x:-12,z:30,y:1.75,clearance:1.2,height:1.65,cycles:24,offset:3},
 {id:'sea-turtle',regionId:'studio-tideglass-cove',x:12,z:41.7,y:-.69,clearance:2.05,height:1.16,cycles:7,offset:5,water:true},
];
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** Regional wildlife has no player slot or persistent inventory. Both clients
 * evaluate this same bounded schedule from the existing authoritative clock. */
export function animalSample(site:AnimalSite,time:number){
 const spec=assets[site.species??site.id as AnimalId] as Spec,move=site.water?'swim':(site.species??site.id)==='kangaroo'?'hop':'walk',clip=spec.clips[move],moving=clip.duration*site.cycles,length=clip.nominalSpeedMps*moving,radius=length/(2*Math.PI),rest=(site.species??site.id)==='kangaroo'||(site.species??site.id)==='koala'?'rest':'lie';
 const schedule:readonly[string,number][]=site.water?[['idle',3],['start_swim',1],[move,moving],['stop_swim',1],['idle',4]]:[['idle',3],[move,moving],['idle',2],['settle',1],['sit',4],['rest_down',1],[rest,4],['rest_up',1],['sit',1],['rise',1],['idle',2]];
 const total=schedule.reduce((a,p)=>a+p[1],0);let local=((Math.max(0,time)+site.offset)%total+total)%total,index=0;while(local>=schedule[index][1])local-=schedule[index++][1];const name=schedule[index][0];let distance=0,speed=0;
 if(name===move){speed=clip.nominalSpeedMps;if(clip.translationProfile){const cycles=local/clip.duration,phase=cycles%1,[a,b]=clip.translationProfile.airbornePhase;distance=(Math.floor(cycles)+clamp((phase-a)/(b-a)))*clip.translationProfile.distancePerCycleMetres;speed=phase>=a&&phase<b?clip.nominalSpeedMps/(b-a):0;}else distance=local*speed;}
 const angle=distance/radius,previous=schedule[(index+schedule.length-1)%schedule.length],current=spec.clips[name],phase=current.loop?local%current.duration:Math.min(local,current.duration),blend=clamp(local/.15);
 return{x:site.x+Math.cos(angle)*radius,z:site.z+Math.sin(angle)*radius,yaw:-angle,clip:name,seconds:phase,previous:previous[0],previousSeconds:previous[1],blend,speed,radius,total};
}
