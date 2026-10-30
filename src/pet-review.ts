import {petAppearance} from './pet-appearance';
import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,DirectionalLight,Color3,MeshBuilder,PBRMaterial,SceneLoader,ShadowGenerator} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,engine=new Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);
scene.clearColor.set(.64,.70,.68,1);scene.imageProcessingConfiguration.exposure=1;scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=3;
const camera=new ArcRotateCamera('review',Math.PI/2,1.38,3.6,new Vector3(0,.77,0),scene);camera.attachControl(canvas,true);camera.minZ=.02;camera.lowerRadiusLimit=1.7;camera.upperRadiusLimit=8;
const fill=new HemisphericLight('sky',Vector3.Up(),scene);fill.intensity=.85;fill.diffuse=new Color3(.91,.95,1);fill.groundColor=new Color3(.36,.34,.30);
const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.6),scene);sun.position.set(3,6,-4);sun.intensity=2;sun.diffuse=new Color3(1,.94,.84);
const ground=MeshBuilder.CreateGround('ordinary ground',{width:100,height:100},scene);const mat=new PBRMaterial('ground',scene);mat.albedoColor=new Color3(.44,.51,.43);mat.roughness=1;ground.material=mat;ground.receiveShadows=true;
const shadow=new ShadowGenerator(1024,sun);shadow.useBlurExponentialShadowMap=true;shadow.blurKernel=16;shadow.bias=.001;
const asset=await SceneLoader.ImportMeshAsync('',petAppearance().rootUrl,petAppearance().file,scene);for(const mesh of asset.meshes){mesh.receiveShadows=true;shadow.addShadowCaster(mesh);}
const groups=asset.animationGroups;groups.forEach(g=>g.stop());const select=(name:string)=>{groups.forEach(g=>g.stop());groups.find(g=>g.name===name)?.start(true);document.querySelector('#status')!.textContent=name;};
for(const group of groups){const button=document.createElement('button');button.textContent=group.name;button.onclick=()=>select(group.name);document.querySelector('#clips')!.appendChild(button);}
select('idle');(window as any).petReview={scene,camera,asset,select};engine.runRenderLoop(()=>scene.render());window.addEventListener('resize',()=>engine.resize());
