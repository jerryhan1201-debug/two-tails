import {SWIM_RADIUS,SWIM_HEIGHT,SWIM_SPEED,SWIM_FAST_SPEED,SWIM_LIFT_SPEED,SWIM_HEAD_TOP,type SwimMode,type WaterColumn} from '../shared/swimming';
import {rememberGround,standingSurface,STEP_HEIGHT,PLAYER_HEIGHT,type MovementWorld,type MovementState} from './movement';
export interface SwimmingState extends MovementState {swim:SwimMode;waterId?:string;vx:number;vz:number;mounted:boolean;flight:string;}
export function enterWater(p:SwimmingState,c:WaterColumn){p.swim='surface';p.waterId=c.id;p.grounded=false;p.mounted=false;p.flight='grounded';p.vy=0;p.vx=0;p.vz=0;p.y=c.surfaceFeet;}
/** Finite, swept buoyancy and immersion; land steps and water use distinct bodies. */
export function advanceSwimming(p:SwimmingState,dx:number,dz:number,lift:number,fast:boolean,dt:number,w:MovementWorld,move:(dx:number,dz:number,y:number)=>void,canOccupy?:(x:number,y:number,z:number)=>boolean){
 const speed=fast?SWIM_FAST_SPEED:SWIM_SPEED,n=Math.max(1,Math.ceil(dt/.01)),step=dt/n;let landed=false;
 for(let i=0;i<n;i++){
  const old={x:p.x,y:p.y,z:p.z},c=w.waterAt?.(p.x,p.z,SWIM_RADIUS);if(!c)return{landed:false,needsRecovery:true};
  p.vx=dx*speed;p.vz=dz*speed;let vy=lift<0&&!c.dive?0:lift*SWIM_LIFT_SPEED;
  // No oxygen or punishment. At rest underwater, neutral buoyancy holds depth.
  p.y=Math.max(c.minFeet,Math.min(c.maxFeet,p.y+vy*step));if(w.swimLegalAt&&!w.swimLegalAt(p.x,p.y,p.z,SWIM_RADIUS,SWIM_HEIGHT)||canOccupy&&!canOccupy(p.x,p.y,p.z))p.y=old.y;p.vy=(p.y-old.y)/step;
  const projection=w.resolveSwimAt?.(p.x,p.z,p.y,SWIM_RADIUS,SWIM_HEIGHT);
  if(projection&&Math.hypot(projection.x-p.x,projection.z-p.z)>.025){p.y=old.y;p.vy=0;}
  move(p.vx*step,p.vz*step,p.y);
  if(w.swimLegalAt&&!w.swimLegalAt(p.x,p.y,p.z,SWIM_RADIUS,SWIM_HEIGHT)||canOccupy&&!canOccupy(p.x,p.y,p.z)){Object.assign(p,old);p.vx=0;p.vz=0;p.vy=0;}
  const next=w.waterAt?.(p.x,p.z,SWIM_RADIUS);
  if(!next){
   const ground=standingSurface(w,p.x,p.z,old.y+STEP_HEIGHT, .66),legal=ground&&w.resolveAt(p.x,p.z,ground.y,.66,PLAYER_HEIGHT),ceiling=ground&&w.ceilingAt?.(p.x,p.z,ground.y,.66);
   if(ground&&ground.y-old.y<.28&&ground.y-old.y>-.65&&legal&&Math.hypot(legal.x-p.x,legal.z-p.z)<.025&&(ceiling==null||ceiling-ground.y>PLAYER_HEIGHT)){
    p.y=ground.y;p.vy=0;p.vx=0;p.vz=0;p.grounded=true;p.swim='land';delete p.waterId;p.landing=.18;rememberGround(p,w,.66);landed=true;return{landed,needsRecovery:false};
   }
   Object.assign(p,old);p.vx=0;p.vz=0;p.vy=0;
  }else{
   if(next.minFeet>p.y+(c.id==='cove-swim-basin'?.0001:.04)){p.x=old.x;p.z=old.z;p.vx=0;p.vz=0;p.waterId=c.id;p.swim=c.dive&&p.y+SWIM_HEAD_TOP<c.surface-.01?'underwater':'surface';continue;}
   p.y=Math.max(next.minFeet,Math.min(next.maxFeet,p.y));p.waterId=next.id;
   p.swim=next.dive&&p.y+SWIM_HEAD_TOP<next.surface-.01?'underwater':'surface';
   const roof=w.swimLegalAt?null:w.ceilingAt?.(p.x,p.z,Math.min(old.y,p.y),SWIM_RADIUS);
   if(roof!=null&&p.y+SWIM_HEIGHT>roof){Object.assign(p,old);p.vy=0;}
  }
  if(w.swimLegalAt&&w.swimLegalAt(p.x,p.y,p.z,SWIM_RADIUS,SWIM_HEIGHT)){p.safeX=p.x;p.safeY=p.y;p.safeZ=p.z;}
  if(![p.x,p.y,p.z].every(Number.isFinite))return{landed,needsRecovery:true};
 }
 return{landed,needsRecovery:false};
}
