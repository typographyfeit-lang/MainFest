'use strict';
// Shared geometry/material library. All dimensions are simulation world units.
const ArenaArt3D = window.THREE ? (() => {
  const T=THREE, TAU=Math.PI*2;
  // r128 does not automatically convert authored CSS/hex colors to linear.
  const lin=c=>new T.Color(c).convertSRGBToLinear();
  const req=new URLSearchParams(location.search).get('quality');const tier=['low','medium','high'].includes(req)?req:'medium';
  const C={stone:'#93818b',dark:'#55475d',gold:'#eeb15b',goldEdge:'#ffdc91',wood:'#ae744c',
    team:['#16cfff','#a637f5'],cloth:['#096584','#65249d'],trim:['#06384b','#36134f']};
  function rng(seed=20261126){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}}
  const random=rng();
  function texture(w,h,draw,repeat=false){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t}
  // Crystal Sanctuary 2.1 — procedural texture pack, generated once at startup.
  // Periodic value noise avoids seams; albedo is sRGB, relief/roughness are linear data.
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  function noise(seed,period){
    const r=rng(seed),grid=Float32Array.from({length:period*period},()=>r());
    const at=(x,y)=>grid[((y%period+period)%period)*period+(x%period+period)%period];
    return (u,v)=>{const x=u*period,y=v*period,ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);return mix(mix(at(ix,iy),at(ix+1,iy),fx),mix(at(ix,iy+1),at(ix+1,iy+1),fx),fy)};
  }
  const field=(seed,periods,weights)=>{const ns=periods.map((p,i)=>noise(seed+i*719,p));return (u,v)=>ns.reduce((s,n,i)=>s+n(u,v)*weights[i],0)};
  function mapData(w,h,draw,repeat=true){const t=texture(w,h,draw,repeat);t.encoding=T.LinearEncoding;return t}
  function pixels(g,w,h,fn){const im=g.createImageData(w,h),d=im.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=fn(x/w,y/h,x,y),i=(y*w+x)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255}g.putImageData(im,0,0)}
  const mono=n=>[n,n,n];
  function stroke(g,pts,color,width){g.beginPath();g.moveTo(...pts[0]);for(const p of pts.slice(1))g.lineTo(...p);g.lineWidth=width;g.lineJoin='round';g.lineCap='round';g.strokeStyle=color;g.stroke()}
  const stoneNoise=field(129,[3,9,27,64],[.42,.30,.18,.10]),fineStone=field(201,[17,53,97],[.45,.35,.20]);
  const stoneCracks=[[[26,76],[40,82],[48,97],[67,104],[72,114]],[[174,157],[163,166],[166,180],[153,191]],[[104,29],[111,38],[124,41]],[[224,219],[212,213],[205,198]]];
  function paintStone(g,w,h,mode){
    pixels(g,w,h,(u,v)=>{const n=stoneNoise(u,v),f=fineStone(u,v),edge=Math.min(u,1-u,v,1-v),rim=clamp(edge*23),pit=clamp((.32-f)*3);if(mode==='height')return mono(122+57*(n-.5)+31*(f-.5)-22*pit);if(mode==='rough')return mono(clamp(.84+(f-.5)*.24+pit*.09)*255);const k=218+45*(n-.5)+22*(f-.5)-9*pit-7*(1-rim);return [k+3,k-1,k+5]});
    if(mode==='rough')return;
    const r=rng(202);for(let i=0;i<100;i++){const x=7+r()*(w-14),y=7+r()*(h-14),rx=.8+r()*2.7,ry=.55+r()*1.5;g.beginPath();g.ellipse(x,y,rx,ry,r()*TAU,0,TAU);g.fillStyle=mode==='height'?'#77777766':'#5d4c5921';g.fill();g.beginPath();g.ellipse(x+.8,y+.8,rx*.75,ry*.65,0,0,TAU);g.fillStyle=mode==='height'?'#b4b4b438':'#fff8ef26';g.fill()}
    for(const p of stoneCracks){const scale=w/256,pts=p.map(([x,y])=>[x*scale,y*scale]);stroke(g,pts.map(([x,y])=>[x+.7,y+.8]),mode==='height'?'#bcbcbc88':'#fff7f340',1.15*scale);stroke(g,pts,mode==='height'?'#565656aa':'#58434d58',.95*scale);const k=pts[2];if(k)stroke(g,[k,[k[0]-4*scale,k[1]+6*scale],[k[0]-8*scale,k[1]+7*scale]],mode==='height'?'#68686888':'#6854614d',.65*scale)}
  }
  const stoneTex=texture(256,256,(g,w,h)=>paintStone(g,w,h,'color'),true);
  const stoneBump=mapData(256,256,(g,w,h)=>paintStone(g,w,h,'height'));
  const stoneRough=mapData(128,128,(g,w,h)=>paintStone(g,w,h,'rough'));
  const woodNoise=field(57,[3,12,38],[.45,.35,.20]),grainNoise=field(642,[4,19,51],[.53,.30,.17]);
  function paintWood(g,w,h,mode){
    pixels(g,w,h,(u,v)=>{const n=woodNoise(u,v),gr=grainNoise(u*.4,v),warp=Math.sin(u*TAU)*.045+Math.sin(u*TAU*2)*.013;
      const k1=Math.hypot((u-.34)*.65,(v-.38)*1.4),k2=Math.hypot((u-.78)*.58,(v-.72)*1.5);
      const knots=.05*Math.exp(-k1*11)-.047*Math.exp(-k2*12),p=v+warp+knots;
      const grain=Math.sin(p*TAU*23+gr*2.8)*.55+Math.sin(p*TAU*57+gr*4)*.23;
      const knot=clamp((.10-Math.min(k1,k2))/.10);if(mode==='height')return mono(139+grain*32+(n-.5)*40-knot*40);if(mode==='rough')return mono(clamp(.79-grain*.07+(n-.5)*.20)*255);const l=207+grain*20+(n-.5)*30-knot*23;return [l+17,l+5,l-7]});
    if(mode==='rough')return;const r=rng(873);for(let i=0;i<43;i++){const y=r()*h,x=r()*w,len=10+r()*48;const p=[];for(let j=0;j<=5;j++)p.push([x+j*len/5,y+Math.sin(j*.7+i)*2.2]);stroke(g,p,mode==='height'?'#77777770':i%3?'#76513c44':'#fff1c541',.65+r()*.6)}
    // A subtle knot, not a painted plank seam; each mesh is already an individual plank.
    for(const [u,v] of [[.34,.38],[.78,.72]])for(let i=0;i<3;i++){g.beginPath();g.ellipse(w*u,h*v,5+i*4,2+i*2,-.10,0,TAU);g.strokeStyle=mode==='height'?'#85858588':'#79513b55';g.lineWidth=1;g.stroke()}
  }
  const woodTex=texture(256,256,(g,w,h)=>paintWood(g,w,h,'color'),true);
  const woodBump=mapData(256,256,(g,w,h)=>paintWood(g,w,h,'height'));
  const woodRough=mapData(128,128,(g,w,h)=>paintWood(g,w,h,'rough'));
  const clothNoise=field(741,[5,16,48],[.50,.34,.16]);
  function paintCloth(g,w,h,mode){pixels(g,w,h,(u,v)=>{const n=clothNoise(u,v),a=Math.cos(u*TAU*32),b=Math.cos(v*TAU*32),weave=(a+b)*.5;if(mode==='height')return mono(139+weave*21+(n-.5)*21);const k=231+(n-.5)*23+weave*7;return [k,k,k]})}
  const clothTex=texture(128,128,(g,w,h)=>paintCloth(g,w,h,'color'),true);
  const clothBump=mapData(128,128,(g,w,h)=>paintCloth(g,w,h,'height'));
  const metalNoise=field(717,[3,11,37],[.47,.33,.20]);
  function paintGold(g,w,h,mode){pixels(g,w,h,(u,v)=>{const n=metalNoise(u,v),b=Math.sin(u*TAU*42+Math.sin(v*TAU)*.8);if(mode==='rough')return mono(clamp(.37+(n-.5)*.29+b*.025)*255);const k=229+(n-.5)*27+b*4;return [k+5,k+1,k-6]});if(mode==='color'){const r=rng(15);for(let i=0;i<23;i++){const x=r()*w,y=r()*h;stroke(g,[[x,y],[x+2+r()*9,y+.4]],i%4?'#8c67391b':'#fff5ca38',.65)}}}
  const goldTex=texture(128,128,(g,w,h)=>paintGold(g,w,h,'color'),true);
  const goldRough=mapData(128,128,(g,w,h)=>paintGold(g,w,h,'rough'));
  const detailTex=texture(128,128,(g,w,h)=>{const n=field(919,[5,21,53],[.45,.32,.23]);pixels(g,w,h,(u,v)=>mono(235+(n(u,v)-.5)*30))},true);
  const glowTex=texture(64,64,(g,w,h)=>{const a=g.createRadialGradient(32,32,0,32,32,32);a.addColorStop(0,'rgba(255,255,255,.82)');a.addColorStop(.23,'rgba(255,255,255,.5)');a.addColorStop(.6,'rgba(255,255,255,.14)');a.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=a;g.fillRect(0,0,w,h)});
  const shadowTex=texture(64,64,(g)=>{const a=g.createRadialGradient(32,32,3,32,32,32);a.addColorStop(0,'rgba(21,11,30,.7)');a.addColorStop(.55,'rgba(21,11,30,.37)');a.addColorStop(1,'rgba(21,11,30,0)');g.fillStyle=a;g.fillRect(0,0,64,64)});
  const mats=new Map();
  function material(color,kind='stone'){
    const key=kind+':'+color;if(mats.has(key))return mats.get(key);
    const o={color:lin(color),roughness:.85,metalness:0};
    if(kind==='stone'){o.map=stoneTex;o.bumpMap=stoneBump;o.bumpScale=.72;o.roughnessMap=stoneRough;o.roughness=1}
    if(kind==='wood'){o.map=woodTex;o.bumpMap=woodBump;o.bumpScale=.48;o.roughnessMap=woodRough;o.roughness=1}
    if(kind==='gold'){o.map=goldTex;o.roughnessMap=goldRough;o.roughness=1;o.metalness=.24}
    if(kind==='cloth'){o.map=clothTex;o.bumpMap=clothBump;o.bumpScale=.22;o.roughness=.95;o.side=T.DoubleSide}
    if(kind==='glow'){o.emissive=lin(color);o.emissiveIntensity=.58;o.roughness=.45}
    if(kind==='skin'){o.roughness=.65}
    if(tier==='low'){delete o.bumpMap;delete o.roughnessMap;if(kind==='stone')o.roughness=.85;if(kind==='wood')o.roughness=.80;if(kind==='gold')o.roughness=.43}
    const m=kind==='flat'?new T.MeshBasicMaterial({color:lin(color),toneMapped:false}):new T.MeshStandardMaterial(o);mats.set(key,m);return m;
  }
  const stone=material('#ffffff');const gold=material(C.gold,'gold'),goldLight=material(C.goldEdge,'gold');
  const G={box:new T.BoxGeometry(1,1,1), sphere:new T.SphereGeometry(1,tier==='low'?10:14,tier==='low'?6:9),leaf:new T.SphereGeometry(1,7,4), cyl:new T.CylinderGeometry(1,1,1,16),cone:new T.ConeGeometry(1,1,12), oct:new T.OctahedronGeometry(1,0),plane:new T.PlaneGeometry(1,1), disk:new T.CylinderGeometry(1,1,1,32), torus:new T.TorusGeometry(1,.09,5,40)};
  // Beveled, low-poly cubic geometry, shared by stone masonry and props.
  const s=new T.Shape();s.moveTo(-.43,-.43);s.lineTo(.43,-.43);s.lineTo(.43,.43);s.lineTo(-.43,.43);s.closePath();
  G.bevel=new T.ExtrudeGeometry(s,{depth:.86,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.07,bevelThickness:.07,curveSegments:1});G.bevel.translate(0,0,-.43);G.bevel.computeVertexNormals();
  // Stable face-local UVs keep stone grain and horizontal wood grain readable.
  {const p=G.bevel.attributes.position,n=G.bevel.attributes.normal,uv=G.bevel.attributes.uv;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
      if(ay>=ax&&ay>=az)uv.setXY(i,x+.5,z+.5);else if(az>=ax)uv.setXY(i,x+.5,y+.5);else uv.setXY(i,z+.5,y+.5)}uv.needsUpdate=true;}

  // Authored reusable meshes; no external models or additional loader dependency.
  const shapeExtrude=(points,depth=.18,bevel=.045)=>{const a=new T.Shape();a.moveTo(...points[0]);for(const q of points.slice(1))a.lineTo(...q);a.closePath();const g=new T.ExtrudeGeometry(a,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:6});g.translate(0,0,-depth/2);g.computeVertexNormals();return g};
  G.shield=shapeExtrude([[-.46,.47],[.46,.47],[.47,.08],[.34,-.24],[0,-.54],[-.34,-.24],[-.47,.08]]);
  G.arch=shapeExtrude([[-.46,-.5],[.46,-.5],[.46,.17],[.36,.33],[.19,.44],[0,.51],[-.19,.44],[-.36,.33],[-.46,.17]],.12,.025);
  G.hood=new T.LatheGeometry([[0,-.50],[.55,-.42],[.86,-.17],[1,.15],[.82,.48],[.49,.72],[.22,.94],[.05,1.02]].map(p=>new T.Vector2(...p)),16);
  G.gem=new T.IcosahedronGeometry(1,0);G.ring=new T.TorusGeometry(1,.055,6,32);
  const temp=new T.Object3D(),tmpColor=new T.Color();
  function batch(parent){const groups=new Map();return {
    add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,color=null,shadow=true){const k=geo.uuid+'|'+mat.uuid+'|'+shadow;let g=groups.get(k);if(!g){g={geo,mat,shadow,list:[]};groups.set(k,g)}temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(sx,sy,sz);temp.updateMatrix();g.list.push({matrix:temp.matrix.clone(),color});},
    flush(){for(const g of groups.values()){const m=new T.InstancedMesh(g.geo,g.mat,g.list.length),hasColors=g.list.some(p=>p.color!==null);for(let i=0;i<g.list.length;i++){const p=g.list[i];m.setMatrixAt(i,p.matrix);if(hasColors)m.setColorAt(i,tmpColor.set(p.color===null?'#ffffff':p.color).convertSRGBToLinear())}m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.castShadow=g.shadow;m.receiveShadow=true;m.frustumCulled=false;parent.add(m)}groups.clear();}
  }}
  // Merge each articulated component by material family; retain UVs for PBR maps.
  const mergedModels=new Map(),familyMaterials=new Map();
  function family(mat){const bright=!!mat.emissive&&mat.emissiveIntensity>.5&&mat.emissive.getHex()!==0;return bright?'emissive':tier!=='high'?'skin':mat.map===stoneTex?'stone':mat.map===woodTex?'wood':mat.map===goldTex?'metal':mat.map===clothTex?'cloth':'skin'}
  function familyMaterial(k){if(familyMaterials.has(k))return familyMaterials.get(k);let m;if(k==='emissive')m=new T.MeshBasicMaterial({vertexColors:true,toneMapped:false});else{const o={vertexColors:true,roughness:.78,metalness:0};if(k==='stone'){o.map=stoneTex;o.bumpMap=stoneBump;o.bumpScale=.35}if(k==='wood'){o.map=woodTex;o.bumpMap=woodBump;o.bumpScale=.23}if(k==='metal'){o.map=goldTex;o.roughness=.46;o.metalness=.20}if(k==='cloth'){o.map=clothTex;o.roughness=.95}if(k==='skin')o.map=detailTex;if(tier==='low'){delete o.bumpMap;delete o.roughnessMap;}m=new T.MeshStandardMaterial(o)}familyMaterials.set(k,m);return m}
  function modelBatch(parent,cacheKey){const list=[];return {add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,color=null,shadow=true){temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(sx,sy,sz);temp.updateMatrix();list.push({geo,mat,matrix:temp.matrix.clone(),color,shadow})},flush(){let cached=mergedModels.get(cacheKey);if(!cached){cached=[];for(const k of ['emissive','stone','wood','metal','cloth','skin']){const pos=[],nor=[],col=[],uv=[],v=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3();for(const p of list){if(family(p.mat)!==k)continue;const a=p.geo.attributes.position,b=p.geo.attributes.normal,tex=p.geo.attributes.uv,ix=p.geo.index,count=ix?ix.count:a.count;const color=p.color!==null?lin(p.color):p.mat.color;nm.getNormalMatrix(p.matrix);for(let j=0;j<count;j++){const i=ix?ix.getX(j):j;v.fromBufferAttribute(a,i).applyMatrix4(p.matrix);n.fromBufferAttribute(b,i).applyMatrix3(nm).normalize();pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);col.push(color.r,color.g,color.b);uv.push(tex?tex.getX(i):0,tex?tex.getY(i):0)}}if(pos.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeBoundingSphere();cached.push({g,k})}}mergedModels.set(cacheKey,cached)}for(const p of cached){const m=new T.Mesh(p.g,familyMaterial(p.k));m.castShadow=p.k!=='emissive';m.receiveShadow=p.k!=='emissive';parent.add(m)}list.length=0}}}
  function mesh(parent,geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,shadow=true){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m}
  function glow(parent,color,x,y,z,size,opacity=.45){const m=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:lin(color),transparent:true,opacity:opacity*.60,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));m.position.set(x,y,z);m.scale.set(size,size,1);parent.add(m);return m}
  function lightPool(parent,color,x,z,w,d,opacity=.17,y=.18){const m=mesh(parent,G.plane,new T.MeshBasicMaterial({map:glowTex,color:lin(color),transparent:true,opacity,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2}),x,y,z,w,d,1,-Math.PI/2,0,0,false);m.userData.ownedMaterial=true;return m}
  function contact(parent,x,z,w,d,y=.12){const m=mesh(parent,G.plane,new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),x,y,z,w,d,1,-Math.PI/2,0,0,false);m.userData.ownedMaterial=true;return m}
  function crystal(parent,team,x,y,z,width,height,halo=true){const root=new T.Group();root.position.set(x,y,z);parent.add(root);const n=6,pos=[],colors=[];const top=[0,height*.52,0],bottom=[0,-height*.48,0];const a=[],b=[];for(let i=0;i<n;i++){const q=i*TAU/n+Math.PI/6;a.push([Math.cos(q)*width*.48,height*.09,Math.sin(q)*width*.48]);b.push([Math.cos(q)*width*.34,-height*.19,Math.sin(q)*width*.34])}
    const base=lin(C.team[team]),deep=lin(team?'#55128b':'#05749f'),light=lin(team?'#e8a4ff':'#8ff5ff');function tri(p,q,r,shade){pos.push(...p,...q,...r);const c=shade<.25?deep.clone().lerp(base,shade/.25):base.clone().lerp(light,(shade-.25)/.5);for(let j=0;j<3;j++)colors.push(c.r,c.g,c.b)}
    for(let i=0;i<n;i++){const j=(i+1)%n;tri(top,a[j],a[i],.24+(i%3)*.16);tri(a[i],a[j],b[i],.06+(i%3)*.10);tri(a[j],b[j],b[i],.13+(i%2)*.16);tri(bottom,b[i],b[j],.17+(i%2)*.20)}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.23,metalness:.1,emissive:lin(C.team[team]),emissiveIntensity:.19,flatShading:true});const body=mesh(root,geo,mat,0,0,0);body.userData.ownedGeometry=true;body.userData.ownedMaterial=true;const e=new T.LineSegments(new T.EdgesGeometry(geo,17),new T.LineBasicMaterial({color:lin(team?'#f2bcff':'#c4fbff'),transparent:true,opacity:.55,toneMapped:false}));e.userData.ownedGeometry=true;e.userData.ownedMaterial=true;root.add(e);if(halo)glow(root,C.team[team],0,0,0,Math.max(width,height)*1.65,.35);return {root,body,baseY:y};
  }
  function symbol(ctx,x,y,r,team,fill='#ffcf6c'){ctx.strokeStyle=fill;ctx.lineWidth=r*.15;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-r*.48);ctx.lineTo(x+r*.48,y);ctx.lineTo(x,y+r*.48);ctx.lineTo(x-r*.48,y);ctx.closePath();ctx.stroke();if(!team){for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*1.12);ctx.lineTo(x+Math.cos(a)*r*1.35,y+Math.sin(a)*r*1.35);ctx.stroke()}}}
  const bannerMats=[0,1].map(team=>new T.MeshStandardMaterial({map:texture(256,384,(g,w,h)=>{
    g.scale(2,2);g.beginPath();g.moveTo(4,0);g.lineTo(124,0);g.lineTo(124,178);g.lineTo(94,160);g.lineTo(64,191);g.lineTo(34,160);g.lineTo(4,178);g.closePath();
    const p=new Path2D();p.moveTo(4,0);p.lineTo(124,0);p.lineTo(124,178);p.lineTo(94,160);p.lineTo(64,191);p.lineTo(34,160);p.lineTo(4,178);p.closePath();
    g.fillStyle=C.cloth[team];g.fill(p);g.save();g.clip(p);
    const a=g.createLinearGradient(4,0,124,0);a.addColorStop(0,'#0007');a.addColorStop(.18,'#fff2');a.addColorStop(.37,'#0003');a.addColorStop(.55,'#fff2');a.addColorStop(.8,'#0003');a.addColorStop(1,'#0007');g.fillStyle=a;g.fillRect(0,0,128,192);
    const r=rng(120+team);for(let y=0;y<192;y+=1.4){g.fillStyle=y%3<1?'#00000014':'#ffffff0d';g.fillRect(0,y,128,.45)}for(let x=0;x<128;x+=1.5){g.fillStyle=x%3<1?'#ffffff12':'#0000000b';g.fillRect(x,0,.45,192)}
    for(let i=0;i<140;i++){g.fillStyle=i%4?'#ffffff0c':'#00000014';g.fillRect(r()*128,r()*192,1+r()*3,.65)}
    g.strokeStyle='#805025';g.lineWidth=11;g.stroke(p);g.strokeStyle='#f6b94e';g.lineWidth=8;g.stroke(p);g.strokeStyle='#ffdf91';g.lineWidth=2;g.stroke(p);
    g.globalAlpha=.30;g.strokeStyle='#ffe1a2';g.lineWidth=.75;g.strokeRect(13,6,102,139);g.globalAlpha=1;
    symbol(g,64,85,26,team,'#805022');g.save();g.translate(-.5,-.8);symbol(g,64,85,26,team,'#ffd174');g.restore();g.restore();
  }),transparent:true,alphaTest:.42,side:T.DoubleSide,roughness:.96,bumpMap:clothBump,bumpScale:.18}));
  const bannerGeo=new T.PlaneGeometry(1,1,4,12);
  function banner(parent,team,x,y,z,w,h){const geo=bannerGeo.clone(),m=mesh(parent,geo,bannerMats[team],x,y,z,w,h,1,0,0,0,true);m.userData.banner=true;return m}
  function waveBanner(m,t){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i);p.setZ(i,(Math.sin(t*2.1+y*6+x*3)*.7+Math.cos(x*9)*.28)*(.5-y))}p.needsUpdate=true;}
  function health(parent,team,width,y){const root=new T.Group();root.position.y=y;parent.add(root);const bm=new T.MeshBasicMaterial({color:lin('#1c1425'),toneMapped:false,depthTest:false,depthWrite:false}),fm=new T.MeshBasicMaterial({color:lin(C.team[team]),toneMapped:false,depthTest:false,depthWrite:false});const bg=mesh(root,G.plane,bm,0,0,0,width+2,4.6,1,0,0,0,false);const fill=mesh(root,G.plane,fm,0,0,.05,width,2.7,1,0,0,0,false);bg.userData.ownedMaterial=true;fill.userData.ownedMaterial=true;bg.renderOrder=20;fill.renderOrder=21;return {root,fill,width}}
  function updateHealth(hp,ratio,cam,visible=true){const a=Math.max(0,Math.min(1,ratio));hp.fill.scale.x=Math.max(.001,a*hp.width);hp.fill.position.x=(a-1)*hp.width/2;hp.root.quaternion.copy(cam.quaternion);hp.root.visible=visible;}
  // Dispose only unique per-model resources. Shared library assets remain alive.
  function disposeTree(root){root.traverse(o=>{if(o.userData.banner)o.geometry.dispose();if(o.isSprite)o.material.dispose();if(o.isInstancedMesh&&typeof o.dispose==='function')o.dispose();if(o.userData.ownedGeometry&&o.geometry)o.geometry.dispose();if(o.userData.ownedMaterial&&o.material)o.material.dispose()})}
  return {T,TAU,C,G,lin,material,stone,gold,goldLight,batch,modelBatch,mesh,glow,crystal,contact,lightPool,banner,waveBanner,health,updateHealth,texture,rng,random,symbol,disposeTree,glowTex,shadowTex};
})():null;
