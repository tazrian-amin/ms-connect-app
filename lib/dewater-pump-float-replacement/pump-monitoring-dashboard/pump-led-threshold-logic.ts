import { WATER_LEVEL_SCALE } from "./constants";
import { valueToSegmentIndex } from "./threshold-track-math";

/**
 * A pump column always measures water level, so everything here is on the
 * water scale.
 */
function levelToSegmentIndex(metres: number): number {
  return valueToSegmentIndex(WATER_LEVEL_SCALE, metres);
}

/** Segment index where the dead band starts (bottom of grey zone). */
export function getLowThresholdBoundaryIndex(triggerLevelLow: number) {
  return levelToSegmentIndex(triggerLevelLow);
}

/** First segment index above the dead band (bottom of lit green zone). */
export function getHighThresholdBoundaryIndex(triggerLevelHigh: number) {
  return levelToSegmentIndex(triggerLevelHigh);
}

export type PumpLedSegmentState = "red" | "green" | "off";

/**
 * Colour of a pump LED segment for the current thresholds. Index 0 is the
 * bottom of the column; indices increase upward.
 *
 * Both thresholds roam the whole column, so the colour bands follow them
 * rather than fixed halves: below LOW is red, above HIGH is green, and the
 * dead band between the two is off. That band is never empty — the sliders
 * hold the pair a step apart — so a pump column always shows at least the one
 * unlit segment its hysteresis runs in.
 */
export function getPumpLedSegmentState(
  segmentIndex: number,
  triggerLevelLow: number,
  triggerLevelHigh: number,
): PumpLedSegmentState {
  if (segmentIndex < getLowThresholdBoundaryIndex(triggerLevelLow)) return "red";
  if (segmentIndex >= getHighThresholdBoundaryIndex(triggerLevelHigh)) {
    return "green";
  }
  return "off";
}
