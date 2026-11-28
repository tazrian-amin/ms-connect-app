import { DEVICES, openDevice, startDemo, statusChip } from "./support/devices";
import { expect, test } from "./support/test";

/*
 * Every device has a demo: a simulator that stands in for the firmware behind the same connection
 * code (lib/bluetooth/demo.ts). Driving the demo exercises the device page end to end without hardware.
 */

// Uncaught page errors fail every test here (see support/test.ts).
for (const device of DEVICES) {
  test.describe(device.name, () => {
    test("starts and exits the demo", async ({ page }) => {
      await openDevice(page, device);
      await expect(statusChip(page, "Not connected")).toBeVisible();

      await startDemo(page);
      await expect(page.getByRole("button", { name: "Enable edits" })).toBeEnabled();

      await page.getByRole("button", { name: "Exit demo" }).click();
      await expect(statusChip(page, "Not connected")).toBeVisible();
      await expect(page.getByRole("button", { name: "Try demo" })).toBeVisible();
    });
  });
}

test.describe("leaving a device page", () => {
  const device = DEVICES.find(({ slug }) => slug === "discharge-water-flow-monitor")!;

  test.beforeEach(async ({ page }) => {
    await openDevice(page, device);
    await startDemo(page);
  });

  test("is blocked while a demo runs, until the visitor exits the demo", async ({ page }) => {
    await page.getByRole("link", { name: "All devices" }).click();
    const warning = page.getByRole("dialog", { name: "Demo mode is on" });
    await expect(warning).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/devices/${device.slug}$`));

    await warning.getByRole("button", { name: "Keep exploring" }).click();
    await expect(warning).toBeHidden();
    await expect(statusChip(page, "Demo")).toBeVisible();

    await page.getByRole("link", { name: "All devices" }).click();
    await warning.getByRole("button", { name: "Exit demo" }).click();
    await expect(statusChip(page, "Not connected")).toBeVisible();

    await page.getByRole("link", { name: "All devices" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("with the browser's back button is blocked too", async ({ page }) => {
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Demo mode is on" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/devices/${device.slug}$`));
  });
});

test.describe("edit mode", () => {
  const device = DEVICES.find(({ slug }) => slug === "discharge-water-flow-monitor")!;

  test.beforeEach(async ({ page }) => {
    await openDevice(page, device);
    await startDemo(page);
    await page.getByRole("button", { name: "Enable edits" }).click();
    await expect(page.getByText("Edit mode is on. Changes you apply are sent to the device.")).toBeVisible();
  });

  test("blocks disconnecting until edits are disabled", async ({ page }) => {
    await page.getByRole("button", { name: "Exit demo" }).click();
    const warning = page.getByRole("dialog", { name: "Edit mode is on" });
    await expect(warning).toContainText("Edit mode needs to be disabled before you disconnect the device.");
    await expect(statusChip(page, "Demo")).toBeVisible();

    await warning.getByRole("button", { name: "Disable edits" }).click();
    await expect(warning).toBeHidden();
    await expect(page.getByRole("button", { name: "Enable edits" })).toBeVisible();
  });

  test("blocks leaving the page, ahead of the demo warning", async ({ page }) => {
    await page.getByRole("link", { name: "All devices" }).click();
    const warning = page.getByRole("dialog", { name: "Edit mode is on" });
    await expect(warning).toContainText("Edit mode needs to be disabled before you leave this page.");

    await warning.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByRole("button", { name: "Disable edits" })).toBeVisible();
  });
});
