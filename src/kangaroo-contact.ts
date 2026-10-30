import assets from "./animal-assets.json";
import profile from './kangaroo-profile.json';import type{ContactBody}from'./combat-contact';import type{MovementWorld}from'./movement';
export const KANGAROO_NAV_RADIUS=.95;
type Pose={x:number;y:number;z:number;yaw:number;pose?:string;seconds?:number};
export function kangarooProfile(pose='idle',seconds=0){const clips=profile.clips as Record<string,typeof profile.clips.idle>,frames=clips[pose]??clips.idle,duration=(assets.kangaroo.clips as any)[pose]?.duration??1,at=Math.max(0,Math.min(31,seconds/duration*31));return frames[Math.round(at)];}
/** Four measured volumes follow the original body and long tail independently. */
export function kangarooContacts(id:string,p:Pose):ContactBody[]{const f=kangarooProfile(p.pose,p.seconds),c=Math.cos(p.yaw),s=Math.sin(p.yaw);return f.cylinders.map((v,i)=>({id:id+':'+i,x:p.x+v.x*c+v.z*s,z:p.z-v.x*s+v.z*c,y:p.y+v.minY,height:v.maxY-v.minY,radius:v.radius,fixed:true,reservesColumn:false}));}
export function kangarooFits(w:MovementWorld,p:Pose){for(const v of kangarooContacts('fit',p)){const q=w.resolveAt(v.x,v.z,v.y!,v.radius,v.height??4),ceiling=w.ceilingAt?.(v.x,v.z,v.y!,v.radius);if(Math.hypot(q.x-v.x,q.z-v.z)>.035||ceiling!=null&&ceiling<v.y!+v.height!-.025)return false;}return true;}
export function kangarooOverlaps(p:Pose,other:{x:number;y:number;z:number;radius:number;height:number}){return kangarooContacts('overlap',p).some(v=>other.y<v.y!+v.height!-.025&&v.y!<other.y+other.height-.025&&Math.hypot(v.x-other.x,v.z-other.z)<v.radius+other.radius+.04);}
