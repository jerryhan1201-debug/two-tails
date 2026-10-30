import catalog from '../source-assets/environment/studio-rc1/catalog.json';
import type {WorldBounds,WorldObstacle} from './world-surfaces';
export type StudioTree={x:number;z:number;scale:number;yaw:number;species:'oak'|'birch'|'willow';seed:number};
export function studioTreeObstacles(tree:StudioTree,base:number):WorldObstacle[]{
 const c=Math.cos(tree.yaw),s=Math.sin(tree.yaw),k=tree.scale;
 return catalog[tree.species].barkBands.map(b=>({x:tree.x+(b.x*c+b.z*s)*k,z:tree.z+(-b.x*s+b.z*c)*k,r:b.r*k,bottom:base+b.bottom*k,top:base+b.top*k,walkableTop:false}));
}
export function existingStudioTree(x:number,z:number,s:number,seed:number,biome:string):StudioTree{
 return {x,z,scale:s*.51,yaw:seed,species:biome==='river'?'willow':Math.abs(Math.floor(seed))%3===1?'birch':'oak',seed};
}
const cached=new Map<string,StudioTree[]>();
/** Fixed broad patches and irregular openings, with a tapered edge, shared by both peers. */
export function woodlandLayout(regionId:string,bounds:WorldBounds,biome:string,blocked:(x:number,z:number)=>boolean):StudioTree[]{
 const existing=cached.get(regionId);if(existing)return existing;
 let seed=81071;for(const c of regionId)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const mushroom=regionId==='mushroom-grove',cap=mushroom?145:biome==='forest'?175:120,candidates:{tree:StudioTree;priority:number}[]=[];
 for(let z=bounds.minZ+4;z<bounds.maxZ-4;z+=4.8)for(let x=bounds.minX+4;x<bounds.maxX-4;x+=4.8){
   const px=x+(random()-.5)*3.8,pz=z+(random()-.5)*3.8;
   const patch=Math.sin(px*.061+pz*.012)+Math.cos(pz*.077-px*.026)+.45*Math.sin(px*.17+pz*.12);
   const clearing=Math.sin(px*.035+.7)*Math.cos(pz*.043-.5)>.55;
   if(clearing||patch<.15||random()>(patch>.85?.88:.33)||blocked(px,pz))continue;
   candidates.push({tree:{x:px,z:pz,scale:.63+random()*.40,yaw:random()*Math.PI*2,species:biome==='river'?'willow':random()<.32?'birch':'oak',seed},priority:random()});
 }
 const result:StudioTree[]=[];
 for(const {tree}of candidates.sort((a,b)=>a.priority-b.priority)){if(result.length>=cap)break;if(result.some(t=>Math.hypot(t.x-tree.x,t.z-tree.z)<3.6))continue;result.push(tree);}
 cached.set(regionId,result);return result;
}
