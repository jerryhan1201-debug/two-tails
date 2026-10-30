import {FIELD_CHAINS,chainState} from '../shared/field-chains';
import {FIELD_CONTENT,fieldContent,fieldHidesPartner,newestFieldBook,type FieldRole} from '../shared/fieldbook';
import {fieldStatus,nearestFieldStart} from './field-play';
import type {Snapshot} from './simulation';
import type {UI} from './ui';

export function fieldJournal(value:unknown){
 const b=newestFieldBook(value),known=FIELD_CONTENT.filter(c=>b.found.includes(c.id));
 const chains=FIELD_CHAINS.filter(c=>chainState(b,c.id).known).map(c=>{const a=chainState(b,c.id);return `<article class="field-story"><h3>${c.title}</h3><p>${a.complete?c.ending:c.notes[Math.max(0,a.next-1)]}</p><small>${a.done} / ${c.steps.length} 段回忆 · ${a.complete?'故事已留在手记里':'沿线看看，不急着出发'}</small></article>`;}).join('');
 return `<section class="field-journal"><span class="page-kicker">探索手记</span><h3>小路之外的发现</h3>${chains}<p>发现、结局和纪念品留在当前模式的记录里。未发现的秘密不会在地图标出。</p>${known.length?known.map(c=>`<details class="book-journey" ${b.completed.includes(c.id)?'':'open'}><summary><strong>${c.title}</strong><small>${b.completed.includes(c.id)?'已留念':'进行中'}</small></summary><p>${b.completed.includes(c.id)?c.ending:c.hint}</p>${b.completed.includes(c.id)?`<p>✦ 纪念收藏 · ${c.souvenir}</p>`:''}${c.kind==='flight'?(['gold','white'] as const).filter(r=>b.best[c.id+':'+r]!==undefined).map(r=>`<p>${r==='gold'?'小鸡毛':'小白'}最佳 · ${b.best[c.id+':'+r].toFixed(2)} 秒</p>`).join(''):''}</details>`).join(''):'<p>试着看看村西的树根小窗、蘑菇林入口的伞灯，或家园西门外的小径。靠近后轻触互动键，第一笔发现就会写在这里。</p>'}<p class="fine">已发现 ${known.length} 项 · 纪念收藏 ${b.completed.length} 件。飞行可回起点重玩；寻宝与捉迷藏需要双方相约。</p></section>`;
}
export class FieldUI {
 private prompt=0;
 constructor(private ui:UI){
  document.querySelector('.world-actions')!.insertAdjacentHTML('beforeend','<button data-ui="field-menu" id="field-menu" hidden>探索活动</button><button data-ui="field-cancel" id="field-cancel" hidden>结束活动</button>');
  document.querySelector('#hud')!.insertAdjacentHTML('beforeend','<aside id="field-status" hidden role="status"></aside>');
  document.body.insertAdjacentHTML('beforeend','<aside id="field-curtain" hidden><span>先让伙伴藏好</span><strong id="field-prepare-time"></strong><p>倒数结束后，沿西门外的小径寻找伙伴。旗带内活动，找到后靠近按 E。</p><button data-ui="field-cancel">结束捉迷藏</button></aside>');
  // The curtain is outside the regular UI root and keeps cancellation reachable.
  document.querySelector('#field-curtain button')!.addEventListener('click',()=>void this.ui.onAction('field-cancel',''));
 }
 menu(s:Snapshot,r:FieldRole){const n=nearestFieldStart(s,r);if(!n)return;const c=fieldContent(n.contentId),solo=s.mode==='exploration';
  this.ui.modal(c.title,c.hint,`${c.kind==='flight'?`<button class="primary full" data-ui="field-start" data-value="${c.id}|solo">单人练习 · 记录个人最佳</button>${solo?'':`<button class="secondary full" data-ui="field-start" data-value="${c.id}|duo">邀请伙伴比赛</button>`}`:solo?'<p>这项小游戏需要伙伴；可以先去找找沿路秘密，或练习飞行。</p>':`<p>双方确认后开始，期间隐藏伙伴地图标记和呼唤。可以随时结束。</p><button class="primary full" data-ui="field-start" data-value="${c.id}|duo">邀请伙伴一起玩</button>`}`);
 }
 update(s:Snapshot|null,r:FieldRole){
  const a=s?.fieldPlay,status=document.querySelector<HTMLElement>('#field-status')!,curtain=document.querySelector<HTMLElement>('#field-curtain')!,start=document.querySelector<HTMLElement>('#field-menu')!,cancel=document.querySelector<HTMLElement>('#field-cancel')!;
  status.hidden=!a;status.textContent=s?fieldStatus(s,r):'';start.hidden=!s||!!a||!nearestFieldStart(s,r);cancel.hidden=!a||!a.participants.includes(r);
  curtain.hidden=!(a?.kind==='hide'&&a.phase==='prepare'&&a.seeker===r);if(!curtain.hidden&&this.ui.modalOpen)this.ui.close();if(!curtain.hidden)document.querySelector('#field-prepare-time')!.textContent=Math.max(0,Math.ceil(a!.expiresAt-s!.time))+' 秒';
  document.body.classList.toggle('field-private',fieldHidesPartner(a));
  if(a?.phase==='invited'&&a.id!==this.prompt&&!this.ui.dialogueOpen&&!this.ui.modalOpen){this.prompt=a.id;const mine=a.proposer===r;this.ui.modal(mine?'等伙伴一起玩':'伙伴邀请你一起玩',fieldContent(a.siteId).title,`<p>${fieldContent(a.siteId).hint}</p><p>双方同意后开始。寻宝与捉迷藏期间隐藏伙伴地图标记及呼唤，结束后恢复。</p>${mine?'':'<button class="primary full" data-ui="field-accept">接受邀请</button>'}<button class="secondary full" data-ui="field-cancel">${mine?'取消邀请':'暂时不了'}</button>`);document.querySelector('#modal-layer')!.classList.add('field-view');}
  else if(a?.phase!=='invited'&&this.prompt){this.prompt=0;if(document.querySelector('#modal-layer.field-view'))this.ui.close();}
 }
}
