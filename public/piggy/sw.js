/* קופת הלא — offline support. The page, scripts and styles come from the network first,
 * so a change to the site shows up on the next visit; the cache is only the fallback for
 * no signal (or a network that hasn't answered within a few seconds). */

const VERSION = 'piggy-v1';
const SHELL = [
  './',
  './index.html',
  './piggy.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/config.js',
  './js/strings.js',
  './js/i18n.js',
  './js/store.js',
  './js/art.js',
  './js/fx.js',
  './js/sound.js',
  './js/register.js',
  './js/stage.js',
  './js/haptics.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  '../fonts/frankruhllibre.woff2',
  '../fonts/assistant.woff2',
  '../fonts/newsreader.woff2',
];
const FRESH = /(?:\/|\.html|\.js|\.css|\.webmanifest)$/;
const SLOW_MS = 3000;
const NAVIGATE = 'navigate';
const GET = 'GET';
const BASIC = 'basic';
const NO_CACHE = 'no-cache';
const INDEX = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const keep = (request, response) => {
  if (response.ok && response.type === BASIC) {
    const copy = response.clone();
    caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
};

const fromCache = (request) => {
  const navigation = request.mode === NAVIGATE;
  return caches.match(request, { ignoreSearch: navigation }).then((hit) => hit || (navigation ? caches.match(INDEX) : undefined));
};

function networkFirst(request) {
  const network = fetch(request.mode === NAVIGATE ? request : new Request(request, { cache: NO_CACHE })).then((response) => keep(request, response));
  const offline = network.catch(() => fromCache(request).then((hit) => hit || Response.error()));
  const slow = new Promise((resolve) => setTimeout(resolve, SLOW_MS)).then(() => fromCache(request)).then((hit) => hit || offline);
  return Promise.race([offline, slow]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== GET) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === NAVIGATE || FRESH.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Fonts and icons: from the cache, refreshed in the background.
  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => keep(request, response)).catch(() => cached);
    return cached || network;
  }));
});
