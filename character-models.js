'use strict';
// Standard glTF skin data and authored animation channels; shared geometry, one skeleton per unit.
const ArenaCharacterModels=window.THREE?(()=>{
  const A=ArenaArt3D,T=A.T,C=A.C,cache=new Map(),materials=new Map(),ids=['guard','archer','colossus','imp','mage','hounds','swarm','brute'];let pending=null;
  function register(name,{doc,read}){
    const skin=doc.skins[0],joints=skin.joints,nodes=joints.map(i=>doc.nodes[i]),indexByNode=new Map(joints.map((v,i)=>[v,i])),inverses=read(skin.inverseBindMatrices,'MAT4');
    if(inverses.length!==nodes.length*16)throw Error('Invalid skin');
    const inverseMatrices=nodes.map((_,i)=>new T.Matrix4().fromArray(inverses,i*16));
    const parts=doc.meshes[0].primitives.map(p=>{const a=p.attributes,g=new T.BufferGeometry();for(const [name,key,type,n] of [['position','POSITION','VEC3',3],['normal','NORMAL','VEC3',3],['uv','TEXCOORD_0','VEC2',2],['color','COLOR_0','VEC3',3],['skinWeight','WEIGHTS_0','VEC4',4]])g.setAttribute(name,new T.Float32BufferAttribute(read(a[key],type),n));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(read(a.JOINTS_0,'VEC4',5123),4));g.setIndex(new T.Uint16BufferAttribute(read(p.indices,'SCALAR',5123),1));g.computeBoundingSphere();return {g,kind:doc.materials[p.material].name,triangles:doc.accessors[p.indices].count/3}});
    const clips={};for(const c of doc.animations){let duration=0;const tracks=c.channels.map(ch=>{const s=c.samplers[ch.sampler],times=read(s.input,'SCALAR'),path=ch.target.path,n=path==='rotation'?4:3,values=read(s.output,path==='rotation'?'VEC4':'VEC3');if(!['rotation','scale'].includes(path)||!indexByNode.has(ch.target.node)||values.length!==times.length*n)throw Error('Invalid animation');duration=Math.max(duration,times[times.length-1]);return {i:indexByNode.get(ch.target.node),path,n,times,values}});clips[c.name]={duration,tracks}}
    for(const name of ['Idle','Walk','Attack','Hit','Death','Spawn'])if(!clips[name])throw Error('Missing animation '+name);
    cache.set(name,{nodes,indexByNode,inverseMatrices,parts,clips,root:indexByNode.get(skin.skeleton)});
  }
  function preload(){if(cache.size===ids.length)return Promise.resolve();if(!pending)pending=Promise.all(ids.map(async id=>{if(!cache.has(id))register(id,await ArenaBinary.load(id+'-unit'))})).catch(e=>{pending=null;throw e});return pending}
  function material(kind,team){const k=kind+':'+team;if(materials.has(k))return materials.get(k);const opts={skinning:true,vertexColors:true,color:A.lin(kind==='team'?C.cloth[team]:kind==='magic'?C.team[team]:'#ffffff')};const m=kind==='magic'?new T.MeshBasicMaterial({...opts,toneMapped:false}):new T.MeshStandardMaterial({...opts,roughness:.78,metalness:kind==='body'?.08:0});materials.set(k,m);return m}
  const q0=new T.Quaternion(),q1=new T.Quaternion(),vq=new T.Vector3();
  function instantiate(id,team,parent){const a=cache.get(id);if(!a)throw Error('Unit not preloaded: '+id);const group=new T.Group();parent.add(group);const bones=a.nodes.map(n=>{const b=new T.Bone();b.name=n.name;b.position.set(...n.translation);return b});a.nodes.forEach((n,i)=>{for(const ch of n.children||[])bones[i].add(bones[a.indexByNode.get(ch)])});group.add(bones[a.root]);const skeleton=new T.Skeleton(bones,a.inverseMatrices.map(m=>m.clone()));
    for(const p of a.parts){const mesh=new T.SkinnedMesh(p.g,material(p.kind,team));mesh.castShadow=p.kind!=='magic';mesh.receiveShadow=p.kind!=='magic';mesh.frustumCulled=false;group.add(mesh);group.updateMatrixWorld(true);mesh.bind(skeleton,new T.Matrix4());}
    let clipName='',age=0;const prev=bones.map(b=>({q:b.quaternion.clone(),s:b.scale.clone()}));
    function pose(name,dt,rate=1,reset=false){const c=a.clips[name]||a.clips.Idle;if(clipName!==name||reset){clipName=name;age=0;bones.forEach((b,i)=>{prev[i].q.copy(b.quaternion);prev[i].s.copy(b.scale)})}age+=dt*rate;const looping=name==='Idle'||name==='Walk',t=looping?age%c.duration:Math.min(age,c.duration),blend=Math.min(1,age/.085);for(const b of bones)b.scale.set(1,1,1);
      for(const tr of c.tracks){const b=bones[tr.i],ts=tr.times;let j=0;while(j+1<ts.length-1&&t>ts[j+1])j++;const k=Math.min(j+1,ts.length-1),f=Math.max(0,Math.min(1,(t-ts[j])/(ts[k]-ts[j]||1)));if(tr.path==='rotation'){q0.fromArray(tr.values,j*4);q1.fromArray(tr.values,k*4);q0.slerp(q1,f);b.quaternion.copy(prev[tr.i].q).slerp(q0,blend)}else{const i=j*3,o=k*3;vq.set(tr.values[i]*(1-f)+tr.values[o]*f,tr.values[i+1]*(1-f)+tr.values[o+1]*f,tr.values[i+2]*(1-f)+tr.values[o+2]*f);b.scale.copy(prev[tr.i].s).lerp(vq,blend)}}
    }
    return {group,pose,skeleton,dispose(){if(typeof skeleton.dispose==='function')skeleton.dispose();else if(skeleton.boneTexture)skeleton.boneTexture.dispose()}};
  }
  function stats(){return Object.fromEntries([...cache].map(([id,a])=>[id,{triangles:a.parts.reduce((s,p)=>s+p.triangles,0),bones:a.nodes.length,clips:Object.keys(a.clips)}]))}
  return {preload,instantiate,stats};
})():null;
