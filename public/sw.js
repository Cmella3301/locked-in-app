const CACHE_NAME = 'lockin-v3.4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/watch',
  '/watch.html',
  '/manifest.json'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isGetRequest = event.request.method === 'GET';
  const isAppShellRequest =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/manifest.json';

  if (!isGetRequest) return;

  // Always go to network for API calls
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline - API unavailable' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  if (isAppShellRequest) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/index.html');
          return Response.error();
        });
      })
    );
    return;
  }

  // Cache-first for everything else (UI shell)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback to index.html for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
