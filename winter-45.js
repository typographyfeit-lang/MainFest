'use strict';
/* Block Arena 4.5 — New Year's Eve arena. Visual layer only: towers, camera, collisions and battle
   rules are untouched. Wraps ArenaEnvironment3D.build like the other scene layers.
   ?winter=0 turns the layer off.
   - Floating shrine crystal: icy blue, hovers high over the seal centre with a soft shadow under it,
     slow bob + turn; on capture one team-coloured wave crosses the seal, then only a thin rim stays.
   - Winter fortress: snow on wall copings and pillars, drifts at the walls, cleared lanes with a ragged
     snow edge, a garlanded fir at the enemy gate, amber lantern pools on the snow.
   - Light motion: sparse slanted snowfall, a rare short snow swirl at the wall, flickering lantern flames.
   Phone budget: ~11 extra draw calls, 60–190 snow points by performance level, no per-frame allocation. */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('winter') === '0' || typeof ArenaEnvironment3D === 'undefined' || !ArenaEnvironment3D || typeof ArenaArt3D === 'undefined' || !ArenaArt3D || typeof THREE === 'undefined') return;
  const T = THREE, A = ArenaArt3D, G = A.G, TAU = Math.PI * 2, original = ArenaEnvironment3D.build;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const level = () => Math.max(0, Math.min(2, window.CDPerformance?.level?.() ?? 1));
  const stats = { ready: false, flakes: 0, captures: 0, gusts: 0 };
  window.CDWinter45 = { stats: () => ({ ...stats }) };

  const SNOW = '#eef1f6', SNOW_SHADE = '#c9d3e2', NEEDLE = '#1d3a2b', NEEDLE2 = '#264a34', AMBER = '#ffb35a', ICE = '#62c2ff', ICE_GLOW = '#3aa6ff';
  const snowMat = new T.MeshStandardMaterial({ color: A.lin(SNOW), roughness: .92, metalness: 0 });
  const snowShadeMat = new T.MeshStandardMaterial({ color: A.lin(SNOW_SHADE), roughness: .95, metalness: 0 });

  /* --- snow on the floor: margins, drifts by the forts and lantern patches; lanes stay clear --- */
  const PATCHES = [[114, 100, 31], [248, 102, 22], [120, 538, 22], [240, 538, 22]];
  function snowFloorTexture() {
    const S = 2, W = 360 * S, H = 560 * S;
    return A.texture(W, H, (g) => {
      const rng = A.rng(4501), ragged = (cx, cz, r, n, amp) => { const pts = []; for (let i = 0; i < n; i++) { const a = i * TAU / n, k = r * (1 + (rng() - .5) * amp); pts.push([cx + Math.cos(a) * k, cz + Math.sin(a) * k]); } return pts; };
      const fillPoly = (pts, style) => { g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(x * S, z * S) : g.moveTo(x * S, z * S)); g.closePath(); g.fillStyle = style; g.fill(); };
      const band = (edge) => { const pts = []; // ragged strip along one side of the field
        if (edge === 'L' || edge === 'R') { const x0 = edge === 'L' ? -10 : 370; pts.push([x0, -10]); for (let z = -10; z <= 570; z += 9) pts.push([edge === 'L' ? 38 + (rng() - .5) * 12 : 322 + (rng() - .5) * 12, z]); pts.push([x0, 570]); }
        else { const z0 = edge === 'T' ? -10 : 570, zz = edge === 'T' ? 22 : 546; pts.push([-10, z0]); for (let x = -10; x <= 370; x += 9) pts.push([x, zz + (rng() - .5) * 7]); pts.push([370, z0]); }
        return pts; };
      g.fillStyle = 'rgba(214,224,240,.2)'; g.fillRect(0, 0, W, H);   // light frost over the cleared stone
      g.filter = 'blur(2px)';
      // bluish under-layer shows as a soft shadow rim along every ragged edge
      for (const e of ['L', 'R', 'T', 'B']) fillPoly(band(e), 'rgba(176,192,214,.9)');
      for (const [x, z, r] of PATCHES) fillPoly(ragged(x, z, r, 22, .32), 'rgba(176,192,214,.9)');
      for (const [x, z] of [[53, 169], [307, 169], [53, 391], [307, 391]]) { const out = x < 180 ? -1 : 1; fillPoly(ragged(x + out * 14, z, 18, 18, .4), 'rgba(176,192,214,.85)'); }
      g.filter = 'blur(1px)';
      const top = (pts) => fillPoly(pts.map(([x, z]) => [x, z]), 'rgba(242,244,248,.97)');
      const rng2 = A.rng(4502), shrink = (pts, cx, cz, k) => pts.map(([x, z]) => [cx + (x - cx) * k + (rng2() - .5) * 2, cz + (z - cz) * k + (rng2() - .5) * 2]);
      for (const e of ['L', 'R', 'T', 'B']) { const p = band(e).map(([x, z]) => e === 'L' ? [x - 2.2, z] : e === 'R' ? [x + 2.2, z] : e === 'T' ? [x, z - 2] : [x, z + 2]); top(p); }
      for (const [x, z, r] of PATCHES) top(shrink(ragged(x, z, r, 22, .32), x, z, .88));
      for (const [x, z] of [[53, 169], [307, 169], [53, 391], [307, 391]]) { const out = x < 180 ? -1 : 1; top(shrink(ragged(x + out * 14, z, 18, 18, .4), x + out * 14, z, .86)); }
      // a few frosty sparkles
      g.filter = 'none'; g.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 260; i++) { const x = rng() * 360, z = rng() * 560; if (x > 44 && x < 316 && z > 26 && z < 540) continue; g.fillRect(x * S, z * S, 1.2, 1.2); }
    });
  }

  /* --- voxel props --- */
  function fir(parent, batch, x, z, h, garland) {
    const trunk = A.material('#5b3a26', 'wood');
    batch.add(G.box, trunk, x, h * .07, z, h * .09, h * .14, h * .09);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const k = i / (tiers - 1), r = h * (.3 - .2 * k), y = h * (.17 + .17 * i), th = h * .27, rot = i * .5;
      batch.add(cone6, A.material(i % 2 ? NEEDLE : NEEDLE2), x, y, z, r, th, r, 0, rot, 0);
      batch.add(cone6, snowMat, x, y + th * .2, z, r * .78, th * .55, r * .78, 0, rot + .26, 0);        // snow resting on the branches
    }
    batch.add(G.oct, A.material('#ffd27a', 'gold'), x, h * 1.0, z, h * .05, h * .07, h * .05);
    if (!garland) return null;
    // steady warm garland spiral + a few red baubles
    const bulbs = new T.InstancedMesh(G.sphere, new T.MeshBasicMaterial({ color: A.lin('#ffd27a'), toneMapped: false }), 34), tmp = new T.Object3D();
    for (let i = 0; i < 34; i++) { const k = i / 33, a = k * TAU * 3.2, r = h * (.29 - .21 * k) + 1.2, y = h * (.2 + .7 * k);
      tmp.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r); tmp.scale.setScalar(h * .016); tmp.updateMatrix(); bulbs.setMatrixAt(i, tmp.matrix); }
    bulbs.instanceMatrix.needsUpdate = true; bulbs.castShadow = false; parent.add(bulbs);
    const red = A.material('#c8302a', 'gold');
    for (let i = 0; i < 7; i++) { const k = (i + .5) / 7, a = i * 2.39 + .4, r = h * (.27 - .19 * k) + .8, y = h * (.22 + .62 * k); batch.add(G.sphere, red, x + Math.cos(a) * r, y, z + Math.sin(a) * r, h * .028, h * .028, h * .028); }
    const warm = A.glow(parent, '#ffb24a', x, h * .55, z, h * .8, .14); warm.castShadow = false;
    A.lightPool(parent, '#ff9a3a', x, z, h * 1.1, h * 1.1, .1, .32);
    return bulbs;
  }
  function lantern(parent, batch, x, z, flames, pools) {
    const wood = A.material('#4f3324', 'wood'), iron = A.material('#4b4852', 'gold');
    const S = 1.35, add = (g, m, px, py, pz, sx, sy, sz, rx = 0, ry = 0) => batch.add(g, m, x + (px - x) * S, py * S, z + (pz - z) * S, sx * S, sy * S, sz * S, rx, ry, 0);
    add(G.box, iron, x, 1.2, z, 6, 2.4, 6);                                                // foot
    add(G.box, wood, x, 13, z, 2, 22, 2);
    add(G.box, iron, x, 24.4, z, 6.2, 1, 6.2); add(G.box, iron, x, 31.1, z, 6.2, 1, 6.2);
    for (const dx of [-2.7, 2.7]) for (const dz of [-2.7, 2.7]) add(G.box, iron, x + dx, 27.7, z + dz, .7, 6.6, .7);
    add(G.box, glowMat, x, 27.7, z, 4.2, 5.6, 4.2);
    add(cone4, iron, x, 33.6, z, 5.2, 4, 5.2, 0, Math.PI / 4);
    add(cone4, snowMat, x, 34.4, z, 4.4, 2.6, 4.4, 0, Math.PI / 4);                       // snow on the lamp roof
    flames.push(A.glow(parent, '#ff9a3a', x, 27.7 * S, z, 13, .5));
    pools.push(A.lightPool(parent, '#ff8f2e', x, z, 46, 46, .13, .34));
  }
  const cone6 = new T.ConeGeometry(1, 1, 6), cone4 = new T.ConeGeometry(1, 1, 4), lump = new T.IcosahedronGeometry(1, 1);
  const glowMat = new T.MeshBasicMaterial({ color: A.lin('#ffc46e'), toneMapped: false });

  function snowfall(parent, count) {
    const tex = A.texture(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
    const mk = (n, size, op) => { const geo = new T.BufferGeometry(), pos = new Float32Array(n * 3); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ map: tex, color: A.lin('#f6f7fb'), size, sizeAttenuation: true, transparent: true, opacity: op, depthWrite: false, toneMapped: false }));
      pts.frustumCulled = false; pts.renderOrder = 8; parent.add(pts); return { pts, pos, geo }; };
    const fall = mk(190, 2.6, .78), gust = mk(26, 2.2, .85), rng = A.rng(4507), seed = new Float32Array(190);
    for (let i = 0; i < 190; i++) { fall.pos[i * 3] = -30 + rng() * 420; fall.pos[i * 3 + 1] = rng() * 150; fall.pos[i * 3 + 2] = -30 + rng() * 620; seed[i] = rng() * TAU; }
    gust.pts.visible = false;
    let gustAge = 9, nextGust = 5 + rng() * 4, gx = 0, gz = 0;
    return { update(dt, t, n) {
      fall.geo.setDrawRange(0, n); stats.flakes = n;
      if (motion.matches) return;
      for (let i = 0; i < n; i++) { const o = i * 3; // slanted, gently drifting fall; recycled at the top
        fall.pos[o] += (6.5 + Math.sin(t * .7 + seed[i]) * 2.2) * dt; fall.pos[o + 1] -= (11 + (i % 5)) * dt; fall.pos[o + 2] += 2.5 * dt;
        if (fall.pos[o + 1] < 0 || fall.pos[o] > 390) { fall.pos[o] = -30 + rng() * 400; fall.pos[o + 1] = 120 + rng() * 30; fall.pos[o + 2] = -30 + rng() * 620; } }
      fall.geo.attributes.position.needsUpdate = true;
      // rare short snow swirl at the inner face of the back wall or a side wall
      gustAge += dt; nextGust -= dt;
      if (nextGust <= 0 && level() > 0) { nextGust = 7 + rng() * 6; gustAge = 0; stats.gusts++; const side = rng(); gx = side < .5 ? 60 + rng() * 240 : (side < .75 ? 34 : 326); gz = side < .5 ? 18 : 60 + rng() * 140; }
      gust.pts.visible = gustAge < 1.5;
      if (gust.pts.visible) { const k = gustAge / 1.5; gust.pts.material.opacity = .85 * Math.sin(Math.PI * k);
        for (let i = 0; i < 26; i++) { const a = i * 2.4 + gustAge * 5.5, r = 3 + (i % 7) * 1.6 + k * 6, o = i * 3; gust.pos[o] = gx + Math.cos(a) * r + k * 10; gust.pos[o + 1] = 1 + (i % 9) * 1.3 + k * 14; gust.pos[o + 2] = gz + Math.sin(a) * r * .6; }
        gust.geo.attributes.position.needsUpdate = true; }
    } };
  }

  function winter(base) {
    const root = new T.Group(); root.name = 'Winter 4.5'; base.root.add(root);
    // floor snow (one draw call); drawn before other transparents so unit team rings stay on top
    const floorSnow = A.mesh(root, G.plane, new T.MeshStandardMaterial({ map: snowFloorTexture(), transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -1 }), 180, .3, 280, 360, 560, 1, -Math.PI / 2, 0, 0, false);
    floorSnow.receiveShadow = true; floorSnow.renderOrder = -2;
    const batch = A.batch(root), rng = A.rng(4511);
    // snow on the wall copings and the four gate pillars (walls from environment.js)
    for (let x = -2; x <= 364; x += 17) { batch.add(G.bevel, snowMat, x, 28.3, -9, 17.6, 1.7, 16.4, 0, 0, 0, null, false); batch.add(G.bevel, snowMat, x, 20.3, 569, 17.6, 1.5, 16.4, 0, 0, 0, null, false); }
    for (const x of [-6, 366]) for (let z = -7; z <= 567; z += 17) { const tall = Math.floor((z + 7) / 17) % 3 === 0; batch.add(G.bevel, snowMat, x, tall ? 26.9 : 21.3, z, tall ? 13.4 : 15.4, 1.5, tall ? 12.4 : 17.2, 0, 0, 0, null, false); }
    for (const z of [-11, 571]) for (const x of [45, 315]) { const h = (z > 0 ? 31 : 42) + 3.6; batch.add(G.bevel, snowMat, x, h + .9, z, 24.6, 2.2, 23.6, 0, 0, 0, null, false); batch.add(lump, snowMat, x + (rng() - .5) * 6, h + 2, z + (rng() - .5) * 6, 6, 2.2, 5, 0, 0, 0, null, false); }
    // drifts piled against the inner wall faces (low, wide, bluish where shaded)
    for (let x = 8; x <= 352; x += 22 + rng() * 10) { batch.add(lump, rng() < .5 ? snowMat : snowShadeMat, x, 0, 4 + rng() * 3, 9 + rng() * 6, 3.4 + rng() * 2, 5 + rng() * 2, 0, rng(), 0, null, false); batch.add(lump, snowMat, x + 5, 0, 556 - rng() * 3, 8 + rng() * 5, 3 + rng() * 1.6, 5, 0, rng(), 0, null, false); }
    for (const x of [6, 354]) for (let z = 20; z <= 540; z += 26 + rng() * 14) if (Math.abs(z - 280) > 26) batch.add(lump, rng() < .6 ? snowMat : snowShadeMat, x, 0, z, 5 + rng() * 2, 3 + rng() * 2, 10 + rng() * 6, 0, 0, 0, null, false);
    for (const [x, z, r] of PATCHES) for (let i = 0; i < 3; i++) { const a = rng() * TAU; batch.add(lump, snowMat, x + Math.cos(a) * r * .55, 0, z + Math.sin(a) * r * .55, r * .32, 2.2, r * .24, 0, a, 0, null, false); }
    // garlanded fir at the enemy gate (seen every match), two small snowy firs on the back corners
    fir(root, batch, 114, 98, 60, true);
    fir(root, batch, 24, 22, 34, false); fir(root, batch, 336, 22, 34, false);
    // lanterns: enemy gate and both sides of the player's gate, amber pools land on the snow patches
    const flames = [], pools = [];
    for (const [x, z] of [[248, 102], [120, 538], [240, 538]]) lantern(root, batch, x, z, flames, pools);
    batch.flush();
    root.traverse(o => { if (o.isInstancedMesh && (o.material === snowMat || o.material === snowShadeMat)) o.receiveShadow = true; });

    /* --- floating shrine crystal --- */
    const seal = findSeal(base.root);
    const crystal = seal && (seal.getObjectByName('Reforged shrine crystal') || seal.children.find(o => o.isMesh && o.geometry === G.oct && o.position.y > 20));
    const halo = seal && seal.children.find(o => o.isSprite && o.position.y > 20);
    let shadow = null, wave = null, waveMat = null, icePool = null;
    let gem = null;
    if (crystal) {
      crystal.visible = false;                                            // replaced by the 4.6 shrine crystal below
      gem = new T.Group(); gem.name = 'Shrine crystal 4.6'; seal.add(gem);
      const R = 12.6, UP = 34, DOWN = 30, N = 6, pos = [];                 // hexagonal bipyramid, ~1/3 larger than 3.9
      for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, p0 = [Math.sin(a0) * R, 0, Math.cos(a0) * R], p1 = [Math.sin(a1) * R, 0, Math.cos(a1) * R];
        pos.push(...p0, ...p1, 0, UP, 0, ...p1, ...p0, 0, -DOWN, 0); }
      const shellGeo = new T.BufferGeometry(); shellGeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); shellGeo.computeVertexNormals();
      const shell = new T.Mesh(shellGeo, new T.MeshStandardMaterial({ color: A.lin('#34d6cf'), emissive: A.lin('#0b6f78'), emissiveIntensity: .32, roughness: .08, metalness: .15, flatShading: true, transparent: true, opacity: .62, side: T.DoubleSide, depthWrite: false }));
      shell.renderOrder = 9;
      const core = new T.Mesh(shellGeo, new T.MeshStandardMaterial({ color: A.lin('#1c4fd8'), emissive: A.lin('#123fb8'), emissiveIntensity: .85, roughness: .2, metalness: .1, flatShading: true }));
      core.scale.set(.55, .62, .55);
      const edge = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; edge.push(Math.sin(a) * R * 1.01, 0, Math.cos(a) * R * 1.01, 0, UP * 1.005, 0); }
      const edgeGeo = new T.BufferGeometry(); edgeGeo.setAttribute('position', new T.Float32BufferAttribute(edge, 3));
      const rims = new T.LineSegments(edgeGeo, new T.LineBasicMaterial({ color: A.lin('#effdff'), transparent: true, opacity: .9, toneMapped: false })); rims.renderOrder = 10;
      gem.add(core, shell, rims);
      icePool = A.lightPool(seal, '#8fd4ff', 0, 0, 34, 34, .8, 3.1); icePool.renderOrder = 6;   // faint icy light around the shadow
      shadow = A.mesh(seal, G.plane, new T.MeshBasicMaterial({ map: A.shadowTex, color: 0x000000, transparent: true, depthWrite: false, opacity: .95, polygonOffset: true, polygonOffsetFactor: -3 }), 0, 3.3, 0, 11, 11, 1, -Math.PI / 2, 0, 0, false);
      shadow.renderOrder = 7;
      waveMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide });
      wave = A.mesh(seal, new T.RingGeometry(.86, 1, 64), waveMat, 0, 3.4, 0, 1, 1, 1, -Math.PI / 2, 0, 0, false); wave.visible = false; wave.renderOrder = 8;
    }
    const ice = A.lin(ICE), iceGlow = A.lin(ICE_GLOW), tint = new T.Color(), teamCol = [A.lin(A.C.team[0]), A.lin(A.C.team[1])];
    let owner = -9, waveAge = 9, lastT = 0;
    const fx = snowfall(root, 190);
    stats.ready = true;

    return { root: base.root, update(t, state) {
      base.update(t, state);
      const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
      const lv = level(), sh = state && state.shrine, own = sh ? sh.owner : -1;
      if (crystal) {
        // high hover: lowest facet ≈ y 91, so on the 74° phone camera a clear band of air separates it from its shadow
        const bob = motion.matches ? 0 : Math.sin(t * 1.25) * 3, y = 122 + bob;
        gem.position.y = y; gem.rotation.y = motion.matches ? .4 : t * .3; gem.rotation.z = motion.matches ? 0 : Math.sin(t * .9) * .04;
        if (own !== owner) { // capture: one team-coloured wave, then the thin ownership rim (environment.js) remains
          if (own >= 0 && owner !== -9) { waveAge = 0; waveMat.color.copy(teamCol[own]); stats.captures++; }
          owner = own; tint.copy(iceGlow); if (own >= 0) tint.lerp(teamCol[own], .45);
        }
        if (halo) { halo.position.y = y; halo.scale.setScalar(36); halo.material.color.copy(tint); halo.material.opacity = .14; }
        const lift = (y - 119) / 6; shadow.scale.setScalar(11 - lift * 1.3); shadow.material.opacity = .95 - lift * .1; icePool.material.opacity = .7 + .08 * Math.sin(t * 1.25);
        waveAge += dt; wave.visible = waveAge < 1.15;
        if (wave.visible) { const k = waveAge / 1.15, r = 8 + 48 * (1 - (1 - k) * (1 - k)); wave.scale.set(r, r, 1); waveMat.opacity = .95 * (1 - k); }
      }
      // lantern flames flicker slightly; the garland stays steady
      for (let i = 0; i < flames.length; i++) { const f = motion.matches ? 1 : .88 + .08 * Math.sin(t * 11 + i * 2.1) + .05 * Math.sin(t * 23.7 + i); flames[i].material.opacity = .3 * f; pools[i].material.opacity = .13 * (.94 + .06 * f); }
      fx.update(dt, t, lv === 0 ? 60 : lv === 1 ? 120 : 190);
    } };
  }
  function findSeal(root) { let s = null; root.traverse(o => { if (!s && o.isGroup && Math.abs(o.position.x - 180) < .01 && Math.abs(o.position.z - 280) < .01 && o.children.some(c => c.isMesh && c.position.y > 20)) s = o; }); return s; }

  ArenaEnvironment3D.build = function (scene) {
    const base = original.call(this, scene);
    try { return winter(base); } catch (e) { console.warn('Winter 4.5 fallback:', e); return base; }
  };
})();
