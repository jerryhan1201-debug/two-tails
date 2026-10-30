import { Color3, Curve3, Mesh, MeshBuilder, MultiMaterial, PBRMaterial, PointLight, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import type { World } from './world';
import { GIANT_MUSHROOMS,BASE_FOREST_MUSHROOMS, regionGroundHeight, regionBounds, FOREST_COPIES } from './regions';
import ancientTreeGeometry from '../shared/ancient-tree-geometry.json';
import studioShapes from '../source-assets/environment/studio-rc1/physics.json';
import {regionalTrees} from './regional-trees';

const v=(x:number,y:number,z:number)=>new Vector3(x,y,z);
const curve=(p:number[][])=>Curve3.CreateCatmullRomSpline(p.map(a=>v(a[0],a[1],a[2])),6).getPoints();
export const EXPLORATION_REGIONS=['mushroom-grove','mushroom-home','canopy-garden','canopy-home'];
export const isExplorationInterior=(id:string)=>id==='mushroom-home'||id==='canopy-home';

function sphere(w:World,name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,solid=false){
 const m=MeshBuilder.CreateSphere(name,{diameter:2,segments:18},w.scene);m.position.set(x,y,z);m.scaling.set(sx,sy,sz);w.add(m,color);m.metadata.cameraObstacle=solid;return m;
}
function ring(w:World,name:string,x:number,y:number,z:number,r:number,thickness:number,color:string,vertical=false){
 const m=MeshBuilder.CreateTorus(name,{diameter:r*2,thickness,tessellation:48},w.scene);m.position.set(x,y,z);if(vertical)m.rotation.x=Math.PI/2;w.add(m,color);m.metadata.cameraObstacle=false;return m;
}
function lathe(w:World,name:string,x:number,y:number,z:number,profile:number[][],color:string,segments=64){
 const m=MeshBuilder.CreateLathe(name,{shape:profile.map(a=>v(a[0],a[1],0)),tessellation:segments,cap:Mesh.CAP_ALL},w.scene);
 // Babylon's ribbon seam smoothing can divide by zero at closed radius-zero
 // poles. Recompute from the existing triangles without altering the profile.
 const normals=m.getVerticesData(VertexBuffer.NormalKind);
 if(normals?.some(n=>!Number.isFinite(n))){const fixed:number[]=[];VertexData.ComputeNormals(m.getVerticesData(VertexBuffer.PositionKind)!,m.getIndices()!,fixed);m.setVerticesData(VertexBuffer.NormalKind,fixed);}
 m.position.set(x,y,z);w.add(m,color);return m;
}
function lamp(w:World,x:number,y:number,z:number,scale=.8){
 const s=scale;w.tube('brass lamp stem',[v(x,y,z),v(x,y+1.3*s,z)],.035*s,'#a78655',false);
 lathe(w,'ceramic lamp shade',x,y+1.05*s,z,[[.28*s,0],[.30*s,.1*s],[.15*s,.42*s],[0,.45*s]],'#e6c592');
 sphere(w,'soft lamp pearl',x,y+1.05*s,z,.12*s,.16*s,.12*s,'#ffe0a5').material=w.mat('#ffd696',.65);
 const l=new PointLight('warm occupied room lamp',v(x,y+1.05*s,z),w.scene);l.diffuse=Color3.FromHexString('#ffd19e');l.intensity=1.6*s;l.range=7*s;l.parent=w.root;l.metadata={nightRoomLamp:true,dayIntensity:l.intensity};
 if(!w.indoor){l.metadata={nightReplacedHearth:true};w.registerNightLanternSource(l.position.clone(),l.intensity,l.range);}
}
function planter(w:World,x:number,y:number,z:number,s=.8){
 lathe(w,'hand thrown terracotta plant pot',x,y,z,[[.28*s,0],[.4*s,.12*s],[.45*s,.6*s],[.48*s,.64*s],[.4*s,.68*s],[.37*s,.58*s]],'#c08761',24);
 for(let i=0;i<7;i++){const a=i*2.399,reach=s*(.3+i%3*.15),tip=v(x+Math.cos(a)*reach,y+s*(1.1+i%3*.14),z+Math.sin(a)*reach);w.tube('plant curved stem',curve([[x,y+.5*s,z],[x+Math.cos(a)*reach*.2,y+.95*s,z+Math.sin(a)*reach*.2],[tip.x,tip.y,tip.z]]),.025*s,'#677950');const leaf=sphere(w,'plant fleshy leaf',tip.x,tip.y,tip.z,.13*s,.26*s,.05*s,i%2?'#6e8d56':'#94a575');leaf.rotation.set(.5,a,.35);}
}
function stool(w:World,x:number,y:number,z:number,s=1){
 lathe(w,'carved wood stool seat',x,y+.56*s,z,[[0,0],[.48*s,0],[.51*s,.12*s],[.43*s,.17*s],[0,.17*s]],'#b59569',32);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;w.tube('wood stool splayed leg',[v(x+Math.cos(a)*.38*s,y,z+Math.sin(a)*.38*s),v(x+Math.cos(a)*.25*s,y+.59*s,z+Math.sin(a)*.25*s)],.065*s,'#a3855f',false);}
}
function table(w:World,x:number,y:number,z:number,width=3,depth=1.6){
 const top=w.box('rounded timber dining table',x,y+1.15,z,width,.16,depth,'#bfa477');top.metadata.cameraObstacle=false;
 for(const dx of [-1,1])for(const dz of [-1,1])w.tube('dining table wood leg',[v(x+dx*(width*.37),y,z+dz*(depth*.34)),v(x+dx*(width*.36),y+1.12,z+dz*(depth*.33))],.085,'#9c7a51',false);
}
function mug(w:World,x:number,y:number,z:number,color='#e2d2ae'){
 lathe(w,'ceramic tea cup',x,y,z,[[.11,0],[.15,.04],[.16,.22],[.145,.25],[.12,.23],[.115,.1]],color,24);const h=ring(w,'tea cup loop handle',x+.18,y+.13,z,.09,.035,color,true);h.rotation.y=Math.PI/2;
}
function book(w:World,x:number,y:number,z:number,a=0){
 const b=w.box('cloth field journal',x,y,z,.72,.13,.49,'#728473');b.rotation.y=a;const p=w.box('field journal cream pages',x,y+.04,z,.66,.055,.47,'#e5d9b5');p.rotation.y=a;
}
function banner(w:World,x:number,y:number,z:number,text:string){
 // The short sign is rendered as carved geometry; labels live in map/interaction UI.
 w.tube('wayfinder timber post',[v(x,y,z),v(x,y+1.8,z)],.08,'#a1875e',false);
 const sign=w.box('rounded trail timber sign '+text,x,y+1.6,z,1.25,.38,.11,'#b49b72');sign.rotation.z=-.04;
 for(const side of [-1,1])sphere(w,'sign bronze pin',x+side*.5,y+1.6,z-.07,.035,.035,.018,'#ba9a56');
}

