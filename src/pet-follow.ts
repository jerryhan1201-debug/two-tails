import {PET_HOME,PET_NEST,petIntent,type PetIntent,type PetState,type PetCommand} from '../shared/pet';
import type {DogRole} from '../shared/save';
import type {MovementWorld} from './movement';
import type {Player,Snapshot} from './simulation';
type Point={x:number;y:number;z:number};
export const PET_RADIUS=.34,PET_HEIGHT=1.25;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z),distance3=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
/** Same support triangles and indexed collision as the heroes. Never turn a roof/water into a floor. */
export function petStanding(world:MovementWorld,p:Point,radius=PET_RADIUS,height=PET_HEIGHT):Point|null {
 const s=world.surfaceAt(p.x,p.z,p.y+.25,radius);
 if(!s?.walkable||(s.normalY??1)<.65||Math.abs(s.y-p.y)>.29)return null;
 const q=world.resolveAt(p.x,p.z,s.y,radius,height),ceiling=world.ceilingAt?.(p.x,p.z,s.y,radius);
 if(distance(p,{...q,y:s.y})>.025||ceiling!=null&&ceiling-s.y<height-.02||world.isSafe&&!world.isSafe(p.x,p.z,s.y,radius))return null;
 return{x:p.x,y:s.y,z:p.z};
}
export function petSegment(world:MovementWorld,a:Point,b:Point,checkDestinationHeight=true,radius=PET_RADIUS,height=PET_HEIGHT):Point|null {
 const count=Math.ceil(distance3(a,b)/.16);if(count>200)return null;let previous=a;
 for(let i=1;i<=Math.max(1,count);i++){
  const t=i/Math.max(1,count),q=petStanding(world,{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:previous.y},radius,height);if(!q)return null;previous=q;
 }
 return !checkDestinationHeight||Math.abs(previous.y-b.y)<.3?previous:null;
}
export function petSpawn(world:MovementWorld,around:Point,players:Point[]=[],radius=PET_RADIUS,height=PET_HEIGHT):Point|null {
 for(const r of [1.8,2.5,1.1,3.2,0])for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,p=petStanding(world,{x:around.x+Math.sin(angle)*r,y:around.y,z:around.z+Math.cos(angle)*r},radius,height);
  if(p&&players.every(other=>distance3(p,other)>1.1))return p;
 }return null;
}
export function restorePet(intent:PetIntent,regionId:string,world:MovementWorld,players:Record<DogRole,Player>,roles:DogRole[]):PetState {
 const pet:PetState={...intent,regionId:PET_HOME,...PET_NEST,yaw:Math.PI/2,speed:0,pose:'sit',waiting:'none',relocations:0};
 if(regionId==='studio-undersea-atlantis'&&intent.anchor){Object.assign(pet,intent.anchor,{pose:'sit',waiting:'path'});return pet;}
 if(intent.mode==='follow'){
  const owner=players[roles.includes(intent.owner)?intent.owner:roles[0]];
  const position=petSpawn(world,{x:owner.safeX,y:owner.safeY,z:owner.safeZ},roles.map(r=>players[r]));
  if(position)Object.assign(pet,position,{owner:owner.role,regionId,pose:'idle'});
 }else if(regionId===PET_HOME){const p=petStanding(world,PET_NEST);if(p)Object.assign(pet,p);}
 return pet;
}
export function petAvailable(s:Snapshot,role:DogRole,world:MovementWorld){
 const pet=s.pet,p=s.players[role];return !!pet&&pet.regionId===s.regionId&&!s.regionLoad&&!s.story?.active&&!p.mounted&&!p.homeUse&&!s.duo&&!s.fieldPlay&&p.hp>0&&p.grounded&&Math.abs(p.y-pet.y)<.4&&distance(p,pet)<3.2&&!!petSegment(world,pet,p);
}
/** One authority owns this controller. Remote clients render the bounded snapshot only. */
export class PetFollower {
 constructor(private select:(s:Snapshot)=>PetState|undefined=s=>s.pet,private reactionId='hashiha',private radius=PET_RADIUS,private height=PET_HEIGHT,private options:{maxSpeed?:(s:Snapshot,p:PetState)=>number;stopDistance?:number|((s:Snapshot,p:PetState)=>number);recall?:boolean;updateInterval?:number;turnRate?:number;desiredSpeed?:(s:Snapshot,p:PetState,step:number,gap:number)=>number}={}){}
 private stopping(s:Snapshot,p:PetState){return typeof this.options.stopDistance==='function'?this.options.stopDistance(s,p):this.options.stopDistance??2.25;}
 private standing(w:MovementWorld,p:Point){return petStanding(w,p,this.radius,this.height);}
 private segment(w:MovementWorld,a:Point,b:Point,check=true){return petSegment(w,a,b,check,this.radius,this.height);}
 private spawn(w:MovementWorld,p:Point,players:Point[]){return petSpawn(w,p,players,this.radius,this.height);}

