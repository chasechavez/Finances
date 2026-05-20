const CACHE = 'wci-v2';
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
];
const APP_SHELL = ['./index.html', './manifest.json', './icon.svg', './icon.png'];
const NEVER_CACHE = ['api.anthropic.com', 'claude.ai'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled([
        ...CDN_ASSETS.map(url => cache.add(url).catch(() => {})),
        ...APP_SHELL.map(url => cache.add(url).catch(() => {})),
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Anthropic API or non-GET
  if (NEVER_CACHE.some(h => url.hostname.includes(h)) || e.request.method !== 'GET') return;

  // CDN assets: cache-first, fallback to network
  if (CDN_ASSETS.includes(e.request.url) || url.hostname.includes('fonts.')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // App shell (index.html, manifest, icon): network-first, fallback to cache
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
