'use strict';
const ArenaEnvironment3D = ArenaArt3D ? (()=>{
  const A=ArenaArt3D,{T,G,C,TAU}=A;
  function build(scene){
    const env=new T.Group();scene.add(env);const b=A.batch(env),r=A.rng(714),stone=A.stone;
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
    for(let i=0;i<20;i++)for(let j=0;j<32;j++){const x=9+i*18,z=9+j*17.5;if(Math.abs(z-280)<25)continue;add(G.bevel,stone,x,-1.6,z,17.35,3.2,16.85,0,(i+j)%2*Math.PI,0,choose(tiles),false);if(r()<.11&&(i<2||i>17||r()<.12)){add(G.leaf,moss,x+(r()-.5)*9,.05,z+7.3,2+r()*4,.16,1.3+r()*2,0,r()*TAU,0,null,false)}}
    // Thin, irregular moss patches near the perimeter; dedicated seed keeps other decor unchanged.
    const mossTex=A.texture(128,128,(g,w,h)=>{const q=A.rng(7209);for(let i=0;i<110;i++){const a=q()*TAU,d=Math.sqrt(q())*49,x=64+Math.cos(a)*d,y=64+Math.sin(a)*d;g.fillStyle=['#68794388','#87944980','#53633980','#a0a35b66'][i%4];g.beginPath();g.ellipse(x,y,2+q()*7,1.5+q()*4,a,0,TAU);g.fill()} });
    const mossMat=new T.MeshStandardMaterial({map:mossTex,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
    const mr=A.rng(1452);for(let i=0;i<46;i++){const side=i%2?1:-1,x=side<0?8+mr()*18:352-mr()*18,z=15+mr()*530;if(Math.abs(z-280)<37)continue;add(G.plane,mossMat,x,.10,z,8+mr()*16,5+mr()*10,1,-Math.PI/2,0,mr()*TAU,null,false)}
    // Exact navigable channel: z=264..296; no central bridge.
    const waterTex=A.texture(512,256,(g,w,h)=>{
      const q=A.rng(19),grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#10456d');grad.addColorStop(.18,'#166f9e');grad.addColorStop(.47,'#208fb3');grad.addColorStop(.72,'#1c85ae');grad.addColorStop(1,'#103f69');g.fillStyle=grad;g.fillRect(0,0,w,h);
      // Broad painterly caustics and small curved wavelets. All texture motion is cosmetic.
      for(let i=0;i<58;i++){const x=q()*w,y=q()*h,rx=12+q()*33,ry=4+q()*13;g.save();g.translate(x,y);g.scale(1,ry/rx);const p=g.createRadialGradient(0,0,0,0,0,rx);p.addColorStop(0,'#86f8e54b');p.addColorStop(.55,'#49d8ed26');p.addColorStop(1,'#49d8ed00');g.fillStyle=p;g.fillRect(-rx,-rx,2*rx,2*rx);g.restore()}
      for(let i=0;i<85;i++){const x=q()*w,y=q()*h,len=8+q()*29;g.strokeStyle=i%6?'#92e9ff38':'#e5ffffa0';g.lineWidth=.65+q()*1.8;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+len*.24,y-3.5,x+len*.68,y+4,x+len,y);g.stroke()}
      for(const y of [2,h-3]){g.fillStyle='#c5f7ff40';g.fillRect(0,y,w,1.2)}
    },true);waterTex.repeat.set(3,1);
    const waterMat=new T.MeshStandardMaterial({map:waterTex,color:A.lin('#75cfe8'),emissive:A.lin('#0876a9'),emissiveIntensity:.38,roughness:.34,metalness:.02});
    A.mesh(env,G.plane,waterMat,180,-.65,280,392,32,1,-Math.PI/2,0,0,false);
    const caustics=A.texture(512,128,(g,w,h)=>{const q=A.rng(313);g.lineWidth=1.15;for(let i=0;i<56;i++){const x=q()*w,y=q()*h,r=4+q()*12;g.strokeStyle=i%4?'#79def24d':'#a4f8ff83';g.beginPath();g.moveTo(x-r,y);g.quadraticCurveTo(x,y-r*.5,x+r,y+1);g.quadraticCurveTo(x,y+r*.6,x-r,y);g.stroke()}},true);caustics.repeat.set(4,1);
    const causticMat=new T.MeshBasicMaterial({map:caustics,transparent:true,opacity:.44,depthWrite:false,toneMapped:false});A.mesh(env,G.plane,causticMat,180,-.57,280,392,32,1,-Math.PI/2,0,0,false);
    for(let i=0;i<24;i++)for(const z of [261,299])add(G.bevel,stone,7.5+15*i,.6,z,14.5,4.2,5.5,0,0,0,choose(wall));
    // Bridges: retain x ±34 as visual walkable deck. Posts sit outside the deck.
    for(const x of [90,270]){
      const wood=A.material('#b78251','wood'),woodDark=A.material('#704329','wood');
      add(G.bevel,woodDark,x,1.2,280,68,3.2,42);
      for(let j=0;j<7;j++){add(G.bevel,wood,x,2.6,261.8+j*6.1,68,2.8,5.75,0,0,0,null);for(const dx of [-28,28])add(G.cyl,A.material('#6c4834','gold'),x+dx,4.05,261.8+j*6.1,.8,.22,.8,0,0,0,null,false)}
      for(const s of [-1,1]){add(G.bevel,woodDark,x+s*34,3.8,280,3.6,3.4,43);for(const dz of [-21,21]){add(G.bevel,woodDark,x+s*35,5,280+dz,7.2,10,7.2);add(G.bevel,A.gold,x+s*35,10.3,280+dz,8.5,2.5,8.5);add(G.box,A.goldLight,x+s*35,11.65,280+dz,4.2,.35,4.2,0,Math.PI/4,0)}}
    }
    // Gold tracks painted onto a single transparent plane, not physical colliders.
    const runes=A.texture(1024,1600,(g,w,h)=>{const sx=w/360,sy=h/560;g.scale(sx,sy);g.lineCap='round';g.lineJoin='round';const gold='#ffc05a';g.shadowColor='#ff8f3766';g.shadowBlur=4;function ln(x1,y1,x2,y2,width=1){g.strokeStyle=gold;g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()}
      for(const x of [90,270])for(const [a,e] of [[105,258],[302,455]]){for(const dx of [-7,7])ln(x+dx,a,x+dx,e,1.75);for(let z=a+13;z<e-4;z+=19){g.strokeStyle=gold;g.lineWidth=1.45;g.beginPath();g.moveTo(x,z-4);g.lineTo(x+4.5,z);g.lineTo(x,z+4);g.lineTo(x-4.5,z);g.closePath();g.stroke()}}
      for(const [a,e] of [[46,243],[317,515]]){ln(180,a,180,e,2.05);for(let z=a+17;z<e-4;z+=21){g.strokeStyle=gold;g.lineWidth=1.3;g.beginPath();g.moveTo(180,z-6);g.lineTo(188,z);g.lineTo(180,z+6);g.lineTo(172,z);g.closePath();g.stroke();g.beginPath();g.moveTo(180,z-2.7);g.lineTo(184,z);g.lineTo(180,z+2.7);g.lineTo(176,z);g.closePath();g.stroke()}}
    });
    A.mesh(env,G.plane,new T.MeshBasicMaterial({map:runes,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}),180,.13,280,360,560,1,-Math.PI/2,0,0,false);
    // Floating seal: deliberately separated from banks so it does not look like a traversable third bridge.
    const seal=new T.Group();seal.position.set(180,1.3,280);env.add(seal);
    const sealTex=A.texture(512,512,(g,w,h)=>{g.scale(2,2);g.translate(128,128);g.shadowColor='#ffad4499';g.shadowBlur=8;g.strokeStyle='#ffc05a';g.lineWidth=6;for(const rad of [92,110]){g.beginPath();g.arc(0,0,rad,0,TAU);g.stroke()}g.lineWidth=8;g.lineCap='round';g.beginPath();for(let i=0;i<=200;i++){const a=i/200*TAU*1.65,rr=3+i/200*65,x=rr*Math.cos(a),y=rr*Math.sin(a);if(i===0)g.moveTo(x,y);else g.lineTo(x,y)}g.stroke();for(let i=0;i<8;i++){const a=i*TAU/8;g.save();g.rotate(a);g.lineWidth=4;g.beginPath();g.moveTo(112,0);g.lineTo(124,-8);g.lineTo(135,0);g.lineTo(124,8);g.closePath();g.stroke();g.restore()}});
    const sealMat=new T.MeshBasicMaterial({map:sealTex,transparent:true,depthWrite:false,toneMapped:false,opacity:.94,side:T.DoubleSide});
    // Floating, interrupted stone rim: gaps toward both banks keep the central crossing visibly closed.
    const rim=new T.TorusGeometry(28,2.05,5,26,Math.PI*.75);
    for(const angle of [-Math.PI*.375,Math.PI*.625])A.mesh(seal,rim,A.material('#a28b98'),0,.3,0,1,1,.48,-Math.PI/2,0,angle,false);
    // Holographic effect above the water; no opaque solid disk across the river.
    A.mesh(seal,G.plane,sealMat,0,2,0,70,70,1,-Math.PI/2,0,0,false);
    A.mesh(seal,G.plane,new T.MeshBasicMaterial({color:A.lin('#efab69'),toneMapped:false,map:sealTex,transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending}),0,1.5,0,76,76,1,-Math.PI/2,0,0,false);
    // Fortified perimeter. Front wall is lower to protect the player's tower and camera visibility.
    for(const x of [-6,366])for(let z=-7;z<=567;z+=17){if(Math.abs(z-280)<22)continue;for(let j=0;j<2;j++)add(G.bevel,stone,x,5+j*8.5,z,12,8.2,16.6,0,0,0,choose(wall));add(G.bevel,stone,x,18,z,15,5,17,0,0,0,choose(wall));if(Math.floor((z+7)/17)%3===0)add(G.bevel,stone,x,23,z,13,6,12,0,0,0,choose(wall));}
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
    for(const x of [15,45,140,222,320,346]){const z=280+(r()-.5)*17;add(G.leaf,leaf,x,-.65,z,4.8,.3,3.4,0,r()*TAU,0,null,false);for(let j=0;j<5;j++){const a=j*TAU/5;add(G.leaf,pink,x+Math.cos(a)*1.7,.25,z+Math.sin(a)*1.7,1.4,.65,.9,0,a,0,null,false)}add(G.leaf,A.goldLight,x,.8,z,.9,.5,.9,0,0,0,null,false)}
    for(const x of [30,330]){const z=-12;add(G.bevel,A.material('#76513d','wood'),x,26,z,3,35,3);add(G.bevel,A.material('#76513d','wood'),x,42,z+8,3,3,18);add(G.bevel,A.gold,x,34,z+15,7,11,7);add(G.bevel,A.material('#ffd078','glow'),x,34,z+15,5.5,7.8,5.5);A.glow(env,'#ffbd5a',x,34,z+15,22,.33)}
    b.flush();
    return {root:env,update(t){waterTex.offset.x=(t*.018)%1;caustics.offset.x=(t*.035)%1;causticMat.opacity=.39+Math.sin(t*.8)*.08;sealMat.opacity=.79+Math.sin(t*1.3)*.13;for(const c of cornerCrystals)c.root.position.y=c.baseY+Math.sin(t*1.4+c.root.position.x)*.7}};
  }
  return {build};
})():null;
