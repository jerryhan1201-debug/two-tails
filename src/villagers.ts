import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  TransformNode,
  Vector3,
  VertexData,
  VertexBuffer,
  Curve3,
} from "@babylonjs/core";
import models from "../tools/generate-characters-v6-villagers.geometry.json";
export type VillagerKind = "badger" | "frog" | "mouse";
let villagerSerial = 0;
/** Original continuous-surface animal residents. Feet at Y=0; forward +Z. */
export function createVillager(
  scene: Scene,
  kind: VillagerKind = "badger",
  seed = 0,
  identity = "",
): TransformNode {
  const role = residentIdentity(identity,kind);
  if (["moth","cat","bird","seedling","portrait","ghost"].includes(role))
    return createStoryResident(scene, role, seed, identity);
  const id = `resident-${kind}-${seed}-${++villagerSerial}`;
  const root = new TransformNode(id, scene);
  root.metadata = { kind, seed, identity, role, originalArtwork: true };
  const ownedMaterials: PBRMaterial[] = [];
  const material = (name: string, hex: string, roughness = 0.84, metal = 0) => {
    const m = new PBRMaterial(`${id}-${name}`, scene);
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    m.roughness = roughness;
    m.metallic = metal;
    ownedMaterials.push(m);
    return m;
  };
  const plush = material("soft-cloth", "#ffffff");
  plush.sheen.isEnabled=true;plush.sheen.intensity=.16;plush.sheen.roughness=.92;
  const faceRig=new TransformNode(`${id}-face-rig`,scene);faceRig.parent=root;faceRig.position.y=.80;
  const ink = material("charcoal", "#292C28", 0.36);
  const leather = material("leather", "#755542");
  const gold = material("brass", "#D9B87B", 0.4, 0.4);
  const paper = material("paper", "#F1DFC0");
  const rose = material("rose", "#C38F85");
  const scarf = material(
    "scarf",
    kind === "badger" ? "#BF8E68" : kind === "frog" ? "#D0B574" : "#808AA4",
  );
  const dark = material("cap", kind === "frog" ? "#527655" : "#526C79");
  const attach = (mesh: Mesh, mat: PBRMaterial) => {
    mesh.parent = root;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  };
  const ball = (
    name: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: PBRMaterial,
    segments = 12,
  ) => {
    const m = attach(
      MeshBuilder.CreateSphere(
        `${id}-${name}`,
        { diameter: 1, segments },
        scene,
      ),
      mat,
    );
    m.position.set(x, y, z);
    m.scaling.set(sx, sy, sz);
    return m;
  };
  const tube = (
    name: string,
    path: Vector3[],
    radius: number,
    mat: PBRMaterial,
  ) =>
    attach(
      MeshBuilder.CreateTube(
        `${id}-${name}`,
        { path, radius, tessellation: 7, cap: Mesh.CAP_ALL },
        scene,
      ),
      mat,
    );
  for (const sculpt of models[kind]) {
    const m = new Mesh(`${id}-${sculpt.name}`, scene),
      data = new VertexData();
    data.positions = sculpt.positions;
    data.normals = sculpt.normals;
    // The editable resident sculpt stores sRGB palette colors; PBR vertex colors
    // are multiplied directly into linear albedo, so decode once on import.
    data.colors = sculpt.colors.map((v, i) => i % 4 === 3 ? v : Math.pow(v, 2.2));
    data.indices = sculpt.indices.slice();
    if (!scene.useRightHandedSystem)
      for (let i = 0; i < data.indices.length; i += 3) {
        const j = data.indices[i + 1];
        data.indices[i + 1] = data.indices[i + 2];
        data.indices[i + 2] = j;
      }
    if(sculpt.name==='coat-and-paws'&&role==='forester')for(let i=0;i<sculpt.positions.length;i+=3){
      if(sculpt.positions[i+1]>.18&&sculpt.positions[i+1]<.74){const c=Color3.FromHexString('#70885c').toLinearSpace();data.colors[i/3*4]=c.r;data.colors[i/3*4+1]=c.g;data.colors[i/3*4+2]=c.b;}
    }
    data.applyToMesh(m);
    attach(m, plush);
  }
  const oval = (
    name: string,
    rx: number,
    rz: number,
    y: number,
    z: number,
    radius: number,
    mat: PBRMaterial,
  ) =>
    tube(
      name,
      Array.from({ length: 41 }, (_, i) => {
        const a = (i * Math.PI) / 20;
        return new Vector3(Math.sin(a) * rx, y, Math.cos(a) * rz + z);
      }),
      radius,
      mat,
    );
  const smile = (width: number, y: number, z: number) =>
    tube(
      "smile",
      Array.from({ length: 15 }, (_, i) => {
        const x = (i / 14 - 0.5) * width * 2;
        return new Vector3(
          x,
          y + 0.044 * (x / width) ** 2,
          z - 0.045 * (x / width) ** 2,
        );
      }),
      0.009,
      ink,
    );
  if (kind === "frog") {
    const iris = material("golden-eyes", "#E1CC7C", 0.48);
    for (const sign of [-1, 1]) {
      ball("eye", sign * 0.235, 1.248, 0.145, 0.133, 0.151, 0.071, iris);
      ball("pupil", sign * 0.235, 1.249, 0.184, 0.033, 0.059, 0.016, ink, 10);
      ball("glint", sign * 0.23, 1.271, 0.194, 0.009, 0.012, 0.006, paper, 6);
      ball("nostril", sign * 0.063, 1.065, 0.245, 0.012, 0.011, 0.007, ink, 6);
    }
    smile(0.179, 0.949, 0.285);
    ball("soft-moss-cap", 0, 1.372, -0.047, 0.367, 0.184, 0.337, dark, 16);
    ball("hat-brim", 0, 1.326, -0.002, 0.503, 0.049, 0.401, dark, 16);
    oval("cap-ribbon", 0.183, 0.164, 1.349, -0.047, 0.016, scarf);
    const feather = tube(
      "hat-feather",
      [
        new Vector3(-0.12, 1.377, -0.047),
        new Vector3(-0.2, 1.449, -0.042),
        new Vector3(-0.245, 1.476, -0.05),
      ],
      0.009,
      paper,
    );
    feather.rotation.z = -0.12;
    ball("pearl-button", -0.176, 1.356, 0.092, 0.028, 0.03, 0.017, gold, 8);
  } else {
    for (const sign of [-1, 1]) {
      const eyeY = kind === "badger" ? 1.092 : 1.047,
        eyeX = kind === "badger" ? 0.125 : 0.108;
      ball("eye", sign * eyeX, eyeY, 0.218, 0.043, 0.047, 0.032, ink, 10);
      ball(
        "glint",
        sign * eyeX - 0.006,
        eyeY + 0.01,
        0.234,
        0.009,
        0.01,
        0.006,
        paper,
        6,
      );
    }
    const noseY = kind === "badger" ? 0.979 : 0.955,
      noseZ = kind === "badger" ? 0.327 : 0.324;
    ball(
      "button-nose",
      0,
      noseY,
      noseZ,
      0.061,
      0.044,
      0.042,
      kind === "mouse" ? rose : ink,
      10,
    );
    smile(kind === "badger" ? 0.087 : 0.065, noseY - 0.058, noseZ + 0.025);
    tube(
      "nose-line",
      [
        new Vector3(0, noseY - 0.018, noseZ + 0.003),
        new Vector3(0, noseY - 0.056, noseZ - 0.009),
      ],
      0.007,
      ink,
    );
    if (kind === "mouse") {
      for (const sign of [-1, 1]) {
        ball(
          "velvet-inner-ear",
          sign * 0.22,
          1.252,
          0.049,
          0.161,
          0.178,
          0.023,
          rose,
          14,
        );
        for (const n of [-1, 1])
          tube(
            "whisker",
            [
              new Vector3(sign * 0.055, 0.969 + n * 0.008, 0.284),
              new Vector3(sign * 0.126, 0.976 + n * 0.025, 0.263),
              new Vector3(sign * 0.17, 0.975 + n * 0.03, 0.245),
            ],
            0.0035,
            paper,
          );
      }
      tube(
        "curled-tail",
        [
          new Vector3(0, 0.21, -0.17),
          new Vector3(0.17, 0.11, -0.27),
          new Vector3(0.35, 0.08, -0.26),
          new Vector3(0.44, 0.16, -0.22),
          new Vector3(0.41, 0.24, -0.22),
        ],
        0.013,
        rose,
      );
    } else {
      ball("post-cap", 0, 1.328, -0.015, 0.359, 0.125, 0.311, dark, 14);
      ball("post-cap-visor", 0, 1.294, 0.132, 0.287, 0.024, 0.173, dark, 12);
      ball("post-badge", 0, 1.329, 0.143, 0.036, 0.047, 0.011, gold, 8);
    }
  }
  // Cloth band wraps the neck and drapes as a soft shawl across both shoulders.
  const positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i * Math.PI) / 20;
    const x = Math.sin(a),
      z = Math.cos(a);
    positions.push(x * 0.196, 0.786 - z * 0.014, z * 0.162);
    positions.push(x * 0.266, 0.66 - z * 0.048, z * 0.204);
    if (i < 40) {
      const j = i * 2;
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  const shawl = new Mesh(`${id}-fitted-shawl`, scene);
  vd.applyToMesh(shawl);
  scarf.backFaceCulling = false;
  attach(shawl, scarf);
  oval("shawl-woven-edge", 0.197, 0.163, 0.785, 0, 0.013, scarf);
  ball("shawl-clasp", 0.07, 0.699, 0.207, 0.036, 0.042, 0.021, gold, 8);
  for (let i = 0; i < 3; i++)
    ball(
      "coat-button",
      0,
      0.553 - i * 0.103,
      0.201,
      0.022,
      0.026,
      0.016,
      gold,
      8,
    );
  tube(
    "coat-seam",
    [
      new Vector3(0.018, 0.61, 0.2),
      new Vector3(0.018, 0.48, 0.204),
      new Vector3(0.018, 0.28, 0.181),
    ],
    0.0038,
    leather,
  );
  if (kind === "badger" && role !== "forester") {
    // A sewn leather mailbag and the diagonal strap crossing the coat.
    ball(
      "mail-satchel",
      -0.282,
      0.341,
      0.042,
      0.191,
      0.205,
      0.146,
      leather,
      14,
    );
    const flap = ball(
      "satchel-flap",
      -0.281,
      0.39,
      0.109,
      0.176,
      0.088,
      0.023,
      dark,
      12,
    );
    flap.rotation.z = 0.11;
    ball("bag-buckle", -0.281, 0.372, 0.124, 0.035, 0.037, 0.012, gold, 8);
    tube(
      "bag-strap",
      [
        new Vector3(-0.279, 0.412, 0.075),
        new Vector3(-0.164, 0.534, 0.185),
        new Vector3(0.029, 0.647, 0.185),
        new Vector3(0.192, 0.735, 0.129),
        new Vector3(0.238, 0.714, -0.016),
      ],
      0.017,
      leather,
    );
    const letter = attach(
      MeshBuilder.CreateBox(
        `${id}-letter`,
        { width: 0.11, height: 0.074, depth: 0.008 },
        scene,
      ),
      paper,
    );
    letter.position.set(-0.28, 0.349, 0.119);
    letter.rotation.z = -0.08;
    tube(
      "envelope-fold",
      [
        new Vector3(-0.326, 0.379, 0.125),
        new Vector3(-0.28, 0.347, 0.127),
        new Vector3(-0.23, 0.379, 0.125),
      ],
      0.0028,
      leather,
    );
  } else if (kind === "mouse") {
    const book = attach(
      MeshBuilder.CreateBox(
        `${id}-storybook`,
        { width: 0.15, height: 0.218, depth: 0.057 },
        scene,
      ),
      leather,
    );
    book.position.set(0.259, 0.46, 0.108);
    book.rotation.z = -0.18;
    const pages = attach(
      MeshBuilder.CreateBox(
        `${id}-book-pages`,
        { width: 0.132, height: 0.2, depth: 0.042 },
        scene,
      ),
      paper,
    );
    pages.position.set(0.26, 0.46, 0.112);
    pages.rotation.z = -0.18;
    tube(
      "book-binding",
      [new Vector3(0.185, 0.353, 0.12), new Vector3(0.224, 0.555, 0.12)],
      0.006,
      gold,
    );
  } else {
    // The windmill keeper carries a small brass key, readable from gameplay distance.
    const key = oval("mill-key-ring", 0.029, 0.001, 0.5, 0.218, 0.007, gold);
    key.position.x = 0.272;
    tube(
      "mill-key-stem",
      [
        new Vector3(0.272, 0.49, 0.216),
        new Vector3(0.272, 0.401, 0.216),
        new Vector3(0.299, 0.401, 0.216),
        new Vector3(0.299, 0.419, 0.216),
      ],
      0.007,
      gold,
    );
  }
  if(role==='forester'){
    const felt=material('forester-felt','#5a7151'),glass=material('lantern-glass','#f1dca3',.30);
    glass.emissiveColor=new Color3(.16,.115,.035);
    ball('forester-cape',0,.64,-.11,.60,.38,.24,felt,18);
    const lantern=attach(MeshBuilder.CreateCylinder(`${id}-lantern-glass`,{height:.19,diameter:.115,tessellation:12},scene),glass);lantern.position.set(.30,.34,.15);
    for(const y of [.24,.44]){const rim=attach(MeshBuilder.CreateCylinder(`${id}-lantern-rim`,{height:.022,diameter:.145,tessellation:12},scene),gold);rim.position.set(.30,y,.15);}
    for(const dx of [-.049,.049])tube('lantern-frame',[new Vector3(.30+dx,.25,.19),new Vector3(.30+dx,.44,.19)],.009,gold);
    tube('lantern-handle',[new Vector3(.25,.44,.15),new Vector3(.25,.50,.15),new Vector3(.35,.50,.15),new Vector3(.35,.44,.15)],.01,gold);
    const leafPin=ball('oak-leaf-pin',-.11,.71,.213,.065,.13,.018,felt);leafPin.rotation.z=.45;
  }
  if(role==='captain'){
    const navy=material('captain-navy','#344e63');
    ball('captain-cap-crown',0,1.393,-.045,.37,.17,.32,paper,18);
    ball('captain-navy-band',0,1.352,-.008,.393,.05,.343,navy,16);
    ball('captain-peaked-visor',0,1.337,.18,.37,.035,.22,navy,16);
    tube('anchor-insignia',[new Vector3(0,1.408,.141),new Vector3(0,1.370,.158)],.006,gold);
    tube('anchor-curved-base',[new Vector3(-.023,1.382,.156),new Vector3(-.015,1.366,.164),new Vector3(0,1.361,.165),new Vector3(.015,1.366,.164),new Vector3(.023,1.382,.156)],.006,gold);
    for(const side of [-1,1])for(let n=0;n<2;n++)ball('captain-coat-button',side*.065,.56-n*.105,.21,.019,.023,.012,gold,8);
  }
  if(role==='herbalist'){
    const herb=material('sage-herbs','#78945d');
    const apron=ball('herbalist-apron',0,.455,.188,.35,.39,.045,paper,16);
    ball('woven-basket',-.29,.33,.13,.21,.20,.15,leather,16);
    for(let i=0;i<4;i++){const l=ball('basket-leaf',-.29+(i-1.5)*.036,.47+Math.sin(i)*.04,.13,.05,.16,.022,herb);l.rotation.z=(i-1.5)*.3;}
    apron.metadata={identity:'herbalist apron'};
  }
  // Face and hat are one articulated unit. Their world-space placement is
  // preserved while parenting, so natural attention never detaches the features.
  for(const mesh of root.getChildMeshes()){
    mesh.computeWorldMatrix(true);
    if(mesh.getBoundingInfo().boundingBox.minimumWorld.y>.81||/badger-face|frog-face|mouse-face/.test(mesh.name))mesh.setParent(faceRig);
  }
  const groups = new Map<string, {mat:PBRMaterial,parent:TransformNode,list:Mesh[]}>();
  for (const mesh of root.getChildMeshes()) {
    if (!mesh.isVerticesDataPresent(VertexBuffer.UVKind))
      mesh.setVerticesData(
        VertexBuffer.UVKind,
        new Float32Array(mesh.getTotalVertices() * 2),
      );
    const mat = mesh.material as PBRMaterial;
    const parent=mesh.parent as TransformNode,key=parent.uniqueId+':'+mat.uniqueId;
    const group=groups.get(key)??{mat,parent,list:[]};group.list.push(mesh as Mesh);groups.set(key,group);
  }
  for (const {mat,parent,list} of groups.values()) {
    if (list.length < 2) continue;
    const merged = Mesh.MergeMeshes(list, true, true, undefined, false, false);
    if (merged) {
      merged.name = `${id}-${mat.name}-merged`;
      merged.setParent(parent);
      merged.isPickable = false;
      merged.receiveShadows = true;
    }
  }
  addResidentLife(scene,root,faceRig,seed);
  root.onDisposeObservable.add(() =>
    ownedMaterials.forEach((mat) => mat.dispose()),
  );
  root.scaling.setAll(1 + Math.sin(seed * 7.1) * 0.025);
  return root;
}

