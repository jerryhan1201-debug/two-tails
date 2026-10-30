import {validHomePetIntents,type HomePetIntents} from '../shared/home-pets';
import {validGoldenIntent,type GoldenIntent} from '../shared/golden';
import {validPetIntent,type PetIntent} from '../shared/pet';
import {validateJourneys,type JourneyProgress} from '../shared/journeys';
import {validateFieldBook,type FieldBook} from '../shared/fieldbook';
import { CHAPTERS } from "./content";
import { REGIONS, allowedRegions, getRegion } from "./regions";
import {
  isId,
  isJsonObject,
  migrateSave,
  type AdventureSave,
  type DogRole,
} from "../shared/save";

export type {GameMode} from '../shared/modes';
export const EXPLORATION_STORAGE_KEY = "starlight-exploration-v1";
export const LEGACY_PRACTICE_KEY = "starlight-practice";
export const EXPLORATION_EQUIPMENT = [
  "sword",
  "staff",
  "bow",
  "chime",
] as const;
export const EXPLORATION_SKILLS = ["spark", "heal", "nova", "shield"] as const;
export const EXPLORATION_SKINS = ["base", "forest", "moon"] as const;
export function explorationPermissions(save: AdventureSave): AdventureSave {
  const dog = (role: DogRole) => ({...save.players[role], unlockedEquipment:[...EXPLORATION_EQUIPMENT], unlockedSkills:[...EXPLORATION_SKILLS], unlockedSkins:[...EXPLORATION_SKINS], inventory:[]});
  return {...save,players:{gold:dog('gold'),white:dog('white')}};
}
export interface ExplorationLoadout {
  weaponDrawn?: boolean;
  weaponId: string;
  skillIds: string[];
  skinId: string;
}
export interface ExplorationCamera {
  yaw: number;
  pitch: number;
  distance: number;
}
export interface ExplorationPreferences {
  quality: "auto" | "high" | "medium" | "low";
  music: number;
  sfx: number;
  showEquipment?: boolean;
  sensitivity?: number;
}
/** Deliberately not assignable to AdventureSave: no adventure identity, unlocks, quest flags or snapshot. */
export interface ExplorationSave {
  journeys?:JourneyProgress;
  pet?:PetIntent;
  golden?:GoldenIntent;
  homePets?:HomePetIntents;
  fieldbook?:FieldBook;
  homeLights?: boolean;
  format: "starlight-exploration";
  version: 1;
  updatedAt: string;
  role: DogRole;
  regionId: string;
  discoveredRegions?: string[];
  position: { x: number; y?: number; z: number; yaw: number };
  camera: ExplorationCamera;
  preferences: ExplorationPreferences;
  loadouts: Record<DogRole, ExplorationLoadout>;
}
export interface ExplorationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface ExplorationReadResult {
  save: ExplorationSave | null;
  status: "empty" | "loaded" | "migrated" | "invalid" | "migration-failed";
  message: string;
  backupKey?: string;
}
export const DEFAULT_EXPLORATION_CAMERA: ExplorationCamera = {
  yaw: 0,
  pitch: 0.17,
  distance: 8.8,
};
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const inList = (value: unknown, list: readonly string[]): value is string =>
  typeof value === "string" && list.includes(value);
