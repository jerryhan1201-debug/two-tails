import './studio-fixture';import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{Simulation}from'../src/simulation';import{createExplorationSave}from'../src/exploration';import{animalTargets,reachableAnimal,animalClock}from'../src/animal-interactions';import{validAnimalCare,validAnimalCommand}from'../shared/animal-care';import{ANIMAL_SITES,animalSample}from'../src/animal-schedule';import{freshSave}from'../shared/save';
const coverage=JSON.parse(readFileSync('artifacts/v18/animals/coverage.json','utf8')).coverage;
for(const[species,f]of Object.entries(coverage) as [string,any][])test(species+' real reducer responds once, coordinates stay fixed, bounded pause resumes and no persistent reward',()=>{
 const sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold',f.region)}),s=sim.state,w=(sim as any).movementWorld;s.time=f.time;const p=s.players.gold;Object.assign(p,f.position,{safeX:f.position.x,safeY:f.position.y,safeZ:f.position.z,grounded:true});const initial={x:p.x,y:p.y,z:p.z},before=structuredClone(s.journeys),a=animalTargets(s,w).find(a=>a.id===f.target.id)!;assert(a);assert(reachableAnimal(s,w,p,a));
 sim.command('gold',{x:0,z:0,actions:[],animal:{id:a.id,kind:'play'}});assert.equal(s.animalCare?.reactions.length,1);assert(validAnimalCare(s.animalCare));assert.equal(s.events.filter(e=>e.type==='animal-call').length,1);assert.equal(p.action,'interact');assert.deepEqual({x:p.x,y:p.y,z:p.z},initial);
 Object.assign(s.players.white,p,{role:'white'});sim.command('white',{x:0,z:0,actions:[],animal:{id:a.id,kind:'greet'}});assert.equal(s.animalCare?.reactions.length,1);assert.equal(s.events.filter(e=>e.type==='animal-call').length,1);assert.deepEqual(s.journeys,before);
 // Keep this unit scenario isolated from ordinary enemy/player movement.
 const controller=(sim as any).animalInteractions;s.time+=6.3;controller.tick(s,w,['gold'],()=>{});assert.equal(s.animalCare?.reactions.length,0);assert(validAnimalCare(s.animalCare));const site=ANIMAL_SITES.find(a=>a.id===f.target.id);if(site){const resumed=animalSample(site,animalClock(s,site.id));assert(Math.hypot(resumed.x-a.x,resumed.z-a.z)<.25);}
 assert(!JSON.stringify(sim.exportExploration()).includes('animalCare'));
});
test('invalid input, far away, floor mismatch and a real ray barrier reject animal commands',()=>{
 assert(!validAnimalCommand({id:'x',kind:'feed',coins:1}));assert(!validAnimalCommand({id:'x'.repeat(200),kind:'play'}));
 const f=coverage['golden-retriever'],sim=new Simulation(undefined,{mode:'exploration',exploration:createExplorationSave('gold',f.region)}),s=sim.state,w=(sim as any).movementWorld;s.time=f.time;const a=animalTargets(s,w).find(a=>a.id===f.target.id)!,p=s.players.gold;Object.assign(p,f.position,{grounded:true});assert(reachableAnimal(s,w,p,a));
 assert(!reachableAnimal(s,w,{...p,x:p.x+30},a));assert(!reachableAnimal(s,w,{...p,y:p.y+4.8},a));assert(!reachableAnimal(s,{...w,resolveAt(x,z,y,r){return r===.06?{x:x+1,z}:w.resolveAt(x,z,y,r,2.1);}},p,a));
});
test('disconnect cancellation is immediate and live bounded state never enters adventure persistence',()=>{
 const sim=new Simulation(freshSave('animal-care-test'));sim.state.mode='coop-exploration';const s=sim.state,w=(sim as any).movementWorld,a=animalTargets(s,w).find(a=>a.species==='badger')!,p=s.players.gold;
 for(let i=0;i<32;i++){const x=a.x+Math.sin(i*Math.PI/16)*2,z=a.z+Math.cos(i*Math.PI/16)*2,y=w.surfaceAt(x,z,a.y+.3,.66)?.y;if(y===undefined)continue;Object.assign(p,{x,y,z,grounded:true});if(reachableAnimal(s,w,p,a))break;}
 sim.command('gold',{x:0,z:0,actions:[],animal:{id:a.id,kind:'greet'}});assert(s.animalCare?.reactions.length);assert(!JSON.stringify(sim.exportSave()).includes('animalCare'));sim.resetMovement(true,'gold');assert.equal(s.animalCare?.reactions.length,0);
});
