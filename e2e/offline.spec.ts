import type { Page } from "@playwright/test";
import { DEVICES } from "./support/devices";
import { expect, test } from "./support/test";

/*
 * Offline use (public/sw.js): once signed in, the service worker caches every page and serves it
 * without a network, as long as the session lasts. These tests run with the worker on, which every
 * other test turns off (see playwright.config.ts).
 */
test.use({ serviceWorkers: "allow" });
// Installing the worker caches the whole app first.
test.describe.configure({ timeout: 60_000 });

const PAGES = ["/", ...DEVICES.map(({ slug }) => `/devices/${slug}`)];

/** Runs in the page: how many of the app's pages the worker has cached. */
async function cachedPageCount(page: Page): Promise<number> {
  return page.evaluate(async (pages) => {
    const keys = await caches.keys();
    const app = keys.find((key) => /^ms-connect-(?!shell-|access$)/.test(key));
    if (!app) return 0;
    const cache = await caches.open(app);
    let count = 0;
    for (const path of pages) if (await cache.match(path)) count++;
    return count;
  }, PAGES);
}

/** Opens the app and waits until the service worker controls it and has cached every page. */
async function installForOffline(page: Page) {
  await page.goto("/");
  // The page reloads itself once the worker takes over (components/providers/app-updater.tsx).
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null).catch(() => false), { timeout: 30_000 })
    .toBe(true);
  await expect.poll(() => cachedPageCount(page).catch(() => 0), { timeout: 30_000 }).toBe(PAGES.length);
  await expect(page.getByRole("heading", { name: "Connect Your Device" })).toBeVisible();
}

test("every page opens offline once the app has been cached", async ({ page, context }) => {
  await installForOffline(page);
  await context.setOffline(true);

  for (const { slug, name } of DEVICES) {
    await page.goto(`/devices/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Connect Your Device" })).toBeVisible();
});

test("a demo works offline", async ({ page, context }) => {
  await installForOffline(page);
  await context.setOffline(true);

  await page.goto("/devices/discharge-water-flow-monitor");
  await page.getByRole("button", { name: "Try demo" }).click();
  await expect(page.locator(".MuiChip-root").getByText("Demo", { exact: true })).toBeVisible();
});

test("a page the app doesn't have shows the offline page", async ({ page, context }) => {
  await installForOffline(page);
  await context.setOffline(true);

  await page.goto("/not-a-page");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
});

test("offline, an expired session shows the password dialog and deletes the cached app", async ({ page, context }) => {
  await installForOffline(page);
  // Offline first: online, the app's next session check would let the worker overwrite this
  // with the server's (still valid) answer.
  await context.setOffline(true);
  // What the worker last heard from /api/session, made to have expired a minute ago.
  await page.evaluate(async () => {
    const cache = await caches.open("ms-connect-access");
    await cache.put("/__access", Response.json({ authenticated: true, expiresAt: Date.now() - 60_000, pages: ["/"] }));
  });

  await page.goto("/devices/asset-tracker");
  await expect(page.getByRole("dialog", { name: "Enter the access password" })).toBeVisible();
  expect(await cachedPageCount(page)).toBe(0);

  // Signing in needs the server.
  await page.getByLabel("Password", { exact: true }).fill("anything");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toHaveText(/^You're offline\./);
});

test("offline, /api/session answers from the worker's memory", async ({ page, context }) => {
  await installForOffline(page);
  await context.setOffline(true);

  const body = await page.evaluate(async () => {
    const response = await fetch("/api/session", { cache: "no-store" });
    return { status: response.status, ...(await response.json()) };
  });
  expect(body).toMatchObject({ status: 200, authenticated: true, offline: true });
  expect(body.expiresAt).toBeGreaterThan(Date.now());
});

// Not covered: rolling out a new deploy (components/providers/app-updater.tsx). The browser's update
// check for the worker's scripts can't be intercepted by Playwright, so it would need a second build.
