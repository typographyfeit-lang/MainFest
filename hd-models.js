'use strict';
// Synchronous, restricted GLB 2.0 reader for the two bundled original meshes.
// Only the known format emitted by build-hd-models.py is accepted; no network or eval.
const ArenaHDModels=window.THREE&&typeof ArenaHDData!=='undefined'?(()=>{
  const A=ArenaArt3D,T=A.T,cache=new Map();
  function load(name){
    if(cache.has(name))return cache.get(name);
    const encoded=ArenaHDData[name];if(!encoded)throw Error('Unknown HD model '+name);
    const str=atob(encoded),bytes=Uint8Array.from(str,c=>c.charCodeAt(0)),v=new DataView(bytes.buffer);
    if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length)throw Error('Invalid GLB');
    const jl=v.getUint32(12,true),end=20+jl;if(v.getUint32(16,true)!==0x4e4f534a||v.getUint32(end+4,true)!==0x004e4942)throw Error('Invalid GLB chunks');
    const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,end))),bin=end+8,limit=bin+v.getUint32(end,true);
    function read(i,components,expected){const a=json.accessors[i],b=json.bufferViews[a.bufferView];if(a.componentType!==expected||b.buffer!==0||b.byteStride)throw Error('Unsupported accessor');const offset=bin+(b.byteOffset||0)+(a.byteOffset||0),len=a.count*components,sz=expected===5126?4:2;if(offset<bin||offset+len*sz>limit||limit>bytes.length)throw Error('GLB accessor outside buffer');return expected===5126?new Float32Array(bytes.buffer,offset,len):new Uint16Array(bytes.buffer,offset,len)}
    const parts=json.meshes[0].primitives.map(p=>{if(p.mode!==4)throw Error('Expected triangles');const a=p.attributes,g=new T.BufferGeometry();for(const [attr,key,n] of [['position','POSITION',3],['normal','NORMAL',3],['uv','TEXCOORD_0',2],['color','COLOR_0',3]])g.setAttribute(attr,new T.Float32BufferAttribute(read(a[key],n,5126),n));g.setIndex(Array.from(read(p.indices,1,5123)));g.computeBoundingSphere();const kind=json.materials[p.material].name,base=A.material('#ffffff',kind==='gold'?'gold':'stone');const o={color:A.lin('#ffffff'),vertexColors:true,map:base.map,roughness:base.roughness,metalness:base.metalness};if(base.bumpMap){o.bumpMap=base.bumpMap;o.bumpScale=base.bumpScale*.55}if(base.roughnessMap)o.roughnessMap=base.roughnessMap;return {geometry:g,material:new T.MeshStandardMaterial(o),triangles:json.accessors[p.indices].count/3}});
    cache.set(name,parts);return parts;
  }
  function add(parent,name){for(const p of load(name)){const m=new T.Mesh(p.geometry,p.material);m.castShadow=true;m.receiveShadow=true;parent.add(m)}}
  function stats(){return Object.fromEntries([...cache].map(([k,parts])=>[k,parts.reduce((n,p)=>n+p.triangles,0)]))}
  return {add,stats};
})():null;
