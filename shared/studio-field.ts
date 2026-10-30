import castle from '../source-assets/environment/v15/castle/interactions.json';
import beach from '../source-assets/environment/v15/beach/interactions.json';
import snow from '../source-assets/environment/v15/snow/interactions.json';
const castleHooks:any[]=castle.items.filter(h=>h.id.startsWith('c-viz-')).map(h=>({...h,kind:h.kind==='flight-hook'?'flight-challenge':h.kind==='clock-hook'?'short-event':'sequence-hook',sequence:h.id==='c-viz-pumpkin-order'?[{node:'garden-pumpkin-2',position:[-16,0,5.2]},{node:'garden-pumpkin-3',position:[-17.2,0,10]},{node:'garden-pumpkin-8',position:[-31,0,18]}]:h.kind==='flight-hook'?(h as any).path:h.sequence,approach:h.id==='c-viz-clock-clue'?[-27.2,-3.6,69.4]:undefined}));
export const STUDIO_HOOKS:any[]=[...castleHooks,...beach.hooks,...snow.hooks];
const winterLamps=[[-59.4,2.99557,90],[-50.4,3.83748,134],[-57.4,4.66235,183]];
export const STUDIO_FIELD_TEXT:Record<string,{title:string;hint:string;ending:string;souvenir:string}>={
 'c-viz-pumpkin-order':{title:'南瓜灯的暗号',hint:'花园三盏南瓜灯留下二、三、八的刻痕，依次轻触。',ending:'南瓜的暖光接上了井边的记号。',souvenir:'南瓜灯印'},
 'c-viz-clock-clue':{title:'停在三点的钟',hint:'密室的钟面藏着线索，轻拨短针到三点。',ending:'短针指向三点，钟后的旧纸露出一角。',souvenir:'古钟纸页'},
 'c-viz-moon-flight':{title:'绕过月台',hint:'从花园东侧起飞，沿五枚光环飞到月台。',ending:'古堡的窗光与月台在风里连成一线。',souvenir:'月台飞行印'},
 'winter-wishing-stone':{title:'雪中的心愿',hint:'雪原西边的刻纹石旁，有一颗星星等着回应。',ending:'星纹泛起柔光，你把一个小小心愿留在雪里。',souvenir:'雪原愿星'},
 'winter-tracked-treasure':{title:'脚印的尽头',hint:'循着雪谷里的脚印，走进蓝冰壁龛。',ending:'脚印的尽头亮起暖星，像一路陪伴的灯。',souvenir:'蓝冰星影'},
 'winter-three-lanterns':{title:'三盏冬灯',hint:'沿西侧雪林依次点亮三盏灯，望向连起的星座。',ending:'三盏冬灯在雪林中连成一段温暖的星座。',souvenir:'冬灯星图'},
 'winter-broom-traverse':{title:'穿过冬灯雪境',hint:'从雪原起飞，依次穿过九枚光环，飞到蓝冰雪谷。',ending:'雪原、密林、木屋与雪谷，在风里串成了一条长路。',souvenir:'冬境飞行印'},
 'cove-shell-sequence':{title:'贝壳的回声',hint:'沿沙湾依次轻触三枚贝壳，听潮声接上旋律。',ending:'三枚贝壳应和着海浪，沙里的小藏匣亮了起来。',souvenir:'潮声贝片'},
 'cove-alcove-pearl':{title:'洞湾里的微光',hint:'沿礁石通路进入洞湾，在贝壳壁龛前细看。',ending:'壁龛里的珍珠映出两粒小小的星光。',souvenir:'贝湾珠影'},
 'cove-drift-letter':{title:'漂流瓶里的信',hint:'沙湾的浮木边留着一只瓶子，读读它带来的消息。',ending:'信里写着：愿你总能与喜欢的人走到有风的地方。你将瓶子轻放回岸边。',souvenir:'海风信笺'},
 'cove-low-flight':{title:'掠过潮光',hint:'在栈桥尽头相约起飞，按顺序穿过海岸六环。',ending:'低空掠过潮线，风记住了这一趟飞行。',souvenir:'潮光飞行印'},
};
export function studioFieldPositions(h:any):{id:string;position:number[]}[]{return h.id==='winter-three-lanterns'?winterLamps.map((position,i)=>({id:'winter-puzzle-lamp-'+(i+1),position})):h.sequence[0]?.node?h.sequence.map((n:any)=>({id:n.node,position:n.position})):[{id:h.id,position:h.approach??[h.position.x,h.position.y,h.position.z]}];}
