import {ANIMAL_SPECIES,type AnimalSpecies} from '../shared/animal-care';
type Voice={source:AudioBufferSourceNode;gain:GainNode;species:AnimalSpecies;priority:boolean};
/** Original short synthesis, bounded voices and region-scoped decoded buffers. */
export class AnimalAudio{
 private region='';private allowed=false;private token=0;private buffers=new Map<AnimalSpecies,Promise<AudioBuffer>>();private voices=new Set<Voice>();private last=new Map<string,number>();private count=0;private speciesCounts:Record<string,number>={};
 constructor(private get:()=>{context:AudioContext|null;gain:GainNode|null;active:boolean;volume:number}){}
 update(region:string,allowed:boolean){if(this.region!==region){this.stop();this.region=region;this.buffers.clear();this.last.clear();}this.allowed=allowed;if(!allowed||!this.get().volume)this.stop();}
 stop(){this.token++;for(const v of this.voices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}this.voices.clear();}
 async play(species:unknown,distance:number,priority=false){
  if(!ANIMAL_SPECIES.includes(species as AnimalSpecies)||distance>22)return;
  const {context:c,gain,volume,active}=this.get();if(!c||!gain||!volume||!active||c.state!=='running'||!this.allowed||document.hidden)return;
  const name=species as AnimalSpecies,now=c.currentTime;
  if(priority)for(const v of [...this.voices])if(!v.priority&&(v.species===name||this.voices.size>=2)){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();this.voices.delete(v);}
  if(this.voices.size>=2||!priority&&(now-(this.last.get(name)??-Infinity)<2.5||now-(this.last.get('*')??-Infinity)<.35))return;this.last.set(name,now);this.last.set('*',now);
  const token=this.token;let loading=this.buffers.get(name);if(!loading){loading=fetch('/assets/audio/animals/v18/'+name+'.wav').then(r=>{if(!r.ok)throw Error('animal voice');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b));this.buffers.set(name,loading);}
  try{const buffer=await loading;if(token!==this.token||!this.allowed||!this.get().volume||c.state!=='running'||document.hidden||this.voices.size>=2)return;
   const source=c.createBufferSource(),g=c.createGain();source.buffer=buffer;g.gain.value=Math.max(0,1-distance/22)*.65;source.connect(g).connect(gain);const v={source,gain:g,species:name,priority};this.voices.add(v);this.count++;this.speciesCounts[name]=(this.speciesCounts[name]??0)+1;source.onended=()=>{source.disconnect();g.disconnect();this.voices.delete(v);};source.start();
  }catch{this.buffers.delete(name);}
 }
 get metrics(){return {region:this.region,allowed:this.allowed,voices:this.voices.size,cached:this.buffers.size,count:this.count,species:{...this.speciesCounts}};}
}
