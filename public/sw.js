// Offline-first service worker. The app runs where there is usually no internet, so it caches
// every page plus the scripts, styles and fonts those pages load, and then serves them from the
// cache. Only Bluetooth is needed once installed.
//
// The site is behind a password (proxy.ts), so the worker also enforces access offline:
// - It sits in front of /api/session and remembers the last answer (signed in until when, and
//   whether view mode is on) in a cache that outlives builds. Offline, it answers from that.
// - Pages are served from the cache only while that session lasts; after it, the password
//   dialog is shown instead, and the cached app is deleted. Device pages also need view mode.
// - The app is cached only once signed in, and only the pages the server says are open to the
//   visitor; device pages are added when view mode turns on and removed when it turns off.
//
// /sw-precache.js (app/sw-precache.js/route.ts) holds a per-build version. A new build changes
// that file, which makes the browser install this worker again with a fresh cache. The new
// worker then waits: the page (components/providers/app-updater.tsx) tells it to take over when
// no Bluetooth device is connected, then reloads. The previous build's cache is deleted on
// activate, so it stays intact while the old page still runs.
importScripts("/sw-precache.js");

const { version, buildId } = self.PRECACHE;
// Files the sign-in pages need, cached whether or not the visitor is signed in.
const SHELL_CACHE = `ms-connect-shell-${version}`;
// The app itself, cached only for a signed-in visitor.
const APP_CACHE = `ms-connect-${version}`;
// The last known access. Kept across builds, so an update does not sign anyone out.
const ACCESS_CACHE = "ms-connect-access";
const ACCESS_KEY = "/__access";

const OFFLINE_URL = "/offline.html";
const LOCK_URL = "/locked";
const DEVICE_PREFIX = "/devices/";
const SHELL_URLS = [
  OFFLINE_URL,
  LOCK_URL,
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];
// With poor signal a request can hang for a long time before failing; past this, the worker
// answers from what it knows.
const SESSION_TIMEOUT_MS = 4_000;
const NAVIGATION_TIMEOUT_MS = 10_000;

const SIGNED_OUT = { authenticated: false, expiresAt: null, viewMode: false, pages: [] };

// Same-origin build assets referenced from HTML (attributes and inline RSC payload) or CSS.
const ASSET_URL_PATTERN = /\/(?:_next\/static\/|favicon\.ico)[^"'\s()\\]*/g;
// The inline RSC payload is streamed as `self.__next_f.push([1,"..."])` pieces that can split
// a URL in two, so the pieces are joined before scanning.
const RSC_PIECE_PATTERN = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_URLS);
      // Signed in: the app must be fully cached before this build takes over, or installing
      // fails and is retried later. Signed out: it is cached after signing in instead.
      await cacheAppPages();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = [SHELL_CACHE, APP_CACHE, ACCESS_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/session" || url.pathname.startsWith("/api/session/")) {
    event.respondWith(handleSessionApi(url, request));
    return;
  }
  if (request.method !== "GET") return;
  // The admin page is online only, with its own sign-in.
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return;

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

// --- Access ---------------------------------------------------------------------------------

async function readAccess() {
  const cache = await caches.open(ACCESS_CACHE);
  const stored = await cache.match(ACCESS_KEY);
  return stored ? stored.json() : SIGNED_OUT;
}

/** The last known access, signed out once its session has expired. */
async function currentAccess() {
  const access = await readAccess();
  if (access.authenticated && !(access.expiresAt > Date.now())) {
    await writeAccess(SIGNED_OUT);
    return SIGNED_OUT;
  }
  return access;
}

/** Saves `access`, and brings the cached app in line with it. */
async function writeAccess(access, { recache = true } = {}) {
  const previous = await readAccess();
  const cache = await caches.open(ACCESS_CACHE);
  await cache.put(ACCESS_KEY, Response.json(access));

  if (!access.authenticated) {
    // Nothing of the app is left on the device for the next person to find.
    await caches.delete(APP_CACHE);
  } else if (previous.viewMode && !access.viewMode) {
    await forgetDevicePages();
  }
  if (recache && access.authenticated && (!previous.authenticated || (access.viewMode && !previous.viewMode))) {
    scheduleCaching();
  }
}

/**
 * Learns the visitor's access from an /api/session response. Returns null when the response
 * says nothing about it (a wrong view code, too many attempts).
 */
async function recordAccess(response, options) {
  let access;
  if (response.status === 200) {
    try {
      const body = await response.clone().json();
      access = body.authenticated
        ? { authenticated: true, expiresAt: body.expiresAt, viewMode: Boolean(body.viewMode), pages: body.pages ?? ["/"] }
        : SIGNED_OUT;
    } catch {
      return null;
    }
  } else if (response.status === 401) {
    access = SIGNED_OUT;
  } else {
    return null;
  }
  await writeAccess(access, options);
  return access;
}

/** Looks in one cache without creating it (caches.open would bring a deleted cache back). */
async function matchIn(name, request, options) {
  return (await caches.has(name)) ? (await caches.open(name)).match(request, options) : undefined;
}

