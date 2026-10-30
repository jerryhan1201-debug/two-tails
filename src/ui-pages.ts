import {fieldJournal} from './field-ui';
import { CHAPTERS, type Chapter } from './content';
import { REGIONS } from './regions';
import { regionalReadings } from './region-stories';
import { journeyJournal } from './journeys';
import { newestJourneys } from '../shared/journeys';
import { icon } from './ui-art';
import type { AdventureSave } from '../shared/save';
import type { Snapshot } from './simulation';

// Small original ink drawings belong to the book, not to the rendered world.
const chapterSketch = (chapter: Chapter) => {
  const subjects: Record<string,string> = {
    village: '<path d="M75 140V96l45-37 46 37v44M63 98l57-49 58 49M107 139v-32h26v32M85 98h13v17H85m57-17h13v17h-13"/><path d="M169 140V67m-16 8 32-16m-31-15 31 47M43 139V94m-9 8 18-14"/>',
    river: '<path d="M22 139q44-48 87-11t107-6M34 153q49-38 79-10t91-5M61 127v-34q59-42 118 0v34M57 106q64-49 126 0M69 101v18m20-30v23m21-32v27m21-27v27m23-16v24m18-15v22"/>',
    forest: '<path d="M104 146V53h22v93M71 67q-21-36 12-47 31-26 64 7 37 0 31 38-11 27-42 13-30 18-65-11ZM51 147v-31m-24 0q-4-39 24-44 32 12 28 44Zm134 26v-37m-24 0q-3-37 24-47 30 10 29 47Z"/>',
    graveyard: '<path d="M67 143v-42q0-33 25-33t25 33v42M78 97h28m-14-16v34M145 143v-37q0-25 20-25t20 25v37M39 142q80-16 160 0M133 29a27 27 0 1 0 34 34 25 25 0 0 1-34-34Z"/>',
    castle: '<path d="M56 145V66h25v79m-29-79 17-30 16 30M94 145V84h62v61m-62-61 31-32 31 32M170 145V66h25v79m-30-79 17-30 17 30M111 145v-29a14 14 0 0 1 28 0v29M125 51V26l25 7-25 9M65 94h7m104 0h8"/>',
    mountain: '<path d="m25 145 70-98 40 63 32-44 59 80M72 80l24-33 20 30-18-5-13 13Zm77 11 18-25 20 27-18-6-10 8M61 146q60-28 73-53M122 32q19-14 42-2m-16 10q20-9 44 0"/>',
    dragon: '<path d="M62 141q-28-30 1-64 4-47 43-43 33-17 49 10l27 12-14 21-32-7q-34 20-20 43 43 4 51 26M111 108 98 67l-21 21 2-41M109 34l-4-18 19 16m25 23h2M44 144q70-19 153 0M168 108l23-9-9 26"/>',
  };
  return `<svg class="chapter-sketch" viewBox="0 0 250 170" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path class="sketch-wash" d="M30 144Q7 86 57 51T165 30Q236 45 227 118T126 151Z"/>${subjects[chapter.biome] ?? subjects.forest}<path opacity=".45" d="M33 157q88-12 183 0M25 73l5-8m169-27 9-4M45 42l7 5"/></svg>`;
};

