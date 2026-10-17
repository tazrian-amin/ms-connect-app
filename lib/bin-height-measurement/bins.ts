import { useSyncExternalStore } from "react";
import { releaseConnection } from "@/lib/bluetooth/registry";
import {
  DEFAULT_MATERIAL_TYPE,
  isBinCategory,
  isMaterialType,
  type BinCategory,
  type MaterialType,
} from "./bin-dashboard/bin-categories";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

/*
 * The bins the user monitors with bin height measurement sensors. Each bin has its own tab on the
 * device details page and its own sensor link, keyed by the bin's id. The list starts empty and is
 * kept in localStorage so it survives reloads; it lives only in this browser.
 */

export type Bin = {
  id: string;
  name: string;
  /** The shape the bin is drawn as. */
  category: BinCategory;
  /** What the bin holds, which sets how its material is drawn. */
  materialType: MaterialType;
  /** Hex colour (#rrggbb) the bin's material is drawn in; the default colour when unset. */
  materialColor?: string;
};

const STORAGE_KEY = "bin-height-measurement:bins";

/** What the user picks when adding a bin. */
export type NewBin = Omit<Bin, "id">;

/** Shown to bins saved before bins had a category, which were all drawn as industrial hoppers. */
const LEGACY_CATEGORY: BinCategory = "industrial-hopper";

const noBins: Bin[] = [];

let bins: Bin[] | null = null;
const listeners = new Set<() => void>();

function load(): Bin[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(stored) && stored.every(isStoredBin)) {
      return stored.map((bin) => ({
        ...bin,
        category: bin.category ?? LEGACY_CATEGORY,
        materialType: bin.materialType ?? DEFAULT_MATERIAL_TYPE,
      }));
    }
  } catch {
    // Storage blocked or the stored value is corrupt: start over.
  }
  return noBins;
}

/** A bin as stored, which may predate the category and material type. */
type StoredBin = Omit<Bin, "category" | "materialType"> & Partial<Pick<Bin, "category" | "materialType">>;

function isStoredBin(value: unknown): value is StoredBin {
  const bin = value as Partial<Bin>;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof bin.id === "string" &&
    typeof bin.name === "string" &&
    (bin.category === undefined || isBinCategory(bin.category)) &&
    (bin.materialType === undefined || isMaterialType(bin.materialType)) &&
    (bin.materialColor === undefined || isHexColor(bin.materialColor))
  );
}

/** Whether `value` is a #rrggbb colour, the form `<input type="color">` gives. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function getBins(): Bin[] {
  bins ??= load();
  return bins;
}

function setBins(next: Bin[]): void {
  bins = next;
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

export const BIN_NAME_MAX_LENGTH = 40;

/** The next free numbered name, e.g. "Bin 3", to suggest for a new bin. */
export function suggestBinName(): string {
  const current = getBins();
  let number = current.length + 1;
  while (findBinByName(`Bin ${number}`)) number++;
  return `Bin ${number}`;
}

/** Why `name` can't be given to a new bin, or to the bin `renamingId` when renaming, or null if it can. */
export function validateBinName(name: string, renamingId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name.";
  if (trimmed.length > BIN_NAME_MAX_LENGTH) return `Use at most ${BIN_NAME_MAX_LENGTH} characters.`;
  const other = findBinByName(trimmed);
  if (other && other.id !== renamingId) return "Another bin already has this name.";
  return null;
}

function findBinByName(name: string): Bin | undefined {
  const wanted = name.trim().toLowerCase();
  return getBins().find((bin) => bin.name.toLowerCase() === wanted);
}

/** Adds a bin (its name checked with `validateBinName`) and returns it. */
export function addBin({ name, category, materialType, materialColor }: NewBin): Bin {
  // Not crypto.randomUUID(), which is missing over plain HTTP.
  const id = `bin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const bin: Bin = {
    id,
    name: name.trim(),
    category,
    materialType,
    ...(isHexColor(materialColor) && { materialColor }),
  };
  setBins([...getBins(), bin]);
  return bin;
}

/** Renames a bin (see `validateBinName`). Its sensor link is kept. */
export function renameBin(id: string, name: string): void {
  setBins(getBins().map((bin) => (bin.id === id ? { ...bin, name: name.trim() } : bin)));
}

/** Sets the colour (#rrggbb) a bin's material is drawn in. */
export function setBinMaterialColor(id: string, materialColor: string): void {
  if (!isHexColor(materialColor)) return;
  setBins(getBins().map((bin) => (bin.id === id ? { ...bin, materialColor } : bin)));
}

/** Removes a bin and disconnects its sensor. Removing the last one brings back the page's empty state. */
export function removeBin(id: string): void {
  const current = getBins();
  releaseConnection(binHeightMeasurementProfile, id);
  setBins(current.filter((bin) => bin.id !== id));
}

/** Moves a bin to `index` in the list, shifting the bins between. Its sensor link is kept. */
export function moveBin(id: string, index: number): void {
  const current = getBins();
  const from = current.findIndex((bin) => bin.id === id);
  const to = Math.max(0, Math.min(index, current.length - 1));
  if (from === -1 || from === to) return;
  const next = [...current];
  next.splice(to, 0, ...next.splice(from, 1));
  setBins(next);
}

/**
 * The bins, in the order the user arranged them, or null while the page is rendered on the server
 * and hydrating, before the saved list can be read; so a saved list doesn't flash the empty state.
 */
export function useBins(): Bin[] | null {
  return useSyncExternalStore(subscribe, getBins, () => null);
}
