import {HomeFrameDiagnostics} from './home-frame-diagnostics';
import {isHomePetId} from '../shared/home-pets';
import {petAvailable} from './pet-follow';
import {nearbyAnimal,animalTargets,reachableAnimal} from './animal-interactions';
import {ensureStudioData} from './studio-physics';
import type{RegionLoadCommand}from'../shared/region-load';
import {villaInterior} from './villa-physics';
import {weatherAt} from './world-weather';
import {MotionAudio} from './motion-audio';
import "./style.css";
import "./game-shell.css";
import "./control-skin.css";
import "./studio-ui.css";
import "./desktop.css";
import "./storybook-a.css";
import { GameRenderer } from "./render";
import { Controls } from "./input";
import { Simulation, type Snapshot, type Command } from "./simulation";
import {GuestMotion} from './guest-motion';
import { GameNetwork } from "./network";
import { prepareAdventureRecovery } from "./recovery";
import { AudioManager } from "./audio";
import { UI } from "./ui";
import {StoryReader,storyLinks} from './story-reader';
import {FieldUI} from './field-ui';
import {fieldMovementLocked,type FieldCommand} from '../shared/fieldbook';
import {duoAvailable} from './duo-interactions';
import {resetStoryVotes,type StoryProgress} from '../shared/story';
import { residentIdentity } from "./villagers";
import { CHAPTERS } from "./content";
import { getRegion, getRegionChapter, allowedRegions, regionConnections } from "./regions";
import {explorationPermissions} from './exploration';
import {isFreeExploration} from '../shared/modes';
import { journeyNodes } from "./journeys";
import { nearbyInteraction } from "./interaction-target";
import {
  createExplorationSave,
  readExploration,
  writeExploration,
  allowedExplorationRegions,
  exportExplorationBackup,
  parseExplorationBackup,
  migrateLegacyPractice,
  type ExplorationSave,
} from "./exploration";
import {
  freshSave,
  parseBackup,
  type DogRole,
  type AdventureSave,
} from "../shared/save";

const ui = new UI(),
  fieldUI=new FieldUI(ui),
  controls = new Controls(),
  network = new GameNetwork(),
  audio = new AudioManager();
const guestMotion=new GuestMotion();
const storyReader=new StoryReader();
if (location.protocol === "https:") void fetch("/api/access/status", { cache: "no-store" }).then(async response => { if (response.ok) ui.privateAccess = (await response.json()).authenticated === true; }).catch(() => {});
let renderer: GameRenderer;
let sim: Simulation | null = null,
  remote: Snapshot | null = null,
  running = false,
  gameMode: import('../shared/modes').GameMode = "adventure",
  role: DogRole = "gold",
  saveInFlight: Promise<boolean> | null = null,
  saveFailure = "",
  lastSave = 0,
  lastHud = 0,
  lastSnapshot = 0,
  lastInput = 0,
  lastEvent = 0,
  lastChapter = "",
  lastRegion = "",
  lastTravel = 0,
  busy = false;
const settings = (() => {
  try {
    return {
      music: 0.44,
      sfx: 0.66,
      quality: "auto",
      sensitivity: 1,
      ...JSON.parse(localStorage.getItem("starlight-settings") ?? "{}"),
    };
  } catch {
    return { music: 0.44, sfx: 0.66, quality: "auto", sensitivity: 1 };
  }
})();
const isExploring = () => gameMode === "exploration";
const isFreeExploring = () => isFreeExploration(gameMode);
const developerPreview =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).get("inspect-scenes") === "1";
let selectedRole: DogRole = "gold",
  bare = true;
const explorationRead = readExploration(
  localStorage,
  network.save ?? undefined,
);
let explorationSave: ExplorationSave | null = explorationRead.save;
const refreshContinue = () => {
  ui.continueInfo(network.savedMode('adventure').save);
  document.querySelector<HTMLButtonElement>('#continue-coop')!.hidden = !network.savedMode('coop-exploration').save;
  ui.explorationInfo(explorationSave);
};
const state = () =>
  network.isHost || isExploring() ? (sim?.state ?? null) : remote;