function isValid(access) {
  return access.authenticated && access.expiresAt > Date.now();
}

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function handleSessionApi(url, request) {
  try {
    const response = await fetchWithTimeout(request, request.method === "GET" ? SESSION_TIMEOUT_MS : NAVIGATION_TIMEOUT_MS);
    await recordAccess(response);
    return response;
  } catch {
    // Offline. The current access can still be answered from memory; anything else needs the server.
    if (request.method === "GET" && url.pathname === "/api/session") {
      const access = await currentAccess();
      return Response.json({ ...access, offline: true }, { status: isValid(access) ? 200 : 401 });
    }
    if (request.method === "DELETE" && url.pathname === "/api/session/view") {
      // Turning view mode off needs no check, so it applies offline too, on this device.
      const access = await currentAccess();
      const next = isValid(access) ? { ...access, viewMode: false, pages: ["/"] } : SIGNED_OUT;
      await writeAccess(next);
      return Response.json(next, { status: isValid(next) ? 200 : 401 });
    }
    return Response.json({ error: "You're offline. Connect to the internet and try again." }, { status: 503 });
  }
}

// --- Caching the app ------------------------------------------------------------------------

let caching = Promise.resolve();

/** Caches whatever pages are missing, one run at a time. */
function scheduleCaching() {
  caching = caching
    .then(() => cacheAppPages())
    .catch((error) => console.warn("Caching the app failed:", error));
  return caching;
}

async function cacheAppPages() {
  const response = await fetch("/api/session", { cache: "no-store" });
  const access = await recordAccess(response, { recache: false });
  if (!access?.authenticated) return;

  const cache = await caches.open(APP_CACHE);
  const assets = new Set();
  for (const page of access.pages) {
    if (await cache.match(page)) continue;
    // Not followed: a redirect means access changed meanwhile, and caching it would store the
    // page it redirects to under this page's URL.
    const pageResponse = await fetch(page, { cache: "reload", redirect: "manual" });
    if (pageResponse.type === "opaqueredirect" || pageResponse.status === 401) continue;
    if (!pageResponse.ok) throw new Error(`Precache failed for ${page}: ${pageResponse.status}`);
    const html = await pageResponse.clone().text();
    collectAssetUrls(html.replace(RSC_PIECE_PATTERN, ""), assets);
    collectAssetUrls(joinRscPayload(html), assets);
    await cache.put(page, pageResponse);
  }

  // Stylesheets can pull in more files (fonts), so scan them too.
  for (const url of [...assets].filter((asset) => new URL(asset, self.location.origin).pathname.endsWith(".css"))) {
    const cssResponse = await fetch(url);
    if (cssResponse.ok) collectAssetUrls(await cssResponse.text(), assets);
  }

  // One missing file should not leave the whole app without offline support.
  await Promise.all(
    [...assets].map(async (url) => {
      if (await cache.match(url, { ignoreSearch: true })) return;
      await cache.add(url).catch((error) => console.warn(`Precache skipped ${url}:`, error));
    })
  );
}

async function forgetDevicePages() {
  if (!(await caches.has(APP_CACHE))) return;
  const cache = await caches.open(APP_CACHE);
  const keys = await cache.keys();
  await Promise.all(
    keys.filter((key) => new URL(key.url).pathname.startsWith(DEVICE_PREFIX)).map((key) => cache.delete(key))
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

// --- Serving --------------------------------------------------------------------------------

// Pages are served from the cache first so they open instantly with or without signal.
// Updates still arrive: each new build installs a new worker with fresh copies.
async function handleNavigation(url, request) {
  const access = await currentAccess();

  if (!isValid(access)) {
    // Not signed in as far as this device knows. Online, the server decides: it shows the
    // password dialog, or the page if the visitor has a valid cookie after all.
    try {
      return await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    } catch {
      return (await caches.match(LOCK_URL)) ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
    }
  }

  if (url.pathname.startsWith(DEVICE_PREFIX) && !access.viewMode) {
    return Response.redirect(new URL("/", self.location.origin).href, 302);
  }

  const cached = await matchIn(APP_CACHE, url.pathname);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function handleAsset(url, request) {
  // Next.js appends a `?dpl=` deployment query to asset URLs. The cache is already per build,
  // and build assets have content-hashed paths, so the query can be ignored for matching.
  const onlyDeploymentQuery = [...url.searchParams.keys()].every((key) => key === "dpl");
  const ignoreSearch = onlyDeploymentQuery || url.pathname.startsWith("/_next/static/");
  for (const name of [APP_CACHE, SHELL_CACHE]) {
    const cached = await matchIn(name, request, { ignoreSearch });
    if (cached) return cached;
  }

  const response = await fetch(request);
  // Build assets have hashed, immutable URLs, so anything fetched late (a lazily loaded
  // chunk) is safe to keep for next time. Only served at all to a signed-in visitor.
  if (response.ok && url.pathname.startsWith("/_next/static/") && isValid(await currentAccess())) {
    const cache = await caches.open(APP_CACHE);
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

// The app prefetches every route it may open while online (components/providers/offline-navigation.tsx),
// which fills this cache. Only responses from this worker's own build are stored, so cached
// route data always matches the cached pages and scripts.
async function handlePrefetch(url, request) {
  const access = await currentAccess();
  const allowed = isValid(access) && (access.viewMode || !url.pathname.startsWith(DEVICE_PREFIX));
  if (!allowed) return fetch(request);

  const key = prefetchCacheKey(url, request);
  const cached = await matchIn(APP_CACHE, key, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  // A redirect means the page was not open to the visitor; its data is not this page's.
  if (response.ok && !response.redirected && response.headers.get("x-nextjs-deployment-id") === buildId) {
    (await caches.open(APP_CACHE)).put(key, response.clone());
  }
  return response;
}
