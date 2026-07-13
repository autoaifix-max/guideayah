const CACHE = 'aya-guide-v4.0.0';
const CORE = [
  '/', '/index.html', '/styles.css', '/manifest.webmanifest',
  '/js/app.js','/js/data.js','/js/storage.js','/js/pregnancy.js','/js/ui.js','/js/ai.js','/js/sync.js',
  '/icons/icon-192.png','/icons/icon-512.png',
  '/assets/pregnant-hero.png','/assets/icons/pregnancy-logo.svg','/assets/icons/tree.svg','/assets/icons/diary.svg','/assets/icons/water.svg','/assets/icons/breakfast.svg','/assets/icons/snack.svg','/assets/icons/lunch.svg','/assets/icons/dinner.svg','/assets/icons/mood.svg','/assets/icons/assistant.svg','/assets/icons/secret.svg','/assets/icons/appointment.svg','/assets/icons/safety.svg','/assets/icons/tasks.svg','/assets/icons/memory.svg','/assets/icons/ultrasound.svg','/assets/icons/home.svg','/assets/icons/food.svg','/assets/icons/care.svg','/assets/icons/more.svg'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => { const copy=res.clone(); caches.open(CACHE).then(c=>c.put('/index.html',copy)); return res; }).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => { if (res.ok && new URL(req.url).origin === location.origin) { const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); } return res; })));
});
