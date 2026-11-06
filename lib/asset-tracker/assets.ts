import { useSyncExternalStore } from "react";
import { adoptSoleCloudLink, forgetCloudDevice } from "@/lib/cloud/remembered-links";

/*
 * The assets the user tracks, each fitted with an asset tracker. Each asset has its own tab on the
 * device details page and its own cloud link, keyed by the asset's id; the tracker's serial number
 * is asked for when connecting and kept with the link (see lib/cloud/remembered-links.ts). The list starts empty and is kept in
 * localStorage so it survives reloads; it lives only in this browser.
 */

const SLUG = "asset-tracker";

export type Asset = {
  id: string;
  name: string;
};

/** What the user enters when adding an asset. */
export type NewAsset = Omit<Asset, "id">;

const STORAGE_KEY = "asset-tracker:assets";

export const ASSET_NAME_MAX_LENGTH = 40;

const noAssets: Asset[] = [];

let assets: Asset[] | null = null;
const listeners = new Set<() => void>();

function load(): Asset[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(stored) && stored.every(isAsset)) return stored;
  } catch {
    // Storage blocked or the stored value is corrupt: start over.
  }
  return noAssets;
}

function isAsset(value: unknown): value is Asset {
  const asset = value as Partial<Asset>;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof asset.id === "string" &&
    typeof asset.name === "string"
  );
}

function getAssets(): Asset[] {
  assets ??= load();
  return assets;
}

function setAssets(next: Asset[]): void {
  assets = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Still works for this visit without storage.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The next free numbered name, e.g. "Asset 3", to suggest for a new asset. */
export function suggestAssetName(): string {
  let number = getAssets().length + 1;
  while (findAsset((asset) => sameText(asset.name, `Asset ${number}`))) number++;
  return `Asset ${number}`;
}

/** Why `name` can't be given to a new asset, or to the asset `renamingId` when renaming, or null if it can. */
export function validateAssetName(name: string, renamingId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name.";
  if (trimmed.length > ASSET_NAME_MAX_LENGTH) return `Use at most ${ASSET_NAME_MAX_LENGTH} characters.`;
  const other = findAsset((asset) => sameText(asset.name, trimmed));
  if (other && other.id !== renamingId) return "Another asset already has this name.";
  return null;
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function findAsset(predicate: (asset: Asset) => boolean): Asset | undefined {
  return getAssets().find(predicate);
}

/** Adds an asset (its name checked with `validateAssetName`) and returns it. */
export function addAsset({ name }: NewAsset): Asset {
  // Not crypto.randomUUID(), which is missing over plain HTTP.
  const id = `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const asset: Asset = { id, name: name.trim() };
  setAssets([...getAssets(), asset]);
  return asset;
}

/** Renames an asset (see `validateAssetName`). Its cloud link is kept. */
export function renameAsset(id: string, name: string): void {
  setAssets(getAssets().map((asset) => (asset.id === id ? { ...asset, name: name.trim() } : asset)));
}

/** Removes an asset and ends its cloud link. Removing the last one brings back the page's empty state. */
export function removeAsset(id: string): void {
  forgetCloudDevice(SLUG, id);
  setAssets(getAssets().filter((asset) => asset.id !== id));
}

/** Moves an asset to `index` in the list, shifting the assets between. Its cloud link is kept. */
export function moveAsset(id: string, index: number): void {
  const current = getAssets();
  const from = current.findIndex((asset) => asset.id === id);
  const to = Math.max(0, Math.min(index, current.length - 1));
  if (from === -1 || from === to) return;
  const next = [...current];
  next.splice(to, 0, ...next.splice(from, 1));
  setAssets(next);
}

/**
 * Turns the single tracker linked before the page had one tab per asset into the first asset, so
 * its link carries on there. Call as the app starts, before cloud links are resumed.
 */
export function adoptEarlierTracker(): void {
  adoptSoleCloudLink(SLUG, (_serialNumber, snapshot) => {
    const reportedName = typeof snapshot?.data.device_name === "string" ? snapshot.data.device_name : "";
    const name = validateAssetName(reportedName) === null ? reportedName : suggestAssetName();
    return addAsset({ name });
  });
}

/**
 * The assets, in the order the user arranged them, or null while the page is rendered on the
 * server and hydrating, before the saved list can be read; so a saved list doesn't flash the empty state.
 */
export function useAssets(): Asset[] | null {
  return useSyncExternalStore(subscribe, getAssets, () => null);
}