const activeSave = () => {
  const save=network.isHost || isExploring() ? (sim?.save ?? network.save) : network.save;
  return save&&isFreeExploring()?explorationPermissions(save):save;
};
const safeSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    ui.toast("本机存储空间不足，请导出备份");
    return false;
  }
};
const modePaused = () => !isExploring() && network.state !== "online";
const storyPending=(s:Snapshot)=>!isExploring()&&(s.story?.revision??0)>((network.save?.world.snapshot as unknown as Snapshot|undefined)?.story?.revision??0);
try {
  renderer = new GameRenderer(
    document.querySelector<HTMLCanvasElement>("#game")!,
  );
} catch (error) {
  document.querySelector("#loading")!.innerHTML =
    `<h2>这个浏览器暂时无法打开三维世界</h2><p>请开启硬件加速，或使用 Safari / Chrome / Edge 后重新打开。</p><button type="button" data-graphics-retry>重新尝试</button>`;
  document.querySelector('[data-graphics-retry]')?.addEventListener('click',()=>location.reload());
  throw error;
}
// Load editable core assets before accepting gameplay input. A failed download
// leaves saved progress untouched and can be retried without rebuilding the app.
for (;;) {
  try {
    await renderer.prepareEnvironmentAssets();
    break;
  } catch {
    const loading = document.querySelector<HTMLElement>("#loading")!;
    loading.innerHTML = '<h2>林间小屋还没准备好</h2><p>有些场景没能完整载入。连接恢复后，再试一次。</p><button class="primary" data-assets-retry>重新载入</button>';
    const retry = loading.querySelector<HTMLButtonElement>("[data-assets-retry]")!;
    retry.focus();
    await new Promise<void>(resolve => retry.addEventListener('click', () => resolve(), {once:true}));
    retry.disabled = true;
    retry.textContent = '正在整理行囊…';
  }
}
controls.sensitivity=Number.isFinite(settings.sensitivity)?Math.max(.5,Math.min(2,settings.sensitivity)):1;
controls.onResetLook=()=>{if(running&&!renderer.loadingRegion)renderer.stopLook();};
controls.bind();
ui.loaded();
refreshContinue();
const startAudio = () => {
  audio.setVolumes(settings.music, settings.sfx);
  const s=state();if(s)audio.setMood(getRegionChapter(s.regionId).biome,false,s.regionId,s.players[role]);
  void audio.start().catch(() => ui.toast("点击声音按钮可重新启用音乐"));
};
async function begin(save: AdventureSave, practice: boolean, snapshot?: Snapshot) {
  guestMotion.reset();
  const initialRegion=practice?explorationSave?.regionId:(save.world.snapshot as any)?.regionId??save.chapterId;
  controls.reset();controls.enabled=false;
  try{await ensureStudioData(initialRegion??CHAPTERS[0].id);}catch{ui.toast('场景资料未完整载入，进度仍保留，请重试继续游戏。');return;}
  if (!practice) save = prepareAdventureRecovery(save, snapshot);
  gameMode = practice ? "exploration" : save.mode ?? "adventure";
  role = practice ? selectedRole : (network.role ?? "gold");
  if (isExploring() || network.isHost) {
    sim = practice
      ? new Simulation(undefined, {
          mode: "exploration",
          exploration: explorationSave ?? createExplorationSave(role),
          inheritedAdventure: network.save ?? undefined,
          developerPreview,
        })
      : new Simulation(save,{stories:true});
    sim.deferRegionTransitions=true;
    sim.resolve = (x, z, radius, feetY, bodyHeight) =>
      feetY === undefined ? renderer.world.resolvePosition(x, z, radius) : renderer.world.resolveAt(x, z, feetY, radius ?? .66, bodyHeight ?? 2.2);
  } else {
    const restored = new Simulation(save);
    remote = restored.state;
    sim = null;
  }
  running = true;
  saveFailure = "";
  renderer.menu = false;
  renderer.role = role;
  renderer.yaw = practice ? (explorationSave?.camera.yaw ?? 0) : 0;
  renderer.pitch = practice ? (explorationSave?.camera.pitch ?? 0.17) : 0.17;
  renderer.zoomDistance = practice ? Math.max(6, Math.min(13, explorationSave?.camera.distance ?? 8.8)) : 8.8;
  renderer.characterPreview = null;
  renderer.bare = practice && bare;
  renderer.visibleRoles = practice ? [role] : ["gold", "white"];
  renderer.preview = false;
  renderer.load(
    getRegionChapter(state()?.regionId ?? state()?.chapterId ?? CHAPTERS[0].id),
    state()?.regionId,
    state()?.players[role],
  );
  for (const flag of state()?.flags ?? []) renderer.world.markFound(flag);
  if(renderer.world.regionId===state()?.regionId)sim?.setMovementWorld(renderer.world);
  lastEvent = state()?.eventSerial ?? 0;
  lastChapter = "";
  lastRegion = "";
  lastTravel = 0;
  controls.enabled = true;
  ui.close();
  ui.mode("game");
  ui.status(
    isExploring() ? "单人自由探索 · 无需联机" : "伙伴已连接",
    isExploring()
      ? developerPreview
        ? "开发验收 · 不保存"
        : "独立探索存档"
      : "已读取双人存档",
  );
  startAudio();
  ui.message(
    (practice
      ? "沿路找找秘密、试试飞行挑战，发现会记在探索手记里。这里与双人故事独立保存。"
      : CHAPTERS.find((c) => c.id === state()?.chapterId)?.intro.join(" ")) ??
      "和伙伴一起找回星光。",
  );
  if (sim?.notice) ui.toast(sim.notice);
  lastSave = performance.now();
}
function saveNow(): Promise<boolean> {
  if (saveInFlight) return saveInFlight;
  if (!running || (!isExploring() && !network.isHost) || !sim)
    return Promise.resolve(true);
  const currentSim = sim,
    currentMode = gameMode,
    serial = sim.state.eventSerial,
    storyRevision=sim.state.story?.revision;
  const sameScene = () => sim === currentSim && gameMode === currentMode;
  ui.status(
    currentMode === "exploration"
      ? "单人自由探索"
      : modePaused()
        ? "连接恢复中"
        : "伙伴已连接",
    "正在保存…",
  );
  saveInFlight = (async () => {
    try {
      if (currentMode === "exploration") {
        persistExploration();
        if (sameScene())
          ui.status(
            "单人自由探索",
            developerPreview ? "开发验收 · 不保存" : "探索位置已保存",
          );
      } else {
        const receipt = await network.checkpoint(currentSim.exportSave());
        currentSim.save.revision = receipt.revision;
        if (sameScene())
          ui.status(
            modePaused() ? "冒险已暂停" : "伙伴已连接",
            "已保存 " +
              new Date(receipt.updatedAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
          );
      }
      currentSim.dirty = currentSim.state.eventSerial !== serial||currentSim.state.story?.revision!==storyRevision;
      if (sameScene()) {
        lastSave = performance.now();
        saveFailure = "";
      }
      return true;
    } catch (error) {
      if (sameScene()) {
        saveFailure = currentMode === "exploration"
          ? "本机保存失败；上次健康存档未改变。最新位置仍在当前页面，请先重试或导出备份。"
          : error instanceof Error ? error.message : "服务器尚未确认，请重试或导出当前进度";
        // A failed write must not turn into one storage attempt on every animation frame.
        lastSave = performance.now();
        ui.status(
          currentMode === "exploration" ? "单人自由探索" : "等待伙伴连接",
          currentMode === "exploration"
            ? "保存失败 · 最新位置仅在当前页面"
            : network.pendingStatus === "local"
              ? "尚未确认 · 待同步记录已写入本机"
              : "尚未确认 · 本机也未保存，请勿刷新",
        );
        ui.toast(saveFailure);
      }
      return false;
    }
  })().finally(() => {
    saveInFlight = null;
  });
  return saveInFlight;
}
function showSaveFailure() {
  controls.reset();
  const detail = document.createElement("p");
  detail.className = "fine";
  detail.textContent = saveFailure || "最新进度尚未确认，请重试保存或导出当前进度备份。";
  ui.modal(
    "进度还没有安全保存",
    "你仍在当前场景，之前的健康存档没有被覆盖。",
    `${detail.outerHTML}<div class="save-actions"><button class="secondary" data-ui="home">重试保存并退出</button><button class="secondary" data-ui="export">导出当前进度备份 ↓</button></div><div class="modal-footer"><button class="quiet" data-ui="close">留在游戏</button></div>`,
  );
}
const explorationPreferences = () => ({
  quality: settings.quality,
  music: settings.music,
  sfx: settings.sfx,
  showEquipment: !bare,
  sensitivity: controls.sensitivity,
});
function preserveBeforeImport(key: string) {
  const raw = localStorage.getItem(key);
  if (raw === null) return;
  const backupKey =
    key + "-before-import:" + Date.now() + ":" + crypto.randomUUID();
  if (!safeSet(backupKey, raw) || localStorage.getItem(backupKey) !== raw)
    throw new Error("原记录备份未完成，已取消恢复；当前记录未改变");
}
function persistExploration() {
  if (!sim || !isExploring() || developerPreview) return;
  const next = sim.exportExploration({
    camera: { yaw: renderer.yaw, pitch: renderer.pitch, distance: renderer.zoomDistance },
    preferences: explorationPreferences(),
  });
  writeExploration(localStorage, next);
  explorationSave = next;
}
function chooseExplorer() {
  renderer.characterPreview = selectedRole;
  renderer.previewAngle = Math.PI;
  ui.chooseExplorer(selectedRole);
  document.querySelector("#character-turn")?.addEventListener("input", (e) => {
    renderer.previewAngle = Number((e.target as HTMLInputElement).value) / 100;
  });
}
async function startExploration() {
  const next = structuredClone(
    explorationSave ?? createExplorationSave(selectedRole),
  );
  next.role = selectedRole;
  explorationSave = next;
  bare = !next.preferences.showEquipment;
  Object.assign(settings, {
    quality: next.preferences.quality,
    music: next.preferences.music,
    sfx: next.preferences.sfx,
    sensitivity: next.preferences.sensitivity ?? 1,
  });
  controls.sensitivity=settings.sensitivity;
  renderer.setQuality(settings.quality);
  network.disconnect();
  await begin(freshSave("exploration-sandbox"), true);
}
network.addEventListener("room", (event) => {
  const room = (event as CustomEvent).detail;
  if (!running && !isExploring()) ui.lobby(room, network.clientId);
});
network.addEventListener("started", async (event) => {
  const data = (event as CustomEvent).detail;
  if (isExploring()) return;
  // Rebuild both the simulation and World: flags may roll back, and a cold welcome
  // can carry a live scene from a later chapter than the last durable checkpoint.
  const wasRunning = running, yaw = renderer.yaw, pitch = renderer.pitch;
  const recovered = prepareAdventureRecovery(data.save, data.snapshot,
    wasRunning && network.isHost && sim ? sim.exportResumeSave() : undefined);
  controls.reset();
  await begin(recovered, false);
  if (wasRunning) { renderer.yaw = yaw; renderer.pitch = pitch; }
});
network.addEventListener("input", (event) => {
  const d = (event as CustomEvent).detail;
  if (running && !isExploring() && network.isHost && sim)
    sim.command(d.role, d.input);
});
network.addEventListener('input-sent',event=>{const d=(event as CustomEvent).detail;guestMotion.sent(d.stamp,d.at);});
network.addEventListener("snapshot", (event) => {
  const d = (event as CustomEvent).detail;
  if (d?.v === 2 && !isExploring() && !network.isHost) {remote = d;guestMotion.received(d);}
});
network.addEventListener("status", (event) => {
  const d = (event as CustomEvent).detail;
  if (!isExploring()) {
    ui.status(d.state === "online" ? "伙伴已连接" : d.message);
    if (running && d.state !== "online") {
      guestMotion.reset();
      controls.reset();
      sim?.resetMovement(true,undefined,false);
      if(d.state==='paused'){for(const m of network.room?.players??[])if(!m.connected&&m.role)sim?.resetMovement(true,m.role);}
      else sim?.resetMovement(true,role);
      if(sim?.state.story){resetStoryVotes(sim.state.story);sim.dirty=true;}
      ui.toast(d.message + "，世界已暂停");
    }
    if (d.state === "online" && running && sim?.dirty) void saveNow();
  }
});
network.addEventListener("saved", () => {
  if (
    network.save &&
    sim &&
    !isExploring() &&
    sim.save.adventureId === network.save.adventureId
  )
    sim.save.revision = network.save.revision;
  refreshContinue();
});
network.addEventListener("save-status", (event) => {
  if (!running || isExploring()) return;
  const status = (event as CustomEvent).detail.status;
  if (status === "memory") {
    const message = "本机写入失败，服务器确认前最新进度仅在当前页面。请勿刷新，可导出当前进度备份。";
    if (saveFailure !== message) ui.toast(message);
    saveFailure = message;
    ui.status(modePaused() ? "冒险已暂停" : "伙伴已连接", "本机未保存 · 等待服务器确认");
  } else if (status === "local") {
    ui.status(modePaused() ? "冒险已暂停" : "伙伴已连接", "待同步记录已写入本机 · 等待服务器确认");
  }
});
network.addEventListener("error", (event) =>
  ui.toast((event as CustomEvent).detail.message),
);
network.addEventListener("closed", () => {
  if (isExploring()) return;
  running = false;
  renderer.menu = true;
  controls.enabled = false;
  ui.mode("home");
  ui.close();
  ui.toast("房间已结束，冒险存档仍然保留");
});
const nearCamp = () => {
  if (isFreeExploring()) return true;
  const s = state();
  if (!s) return false;
  const c = getRegionChapter(s.regionId ?? s.chapterId);
  return (
    Math.hypot(s.players[role].x - c.camp.x, s.players[role].z - c.camp.z) < 8
  );
};
function equip(key: string, value: string) {
  const s = state(),
    save = activeSave();
  if (!s || !save || !nearCamp()) return;
  const command: Command = { x: 0, z: 0, actions: [] };
  if (key === "weapon") command.weapon = value;
  if (isExploring()) {
    bare = false;
    renderer.bare = false;
  }
  if (key === "skin") command.skin = value;
  if (key.startsWith("skill")) {
    command.skills = [...s.players[role].skills];
    command.skills[Number(key.slice(-1))] = value;
  }
  if (isExploring() || network.isHost) {
    sim?.command(role, command);
    void saveNow();
    ui.equipment(sim!.save, role, true, isExploring(), bare);
  } else {
    network.sendInput(command as any);
    setTimeout(() => {
      const current = state();
      if (current && network.save) {
        const preview = structuredClone(activeSave()!);
        preview.players[role].weaponId = current.players[role].weapon;
        preview.players[role].skinId = current.players[role].skin;
        preview.players[role].skillIds = current.players[role].skills;
        ui.equipment(preview, role, true);
      }
    }, 200);
  }
}
ui.root.addEventListener("goulai-page-turn", () => { startAudio(); audio.sfx("ui"); });
function showSettings() {
  ui.settings({
    ...settings,
    fullscreen: !!document.fullscreenElement,
    exploration: isExploring(),
    coopExploration: gameMode==='coop-exploration',
    running,
  });
  document.querySelector("#music-volume")?.addEventListener("input", (e) => {
    settings.music = Number((e.target as HTMLInputElement).value) / 100;
    audio.setVolumes(settings.music, settings.sfx);
    safeSet("starlight-settings", JSON.stringify(settings));
  });
  document.querySelector("#sfx-volume")?.addEventListener("input", (e) => {
    settings.sfx = Number((e.target as HTMLInputElement).value) / 100;
    audio.setVolumes(settings.music, settings.sfx);
    audio.sfx("pickup");
    safeSet("starlight-settings", JSON.stringify(settings));
  });
  document.querySelector('#look-sensitivity')?.addEventListener('input',e=>{
    settings.sensitivity=Number((e.target as HTMLInputElement).value)/100;controls.sensitivity=settings.sensitivity;
    document.querySelector('#look-sensitivity-value')!.textContent=Math.round(settings.sensitivity*100)+'%';
    safeSet('starlight-settings',JSON.stringify(settings));
  });
  document.querySelector("#quality")?.addEventListener("change", (e) => {
    settings.quality = (e.target as HTMLSelectElement).value;
    renderer.setQuality(settings.quality);
    safeSet("starlight-settings", JSON.stringify(settings));
  });
}
ui.onAction = async (id, value) => {
  startAudio();
  audio.sfx("ui");
  try {
    if (id.startsWith("equip-")) {
      equip(id.slice(6), value!);
      return;
    }
    switch (id) {
      case 'field-menu': {const s=state();if(s)fieldUI.menu(s,role);break;}
      case 'field-start':
      case 'field-accept':
      case 'field-cancel': {
        const s=state();if(!s)break;const [siteId,choice]=(value??'').split('|');
        const field:FieldCommand=id==='field-start'?{kind:'start',siteId,solo:choice==='solo'}:{kind:id==='field-accept'?'accept':'cancel',id:s.fieldPlay?.id??0};
        controls.reset();ui.close();const cmd:Command={x:0,z:0,actions:[],field};if(isExploring()||network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);break;
      }
      case 'pet-menu': {if(!renderer.pet.ready)void renderer.pet.prepare().catch(()=>ui.toast(renderer.pet.error));const s=state();if(s&&petAvailable(s,role,renderer.world)){controls.reset();ui.petMenu(s);}break;}
      case 'animal-menu': {const s=state(),a=s&&!modePaused()?nearbyAnimal(s,renderer.world,role):undefined;if(a){if(isHomePetId(a.id))renderer.homePets.retry(a.id);controls.reset();ui.animalMenu(a,animalTargets(s!,renderer.world).filter(a=>reachableAnimal(s!,renderer.world,s!.players[role],a)),s!.golden?.revision,isHomePetId(a.id)?s!.homePets?.[a.id]?.revision:0);}break;}
      case 'animal-select': {const s=state();if(!s||modePaused())break;const targets=animalTargets(s,renderer.world).filter(a=>reachableAnimal(s,renderer.world,s.players[role],a)),a=targets.find(a=>a.id===value);if(a){if(isHomePetId(a.id))renderer.homePets.retry(a.id);ui.animalMenu(a,targets,s.golden?.revision,isHomePetId(a.id)?s.homePets?.[a.id]?.revision:0);}break;}
      case 'animal-greet':
      case 'animal-pet':
      case 'animal-follow':
      case 'animal-stay':
      case 'animal-home':
      case 'animal-play': {const s=state();if(!s||modePaused())break;const goldenRevision=Number(document.querySelector('[data-golden-revision]')?.getAttribute('data-golden-revision'));controls.reset();ui.close();const cmd:Command={x:0,z:0,actions:[],animal:{id:value!,kind:id==='animal-follow'?'follow':id==='animal-stay'?'stay':id==='animal-home'?'home':id==='animal-greet'?'greet':id==='animal-pet'?'pet':'play',...(['animal-follow','animal-stay','animal-home'].includes(id)?{revision:goldenRevision}:{})}};if(isExploring()||network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);break;}
      case 'pet-follow':
      case 'pet-home': {const s=state();if(!s?.pet||modePaused())break;controls.reset();ui.close();const cmd:Command={x:0,z:0,actions:[],pet:{kind:id==='pet-follow'?'follow':'home',revision:Number(value)}};if(isExploring()||network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);break;}
      case 'duo-menu': {
        const s=state();if(s&&duoAvailable(s,renderer.world)){controls.reset();ui.duoMenu(role,s.regionId);}break;
      }
      case 'duo-invite':
      case 'duo-accept':
      case 'duo-reject':
      case 'duo-cancel': {
        const s=state();if(!s||modePaused())break;
        const duo:import('../shared/duo').DuoCommand=id==='duo-invite'?{kind:'invite',type:value==='ride'?'ride':'cuddle'}:{kind:id==='duo-accept'?'accept':id==='duo-reject'?'reject':'cancel',id:s.duo?.id??0};
        const cmd:Command={x:0,z:0,actions:[],duo};controls.reset();ui.close();
        if(network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);break;
      }
      case 'home-lights': {
        if(!running||state()?.regionId!=='player-home-villa'||modePaused())break;
        controls.reset();document.exitPointerLock?.();
        const command={x:0,z:0,actions:[],homeLights:state()?.homeLights===false};
        if(network.isHost||isExploring())sim?.command(role,command);else network.sendInput(command);
        break;
      }
      case 'story-replay': {
        const saved=network.save?.world.snapshot as unknown as Snapshot|undefined;
        const unlocked=(!isExploring()?state()?.story:undefined)?.completed??saved?.story?.completed??[];
        storyReader.openReplay(value!,unlocked);controls.reset();break;
      }
      case "create":
      case "create-coop":
        if (busy) return;
        gameMode = id === 'create-coop' ? 'coop-exploration' : 'adventure';
        network.selectMode(gameMode);
        busy = true;
        startAudio();
        ui.toast("正在点亮房间…");
        try {
          await network.createRoom(network.credentials ?? undefined);
        } finally {
          busy = false;
        }
        break;
      case "continue":
      case "continue-coop":
        gameMode = id === 'continue-coop' ? 'coop-exploration' : 'adventure';
        network.selectMode(gameMode);
        if (network.credentials) {
          await network.loadAdventure();
          await network.createRoom(network.credentials);
        }
        break;
      case "explore":
        selectedRole = explorationSave?.role ?? "gold";
        chooseExplorer();
        break;
      case "explore-role":
        selectedRole = value as DogRole;
        chooseExplorer();
        break;
      case "explore-start":
        startExploration();
        break;
      case "continue-explore":
        selectedRole = explorationSave?.role ?? "gold";
        startExploration();
        break;
      case "explore-region":
        if (sim && isExploring()) {
          sim.setExplorationRegion(value!);
          renderer.load(sim.chapter, sim.state.regionId);
          for (const flag of sim.state.flags) renderer.world.markFound(flag);
          if(renderer.world.regionId===sim.state.regionId)sim.setMovementWorld(renderer.world);
          controls.reset();
          renderer.preview = false;
          ui.close();
          await saveNow();
        }
        break;
      case "camera-reset":
        renderer.yaw = state()?.players[role].yaw ?? 0;
        renderer.pitch = 0.17;
        renderer.zoomDistance = 8.8;
        break;
      case "toggle-outfit":
        bare = !bare;
        renderer.bare = bare;
        ui.equipment(activeSave()!, role, nearCamp(), true, bare);
        break;
      case "join":
        gameMode = "adventure";
        ui.join();
        break;
      case "join-confirm":
        if (busy) return;
        busy = true;
        try {
          await network.joinRoom(
            document.querySelector<HTMLInputElement>("#room-code")!.value,
          );
        } finally {
          busy = false;
        }
        break;
      case "role":
        network.selectRole(value as DogRole);
        break;
      case "ready":
        network.ready(
          !network.room?.players.find((p) => p.clientId === network.clientId)
            ?.ready,
        );
        break;
      case "start":
        network.start();
        break;
      case "copy-code":
        try {
          await navigator.clipboard.writeText(network.room?.code ?? "");
          ui.toast("房间码已复制");
        } catch {
          ui.toast("房间码：" + network.room?.code);
        }
        break;
      case "close":
        if(state()?.fieldPlay?.phase==='invited'&&document.querySelector('#modal-layer.field-view')){const cmd:Command={x:0,z:0,actions:[],field:{kind:'cancel',id:state()!.fieldPlay!.id}};if(isExploring()||network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);}
        if(state()?.duo?.phase==='invited'&&document.querySelector('#modal-layer.duo-view')){
          const cmd:Command={x:0,z:0,actions:[],duo:{kind:'cancel',id:state()!.duo!.id}};
          if(network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);
        }
        if (state()?.travel && document.querySelector("#modal-layer.travel-view")) {
          const cmd:Command={x:0,z:0,actions:[],travelResponse:"cancel"};
          if (isExploring() || network.isHost) sim?.command(role,cmd); else network.sendInput(cmd as any);
        }
        ui.close();
        renderer.preview = false;
        renderer.characterPreview = null;
        controls.reset();
        break;
      case "equipment":
        if (!running) {
          ui.toast("进入冒险后，在营火旁打开行囊");
          break;
        }
        renderer.preview = nearCamp();
        ui.equipment(activeSave()!, role, nearCamp(), isExploring(), bare);
        break;
      case "map":
        if (running && state()) ui.worldMap(state()!, isFreeExploring() ? allowedExplorationRegions() : allowedRegions(activeSave()), role);
        break;
      case "map-destination":
        if (state()) ui.destination(value!, state()!, isFreeExploring() ? allowedExplorationRegions() : allowedRegions(activeSave()));
        break;
      case "travel-map":
        if (state()) {
          const cmd:Command={x:0,z:0,actions:[],travel:{regionId:value!,method:"map"}};
          ui.close(); controls.reset();
          if (isExploring() || network.isHost) sim?.command(role,cmd); else network.sendInput(cmd as any);
        }
        break;
      case "travel-accept":
      case "travel-cancel": {
        const cmd:Command={x:0,z:0,actions:[],travelResponse:id==="travel-accept"?"accept":"cancel"};
        ui.close();controls.reset();
        if (isExploring() || network.isHost) sim?.command(role,cmd); else network.sendInput(cmd as any);
        break;
      }
      case "journal":
        if (running && isExploring() && developerPreview)
          ui.regions(
            allowedExplorationRegions(
              network.save ?? undefined,
              developerPreview,
            ),
            state()!.chapterId,
            developerPreview,
          );
        else
          ui.journal(
            running ? activeSave() : network.save,
            running ? (state() ?? undefined) : undefined,
          );
        {
          const saved=network.save?.world.snapshot as unknown as Snapshot|undefined;
          const unlocked=(!isExploring()?state()?.story:undefined)?.completed??saved?.story?.completed??[];
          const links=storyLinks(unlocked);if(links)document.querySelector('#modal-layer .modal')?.insertAdjacentHTML('beforeend',`<details class="story-library"><summary>已读故事</summary>${links}</details>`);
        }
        break;
      case "audio":
        startAudio();
        showSettings();
        break;
      case "game-menu":
        controls.reset();
        ui.gameMenu();
        break;
      case "settings":
        showSettings();
        break;
      case "diagnostics": {
        const report={version:'0.18.8',time:new Date().toISOString(),mode:running?gameMode:'title',role,host:network.isHost,browser:navigator.userAgent,cores:navigator.hardwareConcurrency,webgl:renderer.engine.webGLVersion,graphics:renderer.engine.getGlInfo(),homeFrames:homeFrames.snapshot(),render:[renderer.engine.getRenderWidth(),renderer.engine.getRenderHeight()],quality:renderer.qualityMetrics,inputLock:inputLock(),network:network.diagnostics,prediction:guestMotion.metrics};
        const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Two Tails_连接与画面诊断.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);ui.toast('诊断已导出，包含性能与连接计数，不含口令或存档');break;
      }
      case "help":
        ui.help();
        break;
      case "fullscreen":
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen();
          } catch {
            ui.toast("此浏览器未允许全屏。可通过分享菜单添加到主屏幕。");
          }
        } else
          ui.toast(
            "Safari 可通过分享菜单「添加到主屏幕」，获得更大的游戏画面。",
          );
        break;
      case "export": {
        // Export is the recovery route when either storage or the network is broken.
        // Capture the live state immediately; do not wait for another failing save.
        let text: string;
        const liveAdventure = running && !isExploring() && network.isHost && sim;
        if (isExploring() && sim) {
          text = exportExplorationBackup(
            sim.exportExploration({
              camera: {
                yaw: renderer.yaw,
                pitch: renderer.pitch,
                distance: renderer.zoomDistance,
              },
              preferences: explorationPreferences(),
            }),
          );
        } else {
          text = network.exportBackup(liveAdventure ? liveAdventure.exportSave() : undefined);
        }
        const url = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download =
          (isExploring() ? "Two Tails-单人探索-" : liveAdventure || network.pendingStatus !== "none" ? "Two Tails-双人冒险-当前进度备份-" : "Two Tails-双人冒险-") +
          new Date().toLocaleDateString("sv-SE", {
            timeZone: "Australia/Brisbane",
          }) +
          ".json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        ui.toast(
          isExploring()
            ? "单人探索备份已导出"
            : liveAdventure || network.pendingStatus !== "none"
              ? "当前进度备份已导出；这不表示服务器已确认，请妥善保管"
              : "双人冒险备份已导出，请妥善保管",
        );
        break;
      }
      case "import": {
        if (running) {
          ui.toast("请先保存并回到标题，再恢复备份");
          break;
        }
        const input = document.querySelector<HTMLInputElement>("#backup-file")!;
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return;
          try {
            const text = await f.text();
            if (JSON.parse(text).format === "starlight-exploration") {
              const next = parseExplorationBackup(text);
              preserveBeforeImport("starlight-exploration-v1");
              writeExploration(localStorage, next);
              explorationSave = next;
              ui.toast("已恢复单人探索；双人进度未改变");
            } else {
              const backup = parseBackup(text);
              if (backup.save.adventureId.startsWith("practice-")) {
                const raw = JSON.stringify(backup.save);
                const importedKey =
                  "starlight-practice-import:" +
                  Date.now() +
                  ":" +
                  crypto.randomUUID();
                if (
                  !safeSet(importedKey, raw) ||
                  localStorage.getItem(importedKey) !== raw
                )
                  throw new Error("旧练习备份未能保存，未改动现有记录");
                const next = migrateLegacyPractice(raw, network.save);
                preserveBeforeImport("starlight-exploration-v1");
                writeExploration(localStorage, next);
                explorationSave = next;
                ui.toast("已迁移旧练习的位置与装扮；原记录和双人进度均保留");
              } else {
                await network.importBackup(text);
                ui.toast("双人冒险备份已校验并恢复");
              }
            }
            refreshContinue();
            ui.close();
          } catch (e) {
            ui.toast((e as Error).message);
          }
        };
        input.click();
        break;
      }
      case "site-logout": {
        if (saveInFlight && !(await saveInFlight) || !(await saveNow())) { showSaveFailure(); break; }
        running = false; controls.enabled = false; controls.reset(); network.disconnect();
        const form = document.createElement("form"); form.method = "post"; form.action = "/access/logout"; document.body.appendChild(form); form.submit();
        break;
      }
      case "home":
        if (saveInFlight && !(await saveInFlight)) {
          showSaveFailure();
          break;
        }
        if (!(await saveNow())) {
          showSaveFailure();
          break;
        }
        running = false;
        controls.enabled = false;
        controls.reset();
        renderer.menu = true;
        renderer.characterPreview = null;
        renderer.visibleRoles = ["gold", "white"];
        renderer.bare = true;
        renderer.preview = false;
        if (!isExploring()) network.disconnect();
        gameMode = "adventure";
        sim = null;
        remote = null;
        ui.mode("home");
        ui.close();
        ui.hideDialogue();
        refreshContinue();
        audio.setMood("village", false);
        break;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "已取消上一次联机操作")
      return;
    ui.toast(
      error instanceof Error ? error.message : "这一步没能完成，请稍后再试",
    );
  }
};
storyReader.onCommand=command=>{
  if(!running||isExploring()||modePaused())return;
  const input={x:0,z:0,actions:[],story:command};
  if(network.isHost)sim?.command(role,input);else network.sendInput(input as any);
};
storyReader.onSave=()=>{if(network.isHost)void saveNow();else ui.toast('请房主在当前故事页重试保存');};
renderer.setQuality(settings.quality);
controls.onZoom = delta => renderer.zoom(delta);
document.addEventListener('goulai-region-ready',()=>{if(renderer.world.regionId===state()?.regionId)sim?.setMovementWorld(renderer.world);});
controls.onShortcut = shortcut => {
  if (storyReader.isOpen) { if (shortcut === 'escape') storyReader.dismissReplay(); return; }
  if (shortcut === 'escape') {
    if (ui.modalOpen) void ui.onAction('close');
    else if (ui.dialogueOpen) ui.hideDialogue();
    else if (running) void ui.onAction('settings');
    return;
  }
  if (!running || ui.dialogueOpen) return;
  if (ui.modalOpen) {
    if (document.querySelector(`#modal-layer.${shortcut === 'map' ? 'map' : 'journal'}-view`)) void ui.onAction('close');
    return;
  }
  void ui.onAction(shortcut);
};
// Native form controls keep their keys. Tab stays within the highest open panel.
window.addEventListener('keydown', event => {
  if (event.code !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
  const layer = storyReader.isOpen ? storyReader.root : ui.modalOpen ? document.querySelector<HTMLElement>('#modal-layer') : ui.dialogueOpen ? document.querySelector<HTMLElement>('#dialogue') : null;
  if (!layer) return;
  const items = [...layer.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el => el.getClientRects().length > 0);
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1) {
    event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus();
  }
});
if (
  ["migrated", "invalid", "migration-failed"].includes(explorationRead.status)
)
  ui.toast(explorationRead.message);
