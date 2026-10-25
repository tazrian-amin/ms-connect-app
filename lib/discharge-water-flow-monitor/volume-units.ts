"use client";

import { useSyncExternalStore } from "react";

/** Units the total volume can be shown in. The device reports US gallons. */
export const VOLUME_UNITS = {
  gal: { label: "gal", name: "US gallons", perGallon: 1, precision: 0 },
  L: { label: "L", name: "Litres", perGallon: 3.785411784, precision: 0 },
  "m³": { label: "m³", name: "Cubic metres", perGallon: 0.003785411784, precision: 2 },
  "ft³": { label: "ft³", name: "Cubic feet", perGallon: 0.1336805556, precision: 1 },
  "ac-ft": { label: "ac-ft", name: "Acre-feet", perGallon: 1 / 325_851.4, precision: 3 },
} as const;

export type VolumeUnit = keyof typeof VOLUME_UNITS;

const DEFAULT_UNIT: VolumeUnit = "gal";
// One choice for every flow monitor: it is how this reader thinks about water, not a property of a device.
const STORAGE_KEY = "ms-connect:discharge-volume-unit";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// localStorage throws in some private modes; the choice is only a convenience, so fall back to gallons.
function readStored(): VolumeUnit {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored !== null && stored in VOLUME_UNITS ? (stored as VolumeUnit) : DEFAULT_UNIT;
  } catch {
    return DEFAULT_UNIT;
  }
}

function writeStored(unit: VolumeUnit): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // The choice still applies until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

/** The unit the reader last picked for total volume, remembered in this browser. Gallons until they pick one. */
export function useVolumeUnit(): [VolumeUnit, (unit: VolumeUnit) => void] {
  const unit = useSyncExternalStore(subscribe, readStored, () => DEFAULT_UNIT);
  return [unit, writeStored];
}

/** `gallons` in `unit`, with thousands separators and the unit's usual precision. */
export function formatVolume(gallons: number, unit: VolumeUnit): string {
  const { perGallon, precision } = VOLUME_UNITS[unit];
  return (gallons * perGallon).toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
