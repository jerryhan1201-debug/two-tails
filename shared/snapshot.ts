import {UNDERSEA} from './undersea';
import {SWIM_RADIUS,SWIM_HEIGHT} from './swimming';
import {validSwimming} from './swimming';
import {validHomePetStates,type HomePetStates} from './home-pets';
import {validGoldenState,type GoldenState} from './golden';
import {validPetState,type PetState} from './pet';
import {validAnimalCare,type AnimalCare} from './animal-care';
import {validInputAcks,type InputAcks} from './input-ack';
import {validRegionLoad,type RegionLoad} from './region-load';
import {validHomeUse,type HomeUse} from './home-use';
import {validateFieldBook,validateFieldPlay,type FieldBook,type FieldPlay} from './fieldbook';
import { validateRegionProgress, type TravelProposal } from './regions';
import { validateJourneys, validateJourneyProposal, type JourneyProgress, type JourneyProposal } from './journeys';
import { validateSnapshotProgress, type SnapshotProgress } from './progress';
import {validateStory, resetStoryVotes, type StoryProgress} from './story';
import {validateDuo,type DuoState} from './duo';

/**
 * Content-independent validation for the persisted simulation v1/v2 shapes.
 * Keep unknown content IDs/extension fields intact. A future snapshot version
 * must provide an explicit migration instead of being interpreted as v1.
 */
