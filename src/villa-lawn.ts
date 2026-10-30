import {Color3,Mesh,MeshBuilder,PBRMaterial,Texture,Vector3,VertexBuffer,VertexData,type AbstractMesh,type BaseTexture,type Scene} from '@babylonjs/core';
import {COURTYARD_WALLS,HOME_FOREST,homePathDistance} from './villa-site';
import type {World} from './world';
/** Home-only texture wrappers: cached source grass and other regions remain untouched. */
export function villaLawn(scene:Scene){
 const material=new PBRMaterial('home fine trimmed grass',scene),textures:BaseTexture[]=[];
 const map=(name:string)=>{const t=new Texture(name==='albedo'?'/assets/environment/v14/home-lawn-albedo.jpg':'/assets/environment/cc0/grass_ground-'+name+'.jpg',scene);t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;t.anisotropicFilteringLevel=8;textures.push(t);return t;};
 material.albedoTexture=map('albedo');material.albedoColor=Color3.White();
 material.bumpTexture=map('normal');material.bumpTexture.gammaSpace=false;material.bumpTexture.level=.13;
 material.metallicTexture=map('arm');material.metallicTexture.gammaSpace=false;material.useRoughnessFromMetallicTextureAlpha=false;material.useRoughnessFromMetallicTextureGreen=true;material.useMetallnessFromMetallicTextureBlue=true;material.useAmbientOcclusionFromMetallicTextureRed=true;
 material.metallic=0;material.roughness=1;material.environmentIntensity=.42;material.maxSimultaneousLights=4;
 function apply(mesh:AbstractMesh){const p=mesh.getVerticesData(VertexBuffer.PositionKind);if(!p)return;const uv=new Float32Array(p.length/3*2),colors=new Float32Array(p.length/3*4),matrix=mesh.computeWorldMatrix(true),v=new Vector3();
  for(let i=0,j=0,k=0;i<p.length;i+=3,j+=2,k+=4){Vector3.TransformCoordinatesFromFloatsToRef(p[i],p[i+1],p[i+2],matrix,v);uv[j]=v.x/3.6;uv[j+1]=v.z/3.6;const outside=Math.min(1,Math.max(0,-40-v.x,v.x-46,-38-v.z,v.z-48)/24),variation=1+.025*Math.sin(v.x*.17)*Math.cos(v.z*.13);colors.set([variation*(1-outside*.13),variation*(1-outside*.20),variation*(1-outside*.13),1],k);}
  if(mesh instanceof Mesh)mesh.makeGeometryUnique();mesh.setVerticesData(VertexBuffer.UVKind,uv);mesh.setVerticesData(VertexBuffer.ColorKind,colors);mesh.material=material;mesh.metadata={...mesh.metadata,homeLawn:true};
 }
 return{apply,dispose(){material.dispose(false,false);textures.forEach(t=>t.dispose());}};
}
/** Sparse, static edge tufts. One mesh/atlas, no collision, animation or shadow caster. */
export function buildLawnEdges(world:World){
 const positions:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];let index=0;
 const points:number[][]=[];
 for(const [i,w]of COURTYARD_WALLS.entries()){if(i%2||w.kind==='grille')continue;const[x,,z]=w.center,dx=x===-38?1:x===43?-1:0,dz=z===-35?1:z===46?-1:0;for(let k=0;k<3;k++)points.push([x+dx*(.8+k*.17)+dz*(k-1)*.36,z+dz*(.8+k*.17)+dx*(k-1)*.36]);}
 for(const t of HOME_FOREST.filter((_,i)=>i%16===0))for(let k=0;k<3;k++)points.push([t.x+Math.cos(k*2.1)*1.1,t.z+Math.sin(k*2.1)*1.1]);
 for(const [i,[x,z]]of points.entries()){if(homePathDistance(x,z)<1.8)continue;const h=.14+(i%4)*.025,w=.32;for(let a=0;a<3;a++){const angle=a*Math.PI/3+i,dx=Math.cos(angle)*w/2,dz=Math.sin(angle)*w/2,n=positions.length/3;positions.push(x-dx,.26,z-dz,x+dx,.26,z+dz,x+dx,.26+h,z+dz,x-dx,.26+h,z-dz);uvs.push(0,1,1,1,1,0,0,0);indices.push(n,n+1,n+2,n,n+2,n+3);for(let j=0;j<4;j++)normals.push(0,1,0);}index++;}
 const mesh=new Mesh('home sparse static grass edges',world.scene),data=new VertexData();data.positions=positions;data.indices=indices;data.uvs=uvs;data.normals=normals;data.applyToMesh(mesh);mesh.parent=world.root;mesh.material=world.surfaces.foliage('grass-blades','#b6c7a1');mesh.isPickable=false;mesh.receiveShadows=false;mesh.metadata={cameraObstacle:false,homeLawnEdge:true,tufts:index};return mesh;
}