export function journalPages(save: AdventureSave | null, state?: Snapshot) {
  const active = CHAPTERS.find(c => c.id === (state?.chapterId ?? save?.chapterId)) ?? CHAPTERS[0];
  const remembered = state ?? save?.world.snapshot as Snapshot | undefined;
  const known = new Set([...Object.entries(save?.quests ?? {}).filter(([,v]) => v === true).map(([id]) => id), ...(remembered?.flags ?? []), ...Object.values(remembered?.regionArchive ?? {}).flatMap(region => region.flags)]);
  const letters = REGIONS.flatMap(region => regionalReadings(region.id).filter(item => known.has(item.id)).map(item => ({region,item})));
  const journeys = journeyJournal(newestJourneys(save?.world.journeys, remembered?.journeys)).filter(item => item.status !== 'unstarted');
  const chapters = CHAPTERS.map(ch => {
    const visited = ch.index === 1 || ch.id === active.id || !!save?.completedChapters.includes(ch.id);
    const next = ch.quest.steps.find(id => !known.has(id));
    const nextItem = ch.interactions.find(item => item.id === next);
    const past = ch.quest.steps.filter(id => known.has(id));
    const side = ch.quest.side;
    const sideDone = side.steps.every(id => known.has(id));
    const chapterLetters = letters.filter(({region}) => region.chapterId === ch.id);
    const chapterJourneys = journeys.filter(item => REGIONS.find(region => region.id === item.regionId)?.chapterId === ch.id);
    return `<section class="book-spread" data-tab-panel="chapters" data-tab-id="${ch.id}" ${ch.id === active.id ? '' : 'hidden'}>
      <div class="book-scene"><span class="book-chapter-number">第 ${ch.index} 章</span>${chapterSketch(ch)}<h3>${ch.title}</h3><p>${ch.subtitle}</p><div class="book-route" aria-label="章节进度">${ch.quest.steps.map((id,i) => `<span class="${known.has(id)?'done':id===next?'now':''}" title="${known.has(id)?'已发现':id===next?'当前线索':'未发现'}">${known.has(id)?'✦':String(i+1).padStart(2,'0')}</span>`).join('')}</div><small>${visited ? `${past.length} / ${ch.quest.steps.length} 条线索` : '还没有留下脚印'}</small></div>
      <div class="book-page"><nav class="page-tabs" aria-label="第${ch.index}章手记页"><button data-tab-group="book-${ch.id}" data-tab-target="path" aria-pressed="true">旅途</button><button data-tab-group="book-${ch.id}" data-tab-target="friends" aria-pressed="false">相遇</button><button data-tab-group="book-${ch.id}" data-tab-target="journeys" aria-pressed="false">支路${chapterJourneys.some(item => item.status === 'active') ? ' ·' : ''}</button><button data-tab-group="book-${ch.id}" data-tab-target="letters" aria-pressed="false">来信${chapterLetters.length ? ` · ${chapterLetters.length}` : ''}</button></nav>
      <div data-tab-panel="book-${ch.id}" data-tab-id="path"><span class="page-kicker">${visited ? (next ? '当前目标' : '这一页的星光') : '未抵达'}</span><h4>${visited ? (nextItem?.label ?? ch.quest.title) : '沿着小路，继续向前'}</h4><p class="objective-text">${visited ? (next ? (nextItem?.hint ?? ch.quest.title) : ch.ending[0]) : '抵达这里后，新的线索会写进手记。'}</p>${visited && past.length ? `<details class="journey-history"><summary>翻看走过的路 <span>${past.length}</span></summary><ol>${past.map(id => `<li>${icon('star')}<span>${ch.interactions.find(item => item.id===id)?.label ?? '找回一束星光'}</span></li>`).join('')}</ol></details>` : ''}<div class="page-stamp">${visited ? (next ? '旅途中' : '已点亮') : '下一次相遇'}</div></div>
      <div data-tab-panel="book-${ch.id}" data-tab-id="friends" hidden><span class="page-kicker">路上的朋友</span><h4>${visited ? side.title : '留一页给新的朋友'}</h4><p class="objective-text">${visited ? (sideDone ? side.ending : side.intro) : '先抵达这一章，听听他们的故事。'}</p>${visited ? `<p class="book-progress">${sideDone ? '✦ 这份心愿已经完成' : `${side.steps.filter(id=>known.has(id)).length} / ${side.steps.length} 条相遇线索`}</p>` : ''}</div>
      <div data-tab-panel="book-${ch.id}" data-tab-id="journeys" hidden><span class="page-kicker">沿途的小小约定</span>${chapterJourneys.length ? chapterJourneys.map(item => `<details class="book-journey" ${item.status === 'active' ? 'open' : ''}><summary><span>${item.status === 'complete' ? '✦' : '◇'}</span><strong>${item.title}</strong><small>${item.status === 'complete' ? '已完成' : '进行中'}</small></summary><p class="journey-location">${REGIONS.find(region => region.id === item.regionId)?.name ?? ''}</p><p class="objective-text">${item.hint}</p></details>`).join('') : '<h4>小路还等着新的脚印</h4><p class="objective-text">旅途中遇到的约定会记在这里，随时可以回来接着走。</p>'}</div>
      <div data-tab-panel="book-${ch.id}" data-tab-id="letters" hidden><span class="page-kicker">夹在书页里的来信</span>${chapterLetters.length ? chapterLetters.map(({region,item}) => `<details class="book-letter"><summary>${icon('feather')}<strong>${item.label}</strong></summary><small>${region.name} · ${item.speaker}</small><p>${item.text}</p></details>`).join('') : `<h4>这一页还空着</h4><p class="objective-text">探索时读过的信，会留在这里。</p>${icon('feather')}`}</div>
      <span class="page-number">${String(ch.index*2).padStart(2,'0')}</span></div>
    </section>`;
  }).join('');
  return `${fieldJournal(remembered?.fieldbook??save?.world.fieldbook)}<div class="traveller-book"><nav class="chapter-ribbons" aria-label="章节">${CHAPTERS.map(ch=>`<button data-tab-group="chapters" data-tab-target="${ch.id}" aria-pressed="${ch.id===active.id}" aria-label="第${ch.index}章 ${ch.title}"><b>${ch.index}</b><span>${ch.title}</span></button>`).join('')}</nav><div class="book-binding">${chapters}</div><footer class="book-bottom"><span>发现秘密 ${save?.secrets.length ?? 0}</span><span>${save?.completedChapters.length ?? 0} / ${CHAPTERS.length} 章</span></footer></div>`;
}

