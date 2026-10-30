import{studioCabinAt}from'./studio-regions';
/** User-supplied music. Future scenery assignments stay outside the region registry. */
export const MUSIC_CUES={
  snow:{title:'白落落村',file:'assets/audio/v15/snow.m4a'},
  'christmas-house':{title:'圣诞小屋',file:'assets/audio/v15/christmas-house.m4a'},
  'mermaid-bay':{title:'人鱼湾',file:'assets/audio/v15/mermaid-bay.m4a'},
  castle:{title:'威廉古堡',file:'assets/audio/v15/castle.m4a'},
  childhood:{title:'儿时的画',file:'assets/audio/v13/childhood.m4a'},
  'magic-forest':{title:'魔法密林（附）',file:'assets/audio/v13/magic-forest.m4a'},
  aquarius:{title:'水瓶宫',file:'assets/audio/v13/aquarius.m4a'},
} as const;
export type MusicCueId=keyof typeof MUSIC_CUES;
export function musicForRegion(regionId:string,position?:{x:number;y:number;z:number},wasInside=false):MusicCueId{
  if(regionId==='studio-winter-lantern')return position&&studioCabinAt(position,wasInside?.25:-.1)?'christmas-house':'snow';
  if(regionId==='studio-tideglass-cove')return 'mermaid-bay';
  if(regionId==='ch05-candle-castle')return 'castle';
  if(regionId==='player-home-villa')return 'aquarius';
  if(regionId==='mushroom-grove')return 'magic-forest';
  return 'childhood';
}
export const DEFERRED_MUSIC=[
  {scene:'海底世界',title:'暮光遗迹',asset:null,reason:'当前只有 NCM 文件，待浏览器可播放的音频'},
] as const;
