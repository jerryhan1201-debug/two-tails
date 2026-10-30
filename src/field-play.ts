import {STUDIO_HOOKS}from'../shared/studio-field';
import {chainFollowup} from '../shared/field-chains';
import {FIELD_NODES,FIELD_ROUTES,HIDE_BOUNDS,fieldContent,fieldHidesPartner,fieldNodes,validFieldCommand,type FieldCommand,type FieldNode,type FieldPlay,type FieldPoint,type FieldRole} from '../shared/fieldbook';
import type {Snapshot} from './simulation';
import type {MovementWorld} from './movement';
import {clearDuoPath} from './duo-interactions';
import {homePathDistance} from './villa-site';
import {regionGroundHeight} from './regions';

export interface FieldContext {s:Snapshot;world:MovementWorld;solo:boolean;role:FieldRole;blocked:(r:FieldRole)=>boolean;emit:(type:string,x:number,z:number,text:string)=>void}
const other=(r:FieldRole):FieldRole=>r==='gold'?'white':'gold';
const name=(r:FieldRole)=>r==='gold'?'小鸡毛':'小白';
export function clearFieldPath(world:MovementWorld,p:FieldPoint,n:{x:number;z:number},y:number){const distance=Math.hypot(p.x-n.x,p.z-n.z)||1,t=Math.max(0,(distance-.85)/distance);return clearDuoPath(world,p,{x:p.x+(n.x-p.x)*t,y:p.y+(y-p.y)*t,z:p.z+(n.z-p.z)*t},.08,.35);}
export function fieldReachable(c:Pick<FieldContext,'world'>&{s:Pick<Snapshot,'players'|'regionId'>},r:FieldRole,n:FieldNode,radius=3.2){
 const p=c.s.players[r],y=n.y??regionGroundHeight(n.regionId,n.x,n.z);
 return c.s.regionId===n.regionId&&p.hp>0&&p.grounded&&!p.mounted&&Math.abs(p.y-y)<.5&&Math.hypot(p.x-n.x,p.z-n.z)<radius&&clearFieldPath(c.world,p,n,y);
}
const message=(c:FieldContext,r:FieldRole,text:string)=>{const p=c.s.players[r];c.emit('field-message',p.x,p.z,text);};
function discovered(c:FieldContext,id:string){const b=c.s.fieldbook;if(!b.found.includes(id)){b.found.push(id);b.revision++;}}
function complete(c:FieldContext,id:string){
 discovered(c,id);const b=c.s.fieldbook,item=fieldContent(id);if(b.completed.includes(id))return false;
 b.completed.push(id);b.revision++;const n=FIELD_NODES.find(n=>n.contentId===id)!;
 c.emit('discover',n.x,n.z,item.ending+' '+chainFollowup(id,b)+' · 纪念品「'+item.souvenir+'」已写进手记。');return true;
}
const setStep=(c:FieldContext,key:string,n:number)=>{if(c.s.fieldbook.steps[key]!==n){c.s.fieldbook.steps[key]=n;c.s.fieldbook.revision++;}};
export function useFieldNode(c:FieldContext,r:FieldRole,n:FieldNode){
 if(!fieldReachable(c,r,n)||c.blocked(r)||c.s.story?.active||c.s.travel||c.s.duo)return;
 const b=c.s.fieldbook,id=n.contentId,content=fieldContent(id),step=b.steps[id]??0;
 if(content.kind==='flight'||content.kind==='game'){
  if(n.index===0){commandField(c,r,{kind:'start',siteId:id,solo:c.solo});return;}
  const a=c.s.fieldPlay;if(!a||a.siteId!==id||a.phase!=='active')return message(c,r,'先和伙伴在双人篮前相约，再拼合两半线索。');
  if(n.index===1||n.index===2){const owner=n.index===1?'gold':'white';if(r!==owner)return message(c,r,'这是留给伙伴的半张图，把它留给伙伴来读。');if(!a.clues.includes(r))a.clues.push(r);return message(c,r,r==='gold'?'你的半张图：藏匣在树根小窗北边，带有一片金叶。请把线索告诉伙伴。':'你的半张图：藏匣在村西两条林路之间，白色月纹朝着花束。请把线索告诉伙伴。');}
  if(a.clues.length<2)return message(c,r,'锁扣上有两半图的凹槽；先各自找到属于自己的那一半。');
  const q=c.s.players[other(r)],p=c.s.players[r];
  if(!fieldReachable(c,other(r),n)||Math.abs(p.y-q.y)>.3||!clearDuoPath(c.world,{...p,y:p.y+.8},{...q,y:q.y+.8},.1,.8))return message(c,r,'两半图已经齐了。请和伙伴一起站到藏匣旁，再合上图页。');
  complete(c,id);a.phase='result';a.expiresAt=c.s.time+12;a.result='两半图合上了，林间小画已收藏。';return;
 }
 if(c.s.fieldPlay&&c.s.fieldPlay.phase!=='result')return message(c,r,'先结束当前活动，再慢慢看这里。');
 discovered(c,id);
 if(b.completed.includes(id))return message(c,r,content.ending+' '+chainFollowup(id,b)+' · 纪念已收藏，可在手记回看。');
 let done=false,hint=content.hint;
 const studio=STUDIO_HOOKS.find(h=>h.id===id);
 if(studio){const sequence=studio.id==='winter-three-lanterns'||studio.sequence[0]?.node;const next=sequence?(n.index===step?step+1:n.index===0?1:0):step+1;setStep(c,id,next);done=sequence?next===(studio.id==='winter-three-lanterns'?3:studio.sequence.length):next>=(id==='c-viz-clock-clue'?3:2);hint=sequence?(studio.id==='winter-three-lanterns'?'这盏冬灯亮了，沿西侧雪林寻找下一盏。':studio.id==='c-viz-pumpkin-order'?'灯光回应了，寻找下一盏南瓜灯。':'潮声有了回应，沿路寻找下一枚贝壳。'):'轻触确认，把这一刻写进手记。';}
 switch(id){
  case 'root-window':setStep(c,id,step+1);done=step>=1;hint='叶片被拨开了，小窗后有几粒闪动的光。再轻触窗沿。';break;
  case 'wind-shell':setStep(c,id,step|(1<<n.index));done=(step|(1<<n.index))===3;hint='一片叶子转向了风，另一片还没有回应。';break;
  case 'moon-dew':{const hour=(9+c.s.time/30)%24;if(hour>=19||hour<6){setStep(c,id,1);done=true;}else hint='露珠还透明着。等到夜色降临，再来看菌褶里的月光。';break;}
  case 'cap-echo':{const next=n.index===[0,2,1][step]?step+1:n.index===0?1:0;setStep(c,id,next);done=next===3;hint=next?'响声接上了，再听下一枚。':'声音散开了。看菌盖的刻痕：一、三、二。';c.emit('journey-chime',n.x,n.z,'');break;}
  case 'turning-stone':setStep(c,id,step+1);done=step>=2;hint='石头转了一格，水纹还差一点才能接上。';break;
  case 'leaf-pocket':setStep(c,id,step+1);done=step>=1;hint='叶袋打开了，一枚银色种子正慢慢落下。再伸爪接住。';break;
  case 'ribbon-return':
   if(n.index===0&&step===0){setStep(c,id,1);hint='篮沿画着一串花瓣，指向村西树枝。找到丝带后，先系好路旁花束。';}
   else if(n.index===1&&step===1){setStep(c,id,2);hint='丝带找到了。沿林路向北，给散开的花束系个结。';}
   else if(n.index===2&&step===2){setStep(c,id,3);hint='花束系好了。回针线篮旁，给花匠留个平安的消息。';}
   else if(n.index===0&&step===3){setStep(c,id,4);done=true;}
   else hint=step===2?'丝带在爪边，去村西路旁的花束看看。':step===3?'花束已经系好，回针线篮旁留个消息。':content.hint;
   break;
  case 'glow-procession':if(n.index===step){setStep(c,id,step+1);done=step===4;hint='这枚伞灯留下暖光，下一枚在林路更深处回应了。';}else hint='先沿着亮起的伞灯走。它会把下一段路照出来。';break;
  case 'woodland-lamps':
   if(n.index===0){if(step===15)done=true;else{if(!step)setStep(c,id,1);hint='灯座还缺沿路三盏灯的回应。沿西门外弯曲的小径，拨正松动的接头。';}}
   else if(step){setStep(c,id,step|(1<<n.index));hint=(step|(1<<n.index))===15?'三盏灯都接好了。回到西门灯座，合上总接头。':'这盏灯已接好，沿林路看看其余灯座。';}
   break;
  case 'wind-mobile':
   if(n.index){const key=id+(n.index===1?':a':':b'),value=((b.steps[key]??0)+1)%4;setStep(c,key,value);hint=(n.index===1?'风向叶':'配重环')+'已调到第 '+value+' 格。';}
   else{done=b.steps[id+':a']===2&&b.steps[id+':b']===3;if(done)setStep(c,id,1);else hint='风向叶应对齐第二格，配重环应对齐第三格。调好再拉铃绳。';}
   break;
 }
 if(done)complete(c,id);else message(c,r,hint);
}
export function commandField(c:FieldContext,r:FieldRole,cmd:FieldCommand){
 if(!validFieldCommand(cmd))return;const s=c.s,a=s.fieldPlay;
 if(cmd.kind==='cancel'){if(a?.id===cmd.id&&a.participants.includes(r)){delete s.fieldPlay;message(c,r,'活动已结束，伙伴标记和正常探索已恢复。');}return;}
 if(cmd.kind==='accept'){
  if(!a||a.id!==cmd.id||a.phase!=='invited'||r===a.proposer||s.time>a.expiresAt)return;
  const start=FIELD_NODES.find(n=>n.contentId===a.siteId&&n.index===0)!;
  if(!a.participants.every(p=>fieldReachable(c,p,start,5)&&!c.blocked(p))||s.duo||s.story?.active||s.travel){delete s.fieldPlay;return message(c,r,'先在活动起点一起站稳，再相约。');}
  begin(c,a);return;
 }
 if(a&&a.phase!=='result')return message(c,r,'已有活动进行中，可以先取消再重玩。');
 const content=fieldContent(cmd.siteId),start=FIELD_NODES.find(n=>n.contentId===cmd.siteId&&n.index===0)!;
 if(!fieldReachable(c,r,start)||c.blocked(r)||s.duo||s.story?.active||s.travel||s.journeyProposal)return message(c,r,'请先在活动起点站稳，离开战斗和其他互动。');
 const solo=content.kind==='flight'&&(c.solo||cmd.solo===true);
 if(c.solo&&!solo)return message(c,r,'这是双人活动。可以先探索秘密、短事件，或独自练习飞行。');
 if(content.kind==='flight'&&!s.broomOwned)return message(c,r,'先在营地领取扫帚，再来起飞。');
 if(!solo&&(!fieldReachable(c,other(r),start,5)||c.blocked(other(r))))return message(c,r,'请和伙伴一起到活动起点附近，再发出邀请。');
 const next:FieldPlay={id:s.eventSerial+1,siteId:cmd.siteId,regionId:s.regionId,kind:content.kind==='flight'?'flight':cmd.siteId==='woodland-hide'?'hide':'treasure',phase:'invited',proposer:r,participants:solo?[r]:['gold','white'],startedAt:s.time,expiresAt:s.time+30,round:1,seeker:r,next:{gold:0,white:0},finished:{},clues:[],result:''};
 s.fieldPlay=next;message(c,r,solo?'准备起飞。':'已邀请伙伴 · '+content.title);if(solo)begin(c,next);
}
function begin(c:FieldContext,a:FieldPlay){discovered(c,a.siteId);a.startedAt=c.s.time;
 a.phase=a.kind==='flight'?'countdown':a.kind==='hide'?'prepare':'active';a.expiresAt=c.s.time+(a.kind==='flight'?3:a.kind==='hide'?25:240);
}
function hideRound(c:FieldContext,a:FieldPlay,found:boolean){
 a.finished[a.seeker]=found?Math.min(90,c.s.time-a.startedAt):90;
 if(a.round===1){a.round=2;a.seeker=other(a.seeker);a.phase='prepare';a.startedAt=c.s.time;a.expiresAt=c.s.time+25;message(c,a.seeker,(found?'找到了！':'第一轮时间到了。')+'交换寻找者，重新准备 25 秒。');}
 else{a.phase='result';a.expiresAt=c.s.time+12;const gold=a.finished.gold??90,white=a.finished.white??90;a.result=gold===white?'两轮结束，今天不分胜负。':name(gold<white?'gold':'white')+'找到伙伴更快！';complete(c,a.siteId);}
}
/** Checkpoints are advanced only by short, actual movement segments in order. */
export class FieldTicker {
 private previous:Partial<Record<FieldRole,FieldPoint>>={};private runId=-1;
 tick(c:FieldContext){const s=c.s,a=s.fieldPlay;if(!a){this.previous={};this.runId=-1;return;}
  if(a.id!==this.runId){this.previous={};this.runId=a.id;}
  // Ground enemies can remain aggro while a broom passes high above them.
  // That must not cancel an already running flight; damage rules are unchanged.
  if(a.regionId!==s.regionId||s.travel||s.story?.active||a.participants.some(r=>s.players[r].hp<=0||((a.kind!=='flight'||!s.players[r].mounted)&&c.blocked(r)))){delete s.fieldPlay;message(c,a.proposer,'活动已结束，可以继续正常探索。');return;}
  if(a.phase==='result'){if(s.time>=a.expiresAt)delete s.fieldPlay;return;}
  if(a.phase==='invited'){const start=FIELD_NODES.find(n=>n.contentId===a.siteId&&n.index===0)!;if(s.time>=a.expiresAt||a.participants.some(r=>!fieldReachable(c,r,start,6))){delete s.fieldPlay;message(c,a.proposer,'活动邀请已取消，回到起点可以重新相约。');}return;}
  if(a.kind==='hide'){
   const b=HIDE_BOUNDS;if(a.participants.some(r=>{const p=s.players[r];return p.mounted||p.x<b.minX||p.x>b.maxX||p.z<b.minZ||p.z>b.maxZ||homePathDistance(p.x,p.z)>9||(p.x>-39&&p.z>-36);})){delete s.fieldPlay;message(c,a.proposer,'离开林路范围或起飞，捉迷藏已取消。');return;}
   if(a.phase==='prepare'&&s.time>=a.expiresAt){a.phase='active';a.startedAt=s.time;a.expiresAt=s.time+90;}
   else if(a.phase==='active'&&s.time>=a.expiresAt)hideRound(c,a,false);
   return;
  }
  if(a.kind==='treasure'){const start=FIELD_NODES.find(n=>n.contentId===a.siteId&&n.index===0)!;if(s.time>=a.expiresAt||a.participants.some(r=>Math.hypot(s.players[r].x-start.x,s.players[r].z-start.z)>65)){delete s.fieldPlay;message(c,a.proposer,'寻宝时间到了或离开了村西范围，线索可以重新领取。');}return;}
  if(a.phase==='countdown'){if(s.time>=a.expiresAt){a.phase='active';a.startedAt=s.time;a.expiresAt=s.time+180;this.previous={};}return;}
  if(s.time>=a.expiresAt){a.phase='result';a.expiresAt=s.time+12;a.result='这一趟没有全部完成。可返回起点重试，日常飞行照常。';return;}
  const route=FIELD_ROUTES[a.siteId];
  for(const r of a.participants){const p=s.players[r],prev=this.previous[r];this.previous[r]={x:p.x,y:p.y,z:p.z};if(a.finished[r]!==undefined||!prev||!p.mounted)continue;
   const q=route[a.next[r]],dx=p.x-prev.x,dy=p.y-prev.y,dz=p.z-prev.z,len=dx*dx+dy*dy+dz*dz;if(!q||len>4||len<.000001)continue;
   const t=Math.max(0,Math.min(1,((q.x-prev.x)*dx+(q.y-prev.y)*dy+(q.z-prev.z)*dz)/len));
   if(Math.hypot(prev.x+t*dx-q.x,prev.y+t*dy-q.y,prev.z+t*dz-q.z)>2.2)continue;
   a.next[r]++;if(a.next[r]===route.length){const elapsed=Math.round((s.time-a.startedAt)*100)/100;a.finished[r]=elapsed;const key=a.siteId+':'+r;if(elapsed<(s.fieldbook.best[key]??Infinity)){s.fieldbook.best[key]=elapsed;s.fieldbook.revision++;}complete(c,a.siteId);message(c,r,name(r)+'完成 · '+elapsed.toFixed(2)+' 秒');}
  }
  if(a.participants.every(r=>a.finished[r]!==undefined)){a.phase='result';a.expiresAt=s.time+12;a.result=a.participants.map(r=>name(r)+' '+a.finished[r]!.toFixed(2)+' 秒').join(' · ');}
 }
}
export function fieldFind(c:FieldContext,r:FieldRole){const a=c.s.fieldPlay;if(a?.kind!=='hide'||a.phase!=='active'||a.seeker!==r)return false;
 const p=c.s.players[r],q=c.s.players[other(r)];if(Math.hypot(p.x-q.x,p.z-q.z)<3.2&&Math.abs(p.y-q.y)<1&&clearDuoPath(c.world,{...p,y:p.y+.7},{...q,y:q.y+.7},.08,.5)){hideRound(c,a,true);return true;}return false;
}
export function fieldStatus(s:Snapshot,r:FieldRole){const a=s.fieldPlay;if(!a)return '';const title=fieldContent(a.siteId).title,remaining=Math.max(0,Math.ceil(a.expiresAt-s.time));
 if(a.phase==='result')return title+' · '+a.result;
 if(a.phase==='invited')return title+' · 等待伙伴确认';
 if(a.phase==='countdown')return title+' · '+remaining+' 秒后开始，起飞穿环';
 if(a.kind==='hide')return '第 '+a.round+' 轮 · '+(a.seeker===r?'你来寻找':'你来躲藏')+' · '+(a.phase==='prepare'?'准备':'寻找')+' '+remaining+' 秒 · 西门外林路内，找到后按 E';
 if(a.kind==='treasure')return title+' · '+remaining+' 秒 · '+(a.clues.includes(r)?r==='gold'?'你的线索：树根小窗以北，金叶藏匣。':'你的线索：村西两路之间，月纹朝花束。':r==='gold'?'你的半张图在村西风向叶附近，带金叶。':'你的半张图在针线篮以西，带月纹。');
 return title+' · '+(a.next[r]??0)+' / '+FIELD_ROUTES[a.siteId].length+' 环 · '+(s.time-a.startedAt).toFixed(1)+' 秒'+(a.finished[r]!==undefined?' · 已完成，等伙伴':'');
}
export function nearestFieldStart(s:Snapshot,r:FieldRole){return fieldNodes(s.regionId).find(n=>n.index===0&&['flight','game'].includes(fieldContent(n.contentId).kind)&&Math.hypot(s.players[r].x-n.x,s.players[r].z-n.z)<3.2);}
