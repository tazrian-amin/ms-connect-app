import { appVersion, buildId } from "@/lib/app-version";

// Rendered once at build time. public/sw.js loads this with importScripts(), and the
// browser re-installs a service worker whenever an imported script's bytes change,
// so each build rolls out a fresh offline cache.
//
// Served without signing in (see proxy.ts), so an installed app can always update, so it holds
// nothing private. The worker learns which pages to cache from /api/session instead.
export const dynamic = "force-static";

export function GET() {
  const precache = {
    version: `${appVersion}-${buildId}`,
    // Next.js sends this as the deployment ID; lets the worker tell this build's responses apart.
    buildId,
  };

  return new Response(`self.PRECACHE = ${JSON.stringify(precache)};\n`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
