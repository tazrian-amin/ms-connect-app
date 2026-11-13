"use client";

import { useEffect, useState } from "react";
import type { assetTrackerCommands } from "@/lib/bluetooth/commands/asset-tracker";
import { useDeviceMessages } from "@/lib/bluetooth/hooks";
import type { getMessenger } from "@/lib/bluetooth/messaging";
import { fetchAssetTrackerHistory } from "./cloud";
import type { TimedLatLng } from "./location";
import type { HistorySource } from "./location-history";

/** Enough for hours of driving at a one-minute reporting interval, without growing unbounded. */
const MAX_PATH_POINTS = 1000;
/** How far back to look for where a trip began, when the page opens partway through it. */
const LOOK_BACK_MS = 24 * 3_600_000;

export type LiveTrip = {
  /** Where the tracker last stopped, and when; null until known. */
  stop: TimedLatLng | null;
  /** Its path since it set off from `stop` (starting there, if known), oldest first. */
  path: TimedLatLng[];
};

type TripState = LiveTrip & { moving?: boolean };

const EMPTY: TripState = { stop: null, path: [] };

/**
 * The tracker's current trip, for the live map: where it last stopped and the path it has taken
 * since. Built from the motion reports: one that says it stopped starts afresh from there, and the
 * ones while moving add to the path. If the page opens while it's already on the move, the start of
 * the trip is looked up in the cloud history. Kept in memory only, and cleared when the link ends.
 */
export function useLiveTrip(
  messenger: ReturnType<typeof getMessenger<typeof assetTrackerCommands>>,
  linked: boolean,
  source: HistorySource | null,
): LiveTrip {
  // With whether it was moving at the last report that said, kept together so a burst of reports
  // each sees the one before.
  const [state, setState] = useState<TripState>(EMPTY);

  const [wasLinked, setWasLinked] = useState(linked);
  if (linked !== wasLinked) {
    setWasLinked(linked);
    if (!linked) setState(EMPTY);
  }

  useDeviceMessages(messenger, ({ timestamp, data }) => {
    const { latitude, longitude, is_moving } = data;
    setState((current) => {
      const moving = is_moving ?? current.moving;
      if (latitude === undefined || longitude === undefined) return { ...current, moving };
      const point = { latitude, longitude, time: timestamp };
      // Stopped: this is the new last stop, and the next trip starts from here.
      if (moving === false) return { stop: point, path: [], moving };
      const path = current.path.length ? current.path : current.stop ? [current.stop] : [];
      const last = path.at(-1);
      if (last?.latitude === latitude && last.longitude === longitude) return { ...current, moving };
      return { stop: current.stop, path: [...path.slice(-(MAX_PATH_POINTS - 1)), point], moving };
    });
  });

  // On the move with no stop seen since the page opened: find where the trip began in the history.
  const serialNumber = source?.kind === "cloud" ? source.serialNumber : null;
  const needsStart = state.moving === true && state.stop === null && serialNumber !== null;
  useEffect(() => {
    if (!needsStart || !serialNumber) return;
    const controller = new AbortController();
    const to = Date.now();
    fetchAssetTrackerHistory(serialNumber, to - LOOK_BACK_MS, to, controller.signal).then(
      (history) => {
        const stopIndex = history.findLastIndex((point) => point.moving === false);
        if (stopIndex < 0) return;
        const earlier = history.slice(stopIndex);
        setState((current) => {
          if (current.stop) return current;
          const since = earlier.at(-1)!.time;
          const later = current.path.filter((point) => point.time > since);
          return { ...current, stop: earlier[0], path: [...earlier, ...later].slice(-MAX_PATH_POINTS) };
        });
      },
      // Without the history, the path just starts where the page first heard from it.
      () => {},
    );
    return () => controller.abort();
  }, [needsStart, serialNumber]);

  return state;
}
