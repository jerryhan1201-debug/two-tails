/** Immutable broad phase; exact collision and height tests still run on the results. */
export function spatialCandidates<T extends {x:number;z:number}>(items:readonly T[],radius:(item:T)=>number,cell=20){
 const bins=new Map<string,T[]>();
 for(const item of items){const r=radius(item);for(let x=Math.floor((item.x-r)/cell);x<=Math.floor((item.x+r)/cell);x++)for(let z=Math.floor((item.z-r)/cell);z<=Math.floor((item.z+r)/cell);z++){const key=x+','+z,list=bins.get(key)??[];list.push(item);bins.set(key,list);}}
 return (x:number,z:number,r=0):T[]=>{const minX=Math.floor((x-r)/cell),maxX=Math.floor((x+r)/cell),minZ=Math.floor((z-r)/cell),maxZ=Math.floor((z+r)/cell);if(minX===maxX&&minZ===maxZ)return bins.get(minX+','+minZ)??[];const found=new Set<T>();for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++)for(const item of bins.get(i+','+j)??[])found.add(item);return [...found];};
}
