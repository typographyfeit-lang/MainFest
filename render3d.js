'use strict';
// Crystal Dominion 3.9 — WebGL renderer (Three.js r128), Royal Citadels camera.
// Public contract: V.ok, V.prepare(), V.begin(G), V.frame(G), V.pick(event), V.project(x, z, y),
// V.preview(point, card, valid), V.stop(), V.stats().
// The renderer only reads the simulation (game.js); it never changes positions, HP or balance.
const V = (() => {
  const ready = typeof THREE !== 'undefined' && typeof ArenaArt3D !== 'undefined' && ArenaArt3D &&
    typeof ArenaEnvironment3D !== 'undefined' && ArenaEnvironment3D && typeof ArenaHDModels !== 'undefined' && ArenaHDModels &&
    typeof ArenaTowers3D !== 'undefined' && ArenaTowers3D && typeof ArenaCharacterModels !== 'undefined' && ArenaCharacterModels &&
    typeof ArenaCharacters3D !== 'undefined' && ArenaCharacters3D;
  if (!ready) return { ok: false };
  try {
    const A = ArenaArt3D, { T, G: geo, C } = A;
    const W = 360, H = 560, DEPLOY = 322;
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const easeOut = k => 1 - (1 - k) * (1 - k);
    const cv = document.querySelector('#cv'), perf = document.querySelector('#perf');
    const params = new URLSearchParams(location.search), debug = params.get('debug') === '1';
    if (perf) perf.hidden = !debug;
    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------ quality */
    // Medium keeps a static shadow map (architecture only); units use soft contact shadows.
    const PRESETS = {
      low: { dpr: 1, shadow: 0, particles: 48, glows: 220, motes: 0, unitShadows: false },
      medium: { dpr: 1.5, shadow: 1024, particles: 96, glows: 380, motes: 26, unitShadows: false },
      high: { dpr: 2, shadow: 2048, particles: 160, glows: 540, motes: 40, unitShadows: true }
    };
    const requested = params.get('quality');
    const quality = has(PRESETS, requested) ? requested : 'medium', q = PRESETS[quality], adaptive = !has(PRESETS, requested);
    const maxDpr = () => Math.min(window.devicePixelRatio || 1, q.dpr);
    let dpr = maxDpr(), shadowReduced = false;

    const R = new T.WebGLRenderer({ canvas: cv, antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' });
    R.setPixelRatio(dpr);
    R.outputEncoding = T.sRGBEncoding;
    R.toneMapping = T.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = q.shadow > 0;
    R.shadowMap.type = T.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = q.unitShadows;          // static map on Medium, refreshed on demand
    if (R.info) R.info.autoReset = false;             // so the counter includes the shadow pass

    /* ------------------------------------------------------------ scene */
    const sc = new T.Scene(), perspective = new T.PerspectiveCamera(22, W / H, 1, 3000), ray = new T.Raycaster();
    const orthographic = new T.OrthographicCamera(-180,180,280,-280,1,3000), shotPerspective = new T.PerspectiveCamera(), shotOrtho = new T.OrthographicCamera();
    let cam=perspective, baseCamera=perspective;
    const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    sc.background = A.lin('#22192e');
    const env = ArenaEnvironment3D.build(sc);
    // Authored six-face LDR reflection environment; High only, to avoid PMREM start-up cost elsewhere.
    if (quality === 'high' && T.CubeTexture) {
      try {
        const faces = Array.from({ length: 6 }, (_, i) => {
          const c = document.createElement('canvas'); c.width = c.height = 64;
          const g = c.getContext('2d'), a = g.createLinearGradient(0, 0, 64, 64);
          a.addColorStop(0, i === 2 ? '#b2a2c8' : '#695875'); a.addColorStop(.6, '#352a47'); a.addColorStop(1, '#171321');
          g.fillStyle = a; g.fillRect(0, 0, 64, 64);
          if (i === 0 || i === 2 || i === 4) {
            const r = g.createRadialGradient(19, 18, 1, 19, 18, 28);
            r.addColorStop(0, '#fff1ca'); r.addColorStop(.32, '#d9b5a2a0'); r.addColorStop(1, '#d9b5a200');
            g.fillStyle = r; g.fillRect(0, 0, 64, 64);
          }
          return c;
        });
        const cube = new T.CubeTexture(faces); cube.encoding = T.sRGBEncoding; cube.needsUpdate = true; sc.environment = cube;
      } catch (e) { console.warn('Reflection environment disabled:', e.message); }
    }
    sc.add(new T.HemisphereLight(A.lin('#ded0e8'), A.lin('#66516b'), .63));
    const sun = new T.DirectionalLight(A.lin('#ffe6cc'), 1.19);
    sun.position.set(70, 530, 170); sun.target.position.set(180, 0, 280); sc.add(sun, sun.target);
    sun.castShadow = q.shadow > 0;
    if (q.shadow > 0) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      sun.shadow.bias = -.0004; sun.shadow.normalBias = .23; sun.shadow.radius = 2.4;
      Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 370, bottom: -370, near: 1, far: 920 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    const fillLight = new T.DirectionalLight(A.lin('#b3bbef'), .26);
    fillLight.position.set(400, 190, 560); sc.add(fillLight);

    // Deployment zone and aim marker for the selected rune.
    const zone = new T.Mesh(geo.plane, new T.MeshBasicMaterial({ color: A.lin('#78e6ff'), transparent: true, opacity: .085, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    zone.rotation.x = -Math.PI / 2; zone.scale.set(W, H - DEPLOY, 1); zone.position.set(W / 2, .16, (DEPLOY + H) / 2); zone.visible = false; sc.add(zone);
    const aim = A.mesh(sc, geo.ring, new T.MeshBasicMaterial({ color: A.lin('#ffcb65'), transparent: true, opacity: .85, depthWrite: false, toneMapped: false }), 0, .22, 0, 1, 1, 1, -Math.PI / 2, 0, 0, false);
    aim.visible = false;
    let aimSize = 12;
    function preview(p, c, valid) {
      aim.visible = !!(p && c && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H);
      if (!aim.visible) return;
      aim.position.set(p.x, .25, p.y);
      aimSize = c.sp ? c.rad : c.big ? 19 : c.k > 2 ? 13 : 12;
      aim.scale.setScalar(aimSize);
      aim.material.color.copy(A.lin(valid ? '#ffd378' : '#e86e75'));
      wake();
    }

    /* ------------------------------------------------------------ camera */
    const fitPoints = [], towerFitPoints = [], camBase = new T.Vector3(), camBaseQ = new T.Quaternion();
    let camBaseFov = 22, cameraPitch = 60, cameraDistance = 0, cameraMargin = .978, fitCount = 0, cinematicShot = false;
    const camTarget = new T.Vector3(180,17,280), fitOffset = new T.Vector2(), occluders=[];
    let cameraHalfHeight=0, fitMaxNdc=0, fieldCoverage=0;
    function bounds(x, y, z, hw, h, hd) { for (const dx of [-hw, hw]) for (const dz of [-hd, hd]) for (const dy of [0, h]) fitPoints.push(new T.Vector3(x + dx, y + dy, z + dz)); }
    bounds(180, 0, 280, 180, 0, 280);
    for (const z of [52, 508]) bounds(180, 0, z, 42, 122, 42);
    for (const x of [53, 307]) for (const z of [169, 391]) bounds(x, 0, z, 18, 60, 18);
    bounds(180, 0, 280, 54, 50, 54);
    for (const x of [45, 315]) for (const z of [-11, 571]) bounds(x, 0, z, 13, z > 0 ? 34 : 47, 12);
    for (const x of [0, 360]) for (const z of [-8, 568]) bounds(x, 0, z, 0, 42, 0);
    let lastSize = '';
    function refreshTowerBounds() {
      towerFitPoints.length=0;occluders.length=0;
      for(const o of towers){
        // Conservative inner opaque masonry box, not the crystal, flags or transparent halo.
        const h=o.t.king?o.t.rad*.78:16;
        occluders.push({t:o.t,box:new T.Box3(new T.Vector3(o.t.x-h,1,o.t.y-h),new T.Vector3(o.t.x+h,o.t.king?60:47,o.t.y+h))});
        const b=o.fitBounds;
        if(b)for(const dx of [-b.half,b.half])for(const dz of [-b.half,b.half])for(const y of [0,b.height])towerFitPoints.push(new T.Vector3(o.t.x+dx,y,o.t.y+dz));
        // The static mesh bounding box is measured once at battle start, with a conservative
        // authored bound above for rotating crystals/rigs and the old fallback models.
        const box=new T.Box3().setFromObject(o.root);
        if(!box.isEmpty()&&[box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite))
          for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])towerFitPoints.push(new T.Vector3(x,y,z));
      }
    }
    // Pure interval solver; auto evaluates candidate tilts/FOV only at layout changes.
    let inspection=null, introAt=0, actualRatio=1, fitCandidates=0;
    function solveFit(points,aspect,pitch,fov,margin,ortho,legacy){
      const a=pitch*Math.PI/180, upY=Math.cos(a),upZ=-Math.sin(a),backY=Math.sin(a),backZ=Math.cos(a);
      const coords=points.map(p=>({x:p.x-180,y:(p.y-17)*upY+(p.z-280)*upZ,z:(p.y-17)*backY+(p.z-280)*backZ}));
      const tangent=Math.tan(fov*Math.PI/360);let d=1000,sx=0,sy=0,hh=0;
      if(ortho){const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);sx=(minX+maxX)/2;sy=(minY+maxY)/2;hh=Math.max((maxY-minY)/2,(maxX-minX)/2/aspect)/margin*1.00001;}
      else {function interval(d){let x0=-Infinity,x1=Infinity,y0=-Infinity,y1=Infinity;for(const p of coords){const depth=d-p.z;if(depth<=2)return null;const hy=depth*tangent*margin,hx=hy*aspect;x0=Math.max(x0,p.x-hx);x1=Math.min(x1,p.x+hx);y0=Math.max(y0,p.y-hy);y1=Math.min(y1,p.y+hy);}if(legacy)return x0<=0&&x1>=0&&y0<=0&&y1>=0?[0,0]:null;return x0<=x1&&y0<=y1?[(x0+x1)/2,(y0+y1)/2]:null;}
        let lo=160,hi=2700;while(!interval(hi)&&hi<100000)hi*=2;for(let i=0;i<28;i++){const m=(lo+hi)/2;if(interval(m))hi=m;else lo=m;}d=hi*1.00001;[sx,sy]=interval(d)||[0,0];}
      const corners=[[0,0],[360,0],[360,560],[0,560]].map(([x,z])=>{const yy=-17*upY+(z-280)*upZ,zz=-17*backY+(z-280)*backZ,hy=ortho?hh:(d-zz)*tangent;return [(x-180-sx)/(hy*aspect),(yy-sy)/hy];});let area=0;for(let i=0;i<4;i++){const p=corners[i],q=corners[(i+1)%4];area+=p[0]*q[1]-q[0]*p[1];}
      const ratio=ortho?1:(d+17*backY+280*backZ)/(d+17*backY-280*backZ);
      return {pitch,fov,d,sx,sy,hh,upY,upZ,backY,backZ,coverage:Math.abs(area)/8,ratio};
    }
    function fit() {
      const w=cv.clientWidth,h=cv.clientHeight;if(w<1||h<1)return;
      lastSize=w+'x'+h;R.setSize(w,h,false);
      const aspect=w/h, settings=window.CDCamera38?.view(aspect)||{pitch:60,fov:22,margin:.945},points=(settings.legacy?fitPoints:fitPoints.slice(0,64)).concat(towerFitPoints);
      cameraMargin=settings.margin;
      const pitches=settings.automatic?(settings.orthographic?[80,82,84,85]:[70,72,74]):[settings.pitch],fovs=settings.automatic&&!settings.orthographic?[22,24,26]:[settings.fov];
      let best=null,bestScore=-Infinity;fitCandidates=0;
      for(const p of pitches)for(const f of fovs){const a=solveFit(points,aspect,p,f,settings.margin,!!settings.orthographic,settings.legacy);fitCandidates++;const score=a.coverage-.32*(a.ratio-1)-.003*Math.abs(p-settings.pitch);if(score>bestScore){bestScore=score;best=a;}}
      const {pitch,fov,d,sx,sy,hh,upY,upZ,backY,backZ}=best;cameraPitch=pitch;camBaseFov=fov;cameraHalfHeight=hh;actualRatio=best.ratio;
      cam=settings.orthographic?orthographic:perspective;baseCamera=cam;
      if(settings.orthographic){cam.left=-hh*aspect;cam.right=hh*aspect;cam.top=hh;cam.bottom=-hh;}else{cam.aspect=aspect;cam.fov=fov;}
      fitOffset.set(sx,sy);camTarget.set(180+sx,17+sy*upY,280+sy*upZ);cam.position.set(camTarget.x,camTarget.y+backY*d,camTarget.z+backZ*d);cam.lookAt(camTarget);
      cam.near=1;cam.far=Math.max(3000,d+1000);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);camBase.copy(cam.position);camBaseQ.copy(cam.quaternion);cameraDistance=d;
      const v=new T.Vector3();fitMaxNdc=0;for(const p of points){v.copy(p).project(cam);fitMaxNdc=Math.max(fitMaxNdc,Math.abs(v.x),Math.abs(v.y));}
      fieldCoverage=best.coverage;fitCount++;wake();
    }
    function restoreCamera(){cam=baseCamera;cam.position.copy(camBase);cam.quaternion.copy(camBaseQ);cam.updateMatrixWorld(true);}
    function refitCamera(){if(on&&cv.clientWidth&&cv.clientHeight)fit();}
    function cameraStats(){return {available:true,pitch:cameraPitch,fov:baseCamera.isOrthographicCamera?null:camBaseFov,projection:baseCamera.isOrthographicCamera?'orthographic':'perspective',distance:cameraDistance,halfHeight:cameraHalfHeight,offset:fitOffset.toArray(),margin:cameraMargin,maxNdc:fitMaxNdc,fieldCoverage,perspectiveRatio:actualRatio,fitCandidates,occlusionChecks,inspecting:!!inspection,intro:!!introAt,markers:visionMarks.size,fitCount,cinematicShot,points:fitPoints.length+towerFitPoints.length,canvas:[cv.clientWidth,cv.clientHeight],settings:window.CDCamera38?.settings()};}
    function inspectCamera(state,opts){
      if(!on||!state?.paused||state.done||window.CDCamera38?.legacy)return false;
      inspection={yaw:Math.max(-180,Math.min(180,Number(opts?.yaw)||0)),pitch:Math.max(35,Math.min(85,Number(opts?.pitch)||60)),zoom:Math.max(85,Math.min(150,Number(opts?.zoom)||100)),focus:['arena','own','enemy','shrine'].includes(opts?.focus)?opts.focus:'arena'};wake();return true;
    }
    function closeInspection(){inspection=null;restoreCamera();wake();}
    function openingCamera(state,now){
      if(!introAt||!state.paused||state.done||!window.CDCamera38?.introAllowed()){introAt=0;return false;}
      const k=clamp01((now-introAt)/1400);if(k>=1){introAt=0;return false;}
      // Starts at an elevated angled overview and eases to the EXACT base pose.
      const e=1-k*k*(3-2*k);cam=baseCamera.isOrthographicCamera?shotOrtho:shotPerspective;cam.copy(baseCamera,false);
      cam.position.set(camBase.x+180*e,camBase.y-120*e,camBase.z+130*e);cam.lookAt(camTarget);
      cam.updateProjectionMatrix();cam.updateMatrixWorld(true);return true;
    }
    function showInspection(state){
      if(!inspection||!state.paused||state.done){inspection=null;return false;}
      const a=inspection.pitch*Math.PI/180,b=inspection.yaw*Math.PI/180;
      const target=inspection.focus==='own'?new T.Vector3(180,40,508):inspection.focus==='enemy'?new T.Vector3(180,40,52):inspection.focus==='shrine'?new T.Vector3(180,10,280):camTarget;
      cam=shotPerspective;cam.aspect=baseCamera.isOrthographicCamera?cv.clientWidth/cv.clientHeight:baseCamera.aspect;cam.fov=30;cam.near=1;cam.far=5000;
      const d=(inspection.focus==='arena'?Math.max(850,baseCamera.isOrthographicCamera?cameraHalfHeight/Math.tan(Math.PI/12):cameraDistance):380)*100/inspection.zoom;
      cam.position.set(target.x+Math.sin(b)*Math.cos(a)*d,target.y+Math.sin(a)*d,target.z+Math.cos(b)*Math.cos(a)*d);cam.lookAt(target);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);return true;
    }
    function beginIntro(state){if(!on||!state?.paused||state.done||!window.CDCamera38?.introAllowed())return false;introAt=performance.now();wake();return true;}
    function endIntro(){introAt=0;restoreCamera();wake();}
    // 4.6 ending: when a core falls, push in on ITS ruins starting from the exact gameplay pose (frame 1 =
    // current camera), 1.7 s smoothstep, no FOV change, no pull-back, no cut; then hold. The ruins settle in
    // the upper part of the frame so the result card (shown low) leaves them visible. Gameplay camera untouched.
    const finishLook = new T.Vector3(), finishAim = new T.Vector3(), finishEnd = new T.Vector3(), finishDir = new T.Vector3();
    function finishCamera(state){
      if(!state.done||reducedMotion)return false;
      const target=state.tw.find(t=>t.king&&t.hp<=0);if(!target)return false;
      const k=clamp01(state.finishAge/1.7),e=k*k*(3-2*k);
      cam=baseCamera.isOrthographicCamera?shotOrtho:shotPerspective;cam.copy(baseCamera,false);
      finishLook.set(target.x,14,target.y+62);
      finishDir.copy(camBase).sub(finishLook).normalize();
      finishEnd.copy(finishLook).addScaledVector(finishDir,baseCamera.isOrthographicCamera?camBase.distanceTo(finishLook):560);
      cam.position.lerpVectors(camBase,finishEnd,e);
      finishAim.lerpVectors(camTarget,finishLook,e);cam.lookAt(finishAim);
      if(cam.isOrthographicCamera){const f=1-.58*e;cam.left*=f;cam.right*=f;cam.top*=f;cam.bottom*=f;}
      cam.updateProjectionMatrix();cam.updateMatrixWorld(true);return true;
    }
    addEventListener('resize', () => { if (on && cv.clientHeight) fit(); });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (on && cv.clientHeight && lastSize !== cv.clientWidth + 'x' + cv.clientHeight) fit(); }).observe(cv);

    /* ------------------------------------------------------------ shared helpers */
    const tmp = new T.Object3D(), tmpColor = new T.Color(), up = new T.Vector3(0, 1, 0), dir = new T.Vector3();
    const camQ = new T.Quaternion(), pr = A.rng(458);
    const colours = new Map(), colour = hex => { if (!colours.has(hex)) colours.set(hex, A.lin(hex)); return colours.get(hex); };
    const TEAM = [colour(C.team[0]), colour(C.team[1])], TEAM_LIGHT = [colour('#9ff4ff'), colour('#e2a6ff')];
    const GOLD = colour('#ffcf6e'), WHITE = colour('#ffffff'), FIRE = colour('#ff8a3d'), FIRE_CORE = colour('#ffd98a');
    const SPARK = colour('#8fe9ff'), MOTE = colour('#d9c4ff');
    const scaled = (c, k) => tmpColor.copy(c).multiplyScalar(Math.max(0, k));

    // Instanced batches: one draw call per batch, refilled every frame.
    function batch(geometry, material, capacity, order) {
      const mesh = new T.InstancedMesh(geometry, material, capacity);
      // r128 sizes instanceColor from mesh.count on the first setColorAt, so colour before count = 0.
      for (let i = 0; i < capacity; i++) mesh.setColorAt(i, WHITE);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = order; mesh.count = 0; mesh.visible = false;
      if (mesh.instanceMatrix && mesh.instanceMatrix.setUsage && T.DynamicDrawUsage) mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      if (mesh.instanceColor && mesh.instanceColor.setUsage && T.DynamicDrawUsage) mesh.instanceColor.setUsage(T.DynamicDrawUsage);
      sc.add(mesh);
      let n = 0;
      return {
        mesh,
        reset() { n = 0; },
        push(color) { if (n >= capacity) return; tmp.updateMatrix(); mesh.setMatrixAt(n, tmp.matrix); mesh.setColorAt(n, color); n++; },
        commit() {
          mesh.count = n; mesh.visible = n > 0;
          if (n) { if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
        },
        get size() { return n; }
      };
    }
    const additive = (map, extra = {}) => new T.MeshBasicMaterial(Object.assign({ map, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }, extra));
    const ringTex = A.texture(128, 128, g => {
      const r = g.createRadialGradient(64, 64, 24, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.55, 'rgba(255,255,255,.08)');
      r.addColorStop(.78, 'rgba(255,255,255,.95)'); r.addColorStop(.86, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    });
    const waveTex = A.texture(128, 128, g => {
      const r = g.createRadialGradient(64, 64, 40, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.72, 'rgba(255,255,255,.18)');
      r.addColorStop(.9, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    });
    // Summoning seal: a circle, a hexagram-like star and twelve rune ticks.
    const runeTex = A.texture(256, 256, g => {
      g.translate(128, 128); g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.shadowColor = '#ffffff'; g.shadowBlur = 8;
      g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 92, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 4;
      for (const off of [0, Math.PI / 3]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = off + i * Math.PI * 2 / 3 - Math.PI / 2; i ? g.lineTo(Math.cos(a) * 88, Math.sin(a) * 88) : g.moveTo(Math.cos(a) * 88, Math.sin(a) * 88); } g.stroke(); }
      for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * Math.PI / 6); g.beginPath(); g.moveTo(0, -100); g.lineTo(0, -108); g.stroke(); g.restore(); }
    });
    const scorchTex = A.texture(128, 128, g => {
      const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      r.addColorStop(0, 'rgba(22,12,24,.82)'); r.addColorStop(.45, 'rgba(34,18,30,.55)'); r.addColorStop(1, 'rgba(34,18,30,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      const n = A.rng(77);
      for (let i = 0; i < 26; i++) { const a = n() * Math.PI * 2, d = 18 + n() * 34; g.fillStyle = 'rgba(18,9,20,.35)'; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + n() * 5, 0, Math.PI * 2); g.fill(); }
    });

    const blobs = batch(geo.plane, new T.MeshBasicMaterial({ map: A.shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 110, 1);
    const rings = batch(geo.plane, additive(ringTex, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 110, 2);
    const flats = batch(geo.plane, additive(A.glowTex, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 72, 3);
    const waves = batch(geo.plane, additive(waveTex, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 56, 4);
    const runes = batch(geo.plane, additive(runeTex, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 28, 5);
    const glows = batch(geo.plane, additive(A.glowTex), q.glows, 20);
    const beams = batch(geo.box, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }), 110, 21);
    const barBack = batch(geo.plane, new T.MeshBasicMaterial({ color: A.lin('#1c1425'), transparent: true, opacity: .92, depthTest: false, depthWrite: false, toneMapped: false }), 110, 40);
    const barFill = batch(geo.plane, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }), 110, 41);
    const visionTex=A.texture(64,64,g=>{g.clearRect(0,0,64,64);g.beginPath();g.moveTo(32,5);g.lineTo(59,32);g.lineTo(32,59);g.lineTo(5,32);g.closePath();g.fillStyle='#11121fe8';g.fill();g.strokeStyle='#ffffff';g.lineWidth=5;g.stroke();g.beginPath();g.arc(32,32,7,0,Math.PI*2);g.fillStyle='#ffffff';g.fill();});
    const visionMarks=batch(geo.plane,new T.MeshBasicMaterial({map:visionTex,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),72,39);
    const batches = [blobs, rings, flats, waves, runes, glows, beams, barBack, barFill, visionMarks];
    const visionRay=new T.Ray(),visionPoint=new T.Vector3(),visionHit=new T.Vector3(),visionDir=new T.Vector3();
    let occlusionChecks=0;
    function markHidden(u,o,x,z){
      if(!window.CDCamera38?.markersAllowed()||cinematicShot||u.hp<=0)return;
      let hits=0;
      for(const fraction of [.20,.45,.70]){
        visionPoint.set(x,Math.max(3,o.height*fraction),z);
        let limit=Infinity;if(baseCamera.isOrthographicCamera){baseCamera.getWorldDirection(visionDir).negate();limit=visionDir.dot(camBase)-visionDir.dot(visionPoint);}else{visionDir.copy(camBase).sub(visionPoint);limit=visionDir.length();visionDir.normalize();}
        visionRay.set(visionPoint,visionDir);
        for(const b of occluders){if(b.t.hp<=0)continue;occlusionChecks++;if(visionRay.intersectBox(b.box,visionHit)){const d=visionHit.distanceTo(visionPoint);if(d>.1&&d<limit-.1){hits++;break;}}}
      }
      if(hits<2)return;
      const pY=Math.max(5,o.height*.55);visionPoint.set(x,pY,z);
      const height=baseCamera.isOrthographicCamera?2*cameraHalfHeight:2*Math.max(1,visionDir.copy(camBase).sub(visionPoint).dot(visionHit.set(0,0,1).applyQuaternion(camBaseQ)))*Math.tan(camBaseFov*Math.PI/360);
      const size=Math.max(8,Math.min(28,height*15/Math.max(1,cv.clientHeight)));billboard(visionMarks,x,pY,z,size,size,u.bonus?GOLD:TEAM_LIGHT[u.team]);
    }

    // Writers for the three quad orientations.
    function ground(b, x, z, sx, sz, color, spin = 0, y = .3) {
      tmp.position.set(x, y, z); tmp.rotation.set(-Math.PI / 2, 0, spin); tmp.scale.set(sx, sz, 1); b.push(color);
    }
    function billboard(b, x, y, z, sx, sy, color) {
      tmp.position.set(x, y, z); tmp.quaternion.copy(camQ); tmp.scale.set(sx, sy, 1); b.push(color);
    }
    function beam(x0, y0, z0, x1, y1, z1, width, color) {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz);
      if (len < .01) return;
      dir.set(dx / len, dy / len, dz / len);
      tmp.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      tmp.quaternion.setFromUnitVectors(up, dir);
      tmp.scale.set(width, len, width);
      beams.push(color);
    }

    /* ------------------------------------------------------------ particles (sparks and debris) */
    const particleMat = new T.MeshBasicMaterial({ color: '#fff' });
    const particles = new T.InstancedMesh(geo.oct, particleMat, q.particles);
    for (let i = 0; i < q.particles; i++) particles.setColorAt(i, WHITE);   // before count = 0 (see batch)
    particles.frustumCulled = false; particles.count = 0; sc.add(particles);
    const pool = Array.from({ length: q.particles }, () => ({ life: 0, c: WHITE }));
    function burst(x, z, y, c, n) {
      const color = typeof c === 'string' ? colour(c) : c;
      const count = shadowReduced ? Math.ceil(n * .55) : n;
      for (let i = 0; i < count; i++) {
        const p = pool.find(x => x.life <= 0);
        if (!p) break;
        const a = pr() * Math.PI * 2, s = 7 + pr() * 18;
        p.x = x; p.z = z; p.y = y; p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 9 + pr() * 30;
        p.max = .35 + pr() * .42; p.life = p.max; p.s = .7 + pr() * 2.2; p.c = color;
      }
    }
    function updateParticles(dt) {
      let j = 0;
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) continue;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= 46 * dt;
        tmp.position.set(p.x, Math.max(.35, p.y), p.z); tmp.rotation.set(p.life * 5, p.life * 8, 0); tmp.scale.setScalar(p.s * Math.min(1, p.life / .15)); tmp.updateMatrix();
        particles.setMatrixAt(j, tmp.matrix); particles.setColorAt(j, p.c); j++;
      }
      particles.count = j; particles.visible = j > 0;
      if (particles.instanceMatrix) particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
    }
    // Stone debris when a tower falls.
    const debrisCount = quality === 'low' ? 20 : quality === 'high' ? 96 : 48;
    const debris = new T.InstancedMesh(geo.bevel, A.material('#9c838d'), debrisCount);
    debris.count = 0; debris.frustumCulled = false; debris.castShadow = false; debris.receiveShadow = true; sc.add(debris);
    const rocks = Array.from({ length: debrisCount }, () => ({ life: 0 }));
    function shatter(x, z, amount = 24) {
      for (let i = 0; i < (quality === 'low' || shadowReduced ? amount / 2 : amount); i++) {
        const r = rocks.find(a => a.life <= 0);
        if (!r) break;
        const a = pr() * Math.PI * 2, speed = 10 + pr() * 32;
        r.x = x + Math.cos(a) * 7; r.z = z + Math.sin(a) * 7; r.y = 10 + pr() * 25;
        r.vx = Math.cos(a) * speed; r.vz = Math.sin(a) * speed; r.vy = 15 + pr() * 40; r.life = .45 + pr() * .55; r.s = 2 + pr() * 4; r.angle = pr() * 6;
      }
    }
    function animateRocks(dt) {
      let i = 0;
      for (const r of rocks) {
        if (r.life <= 0) continue;
        r.life -= dt;
        if (r.life <= 0) continue;
        r.x += r.vx * dt; r.z += r.vz * dt; r.vy -= 90 * dt; r.y += r.vy * dt;
        if (r.y < r.s * .5) { r.y = r.s * .5; r.vy = Math.max(0, -r.vy * .2); r.vx *= .82; r.vz *= .82; }
        tmp.position.set(r.x, r.y, r.z); tmp.rotation.set(r.angle + r.life * 5, r.angle * .5, r.life * 3); tmp.scale.setScalar(r.s * Math.min(1, r.life / .14)); tmp.updateMatrix();
        debris.setMatrixAt(i++, tmp.matrix);
      }
      debris.count = i; debris.visible = i > 0;
      if (debris.instanceMatrix) debris.instanceMatrix.needsUpdate = true;
    }

    // Burn marks left by meteors (normal blending, so each has its own fading material).
    const scorches = Array.from({ length: 4 }, () => {
      const m = A.mesh(sc, geo.plane, new T.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, .12, 0, 1, 1, 1, -Math.PI / 2, 0, 0, false);
      m.visible = false; m.receiveShadow = false;
      return { m, life: 0 };
    });
    function scorch(x, z, r) {
      const s = scorches.reduce((a, b) => a.life <= b.life ? a : b);
      s.life = 4.5; s.m.position.set(x, .12, z); s.m.scale.set(r * 1.7, r * 1.7, 1); s.m.rotation.z = pr() * 6.28; s.m.visible = true;
    }
    function updateScorches(dt) {
      for (const s of scorches) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.m.material.opacity = clamp01(s.life / 1.5) * .9;
        if (s.life <= 0) s.m.visible = false;
      }
    }

    // Damage numbers: reusable canvases, drawn only when health changes.
    const numbers = [], knownHP = new Map();
    if (quality !== 'low') for (let i = 0; i < 20; i++) {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
      const tex = new T.CanvasTexture(canvas); tex.encoding = T.sRGBEncoding;
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
      sprite.visible = false; sprite.scale.set(24, 12, 1); sprite.renderOrder = 45; sc.add(sprite);
      numbers.push({ canvas, tex, sprite, life: 0 });
    }
    function number(o, d, x, z) {
      const n = numbers.find(n => n.life <= 0);
      if (!n || d <= 0) return;
      const g = n.canvas.getContext('2d');
      g.clearRect(0, 0, 128, 64); g.font = 'bold 36px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = '#201528'; g.strokeText('-' + Math.round(d), 64, 32);
      g.fillStyle = o.team ? '#e2c4ff' : '#b5f8ff'; g.fillText('-' + Math.round(d), 64, 32);
      n.tex.needsUpdate = true; n.life = .62; n.x = x; n.z = z; n.y = o.king === undefined ? 40 : o.king ? 110 : 79; n.big = d >= 150;
      n.sprite.position.set(n.x, n.y, n.z); n.sprite.visible = true; n.sprite.material.opacity = 1;
    }
    let labelFrame = 0;
    function damageLabels(state, dt) {
      if (!numbers.length) return;
      labelFrame++;
      const check = (o, x, z) => {
        const known = knownHP.get(o);
        if (known && o.hp < known.hp) number(o, known.hp - Math.max(0, o.hp), x, z);
        knownHP.set(o, { hp: o.hp, seen: labelFrame, x, z });
      };
      for (const u of state.u) { const v = units.get(u); check(u, v ? v.vx : u.x, v ? v.vz : u.y); }
      for (const t of state.tw) check(t, t.x, t.y);
      for (const [o, k] of knownHP) if (k.seen !== labelFrame) { if (k.hp > 0 && o.hp <= 0) number(o, k.hp, k.x, k.z); knownHP.delete(o); }
      for (const n of numbers) {
        if (n.life <= 0) continue;
        n.life = Math.max(0, n.life - dt);
        n.sprite.visible = n.life > 0;
        const age = .62 - n.life, pop = n.big ? 1.35 : 1;
        n.sprite.position.y = n.y + age * 26;
        const s = pop * (age < .09 ? .7 + age / .09 * .45 : 1.15 - Math.min(.15, (age - .09) * .6));
        n.sprite.scale.set(24 * s, 12 * s, 1);
        n.sprite.material.opacity = Math.min(1, n.life / .18);
      }
    }

    /* ------------------------------------------------------------ visual effects */
    // Every effect has its own clock, so it plays smoothly at any refresh rate.
    const fx = [];
    let shake = 0, shakeT = 0, finalMode = false;
    function addShake(k) { if (!reducedMotion && (window.CDCamera38?.shakeAllowed() ?? true)) shake = Math.min(1.7, shake + k); }
    function effect(kind, props, dur) { fx.push(Object.assign({ kind, t: 0, dur }, props)); }

    function unitPos(u) { const v = units.get(u); return v ? { x: v.vx, z: v.vz } : { x: u.x, z: u.y }; }
    function heightOf(o, attacker) {
      if (o.king !== undefined) return o.king ? (attacker ? 80 : 64) : (attacker ? 60 : 50);   // side: crossbow bolt at 60 (citadel-38 SIDE_BOLT)
      return attacker ? 18 : o.big ? 17 : 11;
    }
    function onSimFx(f, attackers) {
      if (f.k === 'm') {
        const p = f.b.king === undefined ? unitPos(f.b) : { x: f.b.x, z: f.b.y };
        effect('hit', { x: p.x, y: heightOf(f.b), z: p.z, c: WHITE, size: 13 }, .16);
        burst(p.x, p.z, 10, '#ffd699', 5);
        return;
      }
      if (f.k === 'l') {
        const tower = f.a.king !== undefined;
        if (tower) attackers.add(f.a);
        const s = tower ? { x: f.a.x, z: f.a.y } : unitPos(f.a);
        effect('shot', { a: f.a, b: f.b, x0: s.x, z0: s.z, y0: heightOf(f.a, true), tower, team: f.a.team }, tower ? .16 : .14);
        return;
      }
      if (f.k !== 'c') return;
      if (f.card === 'meteor') effect('meteor', { x: f.x, z: f.y, r: f.r }, .14);
      else if (f.card === 'spark') { effect('lightning', { x: f.x, z: f.y, r: f.r, seed: Math.floor(pr() * 1e6) }, .34); effect('boom', { x: f.x, z: f.y, r: f.r, c: SPARK, core: WHITE }, .45); burst(f.x, f.y, 6, '#bdf6ff', 12); addShake(.25); }
      else if (f.card === 'mage' && f.a) { const s = unitPos(f.a); effect('fireball', { x0: s.x, z0: s.z, x: f.x, z: f.y, r: f.r }, .15); }
      else if (f.card === 'imp') { effect('boom', { x: f.x, z: f.y, r: f.r, c: FIRE, core: FIRE_CORE, big: true }, .55); burst(f.x, f.y, 6, '#ff9f5a', 14); addShake(.35); }
      else if (f.card === 'shrine') { effect('pillar', { x: f.x, z: f.y, c: f.team >= 0 ? TEAM_LIGHT[f.team] : GOLD }, 1.4); burst(f.x, f.y, 10, '#ffe3a1', 18); }
      else effect('boom', { x: f.x, z: f.y, r: f.r, c: GOLD, core: WHITE }, .4);
    }
    function onEvent(e) {
      if (e.type === 'cast' && !e.sp) {
        const big = e.id === 'colossus' || e.id === 'brute';
        effect('summon', { x: e.x, z: e.y, team: e.team, r: big ? 34 : 26 }, .75);
        burst(e.x, e.y, 3, TEAM_LIGHT[e.team], big ? 12 : 8);
      } else if (e.type === 'final') finalMode = true;
      else if (e.type === 'rage') {
        for (const o of towers) if (o.t.team === e.team && o.t.hp > 0) effect('aura', { x: o.t.x, z: o.t.y, r: o.t.king ? 70 : 38, c: TEAM_LIGHT[e.team] }, 1.1);
      }
    }
    // Draw (and advance) every effect.
    function drawEffects(dt, time) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const e = fx[i];
        e.t += dt;
        const k = clamp01(e.t / e.dur);
        switch (e.kind) {
          case 'summon': {
            const c = TEAM_LIGHT[e.team], fade = Math.pow(1 - k, 1.3);
            ground(runes, e.x, e.z, e.r * 2 * (.45 + .75 * easeOut(k)), e.r * 2 * (.45 + .75 * easeOut(k)), scaled(TEAM[e.team], 1.25 * fade), k * 2.4 + e.x);
            if (k < .4) ground(flats, e.x, e.z, e.r * 2.6, e.r * 2.6, scaled(c, (1 - k / .4) * .45));
            const pillar = Math.sin(Math.min(1, k * 1.6) * Math.PI);
            billboard(glows, e.x, 26, e.z, e.r * .5 * (1 - k * .5), 70 * (.6 + .4 * pillar), scaled(c, .5 * pillar));
            billboard(glows, e.x, 9, e.z, e.r, e.r, scaled(WHITE, .3 * fade));
            break;
          }
          case 'hit':
            billboard(glows, e.x, e.y, e.z, e.size * (.7 + .6 * k), e.size * (.7 + .6 * k), scaled(e.c, 1.1 * (1 - k)));
            break;
          case 'soul': {
            const c = TEAM_LIGHT[e.team], y = e.y + easeOut(k) * 30;
            billboard(glows, e.x + Math.sin(k * 7) * 3, y, e.z, 9 * (1 - k) + 3, 12 * (1 - k) + 4, scaled(c, .9 * (1 - k)));
            billboard(glows, e.x - Math.sin(k * 6) * 4, y * .8, e.z + 2, 6 * (1 - k) + 2, 8 * (1 - k) + 2, scaled(c, .5 * (1 - k)));
            break;
          }
          case 'shot': {
            const live = e.b && e.b.king === undefined ? unitPos(e.b) : { x: e.b.x, z: e.b.y };
            const y1 = heightOf(e.b), arc = e.tower ? 14 : 9;
            const at = s => ({ x: e.x0 + (live.x - e.x0) * s, y: e.y0 + (y1 - e.y0) * s + Math.sin(s * Math.PI) * arc, z: e.z0 + (live.z - e.z0) * s });
            const p = at(k), c = TEAM_LIGHT[e.team];
            if (e.tower) {
              for (let j = 4; j >= 1; j--) { const s = at(Math.max(0, k - j * .07)); billboard(glows, s.x, s.y, s.z, 9 - j * 1.5, 9 - j * 1.5, scaled(c, .45 / j)); }
              billboard(glows, p.x, p.y, p.z, 14, 14, scaled(c, 1.1));
              billboard(glows, p.x, p.y, p.z, 6, 6, scaled(WHITE, .9));
            } else {
              const b = at(Math.max(0, k - .12));
              beam(b.x, b.y, b.z, p.x, p.y, p.z, .9, scaled(c, 1.4));
              billboard(glows, p.x, p.y, p.z, 7, 7, scaled(c, .9));
            }
            if (k >= 1) { effect('hit', { x: live.x, y: y1, z: live.z, c, size: e.tower ? 18 : 11 }, .18); burst(live.x, live.z, y1, c, e.tower ? 6 : 3); }
            break;
          }
          case 'fireball': {
            const s = easeOut(k), x = e.x0 + (e.x - e.x0) * s, z = e.z0 + (e.z - e.z0) * s, y = 20 * (1 - s) + 8 + Math.sin(s * Math.PI) * 10;
            for (let j = 3; j >= 1; j--) { const t = Math.max(0, s - j * .09); billboard(glows, e.x0 + (e.x - e.x0) * t, 20 * (1 - t) + 8 + Math.sin(t * Math.PI) * 10, e.z0 + (e.z - e.z0) * t, 9 - j * 2, 9 - j * 2, scaled(FIRE, .5 / j)); }
            billboard(glows, x, y, z, 15, 15, scaled(FIRE, 1.2));
            billboard(glows, x, y, z, 7, 7, scaled(FIRE_CORE, 1));
            if (k >= 1) { effect('boom', { x: e.x, z: e.z, r: e.r, c: FIRE, core: FIRE_CORE }, .45); burst(e.x, e.z, 6, '#ffae63', 9); }
            break;
          }
          case 'meteor': {
            const x0 = e.x + 70, y0 = 210, z0 = e.z - 110, s = k * k;
            const x = x0 + (e.x - x0) * s, y = y0 * (1 - s) + 6 * s, z = z0 + (e.z - z0) * s;
            for (let j = 6; j >= 1; j--) { const t = Math.max(0, s - j * .06); billboard(glows, x0 + (e.x - x0) * t, y0 * (1 - t) + 6 * t, z0 + (e.z - z0) * t, 18 - j * 2, 18 - j * 2, scaled(FIRE, .55 / Math.sqrt(j))); }
            billboard(glows, x, y, z, 30, 30, scaled(FIRE, 1.3));
            billboard(glows, x, y, z, 13, 13, scaled(FIRE_CORE, 1.2));
            if (k >= 1) {
              effect('boom', { x: e.x, z: e.z, r: e.r, c: FIRE, core: FIRE_CORE, big: true }, .7);
              scorch(e.x, e.z, e.r); shatter(e.x, e.z, 14); burst(e.x, e.z, 8, '#ffb15e', 20); addShake(.95);
            }
            break;
          }
          case 'boom': {
            const fade = 1 - k, size = e.r * (e.big ? 3.2 : 2.6);
            ground(flats, e.x, e.z, size * (.7 + .3 * k), size * (.7 + .3 * k), scaled(e.c, 1.5 * fade * fade));
            ground(waves, e.x, e.z, e.r * 2 * (.3 + 1.05 * easeOut(k)), e.r * 2 * (.3 + 1.05 * easeOut(k)), scaled(e.c, 1.5 * fade), 0, .35);
            billboard(glows, e.x, 8 + k * 8, e.z, e.r * (1.3 - .6 * k), e.r * (1.3 - .6 * k), scaled(e.core, 1.3 * Math.pow(fade, 1.5)));
            if (e.big) billboard(glows, e.x, 16 + k * 18, e.z, e.r * 1.6, e.r * 1.6, scaled(e.c, .7 * fade));
            break;
          }
          case 'lightning': {
            const fade = 1 - k, flicker = .65 + .35 * Math.sin(time * 90 + e.seed);
            const n = A.rng(Math.floor(time * 24) + e.seed);
            let px = e.x + (n() - .5) * 30, py = 170, pz = e.z - 40 + (n() - .5) * 20;
            for (let j = 1; j <= 8; j++) {
              const s = j / 8, jitter = (1 - s) * 14;
              const nx = px + (e.x - px) * (1 / (9 - j)) + (n() - .5) * jitter, ny = 170 * (1 - s) + 1, nz = pz + (e.z - pz) * (1 / (9 - j)) + (n() - .5) * jitter;
              beam(px, py, pz, nx, ny, nz, 3 * fade + .6, scaled(SPARK, 1.6 * fade * flicker));
              beam(px, py, pz, nx, ny, nz, 1, scaled(WHITE, 1.4 * fade * flicker));
              billboard(glows, (px + nx) / 2, (py + ny) / 2, (pz + nz) / 2, 22, 26, scaled(SPARK, .38 * fade * flicker));
              px = nx; py = ny; pz = nz;
            }
            ground(flats, e.x, e.z, e.r * 3.2, e.r * 3.2, scaled(SPARK, 1.4 * fade * flicker));
            break;
          }
          case 'pillar': {
            const fade = Math.sin(Math.min(1, k * 1.25) * Math.PI) * (1 - k * .3);
            for (let j = 0; j < 5; j++) billboard(glows, e.x, 12 + j * 22, e.z, 22 * (1 - k * .4), 46, scaled(e.c, .55 * fade));
            ground(runes, e.x, e.z, 120, 120, scaled(e.c, 1.2 * fade), time * .8);
            ground(waves, e.x, e.z, 108 * (.6 + .9 * easeOut(k)), 108 * (.6 + .9 * easeOut(k)), scaled(e.c, 1.2 * (1 - k)), 0, .4);
            break;
          }
          case 'towerfall': {
            const fade = 1 - k;
            ground(waves, e.x, e.z, e.r * (.6 + 2.4 * easeOut(k)), e.r * (.6 + 2.4 * easeOut(k)), scaled(e.c, 1.7 * fade), 0, .4);
            ground(flats, e.x, e.z, e.r * 3, e.r * 3, scaled(e.c, 1.2 * fade * fade));
            billboard(glows, e.x, 30 + k * 30, e.z, e.r * 1.6, e.r * 1.6, scaled(WHITE, .9 * fade * fade));
            break;
          }
          case 'aura': {
            const fade = Math.sin(k * Math.PI);
            ground(waves, e.x, e.z, e.r * (1.2 + .8 * k), e.r * (1.2 + .8 * k), scaled(e.c, 1.2 * fade), 0, .4);
            ground(rings, e.x, e.z, e.r * 1.6, e.r * 1.6, scaled(e.c, .8 * fade));
            break;
          }
        }
        if (e.t >= e.dur) fx.splice(i, 1);
      }
    }

    // Floating light motes over the arena; golden and livelier in the final minute.
    const motes = Array.from({ length: q.motes }, () => ({ x: pr() * W, z: pr() * H, y: 3 + pr() * 66, s: 1 + pr() * 1.6, v: 2.5 + pr() * 4, ph: pr() * 6.28 }));
    function drawMotes(time, dt) {
      const c = finalMode ? GOLD : MOTE, speed = finalMode ? 2.4 : 1;
      for (const m of motes) {
        m.y += m.v * dt * speed;
        if (m.y > 72) { m.y = 3; m.x = pr() * W; m.z = pr() * H; }
        const edge = Math.min(1, (m.y - 3) / 10, (72 - m.y) / 14), tw = .4 + .6 * Math.pow(Math.sin(time * 2.1 + m.ph), 2);
        billboard(glows, m.x + Math.sin(time * .7 + m.ph) * 5, m.y, m.z + Math.cos(time * .5 + m.ph) * 3, m.s * 3.4, m.s * 3.4, scaled(c, .5 * tw * edge));
      }
    }

    /* ------------------------------------------------------------ battle objects */
    let towers = [], units = new Map(), fallen = [], on = false, last = performance.now();
    let seenFx = new WeakSet(), evi = 0, pausedFrames = 0, dirty = true;
    function wake() { dirty = true; }
    function remove(o) { sc.remove(o.root); if (o.dispose) o.dispose(); A.disposeTree(o.root); }
    function clearBattle() {
      for (const o of units.values()) remove(o);
      units.clear();
      for (const f of fallen) remove(f.o);
      fallen = [];
      for (const o of towers) remove(o);
      towers = [];
      fx.length = 0; knownHP.clear();
      for (const p of pool) p.life = 0;
      for (const r of rocks) r.life = 0;
      for (const s of scorches) { s.life = 0; s.m.visible = false; }
      for (const n of numbers) { n.life = 0; n.sprite.visible = false; }
      for (const b of batches) { b.reset(); b.commit(); }
      particles.count = 0; debris.count = 0; zone.visible = false; aim.visible = false;
    }

    let frames = 0, elapsed = 0, work = 0, fps = 0, frameMs = 0, workMs = 0, slowSeconds = 0, fastSeconds = 0;
    let lastCalls = 0, lastTris = 0, peakCalls = 0, peakTriangles = 0;
    function begin(state) {
      clearBattle();
      if (window.ArenaAudio) ArenaAudio.begin(state);
      towers = state.tw.map(t => { const o = ArenaTowers3D.build(t); sc.add(o.root); return o; });
      seenFx = new WeakSet(); evi = 0; finalMode = false; shake = 0; pausedFrames = 0;
      slowSeconds = fastSeconds = 0; frames = 0; elapsed = 0; work = 0; fps = 0; peakCalls = 0; peakTriangles = 0;
      on = true; last = performance.now();
      inspection=null;introAt=0;window.CDCamera38?.enter(state);refreshTowerBounds();cinematicShot=false;fit();
      R.shadowMap.needsUpdate = true;
    }
    const unitOpts = () => ({ shadows: q.unitShadows && !shadowReduced });

    function frame(state) {
      const start = performance.now(), raw = Math.max(.001, (start - last) / 1000), dt = Math.min(.05, raw), time = start / 1000;
      last = start;
      // Behind the pause menu nothing moves: draw a couple of frames for the overlay, then rest the GPU.
      // (A pause set without the menu, as in the test scripts, keeps the visuals alive.)
      const frozen = !!(state.paused && state.menu && !state.done);
      if (frozen && !dirty && pausedFrames > 2 && !introAt) return;
      pausedFrames = frozen ? pausedFrames + 1 : 0;
      dirty = false;
      const gameDt = frozen ? 0 : dt, alpha = Number.isFinite(state.alpha) ? state.alpha : 1;
      if (lastSize !== cv.clientWidth + 'x' + cv.clientHeight && cv.clientHeight) fit();
      cinematicShot=showInspection(state)||openingCamera(state,start)||finishCamera(state);camQ.copy(cam.quaternion);
      window.CDCitadel38?.readFrame(state);env.update(time, state);
      const card = state.sel >= 0 && CARDS[state.hand[state.sel]];
      zone.visible = !!card && !card.sp && !state.done;
      if (zone.visible) zone.material.opacity = .07 + .035 * Math.sin(time * 4);
      if (!card || state.done) aim.visible = false;
      else if (aim.visible) aim.scale.setScalar(aimSize * (1 + .06 * Math.sin(time * 7)));
      for (const b of batches) b.reset();occlusionChecks=0;

      // Units: interpolate between simulation steps, then draw ring, contact shadow and health bar.
      const live = new Set(state.u);
      for (const [u, o] of units) if (!live.has(u)) {
        o.death(); fallen.push({ o }); units.delete(u);
        burst(o.vx, o.vz, 10, TEAM_LIGHT[u.team], 7);
        effect('soul', { x: o.vx, y: 14, z: o.vz, team: u.team }, .8);
      }
      for (const u of state.u) {
        let o = units.get(u);
        if (!o) { o = ArenaCharacters3D.build(u, unitOpts()); units.set(u, o); sc.add(o.root); }
        const x = u.px === undefined ? u.x : u.px + (u.x - u.px) * alpha, z = u.py === undefined ? u.y : u.py + (u.y - u.py) * alpha;
        o.vx = x; o.vz = z;
        o.update(time, gameDt, x, z);
        const s = o.size;
        ground(blobs, x, z, s * 2.5, s * 2.1, WHITE, 0, .1);
        const ringColor = u.bonus ? GOLD : TEAM[u.team], pulse = u.attacking ? 1.25 : 1;
        ground(rings, x, z, s * 2.3, s * 2.3, scaled(ringColor, .95 * pulse), 0, .19);
        if(!state.done)markHidden(u,o,x,z);
        if (u.hp < u.max && u.hp > 0) {
          const w = u.big || u.bonus ? 24 : 19, ratio = Math.max(0, u.hp / u.max), y = o.height;
          billboard(barBack, x, y, z, w + 2.4, 4.6, WHITE);
          const fw = Math.max(.001, w * ratio);
          billboard(barFill, x + (fw - w) / 2, y, z, fw, 2.7, u.bonus ? GOLD : TEAM[u.team]);
        }
      }
      for (const f of fallen) f.age = f.o.updateDeath(gameDt);
      fallen = fallen.filter(f => { if (f.age > .95) { remove(f.o); return false; } return true; });

      // New simulation effects and events.
      const attackers = new Set();
      for (const f of state.fx) if (!seenFx.has(f)) { seenFx.add(f); onSimFx(f, attackers); }
      const events = state.ev || [];
      while (evi < events.length) onEvent(events[evi++]);

      // Towers: attack flashes, collapse, debris.
      let collapsing = false;
      for (const o of towers) {
        if (o.t.hp <= 0 && !o.isDead()) {
          const c = TEAM_LIGHT[o.t.team];
          burst(o.t.x, o.t.y, 24, c, 25); shatter(o.t.x, o.t.y);
          effect('towerfall', { x: o.t.x, z: o.t.y, r: o.t.king ? 60 : 34, c }, o.t.king ? 1.1 : .85);
          addShake(o.t.king ? 1.6 : .9);
        }
        o.update(time, gameDt, cam, attackers.has(o.t));
        if (o.isCollapsing && o.isCollapsing()) collapsing = true;
      }
      if (collapsing && R.shadowMap.enabled && !R.shadowMap.autoUpdate) R.shadowMap.needsUpdate = true;

      drawEffects(gameDt, time);
      drawMotes(time, dt);
      updateParticles(gameDt); animateRocks(gameDt); updateScorches(gameDt); damageLabels(state, gameDt);
      for (const b of batches) b.commit();
      if (window.ArenaAudio) ArenaAudio.frame(state);

      // Camera shake (never applied to picking: the camera is restored right after rendering).
      let shaken = false;
      if (shake > 0 && !frozen && !cinematicShot && state.sel<0 && (window.CDCamera38?.shakeAllowed() ?? true)) {
        shakeT += dt;
        const s = shake * shake * 2.3;
        cam.position.set(camBase.x + Math.sin(shakeT * 61) * s, camBase.y + Math.sin(shakeT * 47 + 1) * s * .6, camBase.z + Math.cos(shakeT * 53) * s);
        cam.updateMatrixWorld();
        shake = Math.max(0, shake - dt * 2.4);
        shaken = true;
      } else if(state.sel>=0) shake=0;
      if (R.info && R.info.reset) R.info.reset();
      try { R.render(sc, cam); } finally { if (shaken || cinematicShot) restoreCamera(); }

      // Statistics and adaptive quality.
      lastCalls = R.info.render.calls; lastTris = R.info.render.triangles;
      peakCalls = Math.max(peakCalls, lastCalls); peakTriangles = Math.max(peakTriangles, lastTris);
      frames++; elapsed += raw; frameMs = raw * 1000; work += performance.now() - start;
      if (elapsed >= 1) {
        fps = Math.round(frames / elapsed); workMs = work / frames;
        if (adaptive && on && !state.done && !state.paused && !document.hidden) adapt();
        if (debug && perf) perf.textContent = `${quality.toUpperCase()} · ${fps} FPS · кадр ${workMs.toFixed(1)} мс · DPR ${dpr.toFixed(2)}${shadowReduced ? ' · Eco' : ''} · ${lastCalls} calls · ${Math.round(lastTris / 1000)}k tris · ${units.size} юн.`;
        frames = 0; elapsed = 0; work = 0;
      }
    }
    // Lower resolution only when the device really struggles. A steady 30 FPS is the iOS
    // Low Power Mode cap, not a slow GPU, so it does not count as struggling.
    function adapt() {
      const budget = 1000 / Math.max(1, fps), struggling = fps < 26 || (fps < 50 && workMs > budget * .7);
      slowSeconds = struggling ? slowSeconds + 1 : 0;
      fastSeconds = fps > 55 ? fastSeconds + 1 : 0;
      let next = dpr;
      if (slowSeconds >= 3 && dpr > 1) next = Math.max(1, dpr - .25);
      else if (fastSeconds >= 12 && dpr < maxDpr()) next = Math.min(maxDpr(), dpr + .25);
      if (next !== dpr) { dpr = next; R.setPixelRatio(dpr); R.setSize(cv.clientWidth,cv.clientHeight,false); slowSeconds = fastSeconds = 0; return; }
      if (slowSeconds >= 5 && dpr <= 1 && !shadowReduced && R.shadowMap.enabled) { shadowReduced = true; R.shadowMap.enabled = false; slowSeconds = fastSeconds = 0; }
      else if (fastSeconds >= 15 && shadowReduced) { shadowReduced = false; R.shadowMap.enabled = true; R.shadowMap.needsUpdate = true; slowSeconds = fastSeconds = 0; }
    }

    function pick(e) {
      if(inspection||introAt)return null;
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const p = new T.Vector3();
      ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), baseCamera);
      return ray.ray.intersectPlane(groundPlane, p) ? { x: p.x, y: p.z } : null;
    }
    function project(x, z, y = 0) {
      const r = cv.getBoundingClientRect(), v = new T.Vector3(x, y, z).project(baseCamera);
      return { clientX: r.left + (v.x + 1) * r.width / 2, clientY: r.top + (1 - v.y) * r.height / 2, ndcX: v.x, ndcY: v.y, ndcZ: v.z };
    }
    function stop() { inspection=null;introAt=0;on = false; clearBattle(); towerFitPoints.length=0;occluders.length=0;cinematicShot=false;window.CDCamera38?.leave(); }
    function stats() {
      return {
        quality, adaptive, dpr, shadowReduced, shadowMode: !R.shadowMap.enabled ? 'off' : R.shadowMap.autoUpdate ? 'dynamic' : 'static',
        hdModels: ArenaHDModels.stats(), characterModels: ArenaCharacterModels.stats(),
        fps, frameMs: +frameMs.toFixed(2), workMs: +workMs.toFixed(2), drawCalls: lastCalls, triangles: lastTris, peakCalls, peakTriangles,
        units: units.size, effects: fx.length, instances: { rings: rings.size, blobs: blobs.size, bars: barFill.size, glows: glows.size, beams: beams.size }, textures: R.info.memory.textures, geometries: R.info.memory.geometries, three: T.REVISION, canvas: [cv.width, cv.height]
      };
    }
    let loaded = false, loading = null;
    function prepare() {
      if (loaded) return Promise.resolve();
      if (!loading) loading = Promise.all([ArenaHDModels.preload(), ArenaCharacterModels.preload()]).then(() => { loaded = true; }).catch(e => { loading = null; throw e; });
      return loading;
    }
    return { ok: true, prepare, begin, frame, pick, project, preview, stop, stats, refitCamera, cameraStats, inspectCamera, closeInspection, beginIntro, endIntro };
  } catch (error) {
    console.error('Crystal Dominion renderer:', error);
    return { ok: false, error: String(error) };
  }
})();
