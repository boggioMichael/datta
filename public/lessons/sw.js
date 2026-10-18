/* service worker — מטמון לאפליקציה (עובדת גם בלי רשת) + התראות push */
const VERSION = "lessons-v9";
const SHELL = ["./", "./index.html", "./app.css", "./app.js", "./config.js", "./store.js", "./content.js", "./quiz.js", "./gen.js", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-192.png", "../fonts/assistant.woff2", "../fonts/frankruhllibre.woff2", "../fonts/plexmono-regular.woff2", "../fonts/plexmono-medium.woff2"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

// הדף, הסקריפטים, העיצוב, חבילות השאלות וה-manifest: קודם מהרשת, כך ששינוי באתר מופיע כבר בפתיחה הבאה.
// המטמון הוא רק גיבוי: בלי רשת, או כשהרשת לא עונה תוך 3 שניות (ואז הרשת ממשיכה ומעדכנת את העותק השמור).
const FRESH = /(?:\/|\.html|\.js|\.css|\.json|\.webmanifest)$/;
const SLOW_MS = 3000;
const keep = (req, res) => { if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); } return res; };
const fromCache = (req) => { const nav = req.mode === "navigate"; return caches.match(req, { ignoreSearch: nav }).then((hit) => hit || (nav ? caches.match("./index.html") : undefined)); };
function networkFirst(req) {
  const net = fetch(req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" })).then((res) => keep(req, res));
  const offline = net.catch(() => fromCache(req).then((hit) => hit || Response.error()));
  const slow = new Promise((r) => setTimeout(r, SLOW_MS)).then(() => fromCache(req)).then((hit) => hit || offline);
  return Promise.race([offline, slow]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Firebase/CDN: network only
  if (req.mode === "navigate" || FRESH.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  // fonts and icons: from the cache, refreshed in the background
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => keep(req, res)).catch(() => cached);
    return cached || net;
  }));
});

// Web Push (FCM שולח payload עם notification או data)
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { notification: { title: "המכללה הפתוחה למדעי המחשב", body: e.data?.text() } }; }
  const n = data.notification || {};
  const d = data.data || {};
  const title = n.title || d.title || "⚡ בוחן פתע!";
  const body = n.body || d.body || "5 שאלות, 2 דקות. יאללה?";
  const url = d.url || n.click_action || "#/surprise";
  e.waitUntil(self.registration.showNotification(title, { body, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", dir: "rtl", lang: "he", tag: d.tag || "prep8200", data: { url }, vibrate: [100, 50, 100] }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url || "#/surprise";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes("/lessons/")) { c.focus(); c.postMessage({ url: target }); return; } }
    return self.clients.openWindow(new URL(target.startsWith("#") ? "./" + target : target, self.registration.scope).href);
  }));
});
