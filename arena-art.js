'use strict';

// Sprite cells are aligned at the feet, so large and small pieces share a ground plane.
const ArenaArt = (() => {
  const cell = 192;
  const troopIds = ['guard', 'archer', 'colossus', 'imp', 'mage', 'hounds', 'swarm', 'brute'];
  const portraits = [...troopIds, 'meteor', 'spark'];
  const teamColors = ['#338df3', '#ed534d'];
  const images = {};
  const ground = document.createElement('canvas');
  const paintScale = 2.5;
  ground.width = 360 * paintScale;
  ground.height = 560 * paintScale;

  const ready = Promise.all(['arena', 'towers', 'units'].map(name => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = () => reject(new Error('Не удалось загрузить ' + img.src));
    images[name] = img;
    img.src = 'assets/' + name + '.webp';
  })));

  function ellipse(c, x, y, rx, ry, fill) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }
  function line(c, points, color, width) {
    c.beginPath();
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  function bridge(c, x, river, half) {
    const y = river - half - 5;
    const h = half * 2 + 10;
    c.fillStyle = '#38432f77';
    c.fillRect(x - 21, y + 3, 49, h + 2);
    c.fillStyle = '#61432e';
    c.fillRect(x - 24, y, 48, h);
    for (let i = 0; i < 7; i++) {
      const left = x - 23 + i * 6.6;
      const top = y + Math.sin(i * 9) * 0.9;
      const wood = c.createLinearGradient(left, 0, left + 6.1, 0);
      wood.addColorStop(0, '#f5d18b');
      wood.addColorStop(0.24, '#dca162');
      wood.addColorStop(1, i % 2 ? '#b47a43' : '#c38c50');
      c.fillStyle = wood;
      c.fillRect(left, top, 6.1, h - 1);
      line(c, [[left + 2, top + 7], [left + 2.6, top + 16], [left + 2, top + 21]], '#98663c99', 0.6);
    }
    for (const dx of [-22, 22]) {
      line(c, [[x + dx, y], [x + dx + 1, y + h]], '#6a4a30', 2);
      for (const dy of [1, h - 3]) {
        ellipse(c, x + dx, y + dy + 1.3, 2.9, 2.4, '#755032');
        ellipse(c, x + dx - 0.4, y + dy, 2.7, 1.7, '#e4bf81');
      }
    }
  }
  function prepareGround(w, h, river, half, crossings, towers) {
    const c = ground.getContext('2d');
    c.setTransform(paintScale, 0, 0, paintScale, 0, 0);
    c.drawImage(images.arena, 0, 0, w, h);
    c.lineJoin = 'round';
    for (const side of [0, 1]) {
      const keep = towers.find(t => t.king && t.team === side);
      const flank = towers.filter(t => !t.king && t.team === side);
      const bank = river + (side ? -half : half);
      const route = [[crossings[0], bank], [flank[0].x, flank[0].y],
        [flank[0].x, keep.y], [keep.x, keep.y], [flank[1].x, keep.y],
        [flank[1].x, flank[1].y], [crossings[1], bank]];
      line(c, route, '#8a833e99', 13.5);
      line(c, route, '#dfc378', 11.5);
      // Paving joints and scattered gravel break up the two long lanes.
      for (const x of crossings) {
        const start = Math.min(bank, keep.y);
        const end = Math.max(bank, keep.y);
        for (let y = start + 6; y < end; y += 10.5) {
          const offset = Math.sin(y * 1.6 + x);
          line(c, [[x - 5.5, y], [x, y + offset], [x + 5.5, y + 0.6]], '#ac8e525e', 0.7);
          ellipse(c, x + 3.6 * offset, y + 3, 0.85, 0.47, '#f7e3a8');
        }
      }
    }
    for (const x of crossings) bridge(c, x, river, half);
  }
  function surface(canvas, w, h) {
    // CSS controls the display size. The simulation always uses its original coordinates.
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const c = canvas.getContext('2d');
    c.setTransform(width / w, 0, 0, height / h, 0, 0);
    return c;
  }
  function sprite(c, sheet, col, row, x, base, size) {
    c.drawImage(sheet, col * cell, row * cell, cell, cell, x - size / 2, base - size, size, size);
  }
  function health(c, x, y, width, ratio, team, number) {
    const h = number === undefined ? 3.2 : 8;
    const left = x - width / 2;
    c.fillStyle = '#213435';
    c.beginPath();
    c.roundRect(left - 1, y - 1, width + 2, h + 2, 2);
    c.fill();
    c.fillStyle = '#553e38';
    c.fillRect(left, y, width, h);
    const filled = width * Math.min(1, Math.max(0, ratio));
    c.fillStyle = teamColors[team];
    c.fillRect(left, y, filled, h);
    c.fillStyle = '#ffffff68';
    c.fillRect(left, y, filled, 1);
    if (number !== undefined) {
      c.font = 'bold 7.4px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 1.5;
      c.strokeStyle = '#203440bb';
      c.strokeText(number, x, y + h / 2);
      c.fillStyle = '#fff';
      c.fillText(number, x, y + h / 2);
    }
  }
  function tower(c, t, labels = true) {
    const size = t.king ? 62 : 51;
    const base = t.y + (t.king ? 20 : 15);
    ellipse(c, t.x + 3, base - 3, size * 0.42, size * 0.12, '#34301f44');
    if (t.hp <= 0) {
      for (let i = 0; i < 8; i++) {
        const x = t.x + Math.cos(i * 2.42) * (3 + i * 1.9);
        const y = t.y + Math.sin(i * 2.42) * (2 + i * 0.9);
        c.fillStyle = ['#887960', '#6b6a62', '#a6987a'][i % 3];
        c.fillRect(x - 3, y, 7, 4.5);
        c.fillStyle = '#c3b190';
        c.fillRect(x - 3, y - 1, 7, 2);
      }
      return;
    }
    sprite(c, images.towers, t.team, t.king ? 0 : 1, t.x, base, size);
    if (labels) health(c, t.x, base + 1.5, t.king ? 35 : 30, t.hp / t.max, t.team, Math.ceil(t.hp));
  }
  function troop(c, u, time) {
    const index = troopIds.indexOf(u.id);
    const size = u.big ? 34 : u.id === 'swarm' ? 18 : 25;
    const base = u.y + size * 0.3;
    ellipse(c, u.x + 1, base - 1, size * 0.39, size * 0.13, '#29352566');
    ellipse(c, u.x, base - 1, size * 0.38, size * 0.125, teamColors[u.team]);
    const bob = u.moving ? Math.abs(Math.sin(time * 10 + u.phase)) * 1.6 : 0;
    if (index >= 0) sprite(c, images.units, index % 4, Math.floor(index / 4), u.x, base - bob, size);
    else {
      c.font = '16px system-ui';
      c.textAlign = 'center';
      c.fillText(u.ic, u.x, base);
    }
    if (u.hp < u.max) health(c, u.x, base - size - 4, 17, u.hp / u.max, u.team);
  }
  function water(c, time, w, river, half, crossings) {
    for (let i = 0; i < 18; i++) {
      const x = (i * 37 + time * (2 + i % 3)) % (w + 16) - 8;
      if (crossings.some(b => Math.abs(x - b) < 31)) continue;
      const y = river + Math.sin(8 * i) * (half - 4);
      line(c, [[x, y], [x + 2.5, y + 0.6], [x + 6, y]], '#ebffed80', 0.8);
    }
  }
  function effect(c, fx) {
    c.save();
    if (fx.k === 'c') {
      const p = 1 - fx.l / 0.3;
      const r = fx.r * (0.24 + 0.76 * p);
      const spark = fx.card === 'spark';
      const wash = c.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, r);
      wash.addColorStop(0, spark ? '#f9ffff' : '#fff8aa');
      wash.addColorStop(0.52, spark ? '#93dbff99' : '#ff9d3799');
      wash.addColorStop(1, spark ? '#6b96fe22' : '#ff663322');
      c.globalAlpha = 1 - p;
      ellipse(c, fx.x, fx.y, r, r, wash);
      c.strokeStyle = spark ? '#c8fdff' : '#ffe98c';
      c.lineWidth = 2;
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const dx = Math.cos(i * 2.4), dy = Math.sin(i * 2.4);
        line(c, [[fx.x + dx * r * 0.36, fx.y + dy * r * 0.36],
          [fx.x + dx * r * 0.64 - dy * 2, fx.y + dy * r * 0.64 + dx * 2],
          [fx.x + dx * r, fx.y + dy * r]], spark ? '#fff8a0' : '#ffcf75', 1.4);
      }
    } else {
      const p = 1 - fx.l / 0.1;
      const startY = fx.a.y - (fx.a.king === undefined ? 8 : 14);
      const dx = fx.b.x - fx.a.x, dy = fx.b.y - 5 - startY;
      const tip = [fx.a.x + dx * p, startY + dy * p];
      const tail = Math.max(0, p - 0.33);
      line(c, [[fx.a.x + dx * tail, startY + dy * tail], tip], '#704824', 2.4);
      line(c, [[fx.a.x + dx * tail, startY + dy * tail], tip], '#ffe6a0', 1.25);
      ellipse(c, ...tip, 2, 2, '#fff3bf');
    }
    c.restore();
  }
  function portraitStyle(id) {
    const i = portraits.indexOf(id);
    return i < 0 ? '' : '--px:' + (i % 5) * 25 + '%;--py:' + Math.floor(i / 5) * 100 + '%';
  }
  return {ready, ground, prepareGround, surface, tower, troop, water, effect, portraitStyle};
})();
