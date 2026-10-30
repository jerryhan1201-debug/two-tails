import {rebindCastle} from './castle-rebind';
/** Stable content identifiers are save keys. Add chapters; never renumber saved IDs. */
export type Biome =
  | "village"
  | "river"
  | "forest"
  | "graveyard"
  | "castle"
  | "mountain"
  | "dragon";
export type Point = { x: number; z: number; y?:number };
export type Reward = {
  weapon?: string;
  skill?: string;
  skin?: string;
  xp?: number;
};
export type LandmarkKind =
  | "house"
  | "windmill"
  | "bridge"
  | "ruin"
  | "grave"
  | "castle"
  | "crystal"
  | "dragonNest"
  | "tree"
  | "camp"
  | "rock"
  | "lantern"
  | "arch"
  | "water";
export type Landmark = Point & {
  id: string;
  kind: LandmarkKind;
  scale?: number;
  rotation?: number;
};
export type EnemyKind =
  | "slime"
  | "wolf"
  | "sprite"
  | "zombie"
  | "bat"
  | "golem"
  | "dragon";
export type BossPhase = {
  threshold: number;
  label: string;
  pattern:
    | "slam"
    | "charge"
    | "volley"
    | "summon"
    | "breath"
    | "tail"
    | "storm";
  hint: string;
};
export type Encounter = Point & {
  id: string;
  kind: EnemyKind;
  count: number;
  elite?: boolean;
  boss?: boolean;
  name?: string;
  phases?: BossPhase[];
};
export type Interaction = Point & {
  id: string;
  kind: "beacon" | "relic" | "npc" | "supply" | "plate";
  label: string;
  text: string;
  /** Authored correspondence can identify its writer without spawning another NPC. */
  speaker?: string;
  portrait?: string;
  questRole?: "main" | "side";
  requiresClear?: boolean;
  /** Local scene props can request line-of-sight without changing old interactions. */
  requiresClearPath?: boolean;
  reward?: Reward;
  pair?: string;
  hint?: string;
  /** Discovery is available only while standing on this authored landing surface. */
  surfaceId?: string;
  afterBoss?: boolean;
};
export type Secret = Interaction & { hint: string };
export type ChapterPath = {
  id: string;
  points: [number, number][];
  width: number;
  kind: "stone" | "dirt" | "bridge";
};
export type TerrainRectangle = Point & { width: number; depth: number };
export type Terrain = {
  water?: TerrainRectangle[];
  platforms?: (TerrainRectangle & { id: string; height: number; requiresFlag?: string })[];
  shelters?: (Point & { radius: number })[];
  blocked?: TerrainRectangle[];
  cliffs?: TerrainRectangle[];
};
export type SideQuest = {
  id: string;
  title: string;
  intro: string;
  steps: string[];
  ending: string;
  reward: Reward;
};
export type Quest = { title: string; steps: string[]; side: SideQuest };
export type WorldEvent = {
  id: string;
  title: string;
  trigger: Point & { radius: number };
  description: string;
  spawns: Encounter[];
  resolution: string;
  reward?: Reward;
};
export type Chapter = {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  biome: Biome;
  intro: string[];
  ending: string[];
  spawn: Point;
  camp: Point;
  exit: Point;
  palette: {
    sky: string;
    fog: string;
    ground: string;
    leaf: string;
    accent: string;
  };
  landmarks: Landmark[];
  paths: ChapterPath[];
  terrain: Terrain;
  encounters: Encounter[];
  interactions: Interaction[];
  secrets: Secret[];
  quest: Quest;
  event: WorldEvent;
};

