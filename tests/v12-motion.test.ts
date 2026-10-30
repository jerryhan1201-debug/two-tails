import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/simulation';import {freshSave} from '../shared/save';import {advanceFlight,FLIGHT_SPEED,FLIGHT_BOOST_SPEED,FLIGHT_CLIMB_SPEED,FLIGHT_MAX_HEIGHT,type MovementWorld} from '../src/movement';import {villaMovementWorld} from '../src/villa-physics';import {TREE_PROFILE} from '../src/villa-tree-profile';
const flat:MovementWorld={bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000},surfaceAt:()=>({y:0,walkable:true,id:'ground'}),resolveAt:(x,z)=>({x,z}),ceilingAt:()=>null,isSafe:()=>true};
function fly(p:ReturnType<typeof flyer>,x:number,z:number,lift:number,boost:boolean,dt:number,world:MovementWorld){return advanceFlight(p,x,z,lift,boost,dt,world,.66,(dx,dz,y)=>{const q=world.resolveAt(p.x+dx,p.z+dz,y,.66,2.1);p.x=q.x;p.z=q.z;});}
function flyer(){const p=new Simulation(freshSave('flight-fixture')).state.players.gold;Object.assign(p,{x:0,y:8,z:0,safeX:0,safeY:0,safeZ:0,mounted:true,grounded:false,flight:'flying',vx:0,vz:0,vy:0});return p;}
test('both actual settled horizontal speeds are exactly baseline ×1.15 and vertical constants remain unchanged',()=>{
 assert(Math.abs(FLIGHT_SPEED-8.2*1.15)<1e-12);assert(Math.abs(FLIGHT_BOOST_SPEED-11*1.15)<1e-12);assert.equal(FLIGHT_CLIMB_SPEED,4.5);assert.equal(FLIGHT_MAX_HEIGHT,24);
 for(const boost of [false,true])for(const dt of [.016,.05,.2]){const p=flyer();for(let t=0;t<2;t+=dt)fly(p,1,0,0,boost,dt,flat);const x=p.x;for(let i=0;i<10;i++)fly(p,1,0,0,boost,dt,flat);assert(Math.abs((p.x-x)/(dt*10)-(boost?12.65:9.43))<1e-7,JSON.stringify({boost,dt,measured:(p.x-x)/(dt*10),p}));}
 const p=flyer();for(let i=0;i<200;i++)fly(p,0,0,1,true,.05,flat);assert.equal(p.y,24);
});
test('boosted low-frame approach cannot tunnel through a thin villa wall; upper trunk transition remains solid',()=>{
 const p=flyer();Object.assign(p,{x:46,y:.6,z:20,safeX:40,safeY:.26,safeZ:20});for(let i=0;i<30;i++)fly(p,-1,0,0,true,.2,villaMovementWorld);assert(p.x>=43.8,'east courtyard wall blocks boosted flight below its top');
 for(const y of [5.3,5.8,6.6,7.6,8.7,9.8]){const q=villaMovementWorld.resolveAt(31,15,y,.66,2.1);assert(Math.hypot(q.x-31,q.z-15)>1,'repaired trunk is not a visual-only cone');}
 assert(TREE_PROFILE.length>=8);for(let i=1;i<TREE_PROFILE.length;i++){assert(TREE_PROFILE[i][0]>TREE_PROFILE[i-1][0]);assert(TREE_PROFILE[i][1]<TREE_PROFILE[i-1][1]);}
});
test('only gold starts an immediate outdoor ride; proximity, floor and wall checks reject unsafe starts',()=>{
 const s=new Simulation({...freshSave('v14-outdoor-ride'),mode:'coop-exploration'});s.state.enemies=[];s.setMovementWorld(flat);
 const position=()=>{for(const[r,x]of [['gold',2],['white',0]]as const)Object.assign(s.state.players[r],{x,y:0,z:0,safeX:x,safeY:0,safeZ:0,grounded:true,action:'idle',speed:0});};position();
 s.command('white',{x:0,z:0,actions:[],duo:{kind:'invite',type:'ride'}});assert(!s.state.duo);s.command('gold',{x:0,z:0,actions:[],duo:{kind:'invite',type:'ride'}});assert.equal(s.exportLiveSnapshot().duo?.phase,'active');s.resetMovement(true);
 for(const pos of [{x:20,y:0,z:0},{x:1,y:5.1,z:0}]){position();Object.assign(s.state.players.gold,pos);s.command('gold',{x:0,z:0,actions:[],duo:{kind:'invite',type:'ride'}});assert(!s.state.duo);}
 position();s.setMovementWorld({...flat,resolveAt:(x,z)=>({x:x>.4&&x<1.5?x+1:x,z})});s.command('gold',{x:0,z:0,actions:[],duo:{kind:'invite',type:'ride'}});assert(!s.state.duo);
});