export interface SnapshotPlayerShape {
  swim?:import('./swimming').SwimMode;waterId?:string;
  homeUse?:HomeUse;
  role: "gold" | "white";
  mounted?:boolean;
  flight?:'grounded'|'flying'|'landing';
  vx?:number;
  vz?:number;
  y?: number;
  vy?: number;
  grounded?: boolean;
  sprinting?: boolean;
  safeX?: number;
  safeY?: number;
  safeZ?: number;
  landing?: number;
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
export interface SnapshotEnemyShape {
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
  telegraphs?: { x: number; z: number; r: number; delay: number; height?: "ground" | "body" }[];
  attackSerial?: number;
  exposed?: number;
  recoveryUsed?: boolean;
}
export interface SnapshotEventShape {
  y?: number;
  id: number;
  type: string;
  x: number;
  z: number;
  text?: string;
  value?: number;
}
export interface SnapshotShape {
  animalCare?:AnimalCare;
  pet?:PetState;
  golden?:GoldenState;
  homePets?:HomePetStates;
  inputAcks?:InputAcks;
  regionLoad?:RegionLoad;
  fieldbook?:FieldBook;
  fieldPlay?:FieldPlay;
  duo?:DuoState;
  homeLights?:boolean;
  mode?: import('./modes').RoomMode;
  story?:StoryProgress;
  v: 1 | 2;
  progress?: SnapshotProgress;
  chapterId: string;
  regionId?:string;
  discoveredRegions?:string[];
  broomOwned?:boolean;
  travel?:TravelProposal;
  journeys?:JourneyProgress;
  journeyProposal?:JourneyProposal;
  regionArchive?:Record<string, RegionArchiveShape>;
  time: number;
  players: { gold: SnapshotPlayerShape; white: SnapshotPlayerShape };
  enemies: SnapshotEnemyShape[];
  flags: string[];
  events: SnapshotEventShape[];
  ended: boolean;
  coop: number;
  checkpoint: { x: number; z: number };
  eventSerial: number;
}

export interface RegionArchiveShape {
 chapterId:string;flags:string[];enemies:SnapshotEnemyShape[];checkpoint:{x:number;z:number};ended:boolean;
}

type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const nonnegative = (value: unknown): value is number =>
  finite(value) && value >= 0;
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const boundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const owns = (value: RecordValue, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
function fail(detail: string): never {
  throw new Error(`存档场景快照损坏：${detail}。请恢复有效备份`);
}
const numberFields = (
  value: RecordValue,
  keys: string[],
  nonnegativeOnly = false,
) => keys.every((key) => (nonnegativeOnly ? nonnegative : finite)(value[key]));

/** Throws before any persistence or simulation mutation; never coerces strings. */
export function validateSnapshotShape(
  value: unknown,
): asserts value is SnapshotShape {
  if (!object(value) || (value.v !== 1 && value.v !== 2)) fail("场景版本无效");
  if(owns(value,'homePets')&&!validHomePetStates(value.homePets))fail('家园宠物状态无效');
  if(owns(value,'golden')&&!validGoldenState(value.golden))fail('金毛安排状态无效');
  if(owns(value,'pet')&&!validPetState(value.pet))fail('宠物状态无效');
  if(owns(value,'animalCare')&&(!validAnimalCare(value.animalCare)||value.animalCare.regionId!==value.regionId||value.animalCare.reactions.some(r=>r.start>Number(value.time)+.1)))fail('动物互动状态无效');
  if(owns(value,'fieldbook'))validateFieldBook(value.fieldbook);
  if(owns(value,'fieldPlay')){validateFieldPlay(value.fieldPlay);if(value.fieldPlay.regionId!==value.regionId)fail('探索活动区域不一致');}
  if(owns(value,'homeLights')&&typeof value.homeLights!=='boolean')fail('家园灯光状态无效');
  if(owns(value,'duo')){validateDuo(value.duo);if(value.duo.regionId!==value.regionId)fail('互动区域不一致');}
  if(owns(value,'story'))validateStory(value.story);
  if(owns(value,'regionId')&&!id(value.regionId))fail('区域身份无效');
  let journeyRevision:number|undefined;
  if(owns(value,'journeys')){validateJourneys(value.journeys);journeyRevision=value.journeys.revision;}
  if(owns(value,'journeyProposal')){validateJourneyProposal(value.journeyProposal);if(journeyRevision===undefined||value.journeyProposal.revision!==journeyRevision)fail('支线合作确认已失效');}
  if(owns(value,'discoveredRegions')||owns(value,'broomOwned'))validateRegionProgress({discoveredRegions:value.discoveredRegions,broomOwned:value.broomOwned});
  if(owns(value,'inputAcks')&&!validInputAcks(value.inputAcks))fail('输入确认无效');
  if(owns(value,'regionLoad')&&!validRegionLoad(value.regionLoad))fail('区域准备状态无效');
  if(owns(value,'travel')){const t=value.travel;if(!object(t)||!integer(t.id,1)||!id(t.from)||!id(t.to)||!['map','walk','fly'].includes(t.method as string)||!['gold','white'].includes(t.proposer as string)||!finite(t.expiresAt)||(owns(t,'connectionId')&&!id(t.connectionId)))fail('同行邀请无效');}
  if(owns(value,'regionArchive')){
    if(!object(value.regionArchive)||Object.keys(value.regionArchive).length>16)fail('区域历史无效');
    for(const [region,entry]of Object.entries(value.regionArchive)){
      if(!id(region)||!object(entry)||Object.keys(entry).some(k=>!['chapterId','flags','enemies','checkpoint','ended'].includes(k)))fail('区域历史内容无效');
      const check={...value,...entry};delete check.regionArchive;delete check.progress;delete check.travel;delete check.regionLoad;delete check.journeyProposal;
      validateSnapshotShape(check);
    }
  }
  if (value.mode !== undefined && value.mode !== 'adventure' && value.mode !== 'coop-exploration') fail("单人探索快照不能写入双人冒险");
  if (owns(value,'progress')) {
    validateSnapshotProgress(value.progress);
    if (value.progress.chapterId !== value.chapterId) fail('实时进度与场景章节不一致');
  }
  if (
    !id(value.chapterId) ||
    !nonnegative(value.time) ||
    !nonnegative(value.coop) ||
    !integer(value.eventSerial) ||
    typeof value.ended !== "boolean"
  )
    fail("场景基本信息无效");
  if (!object(value.checkpoint) || !numberFields(value.checkpoint, ["x", "z"]))
    fail("检查点坐标无效");
  if (!object(value.players)) fail("缺少双人角色状态");
  for (const role of ["gold", "white"] as const) {
    const player = value.players[role];
    if (!object(player) || player.role !== role) fail("角色身份无效");
    if (
      !numberFields(player, ["x", "z", "yaw"]) ||
      !numberFields(
        player,
        ["hp", "actionTime", "speed", "invincible", "revive", "buff"],
        true,
      ) ||
      !finite(player.maxHp) ||
      player.maxHp <= 0 ||
      (player.hp as number) > player.maxHp
    )
      fail("角色数值无效");
    if(!validSwimming(String(value.regionId??value.chapterId),player as unknown as SnapshotPlayerShape))fail('水陆状态、深度或游泳速度无效');
    if(owns(player,'weaponDrawn')&&typeof player.weaponDrawn!=='boolean')fail('手持武器状态无效');
    if(owns(player,'homeUse')&&(!validHomeUse(player.homeUse)||value.regionId!=='player-home-villa'||player.mounted||value.duo))fail('家居使用状态无效');
    const movementNumbers = ["y","vy","safeX","safeY","safeZ","landing"];
    for (const field of movementNumbers)
      if ((value.v === 2 || owns(player,field)) && !finite(player[field])) fail("角色移动高度无效");
    for (const field of ["grounded","sprinting"])
      if ((value.v === 2 || owns(player,field)) && typeof player[field] !== "boolean") fail("角色移动状态无效");
    if(['mounted','flight','vx','vz'].some(k=>owns(player,k))&&!(typeof player.mounted==='boolean'&&['grounded','flying','landing'].includes(player.flight as string)&&owns(player,'vx')&&owns(player,'vz')))fail('载具状态无效');
    if(player.mounted===true&&(player.grounded!==false||player.flight==='grounded'))fail('载具与落地状态不一致');
    if(player.mounted===false&&player.flight!=='grounded')fail('载具与飞行状态不一致');
    if(owns(player,'flight')&&!['grounded','flying','landing'].includes(player.flight as string))fail('飞行状态无效');
    for(const field of ['vx','vz'])if(owns(player,field)&&!finite(player[field]))fail('飞行速度无效');
    if (owns(player,"landing") && !nonnegative(player.landing)) fail("角色落地状态无效");
    if (!id(player.action) || !id(player.weapon) || !id(player.skin))
      fail("角色动作或装备无效");
    if (
      !Array.isArray(player.cooldowns) ||
      player.cooldowns.length !== 4 ||
      !player.cooldowns.every(nonnegative)
    )
      fail("角色冷却数组无效");
    if (
      !Array.isArray(player.skills) ||
      player.skills.length !== 2 ||
      !player.skills.every(id)
    )
      fail("角色技能数组无效");
  }
  if(value.regionId===UNDERSEA||value.regionId==='studio-tideglass-cove'&&['surface','underwater'].includes(String((value.players.gold as unknown as SnapshotPlayerShape).swim))&&['surface','underwater'].includes(String((value.players.white as unknown as SnapshotPlayerShape).swim))){const a=value.players.gold as unknown as SnapshotPlayerShape,b=value.players.white as unknown as SnapshotPlayerShape;if(a.y!<b.y!+SWIM_HEIGHT-.001&&b.y!<a.y!+SWIM_HEIGHT-.001&&Math.hypot(a.x-b.x,a.z-b.z)<SWIM_RADIUS*2-.025)fail('海底双狗泳体重叠');}
  const uses=Object.values(value.players as Record<string,SnapshotPlayerShape>).map(p=>p.homeUse).filter(Boolean);
  if(uses.length===2&&uses[0]!.id===uses[1]!.id&&uses[0]!.slot===uses[1]!.slot)fail('家居位置重复占用');
  if (!Array.isArray(value.enemies) || value.enemies.length > 512)
    fail("敌人列表无效");
  const enemyIds = new Set<string>();
  for (const enemy of value.enemies) {
    if (
      !object(enemy) ||
      !id(enemy.id) ||
      !id(enemy.kind) ||
      !boundedText(enemy.name, 200) ||
      !enemy.name.length
    )
      fail("敌人基本信息无效");
    if(owns(enemy,"y")&&!finite(enemy.y))fail("敌人楼层无效");
    if (enemyIds.has(enemy.id)) fail("敌人记录重复");
    enemyIds.add(enemy.id);
    if (
      !numberFields(enemy, [
        "x",
        "z",
        "homeX",
        "homeZ",
        "yaw",
        "timer",
        "targetX",
        "targetZ",
      ]) ||
      !nonnegative(enemy.hp) ||
      !finite(enemy.maxHp) ||
      enemy.maxHp <= 0 ||
      enemy.hp > enemy.maxHp ||
      !nonnegative(enemy.hit)
    )
      fail("敌人数值无效");
    if (
      typeof enemy.boss !== "boolean" ||
      typeof enemy.elite !== "boolean" ||
      !integer(enemy.phase, 1) ||
      !id(enemy.pattern) ||
      !["idle", "chase", "warning", "attack", "dead"].includes(
        enemy.state as string,
      )
    )
      fail("敌人动作状态无效");
    if (owns(enemy,"exposed") && !nonnegative(enemy.exposed)) fail("敌人弱点计时无效");
    if (owns(enemy,"recoveryUsed") && typeof enemy.recoveryUsed !== "boolean") fail("敌人反击窗状态无效");
    if (owns(enemy, "attackSerial") && !integer(enemy.attackSerial))
      fail("敌人攻击序号无效");
    if (owns(enemy, "telegraphs")) {
      if (!Array.isArray(enemy.telegraphs) || enemy.telegraphs.length > 64)
        fail("攻击预兆列表无效");
      for (const mark of enemy.telegraphs)
        if (
          !object(mark) ||
          !numberFields(mark, ["x", "z"]) ||
          !finite(mark.r) ||
          mark.r <= 0 ||
          !nonnegative(mark.delay) ||
          (owns(mark,"height") && mark.height !== "ground" && mark.height !== "body")
        )
          fail("攻击预兆数值无效");
    }
  }
  if (
    !Array.isArray(value.flags) ||
    value.flags.length > 1500 ||
    !value.flags.every(id) ||
    new Set(value.flags).size !== value.flags.length
  )
    fail("关卡进度标识无效");
  if (!Array.isArray(value.events) || value.events.length > 128)
    fail("场景事件列表无效");
  let previousEventId = 0;
  for (const event of value.events) {
    if (
      !object(event) ||
      !integer(event.id, 1) ||
      event.id <= previousEventId ||
      event.id > value.eventSerial ||
      !id(event.type) ||
      !numberFields(event, ["x", "z"])
    )
      fail("场景事件序号或坐标无效");
    if (owns(event, "text") && !boundedText(event.text, 24000))
      fail("场景事件文字无效");
    if (owns(event,"y") && !finite(event.y)) fail("场景事件高度无效");
    if (owns(event, "value") && !finite(event.value)) fail("场景事件数值无效");
    previousEventId = event.id;
  }
}

/** In-memory pause/reconnect recovery. Durable saves already contain safe landings. */
export function resetSnapshotMovement(value: unknown, releaseHome:'all'|'none'|'gold'|'white'='all'): SnapshotShape {
  validateSnapshotShape(value);
  const snapshot = structuredClone(value);delete snapshot.inputAcks;delete snapshot.animalCare;
  if(snapshot.homePets)for(const p of Object.values(snapshot.homePets)){p.speed=0;p.pose=p.id==='home-sea-turtle'?(p.water?'idle':'land_idle'):'sit';}
  if(snapshot.pet){snapshot.pet.speed=0;snapshot.pet.pose='idle';}if(snapshot.golden){snapshot.golden.speed=0;snapshot.golden.pose='idle';}
  resetStoryVotes(snapshot.story);
  delete snapshot.travel;delete snapshot.regionLoad;
  delete snapshot.journeyProposal;
  if(snapshot.duo)for(const role of ['white','gold'] as const){snapshot.players[role].action='idle';snapshot.players[role].actionTime=0;}
  delete snapshot.duo;
  delete snapshot.fieldPlay;
  if (snapshot.v === 2) for (const role of ["gold","white"] as const) {
    const p = snapshot.players[role];
    if(p.homeUse&&(releaseHome==='all'||releaseHome===role)){Object.assign(p,p.homeUse.exit,{action:"idle",actionTime:0});delete p.homeUse;}
    const swimming=p.swim==='surface'||p.swim==='underwater';
    if (!p.grounded&&!swimming) { p.x = p.safeX!; p.z = p.safeZ!; p.y = p.safeY!; }
    p.mounted=false;p.flight='grounded';p.vx=0;p.vz=0;
    p.vy = 0; p.grounded = !swimming; p.sprinting = false; p.speed = 0; p.landing = 0;
    if(swimming){p.action=p.swim==='underwater'?'dive':'swim';p.actionTime=0;}
    if (["run","sprint","jump","fall","dodge","fly","land"].includes(p.action)) { p.action = "idle"; p.actionTime = 0; }
  }
  return snapshot;
}