export function residentIdentity(identity:string,kind:VillagerKind='badger'):string {
  if(/moth/.test(identity))return 'moth';
  if(/cat/.test(identity))return 'cat';
  if(/bird/.test(identity))return 'bird';
  if(/seed/.test(identity))return 'seedling';
  if(/portrait/.test(identity))return 'portrait';
  if(/ghost/.test(identity))return 'ghost';
  if(/herb|mushroom|mycel/.test(identity))return 'herbalist';
  if(/post-home|forester|treehouse/.test(identity))return 'forester';
  if(/frog|hat|captain/.test(identity)||kind==='frog')return 'captain';
  return kind==='badger'?'postman':'herbalist';
}

function addResidentLife(scene:Scene,root:TransformNode,head:TransformNode,seed:number){
  let life=seed*.13,response=0,target:Vector3|undefined;
  const scale=root.scaling.clone();
  const attentionMode = head.metadata?.continuousSkin ? (root.metadata?.role === 'portrait' ? 'none' : 'whole-body') : 'head';
  let gesture:TransformNode|undefined;
  if(attentionMode==='whole-body'){
    const children=root.getChildren().filter((n):n is TransformNode=>n instanceof TransformNode);
    gesture=new TransformNode(`${root.name}-whole-body-response`,scene);gesture.parent=root;gesture.position.y=.55;
    for(const child of children)child.setParent(gesture);
  }
  root.metadata={...root.metadata,attentionMode,responseMode:attentionMode==='none'?'none':attentionMode==='head'?'head-nod':'whole-body-sway',lookAt:(point:Vector3)=>{target=point.clone();},respond:()=>{response=1.7;}};
  const observer=scene.onBeforeRenderObservable.add(()=>{
    if(!root.isEnabled())return;
    const dt=Math.min(.05,scene.getEngine().getDeltaTime()/1000||1/60);life+=dt;response=Math.max(0,response-dt);
    const camera=scene.activeCamera,point=target??camera?.globalPosition;
    let attention=0;
    if(point){const origin=root.getAbsolutePosition(),distance=Vector3.Distance(origin,point),forward=root.getDirection(Vector3.Forward());
      if(distance<13){const desired=Math.atan2(point.x-origin.x,point.z-origin.z)-Math.atan2(forward.x,forward.z);attention=Math.max(-.28,Math.min(.28,Math.atan2(Math.sin(desired),Math.cos(desired))));}}
    if(!head.metadata?.continuousSkin){
      head.rotation.y+=(attention+Math.sin(life*.71)*.035-head.rotation.y)*Math.min(1,dt*3);
      head.rotation.x=Math.sin(life*1.8)*.015+(response>0?Math.sin(response*8)*.10:0);
    }
    if(gesture){
      gesture.rotation.y+=(attention*.45-gesture.rotation.y)*Math.min(1,dt*3);
      gesture.rotation.x=response>0?Math.sin(response*8)*.038*Math.min(1,response/.25):0;
      gesture.position.y=.55+Math.abs(gesture.rotation.x)*.25;
    }
    root.scaling.y=scale.y*(1+(attentionMode==='none'?0:Math.sin(life*2)*.007));
    for(const child of root.getChildTransformNodes())if(child.metadata?.sway){
      child.rotation.z=child.metadata.baseZ+Math.sin(life*child.metadata.sway+seed)*child.metadata.amount;
    }
  });
  root.onDisposeObservable.add(()=>scene.onBeforeRenderObservable.remove(observer));
}

