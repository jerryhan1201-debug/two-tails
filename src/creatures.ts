import {
  Color3, Mesh, MeshBuilder, PBRMaterial, Scene, TransformNode, Vector3,
  VertexData, VertexBuffer, type Material,
} from "@babylonjs/core";
import type { Enemy } from "./simulation";
import type { World } from "./world";
import sculpts from "../tools/creatures-v6.geometry.json";

export interface Creature {
  root: TransformNode; body: TransformNode; warning: Mesh[]; bar: Mesh; phase: Mesh;
  update(dt: number, time: number, enemy: Enemy): void;
  dispose(): void;
}

/** Original, closed 3D creatures. The contact envelope excludes ears, wings and tails. */
export function createCreature(scene: Scene, world: World, enemy: Enemy): Creature {
  const root = new TransformNode(enemy.id, scene);
  const body = new TransformNode(`${enemy.id}-body`, scene); body.parent = root;
  const size = enemy.boss ? 1.5 : enemy.elite ? 1.18 : 1;
  root.scaling.setAll(size);
  root.position.set(enemy.x, world.height(enemy.x, enemy.z), enemy.z);
  const materials: Material[] = [];
  const mat = (name: string, color: string, roughness = .82, glow = 0) => {
    const m = new PBRMaterial(`${enemy.id}-${name}`, scene);
    m.albedoColor = Color3.FromHexString(color).toLinearSpace();
    m.metallic = 0; m.roughness = roughness;
    if (glow) m.emissiveColor = m.albedoColor.scale(glow);
    materials.push(m); return m;
  };
  const fur = mat('soft woodland coat', '#91a1a6');
  fur.sheen.isEnabled=true;fur.sheen.intensity=.18;fur.sheen.roughness=.9;
  const pale = mat('warm pale undercoat', '#cec9b4');
  const dark = mat('charcoal details', '#303c3b', .46);
  const bark = mat('carved warm bark', '#70614c');
  const barkEdge = mat('wood grain ridges', '#968164');
  const moss = mat('velvet moss', '#64885c');
  const leaf = mat('young leaves', '#9eaf71', .77);
  const stone = mat('old blue limestone', '#81938e');
  const eye = mat('small amber eyes', '#e6bd77', .32, .28);
  const magic = mat('quiet starlight', '#9de0cc', .35, .3);
  const attach = (m: Mesh, material: Material, parent: TransformNode = body, castsShadow = true) => {
    m.parent = parent; m.material = material; m.isPickable = false;
    m.receiveShadows = castsShadow; if (castsShadow) world.shadows.addShadowCaster(m); return m;
  };
  const ellipsoid = (name: string, p: number[], r: number[], material: Material, parent: TransformNode = body) => {
    const m = attach(MeshBuilder.CreateSphere(`${enemy.id}-${name}`, { diameter: 2, segments: 12 }, scene), material, parent);
    m.position.set(p[0], p[1], p[2]); m.scaling.set(r[0],r[1],r[2]); return m;
  };
  const tube = (name: string, points: number[][], radius: number, material: Material, parent: TransformNode = body, taper = false) =>
    attach(MeshBuilder.CreateTube(`${enemy.id}-${name}`, {
      path: points.map(p=>new Vector3(...p as [number,number,number])), radius, tessellation: 10,
      cap: Mesh.CAP_ALL, ...(taper ? { radiusFunction: (i: number) => radius * (1 - i / Math.max(1, points.length - 1) * .87) } : {}),
    }, scene), material, parent);
  const branch = (name: string, points: number[][], radius: number, material: Material, parent: TransformNode = body) => {
    const start = new Vector3(...points[0] as [number,number,number]), end = new Vector3(...points[points.length-1] as [number,number,number]);
    const steps = 15, path: number[][] = [];
    for (let i=0;i<=steps;i++) {
      const t=i/steps, k=t*(points.length-1), j=Math.min(points.length-2,Math.floor(k));
      const a=points[j],b=points[j+1],q=k-j;
      path.push([a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q,a[2]+(b[2]-a[2])*q]);
    }
    const mesh=tube(name,path,radius,material,parent,true);
    ellipsoid(`${name}-joint`,start.asArray(),[radius,radius,radius],material,mesh);
    ellipsoid(`${name}-end`,end.asArray(),[radius*.13,radius*.13,radius*.13],material,mesh);
    mesh.setPivotPoint(start);
    return mesh;
  };
  const sculpt = (name: keyof typeof sculpts.meshes, material: Material, parent: TransformNode = body) => {
    const source=sculpts.meshes[name], mesh=new Mesh(`${enemy.id}-${name}`,scene), data=new VertexData();
    data.positions=source.positions;data.normals=source.normals;data.colors=source.colors;data.indices=source.indices.slice();
    if(!scene.useRightHandedSystem)for(let i=0;i<data.indices.length;i+=3){const b=data.indices[i+1];data.indices[i+1]=data.indices[i+2];data.indices[i+2]=b;}
    data.applyToMesh(mesh);return attach(mesh,material,parent);
  };
  // Curved membranes have a real closed edge and smooth spanwise billow. The
  // former six-point planar fan read as cardboard under side/high cameras.
  const sail=(name:string,outline:number[][],material:Material,parent:TransformNode=body)=>{
    const p:number[]=[],indices:number[]=[],n:number[]=[],uv:number[]=[],count=outline.length, radial=8;
    for(const back of [false,true])for(let r=0;r<=radial;r++)for(let j=0;j<count;j++){
      const t=r/radial,q=outline[j];p.push(q[0]*t,q[1]*t,q[2]*t+Math.sin(Math.PI*t)*.085-(back?.022:0));uv.push(t,j/count);
    }
    const layer=(radial+1)*count;
    for(let b=0;b<2;b++)for(let r=0;r<radial;r++)for(let j=0;j<count;j++){
      const a=b*layer+r*count+j,c=b*layer+r*count+(j+1)%count,d=c+count,e=a+count;
      indices.push(...(b?[a,d,c,a,e,d]:[a,c,d,a,d,e]));
    }
    for(let j=0;j<count;j++){const a=radial*count+j,b=radial*count+(j+1)%count;indices.push(a,b,a+layer,b,b+layer,a+layer);}
    const v=new VertexData();v.positions=p;v.indices=indices;v.uvs=uv;VertexData.ComputeNormals(p,indices,n);v.normals=n;
    const m=new Mesh(`${enemy.id}-${name}`,scene);v.applyToMesh(m);return attach(m,material,parent);
  };
  const limbs: { node: TransformNode; phase: number; base: number; axis: 'x'|'z' }[] = [];
  const wings: {mesh: Mesh; side: number; base: number}[]=[];
  let head: Mesh | undefined, tail: Mesh | undefined;
  let barY=2.05;

  if (enemy.kind === 'wolf') {
    head=sculpt('wolf-skin',fur);
    ellipsoid('nose',[0,1.175,1.017],[.105,.07,.055],dark);
    tube('mouth',[[-.16,1.07,.922],[0,1.045,.974],[.16,1.07,.922]],.013,dark);
    for (const side of [-1,1]) {
      ellipsoid('eye socket',[side*.247,1.3,.785],[.077,.058,.045],dark);
      ellipsoid('amber gaze',[side*.256,1.307,.816],[.036,.04,.027],eye);
      ellipsoid('pupil',[side*.26,1.308,.839],[.014,.031,.012],dark);
      const ear=MeshBuilder.CreateLathe(`${enemy.id}-soft pointed ear`,{
        shape:[new Vector3(.002,0,0),new Vector3(.115,.018,0),new Vector3(.145,.11,0),new Vector3(.095,.28,0),new Vector3(.026,.425,0),new Vector3(.002,.442,0)],tessellation:20,cap:Mesh.CAP_ALL,
      },scene);
      attach(ear,fur);ear.position.set(side*.22,1.43,.53);ear.scaling.z=.58;ear.rotation.z=-side*.18;
      const inner=ellipsoid('inner ear',[side*.225,1.645,.59],[.07,.12,.02],pale);inner.rotation.z=-side*.18;
      for(const front of [false,true]) {
        const joint=new TransformNode(`${enemy.id}-leg-${side}-${front}`,scene);joint.parent=body;joint.position.set(side*.29,.71,front?.46:-.50);
        const phase=side*(front?1:-1);limbs.push({node:joint,phase,base:0,axis:'x'});
        sculpt('wolf-leg',fur,joint);
        for(const toe of [-1,1])tube('paw groove',[[toe*.046,-.655,.16],[toe*.046,-.61,.236]],.006,bark,joint);
      }
    }
    tail=branch('bushy curved tail',[[0,.84,-.63],[.16,.84,-.84],[.28,.7,-1.03],[.36,.51,-1.10]],.17,fur);
    barY=2.06;
  } else if (enemy.kind === 'golem') {
    head=sculpt('golem-trunk',bark);
    ellipsoid('carved face',[0,2.04,.268],[.29,.23,.065],barkEdge);
    for(const side of [-1,1]) {
      ellipsoid('eye hollow',[side*.145,2.11,.349],[.084,.062,.027],dark);
      ellipsoid('tree heart eyes',[side*.145,2.115,.374],[.042,.034,.019],magic);
      const brow=tube('bark brow',[[side*.065,2.215,.336],[side*.17,2.235,.332],[side*.265,2.19,.277]],.048,barkEdge);brow.rotation.z=side*.08;
      branch('root leg',[[side*.23,.65,0],[side*.3,.39,.03],[side*.36,.17,.13]],.20,bark);
      ellipsoid('root foot',[side*.34,.16,.15],[.25,.17,.30],barkEdge);
      const shoulder=new TransformNode(`${enemy.id}-root shoulder`,scene);shoulder.parent=body;shoulder.position.set(side*.44,1.46,0);
      limbs.push({node:shoulder,phase:side,base:side*.015,axis:'z'});
      branch('root arm',[[0,0,0],[side*.09,-.29,.015],[side*.09,-.57,.16]],.15,bark,shoulder);
      ellipsoid('rounded knot hand',[side*.09,-.64,.16],[.17,.23,.17],barkEdge,shoulder);
      for(let i=0;i<3;i++)ellipsoid('knuckle',[side*.09+(i-1)*.095,-.73,.27],[.056,.08,.057],bark,shoulder);
      branch('crown twig',[[side*.21,2.3,0],[side*.27,2.46,-.04],[side*.42,2.54,-.06]],.073,bark);
      ellipsoid('moss shoulder',[side*.48,1.64,.06],[.22,.11,.26],moss);
      for(let i=0;i<3;i++) {
        const l=ellipsoid('crown leaves',[side*(.30+i*.055),2.47+i*.045,-.06],[.065,.14,.025],leaf);l.rotation.z=side*(.4+i*.35);
      }
    }
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      branch('vertical bark grain',[[Math.sin(a)*.32,.55,Math.cos(a)*.25],[Math.sin(a+.04)*.55,1.04,Math.cos(a+.04)*.43],[Math.sin(a)*.40,1.58,Math.cos(a)*.34]],.026,barkEdge);
    }
    ellipsoid('heart cavity',[0,1.33,.452],[.18,.21,.05],dark);
    ellipsoid('living heart',[0,1.33,.495],[.088,.13,.048],magic);
    barY=2.91;
  } else if (enemy.kind === 'slime') {
    const jelly=mat('dew colored skin','#91c7a2',.27);
    jelly.clearCoat.isEnabled=true;jelly.clearCoat.intensity=.48;jelly.clearCoat.roughness=.22;
    jelly.subSurface.isTranslucencyEnabled=true;jelly.subSurface.translucencyIntensity=.45;jelly.subSurface.tintColor=new Color3(.68,.94,.76);
    const torso=sculpt('slime-skin',jelly);
    for(let i=0;i<5;i++)ellipsoid('suspended dew pearl',[(i%2?1:-1)*(.14+i*.037),.31+i*.093,.45-i*.025],[.024,.032,.024],magic);
    for(const side of [-1,1]){
      ellipsoid('small dark eye',[side*.205,.65,.524],[.045,.052,.028],dark);
      ellipsoid('eye glint',[side*.20,.667,.55],[.01,.013,.006],pale);
    }
    tube('small smile',[[-.075,.50,.57],[0,.476,.58],[.075,.50,.57]],.013,dark);
    for(let i=0;i<3;i++) {const l=ellipsoid('sprout',[Math.sin(i*2.2)*.08,1.08,Math.cos(i*2.2)*.09],[.09,.22,.024],leaf);l.rotation.z=(i-1)*.7;l.rotation.y=i*2.2;}
    head=torso;barY=1.45;
  } else if (enemy.kind === 'zombie') {
    // Memorial knights are weathered stone armour with a readable face slit.
    const cuirass=attach(MeshBuilder.CreateLathe(`${enemy.id}-forged cuirass`,{shape:[new Vector3(.26,.47,0),new Vector3(.36,.60,0),new Vector3(.41,.98,0),new Vector3(.44,1.29,0),new Vector3(.30,1.47,0)],tessellation:24,cap:Mesh.CAP_ALL},scene),stone);cuirass.scaling.z=.73;
    for(const side of [-1,1])tube('cuirass raised seam',[[side*.13,.58,.233],[side*.19,.97,.295],[side*.26,1.31,.236]],.019,barkEdge);
    for(let i=0;i<3;i++){const plate=ellipsoid('overlapping waist plate',[0,.72-i*.095,.255],[.34-i*.03,.071,.055],stone);plate.rotation.x=-.12;}

    ellipsoid('stone waist',[0,.55,0],[.34,.27,.29],bark);
    head=ellipsoid('rounded helmet',[0,1.76,.02],[.32,.37,.31],stone);
    tube('helmet brow rim',[[-.29,1.85,.158],[-.20,1.89,.283],[0,1.90,.329],[.20,1.89,.283],[.29,1.85,.158]],.025,barkEdge);
    tube('helmet center ridge',[[0,1.63,.33],[0,1.92,.337],[0,2.10,.10],[0,2.06,-.13]],.022,barkEdge);
    for(const side of [-1,1])for(let i=0;i<3;i++)ellipsoid('visor ventilation',[side*(.095+i*.053),1.678,.295-i*.027],[.011,.025,.011],dark);

    tube('visor',[[-.235,1.8,.237],[0,1.76,.32],[.235,1.8,.237]],.048,dark);
    for(const side of [-1,1]) {
      ellipsoid('visor light',[side*.10,1.78,.345],[.065,.026,.018],eye);
      ellipsoid('shoulder plate',[side*.45,1.35,0],[.23,.22,.25],stone);
      branch('arm',[[side*.47,1.26,0],[side*.53,.90,.025],[side*.58,.68,.09]],.13,bark);
      ellipsoid('gauntlet',[side*.53,.67,.085],[.16,.19,.16],stone);
      ellipsoid('shin',[side*.22,.35,0],[.18,.31,.19],stone);
      ellipsoid('boot',[side*.22,.14,.12],[.20,.14,.28],bark);
    }
    const cloak=mat('aged woven tabard','#625f83',.96);
    const tabard=sail('rounded cloth tabard',[[-.20,.02,0],[-.21,-.52,0],[-.10,-.62,0],[.10,-.62,0],[.21,-.52,0],[.20,.02,0]],cloak);tabard.position.set(0,1.18,.35);
    const badge=ellipsoid('memorial badge' ,[0,1.16,.343],[.10,.15,.025],eye);badge.rotation.z=.20;
    barY=2.35;
  } else {
    const dragon=enemy.kind==='dragon', bat=enemy.kind==='bat';
    const coat=mat('twilight skin',dragon?'#879fa5':bat?'#9390a3':'#b6b7d5',.77);
    const membrane=mat('wing membrane',dragon?'#b7a7bc':bat?'#b6a5be':'#b7d8cd',.81);
    membrane.backFaceCulling=false;
    head=sculpt(dragon?'dragon-skin':bat?'bat-skin':'moth-skin',coat);
    for(const side of [-1,1]){
      ellipsoid('watchful eye',[side*(dragon?.26:.145),dragon?1.82:1.12,dragon?.91:.281],[.058,.071,.042],dark);
      ellipsoid('eye light',[side*(dragon?.26:.145),dragon?1.835:1.138,dragon?.948:.314],[.023,.031,.014],eye);
      if(dragon) {
        branch('curved horn',[[side*.29,1.98,.5],[side*.37,2.24,.32],[side*.30,2.43,.22]],.10,pale);
        ellipsoid('hind haunch',[side*.50,.57,-.32],[.29,.45,.36],coat);
        ellipsoid('clawed foot',[side*.49,.14,-.18],[.28,.15,.37],pale);
        branch('fore arm',[[side*.50,1.24,.48],[side*.64,.94,.63],[side*.61,.72,.75]],.13,coat);
      } else if(bat) {
        const ear=ellipsoid('soft ear',[side*.21,1.40,.03],[.10,.25,.07],coat);ear.rotation.z=-side*.30;
      } else {
        branch('feathery antenna',[[side*.12,1.31,0],[side*.19,1.5,.02],[side*.27,1.58,.05]],.024,coat);
        ellipsoid('antenna tip',[side*.27,1.58,.05],[.055,.055,.055],eye);
      }
      if(dragon||bat){
        const outline=[[0,0,0],[side*.30,.50,-.055],[side*.62,.76,-.10],[side*1.16,.68,-.25],[side*1.65,.44,-.40],
          [side*1.43,.20,-.49],[side*1.34,.09,-.55],[side*1.49,.025,-.58],
          [side*1.13,-.035,-.59],[side*.96,-.195,-.57],[side*.77,-.13,-.50],[side*.48,-.18,-.38],[side*.22,-.08,-.19]];
        const wing=sail('arched scalloped wing',outline,membrane);wing.position.set(side*(dragon?.43:.21),dragon?1.17:.94,-.12);wing.scaling.setAll(dragon?1:.58);
        wings.push({mesh:wing,side,base:0});
        for(const tip of [4,7,9,11])tube('wing rib',[[0,0,0],[side*.49,.37,-.15],[outline[tip][0],outline[tip][1],outline[tip][2]]],dragon?.022:.028,coat,wing);
        tube('wing leading tendon',outline.slice(0,5),.038,coat,wing);
      } else {
        for(const upper of [true,false]) {const wing=ellipsoid('moth wing',[side*.39,upper?1.03:.62,-.08],[.37,upper?.34:.24,.047],membrane);wing.rotation.z=side*(upper?-.38:.42);wings.push({mesh:wing,side,base:wing.rotation.y});const mark=ellipsoid('wing marking',[side*.48,upper?1.09:.62,-.026],[.11,.14,.012],eye);wing.computeWorldMatrix(true);mark.setParent(wing);}
      }
    }
    if(dragon){
      for(let i=0;i<6;i++){const scale=ellipsoid('overlapping breast scute',[0,1.42-i*.145,.685-i*.028],[.245+i*.018,.11,.045],pale);scale.rotation.x=-.28;}
      for(const side of [-1,1]){
        ellipsoid('nostril',[side*.146,1.64,1.247],[.040,.023,.017],dark);
        tube('muzzle smile',[[side*.08,1.455,1.236],[side*.23,1.456,1.181],[side*.291,1.49,1.06]],.015,dark);
        for(let i=0;i<3;i++)branch('small ivory claw',[[side*.49+(i-1)*.11,.12,.065],[side*.49+(i-1)*.11,.095,.205]],.035,pale);
      }
      for(let i=0;i<4;i++)ellipsoid('dorsal crest',[0,1.35-i*.14,-.36-i*.17],[.05,.18-i*.012,.12],pale);
    }
    if(dragon) tail=branch('long flowing tail',[[0,.74,-.61],[.26,.52,-1.18],[.54,.35,-1.55],[.80,.51,-1.79]],.27,coat);
    barY=dragon?2.84:1.95;
  }
  if(enemy.boss){
    const crest=mat('story guardian brass','#cbb07a',.42), silk=mat('guardian woven color',enemy.kind==='bat'?'#704e73':'#63898a',.92);
    if(enemy.kind==='golem'){
      const storm=enemy.id.startsWith('m-'),memory=enemy.id.startsWith('f-');
      if(storm){bark.albedoColor=Color3.FromHexString('#718e9a').toLinearSpace();barkEdge.albedoColor=Color3.FromHexString('#b9c8c4').toLinearSpace();}
      for(const side of [-1,1]){
        branch(storm?'storm antler':'elder antler',[[side*.19,2.29,-.03],[side*.33,2.60,-.10],[side*.46,2.73,-.13]],.054,storm?stone:barkEdge);
        if(memory){for(let i=0;i<3;i++){const l=ellipsoid('memory crown leaf',[side*(.36+i*.07),2.55+i*.03,-.04],[.07,.13,.027],magic);l.rotation.z=side*(.7+i*.25);}}
        else if(!storm)branch('thorn crown',[[side*.32,2.50,-.06],[side*.57,2.60,-.04]],.045,barkEdge);
      }
      for(let i=0;i<3;i++)ellipsoid(storm?'storm chest crystal':'guardian seed talisman',[(i-1)*.13,1.49-Math.abs(i-1)*.06,.462],[.037,.09,.028],storm?magic:crest);
    }else if(enemy.kind==='slime'){
      for(const side of [-1,1]){const l=ellipsoid('river waterlily crown',[side*.16,1.02,-.025],[.14,.055,.18],leaf);l.rotation.z=side*.23;}
      ellipsoid('river crown pearl',[0,1.115,.015],[.075,.085,.072],magic);
    }else if(enemy.kind==='zombie'){
      branch('knight horsehair plume',[[0,2.08,0],[0,2.30,-.12],[0,2.20,-.33],[0,2.05,-.39]],.08,silk);
      for(const side of [-1,1])tube('captain shoulder filigree',[[side*.31,1.44,.18],[side*.46,1.52,.15],[side*.58,1.43,.12]],.026,crest);
    }else if(enemy.kind==='bat'){
      const collar=sail('count velvet collar',[[-.31,.08,0],[-.42,.30,-.05],[0,.17,-.05],[.42,.30,-.05],[.31,.08,0],[0,-.05,.03]],silk);collar.position.set(0,.93,.14);
      ellipsoid('count moon brooch',[0,.93,.293],[.064,.08,.025],crest);
      for(const side of [-1,1])ellipsoid('count silver earring',[side*.29,1.22,.04],[.04,.055,.014],crest);
    }else if(enemy.kind==='dragon'){
      for(const side of [-1,1])branch('nest guardian crown',[[side*.24,2.10,.38],[side*.24,2.41,.22],[side*.17,2.48,.12]],.065,crest);
      const badge=ellipsoid('nest heart stone',[0,1.35,.733],[.11,.155,.048],magic);badge.rotation.z=.22;
    }
  }
  if(enemy.kind==='wolf')for(const node of body.getChildren(undefined,true))if(node instanceof TransformNode){node.position.z*=.965;node.scaling.z*=.965;}
  // Center the physical trunk and muzzle together. The old origin left wolf
  // and dragon noses outside their unchanged contact radius during a lunge.
  const recenter=enemy.kind==='wolf'?.15:enemy.kind==='dragon'?.27:0;
  if(recenter)for(const node of body.getChildren(undefined,true))if(node instanceof TransformNode)node.position.z-=recenter;
  const bar=attach(MeshBuilder.CreatePlane(`${enemy.id}-health`,{width:.78,height:.045},scene),eye,root,false);
  bar.position.y=barY;bar.billboardMode=Mesh.BILLBOARDMODE_ALL;
  const phase=attach(MeshBuilder.CreateSphere(`${enemy.id}-phase ember`,{diameter:.10,segments:10},scene),magic,root,false);
  phase.position.set(0,barY+.14,0);phase.setEnabled(false);
  const warning:Mesh[]=[];
  const flying=enemy.kind==='bat'||enemy.kind==='sprite';
  // Support samples come from the visible paw/foot surface. Correcting the
  // body (rather than changing the authoritative root) keeps grounded creatures
  // on the path while the renderer's old generic bob remains compatible.
  const supports=body.getChildMeshes().filter(m=>/wolf-leg|root foot|clawed foot|boot|slime-skin/.test(m.name)).map(mesh=>{
    const positions=mesh.getVerticesData('position')!;const offsets=new Set<number>();
    for(let j=0;j<48;j++){
      const y=-1+j/47*.55,a=j*2.39996323,r=Math.sqrt(Math.max(0,1-y*y));let best=-Infinity,at=0;
      for(let i=0;i<positions.length;i+=3){const q=positions[i]*Math.cos(a)*r+positions[i+1]*y+positions[i+2]*Math.sin(a)*r;if(q>best){best=q;at=i;}}
      offsets.add(at);
    }
    return {mesh,positions,offsets:[...offsets]};
  });
  const articulated=new Set<Mesh>([...supports.map(s=>s.mesh as Mesh),...wings.map(w=>w.mesh),...(head?[head]:[]),...(tail?[tail]:[])]);
  const groups=new Map<TransformNode,Map<Material,Mesh[]>>();
  for(const child of body.getChildMeshes()){
    const m=child as Mesh;if(articulated.has(m)||m.getChildren().length||/ear|wing|tail|horn|twig|leaves|antenna|sprout|crest|plume|crown/i.test(m.name))continue;
    const parent=m.parent as TransformNode,material=m.material!;
    if(!m.isVerticesDataPresent(VertexBuffer.ColorKind))m.setVerticesData(VertexBuffer.ColorKind,new Float32Array(m.getTotalVertices()*4).fill(1));
    if(!m.isVerticesDataPresent(VertexBuffer.UVKind))m.setVerticesData(VertexBuffer.UVKind,new Float32Array(m.getTotalVertices()*2));
    const mats=groups.get(parent)??new Map<Material,Mesh[]>(),list=mats.get(material)??[];list.push(m);mats.set(material,list);groups.set(parent,mats);
  }
  for(const [parent,mats]of groups)for(const [material,list]of mats){
    if(list.length<2)continue;for(const m of list)world.shadows.removeShadowCaster(m);
    const sourceParts=list.map(m=>m.name);parent.computeWorldMatrix(true);const merged=Mesh.MergeMeshes(list,true,true,undefined,false,false);
    if(merged){merged.name=`${enemy.id}-fused-${material.name}`;merged.setParent(parent);merged.metadata={sourceParts};merged.receiveShadows=true;merged.isPickable=false;world.shadows.addShadowCaster(merged);}
  }
  for(const mesh of body.getChildMeshes()){const normals=mesh.getVerticesData(VertexBuffer.NormalKind);if(normals){for(let i=0;i<normals.length;i+=3){const len=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(len>.00001){normals[i]/=len;normals[i+1]/=len;normals[i+2]/=len;}else{normals[i]=0;normals[i+1]=0;normals[i+2]=1;}}mesh.setVerticesData(VertexBuffer.NormalKind,normals);}}
  return {root,body,bar,phase,warning,
    update(dt,time,e){
      const moving=e.state==='chase', t=time*(enemy.kind==='wolf'?10:4.8);
      const strike=e.state==='attack'?Math.sin(Math.min(1,Math.max(0,e.timer/.38))*Math.PI):0;
      const charge=e.state==='warning'?Math.min(1,Math.max(0,e.timer)):0;
      for(const limb of limbs)limb.node.rotation[limb.axis]=limb.base+(moving?Math.sin(t+limb.phase*Math.PI*.5)*(enemy.kind==='golem'?.10:.34):Math.sin(time*1.4+limb.phase)*.025);
      for(const wing of wings){const flap=Math.sin(time*(enemy.kind==='dragon'?2.6:6.5));wing.mesh.rotation.y=wing.base+wing.side*(flap*(enemy.kind==='dragon'?.19:.28)-strike*.25+charge*.10);}
      if(tail)tail.rotation.y=Math.sin(time*2.3)*.06;
      if(head&&enemy.kind==='slime') {const squash=Math.sin(time*(moving?7:2))*(moving?.075:.025)-charge*.085+strike*.07;head.scaling.y=1+squash;head.scaling.x=1-squash*.32;head.scaling.z=1-squash*.32;}
      body.rotation.x=e.state==='warning'?-.055*charge:e.state==='attack'?.08*(.35+.65*strike):0;
      if(enemy.kind==='wolf'&&moving)body.rotation.x=Math.sin(t*2)*.014;
      if(enemy.kind==='golem'&&moving)body.rotation.x=Math.sin(t)*.012;
      body.rotation.z=e.hit>0?.12*Math.sin(time*60):0;
      body.scaling.y=1+(e.state==='warning'?Math.sin(time*12)*.035:0);
      if(!flying&&supports.length){
        body.position.y=0;let low=Infinity;
        for(const support of supports){const w=support.mesh.computeWorldMatrix(true).m,p=support.positions;for(const i of support.offsets)low=Math.min(low,p[i]*w[1]+p[i+1]*w[5]+p[i+2]*w[9]+w[13]);}
        if(Number.isFinite(low))body.position.y=(world.height(root.position.x,root.position.z)+.008-low)/size;
      }
    },
    dispose(){root.dispose(false,false);for(const w of warning)w.dispose(false,true);for(const m of materials)m.dispose();}
  };
}
