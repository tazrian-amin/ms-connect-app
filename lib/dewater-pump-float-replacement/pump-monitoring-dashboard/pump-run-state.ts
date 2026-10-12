import { PumpMonitoringPalette } from "./constants";
import type { PumpRunState } from "./types";

/**
 * What the pump is doing, from the three things the device reports about it:
 * whether it has raised a fault, whether it is in the control loop, and
 * whether it is running. Null — no state at all — until the device has said
 * enough to tell; an enabled pump whose run state is unknown is just "enabled".
 *
 * A fault outranks the enable flag deliberately. A faulted pump is often
 * disabled straight after — by the operator or, in a later firmware, by the
 * device itself — and "Disabled" would then bury the reason it was switched
 * out. The fault is the thing worth showing until it clears.
 */
export function derivePumpRunState(
  enabled: boolean | null,
  isOn: boolean | null,
  faulted: boolean | null,
): PumpRunState | null {
  if (faulted) return "fault";
  if (enabled === null) return null;
  if (!enabled) return "disabled";
  if (isOn === null) return "enabled";
  return isOn ? "run" : "idle";
}

export const PUMP_RUN_STATE_LABELS: Record<PumpRunState, string> = {
  run: "Run",
  idle: "Idle",
  enabled: "Enabled",
  fault: "Fault",
  disabled: "Disabled",
};

/**
 * Colour per state. The word is the whole indicator — there is no dot beside
 * it — so the colour has to carry the same weight the dot used to: green for
 * running and red for a fault, the two that mean something is happening, and
 * quieter greys for the resting states. Idle and enabled keep full contrast and disabled
 * is muted, since the difference between "waiting its turn" and "switched out"
 * is the whole point of the row.
 */
export const PUMP_RUN_STATE_TEXT_COLORS: Record<PumpRunState, string> = {
  run: PumpMonitoringPalette.greenActive,
  idle: PumpMonitoringPalette.text,
  enabled: PumpMonitoringPalette.text,
  fault: PumpMonitoringPalette.redActive,
  disabled: PumpMonitoringPalette.textMuted,
};
