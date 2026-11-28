'use strict';
/* Block Arena 4.6 — lava rift and the two crystal drawbridges (visual layer).
   The deck halves are driven only by the battle's bridge state (G.br from game.js: open / warn / clear /
   part / apart / join, gap 0..1), the same state that decides where units may cross — nobody walks on air.
   Geometry must match game.js: RIFT y=280 ±14, bridges at x=90 and x=270, 56 wide. ?rift=0 hides the layer. */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('rift') === '0' || typeof ArenaEnvironment3D === 'undefined' || !ArenaEnvironment3D || typeof ArenaArt3D === 'undefined' || !ArenaArt3D || typeof THREE === 'undefined') return;
  const T = THREE, A = ArenaArt3D, G = A.G, original = ArenaEnvironment3D.build;
  const RY = 280, HALF = 14, BW = 56, BX = [90, 270], DECK = HALF + 6;          // each half spans 20: 14 over lava + 6 on the bank
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stats = { ready: false, states: ['open', 'open'], gaps: [0, 0] };
  window.CDRift46 = { stats: () => ({ ...stats, states: [...stats.states], gaps: [...stats.gaps] }) };

  // calm tone of the shrine crystal for the decks; basalt lips; molten flow
  // one material for every deck half (vertex colours carry the tones) → 1 draw call per half
  const deckMat = new T.MeshStandardMaterial({ vertexColors: true, emissive: A.lin('#0c3550'), emissiveIntensity: .2, roughness: .68, metalness: 0, flatShading: true });
  const TONE = { top: '#1f6a82', keel: '#123e52', rim: '#57b7cb', joint: '#3d93aa' };
  function merged(parts) {      // parts: [geometry, tone, x, y, z, sx, sy, sz]
    const pos = [], nor = [], col = [], m = new T.Matrix4(), q = new T.Quaternion(), c = new T.Color(), v = new T.Vector3(), nm = new T.Matrix3();
    for (const [geo, tone, x, y, z, sx, sy, sz] of parts) {
      const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, Nn = g.attributes.normal;
      m.compose(v.set(x, y, z), q, new T.Vector3(sx, sy, sz)); nm.getNormalMatrix(m); c.copy(A.lin(tone));
      const n = new T.Vector3();
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); n.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); }
    }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); out.computeBoundingSphere(); return out;
  }
  const basalt = A.material('#4c3d45'), basaltTop = A.material('#6a5560');

  function lavaTexture() {
    const tex = A.texture(512, 64, (g, w, h) => {
      const rng = A.rng(4601), grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#7a1606'); grad.addColorStop(.5, '#ff6a12'); grad.addColorStop(1, '#7a1606');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // dark crust plates drifting on the melt, bright seams between them
      for (let i = 0; i < 46; i++) { const x = rng() * w, y = 6 + rng() * (h - 12), r = 6 + rng() * 14;
        g.fillStyle = rng() < .5 ? '#3a0f08' : '#4d1409'; g.beginPath();
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, q = r * (.65 + rng() * .5); g[k ? 'lineTo' : 'moveTo']((x + Math.cos(a) * q * 1.6 + w) % w, y + Math.sin(a) * q * .55); }
        g.closePath(); g.fill(); }
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) { const x = rng() * w, y = 8 + rng() * (h - 16); g.strokeStyle = 'rgba(255,214,120,.55)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 14, y - 5, x + 28, y + 5, x + 44, y); g.stroke(); }
    }, true);
    return tex;                                  // UVs of the strip pieces carry the 3× repeat
  }

  // One side of a horizontal strip (half-width hw around RY) that stops at the shrine circle, so the lava
  // runs UNDER the round platform and the seal stays whole. UVs follow world x/z (continuous texture).
  const SEAL = 54;
  function stripPiece(side, hw, x0, x1, uScale) {
    const sh = new T.Shape(), n = 16, outer = side < 0 ? x0 : x1, pts = [];
    for (let i = 0; i <= n; i++) { const z = -hw + 2 * hw * i / n, x = 180 + side * Math.sqrt(Math.max(0, SEAL * SEAL - z * z)); pts.push([x, z]); }
    sh.moveTo(outer, -hw); for (const [x, z] of pts) sh.lineTo(x, z); sh.lineTo(outer, hw); sh.closePath();
    const g = new T.ShapeGeometry(sh), P = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) - x0) / (x1 - x0) * uScale, (P.getY(i) + hw) / (2 * hw));
    g.rotateX(Math.PI / 2); g.translate(0, 0, RY); return g;      // shape y → world z (positive z = south)
  }
  function rift(base) {
    const root = new T.Group(); root.name = 'Rift 4.6'; base.root.add(root);
    const lavaTex = lavaTexture();
    const lavaMat = new T.MeshBasicMaterial({ map: lavaTex, toneMapped: false, side: T.DoubleSide });
    for (const side of [-1, 1]) { const m = new T.Mesh(stripPiece(side, HALF, -30, 390, 3), lavaMat); m.position.y = .55; m.renderOrder = -1; root.add(m); }
    // heat haze on both banks (additive, soft)
    const heatTex = A.texture(8, 64, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(255,120,40,0)'); r.addColorStop(.38, 'rgba(255,120,40,.55)'); r.addColorStop(.5, 'rgba(255,160,70,.2)'); r.addColorStop(.62, 'rgba(255,120,40,.55)'); r.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const heatMat = new T.MeshBasicMaterial({ map: heatTex, transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide });
    for (const side of [-1, 1]) { const m = new T.Mesh(stripPiece(side, HALF + 15, -30, 390, 1), heatMat); m.position.y = .62; m.renderOrder = 1; root.add(m); }
    const heat = { material: heatMat };
    // where the lava slips under the platform: a basalt rim along the circle edge and a warm glow beneath it
    const rimBatch = A.batch(root), rimRng = A.rng(4605);
    for (const side of [-1, 1]) for (let i = 0; i <= 6; i++) { const z = -HALF + 2 * HALF * i / 6, x = 180 + side * Math.sqrt(SEAL * SEAL - z * z), a = Math.atan2(z, x - 180);
      rimBatch.add(G.bevel, rimRng() < .5 ? basalt : basaltTop, x + side * .6, .9, RY + z, 3.4, 1.8 + rimRng() * .8, 5.2, 0, -a, 0, null, false); }
    rimBatch.flush();
    for (const side of [-1, 1]) A.lightPool(root, '#ff7a2a', 180 + side * (SEAL - 3), RY, 14, HALF * 2 + 6, .35, .6);
    // basalt lips along both banks (lava keeps them free of snow)
    const lips = A.batch(root), rng = A.rng(4603);
    for (const s of [-1, 1]) for (let x = -14; x <= 374; x += 11) { const inBridge = BX.some(b => Math.abs(x - b) < BW / 2 + 3); if (inBridge || Math.abs(x - 180) < SEAL + 4) continue;
      lips.add(G.bevel, rng() < .5 ? basalt : basaltTop, x, .9, RY + s * (HALF + 1.6), 10.4, 2 + rng() * 1.2, 3.6, 0, (rng() - .5) * .1, 0, null, false); }
    // bridge abutments: two snowy stone bollards at each bridge head
    for (const bx of BX) for (const s of [-1, 1]) for (const e of [-1, 1]) { const x = bx + e * (BW / 2 + 4), z = RY + s * (HALF + 5);
      lips.add(G.bevel, basaltTop, x, 4.5, z, 6.5, 9, 6.5, 0, 0, 0, null, true); lips.add(G.bevel, A.material('#eef1f6'), x, 9.6, z, 7, 1.4, 7, 0, 0, 0, null, false); }
    lips.flush();

    // the drawbridges: each half = thick crystal slab + darker keel + bright edge rails, plus an amber seam
    const bridges = BX.map((bx) => {
      const halves = [-1, 1].map(s => {
        const g = new T.Group(); g.position.set(bx, 0, RY); root.add(g);
        const zc = s * DECK / 2, parts = [[G.bevel, TONE.top, 0, -.9, zc, BW, 3.2, DECK],         // thick slab (walking surface)
          [G.bevel, TONE.keel, 0, -5.2, zc + s * 1.5, BW * .86, 6, DECK - 3]];                   // keel: visible thickness when parted
        for (const e of [-1, 1]) parts.push([G.bevel, TONE.rim, e * (BW / 2 - 1.3), 1.4, zc, 2.6, 2.4, DECK - .6]);
        for (let i = 0; i < 3; i++) parts.push([G.bevel, TONE.joint, (i - 1) * 16, .75, zc + s * (DECK / 2 - 2.2), 9, .5, 1.2]);   // facet joints
        const half = new T.Mesh(merged(parts), deckMat); half.castShadow = true; half.receiveShadow = true; g.add(half);
        return { g, s };
      });
      const seamMat = new T.MeshBasicMaterial({ color: A.lin('#ffb347'), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      const seam = A.mesh(root, G.plane, seamMat, bx, 1.2, RY, BW - 4, 3.2, 1, -Math.PI / 2, 0, 0, false); seam.renderOrder = 4;
      const seamGlow = A.glow(root, '#ffb347', bx, 3, RY, 46, .0); seamGlow.material.opacity = 0;
      return { bx, halves, seam, seamMat, seamGlow, shown: 0 };
    });

    let lastT = 0; stats.ready = true;
    return { root: base.root, update(t, state) {
      base.update(t, state);
      const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
      if (!motion.matches) lavaTex.offset.x = (lavaTex.offset.x + dt * .018) % 1;   // slow flow
      heat.material.opacity = .5 + .06 * Math.sin(t * 1.3);
      const br = state && state.br;
      bridges.forEach((b, i) => {
        const st = br && br[i] ? br[i] : { state: 'open', gap: 0, t: 0 };
        stats.states[i] = st.state; stats.gaps[i] = st.gap;
        // follow the simulated gap closely (fixed-step → smooth): never ahead of the sim, so the deck is
        // fully closed whenever the sim lets units walk on it
        const target = st.gap; b.shown += (target - b.shown) * Math.min(1, dt * 14); if (Math.abs(target - b.shown) < .002 || target === 0 && st.state !== 'join') b.shown = target;
        const e = b.shown * b.shown * (3 - 2 * b.shown);
        for (const h of b.halves) h.g.position.z = RY + h.s * e * DECK;          // each half slides back to its own bank
        const warn = st.state === 'warn' ? 1 : st.state === 'clear' ? .35 : 0, pulse = st.state === 'warn' ? .75 + .25 * Math.sin(t * 12) : 1;
        b.seamMat.opacity = warn * .95 * pulse * (1 - e); b.seamGlow.material.opacity = warn * .42 * pulse * (1 - e);
      });
    } };
  }

  ArenaEnvironment3D.build = function (scene) {
    const base = original.call(this, scene);
    try { return rift(base); } catch (e) { console.warn('Rift 4.6 fallback:', e); return base; }
  };
})();
