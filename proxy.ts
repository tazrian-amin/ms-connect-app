import { NextResponse, type NextRequest } from "next/server";
import { adminLoginPage, LOCK_PAGE_PATH, lockPage } from "@/lib/access/gate-pages";
import {
  ADMIN_COOKIE,
  readAdmin,
  readSession,
  readViewMode,
  SESSION_COOKIE,
  VIEW_COOKIE,
} from "@/lib/access/session";
import { getAccessSettings } from "@/lib/access/settings-store";

/*
 * Gates the whole site behind the shared password, before anything is served.
 *
 * - Without a site session, page loads get the password dialog (lockPage) at the URL they opened,
 *   and everything else (route data, scripts, styles) is refused. So none of the app's code
 *   reaches a visitor who has not signed in.
 * - Device pages also need view mode, or they redirect to the home page.
 * - /admin has its own sign-in (the admin credentials) and skips the site password, so the
 *   password can be set before anyone knows it.
 *
 * Route handlers check access again themselves; this is the outer wall, not the only one.
 */

// Served to everyone: what the sign-in pages and the service worker need before signing in.
const PUBLIC_PATHS = new Set([
  "/sw.js",
  "/sw-precache.js",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/offline.html",
  // Route handlers that check credentials themselves.
  "/api/session",
  "/api/admin/session",
]);

const NO_STORE = { "Cache-Control": "no-store" };

function html(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE } });
}

function isPageLoad(request: NextRequest): boolean {
  if (request.method !== "GET" || request.headers.has("RSC")) return false;
  // A page load the service worker passes on arrives with Sec-Fetch-Dest "empty", but keeps
  // the browser's Accept header.
  return (
    request.headers.get("Sec-Fetch-Dest") === "document" ||
    (request.headers.get("Accept") ?? "").includes("text/html")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/icons/")) return NextResponse.next();
  // The service worker keeps a copy of the dialog to show offline once a session has expired.
  if (pathname === LOCK_PAGE_PATH) return html(lockPage(), 200);

  let settings;
  try {
    settings = await getAccessSettings();
  } catch (error) {
    console.error("Reading access settings failed:", error);
    return new Response("Service unavailable", { status: 503, headers: NO_STORE });
  }

  const isAdmin = readAdmin(settings, request.cookies.get(ADMIN_COOKIE)?.value);
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (isAdmin) return NextResponse.next();
    return isPageLoad(request) ? html(adminLoginPage(), 401) : new Response("Unauthorized", { status: 401, headers: NO_STORE });
  }

  const session = readSession(settings, request.cookies.get(SESSION_COOKIE)?.value);
  // The admin page needs the app's scripts and styles too.
  if (!session && !(isAdmin && pathname.startsWith("/_next/"))) {
    return isPageLoad(request) ? html(lockPage(), 401) : new Response("Unauthorized", { status: 401, headers: NO_STORE });
  }

  if (pathname.startsWith("/devices/") && !readViewMode(settings, session, request.cookies.get(VIEW_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}
