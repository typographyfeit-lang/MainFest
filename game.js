'use strict';
// Crystal Dominion 3.1 — Sanctuary Duel.
// game.js owns the simulation, the save data and the HTML interface.
// The 3D renderer (render3d.js) only reads G; it never changes positions, HP or balance.

/* ------------------------------------------------------------------ constants */
const W = 360, H = 560, RY = 280, DEPLOY = 322;
const SHRINE = { x: 180, y: 280, rad: 54, period: 30 };
const VERSION = '3.1';
const FIXED = 1 / 30;            // simulation step, seconds (rendering interpolates between steps)
const MATCH = 180;               // match length, seconds
const FINAL = 60;                // last minute: runes recharge twice as fast for both sides
const RAGE = 15;                 // after losing an obelisk that side recharges twice as fast for 15 s
// ...and its core fortifies (faster, stronger, longer reach), so a lead is harder to finish off.
const FORTIFY = { rate: .75, damage: 1.2, range: 10 };
const UNIT_LIMIT = 36;           // living units per side
const MAX_LEVEL = 5;
const LEVEL_STEP = .07;          // +7 % health and damage per rune level
const UPGRADE_COST = [0, 0, 80, 160, 240, 320];   // shards to reach level N
const UNLOCK_COST = 100;
const RESULT_DELAY = 1100;       // ms: let the last tower collapse before the result card

const $ = s => document.querySelector(s);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pick = list => list[Math.floor(Math.random() * list.length)];

const CARDS = {
  guard: { n: 'Страж', ic: '🛡️', desc: 'Крепкий защитник', hp: 420, d: 55, r: 16, s: 38, as: 1.1, k: 1, col: '#7b8794', hd: '#d2a679' },
  archer: { n: 'Лучники', ic: '🏹', desc: 'Двое стрелков, бьют издалека', hp: 130, d: 28, r: 100, s: 34, as: 1, k: 2, col: '#4e9a4e', hd: '#d2a679' },
  colossus: { n: 'Колосс', ic: '🗿', desc: 'Очень прочный, атакует только башни', hp: 1500, d: 90, r: 22, s: 24, as: 1.6, k: 1, bld: 1, big: 1, col: '#8d8d8d', hd: '#a9a9a9' },
  imp: { n: 'Бес-подрывник', ic: '🧨', desc: 'Быстро бежит и взрывается', hp: 80, d: 250, r: 16, s: 72, as: 1, k: 1, boom: 40, col: '#d9602a', hd: '#f08a4b' },
  mage: { n: 'Маг огня', ic: '🔥', desc: 'Огненный шар бьёт по площади', hp: 190, d: 65, r: 95, s: 30, as: 1.4, k: 1, spl: 34, col: '#a04ad9', hd: '#d2a679' },
  hounds: { n: 'Гончие', ic: '🐺', desc: 'Три быстрых зверя', hp: 100, d: 28, r: 15, s: 75, as: .8, k: 3, col: '#b0b0b8', hd: '#c8c8d0' },
  swarm: { n: 'Рой', ic: '🪨', desc: 'Четыре маленьких голема', hp: 45, d: 18, r: 14, s: 52, as: .9, k: 4, col: '#6b5b4b', hd: '#8a7866' },
  brute: { n: 'Громила', ic: '🧱', desc: 'Сильный и выносливый боец', hp: 800, d: 95, r: 22, s: 30, as: 1.3, k: 1, big: 1, col: '#a8553a', hd: '#d2a679' },
  meteor: { n: 'Метеорит', ic: '☄️', desc: 'Удар по большой области', sp: 1, d: 250, rad: 50 },
  spark: { n: 'Искра', ic: '⚡', desc: 'Молния по небольшой области', sp: 1, d: 170, rad: 28 }
};
const CD = { guard: 7, archer: 9, colossus: 14, imp: 7, mage: 11, hounds: 10, swarm: 8, brute: 12, meteor: 15, spark: 12 };
const START = ['guard', 'archer', 'colossus', 'imp', 'mage', 'hounds', 'swarm', 'meteor'];
const DEFAULT = ['guard', 'mage', 'colossus', 'meteor'];
const UNIT_IDS = Object.keys(CARDS).filter(id => !CARDS[id].sp);
// wait: seconds between bot decisions; factor: bot cooldown multiplier.
const DIFF = {
  easy: { wait: 4.2, factor: 1.35 },
  normal: { wait: 2.3, factor: 1 },
  hard: { wait: 1.25, factor: .88 }
};
// Bot squads: each battle the bot plays one of these, so fights stay varied.
const AI_DECKS = [
  ['guard', 'mage', 'colossus', 'spark'],
  ['hounds', 'archer', 'brute', 'meteor'],
  ['swarm', 'imp', 'guard', 'spark'],
  ['colossus', 'archer', 'hounds', 'meteor'],
  ['brute', 'mage', 'swarm', 'spark'],
  ['imp', 'hounds', 'archer', 'meteor']
];
const TANKS = ['colossus', 'brute', 'guard'];
const SUPPORT = ['archer', 'mage', 'hounds', 'swarm', 'imp'];
const COUNTER = {
  crowd: ['mage', 'archer', 'guard', 'brute', 'hounds'],     // against many small units
  heavy: ['hounds', 'swarm', 'imp', 'brute', 'guard'],       // against heavy units
  any: ['guard', 'brute', 'hounds', 'archer', 'mage', 'swarm', 'imp']
};

