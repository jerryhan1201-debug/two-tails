import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {createExplorationSave,validateExplorationSave,parseExplorationBackup,exportExplorationBackup,writeExploration,EXPLORATION_STORAGE_KEY} from '../src/exploration';
import {createRegionMovementWorld,MUSHROOM_CAPS,regionGroundHeight} from '../src/regions';

for(const role of ['white','gold'] as const){
 for(const region of ['mushroom-grove','canopy-garden']){
  test(`${role}: independent exploration keeps a safe elevated ${region} landing through export and cold restore`,()=>{
   const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave(role,region)}),p=sim.state.players[role];
   const x=region==='mushroom-grove'?MUSHROOM_CAPS[0].x:0,z=region==='mushroom-grove'?MUSHROOM_CAPS[0].z:39;
   const world=createRegionMovementWorld(region),y=world.surfaceAt(x,z,30,.66)!.y;
   assert(y>7,'fixture is a real elevated walkable surface');
   Object.assign(p,{x,z,y,safeX:x,safeY:y,safeZ:z,grounded:true,yaw:.45});
   sim.setMovementWorld(world);
   const saved=parseExplorationBackup(exportExplorationBackup(sim.exportExploration()));
   assert.equal((saved.position as {y?:number}).y,y,'exploration must serialize the safe surface height');
   const cold=new Simulation(undefined,{mode:'exploration',exploration:saved}),restored=cold.state.players[role];
   assert.equal(cold.state.regionId,region);assert.equal(restored.x,x);assert.equal(restored.z,z);assert.equal(restored.y,y);
   assert.equal(restored.yaw,.45);assert(restored.grounded&&!restored.mounted);assert(world.isSafe!(restored.x,restored.z,restored.y,.66));
  });
 }
 test(`${role}: an airborne exploration save restores the prior safe elevated landing, not transient flight`,()=>{
  const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave(role,'mushroom-grove')}),p=sim.state.players[role],m=MUSHROOM_CAPS[0];
  const world=createRegionMovementWorld('mushroom-grove'),y=world.surfaceAt(m.x,m.z,30,.66)!.y;
  Object.assign(p,{x:m.x,z:m.z,y,safeX:m.x,safeY:y,safeZ:m.z,grounded:true});sim.setMovementWorld(world);
  for(let i=0;i<20;i++){sim.command(role,{x:1,z:0,actions:i?[]:['mount'],lift:1});sim.tick(.02);}
  assert(p.mounted&&!p.grounded);const saved=sim.exportExploration();
  assert.equal((saved.position as {y?:number}).y,y);assert.equal(saved.position.x,m.x);assert.equal(saved.position.z,m.z);
  const cold=new Simulation(undefined,{mode:'exploration',exploration:saved});assert.equal(cold.state.players[role].y,y);assert(cold.state.players[role].grounded&&!cold.state.players[role].mounted);
 });
}
test('old exploration records without height still validate and resume on their existing ground',()=>{
 const old=createExplorationSave('white','mushroom-grove');old.position={x:0,z:-8,yaw:.7};
 assert.deepEqual(validateExplorationSave(old).position,old.position);
 const cold=new Simulation(undefined,{mode:'exploration',exploration:old});assert.equal(cold.state.players.white.y,regionGroundHeight('mushroom-grove',0,-8));assert.equal(cold.state.players.white.yaw,.7);
});
test('optional exploration height rejects corrupt values and unrelated position fields',()=>{
 const old=createExplorationSave();
 for(const y of [NaN,Infinity,-Infinity,null,'8',1001,-1001])assert.throws(()=>validateExplorationSave({...old,position:{...old.position,y}}),/位置|格式/);
 assert.throws(()=>validateExplorationSave({...old,position:{...old.position,y:8,quest:'unexpected'}}),/位置|格式/);
 const withHeight={...old,position:{...old.position,y:8}};assert.equal(validateExplorationSave(withHeight).position.y,8);
});
test('height upgrade retains the exact pre-upgrade exploration record once',()=>{
 const old=createExplorationSave('white'),raw=JSON.stringify(old),data=new Map([[EXPLORATION_STORAGE_KEY,raw],['formal-save','untouched']]);
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 const upgraded={...old,position:{...old.position,y:8}};
 writeExploration(storage,upgraded);writeExploration(storage,{...upgraded,position:{...upgraded.position,y:9}});
 const backups=[...data].filter(([key])=>key.startsWith('starlight-exploration-before-v7:'));
 assert.equal(backups.length,1);assert.equal(backups[0][1],raw);assert.equal(data.get('formal-save'),'untouched');
 assert.equal(parseExplorationBackup(data.get(EXPLORATION_STORAGE_KEY)!).position.y,9);
});
test('failed pre-upgrade backup never replaces the original exploration record',()=>{
 const old=createExplorationSave('white'),raw=JSON.stringify(old),data=new Map([[EXPLORATION_STORAGE_KEY,raw]]);
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{if(key.startsWith('starlight-exploration-before-v7:'))throw new Error('quota');data.set(key,value);}};
 assert.throws(()=>writeExploration(storage,{...old,position:{...old.position,y:8}}),/quota/);
 assert.equal(data.get(EXPLORATION_STORAGE_KEY),raw);assert.equal(data.size,1);
});
