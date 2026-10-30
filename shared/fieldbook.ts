import{STUDIO_HOOKS,STUDIO_FIELD_TEXT,studioFieldPositions}from'./studio-field';
/** Optional discoveries have their own record; no chapter, combat or unlock flags. */
export type FieldRole='gold'|'white';
export type FieldPoint={x:number;y:number;z:number};
export interface FieldBook {v:1;revision:number;found:string[];completed:string[];steps:Record<string,number>;best:Record<string,number>}
export interface FieldPlay {
 id:number;siteId:string;regionId:string;kind:'flight'|'treasure'|'hide';phase:'invited'|'countdown'|'prepare'|'active'|'result';proposer:FieldRole;
 participants:FieldRole[];startedAt:number;expiresAt:number;round:number;seeker:FieldRole;
 next:Record<FieldRole,number>;finished:Partial<Record<FieldRole,number>>;clues:FieldRole[];result:string;
}
export type FieldCommand={kind:'start';siteId:string;solo?:boolean}|{kind:'accept';id:number}|{kind:'cancel';id:number};
export const FIELD_VILLAGE='ch01-lantern-village',FIELD_GROVE='mushroom-grove',FIELD_HOME='player-home-villa';
export interface FieldContent {id:string;regionId:string;title:string;kind:'secret'|'event'|'flight'|'game';hint:string;ending:string;souvenir:string}
export const FIELD_CONTENT:FieldContent[]=[
 ...STUDIO_HOOKS.map(h=>({id:h.id,regionId:h.regionId,...STUDIO_FIELD_TEXT[h.id],kind:(h.kind==='flight-challenge'?'flight':h.kind==='short-event'?'event':'secret') as FieldContent['kind']})),
 {id:'root-window',regionId:FIELD_VILLAGE,title:'树根里的小窗',kind:'secret',hint:'村西林路有一片叶子挡住了树根的小窗，轻轻拨开看看。',ending:'一窝萤火虫从树根小窗升起，留下透明的翅影。',souvenir:'萤火翅影'},
 {id:'wind-shell',regionId:FIELD_VILLAGE,title:'听风的空贝',kind:'secret',hint:'风车小路旁，空贝上的两道刻痕朝着不同方向。依次拨动叶片，再听回声。',ending:'两片叶子同时向风，空贝发出柔软的长音。',souvenir:'风纹贝壳'},
 {id:'moon-dew',regionId:FIELD_GROVE,title:'月光留在菌褶里',kind:'secret',hint:'入口西侧的菌褶下有一滴不肯落下的露。等月光照来，再轻触它。',ending:'月光点亮菌褶，露珠映出一片倒悬的森林。',souvenir:'月露拓片'},
 {id:'cap-echo',regionId:FIELD_GROVE,title:'三个小小回声',kind:'secret',hint:'三枚菌盖刻着“一、三、二”。按这个顺序轻敲，听它们回应。',ending:'菌盖依次闪亮，一朵藏在石缝里的花打开了。',souvenir:'菌褶花瓣'},
 {id:'turning-stone',regionId:FIELD_HOME,title:'石头的另一面',kind:'secret',hint:'西门外林路的叠石上，三道水纹还没接齐。转动最上面那块。',ending:'三道水纹接成一条小溪，石缝露出一枚旧叶印。',souvenir:'溪纹叶印'},
 {id:'leaf-pocket',regionId:FIELD_HOME,title:'林路的叶袋',kind:'secret',hint:'外林转角有一只倒挂的叶袋。松开绳结，再接住里面的小东西。',ending:'一枚种子落进掌心，叶袋在风里重新展开。',souvenir:'银翅种子'},
 {id:'ribbon-return',regionId:FIELD_VILLAGE,title:'被风带走的丝带',kind:'event',hint:'花店旁的针线篮少了一卷丝带。沿着花瓣找，系好路边花束，再回来告诉主人。',ending:'丝带回到花束上，村里的小路多了一抹暖色。',souvenir:'花匠的感谢结'},
 {id:'glow-procession',regionId:FIELD_GROVE,title:'跟着伞灯回家',kind:'event',hint:'林路边一枚伞灯亮起；走近轻触它，下一枚会回应。沿着亮起的伞灯走完小路。',ending:'最后一枚伞灯点亮，光穿过树林，连成一条回家的路。',souvenir:'伞灯剪影'},
 {id:'woodland-lamps',regionId:FIELD_HOME,title:'让林路重新发光',kind:'event',hint:'西门的旧灯座接头松了。拨正沿外林小径的三盏灯，再回到灯座接通。',ending:'三盏林灯连成温暖的弧线，夜路有了新的陪伴。',souvenir:'林灯铭牌'},
 {id:'wind-mobile',regionId:FIELD_HOME,title:'给风一首歌',kind:'event',hint:'林路尽头的风铃停了。风向叶指向第二格，配重环指向第三格；调好后拉一下铃绳。',ending:'叶片转起来，配重轻轻摆动，停了很久的风铃又唱起歌。',souvenir:'风铃小谱'},
 {id:'village-sky',regionId:FIELD_VILLAGE,title:'晨光绕林',kind:'flight',hint:'村西起飞，按顺序穿过亮起的光环。三秒准备后计时；漏环可返回补过。',ending:'你把晨光串成了一个圆。',souvenir:'晨光飞行印'},
 {id:'grove-sky',regionId:FIELD_GROVE,title:'伞间穿行',kind:'flight',hint:'沿林间空隙穿过六枚光环。下一环会亮起，最后一环结束计时。',ending:'风从巨伞之间吹过，也记住了你的路线。',souvenir:'伞间飞行印'},
 {id:'split-treasure',regionId:FIELD_VILLAGE,title:'两半藏宝图',kind:'game',hint:'在村西的双人篮前相约。每人读一半线索，交换发现，一起打开藏匣。',ending:'两片纸合成一幅完整的小画，藏匣终于打开。',souvenir:'合页林间画'},
 {id:'woodland-hide',regionId:FIELD_HOME,title:'林路捉迷藏',kind:'game',hint:'西门外相约：25 秒躲藏、90 秒寻找，两轮交换寻找者。范围是门外整段林路，不能飞行。',ending:'轮流寻找的脚印，成了今天最好玩的记忆。',souvenir:'两串小脚印'},
];
export interface FieldNode {y?:number;id:string;contentId:string;regionId:string;x:number;z:number;label:string;kind:'relic';text:string;visual:'hollow'|'vane'|'dew'|'cap'|'stone'|'pocket'|'basket'|'ribbon'|'bouquet'|'glow'|'lamp'|'mobile'|'ring'|'clue'|'chest';index:number}
const node=(contentId:string,suffix:string,x:number,z:number,label:string,visual:FieldNode['visual'],index=0):FieldNode=>({id:'field-'+contentId+'-'+suffix,contentId,regionId:FIELD_CONTENT.find(c=>c.id===contentId)!.regionId,x,z,label,visual,index,kind:'relic',text:''});
export const FIELD_NODES:FieldNode[]=[
 ...STUDIO_HOOKS.flatMap(h=>studioFieldPositions(h).map((n,index)=>({id:n.id,contentId:h.id,regionId:h.regionId,x:n.position[0],y:n.position[1],z:n.position[2],label:(h.kind==='flight-challenge'?'开始飞行 · ':(h.id==='winter-three-lanterns'||h.sequence[0]?.node)?'轻触 · ':'看看 · ')+STUDIO_FIELD_TEXT[h.id].title,kind:'relic' as const,text:'',visual:'clue' as const,index}))),
 node('root-window','leaf',-23,27,'拨开树根前的叶片','hollow'),
 node('wind-shell','left',-27,43,'拨动左侧风向叶','vane',0),node('wind-shell','right',-23,46,'拨动右侧风向叶','vane',1),
 node('moon-dew','touch',-12,10,'观察菌褶下的露珠','dew'),
 ...[[-14,42],[-12,45],[-9,43]].map(([x,z],i)=>node('cap-echo',String(i),x,z,'轻敲第 '+(i+1)+' 枚菌盖','cap',i)),
 node('turning-stone','turn',-49,-17.3,'转动叠石','stone'),node('leaf-pocket','open',-35,-62.5,'松开叶袋绳结','pocket'),
 node('ribbon-return','start',-9,9,'查看花匠的针线篮','basket',0),node('ribbon-return','ribbon',-24,19,'拾起枝头的丝带','ribbon',1),node('ribbon-return','bouquet',-18,32,'为花束系上丝带','bouquet',2),
 ...[[5,8],[-5,26],[19,38],[7,61],[-22,83]].map(([x,z],i)=>node('glow-procession',String(i),x,z,'轻触伞灯','glow',i)),
 node('woodland-lamps','start',-42,-17.8,'接通林路灯座','lamp',0),...[[ -56.5,-32],[-58,-56],[-27,-60.5]].map(([x,z],i)=>node('woodland-lamps',String(i+1),x,z,'拨正第 '+(i+1)+' 盏林灯','lamp',i+1)),
 node('wind-mobile','pull',-13,-48,'轻拉风铃绳','mobile',0),node('wind-mobile','leaf',-13,-52,'调整风向叶刻度','vane',1),node('wind-mobile','weight',-7,-53,'调整配重环刻度','stone',2),
 node('village-sky','start',-32,14,'晨光绕林 · 起飞挑战','ring'),node('grove-sky','start',3,-4,'伞间穿行 · 起飞挑战','ring'),
 node('split-treasure','start',-30,29,'邀请伙伴拼藏宝图','basket',0),node('split-treasure','gold',-32,45,'展开金色半张图','clue',1),node('split-treasure','white',-16,13,'展开白色半张图','clue',2),node('split-treasure','chest',-25,34,'一起开启林间藏匣','chest',3),
 node('woodland-hide','start',-44,-17,'邀请伙伴捉迷藏','basket'),
];
export const FIELD_ROUTES:Record<string,FieldPoint[]>={
 ...Object.fromEntries(STUDIO_HOOKS.filter(h=>h.kind==='flight-challenge').map(h=>[h.id,h.sequence.map((q:any)=>({x:(q.position??q)[0],y:(q.position??q)[1],z:(q.position??q)[2]}))])),
 'village-sky':[[-34,9,25],[-38,13,44],[-29,18,62],[-12,20,58],[1,15,36],[-18,9,19]].map(([x,y,z])=>({x,y,z})),
 'grove-sky':[[2,8,8],[2,11,25],[23,14,38],[29,18,56],[22,20,82],[4,16,81]].map(([x,y,z])=>({x,y,z})),
};
export const HIDE_BOUNDS={minX:-73,maxX:-4,minZ:-72,maxZ:-15};
export const fieldNodes=(regionId:string)=>FIELD_NODES.filter(n=>n.regionId===regionId);
export const fieldContent=(id:string)=>FIELD_CONTENT.find(c=>c.id===id)!;
export const emptyFieldBook=():FieldBook=>({v:1,revision:0,found:[],completed:[],steps:{},best:{}});
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const role=(v:unknown):v is FieldRole=>v==='gold'||v==='white';
const num=(v:unknown,max=1e12):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const ids=new Set(FIELD_CONTENT.map(c=>c.id));
export function validateFieldBook(v:unknown):asserts v is FieldBook {
 if(!obj(v)||!keys(v,['v','revision','found','completed','steps','best'])||v.v!==1||!num(v.revision)||!Number.isSafeInteger(v.revision)||!obj(v.steps)||!obj(v.best))throw Error('探索手记损坏');
 for(const a of [v.found,v.completed])if(!Array.isArray(a)||a.length>32||!a.every(i=>ids.has(i))||new Set(a).size!==a.length)throw Error('探索发现记录损坏');
 if(!(v.completed as string[]).every(id=>(v.found as string[]).includes(id)))throw Error('探索结局缺少发现记录');
 if(!Object.entries(v.steps).every(([k,n])=>ids.has(k.split(':')[0])&&/^[a-z-]+(?::[ab])?$/.test(k)&&num(n,31)&&Number.isInteger(n))||Object.keys(v.steps).length>32)throw Error('探索机关刻度损坏');
 if(!Object.entries(v.best).every(([k,n])=>Object.hasOwn(FIELD_ROUTES,k.split(':')[0])&&['gold','white'].includes(k.split(':')[1])&&num(n,600)&&n>0)||Object.keys(v.best).length>Object.keys(FIELD_ROUTES).length*2)throw Error('飞行成绩损坏');
}
export function newestFieldBook(...values:unknown[]):FieldBook {let out=emptyFieldBook();for(const v of values){if(v===undefined)continue;validateFieldBook(v);if(v.revision>=out.revision)out=structuredClone(v);}return out;}
export function validFieldCommand(v:unknown):v is FieldCommand {
 if(!obj(v))return false;
 return v.kind==='start'?keys(v,['kind','siteId','solo'])&&typeof v.siteId==='string'&&FIELD_CONTENT.some(c=>c.id===v.siteId&&(c.kind==='flight'||c.kind==='game'))&&(v.solo===undefined||typeof v.solo==='boolean'):
 (v.kind==='accept'||v.kind==='cancel')&&keys(v,['kind','id'])&&num(v.id)&&Number.isSafeInteger(v.id);
}
export function validateFieldPlay(v:unknown):asserts v is FieldPlay {
 if(!obj(v)||!keys(v,['id','siteId','regionId','kind','phase','proposer','participants','startedAt','expiresAt','round','seeker','next','finished','clues','result'])||!num(v.id)||!Number.isSafeInteger(v.id)||typeof v.siteId!=='string'||!ids.has(v.siteId)||!role(v.proposer)||!role(v.seeker)||!['flight','treasure','hide'].includes(String(v.kind))||!['invited','countdown','prepare','active','result'].includes(String(v.phase))||!num(v.startedAt)||!num(v.expiresAt)||!num(v.round,2)||!Number.isInteger(v.round)||!obj(v.next)||!obj(v.finished)||typeof v.result!=='string'||v.result.length>200)throw Error('探索活动状态损坏');
 const c=fieldContent(v.siteId);if(v.regionId!==c.regionId||(v.kind==='flight'?c.kind!=='flight':v.siteId!==(v.kind==='hide'?'woodland-hide':'split-treasure')))throw Error('探索活动区域损坏');
 for(const a of [v.participants,v.clues])if(!Array.isArray(a)||a.length>2||!a.every(role)||new Set(a).size!==a.length)throw Error('探索活动成员损坏');
 if(!(v.participants as unknown[]).includes(v.proposer)||!(v.participants as unknown[]).length||!keys(v.next,['gold','white'])||!num(v.next.gold,FIELD_ROUTES[v.siteId as string]?.length??6)||!num(v.next.white,FIELD_ROUTES[v.siteId as string]?.length??6)||!Number.isInteger(v.next.gold)||!Number.isInteger(v.next.white)||!Object.entries(v.finished).every(([k,n])=>role(k)&&num(n,600)))throw Error('探索活动检查点损坏');
}
export const fieldHidesPartner=(p?:FieldPlay)=>!!p&&p.participants.length===2&&['treasure','hide'].includes(p.kind)&&p.phase!=='invited'&&p.phase!=='result';
export const fieldMovementLocked=(p:FieldPlay|undefined,r:FieldRole)=>!!p&&p.participants.includes(r)&&(p.phase==='countdown'||p.kind==='hide'&&p.phase==='prepare'&&p.seeker===r);

/** Finite prop bodies, shared by the actual runtime worlds; tiny ribbons remain decoration. */
export function fieldBodies(regionId:string,ground:(x:number,z:number)=>number){return fieldNodes(regionId).flatMap(n=>{
 const dimensions:Partial<Record<FieldNode['visual'],number[]>>={hollow:[.82,.75,.2],vane:[.12,1.5,.12],dew:[.72,.85,.72],cap:[.85,.85,.85],stone:[.66,.67,.66],pocket:[.12,1.7,.12],basket:[.75,.55,.55],glow:[.65,.8,.65],lamp:[.32,1.71,.3],mobile:[.12,2.6,.12],clue:[.5,.8,.32],chest:[.75,.6,.55]};
 const d=dimensions[n.visual];if(!d)return [];
 return [{id:n.id,kind:'field-prop',center:[n.x,ground(n.x,n.z)+d[1]/2,n.z],size:d,rotationY:0}];
});}
