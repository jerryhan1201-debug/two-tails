import type {Snapshot,Player} from './simulation';
import type {MovementWorld} from './movement';
import {DUO_RIDE,type DuoPoint} from '../shared/duo';
export const duoPoint=(p:Player):DuoPoint=>({x:p.x,y:p.y,z:p.z,yaw:p.yaw});
export function clearDuoPath(world:MovementWorld,a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},radius=.66,height=2.1){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.18));
 for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t,p=world.resolveAt(x,z,y,radius,height),ceiling=world.ceilingAt?.(x,z,y,radius);if(Math.hypot(p.x-x,p.z-z)>.025||ceiling!=null&&ceiling<y+height-.01)return false;}
 return true;
}
export function duoAvailable(s:Snapshot,world:MovementWorld){
 if(s.mode==='exploration'||s.story?.active||s.travel||s.journeyProposal||s.duo||s.fieldPlay)return false;
 const a=s.players.white,b=s.players.gold;
 if([a,b].some(p=>p.homeUse||p.hp<=0||!p.grounded||p.mounted||p.speed>.3||['attack','cast','hit','dodge','revive','interact'].includes(p.action)))return false;
 if(Math.abs(a.y-b.y)>.22||Math.hypot(a.x-b.x,a.z-b.z)>3.8)return false;
 if(s.enemies.some(e=>e.hp>0&&['chase','warning','attack'].includes(e.state)&&[a,b].some(p=>Math.hypot(e.x-p.x,e.z-p.z)<20)))return false;
 return clearDuoPath(world,a,b,.15,2.1);
}
export function safeDismount(world:MovementWorld,p:{x:number;y:number;z:number;yaw:number}){
 for(const r of [1.65,2.1,2.7,3.3])for(const turn of [.5,-.5,1,0,.25,-.25,.75,-.75]){
  const a=p.yaw+turn*Math.PI,x=p.x+Math.sin(a)*r,z=p.z+Math.cos(a)*r,s=world.surfaceAt(x,z,p.y+.23,.66);
  if(!s?.walkable||Math.abs(s.y-p.y)>.24||world.isSafe&&!world.isSafe(x,z,s.y,.66))continue;
  if(clearDuoPath(world,p,{x,y:s.y,z}))return{x,y:s.y,z,yaw:p.yaw};
 }return null;
}
export function canCarry(world:MovementWorld,p:DuoPoint){const r=world.resolveAt(p.x,p.z,p.y,DUO_RIDE.radius,DUO_RIDE.height),ceiling=world.ceilingAt?.(p.x,p.z,p.y,DUO_RIDE.radius);return Math.hypot(r.x-p.x,r.z-p.z)<.03&&(ceiling==null||ceiling-p.y>=DUO_RIDE.height)&&!!safeDismount(world,p);}
export function cuddlePositions(p:DuoPoint){const dx=Math.cos(p.yaw)*.82,dz=-Math.sin(p.yaw)*.82;return{white:{...p,x:p.x-dx,z:p.z-dz},gold:{...p,x:p.x+dx,z:p.z+dz}};}
