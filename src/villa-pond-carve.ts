import {Mesh,Vector3,VertexBuffer,VertexData,type AbstractMesh} from '@babylonjs/core';
import {POND_EDGE,HOME_POND} from './villa-pond-layout';
type V={world:number[];values:number[]};
/** Subtract a convex opening from the existing lawn triangles, interpolating
 * the existing UVs/normals/colors. Other excavations and source geometry survive. */
export function carvePondOpening(mesh:AbstractMesh){
 if(!(mesh instanceof Mesh)||!mesh.metadata?.homeLawn)return;
 const p=mesh.getVerticesData(VertexBuffer.PositionKind),old=mesh.getIndices();if(!p||!old)return;
 const kinds=[VertexBuffer.PositionKind,VertexBuffer.NormalKind,VertexBuffer.UVKind,VertexBuffer.ColorKind],strides=[3,3,2,4];
 const data=kinds.map((k,i)=>mesh.getVerticesData(k)??Array(p.length/3*strides[i]).fill(k===VertexBuffer.ColorKind?1:0));
 const matrix=mesh.computeWorldMatrix(true),vertices:V[]=Array.from({length:p.length/3},(_,i)=>{const v=Vector3.TransformCoordinates(Vector3.FromArray(p,i*3),matrix);return{world:[v.x,v.y,v.z],values:data.flatMap((d,k)=>Array.from(d.slice(i*strides[k],(i+1)*strides[k])))};});
 const output:number[][]=[[],[],[],[]],indices:number[]=[];
 const mix=(a:V,b:V,t:number):V=>({world:a.world.map((n,i)=>n+(b.world[i]-n)*t),values:a.values.map((n,i)=>n+(b.values[i]-n)*t)});
 const emit=(poly:V[])=>{for(let i=1;i+1<poly.length;i++){for(const v of [poly[0],poly[i],poly[i+1]]){let at=0;strides.forEach((n,k)=>{output[k].push(...v.values.slice(at,at+n));at+=n;});indices.push(indices.length);}}};
 const cut=(poly:V[],a:number[],b:number[],inside:boolean)=>{const next:V[]=[],distance=(v:V)=>(b[0]-a[0])*(v.world[2]-a[2])-(b[2]-a[2])*(v.world[0]-a[0]);
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const u=poly[j],v=poly[i],du=distance(u),dv=distance(v),iu=inside?du>=-1e-8:du<=1e-8,iv=inside?dv>=-1e-8:dv<=1e-8;if(iu!==iv)next.push(mix(u,v,du/(du-dv)));if(iv)next.push(v);}return next;};
 for(let i=0;i<old.length;i+=3){const poly=[vertices[old[i]],vertices[old[i+1]],vertices[old[i+2]]],xs=poly.map(v=>v.world[0]),zs=poly.map(v=>v.world[2]);
  if(poly.some(v=>Math.abs(v.world[1]-.26)>.015)||Math.max(...xs)<HOME_POND.x-HOME_POND.rx||Math.min(...xs)>HOME_POND.x+HOME_POND.rx||Math.max(...zs)<HOME_POND.z-HOME_POND.rz||Math.min(...zs)>HOME_POND.z+HOME_POND.rz){emit(poly);continue;}
  let remaining=poly;for(let j=0;j<POND_EDGE.length&&remaining.length>=3;j++){const a=POND_EDGE[j],b=POND_EDGE[(j+1)%POND_EDGE.length];emit(cut(remaining,a,b,false));remaining=cut(remaining,a,b,true);}
 }
 mesh.makeGeometryUnique();const d=new VertexData();[d.positions,d.normals,d.uvs,d.colors]=output;d.indices=indices;d.applyToMesh(mesh);mesh.refreshBoundingInfo();mesh.metadata={...mesh.metadata,pondOpening:true};
}
