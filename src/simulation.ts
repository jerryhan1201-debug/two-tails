import {BEACH,BEACH_WATER,beachColumn,beachSwimmingLegal} from '../shared/beach-swimming';
import {UNDERSEA,underseaLegal,underseaPair,underseaArrival} from '../shared/undersea';
import {advanceSwimming,type SwimmingState} from './swimming';
import {SWIM_HEIGHT,SWIM_RADIUS} from '../shared/swimming';
import {kangarooLandingAt} from './kangaroo-motion';
import {friendlyAnimalContacts} from "./friendly-animal-contacts";
import {HOME_PET_SITES} from './home-pet-sites';
import {isHomePetId,type HomePetStates} from '../shared/home-pets';import {restoreHomePets,HomePetFollowers,persistentHomePets} from './home-pet-follow';
import {validRegionStepBack,type RegionStepBack} from '../shared/region-load';
import {petSegment} from './pet-follow';
import {goldenIntent,type GoldenState} from '../shared/golden';
import {restoreGolden,GoldenFollower} from './golden-follow';
import {petIntent,validPetCommand,type PetState,type PetCommand} from '../shared/pet';
import {PetFollower,restorePet} from './pet-follow';
import {validAnimalCommand,type AnimalCommand,type AnimalCare} from '../shared/animal-care';
import {AnimalInteractions,animalReaction,nearbyAnimal} from './animal-interactions';
import {validInputStamp} from '../shared/input-ack';
import {studioRelease} from './studio-regions';
import {validRegionLoadCommand,type RegionLoad,type RegionLoadCommand} from '../shared/region-load';
import {homeUseDefinition,type HomeUse} from '../shared/home-use';
import {nearbyHomeUse,homeExit,homeRestPoint} from './home-use';
import {emptyFieldBook,newestFieldBook,fieldHidesPartner,fieldMovementLocked,FIELD_NODES,type FieldBook,type FieldPlay,type FieldCommand} from '../shared/fieldbook';
import {FieldTicker,useFieldNode,commandField,fieldFind,type FieldContext} from './field-play';
import { nearbyInteraction, selectInteractionTarget, onInteractionSurface, onConnectionSurface } from './interaction-target';
import {emptyStory, STORY_IDS, STORY_EXIT, queueStory, resetStoryVotes, applyStoryCommand, type StoryProgress, type StoryCommand} from '../shared/story';
import { CHARACTER_NAMES } from "../shared/characters";
import { createChapterMovementWorld } from "./world-surfaces";
import { REGIONS, getRegion, getRegionChapter, isStoryRegion, allowedRegions, regionConnections, regionGroundHeight, regionBounds, createRegionMovementWorld, type TravelMethod } from './regions';
import type { TravelProposal } from '../shared/regions';
import type { RegionArchiveShape } from '../shared/snapshot';
import { advanceMovement, standingSurface, rememberGround, WALK_SPEED, SPRINT_SPEED, JUMP_SPEED, PLAYER_HEIGHT, STEP_HEIGHT, advanceFlight, type FlightState, type MovementWorld, type MovementState } from "./movement";
import { PLAYER_RADIUS, enemyRadius, moveBody, settleBodies, type ContactBody, type WorldResolver } from "./combat-contact";
import {
  CHAPTERS,
  type Chapter,
  type Encounter,
  type Interaction,
} from "./content";
import { freshSave, type AdventureSave, type DogRole } from "../shared/save";
import { residentReply } from './resident-dialogue';
import { emptyJourneys, newestJourneys, type JourneyProgress, type JourneyProposal } from '../shared/journeys';
import { journeyNodes, journeyEntry, journeyPrompt, journeyRepeatable, useJourney, type JourneyNode } from './journeys';
import { validateSnapshotShape } from "../shared/snapshot";
import { snapshotProgress, type SnapshotProgress } from "../shared/progress";
import {isFreeExploration} from '../shared/modes';
import {VILLA_REGION,villaInterior} from './villa-physics';
import {DUO_RIDE,rideAllowedInRegion,validDuoCommand,type DuoCommand,type DuoState} from '../shared/duo';
import {duoAvailable,duoPoint,clearDuoPath,safeDismount,canCarry,cuddlePositions} from './duo-interactions';
import {
  allowedExplorationRegions,
  canonicalRegion,
  createExplorationSave,
  validateExplorationSave,
  EXPLORATION_EQUIPMENT,
  EXPLORATION_SKILLS,
  EXPLORATION_SKINS,
  explorationPermissions,
  type ExplorationSave,
  type ExplorationCamera,
  type ExplorationPreferences,
  type GameMode,
} from "./exploration";
export type { GameMode } from "./exploration";
export interface SimulationOptions {
  stories?:boolean;
  mode?: GameMode;
  exploration?: ExplorationSave;
  role?: DogRole;
  inheritedAdventure?: AdventureSave | null;
  developerPreview?: boolean;
}
export type Action =
  | "toggleWeapon"
  | "attack"
  | "skill1"
  | "skill2"
  | "dodge"
  | "jump"
  | "interact"
  | "ping"
  | "mount";
