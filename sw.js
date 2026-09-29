/* Service worker: ưu tiên mạng, có bản lưu để dùng khi ngoại tuyến. Đổi VERSION khi thay danh sách file. */
const VERSION = 'so-tra-no-v1.1.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/util.js', 'js/loan.js', 'js/model.js', 'js/state.js',
  'js/views/home.js', 'js/views/debts.js', 'js/views/calc.js', 'js/views/recv.js', 'js/views/plan.js', 'js/views/fund.js', 'js/views/backup.js',
  'js/events.js', 'js/supabase-sync.js', 'js/auth.js', 'js/views/login.js', 'js/app.js', 'js/pwa.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
