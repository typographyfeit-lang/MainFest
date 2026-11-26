// Living Battlefield 3.3: additive arena and audio update, existing gameplay and lobby unchanged.
const VERSION='crystal-dominion-331-audio-fix', V='?v=31', L='?v=32', B='?v=33', F='?v=331';
const CORE=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','cards-v27.svg',
 'style.css'+V,'three.min.js'+V,'three-fallback.js'+V,'art.js'+V,'environment.js'+V,'binary-models.js'+V,'hd-models.js'+V,'towers.js'+V,'character-models.js'+V,'characters.js'+V,'battle-safe-sfx-331.js'+F,'audio-331.js'+F,'battle-safe-theme-331.mp3','battlefield-33.js'+B,'battlefield-33.css'+B,'render3d.js'+V,'game.js'+V,'pwa.js'+V,
 'citadel-hd.glb'+V,'guardian-hd.glb'+V,'guard-unit.glb'+V,'archer-unit.glb'+V,'colossus-unit.glb'+V,'imp-unit.glb'+V,'mage-unit.glb'+V,'hounds-unit.glb'+V,'swarm-unit.glb'+V,'brute-unit.glb'+V,
 'lobby-32.css'+L,'lobby-32.js'+L,'sanctuary-bg.webp','sanctuary-forge.webp','sanctuary-hall.webp','sanctuary-profile.webp','sanctuary-guardian.webp','sanctuary-crystal.svg','sanctuary-ambient.mp3','battle-sfx-33.json','battle-sfx-33.wav','battle-theme-33.mp3','battle-tension-33.mp3','battle-ambience-33.mp3'];
const scope=self.registration.scope;
const urls=new Set(CORE.map(path=>new URL(path,scope).href));
// Install atomically: do not remove a usable old cache until the complete new release is available.
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(VERSION);
 try{await cache.addAll(CORE.map(path=>new Request(new URL(path,scope),{cache:'reload'})));await self.skipWaiting();}
 catch(e){await caches.delete(VERSION);throw e;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('crystal-dominion-')&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||!req.url.startsWith(scope)||url.origin!==self.location.origin)return;
 // Navigation is network-first; don't cache a potentially mismatched future release.
 if(req.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(req);if(response.ok)return response;throw Error('HTTP '+response.status)}catch(e){const cache=await caches.open(VERSION);return await cache.match(new URL('./',scope).href)||Response.error()}})());return;
 }
 if(!urls.has(req.url))return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);let hit=await cache.match(req.url);
  if(!hit){const r=await fetch(req.url);if(r.ok&&r.status===200){await cache.put(req.url,r.clone());}hit=r;}
  // Safari may request partial MP3 bytes even when cached; preserve offline music support.
  const range=req.headers.get('range');if(range&&url.pathname.endsWith('.mp3')&&hit.status===200){
   const b=await hit.arrayBuffer(),m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${b.byteLength}`}});
   const from=m[1]?Number(m[1]):Math.max(0,b.byteLength-Number(m[2]));const to=m[1]&&m[2]?Math.min(b.byteLength-1,Number(m[2])):b.byteLength-1;
   if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||from>to||from>=b.byteLength)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${b.byteLength}`}});
   return new Response(b.slice(from,to+1),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':String(to-from+1),'Content-Range':`bytes ${from}-${to}/${b.byteLength}`,'Accept-Ranges':'bytes'}});
  }return hit;
 })());
});