/* ------------------------------------------------------------------ save data */
const SAVE = 'crystal-dominion-v1';   // key unchanged so 3.0 progress carries over; the format is versioned inside
function readSave(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }
function unique(a) { return Array.isArray(a) ? [...new Set(a.filter(id => hasOwn(CARDS, id)))] : []; }
function sanitize(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const own = unique([...START, ...unique(raw.own)]);
  const deck = unique(raw.deck).filter(id => own.includes(id));
  if (!deck.some(id => !CARDS[id].sp)) deck.unshift('guard');
  for (const id of DEFAULT) if (!deck.includes(id)) deck.push(id);
  const safe = v => Number.isFinite(v) ? Math.max(0, Math.min(999999, Math.floor(v))) : 0;
  const lv = {};
  for (const id of own) {
    const v = raw.lv && raw.lv[id];
    lv[id] = Number.isFinite(v) ? clamp(Math.floor(v), 1, MAX_LEVEL) : 1;
  }
  return {
    version: 2, tr: safe(raw.tr), coin: Number.isFinite(raw.coin) ? safe(raw.coin) : 150,
    own, deck: deck.slice(0, 4), lv, wins: safe(raw.wins), battles: safe(raw.battles),
    difficulty: hasOwn(DIFF, raw.difficulty) ? raw.difficulty : 'normal'
  };
}
let S = sanitize(readSave(SAVE) || readSave('ba1'));
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} };
save();

// Progress code: a manual backup the player can copy and restore on any device.
function checksum(text) { let h = 7; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 1000003; return h.toString(36); }
function exportCode() { const json = JSON.stringify(S); return `CD1.${btoa(json)}.${checksum(json)}`; }
function importCode(code) {
  const m = /^CD1\.([A-Za-z0-9+/=]+)\.([a-z0-9]+)$/.exec(String(code || '').replace(/\s+/g, ''));
  if (!m) return null;
  try { const json = atob(m[1]); if (checksum(json) !== m[2]) return null; return sanitize(JSON.parse(json)); } catch (_) { return null; }
}
const levelOf = id => (S.lv && S.lv[id]) || 1;
const levelMult = lv => 1 + LEVEL_STEP * (clamp(lv, 1, MAX_LEVEL) - 1);
const sound = kind => { if (typeof ArenaAudio !== 'undefined' && ArenaAudio.ui) ArenaAudio.ui(kind); };

/* ------------------------------------------------------------------ menus */
let selected = null;
function cardEl(id, cls = '', battle = false) {
  const c = CARDS[id], lv = levelOf(id);
  return `<button type="button" class="card rune ${cls}" data-id="${id}" aria-label="${c.n}, уровень ${lv}, перезарядка ${CD[id]} сек. ${c.desc}"><b>${CD[id]}с</b>${lv > 1 ? `<small class="lv">ур.${lv}</small>` : ''}<em>${c.ic}</em><span class="rune-name">${c.n}</span>${battle ? '<span class="ready-label">Готов</span><i class="cooldown-track"><i></i></i>' : ''}</button>`;
}
function forgeItem(id) {
  const c = CARDS[id], lv = levelOf(id), owned = S.own.includes(id);
  let action, info;
  if (!owned) {
    action = `<button type="button" data-unlock="${id}" ${S.coin < UNLOCK_COST ? 'disabled' : ''}>Открыть · ${UNLOCK_COST}</button>`;
    info = 'Новая руна';
  } else if (lv >= MAX_LEVEL) {
    action = '<button type="button" disabled>Максимум</button>';
    info = `Уровень ${lv} · +${Math.round(LEVEL_STEP * (lv - 1) * 100)}%`;
  } else {
    const cost = UPGRADE_COST[lv + 1];
    action = `<button type="button" data-upgrade="${id}" ${S.coin < cost ? 'disabled' : ''}>Улучшить · ${cost}</button>`;
    info = `Уровень ${lv} → ${lv + 1}: +${Math.round(LEVEL_STEP * 100)}% ${c.sp ? 'урона' : 'здоровья и урона'}`;
  }
  return `<div class="unlock-item">${cardEl(id)}<div class="forge-info"><b>${c.n}</b><small>${c.desc}</small><small class="forge-level">${info}</small></div>${action}</div>`;
}
function ui() {
  $('#tr').textContent = `Побед: ${S.wins}`;
  $('#co').textContent = `Осколки: ${S.coin}`;
  $('#deck').innerHTML = S.deck.map(id => cardEl(id)).join('');
  $('#coll').innerHTML = Object.keys(CARDS).filter(id => !S.deck.includes(id)).map(id => cardEl(id, (!S.own.includes(id) ? 'lock ' : '') + (selected === id ? 'sel' : ''))).join('');
  const order = [...S.deck, ...Object.keys(CARDS).filter(id => !S.deck.includes(id))];
  const locked = order.filter(id => !S.own.includes(id)), owned = order.filter(id => S.own.includes(id));
  $('#unlock-list').innerHTML = [...locked, ...owned].map(forgeItem).join('');
  $('#difficulty').value = S.difficulty;
  $('#record').textContent = `Сражений: ${S.battles} · Побед: ${S.wins}`;
}
$('#deck').onclick = e => {
  const el = e.target.closest('.card');
  if (!el || !selected || !S.own.includes(selected)) return;
  const i = [...el.parentNode.children].indexOf(el), next = [...S.deck];
  next[i] = selected;
  if (!next.some(id => !CARDS[id].sp)) { $('#deckhint').textContent = 'Оставь хотя бы одного бойца в отряде.'; return; }
  S.deck = next; selected = null;
  $('#deckhint').textContent = 'Выбери руну в коллекции, затем замени одну из четырёх.';
  save(); ui();
};
$('#coll').onclick = e => {
  const el = e.target.closest('.card');
  if (el && S.own.includes(el.dataset.id)) { selected = el.dataset.id; ui(); }
  else if (el) $('#deckhint').textContent = 'Эту руну можно открыть в Кузнице.';
};
$('#unlock-list').onclick = e => {
  const unlock = e.target.closest('[data-unlock]')?.dataset.unlock;
  const upgrade = e.target.closest('[data-upgrade]')?.dataset.upgrade;
  if (unlock && hasOwn(CARDS, unlock) && !S.own.includes(unlock) && S.coin >= UNLOCK_COST) {
    S.coin -= UNLOCK_COST; S.own.push(unlock); S.lv[unlock] = 1; save(); ui(); sound('unlock');
    $('#shopmsg').textContent = `Открыта руна: ${CARDS[unlock].n}`;
  } else if (upgrade && S.own.includes(upgrade)) {
    const lv = levelOf(upgrade), cost = UPGRADE_COST[lv + 1];
    if (lv >= MAX_LEVEL || S.coin < cost) return;
    S.coin -= cost; S.lv[upgrade] = lv + 1; save(); ui(); sound('upgrade');
    $('#shopmsg').textContent = `${CARDS[upgrade].n}: уровень ${lv + 1}!`;
  }
};
$('#difficulty').onchange = e => { if (hasOwn(DIFF, e.target.value)) { S.difficulty = e.target.value; save(); } };
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button,.tab').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.t).classList.add('on');
});
$('#export').onclick = async () => {
  const code = exportCode(), msg = $('#savemsg');
  try { await navigator.clipboard.writeText(code); msg.textContent = 'Код скопирован. Сохрани его в заметках.'; }
  catch (_) { prompt('Скопируй и сохрани этот код:', code); msg.textContent = 'Сохрани код в заметках.'; }
};
$('#import').onclick = () => {
  const code = prompt('Вставь код прогресса (начинается с CD1.)'), msg = $('#savemsg');
  if (!code) return;
  const data = importCode(code);
  if (!data) { msg.textContent = 'Код не подошёл. Проверь, что он скопирован целиком.'; return; }
  if (!confirm(`Заменить прогресс? В коде: побед ${data.wins}, осколков ${data.coin}.`)) return;
  S = data; selected = null; save(); ui(); msg.textContent = 'Прогресс восстановлен.';
};