const motionAudio=new MotionAudio();let windowFocused=true;
let zoneRetreatRequested=false;
let lastStudioSafe:{regionId:string;x:number;y:number;z:number}|undefined;
let preparedLoad=0,failedLoad=0,zonePromise:Promise<void>|null=null;
const loadCommand=(c:RegionLoadCommand)=>{const cmd={x:0,z:0,actions:[],regionLoad:c};if(isExploring()||network.isHost)sim?.command(role,cmd);else network.sendInput({...cmd,regionLoad:{...c}});};
function sceneLoadOverlay(text:string){let e=document.getElementById('studio-loading');if(!e){e=document.createElement('section');e.id='studio-loading';e.className='studio-loading';e.setAttribute('role','status');document.body.append(e);}e.textContent=text;return e;}
function driveRegionPreparation(s:Snapshot){const pending=s.regionLoad;if(!pending){if(preparedLoad&&renderer.world.regionId===s.regionId)renderer.discardPreparedRegion();if(preparedLoad||failedLoad)document.getElementById('studio-loading')?.remove();preparedLoad=0;failedLoad=0;return false;}
 controls.enabled=false;controls.reset();audio.updateFlight(null,false);motionAudio.reset();
 if(pending.failed){if(failedLoad!==pending.id){failedLoad=pending.id;renderer.discardPreparedRegion();const overlay=sceneLoadOverlay('这片风景未完整载入，仍保留原区域和进度。');for(const [label,result]of [['重试','retry'],['留在这里','cancel']] as const){const b=document.createElement('button');b.textContent=label;b.onclick=()=>loadCommand({id:pending.id,result});overlay.append(b);}}return true;}
 if(preparedLoad!==pending.id){preparedLoad=pending.id;failedLoad=0;sceneLoadOverlay('正在准备下一片风景，等伙伴一起出发…');void renderer.prepareRegion(getRegionChapter(pending.to),pending.to,pending.arrival).then(()=>{if(state()?.regionLoad?.id===pending.id)loadCommand({id:pending.id,result:'ready'});else if(!state()?.regionLoad)renderer.discardPreparedRegion();}).catch(()=>{if(state()?.regionLoad?.id===pending.id)loadCommand({id:pending.id,result:'failed'});});}return true;}