/** Continuous thick cap, scalloped rim and real radial gills; all visible from flight. */
export function giantMushroom(w:World,x:number,z:number,height:number,radius:number,seed:number,house=false,stemRadius=radius*.24){
 const base=regionGroundHeight(w.regionId,x,z);
 const id=height<2.5?'medium':'giant',shape=studioShapes[id];
 const scale=v(radius/shape.radius,height/shape.height,radius/shape.radius);
 w.queueMushroom(id,v(x,base,z),scale,stemRadius/(shape.stemRadius*scale.x));
 return {base};
}
function mushroomHouseExterior(w:World){
 const base=regionGroundHeight(w.regionId,0,65);
 w.editableAsset('house',v(0,base,65));
 planter(w,-2.65,base,59.5,1);planter(w,2.85,base,59.7,.85);lamp(w,-2.0,base+1.4,59.3,.6);
 banner(w,3.9,base,58.2,'苔苔的小屋');
}
function* forestLoop(w:World):Generator<void>{
 const bounds=regionBounds(w.regionId);w.buildStage='giant-mushrooms';
 for(const [i,m]of GIANT_MUSHROOMS.entries()){giantMushroom(w,m.x,m.z,m.h,m.cap,i+1,false,m.r);if(i%24===23)yield;}
 w.buildStage='small-mushrooms';
 const smalls:{x:number;z:number;height:number;radius:number;seed:number;existing:boolean}[]=[];
 for(const [i,m] of BASE_FOREST_MUSHROOMS.entries())for(let k=0;k<3;k++){
   const a=i*2.399+k*2.11,x=m.x+Math.cos(a)*(m.r+2.1+k*.4),z=m.z+Math.sin(a)*(m.r+2.1+k*.4);
   if(w.pathDistance(x,z)<3.4||Math.hypot(x,z-65)<12||x<bounds.minX+2||x>bounds.maxX-2||z>bounds.maxZ-3||z<0)continue;
   smalls.push({x,z,height:.65+(i+k)%4*.25,radius:.5+(i+k)%3*.28,seed:i*3+k+41,existing:i<31});
 }
 const preserved=smalls.filter(m=>m.existing),added=smalls.filter(m=>!m.existing).sort((a,b)=>(a.seed*73%101)-(b.seed*73%101));
 let built=0;for(const m of preserved.concat(added.slice(0,126*FOREST_COPIES.length-preserved.length))){giantMushroom(w,m.x,m.z,m.height,m.radius,m.seed);if(++built%40===0)yield;}
 // Roots form a low jumping loop, clear at player head height.
 for(const [x,z,rot]of [[15,35,.25],[18,39,-.3],[21,43,.15]]){const y=w.height(x,z);const stone=w.rock(x,z,1.9,'#ccd2ad',y-.65);stone.scaling.set(1.9,.65,1.7);stone.metadata.cameraObstacle=false;}
 for(let i=0;i<12;i++){const x=-20+Math.sin(i*1.6)*8,z=4+i*6.8;if(w.pathDistance(x,z)<3)continue;w.fern(x,z,1.5,i);w.rock(x+.8,z+.5,.55);}
 for(const [x,z]of [[-5,12],[4,30],[20,37],[23,49],[-8,52],[1,56]]){const y=w.renderedGroundHeight(x,z);w.registerNightLanternSource(v(x+2.7,y+.55,z),1.7,5.5,'#dece9f');for(let i=0;i<3;i++){const px=x+2.7+Math.sin(i*2.4)*.48,pz=z+Math.cos(i*2.4)*.45;const glow=sphere(w,'small amber spore lamp',px,y+.35,pz,.16,.09,.16,'#a2caaa');glow.material=w.mat('#b7d4a4',.28);}}
 w.buildStage='regional-trees';yield;yield* w.treeCopiesSteps(regionalTrees('mushroom-grove'));
 w.buildStage='border-mushrooms';
 for(let i=0;i<108;i++){const side=i%2?1:-1,x=side*(168+(i%3)*5),z=-6+Math.floor(i/2)*11.6;giantMushroom(w,x,z,17+(i%4)*2.4,6+(i%3),i+12);if(i%12===11)yield;}
 w.buildStage='forest-furnishings';
 for(const [i,p]of FOREST_COPIES.slice(1).entries()){
   yield;
   const base=w.height(p.x,p.z+65);
   w.editableAsset('bench',v(p.x,base,p.z+65));
   w.editableAsset('planter',v(p.x+2.2,base,p.z+65),v(.7,.7,.7));
   w.editableAsset('lantern',v(p.x-2,base,p.z+65));w.registerNightLanternSource(v(p.x-1.23,base+2.42,p.z+65),5,8);
   w.editableAsset('sign',v(p.x+2.7,base,p.z+61),v(.75,.75,.75));
   for(let k=0;k<5;k++)w.editableAsset((['grass','bluebell','groundcover','shrub','young'] as const)[k],v(p.x+4+Math.sin(k*2.4),w.height(p.x+4+Math.sin(k*2.4),p.z+66+k),p.z+66+k),v(.8,.8,.8));
   const path=w.editableAsset((['path-a','path-b','path-c'] as const)[i%3],v(p.x,base-.11,p.z+61),v(.8,.35,.8));
   path.metadata={walkableDecoration:true};
 }
 for(const [x,z]of [[-30,99],[-11,109],[7,146],[35,130],[29,96]]){const y=w.height(x,z);banner(w,x+3,y,z,'深林回路');for(let i=0;i<5;i++)w.fern(x+5+Math.sin(i*1.9)*2,z+Math.cos(i*1.9)*2,1+(i%3)*.17,i+201);}
 for(let i=0;i<13;i++){const a=i*2.399,x=-6+Math.cos(a)*(.5+i%3),z=39+Math.sin(a)*2.3;w.fern(x,z,.9+(i%3)*.2,i+97);}
 const log=w.tube('fallen moss forest timber',curve([[-23,w.height(-23,40)+.4,40],[-18,w.height(-18,42)+.35,42],[-12,w.height(-12,41)+.4,41]]),.6,'#947d58',false);log.metadata.cameraObstacle=true;

 mushroomHouseExterior(w);
 const y=w.height(22,49);table(w,23,y,50,2.2,1.1);book(w,23,y+1.3,50,.18);stool(w,23,y,48.8,.9);banner(w,16,w.height(16,34),34,'菌环小径');
}
function rails(w:World,x1:number,z1:number,x2:number,z2:number,y:number){
 const len=Math.hypot(x2-x1,z2-z1),n=Math.ceil(len/1.6);for(let i=0;i<=n;i++){const t=i/n,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;w.box('treehouse turned timber railing post',x,y+.58,z,.13,1.16,.13,'#a48659');}
 for(const h of [.35,1.05])w.tube('treehouse timber handrail',[v(x1,y+h,z1),v(x2,y+h,z2)],.07,'#ba9968',false);
}
function canopyGrove(w:World){
 const ty=regionGroundHeight(w.regionId,7,43);
 w.editableAsset('ancient-tree',v(7,ty,43));
 // Foliage remains lightweight and surrounds the newly authored welded branches.
 for(const [i,sections] of ancientTreeGeometry.branches.entries()){const end=sections.at(-1)!,near=sections.at(-2)!;w.crown(end.x,ty+end.y+.8,end.z,4.4,i+12);w.crown(near.x,ty+near.y+2.1,near.z,4.2,i+71);}w.crown(7,ty+26.2,43,5.2,117);
 // Independent planks, joists and diagonal brackets make the platform bear on the trunk.
 for(let i=0;i<29;i++){const x=-7+i*.5;w.box('treehouse platform individual wood plank',x,7.89,46,.48,.22,16,'#b89e72');}
 for(const z of [39,43,47,51])w.box('treehouse platform loadbearing wood joist',0,7.54,z,14.1,.45,.26,'#8f754c');
 for(const x of [-5.5,5.5])w.tube('treehouse diagonal timber support',[v(7,2.3,43),v(x,7.6,49)],.25,'#8f754c',false);
 rails(w,-7,38,-2,38,8);rails(w,2,38,7,38,8);rails(w,-7,38,-7,54,8);rails(w,-7,54,7,54,8);rails(w,7,54,7,47,8);
 // Two real stair flights exactly match shared slope surfaces: each riser is 0.2 m.
 for(let flight=0;flight<2;flight++){const x=flight===0?-5.5:.5,z0=flight===0?8:26,y0=flight===0?regionGroundHeight('canopy-garden',-5.5,8):4,n=flight===0?20:16,length=flight===0?15:12;for(let i=0;i<n;i++){const z=z0+(i+.5)*.75,y=y0+(4*(flight+1)-y0)*(i+1)/n;w.box('treehouse walkable timber stair tread',x,y-.11,z,3,.22,.77,'#b39a70');for(const side of [-1,1])if(i%4===0)w.box('treehouse stair railing post',x+side*1.48,y+.45,z,.11,1.1,.11,'#a08356');}for(const side of [-1,1])w.tube('treehouse ascending timber handrail',[v(x+side*1.48,y0+1,z0),v(x+side*1.48,4*(flight+1)+1,z0+length)],.065,'#bd9e71',false);}
 for(let i=0;i<18;i++)w.box('treehouse mid stair landing wood plank',-6.75+i*.5,3.88,24.5,.48,.24,3,'#b39a70');rails(w,-7,26,-1,26,4);
 w.editableAsset('canopy-house',v(0,8,48));
 lamp(w,-2,8,42,.8);planter(w,2.5,8,41,.9);stool(w,-4.8,8,52,.8);banner(w,-8,w.height(-8,7),7,'树梢人家');
 w.treeCopies(regionalTrees('canopy-garden'));
 for(let i=0;i<16;i++){const x=Math.sin(i*3.2)*29,z=4+i*5.8;if(w.pathDistance(x,z)>4&&Math.hypot(x-7,z-43)>12){w.fern(x,z,1.2,i);w.rock(x+1,z,.7);}}
}
function interiorFloor(w:World,round:boolean){
 if(round){
   const floor=MeshBuilder.CreateCylinder('mushroom home warm clay floor',{diameter:18,height:.2,tessellation:80},w.scene);floor.position.set(0,-.11,4);w.textured(floor,'limestone',true,false,'#fff0d2');floor.metadata.cameraObstacle=false;
   const positions:number[]=[],indices:number[]=[],uvs:number[]=[],steps=96,levels=[0,1.95,4.45,5.3];
   for(let j=0;j<levels.length;j++)for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2,y=levels[j],r=8.72+Math.sin(y*.6)*.09;positions.push(Math.cos(a)*r,y,4+Math.sin(a)*r);uvs.push(i/steps*6,y/4);if(j<levels.length-1&&i<steps){const mid=(i+.5)/steps*Math.PI*2,door=Math.sin(mid)<-.96,window=j===1&&(Math.abs(mid-1.17)<.16||Math.abs(mid-1.97)<.16);if(!door&&!window){const k=j*(steps+1)+i;indices.push(k,k+1,k+steps+1,k+1,k+steps+2,k+steps+1);}}}
   const d=new VertexData();d.positions=positions;d.indices=indices;d.uvs=uvs;d.normals=[];VertexData.ComputeNormals(positions,indices,d.normals);const shell=new Mesh('smooth mushroom interior organic plaster shell',w.scene);d.applyToMesh(shell);w.add(shell,'#e4d4b3');shell.material=w.surfaces.organic('stem','#e6d9b9');shell.material.backFaceCulling=false;shell.metadata.cameraObstacle=true;
   const skirting:Vector3[]=[];for(let i=0;i<=88;i++){const a=-1.34+i/88*5.82;skirting.push(v(Math.cos(a)*8.59,.13,4+Math.sin(a)*8.59));}w.tube('mushroom curved clay skirting',skirting,.11,'#c6b58e',false).metadata.cameraObstacle=false;
 } else {
   for(let i=0;i<32;i++){const plank=w.box('treehouse warm oak floor board',-7.75+i*.5,-.1,3.5,.48,.2,17,'#b89565');plank.metadata.cameraObstacle=false;}
   for(const side of [-1,1])for(let i=0;i<18;i++)w.box('treehouse interior wood side wall',side*7.9,.13+i*.27,3.5,.22,.25,17,'#b89565');
   for(let i=0;i<18;i++){const y=.13+i*.27;if(y>1.9&&y<4.4){for(const [x,width]of [[-6.35,3.3],[0,4.2],[6.35,3.3]])w.box('treehouse rear window recessed timber wall',x,y,11.9,width,.25,.22,'#b89565');}else w.box('treehouse interior wood rear wall',0,y,11.9,16,.25,.22,'#b89565');}
 }
 // The front section is open to the camera only after entry; walls behind/side remain solid.
 const rug=MeshBuilder.CreateDisc('handwoven natural jute rug',{radius:3.2,tessellation:64},w.scene);rug.rotation.x=Math.PI/2;rug.position.set(0,.018,2);w.add(rug,'#c9b891');rug.material=w.surfaces.fabric('#ccb48d');rug.metadata.cameraObstacle=false;ring(w,'woven rug stitched border',0,.028,2,3.1,.045,'#95826a');
}
function roundWindow(w:World,x:number,y:number,z:number,rot=0){
 const pane=MeshBuilder.CreateDisc('round translucent daylight window',{radius:1.16,tessellation:48},w.scene);pane.position.set(x,y,z);pane.rotation.y=rot;w.add(pane,'#aecbc3');pane.material=w.mat('#bedbd1',.2);pane.material.backFaceCulling=false;ring(w,'curved wood window surround',x,y,z,1.25,.16,'#a68c60',true).rotation.y=rot;
 const vertical=w.box('window timber vertical mullion',x,y,z-.025,.06,2.24,.09,'#b4a074');vertical.rotation.y=rot;const horizontal=w.box('window timber horizontal mullion',x,y,z-.025,2.24,.06,.09,'#b4a074');horizontal.rotation.y=rot;
 const l=new PointLight('soft daylight through round window',v(x,y,z-1),w.scene);l.diffuse=Color3.FromHexString('#d2e2de');l.intensity=2.3;l.range=10;l.parent=w.root;
}
function homeInterior(w:World,tree:boolean){
 if(!tree){
   const interior=w.editableAsset('house',v(0,-.16,0));
   w.configureIndoorCutaways(interior);
   for(const x of [-3.35,3.35]){const l=new PointLight('window daylight',v(x,2.8,.5),w.scene);l.diffuse=Color3.FromHexString('#dbe7dd');l.intensity=1.3;l.range=7;l.parent=w.root;l.metadata={nightWindow:true,dayIntensity:l.intensity};}
   lamp(w,-1.35,0,2.4,.7);lamp(w,1.05,1.48,3.35,.42);
   return;
 }
 const interior=w.editableAsset(tree?'canopy-room':'mushroom-room');
 // The architectural source stays complete. The camera-facing front section cuts away
 // only when the third-person camera is outside it; the walk/portal boundary stays real.
 w.configureIndoorCutaways(interior);
 for(const x of [-3.4,3.4]){const l=new PointLight('daylight through true open round window',v(x,3.1,10.5),w.scene);l.diffuse=Color3.FromHexString('#dbe7dd');l.intensity=2.3;l.range=10;l.parent=w.root;l.metadata={nightWindow:true,dayIntensity:l.intensity};}
 // Native editable furniture, fitted joinery, soft cushions and rug come from the saved room asset.
 const shelfZ=tree?10.7:10.4;
 stool(w,tree?1.8:3.6,0,tree?4.8:2,.95);
 mug(w,tree?1.2:3.2,1.285,tree?6.3:3.5);mug(w,tree?2.4:4.2,1.285,tree?6.6:3.8,'#9faf95');book(w,tree?1.8:3.7,1.30,tree?7:4.1,-.2);
 planter(w,tree?6.8:6.2,0,tree?3.3:0,1.5);planter(w,tree?-7:-6,0,tree?9:5.5,1.1);lamp(w,tree?-6.6:-6.5,0,tree?4:1,.95);lamp(w,1.13,2.23,shelfZ,.55);


}

