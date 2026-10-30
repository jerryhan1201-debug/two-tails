import {castleAnchor,CASTLE_MAP} from './castle-rebind';
import type {JourneyEntry,JourneyProgress} from '../shared/journeys';
import type {JourneyNode,JourneyJournalEntry,JourneyResult,JourneyVisual} from './journeys';

const grave='ch04-moonlit-graveyard',castle='ch05-candle-castle',mountain='ch06-cloud-mountain',village='ch01-lantern-village',forest='ch03-wandering-woods';
const voices:Record<string,{speaker:string;portrait:string}>={'memorial-names':{speaker:'夜班守墓簿',portrait:'ghost'},'castle-window':{speaker:'温室采光图',portrait:'portrait'},'mountain-shelters':{speaker:'避风屋的便条',portrait:'bird'},'home-lights':{speaker:'居民合写的修复清单',portrait:'postman'}};
const node=(journeyId:string,regionId:string,id:string,x:number,z:number,label:string,visual:JourneyVisual,extra:Partial<JourneyNode>={}):JourneyNode=>({journeyId,regionId,id,x,z,label,visual,kind:'relic',text:'',...voices[journeyId],...extra});
export const LATER_JOURNEY_NODES:JourneyNode[]=[
  node('memorial-names',grave,'memorial-register',-12,19,'翻开夜班守墓簿','notice'),
  node('memorial-names',grave,'memorial-weaver-note',-31,38,'读缝补匠的旧围裙','letter'),
  node('memorial-names',grave,'memorial-ferryman-note',30,35,'读摆渡人的船票','letter'),
  node('memorial-names',grave,'memorial-gardener-note',-30,61,'读园丁的种籽纸','letter'),
  node('memorial-names',grave,'memorial-weaver-candle',-14,45,'选择缝补匠灯座的纹样','candle',{valueKey:'weaver'}),
  node('memorial-names',grave,'memorial-ferryman-candle',14,44,'选择摆渡人灯座的纹样','candle',{valueKey:'ferryman'}),
  node('memorial-names',grave,'memorial-gardener-candle',-18,74,'选择园丁灯座的纹样','candle',{valueKey:'gardener'}),
  node('memorial-names',grave,'memorial-lighting',-7,68,'一起点亮记名灯','lever'),
  node('castle-window',castle,'window-optics-note',-13,22,'读温室采光图','notice'),
  node('castle-window',castle,'window-mirror-west',-15,34,'转动西侧导光镜','mirror',{valueKey:'west'}),
  node('castle-window',castle,'window-mirror-centre',9,34,'转动中央导光镜','mirror',{valueKey:'centre'}),
  node('castle-window',castle,'window-mirror-north',9,57,'转动北侧导光镜','mirror',{valueKey:'north'}),
  node('castle-window',castle,'window-clamp',18,59,'一起固定温室的光路','lever'),
  node('mountain-shelters',mountain,'shelter-rescue-note',-29,19,'读避风屋的求助便条','notice'),
  node('mountain-shelters',mountain,'shelter-tool-cart',1,80,'从修补车换一件工具','toolbox'),
  node('mountain-shelters',mountain,'shelter-draft',-5,72.2,'检查漏风的第一处避风棚','shelter',{valueKey:'draft'}),
  node('mountain-shelters',mountain,'shelter-beam',10.5,87.2,'检查松动的第二处避风棚','shelter',{valueKey:'beam'}),
  node('mountain-shelters',mountain,'shelter-lamp',21,94.7,'检查熄灯的第三处避风棚','shelter',{valueKey:'lamp'}),
  node('mountain-shelters',mountain,'shelter-lost-nest',-24,87,'一起护住迷路幼鸟的篮子','nest'),
  node('mountain-shelters',mountain,'shelter-homecoming',-24,17,'把幼鸟交到避风屋门前','chest'),
  node('home-lights',village,'home-return-ledger',-2,8,'读居民合写的修复清单','notice'),
  node('home-lights',village,'home-light-village',-17,12,'给村里的回信灯分一份光','lantern',{valueKey:'village'}),
  node('home-lights',forest,'home-light-forest',-18,20,'给溪林的引路灯分一份光','lantern',{valueKey:'forest'}),
  node('home-lights',mountain,'home-light-mountain',-11,27,'给云山的避风灯分一份光','lantern',{valueKey:'mountain'}),
  node('home-lights',village,'home-restoration',-11,20,'一起送出三份修复星光','lever'),
];
for(const n of LATER_JOURNEY_NODES)if(n.regionId===castle)Object.assign(n,castleAnchor(n.id));
const blank=():JourneyEntry=>({stage:0,known:[],values:{},completed:false});
const entry=(p:JourneyProgress,id:string)=>p.entries[id]??blank();
const optics=CASTLE_MAP.mirrorSolverRebind;
export const MIRROR_SOURCE={x:optics.newSource[0],y:optics.newSource[1],z:optics.newSource[2]},MIRROR_RECEIVER={x:optics.newReceiver[0],y:optics.newReceiver[1],z:optics.newReceiver[2]};
export interface LightSegment {from:{x:number;z:number};to:{x:number;z:number};hit?:string}
/** Orthogonal authored light path, evaluated from the actual current arrows.
 * Wrong turns visibly terminate at a wall or return into an already visited mirror. */
