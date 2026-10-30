import {Color3,Mesh,DynamicTexture,PBRMaterial,Scene,Texture,VertexBuffer,type AbstractMesh,type BaseTexture} from '@babylonjs/core';
import type {EnvironmentMaterials} from './environment-materials';
type Finish='floor-stone'|'floor-oak'|'wall'|'facade'|'counter'|'cloth'|'rug'|'wood';
/** Finish is assigned by surface use. Authored oak/linen/stone maps and UVs survive. */
export function villaFinishes(scene:Scene,surfaces:EnvironmentMaterials){
 const owned:PBRMaterial[]=[],textures:BaseTexture[]=[],materials=new Map<string,PBRMaterial>(),fields=new Map<string,DynamicTexture>();
 const detailMaps=new Map<string,Texture>();const detail=(name:string,normal=false)=>{const key=name+normal;let t=detailMaps.get(key);if(!t){t=new Texture(normal?'/assets/environment/'+name+'-normal.png':'/assets/environment/v16/'+name+'-detail.png',scene,false,false,Texture.TRILINEAR_SAMPLINGMODE);t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;t.anisotropicFilteringLevel=4;if(normal){t.gammaSpace=false;t.level=.12;}detailMaps.set(key,t);textures.push(t);}return t;};
 const optionalBumps=new Map<PBRMaterial,BaseTexture>();
 const field=(kind:'floor-stone'|'floor-oak')=>{
  if(kind==='floor-stone')return detail('mineral');
  if(fields.has(kind))return fields.get(kind)!;
  const size=512,t=new DynamicTexture('home-'+kind,size,scene,true),ctx=t.getContext(),data=(ctx as CanvasRenderingContext2D).createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=(y*size+x)*4,u=x/size,v=y/size;let value:number;
    const board=Math.floor(u*6),grain=Math.sin((u*260+Math.sin(v*Math.PI*2)*.24)*Math.PI*2)*.012;
    value=.89+grain+[.012,-.008,.004,-.013,.016,-.003][board];
    if(x%85<1||((y+board*137)%512)<1)value-=.065;
   data.data[i]=data.data[i+1]=data.data[i+2]=Math.round(value*255);data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE;t.anisotropicFilteringLevel=8;t.update();fields.set(kind,t);textures.push(t);return t;
 };
 function apply(mesh:AbstractMesh){
  const original=mesh.material;if(!(original instanceof PBRMaterial))return;
  const e=mesh.metadata?.gltf?.extras??{},parts=mesh.name.split('__'),role=e.role??mesh.metadata?.villaRole??parts[1],floor=e.floor??parts[0],zone=e.zone??parts[2]??'',name=original.name.toLowerCase();
  let kind:Finish|undefined;
  if(/glass|metal|bronze|light|water|grass/.test(name))return;
  if(/rug/.test(name)||role==='detail'&&zone==='living'&&/washed oak/.test(name))kind='rug';
  else if(role==='slab'&&['floor','terrace'].includes(zone))kind=floor==='F2'?'floor-oak':'floor-stone';
  else if(['wall','column','roof'].includes(role)&&/limestone|plaster/.test(name))kind=/warm limestone/.test(name)&&floor!=='B1'&&zone!=='living hearth'?'facade':'wall';
  else if(role==='furniture'&&/stone|porcelain/.test(name))kind='counter';
  else if(/linen|textile|velvet|cushion/.test(name))kind='cloth';
  else if(/oak|walnut|timber/.test(name))kind='wood';
  if(!kind)return;
  const key=original.uniqueId+':'+kind;let m=materials.get(key);
  if(!m){
   m=original.clone('home-'+kind+' / '+original.name)!;
   // Babylon clones texture wrappers too, including maps replaced below. Own every
   // clone so repeated house visits release them without touching source textures.
   const shared=new Set(original.getActiveTextures());textures.push(...m.getActiveTextures().filter(t=>!shared.has(t)));
   materials.set(key,m);owned.push(m);m.maxSimultaneousLights=4;
   m.metallic=0;
   if(kind==='facade'){
    m.roughness=.9;m.albedoColor=Color3.FromHexString('#f1eee7').toLinearSpace();
    if(original.albedoTexture){
     const source=original.albedoTexture as Texture;
     const t=new Texture('/assets/environment/v14/villa-limestone-ivory.jpg',scene,false,false);
     textures.push(t);t.wrapU=source.wrapU;t.wrapV=source.wrapV;t.anisotropicFilteringLevel=8;
     for(const k of ['uScale','vScale','uOffset','vOffset','uAng','vAng','wAng','coordinatesIndex'] as const)t[k]=source[k];
     m.albedoTexture=t;
     m.bumpTexture=detail('plaster',true);
    }
   }
   if(kind==='wall'){m.roughness=.86;m.albedoColor=Color3.FromHexString('#f0eee5').toLinearSpace();if(!original.albedoTexture)m.albedoColor=Color3.FromHexString('#ebe8df').toLinearSpace();}
   if(kind==='floor-stone'){m.albedoTexture=field(kind);m.albedoColor=Color3.FromHexString('#d0c5b2').toLinearSpace();m.roughness=.66;m.bumpTexture=detail('stone',true);}
   if(kind==='floor-oak'){m.albedoTexture=field(kind);m.albedoColor=Color3.FromHexString('#d0bda0').toLinearSpace();m.roughness=.63;m.bumpTexture=null;}
   if(kind==='wall'&&!m.albedoTexture){m.albedoTexture=detail('plaster');m.bumpTexture=detail('plaster',true);}
   if(kind==='counter'){m.roughness=.46;m.albedoColor=Color3.FromHexString('#ddd6c8').toLinearSpace();}
   if(kind==='wood'){m.roughness=.68;if(!m.albedoTexture){m.albedoTexture=detail('wood');m.bumpTexture=detail('timber',true);}}
   if(kind==='cloth'){m.albedoTexture??=surfaces.fabric('#ffffff').albedoTexture;m.roughness=.94;m.sheen.isEnabled=true;m.sheen.intensity=.16;m.sheen.roughness=.85;if(/sea mist/.test(name))m.albedoColor=Color3.FromHexString('#889e91').toLinearSpace();if(/amber/.test(name))m.albedoColor=Color3.FromHexString('#af7959').toLinearSpace();}
   if(kind==='rug'){m.albedoColor=Color3.FromHexString('#b9ae95').toLinearSpace();m.albedoTexture=surfaces.fabric('#ffffff').albedoTexture;m.roughness=.98;}
  }
  if(m.bumpTexture)optionalBumps.set(m,m.bumpTexture);
  mesh.material=m;
  if(kind==='cloth'||kind==='rug'){
   const p=mesh.getVerticesData(VertexBuffer.PositionKind),n=mesh.getVerticesData(VertexBuffer.NormalKind);if(p&&n){const uv=new Float32Array(p.length/3*2);for(let i=0,j=0;i<p.length;i+=3,j+=2){const axis=Math.abs(n[i])>Math.abs(n[i+1])&&Math.abs(n[i])>Math.abs(n[i+2])?0:Math.abs(n[i+1])>Math.abs(n[i+2])?1:2;uv[j]=p[i+(axis===0?2:0)]*3;uv[j+1]=p[i+(axis===1?2:1)]*3;}if(mesh instanceof Mesh)mesh.makeGeometryUnique();mesh.setVerticesData(VertexBuffer.UVKind,uv);}
  }
  // Only previously untextured floors receive metre-based planar UVs. Furniture
  // grain direction, rounded furniture seams and authored textile UVs are intact.
  if(kind==='floor-stone'||kind==='floor-oak'){
   const p=mesh.getVerticesData(VertexBuffer.PositionKind);if(!p)return;
   const uv=new Float32Array(p.length/3*2);for(let i=0,j=0;i<p.length;i+=3,j+=2){uv[j]=p[i]/(kind==='floor-stone'?5.2:2.4);uv[j+1]=p[i+2]/(kind==='floor-stone'?2.6:5.8);}mesh.setVerticesData(VertexBuffer.UVKind,uv);
  }
 }
 return{apply,setQuality(value:string){for(const[m,t]of optionalBumps)m.bumpTexture=value==='low'?null:t;},detail,dispose(){owned.forEach(m=>m.dispose(false,false));owned.length=0;textures.forEach(t=>t.dispose());}};
}
