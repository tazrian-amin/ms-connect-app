// Offline-first service worker. The app runs where there is usually no internet, so on
// install it caches every page plus the scripts, styles and fonts those pages load, and
// then serves them from the cache. Only Bluetooth is needed once installed.
//
// /sw-precache.js (app/sw-precache.js/route.ts) lists the pages and a per-build version.
// A new build changes that file, which makes the browser install this worker again with
// a fresh cache. The new worker then waits: the page (components/providers/app-updater.tsx)
// tells it to take over when no Bluetooth device is connected, then reloads. The previous
// build's cache is deleted on activate, so it stays intact while the old page still runs.
importScripts("/sw-precache.js");

const { version, buildId, pages } = self.PRECACHE;
const CACHE_NAME = `ms-connect-${version}`;
const OFFLINE_URL = "/offline.html";
const STATIC_URLS = [
  OFFLINE_URL,
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Same-origin build assets referenced from HTML (attributes and inline RSC payload) or CSS.
const ASSET_URL_PATTERN = /\/(?:_next\/static\/|favicon\.ico)[^"'\s()\\]*/g;
// The inline RSC payload is streamed as `self.__next_f.push([1,"..."])` pieces that can split
// a URL in two, so the pieces are joined before scanning.
const RSC_PIECE_PATTERN = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) {
    // Prefetched route data is what lets the Next.js router switch pages without a full
    // reload. Serving it offline keeps the page, and its Bluetooth connections, alive.
    if (request.headers.get("Next-Router-Prefetch") === "1") {
      event.respondWith(handlePrefetch(url, request));
    }
    // Other route data goes to the network. When that fails offline, the router falls
    // back to a full page load, which is served from the cache below.
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(url, request));
  } else {
    event.respondWith(handleAsset(url, request));
  }
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_URLS);

  const assets = new Set();
  for (const page of pages) {
    const response = await fetch(page, { cache: "reload" });
    if (!response.ok) throw new Error(`Precache failed for ${page}: ${response.status}`);
    const html = await response.clone().text();
    collectAssetUrls(html.replace(RSC_PIECE_PATTERN, ""), assets);
    collectAssetUrls(joinRscPayload(html), assets);
    await cache.put(page, response);
  }

  // Stylesheets can pull in more files (fonts), so scan them too.
  for (const url of [...assets].filter((asset) => new URL(asset, self.location.origin).pathname.endsWith(".css"))) {
    const response = await fetch(url);
    if (response.ok) collectAssetUrls(await response.text(), assets);
  }

  // One missing file should not leave the whole app without offline support.
  await Promise.all(
    [...assets].map((url) =>
      cache.add(url).catch((error) => console.warn(`Precache skipped ${url}:`, error))
    )
  );
}

function joinRscPayload(html) {
  let payload = "";
  for (const match of html.matchAll(RSC_PIECE_PATTERN)) {
    try {
      payload += JSON.parse(match[1]);
    } catch {
      // Not a plain string piece; nothing to scan.
    }
  }
  return payload;
}

function collectAssetUrls(text, into) {
  for (const match of text.matchAll(ASSET_URL_PATTERN)) into.add(match[0]);
}

// Pages are served from the cache first so they open instantly with or without signal.
// Updates still arrive: each new build installs a new worker with fresh copies.
async function handleNavigation(url, request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url.pathname);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function handleAsset(url, request) {
  const cache = await caches.open(CACHE_NAME);
  // Next.js appends a `?dpl=` deployment query to asset URLs. The cache is already per build,
  // and build assets have content-hashed paths, so the query can be ignored for matching.
  const onlyDeploymentQuery = [...url.searchParams.keys()].every((key) => key === "dpl");
  const ignoreSearch = onlyDeploymentQuery || url.pathname.startsWith("/_next/static/");
  const cached = await cache.match(request, { ignoreSearch });
  if (cached) return cached;

  const response = await fetch(request);
  // Build assets have hashed, immutable URLs, so anything fetched late (a lazily loaded
  // chunk) is safe to keep for next time.
  if (response.ok && url.pathname.startsWith("/_next/static/")) {
    cache.put(request, response.clone());
  }
  return response;
}

// Prefetch responses for a static page are the same whichever page asked, so key them by
// path and segment only, not by the per-request `_rsc` hash.
function prefetchCacheKey(url, request) {
  const segment = request.headers.get("Next-Router-Segment-Prefetch") ?? "";
  return `${url.pathname}?prefetch-segment=${encodeURIComponent(segment)}`;
}

// The app prefetches every route while online (components/providers/offline-navigation.tsx),
// which fills this cache. Only responses from this worker's own build are stored, so cached
// route data always matches the cached pages and scripts.
async function handlePrefetch(url, request) {
  const cache = await caches.open(CACHE_NAME);
  const key = prefetchCacheKey(url, request);
  const cached = await cache.match(key, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.headers.get("x-nextjs-deployment-id") === buildId) {
    cache.put(key, response.clone());
  }
  return response;
}
