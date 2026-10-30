/** Host-owned additions over the unchanged RC2 release, metres in game LH. */
export const COUNT_COFFIN={x:-40.5,y:-3.6,z:69.3,width:2.6,depth:4.3,height:2.05};
export const CASTLE_STORY_POINTS={
 coffin:{x:-38.4,y:-3.6,z:68.3},locket:{x:-39.5,y:-3.6,z:89.4},key:{x:-32.8,y:-3.6,z:99.5},letter:{x:12.2,y:2.4,z:47.4},
 clocknote:{x:-32.5,y:-3.6,z:78.8},batwindow:{x:-42.6,y:-3.6,z:73.9},bell:{x:-24.9,y:-3.6,z:76.2},
} as const;
export const CASTLE_STORY_OBSTACLES=[{id:'v18-count-coffin',kind:'furniture',zoneId:'secret',center:[COUNT_COFFIN.x,COUNT_COFFIN.y+COUNT_COFFIN.height/2,COUNT_COFFIN.z],size:[COUNT_COFFIN.width,COUNT_COFFIN.height,COUNT_COFFIN.depth],rotationY:0},
 ...(['coffin','locket','key','letter','clocknote','bell'] as const).map(key=>{const p=CASTLE_STORY_POINTS[key];return{id:'v18-count-'+key+'-stand',kind:'furniture',zoneId:key==='letter'?'hall':['key','locket'].includes(key)?'collection':'secret',center:[p.x,p.y+.52,p.z],size:[.76,1.04,.61],rotationY:0};}),
];
