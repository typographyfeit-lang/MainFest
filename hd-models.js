'use strict';
// Static tower architecture: read the original binary assets directly; no Base64 copy.
const ArenaHDModels=window.THREE?(()=>{
  const A=ArenaArt3D,T=A.T,cache=new Map();let pending=null;
  function register(name,{doc,read}){const parts=doc.meshes[0].primitives.map(p=>{if(p.mode!==4)throw Error('Expected triangles');const a=p.attributes,g=new T.BufferGeometry();for(const [attr,key,type,n] of [['position','POSITION','VEC3',3],['normal','NORMAL','VEC3',3],['uv','TEXCOORD_0','VEC2',2],['color','COLOR_0','VEC3',3]])g.setAttribute(attr,new T.Float32BufferAttribute(read(a[key],type),n));g.setIndex(new T.Uint16BufferAttribute(read(p.indices,'SCALAR',5123),1));g.computeBoundingSphere();const kind=doc.materials[p.material].name,base=A.material('#ffffff',kind==='gold'?'gold':'stone');const o={color:A.lin('#ffffff'),vertexColors:true,map:base.map,roughness:base.roughness,metalness:base.metalness};if(base.bumpMap){o.bumpMap=base.bumpMap;o.bumpScale=base.bumpScale*.55}if(base.roughnessMap)o.roughnessMap=base.roughnessMap;return {geometry:g,material:new T.MeshStandardMaterial(o),triangles:doc.accessors[p.indices].count/3}});cache.set(name,parts)}
  function preload(){if(cache.has('citadel-hd'))return Promise.resolve();if(!pending)pending=Promise.all(['citadel-hd'].map(async n=>{if(!cache.has(n))register(n,await ArenaBinary.load(n))})).catch(e=>{pending=null;throw e});return pending}
  function add(parent,name){const parts=cache.get(name);if(!parts)throw Error('Tower not preloaded: '+name);for(const p of parts){const m=new T.Mesh(p.geometry,p.material);m.castShadow=true;m.receiveShadow=true;parent.add(m)}}
  function stats(){return Object.fromEntries([...cache].map(([k,parts])=>[k,parts.reduce((n,p)=>n+p.triangles,0)]))}
  return {add,stats,preload};
})():null;
