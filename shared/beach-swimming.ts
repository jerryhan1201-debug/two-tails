import geometry from './beach-swim-geometry.json';
/** Frozen world-LH RC3 geometry. No transforms or visual-water support planes. */
export const BEACH='studio-tideglass-cove',BEACH_WATER='cove-swim-basin';
type V=number[];
type Solid={id:string;bounds:number[][];vertices:number[][];indices:number[][]};
type Face={v:V[];bounds:number[]};
const solids=geometry.swimSolids as Solid[],byId=new Map(solids.map(s=>[s.id,s]));
const cellSize=geometry.swimSpatialIndex.cellSize;
const sourceCells=geometry.swimSpatialIndex.cells as unknown as Record<string,[string,number][]>;
const faces=new Map<Solid,Face[]>(),rays=new Map<Solid,Map<string,Face[]>>();
const bounds=(v:V[])=>[Math.min(...v.map(p=>p[0])),Math.max(...v.map(p=>p[0])),Math.min(...v.map(p=>p[1])),Math.max(...v.map(p=>p[1])),Math.min(...v.map(p=>p[2])),Math.max(...v.map(p=>p[2]))];
for(const s of solids){const ff=s.indices.map(i=>{const v=i.map(j=>s.vertices[j]);return{v,bounds:bounds(v)};}),rr=new Map<string,Face[]>();faces.set(s,ff);rays.set(s,rr);
 for(const f of ff)for(let y=Math.floor(f.bounds[2]/cellSize);y<=Math.floor(f.bounds[3]/cellSize);y++)for(let z=Math.floor(f.bounds[4]/cellSize);z<=Math.floor(f.bounds[5]/cellSize);z++){const k=y+','+z,a=rr.get(k)??[];a.push(f);rr.set(k,a);}}
const cells=new Map(Object.entries(sourceCells).map(([key,pairs])=>[key,pairs.map(([id,i])=>faces.get(byId.get(id)!)![i])]));
const clip=(poly:V[],level:number,above:boolean)=>{const out:V[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=above?a[1]>=level:a[1]<=level,bi=above?b[1]>=level:b[1]<=level;if(ai)out.push(a);if(ai!==bi){const t=(level-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),level,a[2]+t*(b[2]-a[2])]);}}return out;};
function circleHits(poly:V[],x:number,z:number,r:number){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;const dx=b[0]-a[0],dz=b[2]-a[2],len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/len)):0;if((x-a[0]-t*dx)**2+(z-a[2]-t*dz)**2<r*r-1e-10)return true;}return inside;}
function insideSolid(s:Solid,x:number,y:number,z:number){const hits:number[]=[];for(const{v:[a,b,c]}of rays.get(s)!.get(Math.floor(y/cellSize)+','+Math.floor(z/cellSize))??[]){const d=(b[2]-c[2])*(a[1]-c[1])+(c[1]-b[1])*(a[2]-c[2]);if(Math.abs(d)<1e-10)continue;const u=((b[2]-c[2])*(y-c[1])+(c[1]-b[1])*(z-c[2]))/d,v=((c[2]-a[2])*(y-c[1])+(a[1]-c[1])*(z-c[2]))/d,q=u*a[0]+v*b[0]+(1-u-v)*c[0];if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9&&q>x+1e-9&&!hits.some(h=>Math.abs(h-q)<1e-7))hits.push(q);}return hits.length%2===1;}
export function beachCollision(x:number,y:number,z:number,r=1.75,h=1.53){
 const candidates=new Set<Face>();
 for(let a=Math.floor((x-r)/cellSize);a<=Math.floor((x+r)/cellSize);a++)for(let b=Math.floor(y/cellSize);b<=Math.floor((y+h)/cellSize);b++)for(let c=Math.floor((z-r)/cellSize);c<=Math.floor((z+r)/cellSize);c++)for(const f of cells.get(a+','+b+','+c)??[])candidates.add(f);
 for(const f of candidates){const b=f.bounds;if(b[3]<y||b[2]>y+h||b[1]<x-r||b[0]>x+r||b[5]<z-r||b[4]>z+r)continue;const poly=clip(clip(f.v,y,true),y+h,false);if(poly.length&&circleHits(poly,x,z,r))return true;}
 for(const s of solids){const[a,b]=s.bounds;if(x>a[0]&&x<b[0]&&y+h/2>a[1]&&y+h/2<b[1]&&z>a[2]&&z<b[2]&&insideSolid(s,x,y+h/2,z))return true;}
 return false;
}
const volume=geometry.swimVolumes[0].bounds;
export function beachFootprint(x:number,z:number,r=0){return x-r>=volume[0][0]&&x+r<=volume[1][0]&&z-r>=volume[0][2]&&z+r<=volume[1][2];}
export function beachBodyLegal(x:number,y:number,z:number,r=1.75,h=1.53){
 if(![x,y,z,r,h].every(Number.isFinite)||r<0||h<0||!beachFootprint(x,z,r)||y<volume[0][1]||y>-.7+1e-8||y+h>geometry.hostSurfacePolicy.surfaceBodyTopY+1e-8)return false;
 return !beachCollision(x,y,z,r,h);
}
/** Camera clearance is physical; the eye may cross the real water surface. */
export const beachCameraLegal=(x:number,y:number,z:number)=>beachFootprint(x,z,.2)&&y>=-6&&y<=1&&!beachCollision(x,y-.2,z,.2,.4);
type FloorFace=Face&{gx:number;gz:number;constant:number};
const floorCells=new Map<string,FloorFace[]>();
for(const v of geometry.floorTriangles){const[a,b,c]=v,det=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);if(Math.abs(det)<1e-10)continue;const gx=((b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]))/det,gz=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/det,f={v,bounds:bounds(v),gx,gz,constant:a[1]-gx*a[0]-gz*a[2]};for(let x=Math.floor(f.bounds[0]/4);x<=Math.floor(f.bounds[1]/4);x++)for(let z=Math.floor(f.bounds[4]/4);z<=Math.floor(f.bounds[5]/4);z++){const k=x+','+z,a=floorCells.get(k)??[];a.push(f);floorCells.set(k,a);}}
function inTriangle(v:V[],x:number,z:number){const[a,b,c]=v,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;return u>=-1e-8&&w>=-1e-8&&u+w<=1+1e-8;}
/** Exact maximum of each source triangle over the complete circular footprint.
 * Vertices, edge/circle intersections and the plane-gradient circle extremum
 * exhaust the extrema. There are no four-point or centre-only floor samples. */
