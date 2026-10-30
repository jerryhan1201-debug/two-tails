import type{JourneyProgress,JourneyEntry}from'../shared/journeys';import type{JourneyNode,JourneyResult,JourneyJournalEntry}from'./journeys';
const BEACH='studio-tideglass-cove',SNOW='studio-winter-lantern';
export const COAST_WINTER_IDS=['unsent-log','shell-echo','winter-lamps','snowman-gift'];
type StoryNode=JourneyNode&{zone:string;prop:'book'|'page'|'signal'|'shell'|'lamp'|'mitten'|'scarf'|'tracks'|'gift';propX?:number;propZ?:number};
const n=(journeyId:string,id:string,regionId:string,zone:string,x:number,y:number,z:number,label:string,prop:StoryNode['prop'],visual:JourneyNode['visual'],extra:Partial<StoryNode>={}):StoryNode=>({journeyId,id,regionId,zone,x,y,z,label,prop,visual,kind:'relic',text:'',speaker:regionId===BEACH?'海风留下的手记':'雪地里的来信',portrait:regionId===BEACH?'captain':'forester',requiresClearPath:true,...extra});
export const COAST_WINTER_NODES:StoryNode[]=[
 n('unsent-log','cove-logbook',BEACH,'cove',-14,1.299186,5,'翻开未寄出的航海日记','book','lever'),
 n('unsent-log','cove-log-page',BEACH,'grotto',-43,1.435860,27,'取回洞湾里的日记页','page','letter'),
 n('unsent-log','cove-log-signal',BEACH,'cove',20,1.62,47,'调整栈桥风向板','signal','valve',{valueKey:'signal',propX:23.0,propZ:47}),
 n('shell-echo','cove-echo-low',BEACH,'cove',-18,1.31998,12,'听沙丘贝壳的低音','shell','chime',{tone:0}),
 n('shell-echo','cove-echo-high',BEACH,'cove',-15,.431474,26,'听礁边贝壳的高音','shell','chime',{tone:2}),
 n('shell-echo','cove-echo-middle',BEACH,'cove',9,-.033798,32,'听浅滩贝壳的中音','shell','chime',{tone:1}),
 n('winter-lamps','winter-house-letter',SNOW,'hearth',43,4,145,'查看炉边的归家便笺','book','lever'),
 n('winter-lamps','winter-path-lamp',SNOW,'forest',-9,3.693734,121,'修好林间路灯的灯芯','lamp','valve',{valueKey:'forest'}),
 n('winter-lamps','winter-turn-lamp',SNOW,'forest',18,3.269856,91,'修好转弯处的挡风罩','lamp','valve',{valueKey:'turn'}),
 n('winter-lamps','winter-lost-mitten',SNOW,'valley',6,3.287907,220,'收好雪谷口的手套','mitten','satchel'),
 n('snowman-gift','winter-scarf-note',SNOW,'hearth',22,3.564914,177,'读雪人旁的围巾便签','scarf','notice'),
 n('snowman-gift','winter-gift-tracks',SNOW,'hearth',10,3.080689,194,'辨认通向松树的脚印','tracks','gauge'),
 n('snowman-gift','winter-gift-box',SNOW,'hearth',-3,3.446193,190,'打开雪人藏好的礼物','gift','chest'),
];
export function coastWinterStoryObstacles(regionId:string){return COAST_WINTER_NODES.filter(n=>n.regionId===regionId&&!['shell','tracks','signal'].includes(n.prop)).flatMap(n=>{
 const x=n.propX??n.x,z=n.propZ??n.z+.85,y=n.y!;
 if(n.prop==='lamp')return[{id:n.id+'-pole',kind:'prop',zoneId:n.zone,center:[x,y+1.02,z],size:[.18,2.12,.18],rotationY:0},{id:n.id+'-head',kind:'prop',zoneId:n.zone,center:[x,y+1.88,z],size:[.5,.54,.5],rotationY:0}];
 return[{id:n.id+'-stand',kind:'furniture',zoneId:n.zone,center:[x,y+.38,z],size:[.75,.76,.61],rotationY:0}];
});}
const entry=(p:JourneyProgress,id:string):JourneyEntry=>p.entries[id]??{stage:0,known:[],values:{},completed:false};
export function coastWinterJournal(p:JourneyProgress):JourneyJournalEntry[]{return[
 {id:'unsent-log',title:'没有寄出的航海日记',regionId:BEACH,hints:['海滩入口北侧的沙丘旁，旧日记被石子压住。','去西侧洞湾取回夹在干处的日记页。','日记页画着一枚朝右的旗。到栈桥，将风向板转到一格。','航标已经修好。回沙丘旁给日记添上新的归航日期。','归航日期已经补上。日记收进了手记，旧沉船的页角留给以后的旅程。']},
 {id:'shell-echo',title:'贝壳里的回声',regionId:BEACH,hints:['沙丘旁的低音贝壳留下暗号：低、高、中。','沿海岸找礁边的高音贝壳，让回声继续。','最后去东侧浅滩，敲响中音贝壳。','三声回响连成了短短的归航曲，贝壳上的纹路留下柔光。']},
 {id:'winter-lamps',title:'赶在风雪前亮起的灯',regionId:SNOW,hints:['圣诞木屋炉边留着一张归家便笺。','到木屋南边修好两盏路灯：林间灯芯二格，转弯挡风罩一格。','两盏灯都亮了。去木屋北方雪谷口，找回落下的红手套。','手套已找到。沿亮灯的路回木屋，放在便笺旁。','手套在炉边慢慢暖起来，门外的路灯为晚归的人留着光。']},
 {id:'snowman-gift',title:'雪人藏着的礼物',regionId:SNOW,hints:['木屋西北侧的雪人旁，有一条叠好的围巾。','顺着围巾便签，去西北方辨认一串脚印。','脚印转向西边的松树。礼物藏在树旁的雪堆边。','礼物里是一枚雪花木章：“也给认真找路的你。”手记标下了雪人旁的合影位置。']},
].map(({id,title,regionId,hints})=>{const e=entry(p,id);return{id,title,regionId,stage:e.stage,status:e.completed?'complete':e.stage?'active':'unstarted',hint:hints[Math.min(e.stage,hints.length-1)]};});}
export function coastWinterPrompt(n:JourneyNode,p:JourneyProgress){const e=entry(p,n.journeyId);if(n.id==='cove-logbook'&&e.stage===3)return'在日记里补上归航日期';if(n.id==='winter-house-letter'&&e.stage===3)return'把手套放回炉边';return n.visual==='valve'?`${n.label} · 当前${e.values[n.valueKey!]??0}格`:n.label;}
export function useCoastWinterJourney(p:JourneyProgress,n:JourneyNode):JourneyResult{
 const next=structuredClone(p),e=next.entries[n.journeyId]??={stage:0,known:[],values:{},completed:false},before=JSON.stringify(e),remember=()=>{if(!e.known.includes(n.id))e.known.push(n.id);};let text='',effect:JourneyResult['effect'];
 if(e.completed)text=coastWinterJournal(p).find(j=>j.id===n.journeyId)!.hint;
 else if(n.journeyId==='unsent-log'){
  if(n.id==='cove-logbook'){remember();if(!e.stage){e.stage=1;text='航海日记：“我总想着下一次远行，却忘了把平安寄回家。最后一页被海风带进西侧洞湾，纸上画着回港的旧航标。”';}else if(e.stage===3){e.stage=4;e.completed=true;effect='discover';text='你们补上今天的归航日期，把修好航标的消息写进日记。页角的一艘沉船仍没有名字——等以后准备好了，再来读它的故事。现在，先让家里知道平安。';}else text=coastWinterJournal(next)[0].hint;}
  else if(n.id==='cove-log-page'){if(!e.stage)text='纸页上的字迹还很清楚。先找到沙丘旁的日记，才能知道这一页属于谁。';else{remember();e.stage=Math.max(e.stage,2);effect='discover';text='纸页画着栈桥上的风向板：“旗朝右，轮子一格；海风会把这道标记带给归来的小船。”';}}
  else if(e.stage<2)text='转轮卡在旧记号旁。洞湾里的日记页，或许写着它该指向哪里。';
  else if(e.stage===2){remember();e.values.signal=((e.values.signal??0)+1)%4;text=`风向板转到${e.values.signal}格。`;if(e.values.signal===1){e.stage=3;effect='discover';text+='旧旗舒展开来，栈桥重新有了清楚的归航标记。回日记旁写下今天吧。';}}
  else text='风向板已经固定在安全方向，归航旗正迎着风。';
 }else if(n.journeyId==='shell-echo'){
  const expected=[0,2,1],step=e.values.notes??0;effect='chime';if(n.tone===expected[step]){e.values.notes=step+1;e.stage=step+1;remember();text=['低音像远处的浪，提示下一声去找礁边的高音。','高音越过礁石，东侧浅滩的中音贝壳等着最后的回应。','低、高、中连成短短的归航曲。三枚贝壳的纹路留下柔光。'][step];if(step===2)e.completed=true;}else{e.values.notes=0;e.stage=0;text='浪声把这一次的节拍带走了，可以重新来。顺序是沙丘低音、礁边高音、浅滩中音。';}
 }else if(n.journeyId==='winter-lamps'){
  if(n.id==='winter-house-letter'){remember();if(!e.stage){e.stage=1;text='便笺：“风雪起来前，先让南边的两盏路灯亮起来。林间灯芯调二格，转弯挡风罩调一格。小红手套落在北边雪谷口，回家时顺路带上，热茶在炉边等。”';}else if(e.stage===3){e.stage=4;e.completed=true;effect='discover';text='手套放回炉边，便笺背面添上一行字：“灯亮着，就知道有人会回来。”门外仍飘着雪，屋里留好了两只暖暖的杯子。';}else text=coastWinterJournal(next)[2].hint;}
  else if(n.visual==='valve'){
   if(!e.stage)text='灯座上有木屋的雪花印记。先到炉边看看检修便笺。';
   else if(e.stage>=2)text='灯芯与挡风罩都已固定，路灯会继续亮着。';
   else{remember();const k=n.valueKey!,target=k==='forest'?2:1;e.values[k]=((e.values[k]??0)+1)%4;text=`${n.label}，当前${e.values[k]}格。${e.values[k]===target?'刻痕已对齐。':'便笺要求'+target+'格，可以继续调。'}`;if(e.values.forest===2&&e.values.turn===1){e.stage=2;effect='discover';text+='两盏路灯都亮了，去北边雪谷口取回手套吧。';}}
  }else if(e.stage<2)text='红手套被薄雪盖住。先修好南边的两盏路灯，让回家的路清楚一些。';
  else{remember();e.stage=3;effect='discover';text='抖掉薄雪，手套里还夹着半张雪花纸。沿路返回圣诞木屋，把它放在炉边便笺旁。';}
 }else{
  if(n.id==='winter-scarf-note'){remember();e.stage=Math.max(1,e.stage);text='围巾下面压着便签：“礼物没有走远。去西北方看脚印，认准朝西转弯的那一串，别跟着圆圆的雪球印。”';}
  else if(n.id==='winter-gift-tracks'){if(!e.stage)text='两串浅浅的印子停在这里。雪人旁的围巾便签能告诉你该跟哪一串。';else{remember();e.stage=Math.max(2,e.stage);effect='discover';text='小爪印朝西转，圆雪球印却回到了雪人身边。沿小爪印走向西边的松树，礼物就在树旁。';}}
  else if(e.stage<2)text='礼盒上的绳结画着一串爪印。先认清脚印，再给这份小惊喜落款。';
  else{remember();e.stage=3;e.completed=true;effect='discover';text='盒里是一枚雪花木章：“送给认真找路的你。”把木章按进手记，雪人身旁的位置正好留给一张合影。';}
 }
 const changed=JSON.stringify(e)!==before;if(changed)next.revision=p.revision+1;
 return{progress:changed?next:p,text,changed,...(effect?{effect}:{}),...(e.completed&&!entry(p,n.journeyId).completed?{completedNow:true}:{})};
}
