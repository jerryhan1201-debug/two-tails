import {waterColumn,poolEntry,poolRampY} from '../shared/swimming';
import {TURTLE_LANDING_TRIANGLES} from './turtle-landing-layout';
import {curvedSofaProjection} from './villa-furniture-collision';
import {V13_HOME_BODIES} from './villa-layout-v13';
import {retiredVillaObstacle,LANDING_GUARDS,UPPER_STAIR_JOINTS,UPPER_VOID_GUARD,TREE_LANDING_GUARD,ATRIUM_THRESHOLD_TOP} from './villa-repair-data';
import {fieldBodies} from '../shared/fieldbook';
import {TREE_TRANSITION_COLLISIONS} from './villa-tree-profile';
import data from '../source-assets/environment/villa-rc3/physics.json';
import placement from '../source-assets/environment/villa-rc3/placement-collisions.json';
import roofs from '../source-assets/environment/villa-rc3/roof-surfaces.json';
import supportSolids from '../source-assets/environment/villa-rc3/v11-support-solids.json';
import type {MovementWorld, StandingSurface} from './movement';
import {VILLA_SITE_BOUNDS,COURTYARD_WALLS,HOME_FOREST_COLLISIONS} from './villa-site';
import {POND_BANK_TRIANGLES,POND_BRIDGE_TRIANGLES,POND_UNDERSIDES,POND_RAIL_BODIES,POND_PROP_BODIES,pondMaskContains,pondWaterPoint,pondOnBridge} from './villa-pond-layout';

