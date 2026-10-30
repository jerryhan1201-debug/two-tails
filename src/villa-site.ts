/** Fixed additions around the untouched RC3 site; shared by rendering and physics. */
export const VILLA_OLD_BOUNDS={minX:-39,maxX:44,minZ:-36,maxZ:47};
export {VILLA_SITE_BOUNDS} from '../shared/world-bounds';
export type SiteBox={id:string;kind:string;center:number[];size:number[];rotationY:number};
export const COURTYARD_WALLS:SiteBox[]=[];
function wallRun(id:string,x1:number,z1:number,x2:number,z2:number){
 const length=Math.hypot(x2-x1,z2-z1),count=Math.ceil(length/7),angle=Math.atan2(x2-x1,z2-z1);
 for(let i=0;i<count;i++){const t=(i+.5)/count,grille=i%5===2;
  COURTYARD_WALLS.push({id:id+'-'+i,kind:grille?'grille':'garden-wall',center:[x1+(x2-x1)*t,1.46,z1+(z2-z1)*t],size:[.38,2.4,length/count+.02],rotationY:angle});
 }
}
wallRun('west',-38,-35,-38,-23);wallRun('west-long',-38,-18,-38,46);
wallRun('east',43,-35,43,46);wallRun('north-left',-38,-35,-13,-35);wallRun('north-right',-8,-35,43,-35);
wallRun('south-left',-38,46,23,46);wallRun('south-right',33,46,43,46);
export const WALL_LIGHTS=COURTYARD_WALLS.filter((w,i)=>w.kind!=='grille'&&i%2===0).map(w=>{
 const [x,,z]=w.center,dx=x===-38?1:x===43?-1:0,dz=z===-35?1:z===46?-1:0;
 return {id:w.id,x:x+dx*.24,z:z+dz*.24,dx,dz,y:2.1};
});
export const HOME_FOREST_PATH=[[-38,-20.5],[-55,-21],[-65,-48],[-37,-66],[-10,-59],[-10,-35]];
export function homePathDistance(x:number,z:number){let d=Infinity;
 for(let i=1;i<HOME_FOREST_PATH.length;i++){const [ax,az]=HOME_FOREST_PATH[i-1],[bx,bz]=HOME_FOREST_PATH[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(x-ax-t*dx,z-az-t*dz));}
 return Math.min(d,z>44?Math.abs(x-28):Infinity);
}
export const HOME_FOREST=(()=>{let seed=110731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const trees:{id:string;x:number;z:number;scale:number;yaw:number;asset:string}[]=[];
 for(let z=-85;z<100;z+=6)for(let x=-90;x<96;x+=6){
  const px=x+(rand()-.5)*4.8,pz=z+(rand()-.5)*4.8;
  if(px>-46&&px<51&&pz>-43&&pz<54||homePathDistance(px,pz)<4.7)continue;
  const patch=Math.sin(px*.082+pz*.014)+Math.cos(pz*.075-px*.018);
  if(patch<-.55||rand()>(patch>.6?.94:.48)||Math.hypot(px+68,pz-50)<12||Math.hypot(px-72,pz+54)<10)continue;
  trees.push({id:'home-wood-'+trees.length,x:px,z:pz,scale:.76+rand()*.34,yaw:rand()*Math.PI*2,asset:rand()<.35?'reuse-birch':'reuse-oak'});
 }return trees;
})();
export const HOME_FOREST_COLLISIONS:SiteBox[]=HOME_FOREST.map(t=>({id:t.id,kind:'forest-trunk',center:[t.x,.26+3*t.scale,t.z],size:[1.1*t.scale,6*t.scale,1.1*t.scale],rotationY:t.yaw}));
