import {Color3,Mesh,MeshBuilder,PBRMaterial,Vector3,VertexData,type AbstractMesh,type Texture,type BaseTexture} from '@babylonjs/core';
import type {World} from './world';
/** Local furniture increment: existing architectural modules and circulation stay fixed. */
export function furnishVilla(w:World,existing:AbstractMesh[],detail:(name:string,normal?:boolean)=>Texture){
 const materials:PBRMaterial[]=[],meshes:Mesh[]=[],bumps=new Map<PBRMaterial,BaseTexture>();
 const fabric=(name:string,tint:string)=>{const m=new PBRMaterial(name,w.scene);m.albedoColor=Color3.FromHexString(tint).toLinearSpace();m.roughness=.92;m.metallic=0;m.sheen.isEnabled=true;m.sheen.intensity=.16;m.sheen.roughness=.85;m.maxSimultaneousLights=4;
  const authored=existing.find(n=>n.material instanceof PBRMaterial&&n.material.name.includes('linen ivory'))?.material as PBRMaterial|undefined;m.albedoTexture=w.surfaces.fabric('#ffffff').albedoTexture;m.bumpTexture=authored?.bumpTexture??null;if(m.bumpTexture)bumps.set(m,m.bumpTexture);materials.push(m);return m;};
 const linen=fabric('V12 oatmeal upholstery','#d2c8b4'),sage=fabric('V12 woven sage','#8c9a83'),clay=fabric('V12 muted terracotta','#b58c74'),ivory=fabric('V12 fine cotton bedding','#e4ddce');
 const wood=new PBRMaterial('V12 smoked oak trim',w.scene);wood.albedoColor=Color3.FromHexString('#705840').toLinearSpace();wood.roughness=.68;wood.metallic=0;wood.albedoTexture=detail('wood');wood.bumpTexture=detail('timber',true);bumps.set(wood,wood.bumpTexture);materials.push(wood);
 const register=(m:Mesh,mat:PBRMaterial,type:string)=>{m.parent=w.root;m.material=mat;m.receiveShadows=true;m.isPickable=true;m.metadata={villa:true,villaRole:'furniture',furnitureType:type,cameraObstacle:true};meshes.push(m);w.shadows.addShadowCaster(m);return m;};
 const rounded=(name:string,at:number[],size:number[],radius:number,mat:PBRMaterial,type='cushion',yaw=0)=>{
  const pos:number[]=[],normal:number[]=[],uv:number[]=[],indices:number[]=[],n=10;
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const a=(axis+1)%3,b=(axis+2)%3,start=pos.length/3;
   for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const p=[0,0,0];p[axis]=sign*size[axis]/2;p[a]=(i/n-.5)*size[a];p[b]=(j/n-.5)*size[b];
    const q=p.map((v,k)=>Math.max(-size[k]/2+radius,Math.min(size[k]/2-radius,v))),d=p.map((v,k)=>v-q[k]),len=Math.hypot(...d)||1;
    for(let k=0;k<3;k++){pos.push(q[k]+d[k]/len*radius);normal.push(d[k]/len);}uv.push(p[a]*3,p[b]*3);
    if(i<n&&j<n){const k=start+j*(n+1)+i;const t=sign>0?[k,k+n+1,k+1,k+1,k+n+1,k+n+2]:[k,k+1,k+n+1,k+1,k+n+2,k+n+1];indices.push(...t);}
   }
  }
  const vd=new VertexData();vd.positions=pos;vd.normals=normal;vd.uvs=uv;vd.indices=indices;const m=new Mesh(name,w.scene);vd.applyToMesh(m);m.position=Vector3.FromArray(at);m.rotation.y=yaw;return register(m,mat,type);
 };
 function arc(name:string,y:number,radius:number,width:number,height:number,start:number,end:number,mat:PBRMaterial){
  const paths:Vector3[][]=[],steps=Math.ceil((end-start)*22),ring=20;
  for(let i=0;i<=ring;i++){const a=i/ring*Math.PI*2,rr=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.45)*width/2,yy=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.45)*height/2;paths.push(Array.from({length:steps+1},(_,j)=>{const t=start+(end-start)*j/steps;return new Vector3(-12+Math.cos(t)*(radius+rr),y+yy,6.7+Math.sin(t)*(radius+rr));}));}
  const m=MeshBuilder.CreateRibbon(name,{pathArray:paths,closeArray:true,sideOrientation:Mesh.DOUBLESIDE},w.scene);
  // A closed cross-section still leaves both sweep ends open. Seal each exposed
  // upholstery end using the same profile, material and draw call.
  const data=VertexData.ExtractFromMesh(m),positions=Array.from(data.positions!),normals=Array.from(data.normals!),uv=Array.from(data.uvs!),indices=Array.from(data.indices!);
  // Sweep UVs are metres along the arc/profile, rather than one stretched tile.
  const perimeter=[0];for(let i=1;i<paths.length;i++)perimeter.push(perimeter[i-1]+Vector3.Distance(paths[i][0],paths[i-1][0]));
  for(let k=0;k<positions.length/3;k++){const j=k%(steps+1),i=Math.floor(k/(steps+1))%paths.length;uv[k*2]=j/steps*(end-start)*radius*3;uv[k*2+1]=perimeter[i]*3;}
  for(const endCap of [0,steps]){
   const angle=endCap===0?start:end,sign=endCap===0?-1:1,normal=new Vector3(-Math.sin(angle)*sign,0,Math.cos(angle)*sign);
   const centre=new Vector3(-12+Math.cos(angle)*radius,y,6.7+Math.sin(angle)*radius),offset=positions.length/3;
   positions.push(...centre.asArray());normals.push(...normal.asArray());uv.push(.5,.5);
   for(let i=0;i<ring;i++){const p=paths[i][endCap];positions.push(...p.asArray());normals.push(...normal.asArray());uv.push(.5+((p.x-centre.x)*Math.cos(angle)+(p.z-centre.z)*Math.sin(angle))*3,.5+(p.y-y)*3);}
   for(let i=0;i<ring;i++){let a=offset+1+i,b=offset+1+(i+1)%ring;const pa=Vector3.FromArray(positions,a*3).subtract(centre),pb=Vector3.FromArray(positions,b*3).subtract(centre);if(Vector3.Dot(Vector3.Cross(pa,pb),normal)>0)[a,b]=[b,a];indices.push(offset,a,b);}
  }
  data.positions=positions;data.normals=normals;data.uvs=uv;data.indices=indices;data.applyToMesh(m);
  return register(m,mat,'sofa');
 }
 const replace=new Set(['F1__furniture__living__linen ivory','F1__furniture__living__moss cushion','F1__furniture__living__amber velvet','F2__furniture__bedroom__linen ivory','B1__furniture__music__linen ivory','B1__furniture__music__sea mist textile','F2__furniture__upper lounge__linen ivory','F2__furniture__upper lounge__sea mist textile']);
 for(const m of existing)if(replace.has(m.name)){m.setEnabled(false);m.isPickable=false;w.shadows.removeShadowCaster(m);}
 // Continuous curved shell, three broad tailored cushions; two dogs have room.
 arc('living tailored curved back',1.53,3.91,.37,1.0,.18,2.96,linen);
 for(let i=0;i<3;i++)arc('living thick separate seat '+i,.995,3.49,1.20,.43,.18+i*.925,.18+(i+1)*.925-.018,linen);
 for(const [i,a]of [.42,1.12,1.95,2.64].entries())rounded('living stitched scatter pillow '+i,[-12+Math.cos(a)*3.73,1.46,6.7+Math.sin(a)*3.73],[.74,.67,.22],.10,i%2?sage:clay,'pillow',Math.PI/2-a);
 for(const [i,x,z,yaw]of [[0,-8,5.1,-.45],[1,-9.2,3.4,-.25]]){
  rounded('living lounge deep seat '+i,[x,1.01,z],[1.65,.43,1.45],.16,linen,'armchair',yaw);
  const m=rounded('living lounge padded back '+i,[x+Math.sin(yaw)*.55,1.61,z+Math.cos(yaw)*.55],[1.65,1.02,.38],.17,linen,'armchair',yaw);m.rotation.x=-.08;
 }
 function sofa(name:string,x:number,z:number,floor:number,width:number){
  for(const side of [-1,1])rounded(name+' upholstered arm '+side,[x+side*(width/2-.15),floor+.96,z],[.30,1.03,1.65],.12,linen,'sofa');
  rounded(name+' padded back',[x,floor+1.08,z-.68],[width,1.0,.35],.14,linen,'sofa');
  for(const side of [-1,1]){rounded(name+' deep cushion '+side,[x+side*(width-.64)/4,floor+.64,z+.05],[(width-.68)/2,.39,1.27],.13,linen,'sofa');rounded(name+' accent pillow '+side,[x+side*(width/2-.7),floor+1.0,z-.4],[.66,.62,.22],.09,side===1?sage:clay,'pillow');}
 }
 sofa('upper lounge',.8,5.5,5.1,4);sofa('music room',13,8,-4.5,5);
 for(const [at,size]of [[[ -1.05,6.615,5.5],[.54,.075,.85]],[[-1.32,6.395,5.5],[.075,.43,.85]]]){const throwPiece=rounded('upper lounge soft arm throw',at,size,.028,sage,'throw');throwPiece.isPickable=false;throwPiece.metadata.cameraObstacle=false;throwPiece.metadata.noAccentShadow=true;w.shadows.removeShadowCaster(throwPiece);}
 // Beds retain bases, headboards, bedside tables and the original collision footprint.
 for(const [id,x,z,width,depth]of [['master',-12.7,-6.3,3.5,4.16],['guest',13.2,-9.1,3.5,4.16]] as const){
  rounded(id+' layered mattress',[x,5.82,z],[width,.47,depth],.16,ivory,'bed');
  rounded(id+' soft duvet',[x,6.055,z+.28],[width+.02,.18,depth-.8],.075,linen,'bedding');
  for(const side of [-1,1])rounded(id+' sleeping pillow '+side,[x+side*.85,6.12,z-depth/2+.50],[1.40,.26,.73],.11,ivory,'pillow');
  rounded(id+' folded foot blanket',[x,6.17,z+depth/2-.63],[width-.06,.14,.78],.05,sage,'bedding');
 }
 // A restrained music corner: slatted acoustic panel and long woven rug.
 for(let i=0;i<15;i++)rounded('music acoustic oak slat '+i,[17.50,-2.65,7+i*.29],[.10,2.6,.095],.02,wood,'acoustic-panel');
 const rug=rounded('music wool lounge rug',[13,-4.47,9.7],[6.1,.045,5.0],.02,sage,'rug');rug.isPickable=false;rug.metadata.cameraObstacle=false;
 return{meshes,setQuality(value:string){for(const[m,t]of bumps)m.bumpTexture=value==='low'?null:t;},dispose(){meshes.forEach(m=>m.dispose(false,false));materials.forEach(m=>m.dispose(false,false));}};
}
