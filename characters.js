'use strict';
// Skeletal GLB characters. Visual only: reads unit state from the simulation, never changes it.
// Movement and facing come from the simulation step (u.moving, u.px/u.py), not from render-frame
// deltas, so the walk cycle plays correctly at 30, 60 and 120 Hz.
const ArenaCharacters3D = typeof ArenaArt3D !== 'undefined' && ArenaArt3D ? (() => {
  const A = ArenaArt3D, { T } = A;
  const SCALE = { guard: 1, archer: .88, colossus: 1.45, imp: .78, mage: .96, hounds: .9, swarm: .69, brute: 1.35 };
  const WALK_CYCLE = .68;          // seconds per Walk clip at rate 1 (two steps)
  const SPAWN_TIME = .34;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const easeOutBack = k => { const c = 1.9, x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

  function build(u, opts = {}) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    if (body.rotation) body.rotation.order = 'YXZ';
    const s = (SCALE[u.id] || 1) * (u.bonus ? 1.14 : 1);
    const rig = ArenaCharacterModels.instantiate(u.id, u.team, body, opts);
    body.scale.setScalar(s);
    let ry = u.team ? 0 : Math.PI, age = 0, lastHp = u.hp, lastAttack = u.attackSeq || 0;
    let attack = 0, hit = 0, flinch = 0, walk = 0, stride = 0, dying = false, deathAge = 0, lastX = u.x, lastZ = u.y;
    root.position.set(u.x, 0, u.y);
    body.rotation.y = ry;
    const size = (u.big ? 19 : u.k > 2 ? 10 : 12) * (u.bonus ? 1.14 : 1);
    // Height of the health bar above the ground (animals and the small golems are lower).
    const height = (u.id === 'hounds' ? 26 : u.id === 'swarm' ? 20 : 42) * s + 5;
    return {
      u, root, size, height, rig,
      isDying: () => dying,
      dispose: () => rig.dispose(),
      death() { if (dying) return; dying = true; deathAge = 0; rig.pose('Death', 0, 1, true); },
      // Death clip, then the body sinks and shrinks into the ground.
      updateDeath(dt) {
        deathAge += dt;
        rig.pose('Death', dt);
        const k = Math.max(0, Math.min(1, (deathAge - .4) / .3));
        root.position.y = -k * k * 7;
        body.scale.setScalar(s * (1 - .5 * k));
        return deathAge;
      },
      update(time, dt, x, z) {
        age += dt;
        const sx = u.px === undefined ? u.x - lastX : u.x - u.px, sz = u.py === undefined ? u.y - lastZ : u.y - u.py;
        lastX = u.x; lastZ = u.y;
        const moving = u.moving === undefined ? Math.hypot(sx, sz) > .02 : !!u.moving;
        walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 10);
        // Facing: along the last step while walking, towards the target while fighting.
        let want = null;
        if (moving && Math.hypot(sx, sz) > .001) want = Math.atan2(sx, sz);
        else if (u.attacking && Number.isFinite(u.targetX) && Number.isFinite(u.targetY)) want = Math.atan2(u.targetX - u.x, u.targetY - u.y);
        if (want !== null) ry += wrap(want - ry) * Math.min(1, dt * 12);
        // Reactions.
        if (u.hp < lastHp) { hit = .26; flinch = .18; }
        lastHp = u.hp;
        if ((u.attackSeq || 0) !== lastAttack) attack = .55;
        lastAttack = u.attackSeq || 0;
        hit = Math.max(0, hit - dt); attack = Math.max(0, attack - dt); flinch = Math.max(0, flinch - dt);
        const rate = Math.max(.75, Math.min(1.7, (u.s || 38) / 38));
        // A hit only interrupts standing units; walkers flinch instead of stopping.
        const clip = age < .36 ? 'Spawn' : attack > 0 ? 'Attack' : walk > .5 ? 'Walk' : hit > 0 ? 'Hit' : 'Idle';
        rig.pose(clip, dt, clip === 'Walk' ? rate : 1);
        // Stride-locked bob: two small hops per walk cycle.
        stride += dt * rate * 2 * Math.PI / WALK_CYCLE;
        const bob = walk * Math.abs(Math.sin(stride)) * .7;
        // Summon: drop in with a little overshoot.
        const k = Math.min(1, age / SPAWN_TIME), entering = age < SPAWN_TIME;
        const drop = entering ? (1 - k) * (1 - k) * 16 : 0;
        const f = flinch / .18;
        body.scale.setScalar(s * (entering ? .55 + .45 * easeOutBack(k) : 1 + .07 * f));
        body.rotation.set(-.24 * f, ry, 0);
        root.position.set(x, bob + drop, z);
      }
    };
  }
  return { build };
})() : null;