/* ------------------------------------------------------------------ battle state */
const cv = $('#cv');
let G = null, raf = 0, gesture = null, drag = null, ignoreClickUntil = 0, hintTimer = 0, bannerTimer = 0;
const route = x => x < 130 ? 'left' : x > 230 ? 'right' : 'center';
const tower = (team, x, y, king) => ({ team, x, y, king: !!king, hp: king ? 3600 : 1100, max: king ? 3600 : 1100, rad: king ? 37 : 16, r: king ? 112 : 96, d: king ? 65 : 42, as: king ? 1 : 1.1, cd: 0 });
function structures() { return [tower(0, 53, 391, false), tower(0, 307, 391, false), tower(0, 180, 508, true), tower(1, 53, 169, false), tower(1, 307, 169, false), tower(1, 180, 52, true)]; }
function core(team) { return G.tw.find(t => t.team === team && t.king); }
function ratio(team) { const t = core(team); return Math.max(0, t.hp) / t.max; }
const alive = team => G.u.filter(u => u.team === team && u.hp > 0).length;
function constrain(u, oldX = u.x, oldY = u.y) {
  const rad = u.rad || 12;
  u.x = clamp(u.x, rad, W - rad); u.y = clamp(u.y, rad, H - rad);
  for (const t of G.tw) {
    if (t.hp <= 0) continue;
    const min = t.rad + rad, dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy);
    if (d >= min) continue;
    let nx = dx, ny = dy, len = d;
    if (len < .001) { nx = oldX - t.x; ny = oldY - t.y; len = Math.hypot(nx, ny); if (len < .001) { nx = 0; ny = u.team ? 1 : -1; len = 1; } }
    u.x = clamp(t.x + nx / len * (min + .01), rad, W - rad);
    u.y = clamp(t.y + ny / len * (min + .01), rad, H - rad);
  }
}
function validPoint(p) { return !!(p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H); }
function placementError(p, c, slot = G?.sel) {
  if (!G || !c) return 'Выбери руну';
  if (!validPoint(p)) return 'Коснись арены';
  if (!(G.cool[0][G.hand[slot]] <= .0001)) return 'Руна ещё заряжается';
  if (c.sp) return '';
  if (p.y < DEPLOY) return 'Бойцов можно призвать только на своей половине';
  if (G.tw.some(t => t.hp > 0 && dist(p, t) < t.rad + (c.big ? 19 : 12))) return 'Слишком близко к башне';
  if (alive(0) >= UNIT_LIMIT) return 'На поле слишком много бойцов';
  return '';
}
function placement(p, c, slot = G?.sel) {
  if (!G || !c || G.done || G.paused) return false;
  return placementError(p, c, slot) === '';
}
function spawn(id, team, x, y, { bonus = false } = {}) {
  const c = CARDS[id];
  if (!c || c.sp) return;
  const m = bonus ? 1 : (G.mult && G.mult[team] && G.mult[team][id]) || 1;
  for (let i = 0; i < c.k; i++) {
    if (alive(team) >= UNIT_LIMIT) break;
    const u = { ...c, id, team, x: x + (i - (c.k - 1) / 2) * 18, y: y + rnd(-4, 4), hp: Math.round(c.hp * m), max: Math.round(c.hp * m), d: Math.round(c.d * m), cd: .5, rad: c.big ? 19 : c.k > 2 ? 10 : 12, path: bonus ? 'attack' : route(x), bonus, attackSeq: 0, moving: false };
    if (bonus) { u.hp = u.max = 1050; u.d = 75; u.s = 34; u.r = 20; u.as = 1.2; u.bld = 0; u.rad = 19; }
    else u.y = team ? Math.min(u.y, H - DEPLOY) : Math.max(u.y, DEPLOY);
    constrain(u);
    u.px = u.x; u.py = u.y;          // previous step position, for render interpolation
    G.u.push(u);
  }
}
function blast(x, y, r, d, team, m, card = 'impact', src = null) {
  G.fx.push({ k: 'c', x, y, r, l: card === 'meteor' ? .62 : .32, card, team, a: src });
  for (const o of [...G.u, ...G.tw]) if (o.team !== team && o.hp > 0 && Math.hypot(o.x - x, o.y - y) <= r + o.rad) o.hp -= d * (o.king === undefined ? 1 : m);
}
function playRune(team, id, p) {
  const c = CARDS[id];
  if (!G || G.done || G.paused || !c || !validPoint(p) || !hasOwn(G.cool[team], id) || G.cool[team][id] > 0) return false;
  if (!c.sp && (team === 0 ? p.y < DEPLOY : p.y > H - DEPLOY)) return false;
  if (!c.sp && G.tw.some(t => t.hp > 0 && dist(p, t) < t.rad + (c.big ? 19 : 12))) return false;
  if (!c.sp && alive(team) >= UNIT_LIMIT) return false;
  G.cool[team][id] = CD[id] * (team ? DIFF[G.difficulty].factor : 1);
  if (c.sp) blast(p.x, p.y, c.rad, Math.round(c.d * ((G.mult[team] && G.mult[team][id]) || 1)), team, .4, id);
  else spawn(id, team, p.x, p.y);
  G.ev.push({ type: 'cast', team, id, x: p.x, y: p.y, sp: !!c.sp });
  return true;
}
function pickAiDeck() { return [...pick(AI_DECKS)]; }
// The bot keeps up with the player's rune upgrades: easy never does, normal stays one level
// behind, hard matches the player's average level (at least level 2).
function botLevelFor(difficulty) {
  const avg = S.deck.reduce((sum, id) => sum + levelOf(id), 0) / S.deck.length;
  if (difficulty === 'easy') return 1;
  if (difficulty === 'normal') return clamp(Math.round(avg) - 1, 1, MAX_LEVEL);
  return clamp(Math.max(2, Math.round(avg)), 1, MAX_LEVEL);
}
function start() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; gesture = null; cancelDrag();
  const ai = pickAiDeck(), botLevel = levelMult(botLevelFor(S.difficulty));
  G = {
    t: MATCH, u: [], fx: [], ev: [], hand: [...S.deck], ai, sel: -1, at: 2.5, done: 0, paused: false,
    last: performance.now(), acc: 0, alpha: 1, steps: 0, finishAge: 0, hud: { evi: 0 }, difficulty: S.difficulty, tw: structures(),
    cool: [Object.fromEntries(S.deck.map(id => [id, 0])), Object.fromEntries(ai.map(id => [id, 0]))],
    mult: [Object.fromEntries(S.deck.map(id => [id, levelMult(levelOf(id))])), Object.fromEntries(ai.map(id => [id, botLevel]))],
    rage: [0, 0], finalOn: false, aiPush: null,
    shrine: { next: 30, owner: -1, contested: false, charge: 0, candidate: -1, pulse: 0, lastAward: -1, awards: [0, 0] }
  };
  $('#game').hidden = false; $('#res').hidden = true; $('#pausemenu').hidden = true;
  hand(); V.begin(G); upd();
  raf = requestAnimationFrame(loop);
}
function hand() { $('#hand').innerHTML = G.hand.map((id, i) => cardEl(id, G.sel === i ? 'sel' : '', true)).join(''); G.hud.runes = ''; }
function markSelection() { [...$('#hand').children].forEach((el, i) => el.classList.toggle('sel', !!G && G.sel === i)); }

