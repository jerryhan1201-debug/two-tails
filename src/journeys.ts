import type { Interaction } from './content';
import type { JourneyEntry, JourneyProgress } from '../shared/journeys';
import {LATER_JOURNEY_NODES,laterJournal,laterPrompt,useLaterJourney} from './journeys-later';
import {GARDEN_JOURNEY_NODES,POND_JOURNEY,gardenJournal,useGardenJourney} from './journeys-garden';
import {CASTLE_JOURNEY_NODES,COUNT_JOURNEY,BELL_JOURNEY,castleStoryJournal,castleStoryPrompt,useCastleStory} from './journeys-castle';
import{COAST_WINTER_IDS,COAST_WINTER_NODES,coastWinterJournal,coastWinterPrompt,useCoastWinterJourney}from'./journeys-coast-winter';

export type JourneyVisual='notice'|'satchel'|'letter'|'chime'|'valve'|'gauge'|'lever'|'chest'|'candle'|'mirror'|'toolbox'|'shelter'|'nest'|'lantern';
export type JourneyNode=Interaction&{journeyId:string;regionId:string;visual:JourneyVisual;valueKey?:string;tone?:number};
const node=(journeyId:string,regionId:string,id:string,x:number,z:number,label:string,visual:JourneyVisual,extra:Partial<JourneyNode>={}):JourneyNode=>({journeyId,regionId,id,x,z,label,visual,kind:'relic',text:'',speaker:journeyId==='river-levels'?'河工的试水记录':visual==='chime'?'守林人的风铃':'雨夜邮路的便笺',portrait:journeyId==='river-levels'?'captain':visual==='chime'?'forester':'postman',...extra});
const mail='rain-post',river='river-levels',riverRegion='ch02-windmill-river';
/** Stable authored positions; renderer and simulation consume the same records. */
export const JOURNEY_NODES:JourneyNode[]=[
  node(mail,'mushroom-grove','mushroom-grove-memory',20,48,'翻开雨夜寄信簿','notice',{speaker:'邮差獾的寄信簿',portrait:'postman'}),
  node(mail,'mushroom-grove','mail-wet-satchel',21,43,'捡起高台上的防雨邮袋','satchel',{surfaceId:'mushroom-step-3'}),
  node(mail,'mushroom-home','mushroom-home-memory',-.75,1.65,'在茶灯旁展开湿信','letter',{speaker:'苔苔的茶桌',portrait:'herbalist'}),
  node(mail,'canopy-garden','canopy-garden-memory',-4.5,40.5,'敲响低音风铃','chime',{tone:0,surfaceId:'canopy-platform'}),
  node(mail,'canopy-garden','mail-chime-middle',-5,46,'敲响中音风铃','chime',{tone:1,surfaceId:'canopy-platform'}),
  node(mail,'canopy-garden','mail-chime-high',-5,52,'敲响高音风铃','chime',{tone:2,surfaceId:'canopy-platform'}),
  node(mail,'canopy-home','canopy-home-memory',-2,6,'查看暖阁的回信匣','letter',{speaker:'守林人的回信',portrait:'forester'}),
  node(mail,'mushroom-home','mail-delivery',1.7,-2.2,'一起把回信放进门边信箱','chest'),
  node(river,riverRegion,'river-maintenance-log',-30,43,'翻看河工的检修簿','notice',{speaker:'河工的检修簿',portrait:'captain'}),
  node(river,riverRegion,'river-staff-gauge',-25,59,'观察水位尺与白鹭脚印','gauge'),
  node(river,riverRegion,'river-intake-valve',-32,47,'转动上游进水轮','valve',{valueKey:'intake'}),
  node(river,riverRegion,'river-outlet-valve',-32,57,'转动回水轮','valve',{valueKey:'outlet'}),
  node(river,riverRegion,'river-check-lever',-17,56,'一起拉动试水杆','lever'),
  node(river,riverRegion,'river-dry-chest',-27,73,'取回露出水面的航路匣','chest'),
  ...LATER_JOURNEY_NODES,
  ...GARDEN_JOURNEY_NODES,
  ...CASTLE_JOURNEY_NODES,
  ...COAST_WINTER_NODES,
];
export interface JourneyJournalEntry {id:string;title:string;status:'unstarted'|'active'|'complete';stage:number;hint:string;regionId:string}
const empty=():JourneyEntry=>({stage:0,known:[],values:{},completed:false});
export const journeyEntry=(p:JourneyProgress,id:string):JourneyEntry=>p.entries[id]??empty();
export function journeyJournal(p:JourneyProgress):JourneyJournalEntry[]{
  const m=journeyEntry(p,mail),r=journeyEntry(p,river);
  return [
    {id:mail,title:'雨夜未寄出的信',status:m.completed?'complete':m.stage?'active':'unstarted',stage:m.stage,regionId:m.stage===2||m.stage===5?'mushroom-home':m.stage===3?'canopy-garden':m.stage===4?'canopy-home':'mushroom-grove',hint:[
      '蘑菇林东侧的寄信簿旁，有一只被雨冲上石台的邮袋。',
      '沿三块矮石台跳到最高处，取回防雨邮袋。',
      '到苔灯蘑菇屋的茶桌旁展开湿信，看看显出的墨迹。',
      '登上风铃树屋平台，按信上的低、高、中次序敲响三只铃；敲错可重新来。',
      '铃声已传进暖阁。进屋看看守林人准备的回信。',
      '把回信带回蘑菇屋门边信箱，和伙伴各按一次 E 确认投递。',
      '信已送达。蘑菇屋与树梢的两盏灯会继续回应。',
    ][Math.min(m.stage,6)]},
    {id:river,title:'白鹭浅滩的水位',status:r.completed?'complete':r.stage?'active':'unstarted',stage:r.stage,regionId:riverRegion,hint:r.completed?'航路匣已取回，西岸石步保持露出。':r.stage>=2?'顺着西岸露出的石步到北岸，取回航路匣。':r.known.includes('gauge')?'水位尺的刻痕是：进水二格、回水三格。调好两个轮，再和伙伴各按 E 拉杆试水。':'到银溪西岸读检修簿，再沿河岸观察水位尺；水轮可以反复调整。'},
    ...laterJournal(p),
    ...gardenJournal(p),
    ...castleStoryJournal(p),
    ...coastWinterJournal(p),
  ];
}
export function journeyNodes(regionId:string,_progress?:JourneyProgress):JourneyNode[]{return JOURNEY_NODES.filter(n=>n.regionId===regionId);}
export function journeyRepeatable(n:JourneyNode,p:JourneyProgress){const e=journeyEntry(p,n.journeyId);return !e.completed&&(n.visual==='chime'?(n.journeyId==='shell-echo'||e.stage===3):['valve','lever','candle','mirror','toolbox','shelter','lantern'].includes(n.visual));}
export function journeyPrompt(n:JourneyNode,p:JourneyProgress){
  if([COUNT_JOURNEY,BELL_JOURNEY].includes(n.journeyId))return castleStoryPrompt(n,p);
  if(COAST_WINTER_IDS.includes(n.journeyId))return coastWinterPrompt(n,p);
  const e=journeyEntry(p,n.journeyId);
  if(n.visual==='valve')return `${n.label} · 当前${e.values[n.valueKey!]??0}格`;
  return laterPrompt(n,e);
}
export interface JourneyResult {progress:JourneyProgress;text:string;changed:boolean;confirmation?:boolean;completedNow?:boolean;effect?:'chime'|'water'|'discover'}
/** Pure puzzle reducer: inputs are ordinary reachable E interactions. It never
 * grants combat rewards or writes chapter flags. Confirmation is supplied only
 * after simulation validates the second living partner at the same mechanism. */
