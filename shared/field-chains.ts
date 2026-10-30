import type {FieldBook} from './fieldbook';
export const FIELD_CHAINS=[
 {id:'a-light-for-the-way-home',title:'给归途留一盏灯',steps:['root-window','ribbon-return','woodland-lamps'],notes:['树根小窗里夹着花匠用过的线头，几片花瓣一路落向村里的针线篮。','丝带系回花束后，篮里露出一张旧灯路图：家园西门外还有三盏灯等着回应。','三盏灯连成了归途。西门外短岔路的长椅旁，一本摊开的书终于等到了读者。'],ending:'花匠没有留下姓名，只在长椅边写着：愿每个晚归的人，都能看见一盏等他的灯。根窗、丝带和林灯原来属于同一份心意。'},
 {id:'goodnight-under-the-caps',title:'巨伞下的一声晚安',steps:['moon-dew','glow-procession','cap-echo'],notes:['月露映出一排熄灭的小伞。入口林路旁那枚伞灯，似乎也在等月光。','五枚伞灯连成回家的路，最后一枚底座刻着“一、三、二”。回入口北侧的三枚小菌盖，把这个节拍轻轻敲给它们听。','菌盖回响，石缝里的花慢慢打开。落木旁这片小小空地，是森林留下的晚安。'],ending:'不是谁藏起了光，而是小伞们走散了。月露找到了路，伞灯把它传下去，三枚菌盖替森林轻声说了晚安。'},
] as const;
export function chainState(b:Pick<FieldBook,'found'|'completed'>|undefined,id:string){const c=FIELD_CHAINS.find(c=>c.id===id)!;const next=c.steps.findIndex(id=>!b?.completed.includes(id));return{known:c.steps.some(id=>b?.found.includes(id)),complete:next<0,next:next<0?c.steps.length:next,done:c.steps.filter(id=>b?.completed.includes(id)).length};}
export function chainFollowup(id:string,b:Pick<FieldBook,'found'|'completed'>){const c=FIELD_CHAINS.find(c=>c.steps.some(x=>x===id));if(!c)return '';const i=c.steps.findIndex(x=>x===id);return chainState(b,c.id).complete?c.ending:c.notes[i];}
