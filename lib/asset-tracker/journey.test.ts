import { describe, expect, it } from "vitest";
import { analyseJourney, formatDuration, stopDuration, type Stop } from "./journey";
import { distanceKm, pathLengthKm, type TimedLatLng } from "./location";

const MIN = 60_000;
const HOUR = 60 * MIN;
const T0 = Date.UTC(2026, 10, 13, 8);

/** A point `minutes` after T0, `north` km north of a fixed spot. */
function at(minutes: number, north: number, moving?: boolean): TimedLatLng {
  const point: TimedLatLng = { time: T0 + minutes * MIN, latitude: 40 + north / 111.2, longitude: -85 };
  if (moving !== undefined) point.moving = moving;
  return point;
}

describe("distanceKm / pathLengthKm", () => {
  it("measures great-circle distance", () => {
    // One degree of latitude is about 111.2 km.
    expect(distanceKm({ latitude: 40, longitude: -85 }, { latitude: 41, longitude: -85 })).toBeCloseTo(111.19, 1);
    expect(distanceKm({ latitude: 10, longitude: 20 }, { latitude: 10, longitude: 20 })).toBe(0);
  });

  it("adds up the legs of a path", () => {
    expect(pathLengthKm([at(0, 0), at(1, 1), at(2, 3)])).toBeCloseTo(3, 2);
    expect(pathLengthKm([at(0, 0)])).toBe(0);
    expect(pathLengthKm([])).toBe(0);
  });
});

describe("analyseJourney with motion reports", () => {
  const route = [
    at(0, 0, false), // parked from the start
    at(60, 0, true), // sets off
    at(61, 1, true),
    at(62, 2, false), // stops
    at(180, 2, false), // still there at the end
  ];
  const journey = analyseJourney(route);

  it("alternates stops and trips", () => {
    expect(journey.segments.map((segment) => segment.kind)).toEqual(["stop", "trip", "stop"]);
    expect(journey.stopCount).toBe(2);
  });

  it("times stops from the motion reports exactly", () => {
    const [first, , last] = journey.segments as [Stop, unknown, Stop];
    expect(first).toMatchObject({ number: 1, start: T0, end: T0 + 60 * MIN, exact: true, openStart: true, openEnd: false });
    expect(last).toMatchObject({ number: 2, start: T0 + 62 * MIN, end: T0 + 180 * MIN, openStart: false, openEnd: true });
  });

  it("measures the trip between them", () => {
    const trip = journey.segments[1];
    expect(trip).toMatchObject({ kind: "trip", start: T0 + 60 * MIN, end: T0 + 62 * MIN });
    expect(trip.kind === "trip" && trip.distanceKm).toBeCloseTo(2, 2);
  });

  it("totals moving and stopped time", () => {
    expect(journey.movingMs).toBe(2 * MIN);
    expect(journey.stoppedMs).toBe(60 * MIN + 118 * MIN);
  });

  it("carries the last known motion state over reports without one", () => {
    const mixed = analyseJourney([at(0, 0, false), at(30, 0), at(60, 0, true), at(61, 1)]);
    expect(mixed.segments.map((segment) => segment.kind)).toEqual(["stop", "trip"]);
    expect(mixed.segments[0]).toMatchObject({ first: 0, last: 1, end: T0 + 60 * MIN });
  });

  it("is one trip when it never stops", () => {
    const moving = analyseJourney([at(0, 0, true), at(1, 1, true), at(2, 2, true)]);
    expect(moving.segments).toEqual([expect.objectContaining({ kind: "trip", first: 0, last: 2 })]);
    expect(moving.stopCount).toBe(0);
  });
});

describe("analyseJourney without motion reports (older firmware)", () => {
  it("finds a stop where the tracker stayed put for a while", () => {
    // Drives a minute per km, parks 40 minutes, drives on.
    const route = [at(0, 0), at(1, 1), at(2, 2), at(10, 2.01), at(42, 2.02), at(43, 3), at(44, 4), at(45, 5)];
    const journey = analyseJourney(route);
    expect(journey.segments.map((segment) => segment.kind)).toEqual(["trip", "stop", "trip"]);
    const stop = journey.segments[1] as Stop;
    expect(stop).toMatchObject({ first: 2, last: 4, start: T0 + 2 * MIN, exact: false });
    // It left about one moving interval (1 min) before the next location.
    expect(stop.end).toBe(T0 + 42 * MIN);
  });

  it("doesn't count a short standstill (traffic lights) as a stop", () => {
    const journey = analyseJourney([at(0, 0), at(1, 1), at(2, 1.01), at(3, 2), at(4, 3)]);
    expect(journey.stopCount).toBe(0);
  });

  it("counts a long silence at one place as a stop", () => {
    const journey = analyseJourney([at(0, 0), at(1, 1), at(31, 1), at(32, 2)]);
    expect(journey.stopCount).toBe(1);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [4 * MIN, "4 min"],
    [59.4 * MIN, "59 min"],
    [HOUR, "1 h"],
    [85 * MIN, "1 h 25 min"],
    [24 * HOUR, "1 d"],
    [51 * HOUR, "2 d 3 h"],
  ])("%d ms is %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("stopDuration", () => {
  const stop: Stop = {
    kind: "stop",
    number: 1,
    at: { latitude: 0, longitude: 0 },
    start: 0,
    end: 2 * HOUR + 15 * MIN,
    first: 0,
    last: 0,
    openStart: false,
    openEnd: false,
    exact: true,
  };

  it("hedges where the period cuts the stop off, or the times are worked out", () => {
    expect(stopDuration(stop)).toBe("2 h 15 min");
    expect(stopDuration({ ...stop, openStart: true })).toBe("at least 2 h 15 min");
    expect(stopDuration({ ...stop, openEnd: true })).toBe("2 h 15 min so far");
    expect(stopDuration({ ...stop, exact: false })).toBe("about 2 h 15 min");
  });
});
