import {Color3,MeshBuilder,StandardMaterial,TransformNode,Vector3} from '@babylonjs/core';
import {chainState} from '../shared/field-chains';
import type {World} from './world';import type {Snapshot} from './simulation';
export function buildFieldChainVisuals(w:World){
 const root=new TransformNode('small stories along existing paths',w.scene);root.parent=w.root;
 const wood=new StandardMaterial('story nook weathered wood',w.scene);wood.diffuseColor=Color3.FromHexString('#a7906c');wood.specularColor.setAll(.04);
 const paper=new StandardMaterial('story nook parchment',w.scene);paper.diffuseColor=Color3.FromHexString('#e2d5ae');paper.specularColor.setAll(.02);
 const warm=new StandardMaterial('story nook warm response',w.scene);warm.diffuseColor=Color3.FromHexString('#e9ce8e');warm.emissiveColor=Color3.FromHexString('#b39454').scale(.35);
 const place=(m:ReturnType<typeof MeshBuilder.CreateBox>,mat=wood)=>{m.parent=root;m.material=mat;m.isPickable=false;m.metadata={cameraObstacle:false,storyChain:true};m.receiveShadows=true;return m;};
 const box=(name:string,x:number,y:number,z:number,a:number,b:number,c:number,mat=wood)=>{const m=MeshBuilder.CreateBox(name,{width:a,height:b,depth:c},w.scene);m.position.set(x,y,z);return place(m,mat);};
 const result:ReturnType<typeof MeshBuilder.CreateBox>[]=[];
 if(w.regionId==='ch01-lantern-village'){
  for(const[x,z,a]of [[-22.6,25.8,.4],[-23.3,23.3,.7],[-23.9,20.6,.1],[-17,14,.8],[-12,10.7,.3]]){const m=box('fallen flower ribbon clue',x,w.height(x,z)+.042,z,.09,.025,.40,paper);m.rotation.y=a;}
  box('loose thread under root window',-23,w.height(-23,27)+.18,26.75,.19,.025,.13,warm);
 }
 if(w.regionId==='player-home-villa'){
  const x=-46,z=-26,y=.26;box('returning reader bench',x,y+.62,z,2.6,.15,.8);box('returning reader bench back',x,y+1.05,z+.36,2.6,.75,.10);
  for(const side of [-1,1])box('reading nook bench foot',x+side*.95,y+.29,z,.13,.58,.60);
  box('story nook open book',x+.6,y+.73,z-.1,.60,.045,.42,paper);box('story nook page fold',x+.6,y+.76,z-.1,.014,.04,.40,paper);
  for(let i=0;i<4;i++){const m=box('short readable nook approach',-46,.278,-21-i*1.1,.55,.025,.65,paper);m.rotation.y=Math.sin(i)*.3;}
  result.push(box('reading nook lantern window',x-1.6,y+1.1,z,.23,.27,.22,warm));box('reading nook lamp post',x-1.6,y+.55,z,.06,1.1,.06);box('reading nook lamp cap',x-1.6,y+1.28,z,.33,.05,.31);
 }
 if(w.regionId==='mushroom-grove'){
  // The final lamp carries the same 1/3/2 rhythm used by the existing cap mechanism.
  const x=-22,z=83,y=w.height(x,z);box('last lamp engraved rhythm',x+.7,y+.6,z,.80,.08,.45);
  for(const[g,n]of [1,3,2].entries())for(let i=0;i<n;i++)box('carved one three two mark',x+.43+g*.26+i*.05,y+.646,z,.018,.008,.22,paper);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,m=MeshBuilder.CreateSphere('opened moonflower petal',{diameter:.3,segments:8},w.scene);m.position.set(-12+Math.cos(a)*.2,w.height(-12,43)+.18,43+Math.sin(a)*.2);m.scaling.set(1,.3,1.6);place(m,warm);result.push(m);}
 }
 return{update(s:Snapshot){const on=w.regionId==='player-home-villa'?chainState(s.fieldbook,'a-light-for-the-way-home').complete&&s.homeLights!==false:chainState(s.fieldbook,'goodnight-under-the-caps').complete;for(const m of result)m.setEnabled(on);},dispose(){wood.dispose();paper.dispose();warm.dispose();}};
}
