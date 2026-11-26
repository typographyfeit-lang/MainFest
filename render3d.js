'use strict';
// Public renderer contract: V.ok, V.begin(G), V.frame(G), V.pick(event).
// Simulation stays in game.js; renderer never changes unit positions, HP or balance.
const V=(()=>{
  if(!window.THREE||!ArenaArt3D)return {ok:false};
  try{
    const A=ArenaArt3D,{T,G:geo,C}=A, W=360,H=560,RY=280,RW=16;
    const cv=document.querySelector('#cv');
    const presets={low:{dpr:1,shadow:512,particles:48},medium:{dpr:1.5,shadow:1024,particles:96},high:{dpr:2,shadow:2048,particles:160}};
    const requested=new URLSearchParams(location.search).get('quality');const quality=Object.prototype.hasOwnProperty.call(presets,requested)?requested:'medium',q=presets[quality];
    const R=new T.WebGLRenderer({canvas:cv,antialias:quality!=='low',alpha:false,powerPreference:'high-performance'});R.setPixelRatio(Math.min(window.devicePixelRatio||1,q.dpr));R.outputEncoding=T.sRGBEncoding;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=.94;R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
    const sc=new T.Scene(),cam=new T.PerspectiveCamera(22,360/560,1,3000),ray=new T.Raycaster(),gp=new T.Plane(new T.Vector3(0,1,0),0);
    sc.background=A.lin('#22192e');
    const env=ArenaEnvironment3D.build(sc);
    sc.add(new T.HemisphereLight(A.lin('#d8c4ed'),A.lin('#665473'),.67));const sun=new T.DirectionalLight(A.lin('#ffe1c5'),1.12);sun.position.set(60,460,170);sun.target.position.set(180,0,280);sc.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(q.shadow,q.shadow);sun.shadow.bias=-.0004;sun.shadow.normalBias=.30;sun.shadow.radius=2;Object.assign(sun.shadow.camera,{left:-320,right:320,top:370,bottom:-370,near:1,far:920});sun.shadow.camera.updateProjectionMatrix();
    // Soft cool fill: no additional dynamic shadow maps.
    const fill=new T.DirectionalLight(A.lin('#b6c5f7'),.24);fill.position.set(400,190,560);sc.add(fill);
    const zone=new T.Mesh(geo.plane,new T.MeshBasicMaterial({color:A.lin('#78e6ff'),transparent:true,opacity:.085,toneMapped:false,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));zone.rotation.x=-Math.PI/2;zone.scale.set(W,H-RY-RW-10,1);zone.position.set(W/2,.16,(RY+RW+10+H)/2);zone.visible=false;sc.add(zone);
    let towers=[],units=new Map(),effects=new Map(),on=false,last=performance.now();
    const fitPoints=[];
    function bounds(x,y,z,hw,h,hd){for(const dx of [-hw,hw])for(const dz of [-hd,hd])for(const dy of [0,h])fitPoints.push(new T.Vector3(x+dx,y+dy,z+dz))}
    bounds(180,0,280,180,0,280);for(const z of [45,515]){bounds(180,0,z,42,122,42)}for(const x of [90,270])for(const z of [105,455])bounds(x,0,z,34,91,34);for(const x of [45,315])for(const z of [-11,571])bounds(x,0,z,13,z>0?34:47,12);for(const x of [0,360])for(const z of [-8,568])bounds(x,0,z,0,42,0);
    let lastSize='';function fit(){const w=cv.clientWidth||360,h=cv.clientHeight||560;if(w<1||h<1)return;lastSize=w+'x'+h;R.setSize(w,h,false);cam.aspect=w/h;const pitch=Math.max(58,Math.min(64,58+(0.75-w/h)*24));const a=pitch*Math.PI/180,target=new T.Vector3(180,17,280);function put(d){cam.position.set(180,target.y+Math.sin(a)*d,target.z+Math.cos(a)*d);cam.lookAt(target);cam.updateProjectionMatrix();cam.updateMatrixWorld(true)}let lo=160,hi=2700;for(let i=0;i<25;i++){let d=(lo+hi)/2;put(d);const ok=fitPoints.every(p=>{const v=p.clone().project(cam);return Math.abs(v.x)<.978&&Math.abs(v.y)<.978&&v.z<1&&v.z>-1});if(ok)hi=d;else lo=d}put(hi);}
    addEventListener('resize',()=>{if(on&&cv.clientHeight)fit()});if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(on&&cv.clientHeight&&lastSize!==cv.clientWidth+'x'+cv.clientHeight)fit()}).observe(cv);
    // Pooled effects. No per-frame allocation of GPU geometry, material or texture.
    const slots=[];for(let i=0;i<32;i++){const root=new T.Group();root.visible=false;sc.add(root);const sphere=A.mesh(root,geo.sphere,new T.MeshBasicMaterial({color:A.lin('#fff5c5'),toneMapped:false}),0,0,0,2,2,2,0,0,0,false),halo=A.glow(root,'#ffcf77',0,0,0,12,.75),wave=A.mesh(root,geo.torus,new T.MeshBasicMaterial({color:A.lin('#ffc45e'),toneMapped:false,transparent:true,opacity:.8,depthWrite:false}),0,0,0,1,1,1,-Math.PI/2,0,0,false);const tail=A.mesh(root,geo.cyl,new T.MeshBasicMaterial({color:A.lin('#ffc45e'),toneMapped:false,transparent:true,opacity:.48,depthWrite:false}),0,0,0,.8,1,.8,0,0,0,false);tail.visible=false;slots.push({root,sphere,halo,wave,tail,busy:false})}
    const particleMat=new T.MeshBasicMaterial({color:'#fff'}),particles=new T.InstancedMesh(geo.oct,particleMat,q.particles);particles.frustumCulled=false;particles.count=0;sc.add(particles);const pool=Array.from({length:q.particles},()=>({life:0})),pr=A.rng(458),tmp=new T.Object3D(),color=new T.Color(),trailDir=new T.Vector3(),up=new T.Vector3(0,1,0);
    function burst(x,z,y,c,n){for(let i=0;i<n;i++){const p=pool.find(x=>x.life<=0);if(!p)break;const a=pr()*Math.PI*2,s=7+pr()*18;p.x=x;p.z=z;p.y=y;p.vx=Math.cos(a)*s;p.vz=Math.sin(a)*s;p.vy=9+pr()*30;p.max=.35+pr()*.42;p.life=p.max;p.s=.7+pr()*2.2;p.c=c}}
    function updateParticles(dt){let j=0;for(const p of pool){if(p.life<=0)continue;p.life-=dt;if(p.life<=0)continue;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=46*dt;tmp.position.set(p.x,Math.max(.35,p.y),p.z);tmp.rotation.set(p.life*5,p.life*8,0);tmp.scale.setScalar(p.s*Math.min(1,p.life/.15));tmp.updateMatrix();particles.setMatrixAt(j,tmp.matrix);particles.setColorAt(j,color.set(p.c).convertSRGBToLinear());j++}particles.count=j;particles.instanceMatrix.needsUpdate=true;if(particles.instanceColor)particles.instanceColor.needsUpdate=true}
    function remove(o){sc.remove(o.root);A.disposeTree(o.root)}
    let frames=0,elapsed=0,fps=0,frameMs=0,peakCalls=0,peakTriangles=0;
    function begin(state){for(const o of units.values())remove(o);units.clear();for(const o of towers)remove(o);if(window.ArenaAudio)ArenaAudio.begin(state);towers=state.tw.map(t=>{const o=ArenaTowers3D.build(t);sc.add(o.root);return o});effects.clear();for(const s of slots){s.busy=false;s.root.visible=false}for(const p of pool)p.life=0;particles.count=0;zone.visible=false;frames=0;elapsed=0;fps=0;peakCalls=0;peakTriangles=0;on=true;last=performance.now();fit()}
    function frame(state){const now=performance.now(),raw=Math.max(.001,(now-last)/1000),dt=Math.min(.05,raw),time=now/1000;last=now;
      if(lastSize!==cv.clientWidth+'x'+cv.clientHeight&&cv.clientHeight)fit();env.update(time);
      const card=state.sel>=0&&CARDS[state.hand[state.sel]];zone.visible=!!card&&!card.sp&&!state.done;
      const live=new Set(state.u);for(const [u,o] of units)if(!live.has(u)){burst(u.x,u.y,10,C.team[u.team],7);remove(o);units.delete(u)}
      for(const u of state.u){let o=units.get(u);if(!o){o=ArenaCharacters3D.build(u);units.set(u,o);sc.add(o.root);burst(u.x,u.y,2,C.team[u.team],5)}o.update(time,dt,cam)}
      const active=new Set(state.fx),attackers=new Set();for(const [f,s] of effects)if(!active.has(f)){s.busy=false;s.root.visible=false;effects.delete(f)}
      for(const f of state.fx){if(f.k==='l'&&f.a&&f.a.king!==undefined)attackers.add(f.a);let s=effects.get(f);if(!s){s=slots.find(s=>!s.busy);if(!s)continue;s.busy=true;s.root.visible=true;effects.set(f,s);const c=f.k==='c'?'#ffc35e':C.team[f.a.team]||'#ffe2a5';s.sphere.material.color.copy(A.lin(c));s.halo.material.color.copy(A.lin(c));s.wave.material.color.copy(A.lin(c));s.tail.material.color.copy(A.lin(c));if(f.k==='c')burst(f.x,f.y,4,c,13);else if(f.b)burst(f.b.x,f.b.y,12,c,4)}
        if(f.k==='c'){let p=Math.max(0,Math.min(1,1-f.l/.3)),r=f.r*(.24+.76*p);s.root.position.set(f.x,2.5,f.y);s.sphere.visible=false;s.tail.visible=false;s.wave.visible=true;s.wave.scale.set(r,r,.8);s.wave.material.opacity=(1-p)*.9;s.halo.visible=true;s.halo.scale.set(r*1.4,r*1.4,1);s.halo.material.opacity=(1-p)*.55}
        else{let p=Math.max(0,Math.min(1,1-f.l/.1));const a=f.a,b=f.b,ay=a.king===undefined?23:a.king?80:66;s.root.position.set(a.x+(b.x-a.x)*p,ay*(1-p)+13*p+Math.sin(p*Math.PI)*5,a.y+(b.y-a.y)*p);s.sphere.visible=true;s.wave.visible=false;s.halo.visible=true;s.halo.scale.set(12,12,1);s.halo.material.opacity=.40;trailDir.set(b.x-a.x,13-ay,b.y-a.y);const length=Math.min(17,trailDir.length()*.25);if(length>.01){trailDir.normalize();s.tail.visible=true;s.tail.position.copy(trailDir).multiplyScalar(-length*.5);s.tail.quaternion.setFromUnitVectors(up,trailDir);s.tail.scale.set(.65,length,.65)}else s.tail.visible=false}}
      for(const o of towers){if(o.t.hp<=0&&!o.isDead())burst(o.t.x,o.t.y,24,C.team[o.t.team],25);o.update(time,dt,cam,attackers.has(o.t))}
      updateParticles(dt);if(window.ArenaAudio)ArenaAudio.frame(state);R.render(sc,cam);frames++;elapsed+=raw;frameMs=raw*1000;if(elapsed>=1){fps=Math.round(frames/elapsed);frames=0;elapsed=0}peakCalls=Math.max(peakCalls,R.info.render.calls);peakTriangles=Math.max(peakTriangles,R.info.render.triangles);
    }
    function pick(e){const r=cv.getBoundingClientRect();if(!r.width||!r.height)return null;const p=new T.Vector3();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),cam);return ray.ray.intersectPlane(gp,p)?{x:p.x,y:p.z}:null}
    function project(x,z,y=0){const r=cv.getBoundingClientRect(),v=new T.Vector3(x,y,z).project(cam);return {clientX:r.left+(v.x+1)*r.width/2,clientY:r.top+(1-v.y)*r.height/2,ndcX:v.x,ndcY:v.y,ndcZ:v.z}}
    function stats(){return {quality,fps,frameMs:+frameMs.toFixed(2),drawCalls:R.info.render.calls,triangles:R.info.render.triangles,peakCalls,peakTriangles,units:units.size,textures:R.info.memory.textures,geometries:R.info.memory.geometries,three:T.REVISION,canvas:[cv.width,cv.height]}}
    return {ok:true,begin,frame,pick,project,stats};
  }catch(error){console.error('Block Arena renderer:',error);return {ok:false,error:String(error)}}
})();