export function beachFloorMaximum(x:number,z:number,r=1.75):number|null{
 const candidates=new Set<FloorFace>();for(let a=Math.floor((x-r)/4);a<=Math.floor((x+r)/4);a++)for(let b=Math.floor((z-r)/4);b<=Math.floor((z+r)/4);b++)for(const f of floorCells.get(a+','+b)??[])candidates.add(f);
 let max=-Infinity;for(const f of candidates){const b=f.bounds;if(b[1]<x-r||b[0]>x+r||b[5]<z-r||b[4]>z+r)continue;
  const add=(px:number,pz:number)=>{max=Math.max(max,f.gx*px+f.gz*pz+f.constant);};
  if(inTriangle(f.v,x,z))add(x,z);
  const length=Math.hypot(f.gx,f.gz);if(length>1e-12){const px=x+r*f.gx/length,pz=z+r*f.gz/length;if(inTriangle(f.v,px,pz))add(px,pz);}
  for(let i=0;i<3;i++){const a=f.v[i],b=f.v[(i+1)%3],ax=a[0]-x,az=a[2]-z,dx=b[0]-a[0],dz=b[2]-a[2],aa=dx*dx+dz*dz,bb=2*(ax*dx+az*dz),cc=ax*ax+az*az-r*r;if(cc<=1e-10)add(a[0],a[2]);const disc=bb*bb-4*aa*cc;if(aa>1e-12&&disc>=0)for(const t of[(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>=0&&t<=1)add(a[0]+t*dx,a[2]+t*dz);}
 }
 return Number.isFinite(max)?max:null;
}
export function beachColumn(x:number,z:number,r=1.75){
 if(!beachFootprint(x,z,r))return null;const floor=beachFloorMaximum(x,z,r);if(floor===null||floor>-.78+1e-8)return null;
 // The upper-air cap belongs only to the fixed surface pose, not arbitrary flight.
 if(!beachBodyLegal(x,-.7,z,r))return null;
 return{id:BEACH_WATER as typeof BEACH_WATER,surface:0,floor,surfaceFeet:-.7,minFeet:floor+.08,maxFeet:-.7,dive:floor<=-1.59};
}
export function beachSwimmingLegal(x:number,y:number,z:number){const c=beachColumn(x,z);return !!c&&y>=c.minFeet-.001&&y<=c.maxFeet+.001&&beachBodyLegal(x,y,z);}
