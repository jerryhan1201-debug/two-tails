/** Optional, versioned side-story state. Rotating mechanisms are one revisioned
 * value, never monotonic flags: unioning old and new dial positions corrupts puzzles. */
export interface JourneyEntry {
  stage: number;
  known: string[];
  values: Record<string, number>;
  completed: boolean;
}
export interface JourneyProgress {
  v: 1;
  revision: number;
  entries: Record<string, JourneyEntry>;
}
export interface JourneyProposal {
  journeyId: string;
  nodeId: string;
  proposer: 'gold' | 'white';
  revision: number;
  expiresAt: number;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const integer=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k));
const installed:Record<string,{lastStage:number;values:Record<string,number>}>= {
  'rain-post':{lastStage:6,values:{bellStep:3}},
  'river-levels':{lastStage:3,values:{intake:3,outlet:3}},
  'memorial-names':{lastStage:2,values:{weaver:2,ferryman:2,gardener:2}},
  'castle-window':{lastStage:2,values:{west:3,centre:3,north:3}},
  'mountain-shelters':{lastStage:3,values:{tool:3,draft:1,beam:1,lamp:1,carried:1}},
  'home-lights':{lastStage:2,values:{village:2,forest:2,mountain:2}},
  'pond-reply':{lastStage:4,values:{flow:3}},
  'count-sleep':{lastStage:4,values:{seal:3}},
  'last-bell':{lastStage:3,values:{wheel:3}},
  'unsent-log':{lastStage:4,values:{signal:3}},
  'shell-echo':{lastStage:3,values:{notes:3}},
  'winter-lamps':{lastStage:4,values:{forest:3,turn:3}},
  'snowman-gift':{lastStage:3,values:{}},
};
export const emptyJourneys=():JourneyProgress=>({v:1,revision:0,entries:{}});
export function validateJourneys(v:unknown):asserts v is JourneyProgress {
  if(!object(v)||!keys(v,['v','revision','entries'])||v.v!==1||!integer(v.revision)||!object(v.entries)||Object.keys(v.entries).length>16)throw new Error('支线机关进度损坏');
  for(const [key,e]of Object.entries(v.entries)){
    if(!id(key)||!object(e)||!keys(e,['stage','known','values','completed'])||!integer(e.stage,100)||typeof e.completed!=='boolean'||!Array.isArray(e.known)||e.known.length>64||!e.known.every(id)||new Set(e.known).size!==e.known.length||!object(e.values)||Object.keys(e.values).length>32||!Object.entries(e.values).every(([k,n])=>id(k)&&integer(n,10000)))throw new Error('支线机关记录损坏');
    const schema=installed[key],values=e.values;if(schema&&(e.stage>schema.lastStage||e.completed&&e.stage!==schema.lastStage||Object.entries(schema.values).some(([field,max])=>values[field]!==undefined&&!integer(values[field],max))))throw new Error('支线机关刻度或阶段损坏');
  }
  if(new TextEncoder().encode(JSON.stringify(v)).length>16384)throw new Error('支线机关记录过大');
}
export function validateJourneyProposal(v:unknown):asserts v is JourneyProposal {
  if(!object(v)||!keys(v,['journeyId','nodeId','proposer','revision','expiresAt'])||!id(v.journeyId)||!id(v.nodeId)||!['gold','white'].includes(String(v.proposer))||!integer(v.revision)||typeof v.expiresAt!=='number'||!Number.isFinite(v.expiresAt)||v.expiresAt<0)throw new Error('支线合作确认损坏');
}
/** Call with durable state first: a stale relay must not undo a confirmed turn.
 * Unknown future entry IDs are retained rather than silently discarded. */
export function newestJourneys(...candidates:unknown[]):JourneyProgress {
  let result=emptyJourneys();
  for(const v of candidates){if(v===undefined)continue;validateJourneys(v);if(v.revision>result.revision||v.revision===result.revision&&Object.keys(result.entries).length===0)result=structuredClone(v);}
  return result;
}
