import {transitionLight} from './light-transition';
import {Color3,Mesh,MeshBuilder,PBRMaterial,SpotLight,Texture,TransformNode,Vector3,VertexData,type AbstractMesh} from '@babylonjs/core';
import goldModel from '../tools/gold-v6-blender.geometry.json';
import whiteModel from '../tools/white-v6-blender.geometry.json';
import {bakeStatue} from './statue-bake';
import {COURTYARD_STATUES as STATUES} from './villa-display-layout';
import {HOME_ART} from './villa-layout-v13';
import type {World} from './world';
/** Static local additions; all art derives from the eight supplied current PNGs. */
export function buildHomeV13(w:World){
 const scene=w.scene,meshes:Mesh[]=[],materials:PBRMaterial[]=[],textures:Texture[]=[],glows:Mesh[]=[],artPlanes:Mesh[]=[];
 const mat=(name:string,tint:string,rough=.8,metal=0)=>{const m=new PBRMaterial('V13 '+name,scene);m.albedoColor=Color3.FromHexString(tint).toLinearSpace();m.metallic=metal;m.roughness=rough;m.maxSimultaneousLights=4;materials.push(m);return m;};
 const oak=mat('smoked oak','#896f50'),edge=mat('fine bronze','#62523c',.45,.65),linen=mat('oatmeal','#cfc2a8'),sage=mat('woven sage','#7e9588'),rubber=mat('gym rubber','#3b4547'),steel=mat('gym powder coated metal','#697371',.58,.3),paper=mat('book paper','#d9d0bb');
 const lamp=mat('warm lamp diffuser','#fff0d5');lamp.emissiveColor=Color3.FromHexString('#d6ad73').scale(.5);
 const bronze=mat('aged warm bronze sculpture','#9e8053',.47,.75),patina=mat('sculpture inset patina','#4f4937',.64,.65),stone=mat('sculpture plinth','#b4afa1',.81);
 const register=(m:Mesh,material:PBRMaterial,parent:TransformNode=w.root,solid=false)=>{m.parent=parent;m.material=material;m.receiveShadows=true;m.isPickable=solid;m.metadata={villa:true,villaRole:'furniture',cameraObstacle:solid,homeV13:true};meshes.push(m);if(material!==lamp)w.shadows.addShadowCaster(m);return m;};
 const box=(name:string,x:number,y:number,z:number,a:number,b:number,c:number,m=oak,parent:TransformNode=w.root,solid=false)=>{const o=MeshBuilder.CreateBox(name,{width:a,height:b,depth:c},scene);o.position.set(x,y,z);return register(o,m,parent,solid);};
 const tube=(name:string,points:number[][],radius:number,m=edge,parent:TransformNode=w.root)=>register(MeshBuilder.CreateTube(name,{path:points.map(p=>Vector3.FromArray(p)),radius,tessellation:10,cap:Mesh.CAP_ALL},scene),m,parent);
 const sphere=(name:string,x:number,y:number,z:number,size:number[],m=linen,parent:TransformNode=w.root)=>{const o=MeshBuilder.CreateSphere(name,{diameter:1,segments:12},scene);o.position.set(x,y,z);o.scaling=Vector3.FromArray(size);return register(o,m,parent);};
 const glow=(o:Mesh)=>{o.metadata.artificialGlow=true;glows.push(o);return o;};

 const accents:{id:string;position:Vector3;target:Vector3;meshes:AbstractMesh[];power:number;range:number;angle:number}[]=[];
 for(const art of HOME_ART){const root=new TransformNode('home artwork '+art.id+' '+art.title,scene);root.parent=w.root;root.position=Vector3.FromArray(art.at);root.rotation.y=art.yaw;
  const tex=new Texture('/assets/home-art/v13/'+art.id+'.webp',scene,false,true,Texture.TRILINEAR_SAMPLINGMODE);tex.anisotropicFilteringLevel=8;textures.push(tex);
  const canvas=mat('art '+art.id+' '+art.title,'#ffffff',.95);canvas.albedoTexture=tex;canvas.environmentIntensity=.25;
  const painting=MeshBuilder.CreatePlane('art '+art.id+' complete uncropped canvas',{width:art.width,height:art.height},scene);register(painting,canvas,root);painting.metadata.artId=art.id;painting.receiveShadows=false;w.shadows.removeShadowCaster(painting);artPlanes.push(painting);
  box('art '+art.id+' back support',0,0,.028,art.width+.08,art.height+.08,.055,oak,root);
  for(const side of [-1,1]){box('art '+art.id+' thin frame upright',side*(art.width/2+.017),0,-.012,.035,art.height+.07,.055,edge,root);box('art '+art.id+' thin frame rail',0,side*(art.height/2+.017),-.012,art.width,.035,.055,edge,root);}
  tube('picture '+art.id+' bracket',[[0,art.height/2+.12,.02],[0,art.height/2+.28,-.26]],.026,edge,root);
  box('picture '+art.id+' dedicated light bar',0,art.height/2+.27,-.28,art.width*.53,.09,.13,edge,root);glow(box('picture '+art.id+' diffuser',0,art.height/2+.217,-.28,art.width*.48,.018,.09,lamp,root));
  root.computeWorldMatrix(true);accents.push({id:'art-'+art.id,position:Vector3.TransformCoordinates(new Vector3(0,art.height/2+.22,-.35),root.getWorldMatrix()),target:Vector3.FromArray(art.at),meshes:[painting],power:4.2,range:4,angle:1.6});
 }
 // Two bookcase groups share covers and pages; only their outer carcasses collide.
 const covers=['#697c70','#966d56','#ad9d74'].map((c,i)=>mat('book cloth '+i,c));
 for(const x of [.7,4.8]){box('study bookcase backing',x,6.45,-11.48,2,2.7,.12,oak);for(const side of [-1,1])box('study bookcase side',x+side*.96,6.45,-11.3,.08,2.7,.43,oak);
  for(let row=0;row<4;row++){const y=5.28+row*.69;box('study shelf',x,y,-11.28,1.96,.055,.43,oak);
   for(let i=0;i<8;i++){const xx=x-.77+i*.205,h=.40+(i%3)*.065;box('study shared cloth spine',xx,y+h/2+.03,-11.24,.14,h,.26,covers[(i+row)%3]);box('study page block',xx,y+h/2+.03,-11.26,.11,h-.035,.27,paper);}
  }
 }
 box('study desk top',2.6,6.53,-8.7,3.2,.12,1.25,oak,w.root,true);for(const x of [1.18,4.02])for(const z of [-9.18,-8.22])box('study desk tapered support',x,5.8,z,.095,1.4,.095,edge);
 box('study writing pad',2.5,6.601,-8.65,1.25,.018,.74,sage);box('study open art book',3.7,6.65,-8.62,.52,.07,.42,paper);box('study bound art volume',3.72,6.69,-8.6,.5,.02,.40,covers[1]);
 function chair(name:string,x:number,y:number,z:number,m:PBRMaterial){sphere(name+' tailored seat',x,y+.6,z,[1.3,.25,1.25],m);sphere(name+' curved back',x,y+1.05,z-.48,[1.35,1.05,.25],m);for(const dx of [-.48,.48])for(const dz of [-.4,.4])box(name+' leg',x+dx,y+.26,z+dz,.065,.52,.065,edge);}
 chair('study desk chair',2.6,5.1,-6.9,sage);chair('reading lounge',-1.55,5.1,-6.6,linen);box('reading side table',-2.95,5.93,-7,.65,.08,.65,oak);tube('reading table pedestal',[[-2.95,5.1,-7],[-2.95,5.93,-7]],.07,edge);
 function taskLamp(name:string,x:number,y:number,z:number){tube(name+' stem',[[x,y,z],[x,y+.57,z],[x+.22,y+.7,z]],.024,edge);const hood=MeshBuilder.CreateCylinder(name+' shade',{height:.23,diameterTop:.20,diameterBottom:.44,tessellation:20},scene);hood.position.set(x+.22,y+.61,z);register(hood,linen);glow(sphere(name+' lit underside',x+.22,y+.50,z,[.32,.045,.32],lamp));accents.push({id:name,position:new Vector3(x+.22,y+.47,z),target:new Vector3(x+.22,y-.1,z),meshes:[],power:3.5,range:5,angle:1.5});}
 taskLamp('study reading light',1.35,6.59,-9.1);
 // Gym: a recognisable running deck/console, free-weight bench and rack.
 box('treadmill running frame',15.25,-4.22,-9.05,1.6,.30,3,steel,w.root,true);box('treadmill textured belt',15.25,-4.051,-9.05,1.18,.028,2.65,rubber);
 for(const side of [-1,1]){tube('treadmill handrail',[[15.25+side*.65,-4.15,-9.8],[15.25+side*.65,-2.85,-10.15],[15.25+side*.65,-2.85,-9.2]],.055,steel);}
 const console=box('treadmill tilted control console',15.25,-2.8,-10.18,1.3,.12,.44,rubber);console.rotation.x=-.22;box('treadmill quiet display',15.25,-2.714,-10.16,.53,.018,.20,sage);
 box('training bench upholstered pad',10.3,-3.74,-8.1,1.1,.20,2.65,rubber,w.root,true);for(const z of [-9.0,-7.2]){box('training bench foot',10.3,-4.42,z,1.25,.12,.32,steel);box('training bench support',10.3,-4.12,z,.12,.6,.12,steel);}
 for(const y of [-3.95,-3.28]){box('dumbbell rack shelf',10.7,y,-11.3,3.5,.08,.64,steel);for(let i=0;i<5;i++){const x=9.36+i*.65;const rod=MeshBuilder.CreateCylinder('shared dumbbell grip',{height:.40,diameter:.065,tessellation:10},scene);rod.position.set(x,y+.18,-11.3);rod.rotation.z=Math.PI/2;register(rod,edge);for(const side of [-1,1]){const disc=MeshBuilder.CreateCylinder('shared hexagonal dumbbell',{height:.13,diameter:.28+(i%2)*.06,tessellation:6},scene);disc.position.set(x+side*.22,y+.18,-11.3);disc.rotation.z=Math.PI/2;register(disc,rubber);}}}
 for(const x of [9.0,12.4])box('weight rack support',x,-3.8,-11.35,.09,1.4,.5,steel);
 box('sage training mat',15.8,-4.469,-6.7,1.65,.035,1.9,sage);box('gym rest bench',17,-3.82,-6.05,1.4,.12,.75,oak,w.root,true);for(const x of [16.45,17.55])box('gym bench foot',x,-4.12,-6.05,.1,.64,.5,steel);
 box('gym folded towel',17,-3.70,-6.05,.65,.12,.48,linen);
 for(const x of [10.7,15.4]){box('gym ceiling task bar',x,-.32,-8.2,2.6,.12,.20,edge);glow(box('gym continuous diffuser',x,-.392,-8.2,2.5,.025,.12,lamp));}
 accents.push({id:'gym',position:new Vector3(14,-.48,-8.2),target:new Vector3(13,-4.5,-8.2),meshes:[],power:15,range:9,angle:1.9});
 // Bake the same current exports as the live dogs once, grouped into body/features.
 // The gold body keeps its exact 3.24 scale; only its plinth and location change.
 const bakedGold=bakeStatue(goldModel),bakedWhite=bakeStatue(whiteModel),sculptureMeshes:Mesh[]=[];
 const ivoryStatue=mat('white sculpture warm porcelain','#ded8c9',.58,.08);
 for(const role of ['gold','white'] as const){const a=STATUES[role],baked=role==='gold'?bakedGold:bakedWhite,scale=role==='gold'?STATUES.gold.scale:bakedGold.height*STATUES.gold.scale*.1/bakedWhite.height;
  const root=new TransformNode('courtyard '+role+' bronze statue',scene);root.parent=w.root;root.position.set(a.x,a.baseTop-baked.min[1]*scale,a.z);root.scaling.setAll(scale);root.rotation.y=a.yaw;root.metadata={staticSculpture:true,role,bodyHeight:baked.height*scale,scale,source:'current official idle export'};
  for(const[group,data]of baked.groups){const vd=new VertexData();vd.positions=data.positions;vd.normals=data.normals;vd.indices=data.indices;const m=new Mesh('static '+role+' sculpture '+group,scene);vd.applyToMesh(m);register(m,group==='features'?patina:role==='gold'?bronze:ivoryStatue,root,true);sculptureMeshes.push(m);}
  const lower=role==='gold'?1.2:.6,upper=role==='gold'?1:.12;
  box('statue '+role+' broad grounded plinth',a.x,.26+lower/2,a.z,a.baseWidth,lower,a.baseWidth,stone,w.root,true);
  box('statue '+role+' upper plinth',a.x,.26+lower+upper/2,a.z,a.upperWidth,upper,a.upperWidth,stone,w.root,true);
 }
 for(const x of [-15.8,-7.5]){box('statue shielded uplight housing',x,.39,40.2,.56,.25,.64,edge);glow(box('statue warm lens',x,.535,40.2,.42,.02,.48,lamp));}
 // One of the existing two shared accents illuminates the whole composition.
 accents.push({id:'statue',position:new Vector3(-7.5,1.2,41.7),target:new Vector3(-12.1,3.8,36.5),meshes:sculptureMeshes,power:42,range:18,angle:1.55});
 box('entry welcome console top',-3,1.25,-10.9,1.4,.10,.65,oak,w.root,true);
 for(const x of [-3.6,-2.4])for(const z of [-11.14,-10.66])box('entry welcome console foot',x,.75,z,.06,.90,.06,edge);
 // Merge repeated small static pieces by material; keep art canvases independent.
 for(const material of [oak,edge,linen,sage,rubber,steel,paper,...covers]){const eligible=meshes.filter(m=>m.material===material&&!m.metadata.cameraObstacle&&m.parent===w.root);if(eligible.length<2)continue;for(const m of eligible)w.shadows.removeShadowCaster(m);const merged=Mesh.MergeMeshes(eligible,true,true,undefined,false,false);if(merged){merged.parent=w.root;merged.name='home grouped '+material.name;merged.metadata={villa:true,villaRole:'furniture',homeV13:true,cameraObstacle:false};merged.receiveShadows=true;w.shadows.addShadowCaster(merged);meshes.push(merged);}}
 const spots=[0,1].map(i=>{const l=new SpotLight('home shared accent '+i,Vector3.Zero(),Vector3.Down(),1.6,1.2,scene);l.parent=w.root;l.diffuse=Color3.FromHexString('#fff0d8');l.setEnabled(false);return l;});let enabled=true;const fades=spots.map(transitionLight);const assigned=['',''];
 return{meshes:meshes.filter(m=>!m.isDisposed()),artPlanes,accents,
  setLights(on:boolean){enabled=on;for(const m of glows)m.setEnabled(on);if(!on)spots.forEach(l=>l.setEnabled(false));},
  update(p:{x:number;y:number;z:number},dt:number){if(!enabled)return;const candidates=accents.map(a=>({a,d:Math.hypot(a.target.x-p.x,a.target.y-p.y-1,a.target.z-p.z)})).filter(x=>x.d<12&&Math.abs(x.a.target.y-p.y)<5).sort((a,b)=>a.d-b.d).slice(0,2).map(x=>x.a);
   const chosen=assigned.map(id=>candidates.find(a=>a.id===id));for(let i=0;i<2;i++)if(!chosen[i])chosen[i]=candidates.find(a=>!chosen.includes(a));
   spots.forEach((l,i)=>{const a=chosen[i];assigned[i]=a?.id??'';fades[i](a?.id??'',a?.power??0,dt,()=>{if(a){l.position.copyFrom(a.position);l.direction.copyFrom(a.target.subtract(a.position).normalize());l.range=a.range;l.angle=a.angle;l.includedOnlyMeshes=a.meshes.slice();}});});},
  dispose(){spots.forEach(l=>l.dispose());materials.forEach(m=>m.dispose(false,false));textures.forEach(t=>t.dispose());}
 };
}
