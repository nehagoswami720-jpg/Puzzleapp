/*
 * Minimal app-shell service worker (§18).
 *
 * Scope is deliberately narrow: cache the static shell so a launch from the home
 * screen opens instantly and survives a flaky connection. It must NOT cache
 * puzzle generation — that needs the network (the LLM calls and the serverless
 * routes) and a stale puzzle set would be worse than a spinner. So API calls and
 * non-GET requests always go straight to the network.
 *
 * Bump CACHE on any shell change so old clients drop the previous cache.
 */
const CACHE = 'skill-puzzles-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch generation or any non-GET / cross-origin request.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for navigations so a deploy is picked up immediately; fall
  // back to the cached shell only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/').then((r) => r ?? Response.error())));
    return;
  }

  // Cache-first for static assets — they're content-hashed or versioned.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
