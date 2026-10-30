import { Color3, Color4, Mesh, MeshBuilder, Vector3, StandardMaterial, PBRMaterial, PointLight, VertexBuffer, VertexData, type Scene, type Light } from '@babylonjs/core';
import {setLightEnabled} from './light-transition';
import{castleLightningAt}from'./castle-weather';
export type WeatherKind='clear'|'rain'|'snow'|'thunder';
const CYCLE:WeatherKind[]=['clear','rain','clear','snow','thunder','clear'];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Authoritative simulation seconds, never wall-clock/random: the same snapshot gives the same sky. */
export function weatherAt(time:number,regionId:string,indoor=false){
 const t=Math.max(0,Number.isFinite(time)?time:0),hour=(9+t/30)%24,daylight=clamp((Math.sin((hour-6)/24*Math.PI*2)+.12)/.82),segment=Math.floor(t/150),within=t%150;
 let kind=CYCLE[segment%CYCLE.length];if((regionId.includes('mountain')||regionId==='studio-winter-lantern')&&kind==='rain')kind='snow';if(regionId==='studio-winter-lantern'&&kind==='thunder')kind='snow';if(regionId.includes('dragon')&&kind==='snow')kind='rain';
 if(regionId==='studio-undersea-atlantis')kind='clear';
 const intensity=indoor||kind==='clear'?0:Math.min(1,within/8,(150-within)/8),phase=t%37;
 // One soft, 1.5-second light swell at most every 37 seconds, never a strobe.
 const flash=regionId==='ch05-candle-castle'?castleLightningAt(t).flash*(indoor?.35:1):kind==='thunder'&&!indoor&&phase<1.5?Math.sin(phase/1.5*Math.PI)*.22*intensity:0;
 const night=daylight<.25,icon=kind==='snow'?'❄':kind==='rain'?'☂':kind==='thunder'?'ϟ':night?'☾':'☀',label=kind==='snow'?'飘雪':kind==='rain'?'细雨':kind==='thunder'?'雷雨':night?'月夜':'晴朗';
 return {kind,hour,daylight,intensity,flash,icon,label};
}
type Baseline={sun:Light;sunIntensity:number;sunColor:Color3;hemi:Light|null;hemiIntensity:number;hemiColor:Color3;fog:Color3;fogStart:number;fogEnd:number;clear:Color4;sky:StandardMaterial|null;skyColor:Color3;skyLevel:number;environment:number};
/** One bounded dynamic mesh; no per-drop objects, timers, lights or textures. */
export class WorldWeather {
 private bolt:ReturnType<typeof MeshBuilder.CreateLines>;private boltPoints=Array.from({length:9},()=>new Vector3());private mesh:Mesh;private material:StandardMaterial;private positions=new Float32Array(256*12);private baseline:Baseline|null=null;
 constructor(private scene:Scene){
  this.bolt=MeshBuilder.CreateLines('distant soft lightning',{points:this.boltPoints,updatable:true},scene);this.bolt.color=new Color3(.88,.92,1);this.bolt.isPickable=false;this.bolt.alwaysSelectAsActiveMesh=true;this.bolt.setEnabled(false);
  this.mesh=new Mesh('bounded weather particles',scene);this.mesh.isPickable=false;this.mesh.alwaysSelectAsActiveMesh=true;this.mesh.metadata={cameraObstacle:false};
  const data=new VertexData();data.positions=this.positions;const indices:number[]=[];for(let i=0;i<256;i++){const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);}data.indices=indices;data.applyToMesh(this.mesh,true);
  this.material=new StandardMaterial('soft rain and snow',scene);this.material.disableLighting=true;this.material.backFaceCulling=false;this.material.disableDepthWrite=true;this.material.alpha=.55;this.mesh.material=this.material;this.mesh.setEnabled(false);
 }
 update(time:number,regionId:string,indoor:boolean,focus:{x:number;y:number;z:number},quality:string,active:boolean){
  const sun=this.scene.getLightByName('sun');if(!sun)return;
  if(this.baseline?.sun!==sun){const hemi=this.scene.getLightByName('sky'),sky=this.scene.getMaterialByName('sky daylight gradient') as StandardMaterial|null;this.baseline={sun,sunIntensity:sun.intensity,sunColor:sun.diffuse.clone(),hemi,hemiIntensity:hemi?.intensity??0,hemiColor:hemi?.diffuse.clone()??Color3.White(),fog:this.scene.fogColor.clone(),fogStart:this.scene.fogStart,fogEnd:this.scene.fogEnd,clear:this.scene.clearColor.clone(),sky,skyColor:sky?.emissiveColor.clone()??Color3.White(),skyLevel:sky?.emissiveTexture?.level??1,environment:this.scene.environmentIntensity};}
  const b=this.baseline,w=weatherAt(time,regionId,indoor),day=active?w.daylight:1,cloud=active&&w.kind!=='clear'?.22*w.intensity:0,blend=1-day;
  b.sun.intensity=b.sunIntensity*(1-blend*.86-cloud*.5)+w.flash*(active?1:0);b.sun.diffuse=Color3.Lerp(b.sunColor,new Color3(.56,.68,1),blend*.65);
  if(b.hemi){b.hemi.intensity=b.hemiIntensity*(1-blend*(indoor?.35:.37));b.hemi.diffuse=Color3.Lerp(b.hemiColor,new Color3(.57,.66,.85),blend*.7);}
  this.scene.fogColor=Color3.Lerp(b.fog,new Color3(.10,.15,.25),blend*.78+cloud*.3);this.scene.fogStart=b.fogStart*(1-cloud);this.scene.fogEnd=b.fogEnd*(1-cloud*.5);
  const cc=Color3.Lerp(new Color3(b.clear.r,b.clear.g,b.clear.b),new Color3(.025,.05,.11),blend*.9+cloud*.2);this.scene.clearColor.r=cc.r;this.scene.clearColor.g=cc.g;this.scene.clearColor.b=cc.b;
  this.scene.environmentIntensity=b.environment*(1-blend*(indoor?.55:.72)-cloud*.3);
  const nightStrength=clamp((.8-day)/.7);
  for(const light of this.scene.lights){
   const meta=light.metadata;if(!meta)continue;
   if(meta.nightWindow){light.intensity=meta.dayIntensity*Math.pow(day,1.35);setLightEnabled(light,day>.12);}
   if(meta.nightRoomLamp)light.intensity=meta.dayIntensity*(.8+.2*blend);
   if(meta.nightReplacedHearth)setLightEnabled(light,nightStrength<.01);
   if(meta.nightLanternPool&&light instanceof PointLight){
    const sources=(meta.sources as {position:Vector3;power:number;range:number;tint?:Color3}[]).filter(source=>Math.hypot(source.position.x-focus.x,source.position.z-focus.z)<20).sort((a,b)=>Math.hypot(a.position.x-focus.x,a.position.z-focus.z)-Math.hypot(b.position.x-focus.x,b.position.z-focus.z));
    const first=sources[0],source=meta.slot===0?first:sources.find(candidate=>first&&Vector3.Distance(candidate.position,first.position)>4);
    setLightEnabled(light,nightStrength>.01&&!!source);light.intensity=source?source.power*nightStrength:0;if(source){light.position.copyFrom(source.position);light.range=source.range;if(source.tint)light.diffuse.copyFrom(source.tint);}
   }
  }
  for(const material of this.scene.materials)if(material instanceof PBRMaterial&&material.metadata?.nightWindowView){
   material.albedoColor.copyFrom(material.metadata.dayAlbedo).multiplyInPlace(Color3.Lerp(Color3.White(),new Color3(.22,.32,.48),blend));material.emissiveColor.copyFrom(material.metadata.dayEmissive).scaleInPlace(day);
  }
  if(b.sky){b.sky.emissiveColor=Color3.Lerp(b.skyColor,new Color3(.18,.26,.42),blend);if(b.sky.emissiveTexture)b.sky.emissiveTexture.level=b.skyLevel*Math.max(.13,1-blend*.87-cloud*.65);}
  this.bolt.setEnabled(active&&(!indoor||regionId==='ch05-candle-castle')&&w.flash>.002);
  if(this.bolt.isEnabled()){const cam=this.scene.activeCamera,dx=cam?focus.x-cam.position.x:0,dz=cam?focus.z-cam.position.z:1,l=Math.hypot(dx,dz)||1,forward=cam?.getForwardRay().direction;for(let i=0;i<9;i++){const zig=[0,1.2,-.2,1.6,-.9,.7,-.3,1,0][i];if(regionId==='ch05-candle-castle'){this.boltPoints[i].set(-78+zig,42-i*2.2,72+zig*.3);continue;}this.boltPoints[i].set((cam?.position.x??focus.x)+(forward?.x??dx/l)*80+dz/l*zig,(cam?.position.y??focus.y)+(forward?.y??0)*80+26-i*2,(cam?.position.z??focus.z)+(forward?.z??dz/l)*80-dx/l*zig);}MeshBuilder.CreateLines('distant soft lightning',{points:this.boltPoints,instance:this.bolt});this.bolt.alpha=w.flash/.22*.88;}
  const on=active&&!indoor&&w.intensity>.001;this.mesh.setEnabled(on);if(!on)return;
  const snow=w.kind==='snow',count=quality==='low'?64:quality==='high'?256:160;this.material.emissiveColor=snow?new Color3(.94,.97,1):new Color3(.58,.74,.87);this.material.alpha=(snow?.78:.5)*w.intensity;
  const cam=this.scene.activeCamera,dx=cam?focus.x-cam.position.x:0,dz=cam?focus.z-cam.position.z:1,len=Math.hypot(dx,dz)||1,rightX=dz/len,rightZ=-dx/len;
  for(let i=0;i<256;i++){const off=i*12;if(i>=count){for(let k=0;k<12;k++)this.positions[off+k]=0;continue;}
   const a=((i*73)%257)/257,c=((i*137+19)%263)/263,d=((i*43+7)%269)/269;
   const x=focus.x+(a-.5)*22+(snow?Math.sin(time*.65+i)*.5:0),z=focus.z+(c-.5)*22,y=focus.y+((d*14-time*(snow?1.1:12))%14+14)%14-.3,near=cam?Math.hypot(x-cam.position.x,y-cam.position.y,z-cam.position.z):10,width=(snow?.04:.009)*Math.min(1,near/4),height=(snow?.055:.65)*Math.min(1,near/3),slant=snow?0:.07*Math.min(1,near/3);
   this.positions.set([x-rightX*width,y,z-rightZ*width,x+rightX*width,y,z+rightZ*width,x+rightX*width+slant,y+height,z+rightZ*width,x-rightX*width+slant,y+height,z-rightZ*width],off);
  }
  this.mesh.updateVerticesData(VertexBuffer.PositionKind,this.positions,false,false);
 }
 dispose(){this.bolt.dispose(false,true);this.mesh.dispose();this.material.dispose();this.baseline=null;}
}
