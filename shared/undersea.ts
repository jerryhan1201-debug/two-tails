import data from './undersea-geometry.json';
export const UNDERSEA='studio-undersea-atlantis';
type V=number[];
type Solid={id:string;bounds:number[][];vertices:number[][];indices:number[][]};
const solids=data.swimSolids as Solid[],byId=new Map(solids.map(s=>[s.id,s]));
const cells=data.spatialIndex.cells as Record<string,string[]>;
const size=data.spatialIndex.cellSizeMetres;
export const underseaStats={queries:0,solids:0,triangles:0};
const clip=(poly:V[],level:number,above:boolean)=>{const out:V[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=above?a[1]>=level:a[1]<=level,bi=above?b[1]>=level:b[1]<=level;if(ai)out.push(a);if(ai!==bi){const t=(level-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),level,a[2]+t*(b[2]-a[2])]);}}return out;};
function polygonHits(poly:V[],x:number,z:number,r:number){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;const dx=b[0]-a[0],dz=b[2]-a[2],len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/len)):0;if((x-a[0]-t*dx)**2+(z-a[2]-t*dz)**2<r*r-1e-10)return true;}return inside;}
type Triangle={v:V[];bounds:number[]};
type Detail={triangles:Triangle[];cells:Map<string,Triangle[]>;rays:Map<string,Triangle[]>};
const details=new Map<Solid,Detail>(),detailSize=2;
function solidDetail(s:Solid){let d=details.get(s);if(d)return d;d={triangles:[],cells:new Map(),rays:new Map()};for(const ids of s.indices){const v=ids.map(i=>s.vertices[i]),bounds=[Math.min(v[0][0],v[1][0],v[2][0]),Math.max(v[0][0],v[1][0],v[2][0]),Math.min(v[0][1],v[1][1],v[2][1]),Math.max(v[0][1],v[1][1],v[2][1]),Math.min(v[0][2],v[1][2],v[2][2]),Math.max(v[0][2],v[1][2],v[2][2])],t={v,bounds};d.triangles.push(t);for(let y=Math.floor(bounds[2]/detailSize);y<=Math.floor(bounds[3]/detailSize);y++)for(let z=Math.floor(bounds[4]/detailSize);z<=Math.floor(bounds[5]/detailSize);z++){const ray=y+','+z;let r=d.rays.get(ray);if(!r)d.rays.set(ray,r=[]);r.push(t);for(let x=Math.floor(bounds[0]/detailSize);x<=Math.floor(bounds[1]/detailSize);x++){const key=x+','+ray;let list=d.cells.get(key);if(!list)d.cells.set(key,list=[]);list.push(t);}}}details.set(s,d);return d;}
function triangleCandidates(d:Detail,x:number,y:number,z:number,r:number,h:number){const result=new Set<Triangle>();for(let a=Math.floor((x-r)/detailSize);a<=Math.floor((x+r)/detailSize);a++)for(let b=Math.floor(y/detailSize);b<=Math.floor((y+h)/detailSize);b++)for(let c=Math.floor((z-r)/detailSize);c<=Math.floor((z+r)/detailSize);c++)for(const t of d.cells.get(a+','+b+','+c)??[])result.add(t);return result;}
function insideSolid(s:Solid,x:number,y:number,z:number){let inside=false;for(const {v:[a,b,c]} of solidDetail(s).rays.get(Math.floor(y/detailSize)+','+Math.floor(z/detailSize))??[]){const d=(b[2]-c[2])*(a[1]-c[1])+(c[1]-b[1])*(a[2]-c[2]);if(Math.abs(d)<1e-10)continue;const u=((b[2]-c[2])*(y-c[1])+(c[1]-b[1])*(z-c[2]))/d,v=((c[2]-a[2])*(y-c[1])+(a[1]-c[1])*(z-c[2]))/d;if(u>=0&&v>=0&&u+v<1&&u*a[0]+v*b[0]+(1-u-v)*c[0]>x)inside=!inside;}return inside;}
// Build the bounded immutable triangle index before a player approaches a mesh.
// The authored 8m index still selects solids; this second index narrows exact
// triangle and closed-solid ray queries without changing their equations.
for(const s of solids)solidDetail(s);
export function underseaCandidates(x:number,y:number,z:number,r:number,h:number){const ids=new Set<string>();for(let a=Math.floor((x-r)/size);a<=Math.floor((x+r)/size);a++)for(let b=Math.floor(y/size);b<=Math.floor((y+h)/size);b++)for(let c=Math.floor((z-r)/size);c<=Math.floor((z+r)/size);c++)for(const id of cells[a+','+b+','+c]??[])ids.add(id);return [...ids].map(id=>byId.get(id)!).filter(s=>s&&x+r>=s.bounds[0][0]&&x-r<=s.bounds[1][0]&&y+h>=s.bounds[0][1]&&y<=s.bounds[1][1]&&z+r>=s.bounds[0][2]&&z-r<=s.bounds[1][2]);}
/** A closed indexed boundary clipped across the complete visible swim envelope.
 * No solid transforms, AABB walls, height samples, or standing-floor exemptions. */
