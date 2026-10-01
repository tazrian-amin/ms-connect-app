import { appVersion, buildId } from "@/lib/app-version";
import { appRoutes } from "@/lib/app-routes";

// Rendered once at build time. public/sw.js loads this with importScripts(), and the
// browser re-installs a service worker whenever an imported script's bytes change,
// so each build rolls out a fresh offline cache.
export const dynamic = "force-static";

export function GET() {
  const precache = {
    version: `${appVersion}-${buildId}`,
    // Next.js sends this as the deployment ID; lets the worker tell this build's responses apart.
    buildId,
    pages: appRoutes,
  };

  return new Response(`self.PRECACHE = ${JSON.stringify(precache)};\n`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
