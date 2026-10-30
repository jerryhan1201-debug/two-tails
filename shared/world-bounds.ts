export type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
export const ORIGINAL_BOUNDS:Bounds={minX:-40,maxX:40,minZ:-20,maxZ:112};
export const VILLA_SITE_BOUNDS:Bounds={minX:-96,maxX:102,minZ:-91,maxZ:106};
export const MUSHROOM_FOREST_BOUNDS:Bounds={minX:-160,maxX:160,minZ:-20,maxZ:603};
export const OUTDOOR_BOUNDS:Record<string,Bounds>={
 'studio-undersea-atlantis':{minX:-64,maxX:64,minZ:-66,maxZ:112},
 'studio-manhattan':{minX:-57,maxX:57,minZ:-41,maxZ:153},
 'studio-europe-town':{minX:-35,maxX:38,minZ:-16,maxZ:60},
 'ch05-candle-castle':{minX:-46,maxX:42,minZ:-22,maxZ:109},
 'studio-tideglass-cove':{minX:-58,maxX:58,minZ:-30,maxZ:65},
 'studio-winter-lantern':{minX:-100,maxX:100,minZ:-30,maxZ:290},
 'ch01-lantern-village':{minX:-66,maxX:66,minZ:-32,maxZ:145},
 'ch02-windmill-river':{minX:-62,maxX:62,minZ:-30,maxZ:145},
 'ch03-wandering-woods':{minX:-68,maxX:68,minZ:-32,maxZ:148},
 'canopy-garden':{minX:-56,maxX:56,minZ:-24,maxZ:130},
};
export const chapterBounds=(id:string)=>OUTDOOR_BOUNDS[id]??ORIGINAL_BOUNDS;
export const liveRegionBounds=(id:string)=>id==='player-home-villa'?VILLA_SITE_BOUNDS:id==='mushroom-grove'?MUSHROOM_FOREST_BOUNDS:chapterBounds(id);
/** Live room updates use the same limits as movement; legacy saves still migrate normally. */
export function withinLiveBounds(id:string,p:{x:number;z:number;safeX?:number;safeZ?:number}){
 const b=liveRegionBounds(id),inside=(x:number,z:number)=>x>=b.minX-.1&&x<=b.maxX+.1&&z>=b.minZ-.1&&z<=b.maxZ+.1;
 return inside(p.x,p.z)&&(p.safeX===undefined||p.safeZ===undefined||inside(p.safeX,p.safeZ));
}
