import { Mesh, MeshBuilder, TransformNode, Vector3, VertexData, Curve3, StandardMaterial } from '@babylonjs/core';
import type { Landmark } from './content';
import type { World } from './world';
import { groundHeight, authoredTrees } from './world-surfaces';

const ground=(w:World,x:number,z:number)=>groundHeight(w.chapter,x,z);
function beam(w:World,name:string,a:Vector3,b:Vector3,width:number,depth:number,hex:string,animated=false){
  const m=MeshBuilder.CreateBox(name,{width,depth,height:Vector3.Distance(a,b)},w.scene);m.position.copyFrom(Vector3.Center(a,b));m.rotation.z=-Math.atan2(b.x-a.x,b.y-a.y);w.add(m,hex,!animated);return m;
}
function disc(w:World,name:string,x:number,y:number,z:number,diameter:number,hex:string,staticMesh=true){const m=MeshBuilder.CreateCylinder(name,{height:.035,diameter,tessellation:32},w.scene);m.position.set(x,y,z);w.add(m,hex,staticMesh);m.metadata.cameraObstacle=false;return m;}

/** Chamfered, individually uneven stone with metre-scaled UVs; closed underside and rounded light transitions. */
function dressedStone(w:World,name:string,x:number,y:number,z:number,width:number,height:number,depth:number,seed:number,staticMesh=true){
  const bevel=Math.min(.14,height*.20,width*.08,depth*.08),hx=width/2,hz=depth/2;
  const ring=[[-hx+bevel,-hz],[hx-bevel,-hz],[hx,-hz+bevel],[hx,hz-bevel],[hx-bevel,hz],[-hx+bevel,hz],[-hx,hz-bevel],[-hx,-hz+bevel]];
  const pos:number[]=[],uv:number[]=[],indices:number[]=[];
  const levels=[[-height/2, .965],[-height/2+bevel,1],[height/2-bevel,1],[height/2,.955]];
  for(let row=0;row<levels.length;row++)for(let i=0;i<8;i++){const [yy,scale]=levels[row],[xx,zz]=ring[i],variation=1+.018*Math.sin(seed+i*9.7);pos.push(xx*scale*variation,yy,zz*scale*variation);uv.push((i%2?width:depth)*i/5,yy/1.3);if(row<3){const a=row*8+i,b=row*8+(i+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}}
  // Duplicate the top for an upward face normal instead of a smooth dome.
  const start=pos.length/3;pos.push(0,height/2,0);uv.push(0,0);
  for(let i=0;i<8;i++){const [xx,zz]=ring[i],variation=1+.018*Math.sin(seed+i*9.7);pos.push(xx*.955*variation,height/2,zz*.955*variation);uv.push(xx/1.8,zz/1.8);}
  for(let i=0;i<8;i++)indices.push(start,start+1+i,start+1+(i+1)%8);
  const bottom=pos.length/3;pos.push(0,-height/2,0);uv.push(0,0);for(let i=0;i<8;i++)indices.push(bottom,i,(i+1)%8);
  const vd=new VertexData();vd.positions=pos;vd.uvs=uv;vd.indices=indices;vd.normals=[];VertexData.ComputeNormals(pos,indices,vd.normals);
  const mesh=new Mesh(name,w.scene);vd.applyToMesh(mesh);mesh.position.set(x,y,z);w.textured(mesh,'limestone',staticMesh,true, '#f7f3e7');return mesh;
}

/** A real working mill: tapered masonry, stitched linen sails, axle and rimmed water wheel. */
export function buildWindmill(w:World,l:Landmark){
  const s=l.scale??1,x=l.x,z=l.z,y=ground(w,x,z);
  const tower=MeshBuilder.CreateCylinder('windmill limewashed tapered masonry',{height:7.2*s,diameterBottom:3.5*s,diameterTop:2.35*s,tessellation:28},w.scene);tower.position.set(x,y+3.6*s,z);w.textured(tower,'plaster');
  for(const yy of [.2,1.0,5.7]){const ring=MeshBuilder.CreateTorus('windmill stone collar',{diameter:(3.52-yy*.16)*s,thickness:.15*s,tessellation:36},w.scene);ring.position.set(x,y+yy*s,z);w.textured(ring,'stone');}
  const roof=MeshBuilder.CreateCylinder('windmill slate curved roof',{height:2.15*s,diameterBottom:3.3*s,diameterTop:.15*s,tessellation:28},w.scene);roof.position.set(x,y+8.05*s,z);w.textured(roof,'terracotta');
  const door=w.box('windmill arched oak door',x,y+.9*s,z-1.72*s,.88*s,1.8*s,.1*s,'#9b805a');
  const canopy=w.box('windmill porch timber roof',x,y+2.2*s,z-2.05*s,1.75*s,.12*s,1.1*s,'#93785b');canopy.rotation.x=-.12;
  for(const side of [-1,1])w.box('windmill porch post',x+side*.78*s,y+1.1*s,z-2.44*s,.11*s,2.2*s,.11*s,'#88765b');
  for(const yy of [3.2,5.0]){w.box('windmill deep window reveal',x+.2*s,y+yy*s,z-1.35*s,.72*s,.84*s,.12*s,'#485968');w.box('windmill window transom',x+.2*s,y+yy*s,z-1.43*s,.065*s,.85*s,.08*s,'#bdac86');}
  const pivot=new TransformNode('windmill repaired sail axle',w.scene);pivot.parent=w.root;pivot.position.set(x,y+6.4*s,z-1.65*s);
  const own=(m:Mesh)=>{m.parent=pivot;m.receiveShadows=true;w.shadows.addShadowCaster(m);};
  const axle=MeshBuilder.CreateCylinder('mill bronze axle cap',{height:.55*s,diameter:.4*s,tessellation:20},w.scene);axle.rotation.x=Math.PI/2;axle.material=w.mat('#9f825b');own(axle);
  for(let i=0;i<4;i++){
    const sailRoot=new TransformNode('windmill radial sail '+i,w.scene);sailRoot.parent=pivot;sailRoot.rotation.z=i*Math.PI/2;
    const part=(name:string,xx:number,yy:number,zz:number,ww:number,hh:number,dd:number,hex:string)=>{const m=MeshBuilder.CreateBox(name,{width:ww*s,height:hh*s,depth:dd*s},w.scene);w.add(m,hex,false);m.parent=sailRoot;m.position.set(xx*s,yy*s,zz*s);return m;};
    part('windmill main sail timber',0,2.07,0,.11,4.65,.13,'#b29973');
    for(const side of [-1,1])part('windmill sail edge timber',side*.4,2.68,-.02,.052,3.10,.055,'#a78d66');
    for(let rib=0;rib<8;rib++)part('windmill sail lattice timber',0,1.16+rib*.41,-.06,.9,.045,.06,'#bca27c');
    // Shallow camber gives each canvas a lit and a shaded face, with both sides rendered.
    const p:number[]=[],uv:number[]=[],ix:number[]=[];
    for(let row=0;row<=12;row++)for(let col=0;col<=4;col++){const u=col/4,v=row/12;p.push((u-.5)*.77*s,(1.12+v*3.15)*s,(-.085-Math.sin(u*Math.PI)*.105)*s);uv.push(u*2,v*5);if(col<4&&row<12){const a=row*5+col;ix.push(a,a+1,a+5,a+1,a+6,a+5);}}
    const vd=new VertexData();vd.positions=p;vd.uvs=uv;vd.indices=ix;vd.normals=[];VertexData.ComputeNormals(p,ix,vd.normals);const cloth=new Mesh('windmill taut linen sail',w.scene);vd.applyToMesh(cloth);w.add(cloth,i%2?'#ede2c8':'#e3d1a9',false);cloth.parent=sailRoot;
  }
  const wheel=new TransformNode('river working water wheel',w.scene);wheel.parent=w.root;wheel.position.set(x+2.2*s,y+1.72*s,z+.2*s);
  for(const side of [-1,1]){const rim=MeshBuilder.CreateTorus('waterwheel laminated timber rim',{diameter:3.15*s,thickness:.16*s,tessellation:40},w.scene);w.add(rim,'#92724f',false);rim.parent=wheel;rim.rotation.z=Math.PI/2;rim.position.x=side*.4*s;}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const paddle=MeshBuilder.CreateBox('waterwheel angled oak paddle',{width:.94*s,height:.14*s,depth:.57*s},w.scene);w.add(paddle,'#a48760',false);paddle.parent=wheel;paddle.position.set(0,Math.cos(a)*1.45*s,Math.sin(a)*1.45*s);paddle.rotation.x=a;
    for(const side of [-1,1]){const spoke=MeshBuilder.CreateBox('waterwheel spoke timber',{width:.08*s,height:3.0*s,depth:.11*s},w.scene);w.add(spoke,'#8e7657',false);spoke.parent=wheel;spoke.position.x=side*.4*s;spoke.rotation.x=a;}}
  // Visible channel connecting the wheel to the actual north stream.
  const channelX=x+2.2*s;for(const side of [-1,1])w.box('mill water channel stone retaining side',channelX+side*.67*s,y-.25,z+6*s,.24*s,.56,12*s,'#aaa890');
  const stream=MeshBuilder.CreateGround('mill channel clear water',{width:1.12*s,height:12*s},w.scene);stream.position.set(channelX,y-.02,z+6*s);w.textured(stream,'water',false,false);stream.metadata.cameraObstacle=false;
  w.obstacles.push({x,z,r:1.78*s,top:y+9.2*s});
  let previous=0,speed=0,angle=-.28;
  w.animate(t=>{const dt=Math.min(.05,Math.max(0,t-previous));previous=t;const working=w.foundFlags.has('r-plate-east')||w.foundFlags.has('r-flow');speed+=(Number(working)-speed)*Math.min(1,dt*1.2);angle+=dt*speed*.20;pivot.rotation.z=angle;wheel.rotation.x=-angle*2.15;stream.visibility=.40+speed*.48;});
}

