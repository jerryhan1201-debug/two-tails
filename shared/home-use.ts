/** Transient, host-owned furniture occupancy. No new save version or content IDs. */
export const HOME_USES = [
 {id:'living-sofa',label:'起居沙发',pose:'sit',floor:.3,approach:[-12,9],slots:[[-13.1,1.20,9.65,Math.PI+.28],[-10.9,1.20,9.65,Math.PI-.28]],exits:[[-12.5,8.9],[-11.5,8.9]]},
 {id:'upper-sofa',label:'楼上沙发',pose:'sit',floor:5.1,approach:[.8,7.5],slots:[[-.08,5.925,5.9,0],[1.68,5.925,5.9,0]],exits:[[-2,7.4],[3.5,7.4]]},
 {id:'music-sofa',label:'音乐沙发',pose:'sit',floor:-4.5,approach:[13,10],slots:[[11.91,-3.675,8.35,0],[14.09,-3.675,8.35,0]],exits:[[10,10.2],[15.1,10.2]]},
 {id:'master-bed',label:'主卧床',pose:'lie',floor:5.1,approach:[-12.7,-3],slots:[[-13.55,6.155,-6.05,0],[-11.85,6.155,-6.05,0]],exits:[[-13.65,-2.9],[-11.75,-2.9]]},
 {id:'guest-bed',label:'客卧床',pose:'lie',floor:5.1,approach:[13.2,-6.2],slots:[[12.35,6.155,-8.85,0],[14.05,6.155,-8.85,0]],exits:[[10.5,-7],[15.9,-7]]},
] as const;
export type HomeUseId=typeof HOME_USES[number]['id'];
export type HomePoint={x:number;y:number;z:number;yaw:number};
export type HomeUse={id:HomeUseId;slot:0|1;phase:'enter'|'rest'|'exit';startedAt:number;origin:HomePoint;exit:HomePoint};
export const homeUseDefinition=(id:string)=>HOME_USES.find(f=>f.id===id);
export function validHomeUse(v:any):v is HomeUse{
 const point=(p:any)=>p&&['x','y','z','yaw'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<10000);
 return !!v&&!!homeUseDefinition(v.id)&&(v.slot===0||v.slot===1)&&['enter','rest','exit'].includes(v.phase)&&Number.isFinite(v.startedAt)&&v.startedAt>=0&&point(v.origin)&&point(v.exit)&&Math.abs(v.exit.y-homeUseDefinition(v.id)!.floor)<.15;
}
