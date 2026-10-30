export function regionalTrees(regionId:string){
 if(regionId==='mushroom-grove')return [[-27,4],[-33,32],[34,4],[-33,75],[33,104]].map(([x,z],i)=>({x,z,s:2.5,seed:i,templateSeed:undefined as number|undefined})).concat([{x:-44,z:50,s:2.5,seed:100,templateSeed:0},{x:44,z:82,s:2.5,seed:101,templateSeed:2},{x:-47,z:15,s:2.5,seed:102,templateSeed:1},{x:47,z:40,s:2.5,seed:103,templateSeed:3},{x:-47,z:99,s:2.5,seed:104,templateSeed:4}]);
 if(regionId!=='canopy-garden')return [];
 const first=[[-25,14,3],[22,12,2.7],[-25,54,3.5],[26,66,3.8],[-17,85,3.1],[18,91,2.9]].map(([x,z,s])=>({x,z,s,seed:z,templateSeed:undefined as number|undefined}));
 const trees=Array.from({length:18},(_,i)=>({x:(i%2?1:-1)*(41+(i%3)*5),z:-3+Math.floor(i/2)*14,s:2.6+(i%3)*.5,seed:i*13,templateSeed:undefined as number|undefined}));
 for(let i=0;i<16;i++){const t=trees[i<7?i:i%6];trees.push({x:(i%2?1:-1)*(i<7?45:52),z:i<7?4+i*16:12+(i-7)*12,s:t.s,seed:1000+i,templateSeed:t.seed});}
 return first.concat(trees);
}
