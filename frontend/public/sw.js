const VERSION = "__BUILD_VERSION__";
const SHELL_CACHE = `mle-shell-${VERSION}`;
const DATA_CACHE = "mle-data-v1";
const INDEX = "/index.html";

const isData = (path) =>
  (path.startsWith("/api/content/") && !path.startsWith("/api/content/search")) ||
  path === "/api/labs" ||
  path.startsWith("/api/labs/");

// Precache the app shell listed by the build
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const response = await fetch("/precache-manifest.json", { cache: "no-cache" });
      const { files } = await response.json();
      await cache.addAll(files);
    })(),
  );
});

// Drop shells from older builds; lesson data is kept across updates
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("mle-shell-") && n !== SHELL_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && (response.headers.get("content-type") ?? "").includes("text/html")) {
      await cache.put(INDEX, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(INDEX)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(DATA_CACHE);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  // A reload request (Save for offline) always goes to the network first
  if (request.cache === "reload" || request.cache === "no-store") {
    return refresh.catch(async () => (await cache.match(request, { ignoreVary: true })) ?? Response.error());
  }
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) {
    event.waitUntil(refresh.catch(() => undefined));
    return hit;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") event.respondWith(networkFirstPage(request));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(cacheFirst(request));
  else if (isData(url.pathname)) event.respondWith(staleWhileRevalidate(event, request));
  else if (!url.pathname.startsWith("/api/")) event.respondWith(cacheFirst(request));
});