let graphicsLost=false,graphicsRecoveryTimer:ReturnType<typeof setTimeout>|undefined;
renderer.engine.onContextLostObservable.add(()=>{graphicsLost=true;controls.enabled=false;controls.reset();audio.updateAnimals('',false);sim?.resetMovement(true,role,false);audio.setMusicAudible(false);audio.updateFlight(null,false);audio.updateAmbience('',false,false,false);motionAudio.reset();if(!isExploring()&&!network.isHost)network.sendInput({x:0,z:0,actions:[]});void saveNow();let e=document.getElementById('graphics-recovery');if(!e){e=document.createElement('section');e.id='graphics-recovery';e.className='studio-loading';e.setAttribute('role','status');document.body.append(e);}e.textContent='画面连接暂时中断，操作已暂停，正在恢复…';if(graphicsRecoveryTimer)clearTimeout(graphicsRecoveryTimer);graphicsRecoveryTimer=setTimeout(()=>{if(!graphicsLost)return;e.textContent='画面尚未恢复。可以保存当前进度后重新载入。';const button=document.createElement('button');button.textContent='保存并重新载入';button.onclick=async()=>{button.disabled=true;if(await saveNow())location.reload();else{e.firstChild!.textContent='进度尚未保存，请重试保存后再重新载入。';button.disabled=false;}};e.append(button);},8000);});
renderer.engine.onContextRestoredObservable.add(()=>{graphicsLost=false;if(graphicsRecoveryTimer)clearTimeout(graphicsRecoveryTimer);document.getElementById('graphics-recovery')?.remove();controls.reset();previous=performance.now();renderer.resetAfterContextRestore();});

