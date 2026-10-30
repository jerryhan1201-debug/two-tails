import {HOME_USES,homeUseDefinition,type HomePoint} from '../shared/home-use';
import type {Player} from './simulation';
import type {MovementWorld} from './movement';
import {clearDuoPath} from './duo-interactions';
export function nearbyHomeUse(region:string,p:Player,world:MovementWorld){
 if(region!=='player-home-villa'||p.mounted||!p.grounded||p.hp<=0)return undefined;
 return HOME_USES.filter(f=>Math.abs(f.floor-p.y)<.2&&f.slots.some(([x,y,z,yaw])=>Math.hypot(p.x-x,p.z-z)<3.25&&(f.pose==='lie'||(p.x-x)*Math.sin(yaw)+(p.z-z)*Math.cos(yaw)>-.2)&&clearDuoPath(world,{...p,y:p.y+1.9},{x,y:f.floor+1.9,z},.05,.08))).sort((a,b)=>Math.hypot(p.x-a.approach[0],p.z-a.approach[1])-Math.hypot(p.x-b.approach[0],p.z-b.approach[1]))[0];
}
/** Search only the furniture's own floor and approach side, with other dogs reserved. */
export function homeExit(id:string,slot:number,world:MovementWorld,others:Player[]):HomePoint|undefined{
 const f=homeUseDefinition(id);if(!f)return;
 const [x,z]=f.exits[slot],candidates:number[][]=[];
 if(id==='living-sofa'){const seat=f.slots[slot],angle=Math.atan2(seat[2]-6.7,seat[0]+12);for(const turn of [0,.1,-.1,.2,-.2,.35,-.35,.5,-.5,.8,-.8]){const a=angle+turn;if(a>.2&&a<2.94)candidates.push([-12+Math.cos(a)*2.18,6.7+Math.sin(a)*2.18]);}}
 candidates.push([x,z]);
 for(const r of [.45,.9,1.35,1.8])for(let i=0;i<8;i++)candidates.push([x+Math.cos(i*Math.PI/4)*r,z+Math.sin(i*Math.PI/4)*r]);
 for(const [cx,cz]of candidates){
  const s=world.surfaceAt(cx,cz,f.floor+.15,.66);
  if(!s?.walkable||Math.abs(s.y-f.floor)>.12||world.isSafe&&!world.isSafe(cx,cz,s.y,.66)||others.some(p=>Math.abs(p.y-s.y)<2.1&&Math.hypot(p.x-cx,p.z-cz)<(p.homeUse?1.12:1.38)))continue;
  const [sx,,sz]=f.slots[slot];if(!clearDuoPath(world,{x:sx,y:f.floor+1.9,z:sz},{x:cx,y:s.y+1.9,z:cz},.05,.08))continue;
  return{x:cx,y:s.y,z:cz,yaw:f.pose==='sit'?f.slots[slot][3]:0};
 }
}
export function homeRestPoint(p:Player):HomePoint{
 const h=p.homeUse!,f=homeUseDefinition(h.id)!,[x,y,z,yaw]=f.slots[h.slot];
 return{x,y,z,yaw};
}
