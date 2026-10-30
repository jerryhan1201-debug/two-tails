import {Bone,Matrix,Skeleton,type Mesh,type Scene} from '@babylonjs/core';
/** The studio exports skin matrices in character space. Each part retains its
 * authored pivot, so translate the palette into that part's local coordinates.
 * Geometry, weights, normals, bone order and choreography stay unchanged. */
export function pivotSkinPalette(matrices:readonly (readonly number[])[],pivot:readonly number[],target:Float32Array){
 for(let b=0;b<matrices.length;b++){const m=matrices[b],o=b*16;for(let i=0;i<16;i++)target[o+i]=m[i];for(let axis=0;axis<3;axis++)target[o+12+axis]=m[axis]*pivot[0]+m[4+axis]*pivot[1]+m[8+axis]*pivot[2]+m[12+axis]-pivot[axis];}
 target.set(Matrix.IdentityReadOnly.m,matrices.length*16);
}
export function recordedSkin(scene:Scene,mesh:Mesh,bones:readonly string[],weights:number[][][],pivot:readonly number[]){
 const palette=new Float32Array((bones.length+1)*16),skeleton=new Skeleton(mesh.name+' studio palette',mesh.name,scene);
 for(const name of bones)new Bone(name,skeleton,null,Matrix.Identity());
 skeleton.useTextureToStoreBoneMatrices=false;
 // These are final exported skin matrices, not local bone transforms to be
 // multiplied by another inverse bind. Both render and shadow shaders use them.
 skeleton.prepare=()=>{};skeleton.getTransformMatrices=()=>palette;
 const indices=new Float32Array(weights.length*4),values=new Float32Array(weights.length*4);
 weights.forEach((vertex,v)=>{if(vertex.length>4)throw Error('Studio skin exceeds four influences');vertex.forEach(([b,w],i)=>{indices[v*4+i]=b;values[v*4+i]=w;});});
 mesh.setVerticesData('matricesIndices',indices,false,4);mesh.setVerticesData('matricesWeights',values,false,4);mesh.skeleton=skeleton;mesh.numBoneInfluencers=4;mesh.computeBonesUsingShaders=true;
 return {update:(matrices:readonly (readonly number[])[])=>pivotSkinPalette(matrices,pivot,palette),dispose:()=>skeleton.dispose()};
}
