'use strict';
/* 3.3.2 adaptive scenery. Loaded AFTER environment.js and BEFORE render3d.js.
   Decor uses no colliders; the 3.1 build and update contracts are preserved. */
(() => {
  if(typeof ArenaEnvironment3D==='undefined'||!ArenaEnvironment3D||typeof ArenaArt3D==='undefined'||!ArenaArt3D||typeof THREE==='undefined')return;
  const T=THREE,A=ArenaArt3D,TAU=Math.PI*2,original=ArenaEnvironment3D.build;
  const motion=matchMedia('(prefers-reduced-motion: reduce)'), params=new URLSearchParams(location.search), modes=['auto','light','static'];
  const key='cd-arena-effects-v33';let choice='auto';try{choice=localStorage.getItem(key)||'auto'}catch(_){}if(!modes.includes(choice))choice='auto';if(modes.includes(params.get('arena')))choice=params.get('arena');
  const select=document.querySelector('#arena-effects');if(select){select.value=choice;select.addEventListener('change',()=>{choice=modes.includes(select.value)?select.value:'auto';try{localStorage.setItem(key,choice)}catch(_){}})}
  const detail=params.get('quality')==='high'?2:params.get('quality')==='low'?0:1;
  const mode=()=>motion.matches||choice==='static'?'static':choice==='light'||detail===0?'light':(window.CDPerformance?.level?.()??1)===0?'light':(window.CDPerformance?.level?.()??1)===2?'rich':'balanced';
  const lin=c=>A.lin(c), col=(c)=>lin(c), rnd=A.rng(33033), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  let diag={ready:false};window.Battlefield33={stats:()=>({...diag,mode:mode()})};
  function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t}
  function batch(parent,geo,mat,items){const m=new T.InstancedMesh(geo,mat,items.length),o=new T.Object3D();m.castShadow=false;m.receiveShadow=false;m.frustumCulled=false;items.forEach((it,i)=>{o.position.set(...it.p);o.rotation.set(...(it.r||[0,0,0]));o.scale.set(...it.s);o.updateMatrix();m.setMatrixAt(i,o.matrix);if(it.c)m.setColorAt(i,col(it.c))});m.instanceMatrix.needsUpdate=true;parent.add(m);return m}
  function scenery(scene,base){
    const root=new T.Group();root.name='Living Battlefield 3.3';base.root.add(root);
    const outside=new T.Group(),motionDecor=new T.Group();root.add(outside,motionDecor);
    const stone=new T.MeshStandardMaterial({color:lin('#ffffff'),roughness:.91,metalness:.03}),gold=new T.MeshStandardMaterial({color:lin('#b99358'),roughness:.55,metalness:.36}),box=new T.BoxGeometry(1,1,1),oct=new T.OctahedronGeometry(1,0);
    // Low, carved spillways outside both side walls. The battlefield itself stays at y=0.
    const masonry=[],inlay=[],cliffs=[];const falls=[];
    for(const x of [-27,387])for(const z of [58,387]){
      masonry.push({p:[x,19,z],s:[19,33,16],c:'#76647f'},{p:[x,37,z],s:[22,5,20],c:'#a091a7'},{p:[x,2,z+12],s:[25,5,29],c:'#50435e'});
      inlay.push({p:[x,37,z+10.2],s:[21,1.4,1.4]},{p:[x,20,z+8.3],s:[18,1.1,1.0]});falls.push({x,z:z+10.5});
    }
    // Distant rock silhouettes, behind the far terrace. Kept well away from units and camera target.
    for(let i=0;i<12;i++){let x=-128+i*57,h=42+rnd()*65;cliffs.push({p:[x,-8+h*.25,-113-rnd()*80],s:[38+rnd()*35,h,32+rnd()*45],r:[.12,rnd()*TAU,.12],c:['#413951','#51415f','#68536f'][i%3]})}
    batch(outside,box,stone,masonry);batch(outside,box,gold,inlay);const mountains=batch(outside,oct,stone,cliffs);mountains.visible=detail>0;
    // Two-sided animated water material. A tiled, vertically flowing caustic texture, not a video.
    const water=texture(96,128,(g,w,h)=>{const a=g.createLinearGradient(0,0,w,0);a.addColorStop(0,'#8ed9fc15');a.addColorStop(.2,'#64cfe8ad');a.addColorStop(.46,'#a8edffef');a.addColorStop(.7,'#5d95deaa');a.addColorStop(1,'#6fb7dd15');g.fillStyle=a;g.fillRect(0,0,w,h);const rr=A.rng(733);for(let i=0;i<85;i++){g.fillStyle=i%3===0?'#e7fcff90':'#b6efff40';let x=rr()*w,y=rr()*h,d=12+rr()*64;g.fillRect(x,y,.6+rr()*2,d);if(y+d>h)g.fillRect(x,0,.6+rr(),y+d-h)}});
    water.wrapT=T.RepeatWrapping;water.repeat.set(1,1.65);
    const waterMat=new T.MeshBasicMaterial({map:water,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false,toneMapped:false});
    const fallMesh=batch(outside,new T.PlaneGeometry(1,1),waterMat,falls.map(p=>({p:[p.x,19.5,p.z],s:[15,32,1]})));fallMesh.renderOrder=3;
    const mist=texture(128,128,(g)=>{const a=g.createRadialGradient(64,64,0,64,64,64);a.addColorStop(0,'#c9d9eea0');a.addColorStop(.45,'#becbe655');a.addColorStop(1,'#b3bde000');g.fillStyle=a;g.fillRect(0,0,128,128)});
    const mistMat=new T.MeshBasicMaterial({map:mist,transparent:true,opacity:.27,depthWrite:false,toneMapped:false,side:T.DoubleSide});
    const fogItems=falls.flatMap((p,i)=>Array.from({length:3},(_,j)=>({x:p.x+(j-1)*5,z:p.z+8+j*3,y:5+3*j,ph:i*1.8+j*.8})));const tmp=new T.Object3D();
    const mistMesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),mistMat,fogItems.length);mistMesh.frustumCulled=false;motionDecor.add(mistMesh);mistMesh.renderOrder=4;
    // Four narrow carved banners on the outside of the side walls. Cloth vertices sway in one batch.
    const flagTex=texture(64,96,(g,w,h)=>{g.fillStyle='#332544';g.fillRect(0,0,w,h);g.fillStyle='#b99665';g.fillRect(2,0,2,h);g.fillRect(w-4,0,2,h);g.strokeStyle='#f8d69a';g.lineWidth=2;g.beginPath();g.moveTo(w/2,12);g.lineTo(w-14,46);g.lineTo(w/2,76);g.lineTo(14,46);g.closePath();g.stroke();g.strokeRect(27,39,10,14)});
    const flagMat=new T.MeshBasicMaterial({map:flagTex,side:T.DoubleSide,transparent:true,opacity:.92});const fg=new T.PlaneGeometry(1,1,5,8),fp=fg.attributes.position,orig=new Float32Array(fp.array);
    const flags=[],poles=[];for(const x of [-11,371])for(const z of [125,445]){flags.push({p:[x,26,z],s:[9,17,1],c:z<280?'#d0b0ff':'#80ecf9'});poles.push({p:[x,29,z-2],s:[1.4,28,1.4]},{p:[x,35,z-1],s:[12,1.2,1.2]})}
    const flagMesh=batch(motionDecor,fg,flagMat,flags);batch(outside,box,gold,poles);
    // A few wind-swaying leaves on the OUTER terrace, one instanced draw call.
    const leaves=[];for(let i=0;i<24;i++){const side=i%2?-1:1;leaves.push({x:side<0?-17:377,z:20+Math.floor(i/2)*44+rnd()*8,y:1.9,ph:rnd()*TAU,az:rnd()*TAU,sz:3+rnd()*2})}
    const leafMat=new T.MeshStandardMaterial({color:lin('#66865b'),roughness:1,side:T.DoubleSide});const leafGeo=new T.SphereGeometry(1,5,3);const leafMesh=new T.InstancedMesh(leafGeo,leafMat,leaves.length);leafMesh.frustumCulled=false;motionDecor.add(leafMesh);
    // Warm crystal torches; visual glow baked into the material to avoid adding shadow-casting lights.
    const flameMat=new T.MeshBasicMaterial({color:lin('#ffb660'),transparent:true,opacity:.85,toneMapped:false});const flameGeo=new T.OctahedronGeometry(1,0);const flames=[];for(const x of [-8,368])for(const z of [40,520])flames.push({x,z,y:27,ph:rnd()*TAU});
    const flameMesh=new T.InstancedMesh(flameGeo,flameMat,flames.length);flameMesh.frustumCulled=false;motionDecor.add(flameMesh);
    const haloTex=texture(64,64,g=>{const a=g.createRadialGradient(32,32,0,32,32,32);a.addColorStop(0,'#ffe1ab96');a.addColorStop(.35,'#ffb85d55');a.addColorStop(1,'#ffb85d00');g.fillStyle=a;g.fillRect(0,0,64,64)});
    const halos=batch(motionDecor,new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:haloTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide}),flames.map(f=>({p:[f.x,18,f.z],r:[-Math.PI/2,0,0],s:[25,25,1]})));halos.renderOrder=4;
    // Additional shrine seal: thin gold runes rotate on the ground; ownership is never obscured.
    const runet=texture(256,256,(g,w,h)=>{g.translate(w/2,h/2);g.lineWidth=1.7;g.strokeStyle='#ffe8b5';for(let i=0;i<12;i++){g.save();g.rotate(i*TAU/12);g.beginPath();g.moveTo(0,-116);g.lineTo(5,-110);g.lineTo(0,-104);g.lineTo(-5,-110);g.closePath();g.stroke();g.restore()}g.setLineDash([12,7]);g.beginPath();g.arc(0,0,119,0,TAU);g.stroke()});
    const runemat=new T.MeshBasicMaterial({map:runet,color:lin('#ffcc80'),transparent:true,opacity:.7,depthWrite:false,toneMapped:false,side:T.DoubleSide});const rune=new T.Mesh(new T.PlaneGeometry(117,117),runemat);rune.rotation.x=-Math.PI/2;rune.position.set(180,.39,280);root.add(rune);rune.renderOrder=3;
    const particleMat=new T.MeshBasicMaterial({color:lin('#ffde8d'),transparent:true,opacity:.84,toneMapped:false});const N=detail===2?20:12;
    const particles=new T.InstancedMesh(new T.OctahedronGeometry(1,0),particleMat,N);particles.frustumCulled=false;root.add(particles);
    const waveMat=new T.MeshBasicMaterial({color:lin('#ffe5a0'),transparent:true,opacity:0,depthWrite:false,toneMapped:false,side:T.DoubleSide});const wave=new T.Mesh(new T.RingGeometry(.91,1,64),waveMat);wave.rotation.x=-Math.PI/2;wave.position.set(180,.45,280);wave.visible=false;root.add(wave);wave.renderOrder=5;
    let prevOwner=-10,awardSum=0,burstAge=3,lastT=180,lastElapsed=0,phase=0,first=true,frames=0,lastMode='', lastDecor=-1, decorTicks=0;
    let meshCount=0;root.traverse(o=>{if(o.isMesh)meshCount++});
    diag={ready:true,frames:0,decorTicks:0,phase:0,waterfalls:falls.length,flags:flags.length,particles:0,awardWave:false,quality:detail,extraMeshes:meshCount};
    function update(_time,state){
      // Use game time, not Date.now(): pause and background never advance the scene.
      const remain=Number.isFinite(state?.t)?state.t:180,elapsed=clamp(180-remain,0,180)+(state?.done?(state.finishAge||0):0);
      if(remain>lastT+1||first){burstAge=3;awardSum=0;phase=0;lastDecor=-1;lastElapsed=elapsed;first=false}
      const dt=state?.paused?0:clamp(elapsed-lastElapsed,0,.1);lastElapsed=elapsed;lastT=remain;
      const m=mode(),animated=m!=='static',rich=m==='rich',balanced=m==='balanced',moving=rich||balanced;
      if(animated)phase+=dt;const t=phase,changed=m!==lastMode;
      const due=changed||(animated&&!state?.paused&&t-lastDecor>= (rich?1/30:balanced?1/20:1/12)-.001);
      const activeN=rich?N:balanced?Math.min(6,N):0;
      // Preserve existing capture interpolation and effects, even when NEW decorations are static.
      // Simulation time stops during pause; the original environment remains the source of game cues.
      base.update(elapsed,state);
      const sh=state?.shrine,owner=sh?.owner??-1,urgency=sh&&sh.next<=5?clamp(1-sh.next/5,0,1):0;
      const sum=(sh?.awards?.[0]||0)+(sh?.awards?.[1]||0);if(sum>awardSum)burstAge=0;awardSum=sum;burstAge+=dt;
      if(owner!==prevOwner){prevOwner=owner;const c=owner===0?'#7deeff':owner===1?'#d5a0ff':'#ffcf84';runemat.color.copy(lin(c));particleMat.color.copy(lin(c))}
      rune.rotation.z=animated?t*.16:0;runemat.opacity=.24+urgency*.5;particles.visible=activeN>0&&(urgency>0||burstAge<1.6);   // 4.4: swirl only before/at the awardparticles.count=activeN;
      if(due&&moving){for(let i=0;i<activeN;i++){const a=i*TAU/activeN+t*(.25+urgency*.5),h=((i/activeN+t*.24)%1),r=8+12*h;tmp.position.set(180+Math.cos(a)*r,17+h*32,280+Math.sin(a)*r);tmp.rotation.set(a,t+i,0);tmp.scale.setScalar((.65+urgency*.55)*(1-.5*h));tmp.updateMatrix();particles.setMatrixAt(i,tmp.matrix)}particles.instanceMatrix.needsUpdate=true}
      wave.visible=animated&&burstAge<1.25;const k=clamp(burstAge/1.25,0,1);if(wave.visible){wave.scale.setScalar(16+76*k);waveMat.opacity=.72*(1-k)*(1-k)}
      // Low mode still shows waterfall material, static flags and shrine signals. Rich mode adds mist and sway.
      mistMesh.visible=moving;mistMesh.count=rich?fogItems.length:balanced?Math.min(4,fogItems.length):0;mountains.visible=moving&&detail>0;halos.visible=moving;leafMesh.visible=m!=='light';
      if(due)water.offset.y=animated?-(t*.52%1):0;
      if(due&&(moving||changed)){for(let i=0;i<fp.count;i++){const x=orig[3*i],y=orig[3*i+1];fp.setZ(i,moving?Math.sin(t*1.9+x*5+y*4)*2.1*(.5-y):0)}fp.needsUpdate=true;
        for(let i=0;i<leaves.length;i++){const p=leaves[i];tmp.position.set(p.x,p.y,p.z);tmp.rotation.set(.2,p.az,.65+(rich?Math.sin(t*1.7+p.ph)*.22:0));tmp.scale.set(1.2,p.sz,.65);tmp.updateMatrix();leafMesh.setMatrixAt(i,tmp.matrix)}leafMesh.instanceMatrix.needsUpdate=true;
        for(let i=0;i<flames.length;i++){const p=flames[i];tmp.position.set(p.x,p.y,p.z);tmp.rotation.set(0,t*.8+p.ph,rich?Math.sin(t*3+p.ph)*.16:0);tmp.scale.set(2.4,4.5+(rich?Math.sin(t*4+p.ph)*.8:0),2.4);tmp.updateMatrix();flameMesh.setMatrixAt(i,tmp.matrix)}flameMesh.instanceMatrix.needsUpdate=true;
      }
      if(due&&moving){for(let i=0;i<mistMesh.count;i++){const p=fogItems[i];tmp.position.set(p.x+Math.sin(t*.45+p.ph)*5,p.y+Math.sin(t*.7+p.ph)*1.5,p.z+Math.cos(t*.3+p.ph)*6);tmp.rotation.set(-Math.PI/3,0,p.ph);tmp.scale.set(18+Math.sin(t*.3+p.ph)*3,12,1);tmp.updateMatrix();mistMesh.setMatrixAt(i,tmp.matrix)}mistMesh.instanceMatrix.needsUpdate=true}
      if(due){flameMat.opacity=animated&&moving?.75+.12*Math.sin(t*4):.78;lastDecor=t;decorTicks++;}
      lastMode=m;frames++;diag.frames=frames;diag.decorTicks=decorTicks;diag.phase=phase;diag.particles=activeN;diag.awardWave=wave.visible;diag.decorHz=animated?(rich?30:balanced?20:12):0;
    }
    return {root:base.root,update};
  }
  ArenaEnvironment3D.build=function(scene){const base=original.call(this,scene);try{return scenery(scene,base)}catch(e){const layer=base.root?.getObjectByName('Living Battlefield 3.3');if(layer){base.root.remove(layer);const geometries=new Set(),materials=new Set(),textures=new Set();layer.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material])){materials.add(m);if(m.map)textures.add(m.map)}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose()}console.warn('Living Battlefield scenery fallback:',e.message);diag={ready:false,error:String(e.message)};return base}};
})();
