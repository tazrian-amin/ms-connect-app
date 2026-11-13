import { distanceKm, pathLengthKm, type LatLng, type TimedLatLng } from "./location";

/*
 * Splits a route into stops and the trips between them.
 *
 * The tracker's accelerometer tells it when it starts and stops moving, and it reports straight
 * away when that changes, with `is_moving`. So a stop runs from the report that says it stopped to
 * the next one that says it's moving, to the second.
 *
 * Reports without `is_moving` (e.g. from older firmware) are worked out from the locations and
 * their times instead: a stop is a run of locations within STOP_RADIUS_KM of each other, or a
 * location followed by a long silence, as the tracker reports every minute or so while moving but
 * only every half hour or so while parked. Departure is then estimated, as nothing marks it.
 */

/** How far apart locations can be and still count as one place: GPS drift, a car park. */
const STOP_RADIUS_KM = 0.1;
/** Without motion reports: the shortest standstill counted as a stop, so traffic lights aren't. */
const MIN_STOP_MS = 5 * 60_000;
/** Used for the moving interval when the route has too few moving locations to tell. */
const DEFAULT_MOVING_INTERVAL_MS = 60_000;

export type Stop = {
  kind: "stop";
  /** Its place in the period's stops, from 1, as shown on its marker. */
  number: number;
  /** Where it stood: the middle of the locations recorded there. */
  at: LatLng;
  /** When it stopped and set off again, in epoch ms. */
  start: number;
  end: number;
  /** Indexes of the first and last route locations recorded at the stop. */
  first: number;
  last: number;
  /** It was already there when the period began, so it may have arrived earlier. */
  openStart: boolean;
  /** It was still there at the last location, so it may have stayed longer. */
  openEnd: boolean;
  /** Whether the times come from the tracker's motion reports, rather than being worked out. */
  exact: boolean;
};

export type Trip = {
  kind: "trip";
  start: number;
  end: number;
  /** Indexes of the route locations the trip runs between, including the stops at either end. */
  first: number;
  last: number;
  distanceKm: number;
};

export type Segment = Stop | Trip;

export type Journey = {
  /** Stops and trips in order; never two trips in a row. */
  segments: Segment[];
  movingMs: number;
  stoppedMs: number;
  stopCount: number;
};

type FoundStop = Omit<Stop, "kind" | "number" | "at" | "openStart" | "openEnd">;

export function analyseJourney(route: TimedLatLng[]): Journey {
  const found = route.some((point) => point.moving !== undefined) ? stopsFromMotion(route) : inferStops(route);
  const stops = found.map<Stop>((stop, index) => ({
    ...stop,
    kind: "stop",
    number: index + 1,
    at: middleOf(route.slice(stop.first, stop.last + 1)),
    openStart: stop.first === 0,
    openEnd: stop.last === route.length - 1,
  }));

  const segments: Segment[] = [];
  const addTrip = (first: number, last: number, start: number, end: number) => {
    if (last <= first) return;
    segments.push({
      kind: "trip",
      start,
      end,
      first,
      last,
      distanceKm: pathLengthKm(route.slice(first, last + 1)),
    });
  };

  let previous: Stop | null = null;
  for (const stop of stops) {
    addTrip(previous?.last ?? 0, stop.first, previous?.end ?? route[0].time, stop.start);
    segments.push(stop);
    previous = stop;
  }
  if (route.length) addTrip(previous?.last ?? 0, route.length - 1, previous?.end ?? route[0].time, route.at(-1)!.time);

  let movingMs = 0;
  let stoppedMs = 0;
  for (const segment of segments) {
    if (segment.kind === "trip") movingMs += segment.end - segment.start;
    else stoppedMs += segment.end - segment.start;
  }
  return { segments, movingMs, stoppedMs, stopCount: stops.length };
}

/**
 * Stops from the tracker's motion reports: from each report that says it stopped to the next one
 * that says it's moving. A report without the flag keeps the state of the one before it.
 */
function stopsFromMotion(route: TimedLatLng[]): FoundStop[] {
  const stops: FoundStop[] = [];
  let moving = route.find((point) => point.moving !== undefined)?.moving ?? true;
  let first = -1;
  route.forEach((point, index) => {
    moving = point.moving ?? moving;
    if (!moving && first < 0) first = index;
    if (moving && first >= 0) {
      stops.push({
        start: route[first].time,
        end: point.time,
        first,
        last: index - 1,
        exact: true,
      });
      first = -1;
    }
  });
  if (first >= 0)
    stops.push({
      start: route[first].time,
      end: route.at(-1)!.time,
      first,
      last: route.length - 1,
      exact: true,
    });
  return stops;
}

/** Stops worked out from where and when the locations were recorded, for reports without motion. */
function inferStops(route: TimedLatLng[]): FoundStop[] {
  const movingInterval = estimateMovingInterval(route);
  const stops: FoundStop[] = [];
  for (let i = 0; i < route.length;) {
    // Grow a cluster from i while the next location is close to the cluster's middle.
    let j = i;
    let middle: LatLng = route[i];
    while (j + 1 < route.length && distanceKm(middle, route[j + 1]) <= STOP_RADIUS_KM) {
      j++;
      middle = middleOf(route.slice(i, j + 1));
    }
    // It left some time before the next location: about one moving interval, as that's how soon
    // the tracker reports once it's on the move. Never before the last location at the stop.
    const next = route[j + 1];
    const start = route[i].time;
    const end = next ? Math.max(route[j].time, next.time - movingInterval) : route[j].time;
    if (end - start >= MIN_STOP_MS) {
      stops.push({ start, end, first: i, last: j, exact: false });
      i = j + 1;
    } else {
      i++;
    }
  }
  return stops;
}

function middleOf(points: LatLng[]): LatLng {
  let latitude = 0;
  let longitude = 0;
  for (const point of points) {
    latitude += point.latitude;
    longitude += point.longitude;
  }
  return {
    latitude: latitude / points.length,
    longitude: longitude / points.length,
  };
}

/** The typical time between reports while moving: the median gap between locations far apart. */
function estimateMovingInterval(route: TimedLatLng[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < route.length; i++) {
    if (distanceKm(route[i - 1], route[i]) > STOP_RADIUS_KM) gaps.push(route[i].time - route[i - 1].time);
  }
  if (gaps.length < 3) return DEFAULT_MOVING_INTERVAL_MS;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** A length of time as "2 d 3 h", "1 h 25 min" or "4 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** A stretch of time as "13 Nov 2026, 09:12 – 11:27", or a single time if it's a moment. */
export function formatPeriod(start: number, end: number): string {
  return end > start ? timeFormat.formatRange(start, end) : timeFormat.format(start);
}

/**
 * How long a stop lasted, e.g. "2 h 15 min". Hedged where the period cuts it off: "at least" if it
 * was already there at the start, "so far" if it's still there at the end; and "about" if it was
 * worked out from the locations rather than the tracker's motion reports.
 */
export function stopDuration(stop: Stop): string {
  const duration = formatDuration(stop.end - stop.start);
  if (stop.openStart) return `at least ${duration}`;
  if (stop.openEnd) return `${duration} so far`;
  return stop.exact ? duration : `about ${duration}`;
}