/* ------------------------------------------------------------------ input */
function hint(text) {
  const t = $('#toast');
  if (!t || !text) return;
  t.textContent = text; t.classList.add('on');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => t.classList.remove('on'), 1700);
}
function pulseHand() { const h = $('#hand'); h.classList.remove('pulse'); void h.offsetWidth; h.classList.add('pulse'); }
function selectSlot(i) {
  if (!G || G.done || G.paused || i < 0 || i >= G.hand.length) return;
  if (G.cool[0][G.hand[i]] > 0) { hint('Руна ещё заряжается'); return; }
  cancelGesture(); G.sel = G.sel === i ? -1 : i; markSelection(); upd();
}
$('#hand').onclick = e => {
  if (performance.now() < ignoreClickUntil) return;
  const el = e.target.closest('.card');
  if (!el || !G || G.done) return;
  selectSlot([...$('#hand').children].indexOf(el));
};
cv.onpointerdown = e => {
  if (!G || G.done || G.paused || gesture || e.button > 0) return;
  if (G.sel < 0) { hint('Сначала выбери руну внизу'); pulseHand(); return; }
  const c = CARDS[G.hand[G.sel]], p = V.pick(e);
  gesture = { id: e.pointerId, slot: G.sel };
  if (V.preview) V.preview(p, c, placement(p, c));
  if (e.pointerId !== undefined && cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (_) {}
};
cv.onpointerup = e => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const g = gesture; gesture = null;
  if (V.preview) V.preview(null);
  if (!G || G.done || G.sel !== g.slot || G.sel < 0) return;
  const p = V.pick(e), id = G.hand[G.sel], c = CARDS[id];
  if (!placement(p, c)) { hint(placementError(p, c)); sound('error'); return; }
  if (!playRune(0, id, p)) return;
  G.sel = -1; markSelection(); upd();
};
cv.addEventListener('pointermove', e => {
  if (!G || G.done || G.sel < 0 || !V.preview || (gesture && gesture.id !== e.pointerId) || drag) return;
  const c = CARDS[G.hand[G.sel]], p = V.pick(e);
  V.preview(p, c, placement(p, c));
}, { passive: true });
function cancelGesture() { gesture = null; if (V.preview) V.preview(null); }
cv.addEventListener('pointercancel', cancelGesture);
cv.addEventListener('lostpointercapture', cancelGesture);
cv.addEventListener('pointerleave', () => { if (!gesture && !drag && V.preview) V.preview(null); }, { passive: true });