/** Story-specific residents share the runtime's real meshes with dialogue portraits. */
function createStoryResident(scene:Scene,role:string,seed:number,identity:string):TransformNode{
  const id=`resident-${role}-${seed}-${++villagerSerial}`,root=new TransformNode(id,scene);
  root.metadata={identity,role,kind:role,originalArtwork:true};
  const owned:PBRMaterial[]=[],materials=new Map<string,PBRMaterial>();
  const material=(name:string,color:string,roughness=.83)=>{
    const m=new PBRMaterial(`${id}-${name}`,scene);m.albedoColor=Color3.FromHexString(color).toLinearSpace();m.roughness=roughness;m.metallic=0;owned.push(m);materials.set(name,m);return m;
  };
  const plush=material('soft sculpt','#ffffff'),ink=material('ink','#263139',.44),cream=material('cream','#f4e5c5'),gold=material('brass','#d2b16d',.4),rose=material('rose','#cba297'),sage=material('sage','#759a78'),wood=material('wood','#695541');
  plush.sheen.isEnabled=true;plush.sheen.intensity=.14;plush.sheen.roughness=.9;gold.metallic=.45;
  const head=new TransformNode(`${id}-head-rig`,scene);head.parent=root;head.position.y=role==='portrait'?1.05:.72;
  const attach=(mesh:Mesh,mat:PBRMaterial,parent:TransformNode=root)=>{mesh.parent=parent;mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=true;return mesh;};
  const ball=(name:string,p:number[],r:number[],mat:PBRMaterial,parent:TransformNode=root)=>{
    const m=attach(MeshBuilder.CreateSphere(`${id}-${name}`,{diameter:2,segments:14},scene),mat,parent);m.position.set(p[0],p[1],p[2]);m.scaling.set(r[0],r[1],r[2]);return m;
  };
  const tube=(name:string,points:number[][],radius:number,mat:PBRMaterial,parent:TransformNode=root)=>{const path=points.map(p=>new Vector3(p[0],p[1],p[2]));return attach(MeshBuilder.CreateTube(`${id}-${name}`,{path:path.length>2?Curve3.CreateCatmullRomSpline(path,8,false).getPoints():path,radius,tessellation:10,cap:Mesh.CAP_ALL},scene),mat,parent);};
  const key=(role==='portrait'?'princess':role) as keyof typeof models;
  for(const sculpt of models[key]){
    const mesh=new Mesh(`${id}-${sculpt.name}`,scene),data=new VertexData();data.positions=sculpt.positions;data.normals=sculpt.normals;data.colors=sculpt.colors.map((v,i)=>i%4===3?v:Math.pow(v,2.2));data.indices=sculpt.indices.slice();
    if(!scene.useRightHandedSystem)for(let i=0;i<data.indices.length;i+=3){const b=data.indices[i+1];data.indices[i+1]=data.indices[i+2];data.indices[i+2]=b;}
    data.applyToMesh(mesh);attach(mesh,plush);
  }
  const eyes=(y:number,x:number,z:number)=>{for(const side of [-1,1]){ball('eye',[side*x,y,z],[.028,.033,.021],ink);ball('eye glint',[side*x-.007,y+.009,z+.018],[.006,.007,.004],cream);}};
  if(role==='cat'){
    eyes(.824,.112,.224);ball('pink nose',[0,.741,.263],[.035,.025,.023],rose);
    for(const side of [-1,1]){
      tube('cat smile',[[0,.717,.263],[side*.030,.688,.253],[side*.07,.708,.238]],.009,ink);
      const ear=ball('inner velvet ear',[side*.183,1.035,.067],[.051,.103,.019],rose);ear.rotation.z=-side*.12;
      for(const y of [.727,.763])tube('soft whisker',[[side*.065,y,.24],[side*.18,y+.006,.227],[side*.285,y+.022,.193]],.003,cream);
    }
    const tailColor=material('cat tail coat','#29313a');
    const tail=tube('curled cat tail',[[0,.2,-.19],[.22,.16,-.3],[.40,.20,-.24],[.43,.36,-.18],[.39,.43,-.16]],.045,tailColor);plush.albedoColor=Color3.FromHexString('#687680').toLinearSpace();tail.metadata={sway:1.6,baseZ:0,amount:.045};
    tube('cat ribbon',[[-.16,.551,.20],[0,.534,.245],[.16,.551,.20]],.024,sage);ball('small cat bell',[0,.48,.254],[.034,.044,.03],gold);
  }else if(role==='bird'){
    eyes(.693,.091,.255);
    const beak=attach(MeshBuilder.CreateCylinder(`${id}-tapered beak`,{height:.12,diameterTop:.008,diameterBottom:.11,tessellation:12},scene),gold);beak.rotation.x=Math.PI/2;beak.position.set(0,.62,.31);
    ball('warm breast',[0,.39,.264],[.205,.22,.073],cream);
    for(const side of [-1,1]){
      tube('small bird foot',[[side*.10,.13,.07],[side*.10,.034,.10],[side*.15,.028,.17]],.018,wood);
      tube('bird toe',[[side*.10,.035,.10],[side*.056,.027,.18]],.012,wood);
      for(let i=0;i<3;i++){const feather=ball('layered wing feather',[side*(.255+i*.02),.40-i*.062,-.13],[.084,.139,.085],sage);feather.rotation.x=-.2-i*.1;}
    }
    tube('bird wool scarf',[[-.15,.545,.27],[0,.53,.337],[.15,.545,.27]],.037,rose);
  }else if(role==='moth'){
    eyes(.884,.106,.229);
    tube('gentle moth smile',[[-.043,.779,.248],[0,.762,.257],[.043,.779,.248]],.008,ink);
    const wingMat=material('dusty sage wings','#a2c3b2');wingMat.sheen.isEnabled=true;wingMat.sheen.intensity=.25;
    for(const side of [-1,1]){
      tube('moth antenna',[[side*.11,1.036,.03],[side*.16,1.22,.035],[side*.24,1.29,.06]],.014,wood);ball('antenna pearl',[side*.24,1.29,.06],[.029,.035,.025],gold);
      const wing=ball('upper moth wing',[side*.40,.77,-.085],[.31,.38,.065],wingMat);wing.rotation.z=-side*.42;wing.metadata={sway:2.0,baseZ:wing.rotation.z,amount:.065};
      const lower=ball('lower moth wing',[side*.345,.38,-.1],[.255,.26,.060],sage);lower.rotation.z=side*.40;lower.metadata={sway:2.0,baseZ:lower.rotation.z,amount:.045};
      const mark=ball('moth wing eye',[side*.47,.78,-.015],[.12,.14,.015],cream);mark.setParent(wing);
      const center=ball('moth wing moon',[side*.47,.78,.002],[.065,.072,.013],gold);center.setParent(wing);
      tube('moth arm',[[side*.14,.67,.04],[side*.22,.56,.13],[side*.19,.50,.20]],.029,cream);
    }
    const letter=attach(MeshBuilder.CreateBox(`${id}-blue-memory-leaf`,{width:.13,height:.17,depth:.016},scene),sage);letter.position.set(.15,.52,.225);letter.rotation.z=-.25;
  }else if(role==='seedling'){
    eyes(.827,.10,.229);tube('seedling smile',[[-.045,.72,.237],[0,.704,.251],[.045,.72,.237]],.008,ink);
    tube('sprout stem',[[0,.99,0],[.035,1.14,0],[.025,1.28,.01]],.025,wood);
    for(const side of [-1,1]){const l=ball('crown leaf',[side*.17,1.17,.014],[.19,.075,.055],sage);l.rotation.z=side*.36;tube('leaf vein',[[side*.02,1.13,.064],[side*.17,1.18,.064],[side*.31,1.22,.03]],.007,cream);}
    for(const side of [-1,1]){const l=ball('hand leaf',[side*.29,.55,.01],[.14,.067,.085],sage);l.rotation.z=-side*.30;}
    for(let i=0;i<5;i++)tube('trunk soft grain',[[Math.sin(i*1.3)*.16,.2,Math.cos(i*1.3)*.17],[Math.sin(i*1.3+.12)*.19,.51,Math.cos(i*1.3+.12)*.18]],.009,wood);
    ball('soil charm',[0,.37,.212],[.065,.079,.032],gold);
  }else if(role==='ghost'){
    eyes(1.073,.075,.222);const moon=ball('ghost moon brooch',[0,.79,.234],[.037,.055,.022],gold);moon.rotation.z=.35;
    for(const side of [-1,1])tube('ghost embroidered seam',[[side*.15,1.18,.152],[side*.22,1.00,.162],[side*.22,.68,.19],[side*.26,.36,.135]],.012,sage);
    plush.subSurface.isTranslucencyEnabled=true;plush.subSurface.translucencyIntensity=.3;
  }else if(role==='portrait'){
    const velvet=material('portrait velvet','#667885'),dress=material('princess sage silk','#88a695'),hair=material('chestnut hair','#825e48');
    const back=attach(MeshBuilder.CreateBox(`${id}-portrait backing`,{width:1.15,height:1.64,depth:.11},scene),velvet);back.position.set(0,.87,-.20);
    for(const side of [-1,1]){
      const frame=attach(MeshBuilder.CreateBox(`${id}-carved frame upright`,{width:.095,height:1.77,depth:.17},scene),gold);frame.position.set(side*.60,.87,-.135);
      ball('princess curled hair',[side*.192,1.16,.026],[.10,.26,.115],hair);
    }
    for(const y of [.005,1.735]){const frame=attach(MeshBuilder.CreateBox(`${id}-carved frame rail`,{width:1.29,height:.095,depth:.17},scene),gold);frame.position.set(0,y,-.135);}
    ball('princess dress',[0,.55,.068],[.287,.38,.13],dress);
    eyes(1.19,.080,.204);tube('portrait smile',[[-.034,1.086,.213],[0,1.072,.22],[.034,1.086,.213]],.007,rose);
    ball('princess hair crown',[0,1.37,-.018],[.22,.086,.16],hair);
    for(const x of [-.12,0,.12])ball('small crown petals',[x,1.444-Math.abs(x)*.25,.055],[.038,.075,.025],gold);
    for(const side of [-1,1])for(const y of [.15,1.59])ball('frame acorn carving',[side*.59,y,-.026],[.057,.072,.026],wood);
    ball('portrait necklace',[0,.94,.162],[.032,.04,.017],gold);
  }
  // Facial accessories remain aligned with continuous skin. These residents
  // respond through one visual body pivot; the painted wall frame stays fixed.
  for(const mesh of root.getChildMeshes()){
    mesh.computeWorldMatrix(true);const min=mesh.getBoundingInfo().boundingBox.minimumWorld.y;
    if(min>(role==='portrait'?1.05:role==='bird'?.6:.73)&&!/sculpt|body|cloak|relief|frame|backing|wing/.test(mesh.name))mesh.setParent(head);
  }
  head.metadata={continuousSkin:true};
  addResidentLife(scene,root,head,seed);
  root.onDisposeObservable.add(()=>owned.forEach(m=>m.dispose()));
  return root;
}