export function useJourney(p:JourneyProgress,n:JourneyNode,confirmed=false,context:{endingRestored?:boolean}={}):JourneyResult {
  if(n.journeyId===POND_JOURNEY)return useGardenJourney(p,n);
  if([COUNT_JOURNEY,BELL_JOURNEY].includes(n.journeyId))return useCastleStory(p,n);
  if(COAST_WINTER_IDS.includes(n.journeyId))return useCoastWinterJourney(p,n);
  const next=structuredClone(p),e=next.entries[n.journeyId]??=empty();
  const before=JSON.stringify(e);let text='',confirmation=false,effect:JourneyResult['effect'];
  const remember=(id:string)=>{if(!e.known.includes(id))e.known.push(id);};
  if(e.completed){text=n.journeyId===mail?'信箱里多了一张新便条：“昨夜我们都听见了铃。谢谢你们把两盏灯连在一起。”':n.journeyId===river?'水位停在白鹭脚印下。航路匣已经取回，旧石步仍可通行。':laterJournal(p).find(j=>j.id===n.journeyId)?.hint??'这里已经安顿好了。';}
  else if(n.journeyId===mail){
    if(n.id==='mushroom-grove-memory'){
      remember(n.id);if(e.stage===0)e.stage=1;
      text='邮差獾写道：“雨把寄往树梢的信冲到了东边最高的矮石台上。请沿三块石台捡回邮袋，再到北边蘑菇屋借茶灯烘开信页。别急着乱敲铃，墨迹里写着收信的暗号。”';
    }else if(n.id==='mail-wet-satchel'){
      if(e.stage===0)text='邮袋上的收件人被雨泡花了。先看看石台北侧、地面寄信簿里的说明。';
      else if(e.stage===1){e.stage=2;remember(n.id);text='防雨袋完好，信页却粘住了。袋里的便签画着一盏茶灯：北边蘑菇屋的苔苔知道怎样展开它。';effect='discover';}
      else text='邮袋已经收好。'+journeyJournal(next)[0].hint;
    }else if(n.id==='mushroom-home-memory'){
      remember(n.id);
      if(e.stage===2){e.stage=3;remember('bell-code');text='茶灯照透湿纸，三行墨迹显了出来：“先低声报平安，再把高音送过树冠，最后用中音回应。”旁边画着树屋西侧的三只铃：靠阶梯低音，中央中音，靠北栏高音。';effect='discover';}
      else text=e.stage<2?'茶灯旁留着干布：“带来湿信，就在这里慢慢展开。”先到蘑菇林寄信簿旁找邮袋。':'苔苔添好热茶。信上的暗号仍是低、高、中；回信请投进门边的小信箱。';
    }else if(n.tone!==undefined){
      effect='chime';const tone=['低','中','高'][n.tone];
      if(e.stage<3)text=`${tone}音在树冠间回响。铃牌提醒：先把雨夜邮袋带到蘑菇屋，信里有收件暗号。`;
      else if(e.stage===3){const expected=[0,2,1],position=e.values.bellStep??0;
        if(n.tone===expected[position]){e.values.bellStep=position+1;text=`${tone}音得到屋内轻轻的回应（${position+1}/3）。`;if(position===2){e.stage=4;text='低、高、中三声连在一起，暖阁的小灯亮了。守林人的回信匣已打开，请进屋看看。';effect='discover';}}
        else{e.values.bellStep=0;text=`${tone}音后没有回应。铃牌上的爪印退回起点；再从低音开始，接高音、最后中音。`;}
      }else text='屋里的灯仍亮着。'+journeyJournal(next)[0].hint;
    }else if(n.id==='canopy-home-memory'){
      remember(n.id);if(e.stage===4){e.stage=5;text='回信里夹着两片羽毛：“昨晚两只迷路的鸟循铃而来，已经平安。请把这枚新铃舌带回苔苔的小信箱，让雨夜赶路的人也能听见回应。”';effect='discover';}
      else text=e.stage<4?'回信匣的扣子连着平台的三只铃。桌边画着雨夜邮袋和茶灯；信上的暗号能让守林人知道是谁来了。':'回信已带在身边。苔苔蘑菇屋门边的信箱还等着你们。';
    }else if(n.id==='mail-delivery'){
      if(e.stage<5)text='空信箱里放着一张树屋地图。先找到雨夜邮袋，带回守林人的回信。';
      else if(!confirmed){confirmation=true;text='把回信放进信箱前，请伙伴也到信箱旁按 E；两双爪印一起为这段雨夜邮路落款。';}
      else{e.stage=6;e.completed=true;text='两双爪印压好封口。苔苔把新铃舌挂上门边，轻铃从蘑菇屋传向树梢：这一次，雨夜的信没有错过任何人。';effect='discover';}
    }
  }else if(n.journeyId===river){
    if(n.id==='river-maintenance-log'){remember('log');e.stage=Math.max(e.stage,1);text='检修簿：“汛后西岸石步被淹，航路匣留在北岸。先到下游水位尺，看白鹭脚印旁的两处刻痕；进水轮和回水轮都可逐格转动，四格一圈。调好后，两位河工一起拉杆试水。试错只会回流，不会冲走石步。”';}
    else if(n.id==='river-staff-gauge'){remember('gauge');e.stage=Math.max(e.stage,1);text=`尺上的青色进水刻痕停在二格，白色回水刻痕停在三格，旁边的白鹭脚印在干处。当前进水${e.values.intake??0}格、回水${e.values.outlet??0}格。两处都对准后，再去东侧试水杆。`;}
    else if(n.visual==='valve'){
      if(e.stage>=2)text='水路已经固定在安全刻度，轮子上的止动销锁住了石步。';
      else{e.stage=Math.max(e.stage,1);const key=n.valueKey!;e.values[key]=((e.values[key]??0)+1)%4;remember(n.id);text=`${key==='intake'?'进水':'回水'}轮转到${e.values[key]}格。槽里的浮标随之${key==='intake'?'抬起':'下降'}，水还在试流槽内；水位尺上的刻痕能说明该停在哪格。`;effect='water';}
    }else if(n.id==='river-check-lever'){
      if(e.stage>=2)text='试水杆已扣紧，西岸白色石步保持露出，走到北岸取航路匣吧。';
      else if(!e.known.includes('gauge'))text='杆边写着“先读尺，再试水”。下游西岸水位尺上的青、白刻痕标出了安全水路。';
      else if(e.values.intake!==2||e.values.outlet!==3)text=`水从溢流口回到河里，石步仍未露出。当前进水${e.values.intake??0}格、回水${e.values.outlet??0}格；水位尺要求二格、三格。轮子没有损坏，可以继续调整。`;
      else if(!confirmed){confirmation=true;text='浮标已经对准白鹭脚印。请伙伴到试水杆旁也按 E，一起扣住两侧止动销。';}
      else{e.stage=2;remember(n.id);text='两侧止动销同时扣住，西岸水槽缓缓回流，一列宽石步露了出来。顺着西岸石步到北岸，取回航路匣。';effect='water';}
    }else if(n.id==='river-dry-chest'){
      if(e.stage<2)text='航路匣仍被水槽的锁扣扣住。先读水位尺，调好两轮，再和伙伴一起试水。';
      else{e.stage=3;e.completed=true;remember(n.id);text='航路匣里是每场大雨后手绘的浅滩图。船长在最新一页添上两枚爪印：“谢谢你们，明天小船就能把茶叶送到林边。”石步将一直保持通行。';effect='discover';}
    }
  }else{const result=useLaterJourney(next,e,n,confirmed,context.endingRestored===true);text=result.text;confirmation=result.confirmation===true;effect=result.effect;}
  if(!e.completed||!journeyEntry(p,n.journeyId).completed)remember(n.id);
  const changed=JSON.stringify(e)!==before;
  if(changed)next.revision=p.revision+1;
  else if(!p.entries[n.journeyId])delete next.entries[n.journeyId];
  return {progress:changed?next:p,text,changed,...(confirmation?{confirmation:true}:{}),...(!journeyEntry(p,n.journeyId).completed&&e.completed?{completedNow:true}:{}),...(effect?{effect}:{})};
}
