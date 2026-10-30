import{Color3,Mesh,MeshBuilder,TransformNode,Vector3,VertexData,type Material}from'@babylonjs/core';import type{World}from'./world';import type{Snapshot}from'./simulation';import{COAST_WINTER_NODES}from'./journeys-coast-winter';
type Part={root:TransformNode;update(s:Snapshot):void};
export class CoastWinterDetails{
 private parts=new Map<string,Part>();constructor(private w:World){}
 zones(ids:string[]){for(const[id,p]of this.parts)if(!ids.includes(id)){p.root.dispose();this.parts.delete(id);}for(const id of ids)if(!this.parts.has(id)&&COAST_WINTER_NODES.some(n=>n.regionId===this.w.regionId&&n.zone===id))this.parts.set(id,this.build(id));}
 update(s:Snapshot){for(const p of this.parts.values())p.update(s);}
 private build(zone:string):Part{
  const w=this.w,s=w.scene,root=new TransformNode('regional story details '+zone,s);root.parent=w.root;const groups=new Map<string,Mesh[]>(),updates:((s:Snapshot)=>void)[]=[];
  const wood=w.surfaces.surface('timber','#a79e90'),stone=w.surfaces.surface('limestone','#c4c1b4'),paper=w.surfaces.paint('#e7dcc5'),ink=w.surfaces.paint('#61646a'),red=w.surfaces.fabric('#a56868'),blue=w.surfaces.fabric('#6d94a4'),brass=w.surfaces.paint('#b89c68',.66),pearl=w.surfaces.paint('#e7cec0',.74),lampOff=w.surfaces.paint('#776d60'),lampOn=w.surfaces.paint('#f7d28e',.6);lampOn.emissiveColor=Color3.FromHexString('#eec38c').toLinearSpace().scale(.65);
  const add=(m:Mesh,mat:Material,parent:TransformNode=root,batch=true)=>{m.parent=parent;m.material=mat;m.isPickable=false;m.receiveShadows=true;m.metadata={regionalStory:true,cameraObstacle:false,studioZone:zone};if(batch){const key=parent.uniqueId+':'+mat.uniqueId,items=groups.get(key)??[];items.push(m);groups.set(key,items);}return m;};
  const box=(name:string,x:number,y:number,z:number,width:number,height:number,depth:number,mat:Material,parent=root,batch=true)=>{const m=MeshBuilder.CreateBox(name,{width,height,depth},s);m.position.set(x,y,z);return add(m,mat,parent,batch);};
  const ball=(name:string,x:number,y:number,z:number,scale:number[],mat:Material,parent=root,batch=true)=>{const m=MeshBuilder.CreateSphere(name,{diameter:1,segments:12},s);m.position.set(x,y,z);m.scaling.copyFromFloats(...scale as[number,number,number]);return add(m,mat,parent,batch);};
  const tube=(name:string,path:number[][],radius:number,mat:Material,parent=root)=>add(MeshBuilder.CreateTube(name,{path:path.map(p=>Vector3.FromArray(p)),radius,tessellation:8,cap:Mesh.CAP_ALL},s),mat,parent);
  for(const n of COAST_WINTER_NODES.filter(n=>n.regionId===w.regionId&&n.zone===zone)){
   const p=new TransformNode(n.id+' visible prop',s);p.parent=root;const x=n.propX??n.x,z=n.propZ??(n.z+.85),base=w.surfaceAt(x,z,n.y!+.8,0)?.y??n.y!;p.position.set(x,base,z);
   const entry=(s:Snapshot)=>s.journeys.entries[n.journeyId];
   if(['book','page','scarf','mitten'].includes(n.prop)){
    box(n.id+' low timber stand',0,.31,0,.64,.62,.5,wood,p);box(n.id+' worn stone top',0,.65,0,.75,.08,.57,stone,p);
    if(n.prop==='mitten'){const gloves=new TransformNode(n.id+' carried mittens',s);gloves.parent=p;for(const side of[-1,1]){ball('red winter mitten',side*.13,.76,0,[.21,.08,.32],red,gloves);ball('mitten thumb',side*.23,.755,-.02,[.11,.075,.14],red,gloves);}updates.push(s=>gloves.setEnabled(!entry(s)?.known.includes(n.id)));}
    else{const writing=new TransformNode(n.id+' writing',s);writing.parent=p;box(n.id+' paper note',0,.708,0,.51,.025,.37,paper,writing);for(let i=0;i<3;i++)box('ink note line',-.015,.724,-.10+i*.075,.30,.005,.012,ink,writing);if(n.prop==='scarf'){box('folded snowman scarf',0,.76,.10,.50,.055,.15,red,p);for(let i=0;i<5;i++)box('short scarf tassel',-.2+i*.085,.73,.23,.035,.035,.15,red,p);}
     if(n.id==='winter-house-letter'){const returned=new TransformNode('winter returned warm mittens',s);returned.parent=p;for(const side of[-1,1])ball('returned winter mitten',side*.15,.75,.22,[.20,.08,.25],red,returned);updates.push(s=>returned.setEnabled(!!entry(s)?.completed));}
     if(n.id==='cove-log-page')updates.push(s=>writing.setEnabled(!entry(s)?.known.includes(n.id)));}
   }else if(n.prop==='signal'){
    box('old pier signal clamp',0,.44,0,.18,.88,.18,wood,p);const flag=new TransformNode('restored cove signal flag',s);flag.parent=p;flag.position.y=1.02;
    tube('signal flag staff',[[0,-.3,0],[0,.8,0]],.035,brass,flag);const d=new VertexData();d.positions=[0,.71,0,.78,.64,.045,.66,.35,0,0,.31,0];d.indices=[0,1,2,0,2,3];d.normals=[];VertexData.ComputeNormals(d.positions,d.indices,d.normals);d.uvs=[0,0,1,0,1,1,0,1];const f=new Mesh('cove mended cloth signal',s);d.applyToMesh(f);add(f,blue,flag);
    const wheel=MeshBuilder.CreateTorus('cove signal adjustment ring',{diameter:.37,thickness:.035,tessellation:20},s);wheel.position.y=.62;wheel.rotation.x=Math.PI/2;add(wheel,brass,p);updates.push(s=>{const e=entry(s);flag.rotation.y=(e?.values.signal??0)*Math.PI/2;flag.scaling.x=(e?.stage??0)>=3?1:.16;});
   }else if(n.prop==='shell'){
    const shell=ball('echo shell rounded volume',0,.16,0,[.72,.32,.58],pearl,p);shell.rotation.y=(n.tone??0)*.4;for(let i=-3;i<=3;i++){const off=i*.07;tube('echo shell raised radial rib',[[off*.3,.20,-.25],[off,.33,-.03],[off*1.1,.21,.23]],.012,brass,p);}const rim=MeshBuilder.CreateTorus(n.id+' answer ring',{diameter:.80,thickness:.024,tessellation:32},s);rim.position.y=.04;add(rim,lampOn,p,false);updates.push(s=>rim.setEnabled(!!entry(s)?.completed||!!entry(s)?.known.includes(n.id)));
   }else if(n.prop==='lamp'){
    box('snow route lantern stone foot',0,.12,0,.48,.24,.48,stone,p);box('snow route lantern timber post',0,1.02,0,.14,1.80,.14,wood,p);box('snow route lantern roof',0,2.1,0,.50,.10,.50,wood,p);box('snow route lantern sill',0,1.59,0,.40,.08,.40,wood,p);
    for(const a of[-1,1])for(const b of[-1,1])box('snow route lantern frame',a*.19,1.84,b*.19,.035,.49,.035,brass,p);
    const off=box(n.id+' unlit glass',0,1.84,0,.32,.41,.32,lampOff,p,false),on=box(n.id+' warm glass',0,1.84,0,.32,.41,.32,lampOn,p,false),wheel=MeshBuilder.CreateTorus(n.id+' repair wheel',{diameter:.34,thickness:.027,tessellation:20},s);wheel.position.set(0,.99,-.11);wheel.rotation.x=Math.PI/2;add(wheel,brass,p,false);
    updates.push(s=>{const e=entry(s),lit=(e?.stage??0)>=2||e?.values[n.valueKey!]=== (n.valueKey==='forest'?2:1);off.setEnabled(!lit);on.setEnabled(lit);wheel.rotation.z=(e?.values[n.valueKey!]??0)*Math.PI/2;});
   }else if(n.prop==='tracks'){
    const trail=new TransformNode('snow gift track direction',s);trail.parent=root;for(let i=0;i<20;i++){const t=i/19,x=n.x-12*t+(i%2?.2:-.2),z=n.z-4*t,y=w.surfaceAt(x,z,n.y!+2,0)?.y;if(y===undefined)continue;const print=ball('snow small paw print',x,y+.014,z,[.13,.022,.22],stone,trail);print.rotation.y=-1.89;}
   }else if(n.prop==='gift'){
    box('snow gift wooden box',0,.24,0,.70,.48,.57,wood,p);const lid=new TransformNode('snow gift hinged lid',s);lid.parent=p;lid.position.set(0,.49,.29);box('snow gift lid',0,0,-.29,.73,.07,.61,blue,lid);box('snow gift ribbon',0,.049,-.29,.10,.028,.63,paper,lid);const badge=new TransformNode('snowflake gift stamp',s);badge.parent=p;badge.position.set(0,.5,0);for(let i=0;i<6;i++){const a=i/6*Math.PI*2;tube('snowflake wooden stamp ray',[[0,0,0],[Math.sin(a)*.15,0,Math.cos(a)*.15]],.022,brass,badge);}updates.push(s=>{const done=!!entry(s)?.completed;lid.rotation.x=done?-.72:0;badge.setEnabled(done);});
   }
  }
  for(const list of groups.values()){const parent=list[0].parent as TransformNode,mat=list[0].material;parent.computeWorldMatrix(true);const inverse=parent.getWorldMatrix().clone().invert(),m=Mesh.MergeMeshes(list,true,true,undefined,false,false);if(m){m.name='regional story shared '+zone+' '+parent.name+' '+mat?.name;m.bakeTransformIntoVertices(inverse);m.parent=parent;m.material=mat;m.isPickable=false;m.receiveShadows=true;m.metadata={regionalStory:true,cameraObstacle:false,studioZone:zone};}}
  return{root,update(s){for(const fn of updates)fn(s);}};
 }
 dispose(){for(const p of this.parts.values())p.root.dispose();this.parts.clear();}
}
