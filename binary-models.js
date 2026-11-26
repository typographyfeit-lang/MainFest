'use strict';
// Bounded GLB 2.0 decoder for our own packed assets. All files are local relative URLs.
const ArenaBinary=(()=>{
  function decode(buffer){
    const v=new DataView(buffer);if(v.byteLength<28||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==v.byteLength)throw Error('Invalid GLB header');
    const jl=v.getUint32(12,true),end=20+jl;if(end+8>v.byteLength||v.getUint32(16,true)!==0x4e4f534a||v.getUint32(end+4,true)!==0x004e4942)throw Error('Invalid GLB chunks');
    const bin=end+8,limit=bin+v.getUint32(end,true);if(limit!==v.byteLength)throw Error('Invalid GLB BIN');
    const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jl)));
    const types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    function read(i,type,component=5126){const a=doc.accessors[i],b=a&&doc.bufferViews[a.bufferView],n=types[type];if(!a||!b||!n||a.type!==type||a.componentType!==component||b.buffer!==0||b.byteStride||a.sparse||!Number.isInteger(a.count)||a.count<1)throw Error('Unsupported GLB accessor');const size=component===5126?4:component===5123?2:0,local=a.byteOffset||0,offset=bin+(b.byteOffset||0)+local,len=a.count*n;if(!size||offset<bin||offset%size||local+len*size>b.byteLength||offset+len*size>limit)throw Error('GLB accessor outside buffer');return component===5126?new Float32Array(buffer,offset,len):new Uint16Array(buffer,offset,len)}
    return {doc,read};
  }
  async function load(name){const url='./'+name+'.glb?v=30';const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw Error(name+': HTTP '+res.status);const b=await res.arrayBuffer();if(b.byteLength>4*1024*1024)throw Error('GLB exceeds size limit');return decode(b)}
  return {load,decode};
})();
