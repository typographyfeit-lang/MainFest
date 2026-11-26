'use strict';
// Shared geometry/material library. All dimensions are simulation world units.
const ArenaArt3D = window.THREE ? (() => {
  const T=THREE, TAU=Math.PI*2;
  const C={stone:'#93818b',dark:'#55475d',gold:'#eeb15b',goldEdge:'#ffdc91',wood:'#ae744c',
    team:['#24d9ff','#bd42ff'],cloth:['#117c99','#7434a8'],trim:['#0e536e','#4e2078']};
  function rng(seed=20261126){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}
  const random=rng();
  function texture(w,h,draw,repeat=false){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t}
  const stoneTex=texture(128,128,(g,w,h)=>{const r=rng(11);g.fillStyle='#e8dfdf';g.fillRect(0,0,w,h);for(let i=0;i<1500;i++){g.fillStyle=r()<.52?'rgba(80,57,86,.045)':'rgba(255,255,255,.10)';g.fillRect(r()*w,r()*h,1+r()*7,1+r()*3)}for(let i=0;i<9;i++){g.strokeStyle='#7c687219';g.lineWidth=.7;const x=r()*w,y=r()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+5+r()*8,y+2-r()*4);g.lineTo(x+13+r()*8,y+5);g.stroke()}},true);
  const woodTex=texture(128,128,(g,w,h)=>{const r=rng(57);g.fillStyle='#d9b296';g.fillRect(0,0,w,h);for(let i=0;i<60;i++){g.strokeStyle=i%4?'#68422627':'#fff0c644';g.lineWidth=.3+r()*1.6;let y=r()*h;g.beginPath();g.moveTo(0,y);for(let x=0;x<=w;x+=8)g.lineTo(x,y+Math.sin(x*.045+i)*2.2);g.stroke()}},true);
  const glowTex=texture(64,64,(g,w,h)=>{const a=g.createRadialGradient(32,32,0,32,32,32);a.addColorStop(0,'rgba(255,255,255,.82)');a.addColorStop(.23,'rgba(255,255,255,.5)');a.addColorStop(.6,'rgba(255,255,255,.14)');a.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=a;g.fillRect(0,0,w,h)});
  const shadowTex=texture(64,64,(g)=>{const a=g.createRadialGradient(32,32,3,32,32,32);a.addColorStop(0,'rgba(21,11,30,.7)');a.addColorStop(.55,'rgba(21,11,30,.37)');a.addColorStop(1,'rgba(21,11,30,0)');g.fillStyle=a;g.fillRect(0,0,64,64)});
  const mats=new Map();
  function material(color,kind='stone'){
    const key=kind+':'+color;if(mats.has(key))return mats.get(key);
    const o={color,roughness:.85,metalness:0};
    if(kind==='stone')o.map=stoneTex;
    if(kind==='wood'){o.map=woodTex;o.roughness=.8}
    if(kind==='gold'){o.roughness=.38;o.metalness=.35}
    if(kind==='cloth'){o.roughness=.95;o.side=T.DoubleSide}
    if(kind==='glow'){o.emissive=new T.Color(color);o.emissiveIntensity=.95;o.roughness=.45}
    if(kind==='skin'){o.roughness=.65}
    const m=kind==='flat'?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial(o);mats.set(key,m);return m;
  }
  const stone=material('#ffffff');const gold=material(C.gold,'gold'),goldLight=material(C.goldEdge,'gold');
  const G={box:new T.BoxGeometry(1,1,1), sphere:new T.SphereGeometry(1,10,6),leaf:new T.SphereGeometry(1,7,4), cyl:new T.CylinderGeometry(1,1,1,16),cone:new T.ConeGeometry(1,1,12), oct:new T.OctahedronGeometry(1,0),plane:new T.PlaneGeometry(1,1), disk:new T.CylinderGeometry(1,1,1,32), torus:new T.TorusGeometry(1,.09,5,40)};
  // Beveled, low-poly cubic geometry, shared by stone masonry and props.
  const s=new T.Shape();s.moveTo(-.43,-.43);s.lineTo(.43,-.43);s.lineTo(.43,.43);s.lineTo(-.43,.43);s.closePath();
  G.bevel=new T.ExtrudeGeometry(s,{depth:.86,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.07,bevelThickness:.07,curveSegments:1});G.bevel.translate(0,0,-.43);G.bevel.computeVertexNormals();
  const temp=new T.Object3D(),tmpColor=new T.Color();
  function batch(parent){const groups=new Map();return {
    add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,color=null,shadow=true){const k=geo.uuid+'|'+mat.uuid+'|'+shadow;let g=groups.get(k);if(!g){g={geo,mat,shadow,list:[]};groups.set(k,g)}temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(sx,sy,sz);temp.updateMatrix();g.list.push({matrix:temp.matrix.clone(),color});},
    flush(){for(const g of groups.values()){const m=new T.InstancedMesh(g.geo,g.mat,g.list.length);for(let i=0;i<g.list.length;i++){const p=g.list[i];m.setMatrixAt(i,p.matrix);if(p.color!==null)m.setColorAt(i,tmpColor.set(p.color))}m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.castShadow=g.shadow;m.receiveShadow=true;m.frustumCulled=false;parent.add(m)}groups.clear();}
  }}
  const mergedModels=new Map(),litModel=new T.MeshStandardMaterial({vertexColors:true,roughness:.77,metalness:.04}),brightModel=new T.MeshBasicMaterial({vertexColors:true});
  function modelBatch(parent,cacheKey){const list=[];return {add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,color=null,shadow=true){temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(sx,sy,sz);temp.updateMatrix();list.push({geo,mat,matrix:temp.matrix.clone(),color,shadow})},flush(){let cached=mergedModels.get(cacheKey);if(!cached){cached=[];for(const bright of [false,true]){const pos=[],nor=[],col=[],v=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3();for(const p of list){const isBright=!!p.mat.emissive&&p.mat.emissiveIntensity>.5&&p.mat.emissive.getHex()!==0;if(isBright!==bright)continue;const a=p.geo.attributes.position,b=p.geo.attributes.normal,ix=p.geo.index,count=ix?ix.count:a.count;const color=p.color!==null?new T.Color(p.color):p.mat.color;nm.getNormalMatrix(p.matrix);for(let j=0;j<count;j++){const k=ix?ix.getX(j):j;v.fromBufferAttribute(a,k).applyMatrix4(p.matrix);n.fromBufferAttribute(b,k).applyMatrix3(nm).normalize();pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);col.push(color.r,color.g,color.b)}}if(pos.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeBoundingSphere();cached.push({g,bright})}}mergedModels.set(cacheKey,cached)}for(const p of cached){const m=new T.Mesh(p.g,p.bright?brightModel:litModel);m.castShadow=!p.bright;m.receiveShadow=!p.bright;parent.add(m)}list.length=0}}}
  function mesh(parent,geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,shadow=true){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m}
  function glow(parent,color,x,y,z,size,opacity=.45){const m=new T.Sprite(new T.SpriteMaterial({map:glowTex,color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending}));m.position.set(x,y,z);m.scale.set(size,size,1);parent.add(m);return m}
  function contact(parent,x,z,w,d,y=.12){const m=mesh(parent,G.plane,new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),x,y,z,w,d,1,-Math.PI/2,0,0,false);m.userData.ownedMaterial=true;return m}
  function crystal(parent,team,x,y,z,width,height,halo=true){const root=new T.Group();root.position.set(x,y,z);parent.add(root);const n=6,pos=[],colors=[];const top=[0,height*.52,0],bottom=[0,-height*.48,0];const a=[],b=[];for(let i=0;i<n;i++){const q=i*TAU/n+Math.PI/6;a.push([Math.cos(q)*width*.48,height*.09,Math.sin(q)*width*.48]);b.push([Math.cos(q)*width*.34,-height*.19,Math.sin(q)*width*.34])}
    const base=new T.Color(C.team[team]);function tri(p,q,r,shade){pos.push(...p,...q,...r);const c=base.clone().lerp(new T.Color('#ffffff'),shade);for(let j=0;j<3;j++)colors.push(c.r,c.g,c.b)}
    for(let i=0;i<n;i++){const j=(i+1)%n;tri(top,a[j],a[i],.25+(i%3)*.12);tri(a[i],a[j],b[i],.08+(i%3)*.08);tri(a[j],b[j],b[i],.14);tri(bottom,b[i],b[j],.12+(i%2)*.15)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.23,metalness:.1,emissive:C.team[team],emissiveIntensity:.45,flatShading:true});const body=mesh(root,geo,mat,0,0,0);body.userData.ownedGeometry=true;body.userData.ownedMaterial=true;const e=new T.LineSegments(new T.EdgesGeometry(geo,17),new T.LineBasicMaterial({color:team?'#f2bcff':'#c4fbff',transparent:true,opacity:.8}));e.userData.ownedGeometry=true;e.userData.ownedMaterial=true;root.add(e);if(halo)glow(root,C.team[team],0,0,0,Math.max(width,height)*2.1,.42);return {root,body,baseY:y};
  }
  function symbol(ctx,x,y,r,team,fill='#ffcf6c'){ctx.strokeStyle=fill;ctx.lineWidth=r*.15;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-r*.48);ctx.lineTo(x+r*.48,y);ctx.lineTo(x,y+r*.48);ctx.lineTo(x-r*.48,y);ctx.closePath();ctx.stroke();if(!team){for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*1.12);ctx.lineTo(x+Math.cos(a)*r*1.35,y+Math.sin(a)*r*1.35);ctx.stroke()}}}
  const bannerMats=[0,1].map(team=>new T.MeshStandardMaterial({map:texture(128,192,(g,w,h)=>{g.beginPath();g.moveTo(4,0);g.lineTo(124,0);g.lineTo(124,178);g.lineTo(94,160);g.lineTo(64,191);g.lineTo(34,160);g.lineTo(4,178);g.closePath();g.fillStyle=C.cloth[team];g.fill();g.strokeStyle='#eeb350';g.lineWidth=9;g.stroke();g.save();g.clip();const a=g.createLinearGradient(0,0,128,0);a.addColorStop(0,'#0003');a.addColorStop(.43,'#ffffff13');a.addColorStop(1,'#0003');g.fillStyle=a;g.fillRect(0,0,w,h);g.restore();symbol(g,64,83,26,team)}),transparent:true,alphaTest:.45,side:T.DoubleSide,roughness:.96}));
  const bannerGeo=new T.PlaneGeometry(1,1,1,8);
  function banner(parent,team,x,y,z,w,h){const geo=bannerGeo.clone(),m=mesh(parent,geo,bannerMats[team],x,y,z,w,h,1,0,0,0,true);m.userData.banner=true;return m}
  function waveBanner(m,t){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i);p.setZ(i,Math.sin(t*2.4+y*7+x)*1.0*(.5-y))}p.needsUpdate=true;}
  function health(parent,team,width,y){const root=new T.Group();root.position.y=y;parent.add(root);const bm=new T.MeshBasicMaterial({color:'#1c1425',depthTest:false,depthWrite:false}),fm=new T.MeshBasicMaterial({color:C.team[team],depthTest:false,depthWrite:false});const bg=mesh(root,G.plane,bm,0,0,0,width+2,4.6,1,0,0,0,false);const fill=mesh(root,G.plane,fm,0,0,.05,width,2.7,1,0,0,0,false);bg.userData.ownedMaterial=true;fill.userData.ownedMaterial=true;bg.renderOrder=20;fill.renderOrder=21;return {root,fill,width}}
  function updateHealth(hp,ratio,cam,visible=true){const a=Math.max(0,Math.min(1,ratio));hp.fill.scale.x=Math.max(.001,a*hp.width);hp.fill.position.x=(a-1)*hp.width/2;hp.root.quaternion.copy(cam.quaternion);hp.root.visible=visible;}
  // Dispose only unique per-model resources. Shared library assets remain alive.
  function disposeTree(root){root.traverse(o=>{if(o.userData.banner)o.geometry.dispose();if(o.isSprite)o.material.dispose();if(o.isInstancedMesh&&typeof o.dispose==='function')o.dispose();if(o.userData.ownedGeometry&&o.geometry)o.geometry.dispose();if(o.userData.ownedMaterial&&o.material)o.material.dispose()})}
  return {T,TAU,C,G,material,stone,gold,goldLight,batch,modelBatch,mesh,glow,crystal,contact,banner,waveBanner,health,updateHealth,texture,rng,random,symbol,disposeTree};
})():null;
