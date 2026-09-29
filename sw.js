const CACHE = 'ssf2sb-v7';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/base.css', 'css/select.css', 'css/board.css', 'css/sheet.css', 'css/ui-art.css', 'fonts/super-street-fighter-ii-large.otf', 'data/plate-layout.json', 'data/emblems.json',
  'js/main.js', 'js/store.js', 'js/audio.js', 'js/board.js', 'js/fx.js', 'js/transitions.js', 'js/heat.js', 'img/title/title.webp', 'img/title/flames.webp', 'data/catalog.json',
  'img/icon-192.png', 'img/icon-512.png', 'img/select/bg.webp', 'sounds/ui-press-start.mp3', 'sounds/ui-character-select.mp3',
  'img/bg/ryu.webp', 'img/bg/ken.webp', 'img/select/ryu-idle.webp', 'img/select/ken-idle.webp', 'img/select/ryu-idle-still.webp', 'img/select/ken-idle-still.webp'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const cat = await (await fetch('data/catalog.json', { cache: 'no-store' })).json();
  const extra = new Set(cat.sounds.map(s => s.file));
  for (const f of cat.fighters) {
    extra.add(`img/ui/${f.id}-square.webp`);
    for (const t of cat.tabs) for (const v of ['b', 'c']) extra.add(`img/plates/${f.id}-${t.id}-${v}.webp`);
  }
  try { for (const f of Object.values(await (await fetch('data/emblems.json', { cache: 'no-store' })).json())) extra.add(f); } catch {}
  await cache.addAll([...extra]);
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// Code files: network first so updates arrive; sounds and images: cache first so it is instant and works offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (/\.(mp4|webm)$/.test(url.pathname)) return;      // videos: leave to the browser (iPhones need range requests, which a cache reply cannot answer)
  const code = /\.(html|css|js|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (code) {
      try { const res = await fetch(e.request); cache.put(e.request, res.clone()); return res; }
      catch {
        const hit = await cache.match(e.request, { ignoreSearch: true });
        return hit || (e.request.mode === 'navigate' ? await cache.match('index.html') : null) || Response.error();
      }
    }
    return (await cache.match(e.request)) || fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; });
  })());
});
