import { devices as phones } from "@playwright/test";
import { DEVICES, openDevice, startDemo, statusChip } from "./support/devices";
import { expect, test } from "./support/test";

// The app on a phone: the main pages fit the screen, and the core flows work by touch.
test.use({ ...phones["Pixel 7"] });

/** Whether the page is wider than the screen, i.e. scrolls sideways. */
const scrollsSideways = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("the homepage shows one column of cards and doesn't scroll sideways", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByRole("button", { name: "Show device details" });
  await expect(cards).toHaveCount(DEVICES.length);

  const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
  expect(second!.y).toBeGreaterThan(first!.y);
  expect(Math.abs(second!.x - first!.x)).toBeLessThan(2);
  expect(await scrollsSideways(page)).toBe(false);
});

test("revealing and opening a device works by tap", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reveal Device", exact: true }).last().tap();
  await page.getByRole("link", { name: /Asset Tracker/ }).tap();
  await expect(page.getByRole("heading", { level: 1, name: "Asset Tracker" })).toBeVisible();
});

for (const target of DEVICES) {
  test(`${target.name}: the demo page fits the screen`, async ({ page }) => {
    await openDevice(page, target);
    await startDemo(page);
    // Let the dashboard and charts fill in before measuring.
    await expect(statusChip(page, "Demo")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await scrollsSideways(page)).toBe(false);
  });
}
