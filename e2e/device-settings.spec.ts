import type { Page } from "@playwright/test";
import { device, enableEdits, errorToast, openDevice, settingCard, startDemo, widgetValue } from "./support/devices";
import { expect, test } from "./support/test";

/*
 * Settings and actions, driven against the demo simulators. The simulators answer like firmware,
 * including rejecting bad values, so this covers the same code paths as a real device.
 */

test.describe("asset tracker settings", () => {
  test.beforeEach(async ({ page }) => {
    await openDevice(page, device("asset-tracker"));
    await startDemo(page);
  });

  test("stay locked until edit mode is on", async ({ page }) => {
    const card = settingCard(page, "Moving interval");
    await expect(card.getByRole("spinbutton", { name: "Interval" })).toBeDisabled();
    await expect(card.getByRole("button", { name: "Apply" })).toBeDisabled();

    await enableEdits(page);
    await expect(card.getByRole("spinbutton", { name: "Interval" })).toBeEnabled();
    await expect(card.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  test("show what the device reports, and a change shows up on the dashboard", async ({ page }) => {
    const card = settingCard(page, "Asset name");
    await expect(card.getByText("Reported by the device: Truck 12")).toBeVisible();

    await enableEdits(page);
    await card.getByRole("textbox", { name: "Name" }).fill("Haul truck 4");
    await card.getByRole("button", { name: "Apply" }).click();

    await expect(card.getByText("Reported by the device: Haul truck 4")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Haul truck 4$/ })).toBeVisible();
  });

  test("check numbers before sending", async ({ page }) => {
    await enableEdits(page);
    const card = settingCard(page, "Moving interval");
    const input = card.getByRole("spinbutton", { name: "Interval" });

    await input.fill("0");
    await card.getByRole("button", { name: "Apply" }).click();
    await expect(errorToast(page)).toHaveText("Interval must be at least 1 s.");

    await input.fill("");
    await card.getByRole("button", { name: "Apply" }).click();
    await expect(errorToast(page)).toHaveText("Enter a number for Interval.");
    await expect(card.getByText("Reported by the device: 60 s")).toBeVisible();
  });

  test("show the device's reason when it rejects a value", async ({ page }) => {
    await enableEdits(page);
    const card = settingCard(page, "Asset name");
    // The app allows any text; the tracker only takes 1–32 characters.
    await card.getByRole("textbox", { name: "Name" }).fill("A".repeat(40));
    await card.getByRole("button", { name: "Apply" }).click();

    await expect(errorToast(page)).toHaveText("The device rejected this: Name must be 1–32 characters.");
    await expect(card.getByText("Reported by the device: Truck 12")).toBeVisible();
  });

  test("drop an unapplied change when edit mode is turned off", async ({ page }) => {
    await enableEdits(page);
    const input = settingCard(page, "Moving interval").getByRole("spinbutton", { name: "Interval" });
    await input.fill("999");
    await page.getByRole("button", { name: "Disable edits" }).click();
    await expect(input).toHaveValue("60");
  });

  test("a fresh demo starts from the default settings", async ({ page }) => {
    await enableEdits(page);
    const card = settingCard(page, "Moving interval");
    await card.getByRole("spinbutton", { name: "Interval" }).fill("90");
    await card.getByRole("button", { name: "Apply" }).click();
    await expect(card.getByText("Reported by the device: 90 s")).toBeVisible();

    await page.getByRole("button", { name: "Disable edits" }).click();
    await page.getByRole("button", { name: "Exit demo" }).click();
    await startDemo(page);
    await expect(card.getByText("Reported by the device: 60 s")).toBeVisible();
  });
});

test.describe("discharge water flow monitor", () => {
  const totalVolume = (page: Page) => widgetValue(page, "Total volume released");

  const readGallons = async (page: Page) => Number((await totalVolume(page).textContent())!.replace(/,/g, ""));

  test.beforeEach(async ({ page }) => {
    await openDevice(page, device("discharge-water-flow-monitor"));
    await startDemo(page);
    await expect(totalVolume(page)).toHaveText(/^\d{3},\d{3}$/);
  });

  test("the scaling setting changes the reported flow", async ({ page }) => {
    const card = settingCard(page, "Scaling");
    await expect(card.getByText("Reported by the device: 50 gal/min/V")).toBeVisible();

    await enableEdits(page);
    await card.getByRole("spinbutton", { name: "Flow per volt" }).fill("100");
    await card.getByRole("button", { name: "Apply" }).click();
    await expect(card.getByText("Reported by the device: 100 gal/min/V")).toBeVisible();
    // About 5 V from the sensor: twice the scaling, about twice the flow (roughly 500 gal/min).
    await expect(widgetValue(page, "Instantaneous flow rate")).toHaveText(/^[4-6]\d\d\.\d\s*gal\/min$/);
  });

  test("rejects a scaling of zero, with the device's reason", async ({ page }) => {
    await enableEdits(page);
    const card = settingCard(page, "Scaling");
    await card.getByRole("spinbutton", { name: "Flow per volt" }).fill("0");
    await card.getByRole("button", { name: "Apply" }).click();
    await expect(errorToast(page)).toHaveText("The device rejected this: Flow per volt must be above 0.");
  });

  test("resetting the total asks first, and can be cancelled", async ({ page }) => {
    await enableEdits(page);
    const before = await readGallons(page);

    await page.getByRole("button", { name: "Reset total" }).click();
    const confirm = page.getByRole("dialog", { name: "Reset total?" });
    await expect(confirm).toContainText("The device's total volume counter will go back to zero. This cannot be undone.");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    expect(await readGallons(page)).toBeGreaterThanOrEqual(before);

    await page.getByRole("button", { name: "Reset total" }).click();
    await confirm.getByRole("button", { name: "Reset total" }).click();
    // Back to zero, then counting up again from there.
    await expect.poll(() => readGallons(page)).toBeLessThan(1_000);
  });

  test("resetting needs edit mode, refreshing doesn't", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Reset total" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  test("the total can be shown in other units, and the choice is remembered", async ({ page }) => {
    const gallons = await readGallons(page);
    await page.getByRole("button", { name: "Volume unit: US gallons" }).click();
    await page.getByRole("menuitem", { name: /Litres/ }).click();

    await expect(page.getByRole("button", { name: "Volume unit: Litres" })).toBeVisible();
    const litres = await readGallons(page);
    // 3.785 L to the gallon; the total keeps growing meanwhile, so allow a little.
    expect(litres / gallons).toBeGreaterThan(3.7);
    expect(litres / gallons).toBeLessThan(3.9);

    await page.getByRole("button", { name: "Exit demo" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Volume unit: Litres" })).toBeVisible();
  });
});
