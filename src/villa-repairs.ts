export {isRetiredVillaPart} from './villa-repair-data';
import {LANDING_GUARDS,UPPER_STAIR_JOINTS,UPPER_VOID_GUARD,TREE_LANDING_GUARD,ATRIUM_THRESHOLD} from './villa-repair-data';

import {Color3,MeshBuilder,PBRMaterial,Vector3,VertexBuffer,type AbstractMesh} from '@babylonjs/core';
import type {World} from './world';
export function repairVillaSurfaces(w:World,meshes:AbstractMesh[]){
 const owned:PBRMaterial[]=[];
 const glass=new PBRMaterial('V13 stair safety glass',w.scene);glass.albedoColor=Color3.FromHexString('#a4c4c6').toLinearSpace();glass.metallic=0;glass.roughness=.23;glass.alpha=.32;glass.backFaceCulling=false;glass.twoSidedLighting=true;glass.maxSimultaneousLights=4;owned.push(glass);
 const metal=new PBRMaterial('V13 matching bronze rail',w.scene);metal.albedoColor=Color3.FromHexString('#363e3c').toLinearSpace();metal.metallic=.65;metal.roughness=.48;owned.push(metal);
 const add=(name:string,at:number[],size:number[],material:PBRMaterial)=>{const m=MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},w.scene);m.position=Vector3.FromArray(at);m.parent=w.root;m.material=material;m.isPickable=true;m.metadata={villa:true,villaRole:material===glass?'glass':'railing',cameraObstacle:true};m.receiveShadows=material!==glass;if(material!==glass)w.shadows.addShadowCaster(m);meshes.push(m);return m;};
 for(const guard of LANDING_GUARDS){const[x,y,z]=guard.center;
  add(guard.id+' glass',[x,y,z],[1.08,1.21,.035],glass);
  add(guard.id+' continuous handrail',[x,y+.74,z],[1.3,.065,.065],metal);
  for(const side of [-1,1]){add(guard.id+' connecting post '+side,[x+side*.56,y,z],[.055,1.4,.055],metal);for(const h of [-.47,.47])add(guard.id+' glass clamp',[x+side*.52,y+h,z],[.065,.07,.085],metal);}
 }
 const upper=UPPER_VOID_GUARD,[ux,uy,uz]=upper.center;
 add(upper.id+' glass',[ux,uy,uz],[2.88,1.21,.035],glass);
 add(upper.id+' continuous handrail',[ux,uy+.70,uz],[3.08,.065,.065],metal);
 for(let i=0;i<=3;i++){const x=6.8+i;add(upper.id+' full-height post '+i,[x,uy,uz],[.065,1.4,.065],metal);for(const h of [-.47,.47])add(upper.id+' clamp '+i+' '+h,[x,uy+h,uz],[.085,.075,.09],metal);}
 const stairMetal=meshes.find(m=>m.name==='F1__railing__F1 ascending flight B__deep bronze')?.material as PBRMaterial??metal;
 for(const joint of UPPER_STAIR_JOINTS){const[x,y,z]=joint.center;
  add(joint.id+' grounded post',joint.center,[.085,1.44,.085],stairMetal);
  add(joint.id+' rail elbow seat',[x,y+.68,z],[.13,.085,.14],stairMetal);
  add(joint.id+' stone fixing foot',[x,y-.69,z],[.15,.055,.15],stairMetal);
  for(const h of [-.47,.42])add(joint.id+' glass clamp '+h,[x,y+h,z],[.11,.075,.10],stairMetal);
 }
 const stairStone=meshes.find(m=>m.metadata?.villaRole==='stairs')?.material as PBRMaterial;
 if(stairStone){const sill=add(ATRIUM_THRESHOLD.id,ATRIUM_THRESHOLD.center,ATRIUM_THRESHOLD.size,stairStone);sill.metadata.villaRole='stairs';}
 const treeMetal=meshes.find(m=>m.name==='tree__railing__tree landing__deep bronze')?.material as PBRMaterial??metal;
 const guard=TREE_LANDING_GUARD;add(guard.id+' cap',[30,11.3,25.43],[3.6,.065,.095],treeMetal);
 for(let i=0;i<=12;i++)add(guard.id+' upright '+i,[28.25+i*3.5/12,10.62,25.43],[i===0||i===12?.085:.045,1.44,.055],treeMetal);
 const lampMetal=meshes.find(m=>m.name==='site__fixture__tree lamps__deep bronze')?.material as PBRMaterial??metal;
 add('V14 tree entrance lantern grounded post',[20.9,1.38,13.3],[.09,2.24,.09],lampMetal);
 add('V14 tree entrance lantern grounded foot',[20.9,.30,13.3],[.32,.08,.32],lampMetal);
 // One shared CC0 bark set; project both sides of the V12 join in world metres.
 const bark=w.surfaces.surface('bark','#eee1cf');bark.roughness=.92;bark.bumpTexture!.level=.30;
 for(const mesh of meshes){if(!['trunk','branch'].includes(mesh.metadata?.villaRole))continue;mesh.material=bark;
  const p=mesh.getVerticesData(VertexBuffer.PositionKind),old=mesh.getVerticesData(VertexBuffer.NormalKind);if(!p)continue;const matrix=mesh.computeWorldMatrix(true),uv=new Float32Array(p.length/3*2),norm=old?new Float32Array(old):null;
  for(let i=0,j=0;i<p.length;i+=3,j+=2){const q=Vector3.TransformCoordinates(Vector3.FromArray(p,i),matrix);uv[j]=(Math.atan2(q.z-15,q.x-31)+Math.PI)/Math.PI*3;uv[j+1]=q.y/4.5;
   if(norm&&mesh.metadata.villaRole==='trunk'&&q.y>4.8&&q.y<5.81&&Math.abs(norm[i+1])<.8){const radial=new Vector3(q.x-31,.25*Math.hypot(q.x-31,q.z-15),q.z-15).normalize();const local=Vector3.TransformNormal(radial,matrix.clone().invert()).normalize();const blend=1-Math.min(1,Math.abs(q.y-5.3)/.51);for(let k=0;k<3;k++)norm[i+k]=norm[i+k]*(1-blend)+[local.x,local.y,local.z][k]*blend;}
  }mesh.setVerticesData(VertexBuffer.UVKind,uv);if(norm)mesh.setVerticesData(VertexBuffer.NormalKind,norm);
 }
 return{dispose(){owned.forEach(m=>m.dispose(false,false));}};
}
