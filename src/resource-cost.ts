import type{Geometry}from'@babylonjs/core';
/** Read raw allocation sizes, never decode instance-rate attributes as vertices. */
export function geometryRetainedBytes(geometries:Iterable<Geometry>){
 const cpu=new Set<object>(),gpu=new Set<object>();let bytes=0;
 const dataSize=(data:any)=>{if(!data)return 0;const owner=ArrayBuffer.isView(data)?data.buffer:data;if(cpu.has(owner))return 0;cpu.add(owner);return Array.isArray(data)?data.length*8:owner.byteLength??0;};
 for(const g of geometries){for(const vb of Object.values(g.getVertexBuffers()??{})){const data=vb.getData(),buffer=vb.getBuffer();bytes+=dataSize(data);if(buffer&&!gpu.has(buffer)){gpu.add(buffer);bytes+=buffer.capacity||((data as any)?.byteLength??((data as any)?.length??0)*4);}}const indices=g.getIndices();bytes+=dataSize(indices)+(indices?.length??0)*4+4096;}
 return bytes;
}