export function castleLightPath(e:JourneyEntry):{segments:LightSegment[];reached:boolean;mirrors:string[]} {
  const mirrors=LATER_JOURNEY_NODES.filter(n=>n.visual==='mirror'),targets=[...mirrors,{id:'window-receiver',...MIRROR_RECEIVER}];
  const directions=[[0,1],[1,0],[0,-1],[-1,0]],seen=new Set<string>(),segments:LightSegment[]=[];let at={...MIRROR_SOURCE},direction=0;
  for(let step=0;step<7;step++){
    const [dx,dz]=directions[direction],ahead=targets.map(t=>({t,d:(t.x-at.x)*dx+(t.z-at.z)*dz,side:Math.abs((t.x-at.x)*dz-(t.z-at.z)*dx)})).filter(t=>t.d>.01&&t.side<.01).sort((a,b)=>a.d-b.d)[0];
    if(!ahead){const distance=dx>0?(optics.newRayBounds.x[1]-at.x):dx<0?(at.x-optics.newRayBounds.x[0]):dz>0?(optics.newRayBounds.z[1]-at.z):(at.z-optics.newRayBounds.z[0]);segments.push({from:{...at},to:{x:at.x+dx*distance,z:at.z+dz*distance}});break;}
    segments.push({from:{...at},to:{x:ahead.t.x,z:ahead.t.z},hit:ahead.t.id});
    if(ahead.t.id==='window-receiver')return {segments,reached:true,mirrors:[...seen]};
    if(seen.has(ahead.t.id))break;seen.add(ahead.t.id);at={x:ahead.t.x,y:MIRROR_SOURCE.y,z:ahead.t.z};
    direction=e.values[mirrors.find(n=>n.id===ahead.t.id)!.valueKey!]??0;
  }
  return {segments,reached:false,mirrors:[...seen]};
}
export function laterJournal(p:JourneyProgress):JourneyJournalEntry[]{
 const specs=[
  {id:'memorial-names',title:'替夜归的人记住名字',regionId:grave,hint:'沿墓园两条支路读围裙、船票与种籽纸；让三个灯座各自回应那个人生前做过的事。'},
  {id:'castle-window',title:'温室缺失的一束光',regionId:castle,hint:'按镜座箭头观察光的去向，把西侧窗光经三面导光镜送进东边接光器，再共同固定。'},
  {id:'mountain-shelters',title:'给晚归的小兽留一条暖路',regionId:mountain,hint:'读避风屋便条；在修补车选择毡布、绳索或灯油，对应修好漏风、松梁和熄灯，再去西侧观星路接幼鸟回家。'},
  {id:'home-lights',title:'那些修好以后的小事',regionId:village,hint:'主线归途结束后回灯火村，带着五段支线的回应，给村庄、溪林与云山各留一份光。'},
 ];
 const endings:Record<string,string>={'memorial-names':'灯座重新写上了名字。居民被记住的事情留在守墓簿里。','castle-window':'温室接到了稳定的窗光，冷了许久的幼苗开始向光舒展。','mountain-shelters':'三处避风棚已修好，幼鸟也已回家。沿途暖灯仍然亮着。','home-lights':'三份星光已经分别回到家园。旧结局仍保留，新的日常继续生长。'};
 return specs.map((s):JourneyJournalEntry=>{const e=entry(p,s.id);let hint=s.hint;
  if(s.id==='mountain-shelters'&&e.stage===2)hint='幼鸟已经安稳地待在篮里。沿山路回西侧山脚的避风屋，把篮子交到门前接收匣。';
  else if(s.id==='mountain-shelters'&&['draft','beam','lamp'].every(k=>e.values[k]===1))hint='三处避风棚都已修好。和伙伴到西侧观星路的巢篮旁，各按一次 E 护住幼鸟。';
  if(s.id==='castle-window'&&castleLightPath(e).reached)hint='温室金环已经接到窗光。和伙伴到东侧金环旁的夹座，各按一次 E 固定镜架。';
  if(s.id==='home-lights'&&e.stage)hint=`三份光要送到实际三地：灯火村西侧回信灯（${e.values.village??0}份）、低语森林西南引路灯（${e.values.forest??0}份）、云端山径西侧避风灯（${e.values.mountain??0}份）。各留一份后回村与伙伴确认。`;
  return {...s,status:e.completed?'complete':e.stage?'active':'unstarted',stage:e.stage,hint:e.completed?(endings[s.id]??hint):hint};});
}
export function laterPrompt(n:JourneyNode,e:JourneyEntry){
 if(n.visual==='candle')return `${n.label} · 当前${['叶片','缝针','小船'][e.values[n.valueKey!]??0]}`;
 if(n.visual==='mirror')return `${n.label} · 箭头向${['北','东','南','西'][e.values[n.valueKey!]??0]}`;
 if(n.visual==='toolbox')return `${n.label} · 当前${['未取工具','毡布','绳索','灯油'][e.values.tool??0]}`;
 if(n.visual==='lantern')return `${n.label} · 当前${e.values[n.valueKey!]??0}份`;
 return n.label;
}
export function useLaterJourney(p:JourneyProgress,e:JourneyEntry,n:JourneyNode,confirmed:boolean,endingRestored:boolean):Pick<JourneyResult,'text'|'confirmation'|'effect'> {
 let text='',confirmation=false,effect:JourneyResult['effect'];const know=(id:string)=>{if(!e.known.includes(id))e.known.push(id);};
 if(e.completed)return {text:laterJournal(p).find(j=>j.id===n.journeyId)?.hint??'这里已经安顿好了。'};
 if(n.journeyId==='memorial-names'){
  e.stage=Math.max(e.stage,1);
  if(n.id==='memorial-register')text='守墓簿里有三处被雨水洇花的名字。缝补匠留下围裙，摆渡人留下船票，园丁留下种籽纸。请分别读一读，再让三个灯座的纹样回应他们做过的事；选错可以重新转，不会惊扰任何人。';
  else if(n.id==='memorial-weaver-note'){know('weaver');text='围裙口袋里插着一枚缝针。便笺写道：“阿纫每晚替别人补好衣角，自己的围裙却总忘了缝。”灯座不该只剩一个模糊的名字。';}
  else if(n.id==='memorial-ferryman-note'){know('ferryman');text='船票背面画着一只小船：“老渡最后一班船从不收迟归人的钱。他说，只要对岸还有灯，就该有人等。”';}
  else if(n.id==='memorial-gardener-note'){know('gardener');text='种籽纸上压着一片叶：“青芽总把第一把种籽留给别人。她不识字，却认得每一株快要口渴的草。”';}
  else if(n.visual==='candle'){const key=n.valueKey!;e.values[key]=((e.values[key]??0)+1)%3;text=`灯座转到${['叶片','缝针','小船'][e.values[key]]}纹。烛火尚未点燃；对应的旧物里留着这个人的故事。`;effect='discover';}
  else if(n.id==='memorial-lighting'){
   if(!['weaver','ferryman','gardener'].every(k=>e.known.includes(k)))text='守墓簿还有空白。先把三件旧物都读过，别急着凭图案猜一个人的名字。';
   else if(e.values.weaver!==1||e.values.ferryman!==2||(e.values.gardener??0)!==0)text='烛芯只亮了一瞬，守墓簿仍敞着。围裙里是缝针，船票上是小船，种籽纸里压着叶；可以再去转动对应灯座。';
   else if(!confirmed){confirmation=true;text='三件旧物终于各自找到回应。请伙伴也在记名灯旁按 E，一起把名字读完。';}
   else{e.stage=2;e.completed=true;text='阿纫、老渡、青芽。你们轮流读出名字，三盏灯沿支路亮起。守墓簿里补上的不是战绩，而是补过的衣角、等过的晚归人和分出去的种籽。';effect='discover';}
  }
 }else if(n.journeyId==='castle-window'){
  e.stage=Math.max(e.stage,1);
  if(n.id==='window-optics-note')text='采光图：“每次转动，箭头依次朝北、东、南、西。光遇到导光镜就沿箭头继续；若照回旧镜，会困在旧路里。请看实际光束的落点，把窗光送到东侧温室的金环。”';
  else if(n.visual==='mirror'){e.values[n.valueKey!]=((e.values[n.valueKey!]??0)+1)%4;const beam=castleLightPath(e);text=`${n.label.replace('转动','')}朝向${['北','东','南','西'][e.values[n.valueKey!]]}。${beam.reached?'金环收到了窗光，幼苗的叶尖亮起来了。请到金环旁共同固定光路。':`窗光经过${beam.mirrors.length}面镜子，最后落在${beam.segments.at(-1)?.hit?'一面已经经过的镜子':'墙面'}；顺着光束看看下一步该转哪一面。`}`;effect='discover';}
  else if(n.id==='window-clamp'){
   if(!castleLightPath(e).reached)text='金环仍是暗的。先顺着西窗的光束观察三面镜子的箭头，让光真正照到这里。';
   else if(!confirmed){confirmation=true;text='光已经照进温室。请伙伴也到夹座旁按 E，一起固定镜架，别让窗风又把它吹偏。';}
   else{e.stage=2;e.completed=true;text='你们锁紧镜架，窗光留在温室里。窗下旧牌写着“等春天”；一片刚展开的小叶，把“等”字遮住了。';effect='discover';}
  }
 }else if(n.journeyId==='mountain-shelters'){
  e.stage=Math.max(e.stage,1);
  if(n.id==='shelter-rescue-note')text='避风屋的便条：“幼鸟在西侧观星路等我们，可三处回程棚坏了。修补车上有毡布、绳索和灯油；先读破损处，再取合适的一件。取错可直接换，工具不会被浪费。暖路亮起后，请两位一起护住幼鸟的篮子。”';
  else if(n.visual==='toolbox'){e.values.tool=(e.values.tool??0)%3+1;text=`取出${['','毡布','绳索','灯油'][e.values.tool]}。另外两件仍在车上，按 E 可换一件；各处棚子的破损会告诉你需要什么。`;}
  else if(n.visual==='shelter'){
   const key=n.valueKey! as 'draft'|'beam'|'lamp',required={draft:1,beam:2,lamp:3}[key],problem={draft:'风从棚布的裂口穿进来，需要毡布补住。',beam:'横梁的绑扎松了，需要绳索重新固定。',lamp:'灯芯完好，但油碟干了，需要添灯油。'}[key];
   if(e.values[key]===1)text='这处棚已经修好，暖光护住了回程路。';
   else if(e.values.tool!==required)text=`${problem}当前工具仍带在身边，去修补车换好再来，试错不会损坏棚子。`;
   else{e.values[key]=1;text=`${problem}你们把它修好了。${['draft','beam','lamp'].every(k=>e.values[k]===1)?'三处暖灯连起来了，现在去西侧观星路接幼鸟。':'还有别处的晚归人需要一盏灯。'}`;effect='discover';}
  }else if(n.id==='shelter-lost-nest'){
   if(!['draft','beam','lamp'].every(k=>e.values[k]===1))text='幼鸟把头缩进篮子，回程棚仍有暗处。先修好漏风棚、松梁棚和熄灯棚，再带它们回家。';
   else if(e.stage>=2)text='幼鸟已经在护好风的篮子里，带回南边避风屋门前吧。';
   else if(!confirmed){confirmation=true;text='请伙伴也到篮子旁按 E，一位压住篮盖、一位系好暖布，才能把幼鸟护好。';}
   else{e.stage=2;e.values.carried=1;text='篮盖与暖布固定好了，幼鸟终于把头探出来。沿暖灯回到南边避风屋，把篮子交给等着它们的家人。';effect='discover';}
  }else if(n.id==='shelter-homecoming'){
   if(e.stage<2)text='避风屋门边放着空巢。家人指向西侧观星路：先修好三处暖棚，再去接幼鸟。';
   else{e.stage=3;e.completed=true;e.values.carried=0;text='门一开，屋里的小兽就围了过来。幼鸟从暖布里跳进熟悉的巢，家人把多余的毡布留在门边：下一位晚归的，也许还会用得到。';effect='discover';}
  }
 }else if(n.journeyId==='home-lights'){
  if(!endingRestored)return {text:'修复清单留了三行空白：“等星渠重新接通，再一起商量怎样把光留给每个家。”这段日常会在主线归途结束后继续。'};
  e.stage=Math.max(e.stage,1);
  if(n.id==='home-return-ledger')text='居民把五段新消息写在一起：雨夜邮路、浅滩航图、记名灯、温室窗光、云山暖棚。三个灯座共用三份星光，村庄、溪林、云山各一份；谁也不用再靠熄灭别人的灯来照亮自己。';
  else if(n.visual==='lantern'){
   const key=n.valueKey!,wanted=((e.values[key]??0)+1)%3,total=['village','forest','mountain'].reduce((s,k)=>s+(k===key?wanted:e.values[k]??0),0);
   if(total>3)text='只有三份修复星光。可以再按已经分到两份的灯座，把它退回零份，再留出一份给别处。';
   else{e.values[key]=wanted;text=`这座灯分到${wanted}份光，清单还剩${3-total}份。每座灯最多两份；再按可退回零份重新分。`;effect='discover';}
  }else if(n.id==='home-restoration'){
   const missing=['rain-post','river-levels','memorial-names','castle-window','mountain-shelters'].filter(id=>!entry(p,id).completed);
   if(missing.length)text=`清单还等着${missing.length}段支线的回信。看看旅途手记里没有完成的那几段，居民的灯需要先有能照亮的日常。`;
   else if(!['village','forest','mountain'].every(k=>e.values[k]===1))text='三份光还没有各自找到家。请给村庄、溪林与云山各一份，再回来一起送出。';
   else if(!confirmed){confirmation=true;text='三座灯都各有一份光。请伙伴也在清单旁按 E，一起把这份共同修好的日常送出去。';}
   else{e.stage=2;e.completed=true;text='村庄的信箱、溪林的窗与云山的棚依次亮起。你们没有改写已经走完的归途，只在它后面接上了一天：有人回信，有人开窗，有人等晚归的伙伴。';effect='discover';}
  }
 }
 return {text,...(confirmation?{confirmation:true}:{}),...(effect?{effect}:{})};
}
