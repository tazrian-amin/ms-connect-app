import type { Page } from "@playwright/test";
import { expect } from "./test";

export type DeviceCase = {
  slug: string;
  name: string;
  /** Devices that monitor several units ask for one to be added before anything else shows. */
  addFirst?: { button: string; dialog: string };
};

export const DEVICES: DeviceCase[] = [
  { slug: "dewater-pump-float-replacement", name: "Dewater Pump Float Replacement" },
  { slug: "bin-height-measurement", name: "Bin Height Measurement", addFirst: { button: "Add a new bin", dialog: "Add bin" } },
  { slug: "conveyor-volumetric-scale", name: "Conveyor Volumetric Scale" },
  { slug: "conveyor-volumetric-scale-pro", name: "Conveyor Volumetric Scale Pro" },
  { slug: "discharge-water-flow-monitor", name: "Discharge Water Flow Monitor" },
  { slug: "dewater-water-level-monitor", name: "Dewater Water Level Monitor" },
  { slug: "asset-tracker", name: "Asset Tracker", addFirst: { button: "Add a new asset", dialog: "Add asset" } },
];

export const device = (slug: string) => DEVICES.find((candidate) => candidate.slug === slug)!;

/** The connection status chip, e.g. "Not connected" or "Demo" (components/connection/connection-status-chip.tsx). */
export const statusChip = (page: Page, label: string) =>
  page.locator(".MuiChip-root").getByText(label, { exact: true });

/** Opens a device's page, adding its first bin or asset if it needs one. */
export async function openDevice(page: Page, target: DeviceCase) {
  await page.goto(`/devices/${target.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: target.name, exact: true })).toBeVisible();
  if (target.addFirst) {
    await page.getByRole("button", { name: target.addFirst.button }).click();
    const dialog = page.getByRole("dialog", { name: target.addFirst.dialog });
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(dialog).toBeHidden();
  }
}

export async function startDemo(page: Page) {
  await page.getByRole("button", { name: "Try demo" }).click();
  await expect(statusChip(page, "Demo")).toBeVisible();
  await expect(page.getByText("You're trying a demo with simulated readings.")).toBeVisible();
}

export async function enableEdits(page: Page) {
  await page.getByRole("button", { name: "Enable edits" }).click();
  await expect(page.getByText("Edit mode is on. Changes you apply are sent to the device.")).toBeVisible();
}

/** One setting's card (components/device-details/command-controls.tsx SettingForm), by its title. */
export const settingCard = (page: Page, title: string) =>
  page.locator("form").filter({ has: page.getByRole("heading", { level: 3, name: title, exact: true }) });

/** The app-wide error toast (components/providers/error-toast.tsx). */
export const errorToast = (page: Page) => page.locator(".MuiSnackbar-root").getByRole("alert");

/**
 * The value shown in a dashboard widget (components/device-details/dashboard-widgets.tsx), by the
 * widget's label: its first paragraph other than the label itself.
 */
export const widgetValue = (page: Page, label: string) =>
  page
    .locator(".MuiPaper-root")
    // The label as a paragraph, not e.g. a telemetry chart's heading of the same name.
    .filter({ has: page.getByRole("paragraph").getByText(label, { exact: true }) })
    .last()
    .getByRole("paragraph")
    .filter({ hasNotText: label })
    .first();
