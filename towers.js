'use strict';
// Cores (GLB citadel) and crystal obelisks. Visual only.
const ArenaTowers3D = typeof ArenaArt3D !== 'undefined' && ArenaArt3D ? (() => {
  const A = ArenaArt3D, { T, G, C } = A;
  const stones = ['#9c828b', '#b89a94', '#856d80', '#a98c8d', '#927a87'];
  const COLLAPSE = .55;   // seconds for a destroyed tower to crumble into its ruins
  function build(t) {
    const root = new T.Group();
    root.position.set(t.x, 0, t.y);
    const intact = new T.Group(), ruins = new T.Group();
    root.add(intact, ruins);
    ruins.visible = false;
    const batch = A.batch(intact), team = t.team, tc = C.team[team];
    const trim = A.material(C.trim[team], 'cloth'), emit = A.material(tc, 'glow'), dark = A.material('#3b2c43');
    const stone = A.stone, rand = A.rng(t.x * 127 + t.y * 77), color = () => stones[Math.floor(rand() * stones.length)], banners = [];
    const sm = (geo, mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0, shadow = true) => batch.add(geo, mat, x, y, z, w, h, d, rx, ry, rz, null, shadow);
    let orb, ring, coreLight, attack = 0, peak;
    const high = new URLSearchParams(location.search).get('quality') === 'high';
    if (t.king) {
      peak = 117;
      intact.scale.set(1.12, 1.10, 1.12);
      ruins.scale.setScalar(1.10);
      ArenaHDModels.add(intact, 'citadel-hd');
      sm(G.cyl, trim, 0, 52, 0, 20, 3, 20);
      sm(G.cyl, emit, 0, 55.2, 0, 14, 1, 14, 0, 0, 0, false);
      // Arched windows around the circular citadel.
      for (const a of [-2.45, -1.12, 1.12, 2.45]) {
        const x = Math.sin(a) * 30.7, z = Math.cos(a) * 30.7;
        sm(G.arch, A.material('#493644'), x, 25, z, 12.8, 22, 2.7, 0, a);
        sm(G.arch, emit, x * 1.045, 25, z * 1.045, 8.6, 17, 1.5, 0, a, 0, false);
        sm(G.arch, A.material('#bd9372', 'gold'), x * 1.012, 25, z * 1.012, 10.5, 20, 1.3, 0, a);
        sm(G.arch, emit, x * 1.055, 25, z * 1.055, 7.7, 15.2, 1.6, 0, a, 0, false);
        for (const dy of [22, 29]) sm(G.box, trim, x * 1.075, dy, z * 1.075, 7.4, .9, 1, 0, a, 0, false);
        A.glow(intact, tc, x * 1.12, 25, z * 1.12, 19, .22);
      }
      ring = A.mesh(intact, G.torus, A.material(tc, 'glow'), 0, 56.8, 0, 17, 17, 17, -Math.PI / 2, 0, 0, false);
      orb = A.crystal(intact, team, 0, 83, 0, 25, 40, true);
      if (high && T.PointLight) { coreLight = new T.PointLight(A.lin(tc), .58, 76, 2); coreLight.position.set(0, 70, 0); intact.add(coreLight); }
      A.lightPool(intact, tc, 0, 0, 63, 59, .19, 55.4);
      A.glow(intact, tc, 0, 58, 0, 36, .28);
      banners.push(A.banner(intact, team, 0, 27, 34.1, 29, 40));
      sm(G.cyl, A.gold, 0, 46, 35, 1.8, 30, 1.8, 0, 0, Math.PI / 2);
      for (const x of [-20, 20]) sm(G.bevel, A.gold, x, 9, 26, 4, 6, 5);
    } else {
      peak = 54;
      ruins.scale.setScalar(.66);
      sm(G.cyl, dark, 0, 2, 0, 16, 4, 16);
      sm(G.cyl, A.gold, 0, 4.7, 0, 13.5, 2, 13.5);
      sm(G.cyl, A.material('#9d8690'), 0, 15, 0, 10.5, 19, 10.5);
      for (const q of [-1, 1]) { sm(G.bevel, A.material('#b09a9d'), q * 9, 13, 0, 5, 18, 8); sm(G.bevel, A.gold, q * 9, 22, 0, 6, 2.5, 9); }
      sm(G.cyl, A.gold, 0, 25, 0, 12, 3, 12);
      sm(G.cyl, trim, 0, 27.2, 0, 8.5, 2, 8.5);
      sm(G.arch, emit, 0, 13, 10.7, 5.2, 12, 1.2, 0, 0, 0, false);
      orb = A.crystal(intact, team, 0, 40, 0, 16, 25, true);
      ring = A.mesh(intact, G.torus, A.material(tc, 'glow'), 0, 28, 0, 10, 10, 10, -Math.PI / 2, 0, 0, false);
    }
    batch.flush();
    // Animated parts never cast shadows: the shadow map is static on Medium.
    intact.traverse(o => { if (o === orb.root || banners.includes(o)) o.castShadow = false; });
    if (orb.root) orb.root.traverse(o => { o.castShadow = false; });
    for (const b of banners) b.castShadow = false;
    A.contact(root, 0, 0, t.king ? 105 : 43, t.king ? 93 : 40, .085);
    const light = A.lightPool(intact, tc, 0, 3, t.king ? 104 : 52, t.king ? 92 : 48, t.king ? .19 : .13, .17);
    const rubble = A.batch(ruins);
    for (let i = 0; i < 13; i++) { const a = i * 2.4, rad = (t.king ? 26 : 20) * rand(); rubble.add(G.bevel, stone, Math.cos(a) * rad, 2 + rand() * 3, Math.sin(a) * rad, 7 + rand() * 7, 4 + rand() * 5, 8 + rand() * 6, rand() * .5, a, rand() * .5, color()); }
    rubble.flush();
    const hp = A.health(root, team, t.king ? 40 : 28, peak + 5);
    const baseScale = { x: intact.scale.x, y: intact.scale.y, z: intact.scale.z }, ruinScale = ruins.scale.x;
    let dead = false, collapse = 0, flash = 0;
    return {
      t, root, peak,
      isDead: () => dead,
      // True while the tower is crumbling: the renderer refreshes the static shadow map meanwhile.
      isCollapsing: () => dead && collapse < 1,
      update(time, dt, cam, hasAttack) {
        if (t.hp <= 0) {
          if (!dead) { dead = true; collapse = 0; ruins.visible = true; ruins.scale.setScalar(ruinScale * .2); }
          if (collapse < 1) {
            collapse = Math.min(1, collapse + dt / COLLAPSE);
            const k = collapse, e = k * k;
            intact.position.y = -e * peak * .62;
            intact.scale.set(baseScale.x * (1 + .08 * k), baseScale.y * (1 - .45 * e), baseScale.z * (1 + .08 * k));
            intact.rotation.z = Math.sin(k * 26) * .035 * (1 - k);
            ruins.scale.setScalar(ruinScale * (.2 + .8 * Math.min(1, k * 1.4)));
            if (k >= 1) intact.visible = false;
          }
          A.updateHealth(hp, 0, cam, false);
          return;
        }
        if (hasAttack) { attack = .23; flash = .18; }
        attack = Math.max(0, attack - dt); flash = Math.max(0, flash - dt);
        light.material.opacity = (t.king ? .19 : .13) * (1 + .15 * Math.sin(time * 2 + t.x) + flash * 2.4);
        if (coreLight) coreLight.intensity = .58 + .09 * Math.sin(time * 2 + t.x) + flash * 2;
        orb.root.position.y = orb.baseY + Math.sin(time * 2.2 + t.x * .02) * (t.king ? 1.8 : .55);
        orb.root.rotation.y = time * (t.king ? .28 : .7);
        const charge = 1 + flash * 1.6;
        orb.root.scale.set(charge, charge, charge);
        if (ring) ring.scale.setScalar(((t.king ? 17 : 10) + Math.sin(time * 2) * .7) * (1 + flash * .5));
        for (const m of banners) A.waveBanner(m, time + t.x * .01);
        A.updateHealth(hp, t.hp / t.max, cam, t.hp < t.max);
      }
    };
  }
  return { build };
})() : null;
