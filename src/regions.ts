import castleConnections from '../source-assets/environment/v15/castle/connections.json';
import {studioRelease,BEACH,SNOW,TOWN,CITY,UNDERSEA} from './studio-regions';
import {studioWorld,studioGround} from './studio-physics';
import {fieldBodies} from '../shared/fieldbook';
import { CHAPTERS, type Chapter } from './content';
import { createChapterMovementWorld, landHeight, groundHeight, resolveObstacles, DEFAULT_WORLD_BOUNDS, pathDistance,inWater,sceneryTrees,authoredTrees, type WorldBounds, type WorldObstacle } from './world-surfaces';
import { STEP_HEIGHT, type MovementWorld, type StandingSurface } from './movement';
import type { AdventureSave } from '../shared/save';
import { regionalReadings } from './region-stories';
import { journeyNodes } from './journeys';
import {mushroomSurface,mushroomCeiling,resolveMushroom,ancientTreeObstacles,ancientTreeCeiling,type MushroomSolid} from './forest-physics';
import studioShapes from '../source-assets/environment/studio-rc1/physics.json';
import {STUDIO_HOUSE,houseFurniture,studioHouseObstacles,studioStemObstacles} from './studio-environment-physics';
import {spatialCandidates} from './spatial-candidates';
import {woodlandLayout,studioTreeObstacles,existingStudioTree} from './studio-woodland';
import {regionalTrees} from './regional-trees';
import {RIVER_FOOTWAY,treeBlocksFootway} from './world-surfaces';
import {VILLA_REGION,VILLA_BOUNDS,villaMovementWorld} from './villa-physics';
import {chapterBounds,MUSHROOM_FOREST_BOUNDS} from '../shared/world-bounds';
import densityMushrooms from '../source-assets/environment/v12/mushroom-density.json';
import {HOME_FOREST_PATH} from './villa-site';
export {RIVER_FOOTWAY} from './world-surfaces';