// Drag a rune from the hand straight onto the arena (a tap still selects it).
const overCanvas = e => { const r = cv.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
function moveGhost(e, show) {
  const g = $('#ghost');
  if (!g || !g.style) return;
  g.hidden = !show;
  if (show) g.style.transform = `translate(${Math.round(e.clientX)}px,${Math.round(e.clientY)}px)`;
}
function cancelDrag() {
  if (!drag) return;
  drag.el.classList.remove('dragging');
  moveGhost(null, false);
  drag = null;
  if (V.preview) V.preview(null);
}
$('#hand').addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest('.card');
  if (!el || !G || G.done || G.paused || drag || e.button > 0) return;
  const slot = [...$('#hand').children].indexOf(el);
  if (slot < 0) return;
  drag = { slot, pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, el };
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
});
$('#hand').addEventListener('pointermove', e => {
  if (!drag || drag.pointer !== e.pointerId || !G) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12) return;
    if (G.cool[0][G.hand[drag.slot]] > 0) { hint('Руна ещё заряжается'); cancelDrag(); return; }
    drag.moved = true; cancelGesture(); G.sel = drag.slot; markSelection();
    drag.el.classList.add('dragging');
    const g = $('#ghost');
    if (g) g.dataset.id = G.hand[drag.slot];
  }
  const over = overCanvas(e), c = CARDS[G.hand[drag.slot]], p = over ? V.pick(e) : null;
  moveGhost(e, true);
  if (V.preview) V.preview(p, c, p ? placement(p, c, drag.slot) : false);
}, { passive: true });
$('#hand').addEventListener('pointerup', e => {
  if (!drag || drag.pointer !== e.pointerId) return;
  const d = drag;
  cancelDrag();
  if (!d.moved || !G) return;
  ignoreClickUntil = performance.now() + 400;
  const id = G.hand[d.slot], c = CARDS[id];
  if (overCanvas(e)) {
    const p = V.pick(e);
    if (placement(p, c, d.slot) && playRune(0, id, p)) { G.sel = -1; markSelection(); upd(); return; }
    hint(placementError(p, c, d.slot) || 'Сюда нельзя'); sound('error');
  }
  G.sel = -1; markSelection();
});
$('#hand').addEventListener('pointercancel', cancelDrag);
document.addEventListener('keydown', e => {
  if (!G || G.done) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'з') { setPaused(!G.paused); return; }
  const n = Number(e.key);
  if (n >= 1 && n <= 4) selectSlot(n - 1);
});

/* ------------------------------------------------------------------ pause and exit */
function setPaused(on) {
  if (!G || G.done) return;
  G.paused = !!on;
  G.menu = G.paused;               // the renderer freezes visuals only behind the pause menu
  $('#pausemenu').hidden = !G.paused;
  if (G.paused) { cancelGesture(); cancelDrag(); }
  G.last = performance.now(); G.acc = 0;
  const q = $('#quit');
  q.textContent = 'Выйти из боя'; q.dataset.confirm = '';
  sound('pause');
}
function leaveBattle() {
  cancelGesture(); cancelDrag();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (V.stop) V.stop();
  G = null;
  $('#game').hidden = true; $('#res').hidden = true; $('#pausemenu').hidden = true;
  ui();
}
$('#pause').onclick = () => setPaused(true);
$('#resume').onclick = () => setPaused(false);
$('#quit').onclick = () => {
  const q = $('#quit');
  if (q.dataset.confirm !== '1') { q.dataset.confirm = '1'; q.textContent = 'Точно выйти? Бой не засчитается'; return; }
  leaveBattle();
};
document.addEventListener('visibilitychange', () => {
  if (!G) return;
  cancelGesture(); cancelDrag();
  G.last = performance.now(); G.acc = 0;
  if (document.hidden && !G.done && !G.paused) setPaused(true);
});

/* ------------------------------------------------------------------ simulation */
function loop(now) {
  raf = 0;
  if (!G) return;
  const dt = Math.max(0, Math.min(.5, (now - G.last) / 1000));
  G.last = now;
  if (document.hidden) { G.acc = 0; raf = requestAnimationFrame(loop); return; }
  if (!G.done && !G.paused) {
    G.acc += dt;
    while (G.acc + 1e-9 >= FIXED && !G.done) { step(FIXED); G.acc -= FIXED; }
    G.alpha = clamp(G.acc / FIXED, 0, 1);
  }
  V.frame(G); upd();
  if (G.done) { G.finishAge += dt; if (G.finishAge >= 1.4) return; }
  raf = requestAnimationFrame(loop);
}
// No accumulated permanent advantage: exclusive presence for 1.5 seconds, contested = neutral.
// Every 30 seconds the shrine awards at most one guardian, then resets. Bonus units cannot capture.
function shrineStep(dt) {
  const s = G.shrine;
  s.pulse = Math.max(0, s.pulse - dt);
  const present = [false, false];
  for (const u of G.u) if (u.hp > 0 && !u.bonus && dist(u, SHRINE) <= SHRINE.rad) present[u.team] = true;
  s.contested = present[0] && present[1];
  const side = present[0] === present[1] ? -1 : present[0] ? 0 : 1;
  if (side !== s.candidate) { s.charge = 0; s.candidate = side; s.owner = -1; }
  if (side < 0) { s.owner = -1; s.charge = 0; }
  else { s.charge = Math.min(1.5, s.charge + dt); s.owner = s.charge >= 1.5 ? side : -1; }
  s.next -= dt;
  if (s.next <= 1e-7) {
    const winner = s.owner;
    s.lastAward = -1; s.pulse = .7;
    if (winner >= 0 && alive(winner) < UNIT_LIMIT) {
      spawn('colossus', winner, 180, 280 + (winner ? 23 : -23), { bonus: true });
      s.awards[winner]++; s.lastAward = winner; s.pulse = 2;
      G.fx.push({ k: 'c', x: 180, y: 280, r: SHRINE.rad, l: .32, card: 'shrine', team: winner });
      if (G.ev) G.ev.push({ type: 'guardian', team: winner });
    }
    for (const u of G.u) if (u.path === 'center') u.path = 'attack';
    s.owner = -1; s.candidate = -1; s.charge = 0; s.contested = false; s.next += SHRINE.period;
  }
}

