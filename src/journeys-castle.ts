import type{JourneyProgress,JourneyEntry}from'../shared/journeys';
import type{JourneyNode,JourneyResult,JourneyJournalEntry}from'./journeys';
import{CASTLE_STORY_POINTS as A}from'./castle-story-layout';
export const COUNT_JOURNEY='count-sleep',BELL_JOURNEY='last-bell';
const n=(part:keyof typeof A,label:string,visual:JourneyNode['visual'],journeyId=COUNT_JOURNEY):JourneyNode=>({...A[part],id:'castle-story-'+part,regionId:'ch05-candle-castle',journeyId,label,visual,kind:'relic',text:'',speaker:journeyId===COUNT_JOURNEY?'伯爵留下的便笺':'守钟人的检修簿',portrait:'forester',requiresClearPath:true});
export const CASTLE_JOURNEY_NODES=[n('coffin','查看伯爵棺上的封印','lever'),n('locket','收好旧银怀表','satchel'),n('key','取下家纹钥匙','satchel'),n('letter','读未拆封的家书','letter'),n('clocknote','翻看守钟人的检修簿','notice',BELL_JOURNEY),n('batwindow','查看窗边蝙蝠的栖处','nest',BELL_JOURNEY),n('bell','调整钟楼传动轮','valve',BELL_JOURNEY)];
const entry=(p:JourneyProgress,id:string):JourneyEntry=>p.entries[id]??{stage:0,known:[],values:{},completed:false};
export function castleStoryJournal(p:JourneyProgress):JourneyJournalEntry[]{return[
 {id:COUNT_JOURNEY,title:'伯爵不愿醒来的夜晚',hints:['暗道尽头的密室里，一具胡桃木棺旁留着铭牌。','去收藏室找旧银怀表和家纹钥匙，再到大厅东侧读家书。','回密室，将棺上的月牙封印转到二格。','封印已松开。再读一读棺盖内侧的回信。','伯爵把睡意留给白昼，把灯留给晚归的人。棺盖里的回信已经收进手记。']},
 {id:BELL_JOURNEY,title:'钟楼里的最后一声',hints:['密室星象桌北侧留着守钟人的检修簿，钟楼的传动装置就在同层。','沿星象桌西侧看看窗边，查清钟声停下的原因。','蝙蝠已经睡稳。把东侧传动轮慢慢转到二格，释放一声轻钟。','一声轻钟传过旧窗，蝙蝠回到檐下；不需要进入封闭的钟塔。']},
].map(({id,title,hints})=>{const e=entry(p,id);return{id,title,regionId:'ch05-candle-castle',stage:e.stage,status:e.completed?'complete':e.stage?'active':'unstarted',hint:hints[Math.min(e.stage,hints.length-1)]};});}
export function castleStoryPrompt(n:JourneyNode,p:JourneyProgress){const e=entry(p,n.journeyId);if(n.id==='castle-story-coffin')return e.stage===2?`转动月牙封印 · 当前${e.values.seal??0}格`:e.stage===3?'读棺盖内侧的回信':n.label;if(n.id==='castle-story-bell')return `${n.label} · 当前${e.values.wheel??0}格`;return n.label;}
export function useCastleStory(p:JourneyProgress,n:JourneyNode):JourneyResult{
 const next=structuredClone(p),e=next.entries[n.journeyId]??={stage:0,known:[],values:{},completed:false},before=JSON.stringify(e);let text='',effect:JourneyResult['effect'];const remember=(id:string)=>{if(!e.known.includes(id))e.known.push(id);};
 if(e.completed)text=castleStoryJournal(p).find(j=>j.id===n.journeyId)!.hint;
 else if(n.journeyId===COUNT_JOURNEY){
  if(n.id==='castle-story-coffin'){
   if(!e.stage){e.stage=1;remember(n.id);text='铭牌上刻着“德古拉伯爵”。便笺却写着：“今夜我不愿醒来，怕家里再没有人等。银怀表和家纹钥匙留在收藏室，未拆的家书留在大厅东侧。若有人回来，请让月牙朝下，再轻轻叩门。”';}
   else if(e.stage===1)text='月牙封印还扣着。'+castleStoryJournal(next)[0].hint;
   else if(e.stage===2){e.values.seal=((e.values.seal??0)+1)%4;effect='chime';text=`月牙封印转到${e.values.seal}格。家书背面的图案是二格、月牙朝下。`;if(e.values.seal===2){e.stage=3;text='钥匙转过，棺盖缓缓错开一道缝。里面没有吓人的影子，只有压平的花和一封写好的回信。';}}
   else{e.stage=4;e.completed=true;effect='discover';text='回信写着：“原来家书没有催我赴宴，只说厨房留了热汤，灯也一直亮着。”你们把怀表和钥匙放回棺边。壁上的小家纹亮起来，烛光守着一场终于安心的好梦。';}
  }else if(!e.stage)text='这件旧物旁有同样的月牙家纹。先到密室西南侧看看伯爵的铭牌，别急着拿走。';
  else{remember(n.id);effect='discover';text=n.id.endsWith('locket')?'银怀表停在家人团聚的时刻，盖里夹着一朵干花。':n.id.endsWith('key')?'钥匙齿上的月牙，与密室棺上的封印正好相合。':'家书：“别怕错过晚宴。我们只想等你醒来，一起喝热汤。”背面画着月牙朝下，刻度二格。';if(['locket','key','letter'].every(k=>e.known.includes('castle-story-'+k))){e.stage=Math.max(2,e.stage);text+='旧物和家书都已找到，回密室解开月牙封印吧。';}}
 }else{
  if(n.id==='castle-story-clocknote'){remember(n.id);e.stage=Math.max(1,e.stage);text='检修簿：“别爬封闭的钟塔。楼下东侧的传动轮就能牵动钟舌。钟停了，是因为西窗檐下住进了新邻居；先看看它们，再决定怎样敲钟。”';}
  else if(n.id==='castle-story-batwindow'){
   if(!e.stage)text='几只小蝙蝠收拢翅膀，睡在旧窗上沿。星象桌北侧的检修簿记着它们搬来的那一天。';
   else{remember(n.id);e.stage=Math.max(2,e.stage);effect='discover';text='小蝙蝠已经挪到窗外安稳的檐下。窗扣上刻着两道浅痕：“传动轮二格，只放一声轻钟。”';}
  }else if(e.stage<2)text='传动轮旁贴着“先照看西窗的邻居”。读过检修簿、看过窗边，再轻轻转动。';
  else{e.values.wheel=((e.values.wheel??0)+1)%4;remember(n.id);text=`传动轮转到${e.values.wheel}格。`;if(e.values.wheel===2){e.stage=3;e.completed=true;effect='chime';text+='配重缓缓落下，一声温和的钟响传到旧窗。蝙蝠展开翅膀，又落回檐下。守钟人的空白页多了两枚爪印。';}}
 }
 const changed=JSON.stringify(e)!==before;if(changed)next.revision=p.revision+1;
 return{progress:changed?next:p,text,changed,...(effect?{effect}:{}),...(e.completed&&!entry(p,n.journeyId).completed?{completedNow:true}:{})};
}
