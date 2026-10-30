import {waterColumn} from '../shared/swimming';
import {isHomePetId} from '../shared/home-pets';
import { storybookHome, charm, applyStorybookControls } from './ui-storybook';
import {fieldHidesPartner} from '../shared/fieldbook';
import {rideAllowedInRegion} from '../shared/duo';
import { CHAPTERS } from "./content";
import { REGIONS, REGION_CONNECTIONS, getRegion, getRegionChapter, isStoryRegion } from "./regions";
import { icon, mapDrawing, controlPad } from "./ui-art";
import { journalPages, settingsPages } from "./ui-pages";
import { weatherAt } from "./world-weather";
import { CHARACTER_NAMES } from "../shared/characters";
import type { Snapshot } from "./simulation";
import type { DogRole, AdventureSave } from "../shared/save";
import type { ExplorationSave } from "./exploration";
import type { RoomView } from "../shared/protocol";
const dogPortrait = (role: DogRole) => `/assets/ui/storybook-0.4.1/${role}.png`;
const star =
  '<svg viewBox="0 0 24 24" fill="none"><path d="m12 2 2.8 6.3L22 9l-5.3 4.7 1.6 7-6.3-3.6L5.7 21l1.6-7L2 9l7.2-.7L12 2Z" fill="currentColor"/></svg>';
const paw =
  '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="16" rx="6.5" ry="5"/><ellipse cx="4.5" cy="9.4" rx="2.8" ry="3.4" transform="rotate(-25 4.5 9.4)"/><ellipse cx="9.4" cy="5.7" rx="2.6" ry="3.2"/><ellipse cx="15.4" cy="5.7" rx="2.6" ry="3.2"/><ellipse cx="20" cy="9.4" rx="2.5" ry="3.4" transform="rotate(25 20 9.4)"/></svg>';
