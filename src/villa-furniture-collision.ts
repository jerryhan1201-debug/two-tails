/** Exact horizontal footprint of the existing V12 curved sofa, not its old box chain. */
export function curvedSofaProjection(x:number,z:number,y:number,r:number,height:number,ordinary:boolean){
 for(const [inner,outer,top]of [[2.89,4.09,1.21],[3.725,4.095,2.03]]){
  if(y>=top-.09||y+height<.31)continue;
  const reach=ordinary&&top>y+1.05?.86:r,dx=x+12,dz=z-6.7,rad=Math.hypot(dx,dz),angle=Math.atan2(dz,dx);
  if(angle>=.18&&angle<=2.96){
   const wanted=rad<(inner+outer)/2?Math.min(rad,inner-reach-.001):Math.max(rad,outer+reach+.001);
   if(rad>inner-reach&&rad<outer+reach){x=-12+dx/rad*wanted;z=6.7+dz/rad*wanted;}
  }else{
   const end=angle<0?(dx>=0?.18:2.96):Math.max(.18,Math.min(2.96,angle)),c=Math.cos(end),s=Math.sin(end),along=Math.max(inner,Math.min(outer,dx*c+dz*s)),qx=-12+c*along,qz=6.7+s*along,vx=x-qx,vz=z-qz,d=Math.hypot(vx,vz);
   if(d<reach&&d>1e-8){x=qx+vx/d*(reach+.001);z=qz+vz/d*(reach+.001);}
  }
 }
 return{x,z};
}