/* --- bot ------------------------------------------------------------ */
// The densest group of enemy units a blast of radius r can hit.
function bestBlast(foes, r) {
  let best = null;
  for (const a of foes) {
    let n = 0, big = false;
    for (const b of foes) if (Math.hypot(a.x - b.x, a.y - b.y) <= r + (b.rad || 12) * .5) { n++; if (b.big || b.bonus) big = true; }
    if (!best || n > best.n) best = { x: a.x, y: a.y, n, big };
  }
  return best;
}
function counterPick(units, threat) {
  const small = threat.filter(u => u.k > 1).length, heavy = threat.some(u => u.big || u.bonus);
  const order = heavy ? COUNTER.heavy : small >= 3 ? COUNTER.crowd : COUNTER.any;
  return order.find(id => units.includes(id)) || pick(units);
}
function chooseLane() {
  const d = G.difficulty;
  if (d !== 'easy' && G.shrine.next < 12) return 'center';
  if (G.aiPush && G.t > G.aiPush.until) return G.aiPush.lane;
  if (d === 'hard' && Math.random() < .75) {
    const ob = x => G.tw.find(t => t.team === 0 && !t.king && t.x === x);
    const l = ob(53), r = ob(307), lh = l.hp > 0 ? l.hp : -1, rh = r.hp > 0 ? r.hp : -1;
    return lh === rh ? pick(['left', 'right']) : lh < rh ? 'left' : 'right';
  }
  const r = Math.random();
  return r < .38 ? 'center' : r < .69 ? 'left' : 'right';
}
function pickAttack(units) {
  if (G.difficulty === 'easy') return pick(units);
  if (G.aiPush && G.t > G.aiPush.until) { const s = SUPPORT.find(id => units.includes(id)); if (s) return s; }
  if (G.shrine.next < 12 && units.includes('mage')) return 'mage';
  const tank = TANKS.find(id => units.includes(id));
  if (tank && (G.difficulty === 'hard' || Math.random() < .5)) return tank;
  return pick(units);
}
function aiStep(dt) {
  if ((G.at -= dt) > 0) return;
  const D = DIFF[G.difficulty];
  G.at = D.wait + rnd(0, .55);
  const ready = G.ai.filter(id => G.cool[1][id] <= 0);
  if (!ready.length) return;
  const foes = G.u.filter(u => u.team === 0 && u.hp > 0);
  const threat = foes.filter(u => u.y < 205);
  // 1. Spells: clusters, heavy intruders, or a nearly destroyed obelisk on hard.
  for (const id of ready.filter(k => CARDS[k].sp)) {
    const c = CARDS[id], target = bestBlast(foes, c.rad);
    const need = id === 'meteor' ? 3 : 2;
    if (target && (target.n >= need || (target.big && target.y < 240 && G.difficulty !== 'easy'))) { if (playRune(1, id, target)) return; }
    if (G.difficulty === 'hard' && id === 'meteor') {
      const weak = G.tw.find(t => t.team === 0 && t.hp > 0 && t.hp <= c.d * .4 * G.mult[1][id]);
      if (weak && playRune(1, id, weak)) return;
    }
  }
  const units = ready.filter(id => !CARDS[id].sp);
  if (!units.length) return;
  // 2. Defence: answer units that crossed into the bot half.
  if (threat.length) {
    const lead = threat.reduce((a, b) => a.y < b.y ? a : b);
    const id = G.difficulty === 'easy' || (G.difficulty === 'normal' && Math.random() < .35) ? (units.includes('guard') ? 'guard' : pick(units)) : counterPick(units, threat);
    if (playRune(1, id, { x: clamp(lead.x, 25, 335), y: 205 }) || playRune(1, id, { x: 180, y: 225 })) return;
  }
  // 3. Contest the shrine when the player is about to take it.
  if (G.difficulty !== 'easy' && G.shrine.candidate === 0 && G.shrine.next < 20) {
    const id = units.includes('guard') ? 'guard' : pick(units);
    if (playRune(1, id, { x: 180, y: 225 })) return;
  }
  // 4. Attack: tanks lead a lane, support follows on normal and hard.
  const id = pickAttack(units), lane = chooseLane(), x = lane === 'left' ? 96 : lane === 'right' ? 264 : 180;
  if (playRune(1, id, { x, y: 225 }) || playRune(1, id, { x: 180, y: 225 })) {
    if (TANKS.includes(id) && G.difficulty !== 'easy') G.aiPush = { lane, until: G.t - 6 };
  }
}
function step(dt) {
  G.steps = (G.steps || 0) + 1;
  for (const u of G.u) { u.px = u.x; u.py = u.y; u.moving = false; }
  G.t = Math.max(0, G.t - dt);
  if (!G.finalOn && G.t <= FINAL) { G.finalOn = true; G.ev.push({ type: 'final' }); }
  for (let team = 0; team < 2; team++) {
    if (G.rage[team] > 0) G.rage[team] = Math.max(0, G.rage[team] - dt);
    const rate = G.t <= FINAL || G.rage[team] > 0 ? 2 : 1, cd = G.cool[team];
    for (const id of Object.keys(cd)) cd[id] = cd[id] - dt * rate < 1e-7 ? 0 : cd[id] - dt * rate;
  }
  aiStep(dt);
  G.u.forEach(u => act(u, dt));
  G.tw.forEach(t => t.hp > 0 && tow(t, dt));
  sep();
  G.u = G.u.filter(u => u.hp > 0);
  G.fx.forEach(f => f.l -= dt);
  G.fx = G.fx.filter(f => f.l > 0);
  for (const t of G.tw) if (t.hp <= 0 && !t.down) {
    t.down = true;
    G.ev.push({ type: 'tower', team: t.team, king: t.king });
    if (!t.king) {
      G.rage[t.team] = RAGE;
      const k = core(t.team);
      k.as *= FORTIFY.rate; k.d = Math.round(k.d * FORTIFY.damage); k.r += FORTIFY.range;
      G.ev.push({ type: 'rage', team: t.team });
    }
  }
  if (core(0).hp <= 0 || core(1).hp <= 0 || G.t <= 1e-7) { end(); return; }
  shrineStep(dt);
}
// Detour around intact structures rather than pushing directly into them.
function move(u, x, y, dt) {
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  if (d < .001) return;
  let nx = dx / d, ny = dy / d;
  for (const t of G.tw) {
    if (t.hp <= 0 || Math.hypot(x - t.x, y - t.y) < .1) continue;
    const ox = t.x - u.x, oy = t.y - u.y, dd = Math.hypot(ox, oy), clear = t.rad + u.rad + 5, forward = ox * nx + oy * ny, side = ox * ny - oy * nx;
    if (dd > clear + 28 || forward <= 0 || forward > d || Math.abs(side) >= clear) continue;
    // Choose a stable bypass side. At the field edge prefer the direction into the arena.
    const rx = ox / (dd || 1), ry = oy / (dd || 1);
    let turn = side >= 0 ? -1 : 1;
    if (Math.abs(side) < 1) turn = u.x < 180 ? 1 : -1;
    const px = -ry * turn, py = rx * turn;
    if (u.x + px * clear < u.rad || u.x + px * clear > W - u.rad || u.y + py * clear < u.rad || u.y + py * clear > H - u.rad) turn = -turn;
    nx = -ry * turn - rx * .14; ny = rx * turn - ry * .14;
    const n = Math.hypot(nx, ny) || 1;
    nx /= n; ny /= n;
    break;
  }
  const amount = Math.min(d, u.s * dt), ox = u.x, oy = u.y;
  u.x += nx * amount; u.y += ny * amount;
  constrain(u, ox, oy);
  if (amount > .001) u.moving = true;
}
function act(u, dt) {
  if (u.hp <= 0) return;
  u.cd -= dt; u.attacking = false;
  let target = null, bd = Infinity;
  const center = u.path === 'center' && !u.bonus, flank = u.path === 'left' || u.path === 'right', before = u.team ? u.y < 325 : u.y > 235;
  // Attack near opponents; central squads do not abandon the shrine for remote targets.
  if (!u.bld) for (const o of G.u) {
    if (o === u || o.team === u.team || o.hp <= 0) continue;
    const d = dist(u, o) - o.rad, reach = center ? Math.max(u.r, 32) : Math.max(85, u.r);
    if (d < bd && d <= reach && (!center || dist(o, SHRINE) < 85 || d <= u.r)) { bd = d; target = o; }
  }
  // Buildings are engaged opportunistically, or become the destination after the route.
  for (const o of G.tw) if (o.team !== u.team && o.hp > 0) {
    const d = dist(u, o) - o.rad;
    if (d < bd && (!center && !flank || d <= u.r || flank && !before)) { bd = d; target = o; }
  }
  if (target && bd <= u.r) {
    u.targetX = target.x; u.targetY = target.y; u.attacking = true;
    if (u.cd > 0) return;
    u.cd = u.as; u.attackSeq++;
    if (u.boom) { blast(u.x, u.y, u.boom, u.d, u.team, 1, 'imp'); u.hp = 0; }
    else if (u.spl) blast(target.x, target.y, u.spl, u.d, u.team, 1, u.id, u);
    else { target.hp -= u.d; G.fx.push({ k: u.r > 40 ? 'l' : 'm', a: u, b: target, l: .13 }); }
    return;
  }
  if (center) {
    if (target && target.king === undefined && dist(target, SHRINE) < 75) { move(u, target.x, target.y, dt); return; }
    const x = 180 + (u.x < 180 ? -13 : 13), y = 280 + (u.team ? -20 : 20);
    if (Math.hypot(u.x - x, u.y - y) > 10) move(u, x, y, dt);
    return;
  }
  if (flank && before) {
    if (target && target.king === undefined && bd < 40) { move(u, target.x, target.y, dt); return; }
    move(u, u.path === 'left' ? 96 : 264, u.team ? 328 : 232, dt);
    return;
  }
  if (flank) u.path = 'attack';
  if (!target) target = core(1 - u.team);
  if (target && target.hp > 0) { u.targetX = target.x; u.targetY = target.y; move(u, target.x, target.y, dt); }
}
function tow(t, dt) {
  t.cd -= dt;
  let target = null, bd = t.r;
  for (const o of G.u) if (o.team !== t.team && o.hp > 0) { const d = dist(t, o); if (d < bd) { bd = d; target = o; } }
  if (target && t.cd <= 0) { t.cd = t.as; target.hp -= t.d; G.fx.push({ k: 'l', a: t, b: target, l: .1 }); }
}
function sep() {
  for (let i = 0; i < G.u.length; i++) for (let j = i + 1; j < G.u.length; j++) {
    const a = G.u[i], b = G.u[j];
    if (a.hp <= 0 || b.hp <= 0) continue;
    let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    const m = a.rad + b.rad;
    if (d >= m) continue;
    if (d < .001) { dx = 1; dy = 0; d = 1; }
    const f = (m - d) / d * .25, ax = a.x, ay = a.y, bx = b.x, by = b.y;
    a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
    constrain(a, ax, ay); constrain(b, bx, by);
  }
}
function upgradeTip() {
  const id = [...S.deck].sort((a, b) => levelOf(a) - levelOf(b)).find(k => levelOf(k) < MAX_LEVEL && S.coin >= UPGRADE_COST[levelOf(k) + 1]);
  return id ? `Хватает осколков, чтобы улучшить руну «${CARDS[id].n}» в Кузнице.` : '';
}
function end() {
  if (G.done) return;
  const a = ratio(0), b = ratio(1), r = Math.abs(a - b) < 1e-9 ? 0 : a > b ? 1 : -1;
  G.done = 1; G.result = r;
  cancelGesture(); cancelDrag();
  S.battles++;
  if (r > 0) { S.wins++; S.tr += 30; }
  const reward = r > 0 ? 60 : 20;
  S.coin += reward; save(); ui();
  $('#rt').textContent = r > 0 ? 'ПОБЕДА!' : r < 0 ? 'ПОРАЖЕНИЕ' : 'НИЧЬЯ';
  $('#rp').textContent = `Ядра: ${Math.round(a * 100)}% : ${Math.round(b * 100)}% · +${reward} осколков`;
  $('#rhint').textContent = upgradeTip();
  $('#pausemenu').hidden = true;
  const game = G;
  setTimeout(() => { if (G === game && G.done) $('#res').hidden = false; }, RESULT_DELAY);
}
$('#rb').onclick = () => leaveBattle();
$('#again').onclick = () => { leaveBattle(); playButton.click(); };

