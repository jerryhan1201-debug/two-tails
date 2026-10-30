/** Bake the existing exported idle pose once. No skeleton, animation or per-frame work. */
export function bakeStatue(model:{clips:{idle:{frames:number[][][]}};meshes:{name:string;positions:number[];normals:number[];indices:number[];pivot:number[];weights?:number[][][]}[]}){
 const groups=new Map<string,{positions:number[];normals:number[];indices:number[]}>(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],pose=model.clips.idle.frames[0];
 for(const part of model.meshes){const key=/^(eye|nose|mouth)/.test(part.name)?'features':'body';let g=groups.get(key);if(!g){g={positions:[],normals:[],indices:[]};groups.set(key,g);}const offset=g.positions.length/3;
  for(let v=0;v<part.positions.length/3;v++){const i=v*3,x=part.positions[i]+part.pivot[0],y=part.positions[i+1]+part.pivot[1],z=part.positions[i+2]+part.pivot[2],nx=part.normals[i],ny=part.normals[i+1],nz=part.normals[i+2];let px=0,py=0,pz=0,ax=0,ay=0,az=0;
   if(part.weights)for(const[b,k]of part.weights[v]){const m=pose[b];px+=(m[0]*x+m[4]*y+m[8]*z+m[12])*k;py+=(m[1]*x+m[5]*y+m[9]*z+m[13])*k;pz+=(m[2]*x+m[6]*y+m[10]*z+m[14])*k;ax+=(m[0]*nx+m[4]*ny+m[8]*nz)*k;ay+=(m[1]*nx+m[5]*ny+m[9]*nz)*k;az+=(m[2]*nx+m[6]*ny+m[10]*nz)*k;}
   else{px=x;py=y;pz=z;ax=nx;ay=ny;az=nz;}const length=Math.hypot(ax,ay,az)||1;g.positions.push(px,py,pz);g.normals.push(ax/length,ay/length,az/length);for(const[k,q]of[px,py,pz].entries()){min[k]=Math.min(min[k],q);max[k]=Math.max(max[k],q);}
  }
  for(let i=0;i<part.indices.length;i+=3)g.indices.push(offset+part.indices[i],offset+part.indices[i+2],offset+part.indices[i+1]);
 }
 return{groups,min,max,height:max[1]-min[1]};
}
