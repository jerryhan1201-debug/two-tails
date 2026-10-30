import{Mesh,MeshBuilder,TransformNode,Vector3,VertexData,Color3,type Material}from'@babylonjs/core';
import type{World}from'./world';import type{Snapshot}from'./simulation';import{animalReaction}from'./animal-interactions';
import{COUNT_COFFIN as C,CASTLE_STORY_POINTS as A}from'./castle-story-layout';
type Part={root:TransformNode;update(s:Snapshot,dt:number):void};
/** Small host-owned story set. Only current/adjacent rooms retain geometry;
 * RC2 structure, original interaction nodes and their material ownership stay intact. */
export class CastleDetails{
 private parts=new Map<string,Part>();private lastTime=0;
 constructor(private w:World){}
 zones(ids:string[]){for(const[id,p]of this.parts)if(!ids.includes(id)){for(const m of p.root.getChildMeshes())this.w.shadows.removeShadowCaster(m);p.root.dispose();this.parts.delete(id);}for(const id of ids)if(['secret','collection','hall','garden'].includes(id)&&!this.parts.has(id))this.parts.set(id,this.build(id));}
 update(s:Snapshot){const dt=Math.max(0,Math.min(.05,s.time-this.lastTime));this.lastTime=s.time;for(const p of this.parts.values())p.update(s,dt);}
 private build(zone:string):Part{
  const w=this.w,s=w.scene,root=new TransformNode('castle v18 details '+zone,s);root.parent=w.root;const groups=new Map<string,Mesh[]>(),updates:((s:Snapshot,dt:number)=>void)[]=[];
  const wood=w.surfaces.surface('timber','#a78c7d'),dark=w.surfaces.paint('#534451',.83),stone=w.surfaces.surface('limestone','#ada9b3'),brass=w.surfaces.paint('#ba9863',.64),rust=w.surfaces.paint('#816551',.94),paper=w.surfaces.paint('#e6d9b7'),wine=w.surfaces.fabric('#735363'),moss=w.surfaces.paint('#69755b',.96),ink=w.surfaces.paint('#5b5864');
  const add=(m:Mesh,mat:Material,parent:TransformNode=root,solid=false,batch=true)=>{m.parent=parent;m.material=mat;m.isPickable=solid;m.receiveShadows=true;m.metadata={castleStory:true,cameraObstacle:solid,studioZone:zone};if(batch){const k=parent.uniqueId+':'+mat.uniqueId+':'+solid;const g=groups.get(k)??[];g.push(m);groups.set(k,g);}else if(solid)w.shadows.addShadowCaster(m);return m;};
  const box=(name:string,x:number,y:number,z:number,width:number,height:number,depth:number,mat:Material,parent=root,solid=false,batch=true)=>{const m=MeshBuilder.CreateBox(name,{width,height,depth},s);m.position.set(x,y,z);return add(m,mat,parent,solid,batch);};
  const tube=(name:string,pts:number[][],r:number,mat:Material,parent=root,batch=true)=>add(MeshBuilder.CreateTube(name,{path:pts.map(p=>Vector3.FromArray(p)),radius:r,tessellation:8,cap:Mesh.CAP_ALL},s),mat,parent,false,batch);
  const geo=(name:string,ps:number[],ix:number[],mat:Material,parent=root,solid=false,batch=true)=>{const d=new VertexData();d.positions=ps;d.indices=ix.flatMap((v,i)=>i%3===0?[v,ix[i+2],ix[i+1]]:[]);d.normals=[];VertexData.ComputeNormals(ps,d.indices,d.normals);d.uvs=[];for(let i=0;i<ps.length;i+=3)d.uvs.push(ps[i],ps[i+2]);const m=new Mesh(name,s);d.applyToMesh(m);return add(m,mat,parent,solid,batch);};
  const prism=(name:string,poly:number[][],low:number,high:number,mat:Material,parent=root,solid=false,batch=true)=>{const ps=poly.flatMap(p=>[p[0],low,p[1]]).concat(poly.flatMap(p=>[p[0],high,p[1]])),ix:number[]=[],n=poly.length;for(let i=0;i<n;i++){const j=(i+1)%n;ix.push(i,j,i+n,j,j+n,i+n);if(i>0&&i<n-1)ix.push(0,j,i,n,n+i,n+j);}return geo(name,ps,ix,mat,parent,solid,batch);};
  const ring=(name:string,x:number,y:number,z:number,d:number,mat:Material,parent=root,batch=true)=>{const m=MeshBuilder.CreateTorus(name,{diameter:d,thickness:.045,tessellation:24},s);m.position.set(x,y,z);return add(m,mat,parent,false,batch);};
  const ledge=(part:keyof typeof A,object:string)=>{const p=A[part];box(object+' worn stone stand',p.x,p.y+.45,p.z,.7,.9,.56,stone);box(object+' book support',p.x,p.y+.94,p.z,.76,.09,.61,dark);};
  if(zone==='secret'){
   const coffin=new TransformNode('count complete coffin',s);coffin.parent=root;coffin.position.set(C.x,C.y,C.z);
   const outline=[[-.68,-1.95],[.68,-1.95],[1.08,.68],[.79,1.85],[-.79,1.85],[-1.08,.68]],wide=outline.map(([x,z])=>[x*1.17,z*1.08]);
   prism('count worn plinth',wide,0,.16,stone,coffin,true);prism('count chamfered timber foot',outline.map(([x,z])=>[x*1.04,z*1.025]),.20,.36,dark,coffin,true);
   for(const x of [-.55,.55])for(const z of [-1.25,1.15])box('count short feet',x,.23,z,.28,.26,.26,wood,coffin,true);
   // Six individually thick closed walls surround the recessed lining.
   const inner=outline.map(([x,z])=>[x*.87,z*.92]);for(let i=0;i<6;i++){const j=(i+1)%6;prism('count solid coffin wall',[outline[i],outline[j],inner[j],inner[i]],.35,1.16,wood,coffin,true);tube('count brass rim',[...[[...outline[i]],[...outline[j]]].map(([x,z])=>[x,1.18,z])],.035,brass,coffin);}
   prism('count velvet interior',inner,.36,.49,wine,coffin);box('count folded old letter',0,.52,.35,.67,.022,.85,paper,coffin);for(let i=0;i<4;i++)box('count letter lines',0,.534,.16+i*.1,.36,.008,.018,ink,coffin);
   const lid=new TransformNode('count hinged fitted lid',s);lid.parent=coffin;lid.position.set(-1.08,1.19,0);const lp=outline.map(([x,z])=>[x+1.08,z]);prism('count bevelled lid edge',lp,-.02,.10,dark,lid,true);prism('count raised lid inset',lp.map(([x,z])=>[1.08+(x-1.08)*.91,z*.94]),.10,.19,wood,lid,true);
   for(const a of [-1.42,1.21])box('count age worn lid strap',1.08,.205,a,1.18,.028,.14,brass,lid);ring('count family crest',1.08,.21,.30,.63,brass,lid);box('count crest lower stroke',1.08,.235,.30,.04,.03,.44,brass,lid);box('count crest cross stroke',1.08,.235,.25,.28,.03,.035,brass,lid);
   for(const side of [-1,1])for(const z of [-.85,.7]){const handle=ring('count carrying handle',side*1.0,.80,z,.26,brass,coffin);handle.rotation.z=Math.PI/2;for(const dz of [-.12,.12])box('count handle lug',side*1.005,.83,z+dz,.075,.1,.1,rust,coffin);}
   const seal=new TransformNode('count movable moon seal',s);seal.parent=coffin;seal.position.set(1.1,.94,-.65);const sealRing=ring('count moon seal ring',0,0,0,.36,brass,seal);sealRing.rotation.z=Math.PI/2;box('count moon seal index',.017,.07,0,.04,.13,.055,brass,seal);
   ledge('coffin','count plaque');box('count small engraved plaque',A.coffin.x,A.coffin.y+1.02,A.coffin.z,.65,.03,.44,brass);for(let i=0;i<3;i++)box('count inscription',A.coffin.x,A.coffin.y+1.038,A.coffin.z-.10+i*.10,.37,.008,.02,ink);
   const glow=w.surfaces.paint('#cbb286',.72);glow.emissiveColor=Color3.FromHexString('#bc8956').toLinearSpace().scale(.32);const crest=ring('count returned family crest',-45.42,-1.0,70.8,1.05,glow,root,false);crest.rotation.z=Math.PI/2;crest.setEnabled(false);
   ledge('clocknote','clock keeper notebook');box('clock open maintenance book',A.clocknote.x,-2.58,A.clocknote.z,.69,.035,.44,paper);
   box('clock transmission timber case',A.bell.x,-3.0,A.bell.z,.63,1.2,.38,wood);const dial=new TransformNode('clock lower transmission wheel',s);dial.parent=root;dial.position.set(A.bell.x,-2.05,A.bell.z-.26);const dr=ring('clock transmission wheel',0,0,0,.55,brass,dial);dr.rotation.x=Math.PI/2;tube('clock wheel cross',[[-.24,0,0],[.24,0,0]],.028,brass,dial);tube('clock pulley rope',[[A.bell.x+.23,-2.3,A.bell.z],[A.bell.x+.23,1.8,A.bell.z],[A.bell.x+.42,1.8,A.bell.z]],.018,dark);
   const weight=box('clock moving weight',A.bell.x+.23,-1.95,A.bell.z,.17,.37,.17,brass,root,false,false);
   const bats:TransformNode[]=[];for(let i=0;i<3;i++){const bat=new TransformNode('castle small window bat '+i,s);bat.parent=root;bat.position.set(-45.1,1.25+i*.27,73.3+i*.45);const body=MeshBuilder.CreateSphere('bat body',{diameter:.15,segments:8},s);body.scaling.y=1.5;add(body,dark,bat);for(const side of [-1,1])geo('bat scalloped wing',[0,0,0,side*.22,.12,0,side*.39,.01,.015,side*.27,-.035,.018,side*.18,-.12,.012,side*.08,-.07,0],[0,1,2,0,2,3,0,3,4,0,4,5],dark,bat);bats.push(bat);}
   let first=true;updates.push((s,dt)=>{const e=s.journeys.entries['count-sleep'],be=s.journeys.entries['last-bell'],open=(e?.stage??0)>=3,target=open?.28:0;lid.rotation.z=first?target:lid.rotation.z+(target-lid.rotation.z)*(1-Math.exp(-dt*5));seal.rotation.x=(e?.values.seal??0)*Math.PI/2;crest.setEnabled(!!e?.completed);dial.rotation.z=-(be?.values.wheel??0)*Math.PI/2;weight.position.y=be?.completed?-2.5:-1.95;bats.forEach((b,i)=>{const phase=s.time*.7+i*2;b.position.y=1.25+i*.27+(be?.completed?Math.sin(phase)*.11:0);const response=animalReaction(s,'castle-window-bats');b.rotation.y=response?response.yaw:0;b.position.y+=response?Math.sin((s.time-response.start)*5+i)*.07:0;b.rotation.z=response?Math.sin((s.time-response.start)*8+i)*(response.kind==='play'?.16:.08):be?.completed?Math.sin(phase*4)*.10:0;});first=false;});
   // Hanging fabric with a deliberately uneven, closed silhouette beside the window.
   const ps:number[]=[],ix:number[]=[];for(let i=0;i<=10;i++){const z=71.4+i*.09,x=-45.45+Math.sin(i*.85)*.035;ps.push(x,1.8,z,x,-.7+[.0,.15,-.04,.25,.09,-.23,.1,.21,-.08,.12,0][i],z);if(i<10){const n=i*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}}geo('count worn gathered drape',ps,ix,wine);tube('count iron drape rail',[[-45.45,1.9,71.3],[-45.45,1.9,72.5]],.032,rust);
  }else if(zone==='collection'){
   for(const key of ['key','locket'] as const){const p=A[key];ledge(key,'count '+key);const obj=new TransformNode('count keepsake '+key,s);obj.parent=root;obj.position.set(p.x,p.y+1.02,p.z);if(key==='locket'){ring('count silver watch rim',0,.02,0,.25,brass,obj);box('count watch face',0,.01,0,.19,.035,.19,paper,obj);tube('count watch chain',[[0,.03,.14],[.22,.03,.22],[.27,.03,.12]],.012,brass,obj);}else{ring('count key bow',0,0,-.13,.18,brass,obj);box('count key shaft',0,0,.09,.035,.04,.3,brass,obj);box('count key teeth',.05,0,.2,.12,.04,.08,brass,obj);}updates.push(s=>obj.setEnabled(!s.journeys.entries['count-sleep']?.known.includes('castle-story-'+key)));}
  }else if(zone==='hall'){
   ledge('letter','count family letter');const p=A.letter;box('count undelivered family letter',p.x,p.y+1.01,p.z,.58,.027,.40,paper);box('count letter wax',p.x+.1,p.y+1.035,p.z,.1,.03,.1,wine);
  }else if(zone==='garden'){
   // Bound to the front piers; chipped masonry, repaired seams and fallen slate
   // stay clear of the entry stairs and never cut the load-bearing room shell.
   for(const[x,base]of[[-13.8,2.4],[13.8,2.4],[-4.2,2.4],[4.2,2.4]]){
    for(let row=0;row<4;row++){const y=base+.25+row*.53,span=row%2?.64:.83,z=31.46-row*.014;prism('castle chipped pier facing',[[x-span,z],[x+span,z],[x+span-.15,z+.12],[x-.30,z+.15],[x-span,z+.08]],y,y+.20,stone);}
    tube('castle masonry stepped crack',[[x-.45,base+3.9,31.48],[x-.18,base+3.56,31.47],[x-.28,base+3.30,31.47],[x+.12,base+2.9,31.47]],.018,dark);
    for(let k=0;k<5;k++){const m=MeshBuilder.CreateIcoSphere('castle damp moss at foundation',{radius:.23,subdivisions:1,flat:false},s);m.position.set(x-.7+k*.29,base-.05,31.42);m.scaling.set(1,.25,.6);add(m,moss);}
   }
   for(const side of [-1,1])for(let k=0;k<9;k++){const x=side*(6.2+k*.79),z=31.42+(k%2)*.08;if(k===3||k===7)continue;const poly=[[x-.36,z-.32],[x+.35,z-.30],[x+.33,z+.22],[x+.05,z+.34],[x-.12,z+.21],[x-.37,z+.24]],tile=prism('castle weathered eave slate',poly,0,.055,k%2?dark:ink),ps=tile.getVerticesData('position')!;
    // RC2 hip planes: eave Y15.25, ridge Y19.8 at Z39. Fit each
    // corner to its actual slope, rather than floating level tiles above it.
    for(let i=0;i<ps.length;i+=3)ps[i+1]+=15.268+Math.min((ps[i+2]-31)*4.55/8,(16.8-Math.abs(ps[i]))*4.55/16.8);const ns:number[]=[];VertexData.ComputeNormals(ps,tile.getIndices()!,ns);tile.setVerticesData('position',ps);tile.setVerticesData('normal',ns);tile.refreshBoundingInfo();}
   for(const side of [-1,1])for(let k=0;k<4;k++){const x=side*(12.7+k*.45),z=29.2+(k%2)*.4;prism('castle fallen roof slate',[[x-.22,z-.15],[x+.31,z-.11],[x+.20,z+.18],[x-.15,z+.21]],.025,.09,dark);}
   for(const x of [-14.5,14.5])tube('castle climbing old vine',[[x,.1,31.39],[x-.15,1.2,31.40],[x+.23,2.4,31.43],[x-.12,3.2,31.43]],.024,rust);
  }
  for(const list of groups.values()){const mat=list[0].material,solid=list[0].metadata.cameraObstacle,parent=list[0].parent as TransformNode;parent.computeWorldMatrix(true);const inverse=parent.getWorldMatrix().clone().invert();const m=Mesh.MergeMeshes(list,true,true,undefined,false,false);if(m){m.name='castle v18 shared '+zone+' '+mat?.name;m.bakeTransformIntoVertices(inverse);m.parent=parent;m.material=mat;m.isPickable=solid;m.receiveShadows=true;m.metadata={castleStory:true,cameraObstacle:solid,studioZone:zone};if(solid)w.shadows.addShadowCaster(m);}}
  return{root,update(s,dt){for(const fn of updates)fn(s,dt);}};
 }
 dispose(){for(const p of this.parts.values()){for(const m of p.root.getChildMeshes())this.w.shadows.removeShadowCaster(m);p.root.dispose();}this.parts.clear();}
}
