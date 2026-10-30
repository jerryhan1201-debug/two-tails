import type {DogRole} from './save';
export type DuoKind='ride'|'cuddle';
export type DuoCommand={kind:'invite';type:DuoKind}|{kind:'accept'|'reject'|'cancel';id:number};
export interface DuoPoint{x:number;y:number;z:number;yaw:number}
export interface DuoState{id:number;type:DuoKind;phase:'invited'|'active';proposer:DogRole;regionId:string;expiresAt:number;startedAt:number;origin:Record<DogRole,DuoPoint>;anchor:DuoPoint}
export const DUO_RIDE={radius:1.12,height:4.05,seatY:1.28,seatBack:.32,sprint:5.3};
/** The home region includes its courtyard, rooms and surrounding woodland. */
export const rideAllowedInRegion=(regionId:string)=>regionId!=='player-home-villa';
export function validDuoCommand(v:unknown):v is DuoCommand{const a=v as DuoCommand;return !!a&&typeof a==='object'&&!Array.isArray(a)&&(a.kind==='invite'?['ride','cuddle'].includes(a.type)&&Object.keys(a).every(k=>['kind','type'].includes(k)):['accept','reject','cancel'].includes(a.kind)&&Number.isSafeInteger(a.id)&&a.id>0&&Object.keys(a).every(k=>['kind','id'].includes(k)));}
export function validateDuo(v:unknown):asserts v is DuoState{
 const d=v as DuoState,point=(p:DuoPoint)=>p&&['x','y','z','yaw'].every(k=>Number.isFinite(p[k as keyof DuoPoint]));
 if(!d||typeof d!=='object'||!Number.isSafeInteger(d.id)||d.id<1||!['ride','cuddle'].includes(d.type)||!['invited','active'].includes(d.phase)||!['white','gold'].includes(d.proposer)||typeof d.regionId!=='string'||!Number.isFinite(d.expiresAt)||!Number.isFinite(d.startedAt)||!point(d.anchor)||!point(d.origin?.gold)||!point(d.origin?.white))throw new Error('伙伴互动状态无效');
}
