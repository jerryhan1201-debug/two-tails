import capSource from '../source-assets/environment/v6-core/physics-surfaces.json';
import treeSource from '../shared/ancient-tree-geometry.json';
import studioShapes from '../source-assets/environment/studio-rc1/physics.json';
import {STEP_HEIGHT,MIN_GROUND_NORMAL,type StandingSurface} from './movement';
import type {WorldObstacle} from './world-surfaces';

type P={x:number;z:number};
type V=[number,number,number];
type Triangle={v:V[];minX:number;maxX:number;minZ:number;maxZ:number;minY:number;maxY:number;a:number;b:number;c:number;bottom:boolean};
const cross=(a:P,b:P,c:P)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function hull(points:P[]):P[]{
 const sorted=points.sort((a,b)=>a.x-b.x||a.z-b.z).filter((p,i,a)=>!i||Math.abs(p.x-a[i-1].x)+Math.abs(p.z-a[i-1].z)>1e-9);
 const lower:P[]=[],upper:P[]=[];
 for(const p of sorted){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}
 for(const p of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function contains(t:Triangle,x:number,z:number){
 const [a,b,c]=t.v,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
 return u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8;
}
export interface MushroomSolid {x:number;z:number;base:number;cap:number;h:number;id:string;shapeId?:'giant'|'medium'|'house'}
function createShape(source:{positions:number[][];triangles:number[][]}) {
const vertices=source.positions as V[];
const triangles:Triangle[]=source.triangles.flatMap(ids=>{
 const v=ids.map(i=>vertices[i]),[p,q,r]=v,det=(q[0]-p[0])*(r[2]-p[2])-(r[0]-p[0])*(q[2]-p[2]);
 if(Math.abs(det)<1e-11)return [];
 const a=((q[1]-p[1])*(r[2]-p[2])-(r[1]-p[1])*(q[2]-p[2]))/det,b=((q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]))/det;
 return [{v,minX:Math.min(...v.map(p=>p[0])),maxX:Math.max(...v.map(p=>p[0])),minZ:Math.min(...v.map(p=>p[2])),maxZ:Math.max(...v.map(p=>p[2])),minY:Math.min(...v.map(p=>p[1])),maxY:Math.max(...v.map(p=>p[1])),a,b,c:p[1]-a*p[0]-b*p[2],bottom:false}];
});
// A small deterministic spatial index keeps exact triangle queries out of the full mesh loop.
const cell=.125,grid=new Map<string,Triangle[]>();
for(const t of triangles)for(let x=Math.floor(t.minX/cell);x<=Math.floor(t.maxX/cell);x++)for(let z=Math.floor(t.minZ/cell);z<=Math.floor(t.maxZ/cell);z++){
 const key=x+','+z,list=grid.get(key)??[];list.push(t);grid.set(key,list);
}
function candidates(x:number,z:number,r=0):Triangle[]{
 if(!r)return grid.get(Math.floor(x/cell)+','+Math.floor(z/cell))??[];
 const set=new Set<Triangle>();for(let i=Math.floor((x-r)/cell);i<=Math.floor((x+r)/cell);i++)for(let j=Math.floor((z-r)/cell);j<=Math.floor((z+r)/cell);j++)for(const t of grid.get(i+','+j)??[])set.add(t);return [...set];
}
function capRay(x:number,z:number){
 let top=-Infinity,bottom=Infinity,face:Triangle|undefined;
 for(const t of candidates(x,z))if(contains(t,x,z)){const y=t.a*x+t.b*z+t.c;if(y>top){top=y;face=t;}bottom=Math.min(bottom,y);}
 return face?{top,bottom,face}:null;
}
// Classify underside from vertical intersections, independent of glTF/LH winding.
for(const t of triangles){const x=t.v.reduce((n,p)=>n+p[0],0)/3,z=t.v.reduce((n,p)=>n+p[2],0)/3,ray=capRay(x,z);t.bottom=!!ray&&Math.abs(t.a*x+t.b*z+t.c-ray.bottom)<1e-6;}
const capBounds={r:Math.max(...vertices.map(v=>Math.hypot(v[0],v[2]))),minY:Math.min(...vertices.map(v=>v[1])),maxY:Math.max(...vertices.map(v=>v[1]))};
function mushroomSurface(m:MushroomSolid,x:number,z:number,feetY:number):StandingSurface|null{
 const ray=capRay((x-m.x)/m.cap,(z-m.z)/m.cap);if(!ray)return null;
 const y=m.base+ray.top*m.h,normalY=1/Math.hypot(1,ray.face.a*m.h/m.cap,ray.face.b*m.h/m.cap);
 return y<=feetY+.3?{y,normalY,walkable:normalY>=MIN_GROUND_NORMAL,id:m.id}:null;
}
/** Exact minimum of a planar triangle over a horizontal body disk. */
function diskMinimum(t:Triangle,x:number,z:number,r:number):number|null{
 const points:P[]=[],add=(px:number,pz:number)=>{if(contains(t,px,pz)&&Math.hypot(px-x,pz-z)<=r+1e-8)points.push({x:px,z:pz});};
 add(x,z);const len=Math.hypot(t.a,t.b);if(len)add(x-t.a/len*r,z-t.b/len*r);
 for(let i=0;i<3;i++){
  const a=t.v[i],b=t.v[(i+1)%3];add(a[0],a[2]);
  const dx=b[0]-a[0],dz=b[2]-a[2],ax=a[0]-x,az=a[2]-z,A=dx*dx+dz*dz,B=2*(ax*dx+az*dz),C=ax*ax+az*az-r*r,D=B*B-4*A*C;
  if(A&&D>=0)for(const u of [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])if(u>=0&&u<=1)add(a[0]+u*dx,a[2]+u*dz);
 }
 return points.length?Math.min(...points.map(p=>t.a*p.x+t.b*p.z+t.c)):null;
}
function mushroomCeiling(m:MushroomSolid,x:number,z:number,y:number,radius:number):number|null{
 const nx=(x-m.x)/m.cap,nz=(z-m.z)/m.cap,r=radius/m.cap;
 if(Math.hypot(nx,nz)>capBounds.r+r||y>=m.base+capBounds.maxY*m.h)return null;
 const support=capRay(nx,nz);if(support&&y>=m.base+support.top*m.h-STEP_HEIGHT-.001)return null;
 let lowest=Infinity;for(const t of candidates(nx,nz,r))if(t.bottom){const h=diskMinimum(t,nx,nz,r);if(h!==null){const world=m.base+h*m.h;if(world>y+1e-7)lowest=Math.min(lowest,world);}}
 return Number.isFinite(lowest)?lowest:null;
}
function clipY(poly:V[],y:number,above:boolean):V[]{
 const out:V[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=above?a[1]>=y:a[1]<=y,bi=above?b[1]>=y:b[1]<=y;if(ai)out.push(a);if(ai!==bi){const t=(y-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,y,a[2]+(b[2]-a[2])*t]);}}return out;
}
/** Circle vs a convex horizontal slice. Outside corners use Euclidean radius, not an expanded box. */
function resolveHull(poly:P[],x:number,z:number,r:number):P{
 if(poly.length<3)return {x,z};let inside=true,best=Infinity,closest:P={x,z},normal:P={x:1,z:0};
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(len*len))),q={x:a.x+u*dx,z:a.z+u*dz},d=Math.hypot(x-q.x,z-q.z);if(cross(a,b,{x,z})<0)inside=false;if(d<best){best=d;closest=q;normal={x:dz/len,z:-dx/len};}}
 if(inside)return {x:closest.x+normal.x*(r+.001),z:closest.z+normal.z*(r+.001)};
 if(best<r){const d=best||1;return {x:closest.x+(best?(x-closest.x)/d:normal.x)*(r+.001),z:closest.z+(best?(z-closest.z)/d:normal.z)*(r+.001)};}
 return {x,z};
}
function resolveMushroom(m:MushroomSolid,x:number,z:number,y:number,radius:number,height:number):P{
 const nx=(x-m.x)/m.cap,nz=(z-m.z)/m.cap,lo=(y-m.base)/m.h,hi=(y+height-m.base)/m.h;
 if(Math.hypot(nx,nz)>capBounds.r+radius/m.cap||lo>=capBounds.maxY||hi<capBounds.minY)return {x,z};
 const ray=capRay(nx,nz);
 // Standing feet follow a local sloped surface, as on the cabin roof and terrain.
 if(ray&&y>=m.base+ray.top*m.h-STEP_HEIGHT-.001)return {x,z};
 const points:P[]=[];for(const t of triangles)if(t.maxY>=lo&&t.minY<=hi){const poly=clipY(clipY(t.v,lo,true),hi,false);for(const p of poly)points.push({x:p[0],z:p[2]});}
 const p=resolveHull(hull(points),nx,nz,radius/m.cap);return {x:m.x+p.x*m.cap,z:m.z+p.z*m.cap};
}
return {mushroomSurface,mushroomCeiling,resolveMushroom};
}
const shapes={legacy:createShape(capSource.cap),giant:createShape(studioShapes.giant),medium:createShape(studioShapes.medium),house:createShape(studioShapes.house)};
export function mushroomSurface(m:MushroomSolid,x:number,z:number,feetY:number) {return shapes[m.shapeId??'legacy'].mushroomSurface(m,x,z,feetY);}
export function mushroomCeiling(m:MushroomSolid,x:number,z:number,y:number,radius:number) {return shapes[m.shapeId??'legacy'].mushroomCeiling(m,x,z,y,radius);}
export function resolveMushroom(m:MushroomSolid,x:number,z:number,y:number,radius:number,height:number) {return shapes[m.shapeId??'legacy'].resolveMushroom(m,x,z,y,radius,height);}
export interface TreeSphere {x:number;y:number;z:number;r:number}
/** Same authoring branch centres; conservative overlapping spheres only around solid wood. */
export const ANCIENT_TREE_BRANCHES:TreeSphere[]=treeSource.branches.flatMap(branch=>branch.slice(1).flatMap((b,i)=>{
 const a=branch[i],length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),count=Math.ceil(length/.30),out:TreeSphere[]=[];
 for(let j=0;j<=count;j++){const t=j/count;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,r:a.radius+(b.radius-a.radius)*t+.025});}return out;
}));
export function ancientTreeObstacles(base:number,feetY:number,height:number):WorldObstacle[]{
 const out:WorldObstacle[]=[],rows=treeSource.trunkRows;
 for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],count=Math.ceil((b[0]-a[0])/.5);for(let j=0;j<count;j++){
  const y=a[0]+(b[0]-a[0])*j/count,top=a[0]+(b[0]-a[0])*(j+1)/count;if(base+top<=feetY||base+y>feetY+height)continue;
  const r=a[1]+(b[1]-a[1])*j/count;out.push({x:7+Math.sin(y*.12)*.12,z:43,r:r*1.045,bottom:base+y,top:base+top});
 }}
 for(const s of ANCIENT_TREE_BRANCHES){const dy=Math.max(base+s.y-(feetY+height),feetY-(base+s.y),0);if(dy<s.r)out.push({x:s.x,z:s.z,r:Math.sqrt(s.r*s.r-dy*dy),bottom:base+s.y-s.r,top:base+s.y+s.r});}
 return out;
}
export function ancientTreeCeiling(base:number,x:number,z:number,y:number,radius:number):number|null{
 let lowest=Infinity;for(const s of ANCIENT_TREE_BRANCHES){const d=Math.max(0,Math.hypot(x-s.x,z-s.z)-radius);if(d>=s.r)continue;const bottom=base+s.y-Math.sqrt(s.r*s.r-d*d);if(bottom>y)lowest=Math.min(lowest,bottom);}return Number.isFinite(lowest)?lowest:null;
}
