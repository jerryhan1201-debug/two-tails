import {liveRegionBounds} from '../shared/world-bounds';
export {UNDERSEA} from '../shared/undersea';
import {UNDERSEA,underseaArrival} from '../shared/undersea';
/** Installed studio releases. IDs are permanent save keys; no draft/undersea entry here. */
export const CASTLE='ch05-candle-castle',BEACH='studio-tideglass-cove',SNOW='studio-winter-lantern',TOWN='studio-europe-town',CITY='studio-manhattan';
export const STUDIO_RELEASES:Record<string,{key:string;version:string;bounds:{minX:number;maxX:number;minZ:number;maxZ:number};spawn:{x:number;y:number;z:number}}>={
 [UNDERSEA]:{key:'undersea',version:'UNDERSEA-ATLANTIS-20261013-ROUTE07-SEABED-CITY',bounds:liveRegionBounds(UNDERSEA),spawn:underseaArrival},
 [CITY]:{key:'manhattan',version:'MANHATTAN-20261013-BLOCK05-EXPANDED-CROSSING',bounds:liveRegionBounds(CITY),spawn:{x:0,y:0,z:-32}},
 [TOWN]:{key:'europe-town',version:'EUROPE-TOWN-20261013-BLOCK03-MATERIAL',bounds:liveRegionBounds(TOWN),spawn:{x:14,y:0,z:-10}},
 [SNOW]:{key:'snow',version:'SNOW-LANTERN-20261012-RC2',bounds:liveRegionBounds(SNOW),spawn:{x:0,y:1.417830348,z:-20}},
 [BEACH]:{key:'beach',version:'BEACH-COVE-20261015-RC3-SWIM-BASIN',bounds:liveRegionBounds(BEACH),spawn:{x:0,y:1.202,z:-21}},
 [CASTLE]:{key:'castle',version:'CASTLE-HALLOWEEN-20261011-RC2',bounds:liveRegionBounds(CASTLE),spawn:{x:0,y:0,z:-10}},
};
export const studioRelease=(id:string)=>STUDIO_RELEASES[id];
export const studioAssetBase=(id:string)=>'/assets/maps/'+(id===TOWN||id===CITY||id===UNDERSEA||id===BEACH?'v19/':'v15/')+studioRelease(id).key+'/';

export function studioCabinAt(p:{x:number;y:number;z:number},margin=0){return p.x>=36.2-margin&&p.x<=59.8+margin&&p.y>=3.9&&p.y<=15.2&&p.z>=138.2-margin&&p.z<=159.8+margin;}
