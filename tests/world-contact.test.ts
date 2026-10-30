import test from 'node:test';
import assert from 'node:assert/strict';
import { World, type Obstacle } from '../src/world';
import { CHAPTERS } from '../src/content';

// Call the actual world resolver without creating a WebGL scene. The contact
// suite covers dynamic bodies; this suite covers terrain and authored obstacles.
function world(index=0, obstacles:Obstacle[]=[]):World {
  return Object.assign(Object.create(World.prototype),{chapter:CHAPTERS[index],obstacles});
}
test('actual world bounds reserve the complete body radius for dogs and large enemies',()=>{
  for(const r of [.66,1.27,2.106])for(const x of [-100,100])for(const z of [-100,150]){
    const p=world().resolvePosition(x,z,r);
    assert.ok(p.x>=-40+r&&p.x<=40-r&&p.z>=-20+r&&p.z<=112-r);
  }
});
test('actual rotated house resolver clears its wall for different body sizes',()=>{
  const rotation=.74,c=Math.cos(rotation),s=Math.sin(rotation);
  for(const r of [.66,1.27]){
    const p=world(0,[{x:9.5,z:-3.5,r:0,shape:'box',width:5,depth:4,rotation}]).resolvePosition(9.5,-3.5,r);
    const dx=p.x-9.5,dz=p.z+3.5,lx=dx*c-dz*s,lz=dx*s+dz*c;
    assert.ok(Math.abs(lx)>=2.5+r-1e-8||Math.abs(lz)>=2+r-1e-8);
  }
});
test('actual first-chapter creek bridge permits two dogs abreast and rejects railing crossing',()=>{
  const w=world();
  for(const z of [35,36,37,38,39])for(const x of [24.32,25.68])assert.deepEqual(w.resolvePosition(x,z,.66),{x,z});
  const p=w.resolvePosition(26,37,.66);assert.ok(Math.hypot(p.x-26,p.z-37)>1,'a body outside the usable deck must remain on the bank');
});
test('actual creek banks keep dogs out of water on both sides, with a continuous bridge height',()=>{
  const w=world();for(const z of [36.9,37.1]){
    const p=w.resolvePosition(19,z,.66);assert.ok(Math.abs(p.z-z)>1.5);
  }
  let prev=w.height(25,33.6);for(let z=33.65;z<40.4;z+=.05){const next=w.height(25,z);assert.ok(Math.abs(next-prev)<.1);prev=next;}
});
