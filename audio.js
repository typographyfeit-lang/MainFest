'use strict';
// Original synthesized sound effects: no downloads, no copyrighted music. Audio never affects the simulation.
window.ArenaAudio = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, bus = null, enabled = true, ended = false, lastFx = 0, lastSpawn = 0, evi = 0;
  let seen = new WeakSet(), units = new WeakSet(), dead = new WeakSet();
  try { enabled = localStorage.getItem('ba_audio_v27') !== 'off'; } catch (_) {}
  const buttons = [...document.querySelectorAll('[data-sound]')];

  function sync() {
    for (const b of buttons) {
      if (b.dataset.sound === 'icon') b.textContent = enabled ? '🔊' : '🔇';
      else b.textContent = enabled ? 'Звук: вкл' : 'Звук: выкл';
      b.setAttribute('aria-pressed', String(enabled));
      b.setAttribute('aria-label', enabled ? 'Звук включён' : 'Звук выключен');
    }
  }
  function unlock() {
    if (!AC || !enabled) return;
    try {
      if (!ctx) { ctx = new AC(); bus = ctx.createGain(); bus.gain.value = .23; bus.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (_) { ctx = null; }
  }
  function tone(f0, f1, d, amp, type = 'sine', delay = 0) {
    if (!enabled || !ctx || ctx.state !== 'running' || !bus) return;
    try {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + d);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + .009);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + d + .02);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    } catch (_) {}
  }
  function vibrate(ms) { if (enabled && navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} }
  function click() { unlock(); tone(460, 680, .075, .12, 'sine'); }

  for (const b of buttons) b.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem('ba_audio_v27', enabled ? 'on' : 'off'); } catch (_) {}
    sync();
    if (enabled) { unlock(); if (bus) bus.gain.value = .23; click(); } else if (bus) bus.gain.value = 0;
  });
  sync();
  // Browsers only start audio after a user gesture.
  document.addEventListener('pointerdown', unlock, { passive: true });
  const hand = document.querySelector('#hand');
  if (hand) hand.addEventListener('click', e => { if (e.target.closest('.card')) click(); }, { passive: true });

  // Interface sounds requested by game.js.
  function ui(kind) {
    unlock();
    if (kind === 'unlock') [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .22, .11, 'triangle', i * .07));
    else if (kind === 'upgrade') { tone(587, 880, .2, .12, 'triangle'); tone(880, 1175, .26, .09, 'sine', .1); }
    else if (kind === 'error') { tone(220, 150, .16, .1, 'square'); vibrate(12); }
    else if (kind === 'pause') tone(520, 390, .09, .08, 'sine');
  }

  function begin() {
    seen = new WeakSet(); units = new WeakSet(); dead = new WeakSet();
    ended = false; lastFx = lastSpawn = 0; evi = 0;
    unlock();
    tone(330, 440, .2, .15, 'triangle'); tone(440, 660, .26, .12, 'sine', .12);
  }
  function event(e) {
    if (e.type === 'final') { [392, 523, 659, 784].forEach((f, i) => tone(f, f * 1.01, .3, .1, 'triangle', i * .09)); vibrate([15, 40, 15]); }
    else if (e.type === 'rage') { tone(180, 520, .35, .13, 'sawtooth'); tone(360, 720, .3, .07, 'triangle', .05); }
    else if (e.type === 'guardian') { [523, 784, 1047].forEach((f, i) => tone(f, f, .5, .1, 'sine', i * .06)); }
  }
  function frame(state) {
    const events = state.ev || [];
    if (!enabled || !ctx || ctx.state !== 'running') { evi = events.length; return; }
    const now = ctx.currentTime;
    for (const u of state.u) if (!units.has(u)) {
      units.add(u);
      if (u.team === 0 && now - lastSpawn > .15) { lastSpawn = now; tone(220, 490, .14, .14, 'triangle'); vibrate(9); }
    }
    for (const f of state.fx) {
      if (seen.has(f)) continue;
      seen.add(f);
      if (now - lastFx < .095) continue;
      lastFx = now;
      if (f.k === 'c') {
        if (f.card === 'meteor') { tone(140, 40, .55, .22, 'triangle'); tone(600, 90, .35, .08, 'sawtooth'); vibrate(30); }
        else if (f.card === 'spark') { tone(1400, 300, .18, .08, 'sawtooth'); tone(300, 90, .25, .12, 'triangle', .03); vibrate(16); }
        else { tone(260, 60, .24, .16, 'triangle'); tone(750, 120, .18, .07, 'sawtooth'); vibrate(18); }
      } else tone(900, 240, .075, .055, 'triangle');
    }
    for (const t of state.tw) if (t.hp <= 0 && !dead.has(t)) {
      dead.add(t);
      tone(150, 45, .39, .22, 'triangle'); tone(430, 70, .25, .065, 'sawtooth'); vibrate([25, 35, 30]);
    }
    while (evi < events.length) event(events[evi++]);
    if (state.done && !ended) {
      ended = true;
      const notes = state.result > 0 ? [392, 494, 587, 784] : state.result < 0 ? [392, 349, 294] : [392, 392, 440];
      notes.forEach((f, i) => tone(f, f, .32, .12, 'triangle', i * .13));
    }
  }
  return { begin, frame, ui };
})();
