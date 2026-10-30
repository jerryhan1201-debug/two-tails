/** Bounded, local-only home frame evidence. No positions, saves, messages or credentials. */
class Frames {
 private first:number[]=[];private recent=new Float32Array(600);private cursor=0;
 count=0;totalMs=0;maxMs=0;over33=0;over50=0;over100=0;
 add(ms:number){if(this.first.length<600)this.first.push(ms);this.recent[this.cursor++%600]=ms;this.count++;this.totalMs+=ms;this.maxMs=Math.max(this.maxMs,ms);if(ms>33.4)this.over33++;if(ms>50)this.over50++;if(ms>100)this.over100++;}
 snapshot(){const summary=(values:number[])=>{const a=values.sort((a,b)=>a-b);return{samples:a.length,p50:a[Math.floor((a.length-1)*.5)]??0,p95:a[Math.floor((a.length-1)*.95)]??0,p99:a[Math.floor((a.length-1)*.99)]??0,max:a.at(-1)??0};};return{count:this.count,totalMs:this.totalMs,maxMs:this.maxMs,over33:this.over33,over50:this.over50,over100:this.over100,first600:summary([...this.first]),recent600:summary(Array.from(this.recent.subarray(0,Math.min(this.count,600))))};}
}
export class HomeFrameDiagnostics {
 private groups=new Map<string,Frames>();private inHome=false;private visits=0;private previousAt=0;private previousKey='';private previousBlocked=false;
 observe(now:number,region:string,active:boolean,mounted:boolean,moving:boolean,blocked:'loading'|'menu'|'background'|''=''){
  const home=region==='player-home-villa';if(home&&!this.inHome)this.visits++;this.inHome=home;
  const mode=blocked||(active?(mounted?'broom':moving?'walk':'idle'):'');
  const key=home&&mode?(this.visits===1?'first-visit':'return-visits')+'/'+mode:'';
  const ms=now-this.previousAt;if(this.previousKey&&(key===this.previousKey||this.previousBlocked)&&Number.isFinite(ms)&&ms>0){let group=this.groups.get(this.previousKey);if(!group){group=new Frames();this.groups.set(this.previousKey,group);}group.add(ms);}
  this.previousAt=now;this.previousKey=key;this.previousBlocked=!!blocked;
 }
 snapshot(){return{scope:'Local evidence only. Loading/preparation, menus and background intervals have separate groups; normal gameplay excludes them and mode transitions. First and recent 600 intervals retained per group; lifetime counters remain bounded.',visits:this.visits,groups:Object.fromEntries([...this.groups].map(([key,v])=>[key,v.snapshot()]))};}
}
