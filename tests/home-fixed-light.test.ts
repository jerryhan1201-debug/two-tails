import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,SpotLight,Vector3,MeshBuilder} from '@babylonjs/core';
import {transitionLight} from '../src/light-transition';

test('fixed home fixtures bind once, fade before relocation, and retain daylight intensity changes',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),light=new SpotLight('shared accent',Vector3.Zero(),Vector3.Down(),1.6,1.2,scene);
 light.setEnabled(false);
 const mesh=MeshBuilder.CreateBox('illuminated furniture',{},scene),change=transitionLight(light);let placements=0,resyncs=0;
 const original=(light as any)._resyncMeshes.bind(light);(light as any)._resyncMeshes=()=>{resyncs++;original();};
 const place=(x:number)=>()=>{placements++;light.position.x=x;light.includedOnlyMeshes=[mesh];};
 try{
  for(let i=0;i<120;i++)change('desk',3.5,1/60,place(1));
  assert.equal(placements,1);assert(resyncs<=3,'only initial selection and light-enable notifications resync');
  assert.equal(light.position.x,1);assert(light.intensity>3.49);
  const before=resyncs;for(let i=0;i<120;i++)change('desk',7,1/60,place(1));
  assert.equal(placements,1);assert.equal(resyncs,before);assert(light.intensity>6.99);
  const late=MeshBuilder.CreateBox('late unrelated animal',{},scene);assert(!late.lightSources.includes(light),'late meshes retain the authored painting-only scope');light.includedOnlyMeshes.push(late);assert(late.lightSources.includes(light),'Babylon still updates explicitly changed membership');
  change('statue',42,1/60,place(8));assert.equal(light.position.x,1,'old fixed fixture does not slide while fading');
  for(let i=0;i<120;i++)change('statue',42,1/60,place(8));
  assert.equal(placements,2);assert.equal(light.position.x,8);assert(light.intensity>41.99);
  for(let i=0;i<120;i++)change('',0,1/60,()=>{});assert(!light.isEnabled());
  for(let i=0;i<120;i++)change('desk',3.5,1/60,place(1));assert.equal(placements,3);assert(light.isEnabled());assert(light.intensity>3.49);
 }finally{scene.dispose();engine.dispose();}
});
