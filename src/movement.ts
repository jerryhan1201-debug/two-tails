import type {WaterColumn,SwimMode} from '../shared/swimming';
/** Shared movement contract. Coordinates are world-space, with y at the paws. */
export interface StandingSurface { y: number; walkable: boolean; normalY?: number; id?: string }
export interface MovementWorld {
  swimLegalAt?(x:number,y:number,z:number,radius?:number,height?:number):boolean;
  waterAt?(x:number,z:number,radius?:number):WaterColumn|null;
  resolveSwimAt?(x:number,z:number,y:number,radius:number,height:number):{x:number;z:number};
  recoveryFloor?:number;
  canSaveAt?(x:number,z:number,feetY:number):boolean;
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  surfaceAt(x: number, z: number, feetY: number, radius: number): StandingSurface | null;
  resolveAt(x: number, z: number, feetY: number, radius: number, bodyHeight: number): { x: number; z: number };
  ceilingAt?(x: number, z: number, feetY: number, radius: number): number | null;
  isSafe?(x: number, z: number, feetY: number, radius: number): boolean;
}
export interface MovementState {
  swim?:SwimMode;waterId?:string;
  x: number; z: number; y: number; vy: number; grounded: boolean; sprinting: boolean;
  safeX: number; safeY: number; safeZ: number; landing: number;
}
export const WALK_SPEED = 4.4;
export const SPRINT_SPEED = WALK_SPEED * 1.5;
export const PLAYER_HEIGHT = 2.1;
export const JUMP_SPEED = 6.4;
export const GRAVITY = 18;
export const STEP_HEIGHT = 0.28;
export const MIN_GROUND_NORMAL = 0.65;
const defaultBounds = { minX: -40, maxX: 40, minZ: -20, maxZ: 112 };
function outsideRecoveryBounds(p: MovementState, world: MovementWorld) {
  const b = world.bounds ?? defaultBounds;
  return p.x < b.minX - 4 || p.x > b.maxX + 4 || p.z < b.minZ - 4 || p.z > b.maxZ + 4;
}
export function standingSurface(world: MovementWorld, x: number, z: number, y: number, radius: number) {
  const s = world.surfaceAt(x, z, y, radius);
  return s && s.walkable && Number.isFinite(s.y) && (s.normalY ?? 1) >= MIN_GROUND_NORMAL ? s : null;
}
export function rememberGround(p: MovementState, world: MovementWorld, radius: number) {
  if (p.grounded && (!world.canSaveAt || world.canSaveAt(p.x,p.z,p.y)) && (!world.isSafe || world.isSafe(p.x, p.z, p.y, radius))) {
    p.safeX = p.x; p.safeY = p.y; p.safeZ = p.z;
  }
}
/** Integrates real gravity in <=10 ms steps; sweeps horizontal bodies at every step. */
export function advanceMovement(
  p: MovementState, vx: number, vz: number, dt: number, world: MovementWorld, radius: number,
  moveHorizontal: (dx: number, dz: number, feetY: number) => void,
  bodyHeight=PLAYER_HEIGHT,
  canEnterWater?:(x:number,y:number,z:number)=>boolean,
): { landed: boolean; needsRecovery: boolean } {
  let landed = false;
  p.landing = Math.max(0, p.landing - dt);
  const steps = Math.max(1, Math.ceil(dt / .01)), step = dt / steps;
  for (let i = 0; i < steps; i++) {
    const oldY = p.y;
    if (!p.grounded) { p.vy -= GRAVITY * step; p.y += p.vy * step; }
    const ceiling = world.ceilingAt?.(p.x, p.z, oldY, radius);
    if (ceiling != null && p.vy > 0 && p.y + bodyHeight >= ceiling) {
      p.y = Math.min(p.y, Math.max(oldY, ceiling - bodyHeight)); p.vy = 0;
    }
    const beforeX = p.x, beforeZ = p.z;
    moveHorizontal(vx * step, vz * step, Math.min(oldY, p.y));
    const enteredCeiling = world.ceilingAt?.(p.x,p.z,Math.min(oldY,p.y),radius);
    if (enteredCeiling != null && p.y + bodyHeight > enteredCeiling + .001) {
      if (oldY + bodyHeight > enteredCeiling + .001) { p.x = beforeX; p.z = beforeZ; }
      else { p.y = enteredCeiling - bodyHeight; p.vy = Math.min(0,p.vy); }
    }
    const water=world.waterAt?.(p.x,p.z);
    if(water&&p.y<=water.surface-.25&&(!canEnterWater||canEnterWater(p.x,water.surfaceFeet,p.z))){p.swim='surface';p.waterId=water.id;p.y=water.surfaceFeet;p.vy=0;p.grounded=false;if(world.swimLegalAt){p.safeX=p.x;p.safeY=p.y;p.safeZ=p.z;}return{landed:false,needsRecovery:false};}
    let ground = standingSurface(world, p.x, p.z, Math.max(oldY, p.y) + STEP_HEIGHT, radius);
    if (p.grounded) {
      // Ground locomotion stops before unsafe water. A deliberate jump may cross it.
      if (!ground || ground.y - oldY > STEP_HEIGHT + .001) {
        p.x = beforeX; p.z = beforeZ;
        ground = standingSurface(world, p.x, p.z, oldY + STEP_HEIGHT, radius);
      }
      if (ground && Math.abs(ground.y - oldY) <= STEP_HEIGHT + .001) {
        p.y = ground.y; p.vy = 0;
      } else { p.grounded = false; p.vy = 0; }
    } else if (p.vy <= 0 && ground && oldY >= ground.y - .04 && p.y <= ground.y + .015) {
      const legal = world.resolveAt(p.x, p.z, ground.y, radius, bodyHeight);
      if (Math.hypot(legal.x - p.x, legal.z - p.z) < .04) {
        p.y = ground.y; p.vy = 0; p.grounded = true; p.landing = .16; landed = true;
      }
    }
    rememberGround(p, world, radius);
    if (![p.x,p.z,p.y,p.vy].every(Number.isFinite) || p.y < Math.min(p.safeY,world.recoveryFloor??p.safeY) - 5 || outsideRecoveryBounds(p, world))
      return { landed, needsRecovery: true };
  }
  return { landed, needsRecovery: false };
}