/** Ruins retain a passage but now have a readable broken wall, carved lintel and buried foundations. */
export function buildMemoryRuin(w:World,l:Landmark){
  const {x,z}=l,s=l.scale??1,y=ground(w,x,z);
  for(const side of [-1,1]){
    for(let course=0;course<6;course++){
      const h=.55*s,xx=x+side*2.05*s+(course>3?side*.04*s:0),yy=y+(course+.5)*h;
      const stone=dressedStone(w,'ruin individually worn limestone pier',xx,yy,z,1.18*s,h-.025,.88*s,course+side*11);stone.rotation.y=Math.sin(course*4.5+side)*.015;
    }
    const footing=w.box('ruin buried stone footing',x+side*2.05*s,y+.12*s,z,1.52*s,.25*s,1.28*s,'#c2bfa8');
    for(let k=0;k<4;k++){
      const xx=x+side*(2.7+k*.56)*s,zz=z+(k%2)*.12*s;
      dressedStone(w,'ruin fractured low wall blocks',xx,ground(w,xx,zz)+(.28+.13*Math.abs(Math.sin(k*5+side)))*s,zz,.65*s,(.56+.26*Math.abs(Math.sin(k*5+side)))*s,.76*s,k+side*5);
    }
    w.obstacles.push({x:x+side*2.05*s,z,r:.68*s,top:y+3.4*s});
  }
  const curve:Vector3[]=[];for(let i=0;i<=12;i++){const a=Math.PI-(i/12)*1.42;curve.push(new Vector3(x+Math.cos(a)*2.05*s,y+3.23*s+Math.sin(a)*1.35*s,z));}
  w.tube('ruin broken curved stone lintel',curve,.32*s,'#bcb9a7',false);
  for(let i=0;i<4;i++){const a=i/4*.46;const stone=dressedStone(w,'ruin fractured arch remnant',x+Math.cos(a)*2.05*s,y+3.25*s+Math.sin(a)*1.35*s,z,.5*s,.45*s,.95*s,i+21);stone.rotation.z=a+.2;}
  for(const side of [-1,1])for(let i=0;i<3;i++){const bead=disc(w,'ruin old bronze leaf ornament',x+side*2.05*s,y+.04,z-(.5+i*.26)*s,.12*s,'#a8a078');}
  const tip=w.box('ruin fallen lintel stone',x+3.4*s,ground(w,x+3.4*s,z-1.15*s)+.28*s,z-1.15*s,1.65*s,.48*s,.95*s,'#b3b5a3');tip.rotation.y=.43;
  for(let i=0;i<5;i++)disc(w,'ruin bronze star mosaic',x+(i-2)*.5*s,y+.06,z-1.8*s,.24*s,i%2?'#9ab6a1':'#c3aa6c');
  for(let side of [-1,1])w.tube('ruin embedded living root',Curve3.CreateCatmullRomSpline([new Vector3(x+side*3.6*s,y+.06,z+.8*s),new Vector3(x+side*2.4*s,y+.3*s,z+.6*s),new Vector3(x+side*1.7*s,y+.04,z+1.5*s)],5).getPoints(),.13*s,'#8a795e');
}

