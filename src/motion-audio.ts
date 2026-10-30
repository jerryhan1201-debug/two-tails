import type {MovementWorld} from './movement';
export type GroundSound='grass'|'stone'|'wood';
type Pose={homeUse?:unknown;x:number;y:number;z:number;grounded:boolean;mounted:boolean;sprinting:boolean};
/** Distance driven; blocked movement, teleports, menus and flight cannot make steps. */
export class MotionAudio {
 private previous:(Pose&{region:string})|null=null;private distance=0;
 update(p:Pose,region:string,world:MovementWorld,allowed:boolean){const old=this.previous;this.previous={...p,region};const events:{name:string;value:number}[]=[];
  if(!allowed||!old||p.homeUse||old.homeUse||old.region!==region){this.distance=0;return events;}
  const travelled=Math.hypot(p.x-old.x,p.z-old.z);if(travelled>1.8||Math.abs(p.y-old.y)>2){this.distance=0;return events;}
  const stride=p.sprinting?.95:.78;this.distance=p.grounded&&!p.mounted?this.distance+travelled:0;
  const landed=(old.mounted&&!p.mounted)||(!old.grounded&&p.grounded&&!p.mounted),jumped=old.grounded&&!p.grounded&&!p.mounted;
  if(!landed&&!jumped&&(p.mounted||!p.grounded||this.distance<stride))return events;
  const surface=world.surfaceAt(p.x,p.z,p.y+.28,.66)?.id??'';
  const material:GroundSound=(/wood|deck|plank|porch|boardwalk|bridge|tree.*stair/.test(surface)||surface==='F2 L plate / living void / stairwell')||region==='mushroom-home'?'wood':/stone|path|floor|slab|terrace|paving/.test(surface)||region==='ch01-lantern-village'&&((world as MovementWorld&{pathDistance?:(x:number,z:number)=>number}).pathDistance?.(p.x,p.z)??Infinity)<1.3||region==='player-home-villa'&&p.x>-22&&p.x<20&&p.z>-13&&p.z<17?'stone':'grass';
  const value=material==='grass'?0:material==='stone'?1:2;
  if(old.mounted&&!p.mounted)events.push({name:'land-material',value});
  else if(!old.grounded&&p.grounded&&!p.mounted)events.push({name:'land-material',value});
  else if(old.grounded&&!p.grounded&&!p.mounted)events.push({name:'jump',value});
  if(p.mounted||!p.grounded){this.distance=0;return events;}
  if(this.distance>=stride){events.push({name:'step-material',value});this.distance%=stride;}return events;
 }
 reset(){this.previous=null;this.distance=0;}
}
