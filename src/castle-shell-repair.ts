import {MeshBuilder,Vector3} from '@babylonjs/core';import type {World} from './world';
/** Close the exported stair excavation and the seven-metre unroofed crossway.
 * Door openings to the two stairs and secret room remain at their original widths. */
import {CASTLE_SHELL_BODIES} from './castle-shell-layout';
export function repairCastleShell(w:World){
 const stone=w.surfaces.surface('masonry','#aea392');stone.roughness=.91;
 const meshes=CASTLE_SHELL_BODIES.map(o=>{const m=MeshBuilder.CreateBox(o.id,{width:o.size[0],height:o.size[1],depth:o.size[2]},w.scene);m.parent=w.root;m.position=Vector3.FromArray(o.center);m.material=stone;m.receiveShadows=true;m.isPickable=true;m.metadata={studio:true,studioRole:o.kind,studioZone:'passage',cameraObstacle:true,castleShellRepair:true};return m;});
 return {dispose(){meshes.forEach(m=>m.dispose());}};
}
