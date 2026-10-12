import type { AlterationMode, OperationMode } from "./modes";

/**
 * A pump — the physical unit. It owns its enable flag and its counters, and
 * keeps them whichever column it is drawn in. Thresholds are *not* here: they
 * belong to the column. See ColumnStatus.
 *
 * Every field is null until the device has reported it, and the dashboard
 * shows "—" for it rather than guessing.
 */
export type PumpStatus = {
  id: number;
  /**
   * Whether the pump takes part in the water-level control loop. A disabled
   * pump's column is inert in the UI.
   */
  enabled: boolean | null;
  /** Whether the pump is currently running. The firmware doesn't report this yet. */
  isOn: boolean | null;
  /** Whether a fault has been raised against this pump. */
  faulted: boolean | null;
  /** Lifetime runtime in seconds. */
  totalRuntimeSeconds: number | null;
  /** Runtime since the last reset, in seconds. */
  currentRuntimeSeconds: number | null;
  /**
   * Epoch ms the two runtime figures were measured at. When given and the pump
   * is on, the dashboard counts them up live from this moment, so they don't
   * sit still between updates. Omit to show them exactly as given.
   */
  runtimeReportedAtMs?: number;
  /** Starts since installation. Never reset. */
  totalStarts: number | null;
  /** Starts since the operator's last reset. */
  currentStarts: number | null;
};

/**
 * What a pump is doing, as the status row reports it. Only one of these can be
 * true at a time, so the row shows exactly one:
 *
 * - `run` — in the control loop and currently on.
 * - `idle` — in the control loop, currently off.
 * - `enabled` — in the control loop, with no word from the device on whether it
 *   is running. What the row shows until the firmware reports run state.
 * - `fault` — a fault has been raised against it.
 * - `disabled` — held out of the control loop by its enable flag.
 *
 * A pump the device hasn't reported on yet has no state at all, which is why
 * this is carried as `PumpRunState | null` throughout.
 */
export type PumpRunState = "run" | "idle" | "enabled" | "fault" | "disabled";

/**
 * A column — a position on the dashboard, 1–N left to right, and the thing the
 * high/low sliders belong to.
 *
 * With alteration off a column simply is its pump. With it on the column is a
 * *role* ("starts first", "starts next"), bound to whichever pump the device
 * puts to it. `pumpId` is null for a role no pump has been put to yet, which
 * the dashboard shows as T.B.D.
 */
export type ColumnStatus = {
  /** 1-based position. */
  number: number;
  /** Trigger levels, in feet; null until the device reports them. */
  band: Band | null;
  /** Pump currently bound to this column, or null while none is. */
  pumpId: number | null;
};

/** A high/low pair, in the gauge's own units (feet or amps). */
export type Band = { high: number; low: number };

/**
 * Everything the dashboard draws. It holds no copy of any of it: the host app
 * maps its own device data into this shape and passes it down on every change.
 * Anything null has not been reported by the device yet.
 */
export type PumpDashboardState = {
  /** Current water level in feet, 0–60 (see WATER_LEVEL_MAX_FEET). */
  waterLevel: number | null;
  /** Water column's band, in feet. */
  waterBand: Band | null;
  /** Motor current in amps RMS, 0–1000 (see MOTOR_CURRENT_MAX_AMPS). */
  motorCurrent: number | null;
  /** Motor current column's band, in amps. */
  currentBand: Band | null;
  pumps: PumpStatus[];
  columns: ColumnStatus[];
  operationMode: OperationMode | null;
  alterationMode: AlterationMode | null;
  /** Minutes a pump must stay off before it can restart. */
  minOffTimeMinutes: number | null;
};

export type PumpTriggerBand = "high" | "low";

/**
 * One of the two counters a pump keeps "since the operator's last reset". They
 * are separate figures with a reset each — clearing the runtime leaves the
 * start count alone, and the other way round.
 */
export type SessionCounter = "runtime" | "starts";
