import {Mesh,Vector3,Matrix,VertexBuffer,type AbstractMesh} from '@babylonjs/core';
/** Frozen BLOCK05 low masses only. All 27 towers, source GLB bytes and the
 * playable district remain unchanged. Uniform scale preserves the low asset's
 * proportions; every adapted vertex stays beyond the physical z=154 boundary. */
export const CITY_LOW_LAYERS=[
 {id:'west-front',bounds:[[-59,0,159.5],[-35,24,176.5]],target:[-18,0,221],scale:.7},
 {id:'east-front',bounds:[[34,0,160],[60,23,176]],target:[18,0,227],scale:.7},
 {id:'centre-middle',bounds:[[-61.5,0,195],[-36.5,28,213]],target:[0,0,205],scale:.6},
 {id:'west-middle',bounds:[[-43,0,168],[-23,31,186]],target:[-40,0,203],scale:.6},
 {id:'east-middle',bounds:[[13,0,177.5],[31,26,194.5]],target:[39,0,201],scale:.65},
 {id:'west-rear',bounds:[[-30.5,0,185],[-13.5,35,203]],target:[-22,0,243],scale:.75},
 {id:'east-rear',bounds:[[46,0,182],[72,33,202]],target:[26,0,251],scale:.7},
 {id:'centre-rear',bounds:[[25,0,201],[43,27,219]],target:[0,0,258],scale:.8},
];
type Box={min:number[];max:number[]};
function groups(points:number[][],indices:ArrayLike<number>){const parent=points.map((_,i)=>i),root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a:number,b:number)=>parent[root(a)]=root(b),same=new Map<string,number>();for(let i=0;i<points.length;i++){const key=points[i].map(v=>Math.round(v*1e4)).join(',');if(same.has(key))join(i,same.get(key)!);else same.set(key,i);}for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}const result=new Map<number,number[]>();for(let i=0;i<points.length;i++){const r=root(i),g=result.get(r)??[];g.push(i);result.set(r,g);}return [...result.values()].map(ids=>({ids,min:[0,1,2].map(k=>Math.min(...ids.map(i=>points[i][k]))),max:[0,1,2].map(k=>Math.max(...ids.map(i=>points[i][k])))}));}
function match(b:Box,material:string){return CITY_LOW_LAYERS.find(l=>{const[a,c]=l.bounds;
 if(['sky-blue','sky-sand','sky-stone'].includes(material))return[0,1,2].every(k=>Math.abs(b.min[k]-a[k])<.001&&Math.abs(b.max[k]-c[k])<.001);
 const inside=[0,2].every(k=>b.min[k]>=a[k]-.6&&b.max[k]<=c[k]+.6),height=c[1];if(!inside)return false;
 if(material==='skyline-shared-facade')return Math.abs(b.min[1]-.2)<.01&&Math.abs(b.max[1]-(height-.2))<.01;
 if(material==='stone')return b.min[1]>height-.7&&b.max[1]<height+.15&&[0,2].every(k=>Math.abs((b.min[k]+b.max[k])/2-(a[k]+c[k])/2)<.1);
 return false;
});}
export function layerCitySkyline(meshes:AbstractMesh[]){const body=new Set<string>(),counts=new Map<string,number>();for(const m of meshes){if(!(m instanceof Mesh))continue;const source=m.getVerticesData(VertexBuffer.PositionKind),indices=m.getIndices();if(!source||!indices)continue;m.computeWorldMatrix(true);const world=m.getWorldMatrix().clone(),inverse=Matrix.Invert(world),points:number[][]=[];for(let i=0;i<source.length;i+=3)points.push(Vector3.TransformCoordinates(new Vector3(source[i],source[i+1],source[i+2]),world).asArray());const out=Float32Array.from(source);let changed=false;for(const group of groups(points,indices)){const l=match(group,m.material?.name??'');if(!l)continue;if(['sky-blue','sky-sand','sky-stone'].includes(m.material?.name??''))body.add(l.id);const[a,b]=l.bounds,cx=(a[0]+b[0])/2,cz=(a[2]+b[2])/2;for(const i of group.ids){const p=points[i],target=[l.target[0]+(p[0]-cx)*l.scale,p[1]*l.scale,l.target[2]+(p[2]-cz)*l.scale];if(target[2]<154)throw Error('城市远景层次侵入可玩边界');const local=Vector3.TransformCoordinates(Vector3.FromArray(target),inverse);out[i*3]=local.x;out[i*3+1]=local.y;out[i*3+2]=local.z;}counts.set(l.id,(counts.get(l.id)??0)+group.ids.length);changed=true;}
 if(changed){m.makeGeometryUnique();m.setVerticesData(VertexBuffer.PositionKind,out,false,3);m.refreshBoundingInfo();m.computeWorldMatrix(true);}}
 if(CITY_LOW_LAYERS.some(l=>(counts.get(l.id)??0)<64))throw Error('城市低楼实体/窗面/屋顶识别不完整');
 if(body.size!==8)throw Error('冻结低楼识别不完整：'+body.size);return CITY_LOW_LAYERS.map(l=>({...l,adaptedVertices:counts.get(l.id)??0,minimumZ:l.target[2]-(l.bounds[1][2]-l.bounds[0][2])/2*l.scale}));}
