import { validateRegionProgress, type RegionProgress } from './regions';
import type { AdventureSave, DogProgress } from './save';

/** Credential-free progression accompanying one authoritative live scene. No world
 * or nested snapshot is allowed, so repeated save/reconnect cycles stay bounded. */
export interface SnapshotProgress {
  adventureId: string;
  chapterId: string;
  checkpointId: string;
  completedChapters: string[];
  players: { gold: DogProgress; white: DogProgress };
  quests: Record<string, string | number | boolean>;
  secrets: string[];
  regionProgress?: RegionProgress;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 1500 && v.every(id);
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(v, k));
const dogKeys = ['weaponId','skillIds','unlockedEquipment','unlockedSkills','unlockedSkins','skinId','inventory'] as const;
function validDog(v: unknown): v is DogProgress {
  return object(v) && exactKeys(v,[...dogKeys,...(Object.hasOwn(v,'weaponDrawn')?['weaponDrawn']:[])]) && (v.weaponDrawn===undefined||typeof v.weaponDrawn==='boolean') && id(v.weaponId) && id(v.skinId) &&
    ['skillIds','unlockedEquipment','unlockedSkills','unlockedSkins','inventory'].every(k=>ids(v[k]));
}
export function validateSnapshotProgress(value: unknown): asserts value is SnapshotProgress {
  if (!object(value) || !exactKeys(value,['adventureId','chapterId','checkpointId','completedChapters','players','quests','secrets',...(Object.prototype.hasOwnProperty.call(value,'regionProgress')?['regionProgress']:[])]) ||
      !id(value.adventureId) || !id(value.chapterId) || !id(value.checkpointId) ||
      !ids(value.completedChapters) || !ids(value.secrets) || !object(value.players) ||
      !exactKeys(value.players,['gold','white']) || !validDog(value.players.gold) || !validDog(value.players.white) ||
      !object(value.quests) || Object.keys(value.quests).length > 1500 ||
      !Object.entries(value.quests).every(([k,v])=>id(k) && !['__proto__','constructor','prototype'].includes(k) &&
        (typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) || typeof v === 'string' && v.length <= 24000)) ||
      new TextEncoder().encode(JSON.stringify(value)).length > 65536)
    throw new Error('实时冒险进度损坏或体积过大');
  if(value.regionProgress!==undefined)validateRegionProgress(value.regionProgress);
}
export function snapshotProgress(save: AdventureSave): SnapshotProgress {
  const dog = (p: DogProgress): DogProgress => Object.fromEntries([...dogKeys.map(k=>[k,structuredClone(p[k])]),...(p.weaponDrawn===undefined?[]:[['weaponDrawn',p.weaponDrawn]])]) as unknown as DogProgress;
  const result = { adventureId:save.adventureId, chapterId:save.chapterId, checkpointId:save.checkpointId,
    completedChapters:[...save.completedChapters], players:{gold:dog(save.players.gold),white:dog(save.players.white)},
    quests:structuredClone(save.quests), secrets:[...save.secrets], ...(save.world.regionProgress?{regionProgress:structuredClone(save.world.regionProgress) as unknown as RegionProgress}:{}) };
  validateSnapshotProgress(result);
  return result;
}
