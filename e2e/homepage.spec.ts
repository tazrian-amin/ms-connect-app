import { expect, test } from "./support/test";

const DEVICE_COUNT = 7;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Connect Your Device" })).toBeVisible();
});

const cards = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^(Show|Hide) device details$/ });

test("every device card starts hidden", async ({ page }) => {
  await expect(cards(page)).toHaveCount(DEVICE_COUNT);
  await expect(page.getByRole("button", { name: "Show device details" })).toHaveCount(DEVICE_COUNT);
  await expect(page.getByRole("button", { name: "Hidden device. Show its details." })).toHaveCount(DEVICE_COUNT);
  await expect(page.getByText("Asset Tracker", { exact: true })).toHaveCount(0);
});

test("revealing a card shows its name, survives a reload, and can be hidden again", async ({ page }) => {
  await page.getByRole("button", { name: "Hidden device. Show its details." }).first().click();
  await expect(page.getByRole("button", { name: "Hide device details" })).toHaveCount(1);
  const name = page.getByRole("heading", { level: 3, name: "Dewater Pump Float Replacement" });
  await expect(name).toBeVisible();

  await page.reload();
  await expect(name).toBeVisible();

  await page.getByRole("button", { name: "Hide device details" }).click();
  await expect(name).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show device details" })).toHaveCount(DEVICE_COUNT);
});

test("a revealed card opens its device page", async ({ page }) => {
  await page.getByRole("button", { name: "Show device details" }).last().click();
  await page.getByRole("link", { name: /Asset Tracker/ }).click();
  await expect(page).toHaveURL(/\/devices\/asset-tracker$/);
  await expect(page.getByRole("heading", { level: 1, name: "Asset Tracker" })).toBeVisible();

  await page.getByRole("link", { name: "All devices" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.describe("search", () => {
  test("filters by name", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search devices" }).fill("conveyor");
    await expect(cards(page)).toHaveCount(2);
  });

  test("filters by description, ignoring case and spaces", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search devices" }).fill("  BATTERY  ");
    await expect(cards(page)).toHaveCount(1);
  });

  test("says so when nothing matches, and clearing shows everything again", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "Search devices" });
    await search.fill("toaster");
    await expect(page.getByText("No devices match “toaster”.")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);

    await search.fill("");
    await expect(cards(page)).toHaveCount(DEVICE_COUNT);
  });
});

test("an unknown device is a 404", async ({ page }) => {
  const response = await page.goto("/devices/not-a-device");
  expect(response?.status()).toBe(404);
});
