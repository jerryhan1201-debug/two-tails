import type { Interaction } from './content';

/** Four related, optional readings. They grant no story unlock or permanent reward. */
const readings: Record<string, Interaction> = {
  'mushroom-grove': {
    id: 'mushroom-grove-memory', kind: 'relic', x: 20, z: 48,
    label: '翻开伞下的寄信簿', speaker: '邮差獾的寄信簿', portrait: 'postman',
    text: '“昨夜大雨，寄往树梢的信差一点淋湿。苔苔借我一片菌盖，把信和我一起送进了屋。”纸页边夹着一小片晒干的伞裙。末尾写着：先去北边的蘑菇屋喝杯茶，再沿东边的小路，听风铃找树屋。',
  },
  'mushroom-home': {
    id: 'mushroom-home-memory', kind: 'relic', x: -.75, z: 1.65,
    label: '读茶桌旁的便条', speaker: '苔苔留给赶路人的话', portrait: 'herbalist',
    text: '“不必等雨停，先把湿外套放在篮边。炉上的茶一直温着。”苔苔把村里送来的星灯放在圆窗旁，好让晚归的人认得路。她托邮差捎话给树屋的守林人：今晚也请留一盏灯，别让伙伴独自摸黑。',
  },
  'canopy-garden': {
    id: 'canopy-garden-memory', kind: 'relic', x: -4.5, z: 40.5,
    surfaceId: 'canopy-platform', label: '轻轻摇响引路风铃',
    speaker: '守林人的风铃牌', portrait: 'forester',
    text: '木牌上有两行爪印：“风太大时，星灯会藏进树叶里。听见这三声铃，就知道台阶尽头有人等你。”铃声越过菌盖，落向村庄。守林人把回信留在暖阁窗边，请你们进屋看看。',
  },
  'canopy-home': {
    id: 'canopy-home-memory', kind: 'relic', x: -2, z: 6,
    label: '读窗边尚未封口的回信', speaker: '守林人写给苔苔的回信', portrait: 'forester',
    text: '“茶收到了。昨晚有两只迷路的小鸟循铃飞来，挤在窗沿睡了一夜。”信封里装着一枚风铃舌，准备挂在蘑菇屋门前。守林人写下最后一句：星光不必全留在一处，给每个等伙伴的人一点，就够照亮回家的路。',
  },
};

export function regionalReadings(regionId: string): Interaction[] {
  return readings[regionId] ? [{ ...readings[regionId] }] : [];
}
