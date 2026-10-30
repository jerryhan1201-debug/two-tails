import shapes from '../source-assets/environment/studio-rc1/physics.json';
import type {WorldObstacle} from './world-surfaces';

export const STUDIO_HOUSE={radius:4.22,floor:.16,ceiling:4.90,doorZ:-4.5} as const;
export const houseFurniture:WorldObstacle[]=[
 {x:-2.8,z:.65,r:0,shape:'box',width:1.85,depth:3.04,top:1.25},
 {x:2.3,z:.65,r:0,shape:'box',width:2,depth:1.65,top:1.235},
 {x:0,z:3.35,r:0,shape:'box',width:3,depth:.86,top:1.645},
];
/** Wall segments leave the real 2.56 m arch open; no filled house cylinder. */
export function studioHouseObstacles(base:number,z=0):WorldObstacle[]{
 const out:WorldObstacle[]=[];
 for(let i=0;i<32;i++){
   const a=(i+.5)*Math.PI*2/32,x=Math.sin(a)*4.46,dz=-Math.cos(a)*4.46;
   if(dz<0&&Math.abs(x)<1.6)continue;
   out.push({x,z:z+dz,r:0,shape:'box',width:.94,depth:.34,rotation:a,bottom:base+.14,top:base+5.25});
 }
 out.push({x:0,z:z-4.46,r:0,shape:'box',width:2.6,depth:.4,bottom:base+3.48,top:base+5.25});
 for(const x of [-1.7,1.7])out.push({x,z:z-5.25,r:.13,bottom:base,top:base+3.1});
 out.push({x:2.55,z:z+2,r:0,shape:'box',width:.9,depth:.9,bottom:base+6,top:base+8.07});
 return out.concat(houseFurniture.map(o=>({...o,z:o.z+z,bottom:base+.14,top:base+o.top!})));
}
export function studioStemObstacles(m:{x:number;z:number;r:number;h:number},base:number):WorldObstacle[]{
 return (m.h<2.5?shapes.medium:shapes.giant).stemBands.map(b=>({x:m.x,z:m.z,r:b.radius*m.r,bottom:base+b.minY*m.h,top:base+b.maxY*m.h}));
}
