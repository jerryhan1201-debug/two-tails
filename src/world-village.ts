import { Color3, DynamicTexture, Mesh, MeshBuilder, PBRMaterial, StandardMaterial, Vector3, VertexData, VertexBuffer } from '@babylonjs/core';
import type { World } from './world';

/** Authored first-chapter spaces. These are scenery, not new quests or interactions. */
export function buildVillageDistrict(w:World){for(const _ of buildVillageDistrictSteps(w)){} }
export function* buildVillageDistrictSteps(w: World):Generator<void> {
  const ground=(x:number,z:number)=>w.height(x,z);
  const box=(name:string,x:number,y:number,z:number,a:number,b:number,c:number,hex='#ffffff')=>w.box(name,x,y,z,a,b,c,hex);
  const post=(x:number,z:number,h=1.1)=>box('weathered fence wood post',x,ground(x,z)+h/2,z,.13,h,.13);
  const fence=(x1:number,z1:number,x2:number,z2:number)=>{
    const length=Math.hypot(x2-x1,z2-z1),n=Math.ceil(length/1.6);
    w.obstacles.push({x:(x1+x2)/2,z:(z1+z2)/2,r:0,shape:"box",width:.13,depth:length,rotation:Math.atan2(x2-x1,z2-z1),top:Math.max(ground(x1,z1),ground(x2,z2))+1.1});
    for(let i=0;i<=n;i++){const t=i/n,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;post(x,z);}
    for(const h of [.38,.81])w.tube('split timber fence rail',[new Vector3(x1,ground(x1,z1)+h,z1),new Vector3(x2,ground(x2,z2)+h,z2)],.054,'#9e8b68',false).metadata.cameraObstacle=false;
  };
  const shrub=(x:number,z:number,s:number,seed:number)=>{
    // Leaf volume with a different height/shape than the canopy, anchored in clusters.
    w.crown(x,ground(x,z)+s*.62,z,s,seed);
    if(seed%3===0)w.fern(x+s*.3,z+s*.7,s*.72,seed);
  };
  const barrel=(x:number,z:number,s=.8)=>{
    w.obstacles.push({x,z,r:s*.36,top:ground(x,z)+s});
    const y=ground(x,z),m=MeshBuilder.CreateCylinder('barrel oak wood staves',{height:s,diameterTop:s*.66,diameterBottom:s*.70,tessellation:16},w.scene);
    m.position.set(x,y+s*.5,z);w.add(m,'#b29a70');
    for(const h of [.17,.78]){const ring=MeshBuilder.CreateTorus('barrel iron hoop',{diameter:s*.715,thickness:s*.033,tessellation:24},w.scene);ring.position.set(x,y+s*h,z);w.add(ring,'#64594b');ring.metadata.cameraObstacle=false;}
  };
  const logPile=(x:number,z:number)=>{
    w.obstacles.push({x:x+.38,z,r:0,shape:'box',width:1.04,depth:1.4,rotation:0,top:ground(x,z)+.7});
    for(let row=0;row<3;row++)for(let i=0;i<4-row;i++){
      const m=MeshBuilder.CreateCylinder('split firewood timber',{height:1.4,diameter:.25,tessellation:10},w.scene);
      m.rotation.x=Math.PI/2;m.position.set(x+i*.25+row*.12,ground(x,z)+.13+row*.22,z);w.add(m,'#997754');
      const end=MeshBuilder.CreateDisc('firewood end grain',{radius:.11,tessellation:12},w.scene);end.position.set(m.position.x,m.position.y,z-.705);w.add(end,'#d7b886');end.metadata.cameraObstacle=false;
    }
  };
  const trail=(ax:number,az:number,bx:number,bz:number,width:number)=>{
    const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),pos:number[]=[],uv:number[]=[],ix:number[]=[];
    const n=Math.ceil(len/.3),across=Math.ceil(width/.3);
    for(let i=0;i<=n;i++)for(let j=0;j<=across;j++){const side=j/across*2-1,x=ax+dx*i/n+dz/len*side*width/2,z=az+dz*i/n-dx/len*side*width/2;pos.push(x,w.renderedGroundHeight(x,z)+.024,z);uv.push(j/across,len*i/n/4);if(i<n&&j<across){const a=i*(across+1)+j,b=a+across+1;ix.push(a,a+1,b,a+1,b+1,b);}}
    const d=new VertexData();d.positions=pos;d.indices=ix;d.uvs=uv;d.normals=[];VertexData.ComputeNormals(pos,ix,d.normals);const m=new Mesh('cottage garden worn trail',w.scene);d.applyToMesh(m);w.textured(m,'trail',true,false);m.metadata.cameraObstacle=false;
  };

  // A compact village street: varied roof directions, modest gardens, clear central lane.
  yield;w.house(-8.9,-5.9,.91,-.72);
  yield;w.house(9.5,-3.5,1.02,.74);
  yield;w.house(-9.7,14.9,.78,-.83);
  yield;
  trail(-2,-5,-6.6,-7.9,1.8);trail(2,-3,6.7,-5.7,1.8);trail(-2,12,-7.3,12.7,1.65);
  fence(-5.8,-12,-5.8,-8.4);fence(-5.8,-4.7,-5.8,-1.9);
  fence(6.3,-10.7,6.3,-6.8);fence(6.3,-1.5,6.3,2.7);
  fence(-12,10.3,-6.3,10.3);fence(7.6,13.1,9.9,13.1);fence(12.2,13.1,13.8,13.1);
  for(const [x,z,s,seed]of [[-6.2,-10.8,.64,21],[-6.8,-3.5,.63,25],[6.8,-9,.62,11],[6.9,1.5,.76,16],[-6.7,11,.67,41],[8.1,13.6,.85,44],[-18,7,1.1,64],[15,11,1.1,84]])shrub(x,z,s,seed);
  for(const [x,z]of [[-6.5,-9.6],[-6.6,-2.5],[7,-8.1],[7.1,.4],[-6.2,10.9],[8.8,13.5]])for(let i=0;i<5;i++)w.flower(x+Math.sin(i*2.4)*.5,z+Math.cos(i*2.4)*.5,i+3);
  logPile(-11,-4);logPile(12.1,-5.7);logPile(-17,7);
  barrel(-7.2,-8.1,.72);barrel(-7.6,-8.5,.55);barrel(6.8,-2.2,.82);barrel(-12.3,1.1,.68);
  yield;
  // The market is an authored place: a woven canopy, open crates, bread and
  // orchard fruit. Curved mesh valances replace flattened spheres at the hem.
  const mx=7.8,mz=8.7,my=ground(mx,mz);
  w.obstacles.push({x:mx,z:mz,r:0,shape:"box",width:3.12,depth:1.72,rotation:0,top:my+3.15});
  for(const dx of [-1.43,1.43])for(const dz of [-.73,.73])box('market timber post',mx+dx,my+1.38,mz+dz,.12,2.76,.12);
  for(const dz of [-.73,.73])box('market oak crossbeam',mx,my+2.73,mz+dz,3.1,.12,.13);
  for(let i=0;i<7;i++)box('market timber counter plank',mx-1.32+i*.44,my+.94,mz,.42,.12,1.58);
  for(const z of [-.73,.73])box('counter timber apron',mx,my+.75,mz+z,3.08,.29,.09);
  for(let stripe=0;stripe<10;stripe++){yield;
    const x=mx-1.8+stripe*.36,points:number[]=[],indices:number[]=[],uvs:number[]=[],cols=4,rows=14;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const t=j/rows,u=i/cols,xx=x+u*.36,z=mz-1.05+t*2.10;
      const y=my+2.66+.24*Math.sin(t*Math.PI)+.022*Math.sin((stripe+u)*Math.PI*2)*Math.sin(t*Math.PI);
      points.push(xx,y,z);uvs.push(u*2,t*8);if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
    const makeCloth=(name:string,p:number[],ix:number[],uv:number[])=>{const vd=new VertexData();vd.positions=p;vd.indices=ix;vd.uvs=uv;vd.normals=[];VertexData.ComputeNormals(p,ix,vd.normals);const m=new Mesh(name,w.scene);vd.applyToMesh(m);w.add(m,stripe%2?'#f0dec0':'#b76548');m.material!.backFaceCulling=false;m.metadata.cameraObstacle=false;};
    makeCloth('tensioned linen market canopy',points,indices,uvs);
    for(const edge of [-1,1]){
      const p:number[]=[],ix:number[]=[],uv:number[]=[];
      for(let i=0;i<=10;i++){const u=i/10,xx=x+u*.36,z=mz+edge*1.05;const drop=.16+.11*Math.sin(u*Math.PI);p.push(xx,my+2.66,z,xx,my+2.66-drop,z+edge*.026);uv.push(u,0,u,1);if(i<10){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}}
      makeCloth('hanging linen awning hem',p,ix,uv);
    }
  }
  const crate=(x:number,z:number,y:number,width=.82,depth=.62)=>{
    box('produce crate timber floor',x,y+.025,z,width,.05,depth);
    for(const side of [-1,1])for(let j=0;j<2;j++)box('produce crate timber slat',x,y+.09+j*.13,z+side*depth*.5,width,.085,.035);
    for(const side of [-1,1])for(let j=0;j<2;j++)box('produce crate timber end',x+side*width*.5,y+.09+j*.13,z,.035,.085,depth);
  };
  const fruit=(x:number,y:number,z:number,pear:boolean,seed:number)=>{
    const profile=pear?[[0,0],[.055,.018],[.10,.065],[.105,.13],[.08,.19],[.044,.245],[.028,.27],[0,.272]]:[[0,0],[.07,.016],[.12,.07],[.12,.15],[.09,.20],[.035,.215],[0,.20]];
    const m=MeshBuilder.CreateLathe(pear?'orchard pear with narrow neck':'orchard apple dimpled crown',{shape:profile.map(([r,h])=>new Vector3(r,h,0)),tessellation:16,cap:Mesh.CAP_ALL},w.scene);
    const p=m.getVerticesData(VertexBuffer.PositionKind)!;for(let i=0;i<p.length;i+=3){const a=Math.atan2(p[i+2],p[i]);const l=1+.035*Math.cos(a*5);p[i]*=l;p[i+2]*=l;}
    m.setVerticesData(VertexBuffer.PositionKind,p);const n:number[]=[];VertexData.ComputeNormals(p,m.getIndices()!,n);m.setVerticesData(VertexBuffer.NormalKind,n);m.position.set(x,y,z);m.rotation.y=seed*.71;w.add(m,pear?'#bcbf67':seed%3?'#b84d38':'#d79555');m.metadata.cameraObstacle=false;
    // Orchard skins retain a restrained highlight under the canvas shade.
    const skin=m.material as PBRMaterial;skin.roughness=.46;skin.environmentIntensity=.68;
    w.tube('short fruit stalk',[new Vector3(x,y+(pear?.258:.205),z),new Vector3(x+.012,y+(pear?.315:.26),z-.01)],.009,'#5c4830',false).metadata.cameraObstacle=false;
  };
  crate(mx-.87,mz,my+1.02);crate(mx+.05,mz,my+1.02);
  for(let row=0;row<2;row++)for(let i=0;i<3;i++){fruit(mx-1.13+i*.25,my+1.07,mz-.15+row*.29,false,i+row*3);fruit(mx-.2+i*.25,my+1.07,mz-.15+row*.29,true,i);}
  // Fresh loaves have a shaped crust and shallow scored cuts rather than fruit balls.
  for(let i=0;i<3;i++){
    const bx=mx+1.01,bz=mz-.43+i*.38,loaf=MeshBuilder.CreateSphere('oval baked bread crust',{diameter:1,segments:16},w.scene);loaf.scaling.set(.57,.21,.28);loaf.position.set(bx,my+1.10,bz);loaf.rotation.y=.1;w.add(loaf,'#be8749');loaf.metadata.cameraObstacle=false;
    for(let cut=0;cut<3;cut++)w.tube('bread scored flour cut',[new Vector3(bx-.16+cut*.15,my+1.198,bz-.047),new Vector3(bx-.10+cut*.15,my+1.207,bz+.043)],.012,'#edcca1',false).metadata.cameraObstacle=false;
  }
  crate(mx+1.3,mz+1.42,ground(mx+1.3,mz+1.42),.94,.7);
  w.obstacles.push({x:mx+1.3,z:mz+1.42,r:0,shape:'box',width:.98,depth:.74,rotation:0,top:ground(mx+1.3,mz+1.42)+.72});
  barrel(mx-1.72,mz+.62,.63);
  // Broad street-to-market apron and a garden-side route to the existing postman.
  // These keep the middle of the main road and the first encounter at (-6,24) open.
  trail(1.8,8.1,7.8,6.9,3.5);trail(7.8,11.4,11.0,14.9,2.3);trail(11,14.9,16,15,2.0);
  yield;
  trail(-2.0,2.0,-6.8,1.1,2.5);

  // Low masonry well at the edge of the existing square, with a real hollow
  // opening, individual blocks and a timber winding frame. Decoration only.
  yield;
  const wx=-4.5,wz=10.0,wy=ground(wx,wz);
  w.obstacles.push({x:wx,z:wz,r:.92,top:wy+2.7});
  for(let row=0;row<3;row++)for(let i=0;i<12;i++){
    const a=(i+(row%2)*.5)/12*Math.PI*2, stone=box('well weathered limestone block',wx+Math.sin(a)*.73,wy+.14+row*.25,wz+Math.cos(a)*.73,.37,.235,.31);
    stone.rotation.y=a;
  }
  const water=MeshBuilder.CreateDisc('well deep dark opening',{radius:.56,tessellation:24},w.scene);water.rotation.x=Math.PI/2;water.position.set(wx,wy+.20,wz);w.add(water,'#243d3b');water.metadata.cameraObstacle=false;
  for(const side of [-1,1])box('well timber support',wx+side*.86,wy+1.15,wz,.13,2.3,.15);
  box('well timber lintel',wx,wy+2.25,wz,2.06,.15,.22);
  w.tube('well timber winding spindle',[new Vector3(wx-.95,wy+1.69,wz),new Vector3(wx+.98,wy+1.69,wz)],.082,'#ad8c5c',false);
  w.tube('well bucket rope',[new Vector3(wx,wy+1.69,wz),new Vector3(wx,wy+.43,wz)],.015,'#ba9d6b',false).metadata.cameraObstacle=false;
  yield;
  trail(-2.3,10,-3.8,10,2.1);

  // A few deliberate groves make foreground / middle / forest edge layers.
  // Their trunks stay outside the houses, market circulation and combat lane.
  for(const [x,z,s,seed]of [[-16,-10,1.05,607],[17,-10,1.12,611],[-18,10,1.1,613],[19,3,1.18,621],[18,20,1.1,629],[-16,24,1.26,631],[11,23,1.2,637]])w.tree(x,z,s,seed);
  for(const [x,z,span,seed]of [[-6.25,-11,2.8,51],[-6.4,-2.9,2.0,59],[6.8,-9.8,2.7,67],[6.8,.5,2.0,71],[-9.6,10.8,3.8,79],[9.0,13.65,1.3,83],[13.6,13.65,1.3,89],[-12,20.5,3.4,97],[14.3,19.3,3.5,101]]){
    for(let i=0;i<5;i++){
      const xx=x+(i-2)*span/5,zz=z+.26*Math.sin(i*2.4+seed);
      w.grassTuft(xx,zz,.44+(i%2)*.13,seed+i);
      if(i%2===0){shrub(xx,zz+.42,.39+(i%3)*.055,seed+i);w.flower(xx+.2,zz-.24,i+seed);}
    }
  }

  // Signs are textured objects in the scene, no UI buttons or new interaction systems.
  const sign=(x:number,z:number,label:string)=>{
    const y=ground(x,z);post(x,z,2.4);
    const face=box('carved village timber sign',x+.42,y+1.9,z,.92,.56,.08);
    const tex=new DynamicTexture('village hand lettered sign',{width:512,height:256},w.scene,false);const ctx=tex.getContext();ctx.fillStyle='#6b5541';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#c5ac7d';ctx.lineWidth=8;ctx.strokeRect(12,12,488,232);ctx.fillStyle='#f5e4b8';ctx.font='bold 57px serif';ctx.fillText(label,(512-ctx.measureText(label).width)/2,149);tex.update();
    const mat=new StandardMaterial('carved village sign ink',w.scene);mat.diffuseTexture=tex;mat.specularColor=Color3.Black();face.material=mat;face.onDisposeObservable.add(()=>{mat.dispose(false,false);tex.dispose();});face.metadata.cameraObstacle=false;
  };
  sign(-4.2,7.7,'灯火村');sign(4.5,23,'溪岸 →');

  // Forest groves: planted as irregular communities around clear routes, not a grid.
  let r=83017;const rand=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
  yield;
  for(const [cx,cz]of [[-16,48],[14,57],[-17,75],[19,84],[-28,95]]){
    for(let i=0;i<15;i++){
      const a=rand()*Math.PI*2,rr=2+rand()*10,x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;
      if(w.pathDistance(x,z)<4.5||Math.abs(x)>38||w.chapter.interactions.some(p=>Math.hypot(p.x-x,p.z-z)<3.3))continue;
      w.tree(x,z,1.25+rand()*1.35,300+i+Math.floor(cz));
      for(let j=0;j<3;j++){const bx=x+Math.sin(j*2.4)*1.9,bz=z+Math.cos(j*2.4)*1.9;if(w.pathDistance(bx,bz)>3.5)shrub(bx,bz,.65+rand()*.58,i*7+j);}
    }
  }
  // Understory, deadwood and moss stone groupings on the inner sides of the forest route.
  yield;
  for(const [x,z]of [[-8,41],[-10,54],[4,62],[-12,69],[11,77],[-7,89]]){
    w.rock(x,z,.95);w.rock(x+1.2,z+.3,.53);shrub(x-.8,z+.8,.78,Math.floor(z));
    for(let i=0;i<6;i++)w.fern(x+Math.sin(i*2.4)*1.7,z+Math.cos(i*2.4)*1.6,.7+(i%3)*.15,i+Math.floor(z));
  }
  yield;
  for(const [x,z]of [[-13,59],[14,65],[-21,85]]){
    w.obstacles.push({x,z,r:0,shape:"box",width:.6,depth:4,rotation:Math.atan2(3.8,1.1),top:ground(x,z)+.62});
    const y=ground(x,z);w.tube('fallen old tree trunk',[new Vector3(x-1.8,y+.24,z-.5),new Vector3(x,y+.30,z),new Vector3(x+2,y+.15,z+.6)],.3,'#8a7960',false);
    for(let i=0;i<3;i++)shrub(x-1+i,z+.7,.47,76+i);
  }
  // Orchard trees and layered banks frame both approaches without obstructing bridge deck.
  yield;
  for(const [x,z]of [[17,28],[34,26],[36,44],[18,47],[38,51]]){
    if(w.pathDistance(x,z)<3.5)continue;w.tree(x,z,1.05,Math.floor(x*7+z));
    shrub(x-1.4,z+.4,.67,Math.floor(x));
  }
  yield;
  for(const [x,z]of [[13,33],[18,33],[32,32],[37,33],[15,41],[31,42],[39,42]]){
    w.rock(x,z,.7);shrub(x+.8,z+.7,.66,Math.floor(x+z));for(let i=0;i<4;i++)w.grassTuft(x+Math.sin(i)*.8,z+Math.cos(i)*.8,1.05,i+Math.floor(x));
  }
}
