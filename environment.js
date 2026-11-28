'use strict';
const ArenaEnvironment3D = ArenaArt3D ? (()=>{
  const A=ArenaArt3D,{T,G,C,TAU}=A;
  function build(scene){
    const tier=new URLSearchParams(location.search).get('quality');const low=tier==='low';const env=new T.Group();scene.add(env);const b=A.batch(env),r=A.rng(714),stone=A.stone;
    const choose=a=>a[Math.floor(r()*a.length)];
    const tiles=['#907287','#806780','#8d7687','#78677e','#9a8291','#6f5b75','#826d83','#795f79','#8e7485','#837086'];
    const wall=['#8c7489','#a38b91','#76637b','#b09a9b','#8d7587','#6a586f'];
    const moss=A.material('#768247','skin'),leaf=A.material('#879345','skin'),darkLeaf=A.material('#435c39','skin'),pink=A.material('#e277b6','skin');
    const add=(geo,mat,x,y,z,w,h,d,rx=0,ry=0,rz=0,color=null,shadow=true)=>b.add(geo,mat,x,y,z,w,h,d,rx,ry,rz,color,shadow);
    A.mesh(env,G.box,A.material('#4d4055'),180,-4,280,360,6,560,0,0,0,false);
    A.mesh(env,G.box,A.material('#31293e'),180,-9,280,420,8,625,0,0,0,false);
    // Subterranean ruin surrounds the arena; all masonry outside the playable rectangle.
    A.mesh(env,G.box,A.material('#31263c'),180,-19,280,870,14,1020,0,0,0,false);
    const ext=A.rng(824),outer=['#49364f','#55415b','#604961','#675066','#3d3048'];
    for(const x of [-39,399])for(let j=0;j<34;j++){const z=-18+j*18;const h=5+ext()*8;add(G.bevel,stone,x,-7+h/2,z,20,h,17.3,0,(j%2)*Math.PI,0,outer[j%5],false);if(j%4===0&&Math.abs(z-280)>40){add(G.bevel,stone,x+ (x<0?-15:15),2,z,11,18,19,0,ext()*.3,0,outer[(j+2)%5],false)}}
    for(const z of [-39,599])for(let i=0;i<22;i++){const x=-10+i*18;const h=7+ext()*6;add(G.bevel,stone,x,-8+h/2,z,17.2,h,21,0,0,0,outer[(i+2)%5],false)}
    // Paint a soft dark edge shadow into a single transparent plane; no new colliders.
    const edgeTex=A.texture(512,768,(g,w,h)=>{const e=36;for(const [x0,y0,x1,y1] of [[0,0,e,0],[w,0,w-e,0],[0,0,0,e],[0,h,0,h-e]]){const a=g.createLinearGradient(x0,y0,x1,y1);a.addColorStop(0,'#1a0e25b0');a.addColorStop(1,'#1a0e2500');g.fillStyle=a;g.fillRect(0,0,w,h)}});
    const edgeMat=new T.MeshBasicMaterial({map:edgeTex,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
    A.mesh(env,G.plane,edgeMat,180,.07,280,360,560,1,-Math.PI/2,0,0,false);
    // Independently colored pavers, with a flat playable surface at y=0.
    for(let i=0;i<20;i++)for(let j=0;j<32;j++){const x=9+i*18,z=9+j*17.5;add(low?G.box:G.bevel,stone,x,-1.6,z,17.35,3.2,16.85,0,(i+j)%2*Math.PI,0,choose(tiles),false);if(r()<.11&&(i<2||i>17||r()<.12)){add(G.leaf,moss,x+(r()-.5)*9,.05,z+7.3,2+r()*4,.16,1.3+r()*2,0,r()*TAU,0,null,false)}}
    // Thin, irregular moss patches near the perimeter; dedicated seed keeps other decor unchanged.
    const mossTex=A.texture(128,128,(g,w,h)=>{const q=A.rng(7209);for(let i=0;i<110;i++){const a=q()*TAU,d=Math.sqrt(q())*49,x=64+Math.cos(a)*d,y=64+Math.sin(a)*d;g.fillStyle=['#68794388','#87944980','#53633980','#a0a35b66'][i%4];g.beginPath();g.ellipse(x,y,2+q()*7,1.5+q()*4,a,0,TAU);g.fill()} });
    const mossMat=new T.MeshStandardMaterial({map:mossTex,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
    const mr=A.rng(1452);for(let i=0;i<46;i++){const side=i%2?1:-1,x=side<0?8+mr()*18:352-mr()*18,z=15+mr()*530;if(Math.abs(z-280)<37)continue;add(G.plane,mossMat,x,.10,z,8+mr()*16,5+mr()*10,1,-Math.PI/2,0,mr()*TAU,null,false)}
    // Painted ambient occlusion around the stone perimeter, one shared draw call.
    // The interior stays readable; this is an authored AO approximation, not a lightmap bake.
    const aoTex=A.texture(512,768,(g,w,h)=>{const im=g.createImageData(w,h),d=im.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,side=Math.min(u,1-u),end=Math.min(v,1-v),river=Math.abs(v-.5);let alpha=78*Math.exp(-side*34)+50*Math.exp(-end*40);if(river<.04)alpha*=.40;const k=(y*w+x)*4;d[k]=34;d[k+1]=22;d[k+2]=47;d[k+3]=Math.min(110,alpha)}g.putImageData(im,0,0)});
    A.mesh(env,G.plane,new T.MeshBasicMaterial({map:aoTex,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}),180,.07,280,360,560,1,-Math.PI/2,0,0,false);
    // All paths are on a continuous walkable floor at y=0. No river or bridges.
    const runes=A.texture(1024,1600,(g,w,h)=>{g.scale(w/360,h/560);g.lineCap='round';g.lineJoin='round';
      for(const sign of [-1,1]){const x=180+sign*84;g.beginPath();g.moveTo(180,68);g.bezierCurveTo(x,125,x,180,x,280);g.bezierCurveTo(x,380,x,435,180,492);g.strokeStyle='#b69c6860';g.lineWidth=37;g.stroke();g.strokeStyle='#c9a46a';g.lineWidth=1.8;g.stroke();for(let z=215;z<=345;z+=26){g.strokeStyle='#e4b86a';g.lineWidth=1.6;g.beginPath();g.moveTo(x,z-5);g.lineTo(x+5,z);g.lineTo(x,z+5);g.lineTo(x-5,z);g.closePath();g.stroke()}}
      g.strokeStyle='#ffd078b0';g.lineWidth=2;g.setLineDash([5,7]);g.beginPath();g.moveTo(180,140);g.lineTo(180,222);g.moveTo(180,338);g.lineTo(180,420);g.stroke();g.setLineDash([]);
      // Player and rival deployment boundaries, with subtle three-lane arrows.
      for(const z of [238,322]){g.strokeStyle=z===322?'#41dcfa90':'#d072ff90';g.lineWidth=1.5;g.setLineDash([5,6]);g.beginPath();g.moveTo(20,z);g.lineTo(340,z);g.stroke();g.setLineDash([]);for(const x of [96,180,264]){const d=z===322?-1:1;g.strokeStyle=z===322?'#5ee7fb':'#dd9bff';g.beginPath();g.moveTo(x-5,z-d*8);g.lineTo(x,z);g.lineTo(x+5,z-d*8);g.stroke()}}
    });
    A.mesh(env,G.plane,new T.MeshBasicMaterial({map:runes,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}),180,.13,280,360,560,1,-Math.PI/2,0,0,false);
    // The shrine is a walkable inlaid circle: its floating crystal never blocks movement.
    const seal=new T.Group();seal.position.set(180,0,280);env.add(seal);
    const sealTex=A.texture(512,512,(g,w,h)=>{g.translate(256,256);g.strokeStyle='#e0b671';g.fillStyle='#473d58';g.lineWidth=7;g.beginPath();g.arc(0,0,244,0,TAU);g.fill();g.stroke();for(const rr of [177,224]){g.beginPath();g.arc(0,0,rr,0,TAU);g.stroke()}g.lineWidth=5;for(let i=0;i<12;i++){g.save();g.rotate(i*TAU/12);g.beginPath();g.moveTo(0,-195);g.lineTo(14,-210);g.lineTo(0,-225);g.lineTo(-14,-210);g.closePath();g.stroke();g.restore()}g.strokeStyle='#ffdd91';g.lineWidth=12;g.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2,x=84*Math.cos(a),y=84*Math.sin(a);i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.stroke();g.rotate(Math.PI/4);g.strokeRect(-43,-43,86,86);});
    A.mesh(seal,G.plane,new T.MeshBasicMaterial({map:sealTex,transparent:true,toneMapped:false,depthWrite:false}),0,.17,0,108,108,1,-Math.PI/2,0,0,false);
    const circleMat=new T.MeshBasicMaterial({color:A.lin('#ffce75'),transparent:true,opacity:.85,toneMapped:false,depthWrite:false});
    A.mesh(seal,G.ring,circleMat,0,.24,0,54,54,54,-Math.PI/2,0,0,false);
    const coreMat=new T.MeshStandardMaterial({color:A.lin('#ffce75'),emissive:A.lin('#ffbc4d'),emissiveIntensity:.62,roughness:.3,metalness:.12,flatShading:true});
    const shrineCrystal=A.mesh(seal,G.oct,coreMat,0,26,0,10,19,10,0,0,0,false);
    const halo=A.glow(seal,'#ffce75',0,26,0,43,.33);
    const pool=A.lightPool(seal,'#ffce75',0,0,105,105,.14,.22);
    // 3.1: twelve timer marks in one instanced draw call (additive, so brightness encodes progress).
    const marks=new T.InstancedMesh(G.box,new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,depthWrite:false,blending:T.AdditiveBlending}),12);marks.frustumCulled=false;marks.castShadow=false;seal.add(marks);
    const markTmp=new T.Object3D(),markBase=A.lin('#ffce75'),markColor=A.lin('#ffce75');for(let i=0;i<12;i++){const a=i*TAU/12;markTmp.position.set(Math.cos(a)*46,.30,Math.sin(a)*46);markTmp.rotation.set(0,-a,0);markTmp.scale.set(3.5,.35,5);markTmp.updateMatrix();marks.setMatrixAt(i,markTmp.matrix);marks.setColorAt(i,markColor)}
    // 3.1: capture charge disc in the colour of the side holding the shrine.
    const chargeTex=A.texture(128,128,g=>{const r=g.createRadialGradient(64,64,6,64,64,64);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(.55,'rgba(255,255,255,.35)');r.addColorStop(.8,'rgba(255,255,255,.65)');r.addColorStop(.92,'rgba(255,255,255,.2)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128)});
    const chargeMat=new T.MeshBasicMaterial({map:chargeTex,color:A.lin('#ffce75'),transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
    const chargeDisc=A.mesh(seal,G.plane,chargeMat,0,.21,0,96,96,1,-Math.PI/2,0,0,false);chargeDisc.visible=false;
    let lastLit=-1,lastCand=-2,chargeLevel=0,lastT=0;
    let lastOwner=-99;
    // Fortified perimeter. Front wall is lower to protect the player's tower and camera visibility.
    for(const x of [-6,366])for(let z=-7;z<=567;z+=17){for(let j=0;j<2;j++)add(G.bevel,stone,x,5+j*8.5,z,12,8.2,16.6,0,0,0,choose(wall));add(G.bevel,stone,x,18,z,15,5,17,0,0,0,choose(wall));if(Math.floor((z+7)/17)%3===0)add(G.bevel,stone,x,23,z,13,6,12,0,0,0,choose(wall));}
    for(const z of [-9,569])for(let x=-2;x<=364;x+=17){const front=z>0;for(let j=0;j<(front?2:3);j++)add(G.bevel,stone,x,4+j*8,z,16.6,7.6,13,0,0,0,choose(wall));add(G.bevel,stone,x,front?17:25,z,17,5,16,0,0,0,choose(wall))}
    const runeTex=A.texture(128,128,(g)=>{g.scale(2,2);g.shadowColor='#f4973299';g.shadowBlur=4;g.strokeStyle='#ffb94e';g.lineWidth=4;g.strokeRect(12,12,40,40);g.strokeRect(23,23,18,18)});
    const runeMat=new T.MeshBasicMaterial({map:runeTex,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide});
    for(const z of [-11,571])for(const x of [45,315]){const h=z>0?31:42;for(let y=4;y<h;y+=9)add(G.bevel,stone,x,y,z,21,8.5,20,0,0,0,choose(wall));add(G.bevel,stone,x,h+1,z,24,5,23,0,0,0,'#a3909a');A.mesh(env,G.plane,runeMat,x,h*.63,z+10.3,18,18,1,0,0,0,false);A.glow(env,'#ffb74b',x,h*.63,z+11,24,.18)}
    const cornerCrystals=[];for(const z of [-8,568])for(const x of [-4,364]){const team=z>280?0:1;add(G.bevel,stone,x,17,z,26,6,26,0,0,0,'#a28b9a');cornerCrystals.push(A.crystal(env,team,x,32,z,10,22,true));for(const dx of [-8,8])A.crystal(env,team,x+dx,24,z+2,6,11,false)}
    // Flowers and creeping leaves at the edges, never on the main combat paths.
    for(let i=0;i<145;i++){const side=i%2?1:-1,x=side<0?4+r()*9:356-r()*9,z=9+r()*542;if(Math.abs(z-280)<32)continue;const y=.35;add(G.leaf,moss,x,y,z,2+r()*3,.25,2+r()*4,0,r()*TAU,0,null,false);if(i%4===0){for(let j=0;j<3;j++)add(G.leaf,leaf,x+(j-1)*1.4,1.6,z+(j%2)*1.3,1,2.1,.6,0,r()*TAU,(j-1)*.5,null,false)}if(i%6===0){for(let j=0;j<5;j++){const a=j*TAU/5;add(G.leaf,pink,x+Math.cos(a)*1.1,1.4,z+Math.sin(a)*1.1,1.1,.45,.9,0,a,0,null,false)}add(G.leaf,A.goldLight,x,1.65,z,.65,.45,.65,0,0,0,null,false)}}
    for(const x of [25,63,298,342])for(const z of [-4,562])for(let j=0;j<10;j++){const y=25-j*2.2,dx=Math.sin(j*1.4)*2;add(G.leaf,j%2?leaf:darkLeaf,x+dx,y,z+3,2.7,.7,1.7,0,0,j%2?.5:-.5,null,false);if(j%2===0)add(G.leaf,leaf,x+dx+2.7,y-.8,z+3.3,1.9,.55,1.25,0,0,-.6,null,false)}
    // Fan-shaped original fern clusters and weathered pebbles at the margins.
    const foliage=A.rng(1631);for(let i=0;i<38;i++){const x=i%2?6+foliage()*9:345+foliage()*9,z=18+foliage()*524;if(Math.abs(z-280)<38)continue;for(let j=0;j<5;j++){const a=j*TAU/5+foliage()*.4,sz=3+foliage()*2;add(G.leaf,j%2?leaf:darkLeaf,x+Math.cos(a)*2.4,2.3,z+Math.sin(a)*2.4,sz,1.0,1.15,0,-a,-.40,null,false)}if(i%3===0)add(G.bevel,stone,x+3,.8,z+4,4.8,2.5,3.9,.13,foliage()*TAU,.08,'#6f6176',false)}
    for(const x of [30,330]){const z=-12;add(G.bevel,A.material('#76513d','wood'),x,26,z,3,35,3);add(G.bevel,A.material('#76513d','wood'),x,42,z+8,3,3,18);add(G.bevel,A.gold,x,34,z+15,7,11,7);add(G.bevel,A.material('#ffd078','glow'),x,34,z+15,5.5,7.8,5.5);A.glow(env,'#ffbd5a',x,34,z+15,22,.33)}
    // Additional temple architecture outside the battlefield. Broken capitals, carved plinths,
    // and mossy stone steps make the perimeter read as a sanctuary rather than an isolated board.
    const dusk=A.rng(2818);
    for(const x of [-27,387])for(const z of [55,175,385,505]){const h=18+dusk()*12;add(G.bevel,stone,x,-1,z,17,7,20,0,0,0,'#625269',false);add(G.bevel,stone,x,h/2,z,12,h,13,0,0,0,'#776274',false);add(G.bevel,stone,x,h+2,z,18,5,18,0,0,0,'#a18791',false);for(let i=0;i<3;i++)add(G.leaf,darkLeaf,x+(dusk()-.5)*12,h+5,z+(dusk()-.5)*12,3.3,1.6,1,0,dusk()*TAU,.4,null,false);}
    for(const x of [45,315])for(const z of [9,551])A.lightPool(env,'#ffad55',x,z,43,33,.12,.17);
    if(!low)for(const x of [-11,371])for(const z of [75,210,350,485])A.lightPool(env,'#8160af',x,z,45,85,.08,.19);
    // 3.1: outer sanctuary. On tall phones the camera sees past the north wall, so a terrace with
    // columns and enemy-coloured crystals fills that band; the south side stays low to keep the player's core clear.
    const far=A.rng(3307),slab=['#4b3a52','#584561','#433549','#5f4a62'];
    for(let i=0;i<24;i++){const x=-36+i*18.4;add(G.bevel,stone,x,-4+far()*2,-44-far()*8,18.2,9+far()*4,26,0,far()*.12,0,slab[i%4],false);add(G.bevel,stone,x,-6,-76-far()*6,18.2,8,26,0,0,0,slab[(i+1)%4],false)}
    for(const [x,h] of [[22,44],[112,30],[248,36],[338,48]]){add(G.bevel,stone,x,h/2-1,-52,12,h,12,0,0,0,'#7a6578',false);add(G.bevel,stone,x,h+1.5,-52,17,4,17,0,0,0,'#a48a94',false);if(h>40)add(G.leaf,darkLeaf,x+4,h-6,-46,4,2,1.4,0,0,.5,null,false)}
    for(const [x,s] of [[66,1],[180,1.45],[294,1]]){A.crystal(env,1,x,16*s,-66,15*s,32*s,false);A.crystal(env,1,x-13*s,8*s,-58,8*s,16*s,false);A.lightPool(env,C.team[1],x,-60,64*s,44*s,.16,.6)}
    for(const x of [96,264]){add(G.bevel,stone,x,3,-40,8,6,8,0,.4,0,'#6f5b75',false);A.glow(env,'#ffb35a',x,9,-40,16,.3)}
    for(const [x,s] of [[40,1],[150,.8],[210,.8],[320,1]]){A.crystal(env,0,x,4*s,612,9*s,10*s,false);A.lightPool(env,C.team[0],x,612,40*s,26*s,.12,.4)}
    b.flush();
    return {root:env,update(t,state){const sh=state&&state.shrine,owner=sh?sh.owner:-1;
      if(lastOwner!==owner){lastOwner=owner;const c=owner<0?'#ffce75':C.team[owner];circleMat.color.copy(A.lin(c));coreMat.color.copy(A.lin(c));coreMat.emissive.copy(A.lin(c));halo.material.color.copy(A.lin(c));pool.material.color.copy(A.lin(c));markBase.copy(A.lin(c));lastLit=-1}
      const pulse=sh?sh.pulse:0;shrineCrystal.position.y=27+Math.sin(t*2)*2.3;shrineCrystal.rotation.y=t*.4;const flash=Math.min(1,pulse);/* 4.4: quiet while held, bright only on capture/award */circleMat.opacity=sh&&sh.contested?.44+.25*Math.sin(t*9):Math.min(.9,(owner<0?.55:.34)+.55*flash);halo.material.opacity=.13+.25*flash;pool.material.opacity=.07+.14*flash;const progress=sh?1-sh.next/30:0,lit=Math.floor(progress*12);if(lit!==lastLit){lastLit=lit;for(let i=0;i<12;i++){const k=i<lit?.95:.2;markColor.copy(markBase);markColor.r*=k;markColor.g*=k;markColor.b*=k;marks.setColorAt(i,markColor)}if(marks.instanceColor)marks.instanceColor.needsUpdate=true}
      const dt=Math.min(.05,Math.max(0,t-lastT));lastT=t;const cand=sh?sh.candidate:-1;if(cand!==lastCand){lastCand=cand;chargeMat.color.copy(A.lin(cand<0?'#ffce75':C.team[cand]))}
      const want=cand<0?0:owner>=0?.12+.04*Math.sin(t*5)+.4*Math.min(1,pulse):.12+.5*Math.min(1,sh.charge/1.5);chargeLevel+=(want-chargeLevel)*Math.min(1,dt*9);chargeMat.opacity=chargeLevel;chargeDisc.visible=chargeLevel>.01;const cs=cand<0?96:44+52*Math.min(1,sh.charge/1.5);chargeDisc.scale.set(cs,cs,1);
      for(const c of cornerCrystals)c.root.position.y=c.baseY+Math.sin(t*1.4+c.root.position.x)*.7;
    }};
  }
  return {build};
})():null;