export interface Command {
  regionStepBack?:RegionStepBack;
  animal?:AnimalCommand;
  pet?:PetCommand;
  net?:import('../shared/input-ack').InputStamp;
  regionLoad?:RegionLoadCommand;
  field?:FieldCommand;
  duo?:DuoCommand;
  homeLights?:boolean;
  story?:StoryCommand;
  x: number;
  z: number;
  actions: Action[];
  sprint?: boolean;
  lift?: number;
  travel?: {regionId:string;method:TravelMethod};
  travelResponse?: 'accept'|'cancel';
  weapon?: string;
  skin?: string;
  skills?: string[];
}
export interface Player extends FlightState {
  swim:import('../shared/swimming').SwimMode;waterId?:string;
  homeUse?:HomeUse;
  role: DogRole;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  action: string;
  actionTime: number;
  speed: number;
  invincible: number;
  cooldowns: number[];
  revive: number;
  weapon: string;
  weaponDrawn?:boolean;
  skin: string;
  skills: string[];
  buff: number;
}
export interface Telegraph {
  x: number;
  z: number;
  r: number;
  delay: number;
  height?: "ground" | "body";
}
export interface Enemy {
  y?:number;
  id: string;
  kind: string;
  name: string;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  yaw: number;
  hp: number;
  maxHp: number;
  boss: boolean;
  elite: boolean;
  state: "idle" | "chase" | "warning" | "attack" | "dead";
  timer: number;
  pattern: string;
  targetX: number;
  targetZ: number;
  phase: number;
  hit: number;
  telegraphs: Telegraph[];
  attackSerial: number;
  exposed: number;
  recoveryUsed: boolean;
}
export interface GameEvent {
  y?: number;
  id: number;
  type: string;
  x: number;
  z: number;
  text?: string;
  value?: number;
}
export interface Snapshot {
  animalCare?:AnimalCare;
  pet?:PetState;
  golden?:GoldenState;
  homePets?:HomePetStates;
  inputAcks?:import('../shared/input-ack').InputAcks;
  regionLoad?:RegionLoad;
  fieldbook:FieldBook;
  fieldPlay?:FieldPlay;
  duo?:DuoState;
  homeLights?:boolean;
  story?:StoryProgress;
  v: 2;
  progress?: SnapshotProgress;
  mode?: GameMode;
  activeRoles?: DogRole[];
  chapterId: string;
  regionId:string;
  discoveredRegions:string[];
  broomOwned:boolean;
  travel?:TravelProposal;
  journeys:JourneyProgress;
  journeyProposal?:JourneyProposal;
  regionArchive:Record<string,RegionArchiveShape>;
  time: number;
  players: Record<DogRole, Player>;
  enemies: Enemy[];
  flags: string[];
  events: GameEvent[];
  ended: boolean;
  coop: number;
  checkpoint: { x: number; z: number };
  eventSerial: number;
}
const roles: DogRole[] = ["gold", "white"];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export class Simulation {
  deferRegionTransitions=false;
  get freeExploration() { return isFreeExploration(this.mode); }
  state: Snapshot;
  save: AdventureSave;
  chapter: Chapter;
  dirty = false;
  notice = "";
  readonly mode: GameMode;
  readonly controlledRole: DogRole;
  readonly developerPreview: boolean;
  private explorationRecord: ExplorationSave | null = null;
  private storiesEnabled=false;
  private explorationRegions: string[] = [];
  get visibleRoles(): DogRole[] {
    return this.mode === "exploration" ? [this.controlledRole] : [...roles];
  }
  private inputs: Record<DogRole, Command> = {
    gold: { x: 0, z: 0, actions: [] },
    white: { x: 0, z: 0, actions: [] },
  };
  private lastInput = { gold: 0, white: 0 };
  private transitionTimer = 0;
  private boundaryCooldown = 0;
  private lastBoundary:string|null=null;
  private duoNoticeAt=0;
  private petFollower=new PetFollower();
  private homePetFollowers=new HomePetFollowers();
  private goldenFollower=new GoldenFollower();
  private animalInteractions=new AnimalInteractions();
  private fieldTicker=new FieldTicker();
  private fieldContext():FieldContext {return {s:this.state,world:this.movementWorld,solo:this.mode==='exploration',role:this.controlledRole,blocked:r=>this.mode==='adventure'&&this.inCombat(r),emit:(type,x,z,text)=>{this.emit(type,x,z,text);this.dirty=true;}};}
  get region(){return getRegion(this.state?.regionId??this.chapter.id)!;}
  get availableRegions(){return this.freeExploration?allowedExplorationRegions():allowedRegions(this.save);}
  getRegion(){return this.region;}
  private inputStamps:Partial<Record<DogRole,{stamp:import('../shared/input-ack').InputStamp;at:number}>>={};
  private movementWorld!: MovementWorld;
  resolve: WorldResolver = (x, z, radius = PLAYER_RADIUS) => {
    const bounds = regionBounds(this.state?.regionId ?? this.chapter?.id ?? CHAPTERS[0].id);
    return {
      x: clamp(x, bounds.minX + radius, bounds.maxX - radius),
      z: clamp(z, bounds.minZ + radius, bounds.maxZ - radius),
    };
  };
  constructor(save?: AdventureSave, options: SimulationOptions = {}) {
    this.mode = options.mode ?? save?.mode ?? "adventure";
    this.storiesEnabled=this.mode==='adventure'&&options.stories===true;
    this.developerPreview =
      this.mode === "exploration" && !!options.developerPreview;
    if (this.mode === "exploration") {
      this.explorationRecord = validateExplorationSave(
        options.exploration ?? createExplorationSave(options.role),
      );
      this.explorationRegions = allowedExplorationRegions(
        options.inheritedAdventure ?? save,
        this.developerPreview,
      );
      const region = canonicalRegion(this.explorationRecord.regionId);
      if (!region || !this.explorationRegions.includes(region)) {
        const fallback = createExplorationSave(this.explorationRecord.role);
        this.explorationRecord.regionId = fallback.regionId;
        this.explorationRecord.position = fallback.position;
        this.notice = "此区域尚未在双人冒险中解锁，已回到灯火村自由探索";
      } else this.explorationRecord.regionId = region;
      // Internal UI loadout adapter has its own identity and never contains formal progress.
      this.save = freshSave("exploration-sandbox");
      this.save.chapterId = getRegion(this.explorationRecord.regionId)?.chapterId??this.explorationRecord.regionId;
      for (const r of roles)
        this.save.players[r] = {
          ...this.save.players[r],
          ...structuredClone(this.explorationRecord.loadouts[r]),
          unlockedEquipment: [...EXPLORATION_EQUIPMENT],
          unlockedSkills: [...EXPLORATION_SKILLS],
          unlockedSkins: [...EXPLORATION_SKINS],
          inventory: [],
        };
    } else
      this.save = structuredClone(
        save ?? freshSave("adventure-local-" + Date.now().toString(36)),
      );
    this.controlledRole = this.explorationRecord?.role ?? "gold";
    if (this.freeExploration) this.save=explorationPermissions(this.save);
    const savedChapterId = this.save.chapterId;
    const loaded = this.save.world.snapshot;
    if (loaded !== undefined) {
      validateSnapshotShape(loaded);
      if (loaded.chapterId !== savedChapterId)
        throw new Error("存档章节与场景快照不一致，请恢复有效备份");
    }
    const legacy = /^ch(\d{2})$/.exec(savedChapterId);
    const chapter =
      CHAPTERS.find((c) => c.id === savedChapterId) ??
      (legacy
        ? CHAPTERS.find((c) => c.index === Number(legacy[1]))
        : undefined);
    if (!chapter)
      throw new Error("此存档的章节尚未安装，请使用更新版本继续冒险");
    const initialRegion=this.explorationRecord?.regionId??(loaded as any)?.regionId??chapter.id;
    if(!getRegion(initialRegion))throw new Error('此存档区域尚未安装，请使用更新版本继续');
    if(this.mode==='adventure'&&!allowedRegions(this.save).includes(initialRegion))throw new Error('存档位置尚未由故事解锁，请恢复有效备份');
    this.chapter = getRegionChapter(initialRegion,chapter);
    this.movementWorld = createRegionMovementWorld(initialRegion,this.chapter, () => this.state?.flags ?? []);
    this.save.chapterId = chapter.id;
    this.state = this.initial(this.chapter);
    this.state.regionId=initialRegion;
    this.state.chapterId=chapter.id;
    if (this.explorationRecord)
      Object.assign(
        this.state.players[this.controlledRole],
        this.explorationRecord.position,
      );
    if (loaded !== undefined) {
      this.state = structuredClone(loaded) as unknown as Snapshot;
      this.state.chapterId = chapter.id;
      for (const r of roles) {
        this.state.players[r].weaponDrawn??=this.save.players[r].weaponDrawn??true;
        this.save.players[r].weaponDrawn=this.state.players[r].weaponDrawn;
        this.state.players[r].action = "idle";
        this.state.players[r].speed = 0;
      }
    }
    this.state.fieldbook=newestFieldBook(this.save.world.fieldbook,this.state.fieldbook,this.explorationRecord?.fieldbook);
    delete this.state.fieldPlay;
    this.state.mode=this.mode;
    this.state.homeLights=this.explorationRecord?.homeLights??this.state.homeLights??true;
    this.state.regionId??=initialRegion;
    this.state.regionArchive??={};
    this.state.journeys=newestJourneys(this.save.world.journeys,this.state.journeys,this.explorationRecord?.journeys);
    delete this.state.journeyProposal;
    this.syncJourneyWorld();
    const regional=this.save.world.regionProgress as any;
    this.state.discoveredRegions=[...new Set([...(this.state.discoveredRegions??[]),...(regional?.discoveredRegions??[]),...(this.explorationRecord?.discoveredRegions??[]),...this.save.completedChapters.map(id=>canonicalRegion(id)).filter((id):id is string=>!!id),this.state.regionId])];
    this.state.broomOwned=this.freeExploration||this.state.broomOwned===true||regional?.broomOwned===true||chapter.index>1||this.save.completedChapters.length>0;
    if (this.freeExploration) { this.state.discoveredRegions=allowedExplorationRegions(); for (const r of roles) this.state.players[r].hp=this.state.players[r].maxHp; }
    else if(!this.state.discoveredRegions.includes('player-home-villa'))this.state.discoveredRegions.push('player-home-villa');
    delete this.state.travel;delete this.state.regionLoad;
    delete this.state.duo;
    this.normalizeMovement(true);
    this.state.pet=restorePet(petIntent(this.explorationRecord?.pet??this.save.world.pet??this.state.pet),this.state.regionId,this.movementWorld,this.state.players,this.visibleRoles);
    this.state.golden=restoreGolden(goldenIntent(this.explorationRecord?.golden??this.save.world.golden??this.state.golden),this.state.regionId,this.movementWorld,this.state.players,this.visibleRoles,this.state.time);
    this.state.homePets=restoreHomePets(this.explorationRecord?.homePets??this.save.world.homePets??this.state.homePets,this.state.regionId,this.movementWorld,this.state.players,this.visibleRoles,this.state.time);
    const enemyIds = new Set<string>();
    for (const enemy of this.state.enemies) {
      if (typeof enemy.id !== "string" || enemyIds.has(enemy.id))
        throw new Error("存档中的敌人记录重复或损坏，请恢复有效备份");
      enemyIds.add(enemy.id);
      enemy.telegraphs = Array.isArray(enemy.telegraphs)
        ? enemy.telegraphs
        : [];
      enemy.attackSerial = Number.isFinite(enemy.attackSerial)
        ? enemy.attackSerial
        : 0;
    }
    if(this.storiesEnabled){
      if(!this.state.story){
        this.state.story=emptyStory();
        const progressed=loaded!==undefined||this.save.completedChapters.length>0||Object.keys(this.save.quests).length>0||chapter.index>1;
        if(progressed){
          const ids=[STORY_IDS[0],...CHAPTERS.filter(c=>this.save.completedChapters.includes(c.id)).map(c=>STORY_EXIT[c.index-1])];
          if(chapter.index>=4)ids.push(STORY_IDS[4]);
          this.state.story.completed=[...new Set(ids)];this.state.story.revision++;
        }else queueStory(this.state.story,STORY_IDS[0]);
      }
      resetStoryVotes(this.state.story);this.dirty=true;
    }
  }

  private initial(ch: Chapter): Snapshot {
    const players = {} as Record<DogRole, Player>;
    for (const [i, r] of roles.entries()) {
      const p = this.save.players[r];
      players[r] = {
        role: r,
        x: ch.spawn.x + (i ? 1.3 : -1.3),
        z: ch.spawn.z,
        yaw: 0,
        y: 0, vy: 0, grounded: true, sprinting: false, mounted:false,flight:'grounded',swim:'land',vx:0,vz:0,
        safeX: ch.spawn.x + (i ? 1.3 : -1.3), safeY: 0, safeZ: ch.spawn.z, landing: 0,
        hp: 100,
        maxHp: 100,
        action: "idle",
        actionTime: 0,
        speed: 0,
        invincible: 0,
        cooldowns: [0, 0, 0, 0],
        revive: 0,
        weapon: p.weaponId,
        weaponDrawn: p.weaponDrawn ?? true,
        skin: p.skinId,
        skills: p.skillIds,
        buff: 0,
      };
    }
    return {
      v: 2,
      mode: this.mode,
      activeRoles: this.visibleRoles,
      chapterId: ch.id,
      regionId:ch.id,discoveredRegions:this.freeExploration?allowedExplorationRegions():[ch.id],broomOwned:this.freeExploration,regionArchive:{},journeys:emptyJourneys(),fieldbook:emptyFieldBook(),
      time: 0,
      players,
      enemies: ch.encounters.flatMap((e) => this.spawn(e)),
      flags: [],
      events: [],
      ended: false,
      coop: 0,
      checkpoint: { ...ch.spawn },
      eventSerial: 0,
    };
  }
  private spawn(e: Encounter): Enemy[] {
    return Array.from({ length: e.count }, (_, i) => ({
      id: e.id + "-" + i,
      kind: e.kind,
      name:
        e.name ??
        (
          {
            slime: "苔芽精",
            wolf: "荆棘狼",
            sprite: "迷雾精灵",
            zombie: "梦游守墓人",
            bat: "暮色蝠",
            golem: "遗迹守卫",
            dragon: "星辉龙",
          } as any
        )[e.kind],
      x: e.x + (i ? Math.sin(i * 3) * 2 : 0),
      z: e.z + (i ? Math.cos(i * 3) * 2 : 0),
      ...(e.y===undefined?{}:{y:e.y}),
      homeX: e.x,
      homeZ: e.z,
      yaw: 0,
      hp: e.boss ? 340 : e.elite ? 95 : 45,
      maxHp: e.boss ? 340 : e.elite ? 95 : 45,
      boss: !!e.boss,
      elite: !!e.elite,
      state: "idle",
      timer: 1 + i * 0.3,
      pattern: "circle",
      targetX: e.x,
      targetZ: e.z,
      phase: 1,
      hit: 0,
      telegraphs: [],
      attackSerial: 0,
      exposed: 0, recoveryUsed: false,
    }));
  }
  command(role: DogRole, cmd: Command) {
    if (!this.visibleRoles.includes(role)) return;
    if (!cmd || !Number.isFinite(cmd.x) || !Number.isFinite(cmd.z)) return;
    if(cmd.net&&validInputStamp(cmd.net))this.inputStamps[role]={stamp:{...cmd.net},at:this.state.time};
    if(cmd.regionStepBack){const back=cmd.regionStepBack,p=this.state.players[role];if(validRegionStepBack(back)&&back.regionId===this.state.regionId&&studioRelease(back.regionId)&&Math.hypot(p.x-back.x,p.z-back.z)<3&&Math.abs(p.y-back.y)<.6&&this.movementWorld.isSafe?.(back.x,back.z,back.y,PLAYER_RADIUS)&&petSegment(this.movementWorld,p,back,true,PLAYER_RADIUS,PLAYER_HEIGHT)){this.resetMovement(true,role);Object.assign(p,{x:back.x,y:back.y,z:back.z,safeX:back.x,safeY:back.y,safeZ:back.z,speed:0,vy:0,grounded:true,action:'idle'});this.dirty=true;}return;}
    if(cmd.regionLoad&&validRegionLoadCommand(cmd.regionLoad)){
      const p=this.state.regionLoad,c=cmd.regionLoad;if(!p||p.id!==c.id)return;
      if(c.result==='cancel'){delete this.state.regionLoad;this.boundaryCooldown=4;this.emit('message',0,0,'已留在原区域，进度保持。');return;}
      if(c.result==='failed'){p.failed=true;p.ready=[];return;}
      if(c.result==='retry'){p.failed=false;p.ready=[];p.id=++this.state.eventSerial;return;}
      if(p.failed)return;if(!p.ready.includes(role))p.ready.push(role);
      if(this.visibleRoles.every(r=>p.ready.includes(r))){delete this.state.regionLoad;this.changeRegion(p.to,p.arrival,p.advanceStory,true);}return;
    }
    if(this.state.regionLoad)return;
    if(cmd.animal){if(validAnimalCommand(cmd.animal)){
      if(['follow','stay','home'].includes(cmd.animal.kind)){const message=isHomePetId(cmd.animal.id)?this.homePetFollowers.command(this.state,this.movementWorld,role,cmd.animal.id,cmd.animal.kind as 'follow'|'stay'|'home',cmd.animal.revision!):this.goldenFollower.command(this.state,this.movementWorld,role,cmd.animal.kind as 'follow'|'stay',cmd.animal.revision!);this.emit('animal-response',this.state.players[role].x,this.state.players[role].z,message);this.dirty=true;return;}
      const message=this.animalInteractions.command(this.state,this.movementWorld,role,cmd.animal,(a,r)=>{this.emit('animal-call',a.x,a.z,a.species,1,a.voiceY??a.y);this.emit('animal-response',a.x,a.z,(r.kind==='greet'?'你轻轻招呼，':r.kind==='pet'?'你轻轻抚摸，':'你陪它玩了一小会，')+a.label+'转过身回应了你。');});
      if(message)this.emit('animal-response',this.state.players[role].x,this.state.players[role].z,message);this.inputs[role]={x:0,z:0,actions:[]};this.dirty=true;}return;}
    if(cmd.pet){if(validPetCommand(cmd.pet)){const message=this.petFollower.command(this.state,role,cmd.pet,this.movementWorld);this.emit('pet',this.state.players[role].x,this.state.players[role].z,message);this.dirty=true;}return;}
    if(cmd.field&&this.state.players[role].homeUse){this.emit('message',this.state.players[role].x,this.state.players[role].z,'先起身，再和伙伴玩耍吧。');return;}
    if(cmd.field){commandField(this.fieldContext(),role,cmd.field);this.dirty=true;return;}
    if(cmd.duo){if(validDuoCommand(cmd.duo))this.commandDuo(role,cmd.duo);return;}
    if(typeof cmd.homeLights==='boolean'&&this.state.regionId===VILLA_REGION&&!this.state.story?.active){this.state.homeLights=cmd.homeLights;this.dirty=true;}
    if(this.storiesEnabled&&this.state.story?.active){
      if(cmd.story&&applyStoryCommand(this.state.story,role,cmd.story))this.dirty=true;
      return;
    }
    if(cmd.story)return;
    if(cmd.actions?.includes('toggleWeapon')){
      const p=this.state.players[role];if(p.hp>0&&!['attack','cast','dodge','hit','revive'].includes(p.action))this.setWeaponDrawn(role,p.weaponDrawn===false);
      cmd={...cmd,actions:cmd.actions.filter(a=>a!=='toggleWeapon')};
    }
    if(cmd.travel)this.requestTravel(role,cmd.travel.regionId,cmd.travel.method);
    if(cmd.travelResponse)this.respondTravel(role,cmd.travelResponse==='accept');
    const len = Math.max(1, Math.hypot(cmd.x, cmd.z));
    const existing = this.inputs[role].actions;
    this.inputs[role] = {
      ...cmd,
      x: cmd.x / len,
      z: cmd.z / len,
      sprint: cmd.sprint === true,
      lift:Number.isFinite(cmd.lift)?clamp(cmd.lift!, -1,1):0,
      actions: [
        ...existing,
        ...(Array.isArray(cmd.actions) ? cmd.actions.slice(0, 5) : []),
      ].slice(0, 10),
    };
    this.lastInput[role] = this.state.time;
    if (cmd.weapon || cmd.skin || cmd.skills) this.loadout(role, cmd);
  }
  private setWeaponDrawn(role:DogRole,value:boolean){const p=this.state.players[role];if(p.weaponDrawn===value)return;p.weaponDrawn=value;this.save.players[role].weaponDrawn=value;this.dirty=true;}
  private beginHomeUse(role:DogRole,id:string){
    const s=this.state,p=s.players[role],f=homeUseDefinition(id);if(!f||s.duo||s.fieldPlay||s.travel||this.inCombat(role))return;
    const others=this.visibleRoles.filter(r=>r!==role).map(r=>s.players[r]);
    const choices=([0,1] as const).filter(slot=>!others.some(o=>o.homeUse?.id===id&&o.homeUse.slot===slot)).sort((a,b)=>Math.hypot(p.x-f.slots[a][0],p.z-f.slots[a][2])-Math.hypot(p.x-f.slots[b][0],p.z-f.slots[b][2]));
    const slot=choices[0];if(slot===undefined){this.emit('message',p.x,p.z,'两个位置都有人啦，等伙伴起身后再来。');return;}
    const exit=homeExit(id,slot,this.movementWorld,others);if(!exit){this.emit('message',p.x,p.z,'家具前的落脚处有些拥挤，请让开一点再试。');return;}
    p.homeUse={id:f.id,slot,phase:'enter',startedAt:s.time,origin:{x:p.x,y:p.y,z:p.z,yaw:p.yaw},exit};
    Object.assign(p,{action:'home-'+f.pose,actionTime:0,speed:0,vx:0,vy:0,vz:0,sprinting:false,safeX:exit.x,safeY:exit.y,safeZ:exit.z});
    this.inputs[role]={x:0,z:0,actions:[]};this.dirty=true;this.emit('message',p.x,p.z,'按 E / 互动起身，也可以推动方向离开。');
  }
  private finishHomeUse(role:DogRole){
    const p=this.state.players[role],h=p.homeUse;if(!h)return;
    const others=this.visibleRoles.filter(r=>r!==role).map(r=>this.state.players[r]);
    const exit=homeExit(h.id,h.slot,this.movementWorld,others)??h.exit;
    Object.assign(p,exit,{safeX:exit.x,safeY:exit.y,safeZ:exit.z,grounded:true,mounted:false,flight:'grounded',action:'idle',actionTime:0,speed:0,vx:0,vy:0,vz:0,sprinting:false});delete p.homeUse;this.inputs[role]={x:0,z:0,actions:[]};this.dirty=true;
  }
  private tickHomeUse(role:DogRole,dt:number){
    const p=this.state.players[role],h=p.homeUse!,s=this.state,cmd=this.inputs[role];
    if(s.regionId!=='player-home-villa'){this.finishHomeUse(role);return;}
    const exitRequested=Math.hypot(cmd.x,cmd.z)>.08||cmd.actions.includes('interact');
    cmd.actions=[];p.speed=0;p.vy=0;p.sprinting=false;
    if(exitRequested&&h.phase!=='exit'){
      const exit=homeExit(h.id,h.slot,this.movementWorld,this.visibleRoles.filter(r=>r!==role).map(r=>s.players[r]));
      if(!exit){this.emit('message',p.x,p.z,'请伙伴先让开落脚处，再起身。');return;}
      h.phase='exit';h.startedAt=s.time;h.origin={x:p.x,y:p.y,z:p.z,yaw:p.yaw};h.exit=exit;this.dirty=true;
    }
    const t=Math.min(1,(s.time-h.startedAt)/.42),a=t*t*(3-2*t),goal=h.phase==='exit'?h.exit:homeRestPoint(p);
    if(h.phase==='rest')Object.assign(p,goal);
    else{p.x=h.origin.x+(goal.x-h.origin.x)*a;p.y=h.origin.y+(goal.y-h.origin.y)*a+Math.sin(t*Math.PI)*.14;p.z=h.origin.z+(goal.z-h.origin.z)*a;p.yaw=h.origin.yaw+Math.atan2(Math.sin(goal.yaw-h.origin.yaw),Math.cos(goal.yaw-h.origin.yaw))*a;}
    if(t===1){if(h.phase==='exit')this.finishHomeUse(role);else h.phase='rest';}
  }
  private inCombat(role:DogRole){
    const p=this.state.players[role];
    return p.hp<=0||['attack','cast','hit','dodge','revive'].includes(p.action)||this.state.enemies.some(e=>e.hp>0&&(e.y===undefined||Math.abs(e.y-p.y)<2.4)&&['chase','warning','attack'].includes(e.state)&&Math.hypot(e.x-p.x,e.z-p.z)<18);
  }
  private commandDuo(role:DogRole,cmd:DuoCommand){
    const s=this.state,p=s.players[role],d=s.duo;
    if(cmd.kind==='invite'){
      if(cmd.type==='ride'&&!rideAllowedInRegion(s.regionId)){this.emit('message',p.x,p.z,'家园内已关闭骑乘，可以和伙伴贴贴。');return;}
      if(cmd.type==='ride'&&role!=='gold'){this.emit('message',p.x,p.z,'让小鸡毛靠近后主动骑上；你可以随时下骑。');return;}
      if(!duoAvailable(s,this.movementWorld)){this.emit('message',p.x,p.z,'请和伙伴在同层空地站稳，离开战斗和门口后再试。');return;}
      s.duo={id:++s.eventSerial,type:cmd.type,phase:'invited',proposer:role,regionId:s.regionId,expiresAt:s.time+20,startedAt:s.time,origin:{white:duoPoint(s.players.white),gold:duoPoint(s.players.gold)},anchor:duoPoint(s.players.white)};
      if(cmd.type==='ride')this.activateDuo();
      return;
    }
    if(!d||d.id!==cmd.id)return;
    if(cmd.kind==='cancel'||cmd.kind==='reject'){this.endDuo();return;}
    if(cmd.kind!=='accept'||role===d.proposer||d.phase!=='invited'||d.type!=='cuddle')return;
    this.activateDuo();
  }
  private activateDuo(){
    const s=this.state,d=s.duo;if(!d)return;const p=s.players[d.proposer];
    const check={...s};delete check.duo;if(d.type==='ride'&&!rideAllowedInRegion(s.regionId)||!duoAvailable(check,this.movementWorld)){this.endDuo();return;}
    const white=s.players.white,gold=s.players.gold;
    d.origin={white:duoPoint(white),gold:duoPoint(gold)};d.anchor=duoPoint(white);
    if(d.type==='ride'&&!canCarry(this.movementWorld,d.anchor)){this.emit('message',p.x,p.z,'这里头顶或周围太窄，请换一处空地。');this.endDuo();return;}
    if(d.type==='cuddle'){
      d.anchor.x=(white.x+gold.x)/2;d.anchor.z=(white.z+gold.z)/2;
      const spots=cuddlePositions(d.anchor);
      if(roles.some(r=>!clearDuoPath(this.movementWorld,s.players[r],spots[r])||!this.movementWorld.isSafe?.(spots[r].x,spots[r].z,spots[r].y,PLAYER_RADIUS))){this.emit('message',p.x,p.z,'墙边或台阶旁不够宽敞，换个地方贴贴吧。');this.endDuo();return;}
    }
    d.phase='active';d.startedAt=s.time;d.expiresAt=d.type==='cuddle'?s.time+6.5:Number.MAX_SAFE_INTEGER;
    this.resetMovement(false);this.tickDuo(0);
  }
  private endDuo(){
    const d=this.state.duo;if(!d)return;
    if(d.phase==='active'&&d.type==='ride'){
      const w=this.state.players.white,g=this.state.players.gold,spot=safeDismount(this.movementWorld,w)??d.origin.gold;
      Object.assign(g,spot,{grounded:true,mounted:false,flight:'grounded',safeX:spot.x,safeY:spot.y,safeZ:spot.z});
    }
    delete this.state.duo;this.resetMovement(false);for(const r of roles){const p=this.state.players[r];p.action='idle';p.actionTime=0;}this.dirty=true;
  }
  private tickDuo(dt:number){
    const s=this.state,d=s.duo;if(!d||d.phase!=='active')return;
    if(d.type==='cuddle'){
      const t=Math.min(1,(s.time-d.startedAt)/.5),q=t*t*(3-2*t),spots=cuddlePositions(d.anchor);
      for(const r of roles){const p=s.players[r],a=d.origin[r],b=spots[r];p.x=a.x+(b.x-a.x)*q;p.z=a.z+(b.z-a.z)*q;p.y=b.y;p.yaw=b.yaw;p.speed=0;p.action='cuddle';p.sprinting=false;rememberGround(p,this.movementWorld,PLAYER_RADIUS);}return;
    }
    const w=s.players.white,g=s.players.gold,cmd=s.time-this.lastInput.gold<.35?this.inputs.gold:{x:0,z:0,sprint:false,actions:[]};
    const old={...w},speed=cmd.sprint?DUO_RIDE.sprint:WALK_SPEED;
    if(Math.hypot(cmd.x,cmd.z)>.01)w.yaw=Math.atan2(cmd.x,cmd.z);
    const result=advanceMovement(w,cmd.x*speed,cmd.z*speed,dt,this.movementWorld,DUO_RIDE.radius,(dx,dz,y)=>{
      const body={id:'duo',x:w.x,z:w.z,y,radius:DUO_RIDE.radius,height:DUO_RIDE.height};
      moveBody(body,dx,dz,[],(x,z,r)=>this.movementWorld.resolveAt(x,z,y,r??DUO_RIDE.radius,DUO_RIDE.height));w.x=body.x;w.z=body.z;
    },DUO_RIDE.height);
    if(result.needsRecovery||!w.grounded||!canCarry(this.movementWorld,w)){Object.assign(w,old);if(s.time>this.duoNoticeAt){this.emit('message',w.x,w.z,'前方空间不足，请先下骑。');this.duoNoticeAt=s.time+2;}}
    w.speed=dt?Math.hypot(w.x-old.x,w.z-old.z)/dt:0;w.sprinting=!!cmd.sprint&&w.speed>.1;w.action=w.speed>.1?'run':'idle';
    g.x=w.x-Math.sin(w.yaw)*DUO_RIDE.seatBack;g.z=w.z-Math.cos(w.yaw)*DUO_RIDE.seatBack;g.y=w.y+DUO_RIDE.seatY;g.yaw=w.yaw;g.speed=w.speed;g.action='duo-ride';g.grounded=false;g.vy=0;g.vx=0;g.vz=0;g.mounted=false;g.flight='grounded';
    const spot=safeDismount(this.movementWorld,w)!;g.safeX=spot.x;g.safeY=spot.y;g.safeZ=spot.z;
  }
  private toggleBroom(role:DogRole){
    if(this.state.duo)this.endDuo();
    const p=this.state.players[role];
    if(this.region.indoor){this.emit('message',p.x,p.z,'屋内请步行，扫帚会在门外等你。');return;}
    if(p.mounted){p.flight=p.flight==='landing'?'flying':'landing';this.emit('message',p.x,p.z,p.flight==='landing'?'正在缓缓着陆；再次召唤可取消下降。':'重新悬停。');return;}
    if(this.state.regionId===VILLA_REGION&&villaInterior(p.x,p.y,p.z)){this.emit('message',p.x,p.z,'先步行到院子或露天平台，再骑上扫帚。');return;}
    if(!p.grounded||this.mode==='adventure'&&this.inCombat(role)){this.emit('message',p.x,p.z,'先在安全地面站稳，再骑上扫帚。');return;}
    if(!this.state.broomOwned){
      if(Math.hypot(p.x-this.chapter.spawn.x,p.z-this.chapter.spawn.z)>6&&Math.hypot(p.x-this.chapter.camp.x,p.z-this.chapter.camp.z)>8){this.emit('message',p.x,p.z,'回到出发地或营火，领取守林人留下的练习扫帚。');return;}
      this.state.broomOwned=true;this.dirty=true;
      this.emit('dialogue',p.x,p.z,'守林人的留言：扫帚已为你们备好。B 起降，R 上升，C 下降；松开方向便会悬停。战斗前请先着陆。');
    }
    const roof=this.movementWorld.ceilingAt?.(p.x,p.z,p.y,PLAYER_RADIUS);
    if(roof!=null&&roof-p.y<PLAYER_HEIGHT+1){this.emit('message',p.x,p.z,'这里头顶太低，请到开阔处起飞。');return;}
    rememberGround(p,this.movementWorld,PLAYER_RADIUS);p.mounted=true;p.flight='flying';p.grounded=false;p.y+=.12;p.vy=2.4;p.vx=0;p.vz=0;p.sprinting=false;p.action='fly';this.emit('mount',p.x,p.z,'轻握扫帚，出发。',undefined,p.y);
  }
  requestTravel(role:DogRole,regionId:string,method:TravelMethod='map'):boolean {
    if(this.state.regionLoad)return false;
    if(this.state.duo)this.endDuo();
    for(const r of roles)this.finishHomeUse(r);
    delete this.state.fieldPlay;
    const p=this.state.players[role],target=getRegion(regionId);
    const reject=(text:string)=>{this.emit('message',p.x,p.z,text);return false;};
    if(!target||!['map','walk','fly'].includes(method))return reject('这条林间路线尚未开放。');
    if(regionId===this.state.regionId)return false;
    if(!this.availableRegions.includes(regionId))return reject('先与伙伴完成前一段故事，新的旅途才会开启。');
    if(this.mode==='adventure'&&this.inCombat(role))return reject('先脱离战斗，再向伙伴发出同行邀请。');
    if(this.state.travel)return false;
    if(method==='map'&&!this.state.discoveredRegions.includes(regionId))return reject('先沿步道或骑扫帚发现这里，之后就能从地图返回。');
    let connection;
    if(method!=='map'){
      connection=regionConnections(this.state.regionId).find(c=>c.to===regionId&&Math.hypot(p.x-c.x,p.z-c.z)<=c.radius);
      if(!connection)return reject('沿实际步道到达路标后，才能进入下一片区域。');
      if(method==='fly'&&(!p.mounted||target.indoor))return reject(target.indoor?'请在门前着陆，再步行进屋。':'先骑上扫帚，再沿林间航路抵达。');
      if(method==='walk'&&!this.onConnectionSurface(p,connection))return reject('请先走到门前或路标所在的地面。');
    }
    if(this.mode==='exploration')return this.changeRegion(regionId,connection?.arrival??target.spawn);
    this.state.travel={id:Math.max(1,this.state.eventSerial+1),from:this.state.regionId,to:regionId,method,proposer:role,expiresAt:this.state.time+30,...(connection?{connectionId:connection.id}:{})};
    this.emit('travel-proposal',p.x,p.z,'邀请伙伴同行 · '+target.name);return true;
  }
  respondTravel(role:DogRole,accept:boolean):boolean {
    const proposal=this.state.travel;if(!proposal)return false;
    if(!accept){delete this.state.travel;this.boundaryCooldown=4;this.emit('message',0,0,'已取消同行邀请，继续在当前区域探索。');return true;}
    if(role===proposal.proposer||proposal.from!==this.state.regionId||proposal.expiresAt<this.state.time)return false;
    if(this.mode==='adventure'&&this.visibleRoles.some(r=>this.inCombat(r))){this.emit('message',0,0,'伙伴仍在战斗中，暂时不能同行。');return false;}
    const target=getRegion(proposal.to);
    if(!target||!this.availableRegions.includes(target.id)){delete this.state.travel;return false;}
    const connection=proposal.connectionId?regionConnections(proposal.from).find(c=>c.id===proposal.connectionId):undefined;
    if(connection){const p=this.state.players[proposal.proposer];if(Math.hypot(p.x-connection.x,p.z-connection.z)>connection.radius+1){delete this.state.travel;this.emit('message',p.x,p.z,'已离开路标，同行邀请取消。');return false;}}
    return this.changeRegion(target.id,connection?.arrival??target.spawn);
  }
  private checkRegionBoundary(){
    if(this.boundaryCooldown>0||this.state.travel)return;
    for(const role of this.visibleRoles){const p=this.state.players[role];
      const link=regionConnections(this.state.regionId).find(c=>!getRegion(c.to)?.indoor&&!this.region.indoor&&this.availableRegions.includes(c.to)&&Math.hypot(p.x-c.x,p.z-c.z)<2.2);
      if(!link)continue;
      if(this.lastBoundary===link.id)return;
      this.boundaryCooldown=3;
      const from=this.state.regionId;
      if(this.requestTravel(role,link.to,p.mounted?'fly':'walk')&&this.state.regionId===from)this.lastBoundary=link.id;
      return;
    }
    this.lastBoundary=null;
  }
  private changeRegion(regionId:string,arrival:{x:number;z:number;y?:number},advanceStory=false,prepared=false):boolean {
    if(this.deferRegionTransitions&&!prepared){
      if(this.state.regionLoad)return false;delete this.state.travel;this.endDuo();for(const r of roles)this.finishHomeUse(r);this.resetMovement(false);
      this.state.regionLoad={id:++this.state.eventSerial,from:this.state.regionId,to:regionId,arrival:{...arrival},advanceStory,ready:[]};this.dirty=true;return true;
    }
    const before=this.state,chapterBefore=this.chapter,worldBefore=this.movementWorld,saveBefore=this.save.chapterId;
    try{
      const region=getRegion(regionId);if(!region)throw new Error('区域资源尚未安装');
      const history=structuredClone(before.regionArchive??{});
      history[before.regionId]={chapterId:this.chapter.id,flags:[...before.flags],enemies:structuredClone(before.enemies),checkpoint:{...before.checkpoint},ended:before.ended};
      this.chapter=getRegionChapter(regionId);
      this.movementWorld=createRegionMovementWorld(regionId,this.chapter,()=>this.state?.flags??[]);
      const state=this.initial(this.chapter),remembered=history[regionId];
      if(remembered){state.flags=[...remembered.flags];state.enemies=structuredClone(remembered.enemies) as Enemy[];state.ended=remembered.ended;}
      state.chapterId=advanceStory?this.chapter.id:before.chapterId;
      state.regionId=regionId;state.regionArchive=history;state.time=before.time;state.eventSerial=before.eventSerial;state.broomOwned=before.broomOwned;
      state.journeys=structuredClone(before.journeys);
      state.fieldbook=structuredClone(before.fieldbook);
      state.homeLights=before.homeLights;
      if(before.story)state.story=structuredClone(before.story);
      state.discoveredRegions=[...new Set([...before.discoveredRegions,regionId])];state.checkpoint={x:arrival.x,z:arrival.z};
      for(const [i,r]of roles.entries()){
        const previous=before.players[r],p=state.players[r];p.hp=previous.hp;p.weapon=previous.weapon;p.weaponDrawn=previous.weaponDrawn??true;p.skin=previous.skin;p.skills=[...previous.skills];p.cooldowns=[...previous.cooldowns];
        const x=arrival.x+(i?1.3:-1.3),z=arrival.z,surface=this.movementWorld.surfaceAt(x,z,(arrival.y??1e4)+STEP_HEIGHT,PLAYER_RADIUS);
        if(regionId===UNDERSEA){const q=underseaPair(r,{x:arrival.x,y:arrival.y??-9,z:arrival.z});if(!underseaLegal(q.x,q.y,q.z))throw Error('海底抵达点净空不足');Object.assign(p,q,{safeX:q.x,safeY:q.y,safeZ:q.z,swim:'underwater',waterId:'atlantis-water',grounded:false,mounted:false,flight:'grounded',yaw:0});continue;}
        if(!surface?.walkable)throw new Error('抵达点暂时不可站立');
        Object.assign(p,{x,z,y:surface.y,safeX:x,safeZ:z,safeY:surface.y,...(regionId==='studio-manhattan'?{yaw:0}:before.regionId==='studio-manhattan'&&regionId==='studio-europe-town'?{yaw:Math.PI}:regionId==='studio-europe-town'?{yaw:0}:before.regionId==='studio-europe-town'?{yaw:-Math.PI*3/4}:{})});
      }
      this.state=state;this.syncJourneyWorld();this.save.chapterId=state.chapterId;this.boundaryCooldown=3;this.lastBoundary=null;this.normalizeMovement(true);this.resetMovement(true);this.dirty=true;
      if(this.explorationRecord){this.explorationRecord.regionId=regionId;this.explorationRecord.discoveredRegions=[...state.discoveredRegions];}
      if(regionId===UNDERSEA){for(const key of ['pet','golden'] as const){const animal=before[key];if(animal?.regionId===before.regionId){animal.anchor={regionId:animal.regionId,x:animal.x,y:animal.y,z:animal.z};}}}
      state.pet=restorePet(petIntent(before.pet),regionId,this.movementWorld,state.players,this.visibleRoles);this.petFollower.reset();
      state.golden=restoreGolden(goldenIntent(before.golden),regionId,this.movementWorld,state.players,this.visibleRoles,state.time);this.goldenFollower.reset();
      state.homePets=restoreHomePets(persistentHomePets(before.homePets),regionId,this.movementWorld,state.players,this.visibleRoles,state.time,[...(state.pet?[{...state.pet,radius:.34,height:1.25}]:[]),...(state.golden?[{...state.golden,radius:.55,height:1.6}]:[])]);this.homePetFollowers.reset();
      this.emit('region',arrival.x,arrival.z,region.name);return true;
    }catch{
      this.state=before;this.chapter=chapterBefore;this.movementWorld=worldBefore;this.save.chapterId=saveBefore;delete this.state.travel;this.resetMovement(true);this.emit('message',0,0,'这段路暂时没有载入成功，已返回原区域安全位置；故事与发现都保留。');return false;
    }
  }
  private loadout(r: DogRole, c: Command) {
    const p = this.state.players[r],
      sp = this.save.players[r];
    if (
      this.mode === "adventure" &&
      Math.hypot(p.x - this.chapter.camp.x, p.z - this.chapter.camp.z) > 8
    )
      return;
    if (c.weapon && sp.unlockedEquipment.includes(c.weapon))
      p.weapon = sp.weaponId = c.weapon;
    if (c.skin && sp.unlockedSkins.includes(c.skin))
      p.skin = sp.skinId = c.skin;
    if (
      c.skills &&
      c.skills.length === 2 &&
      c.skills.every((s) => sp.unlockedSkills.includes(s))
    )
      p.skills = sp.skillIds = c.skills;
    this.dirty = true;
  }
  emit(type: string, x: number, z: number, text?: string, value?: number, y?: number) {
    this.state.events.push({
      id: ++this.state.eventSerial,
      type,
      x,
      z,
      ...(y !== undefined ? { y } : {}),
      ...(text ? { text } : {}),
      ...(value !== undefined ? { value } : {}),
    });
    if (this.state.events.length > 28) this.state.events.shift();
  }
  /** Attach the exact visible world's obstacles after a scene build. */
  setMovementWorld(world: MovementWorld) {
    this.movementWorld = world;
    for (const r of this.visibleRoles) {
      const p = this.state.players[r];
      if (p.grounded&&!p.homeUse) this.anchorPlayer(p);
    }
  }
  private groundY(x: number, z: number, hint = 1e4) {
    return standingSurface(this.movementWorld, x, z, hint, PLAYER_RADIUS)?.y ?? 0;
  }
  private anchorPlayer(p: Player) {
    const surface = standingSurface(this.movementWorld, p.x, p.z, p.y+STEP_HEIGHT, PLAYER_RADIUS)??standingSurface(this.movementWorld,p.x,p.z,1e4,PLAYER_RADIUS);
    if (!surface) { this.recoverPlayer(p); return; }
    const projected = this.movementWorld.resolveAt(p.x, p.z, surface.y, PLAYER_RADIUS, PLAYER_HEIGHT);
    const ground = standingSurface(this.movementWorld, projected.x, projected.z, surface.y + STEP_HEIGHT, PLAYER_RADIUS);
    if (!ground || this.movementWorld.isSafe && !this.movementWorld.isSafe(projected.x, projected.z, ground.y, PLAYER_RADIUS)) {
      this.recoverPlayer(p); return;
    }
    p.x = projected.x; p.z = projected.z; p.y = ground.y; p.vy = 0; p.grounded = true;
    rememberGround(p, this.movementWorld, PLAYER_RADIUS);
  }
  private normalizeMovement(recoverAirborne: boolean) {
    if(this.state.regionId===BEACH)for(const p of Object.values(this.state.players))if(beachSwimmingLegal(p.x,p.y,p.z)){Object.assign(p,{swim:p.y+1.5<-.01?'underwater':'surface',waterId:BEACH_WATER,grounded:false,mounted:false,flight:'grounded',safeX:p.x,safeY:p.y,safeZ:p.z});}
    if(this.state.regionId===UNDERSEA)for(const p of Object.values(this.state.players)){if(!underseaLegal(p.x,p.y,p.z))Object.assign(p,underseaPair(p.role));Object.assign(p,{swim:'underwater',waterId:'atlantis-water',grounded:false,mounted:false,flight:'grounded',safeX:p.x,safeY:p.y,safeZ:p.z});}
    if(studioRelease(this.state.regionId)){
      // Missing Y identifies pre-studio enemy records; preserve identity, HP and rewards.
      for(const e of this.state.enemies)if(e.y===undefined){const def=[...this.chapter.encounters,...(this.chapter.event?.spawns??[])].find(d=>e.id.startsWith(d.id+'-'));if(def){const index=Number(e.id.slice(def.id.length+1))||0;Object.assign(e,{x:def.x+(index?Math.sin(index*3)*2:0),z:def.z+(index?Math.cos(index*3)*2:0),y:def.y??0,homeX:def.x,homeZ:def.z,targetX:def.x,targetZ:def.z,telegraphs:[]});}}
      for(const p of Object.values(this.state.players))if((p.grounded||recoverAirborne&&p.swim==='land')&&!this.movementWorld.isSafe?.(p.x,p.z,p.y,PLAYER_RADIUS)){const a=this.chapter.spawn;Object.assign(p,{x:a.x+(p.role==='gold'?1.3:-1.3),z:a.z,y:a.y??0,safeX:a.x+(p.role==='gold'?1.3:-1.3),safeZ:a.z,safeY:a.y??0,grounded:true});}
    }
    const legacy = (this.state.v as number) === 1;
    this.state.v = 2;
    for (const e of this.state.enemies) { e.exposed = Number.isFinite(e.exposed) ? e.exposed : 0; e.recoveryUsed = e.recoveryUsed === true; }
    for (const r of roles) {
      const p = this.state.players[r];
      p.y = Number.isFinite(p.y) ? p.y : this.groundY(p.x, p.z);
      p.vy = Number.isFinite(p.vy) ? p.vy : 0;
      p.grounded = typeof p.grounded === "boolean" ? p.grounded : true;
      p.sprinting = typeof p.sprinting === "boolean" ? p.sprinting : false;
      p.safeX = Number.isFinite(p.safeX) ? p.safeX : p.x;
      p.safeZ = Number.isFinite(p.safeZ) ? p.safeZ : p.z;
      p.safeY = Number.isFinite(p.safeY) ? p.safeY : p.y;
      p.landing = Number.isFinite(p.landing) ? p.landing : 0;
      p.swim=p.swim??'land';
      p.mounted=p.mounted===true;p.flight=['flying','landing'].includes(p.flight)?p.flight:'grounded';
      p.vx=Number.isFinite(p.vx)?p.vx:0;p.vz=Number.isFinite(p.vz)?p.vz:0;
      if(p.homeUse){p.speed=0;p.vx=0;p.vy=0;p.vz=0;continue;}
      if (legacy || p.grounded) this.anchorPlayer(p);
      else if (recoverAirborne && p.swim==='land') this.recoverPlayer(p);
      if (recoverAirborne) { p.mounted=false;p.flight='grounded';p.vx=0;p.vz=0;p.sprinting = false; p.speed = 0; p.vy = 0; p.landing = 0; }
    }
  }
  restoreSnapshot(snapshot: unknown, recoverAirborne = false) {
    validateSnapshotShape(snapshot);
    if(snapshot.chapterId!==this.state.chapterId||snapshot.regionId&&snapshot.regionId!==this.state.regionId){
      const region=snapshot.regionId??snapshot.chapterId;
      if(!getRegion(region))throw new Error('同步区域尚未安装');
      this.chapter=getRegionChapter(region,CHAPTERS.find(c=>c.id===snapshot.chapterId));
      this.movementWorld=createRegionMovementWorld(region,this.chapter,()=>this.state?.flags??[]);
    }
    this.state = structuredClone(snapshot) as unknown as Snapshot;
    this.state.homePets??=restoreHomePets(this.save.world.homePets,this.state.regionId,this.movementWorld,this.state.players,this.visibleRoles,this.state.time);this.homePetFollowers.reset();
    this.state.golden??=restoreGolden(goldenIntent(this.save.world.golden),this.state.regionId,this.movementWorld,this.state.players,this.visibleRoles,this.state.time);this.goldenFollower.reset();
    this.state.pet??=restorePet(petIntent(this.save.world.pet),this.state.regionId,this.movementWorld,this.state.players,this.visibleRoles);
    this.petFollower.reset();
    for(const role of roles){this.state.players[role].weaponDrawn??=this.save.players[role].weaponDrawn??true;this.save.players[role].weaponDrawn=this.state.players[role].weaponDrawn;}
    this.state.regionId??=this.state.chapterId;this.state.discoveredRegions??=[this.state.regionId];this.state.regionArchive??={};this.state.broomOwned??=false;
    this.state.fieldbook??=emptyFieldBook();
    this.state.journeys??=emptyJourneys();this.syncJourneyWorld();
    this.normalizeMovement(recoverAirborne);
    if (recoverAirborne) this.resetMovement(true);
  }
  /** Pause, focus loss and transport recovery must not replay held controls. */
  resetMovement(recoverAirborne = true, onlyRole?: DogRole, releaseHome=true) {
    if(recoverAirborne)this.animalInteractions.cancel(this.state,onlyRole);
    if(this.state.homePets){for(const p of Object.values(this.state.homePets))if(!onlyRole||p.owner===onlyRole){p.speed=0;if(p.id==='home-kangaroo'&&p.pose==='hop'){p.landAt??=kangarooLandingAt(this.state.time,p.gaitStart);}else p.pose=p.id==='home-sea-turtle'?(p.water?'idle':'land_idle'):'sit';}this.homePetFollowers.reset();}
    if(this.state.golden&&(!onlyRole||this.state.golden.owner===onlyRole)){this.state.golden.speed=0;this.state.golden.pose='sit';this.goldenFollower.reset();}
    if(!onlyRole&&this.state.pet){this.state.pet.speed=0;this.state.pet.pose='idle';this.petFollower.reset();}
    if(recoverAirborne){delete this.state.fieldPlay;if(releaseHome)for(const role of onlyRole?[onlyRole]:roles)this.finishHomeUse(role);}
    if(recoverAirborne&&this.state.duo)this.endDuo();
    if(recoverAirborne&&!onlyRole){delete this.state.travel;delete this.state.journeyProposal;this.boundaryCooldown=3;}
    for (const role of onlyRole ? [onlyRole] : roles) {
      this.inputs[role] = { x: 0, z: 0, actions: [] };
      this.lastInput[role] = this.state.time;
      const p = this.state.players[role];
      if (recoverAirborne && !p.grounded && p.swim==='land') this.recoverPlayer(p);
      p.sprinting = false; p.speed = 0;p.vx=0;p.vz=0;p.vy=0;
      if (["run", "sprint", "jump", "fall", "dodge"].includes(p.action)) { p.action = "idle"; p.actionTime = 0; }
    }
  }
  private recoverPlayer(p: Player) {
    if(this.state.regionId===BEACH&&p.swim!=='land'&&beachSwimmingLegal(p.safeX,p.safeY,p.safeZ)){Object.assign(p,{x:p.safeX,y:p.safeY,z:p.safeZ,swim:p.safeY+1.5<-.01?'underwater':'surface',waterId:BEACH_WATER,grounded:false,mounted:false,flight:'grounded',vx:0,vy:0,vz:0,speed:0,sprinting:false,action:p.safeY+1.5<-.01?'dive':'swim',actionTime:0});return;}
    if(this.state.regionId===UNDERSEA){const q=underseaLegal(p.safeX,p.safeY,p.safeZ)?{x:p.safeX,y:p.safeY,z:p.safeZ}:underseaPair(p.role);Object.assign(p,q,{safeX:q.x,safeY:q.y,safeZ:q.z,swim:'underwater',waterId:'atlantis-water',grounded:false,mounted:false,flight:'grounded',vx:0,vy:0,vz:0,speed:0,sprinting:false,landing:0,action:'dive',actionTime:0});return;}
    let x = p.safeX, z = p.safeZ;
    let surface = standingSurface(this.movementWorld, x, z, p.safeY + STEP_HEIGHT, PLAYER_RADIUS);
    if (!surface) {
      x = this.state?.checkpoint.x ?? this.chapter.spawn.x;
      z = this.state?.checkpoint.z ?? this.chapter.spawn.z;
      surface = standingSurface(this.movementWorld, x, z, 1e4, PLAYER_RADIUS);
    }
    // A creature can have occupied the remembered point while the dog was airborne.
    // Search nearby valid ground before restoring, instead of spawning inside it.
    const bodies = this.contacts().filter(body => body.id !== "player:"+p.role);
    const candidates = [{x,z}];
    for (const distance of [.8,1.6,2.4,3.2,4]) for (let i=0;i<12;i++)
      candidates.push({x:x+Math.cos(i*Math.PI/6)*distance,z:z+Math.sin(i*Math.PI/6)*distance});
    for (const point of candidates) {
      const ground = standingSurface(this.movementWorld,point.x,point.z,(surface?.y ?? p.safeY)+STEP_HEIGHT,PLAYER_RADIUS);
      if (!ground || Math.abs(ground.y-(surface?.y ?? p.safeY))>1.5 ||
          this.movementWorld.isSafe && !this.movementWorld.isSafe(point.x,point.z,ground.y,PLAYER_RADIUS) ||
          bodies.some(body=>Math.hypot(body.x-point.x,body.z-point.z)<body.radius+PLAYER_RADIUS+.025)) continue;
      x=point.x;z=point.z;surface=ground;break;
    }
    p.x = x; p.z = z; p.y = surface?.y ?? 0;
    p.vy = 0; p.grounded = true; p.sprinting = false; p.speed = 0; p.landing = 0;p.mounted=false;p.flight='grounded';p.swim='land';delete p.waterId;p.vx=0;p.vz=0;
    p.safeX = x; p.safeY = p.y; p.safeZ = z;
    if (p.hp > 0) { p.action = "idle"; p.actionTime = 0; }
  }
  private enemyHeight(e: Enemy) {
    const base = e.kind === "slime" ? .95 : e.kind === "wolf" ? 1.5 : e.kind === "dragon" ? 3.3 : 2.55;
    return base * (e.boss ? 1.5 : e.elite ? 1.18 : 1);
  }
  private contacts(): ContactBody[] {
    return [
      ...this.visibleRoles.filter(role=>!this.state.players[role].homeUse&&!(this.state.duo?.phase==='active'&&this.state.duo.type==='ride'&&role==='gold')).map(role => {
        const p = this.state.players[role];
        return { id: "player:" + role, x: p.x, z: p.z, y: p.y, height: p.swim!=='land'?SWIM_HEIGHT:PLAYER_HEIGHT, reservesColumn: !this.movementWorld.swimLegalAt||p.swim==='land', radius: p.swim!=='land'?SWIM_RADIUS:PLAYER_RADIUS };
      }),
      ...friendlyAnimalContacts(this.state,this.movementWorld),
      ...this.state.enemies.filter(e => e.hp > 0).map(e => ({
        id: e.id, x: e.x, z: e.z, y: e.y??this.groundY(e.x,e.z), height: this.enemyHeight(e), reservesColumn: true, radius: enemyRadius(e),
      })),
    ];
  }
  private moveEntity(entity: Player | Enemy, dx: number, dz: number, feetY?: number) {
    const player = "role" in entity;
    const id = player ? "player:" + entity.role : entity.id;
    const bodies = this.contacts(), body = bodies.find(b => b.id === id)!;
    if (feetY !== undefined) body.y = feetY;
    const resolve = player
      ? (x: number,z: number,r = PLAYER_RADIUS) => (entity as Player).swim!=='land'&&this.movementWorld.resolveSwimAt?this.movementWorld.resolveSwimAt(x,z,feetY??entity.y,r,SWIM_HEIGHT):this.movementWorld.resolveAt(x,z,feetY ?? entity.y,r,PLAYER_HEIGHT)
      : entity.y===undefined?this.resolve:(x:number,z:number,r=enemyRadius(entity as Enemy))=>this.movementWorld.resolveAt(x,z,entity.y!,r,this.enemyHeight(entity as Enemy));
    const old={x:body.x,z:body.z};if(player&&entity.swim!=='land'&&this.movementWorld.swimLegalAt){const y=feetY??entity.y;if(!this.movementWorld.swimLegalAt(body.x+dx,y,body.z+dz)){if(this.movementWorld.swimLegalAt(body.x+dx,y,body.z))dz=0;else if(this.movementWorld.swimLegalAt(body.x,y,body.z+dz))dx=0;else return;}}moveBody(body, dx, dz, bodies, resolve);
    if(player&&entity.swim!=='land'&&this.movementWorld.swimLegalAt&&!this.movementWorld.swimLegalAt(body.x,feetY??entity.y,body.z)){body.x=old.x;body.z=old.z;}
    if(!player&&entity.y!==undefined){const floor=this.movementWorld.surfaceAt(body.x,body.z,entity.y+STEP_HEIGHT,enemyRadius(entity));if(!floor||Math.abs(floor.y-entity.y)>.5){body.x=old.x;body.z=old.z;}else entity.y=floor.y;}
    entity.x = body.x; entity.z = body.z;
  }
  private settleContacts(dt: number) {
    const bodies = this.contacts();
    settleBodies(bodies, (x,z,r = PLAYER_RADIUS,y = this.groundY(x,z),height = PLAYER_HEIGHT) =>
      height===SWIM_HEIGHT&&this.movementWorld.resolveSwimAt?this.movementWorld.resolveSwimAt(x,z,y,r,height):this.movementWorld.resolveAt(x,z,y,r,height), dt * WALK_SPEED);
    for (const body of bodies) {
      if(body.fixed)continue;
      const entity = body.id.startsWith("player:")
        ? this.state.players[body.id.slice(7) as DogRole]
        : this.state.enemies.find(e => e.id === body.id)!;
      if('role' in entity&&entity.swim!=='land'&&this.movementWorld.swimLegalAt&&!this.movementWorld.swimLegalAt(body.x,entity.y,body.z))continue;
      if('role' in entity&&entity.swim!=='land'&&!this.movementWorld.waterAt?.(body.x,body.z,SWIM_RADIUS))continue;
      entity.x = body.x; entity.z = body.z;
    }
  }
  tick(dt: number, _legacySolo = false) {
    if(this.storiesEnabled&&this.state.story?.active){this.endDuo();return;}
    dt = Math.min(0.05, Math.max(0, dt));
    const s = this.state;
    s.time += dt;
    if(s.regionLoad)return;
    if(s.duo){const d=s.duo,check={...s};delete check.duo;
      if(d.expiresAt<s.time||d.regionId!==s.regionId||d.type==='ride'&&!rideAllowedInRegion(s.regionId)||s.travel||roles.some(r=>this.inCombat(r))||d.phase==='invited'&&!duoAvailable(check,this.movementWorld))this.endDuo();
    }
    this.boundaryCooldown=Math.max(0,this.boundaryCooldown-dt);
    if(s.travel&&s.travel.expiresAt<s.time){delete s.travel;this.emit('message',0,0,'同行邀请已过期，仍停留在当前区域。');}
    if(s.journeyProposal){const proposal=s.journeyProposal,node=journeyNodes(s.regionId).find(n=>n.id===proposal.nodeId),p=s.players[proposal.proposer];
      if(!node||proposal.expiresAt<s.time||proposal.revision!==s.journeys.revision||p.hp<=0||!this.onInteractionSurface(p,node)||Math.hypot(p.x-node.x,p.z-node.z)>4){delete s.journeyProposal;this.emit('message',p.x,p.z,'已松开合作机关；调好的位置仍保留，随时可以再试。');}}
    if(s.duo?.phase!=='active')this.settleContacts(dt);
    for (const r of this.visibleRoles) {
      const p = s.players[r];
      if(p.homeUse){this.tickHomeUse(r,dt);continue;}
      p.cooldowns = p.cooldowns.map((n) => Math.max(0, n - dt));
      p.invincible = Math.max(0, p.invincible - dt);
      p.buff = Math.max(0, p.buff - dt);
      p.actionTime = Math.max(0, p.actionTime - dt);
      if (p.actionTime === 0 && p.hp > 0) p.action = "idle";
      if(s.duo?.phase==='active'){
        if(this.inputs[r].actions.includes('mount')){this.endDuo();this.toggleBroom(r);}
        else{this.inputs[r].actions=[];continue;}
      }
      if (p.hp <= 0) {
        p.action = "down";
        p.speed = 0; p.sprinting = false;
        this.inputs[r].actions = [];
        if (!p.grounded) this.recoverPlayer(p);
        continue;
      }
      let cmd = this.inputs[r];
      if (s.time - this.lastInput[r] > 0.35) cmd = { x: 0, z: 0, actions: [] };

      if(fieldMovementLocked(s.fieldPlay,r))cmd={x:0,z:0,actions:[]};
      for (const a of cmd.actions){if(p.homeUse)break;this.act(r, a);}
      this.inputs[r].actions = [];
      if(p.homeUse)continue;
      if(p.action==='interact'&&s.animalCare?.reactions.some(a=>a.role===r)&&Math.hypot(cmd.x,cmd.z)>.08){this.animalInteractions.cancel(s,r);p.action='idle';p.actionTime=0;}
      const canMove = !["revive", "interact"].includes(p.action);
      const combatAction = ["attack", "cast", "hit", "dodge"].includes(p.action);
      p.sprinting = cmd.sprint === true && canMove && !combatAction && Math.hypot(cmd.x,cmd.z) > .08;
      const speed = p.action === "dodge" ? 11 : p.sprinting ? SPRINT_SPEED : WALK_SPEED;
      let dx = canMove ? cmd.x : 0, dz = canMove ? cmd.z : 0;
      if (p.action === "dodge") { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }
      if (Math.hypot(dx,dz) > .01) p.yaw = Math.atan2(dx,dz);
      const beforeX = p.x, beforeZ = p.z;
      const canEnterWater=this.state.regionId===BEACH?(x:number,y:number,z:number)=>this.contacts().every(b=>b.id==='player:'+p.role||y>=(b.y??0)+(b.height??0)||y+SWIM_HEIGHT<=(b.y??0)||Math.hypot(x-b.x,z-b.z)>=SWIM_RADIUS+b.radius+.025):undefined;
      const wasSwimming=p.swim!=='land';
      const movement = wasSwimming?advanceSwimming(p,dx,dz,cmd.lift??0,cmd.sprint===true,dt,this.movementWorld,(mx,mz,y)=>this.moveEntity(p,mx,mz,y),this.movementWorld.swimLegalAt?(x,y,z)=>this.contacts().every(b=>b.id==='player:'+p.role||y>=(b.y??0)+(b.height??0)||y+SWIM_HEIGHT<=(b.y??0)||Math.hypot(x-b.x,z-b.z)>=SWIM_RADIUS+b.radius-.001):undefined):p.mounted
        ?advanceFlight(p,dx,dz,cmd.lift??0,cmd.sprint===true,dt,this.movementWorld,PLAYER_RADIUS,(mx,mz,y)=>this.moveEntity(p,mx,mz,y),canEnterWater)
        :advanceMovement(p, dx * speed, dz * speed, dt, this.movementWorld, PLAYER_RADIUS,(mx,mz,y) => this.moveEntity(p,mx,mz,y),PLAYER_HEIGHT,canEnterWater);
      p.speed = dt > 0 ? Math.hypot(p.x - beforeX,p.z - beforeZ) / dt : 0;
      if(!wasSwimming&&p.swim!=='land')p.speed=0;
      if(wasSwimming!==(p.swim!=='land')){p.actionTime=0;this.emit('water-transition',p.x,p.z,wasSwimming?'沿浅坡上岸了。':s.regionId===BEACH?'进入海湾泳区 · R 上浮 / C 下潜，沿原沙坡返回岸边。':'入水了 · 沿石坡上下水，池中央 R 上浮 / C 下潜。',undefined,p.y);this.dirty=true;}
      if (movement.needsRecovery) {
        this.recoverPlayer(p);
        this.emit("return", p.x,p.z,"回到最近安全落点，发现与奖励都还在。");
      } else if (movement.landed) this.emit("land",p.x,p.z,undefined,undefined,p.y);
      if (!combatAction && !["revive","interact"].includes(p.action))
        p.action = p.swim!=='land'?(p.swim==='underwater'?'dive':'swim'):p.mounted ? (p.flight==='landing'?'land':'fly') : !p.grounded ? (p.vy > 0 ? "jump" : "fall") : p.speed > .01 ? (p.sprinting ? "sprint" : "run") : "idle";
      if (p.action === "revive") {
        const other = s.players[r === "gold" ? "white" : "gold"];
        if (other.hp <= 0 && Math.hypot(other.x - p.x, other.z - p.z) < 3) {
          other.revive += dt;
          if (other.revive >= 2.2) {
            other.hp = 65;
            other.action = "idle";
            other.revive = 0;
            other.invincible = 2;
            this.emit("heal", other.x, other.z, "伙伴又站起来了！");
            this.dirty = true;
          }
        } else p.action = "idle";
      }
      if (
        Math.hypot(p.x - this.chapter.camp.x, p.z - this.chapter.camp.z) < 4 &&
        p.hp < 100
      )
        p.hp = Math.min(100, p.hp + dt * 12);
    }
    this.tickDuo(dt);
    this.fieldTicker.tick(this.fieldContext());
    this.homePetFollowers.tick(dt,s,this.movementWorld,this.visibleRoles);
    this.goldenFollower.tick(dt,s,this.movementWorld,this.visibleRoles);
    this.petFollower.tick(dt,s,this.movementWorld,this.visibleRoles);
    this.animalInteractions.tick(s,this.movementWorld,this.visibleRoles,a=>this.emit('animal-call',a.x,a.z,a.species,undefined,a.voiceY??a.y));
    const goldenReaction=animalReaction(s,'golden-retriever');if(goldenReaction&&s.golden)Object.assign(s.golden,{x:goldenReaction.x,y:goldenReaction.y,z:goldenReaction.z,yaw:goldenReaction.yaw,speed:0,pose:'sit'});
    const petReaction=animalReaction(s,'hashiha');if(petReaction&&s.pet){Object.assign(s.pet,{x:petReaction.x,y:petReaction.y,z:petReaction.z,yaw:petReaction.yaw,speed:0,pose:'sit'});}
    for (const e of s.enemies) this.enemy(e, dt);
    if (this.visibleRoles.every((r) => s.players[r].hp <= 0)) {
      this.transitionTimer += dt;
      if (this.transitionTimer > 2.5) {
        for (const [i, r] of this.visibleRoles.entries()) {
          const p = s.players[r];
          p.hp = 100;
          p.x = s.checkpoint.x + i * 1.5;
          p.z = s.checkpoint.z;
          p.action = "idle";
          p.invincible = 3;
          this.anchorPlayer(p);
        }
        for (const e of s.enemies) {
          if (e.hp > 0) {
            e.x = e.homeX;
            e.z = e.homeZ;
            e.state = "idle";
            e.hp = e.maxHp;
          }
        }
        this.transitionTimer = 0;
        this.emit(
          "message",
          s.checkpoint.x,
          s.checkpoint.z,
          this.mode === "exploration"
            ? "回到营火，继续自由探索。沙盒练习不影响双人冒险。"
            : "营火仍为你们亮着。已获得的星光都还在。",
        );
        this.dirty = true;
      }
    }
    if (!this.visibleRoles.every((r) => s.players[r].hp <= 0))
      this.transitionTimer = 0;
    if (this.mode === "adventure"&&this.state.regionId===this.state.chapterId) this.triggers(dt);
    this.checkRegionBoundary();
  }
  private act(r: DogRole, a: Action) {
    const p = this.state.players[r];
    if (p.hp <= 0) return;
    if(fieldHidesPartner(this.state.fieldPlay)&&['ping','attack','skill1','skill2'].includes(a))return;
    if(p.swim!=='land'&&!['ping'].includes(a)){if(a==='mount')this.emit('message',p.x,p.z,'先沿浅坡上岸，在安全地面召出扫帚。');return;}
    if(p.mounted&&!['mount','ping','interact'].includes(a))return;
    switch (a) {
      case 'mount':this.toggleBroom(r);break;
      case "jump":
        if (p.grounded && !["attack", "cast", "dodge", "revive", "interact", "hit"].includes(p.action)) {
          rememberGround(p, this.movementWorld, PLAYER_RADIUS);
          p.grounded = false; p.vy = JUMP_SPEED; p.action = "jump"; p.landing = 0;
          this.emit("jump",p.x,p.z,undefined,undefined,p.y);
        }
        break;
      case "dodge":
        if (p.cooldowns[3] <= 0 && p.grounded) {
          p.action = "dodge";
          p.actionTime = 0.34;
          p.invincible = 0.48;
          p.cooldowns[3] = 1.2;
          p.buff = 1.8;
          this.emit("dodge", p.x, p.z);
        }
        break;
      case "attack":
        if (p.cooldowns[0] <= 0 && p.action !== "dodge") {
          this.setWeaponDrawn(r,true);
          const ranged = p.weapon !== "sword";
          p.cooldowns[0] = p.weapon === "bow" ? 0.6 : 0.46;
          p.action = ranged ? "cast" : "attack";
          p.sprinting = false;
          p.actionTime = 0.37;
          const range = ranged ? 10 : 2.8;
          const enemies = this.state.enemies
            .filter((e) => e.hp > 0 && (e.y===undefined||Math.abs(p.y-e.y)<2.4) && (ranged || p.y < (e.y??this.groundY(e.x,e.z)) + this.enemyHeight(e) + .35) && Math.hypot(e.x - p.x, e.z - p.z) < (ranged ? range : PLAYER_RADIUS + enemyRadius(e) + 1.35))
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.x, a.z - p.z) -
                Math.hypot(b.x - p.x, b.z - p.z),
            );
          const partner=this.attackablePartner(r,range,ranged?3.2:PLAYER_HEIGHT);
          if(partner&&(!enemies[0]||Math.hypot(partner.x-p.x,partner.z-p.z)<=Math.hypot(enemies[0].x-p.x,enemies[0].z-p.z))){
            p.yaw=Math.atan2(partner.x-p.x,partner.z-p.z);
            this.hurtPartner(partner,(p.weapon==='chime'?14:22)*(p.buff>0?1.3:1));
          } else if (enemies[0]) {
            p.yaw = Math.atan2(enemies[0].x - p.x, enemies[0].z - p.z);
            this.hurt(
              enemies[0],
              (p.weapon === "chime" ? 14 : 22) * (p.buff > 0 ? 1.3 : 1),
            );
            if (p.weapon === "chime") p.hp = Math.min(100, p.hp + 3);
          }
          this.emit(ranged ? "magic" : "slash", p.x, p.z, undefined, p.yaw, p.y + .8);
        }
        break;
      case "skill1":
      case "skill2": {
        const slot = a === "skill1" ? 0 : 1;
        if (p.cooldowns[slot + 1] > 0) return;
        const skill = p.skills[slot] ?? (slot === 0 ? "spark" : "heal");
        if(!['heal','shield'].includes(skill))this.setWeaponDrawn(r,true);
        p.action = "cast";
        p.sprinting = false;
        p.actionTime = 0.55;
        p.cooldowns[slot + 1] = skill === "heal" ? 10 : 6;
        if (skill === "heal" || skill === "shield") {
          for (const role of this.visibleRoles) {
            const ally = this.state.players[role];
            if (ally.hp > 0 && Math.hypot(ally.x - p.x, ally.z - p.z) < 8) {
              ally.hp = Math.min(100, ally.hp + 35);
              ally.invincible = skill === "shield" ? 4 : 1;
            }
          }
          this.emit("heal", p.x, p.z, "星光正温柔地回应你");
        } else {
          const list = this.state.enemies.filter(
            (e) =>
              e.hp > 0 && (e.y===undefined||Math.abs(p.y-e.y)<3.2) &&
              Math.hypot(e.x - p.x, e.z - p.z) < (skill === "nova" ? 5 : 12),
          );
          const partner=this.attackablePartner(r,skill==='nova'?5:12,3.2);
          if (skill === "nova") { list.forEach((e)=>this.hurt(e,48));if(partner)this.hurtPartner(partner,48); }
          else {
            const enemy=list.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
            if(partner&&(!enemy||Math.hypot(partner.x-p.x,partner.z-p.z)<=Math.hypot(enemy.x-p.x,enemy.z-p.z)))this.hurtPartner(partner,52);
            else if(enemy)this.hurt(enemy,52);
          }
          this.emit("burst", p.x, p.z);
        }
        break;
      }
      case "interact":
        this.interact(r);
        break;
      case "ping":
        this.emit("ping", p.x, p.z, CHARACTER_NAMES[r] + "在这里");
        break;
    }
  }
  /** Both physically present roles can trade blows; hidden solo avatars are never targets. */
  private attackablePartner(role:DogRole,range:number,vertical:number):Player|undefined {
    const other:DogRole=role==='gold'?'white':'gold',active=this.state.activeRoles??this.visibleRoles;
    if(!this.visibleRoles.includes(other)||!active.includes(role)||!active.includes(other))return;
    const source=this.state.players[role],target=this.state.players[other];
    if(target.hp>0&&Math.abs(source.y-target.y)<vertical&&Math.hypot(source.x-target.x,source.z-target.z)<range)return target;
  }
  private hurtPartner(target:Player,baseDamage:number) {
    if (this.freeExploration) return;
    if(target.hp<=0||target.invincible>0)return;
    const damage=Math.max(1,Math.round(baseDamage*.6));
    target.hp=Math.max(0,target.hp-damage);target.action=target.hp?'hit':'down';target.actionTime=.3;
    target.sprinting=false;target.speed=0;target.vx=0;target.vz=0;target.invincible=.55;
    this.emit('damage',target.x,target.z,undefined,damage,target.y+.7);
    if(!target.hp)this.emit('message',target.x,target.z,CHARACTER_NAMES[target.role]+'倒下了，靠近后可以扶起。');
    this.dirty=true;
  }
  private hurt(e: Enemy, dmg: number) {
    if (e.exposed > 0) dmg *= 1.5;
    e.hp = Math.max(0, e.hp - dmg);
    e.hit = 0.2;
    this.emit("hit", e.x, e.z, undefined, Math.round(dmg));
    if (e.hp === 0) {
      e.state = "dead";
      e.telegraphs = [];
      e.timer = 0.8;
      this.emit(
        "defeat",
        e.x,
        e.z,
        this.mode === "exploration"
          ? "沙盒练习结束 · 不结算剧情或奖励"
          : e.boss
            ? "被困的星光自由了！"
            : undefined,
      );
      this.dirty = true;
    }
  }
  private enemy(e: Enemy, dt: number) {
    const reaction=animalReaction(this.state,'creature:'+e.id);if(reaction){e.yaw=reaction.yaw;e.timer=Math.max(.6,e.timer);e.state='idle';return;}
    e.hit = Math.max(0, e.hit - dt);
    e.exposed = Math.max(0, (e.exposed ?? 0) - dt);
    if (e.hp <= 0) return;
    const living = this.visibleRoles
      .map((r) => this.state.players[r])
      .filter((p) => p.hp > 0 && (e.y===undefined||Math.abs(p.y-e.y)<2.4));
    if (!living.length) return;
    const p = living.sort(
      (a, b) =>
        Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z),
    )[0];
    // Free roaming starts peacefully. Explicitly drawing a weapon (including
    // an attack shortcut) starts practice; story combat keeps its existing rules.
    if(this.freeExploration&&this.visibleRoles.every(r=>this.state.players[r].weaponDrawn===false)){
      e.state='idle';e.telegraphs=[];e.timer=Math.max(.8,e.timer);return;
    }
    const dist = Math.hypot(p.x - e.x, p.z - e.z),
      aggro = e.boss ? 18 : 11;
    const definition = e.boss
      ? this.chapter.encounters.find((def) => e.id.startsWith(def.id + "-"))
      : undefined;
    const phases = definition?.phases;
    const hpPhase = phases
      ? phases.reduce(
          (phase, def, index) =>
            e.hp / e.maxHp <= def.threshold ? index + 1 : phase,
          1,
        )
      : 1;
    if (e.boss && hpPhase > e.phase) {
      e.phase = hpPhase;
      e.telegraphs = [];
      e.state = "chase";
      e.timer = 0.7;
      const phase = phases?.[e.phase - 1];
      this.emit(
        "message",
        e.x,
        e.z,
        phase ? phase.label + " · " + phase.hint : "留意新的攻击预兆！",
      );
      if (phase?.pattern === "summon") {
        // One stable summon batch per phase, so reconnects and repeated ticks
        // cannot create another wave after the first one has been defeated.
        const id = e.id + "-phase-" + e.phase + "-guard";
        if (
          !this.state.enemies.some((enemy) => enemy.id.startsWith(id + "-"))
        ) {
          const point = this.resolve(e.x - 3, e.z + 3);
          this.state.enemies.push(
            ...this.spawn({
              id,
              kind: "sprite",
              x: point.x,
              z: point.z,
              count: 2,
              name: "星叶回声",
            }),
          );
          this.emit(
            "message",
            e.x,
            e.z,
            "守卫呼来了两束星叶回声。先为伙伴清出空间。",
          );
          this.dirty = true;
        }
      }
    }
    if (dist > aggro && e.state === "idle") return;
    this.dragonAnchorPulse(e);
    e.timer -= dt;
    if (e.state === "warning") {
      const pending: Telegraph[] = [];
      for (const mark of e.telegraphs) {
        mark.delay -= dt;
        if (mark.delay > 0) {
          pending.push(mark);
          continue;
        }
        for (const target of living) {
          if (
            Math.hypot(target.x - mark.x, target.z - mark.z) < mark.r &&
            target.invincible <= 0 &&
            this.damageReaches(target, e.pattern, mark)
          ) {
            const covered = e.pattern === "storm" && target.grounded && (this.chapter.terrain.shelters ?? []).some(shelter =>
              Math.hypot(target.x-shelter.x,target.z-shelter.z) < shelter.radius - PLAYER_RADIUS);
            if (covered) { this.emit("shelter",target.x,target.z,"石翼挡住了星暴",undefined,target.y+.6); continue; }
            const damage = e.boss
              ? e.pattern === "volley"
                ? 18
                : e.pattern === "storm"
                  ? 20
                  : 24
              : e.elite
                ? 18
                : 12;
            if (this.freeExploration) continue;
            target.hp = Math.max(0, target.hp - damage);
            target.action = target.hp ? "hit" : "down";
            target.actionTime = 0.3;
            target.sprinting = false;
            target.invincible = 0.55;
            this.emit("damage", target.x, target.z, undefined, damage, target.y + .7);
          }
        }
        this.emit("impact", mark.x, mark.z, undefined, mark.r);
      }
      e.telegraphs = pending;
      if (!pending.length) {
        e.state = "attack";
        e.timer = ["slam", "tail", "storm"].includes(e.pattern)
          ? 1.4
          : e.pattern === "volley"
            ? 0.8
            : 1.05;
      }
      return;
    }
    if (e.state === "attack") {
      if (e.exposed > 0) return;
      if (e.timer <= 0 && !e.recoveryUsed) {
        const duration = this.chapterRecoveryWindow(e);
        if (duration > 0) {
          e.recoveryUsed = true; e.exposed = duration; e.timer = duration;
          this.emit("weakness", e.x,e.z,undefined,duration);
          this.emit("message",e.x,e.z,this.chapter.index === 4
            ? "三盏纪念灯唤回了誓言。骑士放下长枪：现在反击！"
            : "日月镜照出了真实的影子。伯爵短暂失去护影：现在反击！");
          return;
        }
      }
      // A charge traverses its telegraphed lane; it never teleports to a player's centre.
      if (e.pattern === "charge" && e.timer > 0.65) {
        const dx = e.targetX - e.x, dz = e.targetZ - e.z, distance = Math.hypot(dx, dz);
        if (distance > 0.01) {
          const travel = Math.min(distance, 20 * dt);
          this.moveEntity(e, dx / distance * travel, dz / distance * travel);
        }
      }
      if (e.timer <= 0) {
        e.state = "chase";
        e.timer = e.boss ? 0.45 : 0.8;
      }
      return;
    }
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
    const phase = phases?.[e.phase - 1];
    const pattern =
      phase?.pattern ??
      (e.kind === "sprite"
        ? "volley"
        : ["wolf", "bat"].includes(e.kind)
          ? "charge"
          : "slam");
    const range =
      pattern === "breath" || pattern === "volley" || pattern === "storm"
        ? 10
        : pattern === "charge"
          ? 7.5
          : pattern === "tail"
            ? 6
            : PLAYER_RADIUS + enemyRadius(e) + 1.35;
    if (dist < range && e.timer <= 0) {
      e.state = "warning";
      e.pattern = pattern;
      e.attackSerial++;
      e.recoveryUsed = false; e.exposed = 0;
      const lead = e.boss ? 1.15 : 1.0;
      const mark = (
        x: number,
        z: number,
        r: number,
        delay: number,
      ): Telegraph => {
        const point = this.resolve(x, z);
        return { x: point.x, z: point.z, r, delay, height: ["slam","summon"].includes(pattern) ? "ground" : "body" };
      };
      e.targetX = p.x;
      e.targetZ = p.z;
      switch (pattern) {
        case "breath":
          e.telegraphs = [2.5, 5, 7.5].map((distance, i) =>
            mark(
              e.x + Math.sin(e.yaw) * distance,
              e.z + Math.cos(e.yaw) * distance,
              1.7 + i * 0.35,
              lead + i * 0.16,
            ),
          );
          break;
        case "tail":
          e.targetX = e.x;
          e.targetZ = e.z;
          e.telegraphs = [mark(e.x, e.z, 5.3, 1.35)];
          break;
        case "charge":
          e.telegraphs = [0.33, 0.66, 1].map((t) =>
            mark(
              e.x + (p.x - e.x) * t,
              e.z + (p.z - e.z) * t,
              e.boss ? 1.9 : 1.6,
              lead,
            ),
          );
          break;
        case "volley":
          e.telegraphs = Array.from({ length: e.boss ? 3 : 2 }, (_, i) => {
            const target = living[i % living.length];
            return mark(
              target.x + (i === 2 ? 1.2 : 0),
              target.z,
              2.0,
              lead + i * 0.36,
            );
          });
          break;
        case "storm":
          e.telegraphs = Array.from({ length: 5 }, (_, i) => {
            if (i < living.length) {
              const target = living[i];
              return mark(target.x, target.z, 2.35, lead + i * 0.3);
            }
            const angle = e.attackSerial * 0.7 + (i * Math.PI * 2) / 3;
            return mark(
              e.x + Math.sin(angle) * 6,
              e.z + Math.cos(angle) * 6,
              2.6,
              lead + i * 0.3,
            );
          });
          break;
        case "summon":
          // Summoned guards supply ranged pressure; the summoner leaves a generous
          // local warning and recovery, giving players time to deal with them.
          e.targetX = e.x;
          e.targetZ = e.z;
          e.telegraphs = [mark(e.x, e.z, 3.0, 1.3)];
          break;
        case "slam":
        default:
          e.targetX = e.x;
          e.targetZ = e.z;
          e.telegraphs = [
            mark(e.x, e.z, e.boss ? 4.2 : 2.5, e.boss ? 1.25 : 1.0),
          ];
          break;
      }
      e.timer = Math.max(...e.telegraphs.map((mark) => mark.delay));
      const hints: Record<string, string> = {
        breath: "龙息 · 离开前方连续金圈",
        tail: "扫尾 · 退到大圈之外",
        charge: "冲锋 · 向预兆两侧闪避",
        volley: "星光连射 · 依次离开落点",
        storm: "星暴 · 寻找圆圈之间的空隙",
        summon: "树根低波 · 起跳越过细环，先清理星叶回声",
        slam: "贴地震波 · 起跳越过细环或闪避后反击",
      };
      this.emit(
        "warning",
        e.targetX,
        e.targetZ,
        e.boss ? hints[pattern] : undefined,
      );
      return;
    }
    e.state = "chase";
    if (dist > Math.max(PLAYER_RADIUS + enemyRadius(e) + 0.12, range * 0.68)) {
      const speed = e.boss
        ? 1.6 + (e.phase - 1) * 0.12
        : e.kind === "wolf"
          ? 2.7
          : e.kind === "zombie"
            ? 1.2
            : 2;
      this.moveEntity(e, Math.sin(e.yaw) * speed * dt, Math.cos(e.yaw) * speed * dt);
    }
  }
  private chapterRecoveryWindow(e: Enemy) {
    if (!e.boss || this.mode !== "adventure") return 0;
    const flags = this.state.flags;
    if (this.chapter.index === 4 && ["g-lantern-gardener","g-lantern-singer","g-lantern-king"].every(id => flags.includes(id))) return 2;
    if (this.chapter.index === 5 && ["c-plate-sun","c-plate-moon"].every(id => flags.includes(id))) return 1.8;
    return 0;
  }
  private dragonAnchorPulse(e: Enemy) {
    if (this.mode !== "adventure" || this.chapter.index !== 7 || !e.boss) return;
    const anchor = ["d-anchor-home","d-anchor-memory","d-anchor-life"][e.phase-1];
    if (!anchor || !this.state.flags.includes(anchor)) return;
    const flag = anchor+"-resonance";
    if (this.state.flags.includes(flag)) return;
    this.state.flags.push(flag);
    for (const role of roles) {
      const p = this.state.players[role];
      if (p.hp > 0) { p.hp = Math.min(p.maxHp,p.hp+12); p.buff = Math.max(p.buff,2.5); }
    }
    const it = this.chapter.interactions.find(i=>i.id===anchor)!;
    this.emit("heal",it.x,it.z,"锚点的回声为两位伙伴恢复星光");
    this.emit("message",e.x,e.z,["家园锚点回应了龙息。两地的光正在一起托住你们。","记忆锚点回应了扫尾。它守护家园的记忆，也成为你们的力量。","生命锚点回应了星暴。生命树没有被夺走，正在重新发芽。"][e.phase-1]);
    this.dirty = true;
  }
  private damageReaches(p: Player, pattern: string, mark: Telegraph) {
    // Only explicitly signposted thin ground waves can be jumped. Ranged/overhead
    // attacks cover the whole jump arc; dodging retains its timed invulnerability.
    const height = ["slam","summon"].includes(pattern) ? .38 : pattern === "tail" ? 1.35 : pattern === "charge" ? 2 : 6;
    const floor = this.groundY(mark.x,mark.z,p.y + STEP_HEIGHT);
    return p.y < floor + height && p.y + PLAYER_HEIGHT > floor;
  }
  private interactionContext() { return {state:this.state,world:this.movementWorld,chapter:this.chapter,mode:this.mode,availableRegions:this.availableRegions}; }
  private onInteractionSurface(p:Player,item:Interaction) { return onInteractionSurface(this.interactionContext(),p,item); }
  private onConnectionSurface(p:Player,connection:ReturnType<typeof regionConnections>[number]) { return onConnectionSurface(this.interactionContext(),p,connection); }
  private interactionTarget(p:Player) { return selectInteractionTarget(this.interactionContext(),p); }
  private interact(r: DogRole) {
    const p=this.state.players[r],other=this.state.players[r==='gold'?'white':'gold'];
    if (!p.grounded) return;
    if(fieldFind(this.fieldContext(),r)){this.dirty=true;return;}
    if (this.mode==='adventure'&&other.hp<=0&&Math.hypot(p.x-other.x,p.z-other.z)<3) {
      p.action='revive';p.actionTime=2.5;this.emit('message',p.x,p.z,'正在扶起伙伴…');return;
    }
    const furniture=nearbyHomeUse(this.state.regionId,p,this.movementWorld);
    if(furniture){this.beginHomeUse(r,furniture.id);return;}
    const {connection:nearestDoor,item}=this.interactionTarget(p);
    if(nearestDoor){this.requestTravel(r,nearestDoor.to,'walk');return;}
    const field=item&&FIELD_NODES.find(n=>n.id===item.id);
    if(field){useFieldNode(this.fieldContext(),r,field);this.dirty=true;return;}
    const journey=item&&journeyNodes(this.state.regionId).find(n=>n.id===item.id);
    if(journey){this.interactJourney(r,journey);return;}
    if(!item){const animal=nearbyAnimal(this.state,this.movementWorld,r);if(animal){this.command(r,{x:0,z:0,actions:[],animal:{id:animal.id,kind:'greet'}});return;}}
    if(item&&this.state.flags.includes(item.id)){
      const reply=residentReply(item,this.chapter,this.state.flags);
      if(reply){p.action='interact';p.actionTime=.6;this.emit('dialogue',item.x,item.z,reply);}
      return;
    }
    if(!isStoryRegion(this.state.regionId)){
      const it=item;
      if(it){this.emit('dialogue',it.x,it.z,it.text);if(!this.state.flags.includes(it.id))this.state.flags.push(it.id);this.dirty=true;}
      return;
    }
    if (this.freeExploration) {
      if (item) {
        p.action = "interact";
        p.actionTime = 0.6;
        this.emit(
          "message",
          item.x,
          item.z,
          "探索预览 · " +
            item.label +
            "。这里的故事留待两位伙伴一起经历；没有提交任务或发放奖励。",
        );
      }
      return;
    }
    const it = item;
    if (!it) return;
    if (it.afterBoss && this.state.enemies.some(e=>e.boss&&e.hp>0)) {
      this.emit("message",p.x,p.z,"巨龙仍紧张地守着生命树。先接通锚点，让它平静下来。"); return;
    }
    if (it.id === "d-homeward-light" && (!this.chapter.quest.steps.every(id=>this.state.flags.includes(id)) ||
        other.hp <= 0 || !other.grounded || Math.hypot(other.x-it.x,other.z-it.z)>7)) {
      this.emit("message",p.x,p.z,"三座锚点需要先接通。请和伙伴一起站到分流台旁，把光送向两个家园。"); return;
    }
    const steps =
        it.questRole === "side"
          ? this.chapter.quest.side.steps
          : this.chapter.quest.steps,
      idx = steps.indexOf(it.id);
    if (
      idx > 0 &&
      !steps.slice(0, idx).every((id) => this.state.flags.includes(id))
    ) {
      this.emit("message", p.x, p.z, "这里的星光还在沉睡。先寻找上一条线索。");
      return;
    }
    if (
      it.requiresClear &&
      this.state.enemies.some(
        (e) => e.hp > 0 && Math.hypot(e.x - it.x, e.z - it.z) < 10 &&
          !(e.boss && ["g-lantern-king","c-star-channel","d-anchor-life"].includes(it.id)),
      )
    ) {
      this.emit("message", p.x, p.z, "先帮这里的居民驱散附近的阴影。");
      return;
    }
    this.complete(it);
    p.action = "interact";
    p.actionTime = 0.6;
  }
  private syncJourneyWorld() {
    // This is a one-way world change. Unlike rotating dials it is safe to mirror
    // as a flag so the existing renderer and shared collision see the same bridge.
    if(this.state.regionId==='ch02-windmill-river'&&journeyEntry(this.state.journeys,'river-levels').stage>=2&&!this.state.flags.includes('journey-river-footway'))this.state.flags.push('journey-river-footway');
    for(const node of journeyNodes(this.state.regionId))if(node.id.endsWith('-memory')&&journeyEntry(this.state.journeys,node.journeyId).known.includes(node.id)&&!this.state.flags.includes(node.id))this.state.flags.push(node.id);
    if(this.mode==='adventure')for(const [id,e]of Object.entries(this.state.journeys.entries))if(e.completed)this.save.quests['journey-'+id]=true;
  }
  private interactJourney(role:DogRole,node:JourneyNode) {
    const p=this.state.players[role],other=this.state.players[role==='gold'?'white':'gold'];
    const context={endingRestored:this.mode==='adventure'&&(this.save.completedChapters.includes(CHAPTERS.at(-1)!.id)||this.save.quests['d-homeward-light']===true)};
    let result=useJourney(this.state.journeys,node,false,context);
    if(result.confirmation){
      const pending=this.state.journeyProposal;
      if(this.mode==='exploration')result=useJourney(result.progress,node,true,context);
      else if(other.hp<=0||!this.onInteractionSurface(other,node)||Math.hypot(other.x-node.x,other.z-node.z)>6){this.emit('message',node.x,node.z,'请和伙伴一起站到机关旁，再分别按 E。当前读数与线索都保留。');return;}
      else if(pending?.nodeId===node.id&&pending.revision===this.state.journeys.revision&&pending.proposer!==role&&pending.expiresAt>=this.state.time)result=useJourney(this.state.journeys,node,true,context);
      else{
        if(result.changed){this.state.journeys=result.progress;this.dirty=true;}
        this.state.journeyProposal={journeyId:node.journeyId,nodeId:node.id,proposer:pending?.nodeId===node.id?pending.proposer:role,revision:this.state.journeys.revision,expiresAt:pending?.nodeId===node.id?pending.expiresAt:this.state.time+20};
        p.action='interact';p.actionTime=.6;this.emit('message',node.x,node.z,result.text);return;
      }
    }
    if(result.changed){this.state.journeys=result.progress;delete this.state.journeyProposal;this.syncJourneyWorld();this.dirty=true;}
    p.action='interact';p.actionTime=.6;
    this.emit('dialogue',node.x,node.z,result.text);
    // Every physical strike keeps its own note, including the last correct note
    // that also opens the reply box and produces a discovery response.
    if(node.tone!==undefined)this.emit('journey-chime',node.x,node.z,undefined,node.tone);
    if(result.completedNow&&node.journeyId==='last-bell')this.emit('castle-bell',node.x,node.z);
    if(result.effect&&result.effect!=='chime')this.emit(result.effect==='water'?'journey-water':'discover',node.x,node.z);
    if(result.completedNow&&this.mode==='adventure')this.emit('message',node.x,node.z,'这段共同经历已记入旅途手记。');
  }
  private complete(it: Interaction) {
    if (this.mode !== "adventure") return;
    if (this.state.flags.includes(it.id)) return;
    this.state.flags.push(it.id);
    this.save.quests[it.id] = true;
    this.emit("message", it.x, it.z, it.text);
    this.emit("discover", it.x, it.z, it.label);
    this.reward(it.reward);
    if (
      this.chapter.secrets.some((s) => s.id === it.id) &&
      !this.save.secrets.includes(it.id)
    )
      this.save.secrets.push(it.id);
    if (this.chapter.quest.steps.includes(it.id)) {
      this.state.checkpoint = { x: it.x, z: it.z };
      this.save.checkpointId = it.id;
    }
    const side = this.chapter.quest.side;
    if (
      side.steps.every((id) => this.state.flags.includes(id)) &&
      !this.state.flags.includes(side.id)
    ) {
      this.state.flags.push(side.id);
      this.save.quests[side.id] = true;
      this.reward(side.reward);
      this.emit("message", it.x, it.z, side.ending);
    }
    this.dirty = true;
  }
  private reward(reward?: {
    weapon?: string;
    skill?: string;
    skin?: string;
    xp?: number;
  }) {
    if (this.mode !== "adventure" || !reward) return;
    for (const r of roles) {
      const p = this.save.players[r];
      if (reward.weapon && !p.unlockedEquipment.includes(reward.weapon))
        p.unlockedEquipment.push(reward.weapon);
      if (reward.skill && !p.unlockedSkills.includes(reward.skill))
        p.unlockedSkills.push(reward.skill);
      if (reward.skin && !p.unlockedSkins.includes(reward.skin))
        p.unlockedSkins.push(reward.skin);
    }
    if (reward.weapon || reward.skill || reward.skin)
      this.emit("unlock", 0, 0, "新的装备或外观已收进冒险背包");
  }
  private triggers(dt: number) {
    if (this.mode !== "adventure"||this.state.regionId!==this.state.chapterId) return;
    const s = this.state,
      e = this.chapter.event;
    if (s.ended) return;
    if (
      !s.flags.includes(e.id) &&
      (this.chapter.index !== 4 || s.flags.includes("g-lantern-gardener")) &&
      roles.some(
        (r) =>
          Math.hypot(
            s.players[r].x - e.trigger.x,
            s.players[r].z - e.trigger.z,
          ) < e.trigger.radius && (e.trigger.y==null||Math.abs(s.players[r].y-e.trigger.y)<2.5),
      )
    ) {
      s.flags.push(e.id);
      s.enemies.push(...e.spawns.flatMap((v) => this.spawn(v)));
      this.save.quests[e.id] = true;
      this.emit("message", e.trigger.x, e.trigger.z, e.description);
      this.dirty = true;
    }
    if (
      s.flags.includes(e.id) &&
      !s.flags.includes(e.id + "-resolved") &&
      e.spawns.every((v) =>
        s.enemies
          .filter((en) => en.id.startsWith(v.id + "-"))
          .every((en) => en.hp <= 0),
      )
    ) {
      s.flags.push(e.id + "-resolved");
      this.save.quests[e.id + "-resolved"] = true;
      this.reward(e.reward);
      this.emit("message", e.trigger.x, e.trigger.z, e.resolution);
      this.dirty = true;
    }
    const plates = this.chapter.interactions.filter(
      (i) => i.kind === "plate" && !s.flags.includes(i.id),
    );
    if (plates.length === 2 && plates[0].pair === plates[1].pair) {
      const firstStep = Math.min(
        ...plates.map((i) => this.chapter.quest.steps.indexOf(i.id)),
      );
      const ready =
        this.chapter.quest.steps
          .slice(0, firstStep)
          .every((id) => s.flags.includes(id)) &&
        plates.every(
          (i) =>
            !i.requiresClear ||
            !s.enemies.some(
              (en) => en.hp > 0 && Math.hypot(en.x - i.x, en.z - i.z) < 10,
            ),
        );
      const stands = (role: DogRole, plate: Interaction) =>
        s.players[role].hp > 0 &&
        Math.hypot(s.players[role].x - plate.x, s.players[role].z - plate.z) < 1.6 &&
        this.onInteractionSurface(s.players[role],plate);
      const both =
        ready &&
        ((stands("gold", plates[0]) && stands("white", plates[1])) ||
          (stands("gold", plates[1]) && stands("white", plates[0])));
      s.coop = both ? s.coop + dt : 0;
      if (s.coop > 1.5) {
        plates.forEach((i) => this.complete(i));
        s.coop = 0;
      }
    } else s.coop = 0;
    const complete =
      this.chapter.quest.steps.every((id) => s.flags.includes(id)) &&
      s.enemies.filter((en) => en.boss).every((en) => en.hp <= 0);
    if (
      complete &&
      (this.chapter.index !== 7 || s.flags.includes("d-homeward-light") || this.save.completedChapters.includes(this.chapter.id)) &&
      roles.every(
        (r) =>
          s.players[r].hp > 0 && s.players[r].grounded &&
          Math.hypot(
            s.players[r].x - this.chapter.exit.x,
            s.players[r].z - this.chapter.exit.z,
          ) < 5,
      )
    ) {
      const finishedIndex=this.chapter.index;
      const firstCompletion=!this.save.completedChapters.includes(this.chapter.id);
      if(firstCompletion)this.save.completedChapters.push(this.chapter.id);
      if(firstCompletion)this.reward({
        skin: this.chapter.index >= 4 ? "moon" : "forest",
        weapon: this.chapter.index >= 2 ? "chime" : "bow",
        skill: this.chapter.index >= 3 ? "shield" : "nova",
      });
      const next = CHAPTERS[CHAPTERS.indexOf(this.chapter) + 1];
      if (next) {
        this.changeRegion(next.id,{...next.spawn},true);
        this.save.checkpointId = next.id + "-camp";
        this.emit("chapter", next.spawn.x, next.spawn.z, next.title);
      } else if (!s.ended) {
        s.ended = true;
        this.emit(
          "ending",
          this.chapter.exit.x,
          this.chapter.exit.z,
          "星光回到了每一个需要它的家。",
        );
      }
      this.dirty = true;
      if(this.storiesEnabled&&this.state.story){
        queueStory(this.state.story,STORY_EXIT[finishedIndex-1]);
        if(finishedIndex===3)queueStory(this.state.story,STORY_IDS[4]);
        this.resetMovement(true);
      }
    }
  }
  private safePosition(p: Player) {
    if(this.state.regionId===BEACH&&p.swim!=='land'&&beachSwimmingLegal(p.x,p.y,p.z))return{x:p.x,y:p.y,z:p.z};
    if(this.state.regionId===UNDERSEA)return underseaLegal(p.x,p.y,p.z)?{x:p.x,y:p.y,z:p.z}:underseaLegal(p.safeX,p.safeY,p.safeZ)?{x:p.safeX,y:p.safeY,z:p.safeZ}:underseaPair(p.role);
    if(p.homeUse)return {...p.homeUse.exit};
    const surface = standingSurface(this.movementWorld,p.x,p.z,p.y + STEP_HEIGHT,PLAYER_RADIUS);
    if (p.grounded && surface && (!this.movementWorld.canSaveAt||this.movementWorld.canSaveAt(p.x,p.z,surface.y)) && (!this.movementWorld.isSafe || this.movementWorld.isSafe(p.x,p.z,surface.y,PLAYER_RADIUS)))
      return { x:p.x, y:surface.y, z:p.z };
    return { x:p.safeX, y:p.safeY, z:p.safeZ };
  }
  private persistedSnapshot(): Snapshot {
    const snapshot = structuredClone(this.state);
    // Progress belongs to the enclosing durable save; never nest a duplicate copy.
    delete snapshot.progress;delete snapshot.inputAcks;delete snapshot.pet;delete snapshot.golden;delete snapshot.homePets;
    delete snapshot.animalCare;snapshot.events=snapshot.events.filter(e=>!e.type.startsWith('animal-'));
    delete snapshot.travel;delete snapshot.regionLoad;
    delete snapshot.journeyProposal;
    delete snapshot.duo;
    delete snapshot.fieldPlay;
    for (const role of roles) {
      const p = snapshot.players[role], position = this.safePosition(this.state.players[role]);
      delete p.homeUse;
      if(this.state.regionId===BEACH&&this.state.players[role].swim!=='land'&&beachSwimmingLegal(position.x,position.y,position.z)){Object.assign(p,position,{safeX:position.x,safeY:position.y,safeZ:position.z,swim:position.y+1.5<-.01?'underwater':'surface',waterId:BEACH_WATER,grounded:false,mounted:false,flight:'grounded',vy:0,vx:0,vz:0,speed:0,sprinting:false,landing:0,action:position.y+1.5<-.01?'dive':'swim',actionTime:0});continue;}
      if(this.state.regionId===UNDERSEA){Object.assign(p,position,{safeX:position.x,safeY:position.y,safeZ:position.z,swim:'underwater',waterId:'atlantis-water',grounded:false,mounted:false,flight:'grounded',vy:0,vx:0,vz:0,speed:0,sprinting:false,landing:0,action:'dive',actionTime:0});continue;}
      Object.assign(p,position,{safeX:position.x,safeY:position.y,safeZ:position.z,vy:0,grounded:true,sprinting:false,speed:0,landing:0,mounted:false,flight:'grounded',swim:'land',vx:0,vz:0});delete p.waterId;
      if (p.hp > 0) { p.action = "idle"; p.actionTime = 0; }
    }
    return snapshot;
  }
  exportLiveSnapshot(): Snapshot {
    if (this.mode === 'exploration') throw new Error('单人探索不能提交双人冒险快照');
    const progress = snapshotProgress({...this.save, chapterId:this.state.chapterId,world:{...this.save.world,regionProgress:{discoveredRegions:this.state.discoveredRegions,broomOwned:this.state.broomOwned}}});
    const inputAcks=Object.fromEntries(Object.entries(this.inputStamps).map(([role,v])=>[role,{...v.stamp,applied:Math.min(1.5,Math.max(0,this.state.time-v.at))}]));
    return {...structuredClone(this.state),progress,inputAcks};
  }
  /** In-memory reconnect keeps legal immersion; permanent saves still use shore anchors. */
  exportResumeSave():AdventureSave {
    const save=this.exportSave(),snapshot=save.world.snapshot as unknown as Snapshot;
    for(const role of roles){const live=this.state.players[role];if(live.swim!=='land')snapshot.players[role]={...structuredClone(live),speed:0,sprinting:false,vy:0,vx:0,vz:0,action:live.swim==='underwater'?'dive':'swim',actionTime:0};}
    return save;
  }
  exportSave(): AdventureSave {
    if (this.mode === "exploration")
      throw new Error("单人探索不能提交双人冒险存档；请导出独立探索记录");
    this.save.chapterId = this.state.chapterId;
    this.save.world = {
      ...this.save.world,
      snapshot: this.persistedSnapshot() as any,
      pet:petIntent(this.state.pet),
      golden:goldenIntent(this.state.golden),
      homePets:persistentHomePets(this.state.homePets) as any,
      regionProgress:{discoveredRegions:[...this.state.discoveredRegions],broomOwned:this.state.broomOwned},
      fieldbook:structuredClone(this.state.fieldbook) as unknown as import('../shared/save').JsonObject,
      journeys:structuredClone(this.state.journeys) as unknown as import('../shared/save').JsonObject,
    };
    this.save.updatedAt = new Date().toISOString();
    const result = structuredClone(this.save);result.mode=this.mode;
    if (this.mode === 'coop-exploration') for (const r of roles) Object.assign(result.players[r], {unlockedEquipment:[], unlockedSkills:[], unlockedSkins:[], inventory:[]});
    return result;
  }
  exportExploration(
    options: {
      camera?: Partial<ExplorationCamera>;
      preferences?: Partial<ExplorationPreferences>;
    } = {},
  ): ExplorationSave {
    if (this.mode !== "exploration" || !this.explorationRecord)
      throw new Error("双人冒险不能写入单人探索记录");
    const p = this.state.players[this.controlledRole];
    const position = this.safePosition(p);
    const result: ExplorationSave = {
      ...structuredClone(this.explorationRecord),
      regionId: this.state.regionId,
      homeLights:this.state.homeLights!==false,
      pet:petIntent(this.state.pet),
      golden:goldenIntent(this.state.golden),
      homePets:persistentHomePets(this.state.homePets) as any,
      fieldbook:structuredClone(this.state.fieldbook),
      journeys:structuredClone(this.state.journeys),
      discoveredRegions:[...this.state.discoveredRegions],
      position: { x: position.x, y: position.y, z: position.z, yaw: p.yaw },
      updatedAt: new Date().toISOString(),
      camera: { ...this.explorationRecord.camera, ...options.camera },
      preferences: {
        ...this.explorationRecord.preferences,
        ...options.preferences,
      },
      loadouts: {
        gold: {
          weaponId: this.state.players.gold.weapon,
          weaponDrawn:this.state.players.gold.weaponDrawn!==false,
          skinId: this.state.players.gold.skin,
          skillIds: [...this.state.players.gold.skills],
        },
        white: {
          weaponId: this.state.players.white.weapon,
          weaponDrawn:this.state.players.white.weaponDrawn!==false,
          skinId: this.state.players.white.skin,
          skillIds: [...this.state.players.white.skills],
        },
      },
    };
    this.explorationRecord = validateExplorationSave(result);
    return structuredClone(this.explorationRecord);
  }
  setExplorationRegion(regionId: string) {
    if(this.mode!=='exploration')throw new Error('双人区域移动必须通过合作冒险，由伙伴确认');
    const id=canonicalRegion(regionId);
    if(!id||!this.explorationRegions.includes(id))throw new Error('此区域尚未在双人冒险中解锁');
    // Legacy public menu adapter. The formal map uses requestTravel, which requires discovery.
    this.changeRegion(id,{...getRegion(id)!.spawn});
  }
  get nearby() { return (r:DogRole)=>nearbyInteraction(this.interactionContext(),r); }
}
