'use strict';
/* Crystal Dominion 3.4 — Visual Overhaul. Additive visual layer, no simulation edits.
 * Uses the existing binary loader, skeletons, adaptive renderer and sound system.
 * Original assets remain available as a rollback/fallback. */
(() => {
  if(typeof THREE==='undefined'||typeof ArenaArt3D==='undefined'||!ArenaArt3D||typeof ArenaEnvironment3D==='undefined'||!ArenaEnvironment3D)return;
  const T=THREE,A=ArenaArt3D,params=new URLSearchParams(location.search);
  const enabled=params.get('visual')!=='legacy', info={enabled,models:{},floor:false,removedPavers:0,stone:false,gold:false,shrine:false,lighting:false};
  window.CDVisual34={stats:()=>({...info,models:{...info.models}})};
  if(!enabled)return;
  // Versioned replacement assets, same decoder contract and unchanged animation data.
  if(typeof ArenaBinary!=='undefined'&&ArenaBinary){
    const load=ArenaBinary.load, replacements={'guard-unit':'guard-reforged-34','colossus-unit':'colossus-reforged-34','citadel-hd':'citadel-reforged-34'};
    ArenaBinary.load=async function(name){
      const replacement=replacements[name];if(!replacement)return load.call(this,name);
      try{const result=await load.call(this,replacement);info.models[name]='reforged';return result}
      catch(error){info.models[name]='legacy';console.warn('Visual 3.4 model fallback:',name,error.message);return load.call(this,name)}
    };
  }
  // All new textures are small, power-of-two, compressed WebP. Replace only color data,
  // keeping the existing material graph, bump/roughness maps, shadows and encoding.
  function image(path,apply){const img=new Image();img.onload=()=>{try{apply(img)}catch(e){console.warn('Visual 3.4 texture fallback:',path,e.message)}};img.onerror=()=>console.warn('Visual 3.4 texture unavailable:',path);img.src=path;return img}
  function replaceMap(map,path,key){if(!map)return;image(path,img=>{map.image=img;map.needsUpdate=true;info[key]=true})}
  replaceMap(A.stone.map,'stone-reforged-34.webp','stone');
  replaceMap(A.gold.map,'gold-reforged-34.webp','gold');
  // Do not increase the number of light sources, shadow-map sizes, or passes.
  const crystal=A.crystal;
  A.crystal=function(...args){const result=crystal.apply(this,args);const mat=result.body?.material;if(mat){mat.roughness=.29;mat.metalness=.13;mat.emissiveIntensity=.16}result.root?.traverse(o=>{if(o.isLineSegments&&o.material)o.material.opacity=.39});return result};
  let floorImage=null, pendingFloors=[];
  image('arena-floor-34.webp',img=>{floorImage=img;for(const f of pendingFloors.splice(0))f(img)});
  // Compact the original paver instances out of their batch, preserving any other masonry
  // sharing that same material. Only do this AFTER the replacement surface is ready.
  function floor(sceneRoot,img){
    const tex=new T.Texture(img);tex.encoding=T.sRGBEncoding;tex.anisotropy=4;tex.needsUpdate=true;
    const mat=new T.MeshStandardMaterial({map:tex,color:A.lin('#ffffff'),roughness:.87,metalness:0});
    const mesh=new T.Mesh(new T.PlaneGeometry(360,560),mat);mesh.name='Reforged stone mosaic';mesh.rotation.x=-Math.PI/2;mesh.position.set(180,.035,280);mesh.receiveShadow=true;mesh.castShadow=false;
    sceneRoot.add(mesh);info.floor=true;
    let removed=0;const tmp=new T.Matrix4(),color=new T.Color();
    // Exact source: the 20×32 pavers are centered at y=-1.6, x in (0,360), z in (0,560),
    // using G.bevel or G.box, A.stone and the non-shadow-casting instanced batch.
    sceneRoot.traverse(o=>{
      if(!o.isInstancedMesh||o.castShadow||o.material!==A.stone||(o.geometry!==A.G.bevel&&o.geometry!==A.G.box))return;
      let dest=0;const count=o.count;
      for(let i=0;i<count;i++){
        o.getMatrixAt(i,tmp);const e=tmp.elements,x=e[12],y=e[13],z=e[14];
        const paver=Math.abs(y+1.6)<.001&&x>0&&x<360&&z>0&&z<560;
        if(paver){removed++;continue}
        if(dest!==i){o.setMatrixAt(dest,tmp);if(o.instanceColor){o.getColorAt(i,color);o.setColorAt(dest,color)}}dest++;
      }
      if(dest!==count){o.count=dest;o.instanceMatrix.needsUpdate=true;if(o.instanceColor)o.instanceColor.needsUpdate=true;if(dest===0)o.visible=false}
    });
    // New surface is only 2 triangles. Original capture indicators remain above it.
    info.removedPavers+=removed;
  }
  function newFacetGeometry(){
    const vertices=[],colors=[],n=6;const ring=(radius,y,angle)=>Array.from({length:n},(_,i)=>[Math.cos(i*2*Math.PI/n+angle)*radius,y,Math.sin(i*2*Math.PI/n+angle)*radius]);
    const upper=ring(.84,.22,Math.PI/6),lower=ring(.63,-.42,Math.PI/6),top=[0,1,0],bottom=[0,-1,0];
    function tri(a,b,c,shade){const av=new T.Vector3(...a),bv=new T.Vector3(...b),cv=new T.Vector3(...c);const normal=bv.clone().sub(av).cross(cv.clone().sub(av));const out=av.clone().add(bv).add(cv);if(normal.dot(out)<0){const tmp=b;b=c;c=tmp}vertices.push(...a,...b,...c);for(let j=0;j<3;j++)colors.push(shade,shade,shade)}
    for(let i=0;i<n;i++){const j=(i+1)%n;tri(top,upper[i],upper[j],[.88,.55,.98,.71,.50,.86][i]);tri(upper[i],lower[i],upper[j],[.59,.82,.45,.90,.63,.75][i]);tri(upper[j],lower[i],lower[j],[.82,.52,.91,.60,.76,.49][i]);tri(bottom,lower[j],lower[i],.52+i*.045)}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  }
  function shrine(root){
    const seal=root.children.find(o=>o.isGroup&&Math.abs(o.position.x-180)<.01&&Math.abs(o.position.z-280)<.01);
    if(!seal)return;
    const crystal=seal.children.find(o=>o.isMesh&&o.geometry===A.G.oct&&o.position.y>20);
    if(crystal){crystal.geometry=newFacetGeometry();crystal.material.vertexColors=true;crystal.material.roughness=.28;crystal.material.metalness=.10;crystal.material.emissiveIntensity=.30;crystal.material.needsUpdate=true;crystal.name='Reforged shrine crystal';info.shrine=true}
    const disc=seal.children.find(o=>o.isMesh&&o.material?.map?.image?.getContext&&Math.abs(o.scale.x-108)<.01);
    if(!disc)return;
    // Repaint the old seal canvas; the original ownership ring, timer marks and 3.3.2
    // adaptive effects remain unchanged. One texture, no additional draw calls.
    const canvas=disc.material.map.image,g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.save();g.clearRect(0,0,w,h);g.scale(w/512,h/512);g.translate(256,256);
    const circle=(r,fill,stroke,lw=1)=>{g.beginPath();g.arc(0,0,r,0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.lineWidth=lw;g.strokeStyle=stroke;g.stroke()}};
    const poly=(n,r,angle=0)=>{g.beginPath();for(let j=0;j<n;j++){const a=angle+j*Math.PI*2/n;g[j?'lineTo':'moveTo'](Math.sin(a)*r,Math.cos(a)*r)}g.closePath()};
    const bg=g.createRadialGradient(0,0,15,0,0,248);bg.addColorStop(0,'#65546c');bg.addColorStop(.65,'#39384f');bg.addColorStop(1,'#252638');circle(245,bg,'#403247',7);circle(238,null,'#b58b56',6);circle(228,null,'#e9c589',2);circle(211,null,'#6e553f',3);circle(186,null,'#ba955d',3);circle(166,null,'#54465d',2);
    for(let j=0;j<12;j++){g.save();g.rotate(j*Math.PI/6);g.fillStyle='#b48b53';g.beginPath();g.moveTo(0,-224);g.lineTo(10,-216);g.lineTo(0,-208);g.lineTo(-10,-216);g.closePath();g.fill();g.strokeStyle='#d5b382';g.lineWidth=2;g.beginPath();g.moveTo(-15,-194);g.lineTo(0,-185);g.lineTo(15,-194);g.stroke();g.restore()}
    poly(6,150,Math.PI/6);g.strokeStyle='#967550';g.lineWidth=4;g.stroke();poly(6,121);g.strokeStyle='#d0aa6d';g.lineWidth=2;g.stroke();g.rotate(Math.PI/4);g.strokeStyle='#edc989';g.lineWidth=5;g.strokeRect(-53,-53,106,106);g.strokeStyle='#9b794b';g.lineWidth=2;g.strokeRect(-42,-42,84,84);g.restore();disc.material.map.needsUpdate=true;
  }
  const original=ArenaEnvironment3D.build;
  ArenaEnvironment3D.build=function(scene){
    const env=original.call(this,scene);if(!env?.root)return env;
    try{shrine(env.root)}catch(e){console.warn('Visual 3.4 shrine fallback:',e.message)}
    const apply=img=>{try{floor(env.root,img)}catch(e){console.warn('Visual 3.4 floor fallback:',e.message)}};
    if(floorImage)apply(floorImage);else pendingFloors.push(apply);
    const update=env.update;let lit=false;
    env.update=function(time,state){
      if(!lit){lit=true;const hemi=scene.children.find(o=>o.isHemisphereLight),directions=scene.children.filter(o=>o.isDirectionalLight);
        if(hemi){hemi.color.copy(A.lin('#e2d7f0'));hemi.groundColor.copy(A.lin('#74617e'));hemi.intensity=.70}
        if(directions[0]){directions[0].color.copy(A.lin('#ffe5bd'));directions[0].intensity=1.28}
        if(directions[1]){directions[1].color.copy(A.lin('#a9c9fc'));directions[1].intensity=.34}
        if(hemi||directions.length)info.lighting=true;
      }
      return update.call(this,time,state);
    };return env;
  };
})();
