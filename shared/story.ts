import type {DogRole} from './save';
export const STORY_VERSION='0.3.0-parchment';
export const STORY_KEYS=['ch01.departure','ch01.footprint','ch02.mural','ch03.two-homes','ch04.names','ch04.closed-channel','ch05.shared-route','ch06.answer','ch07.homecoming'] as const;
export const STORY_IDS=STORY_KEYS.map(id=>'goulai.story.'+id);
export const STORY_PAGES=[3,2,2,3,2,2,3,3,4];
export const STORY_EXIT=[1,2,3,5,6,7,8].map(index=>STORY_IDS[index]);
type Votes=Record<DogRole,boolean>;
export interface StoryPlayback {id:string;version:string;page:number;pageRevision:number;phase:'reading'|'summary';ready:Votes;confirmed:Votes;skip:Votes;skipped:boolean}
export interface StoryProgress {revision:number;completed:string[];queue:string[];active?:StoryPlayback;requests?:string[]}
export interface StoryCommand {id:string;version:string;page:number;revision:number;requestId:string;action:'ready'|'next'|'skip'|'cancel'}
export const blankVotes=():Votes=>({gold:false,white:false});
export const emptyStory=():StoryProgress=>({revision:0,completed:[],queue:[]});
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const validId=(v:unknown)=>typeof v==='string'&&STORY_IDS.includes(v);
const votes=(v:unknown)=>obj(v)&&Object.keys(v).length===2&&typeof v.gold==='boolean'&&typeof v.white==='boolean';
export function validStoryCommand(v:unknown):v is StoryCommand{return obj(v)&&Object.keys(v).length===6&&validId(v.id)&&v.version===STORY_VERSION&&integer(v.page)&&v.page<4&&integer(v.revision)&&typeof v.requestId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v.requestId)&&['ready','next','skip','cancel'].includes(v.action);}
export function validateStory(v:unknown):asserts v is StoryProgress{
 if(!obj(v)||!integer(v.revision)||!Array.isArray(v.completed)||v.completed.length>9||!v.completed.every(validId)||new Set(v.completed).size!==v.completed.length||!Array.isArray(v.queue)||v.queue.length>9||!v.queue.every(validId)||new Set(v.queue).size!==v.queue.length||v.queue.some((id:string)=>v.completed.includes(id)))throw Error('故事记录无效');
 const a=v.active;if(a!==undefined&&(!obj(a)||!validId(a.id)||a.version!==STORY_VERSION||!integer(a.page)||a.page>=STORY_PAGES[STORY_IDS.indexOf(a.id)]||!integer(a.pageRevision)||!['reading','summary'].includes(a.phase)||!votes(a.ready)||!votes(a.confirmed)||!votes(a.skip)||typeof a.skipped!=='boolean'||v.completed.includes(a.id)||v.queue.includes(a.id)))throw Error('故事阅读游标无效');
 if(v.requests!==undefined&&(!Array.isArray(v.requests)||v.requests.length>32||!v.requests.every((id:unknown)=>typeof id==='string'&&/^(gold|white):[a-zA-Z0-9_-]{1,80}$/.test(id))))throw Error('故事请求记录无效');
}
export function queueStory(s:StoryProgress,id:string){if(!validId(id)||s.completed.includes(id)||s.active?.id===id||s.queue.includes(id))return;s.queue.push(id);s.revision++;startQueuedStory(s);}
export function startQueuedStory(s:StoryProgress){if(s.active||!s.queue.length)return;const id=s.queue.shift()!;s.revision++;s.active={id,version:STORY_VERSION,page:0,pageRevision:s.revision,phase:'reading',ready:blankVotes(),confirmed:blankVotes(),skip:blankVotes(),skipped:false};}
export function resetStoryVotes(s:StoryProgress|undefined){if(!s?.active)return;s.revision++;Object.assign(s.active,{pageRevision:s.revision,ready:blankVotes(),confirmed:blankVotes(),skip:blankVotes()});}
/** Only page/phase changes replace the token; simultaneous votes on one page are commutative. */
export function applyStoryCommand(s:StoryProgress,role:DogRole,c:StoryCommand):boolean{
 const a=s.active;if(!validStoryCommand(c)||!a||a.id!==c.id||a.page!==c.page||a.pageRevision!==c.revision||a.version!==c.version)return false;
 const request=role+':'+c.requestId;if(s.requests?.includes(request))return false;
 if(c.action==='ready'){if(a.ready[role])return false;a.ready[role]=true;}
 else if(c.action==='cancel'){a.skip=blankVotes();}
 else if(c.action==='skip'&&a.phase==='reading'){a.skip[role]=true;}
 else if(c.action==='next'&&a.ready.gold&&a.ready.white&&!a.skip.gold&&!a.skip.white){if(a.confirmed[role])return false;a.confirmed[role]=true;}
 else return false;
 s.requests=[...(s.requests??[]),request].slice(-32);
 s.revision++;
 if(a.skip.gold&&a.skip.white){a.phase='summary';a.skipped=true;}
 else if(a.confirmed.gold&&a.confirmed.white){
  if(a.phase==='summary'){s.completed.push(a.id);delete s.active;startQueuedStory(s);return true;}
  if(a.page+1<STORY_PAGES[STORY_IDS.indexOf(a.id)])a.page++;else a.phase='summary';
 }else return true;
 Object.assign(a,{pageRevision:s.revision,ready:blankVotes(),confirmed:blankVotes(),skip:blankVotes()});return true;
}