let lastHealth=0;
const homeFrames=new HomeFrameDiagnostics();
let previous = performance.now(),
  wasControlsEnabled = false,
  worldFlags = new Set<string>();
renderer.engine.runRenderLoop(() => {
  const now = performance.now(),
    dt = Math.min(0.05, (now - previous) / 1000);
  network.metrics.frameSample(now-previous,!!controls.enabled&&Math.hypot(state()?.players[role].speed??0)>0);
  previous = now;
  const s = state();
  homeFrames.observe(now,s?.regionLoad?.to||(renderer.loadingRegion||s?.regionId||''),!!s&&running&&controls.enabled&&!graphicsLost&&!renderer.loadingRegion&&!s.regionLoad&&!modePaused()&&!document.hidden&&windowFocused,!!s?.players[role].mounted,(s?.players[role].speed??0)>.01,document.hidden||!windowFocused?'background':graphicsLost||!!renderer.loadingRegion||!!s?.regionLoad||!!renderer.world.studio?.loading?'loading':ui.modalOpen||ui.dialogueOpen||storyReader.isOpen||modePaused()?'menu':'');
  if(graphicsLost)return;
  audio.updateAnimals(s?.regionId??'',!!s&&running&&!renderer.loadingRegion&&!s.regionLoad&&!modePaused()&&!document.hidden&&windowFocused);
  audio.setMusicAudible(!document.hidden&&windowFocused&&(!running||!modePaused()));
  if (running && s) {
    if(driveRegionPreparation(s)){if(!isExploring()&&network.isHost&&network.state==='online'&&now-lastSnapshot>100){network.sendSnapshot(()=>sim!.exportLiveSnapshot() as any);lastSnapshot=now;}if(modePaused()&&sim?.state.regionLoad)loadCommand({id:sim.state.regionLoad.id,result:'cancel'});renderer.render(dt,s);return;}
    const studio=renderer.world.studio;
    if(studio?.readyAt(s.players[role])&&renderer.world.regionId===s.regionId){const p=s.players[role];if(p.grounded)lastStudioSafe={regionId:s.regionId,x:p.x,y:p.y,z:p.z};if(zoneRetreatRequested){zoneRetreatRequested=false;document.getElementById('studio-loading')?.remove();}}
    if(renderer.world.regionId===s.regionId&&studio?.needs(s.players[role])){
      if(!zonePromise&&!studio.error){const owned=studio;zonePromise=studio.ensure(s.players[role]).then(()=>{if(renderer.world.studio===owned)document.getElementById('studio-loading')?.remove();}).catch(()=>{if(renderer.world.studio===owned&&owned.readyAt(state()!.players[role]))ui.toast('下一片风景尚未备好，可以继续在已载入的区域探索。');}).finally(()=>{if(renderer.world.studio!==owned||!owned.error)zonePromise=null;});}
      // Neighbour modules are already visible and have matching static physics.
      // Prepare the next pack in slices while normal input continues there.
      if(!studio.readyAt(s.players[role])){
        if(studio.error&&document.getElementById('studio-loading')?.dataset.failed!=='true'){
          const owned=studio,e=sceneLoadOverlay('前方场景未载入，当前位置与进度保留。');e.dataset.failed='true';
          const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>{owned.error='';zonePromise=null;e.remove();};
          const cancel=document.createElement('button');const canBack=lastStudioSafe?.regionId===s.regionId&&Math.hypot(lastStudioSafe.x-s.players[role].x,lastStudioSafe.z-s.players[role].z)<3;cancel.textContent=canBack?'返回已载入处':'保存并返回主画面';cancel.onclick=()=>{if(!canBack){document.dispatchEvent(new Event('goulai-region-cancel'));return;}const back=lastStudioSafe;if(!back||back.regionId!==s.regionId)return;zoneRetreatRequested=true;const cmd:Command={x:0,z:0,actions:[],regionStepBack:{...back}};if(isExploring()||network.isHost)sim?.command(role,cmd);else network.sendInput(cmd as any);};e.append(retry,cancel);
        }
        if(!studio.error&&!document.getElementById('studio-loading'))sceneLoadOverlay('正在铺开前方的风景…');
        controls.enabled=false;controls.reset();sim?.resetMovement(false);
        if(!isExploring()&&network.isHost&&now-lastSnapshot>100){network.sendSnapshot(()=>sim!.exportLiveSnapshot() as any);lastSnapshot=now;}
        if(!isExploring()&&!network.isHost)network.sendInput({x:0,z:0,actions:[]});renderer.render(dt,s);return;
      }
    }
    if(renderer.world.regionId!==s.regionId)renderer.load(getRegionChapter(s.regionId),s.regionId,['studio-europe-town','studio-manhattan','studio-undersea-atlantis'].includes(s.regionId)?s.players[role]:undefined);
    if(renderer.loadingRegion){audio.updateFlight(null,false);audio.updateAmbience('',false,false,false);motionAudio.reset();controls.enabled=false;controls.reset();sim?.resetMovement(false);return;}
    controls.enabled = !fieldMovementLocked(s.fieldPlay,role) && !ui.modalOpen && !ui.dialogueOpen && !storyReader.isOpen && !s.story?.active && !storyPending(s) && !modePaused() && !document.hidden && windowFocused;
    if (wasControlsEnabled && !controls.enabled) {
      controls.reset();
      document.dispatchEvent(new Event('goulai-input-block'));
      // A menu or travel invitation stops input while a broom keeps hovering.
      // Backgrounding/disconnection below explicitly uses safe-ground recovery.
      sim?.resetMovement(modePaused() || document.hidden, role, false);
    }
    wasControlsEnabled = controls.enabled;
    renderer.look(controls.look.x, controls.look.y);
    controls.look = { x: 0, y: 0 };
    const cmd = controls.enabled
      ? controls.read(renderer.viewYaw)
      : { x: 0, z: 0, actions: [] };
    if (isExploring() || network.isHost) {
      if (!modePaused() || isExploring()) {
        sim?.command(role, cmd as Command);
        if ((!isExploring() || !ui.modalOpen)&&!storyPending(s)) sim?.tick(dt);
        else if (sim) sim.state.players[role].speed = 0;
      }
      if (
        !isExploring() &&
        now - lastSnapshot > 100 &&
        network.state === "online"
      ) {
        network.sendSnapshot(()=>sim!.exportLiveSnapshot() as any);
        lastSnapshot = now;
      }
    } else if (now - lastInput > 66 && network.state === "online") {
      network.sendInput(cmd as any);
      lastInput = now;
    } else if (cmd.actions.length)
      controls.actions.push(...(cmd.actions as any));
    const updated = state()!;
    const visual=!isExploring()&&!network.isHost?guestMotion.view(updated,role,cmd as Command,dt,renderer.world,controls.enabled&&renderer.world.regionId===updated.regionId,updated.inputAcks?.[role],now):updated;
    if(!isExploring()&&!network.isHost&&guestMotion.snap)renderer.snapActor(role,visual.players[role]);
    const localFlight=updated.players[role];
    audio.updateFlight({...localFlight,region:updated.regionId},controls.enabled);
    const storyChapter=CHAPTERS.find(c=>c.id===updated.chapterId)!;
    const storyNext=storyChapter.interactions.find(i=>storyChapter.quest.steps.includes(i.id)&&!updated.flags.includes(i.id));
    const storyObjective=updated.ended?'星光回到了两个家园。旅途结束后，仍可自由探索。':storyNext?'接下来：'+storyNext.label:updated.enemies.some(e=>e.boss&&e.hp>0)?'接下来：驱散首领身上的阴影。':'接下来：和伙伴一起走向星门。';
    storyReader.update(isExploring()?undefined:updated.story,role,modePaused()||document.hidden,storyObjective,saveFailure,storyPending(updated));
    fieldUI.update(updated,role);
    ui.updateDuo(updated,role,!modePaused()&&renderer.world.regionId===updated.regionId&&duoAvailable(updated,renderer.world));
    const animalGuide:Record<string,string>={'player-home-villa':'家园里也住着袋鼠、考拉和大海龟；海龟在泳池浅石坡附近，可分别安排跟随。金毛在别墅西侧草地，可在靠近菜单选择跟随。','ch02-windmill-river':'袋鼠在水车河谷西岸、青蛙居民附近的草地。','mushroom-grove':'考拉在蘑菇林北侧溪路旁的大伞下。','studio-winter-lantern':'阿拉斯加犬在雪地入口北面的草地、森林边缘前。','studio-tideglass-cove':'海龟在海湾右侧栈桥外的近岸水面，沿岸向北走。'};
    if (updated.chapterId !== lastChapter || updated.regionId !== lastRegion) {
      const ch = getRegionChapter(updated.regionId ?? updated.chapterId);
      if (lastChapter)
        ui.message(
          isExploring()
            ? "已抵达 " + ch.title + "，自由漫游中。"+(updated.golden?.mode==='follow'&&updated.golden.regionId===updated.regionId?'金毛正在跟随你。':(updated.regionId==='player-home-villa'||updated.regionId==='studio-undersea-atlantis')&&updated.golden?.anchor&&updated.golden.anchor.regionId!==updated.regionId?'金毛在'+(getRegion(updated.golden.anchor.regionId)?.name??'它停留的地方')+'等你，可从地图返回找它。':animalGuide[updated.regionId]??'')
            : ch.intro.join(" "),
        );
      if(lastRegion&&updated.regionId==='player-home-villa'){renderer.yaw=Math.PI;renderer.pitch=.17;}
      renderer.load(ch, updated.regionId,updated.regionId==='studio-undersea-atlantis'?updated.players[role]:undefined);
      if (lastRegion) ui.transition(getRegion(updated.regionId)?.name ?? ch.title);
      ui.hideDialogue();
      for (const flag of updated.flags) renderer.world.markFound(flag);
      if(renderer.world.regionId===updated.regionId)sim?.setMovementWorld(renderer.world);
      controls.reset();
      worldFlags = new Set(updated.flags);
      lastChapter = updated.chapterId;
      lastRegion = updated.regionId;
      lastEvent = 0;
      audio.setMood(ch.biome, false, updated.regionId,updated.players[role]);

    }
    if (updated.travel && updated.travel.id !== lastTravel) {
      lastTravel = updated.travel.id; controls.reset(); ui.travelPrompt(updated,role);
    } else if (!updated.travel && lastTravel) {
      lastTravel=0; if (document.querySelector("#modal-layer.travel-view")) ui.close();
    }
    for (const event of updated.events) {
      if (event.id <= lastEvent) continue;
      renderer.effect(event);
      const sounds: Record<string, string> = {
        slash: "sword",
        magic: "magic",
        hit: "hit",
        damage: "hurt",
        defeat: "win",
        burst: "nova",
        heal: "heal",
        dodge: "dodge",
        discover: "pickup",
        warning: "telegraph",

        mount: "magic",
        region: "pickup",
        "journey-chime": "journey-chime",
        "journey-water": "journey-water",
        "castle-bell": "castle-bell",
      };
      if (sounds[event.type]) audio.sfx(sounds[event.type], event.value);
      if(event.type==='animal-call')audio.animalCall(event.text,event,updated.players[role]);
      if (event.text) {
        if(event.type==='field-message')ui.message(event.text);
        else if (["message", "dialogue"].includes(event.type)) {
          const ch=getRegionChapter(updated.regionId ?? updated.chapterId);
          const speaker=[...journeyNodes(updated.regionId ?? updated.chapterId), ...ch.interactions].find(i=>(i.kind === "npc" || event.type === "dialogue") && Math.hypot(i.x-event.x,i.z-event.z)<1.5);
          if (speaker || event.type === "dialogue") {
            const identity = speaker?.portrait ?? (speaker ? residentIdentity(speaker.id, ch.biome === "river" ? "frog" : ["graveyard", "castle"].includes(ch.biome) ? "mouse" : "badger") : "forester");
            ui.dialogue(speaker?.speaker ?? speaker?.label ?? "林间留言",event.text,identity);
          } else ui.message(event.text);
        } else if (["ending", "chapter"].includes(event.type)) ui.message(event.text);
        else if (["unlock", "discover", "pet", "animal-response", "water-transition"].includes(event.type))
          ui.toast(event.text);
      }
      if (event.type === "ending"&&!updated.story?.active) {
        ui.modal(
          "每一个家，都值得亮起来",
          "星光没有被谁独占。它回到了村庄，也重新流向龙的栖地。",
          `<p class="fine">两只小狗回到灯火村。窗台上的面包还是温热的，门口多了一封来自云山的信。</p><button class="primary full" data-ui="home">把这个故事留在行囊里 →</button>`,
        );
      }
      lastEvent = event.id;
    }
    if (updated.flags.includes("r-plate-east") && !worldFlags.has("r-plate-east")) audio.sfx("windmill");
    worldFlags = new Set(updated.flags);
    const p = updated.players[role];
    const walker=updated.duo?.phase==='active'&&updated.duo.type==='ride'?visual.players.white:visual.players[role];
    for(const event of motionAudio.update(walker,updated.regionId,renderer.world,controls.enabled))audio.sfx(event.name,event.value);
    const indoor=!!getRegion(updated.regionId)?.indoor||renderer.world.interiorAt(p);
    audio.updateAmbience(updated.regionId,indoor,weatherAt(updated.time,updated.regionId).daylight<.25,controls.enabled,p,updated.time);
    const battle = updated.enemies.some(
      (e) =>
        e.hp > 0 && e.state !== "idle" && Math.hypot(e.x - p.x, e.z - p.z) < 16,
    );
    audio.setMood(
      getRegionChapter(updated.regionId ?? updated.chapterId).biome,
      battle,
      updated.regionId,p,
    );
    if (now - lastHud > 120) {
      const nearby = sim ? sim.nearby(role) : nearbyInteraction({ state: updated, world: renderer.world }, role);
      ui.hud(updated, role, nearby, isExploring());
      ui.updatePet(updated,role,!modePaused()&&renderer.world.regionId===updated.regionId&&petAvailable(updated,role,renderer.world));
      ui.updateAnimal(!modePaused()&&renderer.world.regionId===updated.regionId?nearbyAnimal(updated,renderer.world,role):undefined);
      lastHud = now;
    }
    if ((sim?.dirty && !saveFailure && now - lastSave > (storyPending(updated)?250:1800)) || now - lastSave > 15000)
      void saveNow();
    renderer.render(dt, visual);
    if(now-lastHealth>2000){lastHealth=now;const d=network.diagnostics;const hint=renderer.engine.getFps()<24?'画面较忙':!isExploring()&&d.state==='online'&&d.inputToHostAckMs.p50>280?'连接稍慢，正在同步':'';const e=document.getElementById('play-health');if(e){e.textContent=hint;e.hidden=!hint;}}
  } else {motionAudio.reset();audio.updateAmbience('',false,false,false);fieldUI.update(null,role);audio.updateFlight(null,false);storyReader.update(undefined,role,false,'','');renderer.render(dt, null);}
});
document.addEventListener('goulai-region-cancel',()=>{document.querySelector<HTMLElement>('#topbar [data-ui=home]')?.click();});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    controls.reset();
    sim?.resetMovement(true, role, false);
    void saveNow();
  } else {
    previous = performance.now();
  }
});
window.addEventListener("focus",()=>{windowFocused=true;});
window.addEventListener("blur", () => {
  windowFocused=false;audio.setMusicAudible(false);audio.updateFlight(null,false);audio.updateAmbience('',false,false,false);motionAudio.reset();
  controls.reset();
  sim?.resetMovement(true, role, false);
  if (!isExploring() && running && !network.isHost) network.sendInput({ x: 0, z: 0, sprint: false, actions: [] });
});
window.addEventListener("beforeunload", (event) => {
  if (!running) return;
  let unsafe = !!saveFailure || network.pendingStatus === "memory";
  if (isExploring() && sim) {
    try {
      persistExploration();
      unsafe = false;
    } catch {
      unsafe = true;
    }
  }
  if (unsafe) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("pagehide", () => {
  if (isExploring() && sim) {
    try {
      persistExploration();
    } catch {}
  }
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
// Read-only metrics are intentionally separate from gameplay and contain no credentials.
// Development-only fixtures; stripped from the private production build.
if (import.meta.env.DEV && (developerPreview || new URLSearchParams(location.search).get('inspect-runtime') === '1')) Object.defineProperty(window,'__goulaiQA',{get:()=>({sim,renderer,audio,controls,state:state()})});
const inputLock=()=>({graphicsLost,loading:renderer.loadingRegion,preparing:!!state()?.regionLoad,studioLoading:!!renderer.world.studio?.loading,modal:ui.modalOpen,hidden:document.hidden,focused:windowFocused,enabled:controls.enabled});
Object.defineProperty(window, "starlightMetrics", {
  get: () => ({
    fps: Math.round(renderer.engine.getFps()),
    meshes: renderer.scene.meshes.length,
    materials: renderer.scene.materials.length,
    textures: renderer.scene.textures.length,
    vertices: renderer.scene.getTotalVertices(),
    chapter: state()?.chapterId,
    region: state()?.regionId,
    discoveredRegions: state()?.discoveredRegions,
    regionLoad:state()?.regionLoad?structuredClone(state()!.regionLoad):undefined,
    studio:renderer.world.studio?{resources:'metrics'in renderer.world.studio?renderer.world.studio.metrics:undefined,zone:renderer.world.studio.zone,ready:renderer.world.studio.ready,error:renderer.world.studio.error,timings:renderer.world.studio.timings,calibration:renderer.world.studio.calibration,roadSurface:'roadMetrics'in renderer.world.studio?renderer.world.studio.roadMetrics:undefined,skylineAdaptation:'skylineAdaptation'in renderer.world.studio?renderer.world.studio.skylineAdaptation:undefined}:undefined,
    fieldbook:state()?structuredClone(state()!.fieldbook):undefined,
    fieldPlay:state()?.fieldPlay?structuredClone(state()!.fieldPlay):undefined,
    broomOwned: state()?.broomOwned,
    pet:state()?.pet?structuredClone(state()!.pet):undefined,
    animals:[...(renderer.world.animals?.metrics??[]),...(state()?.golden?.regionId===state()?.regionId&&renderer.golden.ready?[{id:'golden-retriever',version:'golden-retriever-studio-01',position:renderer.golden.root.position.asArray(),pose:state()?.golden?.pose,visible:renderer.golden.root.isEnabled(),clips:renderer.golden.metrics.clips}]:[])],
    homePets:state()?.homePets?structuredClone(state()!.homePets):undefined,homePetActors:renderer.homePets.metrics,
    golden:state()?.golden?structuredClone(state()!.golden):undefined,
    animalAudio:audio.animalAudioMetrics,
    animalCare:state()?.animalCare?structuredClone(state()!.animalCare):undefined,
    homeLights:state()?.homeLights!==false,
    homeUse:state()?Object.fromEntries(Object.entries(state()!.players).map(([r,p])=>[r,p.homeUse?structuredClone(p.homeUse):null])):undefined,
    duo:state()?.duo?structuredClone(state()!.duo):undefined,
    travel: state()?.travel ? { ...state()!.travel } : undefined,
    story: state()?.story?structuredClone(state()!.story):undefined,
    mode: running ? gameMode : "title",
    inputMode: controls.mode,
    clouds: renderer.cloudMetrics,
    sceneFrames: renderer.scene.getFrameId(),
    role,
    health: running ? state()?.players[role].hp : undefined,
    defeated: running
      ? state()
          ?.enemies.filter((e) => e.hp <= 0)
          .map((e) => e.id)
      : undefined,
    position: running
      ? { x: state()?.players[role].x, y: state()?.players[role].y, z: state()?.players[role].z }
      : undefined,
    combat: running && new URLSearchParams(location.search).get("inspect-combat") === "1" && state()
      ? {
          activeRoles: [...(state()!.activeRoles ?? ["gold", "white"])],
          flags: [...state()!.flags], checkpoint: {...state()!.checkpoint}, ended: state()!.ended,
          journeys: structuredClone(state()!.journeys),
          journeyProposal: state()!.journeyProposal ? {...state()!.journeyProposal} : undefined,
          renderedPlayers: Object.fromEntries(Object.entries(renderer.dogs).map(([key,dog])=>[key,{x:dog.root.position.x,y:dog.root.position.y,z:dog.root.position.z}])),
          players: Object.fromEntries(Object.entries(state()!.players).map(([dog, p]) => [dog, {
            role: dog, weaponDrawn:p.weaponDrawn!==false, x: p.x, y: p.y, z: p.z, vy: p.vy, grounded: p.grounded, sprinting: p.sprinting, mounted:p.mounted, flight:p.flight, swim:p.swim,waterId:p.waterId,safeX:p.safeX, safeY:p.safeY, safeZ:p.safeZ, hp: p.hp, action: p.action,
          }])),
          enemies: state()!.enemies.map(e => ({
            id: e.id, kind: e.kind, x: e.x, y:e.y, z: e.z, hp: e.hp,
            boss: e.boss, elite: e.elite, state: e.state, timer: e.timer, pattern: e.pattern, exposed: e.exposed, telegraphs: e.telegraphs.map(mark => ({...mark})),
          })),
        }
      : undefined,
    locomotion: running ? { swim:state()?.players[role].swim,waterId:state()?.players[role].waterId,mounted: state()?.players[role].mounted, flight: state()?.players[role].flight, grounded: state()?.players[role].grounded, vy: state()?.players[role].vy, sprinting: state()?.players[role].sprinting, speed: state()?.players[role].speed, landing: state()?.players[role].landing } : undefined,
    camera: { actorCoverage:renderer.actorCoverage, yaw: renderer.viewYaw, targetYaw:renderer.yaw, pitch: renderer.pitch, sensitivity:controls.sensitivity, distance: renderer.zoomDistance, position: renderer.camera.position.asArray(), rotation: renderer.camera.rotation.asArray(), fov: renderer.camera.fov },
    quality:renderer.qualityMetrics,
    network:network.diagnostics,prediction:guestMotion.metrics,
    inputLock:inputLock(),
    renderWidth: renderer.engine.getRenderWidth(),
    renderHeight: renderer.engine.getRenderHeight(),
  }),
});
