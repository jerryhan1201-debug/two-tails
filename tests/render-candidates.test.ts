import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,FreeCamera,Vector3,MeshBuilder,TransformNode,Skeleton,Bone,Matrix,ActionManager,Mesh,MorphTargetManager} from '@babylonjs/core';
import {installRenderCandidates} from '../src/render-candidates';

function fixture(){const engine=new NullEngine(),scene=new Scene(engine),camera=new FreeCamera('camera',new Vector3(0,2,-10),scene);camera.setTarget(new Vector3(0,2,0));scene.activeCamera=camera;scene.updateTransformMatrix(true);return {engine,scene,camera};}
const ids=(scene:Scene)=>scene.getActiveMeshes().data.slice(0,scene.getActiveMeshes().length).map(m=>m.uniqueId).sort((a,b)=>a-b);
test('same visible selection during turns, parent toggles, late loads and disposals; frozen instance sources remain eligible',()=>{
 const {engine,scene,camera}=fixture();try{
  const root=new TransformNode('region',scene),meshes=[];
  for(let i=0;i<64;i++){const m=MeshBuilder.CreateBox('static '+i,{},scene);m.parent=root;m.position.set((i%8-4)*4,2,Math.floor(i/8)*4);m.freezeWorldMatrix();meshes.push(m);}
  const source=MeshBuilder.CreateBox('instance source',{},scene);source.position.set(100,0,0);source.freezeWorldMatrix();const instance=source.createInstance('instance');instance.position.set(0,2,1);instance.computeWorldMatrix(true);
  const ordinary=scene.getActiveMeshCandidates;installRenderCandidates(scene);const reduced=scene.getActiveMeshCandidates;installRenderCandidates(scene);assert.equal(scene.getActiveMeshCandidates,reduced);
  const compare=()=>{scene.updateTransformMatrix(true);scene.getActiveMeshCandidates=ordinary;scene.render();const before=ids(scene);scene.getActiveMeshCandidates=reduced;scene.render();assert.deepEqual(ids(scene),before);assert(reduced().data.includes(source));};
  compare();assert(reduced().length<scene.meshes.length);
  camera.setTarget(new Vector3(25,2,12));compare();root.setEnabled(false);compare();assert(!reduced().data.includes(meshes[0]));root.setEnabled(true);compare();
  const late=MeshBuilder.CreateBox('late',{},scene);late.position.set(8,2,0);late.freezeWorldMatrix();compare();late.dispose();compare();assert(!reduced().data.includes(late));
 }finally{scene.dispose();engine.dispose();}
});
test('rigs, unfrozen movers, animation/LOD/intersection special cases use normal evaluation',()=>{
 const {engine,scene}=fixture();try{
  const mover=MeshBuilder.CreateBox('mover',{},scene);mover.position.x=100;mover.computeWorldMatrix(true);
  const rig=MeshBuilder.CreateBox('rig',{},scene);rig.position.x=100;rig.freezeWorldMatrix();rig.skeleton=new Skeleton('rig','rig',scene);new Bone('bone',rig.skeleton,null,Matrix.Identity());
  const action=MeshBuilder.CreateBox('action',{},scene);action.position.x=100;action.freezeWorldMatrix();action.actionManager=new ActionManager(scene);
  const morph=MeshBuilder.CreateBox('morph',{},scene);morph.position.x=100;morph.freezeWorldMatrix();morph.morphTargetManager=new MorphTargetManager(scene);
  const bill=MeshBuilder.CreateBox('billboard',{},scene);bill.position.x=100;bill.billboardMode=Mesh.BILLBOARDMODE_ALL;bill.freezeWorldMatrix();
  const forced=MeshBuilder.CreateBox('always',{},scene);forced.position.x=100;forced.freezeWorldMatrix();forced.alwaysSelectAsActiveMesh=true;
  const plain=MeshBuilder.CreateBox('plain',{},scene);plain.position.x=100;plain.freezeWorldMatrix();
  installRenderCandidates(scene);let list=scene.getActiveMeshCandidates().data;for(const mesh of [mover,rig,action,morph,bill,forced])assert(list.includes(mesh));assert(!list.includes(plain));
  plain.unfreezeWorldMatrix();assert(scene.getActiveMeshCandidates().data.includes(plain));plain.freezeWorldMatrix();scene.skipFrustumClipping=true;assert(scene.getActiveMeshCandidates().data.includes(plain));scene.skipFrustumClipping=false;
  scene.customLODSelector=mesh=>mesh;assert(scene.getActiveMeshCandidates().data.includes(plain));mover.setEnabled(false);assert(!scene.getActiveMeshCandidates().data.includes(mover));
 }finally{scene.dispose();engine.dispose();}
});
