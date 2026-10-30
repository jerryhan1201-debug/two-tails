import type {Material,Scene}from'@babylonjs/core';
const installed=new WeakSet<Scene>();
/** This project deliberately uses at most four lights per material (some use
 * three). Babylon's glTF loader raises EVERY scene material to scene.lights.length
 * after a load, including inactive cached lights. Keep the authored budgets;
 * late pet/neighbour loads must not invalidate every existing shader. Scene-local
 * accessors preserve Babylon's actual setter for supported authored values. */
export function retainMaterialLightBudgets(scene:Scene){
 if(installed.has(scene))return;installed.add(scene);
 const guarded=new WeakSet<Material>();const guard=(material:Material)=>{if(guarded.has(material))return;if(!('maxSimultaneousLights'in material))return;let prototype=Object.getPrototypeOf(material),descriptor:PropertyDescriptor|undefined;while(prototype&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(prototype,'maxSimultaneousLights');prototype=Object.getPrototypeOf(prototype);}if(!descriptor?.get||!descriptor.set)return;const {get,set}=descriptor;guarded.add(material);if((get.call(material)??0)>4)set.call(material,4);
  Object.defineProperty(material,'maxSimultaneousLights',{configurable:true,get(){return get.call(material);},set(value:number){if(Number.isInteger(value)&&value>=0&&value<=4)set.call(material,value);}});
 };
 for(const material of scene.materials)guard(material);
 // Babylon's material-added observable is deferred; guard synchronously so a
 // textureless GLB cannot raise budgets before that notification arrives.
 const add=scene.addMaterial.bind(scene);scene.addMaterial=(material)=>{add(material);guard(material);};
}
