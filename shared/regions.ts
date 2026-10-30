import type { DogRole } from './save';
export interface TravelProposal { id:number;from:string;to:string;method:'map'|'walk'|'fly';proposer:DogRole;expiresAt:number;connectionId?:string }
export interface RegionProgress { discoveredRegions:string[];broomOwned:boolean }
export function validateRegionProgress(value:unknown):asserts value is RegionProgress {
 const v=value as RegionProgress;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['discoveredRegions','broomOwned'].includes(k))||typeof v.broomOwned!=='boolean'||!Array.isArray(v.discoveredRegions)||v.discoveredRegions.length>64||!v.discoveredRegions.every(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id))||new Set(v.discoveredRegions).size!==v.discoveredRegions.length)throw new Error('区域发现或扫帚记录损坏');
}
