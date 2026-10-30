import {BEACH,BEACH_WATER,beachColumn,beachSwimmingLegal} from './beach-swimming';
import {UNDERSEA,underseaColumn,underseaLegal} from './undersea';
import geometry from './swim-geometry.json';
export type SwimMode='land'|'surface'|'underwater';
export const SWIM_RADIUS=1.75,SWIM_HEIGHT=1.53,SWIM_HEAD_TOP=1.50,SWIM_SPEED=2.5,SWIM_FAST_SPEED=3.5,SWIM_LIFT_SPEED=.85;
export type WaterColumn={id:'home-pool'|'cove-shallows'|'cove-swim-basin'|'atlantis-water';surface:number;floor:number;surfaceFeet:number;minFeet:number;maxFeet:number;dive:boolean};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function polygonPoint(poly:number[][],x:number,z:number){let inside=false,distance=Infinity,qx=x,qz=z;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(px-x,pz-z);if(d<distance){distance=d;qx=px;qz=pz;}}return{inside,distance,qx,qz};}
export const poolWaterPoint=(x:number,z:number)=>polygonPoint(geometry.pool,x,z);
export function poolRampY(x:number,z:number){if(Math.abs(x-13)>2.8||z<30.2||z>38.8)return null;return z<34.2?-.72+(z-30.2)*1.14/4:.42-(z-34.2)*.16/4.6;}
export const poolEntry=(x:number,z:number,r=0)=>Math.abs(x-13)<=2.8-r&&z>=30.2&&z<=38.8;
const floors=new Map<string,number[][][]>();for(const t of geometry.beachFloor){for(let x=Math.floor(Math.min(...t.map(v=>v[0]))/3);x<=Math.floor(Math.max(...t.map(v=>v[0]))/3);x++)for(let z=Math.floor(Math.min(...t.map(v=>v[2]))/3);z<=Math.floor(Math.max(...t.map(v=>v[2]))/3);z++){const k=x+','+z,a=floors.get(k)??[];a.push(t);floors.set(k,a);}}
export function beachFloorAt(x:number,z:number){let h:number|null=null;for(const t of floors.get(Math.floor(x/3)+','+Math.floor(z/3))??[]){const[a,b,c]=t,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(u>=-.0001&&v>=-.0001&&u+v<=1.0001)h=Math.max(h??-Infinity,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return h;}
export function shoreAt(x:number){const p=geometry.shore;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if(x>=a[0]&&x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return Infinity;}
/** Authored finite water only. The offshore visual has no seabed and is excluded. */
export function waterColumn(region:string,x:number,z:number,r=SWIM_RADIUS):WaterColumn|null{
 if(region===UNDERSEA)return underseaColumn(x,z,r);
 if(region===BEACH)return beachColumn(x,z,r);
 let floor:number,surface:number,id:WaterColumn['id'];
 if(region==='player-home-villa'){const q=poolWaterPoint(x,z);if(!q.inside||q.distance<r&&!poolEntry(x,z,r))return null;floor=-1.5;surface=.12;id='home-pool';const distanceX=Math.max(10.2-x,0,x-15.8);if(distanceX<=r){const span=Math.sqrt(Math.max(0,r*r-distanceX*distanceX)),low=Math.max(30.2,z-span),high=Math.min(38.8,z+span);if(low<=high){const nearestPeak=clamp(34.2,low,high);floor=Math.max(floor,poolRampY(13,nearestPeak)!);}}}

 else return null;
 if(surface-floor<(id==='home-pool'?.32:.32))return null;const minFeet=floor+.08,surfaceFeet=Math.max(minFeet,surface-.70),maxFeet=surfaceFeet;
 return{id,surface,floor,surfaceFeet,minFeet,maxFeet,dive:surface-floor>=SWIM_HEAD_TOP+.09};
}
export function validSwimming(region:string,p:{x:number;z:number;y?:number;swim?:unknown;waterId?:unknown;grounded?:boolean;mounted?:boolean;flight?:string;speed:number;vy?:number;vx?:number;vz?:number;safeX?:number;safeY?:number;safeZ?:number;homeUse?:unknown}){
 if(region===UNDERSEA){return p.swim==='underwater'&&p.waterId==='atlantis-water'&&p.grounded===false&&p.mounted===false&&p.flight==='grounded'&&!p.homeUse&&typeof p.y==='number'&&underseaLegal(p.x,p.y,p.z)&&typeof p.safeX==='number'&&typeof p.safeY==='number'&&typeof p.safeZ==='number'&&underseaLegal(p.safeX,p.safeY,p.safeZ)&&p.speed<=SWIM_FAST_SPEED+.05&&Math.abs(p.vy??0)<=SWIM_LIFT_SPEED+.01&&Math.hypot(p.vx??0,p.vz??0)<=SWIM_FAST_SPEED+.01;}
 if(region===BEACH&&p.swim!==undefined&&p.swim!=='land'&&(!beachSwimmingLegal(p.x,p.y??NaN,p.z)||p.waterId!==BEACH_WATER||!beachSwimmingLegal(p.safeX??NaN,p.safeY??NaN,p.safeZ??NaN)))return false;
 if(region===BEACH&&(p.swim===undefined||p.swim==='land')&&typeof p.y==='number'&&beachColumn(p.x,p.z)&&(p.grounded===true||p.y<-.25))return false;
 if(p.swim===undefined)return p.waterId===undefined;
 if(!['land','surface','underwater'].includes(String(p.swim)))return false;
 if(p.swim==='land'){
  if(p.waterId!==undefined)return false;
  if(region==='player-home-villa'&&!p.mounted&&typeof p.y==='number'&&poolWaterPoint(p.x,p.z).inside){const ramp=poolRampY(p.x,p.z);if(p.grounded===true&&(ramp===null||Math.abs(p.y-ramp)>.04))return false;if(p.grounded===false&&p.y<-.15&&(ramp===null||p.y<ramp-.04))return false;}
  return true;
 }
 const c=waterColumn(region,p.x,p.z);return !!c&&p.waterId===c.id&&p.grounded===false&&p.mounted===false&&p.flight==='grounded'&&!p.homeUse&&typeof p.y==='number'&&p.y>=c.minFeet-.03&&p.y<=c.maxFeet+.03&&p.speed<=SWIM_FAST_SPEED+.05&&Math.abs(p.vy??0)<=SWIM_LIFT_SPEED+.01&&Math.hypot(p.vx??0,p.vz??0)<=SWIM_FAST_SPEED+.01&&(p.swim==='underwater'?c.dive&&p.y+SWIM_HEAD_TOP<c.surface-.005:p.y+SWIM_HEAD_TOP>=c.surface-.025);
}