export type TravelMethod = 'map' | 'walk' | 'fly';
export interface RegionDefinition { id:string; name:string; chapterId:string; indoor:boolean; mapX:number; mapY:number; spawn:{x:number;z:number;y?:number}; description:string }
export interface RegionConnection { id:string; from:string; to:string; x:number;z:number;y?:number; arrival:{x:number;z:number;y?:number}; radius:number; label:string }
const chapterRegionNames=['灯火村 · 晨光林','银溪河岸','低语森林','月灯墓园','旧王古堡','云端山径','龙巢归途'];
export const REGIONS:RegionDefinition[]=[...CHAPTERS.map((c,i)=>({id:c.id,name:chapterRegionNames[i],chapterId:c.id,indoor:false,mapX:15+i*10,mapY:74-i*8,spawn:{...c.spawn},description:c.subtitle})),
  {id:UNDERSEA,name:'海底星光古城',chapterId:CHAPTERS[1].id,indoor:false,mapX:63,mapY:95,spawn:{x:-8,y:-9,z:-49},description:'从海湾旅行到珊瑚与水母深处，游入沉船、神殿和古城回廊。R 上浮，C 下潜。'},
  {id:CITY,name:'曼哈顿街区',chapterId:CHAPTERS[0].id,indoor:false,mapX:77,mapY:91,spawn:{x:0,y:0,z:-32},description:'从小镇车站走进砖石街墙，沿大道、咖啡馆与北街漫步。'},
  {id:TOWN,name:'欧洲小镇',chapterId:CHAPTERS[0].id,indoor:false,mapX:67,mapY:87,spawn:{x:14,y:0,z:-10},description:'沿暖灰石砖漫游街区，穿过城门、喷泉广场与旅店。'},
  {id:'mushroom-grove',name:'伞光蘑菇林',chapterId:CHAPTERS[0].id,indoor:false,mapX:22,mapY:42,spawn:{x:0,z:-8},description:'沿晨光林的苔路，听菌盖下的雨声。'},
  {id:'mushroom-home',name:'苔灯蘑菇屋',chapterId:CHAPTERS[0].id,indoor:true,mapX:15,mapY:25,spawn:{x:0,z:-2,y:0},description:'圆窗旁的灯火，为每位赶路人留一张椅子。'},
  {id:'canopy-garden',name:'风铃树屋',chapterId:CHAPTERS[0].id,indoor:false,mapX:44,mapY:62,spawn:{x:0,z:-8},description:'循着木阶登上树冠，回望来时的森林。'},
  {id:'canopy-home',name:'树梢暖阁',chapterId:CHAPTERS[0].id,indoor:true,mapX:48,mapY:42,spawn:{x:0,z:-2,y:0},description:'木香、织毯和风铃，藏在枝叶之间。'},
  {id:VILLA_REGION,name:'林缘家园',chapterId:CHAPTERS[0].id,indoor:false,mapX:36,mapY:82,spawn:{x:29.6,y:.26,z:38},description:'村外林间的家，庭院、三层居室和一座树屋。'},
  {id:BEACH,name:'潮光海湾',chapterId:CHAPTERS[1].id,indoor:false,mapX:53,mapY:77,spawn:{x:0,y:1.202,z:-21},description:'沿河岸木道走向海风，贝壳、洞湾与栈桥等待足迹。'},
  {id:SNOW,name:'冬灯雪境',chapterId:CHAPTERS[5].id,indoor:false,mapX:83,mapY:30,spawn:{x:0,y:1.417830348,z:-20},description:'从雪原穿过覆雪密林，冬灯木屋与蓝冰雪谷一路相伴。'},
];
export const NEW_REGION_IDS=REGIONS.filter(r=>!CHAPTERS.some(c=>c.id===r.id)).map(r=>r.id);
const terrainChapters=new Map<string,Chapter>();
export {MUSHROOM_FOREST_BOUNDS};
export const regionBounds=(id:string):WorldBounds=>studioRelease(id)?.bounds??(id===VILLA_REGION?VILLA_BOUNDS:id==='mushroom-grove'?MUSHROOM_FOREST_BOUNDS:chapterBounds(id));
export const getRegion=(id:string):RegionDefinition|undefined=>REGIONS.find(r=>r.id===id)??(()=>{const c=CHAPTERS.find(c=>c.id===id);return c?{id:c.id,name:c.title,chapterId:c.id,indoor:false,mapX:85,mapY:16,spawn:{...c.spawn},description:c.subtitle}:undefined;})();
export const isStoryRegion=(id:string)=>CHAPTERS.some(c=>c.id===id);
export function allowedRegions(save?:Pick<AdventureSave,'chapterId'|'completedChapters'>|null, developerPreview=false):string[]{
  const installed=[...new Set([...REGIONS.map(r=>r.id),...CHAPTERS.map(c=>c.id)])];
  if(developerPreview)return installed;
  const ids=new Set([CHAPTERS[0].id,...NEW_REGION_IDS.filter(id=>!studioRelease(id))]);
  if(save){const current=CHAPTERS.find(c=>c.id===save.chapterId||c.index===Number(save.chapterId.slice(2)));if(current)ids.add(current.id);
    for(const saved of save.completedChapters){const i=CHAPTERS.findIndex(c=>c.id===saved||c.index===Number(saved.slice(2)));if(i>=0){ids.add(CHAPTERS[i].id);if(CHAPTERS[i+1])ids.add(CHAPTERS[i+1].id);}}}
  for(const r of REGIONS)if(studioRelease(r.id)&&!isStoryRegion(r.id)&&ids.has(r.chapterId))ids.add(r.id);
  return installed.filter(id=>ids.has(id));
}
const links:RegionConnection[]=[];
function pair(id:string,a:string,b:string,ap:{x:number;z:number;y?:number},bp:{x:number;z:number;y?:number},aa=ap,ba=bp){
  links.push({id:id+'-out',from:a,to:b,...ap,arrival:{...ba},radius:3.2,label:getRegion(b)!.name},
    {id:id+'-back',from:b,to:a,...bp,arrival:{...aa},radius:3.2,label:getRegion(a)!.name});
}
pair('cove-undersea',BEACH,UNDERSEA,{x:16,y:1.323867135,z:-14},{x:-8,y:-9,z:-55},{x:16,y:1.323867135,z:-19},{x:-8,y:-9,z:-49});
pair('town-city',TOWN,CITY,{x:14,y:.64,z:56},{x:0,y:0,z:-38},{x:14,y:.64,z:51},{x:0,y:0,z:-32});
pair('village-town',CHAPTERS[0].id,TOWN,{x:46,z:110},{x:14,y:0,z:-14},{x:42,z:106},{x:14,y:0,z:-10});
pair('mountain-snow','ch06-cloud-mountain',SNOW,{x:-30,z:18},{x:0,y:1.434,z:-28},{x:-24,z:18},{x:0,y:1.417830348,z:-20});
pair('river-cove','ch02-windmill-river',BEACH,{x:31,z:78},{x:0,y:1.202,z:-28},{x:25,z:78},{x:0,y:1.202,z:-21});
pair('village-mushroom',CHAPTERS[0].id,'mushroom-grove',{x:-31,z:48},{x:0,z:-14},{x:-27,z:48},{x:0,z:-8});
pair('village-canopy',CHAPTERS[0].id,'canopy-garden',{x:31,z:73},{x:0,z:-14},{x:27,z:73},{x:0,z:-8});
pair('village-villa',CHAPTERS[0].id,VILLA_REGION,{x:31,z:59},{x:27.5,y:.26,z:44},{x:27,z:57},{x:29.6,y:.26,z:38});
pair('mushroom-canopy','mushroom-grove','canopy-garden',{x:29,z:36},{x:-28,z:4},{x:24,z:36},{x:-23,z:4});
pair('forest-mushroom',CHAPTERS[2].id,'mushroom-grove',{x:-31,z:48},{x:-31,z:74},{x:-27,z:48},{x:-27,z:74});
pair('forest-canopy',CHAPTERS[2].id,'canopy-garden',{x:31,z:73},{x:30,z:75},{x:27,z:73},{x:26,z:75});
pair('mushroom-door','mushroom-grove','mushroom-home',{x:0,z:60.3},{x:0,z:-3.5},{x:0,z:58},{x:0,z:-2});
pair('canopy-door','canopy-garden','canopy-home',{x:0,z:42,y:8},{x:0,z:-4},{x:0,z:39,y:8},{x:0,z:-2});
// The original story exit remains authoritative; these links only revisit already unlocked chapters.
for(let i=0;i<CHAPTERS.length-1;i++)pair('story-'+i,CHAPTERS[i].id,CHAPTERS[i+1].id,{...CHAPTERS[i].exit},{x:0,z:-16},{x:CHAPTERS[i].exit.x,z:CHAPTERS[i].exit.z-6},{...CHAPTERS[i+1].spawn});
for(const replacement of castleConnections.connections){const at=links.findIndex(l=>l.id===replacement.id);if(at<0)throw Error('Missing stable castle link');links[at]={...replacement};}
export const REGION_CONNECTIONS=links;
export const regionConnections=(id:string)=>links.filter(l=>l.from===id);
export const MUSHROOM_TERRACES=[{id:'mushroom-step-1',x:15,z:35,width:3,depth:3,height:.5},{id:'mushroom-step-2',x:18,z:39,width:3,depth:3,height:.95},{id:'mushroom-step-3',x:21,z:43,width:3,depth:3,height:1.4}];
const BASE_GIANT_MUSHROOMS=[{x:-16,z:8,r:1.15,h:10,cap:6},{x:16,z:15,r:1.4,h:13,cap:7},{x:-19,z:32,r:1.8,h:16,cap:8},{x:15,z:55,r:1.15,h:11,cap:6},{x:-15,z:70,r:1.6,h:14,cap:7.5},{x:25,z:79,r:1.2,h:12,cap:6.5},{x:-10,z:20,h:6,cap:3,r:.65},{x:11,z:41,h:7,cap:3.5,r:.8},{x:-9,z:53,h:6.5,cap:3,r:.65},
 {x:-34,z:13,r:1.25,h:14,cap:7.4},{x:33,z:4,r:1.4,h:15,cap:8.1},{x:-39,z:38,r:1.9,h:18,cap:9},{x:40,z:31,r:1.3,h:15,cap:7.6},
 {x:-32,z:53,r:1.4,h:12,cap:7},{x:38,z:59,r:1.6,h:17,cap:8.5},{x:-39,z:82,r:1.8,h:19,cap:9.5},{x:44,z:88,r:1.5,h:15,cap:8.1},
 {x:-19,z:95,r:1.4,h:13,cap:7.6},{x:15,z:100,r:1.75,h:17,cap:9},{x:-43,z:111,r:2.2,h:20,cap:10},{x:40,z:116,r:1.6,h:17,cap:8.5},
 {x:-9,z:128,r:1.9,h:19,cap:10},{x:23,z:140,r:1.75,h:18,cap:9.5},{x:-37,z:143,r:1.6,h:16,cap:8.5},
 {x:-25,z:118,r:.85,h:7,cap:3.6},{x:33,z:133,r:.7,h:6,cap:3.3},{x:-45,z:63,r:.95,h:8,cap:4.1},{x:47,z:45,r:.8,h:7.5,cap:3.9},
 {x:3,z:112,r:.85,h:8.5,cap:4.6},{x:-24,z:147,r:.7,h:6.5,cap:3.5},{x:47,z:146,r:1.25,h:13,cap:6.7},
 {x:-44,z:-2,r:1.3,h:15,cap:7.6},{x:45,z:13,r:1.6,h:16,cap:8.5},{x:-30,z:29,r:1.1,h:11,cap:5.5},{x:-47,z:52,r:1.5,h:14,cap:7.2},
 {x:32,z:48,r:1.1,h:10,cap:5.5},{x:-45,z:75,r:1.2,h:11,cap:6.4},{x:42,z:103,r:1.1,h:10,cap:5.5},{x:-4,z:90,r:1.2,h:11,cap:6.5},
 {x:-49,z:136,r:1.3,h:13,cap:6.5},{x:6,z:138,r:1.3,h:13,cap:6.7},{x:47,z:131,r:1.2,h:12,cap:6.5},
 {x:-7,z:41,r:.75,h:7,cap:3.6},{x:48,z:73,r:.8,h:7.5,cap:3.7},{x:-51,z:105,r:.75,h:7,cap:3.6},{x:7,z:121,r:.9,h:9,cap:4.1},{x:27,z:124,r:.75,h:7,cap:3.6},
];
export const FOREST_COPIES=[{x:0,z:0},...[-106,0,106].flatMap(x=>[0,148,296,444].filter(z=>x!==0||z!==0).map(z=>({x,z})))];
export const FOREST_EXPANSION_PATHS=[
 ...[-55,55].map(x=>({id:'forest-long-'+x,points:[[x,0],[x,580]],width:4,kind:'dirt' as const})),
 ...[0,155,303,451,583].map(z=>({id:'forest-cross-'+z,points:[[-145,z],[145,z]],width:3.8,kind:'dirt' as const})),
 {id:'forest-entry-spur',points:[[4,30],[4,0],[55,0]],width:3.8,kind:'dirt' as const},
 ...FOREST_COPIES.slice(1).map((p,i)=>({id:'forest-copy-loop-'+i,points:[[-27,60],[-30,110],[1,143],[33,140],[27,108],[20,36],[4,30],[-27,60]].map(([x,z])=>[x+p.x,z+p.z]),width:3.4,kind:'dirt' as const})),
] as Chapter['paths'];
const expansionClear=(x:number,z:number,r:number)=>FOREST_EXPANSION_PATHS.every(p=>p.points.slice(1).every((b,i)=>{const a=p.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)>p.width/2+r+.8;}));
export const BASE_FOREST_MUSHROOMS=FOREST_COPIES.flatMap((p,i)=>BASE_GIANT_MUSHROOMS.filter(m=>!i||expansionClear(m.x+p.x,m.z+p.z,m.r)).map(m=>({...m,x:m.x+p.x,z:m.z+p.z,h:m.h*1.35})));
export const GIANT_MUSHROOMS=[...BASE_FOREST_MUSHROOMS,...densityMushrooms];
export const MUSHROOM_CAPS:MushroomSolid[]=[...GIANT_MUSHROOMS.map((m,i)=>({...m,shapeId:(m.h<2.5?'medium':'giant') as 'medium'|'giant',base:regionGroundHeight('mushroom-grove',m.x,m.z),id:'giant-mushroom-cap-'+i})),{x:0,z:65,cap:studioShapes.house.radius,h:studioShapes.house.height,shapeId:'house',base:regionGroundHeight('mushroom-grove',0,65),id:'mushroom-house-roof'}];
/** World-space contract shared with the editable cabin asset. Roof thickness is vertical. */
export const CANOPY_ROOF={halfWidth:4.25,minZ:43.6,maxZ:52.4,ridgeY:14,eaveY:12.1,thickness:.22,cabin:{halfWidth:3.5,minZ:44.5,maxZ:51.5,floorY:8},surfaceId:'canopy-cabin-roof'} as const;
const canopyRoofSlope=(CANOPY_ROOF.ridgeY-CANOPY_ROOF.eaveY)/CANOPY_ROOF.halfWidth;
export function canopyRoofHeight(x:number,z:number):number|null {
 return Math.abs(x)<=CANOPY_ROOF.halfWidth&&z>=CANOPY_ROOF.minZ&&z<=CANOPY_ROOF.maxZ?CANOPY_ROOF.ridgeY-canopyRoofSlope*Math.abs(x):null;
}
/** Intersect the sloped solid with a vertical body, then resolve its actual horizontal span. */
function canopyRoofObstacles(x:number,z:number,feetY:number,height:number):WorldObstacle[]{
 const roof=CANOPY_ROOF,top=roof.ridgeY-canopyRoofSlope*Math.min(roof.halfWidth,Math.abs(x)),out:WorldObstacle[]=[];
 // Like terrain slopes, paws follow the surface at their centre. The normal step allowance
 // lets a grounded dog walk uphill without its uphill foot/contact radius pushing it away.
 if(feetY>=top-STEP_HEIGHT-.001)return out;
 const strip=(lo:number,hi:number,minZ:number,maxZ:number,bottom:number)=>{
  if(hi<=lo)return;
  if(lo===0){out.push({x:0,z:(minZ+maxZ)/2,r:0,shape:'box',width:hi*2,depth:maxZ-minZ,bottom,top:roof.ridgeY});return;}
  for(const sign of [-1,1])out.push({x:sign*(lo+hi)/2,z:(minZ+maxZ)/2,r:0,shape:'box',width:hi-lo,depth:maxZ-minZ,bottom,top:roof.ridgeY});
 };
 if(feetY+height>=roof.cabin.floorY)strip(0,Math.min(roof.cabin.halfWidth,(roof.ridgeY-roof.thickness-feetY-.015)/canopyRoofSlope),roof.cabin.minZ,roof.cabin.maxZ,roof.cabin.floorY);
 // At this body's height only part of each roof slope is solid; air above the eaves stays clear.
 strip(Math.max(0,(roof.ridgeY-roof.thickness-feetY-height)/canopyRoofSlope),Math.min(roof.halfWidth,(roof.ridgeY-feetY-.015)/canopyRoofSlope),roof.minZ,roof.maxZ,roof.eaveY-roof.thickness);
 return out;
}
export const REGIONAL_OBSTACLES:Record<string,WorldObstacle[]>={
 'mushroom-grove':[...GIANT_MUSHROOMS.flatMap(m=>studioStemObstacles(m,regionGroundHeight('mushroom-grove',m.x,m.z))),...studioHouseObstacles(regionGroundHeight('mushroom-grove',0,65),65),...FOREST_COPIES.slice(1).flatMap(p=>{const base=regionGroundHeight('mushroom-grove',p.x,p.z+65);return [{x:p.x,z:p.z+65,r:0,shape:'box' as const,width:2.6,depth:1.14,top:base+1.49},{x:p.x+2.2,z:p.z+65,r:0,shape:'box' as const,width:1.06,depth:.48,top:base+.75},{x:p.x-2,z:p.z+65,r:.18,top:base+3.22}];})],
 'mushroom-home':houseFurniture.map(o=>({...o,top:o.top!-.16})),
 'canopy-garden':[],
 'canopy-home':[{x:-5,z:6.3,r:0,shape:'box',width:3.55,depth:1.85,top:1.83},{x:1.8,z:6.6,r:0,shape:'box',width:3.6,depth:2,top:1.31},{x:0,z:10.7,r:0,shape:'box',width:3,depth:.8,top:2.2},{x:7,z:8,r:.7,top:5.8},{x:6.8,z:3.3,r:.675,top:2.4},{x:-7,z:9,r:.50,top:1.8},{x:-2.95,z:6,r:0,shape:'box',width:.7,depth:.8,top:1.1}],
};
export function getRegionChapter(regionId:string,storyChapter:Chapter=CHAPTERS[0]):Chapter {
 const existing=CHAPTERS.find(c=>c.id===regionId);if(existing)return existing;
 const region=getRegion(regionId);if(!region)return storyChapter;
 if(studioRelease(regionId))return {...CHAPTERS.find(c=>c.id===region.chapterId)!,id:region.chapterId,title:region.name,subtitle:region.description,spawn:{...region.spawn},camp:{...region.spawn},exit:{...region.spawn},intro:[region.description],ending:[],landmarks:[],paths:[],terrain:{},encounters:[],interactions:[],secrets:[],quest:{title:regionId===UNDERSEA?'海底漫游':regionId===CITY?'城市漫步':regionId===TOWN?'小镇漫步':regionId===SNOW?'冬灯漫游':'海风拾贝',steps:[],side:{id:regionId+'-visit',title:region.name,intro:region.description,steps:[],ending:'记下沿途的风景。',reward:{}}},event:{id:regionId+'-quiet',title:region.name,trigger:{x:0,z:0,radius:0},description:'',spawns:[],resolution:''},palette:regionId===UNDERSEA?{sky:'#123944',fog:'#245966',ground:'#6f8f8e',leaf:'#547d85',accent:'#d5c691'}:regionId===CITY?{sky:'#c4dfeb',fog:'#dde2db',ground:'#aaa291',leaf:'#527955',accent:'#e4bf8a'}:regionId===TOWN?{sky:'#c4dfeb',fog:'#dde2db',ground:'#aaa291',leaf:'#527955',accent:'#e4bf8a'}:regionId===SNOW?{sky:'#b8cfdf',fog:'#dbe5ef',ground:'#dae8f1',leaf:'#738d91',accent:'#e9c58d'}:{sky:'#9dd8ea',fog:'#c5e3e5',ground:'#d7c398',leaf:'#527955',accent:'#edd9a5'}};
 const mushroom=regionId.startsWith('mushroom');
 return {...CHAPTERS[0],id:region.chapterId,index:1,title:region.name,subtitle:region.description,biome:'forest',spawn:{...region.spawn},camp:{...region.spawn},exit:{x:0,z:-14},
  intro:[region.description],ending:[],palette:{sky:'#c4ddd8',fog:'#d8e3c9',ground:'#72875b',leaf:'#527955',accent:mushroom?'#f5c88e':'#efca88'},
  landmarks:[],paths:region.indoor?[]:regionId===VILLA_REGION?[{id:'home-forest-loop',points:HOME_FOREST_PATH as [number,number][],width:3,kind:'dirt'}]:mushroom?[{id:'mushroom-main',points:[[0,-14],[0,-8],[-5,12],[4,30],[0,55]],width:4.8,kind:'dirt'},{id:'mushroom-loop',points:[[4,30],[20,36],[22,49],[0,55]],width:2.8,kind:'dirt'},{id:'mushroom-canopy-path',points:[[4,30],[24,36],[32,36]],width:3,kind:'dirt'},{id:'mushroom-oldforest-path',points:[[0,55],[-7,60],[-27,60],[-31,74]],width:3,kind:'dirt'},
   {id:'mushroom-north-loop',points:[[-27,60],[-23,76],[-25,84],[-31,89],[-30,110],[-16,143],[1,149],[33,151],[38,125],[27,108],[22,89],[15,79],[10,74],[10,57],[0,55]],width:3.6,kind:'dirt'},
   {id:'mushroom-east-ramble',points:[[22,49],[30,65],[31,85],[27,108]],width:3.2,kind:'dirt'},
   {id:'mushroom-deep-crossing',points:[[-30,110],[-11,109],[3,100],[27,108]],width:2.7,kind:'dirt'},...FOREST_EXPANSION_PATHS
  ]:[{id:'canopy-main',points:[[0,-14],[0,-8],[-5.5,8],[-5.5,24],[.5,24],[.5,39]],width:4,kind:'dirt'},{id:'canopy-return',points:[[-31,4],[-5.5,8]],width:3,kind:'dirt'},{id:'canopy-oldforest',points:[[0,-8],[20,4],[32,30],[32,55],[30,75]],width:3,kind:'dirt'}],
  terrain:mushroom&&!region.indoor?{platforms:MUSHROOM_TERRACES}: {},encounters:[],interactions:regionalReadings(regionId),secrets:[],quest:{title:'林间小憩',steps:[],side:{id:regionId+'-visit',title:'留一段林间记忆',intro:'走近灯火与风铃。',steps:[],ending:'旅途有了新的回忆。',reward:{}}},event:{id:regionId+'-quiet',title:'林间小憩',trigger:{x:0,z:0,radius:0},description:'',spawns:[],resolution:''}};
}
export function regionGroundHeight(regionId:string,x:number,z:number):number {
 if(studioRelease(regionId))return studioGround(regionId,x,z);
 if(regionId===VILLA_REGION)return .26;
 const r=getRegion(regionId);if(r?.indoor)return 0;
 let ch=terrainChapters.get(regionId);if(!ch){ch=getRegionChapter(regionId);terrainChapters.set(regionId,ch);}const height=landHeight(ch,x,z);
 if(regionId==='mushroom-grove'){const d=Math.hypot(x,z-65),t=Math.max(0,Math.min(1,(d-7)/5)),blend=t*t*(3-2*t);return landHeight(ch,0,65)*(1-blend)+height*blend;}
 return height;
}
export function canopySurface(x:number,z:number):StandingSurface|null {
 const start=regionGroundHeight('canopy-garden',-5.5,8);
 if(x>=-7&&x<=-4&&z>=8&&z<=23)return {y:start+(4-start)*(z-8)/15,walkable:true,normalY:.96,id:'canopy-stair-lower'};
 if(x>=-7&&x<=2&&z>=23&&z<=26)return {y:4,walkable:true,normalY:1,id:'canopy-turn'};
 if(x>=-1&&x<=2&&z>=26&&z<=38)return {y:4+4*(z-26)/12,walkable:true,normalY:.95,id:'canopy-stair-upper'};
 if(x>=-7&&x<=7&&z>=38&&z<=54)return {y:8,walkable:true,normalY:1,id:'canopy-platform'};
 return null;
}
export function canopyCameraGroundHeight(x:number,z:number,cameraY:number):number {
 const ground=regionGroundHeight('canopy-garden',x,z),deck=canopySurface(x,z);
 // A camera below a suspended stair/deck belongs to the space underneath it.
 return deck&&deck.y<=cameraY?Math.max(ground,deck.y):ground;
}
/** Authored V6 story props share collision with the corresponding rendered structures. */
export function storyDetailObstacles(ch:Chapter):WorldObstacle[]{
 const out:WorldObstacle[]=[],circle=(x:number,z:number,r:number,height:number)=>out.push({x,z,r,top:groundHeight(ch,x,z)+height}),box=(x:number,z:number,width:number,depth:number,height:number)=>out.push({x,z,r:0,shape:'box',width,depth,top:groundHeight(ch,x,z)+height});
 if(ch.biome==='village')circle(-12,18,.95,.95);
 if(ch.biome==='forest')for(const x of [-19,19])for(const z of [30,37,44])circle(x,z,.65,4.2);
 if(ch.biome==='graveyard'){for(const x of [-26,-20])box(x,57,.6,7,5.2);box(-23,60.4,6.4,.65,5.2);}
 if(ch.biome==='castle')for(const x of [22,32])box(x,53,.42,12.5,.5);
 if(ch.biome==='mountain')for(const [x,z]of [[-24.3,46],[-17.7,46],[19.7,72],[26.3,72]])circle(x,z,3.4,7);
 return out;
}
/** Small authored mechanism bodies. Their interaction radius extends beyond the
 * solid prop, so reading/turning is possible beside it without walking through it. */
