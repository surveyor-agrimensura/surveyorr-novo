'use strict';

const SURVEYOR_SW_VERSION = '1.0.0-rc.185.74';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// O Surveyor depende de internet. O Service Worker existe para a experiência
// instalável (PWA), sem transformar o sistema em aplicativo offline.
// Em localhost, uma reinicialização momentânea do servidor não deve gerar uma
// rejeição não tratada no FetchEvent nem poluir o console com erro de Promise.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (error) {
      const cached = await caches.match(request).catch(() => null);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return new Response('<!doctype html><meta charset="utf-8"><title>Surveyor</title><body style="font-family:Arial;padding:24px">Servidor local temporariamente indisponível. Recarregue após o servidor voltar.</body>', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});
