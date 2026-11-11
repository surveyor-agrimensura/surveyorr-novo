/* SURVEYOR PWA — cache restrito a arquivos públicos imutáveis. */
const VERSION = 'surveyor-static-v56';
const OFFLINE_FILES = ['/offline.html', '/pwa/surveyor-192.png', '/pwa/surveyor-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('surveyor-static-') && key !== VERSION).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.credentials === 'include') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match('/offline.html')) || Response.error()));
    return;
  }
  if (!url.pathname.startsWith('/assets/')) return;
  event.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req);
    if (cached) return cached;
    const response = await fetch(req);
    if (response.ok && response.type === 'basic') await cache.put(req, response.clone());
    return response;
  }));
});
