export function renderDensity(width:number,height:number,dpr:number,quality:string){
 const cap=quality==='high'?2:quality==='low'?1:1.5;
 const budget=quality==='high'?4_200_000:quality==='low'?1_400_000:2_700_000;
 return Math.min(Math.max(.5,dpr),cap,Math.sqrt(budget/Math.max(1,width*height)),3200/Math.max(1,width),2200/Math.max(1,height));
}
/** Four-second samples, a warm-up and hysteresis keep loading from blurring a session. */
export class AutoResolution {
 density=1;target=1;private low=0;private high=0;private cooldown=12;
 reset(target:number){this.target=target;this.density=target;this.low=this.high=0;this.cooldown=12;}
 warmup(){this.low=this.high=0;this.cooldown=12;}
 sample(fps:number,seconds:number,active:boolean){
  this.cooldown=Math.max(0,this.cooldown-seconds);
  if(!active||!Number.isFinite(fps)||fps<1||this.cooldown>0){this.low=this.high=0;return false;}
  this.low=fps<32?this.low+1:0;this.high=fps>52?this.high+1:0;
  const before=this.density,floor=Math.min(this.target,.85);
  if(this.low>=2){this.density=Math.max(floor,this.density-.12);this.low=0;this.cooldown=8;}
  if(this.high>=3){this.density=Math.min(this.target,this.density+.10);this.high=0;this.cooldown=12;}
  return Math.abs(before-this.density)>.001;
 }
}

export type RenderTier='low'|'medium'|'high';
/** Sustained frame-time windows, never a loading frame or network round-trip. */
export class AutoQuality {
 tier:RenderTier;private frames:number[]=[];private cooldown=12;private slow=0;private fast=0;
 constructor(private limited=false){this.tier=limited?'low':'medium';}
 warmup(){this.frames=[];this.slow=this.fast=0;this.cooldown=Math.max(12,this.cooldown);}
 observe(ms:number,active:boolean){if(!active){this.warmup();return;}if(Number.isFinite(ms)&&ms>0){this.frames.push(ms);if(this.frames.length>240)this.frames.shift();}}
 sample(seconds:number){this.cooldown=Math.max(0,this.cooldown-seconds);const a=this.frames.sort((x,y)=>x-y);this.frames=[];const p95=a[Math.floor(a.length*.95)]??0;if(a.length<40||this.cooldown>0)return{changed:false,p95};
  this.slow=p95>36?this.slow+1:0;this.fast=p95<18.5?this.fast+1:0;const before=this.tier,levels:RenderTier[]=['low','medium','high'];let index=levels.indexOf(this.tier);
  if(this.slow>=2&&index>0)index--;else if(this.fast>=4&&index<(this.limited?1:2))index++;
  this.tier=levels[index];if(this.tier!==before){this.slow=this.fast=0;this.cooldown=24;}return{changed:this.tier!==before,p95};
 }
}
