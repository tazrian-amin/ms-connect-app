import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";

// UTC build time such as "20261002-143005". Shown in the footer and used as the service
// worker's cache version, so every deploy is identifiable and reaches installed apps.
//
// `next start` evaluates this file again, so it must reuse the build's ID rather than make a
// new one: otherwise every client-side navigation looks like it hit a different deploy.
// The build records its resolved config in required-server-files.json.
function resolveBuildId(phase: string): string {
  if (phase === PHASE_PRODUCTION_SERVER) {
    const file = join(process.cwd(), ".next", "required-server-files.json");
    return JSON.parse(readFileSync(file, "utf8")).config.deploymentId;
  }
  return new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

export default function nextConfig(phase: string): NextConfig {
  const buildId = resolveBuildId(phase);

  return {
    // Tags client-side navigation responses with the build, so the service worker only caches
    // data that matches its own build, and Next.js reloads instead of mixing two deploys.
    deploymentId: buildId,
    env: {
      APP_BUILD_ID: buildId,
    },
    async headers() {
      return [
        {
          // Always fetch a fresh service worker so updates roll out promptly.
          source: "/sw.js",
          headers: [
            { key: "Content-Type", value: "application/javascript; charset=utf-8" },
            { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
            { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          ],
        },
        {
          // Imported by sw.js; must also be fresh so a new build's cache version is seen.
          source: "/sw-precache.js",
          headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
        },
      ];
    },
  };
}
