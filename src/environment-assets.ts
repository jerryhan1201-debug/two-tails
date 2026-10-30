import { AssetContainer, Scene, SceneLoader, TransformNode, Vector3, type InstantiatedEntries } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {previewTrees,TREE_PROTOTYPE_ROOT} from './tree-prototype';

export const STUDIO_ASSET_IDS = ['house','giant','medium','young','oak','birch','willow','fern','shrub','grass','bluebell','groundcover','path-a','path-b','path-c','bench','lantern','planter','sign','fence','bridge'] as const;
export const ENVIRONMENT_ASSET_IDS = ['mushroom-house', 'mushroom-room', 'canopy-house', 'canopy-room', 'giant-mushroom', 'ancient-tree', ...STUDIO_ASSET_IDS] as const;
export type EnvironmentAssetId = typeof ENVIRONMENT_ASSET_IDS[number];
type Cache = { containers: Map<EnvironmentAssetId, AssetContainer>; pending?: Promise<void> };
const caches = new WeakMap<Scene, Cache>();
function cacheFor(scene: Scene) { let cache = caches.get(scene); if (!cache) { cache = { containers: new Map() }; caches.set(scene, cache); } return cache; }
/** Bounded, explicit startup preload. Failed attempts release every partial asset and are retryable. */
export function prepareEnvironmentAssets(scene: Scene): Promise<void> {
  const cache = cacheFor(scene);
  if (cache.containers.size === ENVIRONMENT_ASSET_IDS.length) return Promise.resolve();
  if (cache.pending) return cache.pending;
  cache.pending = (async () => {
    const staged = new Map<EnvironmentAssetId, AssetContainer>();
    try {
      // Sequential loads bound peak memory and avoid late successes after a rejected batch.
      for (const id of ENVIRONMENT_ASSET_IDS) {
        const studio = (STUDIO_ASSET_IDS as readonly string[]).includes(id);
        const container = await SceneLoader.LoadAssetContainerAsync(previewTrees&&['oak','birch','willow'].includes(id)?TREE_PROTOTYPE_ROOT:'/assets/environment/'+(studio?'studio-rc1/':'v6-core/'), id + '.glb?rev=v8-rc1', scene, undefined, '.glb');
        if (!container.meshes.some(mesh => mesh.getTotalVertices() > 0)) { container.dispose(); throw new Error(id + ' contains no geometry'); }
        staged.set(id, container);
      }
      for (const [id, container] of staged) cache.containers.set(id, container);
    } catch (error) {
      for (const container of staged.values()) container.dispose();
      cache.containers.clear();
      throw new Error('核心场景素材加载失败，请重试。' + (error instanceof Error ? ' ' + error.message : ''), { cause: error });
    } finally { cache.pending = undefined; }
  })();
  return cache.pending;
}
export type EnvironmentLease = { root: TransformNode; dispose(): void };
export function instantiateEnvironmentAsset(scene: Scene, id: EnvironmentAssetId, parent: TransformNode, position = Vector3.Zero(), scale = Vector3.One(), forceClone = false): EnvironmentLease {
  const container = cacheFor(scene).containers.get(id);
  if (!container) throw new Error('核心场景素材尚未准备完成：' + id);
  const root = new TransformNode('editable-environment/' + id, scene);
  root.position.copyFrom(position); root.scaling.copyFrom(scale); root.parent = parent;
  const studio = (STUDIO_ASSET_IDS as readonly string[]).includes(id);
  if(studio) root.rotation.y=Math.PI;
  let instances: InstantiatedEntries;
  try {
    instances = container.instantiateModelsToScene(name => id + '/' + name, false, { doNotInstantiate: forceClone || (!studio && id !== 'giant-mushroom') || id==='house' });
    for (const node of instances.rootNodes) node.parent = root;
    for (const mesh of root.getChildMeshes()) {
      mesh.receiveShadows = true;
      mesh.isPickable = true;
      mesh.metadata = { ...mesh.metadata, environmentAsset: id,
        cameraCutaway: /CUTAWAY_FRONT|01_front_cutaway/.test(mesh.name),
        cameraObstacle: !/glass|gill|leaf|fleck|note|cup|windchime|floor|window view|fitted furnishings|daybed|pillow|dining table|sideboard|correspondence|05_furniture|06_details/i.test(mesh.name) && !['fern','grass','shrub','bluebell','groundcover','path-a','path-b','path-c','young'].includes(id) };
    }
  } catch (error) { root.dispose(); throw error; }
  return { root, dispose() {
    // Never let World.root.dispose(false, true) reach cache-owned materials/textures.
    root.parent = null;
    instances.dispose();
    root.dispose();
  } };
}
export function disposeEnvironmentAssets(scene: Scene) {
  const cache = caches.get(scene); if (!cache) return;
  for (const container of cache.containers.values()) container.dispose();
  cache.containers.clear(); caches.delete(scene);
}
export function environmentAssetStats(scene: Scene) {
  const cache = caches.get(scene);
  return { loaded: cache?.containers.size ?? 0, expected: ENVIRONMENT_ASSET_IDS.length, pending: Boolean(cache?.pending) };
}

/** Read-only cache geometry for direct static instancing; ownership stays here. */
export function environmentAssetMeshes(scene:Scene,id:EnvironmentAssetId){
 const container=cacheFor(scene).containers.get(id);if(!container)throw Error('Missing prepared asset '+id);
 return container.meshes.filter(m=>m.getTotalVertices()>0);
}

/** Read-only ownership ledger for bounded prototype-cache lifecycle audits. */
export function environmentMaterialOwnership(scene:Scene){return [...(caches.get(scene)?.containers.values()??[])].flatMap(c=>c.materials.map(m=>({id:m.uniqueId,name:m.name})));}
