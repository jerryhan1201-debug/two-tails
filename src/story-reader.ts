import content from './story-content.json';
import {STORY_VERSION,type StoryProgress,type StoryCommand,type StoryPlayback} from '../shared/story';
import type {DogRole} from '../shared/save';
import {icon} from './ui-art';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const storyLinks=(ids:string[])=>content.filter(s=>ids.includes(s.id)).map(s=>`<button class="setting-command" data-ui="story-replay" data-value="${s.id}">${icon('feather')}<span>${escape(s.title)}</span>${icon('arrow')}</button>`).join('');
export class StoryReader {
 readonly root=document.createElement('section');
 private active:StoryPlayback|undefined;
 private key='';private readyKey='';private failed=false;private role:DogRole='gold';private paused=false;private objective='';
 private replay:{id:string;page:number}|undefined;
 onCommand:(c:StoryCommand)=>void=()=>{};
 onSave:()=>void=()=>{};
 constructor(){
  this.root.id='story-reader';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','林间故事');document.querySelector('#app')!.append(this.root);
  this.root.addEventListener('click',event=>{const action=(event.target as HTMLElement).closest<HTMLElement>('[data-story]')?.dataset.story;if(!action)return;
   if(action==='retry'){this.key='';this.render();return;}
   if(action==='save'){this.onSave();return;}
   if(this.replay){if(action==='exit'){this.replay=undefined;this.close();return;}const pages=content.find(s=>s.id===this.replay!.id)!.pages;this.replay.page=Math.max(0,Math.min(pages.length-1,this.replay.page+(action==='prev'?-1:1)));this.key='';this.render();return;}
   if(this.paused||!this.active)return;
   this.send(action as StoryCommand['action']);
  });
 }
 get isOpen(){return !this.root.hidden;}
 dismissReplay(){if(!this.replay)return false;this.replay=undefined;this.close();return true;}
 openReplay(id:string,unlocked:string[]){if(!unlocked.includes(id)||!content.some(s=>s.id===id)||this.active)return;this.replay={id,page:0};this.key='';this.render();}
 close(){this.root.hidden=true;document.body.classList.remove('story-open');this.key='';this.readyKey='';}
 reset(){this.active=undefined;this.replay=undefined;this.close();}
 update(progress:StoryProgress|undefined,role:DogRole,paused:boolean,objective:string,saveError:string,saving=false){
  this.active=progress?.active;this.role=role;this.paused=paused||!!saveError;this.objective=objective;
  if(this.active)this.replay=undefined;
  if(!this.active&&!this.replay){this.close();return;}
  this.render();
  const a=this.active;if(!a)return;
  const status=this.root.querySelector<HTMLElement>('[data-story-status]')!;
  status.textContent=saveError?'保存尚未确认，请重试后继续。':paused?'伙伴暂时离开，停在这一页。':saving?'正在保存本页…':a.skip.gold||a.skip.white?'伙伴提议共同跳过，或继续阅读。':!a.ready.gold||!a.ready.white?'等待双方载入本页；若持续等待，请双方刷新。':a.confirmed[role]?'你已读完，等待伙伴。':'和伙伴一起翻到下一页。';
  const next=this.root.querySelector<HTMLButtonElement>('[data-story="next"]')!;
  next.disabled=this.paused||saving||!a.ready.gold||!a.ready.white||a.confirmed[role]||a.skip.gold||a.skip.white;
  const skip=this.root.querySelector<HTMLButtonElement>('[data-story="skip"]');if(skip){skip.disabled=this.paused||saving;skip.textContent=a.skip[role]?'已提议跳过':a.skip.gold||a.skip.white?'同意共同跳过':'共同跳过';}
  const cancel=this.root.querySelector<HTMLButtonElement>('[data-story="cancel"]');if(cancel){cancel.hidden=!a.skip.gold&&!a.skip.white;cancel.disabled=this.paused;}
  this.root.querySelector<HTMLElement>('[data-story="save"]')!.hidden=!saveError;
  this.ready();
 }
 private send(action:StoryCommand['action']){const a=this.active;if(!a)return;this.onCommand({id:a.id,version:STORY_VERSION,page:a.page,revision:a.pageRevision,requestId:crypto.randomUUID(),action});}
 private ready(){const a=this.active;if(!a||this.paused||this.failed||a.ready[this.role])return;const key=a.id+':'+a.pageRevision;const img=this.root.querySelector<HTMLImageElement>('.story-art');if(img&&(!img.complete||!img.naturalWidth))return;if(key!==this.readyKey){this.readyKey=key;this.send('ready');}}
 private render(){
  const a=this.active,id=a?.id??this.replay?.id;if(!id)return;const s=content.find(s=>s.id===id);if(!s)return;
  const index=a?.page??this.replay!.page,summary=a?.phase==='summary',key=id+':'+index+':'+(a?.pageRevision??'replay')+':'+summary;
  if(this.root.hidden)document.dispatchEvent(new Event('goulai-input-block'));
  this.root.hidden=false;document.body.classList.add('story-open');if(key===this.key)return;this.key=key;this.failed=false;
  const page=s.pages[index];this.root.innerHTML=`<article class="story-sheet ${!summary&&page.image?'illustrated':'parchment'}"><header><span>${escape(s.title)}</span><small>${this.replay?'手记回看 · ':''}${summary?'故事小结':`${index+1} / ${s.pages.length}`}</small></header><div class="story-body">${!summary&&page.image?`<img class="story-art" src="${page.image}" alt="${escape(page.alt)}"/>`:''}<div class="story-copy"><p>${escape(summary?s.summary:page.text)}</p>${summary?`<p class="story-objective">${escape(this.objective)}</p>`:''}<button data-story="retry" hidden>重新载入插画</button></div></div><footer><span data-story-status role="status">${this.replay?'已解锁手记':''}</span><div class="story-actions">${this.replay?`<button data-story="prev" aria-label="上一页" ${index===0?'disabled':''}>${icon('arrow')}</button><button data-story="next" aria-label="下一页" ${index===s.pages.length-1?'disabled':''}>${icon('arrow')}</button><button data-story="exit">返回手记</button>`:`<button data-story="save" hidden>重试保存</button>${summary?'':'<button data-story="skip">共同跳过</button><button data-story="cancel" hidden>继续阅读</button>'}<button data-story="next" disabled>${summary?'回到旅途':'读完此页'} ${icon('arrow')}</button>`}</div></footer></article>`;
  const img=this.root.querySelector<HTMLImageElement>('.story-art');if(img){img.addEventListener('load',()=>this.ready(),{once:true});img.addEventListener('error',()=>{this.failed=true;img.hidden=true;const retry=this.root.querySelector<HTMLButtonElement>('[data-story="retry"]')!;retry.hidden=false;retry.textContent='插画暂未载入 · 重试';},{once:true});}
  this.ready();
 }
}
