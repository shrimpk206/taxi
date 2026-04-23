// 간단한 서비스워커: 정적 자산은 cache-first, 외부(CDN)는 stale-while-revalidate.

const CACHE = 'taxi-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './meter.js',
  './geo.js',
  './map.js',
  './receipt.js',
  './sound.js',
  './storage.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // cache-first
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
      })
    );
  } else {
    // stale-while-revalidate
    e.respondWith(
      caches.match(request).then((cached) => {
        const net = fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
