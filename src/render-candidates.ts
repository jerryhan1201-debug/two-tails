import {Mesh,type AbstractMesh,type Scene} from '@babylonjs/core';

const installed=new WeakSet<Scene>();
/** Keep Babylon's order and final selection, but avoid material/LOD preparation
 * for disabled worlds and already-frozen scenery outside the camera frustum.
 * Moving/rigged meshes and instance sources always retain the normal path.
 * Reading the current scene each time also covers late loads, disposals and
 * parent enable changes without a second visibility cache to invalidate. */
export function installRenderCandidates(scene:Scene){
 if(installed.has(scene))return;installed.add(scene);
 const candidates:{data:AbstractMesh[];length:number}={data:[],length:0};
 scene.getActiveMeshCandidates=()=>{
  let count=0;
  const clipStatic=!scene.skipFrustumClipping&&!scene.customLODSelector;
  for(const mesh of scene.meshes){
   if(mesh.isBlocked||!mesh.isEnabled())continue;
   if(clipStatic&&mesh.isWorldMatrixFrozen&&!mesh.alwaysSelectAsActiveMesh
    &&!mesh.skeleton&&!mesh.morphTargetManager&&!mesh.bakedVertexAnimationManager
    &&!mesh.actionManager&&!mesh.billboardMode&&!mesh.infiniteDistance&&!mesh.animations.length
    &&!(mesh instanceof Mesh&&mesh.instances.length)&&!mesh.isInFrustum(scene.frustumPlanes))continue;
   candidates.data[count++]=mesh;
  }
  candidates.data.length=count;candidates.length=count;
  return candidates;
 };
 scene.onDisposeObservable.addOnce(()=>{candidates.data.length=0;candidates.length=0;});
}
