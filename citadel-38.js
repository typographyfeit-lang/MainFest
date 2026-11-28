'use strict';
/* Royal Citadels: visual-only tower implementation. Existing tower combat objects are read-only. */
(() => {
  const params=new URLSearchParams(location.search);
  if(params.get('visual')==='legacy'||params.get('citadel')==='legacy'||typeof ArenaTowers3D==='undefined'||!ArenaTowers3D||typeof ArenaArt3D==='undefined'||!ArenaArt3D)return;
  const A=ArenaArt3D,T=A.T,G=A.G,TAU=Math.PI*2, oldBuild=ArenaTowers3D.build;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const budget=()=>params.get('quality')==='low'?0:Math.max(0,Math.min(2,window.CDPerformance?.level?.()??(params.get('quality')==='high'?2:1)));
  const targetMap=new WeakMap(), seen=new WeakSet();
  const stats={built:0,active:0,stageChanges:0,mages:0,attacks:0,fallbacks:0,detail:0};
  window.CDCitadel38={stats:()=>({...stats}),readFrame(state){for(const f of state?.fx||[]){if(seen.has(f))continue;seen.add(f);if(f.a?.king!==undefined&&f.b&&Number.isFinite(f.b.x)&&Number.isFinite(f.b.y))targetMap.set(f.a,{x:f.b.x,z:f.b.y});}}};
  // Geometry and material families shared by all towers. A.modelBatch caches merged buffers by key.
  const palettes=[{stone:'#dfc9af',shade:'#ad8c79',top:'#f3dfbd',metal:'#d6a24b',edge:'#ffe1a1',dark:'#4b485d',cloth:'#126888'},
                  {stone:'#665369',shade:'#413448',top:'#8f738f',metal:'#b68a52',edge:'#e6b574',dark:'#2d233d',cloth:'#672992'}];
  const cylinder=new T.CylinderGeometry(1,1,1,12), octagonal=new T.CylinderGeometry(1,1,1,8), pillar=new T.CylinderGeometry(1,1,1,8), spike=new T.ConeGeometry(1,1,6), smallRing=new T.TorusGeometry(1,.04,4,24);
  const levels=[0,1,2,3];
  const decals=levels.slice(1).map(stage=>new T.MeshBasicMaterial({map:A.texture(128,128,(g,w,h)=>{const rng=A.rng(3800+stage);for(let i=0;i<stage*3;i++){let x=12+rng()*104,y=8+rng()*50;const path=[[x,y]];for(let j=0;j<3+stage;j++){x+=rng()*20-10;y+=8+rng()*14;path.push([x,y]);}for(const [dx,stroke,width] of [[1,'#e8c5a58a',3], [0,'#221b2bea',1.8+stage*.3]]){g.beginPath();g.lineJoin='round';g.lineCap='round';path.forEach(([px,py],k)=>k?g.lineTo(px+dx,py):g.moveTo(px+dx,py));g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}}),transparent:true,alphaTest:.14,depthWrite:false,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));
  /* ---- Block Arena 4.0 towers: voxel masonry keep + timber crossbow towers ------------------
   * Same models for both teams (only banners differ: blue / red). Every part goes through
   * A.modelBatch, so each tower type is merged once into ≤6 meshes and shared by both teams.
   * Limits kept from 3.9 so camera, combat and picking are untouched:
   *   core: footprint ≤ ±42, weapon (bolt) at y=80 over the tower centre (render3d heightOf)
   *   side: footprint ≤ ±18.5, weapon (bolt) at y=40 over the tower centre                     */
  const BANNER=['#2563d9','#d2362c'];
  const bannerCloth=BANNER.map((c,team)=>new T.MeshStandardMaterial({side:T.DoubleSide,roughness:.92,alphaTest:.5,map:A.texture(128,192,(g,w,h)=>{
    g.fillStyle=c;g.fillRect(0,0,w,h);const sh=g.createLinearGradient(0,0,0,h);sh.addColorStop(0,'rgba(255,255,255,.10)');sh.addColorStop(1,'rgba(0,0,0,.30)');g.fillStyle=sh;g.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=6){g.fillStyle=x%12?'rgba(0,0,0,.05)':'rgba(255,255,255,.04)';g.fillRect(x,0,3,h)}
    g.fillStyle='#e6b04f';g.fillRect(0,0,w,12);g.fillRect(0,12,9,h);g.fillRect(w-9,12,9,h);
    // swallow-tail hem (cut out by alphaTest)
    g.globalCompositeOperation='destination-out';g.beginPath();g.moveTo(w*.5,h*.80);g.lineTo(w*.22,h);g.lineTo(w*.78,h);g.closePath();g.fill();g.globalCompositeOperation='source-over';
    // emblem: gold shield with tower mark
    g.fillStyle='#e6b04f';g.beginPath();g.moveTo(w*.26,h*.22);g.lineTo(w*.74,h*.22);g.lineTo(w*.74,h*.47);g.lineTo(w*.5,h*.64);g.lineTo(w*.26,h*.47);g.closePath();g.fill();
    g.fillStyle=c;g.fillRect(w*.38,h*.31,w*.24,h*.2);g.fillRect(w*.34,h*.28,w*.08,h*.06);g.fillRect(w*.46,h*.28,w*.08,h*.06);g.fillRect(w*.58,h*.28,w*.08,h*.06);
  })}));
  const C40={stone:['#bcae9b','#ab9c89','#c8baa5','#9f907f','#b3a690'],mortar:'#3a333f',cap:'#cfc1ab',moss:['#5f8037','#4d6b2c','#76913f'],wood:'#8d5c36',woodDark:'#6a4327',iron:'#55525c',trim:'#e0aa4c',slot:'#1d1823'};
  const stoneM=A.material('#ffffff'),mortarM=A.material(C40.mortar),woodM=A.material(C40.wood,'wood'),woodDarkM=A.material(C40.woodDark,'wood'),ironM=A.material(C40.iron,'gold'),trimM=A.material(C40.trim,'gold'),slotM=A.material(C40.slot);
  function kit(batch,seed){
    const rng=A.rng(seed),add=(...a)=>batch.add(...a);
    const tone=()=>C40.stone[Math.floor(rng()*C40.stone.length)];
    // One wall face of separate bevelled blocks in running bond. Local x runs along the face,
    // local +z points outward; skip(u,row) leaves holes (gates).
    function wall(cx,cz,ry,len,y0,rows,rowH,thick,bw,skip,mode='front'){
      const c=Math.cos(ry),sn=Math.sin(ry);
      for(let r=0;r<rows;r++){let u=-len/2-(r%2?bw/2:0);
        while(u<len/2){const a=Math.max(u,-len/2),b=Math.min(u+bw,len/2),w=b-a;if(w>1.2){const m=(a+b)/2;
          if((!skip||!skip(m,r))&&(mode!=='back'||r===rows-1)){const j=(rng()-.5)*.5;add(mode==='front'?G.bevel:G.box,stoneM,cx+c*m+sn*j,y0+rowH*(r+.5),cz-sn*m+c*j,w-.7,rowH-.7,thick,0,ry,0,tone());}}u+=bw;}}
    }
    const square=(h,y0,rows,rowH,thick,bw,skipFront)=>{
      wall(0,h,0,2*h+thick,y0,rows,rowH,thick,bw,skipFront);wall(0,-h,Math.PI,2*h+thick,y0,rows,rowH,thick,bw,null,'back');
      wall(h,0,Math.PI/2,2*h-thick,y0,rows,rowH,thick,bw,null,'side');wall(-h,0,-Math.PI/2,2*h-thick,y0,rows,rowH,thick,bw,null,'side');
      add(G.box,mortarM,0,y0+rows*rowH/2,0,2*h-thick*.9,rows*rowH-.2,2*h-thick*.9);   // dark core shows in mortar joints
    };
    const moss=(h,y,n,size)=>{for(let i=0;i<n;i++){const side=i%4,u=(rng()-.5)*2*h,o=h+rng()*1.2;const x=side<2?u:(side===2?o:-o),z=side<2?(side?-o:o):u;
      add(G.box,stoneM,x,y+rng()*.8,z,size*(1+rng()),size*.55,size*(.8+rng()*.6),0,rng()*3,0,C40.moss[i%3]);}};
    // Timber beam with the grain along its length: geometry x is the long axis.
    const beam=(x,y,z,len,w,h,ry=0,rz=0,m=woodM)=>add(G.bevel,m,x,y,z,len,h,w,0,ry,rz);
    const post=(x,y,z,len,w,m=woodM)=>add(G.bevel,m,x,y,z,len,w,w,0,0,Math.PI/2);
    return {rng,add,tone,wall,square,moss,beam,post};
  }
  function coreParts(parent,part){
    const batch=A.modelBatch(parent,'bt40:core:'+part),k=kit(batch,4011+part.length),{add,wall,square,moss,beam,post}=k;
    const H=29,TOP=51;
    if(part==='base'){
      // wide plinth of large blocks
      square(32.5,0,2,4.6,7,13);add(G.box,stoneM,0,9.05,0,63,.3,63,0,0,0,C40.cap);
      moss(34,0,24,2.2);moss(30.5,9.2,14,1.8);
      // squat keep, gate recessed into the +z wall (faces the camera for both teams)
      square(H,9.2,6,7,5,11,(u,r)=>Math.abs(u)<9.5&&r<3);
      add(G.box,slotM,0,19.6,27.4,17.5,21,1.2);                                             // gate recess
      for(const x of [-5.6,0,5.6])add(G.bevel,woodDarkM,x,19.6,28.2,20.4,1.2,5.3,0,0,Math.PI/2); // door planks, vertical grain
      for(const x of [-10.8,10.8])for(let r=0;r<3;r++)add(G.bevel,stoneM,x,9.2+7*r+3.5,32,3.6,6.4,4.5,0,0,0,C40.cap); // jamb stones
      beam(0,31.6,32.6,26,5.8,3.6);                                                          // timber lintel, projects 3u
      // corbel ring + wooden roof deck (reads from above as planks inside stone)
      for(const [x,z,ry,l,m] of [[0,H+1.2,0,64,'front'],[0,-H-1.2,Math.PI,64,'side'],[H+1.2,0,Math.PI/2,56,'side'],[-H-1.2,0,-Math.PI/2,56,'side']])wall(x,z,ry,l,TOP,1,2.6,6,11,null,m);
      for(let i=0;i<10;i++)beam(0,TOP+1.2,-25.7+i*5.7,55,5.2,1.1);
      // corner turrets project out of every corner
      for(const x of [-28,28])for(const z of [-28,28]){
        for(const [dx,dz,ry,m] of [[0,7.4,0,z>0?'front':'side'],[0,-7.4,Math.PI,'back'],[7.4,0,Math.PI/2,'side'],[-7.4,0,-Math.PI/2,'side']])wall(x+dx,z+dz,ry,ry%Math.PI?11.4:18.2,0,6,10.6,3.4,9.1,null,m);
        add(G.box,mortarM,x,32,z,13,63.8,13);add(G.box,stoneM,x,64.15,z,15.2,.6,15.2,0,0,0,C40.cap);
        for(const [sx,sz] of [[0,1],[1,0]])add(G.box,slotM,x+(sx?Math.sign(x)*9.1:0),40,z+(sz?Math.sign(z)*9.1:0),sx?1:1.6,8,sz?1:1.6);
      }
      // central donjon carrying the ballista platform (bolt at y=80)
      square(11,TOP+1.6,3,6,4,8.5);add(G.bevel,woodM,0,71.6,0,25,1.6,25,0,0,0);
      post(0,73.2,0,3.4,4.6);
      // banner arm over the gate
      beam(0,58.8,34,11,2.6,2.6,Math.PI/2);beam(0,58.8,38.8,24,1.6,1.6,0,0,ironM);
      // flag masts on the two front turrets
      for(const x of [-28,28])post(x,72.5,28,17,1.8);
    }else if(part==='crown'){
      const merl=(cx,cz,ry,len,n,y,w,h,d)=>{const c=Math.cos(ry),sn=Math.sin(ry);for(let i=0;i<n;i++){const u=-len/2+len*(i+.5)/n;add(G.bevel,stoneM,cx+c*u,y+h/2,cz-sn*u,w,h,d,0,ry,0,k.tone());}};
      merl(0,32.2,0,44,4,TOP+2.6,6.4,6.6,3.6);merl(0,-32.2,Math.PI,44,4,TOP+2.6,6.4,6.6,3.6);merl(32.2,0,Math.PI/2,46,4,TOP+2.6,6.4,6.6,3.6);merl(-32.2,0,-Math.PI/2,46,4,TOP+2.6,6.4,6.6,3.6);
      for(const x of [-28,28])for(const z of [-28,28]){
        // turret corbels stick out, then merlons
        for(const [dx,dz,ry] of [[0,8.4,0],[0,-8.4,Math.PI],[8.4,0,Math.PI/2],[-8.4,0,-Math.PI/2]]){const c=Math.cos(ry),sn=Math.sin(ry);for(const u of [-5,0,5])add(ry===0?G.bevel:G.box,stoneM,x+dx+c*u,62.6,z+dz-sn*u,4.6,2.8,2.6,0,ry,0,C40.cap);
          for(const u of [-4.4,4.4])add(G.bevel,stoneM,x+dx+c*u,67.6,z+dz-sn*u,5,6.4,2.8,0,ry,0,k.tone());}
      }
      merl(0,11.6,0,20,3,TOP+19.6,4.4,4,2.4);merl(0,-11.6,Math.PI,20,3,TOP+19.6,4.4,4,2.4);
    }else if(part==='detail'){
      for(const x of [-5.6,0,5.6])for(const y of [13.5,25])add(G.box,ironM,x,y,29.1,4.6,1,.6);     // door bands
      for(const x of [-12.9,12.9])add(G.box,ironM,x,31.6,35.6,1,4,.8);                            // lintel straps
      for(const x of [-28,28])for(const z of [-28,28])moss(7.4,0,4,1.6);
      for(let i=0;i<6;i++){const a=i*1.05;add(G.bevel,stoneM,Math.sin(a)*34.5,1,Math.cos(a)*34.5,4,2,3,0,a,0,C40.moss[i%3]);}
    }else if(part==='ruins'||part==='chips'){
      legacy(parent,1,part);return;
    }
    batch.flush();
  }
  // Side tower 4.2: a small fortress next to the keep (~80% of its height, ~55% of its width — the widest that stays on screen).
  // Octagonal plan: the front (+z) face plus the two diagonal faces turn toward the 74° camera, so
  // roof, front wall and a side face are all visible; every vertex stays inside the unit keep-out
  // circle (rad 16 + 12 = 28) and the outer edge stays on screen with the current camera.
  // Tiers: wide stone base (apothem 20.4) → tall walls (17.2) → overhanging deck (20.2) + crossbow.
  const SIDE_BOLT=60;                                  // must match render3d.js heightOf(side, attacker)
  const shade=(hex,f)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*f).toString(16).padStart(2,'0')).join('');
  const OCT=Math.tan(Math.PI/8)*2;                     // side length / apothem of a regular octagon
  function sideParts(parent,part){
    const batch=A.modelBatch(parent,'bt42:side:'+part),k=kit(batch,4411+part.length),{add,beam,post}=k;
    const BASE=20.4,BASE_T=4.2,BASE_H=9.2,WALL=17.2,WALL_T=3.2,ROWS=6,ROWH=6.4,DECK=47.8,DA=20.2;
    const faces=[...Array(8)].map((_,i)=>{const a=i*Math.PI/4;return {i,a,sx:Math.sin(a),cz:Math.cos(a),mode:i===0||i===1||i===7?'front':i===2||i===6?'side':'back'};});
    const octFill=(ap,y,h,mat,col=null)=>{const r=ap/Math.cos(Math.PI/8);add(octagonal,mat,0,y,0,r,h,r,0,Math.PI/8,0,col);};   // true octagon, flat face toward +z
    // one octagon ring of separate blocks; skip(face,u,row) leaves real recesses
    const ring=(ap,t,y0,rows,rowH,bw,skip,toneOf)=>{for(const f of faces){const c=ap-t/2,len=OCT*ap+.3;
      for(let r=0;r<rows;r++){if(f.mode==='back'&&r<rows-1)continue;let u=-len/2-(r%2?bw/2:0);
        while(u<len/2){const a0=Math.max(u,-len/2),b0=Math.min(u+bw,len/2),w=b0-a0,m=(a0+b0)/2;
          if(w>1.2&&!(skip&&skip(f,m,r))){const ca=Math.cos(f.a),sa=Math.sin(f.a),j=(k.rng()-.5)*.4;
            add(f.mode==='front'?G.bevel:G.box,stoneM,f.sx*(c+j)+ca*m,y0+rowH*(r+.5),f.cz*(c+j)-sa*m,w-.6,rowH-.6,t,0,f.a,0,toneOf?toneOf(r):k.tone());}
          u+=bw;}}}};
    if(part==='base'){
      // 1 · wide stone base, two courses of big blocks + sunlit ledge
      ring(BASE,BASE_T,0,2,BASE_H/2,7.4);octFill(BASE-BASE_T+.2,BASE_H/2,BASE_H-.2,mortarM);
      for(const f of faces)add(G.bevel,stoneM,f.sx*(BASE-1.3),BASE_H+.35,f.cz*(BASE-1.3),OCT*BASE*.97,.9,2.6,0,f.a,0,C40.cap);
      octFill(BASE-2.4,BASE_H+.2,.4,stoneM,shade(C40.cap,.9));
      for(let i=0;i<10;i++){const f=faces[[0,1,7,2,6][i%5]],u=(k.rng()-.5)*OCT*BASE*.8,o=BASE-2.6-k.rng()*1.5;     // moss on the ledge
        add(G.box,stoneM,f.sx*o+Math.cos(f.a)*u,BASE_H+.6,f.cz*o-Math.sin(f.a)*u,2.4+k.rng()*2,.6,1.6,0,f.a,0,C40.moss[i%3]);}
      // 2 · tall walls; the top two courses are baked darker = shadow under the deck
      ring(WALL,WALL_T,BASE_H+.2,ROWS,ROWH,5.6,
        (f,u,r)=>(f.i===0&&r>=2&&r<=3&&Math.abs(u)<3.6)||((f.i===1||f.i===7)&&r===3&&Math.abs(u)<1.6),
        r=>r===ROWS-1?shade(k.tone(),.56):r===ROWS-2?shade(k.tone(),.84):k.tone());
      octFill(WALL-WALL_T+.1,BASE_H+.2+ROWS*ROWH/2,ROWS*ROWH-.2,mortarM);
      const ly=BASE_H+.2+ROWH*3;                                                                    // front loophole
      add(G.box,slotM,0,ly,WALL-WALL_T-.1,1.4,10.4,.5);add(G.box,slotM,0,ly+1.3,WALL-WALL_T-.1,5.2,1.3,.5);
      add(G.bevel,stoneM,0,ly-ROWH-.1,WALL+.9,9.4,1.4,2.4,0,0,0,C40.cap);add(G.bevel,stoneM,0,ly+ROWH+.2,WALL+.9,10,1.6,2.4,0,0,0,C40.cap);
      // timber posts on the octagon vertices (vertical grain) cover the masonry seams
      const vr=WALL/Math.cos(Math.PI/8)+.4;
      for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4;add(G.bevel,woodDarkM,Math.sin(a)*vr,BASE_H+.2+ROWS*ROWH/2,Math.cos(a)*vr,ROWS*ROWH+.4,3,3,0,a,Math.PI/2);}
      // 3 · fighting deck: dark joists + fascia (side), light planks (top), 3.3u overhang
      for(const o of [-8,0,8])beam(o,DECK+.8,0,2*DA+1.6,2,1.6,Math.PI/2,0,woodDarkM);
      for(let i=0;i<9;i++){const z=-17.2+i*4.3,half=Math.min(DA-1,1.4142*(DA-1)-Math.abs(z)-2.15);
        add(G.bevel,woodM,0,DECK+2.2,z,2*half,1.2,4.2,0,0,0,i%2?'#b27c4e':'#a8724a');}
      for(const f of faces)beam(f.sx*(DA-.6),DECK+1.5,f.cz*(DA-.6),OCT*DA+.5,1.2,3,f.a,0,woodDarkM);
      post(0,DECK+3.9,0,2.4,4.2);                                                                     // crossbow mount
      post(-13,DECK+11.4,-13,16,1.4);                                                             // pennant pole (flag in create)
    }else if(part==='crown'){
      for(const f of faces)add(G.bevel,stoneM,f.sx*(DA-2.2),DECK+5,f.cz*(DA-2.2),5.4,3.6,2.4,0,f.a,0,k.tone());  // low merlons
    }else if(part==='detail'){
      for(const o of [-8,0,8])for(const e of [-DA-1.3,DA+1.3])add(G.box,ironM,o,DECK+.8,e,2.2,1.8,.4);
      const vr=WALL/Math.cos(Math.PI/8)+.4;
      for(const i of [7,0])for(const y of [BASE_H+8,BASE_H+30]){const a=(i+.5)*Math.PI/4;add(G.box,ironM,Math.sin(a)*(vr+1.55),y,Math.cos(a)*(vr+1.55),3.4,.8,.3,0,a,0);}
    }else if(part==='ruins'||part==='chips'){
      legacy(parent,.62,part);return;
    }
    batch.flush();
  }
  // Rubble/debris from 3.9 (unchanged look, now shared by both teams).
  function legacy(parent,s,part){
    const batch=A.modelBatch(parent,`bt40:${s}:${part}`),stone=A.material('#a89a88'),shade=A.material('#7d7064'),metal=ironM,add=(geo,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>batch.add(geo,mat,x*s,y*s,z*s,sx*s,sy*s,sz*s,rx,ry,rz);
    if(part==='ruins'){add(cylinder,shade,0,2,0,33,4,33);const rnd=A.rng(3843);for(let i=0;i<11;i++){const a=i*2.399,r=11+17*rnd();add(G.bevel,i%4===0?metal:stone,Math.sin(a)*r,3+rnd()*4,Math.cos(a)*r,5+rnd()*7,4+rnd()*7,5+rnd()*6,rnd()*.6,a,rnd()*.4);}add(G.bevel,woodDarkM,8,5,-6,16,2.4,2.4,.2,.7,.3);}
    else {const rnd=A.rng(3861);for(let i=0;i<6;i++){const a=i*TAU/6,r=(s===1?33:19)/s+rnd()*2;add(G.bevel,i%3===0?metal:shade,Math.sin(a)*r,2+rnd()*1.5,Math.cos(a)*r,4.5,3.5,5,.2,a,.4);}}
    batch.flush();
  }
  // Shared crossbow (side towers) / ballista (core, ×1.6). Front = local +z; the bolt groove
  // passes through the pivot axis at bolt height, so tower shots leave from the weapon.
  const BOLT_Y=5.2;
  function crossbow(parent){
    const batch=A.modelBatch(parent,'bt40:xbow'),add=(...a)=>batch.add(...a);
    add(G.box,ironM,0,.6,0,6.4,1.2,6.4);add(G.bevel,woodDarkM,0,2.4,0,2.4,3,2.4);
    add(G.bevel,woodM,0,BOLT_Y-1.2,1.5,16,2.2,2.6,0,Math.PI/2,0);                                 // stock, grain along it
    for(const sx of [-1,1]){add(G.bevel,woodDarkM,sx*4.7,BOLT_Y-.6,7.7,9.6,1.6,1.4,0,sx*.22,0);   // bow arms swept back
      add(G.box,ironM,sx*9.2,BOLT_Y-.6,5.8,1.2,2.2,1.2);}
    add(G.box,slotM,0,BOLT_Y-.6,5.6,18.2,.35,.35);                                                // string
    add(G.box,ironM,0,BOLT_Y-.6,9.6,3.2,2.6,1.2);                                                 // front stirrup
    add(G.box,ironM,0,BOLT_Y,3.6,.8,.8,13);add(G.oct,trimM,0,BOLT_Y,10.6,1.1,1.1,2.2);            // bolt + head
    add(G.box,ironM,0,BOLT_Y-1.6,-5.8,4.6,2.6,1.6);                                               // winch
    batch.flush();
  }
  function create(t){
    const core=!!t.king,team=t.team?1:0,tc=A.C.team[team],s=core?1:.45;
    const root=new T.Group(),intact=new T.Group(),ruins=new T.Group(),crown=new T.Group(),detail=new T.Group(),chips=new T.Group();
    root.position.set(t.x,0,t.y);root.add(intact,ruins);intact.add(crown,detail,chips);
    const parts=core?coreParts:sideParts;parts(intact,'base');parts(crown,'crown');parts(detail,'detail');parts(chips,'chips');parts(ruins,'ruins');
    ruins.visible=false;chips.visible=false;
    // Crack decals on the four wall faces (textures shared; no runtime allocation per stage).
    const cracks=new T.InstancedMesh(G.plane,decals[0],4), tmp=new T.Object3D();cracks.frustumCulled=false;cracks.renderOrder=3;cracks.castShadow=false;cracks.visible=false;
    const face=core?31.9:17.5,cy=core?35:28,cw=core?40:13,ch=core?30:30;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;tmp.position.set(Math.sin(a)*face,cy,Math.cos(a)*face);tmp.rotation.set(0,a,0);tmp.scale.set(cw,ch,1);tmp.updateMatrix();cracks.setMatrixAt(i,tmp.matrix)}cracks.instanceMatrix.needsUpdate=true;intact.add(cracks);
    A.contact(root,0,0,core?87:46,core?87:46,.085);
    const light=A.lightPool(intact,tc,0,0,core?74:46,core?74:46,.17,.14);
    // Team banners: big one over the gate, tilted ~35° toward the camera so it reads from above, gonfalons on the front turrets.
    const banners=[];
    const flag=(x,y,z,w,h,tilt)=>{const b=A.banner(intact,team,x,y,z,w,h);b.material=bannerCloth[team];b.rotation.x=tilt;b.castShadow=false;banners.push(b);return b;};
    if(core){flag(0,49.8,34.2,25,18,-.62);flag(-28,76.6,29.4,8.5,10,-.62);flag(28,76.6,29.4,8.5,10,-.62);}
    else flag(-9.1,62.6,-13,7.5,8,-.9);   // pennant on the rear corner pole, tilted to the camera
    // Weapon pivot: bolt exactly at the shot origin (render3d heightOf: core 80, side 60).
    const pivot=new T.Group(),kick=new T.Group(),ws=core?1.6:1.25;pivot.position.y=(core?80:SIDE_BOLT)-BOLT_Y*ws;pivot.scale.setScalar(ws);pivot.add(kick);intact.add(pivot);crossbow(kick);
    let angle=team?0:Math.PI;pivot.rotation.y=angle;
    const hp=A.health(root,team,core?40:28,core?100:74),peak=core?90:64;
    let dead=false,collapse=0,stage=-1,attack=0,lastTier=-1,elapsed=0;
    stats.built++;stats.active++;stats.crossbows=(stats.crossbows||0)+1;
    return {t,root,peak,fitBounds:{half:core?42:23,height:core?122:77},weapon:pivot,isDead:()=>dead,isCollapsing:()=>dead&&collapse<1,dispose(){stats.active=Math.max(0,stats.active-1);},update(time,dt,cam,hasAttack){
      const tier=budget();stats.detail=tier;if(tier!==lastTier){lastTier=tier;detail.visible=tier===2;crown.visible=stage<3;}
      if(t.hp<=0){if(!dead){dead=true;ruins.visible=true;ruins.scale.setScalar(.72);stage=4;stats.stageChanges++;}
        collapse=Math.min(1,collapse+dt/.72);const k=collapse,e=k*k;intact.position.y=-peak*.66*e;intact.scale.y=1-.46*e;intact.rotation.z=motion.matches?0:Math.sin(k*22)*.028*(1-k);ruins.scale.setScalar(.72+.28*k);if(k===1)intact.visible=false;A.updateHealth(hp,0,cam,false);return;}
      const r=Math.max(0,Math.min(1,t.hp/t.max)),next=r<=.25?3:r<=.5?2:r<=.75?1:0;
      if(next!==stage){stage=next;stats.stageChanges++;cracks.visible=stage>0;cracks.material=decals[Math.max(0,stage-1)];chips.visible=stage>=2;for(const b of banners)b.visible=stage<3;crown.visible=stage<3;}
      if(hasAttack){attack=.3;stats.attacks++;}
      attack=Math.max(0,attack-dt);const flash=attack/.3;elapsed+=dt;
      light.material.opacity=(.1+.07*r)*(1+flash*1.3);
      const tar=targetMap.get(t);if(tar){const want=Math.atan2(tar.x-t.x,tar.z-t.y);angle+=Math.atan2(Math.sin(want-angle),Math.cos(want-angle))*Math.min(1,dt*(attack>0?18:6));pivot.rotation.y=angle;}
      kick.position.z=motion.matches?0:-flash*flash*2.2;
      if(tier>0&&!motion.matches)for(const b of banners)if(b.visible)A.waveBanner(b,elapsed+b.position.x*.05);
      A.updateHealth(hp,r,cam,r<1);
    }};
  }
  ArenaTowers3D.build=function(t){try{return create(t)}catch(e){stats.fallbacks++;console.warn('Royal Citadels fallback:',e);return oldBuild.call(this,t)}};
})();
