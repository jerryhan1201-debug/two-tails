/** One authored garden footprint, shared by meshes, supports and water safety. */
export const HOME_POND={x:-28.5,z:-26.5,grassY:.26,waterY:.10,bottomY:-1.02,rx:7.1,rz:8.4,bridgeHalf:7.4,bridgeWidth:3.6};
export type PondPoint=[number,number,number];
export const POND_EDGE=Array.from({length:48},(_,i):PondPoint=>{const a=i/48*Math.PI*2;return[HOME_POND.x+Math.cos(a)*HOME_POND.rx,.26,HOME_POND.z+Math.sin(a)*HOME_POND.rz];});
export const POND_WATER_EDGE=POND_EDGE.map((_,i):PondPoint=>{const a=i/48*Math.PI*2,v=1+.047*Math.sin(a*3+.6)+.027*Math.cos(a*5);return[HOME_POND.x+Math.cos(a)*(HOME_POND.rx-.72)*v,HOME_POND.waterY,HOME_POND.z+Math.sin(a)*(HOME_POND.rz-.72)*v];});
export function polygonPoint(poly:readonly PondPoint[],x:number,z:number){let inside=false,distance=Infinity,qx=x,qz=z;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
  const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz))),px=a[0]+t*dx,pz=a[2]+t*dz,d=Math.hypot(x-px,z-pz);
  if(d<distance){distance=d;qx=px;qz=pz;}
 }return{inside,distance,qx,qz};
}
export const pondWaterPoint=(x:number,z:number)=>Math.abs(x-HOME_POND.x)>HOME_POND.rx+2||Math.abs(z-HOME_POND.z)>HOME_POND.rz+2?{inside:false,distance:Infinity,qx:x,qz:z}:polygonPoint(POND_WATER_EDGE,x,z);
export function pondMaskContains(x:number,z:number){if(Math.abs(x-HOME_POND.x)>HOME_POND.rx||Math.abs(z-HOME_POND.z)>HOME_POND.rz)return false;return polygonPoint(POND_EDGE,x,z).inside;}
export const pondBridgeHeight=(x:number)=>HOME_POND.grassY+.62*(1-Math.min(1,Math.abs((x-HOME_POND.x)/HOME_POND.bridgeHalf))**2);
export const pondOnBridge=(x:number,z:number,y:number)=>Math.abs(x-HOME_POND.x)<=HOME_POND.bridgeHalf+.1&&Math.abs(z-HOME_POND.z)<HOME_POND.bridgeWidth/2+.05&&y>=pondBridgeHeight(x)-.32;
export type PondTriangle={id:string;role:string;vertices:number[][];normal:number[]};
function tri(id:string,a:PondPoint,b:PondPoint,c:PondPoint):PondTriangle{
 const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);return{id,role:'garden-bridge',vertices:[a,b,c],normal:n.map(x=>x/len)};
}
export const POND_BANK_TRIANGLES:PondTriangle[]=POND_EDGE.flatMap((a,i)=>{const j=(i+1)%POND_EDGE.length,b=POND_EDGE[j],c=POND_WATER_EDGE[i],d=POND_WATER_EDGE[j];return[tri('pond-bank-'+i,a,c,b),tri('pond-bank-'+i,b,c,d)];});
export const POND_DECK=Array.from({length:33},(_,i)=>{const x=HOME_POND.x-HOME_POND.bridgeHalf+i/32*HOME_POND.bridgeHalf*2;return{x,y:pondBridgeHeight(x)};});
export const POND_BRIDGE_TRIANGLES=POND_DECK.slice(0,-1).flatMap((a,i)=>{const b=POND_DECK[i+1],z=HOME_POND.z,w=HOME_POND.bridgeWidth/2;
 const p:[PondPoint,PondPoint,PondPoint,PondPoint]=[[a.x,a.y,z-w],[a.x,a.y,z+w],[b.x,b.y,z-w],[b.x,b.y,z+w]];return[tri('pond-bridge-'+i,p[0],p[1],p[2]),tri('pond-bridge-'+i,p[2],p[1],p[3])];});
export const POND_UNDERSIDES=POND_BRIDGE_TRIANGLES.map(t=>({...t,id:t.id+'-underside',vertices:t.vertices.map(v=>[v[0],v[1]-.16,v[2]]),normal:t.normal.map(v=>-v)}));
export const POND_RAIL_BODIES=POND_DECK.slice(0,-1).flatMap((a,i)=>{const b=POND_DECK[i+1];return[-1,1].map(side=>({id:'pond-bridge-rail-'+side+'-'+i,kind:'garden-rail',center:[(a.x+b.x)/2,(a.y+b.y)/2+.63,HOME_POND.z+side*(HOME_POND.bridgeWidth/2+.045)],size:[b.x-a.x+.025,1.22+Math.abs(b.y-a.y),.12],rotationY:0}));});
/** Reserved semantics only: no swim state or water-floor registration. */
export const POND_SWIM_RESERVATION={enabled:false,waterY:HOME_POND.waterY,bottomY:HOME_POND.bottomY,volume:POND_WATER_EDGE,landEntry:{x:-28.5,y:.26,z:-20.9},returnAnchor:{x:-28.5,y:.26,z:-20.5},resourceGroup:'home-water-garden'};
export const POND_LIGHTS=[{position:[-20.3,1.20,-29.2],range:6,power:6},{position:[-36.4,1.20,-24.8],range:6,power:6}];
export const POND_STORY_POINTS={album:{x:-23,y:.26,z:-20.2},iris:{x:-34.1,y:.26,z:-18.2},wheel:{x:-20.5,y:.26,z:-24.9},case:{x:-35.2,y:.26,z:-21.5},reply:{x:-22,y:.26,z:-32.8}};
export const POND_PROP_BODIES=[{id:'pond-album-ledge',kind:'garden-story',center:[-23,.72,-20.2],size:[.8,.92,.5],rotationY:0},{id:'pond-current-post',kind:'garden-story',center:[-20.5,.72,-24.9],size:[.19,.92,.19],rotationY:0},{id:'pond-reply-rest',kind:'garden-story',center:[-22,.53,-32.8],size:[1.2,.54,.65],rotationY:0}];
