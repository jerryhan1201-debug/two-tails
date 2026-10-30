export interface InputStamp {epoch:number;seq:number}
export interface InputAck extends InputStamp {applied:number}
export type InputAcks=Partial<Record<'gold'|'white',InputAck>>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const validInputStamp=(v:unknown):v is InputStamp=>object(v)&&Object.keys(v).length===2&&Number.isInteger(v.epoch)&&Number(v.epoch)>=0&&Number(v.epoch)<=0xffffffff&&Number.isInteger(v.seq)&&Number(v.seq)>0&&Number(v.seq)<=0x7fffffff;
export function validInputAcks(v:unknown):v is InputAcks{return object(v)&&Object.keys(v).every(role=>['gold','white'].includes(role)&&object(v[role])&&Object.keys(v[role]).length===3&&validInputStamp({epoch:v[role].epoch,seq:v[role].seq})&&typeof v[role].applied==='number'&&Number.isFinite(v[role].applied)&&v[role].applied>=0&&v[role].applied<=1.5);}
