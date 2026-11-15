import type { Page } from "@playwright/test";
import { expect } from "./test";

// The asset tracker page's tabs and dialogs (lib/asset-tracker, components/device-details/instance-tabs.tsx).

export const tabs = (page: Page) => page.getByRole("tablist", { name: "Assets" }).getByRole("tab");
export const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Assets" }).getByRole("tab", { name });
export const nameField = (page: Page) => page.getByRole("textbox", { name: "Asset name" });

/** Adds an asset, from the empty state or the tab bar, with `name` or the suggested one. */
export async function addAsset(page: Page, name?: string) {
  const empty = page.getByRole("button", { name: "Add a new asset" });
  await (await empty.isVisible() ? empty : page.getByRole("button", { name: "Add asset" })).click();
  const dialog = page.getByRole("dialog", { name: "Add asset" });
  if (name !== undefined) await nameField(page).fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog).toBeHidden();
}

/** Picks an item from the selected asset's "More actions" menu. */
export async function assetMenu(page: Page, item: string) {
  await page.getByRole("button", { name: /^More actions for / }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

/** Opens the cloud connect dialog and submits `serial`. Returns the dialog. */
export async function connectSerial(page: Page, serial: string) {
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Connect through the cloud" });
  await dialog.getByRole("textbox", { name: "Serial number" }).fill(serial);
  await dialog.getByRole("button", { name: "Connect" }).click();
  return dialog;
}
