// Crystal Dominion offline cache (lets the game start without a network once it has been opened).
// When releasing a new version, change VERSION here together with every ?v= number in index.html.
const VERSION = 'crystal-dominion-31';
const V = '?v=31';
const CORE = [
  './', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'cards-v27.svg',
  'style.css' + V, 'three.min.js' + V, 'three-fallback.js' + V, 'art.js' + V, 'environment.js' + V,
  'binary-models.js' + V, 'hd-models.js' + V, 'towers.js' + V, 'character-models.js' + V, 'characters.js' + V,
  'audio.js' + V, 'render3d.js' + V, 'game.js' + V, 'pwa.js' + V,
  'citadel-hd.glb' + V, 'guard-unit.glb' + V, 'archer-unit.glb' + V, 'colossus-unit.glb' + V, 'imp-unit.glb' + V,
  'mage-unit.glb' + V, 'hounds-unit.glb' + V, 'swarm-unit.glb' + V, 'brute-unit.glb' + V
];

self.addEventListener('install', event => {
  // A missing file is skipped instead of failing the whole install.
  event.waitUntil(caches.open(VERSION)
    .then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('crystal-dominion-') && key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // The page itself: network first, so a new version arrives immediately; cached copy when offline.
    event.respondWith(fetch(request)
      .then(response => { if (response.ok) { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put('./', copy)); } return response; })
      .catch(() => caches.match('./')));
    return;
  }
  // Scripts, models and images: answer from the cache at once and refresh it in the background,
  // so even a file uploaded without a new ?v= number is picked up on the next start.
  event.respondWith(caches.open(VERSION).then(cache => cache.match(request).then(hit => {
    const network = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; });
    if (hit) { event.waitUntil(network.catch(() => null)); return hit; }
    return network;
  })));
});