export const VILLA_REGION='player-home-villa';
export const VILLA_BOUNDS=VILLA_SITE_BOUNDS;
type Triangle={id:string;role:string;vertices:number[][];normal:number[]};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function triangleIndex(triangles:Triangle[]) {
 const grid=new Map<string,Triangle[]>();
 for(const t of triangles){const xs=t.vertices.map(p=>p[0]),zs=t.vertices.map(p=>p[2]);
  for(let x=Math.floor(Math.min(...xs)/4);x<=Math.floor(Math.max(...xs)/4);x++)for(let z=Math.floor(Math.min(...zs)/4);z<=Math.floor(Math.max(...zs)/4);z++){
   const key=x+','+z,list=grid.get(key)??[];list.push(t);grid.set(key,list);
  }
 }
 return (x:number,z:number)=>grid.get(Math.floor(x/4)+','+Math.floor(z/4))??[];
}
function planeY(t:Triangle,x:number,z:number){
 const[a,b,c]=t.vertices,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(Math.abs(d)<1e-10)return null;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
 return u<-.0001||v<-.0001||u+v>1.0001?null:u*a[1]+v*b[1]+(1-u-v)*c[1];
}
const supports=triangleIndex([...data.supportTriangles,...roofs,...ATRIUM_THRESHOLD_TOP,...POND_BANK_TRIANGLES,...POND_BRIDGE_TRIANGLES,...TURTLE_LANDING_TRIANGLES]);
const undersides=triangleIndex([...data.undersideTriangles,...POND_UNDERSIDES]);
export const villaObstacles=[...data.obstacles.filter(o=>!retiredVillaObstacle(o.id)&&o.id!=='A upper oak trunk'&&!o.id.startsWith('curved living sofa ')).map(o=>o.id==='A walnut entry jamb'?{...o,center:[o.center[0]+(o.center[0]<1?.015:-.015),o.center[1],o.center[2]-.0125],size:[o.size[0]+.03,o.size[1],o.size[2]+.025]}:o),...placement,{id:'V14 curved living sofa',kind:'curved-sofa',center:[-12,1.165,6.7],size:[8.2,1.73,8.2],rotationY:0},...supportSolids,...LANDING_GUARDS,TREE_LANDING_GUARD,...V13_HOME_BODIES,...COURTYARD_WALLS,...HOME_FOREST_COLLISIONS,...TREE_TRANSITION_COLLISIONS,...fieldBodies(VILLA_REGION,()=>.26)];
villaObstacles.push(...POND_RAIL_BODIES,...POND_PROP_BODIES,...UPPER_STAIR_JOINTS,UPPER_VOID_GUARD);
const obstacles=villaObstacles;
const obstacleGrid=new Map<string,typeof obstacles>();
for(const o of obstacles){const r=Math.hypot(o.size[0],o.size[2])/2+1;
 for(let x=Math.floor((o.center[0]-r)/4);x<=Math.floor((o.center[0]+r)/4);x++)for(let z=Math.floor((o.center[2]-r)/4);z<=Math.floor((o.center[2]+r)/4);z++){
  const k=x+','+z,list=obstacleGrid.get(k)??[];list.push(o);obstacleGrid.set(k,list);
 }
}
export function poolPoint(x:number,z:number){
 const poly=data.pool.polygonXZ;let inside=false,distance=Infinity,qx=x,qz=z;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(px-x,pz-z);
  if(d<distance){distance=d;qx=px;qz=pz;}
 }
 return {inside,distance,qx,qz};
}
function surfaceAt(x:number,z:number,y:number,r=.66):StandingSurface|null{
 if(x<VILLA_BOUNDS.minX+r||x>VILLA_BOUNDS.maxX-r||z<VILLA_BOUNDS.minZ+r||z>VILLA_BOUNDS.maxZ-r)return null;
 const pool=poolPoint(x,z);let best:StandingSurface|null=null;
 // New walkable ground only outside the authored rectangle. Preserve every excavation.
 if((x<-40||x>46||z<-38||z>48)&&y>=.26)best={y:.26,walkable:true,normalY:1,id:'home-forest-ground'};
 // Six-centimetre seam sampling follows the release's stone joints, not a blanket floor.
 for(const[dx,dz]of [[0,0],[.06,0],[-.06,0],[0,.06],[0,-.06]])for(const t of supports(x+dx,z+dz)){
  const h=planeY(t,x+dx,z+dz);if(h===null||h>y+.0001||pool.inside&&h<.5&&!t.id.startsWith('turtle-stone-landing-')||!t.id.startsWith('pond-')&&!t.id.startsWith('turtle-stone-landing-')&&h<.5&&pondMaskContains(x+dx,z+dz))continue;
  if(!best||h>best.y)best={y:h,normalY:t.role==='roof'?1:t.normal[1],walkable:true,id:t.role==='roof'?'villa-unsafe-roof':t.id};
 }
 return best;
}
function ceilingAt(x:number,z:number,y:number,r=.66){
 const headMargin=r===.66?.12:0;if(r===.66)r=.86;
 let best=Infinity;
 // The underside of a tread we can step onto is below the paws, not a ceiling.
 // Keep the same staircase solid for somebody walking underneath it.
 const step=surfaceAt(x,z,y+.281,0),ownStep=step&&step.y>=y-.05?step.id:undefined;
 for(const[dx,dz]of [[0,0],[r*.8,0],[-r*.8,0],[0,r*.8],[0,-r*.8]])for(const t of undersides(x+dx,z+dz)){
  const h=planeY(t,x+dx,z+dz);// The low soil tray is a step, not an overhead ceiling at courtyard height.
  if(t.role==='stairs'&&t.id===ownStep)continue;
  if(h!==null&&!(t.id==='planter soil'&&h+.081<=y+.281)&&h>y+.05)best=Math.min(best,h);
 }
 for(const o of obstacleGrid.get(Math.floor(x/4)+','+Math.floor(z/4))??[]){
  const bottom=o.center[1]-o.size[1]/2;if(bottom<=y+.05||o.kind==='support-solid'&&o.center[1]+o.size[1]/2<=y+.281)continue;
  const c=Math.cos(o.rotationY||0),s=Math.sin(o.rotationY||0),dx=x-o.center[0],dz=z-o.center[2];
  if(Math.abs(dx*c-dz*s)<o.size[0]/2+r&&Math.abs(dx*s+dz*c)<o.size[2]/2+r)best=Math.min(best,bottom);
 }
 return Number.isFinite(best)?best-headMargin:null;
}
function resolveAt(x:number,z:number,y:number,r=.66,height=2.1,ignoreWater=false){
 const ordinary=height===2.1&&r===.66;if(ordinary)height=2.22;
 for(let pass=0;pass<3;pass++)for(const o of obstacleGrid.get(Math.floor(x/4)+','+Math.floor(z/4))??[]){
  if(o.kind==='curved-sofa'){const p=curvedSofaProjection(x,z,y,r,height,ordinary);x=p.x;z=p.z;continue;}
  const [cx,cy,cz]=o.center,[w,h,d]=o.size;if(cy+h/2<y+.09||cy-h/2>y+height-.02)continue;
  if(o.kind==='support-solid'&&cy+h/2-y<=.281)continue;
  const c=Math.cos(o.rotationY||0),s=Math.sin(o.rotationY||0),dx=x-cx,dz=z-cz;let lx=dx*c-dz*s,lz=dx*s+dz*c;
  // The shipped dogs' heads are wider than their .66 m torso capsule. Match only
  // head-height solids; do not inflate furniture feet or every doorway proxy.
  const reach=ordinary&&cy+h/2>y+1.05?.86:r;
  // This existing coffee table is round; its former box blocked the open corners.
  if(o.id==='living round table body'){const radius=Math.max(w,d)/2+reach,distance=Math.hypot(dx,dz);if(distance<radius){const scale=(radius+.001)/(distance||1);x=cx+(distance?dx:1)*scale;z=cz+(distance?dz:0)*scale;}continue;}
  let qx=clamp(lx,-w/2,w/2),qz=clamp(lz,-d/2,d/2),vx=lx-qx,vz=lz-qz,len=Math.hypot(vx,vz);if(len>=reach)continue;
  if(len<1e-8){if(w/2-Math.abs(lx)<d/2-Math.abs(lz)){vx=lx>=0?1:-1;vz=0;qx=vx*w/2;qz=lz;}else{vx=0;vz=lz>=0?1:-1;qx=lx;qz=vz*d/2;}}
  else{vx/=len;vz/=len;}
  lx=qx+vx*(reach+.001);lz=qz+vz*(reach+.001);x=cx+lx*c+lz*s;z=cz-lx*s+lz*c;
 }
 if(!ignoreWater&&y<.65){const p=poolPoint(x,z);if((p.inside||p.distance<r)&&!poolEntry(x,z,r)){const sign=p.inside?-1:1,dx=x-p.qx,dz=z-p.qz,d=Math.hypot(dx,dz)||1;x=p.qx+sign*dx/d*(r+.01);z=p.qz+sign*dz/d*(r+.01);}}
 if(!ignoreWater&&y<.65&&!pondOnBridge(x,z,y)){const p=pondWaterPoint(x,z);if(p.inside||p.distance<r){const sign=p.inside?-1:1,dx=x-p.qx,dz=z-p.qz,d=Math.hypot(dx,dz)||1;x=p.qx+sign*dx/d*(r+.015);z=p.qz+sign*dz/d*(r+.015);}}
 return {x:clamp(x,VILLA_BOUNDS.minX+r,VILLA_BOUNDS.maxX-r),z:clamp(z,VILLA_BOUNDS.minZ+r,VILLA_BOUNDS.maxZ-r)};
}
export const villaMovementWorld:MovementWorld={waterAt:(x,z,r)=>waterColumn(VILLA_REGION,x,z,r),resolveSwimAt:(x,z,y,r,h)=>resolveAt(x,z,y,r,h,true),bounds:VILLA_BOUNDS,surfaceAt,resolveAt,ceilingAt,isSafe(x,z,y,r=.66){
 const s=surfaceAt(x,z,y+.01,r),p=resolveAt(x,z,y,r),ceiling=ceilingAt(x,z,y,r);
 return !!s&&s.id!=='villa-unsafe-roof'&&Math.abs(s.y-y)<.15&&Math.hypot(p.x-x,p.z-z)<.05&&(ceiling===null||ceiling-y>=2.1);
}};
export const villaCameraGround=(x:number,z:number,y:number)=>surfaceAt(x,z,y-.1,0)?.y??-5;
export function villaInterior(x:number,y:number,z:number){
 const ceil=ceilingAt(x,z,y,.1);return ceil!==null&&ceil-y<12;
}

/** Existing solids, with water safety handled by the turtle's separate finite envelope. */
export const villaTurtleResolveAt=(x:number,z:number,y:number,r:number,h:number)=>resolveAt(x,z,y,r,h,true);
