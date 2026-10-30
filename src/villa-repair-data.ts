/** Scope by source semantics, never by generic portrait names elsewhere. */
export function isRetiredVillaPart(name:string,extras:any={}){
 const [floor,role,zone]=name.split('__'),parts=[zone,...(extras.sourceParts??[])].join(' ');
 return (floor==='site'&&role==='wall'&&/garden low wall(?:\b|[._])|A east garden boundary/i.test(parts))||
  (['F1','F2'].includes(floor)&&/foyer art|framed textile artwork|art linen field|original abstract relief/i.test(parts));
}
export const retiredVillaObstacle=(id:string)=>/^(garden low wall(?:[._]\d+)?|A east garden boundary)$/.test(id);
export const LANDING_GUARDS=[-2.1,2.7].map(y=>({id:'V13 landing central return '+y,kind:'railing',center:[10.4,y+.7,-2.5],size:[1.12,1.4,.08],rotationY:0}));
// The source rail panels have a post at their start, but the last sloped
// segment ends without a terminal post. These joints close the authored ends
// at the turning landing and top stair mouth; no rail crosses either flight.
export const UPPER_STAIR_JOINTS=[[6.82,2.7,-2.5],[9.78,2.7,-2.5],[11.02,5.1,3],[13.98,5.1,3]].map(([x,y,z],i)=>({id:'V18 upper stair terminal '+i,kind:'railing',center:[x,y+.72,z],size:[.10,1.44,.10],rotationY:0}));


export const TREE_LANDING_GUARD={id:'V14 tree landing south guard',kind:'railing',center:[30,10.62,25.43],size:[3.6,1.44,.1],rotationY:0};

// The authored top tread ends at Y0; the adjacent lawn is Y.26. A short stone
// riser closes that exposed soil edge without spanning the courtyard opening.
export const ATRIUM_THRESHOLD={id:'V16 atrium final threshold',kind:'support-solid',center:[-22.4,.12,13.96],size:[2.8,.28,.18],rotationY:0};
export const ATRIUM_THRESHOLD_TOP=(()=>{const[x,y,z]=ATRIUM_THRESHOLD.center,[w,h,d]=ATRIUM_THRESHOLD.size,a=[x-w/2,y+h/2,z-d/2],b=[x+w/2,y+h/2,z-d/2],c=[x-w/2,y+h/2,z+d/2],e=[x+w/2,y+h/2,z+d/2];return[[a,b,c],[b,e,c]].map(vertices=>({id:ATRIUM_THRESHOLD.id,role:'stairs',vertices,normal:[0,1,0]}));})();

// The F2 front-left edge overlooks flight A, whose landing is one half-storey lower.
// Only flight B (x11..14) is the top-storey stair mouth. Close the missing 3m edge.
export const UPPER_VOID_GUARD={id:'V181 F2 front-left full guard',kind:'railing',center:[8.3,5.80,3],size:[3,1.4,.10],rotationY:0};
