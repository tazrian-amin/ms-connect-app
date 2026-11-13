"use client";

import { useEffect, useState } from "react";
import { fetchAssetTrackerHistory } from "./cloud";
import { DEMO_HOME } from "./demo";
import type { LatLng, TimedLatLng } from "./location";

/** Where history comes from: the demo's made-up journeys, or the backend by serial number. */
export type HistorySource = { kind: "demo" } | { kind: "cloud"; serialNumber: string };

export type HistoryRange = { from: number; to: number };

export type LocationHistory =
  | { status: "loading"; points?: TimedLatLng[] }
  | { status: "loaded"; points: TimedLatLng[] }
  | { status: "error"; error: string; points?: TimedLatLng[] };

/**
 * The locations recorded in `range`, oldest first, while `source` and `range` are set. While a new
 * range loads, the previous points are kept, so the map doesn't blank between ranges.
 */
export function useLocationHistory(source: HistorySource | null, range: HistoryRange | null): LocationHistory | null {
  const key = source && range ? `${JSON.stringify(source)}:${range.from}:${range.to}` : null;
  const [result, setResult] = useState<{ key: string; points?: TimedLatLng[]; error?: string } | null>(null);

  useEffect(() => {
    if (!key || !source || !range) return;
    const controller = new AbortController();
    load(source, range, controller.signal).then(
      (points) => setResult({ key, points }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, error: error instanceof Error ? error.message : "Couldn't load the history." });
      },
    );
    return () => controller.abort();
    // `key` stands for `source` and `range`, which are new objects on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  const previous = result?.points;
  if (result?.key !== key) return { status: "loading", points: previous };
  if (result.error) return { status: "error", error: result.error, points: previous };
  return { status: "loaded", points: result.points ?? [] };
}

function load(source: HistorySource, range: HistoryRange, signal: AbortSignal): Promise<TimedLatLng[]> {
  if (source.kind === "cloud") return fetchAssetTrackerHistory(source.serialNumber, range.from, range.to, signal);
  // A short wait, so the demo shows loading the way the real service will.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(demoHistory(range.from, range.to)), 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

const MINUTE = 60_000;
/** About 30 km/h, in degrees of latitude per minute. */
const DEMO_SPEED = 0.0045;
/** How far from home the truck's destinations can be, in degrees (about 6 km). */
const DEMO_RANGE = 0.055;
/**
 * Like the real tracker: a report every minute while moving, every 30 minutes while parked, and
 * one the moment its accelerometer says it started or stopped moving.
 */
const DEMO_PARKED_REPORT_MINUTES = 30;

/**
 * A made-up history for the demo. During the working day (07:00–19:00) the truck drives from
 * stop to stop, each a random place within a few km of home, waiting 1–3 hours at each; from
 * 17:00 it heads home and stays there overnight. The same range always gives the same journey.
 * Each location says whether it was moving, as the real tracker's reports do.
 */
export function demoHistory(from: number, to: number): TimedLatLng[] {
  const random = seededRandom(Math.floor(from / MINUTE) ^ Math.floor(to / MINUTE));
  const between = (min: number, max: number) => min + random() * (max - min);
  const lonScale = Math.cos((DEMO_HOME.latitude * Math.PI) / 180);
  const points: TimedLatLng[] = [];

  let { latitude, longitude } = DEMO_HOME;
  let heading = 0;
  let target: LatLng | null = null;
  let parkedUntil = from + between(0, 90) * MINUTE;
  let parkedMinutes = DEMO_PARKED_REPORT_MINUTES;
  let moving = false;

  for (let time = Math.ceil(from / MINUTE) * MINUTE; time <= to; time += MINUTE) {
    const hour = new Date(time).getHours();

    // Set off for the next stop once the wait is over, if it's still the working day.
    if (!target && time >= parkedUntil && hour >= 7 && hour < 19) {
      const atHome = latitude === DEMO_HOME.latitude && longitude === DEMO_HOME.longitude;
      target =
        hour >= 17 || (!atHome && random() < 0.3)
          ? DEMO_HOME
          : {
              latitude: DEMO_HOME.latitude + between(-1, 1) * DEMO_RANGE,
              longitude: DEMO_HOME.longitude + (between(-1, 1) * DEMO_RANGE) / lonScale,
            };
      if (target === DEMO_HOME && atHome) target = null;
    }

    if (target && !moving) {
      // Set off: reported straight away, from where it was parked.
      moving = true;
      points.push({ latitude, longitude, time, moving });
      parkedMinutes = 0;
    } else if (target) {
      const north = target.latitude - latitude;
      const east = (target.longitude - longitude) * lonScale;
      if (Math.hypot(north, east) <= DEMO_SPEED) {
        // Arrived: park here for a while.
        ({ latitude, longitude } = target);
        target = null;
        moving = false;
        parkedUntil = time + between(60, 180) * MINUTE;
      } else {
        // Steer towards the stop, with some wobble so the road isn't a straight line.
        const wanted = Math.atan2(east, north);
        const turn = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
        heading += turn * 0.35 + (random() - 0.5) * 0.5;
        latitude += DEMO_SPEED * Math.cos(heading);
        longitude += (DEMO_SPEED * Math.sin(heading)) / lonScale;
      }
      points.push({ latitude, longitude, time, moving });
      parkedMinutes = 0;
    } else if (++parkedMinutes >= DEMO_PARKED_REPORT_MINUTES) {
      points.push({ latitude, longitude, time, moving });
      parkedMinutes = 0;
    }
  }
  return points;
}

/** mulberry32: a small, fast, seeded random number generator, returning values in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
