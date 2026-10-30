import test from 'node:test';import assert from'node:assert/strict';
import{villaMovementWorld as w}from'../src/villa-physics';import{advanceMovement}from'../src/movement';
test('villa stair entry steps onto its tread without treating that tread underside as a ceiling',()=>{
 const p={x:8.3,y:.3,z:3.2,vy:0,grounded:true,sprinting:false,safeX:8.3,safeY:.3,safeZ:3.2,landing:0};
 for(let i=0;i<30;i++){const result=advanceMovement(p,0,-1,1/60,w,.66,(dx,dz,y)=>{const v=w.resolveAt(p.x+dx,p.z+dz,y,.66,2.1);p.x=v.x;p.z=v.z;});assert(!result.needsRecovery);}
 assert(p.z<2.8);assert(Math.abs(p.y-.54)<.001);assert(p.grounded);
 // A character below the elevated flight still meets the physical underside.
 const under=w.ceilingAt!(8.3,0,.3,.66);assert(under!==null&&under<2.4);
});