export interface FlightState extends MovementState {
  mounted:boolean;
  flight:'grounded'|'flying'|'landing';
  vx:number;
  vz:number;
}
export const FLIGHT_SPEED=9.43;
export const FLIGHT_BOOST_SPEED=12.65;
export const FLIGHT_CLIMB_SPEED=4.5;
export const FLIGHT_MAX_HEIGHT=24;
const approach=(value:number,target:number,step:number)=>value<target?Math.min(target,value+step):Math.max(target,value-step);
/** A swept 3D body, with acceleration and a real downward landing query. No teleporting while airborne. */
export function advanceFlight(p:FlightState,dx:number,dz:number,lift:number,boost:boolean,dt:number,world:MovementWorld,radius:number,
  moveHorizontal:(dx:number,dz:number,feetY:number)=>void,canEnterWater?:(x:number,y:number,z:number)=>boolean):{landed:boolean;needsRecovery:boolean}{
  const steps=Math.max(1,Math.ceil(dt/.01)),step=dt/steps;
  for(let i=0;i<steps;i++){
    const landing=p.flight==='landing',speed=boost?FLIGHT_BOOST_SPEED:FLIGHT_SPEED;
    p.vx=approach(p.vx,landing?0:dx*speed,11*step);p.vz=approach(p.vz,landing?0:dz*speed,11*step);
    p.vy=approach(p.vy,landing?-3.8:Math.max(-1,Math.min(1,lift))*FLIGHT_CLIMB_SPEED,9*step);
    const oldY=p.y,beforeX=p.x,beforeZ=p.z;
    p.y=Math.min(FLIGHT_MAX_HEIGHT,p.y+p.vy*step);
    if(p.y>=FLIGHT_MAX_HEIGHT&&p.vy>0)p.vy=0;
    const ceiling=world.ceilingAt?.(p.x,p.z,oldY,radius);
    if(ceiling!=null&&p.vy>0&&p.y+PLAYER_HEIGHT>ceiling){p.y=Math.max(oldY,ceiling-PLAYER_HEIGHT);p.vy=0;}
    // Pure vertical motion still sweeps the full body against wood and walls.
    // The horizontal actor solver intentionally does nothing for a zero vector,
    // so feed it the world's outward projection when a changing height contacts
    // a curved side. This slides around the solid instead of passing through it.
    const projected=world.resolveAt(p.x,p.z,p.y,radius,PLAYER_HEIGHT);
    if(Math.hypot(projected.x-p.x,projected.z-p.z)>.00001)moveHorizontal(projected.x-p.x,projected.z-p.z,p.y);
    moveHorizontal(p.vx*step,p.vz*step,Math.min(oldY,p.y));
    if(Math.abs(p.x-beforeX)<Math.abs(p.vx*step)*.3)p.vx=0;
    if(Math.abs(p.z-beforeZ)<Math.abs(p.vz*step)*.3)p.vz=0;
    const entering=world.ceilingAt?.(p.x,p.z,Math.min(oldY,p.y),radius);
    // A descent may contact the upper/side skin of a curved branch. Preserve
    // the collision solver's outward slide instead of rolling it back into the
    // old overlapping column forever. Only reject a newly entered low ceiling
    // when the previous body had genuinely clear headroom.
    const hadHeadroom=ceiling==null||oldY+PLAYER_HEIGHT<=ceiling+.001;
    if(entering!=null&&p.y+PLAYER_HEIGHT>entering+.001&&hadHeadroom){p.x=beforeX;p.z=beforeZ;p.vx=0;p.vz=0;}
    const water=world.waterAt?.(p.x,p.z);if(water?.id==='cove-swim-basin'&&p.y<=water.surface-.25){if(!canEnterWater||canEnterWater(p.x,water.surfaceFeet,p.z)){Object.assign(p,{y:water.surfaceFeet,vy:0,vx:0,vz:0,grounded:false,mounted:false,flight:'grounded',swim:'surface',waterId:water.id,safeX:p.x,safeY:water.surfaceFeet,safeZ:p.z});return{landed:false,needsRecovery:false};}p.x=beforeX;p.z=beforeZ;p.y=oldY;p.vy=0;}
    const ground=standingSurface(world,p.x,p.z,Math.max(oldY,p.y)+STEP_HEIGHT,radius);
    if(ground&&p.vy>0&&p.y<ground.y+.05)p.y=ground.y+.05;
    if(ground&&p.vy<=0&&p.y<=ground.y+.08){
      const legal=world.resolveAt(p.x,p.z,ground.y,radius,PLAYER_HEIGHT);
      if(Math.hypot(legal.x-p.x,legal.z-p.z)<.04&&(!world.isSafe||world.isSafe(p.x,p.z,ground.y,radius))){
        p.y=ground.y;p.vy=0;p.vx=0;p.vz=0;p.grounded=true;p.flight='grounded';p.mounted=false;p.landing=.2;rememberGround(p,world,radius);return {landed:true,needsRecovery:false};
      }
      p.y=Math.max(p.y,ground.y+.12);p.vy=0;
    }
    // A controlled descent from a roof is not a fall below the launch point.
    // Keep the emergency floor below the terrain datum (or a lower saved floor).
    if(![p.x,p.z,p.y,p.vy,p.vx,p.vz].every(Number.isFinite)||p.y<Math.min(p.safeY,0)-5||outsideRecoveryBounds(p,world))return {landed:false,needsRecovery:true};
  }
  return {landed:false,needsRecovery:false};
}
