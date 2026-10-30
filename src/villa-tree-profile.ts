import data from '../source-assets/environment/v12/tree-transition.json';
export const TREE_PROFILE=data.profile;
const maxRadius=Math.max(...data.baseRing.map(v=>v[1]));
/** Bands use the same profile as the replacement trunk; steps/platform stay untouched. */
export const TREE_TRANSITION_COLLISIONS=TREE_PROFILE.slice(1).flatMap(([y,r],i)=>{
 const [bottom,previous]=TREE_PROFILE[i],radius=maxRadius*Math.max(r,previous),pieces=16,depth=radius*2/pieces;
 return Array.from({length:pieces},(_,k)=>{const dz=-radius+(k+.5)*depth,near=Math.max(0,Math.abs(dz)-depth/2),width=2*Math.sqrt(Math.max(0,radius*radius-near*near));return{id:`v12-oak-transition-${i}-${k}`,floor:'site',kind:'trunk',center:[31,bottom+(y-bottom)/2,15+dz],size:[width,y-bottom,depth],rotationY:0};});
});