/* ------------------------------------------------------------------ assets and HUD */
let assetsReady = false, assetsLoading = null;
function prepareAssets() {
  if (assetsReady) return Promise.resolve();
  if (!assetsLoading) assetsLoading = Promise.resolve().then(() => V.prepare ? V.prepare() : null).then(() => { assetsReady = true; }).catch(e => { assetsLoading = null; throw e; });
  return assetsLoading;
}
const playButton = $('#play'), loadStatus = $('#loadstatus');
function status(text) { loadStatus.textContent = text; }
playButton.onclick = async () => {
  if (!V.ok) { status('3D-движок не загрузился. Обнови страницу и проверь, что WebGL включён.'); return; }
  playButton.disabled = true;
  try { status(assetsReady ? '' : 'Загрузка 3D-моделей…'); await prepareAssets(); status(''); start(); }
  catch (e) {
    console.error('Asset loading:', e);
    if (G) { if (raf) cancelAnimationFrame(raf); raf = 0; if (V.stop) V.stop(); G = null; $('#game').hidden = true; $('#res').hidden = true; }
    status('Не удалось загрузить модели. Нажмите «В БОЙ» ещё раз.');
  } finally { playButton.disabled = false; }
};
if (V.ok && V.prepare) prepareAssets().then(() => status('')).catch(() => status('Модели не загружены. Нажмите «В БОЙ», чтобы повторить.'));

