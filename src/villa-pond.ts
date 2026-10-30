import {Color3,Mesh,MeshBuilder,Vector3,VertexData,TransformNode,type Material,type PBRMaterial,type Texture} from '@babylonjs/core';
import type {World} from './world';import type {JourneyProgress} from '../shared/journeys';
import {HOME_POND as P,POND_EDGE,POND_WATER_EDGE,POND_BANK_TRIANGLES,POND_BRIDGE_TRIANGLES,POND_DECK,POND_LIGHTS,POND_STORY_POINTS as A,pondBridgeHeight,type PondTriangle} from './villa-pond-layout';
/** A finite garden water feature. Shared materials and merged static batches;
 * only the letter case, wheel and final blooms carry story presentation state. */
export function buildVillaPond(w:World){
 const s=w.scene,root=w.root,groups=new Map<string,Mesh[]>(),owned:Mesh[]=[],dynamic:TransformNode[]=[],glows:Mesh[]=[];
 const paint=(c:string,r=.82)=>w.surfaces.paint(c,r),wood=w.surfaces.surface('timber','#d2bb98'),edge=w.surfaces.surface('timber','#aa8c67'),soil=w.surfaces.surface('earth','#817b60'),bed=w.surfaces.surface('earth','#455f4e'),stone=w.surfaces.surface('limestone','#d9dbcc'),brass=paint('#ac9564',.65),paper=paint('#e9ddbb'),ink=paint('#736653'),leaves=[paint('#557b48',.72),paint('#77945b',.70)],petals=[paint('#e8c4cc',.66),paint('#faf0da',.72)],stem=paint('#65805b'),iris=paint('#a299c1');
 wood.roughness=.87;edge.roughness=.91;wood.metallic=edge.metallic=0;
 const grain=w.surfaces.texture('timber-normal').clone();grain.name='pond natural oak fine grain';grain.level=.13;grain.uScale=2;grain.vScale=6;wood.bumpTexture=grain;edge.bumpTexture=grain;
 const add=(m:Mesh,mat:Material,obstacle=false,cast=false,batch=true)=>{m.parent=root;m.material=mat;m.isPickable=obstacle;m.receiveShadows=true;m.metadata={cameraObstacle:obstacle,homePond:true,noAccentShadow:!cast};if(batch){const key=mat.uniqueId+':'+obstacle+':'+cast;const list=groups.get(key)??[];list.push(m);groups.set(key,list);}else{owned.push(m);if(cast)w.shadows.addShadowCaster(m);}return m;};
 const box=(name:string,x:number,y:number,z:number,width:number,height:number,depth:number,mat:Material,obstacle=false,cast=false,batch=true)=>{const m=MeshBuilder.CreateBox(name,{width,height,depth},s);m.position.set(x,y,z);return add(m,mat,obstacle,cast,batch);};
 const tube=(name:string,path:Vector3[],radius:number,mat:Material,obstacle=false,cast=false)=>add(MeshBuilder.CreateTube(name,{path,radius,tessellation:7,cap:Mesh.CAP_ALL},s),mat,obstacle,cast);
 // Layout triangles use mathematical upward normals. Babylon's LH mesh winding
 // is reversed at this rendering boundary; physics keeps the original normals.
 const geo=(name:string,positions:number[],indices:number[],mat:Material,obstacle=false,cast=false,batch=true,colors?:number[])=>{const d=new VertexData();d.positions=positions;d.indices=indices.flatMap((_,i)=>i%3===0?[indices[i],indices[i+2],indices[i+1]]:[]);d.normals=[];VertexData.ComputeNormals(positions,d.indices,d.normals);d.uvs=[];for(let i=0;i<positions.length;i+=3)d.uvs.push(positions[i]/2.8,positions[i+2]/2.8);if(colors)d.colors=colors;const m=new Mesh(name,s);d.applyToMesh(m);return add(m,mat,obstacle,cast,batch);};
 const triangles=(name:string,ts:PondTriangle[],mat:Material,obstacle=false)=>geo(name,ts.flatMap(t=>t.vertices.flat()),ts.flatMap((_,i)=>[i*3,i*3+1,i*3+2]),mat,obstacle,obstacle);
 triangles('pond continuous sloping bank',POND_BANK_TRIANGLES,soil);
 const bedPos:number[]=[P.x,P.bottomY,P.z],bedIdx:number[]=[];POND_WATER_EDGE.forEach((v,i)=>{bedPos.push(v[0],P.bottomY+.23,v[2]);bedIdx.push(0,(i+1)%48+1,i+1);});geo('pond visible stone and silt basin',bedPos,bedIdx,bed);
 const bowl:number[]=[],bi:number[]=[];POND_WATER_EDGE.forEach((v,i)=>{bowl.push(...v,v[0],P.bottomY+.23,v[2]);const j=(i+1)%48;bi.push(i*2,i*2+1,j*2,j*2,i*2+1,j*2+1);});geo('pond submerged complete sides',bowl,bi,bed);
 const water=w.surfaces.surface('water','#668d84');water.albedoColor=Color3.FromHexString('#7b9c8b').toLinearSpace();water.alpha=.67;water.clearCoat.intensity=.35;water.environmentIntensity=.62;water.roughness=.24;
 const wp=[P.x,P.waterY,P.z],wi:number[]=[];POND_WATER_EDGE.forEach((v,i)=>{wp.push(...v);wi.push(0,(i+1)%48+1,i+1);});const waterMesh=geo('pond single water surface',wp,wi,water,false,false,false);waterMesh.receiveShadows=false;waterMesh.metadata={...waterMesh.metadata,waterY:P.waterY,notWalkable:true};
 triangles('pond arched continuous deck',POND_BRIDGE_TRIANGLES,wood,true);
 // Exact arched slab undersides and fascia; no open back or floating planks.
 for(let i=0;i<32;i++){const a=POND_DECK[i],b=POND_DECK[i+1];for(const side of [-1,1]){const z=P.z+side*P.bridgeWidth/2;geo('pond bridge edge fascia',[a.x,a.y,z,b.x,b.y,z,a.x,a.y-.16,z,b.x,b.y-.16,z],side<0?[0,1,2,1,3,2]:[0,2,1,1,2,3],edge,true,true);}
  geo('pond bridge closed underside',[a.x,a.y-.16,P.z-P.bridgeWidth/2,b.x,b.y-.16,P.z-P.bridgeWidth/2,a.x,a.y-.16,P.z+P.bridgeWidth/2,b.x,b.y-.16,P.z+P.bridgeWidth/2],[0,1,2,2,1,3],edge,true,false);
  if(i%2===0){const seam=box('bridge narrow board joint',(a.x+b.x)/2,(a.y+b.y)/2+.003,P.z,.012,.009,P.bridgeWidth-.02,edge);seam.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);}
 }
 for(const side of [-1,1]){
  for(const h of [.46,1.15])tube('bridge continuous curved timber handrail',POND_DECK.map(p=>new Vector3(p.x,p.y+h,P.z+side*(P.bridgeWidth/2+.06))),h>1?.045:.03,edge,true,true);
  for(let i=0;i<=32;i+=4){const p=POND_DECK[i];box('bridge squared baluster',p.x,p.y+.60,P.z+side*(P.bridgeWidth/2+.06),.085,1.24,.085,wood,true,true);const cap=MeshBuilder.CreateSphere('bridge rounded post finial',{diameter:.12,segments:8},s);cap.position.set(p.x,p.y+1.23,P.z+side*(P.bridgeWidth/2+.06));add(cap,edge,true,true);}
  for(const dx of [-4.5,4.5])box('bridge timber pier',P.x+dx,(pondBridgeHeight(P.x+dx)+P.bottomY)/2,P.z+side*1.3,.20,pondBridgeHeight(P.x+dx)-P.bottomY,.20,edge,true,true);
 }
 let seed=181727;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // Stone clusters sit in the bank, with clear gaps instead of a uniform bead ring.
 for(let i=0;i<24;i++){const a=(i<10?2.1:i<18?4.1:.7)+(rand()-.5)*1.2,rx=P.rx-.2+rand()*.3,rz=P.rz-.25+rand()*.3;const m=MeshBuilder.CreateIcoSphere('pond worn bank stone',{radius:.38,subdivisions:1,flat:false},s);m.position.set(P.x+Math.cos(a)*rx,.09,P.z+Math.sin(a)*rz);m.scaling.set(.75+rand(),.42+rand()*.28,.7+rand()*.6);m.rotation.y=rand()*6.28;add(m,stone);}
 const flowerMeshes:Mesh[]=[];
 function lily(x:number,z:number,r:number,t:number,flower:boolean){
  const p=[x,P.waterY+.018,z],idx:number[]=[];for(let i=0;i<=28;i++){const a=.10+i/28*(Math.PI*2-.20)+t;p.push(x+Math.sin(a)*r,P.waterY+.024+Math.sin(i/28*Math.PI)*.018,z+Math.cos(a)*r*.9);if(i<28)idx.push(0,i+1,i+2);}geo('cupped water lily pad',p,idx,leaves[Math.floor(rand()*2)]);
  if(!flower)return;for(let layer=0;layer<2;layer++)for(let k=0;k<7;k++){
   const angle=k/7*Math.PI*2+t+layer*.38,length=.25-layer*.055;const pp:number[]=[],ii:number[]=[];for(let j=0;j<=5;j++){const u=j/5,h=.06+Math.sin(u*Math.PI*.77)*(.10+layer*.06),wide=Math.sin(u*Math.PI)*.070;for(const side of [-1,1]){const lateral=side*wide;pp.push(x+Math.sin(angle)*u*length+Math.cos(angle)*lateral,P.waterY+h,z+Math.cos(angle)*u*length-Math.sin(angle)*lateral);}if(j<5){const n=j*2;ii.push(n,n+1,n+2,n+2,n+1,n+3);}}
   const m=geo('water lily sculpted petals',pp,ii,petals[layer],false,false,false);m.material!.backFaceCulling=false;(m.material as PBRMaterial).twoSidedLighting=true;flowerMeshes.push(m);
  }
  const heart=MeshBuilder.CreateSphere('water lily pollen heart',{diameter:.10,segments:8},s);heart.scaling.y=.4;heart.position.set(x,P.waterY+.10,z);add(heart,brass,false,false,false);flowerMeshes.push(heart);
 }
 const clumps=[[-31.5,-31.5],[-25.3,-22.5],[-29.8,-20.0],[-27,-33.2],[-31.8,-23.7],[-24.8,-31.7]];
 for(const[cx,cz]of clumps)for(let i=0;i<10;i++){const a=rand()*6.28,d=Math.sqrt(rand())*1.2,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(((x-P.x)/(P.rx-1.15))**2+((z-P.z)/(P.rz-1.15))**2<1&&Math.abs(z-P.z)>1.95)lily(x,z,.22+rand()*.22,rand()*6.28,i%4===0);}
 // Three modest iris/reed beds with curved solid leaves, not alpha-card curtains.
 for(const[cx,cz]of[[-34.1,-18.5],[-34.8,-30.0],[-24.3,-34.5]])for(let i=0;i<12;i++){
  const x=cx+(rand()-.5)*.85,z=cz+(rand()-.5)*.6,h=.45+rand()*.45,a=rand()*6.28,pp:number[]=[],ii:number[]=[];for(let j=0;j<=5;j++){const t=j/5,wide=Math.sin(t*Math.PI)*.055,bend=t*t*.27;for(const side of [-1,1])pp.push(x+Math.sin(a)*bend+Math.cos(a)*wide*side,.24+h*t,z+Math.cos(a)*bend-Math.sin(a)*wide*side);if(j<5){const n=j*2;ii.push(n,n+1,n+2,n+2,n+1,n+3);}}const m=geo('arched iris foliage',pp,ii,stem);m.material!.backFaceCulling=false;(m.material as PBRMaterial).twoSidedLighting=true;
  if(i%4===0){const y=.24+h*.9;tube('iris slender stem',[new Vector3(x,.2,z),new Vector3(x,y,z)],.012,stem);for(let k=0;k<3;k++){const bloom=MeshBuilder.CreateSphere('iris folded petals',{diameter:.17,segments:8},s);bloom.scaling.set(.43,.85,1.3);bloom.position.set(x+Math.sin(k*2.1)*.055,y,z+Math.cos(k*2.1)*.055);bloom.rotation.y=k*2.1;add(bloom,iris);}}
 }
 const lampMat=paint('#f4d3a0');lampMat.emissiveColor=Color3.FromHexString('#ffd99a').toLinearSpace().scale(.8);
 for(const l of POND_LIGHTS){const[x,y,z]=l.position;box('pond small lantern stone foot',x,.40,z,.48,.28,.48,stone);box('pond lantern bronze frame',x,.91,z,.28,.83,.28,edge);const glow=box('pond lantern warm inset',x,y,z,.18,.20,.18,lampMat,false,false,false);glows.push(glow);box('pond lantern cap',x,y+.15,z,.35,.09,.35,edge);}
 // Authored story objects stay separate from static batches only when stateful.
 const album=A.album;box('pond sketchbook stone reading ledge',album.x,.72,album.z,.8,.92,.5,stone,true,true);const book=box('pond open water garden sketchbook',album.x,1.20,album.z,.74,.045,.45,paper);book.rotation.x=-.13;for(let i=0;i<4;i++)box('pond sketchbook handwritten line',album.x-.1,1.234,album.z-.12+i*.07,.25,.008,.009,ink);
 const wheel=new TransformNode('pond iris-mark current dial',s);wheel.parent=root;wheel.position.set(A.wheel.x,1.20,A.wheel.z);dynamic.push(wheel);box('pond old watercourse dial post',A.wheel.x,.72,A.wheel.z,.19,.92,.19,edge,true,true);const ring=MeshBuilder.CreateTorus('pond four-position flow wheel',{diameter:.65,thickness:.07,tessellation:24},s);add(ring,brass,false,false,false);ring.parent=wheel;ring.rotation.x=Math.PI/2;const pointer=box('pond visible current pointer',0,.13,0,.045,.38,.055,edge,false,false,false);pointer.parent=wheel;
 const letterCase=new TransformNode('pond floating letter case',s);letterCase.parent=root;dynamic.push(letterCase);const cbody=box('pond watertight letter box',0,0,0,.65,.26,.45,edge,false,false,false);cbody.parent=letterCase;const lid=box('pond letter box fitted lid',0,.15,0,.68,.07,.48,wood,false,false,false);lid.parent=letterCase;const clasp=box('pond letter box brass clasp',0,.055,-.24,.07,.12,.025,brass,false,false,false);clasp.parent=letterCase;
 box('pond bridge-side letter rest',A.reply.x,.53,A.reply.z,1.2,.54,.65,stone,true,true);const returned=box('pond returned letter on the bridge table',A.reply.x,.82,A.reply.z,.49,.018,.33,paper,false,false,false);returned.setEnabled(false);
 const blooms:Mesh[]=[];for(const mat of petals.concat([brass])){const list=flowerMeshes.filter(m=>m.material===mat);if(list.length){const m=Mesh.MergeMeshes(list,true,true,undefined,false,false)!;m.name='pond shared final blossoms';m.parent=root;m.material=mat;m.isPickable=false;m.metadata={cameraObstacle:false,homePond:true,noAccentShadow:true};blooms.push(m);owned.push(m);}}
 for(const list of groups.values()){const first=list[0],material=first.material!,meta={...first.metadata},cast=w.shadows.getShadowMap()?.renderList?.includes(first)??false;const m=Mesh.MergeMeshes(list,true,true,undefined,false,false)!;m.name='pond shared '+material.name;m.parent=root;m.material=material;m.receiveShadows=true;m.metadata=meta;m.isPickable=meta.cameraObstacle;owned.push(m);if(meta.cameraObstacle||cast)w.shadows.addShadowCaster(m);}
 let lastStage=-1,ready=false,lastTime=0;return{meshes:owned.filter(m=>!m.isDisposed()),lights:POND_LIGHTS,setLights(on:boolean){glows.forEach(m=>m.setEnabled(on));},
  update(progress:JourneyProgress,time:number){const e=progress.entries['pond-reply'],stage=e?.stage??0,target=stage>=2?A.case:{x:P.x,y:P.waterY,z:P.z+1.95};if(!ready){ready=true;dynamic.forEach(n=>{n.unfreezeWorldMatrix();n.getChildMeshes().forEach(m=>m.unfreezeWorldMatrix());});letterCase.position.set(target.x,P.waterY+.09,target.z);}const dt=Math.min(.1,Math.max(0,time-lastTime));lastTime=time;wheel.rotation.z=-(e?.values.flow??0)*Math.PI/2;const ease=1-Math.exp(-dt*2);letterCase.position.x+=(target.x-letterCase.position.x)*ease;letterCase.position.z+=(target.z-letterCase.position.z)*ease;letterCase.position.y=P.waterY+.09+Math.sin(time*1.2)*.009;letterCase.rotation.z=Math.sin(time*.8)*.025;letterCase.setEnabled(stage<3);if(stage!==lastStage){lastStage=stage;returned.setEnabled(stage>=4);blooms.forEach((m,i)=>m.setEnabled(stage>=4||i===1));}const bump=water.bumpTexture as Texture|null;if(bump)bump.uOffset=Math.sin(time*.025)*.025;},
  dispose(){grain.dispose();/* Root and shared EnvironmentMaterials own the other resources. */}
 };
}
