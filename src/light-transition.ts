import type {Light} from '@babylonjs/core';
export function setLightEnabled(light:Light,on:boolean){if(light.isEnabled(false)!==on)light.setEnabled(on);}
/** Fixed fixtures never slide through walls: fade out, bind once, then fade in.
 * A stable fixture only changes intensity. Rebinding includedOnlyMeshes every
 * frame makes Babylon rescan the scene and recursively wrap its array hooks. */
export function transitionLight(light:Light){let current='',level=0;return(id:string,power:number,dt:number,place:()=>void)=>{const gain=1-Math.exp(-Math.min(.1,dt)*12);if(id!==current){level+=(0-level)*gain;if(level<.025){current=id;level=0;place();}}else{level+=(1-level)*gain;}light.intensity=power*level;setLightEnabled(light,!!current&&power*level>.005);};}