function banner(text, tone) {
  const b = $('#banner');
  if (!b) return;
  b.textContent = text; b.className = 'on ' + (tone || '');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.className = ''; }, 2600);
}
function showEvent(e) {
  if (e.type === 'final') banner('Буря кристаллов! Руны заряжаются вдвое быстрее', 'gold');
  else if (e.type === 'rage') banner(e.team === 0 ? 'Обелиск пал! Ядро усилено, руны ×2 на 15 секунд' : 'Обелиск врага пал! Его ядро усилено', e.team === 0 ? 'own' : 'enemy');
}
function upd() {
  if (!G) return;
  const h = G.hud, t = Math.ceil(G.t), a = Math.round(ratio(0) * 100), b = Math.round(ratio(1) * 100), s = G.shrine;
  const time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  if (h.time !== time) { $('#time').textContent = time; h.time = time; }
  const fin = G.t <= FINAL && !G.done;
  if (h.fin !== fin) { $('#time').classList.toggle('final', fin); h.fin = fin; }
  const hpKey = `${a}:${b}`;
  if (h.hp !== hpKey) { $('#hp0').textContent = a + '%'; $('#hp1').textContent = b + '%'; $('#fill0').style.width = a + '%'; $('#fill1').style.width = b + '%'; h.hp = hpKey; }
  const title = s.pulse > 0 && s.lastAward >= 0 ? (s.lastAward === 0 ? 'Твой хранитель пробудился!' : 'Враг призвал хранителя!') : s.contested ? 'Святилище: спор' : s.owner === 0 ? 'Святилище: твоё' : s.owner === 1 ? 'Святилище: врага' : s.candidate >= 0 ? 'Святилище: захват' : 'Святилище: нейтрально';
  const key = title + Math.ceil(s.next);
  if (h.shrine !== key) {
    $('#ev').textContent = `${title} · ${Math.ceil(s.next)}с`;
    $('#el').style.width = `${100 * (1 - s.next / 30)}%`;
    $('#bar').dataset.owner = String(s.owner);
    h.shrine = key;
  }
  const boost = G.rage[0] > 0 || fin;
  const key2 = G.hand.map(id => Math.ceil(G.cool[0][id] * 10)).join(',') + '|' + G.sel + '|' + boost;
  if (h.runes !== key2) {
    $('#hand').classList.toggle('boost', boost);
    [...$('#hand').children].forEach((el, i) => {
      const id = G.hand[i], v = G.cool[0][id], wait = Math.ceil(v), was = el.classList.contains('lock');
      el.classList.toggle('lock', wait > 0);
      el.classList.toggle('sel', G.sel === i);
      if (was && wait <= 0) { el.classList.remove('ready-pop'); void el.offsetWidth; el.classList.add('ready-pop'); }
      const label = el.querySelector('.ready-label');
      if (label) label.textContent = wait > 0 ? `${wait}с` : 'Готов';
      const track = el.querySelector('.cooldown-track i');
      if (track) track.style.width = `${100 * (1 - v / CD[id])}%`;
      if (el.style.setProperty) el.style.setProperty('--cd', clamp(v / CD[id], 0, 1).toFixed(3));
      el.setAttribute('aria-disabled', String(wait > 0));
    });
    h.runes = key2;
  }
  const events = G.ev || [];
  while (h.evi < events.length) showEvent(events[h.evi++]);
  const pauseBtn = $('#pause');
  if (pauseBtn && h.doneFlag !== !!G.done) { pauseBtn.disabled = !!G.done; h.doneFlag = !!G.done; }
}
ui();
