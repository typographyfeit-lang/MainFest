'use strict';
// glTF skinned characters. Geometry is shared per unit type (body and team cloth are merged into one
// mesh per team, so a unit costs two draw calls instead of three); every unit gets its own skeleton.
const ArenaCharacterModels = typeof THREE !== 'undefined' && typeof ArenaArt3D !== 'undefined' && ArenaArt3D ? (() => {
  const A = ArenaArt3D, T = A.T, C = A.C, cache = new Map();
  const ids = ['guard', 'archer', 'colossus', 'imp', 'mage', 'hounds', 'swarm', 'brute'];
  const LOOPS = { Idle: true, Walk: true };
  const FADE = { Attack: .06, Death: .1, Spawn: .01, Hit: .08 };
  let pending = null, litMaterial = null;
  const magicMaterials = new Map();

  function register(name, { doc, read }) {
    const skin = doc.skins[0], joints = skin.joints, nodes = joints.map(i => doc.nodes[i]);
    const indexByNode = new Map(joints.map((v, i) => [v, i])), inverses = read(skin.inverseBindMatrices, 'MAT4');
    if (inverses.length !== nodes.length * 16) throw Error('Invalid skin');
    const inverseMatrices = nodes.map((_, i) => new T.Matrix4().fromArray(inverses, i * 16));
    const prims = doc.meshes[0].primitives.map(p => {
      const a = p.attributes;
      return {
        kind: doc.materials[p.material].name,
        position: read(a.POSITION, 'VEC3'), normal: read(a.NORMAL, 'VEC3'), uv: read(a.TEXCOORD_0, 'VEC2'),
        color: read(a.COLOR_0, 'VEC3'), skinWeight: read(a.WEIGHTS_0, 'VEC4'), skinIndex: read(a.JOINTS_0, 'VEC4', 5123),
        index: read(p.indices, 'SCALAR', 5123), triangles: doc.accessors[p.indices].count / 3
      };
    });
    const clips = {};
    for (const c of doc.animations) {
      let duration = 0;
      const tracks = c.channels.map(ch => {
        const s = c.samplers[ch.sampler], times = read(s.input, 'SCALAR'), path = ch.target.path, n = path === 'rotation' ? 4 : 3;
        const values = read(s.output, path === 'rotation' ? 'VEC4' : 'VEC3');
        if (!['rotation', 'scale'].includes(path) || !indexByNode.has(ch.target.node) || values.length !== times.length * n) throw Error('Invalid animation');
        duration = Math.max(duration, times[times.length - 1]);
        return { i: indexByNode.get(ch.target.node), path, n, times, values };
      });
      clips[c.name] = { duration, tracks };
    }
    for (const clip of ['Idle', 'Walk', 'Attack', 'Hit', 'Death', 'Spawn']) if (!clips[clip]) throw Error('Missing animation ' + clip);
    const magicPrim = prims.find(p => p.kind === 'magic');
    cache.set(name, { nodes, indexByNode, inverseMatrices, prims, clips, root: indexByNode.get(skin.skeleton), lit: [null, null], magic: magicPrim ? geometry([magicPrim], null) : null });
  }

  // Merge primitives into one skinned geometry; team cloth colour is baked into the vertex colours.
  function geometry(list, cloth) {
    let vertices = 0, indices = 0;
    for (const p of list) { vertices += p.position.length / 3; indices += p.index.length; }
    const pos = new Float32Array(vertices * 3), nor = new Float32Array(vertices * 3), uv = new Float32Array(vertices * 2), col = new Float32Array(vertices * 3);
    const weight = new Float32Array(vertices * 4), joint = new Uint16Array(vertices * 4), index = new Uint16Array(indices);
    let vo = 0, io = 0;
    for (const p of list) {
      const n = p.position.length / 3, tint = cloth && p.kind === 'team';
      pos.set(p.position, vo * 3); nor.set(p.normal, vo * 3); uv.set(p.uv, vo * 2); weight.set(p.skinWeight, vo * 4); joint.set(p.skinIndex, vo * 4);
      for (let i = 0; i < n; i++) {
        col[(vo + i) * 3] = p.color[i * 3] * (tint ? cloth.r : 1);
        col[(vo + i) * 3 + 1] = p.color[i * 3 + 1] * (tint ? cloth.g : 1);
        col[(vo + i) * 3 + 2] = p.color[i * 3 + 2] * (tint ? cloth.b : 1);
      }
      for (let i = 0; i < p.index.length; i++) index[io + i] = p.index[i] + vo;
      vo += n; io += p.index.length;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(weight, 4));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(joint, 4));
    g.setIndex(new T.Uint16BufferAttribute(index, 1));
    g.computeBoundingSphere();
    return g;
  }
  function litGeometry(a, team) {
    if (!a.lit[team]) a.lit[team] = geometry(a.prims.filter(p => p.kind !== 'magic'), A.lin(C.cloth[team]));
    return a.lit[team];
  }
  function lit() {
    if (!litMaterial) litMaterial = new T.MeshStandardMaterial({ skinning: true, vertexColors: true, color: A.lin('#ffffff'), roughness: .76, metalness: .05 });
    return litMaterial;
  }
  function magic(team) {
    if (!magicMaterials.has(team)) magicMaterials.set(team, new T.MeshBasicMaterial({ skinning: true, vertexColors: true, color: A.lin(C.team[team]), toneMapped: false }));
    return magicMaterials.get(team);
  }
  function preload() {
    if (cache.size === ids.length) return Promise.resolve();
    if (!pending) pending = Promise.all(ids.map(async id => { if (!cache.has(id)) register(id, await ArenaBinary.load(id + '-unit')); })).catch(e => { pending = null; throw e; });
    return pending;
  }

  const q0 = new T.Quaternion(), q1 = new T.Quaternion(), vq = new T.Vector3();
  function instantiate(id, team, parent, opts = {}) {
    const a = cache.get(id);
    if (!a) throw Error('Unit not preloaded: ' + id);
    const group = new T.Group();
    parent.add(group);
    const bones = a.nodes.map(n => { const b = new T.Bone(); b.name = n.name; b.position.set(...n.translation); return b; });
    a.nodes.forEach((n, i) => { for (const ch of n.children || []) bones[i].add(bones[a.indexByNode.get(ch)]); });
    group.add(bones[a.root]);
    const skeleton = new T.Skeleton(bones, a.inverseMatrices.map(m => m.clone()));
    const meshes = [new T.SkinnedMesh(litGeometry(a, team), lit())];
    if (a.magic) meshes.push(new T.SkinnedMesh(a.magic, magic(team)));
    meshes[0].castShadow = !!opts.shadows;
    meshes[0].receiveShadow = true;
    for (const mesh of meshes) { mesh.frustumCulled = false; group.add(mesh); group.updateMatrixWorld(true); mesh.bind(skeleton, new T.Matrix4()); }

    // Clip playback with a short crossfade. Looping clips (Idle, Walk) keep their phase,
    // so switching between them never restarts the cycle.
    let clip = '', age = 0, fade = 1, fadeTime = .14;
    const phase = { Idle: 0, Walk: 0 }, prev = bones.map(b => ({ q: b.quaternion.clone(), s: b.scale.clone() }));
    function pose(name, dt, rate = 1, reset = false) {
      const c = a.clips[name] || a.clips.Idle, looping = !!LOOPS[name];
      if (clip !== name || reset) {
        bones.forEach((b, i) => { prev[i].q.copy(b.quaternion); prev[i].s.copy(b.scale); });
        fade = 0; fadeTime = FADE[name] || .14; clip = name;
        age = looping && !reset ? phase[name] : 0;
      }
      age += dt * rate;
      if (looping) phase[name] = age;
      fade = Math.min(1, fade + dt / fadeTime);
      const t = looping ? age % c.duration : Math.min(age, c.duration), blend = fade * fade * (3 - 2 * fade);
      for (const b of bones) b.scale.set(1, 1, 1);
      for (const tr of c.tracks) {
        const b = bones[tr.i], ts = tr.times;
        let j = 0;
        while (j + 1 < ts.length - 1 && t > ts[j + 1]) j++;
        const k = Math.min(j + 1, ts.length - 1), f = Math.max(0, Math.min(1, (t - ts[j]) / (ts[k] - ts[j] || 1)));
        if (tr.path === 'rotation') { q0.fromArray(tr.values, j * 4); q1.fromArray(tr.values, k * 4); q0.slerp(q1, f); b.quaternion.copy(prev[tr.i].q).slerp(q0, blend); }
        else {
          const i = j * 3, o = k * 3;
          vq.set(tr.values[i] * (1 - f) + tr.values[o] * f, tr.values[i + 1] * (1 - f) + tr.values[o + 1] * f, tr.values[i + 2] * (1 - f) + tr.values[o + 2] * f);
          b.scale.copy(prev[tr.i].s).lerp(vq, blend);
        }
      }
    }
    return {
      group, pose, skeleton, meshes,
      clip: () => clip,
      dispose() { if (typeof skeleton.dispose === 'function') skeleton.dispose(); else if (skeleton.boneTexture) skeleton.boneTexture.dispose(); }
    };
  }
  function stats() {
    return Object.fromEntries([...cache].map(([id, a]) => [id, { triangles: a.prims.reduce((s, p) => s + p.triangles, 0), bones: a.nodes.length, clips: Object.keys(a.clips), drawCalls: a.magic ? 2 : 1 }]));
  }
  return { preload, instantiate, stats };
})() : null;