export function* buildRegionalEnvironmentSteps(w:World,regionId:string):Generator<void>{
 if(regionId==='mushroom-grove')yield* forestLoop(w);
 if(regionId==='canopy-garden')canopyGrove(w);
 if(isExplorationInterior(regionId))homeInterior(w,regionId==='canopy-home');
}

/** Each original chapter gets authored structural silhouettes, not only dressing. */
export function enrichStoryLandmarks(w:World){
 const biome=w.chapter.biome;
 if(biome==='village'){
  // Orchard trellis and well form a lived-in side street focal point.
  const x=-12,z=18,y=w.height(x,z);lathe(w,'village cut limestone well',x,y,z,[[.85,0],[.95,.1],[.95,.95],[.8,1.05],[.69,.94],[.7,.25]],'#cec9ad',40);
  for(const s of [-1,1])w.box('well oak timber upright',x+s*1.2,y+1.7,z,.16,3.4,.16,'#a58b63');w.box('well timber roof ridge',x,y+3.3,z,3.2,.15,.15,'#a68b63');
  for(const s of [-1,1]){const r=w.box('well wood shingle pitched roof',x,y+3.1,z+s*.55,3.3,.13,1.2,'#81916c');r.rotation.x=s*.33;}
  for(let i=0;i<3;i++){const px=18+i*3.1,pz=18;w.tube('orchard pergola curved branch',curve([[px,y,pz],[px,y+3.1,pz],[px+2.5,y+3.3,pz]]),.11,'#9c8159',false);w.crown(px+1.2,y+3.6,pz,.9,91+i);}
 } else if(biome==='river'){
  const x=-22,z=26,y=w.height(x,z);for(let i=0;i<11;i++)w.box('riverside dock individual timber plank',x+i*.35,y+.15,z,.33,.16,5,'#b6a27c');
  for(const side of [-1,1])for(const dz of [-2.2,2.2])w.box('riverside dock mooring timber post',x+1.75+side*1.75,y+.47,z+dz,.2,1.2,.2,'#9f875c');
  const boat=lathe(w,'riverside carved timber skiff hull',-26,y+.3,27,[[0,-.3],[.48,-.2],[.85,.24],[.83,.31],[.71,.26],[.38,-.07],[0,-.13]],'#af8556',40);boat.scaling.z=2.8;boat.rotation.z=.08;w.box('riverside skiff timber rowing seat',-26,y+.42,27,1.35,.09,.48,'#bb9a6b');
 } else if(biome==='forest'){
  // A ruined open cloister frames the memory garden without closing its approach.
  for(const x of [-19,19])for(const z of [30,37,44]){const y=w.height(x,z);lathe(w,'forest cloister ancient limestone column',x,y,z,[[.6,0],[.65,.24],[.38,.45],[.32,3.8],[.52,4],[.6,4.2]],'#c1c1aa',32);w.rock(x+1,z+1,.7);}
  for(const x of [-19,19]){const y=w.height(x,37);w.tube('forest cloister broken stone arcade',curve([[x,y+4.1,30],[x,y+5.9,33.5],[x,y+4.1,37],[x,y+5.7,40.5],[x,y+4.1,44]]),.28,'#c3c6af',false);}
 } else if(biome==='graveyard'){
  // Family memorial chapel: real buttresses, asymmetric broken roof and warm niche.
  const x=-23,z=57,y=w.height(x,z);for(const side of [-1,1]){w.box('memorial chapel limestone wall',x+side*3,y+2.6,z,.6,5.2,7,'#a6adb0');for(const dz of [-2.6,2.6]){const b=w.box('memorial chapel stone buttress',x+side*3.65,y+1.9,z+dz,.75,3.8,1,'#9ea9aa');b.rotation.z=-side*.12;}}
  w.box('memorial chapel stone apse',x,y+2.6,z+3.4,6.4,5.2,.65,'#a6adb0');for(const side of [-1,1])w.tube('memorial chapel pointed stone arch',curve([[x+side*3,y+3.9,z-3.3],[x+side*1.8,y+6,z-3.3],[x,y+6.8,z-3.3]]),.32,'#bfc5c0',false);lamp(w,x,y,z,.9);
 } else if(biome==='castle'){
  // Lantern conservatory has curved tracery and a visible roof from the air.
  const x=27,z=53,y=w.height(x,z);for(const side of [-1,1])for(let i=0;i<4;i++){const zz=z-6+i*4;w.tube('castle conservatory wrought arch',curve([[x+side*5,y,zz],[x+side*4.8,y+4,zz],[x+side*2.3,y+6.2,zz],[x,y+6.8,zz]]),.11,'#829699',false);}
  for(const side of [-1,1])w.box('castle conservatory limestone sill',x+side*5,y+.25,z,.42,.5,12.5,'#bbc1b9');for(let i=0;i<4;i++)planter(w,x+(i%2?3:-3),y,z-4+Math.floor(i/2)*7,1.6);lamp(w,x,y,z,1.2);
 } else if(biome==='mountain'){
  for(const [x,z]of [[-21,46],[23,72]]){const y=w.height(x,z);for(const side of [-1,1]){const buttress=w.rock(x+side*3.3,z,3.7,'#c3c7ba',y+1.9);buttress.scaling.y=5.0;}const span=w.tube('mountain eroded stone wind arch',curve([[x-3.3,y+5,z],[x-2,y+8.5,z],[x,y+9,z],[x+2,y+8.5,z],[x+3.3,y+5,z]]),1.0,'#bcc2b6',false);}
 } else if(biome==='dragon'){
  const y=w.height(0,88);for(let i=0;i<7;i++){const a=.2+i*.45,x=Math.cos(a)*19,z=87+Math.sin(a)*19;const arch=w.tube('dragon nest ancient basalt rib',curve([[x,w.height(x,z),z],[x*.9,y+6,z-2],[x*.65,y+11,z-5]]),1.0,'#89939c');for(let k=0;k<3;k++)w.rock(x+(k-1)*1.5,z,1.2);}
 }
}
