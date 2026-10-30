/// <reference types="vite/client" />
import type { Biome } from "./content";
import {MUSIC_CUES,musicForRegion,type MusicCueId} from './music-cues';
import{castleLightningAt}from'./castle-weather';
import {AnimalAudio} from './animal-audio';

type BrowserAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
type PlayingLoop = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  id: string;
};

/** Gesture-unlocked audio, per-channel gains, lazy scene music and soft transitions. */
export class AudioManager {
  private animalVoices=new AnimalAudio(()=>({context:this.context,gain:this.effectsGain,active:this.active,volume:this.sfxVolume}));
  updateAnimals(region:string,allowed:boolean){this.animalVoices.update(region,allowed);}
  animalCall(species:unknown,at:{x:number;z:number;y?:number;value?:number},listener:{x:number;y:number;z:number}){void this.animalVoices.play(species,Math.hypot(at.x-listener.x,at.z-listener.z,(at.y??listener.y)-listener.y),at.value===1);}
  get animalAudioMetrics(){return this.animalVoices.metrics;}
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private buffers = new Map<MusicCueId, Promise<AudioBuffer>>();
  private current: PlayingLoop | null = null;
  private retired = new Set<PlayingLoop>();
  private pending = 0;
  private musicVolume = 0.46;
  private sfxVolume = 0.62;
  private biome: Biome = "village";
  private musicId:MusicCueId = 'childhood';
  private musicAudible=true;
  private active = false;
  private disposed = false;
  private lastEffect = new Map<string, number>();
  private voices = 0;
  private wind: {source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode}|null=null;
  private windBuffer:AudioBuffer|null=null;
  private windTimer:ReturnType<typeof setTimeout>|undefined;
  private windPosition:{x:number;y:number;z:number;region:string;at:number}|null=null;
  private windSpeed=0;
  private ambience:{source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode;id:string}|null=null;
  private ambientRetired=new Set<{source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode;id:string}>();
  private noiseBuffer:AudioBuffer|null=null;
  private stepNoiseBuffer:AudioBuffer|null=null;
  private stormTime:number|null=null;
  private thunder:{source:AudioBufferSourceNode;filter:BiquadFilterNode;gain:GainNode}|null=null;
  private thunderCount=0;
  private stopThunder(){const a=this.thunder;if(!a)return;this.thunder=null;try{a.source.stop();}catch{}a.source.disconnect();a.filter.disconnect();a.gain.disconnect();}
  private updateStorm(region:string,time:number|undefined,indoor:boolean,allowed:boolean){
    const previous=this.stormTime,c=this.context;
    if(region!=='ch05-candle-castle'||time===undefined||!allowed||document.hidden||!c||c.state!=='running'||!this.active||!this.sfxVolume){this.stormTime=null;this.stopThunder();return;}
    this.stormTime=time;if(previous===null||time<previous||time-previous>1.2)return;
    const storm=castleLightningAt(time);if(!storm.eligible||previous>=storm.thunderAt||time<storm.thunderAt)return;
    this.stopThunder();const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),now=c.currentTime;
    source.buffer=this.sharedNoise();source.playbackRate.value=.68;filter.type='lowpass';filter.frequency.setValueAtTime(260,now);filter.frequency.exponentialRampToValueAtTime(95,now+3.8);filter.Q.value=.5;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(indoor?.16:.28,now+.24);gain.gain.exponentialRampToValueAtTime(.0001,now+4.35);
    source.connect(filter).connect(gain).connect(this.effectsGain!);const a={source,filter,gain};this.thunder=a;this.thunderCount++;source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();if(this.thunder===a)this.thunder=null;};
  }
  get castleAudioMetrics(){return{playing:!!this.thunder,count:this.thunderCount,time:this.stormTime};}
  private stepNoise(){const c=this.context!;if(!this.stepNoiseBuffer){const b=c.createBuffer(1,c.sampleRate*.25,c.sampleRate),d=b.getChannelData(0);let seed=2371,low=0;for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/4294967296*2-1;low=low*.75+n*.25;d[i]=n*.65+low*.35;}this.stepNoiseBuffer=b;}return this.stepNoiseBuffer;}

  private hearth:{source:AudioBufferSourceNode;gain:GainNode}|null=null;private hearthBuffer:AudioBuffer|null=null;private hearthLoading:Promise<void>|null=null;private hearthWanted=0;private hearthRetryAt=0;
  private stopHearth(){this.hearthWanted=0;const h=this.hearth;if(h){this.hearth=null;h.source.stop();h.source.disconnect();h.gain.disconnect();}}
  private updateHearth(volume:number){this.hearthWanted=volume;const c=this.context;if(!c||!volume||!this.active||!this.sfxVolume){this.stopHearth();return;}if(this.hearth){this.hearth.gain.gain.setTargetAtTime(volume,c.currentTime,.25);return;}
   if(!this.hearthBuffer){if(!this.hearthLoading&&performance.now()>this.hearthRetryAt)this.hearthLoading=fetch('/assets/maps/v15/snow/runtime/audio/hearth-loop.wav').then(r=>{if(!r.ok)throw Error('hearth');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).then(b=>{this.hearthBuffer=b;if(this.hearthWanted)this.updateHearth(this.hearthWanted);}).catch(()=>{this.hearthRetryAt=performance.now()+10000;}).finally(()=>this.hearthLoading=null);return;}
   const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.hearthBuffer;source.loop=true;gain.gain.value=0;source.connect(gain).connect(this.effectsGain!);source.start();gain.gain.setTargetAtTime(volume,c.currentTime,.35);this.hearth={source,gain};
  }
  private nextBird=0;
  private sharedNoise(){const c=this.context!;if(!this.noiseBuffer){const b=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=b.getChannelData(0);let seed=104729,smooth=0;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;smooth=.92*smooth+.08*(seed/4294967296*2-1);data[i]=smooth;}this.noiseBuffer=b;}return this.noiseBuffer;}
  private stopAmbience(immediate=false){if(immediate){this.stopHearth();this.stopThunder();this.stormTime=null;}const a=this.ambience;this.ambience=null;if(a){this.ambientRetired.add(a);const now=this.context!.currentTime;a.gain.gain.cancelAndHoldAtTime(now);a.gain.gain.linearRampToValueAtTime(0,now+(immediate?.01:.55));a.source.stop(now+(immediate?.02:.6));}
   if(immediate)for(const old of this.ambientRetired){try{old.source.stop();}catch{}old.source.disconnect();old.gain.disconnect();old.filter.disconnect();this.ambientRetired.delete(old);}}
  updateAmbience(region:string,indoor:boolean,night:boolean,allowed:boolean,position?:{x:number;y:number;z:number},time?:number){
   this.updateStorm(region,time,indoor,allowed);
   const distance=position?Math.hypot(position.x-48,position.z-155.8):100;this.updateHearth(allowed&&region==='studio-winter-lantern'&&indoor&&!document.hidden?Math.max(.06,.25-distance*.009):0);
   const c=this.context;if(!allowed||document.hidden||!this.active||!c||c.state!=='running'||!this.sfxVolume){this.stopAmbience();return;}
   const family=region==='player-home-villa'?'home':region==='mushroom-grove'?'grove':region==='mushroom-home'?'room':this.biome;
   const id=family+(indoor?'-inside':'-outside')+(night?'-night':'-day');
   if(this.ambience?.id!==id){this.stopAmbience();if(this.ambientRetired.size>1){const old=[...this.ambientRetired][0];try{old.source.stop();}catch{}}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.sharedNoise();source.loop=true;source.playbackRate.value=family==='grove'?.71:family==='river'?1.1:.9;filter.type='bandpass';filter.frequency.value=indoor?160:family==='grove'?night?1250:740:family==='river'?1100:family==='home'?430:620;filter.Q.value=.6;gain.gain.value=0;source.connect(filter).connect(gain).connect(this.effectsGain!);source.start();gain.gain.linearRampToValueAtTime(indoor?.035:family==='grove'?.11:.075,c.currentTime+1);const a={source,filter,gain,id};source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.ambientRetired.delete(a);};this.ambience=a;this.nextBird=c.currentTime+5;
   }
   if(!indoor&&c.currentTime>this.nextBird){this.nextBird=c.currentTime+(family==='grove'?19:27);this.sfx(night?'ambient-night':family==='village'?'ambient-village':'ambient-bird');}
  }
  get ambientAudioMetrics(){return{current:this.ambience?.id??null,retiring:this.ambientRetired.size,voices:this.voices,noiseBuffers:Number(!!this.noiseBuffer)};}
  /** Local travelled distance only; no audio state goes over the network. */
  updateFlight(p:{x:number;y:number;z:number;mounted:boolean;region:string}|null,allowed:boolean){
    const now=performance.now(),previous=this.windPosition;
    this.windPosition=p?{...p,at:now}:null;
    if(!p?.mounted||!allowed||document.hidden||!this.active||!this.context||this.sfxVolume===0){this.stopWind();return;}
    if(!previous||previous.region!==p.region){this.stopWind();return;}
    const elapsed=(now-previous.at)/1000;
    if(elapsed<=0||elapsed>.3){this.stopWind();return;}
    const speed=Math.min(13.5,Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z)/elapsed);
    this.windSpeed+=(speed-this.windSpeed)*(1-Math.exp(-elapsed*8));
    if(this.windSpeed<.2){this.stopWind();return;}
    if(this.windTimer!==undefined){clearTimeout(this.windTimer);this.windTimer=undefined;}
    const c=this.context;
    if(!this.wind){
      if(!this.windBuffer){
        const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let smooth=0,seed=7919;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;smooth=(smooth+.035*(seed/4294967296*2-1))/1.035;data[i]=smooth*4;}
        this.windBuffer=buffer;
      }
      const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.windBuffer;source.loop=true;
      filter.type='bandpass';filter.Q.value=.55;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this.effectsGain!);source.start();this.wind={source,filter,gain};
    }
    const v=Math.min(1,this.windSpeed/12.65),t=c.currentTime;
    this.wind.filter.frequency.setTargetAtTime(280+v*v*1000,t,.12);
    this.wind.gain.gain.setTargetAtTime(.075*v+.13*v*v,t,.12);
    this.wind.source.playbackRate.setTargetAtTime(.75+v*.42,t,.16);
  }
  private stopWind(immediate=false){
    this.windSpeed=0;
    if(!this.wind)return;
    if(this.windTimer!==undefined&&!immediate)return;
    const wind=this.wind;
    const dispose=()=>{try{wind.source.stop();}catch{}wind.source.disconnect();wind.filter.disconnect();wind.gain.disconnect();if(this.wind===wind)this.wind=null;this.windTimer=undefined;};
    if(immediate){clearTimeout(this.windTimer);dispose();return;}
    wind.gain.gain.setTargetAtTime(0,this.context!.currentTime,.045);this.windTimer=setTimeout(dispose,220);
  }
  get flightAudioMetrics(){return{playing:!!this.wind,stopping:this.windTimer!==undefined,speed:this.windSpeed,sfx:this.sfxVolume};}
  private gestureHandler = () => {
    if (!this.context || this.disposed || !this.active) return;
    if (this.context.state !== "running")
      void this.context.resume().catch(() => {});
    if (this.current?.id!==this.musicId) void this.switchLoop();
  };
  private visibilityHandler = () => {
    if (!this.context || this.disposed) return;
    if (document.hidden) {this.animalVoices.stop();this.stopAmbience(true);this.stopWind(true);this.windPosition=null;void this.context.suspend().catch(() => {});}
    else if (this.active) void this.context.resume().catch(() => {});
  };

  /** Invoke directly in the first click/touch handler, before awaiting anything else. */
  async start(): Promise<void> {
    if (this.disposed) return;
    if (!this.context) {
      const Audio =
        window.AudioContext ??
        (window as BrowserAudioWindow).webkitAudioContext;
      if (!Audio) return;
      this.context = new Audio({ latencyHint: "interactive" });
      this.musicGain = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.musicGain.gain.value = this.musicAudible?this.musicVolume:0;
      this.effectsGain.gain.value = this.sfxVolume;
      // Headroom protects the mix when many players/enemies act at once.
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 16;
      limiter.ratio.value = 5;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.16;
      this.musicGain.connect(limiter);
      this.effectsGain.connect(limiter);
      limiter.connect(this.context.destination);
      document.addEventListener("visibilitychange", this.visibilityHandler);
      document.addEventListener("pointerdown", this.gestureHandler, {
        passive: true,
      });
    }
    // resume must happen on the gesture stack, not after a network/decode await.
    await this.context.resume();
    this.active = true;
    await this.switchLoop();
  }

  setVolumes(music: number, sfx: number): void {
    const clamp = (n: number) =>
      Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
    this.musicVolume = clamp(music);
    this.sfxVolume = clamp(sfx);
    if(!this.sfxVolume)this.animalVoices.stop();
    if (this.context) {
      this.musicGain?.gain.setTargetAtTime(
        this.musicAudible?this.musicVolume:0,
        this.context.currentTime,
        0.055,
      );
      this.effectsGain?.gain.setTargetAtTime(
        this.sfxVolume,
        this.context.currentTime,
        0.055,
      );
    }
    if(this.active&&this.musicVolume>0&&this.current?.id!==this.musicId)void this.switchLoop();
  }

  setMusicAudible(allowed:boolean):void{
    if(this.musicAudible===allowed)return;
    this.musicAudible=allowed;
    if(this.context)this.musicGain?.gain.setTargetAtTime(allowed?this.musicVolume:0,this.context.currentTime,.055);
  }

  setMood(biome: Biome, _battle: boolean, regionId='',position?:{x:number;y:number;z:number}): void {
    const id=musicForRegion(regionId,position,this.musicId==='christmas-house'),changed=this.musicId!==id;
    this.biome = biome;
    this.musicId=id;
    if (changed && this.active) void this.switchLoop();
  }

  private async buffer(id: MusicCueId): Promise<AudioBuffer> {
    let loading = this.buffers.get(id);
    if (!loading) {
      loading = (async () => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}${MUSIC_CUES[id].file}`,
        );
        if (!response.ok) throw new Error(`Audio ${id}: ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (!this.context || this.disposed) throw new Error("Audio disposed");
        return this.context.decodeAudioData(bytes);
      })();
      this.buffers.set(id, loading);
      void loading.catch(() => this.buffers.delete(id));
    }
    return loading;
  }

  private async switchLoop(): Promise<void> {
    const id = this.musicId;
    // Even returning to the already playing cue must invalidate pending loads.
    const token = ++this.pending;
    if (
      !this.context ||
      !this.musicGain ||
      !this.active ||
      this.musicVolume<=0 ||
      this.current?.id === id ||
      this.disposed
    )
      return;
    try {
      const buffer = await this.buffer(id);
      if (
        token !== this.pending ||
        !this.context ||
        !this.musicGain ||
        this.disposed || !this.active || this.musicVolume<=0
      )
        {if(this.musicId!==id)this.buffers.delete(id);return;}
      const context = this.context;
      const now = context.currentTime;
      const fade = 2.6;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + fade);
      source.connect(gain).connect(this.musicGain);
      source.start(now);
      const previous = this.current;
      this.current = { source, gain, id };
      if (previous) {
        this.retired.add(previous);
        previous.gain.gain.cancelAndHoldAtTime(now);
        previous.gain.gain.linearRampToValueAtTime(0, now + fade);
        previous.source.stop(now + fade + 0.05);
        previous.source.onended = () => {
          previous.source.disconnect();
          previous.gain.disconnect();
          this.retired.delete(previous);
        };
      }
      // Keep only the current decoded cue; retiring sources release after the fade.
      for (const key of this.buffers.keys())
        if (key !== id) this.buffers.delete(key);
    } catch {
      // A failed music request must not interrupt the game. The next gesture
      // or mood change retries; never claim successful audio playback here.
    }
  }

  get musicAudioMetrics(){return{requested:this.musicId,current:this.current?.id??null,retiring:this.retired.size,cached:[...this.buffers.keys()],volume:this.musicVolume,audible:this.musicAudible,context:this.context?.state??null};}

  sfx(name: string, value?: number): void {
    const context = this.context;
    if (
      !context ||
      !this.effectsGain ||
      context.state !== "running" ||
      this.disposed ||
      this.sfxVolume <= 0
    )
      return;
    const now = context.currentTime;
    const cooldown = name === "step" ? 0.13 : 0.04;
    if (
      now - (this.lastEffect.get(name) ?? -Infinity) < cooldown ||
      this.voices > 24
    )
      return;
    this.lastEffect.set(name, now);
    const tone = (
      frequency: number,
      duration: number,
      volume: number,
      type: OscillatorType = "sine",
      end = frequency,
      delay = 0,
    ) => {
      if (!this.effectsGain || this.voices > 24) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(25, end),
        start + duration,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        volume,
        start + Math.min(0.012, duration * 0.2),
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(this.effectsGain);
      this.voices++;
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices--;
      };
    };
    const noise = (duration: number, volume: number, cutoff: number, step=false) => {
      if (!this.effectsGain || this.voices>24) return;
      const buffer=step?this.stepNoise():this.sharedNoise();
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      source.connect(filter).connect(gain).connect(this.effectsGain);
      this.voices++;
      source.start(now,0,duration);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        this.voices--;
      };
    };
    switch (name) {
      case 'castle-bell':
        tone(196,2.2,.06);tone(196*2.76,1.4,.016);tone(196*4.07,.8,.008);
        break;
      case "journey-chime": {
        const frequency = [440, 587.33, 880][Math.max(0, Math.min(2, Math.round(value ?? 0)))];
        tone(frequency, 1.05, .065);
        tone(frequency * 2.01, .7, .022);
        tone(frequency * 2.76, .38, .008);
        break;
      }
      case "journey-water":
        noise(.6, .09, 1400);
        [290, 410, 340].forEach((frequency, i) => tone(frequency, .12, .013, "sine", frequency * .7, .09 + i * .12));
        break;
      case 'ambient-bird':tone(1800,.12,.008,'sine',2200);tone(2400,.18,.006,'sine',1700,.16);break;
      case 'ambient-night':tone(2700,.09,.003,'sine',2600);tone(2650,.1,.003,'sine',2700,.18);break;
      case 'ambient-village':tone(660,.25,.007,'sine',650);tone(990,.30,.005,'sine',980,.2);break;
      case 'step-material':case 'land-material':{
        const land=name==='land-material',m=Math.round(value??0),v=land?1.4:1;
        noise(land?.15:m===0?.10:.085,(m===0?.55:m===1?.43:.70)*v,m===0?1450:m===1?2300:780,true);
        if(m!==0)tone(m===1?170:105,land?.13:.07,.035*v,'sine',m===1?70:48);break;
      }
      case "step":
        noise(0.07, 0.1, 420);
        tone(115, 0.06, 0.025, "sine", 65);
        break;
      case "jump":
        noise(0.09, 0.065, 1200);
        tone(230, 0.14, 0.035, "sine", 400);
        break;
      case "land":
        noise(0.10, 0.09, 520);
        tone(95, 0.1, 0.03, "sine", 55);
        break;
      case "windmill":
        [196, 293.66, 392].forEach((f, i) => tone(f, 0.6, 0.05, "triangle", f, i * 0.18));
        noise(0.6, 0.055, 720);
        break;
      case "attack":
      case "sword":
        noise(0.16, 0.19, 1800);
        tone(320, 0.13, 0.07, "triangle", 105);
        break;
      case "bow":
        tone(280, 0.12, 0.055, "triangle", 680);
        noise(0.08, 0.075, 2800);
        break;
      case "hit":
      case "impact":
        tone(180, 0.15, 0.16, "sine", 52);
        noise(0.095, 0.14, 1300);
        break;
      case "hurt":
      case "damage":
        tone(280, 0.2, 0.09, "triangle", 140);
        tone(75, 0.23, 0.13, "sine", 40);
        break;
      case "dodge":
      case "dash":
        noise(0.17, 0.15, 1900);
        tone(220, 0.16, 0.04, "sine", 440);
        break;
      case "magic":
      case "cast":
      case "spark":
        tone(523.25, 0.32, 0.075, "sine", 1046.5);
        tone(783.99, 0.45, 0.04, "sine", 1568, 0.05);
        break;
      case "nova":
        noise(0.35, 0.16, 850);
        tone(130.81, 0.45, 0.16, "sine", 65.4);
        tone(1046.5, 0.6, 0.055, "sine", 523.25);
        break;
      case "heal":
      case "revive":
      case "rescue":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(f, 0.55, 0.055, "sine", f, i * 0.09),
        );
        break;
      case "shield":
        tone(261.63, 0.7, 0.065, "sine", 392);
        tone(523.25, 0.5, 0.03, "sine", 783.99, 0.08);
        break;
      case "death":
      case "down":
        [392, 329.63, 261.63].forEach((f, i) =>
          tone(f, 0.38, 0.065, "sine", f * 0.94, i * 0.13),
        );
        break;
      case "enemy":
      case "warning":
      case "telegraph":
        tone(98, 0.32, 0.1, "triangle", 73.42);
        tone(146.83, 0.34, 0.055, "sine", 110, 0.1);
        break;
      case "win":
      case "chapter":
      case "victory":
        [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5].forEach((f, i) =>
          tone(f, 0.65, 0.065, "sine", f, i * 0.14),
        );
        break;
      case "pickup":
      case "secret":
        tone(783.99, 0.35, 0.055);
        tone(1174.66, 0.55, 0.035, "sine", 1174.66, 0.1);
        break;
      case "interact":
      case "ready":
      case "ui":
      default:
        tone(587.33, 0.2, 0.045);
        tone(880, 0.28, 0.03, "sine", 880, 0.06);
        break;
    }
  }

  dispose(): void {
    this.animalVoices.update('',false);
    this.stopAmbience(true);this.noiseBuffer=null;this.stepNoiseBuffer=null;this.hearthBuffer=null;this.stopWind(true);this.windBuffer=null;this.windPosition=null;
    this.disposed = true;
    this.active = false;
    this.pending++;
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    document.removeEventListener("pointerdown", this.gestureHandler);
    const loops = [...this.retired];
    if (this.current) loops.push(this.current);
    for (const loop of loops) {
      try {
        loop.source.stop();
      } catch {}
      loop.source.disconnect();
      loop.gain.disconnect();
    }
    this.current = null;
    this.retired.clear();
    this.buffers.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
