const CACHE_NAME = 'padron-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/css/style.css',
  '/js/api.js',
  '/js/db.js',
  '/js/app.js',
  '/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  'https://unpkg.com/html5-qrcode',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') {
    e.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', { status: 503 })));
    return;
  }
  // Network first for API, cache first for static
  if (request.url.includes('/api/')) {
    e.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() => caches.match(request))
    );
  } else {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-electores') {
    e.waitUntil(syncElectores());
  }
});

async function syncElectores() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'SYNC_ELECTORES' }));
}