export function journeyPropObstacles(regionId:string):WorldObstacle[]{
 const sizes:Partial<Record<ReturnType<typeof journeyNodes>[number]['visual'],readonly [number,number,number]>>={notice:[.65,.18,1.3],valve:[1.05,.75,1.8],lever:[1,.7,1.6],chest:[1.1,.75,.9],gauge:[.4,.15,2.5],letter:[.58,.4,.38],toolbox:[1.25,.66,1.05]};
 return journeyNodes(regionId).flatMap(node=>{
  if(node.id.endsWith('-memory'))return [];
  const size=sizes[node.visual],base=regionGroundHeight(regionId,node.x,node.z),out:WorldObstacle[]=[];
  const box=(dx:number,dz:number,width:number,depth:number,top:number,bottom?:number)=>out.push({x:node.x+dx,z:node.z+dz,r:0,shape:'box',width,depth,top:base+top,...(bottom===undefined?{}:{bottom:base+bottom})});
  const circle=(r:number,top:number,bottom?:number)=>out.push({x:node.x,z:node.z,r,top:base+top,...(bottom===undefined?{}:{bottom:base+bottom})});
  if(size)box(0,0,size[0],size[1],size[2]);
  if(node.visual==='candle'){circle(.325,.6);circle(.095,1.12,.6);}
  if(node.visual==='mirror'){box(0,0,.95,.68,.28);circle(.045,1.65,.28);circle(.47,2.14,1.18);}
  if(node.visual==='lantern'){circle(.065,1.6);box(0,0,.51,.42,1.96,1.38);}
  if(node.visual==='shelter'){
   for(const x of [-.88,.88])box(x,.32,.1,.1,2.43);
   box(0,.32,1.92,.14,2.395,2.245);
   // Ten narrow slabs follow the actual pitched felt roof within 1 cm, retaining
   // an open corridor below it and clear air above its finite thickness.
   const angle=.14,depth=1.25*Math.cos(angle)+.085*Math.sin(angle),slope=Math.tan(angle),halfThickness=.085/(2*Math.cos(angle)),slice=depth/10;
   for(let i=0;i<10;i++){const z=-depth/2+(i+.5)*slice,y=2.4-z*slope,margin=halfThickness+slice*slope/2;box(0,z,2.04,slice+.001,y+margin,y-margin);}
  }
  return out;
 });
}
function obstacleCeilings(obstacles:WorldObstacle[],x:number,z:number,y:number,radius:number):number[]{
 return obstacles.filter(o=>o.bottom!==undefined&&o.bottom>y&&(o.shape==='box'?Math.abs(x-o.x)<(o.width??0)/2+radius&&Math.abs(z-o.z)<(o.depth??0)/2+radius:Math.hypot(x-o.x,z-o.z)<o.r+radius)).map(o=>o.bottom!);
}
export function regionWoodland(regionId:string,chapter=getRegionChapter(regionId)){
 if(regionId===VILLA_REGION)return [];
 if(getRegion(regionId)?.indoor||!['village','river','forest'].includes(chapter.biome))return [];
 const old=isStoryRegion(regionId)?[...sceneryTrees(chapter),...authoredTrees(chapter)]:[];
 const clear=[chapter.spawn,chapter.camp,chapter.exit,...chapter.interactions,...chapter.secrets,...chapter.encounters,...regionConnections(regionId),...journeyNodes(regionId)];
 return woodlandLayout(regionId,regionBounds(regionId),chapter.biome,(x,z)=>{
  if(treeBlocksFootway(chapter,x,z))return true;
  if(inWater(chapter,x,z,5)||pathDistance(chapter,x,z)<5||clear.some(p=>Math.hypot(x-p.x,z-p.z)<7)||old.some(p=>Math.hypot(x-p.x,z-p.z)<4.8)||chapter.landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<8*(p.scale??1)))return true;
  if(chapter.biome==='village'&&Math.abs(x)<21&&z<28)return true;
  if((chapter.terrain.platforms??[]).some(p=>Math.abs(x-p.x)<p.width/2+4&&Math.abs(z-p.z)<p.depth/2+4))return true;
  if(regionId==='mushroom-grove'&&(Math.hypot(x,z-65)<17||GIANT_MUSHROOMS.some(p=>Math.hypot(x-p.x,z-p.z)<p.cap+3)||FOREST_COPIES.some(p=>Math.hypot(x-p.x,z-p.z-65)<7)))return true;
  return regionId==='canopy-garden'&&Math.hypot(x,z-43)<22;
 });
}
export function createRegionMovementWorld(regionId:string,chapter:Chapter=getRegionChapter(regionId),getFlags:()=>readonly string[]=()=>[]):MovementWorld {
 if(studioRelease(regionId))return studioWorld(regionId);
 if(regionId===VILLA_REGION)return villaMovementWorld;
 const field:WorldObstacle[]=fieldBodies(regionId,(x,z)=>regionGroundHeight(regionId,x,z)).map(o=>({x:o.center[0],z:o.center[2],r:0,shape:'box' as const,width:o.size[0],depth:o.size[2],bottom:o.center[1]-o.size[1]/2,top:o.center[1]+o.size[1]/2}));
 const trees=[...regionWoodland(regionId,chapter),...regionalTrees(regionId).map(t=>existingStudioTree(t.x,t.z,t.s,t.templateSeed??t.seed,chapter.biome))];
 const wood=trees.flatMap(t=>studioTreeObstacles(t,regionGroundHeight(regionId,t.x,t.z)));
 if(isStoryRegion(regionId)){
  const base=createChapterMovementWorld(chapter,getFlags),extra=[...field,...storyDetailObstacles(chapter),...journeyPropObstacles(regionId),...wood],near=spatialCandidates(extra,o=>o.shape==='box'?Math.hypot(o.width??0,o.depth??0)/2:o.r);
  const resolveAt=(x:number,z:number,y:number,r=.66,h=2.1)=>{const p=base.resolveAt(x,z,y,r,h);return resolveObstacles(near(p.x,p.z,r),p.x,p.z,r,y,h,regionBounds(regionId));};
  const surfaceAt=(x:number,z:number,y:number,r=.66)=>{const ordinary=base.surfaceAt(x,z,y,r),h=chapter.biome==='river'&&getFlags().includes('journey-river-footway')?riverFootwayHeight(x,z,r):null;return h!==null&&h<=y+.3&&(!ordinary||h>ordinary.y)?{y:h,walkable:true,normalY:.99,id:'journey-river-footway'}:ordinary;};
  return {...base,bounds:regionBounds(regionId),surfaceAt,resolveAt,ceilingAt(x,z,y,r=.66){const tops=obstacleCeilings(near(x,z,r),x,z,y,r),ordinary=base.ceilingAt?.(x,z,y,r);if(ordinary!==null&&ordinary!==undefined)tops.push(ordinary);return tops.length?Math.min(...tops):null;},isSafe(x,z,y,r=.66){const p=resolveAt(x,z,y,r),s=surfaceAt(x,z,y,r);return !!s?.walkable&&Math.abs(s.y-y)<.15&&Math.hypot(p.x-x,p.z-z)<.05;}};
 }
 const region=getRegion(regionId)!;
 const obstacles=[...field,...(REGIONAL_OBSTACLES[regionId]??[]),...journeyPropObstacles(regionId),...wood];
 const nearbyObstacles=regionId==='mushroom-grove'?spatialCandidates(obstacles,o=>o.shape==='box'?Math.hypot(o.width??0,o.depth??0)/2:o.r):()=>obstacles;
 const nearbyCaps=spatialCandidates(MUSHROOM_CAPS,m=>m.cap);
 const surfaceAt=(x:number,z:number,y:number,radius=.66):StandingSurface|null=>{
  if(region.indoor){const inside=regionId==='mushroom-home'?Math.hypot(x,z)<=STUDIO_HOUSE.radius-radius:Math.abs(x)<=8-radius&&z>=-5+radius&&z<=12-radius;return inside?{y:0,walkable:true,normalY:1,id:'interior-floor'}:null;}
  const bounds=regionBounds(regionId);
  if(x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius)return null;
  if(regionId==='canopy-garden'){
   const roof=CANOPY_ROOF,top=canopyRoofHeight(x,z);
   if(top!==null&&top<=y+.3&&Math.abs(x)<roof.halfWidth-radius*.22&&z>roof.minZ+radius*.22&&z<roof.maxZ-radius*.22)
    return {y:top,walkable:true,normalY:1/Math.hypot(1,canopyRoofSlope),id:roof.surfaceId};
  }
  if(regionId==='mushroom-grove'){
   const caps=nearbyCaps(x,z).map(m=>mushroomSurface(m,x,z,y)).filter((s):s is StandingSurface=>!!s).sort((a,b)=>b.y-a.y);
   if(caps.length)return caps[0];
   if(Math.hypot(x,z-65)<4.3||Math.abs(x)<1.3&&z>59.3&&z<61){const base=regionGroundHeight(regionId,0,65),floor=base+STUDIO_HOUSE.floor;if(floor<=y+.3)return {y:floor,walkable:true,normalY:1,id:'mushroom-house-floor'};}
  }
  const rooftops=nearbyObstacles(x,z,radius).filter(o=>o.walkableTop!==false&&o.bottom!==undefined&&o.top!==undefined&&o.top<=y+.3&&(o.shape==='box'?Math.abs(x-o.x)<(o.width??0)/2-radius*.22&&Math.abs(z-o.z)<(o.depth??0)/2-radius*.22:Math.hypot(x-o.x,z-o.z)<o.r-radius*.22));
  if(rooftops.length)return {y:Math.max(...rooftops.map(o=>o.top!)),walkable:true,normalY:1,id:'forest-canopy-landing'};
  const elevated=regionId==='canopy-garden'?canopySurface(x,z):null;
  if(elevated&&elevated.y<=y+.3)return elevated;
  const terrace=regionId==='mushroom-grove'?MUSHROOM_TERRACES.find(p=>Math.abs(x-p.x)<p.width/2-radius*.22&&Math.abs(z-p.z)<p.depth/2-radius*.22&&p.height<=y+.3):null;
  if(terrace)return {y:terrace.height,walkable:true,normalY:1,id:terrace.id};
  const h=regionGroundHeight(regionId,x,z);return h<=y+.3?{y:h,walkable:true,normalY:.98,id:'ground'}:null;
 };
 const resolveAt=(x:number,z:number,y:number,radius=.66,height=2.1)=>{
  if(region.indoor){if(regionId==='mushroom-home'){const d=Math.hypot(x,z),max=STUDIO_HOUSE.radius-radius;if(d>max){x=x/d*max;z=z/d*max;}}else{x=Math.max(-8+radius,Math.min(8-radius,x));z=Math.max(-5+radius,Math.min(12-radius,z));}}
  const extra:WorldObstacle[]=[];
  // Continuous railing leaves a clear opening at the stairs and at the landing approach.
  if(regionId==='canopy-garden'){
   extra.push(...ancientTreeObstacles(regionGroundHeight(regionId,7,43),y,height));
   extra.push(...canopyRoofObstacles(x,z,y,height));
   for(const side of [-1,1])extra.push({x:side*7,z:46,r:0,shape:'box',width:.15,depth:16,bottom:7.7,top:9.3});
   extra.push({x:0,z:54,r:0,shape:'box',width:14,depth:.15,bottom:7.7,top:9.3},{x:-4,z:38,r:0,shape:'box',width:6,depth:.15,bottom:7.7,top:9.3},{x:5,z:38,r:0,shape:'box',width:4,depth:.15,bottom:7.7,top:9.3});
  }
  let p=resolveObstacles([...nearbyObstacles(x,z,radius),...extra],x,z,radius,y,height,regionBounds(regionId));
  if(regionId==='mushroom-grove')for(let pass=0;pass<2;pass++)for(const m of nearbyCaps(p.x,p.z,radius))p=resolveMushroom(m,p.x,p.z,y,radius,height);
  return p;
 };
 return {bounds:regionBounds(regionId),surfaceAt,resolveAt,ceilingAt(x,z,y,radius=.66){
    if(region.indoor)return regionId==='mushroom-home'?STUDIO_HOUSE.ceiling:5.8;
    const bottoms=nearbyObstacles(x,z,radius).filter(o=>o.bottom!==undefined&&o.bottom>y&&(o.shape==='box'?Math.abs(x-o.x)<(o.width??0)/2+radius&&Math.abs(z-o.z)<(o.depth??0)/2+radius:Math.hypot(x-o.x,z-o.z)<o.r+radius)).map(o=>o.bottom!);
    if(regionId==='mushroom-grove')for(const m of nearbyCaps(x,z,radius)){const b=mushroomCeiling(m,x,z,y,radius);if(b!==null)bottoms.push(b);}
    if(regionId==='canopy-garden'){
     const branch=ancientTreeCeiling(regionGroundHeight(regionId,7,43),x,z,y,radius);if(branch!==null)bottoms.push(branch);
     const roof=CANOPY_ROOF;
     const distanceZ=Math.max(roof.minZ-z,0,z-roof.maxZ),reachX=Math.sqrt(Math.max(0,radius*radius-distanceZ*distanceZ));
     if(distanceZ<=radius+1e-9&&Math.abs(x)<=roof.halfWidth+reachX+1e-9){
      const underside=roof.ridgeY-canopyRoofSlope*Math.min(roof.halfWidth,Math.abs(x)+reachX)-roof.thickness;
      if(underside>y)bottoms.push(underside);
     }
    }
    if(regionId==='canopy-garden'&&Math.abs(x)<7+radius&&z>38-radius&&z<54+radius&&y<7.7)bottoms.push(7.7);
    return bottoms.length?Math.min(...bottoms):null;
  },isSafe(x,z,y,r=.66){const s=surfaceAt(x,z,y,r),p=resolveAt(x,z,y,r,2.1);return !!s&&Math.abs(s.y-y)<.15&&Math.hypot(p.x-x,p.z-z)<.05;}};
}
/** Optional west-bank crossing revealed by the water-level journey. Bank ramps
 * meet existing ground; it does not open any story exit or original main gate. */
export function riverFootwayHeight(x:number,z:number,radius=.66):number|null {
 const f=RIVER_FOOTWAY;if(Math.abs(x-f.x)>f.width/2-radius*.22||z<f.minZ||z>f.maxZ)return null;
 const ch=CHAPTERS.find(c=>c.biome==='river')!,start=groundHeight(ch,x,f.minZ),end=groundHeight(ch,x,f.maxZ);
 return z<62?start+(f.deckY-start)*(z-f.minZ)/3:z>69?f.deckY+(end-f.deckY)*(z-69)/3:f.deckY;
}
