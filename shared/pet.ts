import type {DogRole} from './save';
export const PET_ID='hashiha' as const;
export const PET_HOME='player-home-villa';
// Quiet lawn beside the living-room side, clear of entrances, uses and sculpture route.
export const PET_NEST={x:-22,y:.26,z:8};
export type PetIntent={id:typeof PET_ID;mode:'home'|'follow';owner:DogRole;revision:number;anchor?:{regionId:string;x:number;y:number;z:number}};
export type PetCommand={kind:'home'|'follow';revision:number};
export type PetState=PetIntent&{regionId:string;x:number;y:number;z:number;yaw:number;speed:number;pose:'idle'|'walk'|'trot'|'sit'|'lie';waiting:'none'|'flight'|'path';relocations:number};
export function validPetIntent(v:unknown):v is PetIntent {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const p=v as PetIntent;
 return p.id===PET_ID&&['home','follow'].includes(p.mode)&&['gold','white'].includes(p.owner)&&Number.isSafeInteger(p.revision)&&p.revision>=0&&p.revision<1e9&&(!p.anchor||typeof p.anchor.regionId==='string'&&/^[a-z0-9-]{1,100}$/.test(p.anchor.regionId)&&[p.anchor.x,p.anchor.y,p.anchor.z].every(n=>Number.isFinite(n)&&Math.abs(n)<2000));
}
export function petIntent(v?:unknown):PetIntent {return validPetIntent(v)?{id:PET_ID,mode:v.mode,owner:v.owner,revision:v.revision,...(v.anchor?{anchor:{...v.anchor}}:{})}:{id:PET_ID,mode:'home',owner:'gold',revision:0};}
export function validPetCommand(v:unknown):v is PetCommand {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as PetCommand;
 return Object.keys(c).every(k=>['kind','revision'].includes(k))&&['home','follow'].includes(c.kind)&&Number.isSafeInteger(c.revision)&&c.revision>=0&&c.revision<1e9;
}
export function validPetState(v:unknown):v is PetState {
 if(!validPetIntent(v))return false;const p=v as PetState;
 return typeof p.regionId==='string'&&/^[a-z0-9-]{1,100}$/.test(p.regionId)&&[p.x,p.y,p.z,p.yaw,p.speed].every(n=>Number.isFinite(n)&&Math.abs(n)<2000)&&p.speed>=0&&p.speed<=8&&['idle','walk','trot','sit','lie'].includes(p.pose)&&['none','flight','path'].includes(p.waiting)&&Number.isSafeInteger(p.relocations)&&p.relocations>=0;
}
