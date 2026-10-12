import {
  LED_COLUMN_HEIGHT,
  THRESHOLD_MARKER_HEIGHT,
  THRESHOLD_POINTER_HEIGHT,
  THRESHOLD_POINTER_MIN_GAP,
  THRESHOLD_TRACK_HEIGHT,
  THRESHOLD_TRACK_TOP,
  type GaugeScale,
} from "./constants";

/** Holds a reading inside the range its column can show. */
export function clampToScale(scale: GaugeScale, value: number): number {
  return Math.min(scale.max, Math.max(0, value));
}

/** Map a reading (stack bottom→top) to its offset from the column top. */
export function levelToTrackOffset(scale: GaugeScale, level: number): number {
  return (
    THRESHOLD_TRACK_TOP +
    (1 - clampToScale(scale, level) / scale.max) * THRESHOLD_TRACK_HEIGHT
  );
}

/**
 * Inverse of `levelToTrackOffset`, snapped to whole steps — a threshold can
 * only be set to a value the column can state, which is one LED per step.
 */
export function trackOffsetToLevel(scale: GaugeScale, offset: number): number {
  const travelled = (offset - THRESHOLD_TRACK_TOP) / THRESHOLD_TRACK_HEIGHT;
  return snapToStep(scale, scale.max * (1 - travelled));
}

/** Nearest value the column can state — see `trackOffsetToLevel`. */
export function snapToStep(scale: GaugeScale, value: number): number {
  return (
    Math.round(clampToScale(scale, value) / scale.step) * scale.step
  );
}

/**
 * Segment a reading falls in, counting from 0 at the bottom of the column.
 * One segment is one step, so this is the reading in steps.
 */
export function valueToSegmentIndex(
  scale: GaugeScale,
  value: number,
): number {
  return Math.round(clampToScale(scale, value) / scale.step);
}

export interface ThresholdPointerLayout {
  /** Offset of the exact-threshold marker from the column top. */
  markerTop: number;
  /** Offset of the label pill; nudged off the marker when the two converge. */
  pillTop: number;
}

/**
 * Places both pointers. HIGH and LOW are free to meet, at which point their
 * pills would sit on top of each other — so once they are closer than a pill
 * height, the pills stack around the midpoint (HIGH above, LOW below) and
 * shift as a pair to stay inside the column. Markers always stay exact.
 */
export function resolveThresholdLayout(
  scale: GaugeScale,
  triggerLevelHigh: number,
  triggerLevelLow: number,
): { high: ThresholdPointerLayout; low: ThresholdPointerLayout } {
  const highMarker = levelToTrackOffset(scale, triggerLevelHigh);
  const lowMarker = levelToTrackOffset(scale, triggerLevelLow);

  let highPill = highMarker - THRESHOLD_POINTER_HEIGHT / 2;
  let lowPill = lowMarker - THRESHOLD_POINTER_HEIGHT / 2;

  if (lowPill - highPill < THRESHOLD_POINTER_HEIGHT + THRESHOLD_POINTER_MIN_GAP) {
    const midpoint = (highMarker + lowMarker) / 2;
    highPill =
      midpoint - THRESHOLD_POINTER_HEIGHT - THRESHOLD_POINTER_MIN_GAP / 2;
    lowPill = midpoint + THRESHOLD_POINTER_MIN_GAP / 2;

    const overflow =
      Math.max(0, -highPill) -
      Math.max(0, lowPill + THRESHOLD_POINTER_HEIGHT - LED_COLUMN_HEIGHT);
    highPill += overflow;
    lowPill += overflow;
  }

  return {
    high: { markerTop: highMarker - THRESHOLD_MARKER_HEIGHT / 2, pillTop: highPill },
    low: { markerTop: lowMarker - THRESHOLD_MARKER_HEIGHT / 2, pillTop: lowPill },
  };
}
