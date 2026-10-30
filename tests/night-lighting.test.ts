import test from 'node:test';
import assert from 'node:assert/strict';
import {Color3,DirectionalLight,HemisphericLight,NullEngine,PBRMaterial,PointLight,Scene,Vector3} from '@babylonjs/core';
import {WorldWeather} from '../src/world-weather';

function fixture(indoor=false){
 const engine=new NullEngine(),scene=new Scene(engine);
 const sun=new DirectionalLight('sun',new Vector3(-1,-1,1),scene);sun.intensity=indoor?1.3:2.95;
 const sky=new HemisphericLight('sky',Vector3.Up(),scene);sky.intensity=indoor?.48:.33;
 scene.environmentIntensity=.7;
 const weather=new WorldWeather(scene),focus={x:0,y:0,z:0};
 const update=(time:number,active=true)=>weather.update(time,indoor?'mushroom-home':'mushroom-grove',indoor,focus,'high',active);
 const close=()=>{weather.dispose();scene.dispose();engine.dispose();};
 return{scene,sun,sky,focus,update,close};
}

for(const indoor of [false,true])test(`${indoor?'interior':'outdoor'} night light remains directional and returns exactly to daylight`,()=>{
 const f=fixture(indoor);
 try{
  f.update(0);const before={sun:f.sun.intensity,sky:f.sky.intensity,environment:f.scene.environmentIntensity,sunColor:f.sun.diffuse.asArray(),skyColor:f.sky.diffuse.asArray()};
  f.update(390);assert(f.sun.intensity<before.sun*.4);assert(f.sky.intensity<before.sky);assert(f.scene.environmentIntensity<before.environment);
  f.update(0);assert.equal(f.sun.intensity,before.sun);assert.equal(f.sky.intensity,before.sky);assert.equal(f.scene.environmentIntensity,before.environment);assert.deepEqual(f.sun.diffuse.asArray(),before.sunColor);assert.deepEqual(f.sky.diffuse.asArray(),before.skyColor);
  f.update(390,false);assert.equal(f.sun.intensity,before.sun);assert.equal(f.sky.intensity,before.sky);
 }finally{f.close();}
});

test('night windows release the four-light room budget to the existing warm lamps and reverse at dawn',()=>{
 const f=fixture(true);
 try{
  const windows=[0,1].map(i=>{const light=new PointLight('window '+i,new Vector3(i,3,10),f.scene);light.metadata={nightWindow:true,dayIntensity:2.3};return light;});
  const lamps=[0,1].map(i=>{const light=new PointLight('room lamp '+i,new Vector3(i,1,0),f.scene);light.metadata={nightRoomLamp:true,dayIntensity:1.4};return light;});
  const view=new PBRMaterial('separate window view',f.scene),albedo=new Color3(.6,.7,.5),emissive=new Color3(.2,.2,.2);view.metadata={nightWindowView:true,dayAlbedo:albedo.clone(),dayEmissive:emissive.clone()};
  f.update(0);assert(windows.every(l=>l.isEnabled()&&l.intensity===2.3));
  f.update(390);assert(windows.every(l=>!l.isEnabled()&&l.intensity===0));assert(lamps.every(l=>l.isEnabled()&&l.intensity===1.4));assert.equal(f.scene.lights.filter(l=>l.isEnabled()).length,4);assert(view.albedoColor.r<albedo.r*.5);assert(view.emissiveColor.equals(Color3.Black()));
  f.update(0);assert(windows.every(l=>l.isEnabled()&&l.intensity===2.3));assert(view.albedoColor.equals(albedo));assert(view.emissiveColor.equals(emissive));
 }finally{f.close();}
});

test('two reusable lantern lights select distinct nearby sources without accumulating lights or meshes',()=>{
 const f=fixture();
 try{
  const sources=[{position:new Vector3(0,2,0),power:2,range:8},{position:new Vector3(1,2,0),power:2,range:8},{position:new Vector3(8,2,0),power:2.5,range:9}];
  const pools=[0,1].map(slot=>{const light=new PointLight('pool '+slot,Vector3.Zero(),f.scene);light.metadata={nightLanternPool:true,slot,sources};return light;});
  const hearth=new PointLight('hearth',Vector3.Zero(),f.scene);hearth.metadata={nightReplacedHearth:true};
  const counts={lights:f.scene.lights.length,meshes:f.scene.meshes.length,materials:f.scene.materials.length};
  f.update(0);assert(pools.every(l=>!l.isEnabled()));assert(hearth.isEnabled());
  f.update(390);assert(pools.every(l=>l.isEnabled()));assert(!hearth.isEnabled());assert.equal(f.scene.lights.filter(l=>l.isEnabled()).length,4);assert(pools[0].position.equals(sources[0].position));assert(pools[1].position.equals(sources[2].position));
  f.focus.x=100;f.update(390);assert(pools.every(l=>!l.isEnabled()));
  f.focus.x=0;for(let i=0;i<60;i++)f.update(i%2?0:390);
  assert.deepEqual({lights:f.scene.lights.length,meshes:f.scene.meshes.length,materials:f.scene.materials.length},counts);assert(pools.every(l=>!l.isEnabled()));assert(hearth.isEnabled());
 }finally{f.close();}
});
