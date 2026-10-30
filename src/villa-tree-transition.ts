import {Mesh,VertexData,type Material,type Scene,type TransformNode} from '@babylonjs/core';
import data from '../source-assets/environment/v12/tree-transition.json';
import {TREE_PROFILE} from './villa-tree-profile';
export function buildTreeTransition(scene:Scene,parent:TransformNode,material:Material){
 const count=data.baseRing.length,positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(const [y,f]of TREE_PROFILE)for(let i=0;i<=count;i++){
  const [a,r]=data.baseRing[i%count];positions.push(31+Math.cos(a)*r*f,y,15+Math.sin(a)*r*f);uvs.push(i/count*4,(y-5.3)/4);
 }
 for(let j=0;j<TREE_PROFILE.length-1;j++)for(let i=0;i<count;i++){const a=j*(count+1)+i,b=a+count+1;indices.push(a,b,a+1,a+1,b,b+1);}
 const d=new VertexData();d.positions=positions;d.indices=indices;d.uvs=uvs;d.normals=[];VertexData.ComputeNormals(positions,indices,d.normals);
 const m=new Mesh('V12 continuous courtyard oak upper trunk',scene);d.applyToMesh(m);m.material=material;m.parent=parent;m.receiveShadows=true;m.isPickable=true;m.metadata={villa:true,villaRole:'trunk',cameraObstacle:true,source:'tree-transition.json'};return m;
}
