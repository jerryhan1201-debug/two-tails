import type { Chapter, Landmark, TerrainRectangle } from './content';
import { JOURNEY_NODES } from './journeys';
import {existingStudioTree,studioTreeObstacles} from './studio-woodland';
import {spatialCandidates} from './spatial-candidates';
import {chapterBounds} from '../shared/world-bounds';

/** Shared physical chapter geometry. No renderer/browser dependencies. */
export type WorldObstacle = { x:number; z:number; r:number; shape?:'box'; width?:number; depth?:number; rotation?:number; bottom?:number; top?:number;walkableTop?:boolean };
export interface WorldBounds {minX:number;maxX:number;minZ:number;maxZ:number}
export const DEFAULT_WORLD_BOUNDS:WorldBounds={minX:-40,maxX:40,minZ:-20,maxZ:112};
export const heightAt = (x:number,z:number) => Math.sin(x*.11)*.28 + Math.sin(z*.08)*.36 + Math.cos((x+z)*.055)*.22;
export function pathDistance(chapter:Chapter,x:number,z:number) {
  let best=999;
  for(const path of chapter.paths)for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }return best;
}
export function waterProfile(chapter:Chapter,w:TerrainRectangle,x:number) {
  const edge=Math.min(x-(w.x-w.width/2),w.x+w.width/2-x),t=Math.max(0,Math.min(1,edge/4.3));
  if(chapter.biome==='village')return {z:w.z+Math.sin((x-25)*.13)*.52+Math.sin((x-25)*.31)*.16,half:w.depth/2*Math.sqrt(t)*(1+.055*Math.sin((x-25)*.65))};
  // Banks meander only away from the authored crossings, keeping bridge ends on dry ground.
  if(chapter.biome==='river'){
    const nearBridge=chapter.landmarks.filter(l=>l.kind==='bridge'&&Math.abs(l.z-w.z)<8).reduce((d,l)=>Math.min(d,Math.abs(l.x-x)),999);
    const bend=Math.min(1,Math.max(0,(nearBridge-4)/9));
    return {z:w.z+Math.sin(x*.16+w.z)*.75*bend,half:w.depth/2*(1+.09*Math.sin(x*.23)*bend)};
  }return {z:w.z,half:w.depth/2};
}
export function landHeight(chapter:Chapter,x:number,z:number) {
  const base=heightAt(x,z),away=Math.min(1,Math.max(0,(pathDistance(chapter,x,z)-2.5)/7));
  if(chapter.biome==='village')return base+away*Math.min(1,Math.max(0,(z-25)/16))*(.55+.4*Math.sin(x*.16+z*.13))+away*.35*Math.sin(x*.12-z*.065);
  if(chapter.biome==='forest')return base+away*(1.2+.8*Math.sin(x*.12+z*.11)) + away*.4*Math.cos(z*.24);
  if(chapter.biome==='river')return base+away*(.42+.35*Math.sin(x*.18-z*.10));
  return base;
}
export const waterLevel=(chapter:Chapter,x:number,z:number)=>Math.min(.13,landHeight(chapter,x,z)-.14);
export function groundHeight(chapter:Chapter,x:number,z:number) {
  let h=landHeight(chapter,x,z);
  for(const water of chapter.terrain.water??[]){const profile=waterProfile(chapter,water,x),edge=Math.min(water.width/2-Math.abs(x-water.x),profile.half-Math.abs(z-profile.z)),level=waterLevel(chapter,water.x,water.z);
    if(edge>-1.15)h+=Math.max(0,level+.17-h)*Math.min(1,(edge+1.15)/1.15);
    if(edge>0)h-=Math.min(1,edge/.85)*1.25;
  }return h;
}
export function bridgeLocal(x:number,z:number,l:{x:number;z:number;rotation?:number}) {const a=l.rotation??0,dx=x-l.x,dz=z-l.z;return {x:dx*Math.cos(a)-dz*Math.sin(a),z:dx*Math.sin(a)+dz*Math.cos(a)};}
export function bridgeDeck(chapter:Chapter,l:Landmark,d:number) {const s=l.scale??1,rot=l.rotation??0,end=4*s,t=Math.max(0,Math.min(1,(d+end)/(end*2)));return groundHeight(chapter,l.x-Math.sin(rot)*end,l.z-Math.cos(rot)*end)*(1-t)+groundHeight(chapter,l.x+Math.sin(rot)*end,l.z+Math.cos(rot)*end)*t+.08+Math.sin(t*Math.PI)*.38*s;}
export function inWater(chapter:Chapter,x:number,z:number,margin=0){return (chapter.terrain.water??[]).some(w=>{const p=waterProfile(chapter,w,x);return Math.abs(x-w.x)<w.width/2+margin&&Math.abs(z-p.z)<p.half+margin;});}
export const RIVER_FOOTWAY={x:-27,width:4,minZ:59,maxZ:72,deckY:.55} as const;
export function treeBlocksFootway(chapter:Chapter,x:number,z:number){const f=RIVER_FOOTWAY;return chapter.biome==='river'&&Math.abs(x-f.x)<f.width/2+4&&z>f.minZ-4&&z<f.maxZ+4;}
export function sceneryTrees(chapter:Chapter){
  let r=523+chapter.index*731;const rand=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};const biome=chapter.biome,count=biome==='forest'?175:biome==='mountain'||biome==='dragon'?72:135;
  const trees:{x:number;z:number;s:number;seed:number;templateSeed?:number}[]=[];
  for(let i=0;i<count;i++){const x=(rand()-.5)*108,z=-15+rand()*141;
    if(rand()>.7+.2*Math.sin(x*.13+z*.08)||inWater(chapter,x,z,2)||(biome==='village'&&x>-20&&x<20&&z<23)||pathDistance(chapter,x,z)<3.5||Math.hypot(x-chapter.camp.x,z-chapter.camp.z)<7.5||chapter.landmarks.some(l=>Math.hypot(l.x-x,l.z-z)<5.5*(l.scale??1))||[...chapter.interactions,...chapter.secrets].some(it=>Math.hypot(it.x-x,it.z-z)<3.5)||(chapter.terrain.platforms??[]).some(p=>Math.abs(p.x-x)<p.width/2+2&&Math.abs(p.z-z)<p.depth/2+2)||(biome==='castle'&&Math.abs(x)<30))continue;
    trees.push({x,z,s:1.05+rand()*.78,seed:i+1});
  }
  // Keep both earlier tree batches stable; apply the requested second +35% to the first expanded total.
  const originals=trees.slice(),target=Math.ceil((originals.length+Math.ceil(originals.length*.35))*1.35)-originals.length,mechanisms=JOURNEY_NODES.filter(n=>n.regionId===chapter.id);
  for(let attempt=0,added=0;attempt<4000&&added<target&&originals.length;attempt++){
    const x=(rand()-.5)*108,z=-15+rand()*141;
    if(inWater(chapter,x,z,2)||(biome==='village'&&x>-20&&x<20&&z<23)||pathDistance(chapter,x,z)<4.5||Math.hypot(x-chapter.camp.x,z-chapter.camp.z)<9||chapter.landmarks.some(l=>Math.hypot(l.x-x,l.z-z)<6*(l.scale??1))||[...chapter.interactions,...chapter.secrets,...mechanisms].some(it=>Math.hypot(it.x-x,it.z-z)<5)||(chapter.terrain.platforms??[]).some(p=>Math.abs(p.x-x)<p.width/2+3&&Math.abs(p.z-z)<p.depth/2+3)||(biome==='castle'&&Math.abs(x)<30)||trees.some(t=>Math.hypot(t.x-x,t.z-z)<3.3)||[[-31,48],[31,73]].some(([px,pz])=>Math.hypot(x-px,z-pz)<6))continue;
    const template=originals[added%Math.min(6,originals.length)];trees.push({x,z,s:template.s,seed:10000+added,templateSeed:template.seed});added++;
  }
  return trees.filter(t=>!treeBlocksFootway(chapter,t.x,t.z));
}
export function authoredTrees(chapter:Chapter){
  const groups=chapter.biome==='village'?[[15,58,1.3],[-14,65,1.15],[17,84,1.25],[-17,91,1.05]]:chapter.biome==='river'?[[-28,7,1.15],[12,17,1.3],[-31,89,1.2],[29,99,1.25]]:chapter.biome==='forest'?[[15,18,1.5],[-16,17,1.1],[29,38,1.2],[-9,49,1.15],[27,85,1.35]]:[];
  return groups.map(([x,z,s],i)=>({x,z,s,seed:900+i*17,templateSeed:undefined as number|undefined})).filter(p=>pathDistance(chapter,p.x,p.z)>3.1&&!inWater(chapter,p.x,p.z,1.1));
}
export function chapterObstacles(chapter:Chapter):WorldObstacle[]{
  const out:WorldObstacle[]=[];
  const house=(x:number,z:number,s:number,rotation=0)=>out.push({x,z,r:0,shape:'box',width:5*s,depth:4*s,rotation,top:groundHeight(chapter,x,z)+6.5*s});
  for(const l of chapter.landmarks){const s=l.scale??1,y=groundHeight(chapter,l.x,l.z);
    if(l.kind==='house')house(l.x,l.z,s,l.rotation);
    if(l.kind==='windmill')out.push({x:l.x,z:l.z,r:1.9*s,top:y+10*s});
    if(l.kind==='tree')out.push(...(['graveyard','castle'].includes(chapter.biome)?[{x:l.x,z:l.z,r:s*.6,top:y+10*s}]:studioTreeObstacles(existingStudioTree(l.x,l.z,s*2,7,chapter.biome),y)));
    if(l.kind==='castle')out.push({x:l.x,z:l.z,r:5*s,top:y+16*s});
    if(l.kind==='rock')out.push({x:l.x,z:l.z,r:s*1.7,top:y+s*1.8});
    if(l.kind==='arch'||l.kind==='ruin')for(const side of [-1,1])out.push({x:l.x+side*2*s,z:l.z,r:.65*s,top:y+4*s});
  }
  for(const t of [...sceneryTrees(chapter),...authoredTrees(chapter)])out.push(...(['graveyard','castle'].includes(chapter.biome)?[{x:t.x,z:t.z,r:t.s*.3,top:groundHeight(chapter,t.x,t.z)+t.s*5.5}]:studioTreeObstacles(existingStudioTree(t.x,t.z,t.s,t.templateSeed??t.seed,chapter.biome),groundHeight(chapter,t.x,t.z))));
  if(chapter.biome==='village'){
    house(-8.9,-5.9,.91,-.72);house(9.5,-3.5,1.02,.74);house(-9.7,14.9,.78,-.83);
    for(const [x1,z1,x2,z2]of [[-5.8,-12,-5.8,-8.4],[-5.8,-4.7,-5.8,-1.9],[6.3,-10.7,6.3,-6.8],[6.3,-1.5,6.3,2.7],[-12,10.3,-6.3,10.3],[7.6,13.1,9.9,13.1],[12.2,13.1,13.8,13.1]])out.push({x:(x1+x2)/2,z:(z1+z2)/2,r:0,shape:'box',width:.13,depth:Math.hypot(x2-x1,z2-z1),rotation:Math.atan2(x2-x1,z2-z1),top:Math.max(groundHeight(chapter,x1,z1),groundHeight(chapter,x2,z2))+1.1});
    out.push({x:7.8,z:8.7,r:0,shape:'box',width:3.12,depth:1.72,top:groundHeight(chapter,7.8,8.7)+1.02});
  }
  for(const p of chapter.terrain.shelters??[])out.push({x:p.x,z:p.z+2.6,r:0,shape:'box',width:4.9,depth:.75,top:groundHeight(chapter,p.x,p.z)+3.0});
  if(chapter.biome==='castle')for(let z=12;z<96;z+=9)if(![21,48,75].includes(z))for(const side of [-1,1])out.push({x:side*24,z,r:0,shape:'box',width:.8,depth:8.8,top:groundHeight(chapter,side*24,z)+7.2});
  if(chapter.biome==='forest')for(const [x,z,a]of [[14,62,.6],[-8,61,-.5],[12,76,.3]])out.push({x,z,r:0,shape:'box',width:4.5,depth:.62,rotation:-Math.atan2(a*2,4.4),top:groundHeight(chapter,x,z)+.77});
  for(const b of chapter.terrain.blocked??[])out.push({...b,r:0,shape:'box',top:groundHeight(chapter,b.x,b.z)+12});
  return out;
}
export function resolveObstacles(obstacles:WorldObstacle[],x:number,z:number,radius:number,feetY:number,bodyHeight=2.1,bounds:WorldBounds=DEFAULT_WORLD_BOUNDS){
  for(let pass=0;pass<2;pass++)for(const o of obstacles){if(feetY>=(o.top??Infinity)-.015||feetY+bodyHeight<(o.bottom??-Infinity))continue;const dx=x-o.x,dz=z-o.z;
    if(o.shape==='box'){const a=o.rotation??0,c=Math.cos(a),s=Math.sin(a);let lx=dx*c-dz*s,lz=dx*s+dz*c;const hw=(o.width??0)/2+radius,hd=(o.depth??0)/2+radius;if(Math.abs(lx)<hw&&Math.abs(lz)<hd){if(hw-Math.abs(lx)<hd-Math.abs(lz))lx=(lx>=0?1:-1)*hw;else lz=(lz>=0?1:-1)*hd;x=o.x+lx*c+lz*s;z=o.z-lx*s+lz*c;}}
    else {const d=Math.hypot(dx,dz),r=o.r+radius;if(d<r){x=o.x+(d?dx/d:1)*r;z=o.z+(d?dz/d:0)*r;}}
  }return {x:Math.max(bounds.minX+radius,Math.min(bounds.maxX-radius,x)),z:Math.max(bounds.minZ+radius,Math.min(bounds.maxZ-radius,z))};
}
export function createChapterMovementWorld(chapter:Chapter,getFlags:()=>readonly string[]=()=>[]){
  const bounds=chapterBounds(chapter.id);
  const obstacles=chapterObstacles(chapter),near=spatialCandidates(obstacles,o=>o.shape==='box'?Math.hypot(o.width??0,o.depth??0)/2:o.r),active=(p:{requiresFlag?:string})=>!p.requiresFlag||getFlags().includes(p.requiresFlag);
  const surfaceAt=(x:number,z:number,feetY:number,radius=.66)=>{
    if(x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius)return null;
    const surfaces:{y:number;walkable:boolean;normalY:number;id:string}[]=[];
    for(const p of chapter.terrain.platforms??[])if(active(p)&&Math.abs(x-p.x)<=p.width/2-radius*.22&&Math.abs(z-p.z)<=p.depth/2-radius*.22&&p.height<=feetY+.3)surfaces.push({y:p.height,walkable:true,normalY:1,id:p.id});
    for(const l of chapter.landmarks)if(l.kind==='bridge'){const s=l.scale??1,local=bridgeLocal(x,z,l);if(Math.abs(local.x)<Math.max(.2,1.63*s-radius+.02)&&Math.abs(local.z)<4.3*s){const y=bridgeDeck(chapter,l,local.z);if(y<=feetY+.3)surfaces.push({y,walkable:true,normalY:.99,id:l.id});}}
    if(!inWater(chapter,x,z,.12)){const y=groundHeight(chapter,x,z),dx=(groundHeight(chapter,x+.15,z)-groundHeight(chapter,x-.15,z))/.3,dz=(groundHeight(chapter,x,z+.15)-groundHeight(chapter,x,z-.15))/.3,normalY=1/Math.sqrt(1+dx*dx+dz*dz);if(y<=feetY+.3)surfaces.push({y,walkable:normalY>.66,normalY,id:'ground'});}
    return surfaces.sort((a,b)=>b.y-a.y)[0]??null;
  };
  const resolveAt=(x:number,z:number,feetY:number,radius=.66,bodyHeight=2.1)=>{
    const all=[...near(x,z,radius)];
    for(const p of chapter.terrain.platforms??[])if(active(p)&&p.height>feetY+.28)all.push({...p,r:0,shape:'box',top:p.height,bottom:groundHeight(chapter,p.x,p.z)-.2});
    for(const l of chapter.landmarks)if(l.kind==='bridge'){const s=l.scale??1,rot=l.rotation??0;for(const side of [-1,1])all.push({x:l.x+Math.cos(rot)*side*1.54*s,z:l.z-Math.sin(rot)*side*1.54*s,r:0,shape:'box',width:.11,depth:7.5*s,rotation:rot,bottom:Math.min(bridgeDeck(chapter,l,-3.8*s),bridgeDeck(chapter,l,3.8*s))-.15,top:bridgeDeck(chapter,l,0)+.98});}
    return resolveObstacles(all,x,z,radius,feetY,bodyHeight,bounds);
  };
  return {surfaceAt,resolveAt,ceilingAt(x:number,z:number,feetY:number,radius=.66){let lowest=Infinity;for(const s of chapter.terrain.shelters??[])if(Math.abs(x-s.x)<2.6+radius&&z>s.z-.7-radius&&z<s.z+2.9+radius){const bottom=groundHeight(chapter,s.x,s.z)+2.65;if(bottom>feetY)lowest=Math.min(lowest,bottom);}for(const l of chapter.landmarks)if(l.kind==='arch'||l.kind==='ruin'){const s=l.scale??1;if(Math.abs(x-l.x)<2.3*s+radius&&Math.abs(z-l.z)<.5*s+radius){const bottom=landHeight(chapter,l.x,l.z)+3.7*s;if(bottom>feetY)lowest=Math.min(lowest,bottom);}}return Number.isFinite(lowest)?lowest:null;},isSafe(x:number,z:number,y:number,radius=.66){const p=surfaceAt(x,z,y,radius),r=resolveAt(x,z,y,radius,2.1);return !!p?.walkable&&Math.abs(p.y-y)<.15&&Math.hypot(r.x-x,r.z-z)<.05;}};
}