const icons = {
  sword: "⚔",
  staff: "✧",
  bow: "➶",
  chime: "♧",
  spark: "✦",
  heal: "♡",
  nova: "❋",
  shield: "◈",
  base: "☀",
  forest: "❧",
  moon: "☾",
} as Record<string, string>;
const names = {
  sword: "晨光剑盾",
  staff: "星枝法杖",
  bow: "柳木弓",
  chime: "潮汐铃",
  spark: "星火",
  heal: "暖光治愈",
  nova: "星花绽放",
  shield: "星光护盾",
  base: "最初的我们",
  forest: "森林信使",
  moon: "月夜旅人",
} as Record<string, string>;
function controlIcon(selector: string, name: string) {
  const target = document.querySelector<HTMLElement>(selector)!;
  if (target.dataset.glyph === name) return;
  target.dataset.glyph = name;
  target.innerHTML = icon(name);
}
export class UI {
  privateAccess = false;
  root = document.querySelector<HTMLDivElement>("#app")!;
  onAction: (id: string, value?: string) => void = () => {};
  modalOpen = false;
  messageTimer = 0;
  private statusTimer = 0;
  private dialogueLines: string[] = [];
  private dialogueIndex = 0;
  private previousFocus: HTMLElement | null = null;
  get dialogueOpen() { return !document.querySelector<HTMLElement>('#dialogue')!.hidden; }
  constructor() {
    this.root.innerHTML = `<div id="vignette"></div><header id="topbar"><a class="wordmark" href="#" data-ui="home" aria-label="返回主画面"><img src="/assets/ui/studio-0.3.0/wordmark.svg" alt="Two Tails"/></a><div class="top-actions"><span class="edition">第十八版 · 林间回应 · 修复2</span><button data-ui="audio" aria-label="声音设置">${icon("sound")}</button><button data-ui="fullscreen" aria-label="切换全屏">${icon("fullscreen")}</button><button data-ui="settings" aria-label="打开设置">${icon("gear")}</button></div></header>
 <main id="home">${storybookHome()}</main>
 <div id="hud" hidden><section class="player-panel"><div class="avatar"><img id="hud-portrait" src="${dogPortrait("gold")}" alt=""/></div><div><div class="player-line"><strong id="player-name">${CHARACTER_NAMES.gold}</strong><span id="role-label">晨光剑盾</span></div><div class="health"><i id="health-fill"></i></div><div class="partner-line"><span id="partner-state">${CHARACTER_NAMES.white} · 伙伴同行</span><span id="hp-text">100 / 100</span></div></div></section><div class="a-place"><span id="chapter-label"></span><span id="mode-label"></span></div><details class="quest-panel"><summary title="目标详情"><span id="quest-step"></span>${icon("arrow")}</summary><div class="quest-details"><h3 id="quest-title"></h3><button data-ui="journal" aria-label="打开目标手记">${icon("feather")}</button></div></details><div class="minimap"><canvas id="minimap" width="160" height="160"></canvas><span id="map-label">北 ↑</span></div><div id="weather-status" role="status"></div><div id="play-health" role="status" hidden></div><div class="game-top-actions"><button class="hud-map" data-ui="map" aria-label="打开地图" title="地图（M）">${charm("map")}</button><button data-ui="game-menu" aria-label="打开菜单">${charm("hub")}<span>菜单</span></button></div><div class="connection-line"><span id="network-label">单人自由探索</span><i>·</i><span id="save-label">等待第一个脚印</span></div><div id="boss-panel" hidden><strong id="boss-name"></strong><div><i id="boss-health"></i></div><span id="boss-phase"></span></div>${controlPad()}</div><aside id="message" role="status" hidden><span>${icon("feather")}</span><p></p><button data-ui="message-dismiss" aria-label="收起提示">×</button></aside><aside id="dialogue" hidden aria-label="对话"><img class="dialogue-portrait" alt="说话的朋友"/><div class="dialogue-copy"><strong id="dialogue-name"></strong><p id="dialogue-text"></p><div class="dialogue-footer"><button data-ui="dialogue-skip">收起对话</button><button data-ui="dialogue-next">继续 ${icon("arrow")}</button></div></div></aside><div id="transition" hidden><span>${icon("leaf")}</span><strong></strong></div><div id="toast" role="status" hidden></div><div id="modal-layer" hidden></div><div id="rotate-hint"><span>↻</span><strong>把世界横过来</strong><p>横屏后，和伙伴一起出发。</p></div><div id="loading"><div class="loading-star">${star}</div><h2>正在点亮灯火村</h2><p>整理行囊，也等一阵好风。</p></div>`;
    this.root.classList.add('storybook-a');
    for(const id of ['home','topbar'])this.root.querySelector<HTMLElement>('#'+id)!.inert=true;
    applyStorybookControls(this.root);
    this.root.querySelector('#hud')!.insertAdjacentHTML('beforeend','<div class="world-actions"><button data-ui="home-lights" id="home-light-toggle" hidden>关闭所有灯</button></div>');
    this.root.querySelector('.world-actions')!.insertAdjacentHTML('beforeend','<button data-ui="pet-menu" id="pet-menu" hidden>哈士哈</button><span id="pet-status" role="status"></span><button data-ui="duo-menu" id="duo-menu" hidden>与伙伴互动</button><button data-ui="duo-cancel" id="duo-end" hidden>结束互动</button><span id="duo-status" role="status"></span>');
    this.root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const tab = target.closest<HTMLButtonElement>("[data-tab-group]");
      if (tab) {
        this.switchPage(tab.dataset.tabGroup!, tab.dataset.tabTarget!);
        return;
      }
      const el = target.closest<HTMLElement>("[data-ui]");
      if (el) {
        e.preventDefault();
        if (el.dataset.ui === "more-actions") { const hud=this.root.querySelector<HTMLElement>("#hud")!;const on=hud.classList.toggle("actions-expanded");el.setAttribute("aria-expanded",String(on));return; }
        if (el.dataset.ui === "dialogue-next") { this.advanceDialogue(); return; }
        if (el.dataset.ui === "dialogue-skip") { this.hideDialogue(); return; }
        if (el.dataset.ui === "message-dismiss") { document.querySelector<HTMLElement>("#message")!.hidden = true; return; }
        this.onAction(el.dataset.ui!, el.dataset.value);
      }
    });
  }
  gameMenu() {
    this.modal("随身行囊", "", `<div class="a-menu-links">${[['map','map','地图 · M'],['journal','feather','冒险手记 · I'],['equipment','bag','背包与装扮'],['camera-reset','camera-reset','镜头回正'],['fullscreen','fullscreen','切换全屏'],['settings','gear','设置'],['help','feather','操作说明']].map(([action,glyph,label])=>`<button data-ui="${action}">${icon(glyph)}<span>${label}</span></button>`).join('')}</div>`);
  }
  loaded() {
    document.querySelector("#loading")?.remove();
    for(const id of ['home','topbar'])this.root.querySelector<HTMLElement>('#'+id)!.inert=false;
    for (const button of this.root.querySelectorAll<HTMLElement>('button[aria-label]')) button.title = button.getAttribute('aria-label')!;
  }
  mode(mode: "home" | "game") {
    document.querySelector<HTMLElement>("#home")!.hidden = mode !== "home";
    document.querySelector<HTMLElement>("#hud")!.hidden = mode !== "game";
    document
      .querySelector<HTMLElement>("#topbar")!
      .classList.toggle("in-game", mode === "game");
    document.body.classList.toggle("playing", mode === "game");
  }
  continueInfo(save: AdventureSave | null) {
    const button =
      document.querySelector<HTMLButtonElement>("#continue-button")!;
    button.hidden = !save;
    if (save)
      document.querySelector("#continue-chapter")!.textContent =
        CHAPTERS.find((c) => c.id === save.chapterId)?.title ?? "灯火村";
  }
  explorationInfo(save: ExplorationSave | null) {
    document.querySelector<HTMLButtonElement>("#continue-explore")!.hidden =
      !save;
    document.querySelector("#explore-region")!.textContent = save
      ? (CHARACTER_NAMES[save.role] + " · ") +
        (getRegion(save.regionId)?.name ?? "灯火村")
      : "";
  }
  chooseExplorer(role: DogRole) {
    this.modal("选择小狗", "", `<div class="character-callout"><span>今天出发的是</span><h3>${CHARACTER_NAMES[role]}</h3><p>${role === "gold" ? "黄色金毛" : "白色马尔济斯"}</p></div><div class="character-selectors">${(["gold", "white"] as DogRole[]).map(r => `<button class="character-token ${role===r?'selected':''}" data-ui="explore-role" data-value="${r}" aria-pressed="${role===r}"><span class="portrait-medallion ${r}"><img src="${dogPortrait(r)}" alt=""/></span><strong>${CHARACTER_NAMES[r]}</strong>${role===r?'<i>✓</i>':''}</button>`).join('')}</div><label class="preview-turn" for="character-turn">${icon('camera')}<span>转动看看</span><input id="character-turn" type="range" min="0" max="628" value="314" aria-label="旋转角色"></label><button class="primary full" data-ui="explore-start">出发 ${icon('arrow')}</button><p class="character-mode-note">单人探索 · 双人故事独立保存</p>`, true);
    document.querySelector("#modal-layer")!.classList.add("character-view");
    document.body.classList.add("choosing-explorer");
  }
  regions(ids: string[], current: string, developer = false) {
    this.modal(
      developer ? "开发场景验收" : "散步地图",
      developer
        ? "临时游览七章，不写入正式解锁或探索继续位置。"
        : "第一章的村庄、森林和溪岸自由连通；其他区域随双人冒险解锁。",
      `<div class="journal-grid">${CHAPTERS.map((ch) => (ids.includes(ch.id) ? `<button class="chapter-entry ${ch.id === current ? "current" : ""}" data-ui="explore-region" data-value="${ch.id}"><span>${ch.index}</span><div><h3>${ch.title}</h3><p>${ch.subtitle}</p></div><small>${ch.id === current ? "当前区域" : "前往"}</small></button>` : `<div class="chapter-entry locked"><span>${ch.index}</span><div><h3>${ch.title}</h3><p>在双人故事中抵达后开放游览</p></div></div>`)).join("")}</div><p class="fine">探索发现、纪念收藏与搭配保存在本机。双人存档独立保留。</p>`,
      true,
    );
  }
  toast(text: string) {
    const el = document.querySelector<HTMLElement>("#toast")!;
    el.textContent = text;
    el.hidden = false;
    setTimeout(() => {
      if (el.textContent === text) el.hidden = true;
    }, 4200);
  }
  message(text: string) {
    clearTimeout(this.messageTimer);
    const el = document.querySelector<HTMLElement>("#message")!;
    el.querySelector("p")!.textContent = text;
    el.hidden = false;
    this.messageTimer = window.setTimeout(() => (el.hidden = true), 5000);
  }
  status(network: string, save?: string) {
    clearTimeout(this.statusTimer);
    const line = document.querySelector<HTMLElement>(".connection-line")!;
    line.hidden = false;
    document.querySelector("#network-label")!.textContent = network;
    if (save) document.querySelector("#save-label")!.textContent = save;
    const pending = /暂停|中断|等待|重连|连接恢复中|正在保存|失败|未确认|未保存|仅|重试|待同步|尚未/.test(network + " " + document.querySelector("#save-label")!.textContent);
    if (!pending) this.statusTimer = window.setTimeout(() => (line.hidden = true), 5500);
  }
  modal(title: string, subtitle: string, body: string, wide = false) {
    if (!this.modalOpen) this.previousFocus = document.activeElement as HTMLElement;
    document.dispatchEvent(new Event('goulai-input-block'));
    const focusedAction = (document.activeElement as HTMLElement)?.dataset.ui;
    this.modalOpen = true;
    document.body.classList.remove("choosing-explorer");
    const el = document.querySelector<HTMLElement>("#modal-layer")!;
    el.hidden = false;
    el.classList.remove("equipment-view", "character-view", "map-view", "travel-view", "journal-view", "settings-view", "duo-view", "field-view");
    el.innerHTML = `<section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${title}" tabindex="-1"><button class="close" data-ui="close" aria-label="关闭">×</button><div class="modal-eyebrow">${icon("star")} Two Tails</div><h2>${title}</h2><p class="modal-subtitle">${subtitle}</p>${body}</section>`;
    queueMicrotask(() => {
      if (el.hidden) return;
      const previous = focusedAction ? el.querySelector<HTMLElement>(`[data-ui="${CSS.escape(focusedAction)}"]:not(:disabled)`) : null;
      (previous ?? el.querySelector<HTMLElement>('input:not([type=range]),.close,.modal'))?.focus({preventScroll:true});
    });
  }
  close() {
    this.modalOpen = false;
    document.body.classList.remove("choosing-explorer");
    document.querySelector<HTMLElement>("#modal-layer")!.hidden = true;
    if (this.previousFocus?.isConnected && this.previousFocus.getClientRects().length) this.previousFocus.focus({preventScroll:true});
    else if (document.body.classList.contains('playing')) document.querySelector<HTMLElement>('#look-zone')?.focus({preventScroll:true});
    this.previousFocus = null;
  }
  petMenu(s:Snapshot){
    const p=s.pet;if(!p)return;this.modal('哈士哈',p.mode==='home'?'在家等你们回来':`正在跟随${p.owner==='gold'?'小鸡毛':'小白'}`,`<button class="primary full" data-ui="pet-follow" data-value="${p.revision}">跟随我</button><button class="secondary full" data-ui="pet-home" data-value="${p.revision}" ${s.regionId==='player-home-villa'?'':'disabled'}>留在家里</button>${s.regionId==='player-home-villa'?'':'<p class="fine">回家后可以让哈士哈留下休息。</p>'}`);
  }
  animalMenu(a:import('./animal-interactions').AnimalTarget,targets:import('./animal-interactions').AnimalTarget[]=[],goldenRevision=0,homeRevision=0){
    const play=a.source==='flock'?'挥爪逗它们玩':a.water?'挥爪逗它玩':a.source==='resident'?'友好逗玩':a.source==='creature'?'陪它玩':a.species==='kangaroo'||a.species==='koala'?'轻轻逗玩':'轻轻抚摸';
    this.modal(a.label,'慢慢靠近，留一点自在的空间。',`${targets.length>1?'<nav aria-label="附近的朋友" class="animal-choices">'+targets.map((t,i)=>'<button class="quiet" data-ui="animal-select" data-value="'+t.id+'" aria-pressed="'+(t.id===a.id)+'">'+t.label+(targets.filter(n=>n.label===t.label).length>1?' '+(i+1):'')+'</button>').join('')+'</nav>':''}<button class="primary full" data-ui="animal-greet" data-value="${a.id}">招呼它</button>${!a.water&&a.source!=='flock'?'<button class="secondary full" data-ui="animal-pet" data-value="'+a.id+'">轻轻抚摸</button>':''}<button class="secondary full" data-ui="animal-play" data-value="${a.id}">${a.source==='flock'?play:'陪它玩'}</button>${isHomePetId(a.id)?'<div data-golden-revision="'+homeRevision+'"><p>每人可选择一只家园宠物跟随；它会按自己的步速前进，窄门和楼梯处会等待。'+(a.id==='home-sea-turtle'?'请先让开浅石坡，等它慢慢爬上岸。':'')+'</p><button class="primary full" data-ui="animal-follow" data-value="'+a.id+'">跟随我</button><button class="secondary full" data-ui="animal-stay" data-value="'+a.id+'">停止跟随 · 留在这里</button><button class="secondary full" data-ui="animal-home" data-value="'+a.id+'">回自己的休息处</button></div>':a.id==='golden-retriever'?'<div data-golden-revision="'+goldenRevision+'"><button class="primary full" data-ui="animal-follow" data-value="golden-retriever">跟随我</button><button class="secondary full" data-ui="animal-stay" data-value="golden-retriever">停止跟随 · 留在这里</button></div>':''}`);
  }
  updateAnimal(a:import('./animal-interactions').AnimalTarget|undefined){
    let button=this.root.querySelector<HTMLButtonElement>('#animal-menu');if(!button){button=document.createElement('button');button.id='animal-menu';button.dataset.ui='animal-menu';this.root.querySelector('.world-actions')!.append(button);}button.hidden=!a;button.textContent=a?'和'+a.label+'互动':'';
  }
  updatePet(s:Snapshot,role:DogRole,available:boolean){
    this.root.querySelector<HTMLButtonElement>('#pet-menu')!.hidden=!available;
    const p=s.pet,g=s.golden,notices=[p?.regionId===s.regionId&&p.mode==='follow'?(p.waiting==='flight'?'哈士哈在地面等你落下':p.waiting==='path'?'哈士哈在安全处等你':`哈士哈 · 跟随${p.owner==='gold'?'小鸡毛':'小白'}`):'',g?.regionId===s.regionId&&g.mode==='follow'?(g.waiting==='flight'?'金毛在地面等你落下':g.waiting==='path'?'金毛在安全处等你':`金毛 · 跟随${g.owner==='gold'?'小鸡毛':'小白'}`):''];if(s.homePets)for(const pet of Object.values(s.homePets))if(pet.mode==='follow'){const name=pet.id==='home-kangaroo'?'家园袋鼠':pet.id==='home-koala'?'家园考拉':'家园海龟';notices.push(pet.regionId!==s.regionId?name+'在上一个区域的安全处等你':pet.waiting==='path'?name+'在安全处等你 · 此处太窄或有高差':pet.waiting==='flight'?name+'在地面等你落下':name+' · 跟随'+(pet.owner==='gold'?'小鸡毛':'小白'));}this.root.querySelector('#pet-status')!.textContent=notices.filter(Boolean).join(' · ');
  }
  duoMenu(role:DogRole,regionId:string){
    this.modal('与伙伴互动','', `${rideAllowedInRegion(regionId)?role==='gold'?'<button class="primary full" data-ui="duo-invite" data-value="ride">骑上小白 · 双方随时可下骑</button>':'<p>小鸡毛可主动骑上，你可以随时下骑。</p>':'<p>家园内可以和伙伴贴贴。</p>'}<button class="secondary full" data-ui="duo-invite" data-value="cuddle">邀请贴贴</button>`);
    document.querySelector('#modal-layer')!.classList.add('duo-view');
  }
  private duoPromptId=0;
  updateDuo(s:Snapshot,role:DogRole,available:boolean){
    const d=s.duo,active=d?.phase==='active',invited=d?.phase==='invited';
    this.root.querySelector<HTMLButtonElement>('#duo-menu')!.hidden=!available;
    const end=this.root.querySelector<HTMLButtonElement>('#duo-end')!;end.hidden=!active;end.textContent=d?.type==='ride'?'下骑':'结束贴贴';
    this.root.querySelector('#duo-status')!.textContent=active&&d.type==='ride'?'小鸡毛控制移动':'';
    if(invited&&d.id!==this.duoPromptId&&!this.dialogueOpen&&!this.modalOpen){
      this.duoPromptId=d.id;this.duoPrompt(s,role);
    }else if(invited&&d.id!==this.duoPromptId&&document.querySelector('#modal-layer.duo-view')){this.duoPromptId=d.id;this.duoPrompt(s,role);}
    else if(!invited&&this.duoPromptId){this.duoPromptId=0;if(document.querySelector('#modal-layer.duo-view'))this.close();}
  }
  private duoPrompt(s:Snapshot,role:DogRole){const d=s.duo!,mine=d.proposer===role;
    this.modal(mine?'等待伙伴确认':'伙伴想和你互动',d.type==='ride'?'小鸡毛骑小白':'贴贴',`${mine?'':'<button class="primary full" data-ui="duo-accept">接受</button>'}<button class="secondary full" data-ui="${mine?'duo-cancel':'duo-reject'}">${mine?'取消邀请':'暂时不了'}</button>`);
    document.querySelector('#modal-layer')!.classList.add('duo-view');
  }
  join() {
    this.modal(
      "找到你的伙伴",
      "输入伙伴屏幕上的六位房间码。",
      `<label class="input-label">房间码<input id="room-code" maxlength="6" placeholder="例如 A7C2F9" autocomplete="off" autocapitalize="characters" /></label><button data-ui="join-confirm" class="primary full">一起出发 →</button><p class="fine">两台设备需要打开同一个游戏网址。</p>`,
    );
    setTimeout(
      () => document.querySelector<HTMLInputElement>("#room-code")?.focus(),
      100,
    );
  }
  lobby(room: RoomView, clientId: string | null) {
    const mine = room.players.find((p) => p.clientId === clientId);
    this.modal(
      room.mode==='coop-exploration'?'双人自由探索':'为你留了一盏灯',
      "把房间码告诉伙伴，选好角色，一起准备出发。",
      `<div class="room-code"><small>你们的房间码</small><strong>${room.code}</strong><button class="quiet" data-ui="copy-code">复制房间码 ↗</button></div><div class="role-cards">${(
        ["gold", "white"] as DogRole[]
      )
        .map((r) => {
          const p = room.players.find((p) => p.role === r);
          return `<button class="role-card ${mine?.role === r ? "selected" : ""}" data-ui="role" data-value="${r}"><span class="dog-dot ${r}"><img src="${dogPortrait(r)}" alt="" /></span><strong>${CHARACTER_NAMES[r]}</strong><small>${r === "gold" ? "黄色金毛小狗" : "白色马尔济斯"}</small><b>${p ? (p.clientId === clientId ? "你 · " : "伙伴 · ") + (p.ready ? "已准备" : "选择中") : "等待伙伴"}</b></button>`;
        })
        .join(
          "",
        )}</div><button class="primary full" data-ui="ready">${mine?.ready ? "取消准备" : "我准备好了"}</button>${room.hostId === clientId ? `<button class="secondary full" data-ui="start" ${room.players.length < 2 || !room.players.every((p) => p.ready && p.connected) ? "disabled" : ""}>${room.mode==='coop-exploration'?'一起自由探索':'共同进入故事'} →</button>` : '<p class="fine">两人准备后，由房主开启冒险。</p>'}`,
      true,
    );
  }
  journal(save: AdventureSave | null, state?: Snapshot) {
    this.modal("冒险手记", "", journalPages(save, state), true);
    document.querySelector("#modal-layer")!.classList.add("journal-view");
  }
  private switchPage(group: string, page: string) {
    const layer = document.querySelector<HTMLElement>("#modal-layer")!;
    layer.querySelectorAll<HTMLElement>('[data-tab-group]').forEach(button => {
      if (button.dataset.tabGroup === group) button.setAttribute('aria-pressed', String(button.dataset.tabTarget === page));
    });
    layer.querySelectorAll<HTMLElement>('[data-tab-panel]').forEach(panel => {
      if (panel.dataset.tabPanel === group) panel.hidden = panel.dataset.tabId !== page;
    });
    this.root.dispatchEvent(new CustomEvent('goulai-page-turn'));
  }
  equipment(
    save: AdventureSave,
    role: DogRole,
    nearCamp: boolean,
    exploration = false,
    bare = false,
  ) {
    const p = save.players[role];
    const buttons = (items: string[], category: string, current: string) =>
      items
        .map(
          (id) =>
            `<button data-ui="equip-${category}" data-value="${id}" class="item ${id === current ? "selected" : ""}" ${!nearCamp ? "disabled" : ""}><span>${icons[id] ?? "✧"}</span><strong>${names[id] ?? id}</strong>${id === current ? "<small>已装备</small>" : ""}</button>`,
        )
        .join("");
    this.modal(
      "轻装，去更远的地方",
      exploration
        ? "探索中可以随时试穿。所有搭配仅保存在单人探索。"
        : nearCamp
          ? "营火旁很安全。试试新的武器与衣装。"
          : "可以查看行囊；回到营火旁就能更换搭配。",
      `<div class="equipment-sections">${exploration ? `<button class="secondary full" data-ui="toggle-outfit">${bare ? "展示所选服饰" : "查看基础造型"}</button>` : ""}<h3>手中的勇气 <small>武器不绑定角色</small></h3><div class="items">${buttons(p.unlockedEquipment, "weapon", p.weaponId)}</div><h3>身上的故事</h3><div class="items">${buttons(p.unlockedSkins, "skin", p.skinId)}</div><h3>两格星光技能</h3>${[0, 1].map((i) => `<div class="skill-picker"><span>技能 ${i + 1}</span>${p.unlockedSkills.map((id) => `<button class="chip ${p.skillIds[i] === id ? "selected" : ""}" data-ui="equip-skill${i}" data-value="${id}" ${!nearCamp ? "disabled" : ""}>${icons[id] ?? "✧"} ${names[id] ?? id}</button>`).join("")}</div>`).join("")}</div><p class="fine">角色会在场景中展示实际穿戴。${exploration ? "试穿不解锁双人冒险物品。" : "新外观来自冒险和伙伴的帮助。"}</p>`,
      true,
    );
    document.querySelector("#modal-layer")!.classList.add("equipment-view");
  }
  settings(options: {
    music: number;
    sfx: number;
    quality: string;
    sensitivity?: number;
    fullscreen: boolean;
    exploration?: boolean;
    coopExploration?: boolean;
    running?: boolean;
  }) {
    this.modal("设置", "", settingsPages({...options, privateAccess:this.privateAccess}), true);
    document.querySelector("#modal-layer")!.classList.add("settings-view");
    (document.querySelector("#quality") as HTMLSelectElement).value = options.quality;
    for (const kind of ['music', 'sfx']) {
      document.querySelector<HTMLInputElement>(`#${kind}-volume`)!.addEventListener('input', event => {
        document.querySelector(`#${kind}-value`)!.textContent = (event.target as HTMLInputElement).value + '%';
      });
    }
  }

  help() {
    this.modal(
      "第一次冒险",
      "不用着急，伙伴会等你。",
      `<div class="help-lines"><p><b>移动与镜头</b> WASD / 方向键移动，Shift 疾跑，空格跳跃。点击画面或“进入鼠标视角”后，移动鼠标直接转镜头；首次点击不攻击。Esc 释放鼠标，再次点击恢复。右键拖动为备用，滚轮调整远近。Mac 触控板也可使用右键拖动与双指滚动。触屏保留左摇杆、右侧拖动与疾跑键。</p><p><b>飞行</b> B 召出扫帚，再按 B 在安全地面着陆。R 升高、C 降低，Shift 加速；松开方向悬停。触屏用扫帚、升高与降低按钮，可同时拖动镜头。室内不能飞行，战斗时先脱离危险。</p><p><b>游泳</b> 家园泳池沿海龟石坡上下水。WASD 游动，R 上浮、C 下潜；触屏用上浮与下潜按钮。泳池中央可下潜；海湾岸路的海底入口可旅行到珊瑚、水母与星光古城，在入口附近返回海湾。海湾中央沿沙坡走入浮标围定的泳区，深处可以下潜，再沿原沙坡返回岸边。松手停游，无氧气消耗。上岸后恢复原操作。</p><p><b>面板</b> M 地图，I 冒险手记。鼠标未锁定时，Esc 关闭最上层可关闭面板；正常游玩时打开设置。打开面板会释放鼠标，关闭后请点击画面继续。右上角可切换全屏。面板内可以正常滚动与 Tab 导航，输入不会同时控制角色。正式故事仍需双方确认。</p><p><b>地图</b> 自由探索开放全部已实现区域与装备，不受伤害、不提交正式剧情或奖励；单人、双人权限相同。正式冒险按剧情解锁。林缘家园可从地图或灯火村东侧林路抵达；双人跨区由伙伴确认。</p><p><b>战斗</b> 点击攻击；琥珀圆圈表示危险将至，及时移动或闪避；浅蓝根波可以跳过，再趁停顿反击。鼠标左键 / J 攻击，1 / 2 技能（也可 K / L），Q 闪避。疾跑和跳跃不会带来无敌；闪避能穿过短暂的危险时机。</p><p><b>跑跳</b> 矮石台可跳上，河水和高墙不能站立；意外落水会回到最近安全处。部分贴地波纹可以跳过，其余攻击仍需避开预兆。</p><p><b>探索</b> 靠近居民、星灯和遗迹会出现互动键。E 互动，F 呼唤伙伴。</p><p><b>伙伴</b> 倒地后靠近伙伴并互动，停留约两秒扶起。两人倒下会回到最近检查点。</p><p><b>前往下一章</b> 完成星灯任务和首领挑战，两人一起走进北边星门。</p><p><b>存档</b> 重要进度自动保存。结束房间后仍可「继续冒险」，请定期导出备份。</p></div>`,
    );
  }
  hud(s: Snapshot, role: DogRole, nearby: string, exploration = false) {
    const light=this.root.querySelector<HTMLButtonElement>('#home-light-toggle')!;light.hidden=s.regionId!=='player-home-villa';light.textContent=s.homeLights===false?'打开所有灯':'关闭所有灯';
    const p = s.players[role],
      other = s.players[role === "gold" ? "white" : "gold"];
    const ch = getRegionChapter(s.regionId ?? s.chapterId);
    document.querySelector("#mode-label")!.textContent = s.mode==='adventure'?'双人冒险':exploration?'单人探索':'双人探索';
    const context=p.swim!=='land'?'swim':p.mounted?'flight':s.enemies.some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<18&&e.state!=='idle')?'combat':s.regionId==='player-home-villa'||s.regionId==='mushroom-home'?'home':'walk';
    this.root.querySelector<HTMLElement>('#hud')!.dataset.context=context;
    document.querySelector("#player-name")!.textContent =
      CHARACTER_NAMES[role];
    const portrait = document.querySelector<HTMLImageElement>("#hud-portrait")!;
    if (portrait.dataset.role !== role) { portrait.dataset.role = role; portrait.src = dogPortrait(role); }
    document.querySelector<HTMLElement>(".player-panel")!.dataset.health = p.hp / p.maxHp < .3 ? "low" : "normal";
    const weather=weatherAt(s.time,s.regionId??s.chapterId,getRegion(s.regionId??s.chapterId)?.indoor??false);
    const hour=Math.floor(weather.hour),minute=Math.floor((weather.hour-hour)*60);
    const weatherText=`${weather.icon} ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")} · ${weather.label}`;
    const weatherPanel=document.querySelector<HTMLElement>("#weather-status")!;
    if(weatherPanel.textContent!==weatherText)weatherPanel.textContent=weatherText;
    document.querySelector("#role-label")!.textContent = names[p.weapon];
    (document.querySelector("#health-fill") as HTMLElement).style.width =
      `${Math.max(0,Math.min(100,p.hp/p.maxHp*100))}%`;
    document.querySelector("#hp-text")!.textContent =
      s.mode!=='adventure' ? '自由探索 · 不受伤害' : Math.ceil(p.hp) + " / " + p.maxHp;
    document.querySelector("#partner-state")!.textContent = exploration
      ? "单人探索"
      : CHARACTER_NAMES[role === "gold" ? "white" : "gold"] +
        " · " +
        (other.hp <= 0
          ? "需要你的帮助"
          : Math.hypot(other.x - p.x, other.z - p.z) > 12
            ? `相距 ${Math.round(Math.hypot(other.x - p.x, other.z - p.z))} 米`
            : "伙伴同行");
    document.querySelector("#chapter-label")!.textContent =
      getRegion(s.regionId ?? s.chapterId)?.name ?? ch.title;
    document.querySelector("#quest-title")!.textContent = !isStoryRegion(s.regionId ?? s.chapterId) ? ch.quest.title : s.mode!=='adventure'
      ? ch.index !== 1
        ? ch.title
        : p.z < 25
          ? "灯火村街口"
          : p.x > 12 && p.z < 50
            ? "晨光溪岸与果园"
            : "晨光森林小径"
      : ch.quest.title;
    const next = ch.interactions.find(
      (i) => ch.quest.steps.includes(i.id) && !s.flags.includes(i.id),
    );
    const bossAlive = s.enemies.some((e) => e.boss && e.hp > 0);
    document.querySelector("#quest-step")!.textContent = s.mode!=='adventure'
      ? getRegion(s.regionId ?? s.chapterId)?.name.split(" · ")[0] ?? ch.title
      : !isStoryRegion(s.regionId ?? s.chapterId) ? ch.quest.title
      : next
        ? `${next.label} · ${Math.round(Math.hypot(next.x - p.x, next.z - p.z))} 米`
        : bossAlive
          ? "驱散首领身上的阴影"
          : ch.index === 7 && !s.flags.includes("d-homeward-light")
            ? "到归途门前，把星光送往两个家园"
            : "和伙伴一起走向北边星门";
    document.querySelector<HTMLElement>(".quest-panel")!.classList.toggle("exploration-objective", exploration);
    const button = document.querySelector<HTMLButtonElement>("#interact")!;
    button.hidden = !nearby;
    button.setAttribute('aria-label', nearby ? `互动：${nearby}` : '互动');
    document.querySelector<HTMLElement>('#interaction-prompt')!.hidden = !nearby;
    document.querySelector("#interact-label")!.textContent = nearby;
    controlIcon('#attack-icon', p.weapon);
    document.querySelector('.attack')!.setAttribute('aria-label', `${names[p.weapon] ?? '武器'}攻击`);
    for (let i = 1; i <= 2; i++) {
      controlIcon(`#skill${i}-icon`, p.skills[i - 1]);
      const skill = document.querySelector<HTMLButtonElement>(`[data-action="skill${i}"]`)!;
      const remaining = Math.max(0, p.cooldowns[i]);
      const maximum = remaining > 0 ? Math.max(remaining, Number(skill.dataset.cooldownMax ?? 0)) : 0;
      skill.dataset.cooldownMax = String(maximum);
      skill.style.setProperty('--cooldown', `${maximum ? remaining / maximum * 360 : 0}deg`);
      skill.classList.toggle('cooling', remaining > 0);
      skill.setAttribute('aria-label', `${names[p.skills[i - 1]] ?? '星光'}${remaining > 0 ? '，冷却中' : ''}`);
      skill.setAttribute('aria-disabled', String(remaining > 0));
      skill.querySelector('.cooldown-value')!.textContent = remaining > 0 ? remaining.toFixed(1) : '';
      skill.setAttribute('aria-disabled', String(remaining > 0 || p.mounted || p.swim!=='land' || p.hp <= 0));
      skill.title = `${names[p.skills[i - 1]] ?? '星光'} · ${i} / ${i === 1 ? 'K' : 'L'}${remaining > 0 ? ' · 冷却 ' + remaining.toFixed(1) + ' 秒' : ''}`;
    }
    for (const [action, slot] of [['attack', 0], ['dodge', 3]] as const) {
      const control = document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
      const remaining = Math.max(0, p.cooldowns[slot]);
      const maximum = remaining > 0 ? Math.max(remaining, Number(control.dataset.cooldownMax ?? 0)) : 0;
      control.dataset.cooldownMax = String(maximum); control.style.setProperty('--cooldown', `${maximum ? remaining / maximum * 360 : 0}deg`);
      control.classList.toggle('cooling', remaining > 0);
      control.setAttribute('aria-disabled', String(remaining > 0 || p.mounted || p.swim!=='land' || p.hp <= 0 || action === 'dodge' && !p.grounded));
      control.querySelector('.cooldown-value')!.textContent = remaining >= .1 ? remaining.toFixed(1) : '';
    }
    const boss = s.enemies.find(
      (e) => e.boss && e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 22,
    );
    document.querySelector<HTMLElement>("#boss-panel")!.hidden = !boss;
    if (boss) {
      document.querySelector("#boss-name")!.textContent = boss.name;
      document.querySelector<HTMLElement>("#boss-health")!.style.width =
        (boss.hp / boss.maxHp) * 100 + "%";
      document.querySelector("#boss-phase")!.textContent =
        boss.exposed > 0
          ? "✧ 反击窗口 · 此刻攻击更有效"
          : boss.state === "warning"
          ? boss.telegraphs.some(mark => mark.height === "ground")
            ? "浅蓝根波 · 可以跳过，或退到圈外"
            : "琥珀预兆 · 移动或闪避，跳跃仍会受伤"
          : `阶段 ${boss.phase} · 观察、闪避、反击`;
    }
    document.querySelector<HTMLElement>(".ping")!.hidden = exploration||fieldHidesPartner(s.fieldPlay);
    const weaponButton=document.querySelector<HTMLButtonElement>('#weapon-toggle')!,weaponLabel=p.weaponDrawn===false?'拿出武器':'收起武器';
    const weaponText=weaponButton.querySelector('span')!;if(weaponText.textContent!==weaponLabel)weaponText.textContent=weaponLabel;
    weaponButton.setAttribute('aria-label',weaponLabel+' · X');weaponButton.title=weaponLabel+' · X（坐卧或载具中记住选择，退出后生效）';weaponButton.setAttribute('aria-pressed',String(p.weaponDrawn!==false));weaponButton.setAttribute('aria-disabled',String(p.hp<=0||['attack','cast','dodge','hit','revive'].includes(p.action)));
    const mounted = !!p.mounted,swimming=p.swim!=='land',water=waterColumn(s.regionId,p.x,p.z);
    document.body.classList.toggle("flying", mounted);
    document.querySelector<HTMLElement>("#flight-lift")!.hidden = !mounted&&!swimming;
    document.querySelector<HTMLElement>("#mount")!.setAttribute("aria-pressed", String(mounted));
    document.querySelector<HTMLElement>("#mount")!.setAttribute('aria-label', mounted ? '着陆并收起扫帚' : '召出扫帚');
    const canClaimBroom = s.broomOwned || Math.hypot(p.x-ch.spawn.x,p.z-ch.spawn.z)<=6 || Math.hypot(p.x-ch.camp.x,p.z-ch.camp.z)<=8;
    const inCombat = s.mode==='adventure' && (['attack','cast','hit','dodge','revive'].includes(p.action) || s.enemies.some(e=>e.hp>0&&['chase','warning','attack'].includes(e.state)&&Math.hypot(e.x-p.x,e.z-p.z)<18));
    document.querySelector<HTMLElement>('#mount')!.setAttribute('aria-disabled', String(getRegion(s.regionId ?? s.chapterId)?.indoor || p.hp <= 0 || !mounted && (!p.grounded || inCombat || !canClaimBroom)));
    document.querySelector<HTMLElement>('[data-action="jump"]')!.setAttribute('aria-disabled', String(p.hp<=0||mounted||!p.grounded||['attack','cast','dodge','revive','interact','hit'].includes(p.action)));
    document.querySelector<HTMLElement>('#mount')!.title = mounted ? '着陆并收起扫帚 · B' : '召出扫帚 · B';
    controlIcon('#mount-icon', mounted ? 'land' : 'broom');
    document.querySelector('[data-lift="1"]')!.setAttribute('aria-label',swimming?'上浮':'升高');
    document.querySelector('[data-lift="-1"]')!.setAttribute('aria-label',swimming?'下潜':'降低');
    document.querySelector("#flight-status")!.textContent = swimming ? (s.regionId==='studio-undersea-atlantis'?'水下 · R 上浮 / C 下潜 · 珊瑚入口返回海湾':s.regionId==='studio-tideglass-cove'?(water?.dive?`水${p.swim==='underwater'?'下':'面'} · R 上浮 / C 下潜 · 沿沙坡上岸`:'浅处划水 · 沿沙坡上岸 · 湾内深处可下潜'):water?.dive?`水${p.swim==='underwater'?'下':'面'} · R 上浮 / C 下潜 · 沿石坡上岸`:'浅处划水 · 沿石坡上岸 · 池中央可下潜') : mounted ? `高度 ${Math.max(0,p.y-p.safeY).toFixed(1)} 米 · ${p.flight === "landing" ? "正在着陆" : "松手悬停"}` : "";
    this.map(s, role, exploration ? undefined : next, exploration);
  }
  worldMap(s: Snapshot, allowed: string[], role: DogRole) {
    const discovered = s.discoveredRegions ?? [s.regionId ?? s.chapterId];
    const current = s.regionId ?? s.chapterId;
    const points: Record<string, [number,number]> = Object.fromEntries(CHAPTERS.map((c,i)=>[c.id, [[20,75],[40,77],[51,48],[68,68],[80,48],[71,25],[87,19]][i] as [number,number]]));
    Object.assign(points, {"mushroom-grove":[24,40],"mushroom-home":[14,21],"canopy-garden":[44,26],"canopy-home":[44,12],"player-home-villa":[18,91]});
    for(const r of REGIONS)points[r.id]??=[r.mapX,r.mapY];
    const lines = REGION_CONNECTIONS.filter((_,i)=>i%2===0).map(link=>{
      const a=points[link.from], b=points[link.to]; if (!a || !b) return "";
      return `<path d="M${a[0]*8.6} ${a[1]*4.9} Q${(a[0]+b[0])*4.3-18} ${(a[1]+b[1])*2.45+18} ${b[0]*8.6} ${b[1]*4.9}" class="${discovered.includes(link.from)&&discovered.includes(link.to)?"known":"unknown"}"/>`;
    }).join("");
    this.modal("走过的路，都有光", "沿林间小路抵达，也可以乘风而行。发现安全地点后，在地图上落脚。",
      `<div class="world-map">${mapDrawing}<svg class="map-routes" preserveAspectRatio="none" viewBox="0 0 860 490" aria-hidden="true">${lines}</svg>${REGIONS.map((r,i)=>{
       const pt=points[r.id]??[r.mapX,r.mapY], known=discovered.includes(r.id), open=allowed.includes(r.id), here=current===r.id;
       return `<button class="map-place ${here?"here":""} ${known?"known":"undiscovered"} ${open?"":"locked"}" style="left:${pt[0]}%;top:${pt[1]}%" data-ui="map-destination" data-value="${r.id}" aria-label="${r.name}，${here?"当前位置":!open?"故事未解锁":known?"可前往":"沿小路发现"}">${icon(r.indoor?"home":i===0?"home":i===4?"moon":i===5?"star":"leaf")}<strong>${r.name.split(" · ")[0]}</strong><small>${here?(s.activeRoles?.length===1||fieldHidesPartner(s.fieldPlay)?"你在这里":"你与伙伴在此"):!open?"故事未解锁":known?"已发现":"沿小路发现"}</small></button>`;
      }).join("")}</div><div class="map-legend"><span>● 当前位置</span><span>— 已发现连接</span><span>┄ 待走过的小路</span><button class="quiet" data-ui="journal">翻开故事手记 ${icon("feather")}</button><button class="quiet" data-ui="close">收起地图</button></div>`,true);
    document.querySelector("#modal-layer")!.classList.add("map-view");
  }
  destination(id:string, s:Snapshot, allowed:string[]) {
    const r=getRegion(id); if(!r) return;
    const known=(s.discoveredRegions??[]).includes(id), current=id===(s.regionId??s.chapterId), open=allowed.includes(id);
    this.modal(r.name, r.description, `<div class="destination-emblem">${icon(r.indoor?"home":"leaf")}</div><p class="destination-status">${current?"脚下就是这片风景。":!open?"先和伙伴完成前一段故事，这条路才会亮起。":!known?"这里尚未留下脚印。沿地图上的小路步行或飞行抵达，便会记下安全落点。":"这里留着你们的脚印，可以回到安全落点。"}</p><button class="primary full" data-ui="travel-map" data-value="${id}" ${!open||!known||current?"disabled":""}>${s.activeRoles?.length===1?"前往这里":"邀请伙伴同行"} ${icon("arrow")}</button><button class="quiet full" data-ui="map">回到地图</button>`);
  }
  travelPrompt(s: Snapshot, role:DogRole) {
    const trip=s.travel;if(!trip)return;
    const mine=trip.proposer===role;
    this.modal(mine?"等伙伴一起出发":"伙伴想和你去看看",getRegion(trip.to)?.name??"林间小路",`<div class="destination-emblem">${icon("map")}</div><p class="destination-status">${mine?"伙伴确认后，你们会一起前往。":"收好行囊再出发。确认后，两人将一起前往安全落点。"}</p>${mine?"":'<button class="primary full" data-ui="travel-accept">好，一起去 '+icon("arrow")+'</button>'}<button class="secondary full" data-ui="travel-cancel">再待一会儿</button>`);
    document.querySelector("#modal-layer")!.classList.add("travel-view");
  }
  transition(name:string) {
    const el=document.querySelector<HTMLElement>("#transition")!;
    el.querySelector("strong")!.textContent=name;el.hidden=false;
    setTimeout(()=>el.hidden=true,900);
  }
  dialogue(name:string, text:string, identity="forester") {
    document.dispatchEvent(new Event('goulai-input-block'));
    const el=document.querySelector<HTMLElement>("#dialogue")!;
    this.dialogueLines=text.match(/[^。！？]+[。！？]?/g)??[text]; this.dialogueIndex=0;
    document.querySelector("#dialogue-name")!.textContent=name;
    const image=el.querySelector<HTMLImageElement>("img")!; image.src=identity === "white" || identity === "gold" ? dogPortrait(identity) : `/assets/ui/portraits/${identity}.png`;image.alt=name;
    el.hidden=false;this.root.classList.add('dialogue-open');this.drawDialogue();
  }
  hideDialogue(){ document.querySelector<HTMLElement>("#dialogue")!.hidden=true;this.root.classList.remove('dialogue-open'); }
  private advanceDialogue(){if(++this.dialogueIndex>=this.dialogueLines.length)this.hideDialogue();else this.drawDialogue();}
  private drawDialogue(){document.querySelector("#dialogue-text")!.textContent=this.dialogueLines[this.dialogueIndex];document.querySelector('[data-ui="dialogue-next"]')!.innerHTML=(this.dialogueIndex===this.dialogueLines.length-1?"记住了":"继续")+icon("arrow");}
  private map(
    s: Snapshot,
    role: DogRole,
    next?: { x: number; z: number },
    exploration = false,
  ) {
    const canvas = document.querySelector<HTMLCanvasElement>("#minimap")!,
      c = canvas.getContext("2d")!;
    const p = s.players[role];
    const convert = (x: number, z: number) => ({
      x: 80 + (x - p.x) * 2.8,
      y: 80 - (z - p.z) * 2.8,
    });
    c.clearRect(0, 0, 160, 160);
    c.fillStyle = "#23473cb8";
    c.fillRect(0, 0, 160, 160);
    const ch = getRegionChapter(s.regionId ?? s.chapterId);
    c.strokeStyle = "#dad7b65e";
    c.lineWidth = 3;
    for (const path of ch.paths) {
      c.beginPath();
      path.points.forEach(([x, z], i) => {
        const v = convert(x, z);
        i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y);
      });
      c.stroke();
    }
    for (const e of s.enemies.filter((e) => e.hp > 0)) {
      const v = convert(e.x, e.z);
      c.fillStyle = e.boss ? "#e7a08f" : "#cc9b83";
      c.beginPath();
      c.arc(v.x, v.y, e.boss ? 4 : 2, 0, Math.PI * 2);
      c.fill();
    }
    if (next&&!fieldHidesPartner(s.fieldPlay)) {
      const v = convert(next.x, next.z);
      c.fillStyle = "#f1d69f";
      c.beginPath();
      c.arc(
        Math.max(9, Math.min(151, v.x)),
        Math.max(9, Math.min(151, v.y)),
        4,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    for (const r of ["gold", "white"] as DogRole[]) {
      if ((exploration||fieldHidesPartner(s.fieldPlay)) && r !== role) continue;
      const player = s.players[r],
        v = convert(player.x, player.z);
      c.fillStyle = r === "gold" ? "#efc277" : "#ffffff";
      c.beginPath();
      c.arc(v.x, v.y, r === role ? 5 : 4, 0, Math.PI * 2);
      c.fill();
      if (r === role) {
        c.strokeStyle = "#fff6cf";
        c.beginPath();
        c.moveTo(v.x, v.y);
        c.lineTo(
          v.x + Math.sin(player.yaw) * 12,
          v.y - Math.cos(player.yaw) * 12,
        );
        c.stroke();
      }
    }
  }
}
