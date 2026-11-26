'use strict';
/* Imperial Sanctuary — detail pass. All added objects are visual, never colliders.
   The 3.6/3.5 visual layer remains responsible for the original field and team cues. */
(()=>{
  if(typeof ArenaEnvironment3D==='undefined'||!ArenaEnvironment3D||typeof ArenaArt3D==='undefined'||!ArenaArt3D||new URLSearchParams(location.search).get('visual')==='legacy')return;
  const A=ArenaArt3D,T=A.T,TAU=Math.PI*2,motion=matchMedia('(prefers-reduced-motion: reduce)'),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const tier=new URLSearchParams(location.search).get('quality');const budget=()=>Math.min(tier==='low'?0:2,window.CDPerformance?.level?.()??1);
  const palette={royal:['#82d9e9','#29445d','#ffe1aa'],forest:['#83dbad','#345b50','#e2ca93'],frost:['#addcf9','#4d6489','#d9e8fa'],ember:['#f6ab63','#82482d','#ffcd83'],sky:['#c1e3ff','#6987b3','#fff0ca']};
  const info={ready:false,world:'royal',decorHz:0,channels:0,bridges:0,activeResidues:0,level:0,beam:false};window.CDImperial={stats:()=>({...info})};
  const original=ArenaEnvironment3D.build;
  const color=c=>A.lin(c);
  // A seamless water caustic pattern, generated once; move UVs rather than uploading vertices.
  const waterTex=A.texture(128,128,(g,w,h)=>{g.fillStyle='#d9ecf7';g.fillRect(0,0,w,h);let r=A.rng(3701);for(let i=0;i<24;i++){const x=r()*w,y=r()*h;g.strokeStyle=i%3?'#7b9ab84f':'#fffdf3ae';g.lineWidth=1+r()*2;for(const xx of [-128,0,128])for(const yy of [-128,0,128]){g.beginPath();g.moveTo(x+xx-16,y+yy);g.bezierCurveTo(x+xx-8,y+yy-9,x+xx+9,y+yy+11,x+xx+19,y+yy-2);g.stroke()}}},true);waterTex.repeat.set(2,12);
  const foamTex=A.texture(128,64,(g,w,h)=>{const a=g.createLinearGradient(0,0,w,0);a.addColorStop(0,'#e8f8ffbb');a.addColorStop(.26,'#d2f2ff88');a.addColorStop(1,'#e8f8ff00');g.fillStyle=a;g.fillRect(0,0,w,h);const r=A.rng(371);for(let i=0;i<120;i++){const x=r()*w*.6,y=r()*h;g.fillStyle='#ffffff66';g.beginPath();g.ellipse(x,y,1+r()*3,.5+r(),0,0,TAU);g.fill()}},true);foamTex.repeat.set(1,7);
  const waterMat=new T.MeshStandardMaterial({map:waterTex,color:color(palette.royal[0]),roughness:.4,metalness:.12});
  const foamMat=new T.MeshBasicMaterial({map:foamTex,color:color('#e9faff'),transparent:true,opacity:.52,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const shrineTex=A.texture(256,256,(g)=>{g.translate(128,128);g.lineCap='round';g.lineJoin='round';for(const [rr,lw] of [[119,1.6],[112,1.2],[106,1.1]]){g.beginPath();g.arc(0,0,rr,0,TAU);g.lineWidth=lw;g.strokeStyle='#f5dca6';g.stroke()}for(let j=0;j<16;j++){g.save();g.rotate(j*TAU/16);g.strokeStyle='#ffe6b0';g.lineWidth=1.5;g.beginPath();g.moveTo(0,-116);g.lineTo(5,-110);g.lineTo(0,-104);g.lineTo(-5,-110);g.closePath();g.stroke();g.restore()}});
  const shrineMat=new T.MeshBasicMaterial({map:shrineTex,transparent:true,depthWrite:false,color:color('#f4cc85'),toneMapped:false,opacity:.7,side:T.DoubleSide});
  const beamTex=A.texture(64,128,(g,w,h)=>{const a=g.createLinearGradient(0,0,w,0);a.addColorStop(0,'#ffffff00');a.addColorStop(.5,'#ffffff95');a.addColorStop(1,'#ffffff00');g.fillStyle=a;g.fillRect(0,0,w,h);g.globalCompositeOperation='destination-in';const b=g.createLinearGradient(0,0,0,h);b.addColorStop(0,'#ffffff00');b.addColorStop(.3,'#ffffff55');b.addColorStop(.75,'#ffffffdd');b.addColorStop(1,'#ffffff00');g.fillStyle=b;g.fillRect(0,0,w,h)});
  const beamMat=new T.MeshBasicMaterial({map:beamTex,transparent:true,depthWrite:false,opacity:.2,side:T.DoubleSide,toneMapped:false,blending:T.AdditiveBlending});
  const residueTex=A.texture(128,128,(g,w,h)=>{const a=g.createRadialGradient(64,64,0,64,64,63);a.addColorStop(0,'#251c27b8');a.addColorStop(.45,'#49304180');a.addColorStop(.72,'#76504340');a.addColorStop(1,'#2a172700');g.fillStyle=a;g.fillRect(0,0,w,h);g.strokeStyle='#f6c17a66';g.lineWidth=1;for(let i=0;i<7;i++){const angle=i*TAU/7;g.beginPath();g.moveTo(64+Math.cos(angle)*12,64+Math.sin(angle)*12);g.lineTo(64+Math.cos(angle+.06)*35,64+Math.sin(angle+.06)*35);g.lineTo(64+Math.cos(angle-.1)*50,64+Math.sin(angle-.1)*50);g.stroke()}});
  const residueMat=new T.MeshBasicMaterial({map:residueTex,transparent:true,opacity:.43,depthWrite:false,toneMapped:false});
  ArenaEnvironment3D.build=function(scene){
    const base=original.call(this,scene);if(!base?.root)return base;
    const root=new T.Group();root.name='Imperial rivers and shrine';base.root.add(root);
    const banks=new T.Group(),bridges=new T.Group(),rich=new T.Group();root.add(banks,bridges,rich);
    // Perimeter streams, north canal and two ornamental bridges. None cross the playable rectangle.
    for(const x of [-31,391]){A.mesh(banks,A.G.plane,waterMat,x,-.4,280,23,530,1,-Math.PI/2,0,0,false);A.mesh(rich,A.G.plane,foamMat,x+(x<0?10:-10),-.30,280,4,520,1,-Math.PI/2,0,x<0?0:Math.PI,false)}
    const northMat=waterMat.clone();northMat.map=waterTex;A.mesh(banks,A.G.plane,northMat,180,-.4,-91,360,25,1,-Math.PI/2,0,0,false);
    // Batching: 2 materials, one wood and one stone/gold family per group.
    const batch=A.batch(bridges),wood=A.material('#b58c60','wood'),stone=A.stone,gold=A.gold;
    for(const x of [95,265]){for(let i=0;i<7;i++){const z=-110+i*6;batch.add(A.G.box,wood,x,2.7,z,22,2,5.7,0,0,0,null,false)}for(const s of [-1,1]){batch.add(A.G.box,stone,x+s*12,1.1,-92,3,4,42,0,0,0,'#94828b',false);for(const z of [-110,-92,-74])batch.add(A.G.bevel,stone,x+s*12,4,z,4,6,4,0,0,0,'#a9979b',false);batch.add(A.G.box,gold,x+s*12,7,-92,1.4,1.3,38,0,0,0,null,false)}}batch.flush();
    const floral=A.batch(rich),r=A.rng(3711);for(const x of [-32,392])for(let j=0;j<8;j++){const z=33+70*j+r()*6;floral.add(A.G.leaf,A.material('#738d67','skin'),x,.5,z,4,.6,4,0,r()*TAU,0,null,false);floral.add(A.G.leaf,A.material('#d19dbb','skin'),x+1,1.2,z,1.4,1.1,1.5,0,r()*TAU,0,null,false)}floral.flush();
    const seal=A.mesh(root,A.G.plane,shrineMat,180,.46,280,128,128,1,-Math.PI/2,0,0,false);seal.name='Imperial outer seal';
    const beam=A.mesh(root,A.G.plane,beamMat,180,45,280,13,74,1,0,0,0,false);beam.visible=false;beam.renderOrder=4;
    const residues=new T.InstancedMesh(A.G.plane,residueMat,8);residues.count=0;residues.frustumCulled=false;residues.castShadow=false;residues.visible=false;root.add(residues);
    const marks=Array.from({length:8},()=>({on:false,age:0,x:0,z:0,r:0}));const tmp=new T.Object3D();let stateRef=null,seen=new WeakSet(),last=-100,world='',lastLevel=-1,lastOwner=-2,prevElapsed=0;
    function addResidue(x,z,r,t){const p=marks.find(o=>!o.on)||marks.reduce((a,b)=>a.age<b.age?a:b);Object.assign(p,{on:true,age:t,x,z,r})}
    const update=base.update;base.update=function(time,state){const res=update.call(this,time,state);if(!state)return res;const l=budget(),on=!motion.matches&&window.CDRoyal?.vfx?.()!==false,elapsed=clamp(180-(state.t??180),0,180)+(state.done?(state.finishAge||0):0);
      if(state!==stateRef){stateRef=state;seen=new WeakSet();marks.forEach(p=>p.on=false);last=-100;prevElapsed=0;world='';lastLevel=-1;lastOwner=-2}
      const key=window.CDRoyal?.selected?.()||'royal';if(world!==key){world=key;const p=palette[key]||palette.royal;waterMat.color.copy(color(p[0]));northMat.color.copy(color(p[0]));shrineMat.color.copy(color(p[2]));info.world=key}
      // Immediate quality changes; light/eco hides peripheral streams and transparent add-ons.
      if(lastLevel!==l){lastLevel=l;banks.visible=l>0;bridges.visible=l>0;rich.visible=l===2;seal.visible=l>0;info.level=l;info.channels=l>0?3:0;info.bridges=l>0?2:0}
      const sh=state.shrine,owner=sh?.owner??-1;if(lastOwner!==owner){lastOwner=owner;beamMat.color.copy(color(owner===0?A.C.team[0]:owner===1?A.C.team[1]:'#ffdb90'))}
      const hz=l===2?20:l===1?12:0;info.decorHz=hz;
      if(state.paused||!on||l===0){beam.visible=false;residues.visible=false;residues.count=0;info.beam=false;info.activeResidues=0;for(const f of state.fx||[])seen.add(f);if(l===0||!on)marks.forEach(p=>p.on=false);return res}
      // Collect short simulation events each render so effects are not lost when decor is throttled.
      for(const f of state.fx||[])if(!seen.has(f)){seen.add(f);if(f.k==='c'&&['meteor','imp','mage','spark'].includes(f.card)&&Number.isFinite(f.x)&&Number.isFinite(f.y))addResidue(f.x,f.y,Math.min(48,f.r||25),elapsed)}
      if(elapsed<last||elapsed-last>=1/hz||last<0){last=elapsed;waterTex.offset.y=-(elapsed*.23%1);foamTex.offset.y=-(elapsed*.14%1);seal.rotation.z=elapsed*.09;
        const urgency=sh&&sh.next<=5?1-sh.next/5:0;beam.visible=l===2&&(urgency>.15||(sh?.pulse||0)>.25);beamMat.opacity=.10+.13*Math.max(urgency,Math.min(1,sh?.pulse||0));seal.material.opacity=.5+.15*Math.sin(elapsed*.7)**2;info.beam=beam.visible;
        let n=0;for(const p of marks){if(!p.on)continue;if(elapsed-p.age>5){p.on=false;continue}if(n>=(l===2?8:3))continue;const age=Math.max(0,elapsed-p.age),scale=p.r*2*(1-.16*age/5);tmp.position.set(p.x,.25+n*.002,p.z);tmp.rotation.set(-Math.PI/2,0,p.x*.13);tmp.scale.set(scale,scale,1);tmp.updateMatrix();residues.setMatrixAt(n++,tmp.matrix)}residues.count=n;residues.visible=n>0;residues.instanceMatrix.needsUpdate=true;info.activeResidues=n;
      }
      return res;
    };info.ready=true;return base;
  };
})();
