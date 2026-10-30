import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDensity,AutoResolution} from '../src/render-resolution';
test('high quality uses device pixels within explicit density, dimension and area budgets',()=>{
 assert.equal(renderDensity(1180,820,2,'high'),2);
 assert.equal(renderDensity(844,390,3,'high'),2);
 for(const [w,h,d]of [[1920,1080,2],[3840,2160,2],[1366,1024,3]]){const r=renderDensity(w,h,d,'high');assert(w*h*r*r<=4_200_001);assert(w*r<=3200.01);assert(h*r<=2200.01);}
});
test('auto ignores warmup, has a lower bound and recovers with hysteresis',()=>{
 const a=new AutoResolution();a.reset(1.5);
 a.sample(10,4,true);a.sample(10,4,true);assert.equal(a.density,1.5);
 for(let i=0;i<50;i++)a.sample(20,4,true);assert.equal(a.density,.85);
 for(let i=0;i<80;i++)a.sample(60,4,true);assert.equal(a.density,1.5);
 a.warmup();a.sample(10,4,true);assert.equal(a.density,1.5);
 for(let i=0;i<20;i++)a.sample(10,4,false);assert.equal(a.density,1.5);
});

test('automatic effect tiers use sustained P95 and ignore loading; manual pixels stay bounded',async()=>{const{AutoQuality}=await import('../src/render-resolution');const q=new AutoQuality();const sample=(dt:number)=>{for(let i=0;i<200;i++)q.observe(dt,true);return q.sample(4);};for(let i=0;i<10;i++){q.observe(300,false);q.sample(4);}assert.equal(q.tier,'medium');for(let i=0;i<10;i++)sample(45);assert.equal(q.tier,'low');for(let i=0;i<24;i++)sample(16.7);assert.equal(q.tier,'high');const weak=new AutoQuality(true);for(let i=0;i<50;i++){for(let j=0;j<200;j++)weak.observe(16.7,true);weak.sample(4);}assert.equal(weak.tier,'medium');});
