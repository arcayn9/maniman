importScripts("./lib/session-broker.js");
const CACHE_NAME = "maniman-shell-v12";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/maniman-icon.svg",
  "./lib/statement-contract.js",
  "./lib/secure-storage.js",
  "./lib/vault-access.js",
  "./lib/user-guide.js",
  "./lib/account-access.js",
  "./lib/vault-session.js",
  "./lib/session-broker.js",
  "./vendor/supabase-2.119.0.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => (key.startsWith("maniman-") || key.startsWith("pocket-pilot-")) && key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.search || url.pathname.startsWith("/api/") || url.pathname.endsWith("/config.js")) return;
  const allowed = new Set(APP_SHELL.map((item) => new URL(item, self.registration.scope).href));
  if (!allowed.has(url.href)) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())));
    return response;
  }).catch(() => caches.match(event.request)));
});

// The unlock broker holds CryptoKeys in worker RAM only. A per-tab nonce is the
// capability; requests from unrelated origins or non-window clients are ignored.
const sessionBroker = self.ManimanSessionBroker.createBroker();
self.addEventListener("message", (event) => {
  if (event.data?.type !== "maniman-vault-session" || !event.ports?.[0]) return;
  const port = event.ports[0];
  try {
    const client = event.source;
    const url = new URL(client?.url || "");
    if (client?.type !== "window" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return port.postMessage({ ok: false });
    port.postMessage(sessionBroker.handle(event.data));
  } catch (_) { port.postMessage({ ok: false }); }
});
