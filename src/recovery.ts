import {homePetIntents,HOME_PET_IDS} from '../shared/home-pets';import {goldenIntent} from '../shared/golden';import {petIntent} from '../shared/pet';
import { validateSave, type AdventureSave, type JsonObject } from '../shared/save';
import { validateSnapshotShape, type RegionArchiveShape, type SnapshotShape } from '../shared/snapshot';
import {newestFieldBook} from '../shared/fieldbook';
import { newestJourneys } from '../shared/journeys';
import {snapshotProgress} from '../shared/progress';

/** Pair a cold welcome's live scene with its durable progression. A running host is
 * the simulation authority: its paused, safe export is newer than the relay's last
 * 100 ms snapshot and must retain earned rewards and a just-completed chapter. */
export function prepareAdventureRecovery(
  serverSave: AdventureSave,
  roomSnapshot?: unknown,
  pausedHostSave?: AdventureSave,
): AdventureSave {
  validateSave(serverSave);
  if (pausedHostSave?.adventureId === serverSave.adventureId) {
    const result = structuredClone(validateSave(pausedHostSave));
    result.revision = serverSave.revision;
    return result;
  }
  const result = structuredClone(serverSave);
  // A durable page/commit ACK can be newer than the relay's last frame. Keep the
  // matching world and progress together, never combine two chapter cursors.
  const durable=result.world.snapshot as unknown as SnapshotShape|undefined;
  if(roomSnapshot&&durable?.story){
    validateSnapshotShape(roomSnapshot);
    if(durable.story.revision>(roomSnapshot.story?.revision??-1))roomSnapshot={...structuredClone(durable),progress:snapshotProgress(result)};
  }
  if (roomSnapshot !== undefined && roomSnapshot !== null) {
    validateSnapshotShape(roomSnapshot);
    if (roomSnapshot.progress) {
      const progress = roomSnapshot.progress;
      if (progress.adventureId !== result.adventureId) throw new Error('实时进度不属于当前冒险');
      // Unlocks are monotonic. A receipt can be newer than the relay's last 100 ms
      // scene, so preserve confirmed discoveries as well as newly earned ones.
      const union = (a: string[], b: string[]) => [...new Set([...a,...b])];
      result.completedChapters = union(result.completedChapters,progress.completedChapters);
      result.secrets = union(result.secrets,progress.secrets);
      result.quests = {...result.quests,...progress.quests};
      result.checkpointId = progress.checkpointId;
      if(progress.regionProgress){
        const existing=result.world.regionProgress as unknown as {discoveredRegions?:string[];broomOwned?:boolean}|undefined;
        result.world.regionProgress={discoveredRegions:union(existing?.discoveredRegions??[],progress.regionProgress.discoveredRegions),broomOwned:existing?.broomOwned===true||progress.regionProgress.broomOwned};
      }
      for (const role of ['gold','white'] as const) {
        const old = result.players[role], live = structuredClone(progress.players[role]);
        for (const key of ['unlockedEquipment','unlockedSkills','unlockedSkins'] as const) live[key] = union(old[key],live[key]);
        result.players[role] = {...old,...live};
      }
    }
    result.chapterId = roomSnapshot.chapterId;
    const scene = structuredClone(roomSnapshot);
    const durableScene=result.world.snapshot as unknown as SnapshotShape|undefined;
    const journeys=newestJourneys(result.world.journeys,durableScene?.journeys,scene.journeys);
    result.world.journeys=journeys as unknown as JsonObject;
    scene.journeys=journeys;
    const fieldbook=newestFieldBook(result.world.fieldbook,durableScene?.fieldbook,scene.fieldbook);
    result.world.fieldbook=fieldbook as unknown as JsonObject;scene.fieldbook=fieldbook;delete scene.fieldPlay;
    delete scene.journeyProposal;
    if(durableScene?.regionArchive||scene.regionArchive){
      const history:Record<string,RegionArchiveShape>=structuredClone(durableScene?.regionArchive??{});
      const merge=(old:RegionArchiveShape|undefined,live:RegionArchiveShape):RegionArchiveShape=>{
        if(!old)return structuredClone(live);
        const enemies=new Map(old.enemies.map(e=>[e.id,structuredClone(e)]));
        for(const enemy of live.enemies){const prior=enemies.get(enemy.id),next=structuredClone(enemy);if(prior?.hp===0){next.hp=0;next.state='dead';next.telegraphs=[];}enemies.set(enemy.id,next);}
        return {...structuredClone(live),flags:[...new Set([...old.flags,...live.flags])],ended:old.ended||live.ended,enemies:[...enemies.values()]};
      };
      for(const [region,entry]of Object.entries(scene.regionArchive??{}))history[region]=merge(history[region],entry);
      // The relay may be one packet behind a durable ACK. Confirmed room deaths and discoveries are monotonic.
      if(durableScene?.regionId&&durableScene.regionId!==scene.regionId){const old:RegionArchiveShape={chapterId:durableScene.chapterId,flags:durableScene.flags,enemies:durableScene.enemies,checkpoint:durableScene.checkpoint,ended:durableScene.ended};history[durableScene.regionId]=merge(history[durableScene.regionId],old);}
      if(scene.regionId){const durableCurrent=durableScene?.regionId===scene.regionId?{chapterId:durableScene.chapterId,flags:durableScene.flags,enemies:durableScene.enemies,checkpoint:durableScene.checkpoint,ended:durableScene.ended}:undefined;const current=merge(durableCurrent??history[scene.regionId],{chapterId:scene.chapterId,flags:scene.flags,enemies:scene.enemies,checkpoint:scene.checkpoint,ended:scene.ended});scene.flags=current.flags;scene.enemies=current.enemies;scene.ended=current.ended;delete history[scene.regionId];}
      scene.regionArchive=history;
    }
    if(scene.pet)result.world.pet=petIntent(scene.pet) as any;
    if(scene.golden)result.world.golden=goldenIntent(scene.golden) as any;
    if(scene.homePets){const pets=homePetIntents(scene.homePets);for(const id of HOME_PET_IDS){const p=scene.homePets[id];if(p.mode!=='home'||p.anchor)pets[id].anchor={regionId:p.regionId,x:p.x,y:p.y,z:p.z};}result.world.homePets=pets as any;}
    delete scene.pet;delete scene.golden;delete scene.homePets;
    delete scene.progress;
    result.world.snapshot = scene as unknown as JsonObject;
  }
  return validateSave(result);
}
