import{PROTOCOL_VERSION}from'../shared/protocol';
import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomHub,type Peer,type Store,type StoredAdventure,type StoredRoom} from '../server/core';
import {Simulation} from '../src/simulation';
import {CHAPTERS} from '../src/content';
import {JOURNEY_NODES,useJourney} from '../src/journeys';
import {emptyJourneys} from '../shared/journeys';
import {regionGroundHeight} from '../src/regions';
import type {JsonObject} from '../shared/save';
class MemoryStore implements Store {
  saves=new Map<string,StoredAdventure>();rooms:StoredRoom[]=[];
  async load(id:string){return structuredClone(this.saves.get(id)??null);}
  async save(id:string,value:StoredAdventure){this.saves.set(id,structuredClone(value));}
  async loadRooms(){return structuredClone(this.rooms);}
  async saveRooms(rooms:StoredRoom[]){this.rooms=structuredClone(rooms);}
}
class Client implements Peer {messages:{kind:string;payload:any}[]=[];send(s:string){this.messages.push(JSON.parse(s));}close(){}last(kind:string){return this.messages.filter(m=>m.kind===kind).at(-1)?.payload;}}
test('guest ordinary E reaches the authority, both receive mechanism revision, durable ACK and cold restart preserve it',async()=>{
 const store=new MemoryStore(),hub=new RoomHub(store);await hub.init();
 const tokenH='1'.repeat(64),tokenG='2'.repeat(64),made=await hub.create(tokenH);await hub.join(made.room.code,tokenG);
 const host=new Client(),guest=new Client(),hs=hub.connect(made.room.code,host),gs=hub.connect(made.room.code,guest);let hi=0,gi=0;
 const sendH=(kind:string,payload:unknown={})=>hub.receive(hs,JSON.stringify({v:PROTOCOL_VERSION,seq:hi++,kind,payload}));
 const sendG=(kind:string,payload:unknown={})=>hub.receive(gs,JSON.stringify({v:PROTOCOL_VERSION,seq:gi++,kind,payload}));
 await sendH('hello',{clientToken:tokenH});await sendG('hello',{clientToken:tokenG});await sendH('ready',{ready:true});await sendG('ready',{ready:true});await sendH('start');
 const save=structuredClone(made.save);save.chapterId=CHAPTERS[1].id;save.completedChapters=[CHAPTERS[0].id];let progress=emptyJourneys();
 for(const id of ['river-staff-gauge','river-intake-valve','river-intake-valve','river-outlet-valve','river-outlet-valve','river-outlet-valve'])progress=useJourney(progress,JOURNEY_NODES.find(n=>n.id===id)!).progress;
 save.world.journeys=progress as unknown as JsonObject;
 const sim=new Simulation(save),lever=JOURNEY_NODES.find(n=>n.id==='river-check-lever')!;sim.state.enemies=[];
 for(const [i,role]of (['gold','white'] as const).entries()){const x=lever.x+(i?.8:-.8),y=regionGroundHeight(sim.state.regionId,x,lever.z);Object.assign(sim.state.players[role],{x,z:lever.z,y,safeX:x,safeZ:lever.z,safeY:y});}
 sim.command('gold',{x:0,z:0,actions:['interact']});sim.tick(.01);await sendH('snapshot',{snapshot:sim.exportLiveSnapshot()});
 assert.equal(guest.last('snapshot').journeyProposal.proposer,'gold');
 await sendG('input',{input:{x:0,z:0,actions:['interact']}});const relayed=host.last('input');assert.equal(relayed.role,'white');sim.command(relayed.role,relayed.input);sim.tick(.01);
 await sendH('snapshot',{snapshot:sim.exportLiveSnapshot()});assert.equal(guest.last('snapshot').journeys.entries['river-levels'].stage,2);assert(!guest.last('snapshot').journeyProposal);assert(guest.last('snapshot').flags.includes('journey-river-footway'));
 await sendG('snapshot',{snapshot:sim.exportLiveSnapshot()});assert.equal(guest.last('error').code,'HOST_ONLY');
 await sendH('save',{save:sim.exportSave(),expectedRevision:0,requestId:'journey-ack'});assert.equal(host.last('saved').revision,1);
 const coldHub=new RoomHub(store);await coldHub.init();const durable=(await coldHub.authorize(made.credentials)).save,cold=new Simulation(durable);
 assert.equal(cold.state.journeys.revision,sim.state.journeys.revision);assert.equal(cold.state.journeys.entries['river-levels'].values.intake,2);assert.equal(cold.state.journeys.entries['river-levels'].values.outlet,3);assert(cold.state.flags.includes('journey-river-footway'));assert(!cold.state.journeyProposal);
});
