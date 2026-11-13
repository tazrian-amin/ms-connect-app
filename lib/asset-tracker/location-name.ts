"use client";

import { useEffect, useState } from "react";

/*
 * Turns coordinates into a place name ("321 Eagle Court, Ossian, Indiana") with OpenStreetMap's
 * Nominatim. It is free, but allows about one request a second and no bulk use, so names are only
 * looked up when someone asks to see one, and each spot (to about 10 m) is looked up once.
 *
 * For heavier use, do this in the backend instead (e.g. Azure Maps reverse geocoding) and store the
 * name with each location, so every viewer doesn't ask again.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

type NominatimAddress = Partial<
  Record<
    | "house_number"
    | "road"
    | "neighbourhood"
    | "suburb"
    | "village"
    | "town"
    | "city"
    | "county"
    | "state"
    | "country",
    string
  >
>;

type NominatimResult = { name?: string; display_name?: string; address?: NominatimAddress };

/** Resolved names, or in-flight lookups, keyed by the rounded coordinates. */
const names = new Map<string, Promise<string | null>>();

// Four decimal places is about 11 m: close enough to share a name, and lets a parked asset's
// small GPS drift reuse the lookup.
const keyFor = (latitude: number, longitude: number) => `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

function lookUp(latitude: number, longitude: number): Promise<string | null> {
  const key = keyFor(latitude, longitude);
  let name = names.get(key);
  if (!name) {
    const url = `${ENDPOINT}?format=jsonv2&zoom=18&lat=${latitude}&lon=${longitude}`;
    name = fetch(url, { headers: { "Accept-Language": navigator.language } })
      .then((response) => (response.ok ? (response.json() as Promise<NominatimResult>) : null))
      .then((result) => (result ? formatName(result) : null))
      .catch(() => null);
    // A failed lookup is forgotten, so the next time the name is shown it tries again.
    name.then((resolved) => resolved ?? names.delete(key));
    names.set(key, name);
  }
  return name;
}

function formatName({ name, display_name, address = {} }: NominatimResult): string | null {
  const street = [address.house_number, address.road].filter(Boolean).join(" ");
  const place = address.city ?? address.town ?? address.village ?? address.suburb ?? address.county;
  const parts = [name || street || address.neighbourhood, place, address.state].filter(Boolean);
  return parts.length ? parts.join(", ") : (display_name ?? null);
}

export type LocationName = { status: "idle" | "loading" | "found" | "unknown"; name?: string };

/** The place name at the given coordinates, looked up only while `enabled`. */
export function useLocationName(latitude: number, longitude: number, enabled: boolean): LocationName {
  const key = keyFor(latitude, longitude);
  const [result, setResult] = useState<{ key: string; name: string | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    lookUp(latitude, longitude).then((name) => {
      if (current) setResult({ key, name });
    });
    return () => {
      current = false;
    };
  }, [enabled, key, latitude, longitude]);

  if (result?.key === key) return result.name ? { status: "found", name: result.name } : { status: "unknown" };
  return { status: enabled ? "loading" : "idle" };
}
