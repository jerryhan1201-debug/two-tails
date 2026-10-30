import {kangarooPhase,KANGAROO_HOP_PERIOD}from'./kangaroo-motion';import{kangarooFits}from'./kangaroo-contact';import type{Snapshot}from'./simulation';import type{MovementWorld}from'./movement';
const air=(t:number)=>{if(t<=0)return 0;const f=t/KANGAROO_HOP_PERIOD,n=Math.floor(f);return n*.6+Math.max(0,Math.min(.6,f-n-.24));};
/** Render-only interpolation between received authority samples. No new commands
 * or stored positions; planted phases cannot produce a sliding hop on the guest. */
export function interpolateKangaroo(current:Snapshot,a:Snapshot,b:Snapshot,t:number,w:MovementWorld){const homes=current.homePets,p=homes?.['home-kangaroo'],x=a.homePets?.['home-kangaroo'],y=b.homePets?.['home-kangaroo'];if(!homes||!p||!x||!y||x.regionId!==y.regionId||y.regionId!==current.regionId||x.mode!==y.mode||Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z)>1.8)return current.homePets;
 let q=t;const epoch=y.gaitStart??0,time=a.time+(b.time-a.time)*t,hop=x.pose==='hop'&&y.pose==='hop'&&x.gaitStart===y.gaitStart;
 if(hop){const total=air(b.time-epoch)-air(a.time-epoch);q=total>1e-8?(air(time-epoch)-air(a.time-epoch))/total:0;}
 const candidate={...p,x:x.x+(y.x-x.x)*q,y:x.y+(y.y-x.y)*q,z:x.z+(y.z-x.z)*q,yaw:x.yaw+Math.atan2(Math.sin(y.yaw-x.yaw),Math.cos(y.yaw-x.yaw))*q,...(hop?{seconds:kangarooPhase(time,epoch)}:{})};if(!kangarooFits(w,candidate))return current.homePets;return{...homes,'home-kangaroo':candidate};}
