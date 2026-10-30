import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {createExplorationSave} from '../src/exploration';
import {regionBounds,createRegionMovementWorld,GIANT_MUSHROOMS,regionWoodland,getRegionChapter,regionGroundHeight} from '../src/regions';
import {studioTreeObstacles} from '../src/studio-woodland';
import {pathDistance} from '../src/world-surfaces';
function walk(s:Simulation,x:number,z:number){for(let i=0;i<6000;i++){const p=s.state.players.gold,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.15)return;s.command('gold',{x:dx/Math.max(d,.2),z:dz/Math.max(d,.2),actions:[],sprint:true});s.tick(.02);}throw Error('Blocked at '+JSON.stringify(s.state.players.gold));}
test('tenfold forest is real navigable area, with a connected loop and persistent northern position',()=>{
 const b=regionBounds('mushroom-grove');assert.equal((b.maxX-b.minX)*(b.maxZ-b.minZ),112*178*10);assert(GIANT_MUSHROOMS.length>350);
 const s=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold','mushroom-grove')});
 for(const [x,z]of [[4,0],[55,0],[55,155],[55,303],[55,451],[55,583],[-55,583]])walk(s,x,z);
 const stored=s.exportExploration(),restored=new Simulation(undefined,{mode:'exploration',exploration:stored});assert(restored.state.players.gold.z>580);assert.equal(restored.state.regionId,'mushroom-grove');
 for(const [x,z]of [[-55,451],[-55,303],[-55,155],[-55,0]])walk(restored,x,z);
 assert.equal(s.save.completedChapters.length,0);
});
test('woodland uses deterministic protected layouts and same-source finite wood collision',()=>{
 for(const id of ['ch01-lantern-village','ch03-wandering-woods','mushroom-grove','canopy-garden']){
  const ch=getRegionChapter(id),trees=regionWoodland(id,ch),world=createRegionMovementWorld(id,ch);assert(trees.length>5);
  assert.deepEqual(trees,regionWoodland(id,ch));
  for(const t of trees){assert(pathDistance(ch,t.x,t.z)>=5);const wood=studioTreeObstacles(t,regionGroundHeight(id,t.x,t.z));assert(wood.length>0);assert(wood.every(b=>b.top!>b.bottom!&&Number.isFinite(b.r)));}
  const t=trees[0],wood=studioTreeObstacles(t,regionGroundHeight(id,t.x,t.z))[0];assert.notDeepEqual(world.resolveAt(wood.x,wood.z,wood.bottom!+.05,.66,2.1),{x:wood.x,z:wood.z});
 }
});
test('new small room relocates an obsolete indoor checkpoint without changing region or IDs',()=>{
 const f=createExplorationSave('white','mushroom-home');f.position={x:-5,z:8,y:0,yaw:1};const s=new Simulation(undefined,{mode:'exploration',exploration:f}),p=s.state.players.white;
 assert.equal(s.state.regionId,'mushroom-home');assert(createRegionMovementWorld('mushroom-home').isSafe!(p.x,p.z,p.y,.66));assert.equal(s.exportExploration().role,'white');
});
