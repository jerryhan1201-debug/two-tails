import {Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, VertexData} from '@babylonjs/core';
import type {World} from './world';
import {journeyEntry,journeyNodes,type JourneyNode} from './journeys';
import {castleLightPath,MIRROR_RECEIVER} from './journeys-later';
import type {JourneyProgress} from '../shared/journeys';
import {RIVER_FOOTWAY,riverFootwayHeight,regionGroundHeight,MUSHROOM_TERRACES,canopySurface} from './regions';

/** Small working mechanisms share stable node positions with the puzzle reducer.
 * They are presentation only; authoritative values and collision remain in simulation. */
export type JourneyVisuals={update(progress:JourneyProgress,time:number):void;dispose():void};
export function buildJourneyVisuals(w:World):JourneyVisuals {
 const ownedMaterials:StandardMaterial[]=[];
 const updates:((p:JourneyProgress,t:number)=>void)[]=[];
 const matte=(name:string,hex:string,alpha=1)=>{const m=new StandardMaterial('journey '+name,w.scene);m.diffuseColor=Color3.FromHexString(hex);m.specularColor.set(.08,.08,.08);m.alpha=alpha;ownedMaterials.push(m);return m;};
 const wood=matte('weathered oak','#a88b5f'),dark=matte('recessed oak','#645238'),brass=matte('brass fittings','#c4aa66'),paper=matte('weathered paper','#e7ddba'),aqua=matte('water mark','#69b8bb'),cream=matte('chalk mark','#fff2ca');
 const attach=(m:Mesh,parent:TransformNode,material=wood)=>{m.parent=parent;m.material=material;m.receiveShadows=true;m.metadata={cameraObstacle:false,journeyVisual:true};w.shadows.addShadowCaster(m);return m;};
 const box=(p:TransformNode,name:string,x:number,y:number,z:number,width:number,height:number,depth:number,mat=wood)=>{const m=MeshBuilder.CreateBox(name,{width,height,depth},w.scene);m.position.set(x,y,z);return attach(m,p,mat);};
 const ring=(p:TransformNode,name:string,x:number,y:number,z:number,diameter:number,thickness:number,mat=brass)=>{const m=MeshBuilder.CreateTorus(name,{diameter,thickness,tessellation:32},w.scene);m.rotation.x=Math.PI/2;m.position.set(x,y,z);return attach(m,p,mat);};
 const cylinder=(p:TransformNode,name:string,x:number,y:number,z:number,height:number,diameter:number,mat=brass)=>{const m=MeshBuilder.CreateCylinder(name,{height,diameter,tessellation:20},w.scene);m.position.set(x,y,z);return attach(m,p,mat);};
 const rootFor=(n:JourneyNode)=>{const root=new TransformNode('journey/'+n.id,w.scene);root.parent=w.root;const terrace=MUSHROOM_TERRACES.find(p=>p.id===n.surfaceId);const platform=canopySurface(n.x,n.z);const y=terrace?terrace.height:n.surfaceId&&platform?.id===n.surfaceId?platform.y:regionGroundHeight(w.regionId,n.x,n.z);root.position.set(n.x,y,n.z);root.metadata={journeyId:n.journeyId,nodeId:n.id,visual:n.visual};return root;};
 for(const n of journeyNodes(w.regionId)){
  const root=rootFor(n),state=(p:JourneyProgress)=>journeyEntry(p,n.journeyId);
  // The four authored letters and the low bell already exist in native source assets.
  if(n.visual==='letter'){
   if(n.id.endsWith('-memory'))continue;
   box(root,'weathered memorial keepsake stone',0,.18,0,.58,.36,.4,dark);const leaf=box(root,'creased memorial letter',0,.37,0,.44,.018,.29,paper);leaf.rotation.y=.18;
   for(let i=0;i<4;i++)box(root,'memorial note ink line',-.02,.383,-.08+i*.05,.28,.005,.007,dark);
   continue;
  }
  if(n.visual==='notice'){
   box(root,'journal reading stand',0,.59,.05,.10,1.18,.10,dark);const board=box(root,'journal angled wood rest',0,1.14,0,.65,.09,.36);board.rotation.x=-.24;const page=box(root,'journal folded parchment',0,1.201,-.015,.53,.008,.28,paper);page.rotation.x=-.24;
   for(let i=0;i<5;i++){const line=box(root,'visible handwritten journal strokes',-.045+i%2*.025,1.21+i*.012,-.12+i*.045,.34-(i%2)*.08,.006,.007,dark);line.rotation.x=-.24;}
  }else if(n.visual==='satchel'){
   // Rounded rectangular loft, with explicit flap and handle rather than a glowing pickup.
   const positions:number[]=[],indices:number[]=[];for(const [y,scale]of [[.03,.83],[.10,1],[.36,.95],[.43,.78]])for(let k=0;k<24;k++){const a=k/24*Math.PI*2;positions.push(Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.35*.35*scale,y,Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.35*.24*scale);}
   for(let j=0;j<3;j++)for(let k=0;k<24;k++){const a=j*24+k,b=j*24+(k+1)%24;indices.push(a,b,a+24,b,b+24,a+24);}const m=new Mesh('waterproof post satchel rounded stitched body',w.scene),d=new VertexData();d.positions=positions;d.indices=indices;d.normals=[];VertexData.ComputeNormals(positions,indices,d.normals);d.applyToMesh(m);attach(m,root,dark);box(root,'satchel fold flap',0,.32,-.24,.61,.20,.025,wood);box(root,'satchel brass clasp',0,.26,-.26,.09,.09,.04,brass);ring(root,'satchel curved carry handle',0,.48,0,.23,.025,dark);
   updates.push(p=>root.setEnabled(state(p).stage<2));
  }else if(n.visual==='chime'){
   if(n.tone!==0){
    box(root,'bell timber suspension crossbar',0,2.63,0,.77,.12,.15);for(let i=0;i<3;i++){const length=(n.tone===1?.54:.34)+i*.10;box(root,'bell linen hanging cord',(i-1)*.25,2.43,0,.012,.37,.012,dark);cylinder(root,'bell hollow brass resonator',(i-1)*.25,2.25-length/2,0,length,.065);}
   }
   // Three distinct notch marks remain readable even without audio.
   for(let i=0;i<(n.tone??0)+1;i++)box(root,'carved bell tone notch',-.22+i*.16,2.57,-.085,.06,.055,.02,cream);
   const answer=ring(root,'bell reply halo',0,2.20,.02,.65,.024,aqua);answer.setEnabled(false);
   updates.push((p,t)=>{const e=state(p),order=[0,2,1],lit=e.stage>=4||order.slice(0,e.values.bellStep??0).includes(n.tone!);answer.setEnabled(lit);answer.scaling.setAll(1+Math.sin(t*2)*.035);});
  }else if(n.visual==='valve'){
   box(root,'valve masonry foot',0,.12,0,1.05,.24,.75,dark);box(root,'valve iron spindle housing',0,.72,.08,.19,1.2,.22,dark);
   const wheel=new TransformNode('rotating '+n.valueKey+' hand wheel',w.scene);wheel.parent=root;wheel.position.set(0,1.15,-.16);ring(wheel,'water control brass wheel',0,0,0,.91,.074);
   for(let i=0;i<4;i++){const spoke=box(wheel,'water wheel radial spoke',0,0,0,.065,.81,.065,brass);spoke.rotation.z=i*Math.PI/4;}box(wheel,'water wheel pointer',0,.52,0,.10,.20,.06,cream);cylinder(wheel,'hand wheel central nut',0,0,0,.12,.16,dark).rotation.x=Math.PI/2;
   for(let i=0;i<4;i++){const a=i*Math.PI/2;const x=Math.sin(a)*.70,y=1.15+Math.cos(a)*.70;box(root,'fixed water wheel setting '+i,x,y,-.12,.09,.09,.04,i===2&&n.valueKey==='intake'?aqua:i===3&&n.valueKey==='outlet'?cream:dark);for(let k=0;k<i;k++)box(root,'wheel count tick',x-.07+k*.07,y-.12,-.12,.027,.045,.02,cream);}
   updates.push(p=>{wheel.rotation.z=-(state(p).values[n.valueKey!]??0)*Math.PI/2;});
  }else if(n.visual==='gauge'){
   box(root,'white egret water gauge timber',0,1.22,0,.4,2.44,.15,dark);box(root,'water gauge pale inset',0,1.22,-.086,.24,2.25,.025,paper);for(let i=0;i<9;i++)box(root,'water gauge measured horizontal tick',-.01,.18+i*.25,-.11,i%2?.10:.19,.025,.018,dark);box(root,'water gauge intake second blue mark',.19,.68,-.10,.11,.11,.04,aqua);box(root,'water gauge outlet third pale mark',.19,.93,-.10,.11,.11,.04,cream);
   const float=box(root,'moving gauge cork float',0,.5,-.18,.32,.13,.13,aqua);updates.push(p=>{const e=state(p);float.position.y=e.stage>=2?.34:.58+(e.values.intake??0)*.12-(e.values.outlet??0)*.055;});
  }else if(n.visual==='lever'){
   box(root,'trial sluice lever stone footing',0,.16,0,1,.32,.7,dark);box(root,'trial sluice hinge bracket',0,.48,0,.32,.5,.22,brass);const lever=new TransformNode('trial sluice lever moving joint',w.scene);lever.parent=root;lever.position.y=.68;box(lever,'jointed sluice lever shaft',0,.35,0,.10,.8,.10,dark);box(lever,'two paw sluice lever handgrip',0,.74,0,.62,.11,.14,wood);updates.push(p=>{lever.rotation.x=state(p).stage>=2?.78:-.40;});
  }else if(n.visual==='candle'){
   cylinder(root,'memorial turned stone candle seat',0,.30,0,.6,.65,dark);cylinder(root,'memorial wax candle',0,.86,0,.52,.19,paper);const flame=MeshBuilder.CreateSphere('memorial candle flame',{diameter:.15,segments:10},w.scene);flame.scaling.y=1.6;flame.position.y=1.22;attach(flame,root,cream);
   const symbols:TransformNode[]=[];for(let k=0;k<3;k++){const symbol=new TransformNode('memorial life symbol '+k,w.scene);symbol.parent=root;symbol.position.set(0,.40,-.34);symbols.push(symbol);if(k===0){const leaf=MeshBuilder.CreateSphere('engraved leaf',{diameter:.20,segments:10},w.scene);leaf.scaling.set(.48,1,.08);attach(leaf,symbol,aqua);}else if(k===1){box(symbol,'engraved sewing needle',0,0,0,.02,.24,.02,cream);ring(symbol,'engraved needle eye',0,.09,-.015,.055,.012,cream);}else{box(symbol,'engraved ferry hull',0,-.045,0,.24,.04,.02,cream);box(symbol,'engraved ferry mast',0,.045,0,.015,.16,.02,cream);const sail=box(symbol,'engraved ferry sail',.047,.047,0,.077,.11,.014,cream);sail.rotation.z=.18;}}
   updates.push((p,t)=>{const e=state(p);symbols.forEach((m,i)=>m.setEnabled(i===(e.values[n.valueKey!]??0)));flame.setEnabled(e.completed);flame.scaling.y=1.6+Math.sin(t*9+n.x)*.15;});
  }else if(n.visual==='mirror'){
   box(root,'optical mirror wide stone base',0,.14,0,.95,.28,.68,dark);cylinder(root,'optical mirror brass upright',0,.91,0,1.48,.085,brass);const swivel=new TransformNode('mirror directional swivel',w.scene);swivel.parent=root;swivel.position.y=1.66;ring(swivel,'optical mirror round brass rim',0,0,0,.93,.065,brass);const pane=MeshBuilder.CreateDisc('polished directional mirror',{radius:.425,tessellation:40,sideOrientation:Mesh.DOUBLESIDE},w.scene);attach(pane,swivel,aqua);const arrow=box(swivel,'mirror forward arrow shaft',0,-.67,.23,.035,.045,.48,cream);const tip=MeshBuilder.CreateCylinder('mirror forward arrow head',{height:.19,diameterTop:0,diameterBottom:.15,tessellation:3},w.scene);tip.rotation.x=Math.PI/2;tip.position.set(0,-.67,.5);attach(tip,swivel,cream);
   updates.push(p=>{swivel.rotation.y=(state(p).values[n.valueKey!]??0)*Math.PI/2;});
  }else if(n.visual==='toolbox'){
   box(root,'rescue repair cart open box',0,.51,0,1.25,.48,.66,dark);for(const x of [-.54,.54]){const wheel=cylinder(root,'repair cart timber wheel',x,.24,0,.11,.42,wood);wheel.rotation.z=Math.PI/2;}
   const felt=cylinder(root,'rolled rescue felt',-.36,.83,0,.43,.21,aqua);felt.rotation.x=Math.PI/2;const rope=ring(root,'coiled repair rope',.04,.84,0,.27,.045,paper);const oil=cylinder(root,'rescue oil flask',.40,.84,0,.27,.16,brass);const choices=[felt,rope,oil];updates.push(p=>{const chosen=(state(p).values.tool??0)-1;choices.forEach((m,i)=>m.position.y=.83+(i===chosen?.16:0));});
  }else if(n.visual==='shelter'){
   for(const x of [-.88,.88])box(root,'snow shelter upright post',x,1.215,.32,.10,2.43,.10,dark);box(root,'snow shelter rear brace',0,2.32,.32,1.92,.15,.14,dark);const cover=box(root,'snow shelter sloping felt canopy',0,2.40,0,2.04,.085,1.25,aqua);cover.rotation.x=.14;
   const patch=box(root,'repaired felt weather patch',-.34,1.78,.37,.66,.72,.04,wood);const binding=ring(root,'new beam rope binding',.69,2.35,.31,.22,.045,paper);const lamp=cylinder(root,'shelter warm oil lamp',-.54,1.86,.05,.25,.18,cream);updates.push(p=>{const repaired=state(p).values[n.valueKey!]===1;patch.setEnabled(n.valueKey==='draft'&&repaired);binding.setEnabled(n.valueKey==='beam'&&repaired);lamp.setEnabled(repaired);});
  }else if(n.visual==='nest'){
   for(let i=0;i<6;i++){const reed=ring(root,'woven rescue nest ring',0,.08+i*.05,0,.50+i*.035,.045,wood);reed.rotation.x=0;}
   for(const x of [-.12,.12]){const bird=MeshBuilder.CreateSphere('sheltered tiny nestling',{diameter:.20,segments:12},w.scene);bird.position.set(x,.27,0);bird.scaling.set(.75,1.2,.8);attach(bird,root,paper);const beak=MeshBuilder.CreateCylinder('nestling beak',{height:.07,diameterTop:0,diameterBottom:.06,tessellation:4},w.scene);beak.rotation.x=-Math.PI/2;beak.position.set(x,.32,-.105);attach(beak,root,brass);}
   updates.push(p=>root.setEnabled(state(p).stage<2));
  }else if(n.visual==='lantern'){
   cylinder(root,'restoration lantern slender post',0,.80,0,1.6,.13,dark);box(root,'restoration lantern frame',0,1.67,0,.51,.58,.42,brass);const pane=box(root,'restoration lantern glass panes',0,1.66,-.025,.43,.45,.38,dark);const flames:Mesh[]=[];for(let i=0;i<3;i++){const flame=MeshBuilder.CreateSphere('allocated household starlight '+i,{diameter:.09,segments:10},w.scene);flame.position.set(-.12+i*.12,1.63,-.23);attach(flame,root,cream);flames.push(flame);}updates.push(p=>{const e=state(p),value=e.values[n.valueKey!]??0;flames.forEach((m,i)=>m.setEnabled(e.completed||i<value));pane.material=value||e.completed?aqua:dark;});
  }else if(n.visual==='chest'){
   box(root,'courier chest inset foot',0,.12,0,.95,.24,.6,dark);box(root,'courier chest timber body',0,.45,0,1.1,.58,.75);for(const x of [-.43,.43])box(root,'courier chest brass corner binding',x,.45,-.388,.055,.60,.025,brass);
   const lid=new TransformNode('courier chest hinged lid',w.scene);lid.parent=root;lid.position.set(0,.76,.375);box(lid,'courier chest fitted lid',0,.03,-.375,1.15,.12,.80);box(root,'courier chest actual letter slot',0,.64,-.39,.49,.06,.025,dark);
   updates.push(p=>{lid.rotation.x=state(p).completed?-1.13:0;});
  }
 }
 if(w.chapter.biome==='river'){
  const f=RIVER_FOOTWAY,root=new TransformNode('river journey optional west-bank footway',w.scene);root.parent=w.root;
  const positions:number[]=[],indices:number[]=[];for(let i=0;i<=26;i++){const z=f.minZ+(f.maxZ-f.minZ)*i/26;for(const x of [f.x-f.width/2,f.x+f.width/2])positions.push(x,riverFootwayHeight(x,z,0)??f.deckY,z);if(i<26){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const d=new VertexData();d.positions=positions;d.indices=indices;d.normals=[];VertexData.ComputeNormals(positions,indices,d.normals);const deck=new Mesh('revealed continuous west-bank stone crossing',w.scene);d.applyToMesh(deck);attach(deck,root,matte('pale river stepping stone','#adb9a3'));deck.metadata.cameraObstacle=false;
  for(let i=0;i<12;i++){const z=f.minZ+.55+i;const y=riverFootwayHeight(f.x,z,0)??f.deckY;box(root,'river stone cross seam',f.x,y+.012,z,f.width,.015,.028,dark);}
  const channel=new TransformNode('trial water return channel',w.scene);channel.parent=w.root;channel.position.set(f.x,0,(f.minZ+f.maxZ)/2);const water=box(channel,'visible trial water surface',0,.66,0,f.width+.16,.035,f.maxZ-f.minZ,matte('flowing water','#79bac4',.62));w.shadows.removeShadowCaster(water);
  const streams:Mesh[]=[];for(let i=0;i<8;i++)streams.push(box(channel,'return flow pale foam line',-1.4+(i%4)*.85,.69,-6+i*1.55,.18,.012,.52,cream));
  updates.push((p,t)=>{const e=journeyEntry(p,'river-levels'),open=e.stage>=2;root.setEnabled(open);water.position.y=open?.16:.63+((e.values.intake??0)-(e.values.outlet??0))*.027;for(let i=0;i<streams.length;i++){streams[i].position.y=water.position.y+.028;streams[i].position.z=-6+((t*(open?1.35:.55)+i*1.55)%12);} });
 }
 if(w.chapter.biome==='castle'){
  const root=new TransformNode('live castle mirror light path',w.scene);root.parent=w.root;let revision=-1;const beamMaterial=matte('visible warm glasshouse beam','#ffe3a0',.76);beamMaterial.emissiveColor=Color3.FromHexString('#a58a4e');
  const receiver=new TransformNode('glasshouse fixed light receiver',w.scene);receiver.parent=w.root;receiver.position.set(MIRROR_RECEIVER.x,w.height(MIRROR_RECEIVER.x,MIRROR_RECEIVER.z),MIRROR_RECEIVER.z);ring(receiver,'glasshouse receiving golden ring',0,1.66,0,1.1,.07,brass);
  updates.push(p=>{if(p.revision===revision)return;revision=p.revision;root.getChildMeshes().forEach(m=>m.dispose());const path=castleLightPath(journeyEntry(p,'castle-window'));for(const [i,segment]of path.segments.entries()){const points=[new Vector3(segment.from.x,w.height(segment.from.x,segment.from.z)+1.66,segment.from.z),new Vector3(segment.to.x,w.height(segment.to.x,segment.to.z)+1.66,segment.to.z)];const ray=MeshBuilder.CreateTube('actual directed window light segment '+i,{path:points,radius:.045,tessellation:8},w.scene);attach(ray,root,beamMaterial);w.shadows.removeShadowCaster(ray);}receiver.getChildMeshes().forEach(m=>m.material=path.reached?cream:brass);});
 }
 return {update(p,t){updates.forEach(fn=>fn(p,t));},dispose(){ownedMaterials.forEach(m=>m.dispose());}};
}
