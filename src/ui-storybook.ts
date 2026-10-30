import { icon } from './ui-art';

export const storybookFrame = '<svg class="a-frame" viewBox="0 0 64 64" aria-hidden="true"><use href="/assets/ui/storybook-0.4.1/frame-A.svg#frame-A"/></svg>';
export const charm = (name: string) => `<span class="a-charm">${storybookFrame}${icon(name)}</span>`;

/** Visual composition only. These actions keep the existing three save/multiplayer flows. */
export const storybookHome = () => `<div class="title-landscape" aria-hidden="true"></div><div class="title-shade" aria-hidden="true"></div>
 <div class="title-menu"><h1><img src="/assets/ui/storybook-0.4.1/wordmark.svg" alt="Two Tails"/></h1><div class="title-flourish" aria-hidden="true">${icon('ping')}<i></i>${icon('star')}</div></div>
 <div class="a-home-modes">
  <section class="a-home-mode a-primary-mode"><button class="a-mode-start" data-ui="create">${charm('feather')}<strong>双人冒险</strong>${icon('arrow','entry-arrow')}</button><div class="a-story-links"><button data-ui="join" class="a-continue"><span>加入伙伴</span></button><button data-ui="continue" id="continue-button" class="a-continue" hidden><span>继续冒险<small id="continue-chapter"></small></span></button></div></section>
  <section class="a-home-mode"><button class="a-mode-start" data-ui="explore">${charm('ping')}<strong>单人探索</strong>${icon('arrow','entry-arrow')}</button><button data-ui="continue-explore" id="continue-explore" class="a-continue" hidden><span>继续探索<small id="explore-region"></small></span>${icon('arrow')}</button></section>
  <section class="a-home-mode"><button class="a-mode-start" data-ui="create-coop">${charm('partner')}<strong>双人探索</strong>${icon('arrow','entry-arrow')}</button><button data-ui="continue-coop" id="continue-coop" class="a-continue" hidden><span>继续双人探索</span>${icon('arrow')}</button></section>
 </div><footer class="home-footer"><button data-ui="journal" class="title-book">${icon('feather')}<span>冒险手记</span></button><span class="title-edition">第十八版 · 林间回应 · 修复2</span></footer>`;

/** Only decorative frames; original Controls bindings and hit rectangles remain in place. */
export function applyStorybookControls(root: HTMLElement) {
  for (const button of root.querySelectorAll<HTMLElement>('.action-pad button,#sprint,.ping,#mount,#flight-lift button,#interact,.top-actions button')) {
    button.classList.add('a-control');
    button.insertAdjacentHTML('afterbegin', storybookFrame);
  }
}
