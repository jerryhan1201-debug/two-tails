import {studioRelease} from './studio-regions';
import {nearbyHomeUse} from './home-use';
import {fieldNodes,fieldContent,type FieldNode} from '../shared/fieldbook';
import {fieldReachable,clearFieldPath} from './field-play';
import {clearDuoPath} from './duo-interactions';
import type { Chapter, Interaction } from './content';
import type { DogRole } from '../shared/save';
import type { Player, Snapshot } from './simulation';
import { PLAYER_RADIUS } from './combat-contact';
import { standingSurface, type MovementWorld } from './movement';
import { allowedRegions, getRegionChapter, regionConnections, regionGroundHeight } from './regions';
import { journeyNodes, journeyEntry, journeyRepeatable, journeyPrompt } from './journeys';
import { residentReply } from './resident-dialogue';
import {nearbyAnimal} from './animal-interactions';

/** Read-only selection shared by authoritative E and either client's touch prompt. */
export interface InteractionContext {
  state: Pick<Snapshot,'regionId'|'chapterId'|'players'|'flags'|'journeys'|'journeyProposal'|'mode'|'progress'|'fieldbook'|'fieldPlay'>;
  world: MovementWorld;
  chapter?: Chapter;
  mode?: import('../shared/modes').GameMode;
  availableRegions?: readonly string[];
}
export function onInteractionSurface(context:InteractionContext,p:Player,item:Interaction) {
  const surface=standingSurface(context.world,p.x,p.z,p.y+.05,PLAYER_RADIUS);
  const studio=!!studioRelease(context.state.regionId);
  const floor=item.kind==='plate'?(standingSurface(context.world,item.x,item.z,p.y+.05,PLAYER_RADIUS)?.y??0):0;
  return p.grounded&&(item.surfaceId?surface?.id===item.surfaceId:Math.abs(p.y-(item.y??regionGroundHeight(context.state.regionId,item.x,item.z)))<=1.2)&&(!(studio||item.requiresClearPath)||clearFieldPath(context.world,{...p,y:p.y+1.3},item,(item.y??p.y)+1.3))&&
    (item.kind!=='plate'||!!surface&&(!item.surfaceId?(studio||surface.id==='ground'):true)&&Math.abs(p.y-floor)<.3);
}
export function onConnectionSurface(context:InteractionContext,p:Player,connection:ReturnType<typeof regionConnections>[number]) {
  if(context.state.regionId==='studio-undersea-atlantis')return p.swim==='underwater'&&Math.abs(p.y-(connection.y??-9))<=1.2;
  return p.grounded&&Math.abs(p.y-(connection.y??regionGroundHeight(context.state.regionId,connection.x,connection.z)))<=1.2;
}
export function selectInteractionTarget(context:InteractionContext,p:Player) {
  const {state}=context,chapter=context.chapter??getRegionChapter(state.regionId),mode=context.mode??state.mode??'adventure';
  const available=context.availableRegions??allowedRegions({chapterId:state.chapterId,completedChapters:state.progress?.completedChapters??[]});
  const distance=(item:{x:number;z:number})=>Math.hypot(item.x-p.x,item.z-p.z);
  // Equal quarter-metre distance bands use stable IDs on both host and guest.
  const compare=(a:{x:number;z:number;id:string},b:{x:number;z:number;id:string})=>Math.round(distance(a)*4)-Math.round(distance(b)*4)||a.id.localeCompare(b.id);
  const connection=regionConnections(state.regionId).filter(c=>onConnectionSurface(context,p,c)&&available.includes(c.to)&&distance(c)<c.radius).sort(compare)[0];
  const fields=fieldNodes(state.regionId),fieldIds=new Set(fields.map(n=>n.id));
  const nodes=journeyNodes(state.regionId,state.journeys),byId=new Map(nodes.map(n=>[n.id,n]));
  const reachable:Interaction[]=[...new Map([...chapter.interactions,...chapter.secrets,...nodes,...fields].map(i=>[i.id,i])).values()].filter(i=>(mode!=='adventure'||i.kind!=='plate')&&distance(i)<3.5&&onInteractionSurface(context,p,i)&&(!fieldIds.has(i.id)||fieldReachable({world:context.world,s:state},p.role,i as FieldNode))).sort(compare);
  const unread=reachable.find(i=>{if(fieldIds.has(i.id)){const f=i as FieldNode;return !state.fieldbook?.completed.includes(f.contentId)||['flight','game'].includes(fieldContent(f.contentId).kind);}const n=byId.get(i.id);return n?!journeyEntry(state.journeys,n.journeyId).completed&&(journeyRepeatable(n,state.journeys)||!journeyEntry(state.journeys,n.journeyId).known.includes(n.id)):!state.flags.includes(i.id);});
  if(connection&&(!unread||distance(connection)<=distance(unread)))return {connection,item:undefined};
  return {connection:undefined,item:unread??reachable.find(i=>fieldIds.has(i.id)||byId.has(i.id)||residentReply(i,chapter,state.flags)!==undefined)};
}
export function nearbyInteraction(context:InteractionContext,role:DogRole):string {
  const {state}=context,p=state.players[role],other=state.players[role==='gold'?'white':'gold'],mode=context.mode??state.mode??'adventure';
  if(p.homeUse)return '起身 · 方向键也可离开';
  if(!p.grounded||p.hp<=0)return '';
  const furniture=nearbyHomeUse(state.regionId,p,context.world);if(furniture)return (furniture.pose==='sit'?'坐下 · ':'躺下 · ')+furniture.label;
  if(mode==='adventure'&&other.hp<=0&&Math.hypot(p.x-other.x,p.z-other.z)<3)return '扶起伙伴';
  if(state.fieldPlay?.kind==='hide'&&state.fieldPlay.phase==='active'&&state.fieldPlay.seeker===role&&Math.hypot(p.x-other.x,p.z-other.z)<3.2&&clearDuoPath(context.world,{...p,y:p.y+.7},{...other,y:other.y+.7},.08,.5))return '找到伙伴 · 轻触确认';
  const {connection,item}=selectInteractionTarget(context,p);
  if(connection)return '前往 · '+connection.label;
  const field=item&&fieldNodes(state.regionId).find(n=>n.id===item.id);if(field)return field.label;
  const journey=item&&journeyNodes(state.regionId).find(n=>n.id===item.id);
  if(journey){const proposal=state.journeyProposal;return(proposal?.nodeId===journey.id?(proposal.proposer===role?'等伙伴确认 · ':'确认合作 · '):'')+journeyPrompt(journey,state.journeys);}
  if(item?.kind==='npc'&&state.flags.includes(item.id))return '和'+(item.speaker??'这位居民')+'再说几句';
  const animal=!item?nearbyAnimal(state as Snapshot,context.world,role):undefined;
  return item?(mode==='exploration'?'预览 · ':'')+item.label:animal?'招呼 · '+animal.label:'';
}