const keysAre = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  Object.keys(value).every((k) => keys.includes(k));
export function canonicalRegion(id: string): string | undefined {
  if (REGIONS.some(r => r.id === id)) return id;
  return CHAPTERS.find(
    (c) =>
      c.id === id || (/^ch\d{2}$/.test(id) && c.index === Number(id.slice(2))),
  )?.id;
}
export function allowedExplorationRegions(
  adventure?: AdventureSave | null,
  developerPreview = false,
): string[] {
  return [...new Set([...REGIONS.map(r => r.id),...CHAPTERS.map(c=>c.id)])];
}
export function createExplorationSave(
  role: DogRole = "gold",
  regionId = CHAPTERS[0].id,
): ExplorationSave {
  if (role !== "gold" && role !== "white")
    throw new Error("请选择金色或白色小狗");
  const region = getRegion(canonicalRegion(regionId) ?? "");
  if (!region) throw new Error("此探索区域尚未安装");
  const loadout = (): ExplorationLoadout => ({
    weaponDrawn:false,
    weaponId: "sword",
    skillIds: ["spark", "heal"],
    skinId: "base",
  });
  return {
    format: "starlight-exploration",
    version: 1,
    updatedAt: new Date().toISOString(),
    role,
    regionId: region.id,
    discoveredRegions: [region.id],
    position: { x: region.spawn.x, z: region.spawn.z, yaw: 0 },
    camera: { ...DEFAULT_EXPLORATION_CAMERA },
    preferences: {
      quality: "auto",
      music: 0.44,
      sfx: 0.66,
      showEquipment: false,
    },
    loadouts: { gold: loadout(), white: loadout() },
  };
}
export function validateExplorationSave(value: unknown): ExplorationSave {
  if (
    !isJsonObject(value) ||
    new TextEncoder().encode(JSON.stringify(value)).length > 24576 ||
    !keysAre(Object.fromEntries(Object.entries(value).filter(([key]) => !["discoveredRegions","homeLights","fieldbook","pet","golden","homePets","journeys"].includes(key))), [
      "format",
      "version",
      "updatedAt",
      "role",
      "regionId",
      "position",
      "camera",
      "preferences",
      "loadouts",
    ]) ||
    value.format !== "starlight-exploration" ||
    value.version !== 1 ||
    (value.role !== "gold" && value.role !== "white") ||
    !isId(value.regionId) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw new Error("探索记录格式损坏；原记录已保留");
  if (value.discoveredRegions !== undefined && (!Array.isArray(value.discoveredRegions) || value.discoveredRegions.length > 64 || !value.discoveredRegions.every(id => isId(id))))
    throw new Error("探索地图记录损坏；原记录已保留");
  if(value.homePets!==undefined&&!validHomePetIntents(value.homePets))throw new Error('家园宠物记录损坏；原记录已保留');
  if(value.golden!==undefined&&!validGoldenIntent(value.golden))throw new Error('金毛安排记录损坏；原记录已保留');
  if(value.pet!==undefined&&!validPetIntent(value.pet))throw new Error('宠物安排记录损坏；原记录已保留');
  const { position, camera, preferences, loadouts } = value;
  if (
    !isJsonObject(position) ||
    !keysAre(Object.fromEntries(Object.entries(position).filter(([key]) => key !== "y")), ["x", "z", "yaw"]) ||
    !finite(position.x, -1000, 1000) ||
    (position.y !== undefined && !finite(position.y, -1000, 1000)) ||
    !finite(position.z, -1000, 1000) ||
    !finite(position.yaw, -1e6, 1e6) ||
    !isJsonObject(camera) ||
    !keysAre(camera, ["yaw", "pitch", "distance"]) ||
    !finite(camera.yaw, -1e6, 1e6) ||
    !finite(camera.pitch, -1.12, 1.5) ||
    !finite(camera.distance, 2, 30) ||
    !isJsonObject(preferences) ||
    !Object.keys(preferences).every((k) =>
      ["quality", "music", "sfx", "showEquipment", "sensitivity"].includes(k),
    ) ||
    (preferences.sensitivity !== undefined && !finite(preferences.sensitivity,.5,2)) ||
    (preferences.showEquipment !== undefined &&
      typeof preferences.showEquipment !== "boolean") ||
    !inList(preferences.quality, ["auto", "high", "medium", "low"]) ||
    !finite(preferences.music, 0, 1) ||
    !finite(preferences.sfx, 0, 1) ||
    !isJsonObject(loadouts) ||
    !keysAre(loadouts, ["gold", "white"])
  )
    throw new Error("探索位置或偏好损坏；原记录已保留");
  for (const role of ["gold", "white"]) {
    const p = loadouts[role];
    if (
      !isJsonObject(p) ||
      !keysAre(Object.fromEntries(Object.entries(p).filter(([k])=>k!=="weaponDrawn")), ["weaponId", "skillIds", "skinId"]) ||
      (p.weaponDrawn!==undefined&&typeof p.weaponDrawn!=="boolean") ||
      !inList(p.weaponId, EXPLORATION_EQUIPMENT) ||
      !inList(p.skinId, EXPLORATION_SKINS) ||
      !Array.isArray(p.skillIds) ||
      p.skillIds.length !== 2 ||
      !p.skillIds.every((v) => inList(v, EXPLORATION_SKILLS))
    )
      throw new Error("探索装扮记录损坏；原记录已保留");
  }
  if(value.fieldbook!==undefined)validateFieldBook(value.fieldbook);
  if(value.journeys!==undefined)validateJourneys(value.journeys);
  const result = structuredClone(value) as unknown as ExplorationSave;
  if(result.homeLights!==undefined&&typeof result.homeLights!=='boolean')throw new Error('家园灯光记录损坏');
  result.preferences.showEquipment ??= false;
  for(const r of ['gold','white'] as const)result.loadouts[r].weaponDrawn??=result.preferences.showEquipment;
  result.discoveredRegions ??= [result.regionId];
  return result;
}
export function exportExplorationBackup(save: ExplorationSave): string {
  return JSON.stringify(validateExplorationSave(save), null, 2);
}
export function parseExplorationBackup(text: string): ExplorationSave {
  if (new TextEncoder().encode(text).length > 8192)
    throw new Error("探索备份体积过大");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("探索备份不是完整 JSON 文件");
  }
  return validateExplorationSave(value);
}
export function writeExploration(
  storage: ExplorationStorage,
  save: ExplorationSave,
): void {
  const serialized = JSON.stringify(validateExplorationSave(save));
  const previous = storage.getItem(EXPLORATION_STORAGE_KEY);
  if (previous !== null) {
    let previousSave: ExplorationSave | undefined;
    try {
      previousSave = parseExplorationBackup(previous);
    } catch {
      preserveRaw(storage, previous, "starlight-exploration-corrupt-backup-v1");
    }
    // Keep the last height-free record readable by the 0.6 rollback build.
    if (previousSave && previousSave.position.y === undefined && save.position.y !== undefined)
      preserveRaw(storage, previous, "starlight-exploration-before-v7");
  }
  storage.setItem(EXPLORATION_STORAGE_KEY, serialized);
  if (storage.getItem(EXPLORATION_STORAGE_KEY) !== serialized)
    throw new Error("探索记录未能写入本机；请导出探索备份");
}
function preserveRaw(
  storage: ExplorationStorage,
  raw: string,
  category: string,
): string {
  // Never replace an earlier backup, even if the player has changed the legacy record.
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++)
    hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  const prefix = `${category}:${(hash >>> 0).toString(16)}-${raw.length}`;
  for (let i = 0; i < 100; i++) {
    const key = prefix + (i ? `-${i}` : ""),
      existing = storage.getItem(key);
    if (existing === raw) return key;
    if (existing !== null) continue;
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) throw new Error("旧练习记录备份未成功");
    return key;
  }
  throw new Error("无法建立独立的旧练习备份");
}
/** Copies only visit preferences and loadout, never the former practice's campaign progress. */
export function migrateLegacyPractice(
  raw: string,
  adventure?: AdventureSave | null,
): ExplorationSave {
  const legacy = migrateSave(JSON.parse(raw));
  const allowed = allowedExplorationRegions(adventure),
    oldRegion = canonicalRegion(legacy.chapterId);
  const region =
    oldRegion && allowed.includes(oldRegion) ? oldRegion : CHAPTERS[0].id;
  const result = createExplorationSave("gold", region);
  for (const role of ["gold", "white"] as const) {
    const p = legacy.players[role];
    if (inList(p.weaponId, EXPLORATION_EQUIPMENT))
      result.loadouts[role].weaponId = p.weaponId;
    if (inList(p.skinId, EXPLORATION_SKINS))
      result.loadouts[role].skinId = p.skinId;
    if (
      p.skillIds.length === 2 &&
      p.skillIds.every((s) => inList(s, EXPLORATION_SKILLS))
    )
      result.loadouts[role].skillIds = [...p.skillIds];
  }
  const snapshot = legacy.world.snapshot as any;
  if (region === oldRegion && snapshot?.players?.gold) {
    const p = snapshot.players.gold;
    result.position = { x: p.x, z: p.z, yaw: p.yaw };
  }
  return validateExplorationSave(result);
}
export function readExploration(
  storage: ExplorationStorage,
  adventure?: AdventureSave | null,
): ExplorationReadResult {
  let current: string | null, legacy: string | null;
  try {
    current = storage.getItem(EXPLORATION_STORAGE_KEY);
    legacy = storage.getItem(LEGACY_PRACTICE_KEY);
  } catch {
    return {
      save: null,
      status: "invalid",
      message: "无法读取本机探索记录；现有数据未修改",
    };
  }
  if (current !== null) {
    try {
      return {
        save: parseExplorationBackup(current),
        status: "loaded",
        message: "已读取独立的单人探索记录",
      };
    } catch (error) {
      return {
        save: null,
        status: "invalid",
        message: (error as Error).message,
      };
    }
  }
  if (legacy === null)
    return { save: null, status: "empty", message: "还没有单人探索记录" };
  let backupKey: string | undefined;
  try {
    backupKey = preserveRaw(storage, legacy, "starlight-practice-backup-v1");
    const save = migrateLegacyPractice(legacy, adventure);
    writeExploration(storage, save);
    return {
      save,
      status: "migrated",
      backupKey,
      message: "旧练习已另存备份，只迁移位置与装扮；旧记录及双人进度保持不变",
    };
  } catch (error) {
    return {
      save: null,
      status: "migration-failed",
      ...(backupKey ? { backupKey } : {}),
      message: `迁移未完成，旧练习原值仍保留：${(error as Error).message}`,
    };
  }
}
