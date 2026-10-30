import test from 'node:test';
import assert from 'node:assert/strict';
import {canopyCameraGroundHeight,canopySurface,regionGroundHeight} from '../src/regions';

test('camera under the tree deck uses real terrain, not the suspended floor',()=>{
 for(const [x,z]of [[0,42],[2,46],[-5,50]]){
  const ground=regionGroundHeight('canopy-garden',x,z);
  assert.equal(canopyCameraGroundHeight(x,z,ground+2),ground);
  assert.equal(canopyCameraGroundHeight(x,z,9.5),8);
 }
});
test('camera under a stair remains below it, while the upper space retains that stair',()=>{
 for(const [x,z]of [[-5.5,18],[.5,32]]){
  const stair=canopySurface(x,z)!.y,ground=regionGroundHeight('canopy-garden',x,z);
  assert.equal(canopyCameraGroundHeight(x,z,stair-.2),ground);
  assert.equal(canopyCameraGroundHeight(x,z,stair+1.5),Math.max(ground,stair));
 }
});
test('ordinary open ground stays unchanged at either camera height',()=>{
 const x=15,z=20,ground=regionGroundHeight('canopy-garden',x,z);
 assert.equal(canopyCameraGroundHeight(x,z,ground+1),ground);
 assert.equal(canopyCameraGroundHeight(x,z,20),ground);
});
test('a normal sight line under the deck is not shortened to the character near plane',()=>{
 const x=0,z=42,ground=regionGroundHeight('canopy-garden',x,z);
 const targetY=ground+1.3,dy=2.4,dz=-7.6,distance=Math.hypot(dy,dz);
 let clear=distance;
 for(let d=.15;d<distance;d+=.15){
  const probeY=targetY+dy*d/distance,probeZ=z+dz*d/distance;
  if(probeY<canopyCameraGroundHeight(x,probeZ,probeY)+.3){clear=Math.max(.05,d-.15);break;}
 }
 assert.equal(clear,distance);
 assert(targetY<canopySurface(x,z)!.y+.3,'the former highest-deck rule must falsely reject this legal line');
});
