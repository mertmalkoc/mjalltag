// Offline-Modus und Push für die Alltag-App
const V = "mj-2026-11-15-4";
const CORE = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
e.waitUntil(
caches.keys()
.then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
.then(() => self.clients.claim())
);
});

self.addEventListener("fetch", (e) => {
const r = e.request;
if (r.method !== "GET") return;
const u = new URL(r.url);
const same = u.origin === location.origin;

// Seite selbst: immer zuerst frisch holen (so kommen Updates an), ohne Netz aus dem Speicher
if (same && (r.mode === "navigate" || u.pathname.endsWith("/index.html") || u.pathname.endsWith("/"))) {
e.respondWith(
fetch(r, { cache: "no-cache" })
.then((res) => {
const cp = res.clone();
caches.open(V).then((c) => c.put("index.html", cp)).catch(() => {});
return res;
})
.catch(() => caches.match("index.html").then((m) => m || caches.match("./")))
);
return;
}

// Dateien der App, Firebase-Skripte und Quran-Texte: aus dem Speicher, im Hintergrund erneuern
if (same || u.hostname === "www.gstatic.com" || u.hostname === "api.alquran.cloud") {
e.respondWith(
caches.open(V).then(async (c) => {
const hit = await c.match(r);
const net = fetch(r)
.then((res) => {
if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()).catch(() => {});
return res;
})
.catch(() => hit);
return hit || net;
})
);
}
});

// Push: immer eine Benachrichtigung anzeigen (iOS verlangt das)
self.addEventListener("push", (e) => {
let p = {};
try { p = e.data.json(); } catch (_) { try { p = { data: { body: e.data.text() } }; } catch (_) {} }
const d = p.data || {};
const n = p.notification || {};
const title = d.title || n.title || "Alltag";
const body = d.body || n.body || "";
e.waitUntil(
self.registration.showNotification(title, {
body,
icon: "icon-192.png",
badge: "icon-192.png",
data: { url: d.url || "./" },
})
);
});

self.addEventListener("notificationclick", (e) => {
e.notification.close();
const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
e.waitUntil(
clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
for (const c of cs) {
if (c.url.startsWith(self.registration.scope)) {
c.focus();
if ("navigate" in c) c.navigate(url);
return;
}
}
return clients.openWindow(url);
})
);
});
