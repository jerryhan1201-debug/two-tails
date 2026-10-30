import {isHomePetId} from './home-pets';
import type {DogRole} from './save';
export const ANIMAL_SPECIES=['hashiha','kangaroo','koala','malamute','golden-retriever','sea-turtle','badger','frog','mouse','cat','bird','moth','wolf','bat','dragon'] as const;
export type AnimalSpecies=typeof ANIMAL_SPECIES[number];
export type AnimalCommand={id:string;kind:'greet'|'pet'|'play'|'follow'|'stay'|'home';revision?:number};
export type AnimalReaction={id:string;species:AnimalSpecies;role:DogRole;kind:'greet'|'pet'|'play';serial:number;start:number;until:number;x:number;y:number;z:number;yaw:number};
export type AnimalCare={regionId:string;delays:Record<string,number>;reactions:AnimalReaction[]};
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-z0-9][a-z0-9:._-]{0,95}$/.test(v);
export function validAnimalCommand(v:unknown):v is AnimalCommand{return obj(v)&&Object.keys(v).every(k=>['id','kind','revision'].includes(k))&&id(v.id)&&(['greet','pet','play'].includes(v.kind)&&v.revision===undefined||(v.id==='golden-retriever'&&['follow','stay'].includes(v.kind)||isHomePetId(v.id)&&['follow','stay','home'].includes(v.kind))&&Number.isSafeInteger(v.revision)&&v.revision>=0);}
export function validAnimalCare(v:unknown):v is AnimalCare{
 return obj(v)&&Object.keys(v).every(k=>['regionId','delays','reactions'].includes(k))&&id(v.regionId)&&obj(v.delays)&&Object.keys(v.delays).length<=8&&Object.entries(v.delays).every(([k,n])=>['kangaroo','koala','malamute','golden-retriever','sea-turtle','home-kangaroo','home-koala','home-sea-turtle'].includes(k)&&Number.isFinite(n)&&n>=0&&n<120)&&Array.isArray(v.reactions)&&v.reactions.length<=2&&new Set(v.reactions.map((r:any)=>r.id)).size===v.reactions.length&&new Set(v.reactions.map((r:any)=>r.role)).size===v.reactions.length&&v.reactions.every((r:any)=>obj(r)&&Object.keys(r).every(k=>['id','species','role','kind','serial','start','until','x','y','z','yaw'].includes(k))&&id(r.id)&&ANIMAL_SPECIES.includes(r.species)&&['gold','white'].includes(r.role)&&['greet','pet','play'].includes(r.kind)&&Number.isSafeInteger(r.serial)&&r.serial>0&&['start','until','x','y','z','yaw'].every(k=>Number.isFinite(r[k]))&&r.start>=0&&r.until>r.start&&r.until-r.start<=8);
}
export const ANIMAL_NAMES:Record<AnimalSpecies,string>={hashiha:'哈士哈',kangaroo:'大袋鼠',koala:'考拉',malamute:'阿拉斯加犬','golden-retriever':'金毛','sea-turtle':'大海龟',badger:'獾居民',frog:'青蛙居民',mouse:'小鼠居民',cat:'猫居民',bird:'小鸟',moth:'蛾',wolf:'林狼',bat:'蝙蝠',dragon:'星辉龙'};
