import type{JsonObject}from'../shared/save';
type Pending={input:JsonObject;at:number;replaceable:boolean};
/** Ordered bounded input outbox. Continuous movement coalesces; stops/actions never do. */
export class InputOutbox {
 private pending:Pending[]=[];private wasMoving=false;
 offer(input:JsonObject,now:number){const moving=Math.hypot(Number(input.x)||0,Number(input.z)||0)>.001||Math.abs(Number(input.lift)||0)>.001,stop=this.wasMoving&&!moving;this.wasMoving=moving;
  const actions=Array.isArray(input.actions)?[...input.actions]:[],important=stop||actions.length>0||Object.keys(input).some(k=>!['x','z','sprint','lift','actions'].includes(k));
  const item={input:{...input,actions},at:now,replaceable:!important},last=this.pending.at(-1);
  if(last?.replaceable)this.pending[this.pending.length-1]=item;
  else{if(this.pending.length>=12)return false;this.pending.push(item);}return true;
 }
 peek(){return this.pending[0];}
 shift(){this.pending.shift();}
 clear(){this.pending=[];this.wasMoving=false;}
 get length(){return this.pending.length;}
}
