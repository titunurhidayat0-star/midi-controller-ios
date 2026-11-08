const CACHE_NAME = 'midi-royale-pro-v81';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './pro.css?v=9.9.5',
  './pa5x.css?v=9.9.5',
  './theme-pick.css?v=9.9.5',
  './kset.css?v=9.9.5',
  './v9.css?v=9.9.5',
  './v95.css?v=9.9.5',
  './perf.css?v=9.9.5',
  './cmain.css?v=9.9.5',
  './pa5x-skin.css?v=9.9.5',
  './look.css?v=9.9.5',
  './dlg.js?v=9.9.5',
  './pro.js?v=9.9.5',
  './kset.js?v=9.9.5',
  './v9.js?v=9.9.5',
  './voicelib.js?v=9.9.5',
  './pa5x.js?v=9.9.5',
  './theme-pick.js?v=9.9.5',
  './v95.js?v=9.9.5',
  './perf.js?v=9.9.5',
  './cmain.js?v=9.9.5',
  './look.js?v=9.9.5',
  './privacy.html',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  'https://cdn.tailwindcss.com/3.4.16',
  'https://unpkg.com/lucide@0.454.0/dist/umd/lucide.min.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js'
];

// 1. INSTALL SERVICE WORKER & PRE-CACHE ASET KUNCI
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        LOCAL_ASSETS.map(asset => cache.add(asset).catch(err => console.warn('Failed to cache:', asset, err)))
      );
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE & CLEANUP CACHE LAMA
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH INTERCEPTOR
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);
  const isLocalCode = reqUrl.origin === self.location.origin && /\.(css|js)$/.test(reqUrl.pathname);
  if (isLocalCode) {
    // CSS/JS lokal: jaringan dulu supaya perbaikan tampilan selalu terpakai, cache hanya untuk offline
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // offline: coba index.html, lalu root
          return caches.match('./index.html').then((r) => r || caches.match('./'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
