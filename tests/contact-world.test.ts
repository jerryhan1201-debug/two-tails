import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world';
import { CHAPTERS } from '../src/content';
import { moveBody, settleBodies, PLAYER_RADIUS, type ContactBody } from '../src/combat-contact';
const world=()=>Object.assign(Object.create(World.prototype),{chapter:CHAPTERS[0],obstacles:[]}) as World;
test('walking or dodging against a bridge rail cannot teleport the body to a distant river bank',()=>{
 const w=world();
 for(const dz of [0,.05]){
  const body:ContactBody={id:'dog',x:25.7,z:37,radius:PLAYER_RADIUS},start={...body};
  moveBody(body,.55,dz,[body],(x,z,r)=>w.resolvePosition(x,z,r));
  assert.ok(Math.hypot(body.x-start.x,body.z-start.z)<=.56,'world projection must not turn a blocked step into a cross-river teleport');
  assert.ok(Math.abs(body.x-25)+body.radius<=1.63*.85+.03);
 }
});

test('body separation beside a bridge rail cannot project a trapped partner onto the bank',()=>{
 const w=world(),a:ContactBody={id:'gold',x:25.7,z:37,radius:PLAYER_RADIUS},b:ContactBody={id:'white',x:25,z:37,radius:PLAYER_RADIUS};
 for(let i=0;i<20;i++){
  const oldA={...a},oldB={...b};settleBodies([a,b],(x,z,r)=>w.resolvePosition(x,z,r),.22);
  for(const [body,old]of [[a,oldA],[b,oldB]])assert.ok(Math.hypot(body.x-old.x,body.z-old.z)<=.2201);
 }
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=1.32);assert.ok(Math.abs(a.z-37)<.01&&Math.abs(b.z-37)<.01);
});

test('a legacy wider-bridge position can step back onto the current deck without a snap',()=>{
 const w=world(),a:ContactBody={id:'legacy',x:25.9,z:37,radius:PLAYER_RADIUS};
 for(let i=0;i<12;i++){const old={...a};moveBody(a,-.05,0,[a],(x,z,r)=>w.resolvePosition(x,z,r));assert.ok(Math.hypot(a.x-old.x,a.z-old.z)<=.051);}
 assert.ok(a.x<25.5&&Math.abs(a.z-37)<.01);
});
