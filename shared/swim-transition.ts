import {SWIM_FAST_SPEED,SWIM_LIFT_SPEED} from './swimming';
import type {SnapshotShape} from './snapshot';
/** Relay bounds the authority's swimming displacement as well as reported speeds. */
type WaterSnapshot=Pick<SnapshotShape,'time'|'regionId'|'chapterId'|'players'>;
export function validSwimTransition(previous:WaterSnapshot|null,next:WaterSnapshot){
 if(!previous||(previous.regionId??previous.chapterId)!==(next.regionId??next.chapterId))return true;
 const dt=Math.min(1.5,Math.max(0,next.time-previous.time));
 for(const role of ['gold','white']as const){const a=previous.players[role],b=next.players[role],was=a.swim==='surface'||a.swim==='underwater',now=b.swim==='surface'||b.swim==='underwater';
  if(!was&&!now)continue;
  if(was&&now){if(Math.hypot(b.x-a.x,b.z-a.z)>SWIM_FAST_SPEED*dt+.12||Math.abs((b.y??0)-(a.y??0))>((next.regionId??next.chapterId)==='studio-undersea-atlantis'?SWIM_LIFT_SPEED:SWIM_LIFT_SPEED+1.1)*dt+.06)return false;}
  else if(Math.hypot(b.x-a.x,b.z-a.z)>6.6*dt+.15||Math.abs((b.y??0)-(a.y??0))>1.2+6.4*dt)return false;
 }
 return true;
}
