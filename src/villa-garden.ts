import {Color3,DynamicTexture,MeshBuilder,PBRMaterial,StandardMaterial,Texture,Vector3} from '@babylonjs/core';
import {COURTYARD_WALLS,WALL_LIGHTS,HOME_FOREST_PATH} from './villa-site';
import type {World} from './world';
import type {villaFinishes} from './villa-materials';
export function buildHomeGarden(w:World,finishes:ReturnType<typeof villaFinishes>){
 const wallMaterial=new PBRMaterial('home boundary plaster',w.scene);wallMaterial.albedoColor=Color3.FromHexString('#e1ded3').toLinearSpace();wallMaterial.metallic=0;
 const bronze=new PBRMaterial('home boundary bronze',w.scene);bronze.albedoColor=Color3.FromHexString('#363b3c').toLinearSpace();bronze.metallic=.65;bronze.roughness=.52;
 const template=(name:string,width:number,height:number,depth:number,material:PBRMaterial)=>{const m=MeshBuilder.CreateBox(name,{width,height,depth},w.scene);m.parent=w.root;m.material=material;m.isVisible=false;m.isPickable=false;return m;};
 const wall=template('shared courtyard wall',.38,2.4,7,wallMaterial);finishes.apply(wall);
 const cap=template('shared courtyard coping',.46,.09,7,wallMaterial);finishes.apply(cap);
 const slat=template('shared vertical grille',.07,2.4,.07,bronze),lamp=template('shared wall lamp',.1,.32,.18,bronze);
 const place=(source:typeof wall,name:string,x:number,y:number,z:number,angle:number,longScale=1,obstacle=true)=>{const m=source.createInstance(name);m.parent=w.root;m.position.set(x,y,z);m.rotation.y=angle;m.scaling.z=longScale;m.isVisible=true;m.isPickable=obstacle;m.metadata={cameraObstacle:obstacle,villa:true,villaRole:'garden-wall'};m.receiveShadows=true;w.shadows.addShadowCaster(m);return m;};
 for(const b of COURTYARD_WALLS){const[x,y,z]=b.center;
  if(b.kind==='grille'){const count=Math.floor(b.size[2]/.19);for(let i=0;i<count;i++){const d=(i-(count-1)/2)*.19;place(slat,b.id+'-slat-'+i,x+Math.sin(b.rotationY)*d,y,z+Math.cos(b.rotationY)*d,b.rotationY,1);}}
  else place(wall,b.id,x,y,z,b.rotationY,b.size[2]/7);
  place(cap,b.id+'-cap',x,2.705,z,b.rotationY,b.size[2]/7);
 }
 const tex=new DynamicTexture('shared warm wall wash',128,w.scene,false),ctx=tex.getContext();
 const g=ctx.createRadialGradient(64,64,2,64,64,62);g.addColorStop(0,'rgba(255,219,157,.3)');g.addColorStop(.45,'rgba(255,202,123,.14)');g.addColorStop(1,'rgba(255,191,113,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);tex.hasAlpha=true;tex.wrapU=tex.wrapV=Texture.CLAMP_ADDRESSMODE;tex.update();
 const washMat=new StandardMaterial('home light wash',w.scene);washMat.diffuseTexture=tex;washMat.useAlphaFromDiffuseTexture=true;washMat.disableLighting=true;washMat.emissiveColor=Color3.White();washMat.disableDepthWrite=true;washMat.backFaceCulling=false;
 const glowMat=new StandardMaterial('home wall lamp glow',w.scene);glowMat.disableLighting=true;glowMat.emissiveColor=Color3.FromHexString('#ffddb1');
 const patches:ReturnType<typeof MeshBuilder.CreateBox>[]=[];
 for(const l of WALL_LIGHTS){place(lamp,l.id+'-lamp',l.x,l.y,l.z,Math.atan2(l.dz,l.dx),1,false);
  const glow=MeshBuilder.CreateBox(l.id+'-light',{width:.07,height:.2,depth:.12},w.scene);glow.parent=w.root;glow.position.set(l.x+l.dx*.06,l.y,l.z+l.dz*.06);glow.material=glowMat;glow.isPickable=false;patches.push(glow);
  const wallWash=MeshBuilder.CreatePlane(l.id+'-wash',{width:3.4,height:2.7},w.scene);wallWash.parent=w.root;wallWash.position.set(l.x-l.dx*.035,1.55,l.z-l.dz*.035);wallWash.rotation.y=Math.atan2(l.dx,l.dz);wallWash.material=washMat;wallWash.isPickable=false;patches.push(wallWash);
  const groundWash=MeshBuilder.CreateGround(l.id+'-pool',{width:3.8,height:3.8},w.scene);groundWash.parent=w.root;groundWash.position.set(l.x+l.dx*.85,.271,l.z+l.dz*.85);groundWash.material=washMat;groundWash.isPickable=false;patches.push(groundWash);
 }
 const pathMat=new PBRMaterial('home path stone',w.scene);pathMat.albedoColor=Color3.FromHexString('#a7aa9f').toLinearSpace();pathMat.metallic=0;
 const stone=template('shared woodland path stone',.85,.065,1.15,pathMat);finishes.apply(stone);
 for(let i=1;i<HOME_FOREST_PATH.length;i++){const a=Vector3.FromArray([HOME_FOREST_PATH[i-1][0],0,HOME_FOREST_PATH[i-1][1]]),b=Vector3.FromArray([HOME_FOREST_PATH[i][0],0,HOME_FOREST_PATH[i][1]]),length=Vector3.Distance(a,b);
  for(let d=0;d<length;d+=1.6){const p=Vector3.Lerp(a,b,d/length);place(stone,'woodland-stone-'+i+'-'+d,p.x+Math.sin(d*3)*.35,.275,p.z,Math.atan2(b.x-a.x,b.z-a.z)+Math.sin(d)*.2,.9+Math.cos(d)*.12,false);}
 }
 return {setLights(on:boolean){for(const p of patches)p.setEnabled(on);},dispose(){tex.dispose();wallMaterial.dispose();bronze.dispose();washMat.dispose();glowMat.dispose();pathMat.dispose();}};
}
