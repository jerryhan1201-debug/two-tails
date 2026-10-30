/** Original vector interface drawings, independent of the reference character IP. */
export const icon = (name: string, cls = '') => {
 const studio:Record<string,string>={sword:'sword',spark:'spark',nova:'spark',shield:'shield',interact:'hand',jump:'jump',dodge:'dodge',map:'map',gear:'gear',sound:'sound',broom:'broom',feather:'book',star:'star',arrow:'arrow',ping:'paw',partner:'partner',hub:'hub',leaf:'leaf'};
 if(studio[name])return `<svg class="ui-icon ${cls}" viewBox="0 0 48 48" aria-hidden="true"><use href="/assets/ui/storybook-0.4.1/goulai-glyphs.svg#${studio[name]}"/></svg>`;
 const paths:Record<string,string> = {
 sword:'<path d="m12 25 15-19 5-2-1 6-16 18M9 20l11 9M7 31l5-6m-8 4 5 5M16 22 28 8"/>',
 staff:'<path d="m8 31 15-19m-5-8 2 5 5 2 3-5-5-3-5 1Zm-8 8-1-3m20 10 3 1m-20-1-3 2"/>',
 bow:'<path d="M10 5q23 13 0 26l5-13-5-13ZM15 18h17m-6-5 6 5-6 5M5 15l4 3-4 3"/>',
 chime:'<path d="M11 14q0-8 7-8t7 8v9l4 4H7l4-4Zm4 16q3 4 6 0M18 3v3m-12 8-3 3m27-3 3 3"/>',
 spark:'<path d="M18 3q3 8 0 12 6-2 7-7 11 16 2 23-11 8-19-3-6-10 10-25Zm-1 17q-6 8 1 11 8-4 1-9"/>',
 heal:'<path d="M18 30 5 17C-1 8 12 1 18 10 24 1 37 8 31 17Z"/><path d="M18 13v10m-5-5h10"/>',
 nova:'<path d="m18 7 3 7 8 4-8 3-3 8-3-8-8-3 8-4ZM18 1v3m0 28v3M1 18h3m28 0h3M5 5l3 3m20 20 3 3M5 31l3-3M28 8l3-3"/>',
 shield:'<path d="M18 3 5 8v9q1 10 13 16 12-6 13-16V8Zm-5 14 4 4 8-9"/>',
 interact:'<path d="M12 19V9a3 3 0 0 1 6 0v10-5a3 3 0 0 1 5 0v6-3a3 3 0 0 1 5 0v7q0 8-9 9-6 0-10-6l-5-7q-1-4 3-3l5 6M22 3v3m6 2 3-2m-2 8h4"/>',
 jump:'<path d="M18 21V4m-6 6 6-6 6 6M7 30q11-5 22 0M8 24l-3 3m23-3 3 3"/><ellipse cx="13" cy="24" rx="3" ry="2"/><ellipse cx="23" cy="23" rx="3" ry="2"/>',
 dodge:'<path d="M5 26q2-15 23-13m-6-7 8 7-8 7M4 31h7m-6-13H2"/><path d="m15 25 7-3 5 4-5 5-7-2Z"/>',
 sprint:'<path d="M4 12h8M1 18h8M5 25h6m12-8q-8 0-8 8t12 0q0-6-4-8Z"/><ellipse cx="19" cy="10" rx="2.5" ry="3" transform="rotate(-20 19 10)"/><ellipse cx="27" cy="10" rx="2.5" ry="3" transform="rotate(20 27 10)"/><ellipse cx="31" cy="18" rx="2" ry="2.5"/>',
 ascend:'<path d="M18 23V4m-7 7 7-7 7 7M5 29q0-5 5-5 2-5 7-1 6-4 9 2 6-1 6 4 0 3-5 3H9q-4 0-4-3Z"/>',
 descend:'<path d="M18 4v19m-7-7 7 7 7-7M5 30h26m-23-4-3 4 3 4m20-8 3 4-3 4"/>',
 land:'<path d="m25 5-12 13m-2-2q-6 1-7 9 8 3 12-4ZM7 23l5-4m14-5v11m-4-4 4 4 4-4M5 31h26"/>',
 ping:'<path d="M12 18q-6 1-6 7t11 0q0-6-5-7Z"/><ellipse cx="8" cy="12" rx="2" ry="2.5"/><ellipse cx="15" cy="12" rx="2" ry="2.5"/><path d="M23 12q7 7 0 14m4-18q11 11 0 22"/>',
 'camera-reset':'<path d="M30 14a13 13 0 1 0-2 15M30 7v8h-8"/><path d="m18 10-6 15 6-3 6 3Z"/>',
 map:'<path d="M8 5h17q4 0 4 4v18H10q-5 0-5-4V9q0-4 3-4Zm2 0v18q-5-3-5 0m24 4q3 0 3-4V9q-4-4-4 0"/><path d="m14 12 3-2 4 4 4-1m-11 8 4-3 3 2 4-4"/>',
 bag:'<path d="M11 12V9a7 7 0 0 1 14 0v3M8 12h20l2 18H6Z"/><path d="M8 18q10 6 20 0m-13 1v5h6v-5"/>',
 gear:'<path d="m14 4-1 4-4 1-3 4 2 4-2 4 3 5 4 1 1 4h7l1-4 4-1 3-5-2-4 2-4-3-4-4-1-1-4Z"/><circle cx="18" cy="18" r="5"/>',
 camera:'<path d="M8 9h5l2-4h7l2 4h5v20H7V9Z"/><circle cx="18" cy="19" r="7"/>',
 sound:'<path d="m6 15 6 0 7-7v21l-7-7H6Zm18-4q8 7 0 14m3-18q12 11 0 22"/>',
 fullscreen:'<path d="M5 14V5h9m8 0h9v9m0 8v9h-9m-8 0H5v-9"/>',
 broom:'<path d="M27 5 14 20M13 17q-7 0-8 12 9 4 14-6ZM7 27l6-5m-3 7 6-6m8-11 3 2"/><path d="m26 22 1-3 1 3 3 1-3 1-1 3-1-3-3-1Z"/>',
 feather:'<path d="M8 29q1-20 21-23 1 19-21 23ZM8 29l17-17M16 14l1 7m5-2 5 1"/>',
 star:'<path d="m18 3 4 10 11 3-9 7 1 10-7-6-9 6 1-10-8-7 11-3Z"/>',
 home:'<path d="m4 17 14-12 14 12M8 14v18h20V14M15 32V21h7v11"/>',
 leaf:'<path d="M6 29Q1 5 29 6q1 26-23 23Zm0 0L24 11M11 14l3 8m6-4 7 2"/>',
 arrow:'<path d="M7 18h22m-9-9 9 9-9 9"/>',
 moon:'<path d="M27 25A13 13 0 0 1 13 4a14 14 0 1 0 14 21Z"/>',
 };return `<svg class="ui-icon ${cls}" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.star}</svg>`;
};
/** Gameplay controls contain only graphics; names remain available to assistive tools. */
export const controlPad = () => `<div id="look-zone" aria-label="拖动调整镜头"></div>
<div id="joystick" aria-label="移动摇杆"><span class="stick-ring"></span><span id="knob"></span></div>
<div id="interaction-prompt" hidden><kbd class="interaction-key" aria-label="E"><svg viewBox="0 0 20 24" aria-hidden="true"><path d="M5 4V20H15M5 4H15M5 12H14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg></kbd><span id="interact-label"></span></div>
<button id="interact" data-action="interact" aria-label="互动" hidden>${icon('interact')}</button>
<button id="more-actions" data-ui="more-actions" aria-expanded="false" aria-label="展开或收起战斗动作">动作</button>
<div class="action-pad">
 <button class="skill skill-one" data-action="skill1" data-key="1" aria-label="星火"><span id="skill1-icon">${icon('spark')}</span><b class="cooldown-value"></b></button>
 <button class="skill skill-two" data-action="skill2" data-key="2" aria-label="暖光治愈"><span id="skill2-icon">${icon('heal')}</span><b class="cooldown-value"></b></button>
 <button class="attack" data-action="attack" data-key="J / 左键" aria-label="攻击"><span id="attack-icon">${icon('sword')}</span><b class="cooldown-value"></b></button>
 <button class="dodge" data-action="dodge" data-key="Q" aria-label="闪避">${icon('dodge')}<b class="cooldown-value"></b></button>
 <button class="jump" data-action="jump" data-key="Space" aria-label="跳跃">${icon('jump')}</button>
</div>
<button id="sprint" data-sprint aria-label="切换持续疾跑" aria-pressed="false">${icon('sprint')}</button>
<div id="flight-controls"><button id="mount" data-action="mount" data-key="B" aria-label="召出扫帚" aria-pressed="false"><span id="mount-icon">${icon('broom')}</span></button><button id="weapon-toggle" data-action="toggleWeapon" data-key="X" aria-label="收起武器"><span id="weapon-toggle-label">收起武器</span></button><div id="flight-lift" hidden><button data-lift="1" data-key="R" aria-label="升高">${icon('ascend')}</button><button data-lift="-1" data-key="C" aria-label="降低">${icon('descend')}</button></div><span id="flight-status"></span></div>
<button class="ping" data-action="ping" data-key="F" aria-label="呼唤伙伴">${icon('ping')}</button>`;
export const mapDrawing = `<svg viewBox="0 0 860 490" preserveAspectRatio="none" class="map-land" aria-hidden="true"><defs><pattern id="paper-fibre" width="29" height="23" patternUnits="userSpaceOnUse"><path d="M3 8h8m8 11h4" stroke="#9b845d" stroke-opacity=".08"/></pattern><linearGradient id="map-paper" x2="1" y2="1"><stop stop-color="#f4e8c6"/><stop offset="1" stop-color="#dcca9f"/></linearGradient></defs><rect width="860" height="490" rx="24" fill="url(#map-paper)"/><path d="M91 367Q38 311 89 251T123 136Q171 76 248 100T345 60Q410 28 472 78T594 53Q700 29 746 123T782 239Q818 335 735 376T630 440Q542 465 495 414T384 436Q318 467 255 416T91 367Z" fill="#d6d5a3" stroke="#a3b28a" stroke-width="3"/><path d="M125 340Q199 262 270 311T397 287Q470 222 523 239T687 125" fill="none" stroke="#97bcc0" stroke-width="19" stroke-linecap="round"/><path d="M123 338Q201 263 270 308T399 285Q472 223 523 237T686 125" fill="none" stroke="#cbe0d7" stroke-width="6" stroke-linecap="round"/><g fill="#a8b887" stroke="#82986b" stroke-width="1.5">${[[160,155],[183,177],[208,140],[300,155],[331,178],[315,125],[596,330],[623,350],[650,323],[691,305],[405,350],[430,366],[453,340]].map(([x,y])=>`<path d="m${x} ${y} 10-24 10 24-7-3v12h-6v-12Z"/>`).join('')}</g><g fill="#b4b4a0" stroke="#8d9d90" stroke-width="2"><path d="m521 118 27-55 29 55-13-5-17 12-14-12Z"/><path d="m561 114 34-63 36 63-17-6-19 10-19-11Z"/><path d="m603 117 28-40 27 40-12-5-15 8-14-8Z"/></g><g fill="#f1ecd6"><path d="m537 83 11-20 12 24-12-6-8 9Z"/><path d="m581 77 14-26 17 30-17-8-6 9Z"/></g><g fill="none" stroke="#a69672" stroke-width="1.5"><path d="M23 41q18-9 29 0m-20 8q17-9 27 0M762 430q19-8 37 0m-27 8q17-8 35 0M726 45l6-13 6 13-6-4Z"/><circle cx="789" cy="76" r="27"/><path d="m789 41 7 35-7 35-7-35Z"/></g><text x="789" y="26" text-anchor="middle" fill="#786946" font-size="13">北</text><rect width="860" height="490" rx="24" fill="url(#paper-fibre)"/></svg>`;
