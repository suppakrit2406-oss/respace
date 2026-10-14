// ReSpace service worker: เก็บไฟล์หน้าเว็บไว้ให้เปิดได้เร็ว ข้อมูลจาก Supabase ไม่ถูกเก็บ (ดึงสดทุกครั้ง)
const CACHE = 'respace-v13';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'assets/styles.css', 'assets/app.js', 'assets/config.js',
  'assets/supabase.js', 'assets/qrcode.js', 'assets/jsqr.js', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache:'reload'}))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so updates show up; fall back to cache when offline
  e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, {ignoreSearch:true})));
});
