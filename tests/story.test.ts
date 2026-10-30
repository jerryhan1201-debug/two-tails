import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {freshSave,type DogRole} from '../shared/save';
import {STORY_IDS,STORY_PAGES,STORY_EXIT,STORY_VERSION,emptyStory,queueStory,applyStoryCommand,resetStoryVotes,validateStory,type StoryProgress,type StoryCommand} from '../shared/story';
import {validateSnapshotShape} from '../shared/snapshot';
import {prepareAdventureRecovery} from '../src/recovery';
import {CHAPTERS} from '../src/content';
import content from '../src/story-content.json';
let serial=0;
function command(s:StoryProgress,action:StoryCommand['action']):StoryCommand{const a=s.active!;return{id:a.id,version:STORY_VERSION,page:a.page,revision:a.pageRevision,requestId:'test-'+serial++,action};}
function both(s:StoryProgress,action:StoryCommand['action']){const c=command(s,action);for(const role of ['gold','white'] as const)applyStoryCommand(s,role,c);}
function finish(s:StoryProgress){for(let n=0;s.active&&n<40;n++){both(s,'ready');both(s,'next');}assert(!s.active,'Story must finish within the finite page count');}
test('selected manifest has all nine stable sequences, 24 ordered pages and six large illustrations',()=>{
 assert.deepEqual(content.map(s=>s.id),STORY_IDS);assert.deepEqual(content.map(s=>s.pages.length),STORY_PAGES);
 assert.equal(content.reduce((n,s)=>n+s.pages.filter(p=>p.image).length,0),6);
 for(const s of content)assert.deepEqual(s.pages.map(p=>p.order),s.pages.map((_,i)=>i+1));
});
test('page votes, duplicate requests, stale packets, common skip and summary are authoritative',()=>{
 const s=emptyStory();queueStory(s,STORY_IDS[0]);both(s,'ready');const old=command(s,'next');
 assert(applyStoryCommand(s,'gold',old));assert.equal(s.active!.page,0);assert(!applyStoryCommand(s,'gold',old));
 assert(applyStoryCommand(s,'white',old));assert.equal(s.active!.page,1);assert(!applyStoryCommand(s,'white',old));
 const skip=command(s,'skip');applyStoryCommand(s,'gold',skip);assert.equal(s.active!.phase,'reading');
 applyStoryCommand(s,'white',skip);assert.equal(s.active!.phase,'summary');assert.equal(s.completed.length,0);
 both(s,'ready');both(s,'next');assert(!s.active);assert.deepEqual(s.completed,[STORY_IDS[0]]);queueStory(s,STORY_IDS[0]);assert(!s.active);
});
test('pause/reconnect retains the page but invalidates votes and last-page packets',()=>{
 const s=emptyStory();queueStory(s,STORY_IDS[3]);both(s,'ready');both(s,'next');both(s,'ready');const stale=command(s,'next');applyStoryCommand(s,'gold',stale);resetStoryVotes(s);
 assert.equal(s.active!.page,1);assert.deepEqual(s.active!.confirmed,{gold:false,white:false});assert(!applyStoryCommand(s,'white',stale));validateStory(s);
});
test('formal story freezes time, movement, attacks, travel; solo never creates formal stories',()=>{
 const sim=new Simulation(freshSave('a_story_freeze'),{stories:true}),before=structuredClone(sim.state.players);
 sim.command('gold',{x:1,z:1,actions:['attack','mount','jump'],travel:{regionId:'mushroom-grove',method:'map'}});sim.tick(.05);
 assert.equal(sim.state.time,0);assert.deepEqual(sim.state.players,before);assert(!sim.state.travel);
 const solo=new Simulation(undefined,{mode:'exploration',stories:true});assert(!solo.state.story);assert.throws(()=>solo.exportSave());
});
test('all seven transitions use the original gate, atomically queue story after commit, ending needs homeward light',()=>{
 for(const ch of CHAPTERS){
  const save=freshSave('a_story_gate_'+ch.index);save.chapterId=ch.id;save.completedChapters=CHAPTERS.slice(0,ch.index-1).map(c=>c.id);
  const sim=new Simulation(save,{stories:true});if(sim.state.story?.active)finish(sim.state.story);
  sim.state.enemies=[];sim.state.flags=[...ch.quest.steps,ch.event.id,ch.event.id+'-resolved'];
  if(ch.index===7)sim.state.flags=sim.state.flags.filter(id=>id!=='d-homeward-light');
  const flat={surfaceAt:()=>({y:0,walkable:true,id:'ground'}),resolveAt:(x:number,z:number)=>({x,z})};sim.setMovementWorld(flat);
  for(const [i,r]of (['gold','white'] as const).entries())Object.assign(sim.state.players[r],{x:ch.exit.x+i*1.5,z:ch.exit.z,y:0,grounded:true,safeX:ch.exit.x+i*1.5,safeZ:ch.exit.z,safeY:0});
  sim.state.players.white.hp=0;sim.tick(.01);assert.equal(sim.state.story?.active,undefined);assert(!sim.save.completedChapters.includes(ch.id));sim.state.players.white.hp=100;
  if(ch.index===7){sim.tick(.01);assert(!sim.state.ended);assert.equal(sim.state.story?.active,undefined);sim.state.flags.push('d-homeward-light');}
  sim.tick(.01);assert(sim.save.completedChapters.includes(ch.id));assert.equal((sim.state.story as StoryProgress).active?.id,STORY_EXIT[ch.index-1]);
  if(ch.index===3)assert.deepEqual(sim.state.story!.queue,[STORY_IDS[4]]);
  const reward=structuredClone(sim.save.players),recovered=new Simulation(sim.exportSave(),{stories:true});assert.equal(recovered.state.story!.active?.id,STORY_EXIT[ch.index-1]);finish(recovered.state.story!);recovered.tick(.01);assert.deepEqual(recovered.save.players,reward);assert.equal(recovered.save.completedChapters.filter(id=>id===ch.id).length,1);validateSnapshotShape(recovered.exportLiveSnapshot());
 }
});
test('cold recovery chooses newer durable story and matching chapter over stale relay; advanced legacy save does not rewind',()=>{
 const host=new Simulation(freshSave('a_story_recover'),{stories:true});const stale=host.exportLiveSnapshot();both(host.state.story!,'ready');both(host.state.story!,'next');const durable=host.exportSave();
 const cold=new Simulation(prepareAdventureRecovery(durable,stale),{stories:true});assert.equal(cold.state.story!.active!.page,1);assert.deepEqual(cold.state.story!.active!.ready,{gold:false,white:false});
 const legacy=freshSave('a_story_legacy');legacy.chapterId=CHAPTERS[4].id;legacy.completedChapters=CHAPTERS.slice(0,4).map(c=>c.id);const advanced=new Simulation(legacy,{stories:true});assert(!advanced.state.story!.active);assert(advanced.state.story!.completed.includes(STORY_IDS[4]));assert.equal(advanced.chapter.id,CHAPTERS[4].id);
});
test('corrupted page bounds, version and votes fail save validation',()=>{
 const sim=new Simulation(freshSave('a_story_validation'),{stories:true});for(const change of [(s:any)=>s.story.active.page=99,(s:any)=>s.story.active.version='older',(s:any)=>s.story.active.confirmed.gold='yes']){const s=structuredClone(sim.state);change(s);assert.throws(()=>validateSnapshotShape(s));}
});