export interface SettingsPageOptions {sensitivity?:number;music:number;sfx:number;quality:string;fullscreen:boolean;exploration?:boolean;coopExploration?:boolean;running?:boolean;privateAccess:boolean}
export function settingsPages(options: SettingsPageOptions) {
  const nav = [['sound','sound','声音'],['display','camera','画面'],['controls','broom','操作'],['save','bag','存档']];
  return `<div class="game-settings"><nav class="settings-tabs" aria-label="设置分类">${nav.map(([key,symbol,label])=>`<button data-tab-group="settings" data-tab-target="${key}" aria-pressed="${key==='sound'}">${icon(symbol)}<span>${label}</span></button>`).join('')}</nav><div class="settings-pages">
  <section data-tab-panel="settings" data-tab-id="sound"><h3>声音</h3><label class="setting-row" for="music-volume"><span>音乐</span><output id="music-value">${Math.round(options.music*100)}%</output><input id="music-volume" type="range" min="0" max="100" value="${options.music*100}"></label><label class="setting-row" for="sfx-volume"><span>音效</span><output id="sfx-value">${Math.round(options.sfx*100)}%</output><input id="sfx-volume" type="range" min="0" max="100" value="${options.sfx*100}"></label><p class="setting-tip">耳机里也藏着森林的声音。</p></section>
  <section data-tab-panel="settings" data-tab-id="display" hidden><h3>画面</h3><label class="setting-row" for="quality"><span>画质</span><select id="quality"><option value="auto">自动</option><option value="high">细腻</option><option value="medium">均衡</option><option value="low">流畅</option></select></label><button class="setting-command" data-ui="fullscreen">${icon('fullscreen')}<span>${options.fullscreen?'退出全屏':'进入全屏'}</span>${icon('arrow')}</button><button class="setting-command" data-ui="diagnostics"><span>导出连接与画面诊断</span>↓</button><details class="setting-help"><summary>画面与全屏帮助</summary><p>自动画质会根据持续帧时调整。流畅档减少远处细节和阴影开销；均衡与细腻档保留更多表面细节。Safari 不支持全屏时，可从分享菜单添加到主屏幕。</p></details></section>
  <section data-tab-panel="settings" data-tab-id="controls" hidden><h3>操作</h3><label class="setting-row" for="look-sensitivity"><span>鼠标视角灵敏度</span><output id="look-sensitivity-value">${Math.round((options.sensitivity??1)*100)}%</output><input id="look-sensitivity" type="range" min="50" max="200" step="5" value="${(options.sensitivity??1)*100}"></label><dl class="control-pairs"><dt>移动</dt><dd><kbd>W A S D</kbd> / 左侧摇杆</dd><dt>镜头</dt><dd>点击画面启用鼠标视角，Esc 释放；右键或触屏拖动备用</dd><dt>跳跃 · 疾跑</dt><dd><kbd>空格</kbd> · <kbd>Shift</kbd></dd><dt>互动 · 攻击</dt><dd><kbd>E</kbd> · <kbd>J</kbd></dd><dt>拿出 / 收起武器</dt><dd><kbd>X</kbd> · 也可轻触收放按钮</dd><dt>扫帚 · 升降</dt><dd><kbd>B</kbd> · <kbd>R / C</kbd></dd></dl><button class="setting-command" data-ui="help">${icon('map')}<span>完整操作说明</span>${icon('arrow')}</button></section>
  <section data-tab-panel="settings" data-tab-id="save" hidden><h3>存档</h3><p class="save-mode">${options.exploration?'单人探索':options.coopExploration?'双人自由探索':'双人正式冒险'}</p><button class="setting-command" data-ui="export">${icon('bag')}<span>导出备份</span><b>↓</b></button><button class="setting-command" data-ui="import">${icon('feather')}<span>恢复备份</span><b>↑</b></button><input id="backup-file" type="file" accept="application/json,.json" hidden><details class="setting-help"><summary>备份包含什么</summary><p>${options.exploration?'保存自己的位置、镜头与搭配，双人故事进度独立保存。':options.coopExploration?'双人探索独立保存位置与搭配，不获得正式剧情奖励。备份含恢复凭证，请妥善保管。':'双人冒险备份包含进度和恢复凭证，请妥善保管。'}</p></details>${options.privateAccess?'<button class="setting-command logout-command" data-ui="site-logout">保存并退出私人口令 <span>↗</span></button>':''}</section>
  </div></div><footer class="settings-bottom"><button class="quiet" data-ui="close">返回游戏</button><button class="quiet" data-ui="home">保存并回到标题 ${icon('home')}</button></footer>`;
}