 private elapsed=0;private trail:Point[]=[];private route:Point[]=[];private routeAt=0;private lastOwner:Point|null=null;private stuck=0;private lastRevision=-1;private lastRegion='';private quiet=0;private idleTarget:Point|null=null;private roamAt=0;private homeAnchor:Point|null=null;
 metrics={plans:0,maxExpanded:0,safeRecalls:0,steps:0};
 reset(){this.elapsed=0;this.trail=[];this.route=[];this.routeAt=0;this.lastOwner=null;this.stuck=0;this.quiet=0;this.idleTarget=null;this.homeAnchor=null;this.roamAt=0;}
 command(s:Snapshot,role:DogRole,c:PetCommand,w:MovementWorld):string {
  const pet=this.select(s);if(!pet||!petAvailable(s,role,w))return '靠近哈士哈，在同一层站稳后再试。';
  if(s.animalCare?.reactions.some(r=>r.id===this.reactionId&&r.until>s.time))return '哈士哈正在回应，稍等一会儿再安排。';
  if(c.revision!==pet.revision)return '哈士哈刚收到伙伴的安排，请再选一次。';
  if(c.kind==='home'&&s.regionId!==PET_HOME)return '一起回到家园后，再让哈士哈留家休息吧。';
  pet.mode=c.kind;pet.owner=role;pet.revision++;pet.waiting='none';pet.speed=0;pet.pose='idle';this.reset();
  return c.kind==='follow'?`哈士哈跟着${role==='gold'?'小鸡毛':'小白'}出发。`:'哈士哈会在家里等你们回来。';
 }
  tick(dt:number,s:Snapshot,w:MovementWorld,roles:DogRole[]){
  if(s.animalCare?.reactions.some(r=>r.id===this.reactionId&&r.until>s.time))return;
  const pet=this.select(s);if(!pet)return;this.elapsed+=dt;if(this.elapsed<(this.options.updateInterval??.1))return;const step=Math.min(.15,this.elapsed);this.elapsed=0;
  if(pet.revision!==this.lastRevision||s.regionId!==this.lastRegion){this.reset();this.lastRevision=pet.revision;this.lastRegion=s.regionId;}
  if(pet.regionId!==s.regionId){pet.speed=0;return;} // dormant at home while its family explores.
  this.metrics.steps++;const source=s.players[pet.owner],owner=(s.duo?.phase==='active'&&s.duo.type==='ride'&&pet.owner==='gold')?s.players.white:source;
  if(pet.mode==='follow'&&(!roles.includes(pet.owner)||owner.mounted||!owner.grounded||owner.hp<=0)){
   pet.speed=0;pet.pose='sit';pet.waiting=owner.mounted?'flight':owner.swim!=='land'?'path':'none';this.trail=[];this.route=[];this.lastOwner=null;return;
  }
  const anchor=owner.homeUse?owner.homeUse.exit:owner;
  let target:Point|null=null;let stopping=pet.mode==='follow'?this.stopping(s,pet):.25;
  if(pet.mode==='follow'){
   pet.waiting='none';target=anchor;
   if(!this.lastOwner)this.lastOwner={x:anchor.x,y:anchor.y,z:anchor.z};
   else if(distance3(this.lastOwner,anchor)>.55){
    if(this.segment(w,this.lastOwner,anchor)){this.trail.push({...this.lastOwner});if(this.trail.length>96)this.trail.shift();}
    this.lastOwner={x:anchor.x,y:anchor.y,z:anchor.z};
   }
   while(this.trail.length&&distance3(pet,this.trail[0])<.48)this.trail.shift();
   // Following the owner's proven ground route handles curved stairs and doors without a global navmesh.
   if(this.trail.length){target=this.trail[0];stopping=.15;}
   if(distance3(pet,anchor)<this.stopping(s,pet)+.1&&this.segment(w,pet,anchor)){this.trail=[];target=anchor;stopping=this.stopping(s,pet);}
  }else{
   // "Stay home" also works upstairs. Rest on this legal floor instead of
   // trying to plan directly through several storeys to the outdoor nest.
   const home=this.homeAnchor??(this.homeAnchor={x:pet.x,y:pet.y,z:pet.z});
   const nearest=roles.map(r=>s.players[r]).filter(p=>p.grounded&&!p.mounted&&p.hp>0&&Math.abs(p.y-home.y)<.15&&distance(p,home)<5.5).sort((a,b)=>distance(pet,a)-distance(pet,b))[0];
   if(nearest){target=nearest;stopping=1.9;}
   else{
    if(s.time>this.roamAt){this.roamAt=s.time+28;const angle=s.time*.71,p=this.standing(w,{x:home.x+Math.sin(angle)*1.3,y:home.y,z:home.z+Math.cos(angle)*1.3});this.idleTarget=p&&Math.abs(p.y-home.y)<.15?p:null;}
    target=distance(pet,home)>4?home:this.idleTarget;
   }
  }
  if(!target||distance3(pet,target)<=stopping+.02){pet.speed=0;this.quiet+=step;pet.pose=this.quiet>15?'lie':this.quiet>4?'sit':'idle';this.stuck=0;return;}
  this.quiet=0;
  if(!this.segment(w,pet,target)){
   if(s.time>=this.routeAt){this.route=this.plan(w,pet,target);this.routeAt=s.time+1.2;}
   while(this.route.length&&distance3(pet,this.route[0])<.35)this.route.shift();
   if(this.route.length){target=this.route[0];stopping=.12;}
   else{pet.speed=0;pet.pose='sit';pet.waiting='path';this.stuck+=step;this.recallIfDistant(s,w,roles);return;}
  }else this.route=[];
  const dist=distance(pet,target);let desired=Math.min(this.options.maxSpeed?.(s,pet)??7,this.options.desiredSpeed?.(s,pet,step,distance(pet,owner))??(pet.mode==='home'?1.7:Math.max(2,Math.min(7,(distance(pet,owner)-1.8)*1.1))),Math.max(0,dist-stopping)/step);let yaw=Math.atan2(target.x-pet.x,target.z-pet.z);
  if(this.options.turnRate!==undefined){const delta=Math.atan2(Math.sin(yaw-pet.yaw),Math.cos(yaw-pet.yaw)),turn=this.options.turnRate*step*Math.min(1,desired/8);yaw=pet.yaw+Math.max(-turn,Math.min(turn,delta));if(Math.abs(delta)>1.2)desired=0;}
  // A partial stride follows each checked support. It has not yet reached the
  // waypoint's final floor height; requiring that height stalls mid-stair.
  const length=Math.min(desired*step,dist),next=this.segment(w,pet,{x:pet.x+Math.sin(yaw)*length,y:pet.y,z:pet.z+Math.cos(yaw)*length},false);
  if(next){const moved=distance(pet,next);Object.assign(pet,next,{yaw,speed:moved/step,pose:moved/step>2.5?'trot':moved>.01?'walk':'idle'});this.stuck=moved<.02?this.stuck+step:0;}
  else{pet.speed=0;pet.pose='sit';this.stuck+=step;pet.waiting='path';}
  this.recallIfDistant(s,w,roles);
 }
 private recallIfDistant(s:Snapshot,w:MovementWorld,roles:DogRole[]){
  const pet=this.select(s)!;if(this.options.recall===false||pet.mode!=='follow'||this.stuck<8||roles.some(r=>distance3(pet,s.players[r])<24))return;
  const owner=s.players[pet.owner];if(owner.mounted||!owner.grounded)return;const p=this.spawn(w,owner,roles.map(r=>s.players[r]));
  if(p){Object.assign(pet,p,{speed:0,waiting:'none'});pet.relocations++;this.metrics.safeRecalls++;this.reset();}
 }
 private plan(w:MovementWorld,start:Point,goal:Point):Point[]{
  // Bounded local A*: 180 expansions at most, >=1.2 s between plans. Geometry queries use the existing index.
  this.metrics.plans++;type Node=Point&{g:number;f:number;parent:Node|null};const open:Node[]=[{...start,g:0,f:distance3(start,goal),parent:null}],seen=new Map<string,number>();let expanded=0;
  while(open.length&&expanded++<180){open.sort((a,b)=>a.f-b.f);const p=open.shift()!;
   if(distance3(p,goal)<1.1&&this.segment(w,p,goal)){const path:Point[]=[goal];let q:Node|null=p;while(q?.parent){path.unshift({x:q.x,y:q.y,z:q.z});q=q.parent;}this.metrics.maxExpanded=Math.max(expanded,this.metrics.maxExpanded);return path;}
   for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const t={x:p.x+dx*.65,y:p.y,z:p.z+dz*.65};if(distance(t,start)>8)continue;const next=this.segment(w,p,t);if(!next)continue;
    const key=`${Math.round((next.x-start.x)/.65)},${Math.round(next.y*4)},${Math.round((next.z-start.z)/.65)}`,g=p.g+distance3(p,next);if((seen.get(key)??Infinity)<=g)continue;seen.set(key,g);open.push({...next,g,f:g+distance3(next,goal),parent:p});
   }
  }this.metrics.maxExpanded=Math.max(Math.min(expanded,180),this.metrics.maxExpanded);return [];
 }
}
