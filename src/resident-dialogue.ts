import type { Chapter, Interaction } from './content';

/** Reunions are conversation only: simulation must never award or complete them. */
export function residentReply(item: Interaction, chapter: Chapter, flags: readonly string[]): string | undefined {
  if (item.kind !== 'npc' || !flags.includes(item.id)) return;
  const has = (id: string) => flags.includes(id);
  const sideDone = has(chapter.quest.side.id) || chapter.quest.side.steps.every(has);
  switch (item.id) {
    case 'v-post-npc':
      return sideDone
        ? '獾先生把空邮包拍得鼓鼓的：“第一天的信都送到了。下回经过伞光蘑菇林，看看我留在菌盖下的寄信簿；下雨天也有人替我们留灯。”'
        : has('v-post-bag')
          ? '“就是这个邮包！”獾先生小心拂去苹果叶。“最后一封信寄给西北边的守林人。他住在旧石墙附近，天黑前一定还在等。”'
          : '獾先生指了指东边：“过溪桥就是果园。我想起来了，跌倒时邮包滚到了树根下。石台是近路，沿果园小路绕过去也行。”';
    case 'v-post-home':
      return '守林人把信放进胸前口袋：“原来只是报个平安，我却等了一整天。去风铃树屋歇歇吧，木阶尽头留着暖阁；给苔苔的回信也在那里。”';
    case 'r-npc-frog':
      return sideDone
        ? '船长理了理帽檐：“河水听见风车转，就知道该往哪里走。你们若在雾里迷了路，响一下潮汐铃，我会回答。”'
        : has('r-hat')
          ? '船长跳上系船桩：“帽子还好吧？我得先去下游把船缆系牢，沿东岸找到码头，我们在那里碰面。”'
          : '“那阵风往东岸的芦苇荡吹。”船长压低声音，“小心湿木板。水轮没有转起来之前，别急着踩中间的踏台。”';
    case 'r-return-hat':
      return '船长把船头轻轻推离岸边：“你们带回的不只是一顶帽子。现在上游送来的信，也终于能沿河到家了。”';
    case 'f-moth-npc':
      return sideDone
        ? '飞蛾绕着那片蓝叶飞了一圈：“我记住自己的名字了，也记住你们两个。以后树洞里的灯，会亮到最后一位朋友回家。”'
        : has('f-moth-leaf')
          ? '“这片叶子有家的气味。”飞蛾的翅膀亮了一点，“东边高树下有一群很小的灯，请陪我去看看。”'
          : '飞蛾在树皮上画了半片叶：“叶脉像星星，背面是蓝的。我最后一次看见它，是在东侧旧根道。”';
    case 'f-moth-home':
      return '微光落在巢边：“大个子守卫并不是讨厌来客，它听不清森林的心跳了。三块星石都醒来时，记得看它露出光的胸口。”';
    case 'g-cat-npc':
      return sideDone
        ? '豆子抬头看了你们一眼，又把尾巴绕回爪边。空碗旁多了一朵小白花；远处的铃声已经不再催促谁。'
        : has('g-cat-bell')
          ? '豆子闻了闻铃铛，沿西侧墓道走出几步，又回头等你。小毯子就在更北边，那是一段适合慢慢走的路。'
          : '黑猫把爪子搭在空碗边，望向西边。风吹过墓道时，那枚铃铛会发出一声很轻的响。';
    case 'g-cat-home':
      return '豆子在毯子上伸了个懒腰。碑后的字已经磨淡，留下的爪印却很清楚。你们替它挡了一会儿风。';
    case 'c-portrait':
      return sideDone
        ? '画像里的公主把目光转向两只小狗：“月亮照得进来，屋子就没有想象中那么冷。走之前，记得替我看看长廊的小画像。”'
        : has('c-painting')
          ? '公主一眼就认出了卷轴：“请挂回东边月光长廊，旧钉子还在。它喜欢从那儿看花园。”'
          : '公主悄悄指向西侧：“杂物间里有个卷着蓝丝带的画轴。别被盔甲声吓跑，那些脚步已经走了好多年。”';
    case 'c-portrait-return':
      return '公主抚平画框上的丝带：“谢谢你们把它带回来看月亮。日镜和月镜不是争一束光，站在两边，才能让光穿过城堡。”';
    case 'm-bird-npc':
      return sideDone
        ? '小云雀抖落翅膀上的雪：“我先飞一小段，你们慢慢走。远处有风，我就落下来等，谁也不用逞强。”'
        : has('m-feather')
          ? '小云雀把暖羽织毯裹在胸前：“东边避风坡有我的巢。先在石背后等这阵横风过去，再陪我走，好吗？”'
          : '“东边旧巢里留着一条暖羽织毯。”小云雀缩起脚，“你们去找时也要躲风，岩石背面会安静一点。”';
    case 'm-bird-home':
      return '小云雀在巢沿练习拍翅：“今天能飞到这根树枝，就很好了。龙巢上方的风更急，别忘了回头看看伙伴。”';
    case 'd-seed-npc':
      return sideDone
        ? '小树苗撑开两片叶：“等我长大，就给回来的人一片阴凉。星光分给两个家园后，也会落在我这里一点点。”'
        : has('d-seed-soil')
          ? '小树苗把根朝向生命树：“把这捧土送到西北边的空地吧。那里能晒到早晨的光，也不会挡住龙回家的路。”'
          : '“别挖走活树的根。”小树苗轻声说，“东北边落石旁散着温热的星土，捧一点给我就够了。”';
    default:
      return item.text;
  }
}
