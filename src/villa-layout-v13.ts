import {COURTYARD_STATUES as STATUES,statueBodyBounds,GOLD_STATUE_BANDS} from './villa-display-layout';
/** Metres in the existing RC3 shell. No structure, stairs or floor cuts move. */
export const HOME_ART=[
 {id:'03',title:'小白宝座',zone:'entry facing solid wall',at:[.35,2.50,-11.80],width:2.4,height:3.6,yaw:Math.PI},
 {id:'08',title:'小鸡毛宝座',zone:'entry facing solid wall',at:[3.45,2.50,-11.80],width:2.4,height:3.6,yaw:Math.PI},
 {id:'01',title:'草地相伴',zone:'dining',at:[-13.9,2.5,-11.82],width:1.9,height:1.9,yaw:Math.PI},
 {id:'02',title:'粉色庆祝',zone:'kitchen',at:[-19.635,2.35,-9.55],width:1.35,height:1.35,yaw:-Math.PI/2},
 {id:'04',title:'花园野餐',zone:'master',at:[-9,7.35,-11.82],width:1.7,height:1.7,yaw:Math.PI},
 {id:'05',title:'双人单车',zone:'music',at:[17.76,-2.05,11.7],width:1.8,height:1.8,yaw:Math.PI/2},
 {id:'06',title:'小鸡毛学帽',zone:'study',at:[-1.7,7.45,-11.82],width:1.35,height:1.35,yaw:Math.PI},
 {id:'07',title:'小鸡毛课堂',zone:'study',at:[7.82,7.45,-8.7],width:1.8,height:1.8,yaw:Math.PI/2},
];
const body=(id:string,center:number[],size:number[],rotationY=0)=>({id,kind:'home-furniture',center,size,rotationY});
export const V13_HOME_BODIES=[
 body('story reading nook',[-46,.9,-26],[2.6,1.28,.8]),
 body('study desk',[2.6,5.83,-8.7],[3.2,1.46,1.25]),body('study chair',[2.6,5.65,-6.9],[.95,1.1,.95]),
 body('study bookcase west',[.7,6.45,-11.45],[2.0,2.7,.45]),body('study bookcase east',[4.8,6.45,-11.45],[2.0,2.7,.45]),
 body('study reading chair',[-1.55,5.73,-6.6],[1.5,1.25,1.45]),body('study side table',[-2.95,5.53,-7],[.65,.86,.65]),
 body('gym treadmill',[15.25,-3.82,-9.05],[1.6,1.36,3.0]),body('gym training bench',[10.3,-4.05,-8.1],[1.1,.9,2.65]),
 body('gym weights rack',[10.7,-3.7,-11.35],[3.5,1.6,.7]),body('gym rest bench',[17,-4.13,-6.05],[1.4,.74,.75]),
 body('entry welcome console',[-3,.80,-10.9],[1.4,1,.65]),
 ...(['gold','white'] as const).flatMap(role=>{const a=STATUES[role],b=statueBodyBounds(role),lower=role==='gold'?1.2:.6,upper=role==='gold'?1:.12;return[
  body('courtyard '+role+' lower plinth',[a.x,.26+lower/2,a.z],[a.baseWidth,lower,a.baseWidth]),
  body('courtyard '+role+' upper plinth',[a.x,.26+lower+upper/2,a.z],[a.upperWidth,upper,a.upperWidth]),
  ...(role==='gold'?GOLD_STATUE_BANDS.map(([min,max],i)=>{const band=statueBodyBounds(role,min,max);return body('courtyard gold statue band '+i,band.center,band.size,band.rotationY);}):[body('courtyard white statue',b.center,b.size,b.rotationY)]),
 ];}),
];
/** Reserved two-dog use/approach poses; not exposed as interactions this round. */
export const HOME_FUTURE_POSES=[
 {id:'living-sofa',roles:[[-13.1,.3,9.5],[-10.9,.3,9.5]],approach:[-12,.3,7.9]},
 {id:'upper-sofa',roles:[[-.1,5.1,5.5],[1.7,5.1,5.5]],approach:[.8,5.1,7.5]},
 {id:'music-sofa',roles:[[11.9,-4.5,8],[14.1,-4.5,8]],approach:[13,-4.5,10]},
 {id:'master-bed',roles:[[-13.5,5.1,-6.3],[-11.9,5.1,-6.3]],approach:[-12.7,5.1,-3]},
 {id:'guest-bed',roles:[[12.4,5.1,-9.1],[14,5.1,-9.1]],approach:[13.2,5.1,-6.2]},
 {id:'study',roles:[[2.6,5.1,-6.9],[-1.55,5.1,-6.6]],approach:[.5,5.1,-5.6]},
 {id:'gym',roles:[[15.25,-4.5,-9.05],[10.3,-4.5,-8.1]],approach:[15.8,-4.5,-4.9]},
];
