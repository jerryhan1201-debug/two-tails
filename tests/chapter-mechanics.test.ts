import './studio-fixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation';
import { CHAPTERS } from '../src/content';
import { freshSave } from '../shared/save';
const flat={surfaceAt:()=>({y:0,walkable:true,id:'ground'}),resolveAt:(x:number,z:number)=>({x,z}),isSafe:()=>true};
function fixture(index:number) {
  const save=freshSave('chapter-v5');save.chapterId=CHAPTERS[index].id;
  const sim=new Simulation(save);sim.setMovementWorld({...flat,surfaceAt:()=>({y:index===4?8.4:0,walkable:true,id:'ground'})});
  return sim;
}
function place(sim:Simulation,x:number,z:number) {
  const y=sim.chapter.index===5?8.4:0;
  for(const[i,r]of(['gold','white']as const).entries())Object.assign(sim.state.players[r],{x:x+i*1.5,z,y,vy:0,grounded:true,safeX:x+i*1.5,safeY:y,safeZ:z});
}
for(const [index,flags,duration]of [[3,['g-lantern-gardener','g-lantern-singer','g-lantern-king'],2],[4,['c-plate-sun','c-plate-moon'],1.8]] as const)
  test(`chapter ${index+1}: recorded clues create a real post-attack weakness, which persists through save without repeating`,()=>{
    const sim=fixture(index),boss=sim.state.enemies.find(e=>e.boss)!;sim.state.enemies=[boss];
    place(sim,boss.x,boss.z-5);Object.assign(boss,{state:'attack',timer:.005,pattern:'volley',exposed:0,recoveryUsed:false});
    sim.tick(.01);assert.equal(boss.exposed,0,'uncompleted clues do not fabricate a vulnerability');
    sim.state.flags.push(...flags);Object.assign(boss,{state:'attack',timer:.005});sim.tick(.01);
    assert.equal(boss.exposed,duration);assert.equal(boss.recoveryUsed,true);
    sim.state.players.white.z=boss.z+5; // Flank the boss: this assertion measures its weakness, not partner damage.
    const p=sim.state.players.gold;p.weapon='staff';sim.command('gold',{x:0,z:0,actions:['attack']});const hp=boss.hp;sim.tick(.01);assert.equal(hp-boss.hp,33,'22 base attack gains 50% during mirror/oath window');
    const restored=new Simulation(sim.exportSave());restored.setMovementWorld({...flat,surfaceAt:()=>({y:index===4?8.4:0,walkable:true,id:'ground'})});const saved=restored.state.enemies[0];assert(saved.exposed>0&&saved.recoveryUsed);assert(flags.every(id=>restored.state.flags.includes(id)));
    for(let i=0;i<240;i++)restored.tick(.01);assert.equal(saved.exposed,0);assert.equal(restored.state.events.filter(e=>e.type==='weakness').length,1);
  });
test('graveyard midnight responds to the recovered memorial name and still spawns its crisis only once',()=>{
  const sim=fixture(3),event=sim.chapter.event;sim.state.enemies=[];place(sim,event.trigger.x,event.trigger.z);sim.tick(.01);assert(!sim.state.flags.includes(event.id));
  sim.state.flags.push('g-lantern-gardener');sim.tick(.01);assert(sim.state.flags.includes(event.id));const count=sim.state.enemies.length;sim.tick(.01);assert.equal(sim.state.enemies.length,count);
});
test('dragon anchors each answer their matching phase once and retain their use across a reload',()=>{
  const sim=fixture(6),boss=sim.state.enemies.find(e=>e.boss)!;sim.state.enemies=[boss];sim.state.flags=[...sim.chapter.quest.steps];place(sim,boss.x,boss.z-5);
  for(const r of ['gold','white']as const)sim.state.players[r].hp=40;
  sim.tick(.01);assert.equal(sim.state.players.gold.hp,52);sim.tick(.01);assert.equal(sim.state.players.gold.hp,52);
  boss.hp=boss.maxHp*.65;sim.tick(.01);assert.equal(boss.phase,2);assert.equal(sim.state.players.gold.hp,64);
  boss.hp=boss.maxHp*.35;sim.tick(.01);assert.equal(boss.phase,3);assert.equal(sim.state.players.gold.hp,76);
  const resumed=new Simulation(sim.exportSave());resumed.setMovementWorld(flat);resumed.tick(.01);assert.equal(resumed.state.players.gold.hp,76);assert.equal(resumed.state.flags.filter(id=>id.endsWith('-resonance')).length,3);
});
test('the finale requires all anchors, a calm dragon and both partners at the visible return light; completed legacy endings stay compatible',()=>{
  const sim=fixture(6),boss=sim.state.enemies.find(e=>e.boss)!;sim.state.enemies=[boss];const light=sim.chapter.interactions.find(i=>i.id==='d-homeward-light')!;
  place(sim,light.x,light.z);sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.01);assert(!sim.state.flags.includes(light.id));
  boss.hp=0;boss.state='dead';sim.state.flags=[...sim.chapter.quest.steps];place(sim,sim.chapter.exit.x,sim.chapter.exit.z);sim.tick(.01);assert.equal(sim.state.ended,false,'walking straight to the exit does not skip the shared light');
  place(sim,light.x,light.z);sim.state.players.white.x+=12;sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.01);assert(!sim.state.flags.includes(light.id));
  place(sim,light.x,light.z);sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.01);assert(sim.state.flags.includes(light.id));
  place(sim,sim.chapter.exit.x,sim.chapter.exit.z);sim.tick(.01);assert.equal(sim.state.ended,true);assert.equal(sim.state.events.filter(e=>e.type==='ending').length,1);
  const legacy=fixture(6);legacy.state.enemies=[];legacy.state.flags=[...legacy.chapter.quest.steps];legacy.save.completedChapters=[legacy.chapter.id];place(legacy,legacy.chapter.exit.x,legacy.chapter.exit.z);legacy.tick(.01);assert.equal(legacy.state.ended,true);
});

test('a nearby pursuing boss does not force players to kill it before activating its final clue or life anchor',()=>{
  for(const[index,id]of [[3,'g-lantern-king'],[4,'c-star-channel'],[6,'d-anchor-life']]as const){
    const sim=fixture(index),boss=sim.state.enemies.find(e=>e.boss)!,it=sim.chapter.interactions.find(i=>i.id===id)!;
    sim.state.enemies=[boss];sim.state.flags=sim.chapter.quest.steps.slice(0,sim.chapter.quest.steps.indexOf(id));
    place(sim,it.x,it.z);Object.assign(boss,{x:it.x,z:it.z+5,state:'chase'});
    sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.01);assert(sim.state.flags.includes(id),id);assert(boss.hp>0);
  }
});
