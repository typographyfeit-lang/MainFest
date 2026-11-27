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
  function architecture(parent,t,part){
    const team=t.team?1:0,p=palettes[team],core=!!t.king,s=core?1:.45,tc=A.C.team[team],batch=A.modelBatch(parent,`cd38:${team}:${core?'core':'side'}:${part}`);
    const stone=A.material(p.stone), shade=A.material(p.shade), top=A.material(p.top), metal=A.material(p.metal,'gold'), edge=A.material(p.edge,'gold'), dark=A.material(p.dark), emit=A.material(tc,'glow');
    const cyl=team?octagonal:cylinder, add=(geo,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>batch.add(geo,mat,x*s,y*s,z*s,sx*s,sy*s,sz*s,rx,ry,rz);
    const radial=(n,r,fn,phase=0)=>{for(let i=0;i<n;i++){const a=TAU*i/n+phase;fn(Math.sin(a)*r,Math.cos(a)*r,a,i)}};
    if(part==='base'){
      add(cyl,shade,0,2.5,0,35.5,5,35.5);add(cyl,metal,0,6,0,32,2,32);
      add(cyl,top,0,9,0,31,4,31);add(cyl,stone,0,27,0,26,32,26);
      add(cyl,shade,0,13,0,28,3,28);add(cyl,metal,0,43,0,28.5,3.5,28.5);add(cyl,top,0,47,0,30,5,30);add(cyl,metal,0,50,0,29.5,1.8,29.5);
      radial(team?4:6,26,(x,z,a)=>{add(G.box,shade,x,28,z,8,29,7,0,a);add(pillar,top,x,27,z,3.1,28,3.1,0,a);add(G.box,metal,x,41,z,9,3,9,0,a);add(G.box,metal,x,15,z,8,2,8,0,a);},team?Math.PI/4:0);
      // Faceted window frames, inner crystal glass and stone arches. All decoration is inside base footprint.
      radial(team?4:6,25.9,(x,z,a)=>{add(G.arch,dark,x,28,z,10,20,2,0,a);add(G.arch,metal,x*1.02,28,z*1.02,8.7,18,1,0,a);add(G.arch,emit,x*1.05,28,z*1.05,6.1,14,1,0,a);},team?0:Math.PI/6);
      if(core){add(cyl,shade,0,55,0,23,7,23);add(cyl,metal,0,60,0,25,3,25);add(cyl,dark,0,62,0,17,2,17);add(cyl,emit,0,63.1,0,13,1,13);}
      else {add(cyl,shade,0,55,0,26,8,26);add(cyl,metal,0,60,0,28,2.5,28);add(cyl,top,0,62,0,23,3,23);}
    }else if(part==='crown'){
      if(core){radial(team?4:6,24,(x,z,a)=>{add(G.bevel,stone,x,62,z,11,14,10,0,a);add(G.box,metal,x,69,z,12,3,11,0,a);add(spike,metal,x,team?77:74,z,team?4.5:3.5,team?14:8,team?4.5:3.5,0,a);add(G.oct,emit,x*.93,67,z*.93,2,3.5,2,0,a);},team?Math.PI/4:0);}
      else {radial(4,25,(x,z,a)=>{add(G.bevel,top,x,61,z,10,9,9,0,a);add(G.box,metal,x,66,z,11,2,10,0,a);},Math.PI/4);}
    }else if(part==='detail'){
      radial(team?8:12,30.5,(x,z,a)=>{add(G.box,metal,x,9,z,3.3,1.2,2.5,0,a);add(G.oct,edge,x,12,z,1.6,2.2,1.6,0,a);});
      radial(team?4:6,28,(x,z,a)=>{for(const dx of [-2,2]){const c=Math.cos(a),v=Math.sin(a);add(G.box,metal,x+c*dx,28,z-v*dx,.9,23,1.1,0,a);}add(G.oct,emit,x,38,z,2.5,4,1.4,0,a);});
      radial(team?8:12,29,(x,z,a)=>{add(G.box,shade,x,48,z,6.5,2.8,2,0,a);add(G.box,edge,x,50,z,4.8,1,1.6,0,a);});
    }else if(part==='ruins'){
      add(cyl,shade,0,2,0,33,4,33);add(cyl,metal,0,4.5,0,29,1.1,29);
      const rnd=A.rng(3843+team);for(let i=0;i<11;i++){const a=i*2.399,r=11+17*rnd();add(G.bevel,i%4===0?metal:stone,Math.sin(a)*r,3+rnd()*4,Math.cos(a)*r,5+rnd()*7,4+rnd()*7,5+rnd()*6,rnd()*.6,a,rnd()*.4);}
      add(G.oct,emit,0,7,0,3.5,5,3.5,.5,.3,.4);
    }else if(part==='chips'){
      const rnd=A.rng(3861+team);for(let i=0;i<6;i++){const a=i*TAU/6,r=27+rnd()*4;add(G.bevel,i%3===0?metal:shade,Math.sin(a)*r,2+rnd()*1.5,Math.cos(a)*r,4.5,3.5,5,.2,a,.4);}
    }
    batch.flush();
  }
  function create(t){
    const core=!!t.king,team=t.team?1:0,tc=A.C.team[team],s=core?1:.45;
    const root=new T.Group(),intact=new T.Group(),ruins=new T.Group(),crown=new T.Group(),detail=new T.Group(),chips=new T.Group();
    root.position.set(t.x,0,t.y);root.add(intact,ruins);intact.add(crown,detail,chips);
    architecture(intact,t,'base');architecture(crown,t,'crown');architecture(detail,t,'detail');architecture(chips,t,'chips');architecture(ruins,t,'ruins');
    ruins.visible=false;chips.visible=false;
    // Four wall decals share textures; the three stages never allocate geometry at runtime.
    const cracks=new T.InstancedMesh(G.plane,decals[0],4), tmp=new T.Object3D();cracks.frustumCulled=false;cracks.renderOrder=3;cracks.castShadow=false;cracks.visible=false;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;tmp.position.set(Math.sin(a)*26.9*s,28*s,Math.cos(a)*26.9*s);tmp.rotation.set(0,a,0);tmp.scale.set(23*s,27*s,1);tmp.updateMatrix();cracks.setMatrixAt(i,tmp.matrix)}cracks.instanceMatrix.needsUpdate=true;intact.add(cracks);
    A.contact(root,0,0,core?87:37,core?87:37,.085);
    const light=A.lightPool(intact,tc,0,0,core?74:36,core?74:36,.17,.14);
    const banners=[A.banner(intact,team,0,30*s,27.6*s,core?22:9,core?32:14)];
    banners[0].castShadow=false;
    let orb=null,ring=null,mage=null,magePivot=null,staffGlow=null;
    if(core){orb=A.crystal(intact,team,0,85,0,23,32,true);orb.root.traverse(o=>{o.castShadow=false});ring=A.mesh(intact,smallRing,A.material(tc,'glow'),0,64.5,0,17,17,17,-Math.PI/2,0,0,false);}
    else {
      // The actual existing rigged Mage GLB, not a static statuette. Cosmetic scale only.
      magePivot=new T.Group();magePivot.position.y=28.6;magePivot.scale.setScalar(.57);magePivot.rotation.y=team?0:Math.PI;intact.add(magePivot);
      try{mage=ArenaCharacterModels.instantiate('mage',team,magePivot,{shadows:false,level:1});mage.pose('Idle',0,1,true);}catch(e){console.warn('Citadel mage fallback:',e.message);orb=A.crystal(intact,team,0,41,0,12,19,true);orb.root.traverse(o=>{o.castShadow=false});}
      staffGlow=A.glow(intact,tc,0,49,0,18,.25);staffGlow.material.opacity=.08;
    }
    const hp=A.health(root,team,core?40:28,core?114:59),peak=core?107:54;
    let dead=false,collapse=0,stage=-1,attack=0,flinch=0,angle=team?0:Math.PI,lastHp=t.hp,lastTier=-1,tick=0,elapsed=0;
    stats.built++;stats.active++;if(mage)stats.mages++;
    return {t,root,peak,fitBounds:{half:core?42:19,height:core?122:62},isDead:()=>dead,isCollapsing:()=>dead&&collapse<1,dispose(){if(mage)mage.dispose();stats.active=Math.max(0,stats.active-1);},update(time,dt,cam,hasAttack){
      const tier=budget();stats.detail=tier;if(tier!==lastTier){lastTier=tier;detail.visible=tier===2;crown.visible=tier>0&&stage<3;}
      if(t.hp<=0){if(!dead){dead=true;ruins.visible=true;ruins.scale.setScalar(.72);stage=4;stats.stageChanges++;}
        collapse=Math.min(1,collapse+dt/.72);const k=collapse,e=k*k;intact.position.y=-peak*.66*e;intact.scale.y=1-.46*e;intact.rotation.z=motion.matches?0:Math.sin(k*22)*.028*(1-k);ruins.scale.setScalar(.72+.28*k);if(k===1)intact.visible=false;A.updateHealth(hp,0,cam,false);return;}
      const r=Math.max(0,Math.min(1,t.hp/t.max)),next=r<=.25?3:r<=.5?2:r<=.75?1:0;
      if(next!==stage){stage=next;stats.stageChanges++;cracks.visible=stage>0;cracks.material=decals[Math.max(0,stage-1)];chips.visible=stage>=2;banners[0].visible=stage<3;crown.visible=tier>0&&stage<3;if(orb)orb.body.material.emissiveIntensity=[.33,.23,.15,.07][stage];}
      if(t.hp<lastHp)flinch=.18;lastHp=t.hp;flinch=Math.max(0,flinch-dt);
      if(hasAttack){attack=.54;stats.attacks++;if(mage)mage.pose('Attack',0,1,true);}
      attack=Math.max(0,attack-dt);const flash=Math.max(0,attack/.54);elapsed+=dt;tick+=dt;
      light.material.opacity=(.1+.07*r)*(1+flash*1.3);
      if(orb){orb.root.rotation.y=motion.matches?0:elapsed*.40;orb.root.position.y=orb.baseY+(motion.matches?0:Math.sin(elapsed*2.2)*(stage===3?.65:1.1));const v=1+(motion.matches?0:flash*.09);orb.root.scale.setScalar(v);if(stage===3)orb.body.material.emissiveIntensity=.07+.045*(.5+.5*Math.sin(elapsed*11));}
      if(ring)ring.rotation.z=motion.matches?0:elapsed*.18;
      if(mage&&magePivot){const tar=targetMap.get(t);if(tar&&attack>0){const want=Math.atan2(tar.x-t.x,tar.z-t.y);angle+=Math.atan2(Math.sin(want-angle),Math.cos(want-angle))*Math.min(1,dt*14);}
        magePivot.rotation.y=angle;const interval=tier===0?1/12:tier===1?1/20:1/30;
        if(tick>=interval||hasAttack){mage.pose(attack>0?'Attack':flinch>0?'Hit':'Idle',motion.matches&&!hasAttack?0:tick,1);tick=0;}
      }
      if(staffGlow)staffGlow.material.opacity=tier>0?.05+flash*.28:0;
      if(tier>0&&!motion.matches&&banners[0].visible)A.waveBanner(banners[0],elapsed);
      A.updateHealth(hp,r,cam,r<1);
    }};
  }
  ArenaTowers3D.build=function(t){try{return create(t)}catch(e){stats.fallbacks++;console.warn('Royal Citadels fallback:',e);return oldBuild.call(this,t)}};
})();
