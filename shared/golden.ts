import {validPetIntent,validPetState,type PetIntent,type PetState} from './pet';
export type GoldenIntent=Omit<PetIntent,'id'>&{id:'golden-retriever';anchor?:{regionId:string;x:number;y:number;z:number}};
export type GoldenState=Omit<PetState,'id'>&GoldenIntent;
export function validGoldenIntent(v:unknown):v is GoldenIntent {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const p=v as GoldenIntent;
 return p.id==='golden-retriever'&&validPetIntent({...p,id:'hashiha'})&&(!p.anchor||typeof p.anchor.regionId==='string'&&/^[a-z0-9-]{1,100}$/.test(p.anchor.regionId)&&[p.anchor.x,p.anchor.y,p.anchor.z].every(n=>Number.isFinite(n)&&Math.abs(n)<2000));
}
export function goldenIntent(v?:unknown):GoldenIntent {return validGoldenIntent(v)?{id:v.id,mode:v.mode,owner:v.owner,revision:v.revision,...(v.anchor?{anchor:{...v.anchor}}:{})}:{id:'golden-retriever',mode:'home',owner:'gold',revision:0};}
export function validGoldenState(v:unknown):v is GoldenState{return validGoldenIntent(v)&&validPetState({...v,id:'hashiha'});}
