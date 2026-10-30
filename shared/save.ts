import {validHomePetIntents} from './home-pets';
import {validGoldenIntent} from './golden';
import {validPetIntent} from './pet';
import {validateFieldBook} from './fieldbook';
import { validateRegionProgress } from './regions';
import { validateJourneys } from './journeys';
/** Stable, versioned progress. Room codes are deliberately absent. */
import { validateSnapshotShape } from "./snapshot";
import {roomMode, type RoomMode} from './modes';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type DogRole = "gold" | "white";
export const SAVE_VERSION = 2 as const;
export const MAX_SAVE_BYTES = 196_608;
export interface DogProgress {
  weaponDrawn?: boolean;
  weaponId: string;
  skillIds: string[];
  unlockedEquipment: string[];
  unlockedSkills: string[];
  unlockedSkins: string[];
  skinId: string;
  inventory: string[];
}
export interface AdventureSave {
  mode?: RoomMode;
  version: 2;
  adventureId: string;
  revision: number;
  updatedAt: string;
  chapterId: string;
  checkpointId: string;
  completedChapters: string[];
  players: Record<DogRole, DogProgress>;
  quests: Record<string, string | number | boolean>;
  secrets: string[];
  world: JsonObject;
}
export interface AdventureCredentials {
  adventureId: string;
  recoveryToken: string;
}
export interface SaveReceipt {
  revision: number;
  updatedAt: string;
  requestId: string;
}
export interface BackupFile {
  format: "starlight-dogs";
  formatVersion: 1;
  credentials: AdventureCredentials;
  save: AdventureSave;
}
const safeId = /^[a-zA-Z0-9_-]{1,100}$/;
export function isId(value: unknown): value is string {
  return typeof value === "string" && safeId.test(value);
}
export function isJsonObject(value: unknown): value is JsonObject {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isSafeJson(value)
  );
}
export function isSafeJson(
  value: unknown,
  depth = 0,
  nodes = { count: 0 },
): value is JsonValue {
  if (++nodes.count > 24000 || depth > 24) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= 24000;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return (
      value.length <= 10000 &&
      value.every((v) => isSafeJson(v, depth + 1, nodes))
    );
  if (typeof value === "object")
    return Object.entries(value).every(
      ([k, v]) =>
        k.length <= 120 &&
        !["__proto__", "constructor", "prototype"].includes(k) &&
        isSafeJson(v, depth + 1, nodes),
    );
  return false;
}
function strings(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= 1500 && v.every(isId);
}
function progress(v: unknown): v is DogProgress {
  if (!isJsonObject(v)) return false;
  return (
    (v.weaponDrawn === undefined || typeof v.weaponDrawn === "boolean") &&
    isId(v.weaponId) &&
    isId(v.skinId) &&
    [
      "skillIds",
      "unlockedEquipment",
      "unlockedSkills",
      "unlockedSkins",
      "inventory",
    ].every((k) => strings(v[k]))
  );
}
export function validateSave(value: unknown): AdventureSave {
  if (
    !isJsonObject(value) ||
    new TextEncoder().encode(JSON.stringify(value)).length > MAX_SAVE_BYTES
  )
    throw new Error("存档格式无效或体积过大");
  const s = value as unknown as AdventureSave;
  if (s.mode !== undefined && s.mode !== 'adventure' && s.mode !== 'coop-exploration') throw new Error('未知的存档模式');
  if (s.mode === 'coop-exploration' && (s.completedChapters?.length || s.secrets?.length || Object.keys(s.quests ?? {}).length)) throw new Error('自由探索不能记录正式冒险奖励');
  if (s.version !== SAVE_VERSION)
    throw new Error("存档版本不受支持，请使用支持此版本的游戏");
  if (
    !isId(s.adventureId) ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    !isId(s.chapterId) ||
    !isId(s.checkpointId) ||
    typeof s.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(s.updatedAt))
  )
    throw new Error("存档基本信息损坏");
  if (
    !strings(s.completedChapters) ||
    !strings(s.secrets) ||
    !s.players ||
    !progress(s.players.gold) ||
    !progress(s.players.white) ||
    !isJsonObject(s.quests) ||
    !isJsonObject(s.world)
  )
    throw new Error("存档进度损坏");
  if (
    !Object.values(s.quests).every((v) =>
      ["string", "number", "boolean"].includes(typeof v),
    )
  )
    throw new Error("任务进度损坏");
  if(s.world.homePets!==undefined&&!validHomePetIntents(s.world.homePets))throw new Error('家园宠物记录损坏');
  if(s.world.golden!==undefined&&!validGoldenIntent(s.world.golden))throw new Error('金毛安排记录损坏');
  if(s.world.pet!==undefined&&!validPetIntent(s.world.pet))throw new Error('宠物安排记录损坏');
  if(s.world.regionProgress!==undefined)validateRegionProgress(s.world.regionProgress);
  if(s.world.fieldbook!==undefined)validateFieldBook(s.world.fieldbook);
  if(s.world.journeys!==undefined)validateJourneys(s.world.journeys);
  if (s.world.snapshot !== undefined) {
    validateSnapshotShape(s.world.snapshot);
    if ((s.world.snapshot.mode ?? 'adventure') !== roomMode(s)) throw new Error('存档与场景模式不一致');
    if (s.world.snapshot.chapterId !== s.chapterId)
      throw new Error("存档章节与场景快照不一致，请恢复有效备份");
  }
  return structuredClone(s);
}
export function defaultDog(): DogProgress {
  return {
    weaponId: "sword",
    skillIds: ["spark", "heal"],
    unlockedEquipment: ["sword", "staff"],
    unlockedSkills: ["spark", "heal"],
    unlockedSkins: ["base"],
    skinId: "base",
    inventory: [],
  };
}
export function freshSave(adventureId: string): AdventureSave {
  return {
    version: 2,
    adventureId,
    revision: 0,
    updatedAt: new Date().toISOString(),
    chapterId: "ch01",
    checkpointId: "village",
    completedChapters: [],
    players: { gold: defaultDog(), white: defaultDog() },
    quests: {},
    secrets: [],
    world: {},
  };
}
/** A deliberately additive migration keeps unknown future content IDs intact. */
export function migrateSave(value: unknown): AdventureSave {
  if (!isJsonObject(value)) throw new Error("无法读取存档");
  if (value.version === 1) {
    const migrated = structuredClone(value);
    migrated.version = 2;
    migrated.completedChapters ??= [];
    migrated.secrets ??= [];
    migrated.quests ??= {};
    migrated.world ??= {};
    return validateSave(migrated);
  }
  return validateSave(value);
}
export function parseBackup(text: string): BackupFile {
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES + 2048)
    throw new Error("备份文件过大");
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("备份不是完整的 JSON 文件");
  }
  if (
    !isJsonObject(file) ||
    file.format !== "starlight-dogs" ||
    file.formatVersion !== 1 ||
    !isJsonObject(file.credentials)
  )
    throw new Error("不是本游戏的存档备份");
  const c = file.credentials;
  if (
    !isId(c.adventureId) ||
    typeof c.recoveryToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(c.recoveryToken)
  )
    throw new Error("恢复凭证损坏");
  const save = migrateSave(file.save);
  if (save.adventureId !== c.adventureId)
    throw new Error("存档与恢复凭证不匹配");
  return {
    format: "starlight-dogs",
    formatVersion: 1,
    credentials: c as unknown as AdventureCredentials,
    save,
  };
}
export function makeBackup(
  credentials: AdventureCredentials,
  save: AdventureSave,
): string {
  return JSON.stringify(
    {
      format: "starlight-dogs",
      formatVersion: 1,
      credentials,
      save: validateSave(save),
    },
    null,
    2,
  );
}