export function buildExplorationDistrict(w:World){
  const chapter=w.chapter;
  for(const p of chapter.terrain.platforms??[]){
    const y=ground(w,p.x,p.z),depth=Math.max(.25,p.height-y),locked=!!p.requiresFlag;
    // The physics rectangle and top surface use the exact same width, depth and absolute y.
    const slab=dressedStone(w,'authored weathered terrace stone '+p.id,p.x,p.height-depth/2-.045,p.z,p.width,depth-.09,p.depth,p.x+p.z,!locked);slab.metadata.cameraObstacle=false;
    const lip=dressedStone(w,'terrace worn limestone cap '+p.id,p.x,p.height-.085,p.z,p.width,.17,p.depth,p.x+p.z+1,!locked);lip.metadata.cameraObstacle=false;
    const accent=disc(w,'terrace engraved landing leaf',p.x,p.height+.025,p.z,.31,chapter.biome==='village'?'#c29a59':'#aac5b0',!locked);
    if(locked){let level=0;w.animate(t=>{const enabled=w.foundFlags.has(p.requiresFlag!);level+=(Number(enabled)-level)*.12;slab.position.y=p.height-depth/2-.045-(1-level)*1.05;lip.position.y=p.height-.085-(1-level)*1.05;accent.visibility=level;});}
    else for(const side of [-1,1]){w.grassTuft(p.x+side*(p.width/2+.22),p.z+.6,.5,p.x+side);}
  }
  if(chapter.biome==='village'||chapter.biome==='forest'||chapter.biome==='river'){
    // Deliberately uneven woodland groups fill foreground, path bends and reverse views.
    authoredTrees(chapter).forEach(({x,z,s,seed},i)=>{w.tree(x,z,s,seed);for(let j=0;j<6;j++){const a=j*2.39,xx=x+Math.cos(a)*2.0,zz=z+Math.sin(a)*1.5;if(w.pathDistance(xx,zz)>2.5)w.fern(xx,zz,.7+(j%3)*.18,100+i*7+j);}});
    if(chapter.biome==='forest'){
      // Low root arches and fallen timber frame the memory side route without obstructing it.
      for(const [x,z,a]of [[14,62,.6],[-8,61,-.5],[12,76,.3]]){const yy=ground(w,x,z);w.tube('fallen forest trunk with broken heartwood',[new Vector3(x-2,ground(w,x-2,z-a)+.21,z-a),new Vector3(x,yy+.32,z),new Vector3(x+2.4,ground(w,x+2.4,z+a)+.19,z+a)],.35,'#88755b',false);for(let i=0;i<3;i++)w.fern(x-1+i,z+1,.78,32+i);}
      // A half circle of low tablets makes the central memorial a place, not a recoloured arch.
      for(let i=0;i<5;i++){const a=Math.PI*.16+i*Math.PI*.17,x=9.5+Math.cos(a)*4.2,z=66.5+Math.sin(a)*4.2,y=ground(w,x,z);const tablet=dressedStone(w,'memory garden worn inscription tablet',x,y+.65,z,.75,1.3,.28,i+8);tablet.rotation.y=-a;disc(w,'memory garden leaf inset',x,y+.018,z-1,.22,'#bcb882');}
    }
    if(chapter.biome==='village'){
      for(const [x,z]of [[25,18.5],[29.3,21.5],[33.7,25]]){const a=disc(w,'orchard brass apple waymark',x,ground(w,x,z)+.045,z,.22,'#cfa260');}
      w.lantern(30.8,29.4,.62);w.rock(35.6,32.4,1.12);
    }
    if(chapter.biome==='river'){
      // Retaining piers and broad stone landing indicate the optional downstream loop.
      for(const z of [58,73.7]){w.lantern(33.5,z,.72);for(const side of [-1,1])w.rock(30+side*2.25,z,.62);}
      for(const [x,z]of [[-5,51],[7,51]]){
        const yy=ground(w,x,z);for(const side of [-1,1]){const arm=w.box('sluice plate flanking stone curb',x+side*1.55,yy+.18,z,.28,.36,2.6,'#aaa993');arm.metadata.cameraObstacle=false;}
      }
      // A clear line links both existing plates to the working sluice.
      const y=ground(w,1,51);const channel=w.tube('sluice bronze synchronization line',[new Vector3(-4,y+.035,51),new Vector3(6,y+.035,51)],.035,'#bca56e',false);channel.metadata.cameraObstacle=false;
    }
  }
  if(chapter.biome==='graveyard'){
    // Warm family offerings in the cold memorial setting; candle groups brighten as names are restored.
    for(const [index,[x,z]]of [[-20,27],[22,52],[-2,77]].entries()){const y=ground(w,x,z);for(let i=0;i<4;i++){const cup=w.box('memorial candle wax',x+i*.25,y+.18,z+.36*Math.sin(i),.12,.36,.12,'#e6d9b5');const flame=MeshBuilder.CreateSphere('memorial warm candle flame',{diameter:.07,segments:8},w.scene);flame.position.set(cup.position.x,y+.4,cup.position.z);w.add(flame,'#ffc980',false,.5);w.animate(()=>{const lit=w.foundFlags.has(['g-lantern-gardener','g-lantern-singer','g-lantern-king'][index]);flame.setEnabled(lit);});}for(let i=0;i<5;i++)w.flower(x+i*.2,z-.4,i);}
    const bells=[[-12,64],[13,69]];for(const [x,z]of bells)w.lantern(x,z,.8);
  }
  if(chapter.biome==='castle'){
    // Library and observatory are actual readable fixtures along their existing branches.
    for(const z of [25,30,35])for(const side of [-1,1]){const x=-30+side*3,y=ground(w,x,z);w.box('library oak shelf backing',x,y+1.3,z,.24,2.6,3.7,'#68533f');for(let row=0;row<3;row++){w.box('library timber shelf',x-side*.32,y+.35+row*.8,z,.75,.1,3.7,'#a68b63');for(let b=0;b<9;b++)w.box('library cloth book spine',x-side*.32,y+.68+row*.8,z-1.55+b*.36,.48,.54+(b%3)*.06,.23,['#9a755c','#697c78','#a88e66'][b%3]);}}
    for(const [id,x]of [['c-plate-sun',-8],['c-plate-moon',8]] as const){const z=55,y=ground(w,x,z);const stand=MeshBuilder.CreateTorus('observatory engraved mirror frame',{diameter:2.5,thickness:.12,tessellation:48},w.scene);stand.position.set(x,y+2.1,z+1.5);stand.rotation.x=Math.PI/2;w.add(stand,id==='c-plate-sun'?'#ceac68':'#afbacc');
      const face=MeshBuilder.CreateDisc('observatory polished mirror face',{radius:1.13,tessellation:48},w.scene);face.position.set(x,y+2.1,z+1.48);w.add(face,id==='c-plate-sun'?'#b8c4c3':'#a8bbd1',false);face.material!.backFaceCulling=false;
      const ray=w.tube('observatory joined mirror light',[new Vector3(x,y+2.1,z+1.45),new Vector3(0,ground(w,0,69)+.07,69)],.026,'#d9ca98',false,false);ray.metadata.cameraObstacle=false;ray.material=w.mat('#e1d5a4',.36,.6);w.animate(()=>{ray.visibility=w.foundFlags.has('c-plate-moon')?1:0;});
    }
  }
  if(chapter.biome==='mountain'){
    for(const p of chapter.terrain.shelters??[]){
      const y=ground(w,p.x,p.z);const back=w.box('stone wing shelter back',p.x,y+1.35,p.z+2.6,4.9,2.7,.75,'#abb4b4');
      const roof=w.box('stone wing shelter solid roof',p.x,y+2.87,p.z+1.15,5.15,.44,3.7,'#c4c6b9');roof.rotation.z=.035;
      for(const side of [-1,1])w.box('stone wing shelter supporting pier',p.x+side*2.35,y+1.2,p.z-.25,.42,2.4,.45,'#a5afaa');
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2;disc(w,'stone wing pale shelter boundary',p.x+Math.cos(a)*(p.radius-.3),y+.045,p.z+Math.sin(a)*(p.radius-.3),.20,'#e0dcc1');}
      w.lantern(p.x-2.75,p.z,.72);
    }

    // Wind direction and sheltered backs of the existing west rocks are readable from the main trail.
    for(const [x,z]of [[-25,20],[13,39],[-13,66],[21,83]]){const y=ground(w,x,z);w.box('mountain wind marker timber',x,y+1.2,z,.09,2.4,.09,'#a99775');const flag=w.box('shelter wind ribbon',x+.48,y+2.15,z,.95,.22,.025,'#e6c394');w.animate(t=>{flag.rotation.y=Math.sin(t*3+z)*.18;});for(let i=0;i<4;i++)disc(w,'shelter route pale marker',x-i*.65,y+.035,z+.3,.16,'#d4cdb2');}
  }
  if(chapter.biome==='dragon'){
    const homeY=ground(w,-2.5,101);dressedStone(w,'two homes branching light stone',-2.5,homeY+.15,101,2.7,.3,1.7,92);
    for(const side of [-1,1]){
      const points=[new Vector3(-2.5,homeY+.32,101),new Vector3(-2.5+side*1.7,homeY+.23,102),new Vector3(-2.5+side*3.8,ground(w,-2.5+side*3.8,104)+.06,104)];
      const ray=w.tube('two homeward warm light streams',points,.038,'#c4bda6',false,false);ray.metadata.cameraObstacle=false;ray.material=w.mat('#f5d38d',.01);
      w.animate(()=>{if(w.foundFlags.has('d-homeward-light'))(ray.material as StandardMaterial).emissiveColor.set(.8,.52,.16);});
      w.lantern(-2.5+side*3.8,104,.7);
    }

    for(const it of chapter.interactions.filter(i=>i.questRole==='main')){
      const target={x:0,z:83},points:Vector3[]=[];for(let i=0;i<=20;i++){const t=i/20,x=it.x*(1-t)+target.x*t,z=it.z*(1-t)+target.z*t;points.push(new Vector3(x,ground(w,x,z)+.025,z));}
      const conduit=w.tube('homeward repaired star channel',points,.035,'#aeb9ad',false,false);conduit.metadata.cameraObstacle=false;conduit.material=w.mat(it.id==='d-anchor-home'?'#d7c48b':it.id==='d-anchor-memory'?'#d8c58b':'#d9c68b',.06);w.animate(()=>{const mat=conduit.material as StandardMaterial;if(w.foundFlags.has(it.id))mat.emissiveColor.set(.45,.30,.08);});
    }
  }
}
