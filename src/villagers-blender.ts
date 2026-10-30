import { Color3, Mesh, PBRMaterial, Scene, TransformNode, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import source from '../tools/residents-v6-blender.geometry.json';
type Part={name:string;material:string;positions:number[];normals:number[];uvs:number[];indices:number[];weights:number[][][]};
type Rig={sourceSHA256:string;bones:string[];attentionMode:'head'|'whole-body'|'none';height:number;materials:Record<string,{linearColor:number[];roughness:number;metallic:number}>;meshes:Part[];clips:Record<string,{frames:number[][][]}>};
const models=(source as unknown as {roles:Record<string,Rig>}).roles;
let serial=0;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
/** The same Blender subdivided mesh, UV islands, interpolated weights and bone actions as the saved source. */
export function createBlenderResident(scene:Scene,role:string,seed:number,npcIdentity:string):TransformNode|undefined {
 const model=models[role];if(!model)return;
 const root=new TransformNode(`resident-${role}-${seed}-${++serial}`,scene),materials=new Map<string,PBRMaterial>();
 root.metadata={role,identity:npcIdentity,kind:role,originalArtwork:true,method:'Blender quad cage + local subdivision + UV + weighted rig',sourceSHA256:model.sourceSHA256,attentionMode:model.attentionMode,responseMode:model.attentionMode==='none'?'none':model.attentionMode==='head'?'head-nod':'whole-body-sway',hasWeightedRig:true,boneCount:model.bones.length};
 for(const [name,definition]of Object.entries(model.materials)){
  const m=new PBRMaterial(root.name+'-'+name,scene);m.albedoColor=new Color3(...definition.linearColor as [number,number,number]);m.roughness=definition.roughness;m.metallic=definition.metallic;
  if(definition.roughness>.65){m.sheen.isEnabled=true;m.sheen.intensity=.12;m.sheen.roughness=.9;}
  materials.set(name,m);
 }
 // Merge by actual source material, retaining every vertex's exported armature weights.
 const groups=new Map<string,Part>();
 for(const part of model.meshes){
  let group=groups.get(part.material);
  if(!group){group={name:part.material,material:part.material,positions:[],normals:[],uvs:[],indices:[],weights:[]};groups.set(part.material,group);}
  const offset=group.positions.length/3;group.positions.push(...part.positions);group.normals.push(...part.normals);group.uvs.push(...part.uvs);group.indices.push(...part.indices.map(i=>i+offset));group.weights.push(...part.weights);
 }
 const skin=[...groups.values()].map(part=>{
  const mesh=new Mesh(root.name+'-'+part.name,scene),data=new VertexData();data.positions=part.positions;data.normals=part.normals;data.uvs=part.uvs;data.indices=part.indices.slice();
  if(!scene.useRightHandedSystem)for(let i=0;i<data.indices.length;i+=3){const t=data.indices[i+1];data.indices[i+1]=data.indices[i+2];data.indices[i+2]=t;}
  data.applyToMesh(mesh,true);mesh.parent=root;mesh.material=materials.get(part.material)!;mesh.isPickable=false;mesh.receiveShadows=true;
  return {part,mesh,positions:new Float32Array(part.positions),normals:new Float32Array(part.normals)};
 });
 let life=seed*.131,response=0,target:Vector3|undefined,attention=0;
 root.metadata.lookAt=(point:Vector3)=>{target=point.clone();};
 root.metadata.respond=()=>{if(model.attentionMode!=='none')response=1.2;};
 const sample=(name:string,time:number,loop=true)=>{
  const frames=model.clips[name].frames,t=(loop?((time%1)+1)%1:Math.max(0,Math.min(1,time)))*(frames.length-1),a=Math.floor(t),b=Math.min(a+1,frames.length-1),q=t-a;
  return frames[a].map((m,bone)=>m.map((value,i)=>value+(frames[b][bone][i]-value)*q));
 };
 const observer=scene.onBeforeRenderObservable.add(()=>{
  if(!root.isEnabled())return;
  const dt=Math.min(.05,scene.getEngine().getDeltaTime()/1000||1/60);life+=dt;response=Math.max(0,response-dt);
  let aim=0;
  if(target&&model.attentionMode!=='none'){
   const p=root.getAbsolutePosition(),f=root.getDirection(Vector3.Forward());if(Vector3.Distance(p,target)<13){const d=Math.atan2(target.x-p.x,target.z-p.z)-Math.atan2(f.x,f.z);aim=Math.max(-.28,Math.min(.28,Math.atan2(Math.sin(d),Math.cos(d))));}
  }
  attention+=(aim-attention)*Math.min(1,dt*3);
  const idle=sample('idle',life*.45),look=sample(attention<0?'look_left':'look_right',0),answer=response>0?sample('respond',1-response/1.2,false):undefined;
  const matrices=idle.map((m,b)=>m.map((v,i)=>v+(look[b][i]-identity[i])*Math.abs(attention)/.28+(answer?answer[b][i]-identity[i]:0)));
  for(const {part,mesh,positions,normals}of skin){
   for(let v=0;v<part.positions.length/3;v++){
    const i=v*3,x=part.positions[i],y=part.positions[i+1],z=part.positions[i+2],nx=part.normals[i],ny=part.normals[i+1],nz=part.normals[i+2];let px=0,py=0,pz=0,tx=0,ty=0,tz=0;
    for(const [bone,weight]of part.weights[v]){const m=matrices[bone];px+=(m[0]*x+m[4]*y+m[8]*z+m[12])*weight;py+=(m[1]*x+m[5]*y+m[9]*z+m[13])*weight;pz+=(m[2]*x+m[6]*y+m[10]*z+m[14])*weight;tx+=(m[0]*nx+m[4]*ny+m[8]*nz)*weight;ty+=(m[1]*nx+m[5]*ny+m[9]*nz)*weight;tz+=(m[2]*nx+m[6]*ny+m[10]*nz)*weight;}
    positions[i]=px;positions[i+1]=py;positions[i+2]=pz;const len=Math.hypot(tx,ty,tz)||1;normals[i]=tx/len;normals[i+1]=ty/len;normals[i+2]=tz/len;
   }
   mesh.updateVerticesData(VertexBuffer.PositionKind,positions,false,false);mesh.updateVerticesData(VertexBuffer.NormalKind,normals,false,false);
  }
  root.metadata.responseActive=response>0;root.metadata.attentionYaw=attention;root.metadata.animationPhase=life;
 });
 root.onDisposeObservable.add(()=>{scene.onBeforeRenderObservable.remove(observer);materials.forEach(m=>m.dispose());});
 return root;
}
