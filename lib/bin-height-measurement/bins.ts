import { useSyncExternalStore } from "react";
import { releaseConnection } from "@/lib/bluetooth/registry";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

/*
 * The bins the user monitors with bin height measurement sensors. Each bin has its own tab on the
 * device details page and its own sensor link, keyed by the bin's id. The list is kept in
 * localStorage so it survives reloads; it lives only in this browser.
 */

export type Bin = {
  id: string;
  name: string;
};

const STORAGE_KEY = "bin-height-measurement:bins";

const defaultBins: Bin[] = [{ id: "bin-1", name: "Bin 1" }];

let bins: Bin[] | null = null;
const listeners = new Set<() => void>();

function load(): Bin[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(stored) && stored.length > 0 && stored.every(isBin)) return stored;
  } catch {
    // Storage blocked or the stored value is corrupt: start over.
  }
  return defaultBins;
}

function isBin(value: unknown): value is Bin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Bin).id === "string" &&
    typeof (value as Bin).name === "string"
  );
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

/** Adds a bin named after the next free number, e.g. "Bin 3", and returns it. */
export function addBin(): Bin {
  const current = getBins();
  const taken = new Set(current.map((bin) => bin.name));
  let number = current.length + 1;
  while (taken.has(`Bin ${number}`)) number++;
  // Not crypto.randomUUID(), which is missing over plain HTTP.
  const bin = { id: `bin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name: `Bin ${number}` };
  setBins([...current, bin]);
  return bin;
}

/** Removes a bin and disconnects its sensor. The last bin is kept, so the page always has one to show. */
export function removeBin(id: string): void {
  const current = getBins();
  if (current.length <= 1) return;
  releaseConnection(binHeightMeasurementProfile, id);
  setBins(current.filter((bin) => bin.id !== id));
}

/** The bins, in the order they were added. */
export function useBins(): Bin[] {
  return useSyncExternalStore(subscribe, getBins, () => defaultBins);
}
