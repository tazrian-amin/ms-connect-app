import type { Page } from "@playwright/test";
import { addAsset, connectSerial } from "./support/assets";
import { DEVICES, device, openDevice, startDemo, statusChip } from "./support/devices";
import { bluetoothRequests, installFakeBluetooth } from "./support/fake-bluetooth";
import { expect, test } from "./support/test";
import { FakeTrackerApi } from "./support/tracker-api";

/*
 * The app on Android tablets in Chrome, where it is mostly used.
 * Runs once per tablet in playwright.config.ts (TABLETS), portrait and landscape, so every test
 * here holds for every tablet. Layout expectations follow the app's MUI breakpoints:
 * sm = 600 px (two columns), md = 900 px (side-by-side panels), lg = 1200 px (three columns).
 */

const width = (page: Page) => page.viewportSize()!.width;

/** Whether the page is wider than the screen, i.e. scrolls sideways. */
const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/** Fails unless `locator` lies wholly on screen. */
async function expectOnScreen(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = (await locator.boundingBox())!;
  const { width: w, height: h } = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(w);
  expect(box.y + box.height).toBeLessThanOrEqual(h);
}

test.describe("homepage", () => {
  test("lays the cards out in columns, without scrolling sideways", async ({ page }) => {
    await page.goto("/");
    const cards = page.getByRole("button", { name: "Show device details" });
    await expect(cards).toHaveCount(DEVICES.length);

    const tops = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    const perRow = tops.filter((top) => Math.abs(top - tops[0]) < 2).length;
    expect(perRow).toBe(width(page) >= 1200 ? 3 : 2);
    expect(await scrollsSideways(page)).toBe(false);
  });

  test("search, reveal and open a device by touch", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search devices" }).tap();
    await page.getByRole("searchbox", { name: "Search devices" }).fill("flow");
    await expect(page.getByRole("button", { name: "Show device details" })).toHaveCount(1);

    await page.getByRole("button", { name: "Reveal Device", exact: true }).tap();
    await page.getByRole("link", { name: /Discharge Water Flow Monitor/ }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Discharge Water Flow Monitor" })).toBeVisible();
  });
});

for (const target of DEVICES) {
  test(`${target.name}: the demo runs and the page fits the screen`, async ({ page }) => {
    await openDevice(page, target);
    await startDemo(page);
    // Let the dashboard and charts fill in before measuring.
    await page.waitForTimeout(500);
    expect(await scrollsSideways(page)).toBe(false);

    await page.getByRole("button", { name: "Exit demo" }).tap();
    await expect(statusChip(page, "Not connected")).toBeVisible();
  });
}

test("turning the tablet round keeps the demo running and the page fitting", async ({ page }) => {
  await openDevice(page, device("dewater-pump-float-replacement"));
  await startDemo(page);

  const { width: w, height: h } = page.viewportSize()!;
  await page.setViewportSize({ width: h, height: w });
  await expect(statusChip(page, "Demo")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await scrollsSideways(page)).toBe(false);

  await page.setViewportSize({ width: w, height: h });
  await expect(statusChip(page, "Demo")).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
});

test("edit mode and the leave-page guard work by touch", async ({ page }) => {
  await openDevice(page, device("discharge-water-flow-monitor"));
  await startDemo(page);
  await page.getByRole("button", { name: "Enable edits" }).tap();
  await page.getByRole("link", { name: "All devices" }).tap();

  const warning = page.getByRole("dialog", { name: "Edit mode is on" });
  await expect(warning).toBeVisible();
  await expectOnScreen(page, warning);
  await warning.getByRole("button", { name: "Disable edits" }).tap();
  await expect(page.getByRole("button", { name: "Enable edits" })).toBeVisible();
});

test.describe("asset tracker", () => {
  let api: FakeTrackerApi;

  test.beforeEach(async ({ page }) => {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    api = new FakeTrackerApi();
    api.addTracker("AT-100", { device_name: "Loader 7" }, [
      { time: now - 5 * HOUR, latitude: 40.86, longitude: -85.16, moving: false },
      { time: now - 4 * HOUR, latitude: 40.86, longitude: -85.16, moving: true },
      { time: now - 4 * HOUR + 60_000, latitude: 40.865, longitude: -85.16, moving: true },
      { time: now - 4 * HOUR + 120_000, latitude: 40.87, longitude: -85.16, moving: false },
    ]);
    await api.install(page);
    await page.goto("/devices/asset-tracker");
    await addAsset(page, "Loader");
  });

  test("the serial number dialog fits the screen, and connecting works", async ({ page }) => {
    await page.getByRole("button", { name: "Connect", exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: "Connect through the cloud" });
    await expect(dialog).toBeVisible();
    await expectOnScreen(page, dialog);
    await dialog.getByRole("button", { name: "Cancel" }).tap();

    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Loader 7$/ })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
  });

  test("history puts the stops beside the map in landscape, and below it in portrait", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await page.getByRole("button", { name: "History" }).tap();

    const panel = page.getByRole("complementary", { name: "Stops and trips" });
    await expect(panel.getByRole("heading", { name: "Stops and trips · 2 stops" })).toBeVisible();
    const box = (await panel.boundingBox())!;
    if (width(page) >= 900) {
      // A side column, narrower than half the page.
      expect(box.width).toBeLessThan(width(page) / 2);
    } else {
      // Full width, under the map.
      expect(box.width).toBeGreaterThan(width(page) * 0.8);
    }
    expect(await scrollsSideways(page)).toBe(false);
  });
});

test.describe("Bluetooth", () => {
  test("Connect opens the device chooser, and closing it changes nothing", async ({ page }) => {
    await installFakeBluetooth(page, { chooser: "cancel" });
    await page.goto("/devices/discharge-water-flow-monitor");
    await page.getByRole("button", { name: "Connect", exact: true }).tap();

    await expect(statusChip(page, "Not connected")).toBeVisible();
    await expect(page.locator(".MuiSnackbar-root")).toHaveCount(0);
    const requests = await bluetoothRequests(page);
    expect(requests).toHaveLength(1);
    // The services the app talks to must be declared up front, or Chrome blocks them after pairing.
    // (Most profiles don't filter the chooser yet: see the TODOs in lib/*/bluetooth-profile.ts.)
    expect(requests[0].optionalServices?.length).toBeGreaterThan(0);
  });

  test("says what to do when Bluetooth permission is blocked", async ({ page }) => {
    await installFakeBluetooth(page, { chooser: "blocked" });
    await page.goto("/devices/discharge-water-flow-monitor");
    await page.getByRole("button", { name: "Connect", exact: true }).tap();
    await expect(page.locator(".MuiSnackbar-root").getByRole("alert")).toHaveText(
      "Bluetooth access was blocked. Check the browser's Bluetooth permission for this app.",
    );
  });

  test("warns when Bluetooth is switched off, but still lets the user try", async ({ page }) => {
    await installFakeBluetooth(page, { available: false });
    await page.goto("/devices/discharge-water-flow-monitor");
    await expect(page.getByText("Bluetooth looks switched off or unavailable on this device.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeEnabled();
  });
});
