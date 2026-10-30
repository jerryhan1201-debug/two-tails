import {HOME_PET_SITES}from'./home-pet-sites';import{ANIMAL_SITES,animalSample}from'./animal-schedule';import{animalClock,animalReaction}from'./animal-interactions';import{kangarooContacts}from'./kangaroo-contact';import type{Snapshot}from'./simulation';import type{MovementWorld}from'./movement';import type{ContactBody}from'./combat-contact';
/** The same original animal volumes are used by authority and guest prediction. */
export function friendlyAnimalContacts(s:Snapshot,w:MovementWorld):ContactBody[]{const out:ContactBody[]=[];
 for(const p of Object.values(s.homePets??{}).filter(p=>p.regionId===s.regionId&&!p.water)){
  if(p.id==='home-kangaroo'){const reaction=animalReaction(s,p.id),elapsed=reaction?s.time-reaction.start:0,remaining=reaction?reaction.until-s.time:0,pose=reaction?elapsed<1?'settle':remaining<1?'rise':'sit':p.pose,seconds=reaction?pose==='rise'?1-remaining:elapsed:p.seconds;out.push(...kangarooContacts(p.id,{...p,pose,seconds}));}
  else out.push({id:p.id,x:p.x,z:p.z,y:p.y,height:HOME_PET_SITES[p.id].height,reservesColumn:false,fixed:true,radius:HOME_PET_SITES[p.id].clearance});
 }
 const site=ANIMAL_SITES.find(a=>a.id==='kangaroo'&&a.regionId===s.regionId);if(site){const sample=animalSample(site,animalClock(s,site.id)),reaction=animalReaction(s,site.id),elapsed=reaction?s.time-reaction.start:0,remaining=reaction?reaction.until-s.time:0,original=reaction?animalSample(site,animalClock(s,site.id)-elapsed):sample,x=reaction?.x??sample.x,z=reaction?.z??sample.z,y=w.surfaceAt(x,z,site.y+.8,0)?.y??site.y,pose=reaction?elapsed<1?'settle':remaining<1?'rise':'sit':sample.clip,seconds=reaction?pose==='rise'?1-remaining:elapsed:sample.seconds,yaw=reaction?original.yaw+Math.atan2(Math.sin(reaction.yaw-original.yaw),Math.cos(reaction.yaw-original.yaw))*Math.min(1,elapsed/.4)*Math.min(1,remaining/.5):sample.yaw;out.push(...kangarooContacts('ambient:kangaroo',{x,y,z,yaw,pose,seconds}));}
 return out;
}