export const CHAPTERS: Chapter[] = [
  {
    id: "ch01-lantern-village",
    index: 1,
    title: "灯火村与晨光森林",
    subtitle: "出发时，记得带上伙伴",
    biome: "village",
    intro: [
      "面包还在烤，村里的星灯却一起熄灭了。钟楼只剩一颗温热的火星。",
      "邮差獾看见恶龙带着星光飞向北方。先替村子找回三盏路灯，再沿森林追寻它。",
    ],
    ending: [
      "晨光重新落上村庄的屋顶。两只小狗把第一枚星种放进了行囊。",
      "恶龙留下的脚印很深；脚印旁，却有一枚被它小心避开的鸟蛋。",
    ],
    spawn: { x: 0, z: -11 },
    camp: { x: -7, z: 1 },
    exit: { x: 1, z: 105 },
    palette: {
      sky: "#b7d9e4",
      fog: "#d7e1cf",
      ground: "#759858",
      leaf: "#497745",
      accent: "#ffcc7a",
    },
    landmarks: [
      {
        id: "v-bakery",
        kind: "house",
        x: -15,
        z: 3,
        scale: 1.25,
        rotation: 0.25,
      },
      { id: "v-post", kind: "house", x: 13, z: 7, scale: 0.95, rotation: -0.4 },
      {
        id: "v-cottage",
        kind: "house",
        x: -22,
        z: 21,
        scale: 0.85,
        rotation: 0.5,
      },
      { id: "v-fork-tree", kind: "tree", x: 8, z: 33, scale: 1.7 },
      { id: "v-stream", kind: "water", x: 22, z: 37, scale: 1 },
      { id: "v-footbridge", kind: "bridge", x: 25, z: 37, scale: .85 },
      { id: "v-orchard", kind: "tree", x: 28, z: 27, scale: 1.15 },
      { id: "v-ruin", kind: "ruin", x: -25, z: 65, scale: 1.0 },
      { id: "v-arch", kind: "arch", x: 1, z: 103, scale: 1.25 },
    ],
    paths: [
      {id:'village-home-path',points:[[24,48],[27,54],[31,59]],width:3.5,kind:'dirt'},
      {
        id: "v-main",
        points: [
          [0, -16],
          [0, 12],
          [-6, 25],
          [5, 42],
          [-3, 57],
          [6, 72],
          [0, 90],
          [1, 108],
        ],
        width: 4.7,
        kind: "stone",
      },
      {
        id: "v-orchard-path",
        points: [
          [-6, 25],
          [13, 24],
          [27, 32],
          [24, 48],
          [-3, 57],
        ],
        width: 2.5,
        kind: "dirt",
      },
      {
        id: "v-orchard-terrace-loop",
        points: [[23, 18], [27, 20], [30.5, 23], [34, 26.5], [33, 30.5], [27, 32]],
        width: 1.8,
        kind: "dirt",
      },
      {
        id: "v-moss-path",
        points: [
          [5, 42],
          [-19, 47],
          [-29, 63],
          [-22, 76],
          [6, 72],
        ],
        width: 2.1,
        kind: "dirt",
      },
    ],
    terrain: {
      water: [{x:40,z:37,width:64,depth:5}],
      platforms: [
        { id: "v-orchard-step-one", x: 27, z: 20, width: 3.5, depth: 3.2, height: 1.05 },
        { id: "v-orchard-step-two", x: 30.5, z: 23, width: 3.6, depth: 3.5, height: 1.6 },
        { id: "v-orchard-lookout", x: 34, z: 26.5, width: 4.0, depth: 4.1, height: 2.0 },
        { id: "v-orchard-return", x: 33, z: 30.5, width: 3.4, depth: 3.2, height: 1.05 },
      ],
    },
    encounters: [
      { id: "v-slime-1", kind: "slime", x: -6, z: 24, count: 3 },
      { id: "v-slime-2", kind: "slime", x: 22, z: 45, count: 2 },
      { id: "v-wolf-1", kind: "wolf", x: -1, z: 52, count: 3 },
      { id: "v-sprite-1", kind: "sprite", x: 5, z: 72, count: 2 },
      {
        id: "v-boss",
        kind: "golem",
        x: 0,
        z: 90,
        count: 1,
        boss: true,
        name: "打瞌睡的荆棘守卫",
        phases: [
          {
            threshold: 1,
            label: "慢半拍的重拳",
            pattern: "slam",
            hint: "脚下金圈收束时跳过低矮根波，或退到圈外；守卫停顿时再靠近反击。",
          },
          {
            threshold: 0.5,
            label: "醒来的树根",
            pattern: "summon",
            hint: "先驱散小怪，让伙伴放心施法。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "v-lamp-market",
        kind: "beacon",
        x: -6,
        z: 25,
        label: "集市星灯",
        text: "星灯亮了。面包师喊：带两块路上吃，不许饿着冒险！",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "v-lamp-edge",
        kind: "beacon",
        x: -3,
        z: 55,
        label: "林缘星灯",
        text: "灯罩上有一片蓝色龙鳞，碰起来却冷得像霜。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "v-lamp-guard",
        kind: "beacon",
        x: 6,
        z: 74,
        label: "守林星灯",
        text: "通往溪谷的路亮起来了。守卫胸口的星种也在回应。",
        questRole: "main",
        requiresClear: true,
        reward: { skill: "heal", xp: 40 },
      },
      {
        id: "v-post-npc",
        kind: "npc",
        x: 16,
        z: 15,
        label: "邮差的烦恼",
        text: "獾先生：第一天上班就丢了邮包……它应该在溪桥那边的果园，别告诉奶奶。东边苹果记号是我练习跑跳的矮石台；不走石台也能沿普通果园路过去。",
        questRole: "side",
      },
      {
        id: "v-post-bag",
        kind: "supply",
        x: 30,
        z: 43,
        label: "树根下的邮包",
        text: "邮包里是给守林人的围巾，还有一封写着「早点回家」的信。",
        questRole: "side",
        requiresClear: true,
      },
      {
        id: "v-post-home",
        kind: "npc",
        x: -28,
        z: 70,
        label: "把信交给守林人",
        text: "守林人接过信，认真地把你的名字记进了村庄的勇士簿。",
        questRole: "side",
        reward: { skin: "forest", xp: 50 },
      },
    ],
    secrets: [
      {
        id: "v-secret-orchard-lookout",
        kind: "relic", x: 34, z: 26.5, surfaceId: "v-orchard-lookout",
        label: "邮差的练习路",
        text: "矮石墙上夹着邮差小时候的路线卡：先跃上第一块宽石台，再顺着苹果记号绕回果园。背面写着：跑得快很好，记得等一等同行的人。你找到一枚护身星纹，学会在危险前为伙伴撑起星光护盾。",
        hint: "邮差小路旁的苹果记号向上延伸，第三块宽石台能看见溪桥。",
        reward: { skill: "shield", xp: 35 },
      },
      {
        id: "v-secret-paw",
        kind: "relic",
        x: 31,
        z: 19,
        label: "第一位冒险家的脚印",
        text: "石头上的小爪印比你的还小。下面刻着：勇敢，也可以先从出门开始。",
        hint: "果园篱笆后，有一串朝石头走去的小脚印。",
        reward: { xp: 25 },
      },
      {
        id: "v-secret-bell",
        kind: "relic",
        x: -34,
        z: 57,
        label: "会打嗝的风铃",
        text: "叮——嗝！原来风铃里藏着一颗糖。它赠给你一枚轻风护符。",
        hint: "苔藓小路里传来一声不太像鸟叫的「叮嗝」。",
        reward: { skill: "shield", xp: 25 },
      },
    ],
    quest: {
      title: "重燃三盏星灯，唤醒林门守卫",
      steps: ["v-lamp-market", "v-lamp-edge", "v-lamp-guard"],
      side: {
        id: "v-post-quest",
        title: "第一天的邮差",
        intro: "果园边的邮差似乎需要帮助。",
        steps: ["v-post-npc", "v-post-bag", "v-post-home"],
        ending: "一封平凡的信，也值得绕一点远路。",
        reward: { skin: "forest", xp: 50 },
      },
    },
    event: {
      id: "v-event-orchard",
      title: "果园里的不速之客",
      trigger: { x: 24, z: 45, radius: 8 },
      description: "果筐突然晃动！被失落星光惊醒的果冻怪从苹果堆里冒出来。",
      spawns: [{ id: "v-ambush-a", kind: "slime", x: 27, z: 45, count: 3 }],
      resolution: "最后一颗苹果落地。果园安静了，筐底留下一小袋补给。",
      reward: { xp: 35 },
    },
  },
  {
    id: "ch02-windmill-river",
    index: 2,
    title: "溪谷与旧风车",
    subtitle: "风停下的时候，借彼此一点力",
    biome: "river",
    intro: [
      "溪谷的水车停止转动，两岸居民隔着水面喊话。",
      "旧风车的引水门必须从两侧同时开启。先找到失散的水轮零件，再与伙伴站上两个踏板。",
    ],
    ending: [
      "风车转起第一圈，沉睡的水声回到了溪谷。弓匠把修好的弓送给了两位冒险家。",
      "水底露出古老壁画：巨龙曾经守着一棵比城堡还高的树。",
    ],
    spawn: { x: -11, z: -11 },
    camp: { x: -18, z: 1 },
    exit: { x: 10, z: 105 },
    palette: {
      sky: "#b8dfdc",
      fog: "#d1e5d5",
      ground: "#739b68",
      leaf: "#3e7661",
      accent: "#e8c98b",
    },
    landmarks: [
      { id: "r-fisher-house", kind: "house", x: -28, z: 13, scale: 0.9 },
      { id: "r-water-mill", kind: "windmill", x: -22, z: 51, scale: 1.6 },
      { id: "r-west-bridge", kind: "bridge", x: -16, z: 35, scale: 1.4 },
      { id: "r-east-bridge", kind: "bridge", x: 20, z: 65, scale: 1.4 },
      { id: "r-island-tree", kind: "tree", x: 3, z: 48, scale: 1.8 },
      { id: "r-dam", kind: "ruin", x: -20, z: 79, scale: 1.3 },
      { id: "r-exit", kind: "arch", x: 10, z: 103 },
    ],
    paths: [
      {
        id: "r-main",
        points: [
          [-11, -16],
          [-12, 21],
          [-16, 35],
          [-12, 48],
          [5, 54],
          [20, 65],
          [11, 79],
          [10, 108],
        ],
        width: 4.2,
        kind: "dirt",
      },
      {
        id: "r-west-crossing",
        points: [
          [-16, 29],
          [-16, 41],
        ],
        width: 6,
        kind: "bridge",
      },
      {
        id: "r-east-crossing",
        points: [
          [20, 59],
          [20, 71],
        ],
        width: 6,
        kind: "bridge",
      },
      {
        id: "r-fishers-path",
        points: [
          [-12, 21],
          [-30, 23],
          [-31, 46],
          [-22, 53],
          [5, 54],
        ],
        width: 2.4,
        kind: "dirt",
      },
      {
        id: "r-east-bank",
        points: [
          [-12, 48],
          [10, 44],
          [31, 48],
          [31, 78],
          [11, 79],
        ],
        width: 2.6,
        kind: "dirt",
      },
    ],
    terrain: {
      water: [
        { x: 0, z: 35, width: 78, depth: 7 },
        { x: 0, z: 65, width: 78, depth: 7 },
      ],
      platforms: [
        { id: "r-bank-start", x: 30, z: 59.5, width: 3.8, depth: 3.6, height: .35 },
        { id: "r-sluice-stone-one", x: 31, z: 62.7, width: 3.5, depth: 3.6, height: .55, requiresFlag: "r-plate-east" },
        { id: "r-sluice-lookout", x: 31, z: 66.2, width: 3.8, depth: 3.6, height: .65, requiresFlag: "r-plate-east" },
        { id: "r-sluice-stone-three", x: 30, z: 69.5, width: 3.5, depth: 3.6, height: .4, requiresFlag: "r-plate-east" },
        { id: "r-bank-finish", x: 28.5, z: 72.5, width: 3.5, depth: 3.5, height: .3 },
      ],
    },
    encounters: [
      { id: "r-slimes", kind: "slime", x: -10, z: 23, count: 3 },
      { id: "r-sprites", kind: "sprite", x: 6, z: 48, count: 3 },
      { id: "r-wolves", kind: "wolf", x: 28, z: 75, count: 3 },
      { id: "r-golem", kind: "golem", x: -21, z: 80, count: 1, elite: true },
      {
        id: "r-boss",
        kind: "slime",
        x: 10,
        z: 91,
        count: 1,
        boss: true,
        name: "泡泡河神",
        phases: [
          {
            threshold: 1,
            label: "涨潮前的波纹",
            pattern: "volley",
            hint: "水泡会依次落在三处亮圈，离开锁定落点；跳跃也不能挡住头顶水泡。",
          },
          {
            threshold: 0.5,
            label: "拍岸浪",
            pattern: "slam",
            hint: "低矮拍岸波抵达时跳起，或退到亮圈外；落地后靠近它反击。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "r-wheel",
        kind: "relic",
        x: -10,
        z: 24,
        label: "找回水轮轴芯",
        text: "轴芯卡在河滩石缝里。上面的刻痕刚好对准风车的月牙标记。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "r-plate-west",
        kind: "plate",
        x: -5,
        z: 51,
        label: "西岸引水踏板",
        text: "先找回轴芯，再与伙伴分别站稳在两块踏板上约两秒。水门会记住已经接上的力量，不必反复对拍。",
        questRole: "main",
        pair: "river-gate",
        requiresClear: true,
      },
      {
        id: "r-plate-east",
        kind: "plate",
        x: 7,
        z: 51,
        label: "东岸引水踏板",
        text: "两边的星纹接在一起，水门终于抬起。风车的帆与水轮开始转动，东岸白色刻度处的宽石台也露出了水面。",
        questRole: "main",
        pair: "river-gate",
        requiresClear: true,
      },
      {
        id: "r-flow",
        kind: "beacon",
        x: 12,
        z: 78,
        label: "重新引导溪流",
        text: "清澈溪水转动叶轮。一把柳木弓从防水匣里弹了出来。",
        questRole: "main",
        requiresClear: true,
        reward: { weapon: "bow", xp: 60 },
      },
      {
        id: "r-npc-frog",
        kind: "npc",
        x: -30,
        z: 24,
        label: "青蛙船长",
        text: "船长说自己的帽子被风卷走了。没有帽子，今天连「呱」都不够威风。",
        questRole: "side",
      },
      {
        id: "r-hat",
        kind: "supply",
        x: 31,
        z: 46,
        label: "芦苇上的船长帽",
        text: "帽子里蜷着一只午睡的蜗牛。你给它另找了片宽叶子。",
        questRole: "side",
      },
      {
        id: "r-return-hat",
        kind: "npc",
        x: 30,
        z: 80,
        label: "把帽子送到下游码头",
        text: "船长恢复了威风：呱！这串潮汐铃归你们了。",
        questRole: "side",
        reward: { weapon: "chime", xp: 50 },
      },
    ],
    secrets: [
      {
        id: "r-secret-tide-marker", kind: "relic", x: 31, z: 66.2,
        surfaceId: "r-sluice-lookout", label: "退水后的潮汐刻度",
        text: "两岸踏板把旧闸抬起，宽石台露出水面，沿芦苇可以绕回上游。刻度旁留着船长父亲的一行字：水会走远，回家的路要留下。刻度槽里还留着一串潮汐铃，现在可以把它带上旅途。",
        hint: "东岸芦苇间有一串没入水中的白色刻度，等两岸水门一起升起再回来。",
        reward: { weapon: "chime", xp: 45 },
      },
      {
        id: "r-secret-wall",
        kind: "relic",
        x: -33,
        z: 55,
        label: "水后的旧壁画",
        text: "壁画上，巨龙用翅膀替幼鸟挡雨。它曾经是守护者。",
        hint: "风车背后，水光映出一条不属于石头的金线。",
        reward: { xp: 35 },
      },
      {
        id: "r-secret-bottle",
        kind: "relic",
        x: 34,
        z: 89,
        label: "给未来的漂流瓶",
        text: "「希望捡到这封信的人，今天有人陪着。」瓶底是一颗完好的星砂。",
        hint: "下游一簇金色芦苇间，有微弱的玻璃闪光。",
        reward: { skill: "nova", xp: 35 },
      },
    ],
    quest: {
      title: "修复水轮，与伙伴同时开启两岸踏板",
      steps: ["r-wheel", "r-plate-west", "r-plate-east", "r-flow"],
      side: {
        id: "r-captain",
        title: "没有帽子的船长",
        intro: "西岸有一位垂头丧气的青蛙船长。",
        steps: ["r-npc-frog", "r-hat", "r-return-hat"],
        ending: "溪谷恢复了一顶帽子的尊严。",
        reward: { weapon: "chime", xp: 50 },
      },
    },
    event: {
      id: "r-event-current",
      title: "水门后的暗流",
      trigger: { x: 20, z: 74, radius: 7 },
      description:
        "松开的水门惊动了岸边的精灵。它们围住出口，水面泛起警告的涟漪。",
      spawns: [
        { id: "r-current-sprites", kind: "sprite", x: 18, z: 77, count: 3 },
      ],
      resolution: "暗流平复，通往下游的河岸重新安全。",
      reward: { xp: 45 },
    },
  },
  {
    id: "ch03-wandering-woods",
    index: 3,
    title: "迷途森林与星光遗迹",
    subtitle: "迷路的，未必只有旅人",
    biome: "forest",
    intro: [
      "森林里的路标全都指着「回家」。可谁也不知道家在哪一边。",
      "三块星碑记得旧路。唤醒它们，也许能听见这片森林真正的故事。",
    ],
    ending: [
      "星碑拼出了一幅地图：云山上的生命树正在枯萎，树下挤满失去家园的生灵。",
      "原来恶龙拿走星光，是想救它们。但森林也正在为此失去光明。",
    ],
    spawn: { x: 7, z: -11 },
    camp: { x: 13, z: 0 },
    exit: { x: -4, z: 105 },
    palette: {
      sky: "#8eb7b6",
      fog: "#88aead",
      ground: "#416e62",
      leaf: "#23564e",
      accent: "#91e8ca",
    },
    landmarks: [
      { id: "f-great-tree", kind: "tree", x: -4, z: 31, scale: 2.3 },
      { id: "f-first-ring", kind: "ruin", x: -23, z: 29, scale: 1.3 },
      { id: "f-moon-pool", kind: "water", x: 17, z: 52, scale: 1.7 },
      { id: "f-root-gate", kind: "arch", x: 0, z: 69, scale: 1.3 },
      { id: "f-third-ring", kind: "ruin", x: -18, z: 77, scale: 1.5 },
      { id: "f-glow-tree", kind: "tree", x: 30, z: 73, scale: 1.6 },
      { id: "f-star-exit", kind: "arch", x: -4, z: 103 },
    ],
    paths: [
      {
        id: "f-winding",
        points: [
          [7, -15],
          [2, 13],
          [-23, 29],
          [-13, 43],
          [20, 51],
          [12, 66],
          [-18, 77],
          [-4, 91],
          [-4, 108],
        ],
        width: 3.7,
        kind: "dirt",
      },
      {
        id: "f-outer-west",
        points: [
          [2, 13],
          [-29, 13],
          [-33, 43],
          [-29, 65],
          [-18, 77],
        ],
        width: 2.2,
        kind: "dirt",
      },
      {
        id: "f-root-shortcut",
        points: [
          [-13, 43],
          [-3, 54],
          [0, 69],
          [-18, 77],
        ],
        width: 2.4,
        kind: "stone",
      },
      {
        id: "f-memory-terrace-loop",
        points: [[-3, 54], [3, 60], [6.5, 63], [9.5, 66.5], [6.5, 70.5], [0, 69]],
        width: 1.9,
        kind: "stone",
      },
      {
        id: "f-mushroom",
        points: [
          [20, 51],
          [33, 49],
          [32, 75],
          [14, 89],
          [-4, 91],
        ],
        width: 2.2,
        kind: "dirt",
      },
    ],
    terrain: {
      water: [{ x: 17, z: 57, width: 11, depth: 7 }],
      platforms: [
        { id: "f-memory-step-one", x: 3, z: 60, width: 3.6, depth: 3.4, height: .35 },
        { id: "f-memory-step-two", x: 6.5, z: 63, width: 3.8, depth: 3.6, height: .9 },
        { id: "f-memory-terrace", x: 9.5, z: 66.5, width: 4.4, depth: 4.5, height: 1.45 },
        { id: "f-memory-return", x: 6.5, z: 70.5, width: 3.4, depth: 3.4, height: .65 },
      ],
    },
    encounters: [
      { id: "f-wolves-west", kind: "wolf", x: -23, z: 29, count: 4 },
      { id: "f-sprites-pool", kind: "sprite", x: 21, z: 50, count: 4 },
      { id: "f-golem-roots", kind: "golem", x: -16, z: 76, count: 2 },
      { id: "f-wolves-path", kind: "wolf", x: -30, z: 58, count: 2 },
      {
        id: "f-boss",
        kind: "golem",
        x: -4,
        z: 91,
        count: 1,
        boss: true,
        name: "记忆的树心",
        phases: [
          {
            threshold: 1,
            label: "根须回响",
            pattern: "slam",
            hint: "根须亮起时跳过低矮根波，或离开亮圈；等树心收回根须再靠近。",
          },
          {
            threshold: 0.6,
            label: "遗忘的守卫",
            pattern: "summon",
            hint: "小精灵会保护树心，先解决它们。",
          },
          {
            threshold: 0.3,
            label: "星叶风暴",
            pattern: "volley",
            hint: "保持移动，趁落叶间隙攻击。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "f-stone-path",
        kind: "beacon",
        x: -23,
        z: 30,
        label: "路径星碑",
        text: "星碑低语：最早的龙没有王冠，只有一群需要庇护的小动物。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "f-stone-rain",
        kind: "beacon",
        x: 21,
        z: 50,
        label: "雨水星碑",
        text: "壁画里的星光汇成一条河，同时流向王国与云山。后来，有人封闭了山上的水道。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "f-stone-heart",
        kind: "beacon",
        x: -18,
        z: 78,
        label: "树心星碑",
        text: "最后一条旧路显现。你学会让星光在掌心绽开。",
        questRole: "main",
        requiresClear: true,
        reward: { skill: "nova", xp: 75 },
      },
      {
        id: "f-moth-npc",
        kind: "npc",
        x: -30,
        z: 17,
        label: "忘了名字的飞蛾",
        text: "飞蛾记得一片发蓝的叶子，却忘了回巢的方向。",
        questRole: "side",
      },
      {
        id: "f-moth-leaf",
        kind: "relic",
        x: 34,
        z: 49,
        label: "拾起会唱歌的蓝叶",
        text: "叶脉唱出细细的旋律。飞蛾的翅膀开始随之闪烁。",
        questRole: "side",
      },
      {
        id: "f-moth-home",
        kind: "npc",
        x: 31,
        z: 79,
        label: "送飞蛾回到光巢",
        text: "巢里的小灯一盏盏点亮。「我想起来了，我叫微光。」",
        questRole: "side",
        reward: { skin: "forest", xp: 65 },
      },
    ],
    secrets: [
      {
        id: "f-secret-shared-memory", kind: "relic", x: 9.5, z: 66.5,
        surfaceId: "f-memory-terrace", label: "树心留下的另一条路",
        text: "断阶尽头的浮雕保存了被抹去的半幅星图：山上与山下原本共享一条河。树心记住了每个被庇护的小生命，也记住了有人关上水门的那一天。记忆片化成一件月夜披风，提醒你把这段故事带出森林。",
        hint: "树根捷径东侧，断裂石阶上的三片铜叶指向一座低矮遗迹台。",
        reward: { skin: "moon", xp: 60 },
      },
      {
        id: "f-secret-library",
        kind: "relic",
        x: -35,
        z: 47,
        label: "树洞图书馆",
        text: "借阅册上最近的签名是恶龙：借《让树重新长大》，尚未归还。",
        hint: "树根西侧，一只蘑菇上画着极小的书。",
        reward: { xp: 45 },
      },
      {
        id: "f-secret-stargazer",
        kind: "relic",
        x: 34,
        z: 89,
        label: "倒着看的星空",
        text: "水洼里的星星与天空不同。那是旧水道的地图，正通往城堡下方。",
        hint: "蘑菇小路尽头，晴天的水洼也会闪星星。",
        reward: { skill: "shield", xp: 45 },
      },
    ],
    quest: {
      title: "唤醒三块星碑，穿过树心之门",
      steps: ["f-stone-path", "f-stone-rain", "f-stone-heart"],
      side: {
        id: "f-moth-quest",
        title: "名字叫微光",
        intro: "西边树洞里传来细小的求助声。",
        steps: ["f-moth-npc", "f-moth-leaf", "f-moth-home"],
        ending: "一只飞蛾的归途，点亮了整棵树。",
        reward: { skin: "forest", xp: 65 },
      },
    },
    event: {
      id: "f-event-sentry",
      title: "遗迹醒来了",
      trigger: { x: 1, z: 65, radius: 9 },
      description:
        "踩到的古老星纹突然发亮。守卫误把你们当成了偷星者，树根间亮起危险的符号。",
      spawns: [
        {
          id: "f-sentry-one",
          kind: "golem",
          x: 0,
          z: 68,
          count: 1,
          elite: true,
        },
        { id: "f-sentry-sprites", kind: "sprite", x: 5, z: 65, count: 2 },
      ],
      resolution: "守卫终于认出了星种，低头让开道路。",
      reward: { xp: 60 },
    },
  },
  {
    id: "ch04-moonlit-graveyard",
    index: 4,
    title: "月雾墓园",
    subtitle: "有些告别，也可以温柔",
    biome: "graveyard",
    intro: [
      "月雾在墓碑之间流动。这里的亡者并不想吓人，只是找不到安眠的方向。",
      "守墓奶奶请你们点亮三座纪念灯。记住名字，就能把迷失的人送回梦里。",
    ],
    ending: [
      "最后一座灯亮起，墓园恢复安宁。守墓奶奶把城堡钥匙郑重放进你的爪心。",
      "旧王的碑文写着：他曾封闭通往云山的星渠，以为王国会因此永远明亮。",
    ],
    spawn: { x: -2, z: -11 },
    camp: { x: -11, z: 0 },
    exit: { x: 0, z: 105 },
    palette: {
      sky: "#323d65",
      fog: "#586480",
      ground: "#526576",
      leaf: "#354e62",
      accent: "#c1cbff",
    },
    landmarks: [
      { id: "g-gate", kind: "arch", x: -2, z: 10, scale: 1.3 },
      { id: "g-caretaker", kind: "house", x: -24, z: 4, scale: 0.85 },
      { id: "g-west-crypt", kind: "ruin", x: -21, z: 31, scale: 1.2 },
      { id: "g-grave-one", kind: "grave", x: -15, z: 47, scale: 1.6 },
      { id: "g-grave-two", kind: "grave", x: 15, z: 41, scale: 1.4 },
      { id: "g-chapel", kind: "castle", x: 23, z: 58, scale: 0.65 },
      { id: "g-old-king", kind: "grave", x: 0, z: 77, scale: 2 },
      { id: "g-moon-gate", kind: "arch", x: 0, z: 103, scale: 1.2 },
    ],
    paths: [
      {
        id: "g-procession",
        points: [
          [-2, -15],
          [-2, 16],
          [-21, 29],
          [-8, 45],
          [23, 55],
          [8, 69],
          [0, 79],
          [0, 108],
        ],
        width: 4.2,
        kind: "stone",
      },
      {
        id: "g-names-path",
        points: [
          [-21, 29],
          [-33, 37],
          [-32, 61],
          [-19, 80],
          [0, 79],
        ],
        width: 2.3,
        kind: "dirt",
      },
      {
        id: "g-chapel-garden",
        points: [
          [-2, 16],
          [22, 24],
          [33, 45],
          [23, 55],
        ],
        width: 2.4,
        kind: "stone",
      },
      {
        id: "g-moon-side",
        points: [
          [23, 55],
          [32, 79],
          [18, 94],
          [0, 96],
        ],
        width: 2.4,
        kind: "stone",
      },
    ],
    terrain: {},
    encounters: [
      { id: "g-zombie-west", kind: "zombie", x: -20, z: 28, count: 4 },
      { id: "g-bats-chapel", kind: "bat", x: 23, z: 53, count: 4 },
      { id: "g-zombie-king", kind: "zombie", x: 1, z: 76, count: 4 },
      { id: "g-bats-garden", kind: "bat", x: 28, z: 26, count: 2 },
      {
        id: "g-boss",
        kind: "zombie",
        x: 0,
        z: 92,
        count: 1,
        boss: true,
        name: "遗忘姓名的骑士",
        phases: [
          {
            threshold: 1,
            label: "苍白的冲锋",
            pattern: "charge",
            hint: "骑士拉低长枪时，向侧面闪避。",
          },
          {
            threshold: 0.5,
            label: "守夜人的誓约",
            pattern: "summon",
            hint: "替伙伴挡开幽灵，骑士疲惫时再进攻。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "g-lantern-gardener",
        kind: "beacon",
        x: -21,
        z: 30,
        label: "园丁的纪念灯",
        text: "「米娅，种下四百株月光花。」花朵顺着旧路开放，古钟像是认出了这个名字。钟声将唤醒守夜人；请继续找回另两盏灯里的名字。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "g-lantern-singer",
        kind: "beacon",
        x: 23,
        z: 56,
        label: "歌者的纪念灯",
        text: "「艾洛，把最后一首歌留给孩子。」礼拜堂里响起没有歌词的摇篮曲。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "g-lantern-king",
        kind: "beacon",
        x: 0,
        z: 78,
        label: "旧王的纪念灯",
        text: "「愿后来的人，修补我因恐惧犯下的错。」三盏灯合成守夜人的誓言。骑士完成每次招式后会放下长枪、记起自己；抓住这一刻反击，星渠的线索就在他身后的城堡。",
        questRole: "main",
        requiresClear: true,
        reward: { skin: "moon", xp: 85 },
      },
      {
        id: "g-cat-npc",
        kind: "npc",
        x: 24,
        z: 25,
        label: "等主人的黑猫",
        text: "黑猫守在空碗旁，不肯离开。它望向西边墓道里的一枚铃铛。",
        questRole: "side",
      },
      {
        id: "g-cat-bell",
        kind: "relic",
        x: -33,
        z: 58,
        label: "找到旧项圈铃铛",
        text: "铃铛内侧写着猫的名字：豆子。你轻轻摇了摇它。",
        questRole: "side",
        requiresClear: true,
      },
      {
        id: "g-cat-home",
        kind: "npc",
        x: -22,
        z: 80,
        label: "陪豆子走完最后一段路",
        text: "墓前有一张为猫留的小毯子。豆子终于蜷下来，安静地睡着了。",
        questRole: "side",
        reward: { skill: "heal", xp: 75 },
      },
    ],
    secrets: [
      {
        id: "g-secret-tea",
        kind: "relic",
        x: -34,
        z: 35,
        label: "幽灵的下午茶",
        text: "石桌上多出两杯热茶。「吓到你们了？对不起，糖在左边。」",
        hint: "西墓道传来瓷杯轻碰声，空气里有茶香。",
        reward: { xp: 50 },
      },
      {
        id: "g-secret-moon",
        kind: "relic",
        x: 34,
        z: 82,
        label: "不会枯萎的月光花",
        text: "它的根连着云山。即使星光很少，生命仍在努力替彼此保留一点。",
        hint: "礼拜堂后面，只有一朵花朝着山的方向开放。",
        reward: { skin: "moon", xp: 50 },
      },
    ],
    quest: {
      title: "点亮纪念灯，让守夜骑士安眠",
      steps: ["g-lantern-gardener", "g-lantern-singer", "g-lantern-king"],
      side: {
        id: "g-cat-quest",
        title: "豆子还在等",
        intro: "东边花园里有一只没有离开的黑猫。",
        steps: ["g-cat-npc", "g-cat-bell", "g-cat-home"],
        ending: "被记得的名字，不会孤单。",
        reward: { skill: "heal", xp: 75 },
      },
    },
    event: {
      id: "g-event-bells",
      title: "午夜提前了",
      trigger: { x: -8, z: 46, radius: 8 },
      description:
        "古钟突然响起。雾中出现醒来的守墓人，暖灯仍照着你们回营地的方向。",
      spawns: [
        { id: "g-midnight-zombies", kind: "zombie", x: -7, z: 50, count: 3 },
        { id: "g-midnight-bats", kind: "bat", x: -14, z: 48, count: 2 },
      ],
      resolution: "钟声停了。雾里传来一句很轻的谢谢。",
      reward: { xp: 70 },
    },
  },
  {
    id: "ch05-candle-castle",
    index: 5,
    title: "烛光古堡",
    subtitle: "窗后的影子，藏着旧日的选择",
    biome: "castle",
    intro: [
      "城堡从外面看像一座沉睡的山。窗里却有人等着你们。",
      "吸血鬼伯爵保存着旧王的星渠图。他不相信两只小狗能改变什么。先让尘封的天文仪再次转动。",
    ],
    ending: [
      "伯爵放下手杖：他守了几百年的，只是一个不敢承认的错误。",
      "完整的星渠图出现了：让王国与云山共享星光，需要三枚调谐晶体，以及恶龙愿意松开的爪。",
    ],
    spawn: { x: 0, z: -11 },
    camp: { x: -12, z: 0 },
    exit: { x: 0, z: 105 },
    palette: {
      sky: "#303657",
      fog: "#53516c",
      ground: "#66637c",
      leaf: "#3b465f",
      accent: "#efbb75",
    },
    landmarks: [
      { id: "c-main-facade", kind: "castle", x: -22, z: 61, scale: 1.4 },
      { id: "c-east-tower", kind: "castle", x: 29, z: 78, scale: 0.9 },
      { id: "c-gate", kind: "arch", x: 0, z: 11, scale: 1.5 },
      { id: "c-library", kind: "ruin", x: -28, z: 29, scale: 1.4 },
      { id: "c-orrery", kind: "crystal", x: 0, z: 55, scale: 1.8 },
      { id: "c-balcony", kind: "bridge", x: 23, z: 64, scale: 1.1 },
      { id: "c-high-door", kind: "arch", x: 0, z: 103, scale: 1.5 },
    ],
    paths: [
      {
        id: "c-gallery",
        points: [
          [0, -15],
          [0, 17],
          [-19, 28],
          [-12, 42],
          [0, 53],
          [0, 72],
          [0, 108],
        ],
        width: 5,
        kind: "stone",
      },
      {
        id: "c-library-pass",
        points: [
          [-19, 28],
          [-34, 34],
          [-32, 52],
          [-16, 64],
          [0, 72],
        ],
        width: 2.8,
        kind: "stone",
      },
      {
        id: "c-balcony-pass",
        points: [
          [0, 17],
          [23, 29],
          [31, 44],
          [23, 64],
          [23, 78],
          [0, 90],
        ],
        width: 3,
        kind: "stone",
      },
      {
        id: "c-orrery-ring",
        points: [
          [-12, 42],
          [-10, 53],
          [0, 64],
          [10, 53],
          [0, 42],
          [-12, 42],
        ],
        width: 2.4,
        kind: "stone",
      },
    ],
    terrain: {},
    encounters: [
      { id: "c-bats-gallery", kind: "bat", x: -19, z: 28, count: 4 },
      { id: "c-zombies-library", kind: "zombie", x: -30, z: 45, count: 3 },
      { id: "c-golems-orrery", kind: "golem", x: 0, z: 52, count: 2 },
      { id: "c-bats-balcony", kind: "bat", x: 25, z: 76, count: 4 },
      {
        id: "c-boss",
        kind: "bat",
        x: 0,
        z: 91,
        count: 1,
        boss: true,
        name: "烛影伯爵",
        phases: [
          {
            threshold: 1,
            label: "礼貌的邀请",
            pattern: "volley",
            hint: "烛火聚拢时，离开伯爵正前方。",
          },
          {
            threshold: 0.65,
            label: "影子的舞会",
            pattern: "summon",
            hint: "分头清理蝙蝠，给队友留出施法空间。",
          },
          {
            threshold: 0.3,
            label: "最后一支舞",
            pattern: "charge",
            hint: "他躬身行礼后会突进，等待这一拍再闪避。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "c-map-page",
        kind: "relic",
        x: -19,
        z: 29,
        label: "寻找缺失的星图",
        text: "画框后藏着半张星图。旧王的注释写着：共享不是损失。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "c-plate-sun",
        kind: "plate",
        x: -8,
        z: 53,
        label: "太阳镜踏板",
        text: "一面镜子照不亮整张图。留在太阳镜上，请伙伴转动月亮镜。",
        questRole: "main",
        pair: "castle-mirrors",
        requiresClear: true,
      },
      {
        id: "c-plate-moon",
        kind: "plate",
        x: 8,
        z: 53,
        label: "月亮镜踏板",
        text: "日月两束光合在一起，封印了几百年的天文仪开始转动。镜面已经锁定，不必反复重踩；伯爵每次招式后，日月光会短暂照出他的真实影子，那时的反击更有力。",
        questRole: "main",
        pair: "castle-mirrors",
        requiresClear: true,
      },
      {
        id: "c-star-channel",
        kind: "beacon",
        x: 0,
        z: 76,
        label: "打开旧王的星渠图",
        text: "山顶并非没有星光，而是连接两地的星渠被封住了。",
        questRole: "main",
        requiresClear: true,
        reward: { weapon: "chime", xp: 95 },
      },
      {
        id: "c-portrait",
        kind: "npc",
        x: 25,
        z: 29,
        label: "不高兴的画像",
        text: "画像里的公主把头转向墙：我的小狗画像呢？谁把它搬进杂物间了！",
        questRole: "side",
      },
      {
        id: "c-painting",
        kind: "relic",
        x: -34,
        z: 50,
        label: "找回小狗画像",
        text: "画像里也有两只圆乎乎的小狗，正试图偷走王冠上的饼干。",
        questRole: "side",
        requiresClear: true,
      },
      {
        id: "c-portrait-return",
        kind: "npc",
        x: 29,
        z: 83,
        label: "把画像挂回月光长廊",
        text: "公主终于笑了。墙后移开一扇小门，露出她珍藏的月夜披风。",
        questRole: "side",
        reward: { skin: "moon", xp: 85 },
      },
    ],
    secrets: [
      {
        id: "c-secret-recipe",
        kind: "relic",
        x: -35,
        z: 34,
        label: "伯爵的秘密食谱",
        text: "第一页写着：番茄浓汤，多加糖。最后一页画着伯爵戴围裙的自画像。",
        hint: "图书室西墙后，有一股与古堡很不相称的番茄香气。",
        reward: { xp: 55 },
      },
      {
        id: "c-secret-music",
        kind: "relic",
        x: 34,
        z: 47,
        label: "没有琴手的钢琴",
        text: "琴上放着伯爵年轻时写的道歉信。署名旁的墨水，至今没有干。",
        hint: "东阳台尽头，三声断续的琴音每次都少一个结尾。",
        reward: { skill: "nova", xp: 55 },
      },
    ],
    quest: {
      title: "合上日月镜，找到通往云山的星渠图",
      steps: ["c-map-page", "c-plate-sun", "c-plate-moon", "c-star-channel"],
      side: {
        id: "c-portrait-quest",
        title: "公主也爱小狗",
        intro: "东边画廊有幅拒绝看人的画像。",
        steps: ["c-portrait", "c-painting", "c-portrait-return"],
        ending: "一段微小的快乐，让冰冷的城堡有了家的样子。",
        reward: { skin: "moon", xp: 85 },
      },
    },
    event: {
      id: "c-event-masquerade",
      title: "无人舞会",
      trigger: { x: 0, z: 68, radius: 8 },
      description: "钟摆突然停下，烛火一起熄灭又亮起。空荡大厅里的舞伴醒来了。",
      spawns: [
        { id: "c-dance-bats", kind: "bat", x: 8, z: 68, count: 3 },
        { id: "c-dance-zombies", kind: "zombie", x: -8, z: 72, count: 2 },
      ],
      resolution: "最后一位舞伴鞠躬离场，长廊深处的暖灯重新亮起。",
      reward: { xp: 80 },
    },
  },
  {
    id: "ch06-cloud-mountain",
    index: 6,
    title: "云山与失落栖地",
    subtitle: "不是所有裂痕，都只能用力量填平",
    biome: "mountain",
    intro: [
      "云海之上，生命树只剩几片叶子。小兽们挤在龙翼留下的避风处。",
      "带着星渠图，校准三枚调谐晶体。这一次，要让光同时抵达山上与山下。",
    ],
    ending: [
      "晶体发出了同一个音。来自灯火村的信鸽降落，带来了居民们的承诺：他们愿意一起修好星渠。",
      "恶龙已经太久没有休息。你们要带着答案，穿过它最后的防线。",
    ],
    spawn: { x: -17, z: -11 },
    camp: { x: -25, z: 1 },
    exit: { x: 15, z: 105 },
    palette: {
      sky: "#b2c9e5",
      fog: "#e0e5f0",
      ground: "#839998",
      leaf: "#537477",
      accent: "#ffe3a3",
    },
    landmarks: [
      { id: "m-refuge", kind: "house", x: -29, z: 12, scale: 0.8 },
      { id: "m-west-spire", kind: "rock", x: -28, z: 32, scale: 2.4 },
      { id: "m-crystal-one", kind: "crystal", x: 20, z: 29, scale: 1.4 },
      { id: "m-crystal-two", kind: "crystal", x: -18, z: 58, scale: 1.5 },
      { id: "m-old-tree", kind: "tree", x: 26, z: 71, scale: 1.6 },
      { id: "m-cloud-bridge", kind: "bridge", x: 4, z: 72, scale: 1.5 },
      { id: "m-crystal-three", kind: "crystal", x: 15, z: 79, scale: 1.6 },
      { id: "m-gate", kind: "arch", x: 15, z: 104, scale: 1.3 },
    ],
    paths: [
      {
        id: "m-switchback",
        points: [
          [-17, -15],
          [-13, 14],
          [20, 29],
          [22, 40],
          [-18, 57],
          [-10, 68],
          [4, 72],
          [15, 80],
          [15, 108],
        ],
        width: 4.6,
        kind: "stone",
      },
      {
        id: "m-refuge-trail",
        points: [
          [-13, 14],
          [-30, 18],
          [-33, 42],
          [-18, 57],
        ],
        width: 2.5,
        kind: "dirt",
      },
      {
        id: "m-eagle-trail",
        points: [
          [20, 29],
          [33, 38],
          [32, 58],
          [27, 77],
          [15, 80],
        ],
        width: 2.4,
        kind: "stone",
      },
      {
        id: "m-stargazer-trail",
        points: [
          [-10, 68],
          [-27, 76],
          [-25, 90],
          [4, 96],
          [15, 96],
        ],
        width: 2.3,
        kind: "stone",
      },
    ],
    terrain: { shelters: [{ x: -5, z: 73, radius: 2.25 }, { x: 10.5, z: 88, radius: 2.25 }, { x: 21, z: 95.5, radius: 2.25 }] },
    encounters: [
      { id: "m-golems-east", kind: "golem", x: 20, z: 30, count: 2 },
      { id: "m-wolves-west", kind: "wolf", x: -18, z: 57, count: 4 },
      { id: "m-sprites-high", kind: "sprite", x: 16, z: 78, count: 4 },
      {
        id: "m-wolves-trail",
        kind: "wolf",
        x: 30,
        z: 52,
        count: 3,
        elite: true,
      },
      {
        id: "m-boss",
        kind: "golem",
        x: 15,
        z: 92,
        count: 1,
        boss: true,
        name: "风暴的残响",
        phases: [
          {
            threshold: 1,
            label: "积云",
            pattern: "volley",
            hint: "远离发亮的落点，在空隙中前进。",
          },
          {
            threshold: 0.6,
            label: "暴风眼",
            pattern: "storm",
            hint: "风暴蓄力时进入石翼下的浅色地面并站稳；跳起会离开庇护。伙伴倒地时先引开落点，再去救援。",
          },
          {
            threshold: 0.3,
            label: "云海坠落",
            pattern: "slam",
            hint: "躲过重击后，它会长时间露出核心。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "m-crystal-dawn",
        kind: "beacon",
        x: 20,
        z: 30,
        label: "校准晨曦晶体",
        text: "晶体里映出灯火村的窗光。山下的人已经开始修复自己的那一段星渠。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "m-crystal-rain",
        kind: "beacon",
        x: -18,
        z: 58,
        label: "校准雨声晶体",
        text: "枯树根边渗出第一滴清水。一只小兽谨慎地伸出爪子。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "m-crystal-evening",
        kind: "beacon",
        x: 15,
        z: 80,
        label: "校准晚星晶体",
        text: "三枚晶体的声音合在一起。你们终于找到了无需夺走任何人星光的办法。",
        questRole: "main",
        requiresClear: true,
        reward: { skill: "heal", xp: 110 },
      },
      {
        id: "m-bird-npc",
        kind: "npc",
        x: -32,
        z: 20,
        label: "不会飞的小云雀",
        text: "小云雀说自己并不怕高，只是翅膀冻住了。它的巢在东边避风坡。",
        questRole: "side",
      },
      {
        id: "m-feather",
        kind: "supply",
        x: 33,
        z: 56,
        label: "取回暖羽织毯",
        text: "你从旧巢中找到了一条羽绒毯，边角绣着巨龙的金线。",
        questRole: "side",
        requiresClear: true,
      },
      {
        id: "m-bird-home",
        kind: "npc",
        x: 29,
        z: 82,
        label: "给小云雀暖暖翅膀",
        text: "小云雀飞起一小段，又落回你的头顶。它决定再陪你走一会儿。",
        questRole: "side",
        reward: { skin: "forest", xp: 95 },
      },
    ],
    secrets: [
      {
        id: "m-secret-nest",
        kind: "relic",
        x: -35,
        z: 43,
        label: "龙鳞做的小屋",
        text: "每片龙鳞都磨平了锋利的边。恶龙给这些无家可归的小动物盖了很多这样的房子。",
        hint: "避风坡后面，有一片和石头颜色不同的蓝光。",
        reward: { xp: 65 },
      },
      {
        id: "m-secret-letter",
        kind: "relic",
        x: -28,
        z: 90,
        label: "没寄出的求援信",
        text: "信纸被大爪子戳破好几个洞。「山下的朋友，我不知道该怎样开口……」",
        hint: "西边观星台，一只压纸石下露出半张揉皱的纸。",
        reward: { skin: "moon", xp: 65 },
      },
    ],
    quest: {
      title: "校准调谐晶体，为两地接通星渠",
      steps: ["m-crystal-dawn", "m-crystal-rain", "m-crystal-evening"],
      side: {
        id: "m-bird-quest",
        title: "一小段飞行",
        intro: "避风营地外有一只冻僵的小云雀。",
        steps: ["m-bird-npc", "m-feather", "m-bird-home"],
        ending: "有时，勇敢只是重新拍一次翅膀。",
        reward: { skin: "forest", xp: 95 },
      },
    },
    event: {
      id: "m-event-storm",
      title: "风暴先到了",
      trigger: { x: 1, z: 72, radius: 8 },
      description:
        "乌云掠过山脊，雷光唤醒了碎石里的星尘。桥西石翼与浅色落脚圈是避风点，站稳在里面可挡住星暴；普通近身攻击仍要躲开。",
      spawns: [
        { id: "m-storm-sprites", kind: "sprite", x: 4, z: 75, count: 3 },
        { id: "m-storm-golem", kind: "golem", x: -3, z: 74, count: 1 },
      ],
      resolution: "风暴渐弱。你们替后来的旅人重新扶正了路灯。",
      reward: { xp: 90 },
    },
  },
  {
    id: "ch07-star-dragon",
    index: 7,
    title: "星光龙巢与归途",
    subtitle: "把光带回家，也把家留给别人",
    biome: "dragon",
    intro: [
      "龙巢里没有金山。只有一棵奄奄一息的生命树，和紧紧护着它的巨龙。",
      "它以为你们也要夺走最后的光。先接通三座星渠锚点，让它看见另一个答案。",
    ],
    ending: [
      "巨龙终于松开爪子。星光没有消失，而是顺着修好的星渠，同时流向了山上与山下。",
      "它低下头，向曾被它伤害的居民道歉。修复家园还需要很久，它会亲自去做。",
      "两只小狗回到灯火村。面包师把「勇士饼干」改名为「好伙伴饼干」。",
      "远处海面上，一座从未见过的灯塔轻轻亮起。但今晚，先好好睡一觉。",
    ],
    spawn: { x: 0, z: -11 },
    camp: { x: -9, z: 0 },
    exit: { x: 0, z: 107 },
    palette: {
      sky: "#525988",
      fog: "#7f87a3",
      ground: "#737c95",
      leaf: "#607888",
      accent: "#ffd486",
    },
    landmarks: [
      { id: "d-old-life-tree", kind: "tree", x: 0, z: 62, scale: 2.6 },
      { id: "d-west-crystal", kind: "crystal", x: -24, z: 28, scale: 1.6 },
      { id: "d-east-crystal", kind: "crystal", x: 24, z: 48, scale: 1.6 },
      { id: "d-heart-crystal", kind: "crystal", x: 0, z: 73, scale: 1.7 },
      { id: "d-nest", kind: "dragonNest", x: 0, z: 95, scale: 1.6 },
      { id: "d-west-ruin", kind: "ruin", x: -30, z: 55, scale: 1.2 },
      { id: "d-east-arch", kind: "arch", x: 31, z: 78, scale: 1.1 },
      { id: "d-home-gate", kind: "arch", x: 0, z: 106, scale: 1.5 },
    ],
    paths: [
      {
        id: "d-star-spiral",
        points: [
          [0, -15],
          [-8, 13],
          [-24, 28],
          [-14, 39],
          [24, 48],
          [18, 63],
          [0, 74],
          [0, 110],
        ],
        width: 4.9,
        kind: "stone",
      },
      {
        id: "d-quiet-west",
        points: [
          [-24, 28],
          [-34, 38],
          [-32, 60],
          [-25, 77],
          [0, 84],
        ],
        width: 2.6,
        kind: "dirt",
      },
      {
        id: "d-life-east",
        points: [
          [24, 48],
          [34, 55],
          [32, 78],
          [20, 87],
          [0, 91],
        ],
        width: 2.6,
        kind: "stone",
      },
      {
        id: "d-tree-ring",
        points: [
          [-14, 39],
          [-11, 60],
          [0, 74],
          [18, 63],
        ],
        width: 3,
        kind: "stone",
      },
    ],
    terrain: {},
    encounters: [
      {
        id: "d-golems-west",
        kind: "golem",
        x: -24,
        z: 28,
        count: 2,
        elite: true,
      },
      { id: "d-sprites-east", kind: "sprite", x: 24, z: 48, count: 4 },
      { id: "d-golems-heart", kind: "golem", x: 0, z: 73, count: 2 },
      { id: "d-wolves-side", kind: "wolf", x: -29, z: 66, count: 3 },
      {
        id: "d-boss",
        kind: "dragon",
        x: 0,
        z: 93,
        count: 1,
        boss: true,
        name: "守巢之龙 · 阿斯特",
        phases: [
          {
            threshold: 1,
            label: "护巢的怒火",
            pattern: "breath",
            hint: "胸口亮起时从侧面离开三段吐息落区；腾空也挡不住龙息。",
          },
          {
            threshold: 0.7,
            label: "破碎的信任",
            pattern: "tail",
            hint: "尾巴抬起时退到外圈；跳跃不能越过高扫尾，结束后再靠近。",
          },
          {
            threshold: 0.4,
            label: "最后的星暴",
            pattern: "storm",
            hint: "生命锚点已经把星渠接通；躲开交错星暴，互相救援，让它平静下来。",
          },
        ],
      },
    ],
    interactions: [
      {
        id: "d-homeward-light", kind: "beacon", x: -2.5, z: 101,
        label: "把星光送回两个家园", afterBoss: true, requiresClear: true,
        text: "你们把生命树的新芽放在分流台上。两道暖光分别流向山下的窗和山上的巢。巨龙低下头：这一次，我会和大家一起修。回家的路就在两束光之间。",
      },
      {
        id: "d-anchor-home",
        kind: "beacon",
        x: -24,
        z: 29,
        label: "接通家园锚点",
        text: "光从村庄方向亮起。面包师、邮差和守林人正在一起推开旧水闸。巨龙开始喷吐火焰时，这座锚点会为两位伙伴送来一次恢复与反击的力量。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "d-anchor-memory",
        kind: "beacon",
        x: 24,
        z: 49,
        label: "接通记忆锚点",
        text: "月雾墓园与烛光城堡接上了星渠。伯爵第一次主动向居民打开城门。巨龙改用扫尾时，记忆的回声将为两位伙伴送来一次恢复。",
        questRole: "main",
        requiresClear: true,
      },
      {
        id: "d-anchor-life",
        kind: "beacon",
        x: 0,
        z: 75,
        label: "接通生命锚点",
        text: "生命树长出一枚新芽。最后的星暴到来时，它会为两位伙伴再送来一次恢复。让巨龙平静后，带着伙伴到归途门前的分流台，把光亲手送往两个家园。",
        questRole: "main",
        requiresClear: true,
        reward: { xp: 140 },
      },
      {
        id: "d-seed-npc",
        kind: "npc",
        x: -34,
        z: 39,
        label: "最小的树苗",
        text: "小树苗被龙巢落石压住了。它需要一捧仍有星光的泥土。",
        questRole: "side",
      },
      {
        id: "d-seed-soil",
        kind: "supply",
        x: 35,
        z: 59,
        label: "取一捧星光泥土",
        text: "泥土很轻，像握住了一小片夜空。里面的种子正在慢慢醒来。",
        questRole: "side",
      },
      {
        id: "d-seed-plant",
        kind: "relic",
        x: -29,
        z: 79,
        label: "种下新的生命树",
        text: "你们把树苗种在能同时看见山上与山下的地方。这里会长出新的阴凉。",
        questRole: "side",
        reward: { skin: "moon", xp: 120 },
      },
    ],
    secrets: [
      {
        id: "d-secret-toy",
        kind: "relic",
        x: -35,
        z: 62,
        label: "龙小时候的玩具",
        text: "一只用枯枝编成的小鸟，早已修过许多次。原来它从很小的时候，就害怕失去。",
        hint: "西边旧巢的碎枝下，有一小块被磨得发亮的木头。",
        reward: { xp: 75 },
      },
      {
        id: "d-secret-promise",
        kind: "relic",
        x: 35,
        z: 83,
        label: "写给下一位旅人的话",
        text: "你们在石头上留下两个小爪印：如果你也迷路了，记得先找到可以一起走的人。",
        hint: "东边拱门外的平台，正好能看见来时的七条路。",
        reward: { xp: 75 },
      },
    ],
    quest: {
      title: "接通三座星渠锚点，让巨龙看见另一个答案",
      steps: ["d-anchor-home", "d-anchor-memory", "d-anchor-life"],
      side: {
        id: "d-seed-quest",
        title: "给明天留一点阴凉",
        intro: "西边旧巢旁，一株小树苗还在努力站直。",
        steps: ["d-seed-npc", "d-seed-soil", "d-seed-plant"],
        ending: "两只小狗种下一棵树，也种下了一个会继续长大的约定。",
        reward: { skin: "moon", xp: 120 },
      },
    },
    event: {
      id: "d-event-fracture",
      title: "星光裂隙",
      trigger: { x: 4, z: 65, radius: 10 },
      description:
        "过量星光从生命树的裂缝中涌出！失控的星尘挡住锚点，必须为伙伴清出最后一条路。",
      spawns: [
        { id: "d-fracture-sprites", kind: "sprite", x: 4, z: 68, count: 4 },
        {
          id: "d-fracture-golem",
          kind: "golem",
          x: -4,
          z: 68,
          count: 1,
          elite: true,
        },
      ],
      resolution: "裂隙稳定了。生命树的光终于沿着正确的方向流动。",
      reward: { xp: 110 },
    },
  },
];

// Extend only the outdoor margins. Retain chapter object identity and all quest coordinates.
for(const c of CHAPTERS.filter(c=>['village','river','forest'].includes(c.biome))){
 c.paths.push({id:c.id+'-outer-ramble',kind:'dirt',width:3.4,points:[[30,35],[48,35],[55,58],[51,101],[36,128],[-12,134],[-52,118],[-55,82],[-49,43],[-30,43]]});
}
rebindCastle(CHAPTERS.find(c=>c.id==='ch05-candle-castle')!);
export const CHAPTER_BY_ID = new Map(
  CHAPTERS.map((chapter) => [chapter.id, chapter]),
);
export const CONTENT_VERSION = 2;
