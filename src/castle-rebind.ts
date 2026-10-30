import map from '../source-assets/environment/v15/castle/semantic-map.json';
import interactions from '../source-assets/environment/v15/castle/interactions.json';
import type{Chapter,Point}from'./content';
export const CASTLE_MAP=map;
export const castleAnchor=(id:string)=>interactions.items.find(i=>i.id===id)?.position??map.entries.find(e=>e.oldId===id)?.newPosition;
/** Spatial-only migration. Stable IDs, prose, order, flags and rewards stay intact. */
export function rebindCastle(ch:Chapter){
 const p=(a:number[]):Point=>({x:a[0],y:a[1],z:a[2]});ch.spawn=p(map.newSpawn);ch.camp=p(map.newCamp);ch.exit=p(map.newExit);ch.terrain={};
 for(const item of [...ch.landmarks,...ch.encounters,...ch.interactions,...ch.secrets,...ch.event.spawns]){const at=castleAnchor(item.id);if(at)Object.assign(item,at);}
 ch.event.trigger={...ch.event.trigger,...castleAnchor(ch.event.id)};
 const paths:Record<string,[number,number][]>={'c-gallery':[[0,-10],[0,24],[0,37],[0,46],[-10.5,46],[-10.5,60],[0,65],[0,96]],'c-library-pass':[[-28.75,19.8],[-28.75,35],[-29.5,70],[-29.5,88]],'c-balcony-pass':[[0,89],[14,91]],'c-orrery-ring':[[0,89],[10,95],[0,101],[-10,95],[0,89]]};for(const path of ch.paths)if(paths[path.id])path.points=paths[path.id];
}