export function underseaCollision(x:number,y:number,z:number,r=1.75,h=1.53):string|null{
 underseaStats.queries++;for(const s of underseaCandidates(x,y,z,r,h)){underseaStats.solids++;for(const {v:tri,bounds:b} of triangleCandidates(solidDetail(s),x,y,z,r,h)){if(b[3]<y||b[2]>y+h||b[1]<x-r||b[0]>x+r||b[5]<z-r||b[4]>z+r)continue;underseaStats.triangles++;const poly=clip(clip(tri,y,true),y+h,false);if(poly.length&&polygonHits(poly,x,z,r))return s.id;}if(x>s.bounds[0][0]&&x<s.bounds[1][0]&&y+h/2>s.bounds[0][1]&&y+h/2<s.bounds[1][1]&&z>s.bounds[0][2]&&z<s.bounds[1][2]&&insideSolid(s,x,y+h/2,z))return s.id;}return null;
}
type Rect=[number,number,number,number];
function subtract(a:Rect,b:Rect):Rect[]{const lx=Math.max(a[0],b[0]),hx=Math.min(a[1],b[1]),lz=Math.max(a[2],b[2]),hz=Math.min(a[3],b[3]);if(lx>=hx||lz>=hz)return[a];return [[a[0],lx,a[2],a[3]],[hx,a[1],a[2],a[3]],[lx,hx,a[2],lz],[lx,hx,hz,a[3]]].filter(v=>v[0]<v[1]&&v[2]<v[3]) as Rect[];}
// The tilted cabin water is fully contained by coral-branch-water. Validate
// that exact convex containment before simplifying all seven volumes to this
// AABB union; no authored water is discarded. Forbidden volumes are frozen empty.
const boxes=data.swimVolumes.filter(v=>v.type==='AABB');
for(const v of data.swimVolumes.filter(v=>v.type==='convex'))if(!boxes.some(b=>v.vertices!.every(p=>p.every((n,i)=>n>=b.bounds![0][i]&&n<=b.bounds![1][i]))))throw Error('海底水域契约变更：需要重验凸体并集');
if(data.forbiddenVolumes.length)throw Error('海底禁游体积契约变更：需要重验');
/** Exact union coverage for a cylinder, including the narrow overlapping ports:
 * split at authored Y levels, subtract rectangles, test uncovered circle area. */
export function underseaWaterContains(x:number,y:number,z:number,r=1.75,h=1.53){
 if(![x,y,z,r,h].every(Number.isFinite)||r<0||h<0)return false;
 const levels=[y,y+h,...boxes.flatMap(v=>v.bounds!.map(b=>b[1])).filter(v=>v>y&&v<y+h)].sort((a,b)=>a-b);
 for(let i=1;i<levels.length;i++){const lo=levels[i-1],hi=levels[i];let gaps:Rect[]=[[x-r,x+r,z-r,z+r]];for(const v of boxes){const[a,b]=v.bounds!;if(a[1]>lo+1e-9||b[1]<hi-1e-9)continue;gaps=gaps.flatMap(g=>subtract(g,[a[0],b[0],a[2],b[2]]));}if(gaps.some(g=>{const dx=Math.max(g[0]-x,0,x-g[1]),dz=Math.max(g[2]-z,0,z-g[3]);return dx*dx+dz*dz<r*r-1e-10||r===0&&x>=g[0]&&x<=g[1]&&z>=g[2]&&z<=g[3];}))return false;}
 return true;
}
export const underseaLegal=(x:number,y:number,z:number,r=1.75,h=1.53)=>underseaWaterContains(x,y,z,r,h)&&!underseaCollision(x,y,z,r,h);
export function underseaColumn(x:number,z:number,r=1.75){const found=boxes.filter(v=>x+r>=v.bounds![0][0]&&x-r<=v.bounds![1][0]&&z+r>=v.bounds![0][2]&&z-r<=v.bounds![1][2]);if(!found.length)return null;const floor=Math.min(...found.map(v=>v.bounds![0][1])),maxFeet=Math.max(...found.map(v=>v.bounds![1][1]))-1.53;return {id:'atlantis-water' as const,surface:0,floor,surfaceFeet:maxFeet,minFeet:floor,maxFeet,dive:true};}
export const underseaArrival={x:-8,y:-9,z:-49};
export function underseaPair(role:'gold'|'white',at=underseaArrival){return {x:at.x+(role==='gold'?-2:2),y:at.y,z:at.z};}
