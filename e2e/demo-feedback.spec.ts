import type { Page } from "@playwright/test";
import { device, openDevice, startDemo } from "./support/devices";
import { expect, test } from "./support/test";

/*
 * After a demo, a dialog asks how it went (lib/demo-feedback.ts): only after a demo of 30 s or
 * more that the visitor ended with Exit demo, once per device, at most once every 3 days, and never
 * after "Don't ask again". The page's clock is faked so no test waits in real time.
 */

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
const FLOW = device("discharge-water-flow-monitor");
const feedback = (page: Page) => page.getByRole("dialog", { name: /^How was the .* demo\?$/ });

/**
 * Moves every "asked at" time in the stored record back 3 days, as if they were asked that long
 * ago. (Jumping the page's clock 3 days ahead would also end the 3-day sign-in.)
 */
async function ageAskedTimes(page: Page) {
  await page.evaluate((age) => {
    const record = JSON.parse(localStorage.getItem("ms-connect:demo-feedback")!);
    for (const slug of Object.keys(record.asked)) record.asked[slug] -= age;
    localStorage.setItem("ms-connect:demo-feedback", JSON.stringify(record));
  }, THREE_DAYS);
}

async function runDemo(page: Page, seconds: number) {
  await startDemo(page);
  await page.clock.fastForward(seconds * 1000);
  await page.getByRole("button", { name: "Exit demo" }).click();
  // The dialog shows 1.5 s after the demo ends.
  await page.clock.fastForward(2_000);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await openDevice(page, FLOW);
});

test("asks after a demo of 30 seconds or more", async ({ page }) => {
  await runDemo(page, 31);
  await expect(feedback(page)).toHaveAccessibleName("How was the Discharge Water Flow Monitor demo?");
  await expect(feedback(page).getByRole("link", { name: "Contact Sales" })).toHaveAttribute("href", /^mailto:/);
});

test("doesn't ask after a short demo", async ({ page }) => {
  await runDemo(page, 10);
  await page.clock.fastForward(5_000);
  await expect(feedback(page)).toHaveCount(0);
});

test("doesn't ask when the demo ends by leaving the page", async ({ page }) => {
  await startDemo(page);
  await page.clock.fastForward(31_000);
  await page.getByRole("link", { name: "All devices" }).click();
  await page.getByRole("dialog", { name: "Demo mode is on" }).getByRole("button", { name: "Exit demo" }).click();
  await page.clock.fastForward(5_000);
  await expect(feedback(page)).toHaveCount(0);
});

test("can't be sent empty", async ({ page }) => {
  await runDemo(page, 31);
  const dialog = feedback(page);
  const send = dialog.getByRole("button", { name: "Email us" });
  await expect(send).toBeDisabled();

  await dialog.getByRole("checkbox", { name: "I'd like to order the Discharge Water Flow Monitor" }).check();
  await expect(send).toBeEnabled();
  await dialog.getByRole("checkbox", { name: "I'd like to order the Discharge Water Flow Monitor" }).uncheck();
  await expect(send).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Anything you'd like to tell us? (optional)" }).fill("Nice gauge.");
  await expect(send).toBeEnabled();
});

test("asks only once per device", async ({ page }) => {
  await runDemo(page, 31);
  await feedback(page).getByRole("button", { name: "Not now" }).click();
  await expect(feedback(page)).toBeHidden();

  await runDemo(page, 31);
  await expect(feedback(page)).toHaveCount(0);
});

test("asks about another device only after 3 days", async ({ page }) => {
  await runDemo(page, 31);
  await feedback(page).getByRole("button", { name: "Not now" }).click();

  await openDevice(page, device("dewater-water-level-monitor"));
  await runDemo(page, 31);
  await expect(feedback(page)).toHaveCount(0);

  await ageAskedTimes(page);
  await runDemo(page, 31);
  await expect(feedback(page)).toHaveAccessibleName("How was the Dewater Water Level Monitor demo?");
});

test("\"Don't ask again\" is remembered", async ({ page }) => {
  await runDemo(page, 31);
  await feedback(page).getByRole("button", { name: "Don't ask again" }).click();
  await expect(feedback(page)).toBeHidden();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ms-connect:demo-feedback") ?? "null"));
  expect(stored).toMatchObject({ optedOut: true });

  await ageAskedTimes(page);
  await openDevice(page, device("dewater-water-level-monitor"));
  await runDemo(page, 31);
  await expect(feedback(page)).toHaveCount(0);
});
