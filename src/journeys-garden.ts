import type {JourneyProgress,JourneyEntry} from '../shared/journeys';
import type {JourneyNode,JourneyResult,JourneyJournalEntry} from './journeys';
import {POND_STORY_POINTS as A} from './villa-pond-layout';

export const POND_JOURNEY='pond-reply';
const node=(part:keyof typeof A,label:string,visual:JourneyNode['visual']):JourneyNode=>({
  ...A[part],id:'pond-'+part,journeyId:POND_JOURNEY,regionId:'player-home-villa',kind:'relic',label,visual,text:'',
  speaker:'水边的旧画册',portrait:'forester',requiresClearPath:true,...(part==='wheel'?{valueKey:'flow'}:{}),
});
export const GARDEN_JOURNEY_NODES=[node('album','翻开水边旧画册','notice'),node('iris','辨认鸢尾旁的刻痕','gauge'),node('wheel','转动引信轮','valve'),node('case','取出漂来的信匣','chest'),node('reply','在桥边放好回信','letter')];
const entry=(p:JourneyProgress):JourneyEntry=>p.entries[POND_JOURNEY]??{stage:0,known:[],values:{},completed:false};
export function gardenJournal(p:JourneyProgress):JourneyJournalEntry[]{
 const e=entry(p);return[{id:POND_JOURNEY,title:'睡莲下的回信',regionId:'player-home-villa',stage:e.stage,status:e.completed?'complete':e.stage?'active':'unstarted',hint:[
  '庭院西北角，池塘南岸的石台上留着一本旧画册。',
  e.known.includes('pond-iris')?'把东桥头引信轮转到二格，让指针朝下；牵引细绳会将信匣带向南岸。':'按画册的提示，到南岸鸢尾花旁辨认刻痕。',
  '引信轮已扣住。到南岸睡莲旁取出信匣，岸上就能够到。',
  '从桥头绕到北岸，把信放在东北侧的小石台上。',
  '回信已经放好。粉白睡莲开在桥畔，画册里添上了这一天的合影位置。',
 ][Math.min(e.stage,4)]}];
}
export function useGardenJourney(p:JourneyProgress,n:JourneyNode):JourneyResult{
 const next=structuredClone(p),e=next.entries[POND_JOURNEY]??={stage:0,known:[],values:{},completed:false},before=JSON.stringify(e);
 const remember=(id:string)=>{if(!e.known.includes(id))e.known.push(id);};
 let text='',effect:JourneyResult['effect'];
 if(e.completed)text='石台上夹着新的落款：“走慢一点也没关系，桥这边一直有人等你。”睡莲旁的位置，留给下一张一起拍的照片。';
 else if(n.id==='pond-album'){
  remember(n.id);e.stage=Math.max(1,e.stage);text='旧画册里画着一座蓝绿小桥：“那年我把没说出口的话收进防水信匣，拴在桥下。若你找到了南岸的鸢尾，就能读懂引信轮该停的方向。请把回信留在北岸石台——这次，我会回来取。”';
 }else if(n.id==='pond-iris'){
  if(!e.stage)text='鸢尾边有两枚朝下的花瓣刻痕。南岸石台上的旧画册，或许解释了它们的用途。';
  else{remember(n.id);text='花丛旁刻着两枚花瓣，尖端朝下。画册边注：“东桥头的引信轮转到二格，指针向下。转错也不要紧，四格是一圈。”';effect='discover';}
 }else if(n.id==='pond-wheel'){
  if(e.stage>=2)text='止动销已经扣好，细绳通向南岸的信匣。'+gardenJournal(next)[0].hint;
  else if(!e.stage)text='铜轮旁的小牌写着：“为没有寄出的信引路。”先看看南岸石台上的画册。';
  else{e.values.flow=((e.values.flow??0)+1)%4;remember(n.id);effect='water';text=`引信轮转到${e.values.flow}格，指针朝${['上','右','下','左'][e.values.flow]}。`;
   if(e.values.flow===2&&e.known.includes('pond-iris')){e.stage=2;text+='止动销轻轻落下，细绳将信匣牵向南岸睡莲边。沿岸走过去，就能伸爪取到。';}
   else text+=e.known.includes('pond-iris')?'鸢尾刻痕提示二格、向下；轮子还可以继续转。':'先认一认南岸鸢尾边的刻痕，确认止动销的方向。';
  }
 }else if(n.id==='pond-case'){
  if(e.stage<2)text='信匣还拴在桥下，别踏进水里。读过画册和鸢尾刻痕后，东桥头的引信轮能将它牵到岸边。';
  else if(e.stage===2){e.stage=3;remember(n.id);effect='discover';text='防水匣里，画中人留了一封迟来的回信：“我回来了。花开时没有遇见，花谢后也能一起等下一季。”信纸背面画着北岸石台，旁边有两枚小小的爪印。';}
  else text='信已经收好。'+gardenJournal(next)[0].hint;
 }else if(n.id==='pond-reply'){
  if(e.stage<3)text='石台上压着一枚小石子，空出的地方正好放一封信。'+gardenJournal(next)[0].hint;
  else{e.stage=4;e.completed=true;remember(n.id);effect='discover';text='把回信压在石子下，风掀起画册的最后一页。粉白睡莲在桥畔舒展开：“幸好等到的，不只是一封信。”手记已收好这段回信，也标下了桥边合影的位置。';}
 }
 const changed=JSON.stringify(e)!==before;if(changed)next.revision=p.revision+1;
 return{progress:changed?next:p,text,changed,...(effect?{effect}:{}),...(e.completed&&!entry(p).completed?{completedNow:true}:{})};
}
