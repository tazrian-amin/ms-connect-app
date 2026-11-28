import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { ADMIN, AUTH_FILE } from "./e2e/support/constants";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// The test server keeps its access settings here, never in the real .data/ or Redis.
const settingsDir = path.join(__dirname, "e2e", ".data");

/*
 * Android tablets the app is used on, in Chrome. Each runs e2e/tablet.spec.ts with its own screen
 * size and touch input. The app supports Android and Chrome only, so every project uses Chromium.
 */
const TABLETS = {
  "tablet-galaxy-tab-s9": devices["Galaxy Tab S9"],
  "tablet-galaxy-tab-s9-landscape": devices["Galaxy Tab S9 landscape"],
  "tablet-galaxy-tab-s4-landscape": devices["Galaxy Tab S4 landscape"],
  // 600 px wide: the narrowest tablet, right at the layout's phone/tablet breakpoint.
  "tablet-nexus-7": devices["Nexus 7"],
};

/*
 * Projects run in order:
 *   setup  → the admin sets a site password, a visitor signs in, and the session is saved.
 *   app    → every regular test, starting signed in with that session.
 *   tablet-* → e2e/tablet.spec.ts on each tablet in TABLETS, also signed in.
 *   admin  → tests that change the site password (which signs everyone out), so they run last.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The service worker answers requests itself, which hides them from page.route() and keeps
    // stale copies between tests. Tests that are about offline use turn it back on.
    serviceWorkers: "block",
  },

  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "app",
      testIgnore: [/global\.setup\.ts/, /admin-password\.spec\.ts/, /tablet\.spec\.ts/],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
    ...Object.entries(TABLETS).map(([name, device]) => ({
      name,
      testMatch: /tablet\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...device, storageState: AUTH_FILE },
    })),
    {
      name: "admin",
      testMatch: /admin-password\.spec\.ts/,
      dependencies: ["app", ...Object.keys(TABLETS)],
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // A production build, as the Next.js docs recommend. The settings start empty on every run.
    command: `rm -rf "${settingsDir}" && npm run build && npm run start -- --port ${PORT}`,
    url: `${baseURL}/manifest.webmanifest`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      ACCESS_SETTINGS_DIR: settingsDir,
      ADMIN_USERNAME: ADMIN.username,
      ADMIN_PASSWORD: ADMIN.password,
      // Empty, so a Redis configured in the shell is never used by the tests.
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      // Inlined at build time. A host that doesn't exist, so tests mock it and never reach the real API.
      NEXT_PUBLIC_ASSET_TRACKER_API_URL: "https://asset-tracker-api.test",
    },
  },
});
