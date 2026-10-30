import {MeshBuilder,StandardMaterial,Color3,type Mesh,type Scene} from '@babylonjs/core';
import type{Snapshot}from'./simulation';
import {waterColumn}from'../shared/swimming';
/** Four reusable surface rings. No scene traversal, textures, reflections or water lights. */
export class SwimWake{
 private rings:Mesh[];private material:StandardMaterial;private ready=false;
 constructor(scene:Scene){this.material=new StandardMaterial('soft swimming ripples',scene);this.material.disableLighting=true;this.material.emissiveColor=new Color3(.58,.78,.80);this.material.alpha=.28;this.material.disableDepthWrite=true;this.rings=Array.from({length:4},(_,i)=>{const m=MeshBuilder.CreateTorus('swimming surface ripple '+i,{diameter:1,thickness:.012,tessellation:24},scene);m.material=this.material;m.isPickable=false;m.metadata={cameraObstacle:false};m.setEnabled(false);return m;});void this.material.forceCompilationAsync(this.rings[0]).then(()=>this.ready=true);}
 update(s:Snapshot|null,roles:readonly string[]){for(let r=0;r<2;r++){const role=r?'white':'gold',p=s?.players[role],c=p&&s&&p.swim==='surface'?waterColumn(s.regionId,p.x,p.z):null;for(let i=0;i<2;i++){const ring=this.rings[r*2+i],on=!!c&&this.ready&&roles.includes(role);ring.setEnabled(on);if(!on||!p||!c||!s)continue;const phase=(s.time*(p.speed>.05?1.5:.65)+i*.5)%1,scale=.7+phase*1.5;ring.position.set(p.x,c.surface+.015,p.z);ring.scaling.set(scale,1,scale);ring.visibility=(1-phase)*Math.min(1,(s.time+.1)*4);}}}
 dispose(){this.rings.forEach(m=>m.dispose());this.material.dispose();}
}
