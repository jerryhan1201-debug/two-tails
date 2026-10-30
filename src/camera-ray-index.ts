import{Matrix,Ray,Vector3,VertexBuffer,type AbstractMesh,type Geometry,type Mesh}from'@babylonjs/core';
type Group={start:number;end:number;min:Vector3;max:Vector3};
type Index={positions:ArrayLike<number>;indices:ArrayLike<number>;groups:Group[]};
const cache=new WeakMap<Geometry,Index>();
const local=new Ray(Vector3.Zero(),Vector3.Zero()),inverse=Matrix.Identity(),a=Vector3.Zero(),b=Vector3.Zero(),c=Vector3.Zero(),point=Vector3.Zero();
/** Exact triangles in small contiguous bounds; no proxy walls, new draw calls or
 * copied geometry. Thin instances retain Babylon's per-instance picking path. */
export function cameraRayDistance(ray:Ray,mesh:AbstractMesh):number|null{
 const m=mesh as Mesh,g=m.geometry;
 if(!g||m.hasThinInstances||m.skeleton||m.morphTargetManager||g.getTotalIndices()<384){const hit=ray.intersectsMesh(mesh,false);return hit.hit?hit.distance:null;}
 let index=cache.get(g);
 if(!index){const p=g.getVerticesData(VertexBuffer.PositionKind),ii=g.getIndices();if(!p||!ii)return null;
  const groups:Group[]=[];for(let start=0;start<ii.length;start+=192){const end=Math.min(start+192,ii.length),min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
   for(let j=start;j<end;j++){const v=ii[j]*3;min.x=Math.min(min.x,p[v]);min.y=Math.min(min.y,p[v+1]);min.z=Math.min(min.z,p[v+2]);max.x=Math.max(max.x,p[v]);max.y=Math.max(max.y,p[v+1]);max.z=Math.max(max.z,p[v+2]);}groups.push({start,end,min,max});
  }index={positions:p,indices:ii,groups};cache.set(g,index);
 }
 mesh.getWorldMatrix().invertToRef(inverse);Ray.TransformToRef(ray,inverse,local);let closest=local.length,found=false;
 const{positions:p,indices:ii}=index;
 for(const block of index.groups){if(!local.intersectsBoxMinMax(block.min,block.max))continue;
  for(let k=block.start;k<block.end;k+=3){Vector3.FromArrayToRef(p,ii[k]*3,a);Vector3.FromArrayToRef(p,ii[k+1]*3,b);Vector3.FromArrayToRef(p,ii[k+2]*3,c);const hit=local.intersectsTriangle(a,b,c);if(hit&&hit.distance>=0&&hit.distance<=closest){closest=hit.distance;found=true;}}
 }
 if(!found)return null;local.direction.scaleToRef(closest,point);point.addInPlace(local.origin);Vector3.TransformCoordinatesToRef(point,mesh.getWorldMatrix(),point);return Vector3.Distance(ray.origin,point);
}
