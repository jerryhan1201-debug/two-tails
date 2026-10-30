import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {createExplorationSave} from '../src/exploration';
import {createRegionMovementWorld} from '../src/regions';

for(const [region,x,z]of [['canopy-home',6.9,3],['canopy-home',-7,9]]as const){
 test(`an old ${region} position (${x},${z}) occupied by its existing planter resumes at nearby legal floor without losing its loadout`,()=>{
  const saved=createExplorationSave('gold',region);saved.position={x,z,yaw:.7};saved.loadouts.gold={weaponId:'chime',skinId:'forest',skillIds:['nova','shield']};saved.discoveredRegions=['mushroom-grove','mushroom-home','canopy-garden','canopy-home'];
  const world=createRegionMovementWorld(region);assert.equal(world.isSafe!(x,z,0,.66),false,'fixture intentionally intersects the actual existing planter');
  const sim=new Simulation(undefined,{mode:'exploration',exploration:saved}),p=sim.state.players.gold;
  assert.equal(sim.state.regionId,region);assert.equal(p.y,0);assert(p.grounded&&!p.mounted);assert(world.isSafe!(p.x,p.z,p.y,.66));
  const delta=Math.hypot(p.x-x,p.z-z);assert(delta>.1&&delta<2,'repair projects to local floor rather than returning to the doorway');
  const exported=sim.exportExploration();assert.deepEqual(exported.loadouts.gold,saved.loadouts.gold);assert(saved.discoveredRegions.every(id=>exported.discoveredRegions!.includes(id)));
  const cold=new Simulation(undefined,{mode:'exploration',exploration:exported});assert.equal(cold.state.regionId,region);assert(Math.hypot(cold.state.players.gold.x-p.x,cold.state.players.gold.z-p.z)<.001,'second cold restore remains at the repaired point');
 });
}
test('a legal existing interior save retains its exact ground position and facing',()=>{
 for(const region of ['mushroom-home','canopy-home']){
  const saved=createExplorationSave('white',region),z=region==='mushroom-home'?-2:4;saved.position={x:0,z,yaw:1.2};const sim=new Simulation(undefined,{mode:'exploration',exploration:saved}),p=sim.state.players.white;
  assert.equal(sim.state.regionId,region);assert.equal(p.x,0);assert.equal(p.z,z);assert.equal(p.yaw,1.2);
 }
});
test('selected smaller mushroom room migrates obsolete outer-wall and new-cabinet positions, preserving loadout and safe cold resume',()=>{
 for(const [x,z] of [[-6,5.5],[0,4]]){
  const saved=createExplorationSave('gold','mushroom-home');saved.position={x,z,yaw:.7};saved.loadouts.gold={weaponId:'chime',skinId:'forest',skillIds:['nova','shield']};
  const world=createRegionMovementWorld('mushroom-home');assert.equal(world.isSafe!(x,z,0,.66),false);
  const sim=new Simulation(undefined,{mode:'exploration',exploration:saved}),p=sim.state.players.gold;assert(world.isSafe!(p.x,p.z,p.y,.66));assert.equal(sim.state.regionId,'mushroom-home');assert.equal(p.yaw,.7);
  const exported=sim.exportExploration();assert.deepEqual(exported.loadouts.gold,saved.loadouts.gold);const cold=new Simulation(undefined,{mode:'exploration',exploration:exported});assert(Math.hypot(cold.state.players.gold.x-p.x,cold.state.players.gold.z-p.z)<.001);
 }
});
