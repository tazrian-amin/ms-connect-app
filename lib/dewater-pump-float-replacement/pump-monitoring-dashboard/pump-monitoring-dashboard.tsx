"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";

import {
  COLUMN_GAP,
  CURRENT_COLUMN_WIDTH,
  PUMP_COLUMN_WIDTH,
  PUMP_GROUP_GAP,
  PumpMonitoringPalette,
} from "./constants";
import { MinOffTimeSection } from "./min-off-time-section";
import { ModeSection } from "./mode-section";
import {
  ALTERATION_MODE_LABELS,
  alterationModes,
  OPERATION_MODE_LABELS,
  operationModes,
  type AlterationMode,
  type OperationMode,
  type UnavailableOptions,
} from "./modes";
import {
  MotorCurrentColumn,
  MotorCurrentHeading,
} from "./motor-current-column";
import { PumpColumn } from "./pump-column";
import { PumpCounterRows } from "./pump-counter-rows";
import {
  PumpGroupGutter,
  PumpHeaderRows,
  type PumpColumnView,
} from "./pump-header-rows";
import { derivePumpRunState } from "./pump-run-state";
import { ResetCounterDialog } from "./reset-counter-dialog";
import type {
  PumpDashboardState,
  PumpStatus,
  PumpTriggerBand,
  SessionCounter,
} from "./types";
import type { LastResetTimes } from "./use-last-reset";
import { usePendingActions } from "./use-pending-actions";
import { WaterLevelColumn } from "./water-level-column";

/**
 * What a handler may return. Resolve `false` (or throw) when the change did not
 * land — the control then stays where it was. Anything else counts as success.
 */
export type ActionResult = Promise<boolean | void> | boolean | void;

export interface PumpMonitoringDashboardProps {
  /** Everything drawn. The dashboard never edits it — handlers ask the host to. */
  state: PumpDashboardState;
  /**
   * Read-only dashboard: every control is inert, the readouts read as normal.
   * The host owns the lock — see EditsToggle for the switch that opens it.
   */
  locked: boolean;
  /** Operation modes drawn but not selectable, with the reason for each. */
  unavailableOperationModes?: UnavailableOptions<OperationMode>;
  /** Alteration modes drawn but not selectable, with the reason for each. */
  unavailableAlterationModes?: UnavailableOptions<AlterationMode>;
  /** Session counters that can't be reset, with the reason for each. */
  unresettableCounters?: UnavailableOptions<SessionCounter>;
  /** When each counter was last cleared — see useLastReset. */
  lastReset?: LastResetTimes;

  onPumpEnabledChange?: (pumpId: number, enabled: boolean) => ActionResult;
  onColumnTriggerLevelChange?: (
    columnNumber: number,
    band: PumpTriggerBand,
    level: number,
  ) => ActionResult;
  onWaterBandChange?: (band: PumpTriggerBand, level: number) => ActionResult;
  onCurrentBandChange?: (band: PumpTriggerBand, level: number) => ActionResult;
  onOperationModeChange?: (mode: OperationMode) => ActionResult;
  onAlterationModeChange?: (mode: AlterationMode) => ActionResult;
  onMinOffTimeChange?: (minutes: number) => ActionResult;
  /** Clears that counter on every pump. Called after the user confirms. */
  onResetCounter?: (counter: SessionCounter) => ActionResult;
}

/** Shown for a counter the host hasn't reported yet. */
const UNAVAILABLE_LABEL = "—";

const NO_RESETS: LastResetTimes = { runtime: null, starts: null };

/** Spinner key for one control on one pump — see usePendingActions. */
function pumpKey(pumpId: number, control: string): string {
  return `pump-${pumpId}-${control}`;
}

/** Same, for a control that belongs to the column rather than to a pump. */
function columnKey(columnNumber: number, control: string): string {
  return `column-${columnNumber}-${control}`;
}

/** Whether this pump's runtime figures should count up between updates. */
function countsLive(pump: PumpStatus): boolean {
  return (
    pump.enabled === true &&
    pump.isOn === true &&
    pump.runtimeReportedAtMs !== undefined
  );
}

// A reported counter, counted up live for the ON time since it was measured.
// A disabled pump is held still even if its OFF hasn't arrived yet, so the
// counter never runs past the "Disabled" the column already shows.
function liveSeconds(
  pump: PumpStatus,
  reported: number | null,
  nowMs: number,
): number | null {
  if (reported === null) return null;
  if (!countsLive(pump)) return reported;
  return reported + Math.max(0, (nowMs - pump.runtimeReportedAtMs!) / 1000);
}

/** Days rolled into a year, ignoring leap years — see `formatRuntime`. */
const DAYS_PER_YEAR = 365;

// Minute-resolution elapsed-time label, e.g. "0d 0h 5m", "2d 4h 23m". All three
// units are always spelled out, empty or not, so a counter keeps the same shape
// as it grows and the figures line up down a column. Sub-minute runtime reads
// as "0d 0h 0m" — seconds are deliberately not shown.
//
// Past a year the label rolls the days up and drops the minutes instead of
// adding a fourth unit — "2y 1d 4h" — because the minute on a figure of that
// size is noise the column width can't afford.
function formatRuntime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days >= DAYS_PER_YEAR) {
    const years = Math.floor(days / DAYS_PER_YEAR);
    return `${years}y ${days % DAYS_PER_YEAR}d ${hours}h`;
  }
  return `${days}d ${hours}h ${minutes}m`;
}

function formatSeconds(seconds: number | null): string {
  return seconds === null ? UNAVAILABLE_LABEL : formatRuntime(seconds);
}

function formatCount(count: number | null): string {
  return count === null ? UNAVAILABLE_LABEL : String(count);
}

/**
 * Pure UI. The dashboard holds no copy of any setting: every value comes from
 * `state`, and each control only calls its handler and shows a spinner until
 * the returned promise settles. The host decides what a change means — send a
 * command, update local state, anything — and passes the new `state` back down.
 */
export function PumpMonitoringDashboard({
  state,
  locked,
  unavailableOperationModes,
  unavailableAlterationModes,
  unresettableCounters,
  lastReset = NO_RESETS,
  onPumpEnabledChange,
  onColumnTriggerLevelChange,
  onWaterBandChange,
  onCurrentBandChange,
  onOperationModeChange,
  onAlterationModeChange,
  onMinOffTimeChange,
  onResetCounter,
}: PumpMonitoringDashboardProps) {
  const { isPending, track } = usePendingActions();

  // Re-render once a second while any pump is counting up live. Idle otherwise.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const anyCountingLive = state.pumps.some(countsLive);
  useEffect(() => {
    if (!anyCountingLive) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyCountingLive]);

  const pumpById = useMemo(
    () => new Map(state.pumps.map((pump) => [pump.id, pump])),
    [state.pumps],
  );

  // Reset is destructive and has no undo, so a Reset button only opens the
  // confirmation. The two session counters are separate figures, so a button
  // clears its own on every pump and leaves the other alone.
  const [pendingReset, setPendingReset] = useState<SessionCounter | null>(null);
  const [resetInFlight, setResetInFlight] = useState<SessionCounter | null>(
    null,
  );
  const requestResetRuntime = useCallback(() => setPendingReset("runtime"), []);
  const requestResetStarts = useCallback(() => setPendingReset("starts"), []);
  const cancelReset = useCallback(() => setPendingReset(null), []);

  const confirmReset = useCallback(async () => {
    if (pendingReset === null) return;
    setResetInFlight(pendingReset);
    try {
      await track(`reset-${pendingReset}`, () =>
        onResetCounter?.(pendingReset),
      );
    } finally {
      setResetInFlight(null);
      setPendingReset(null);
    }
  }, [onResetCounter, pendingReset, track]);

  const setPumpEnabled = useCallback(
    (pumpId: number, enabled: boolean) =>
      void track(pumpKey(pumpId, "enabled"), () =>
        onPumpEnabledChange?.(pumpId, enabled),
      ),
    [onPumpEnabledChange, track],
  );

  const setColumnLevel = useCallback(
    (columnNumber: number, band: PumpTriggerBand, level: number) =>
      void track(columnKey(columnNumber, "threshold"), () =>
        onColumnTriggerLevelChange?.(columnNumber, band, level),
      ),
    [onColumnTriggerLevelChange, track],
  );
  const setTriggerLevelHigh = useCallback(
    (columnNumber: number, level: number) =>
      setColumnLevel(columnNumber, "high", level),
    [setColumnLevel],
  );
  const setTriggerLevelLow = useCallback(
    (columnNumber: number, level: number) =>
      setColumnLevel(columnNumber, "low", level),
    [setColumnLevel],
  );

  const setWaterBand = useCallback(
    (band: PumpTriggerBand, level: number) =>
      void track("water-band", () => onWaterBandChange?.(band, level)),
    [onWaterBandChange, track],
  );
  const setCurrentBand = useCallback(
    (band: PumpTriggerBand, level: number) =>
      void track("current-band", () => onCurrentBandChange?.(band, level)),
    [onCurrentBandChange, track],
  );

  const setOperationMode = useCallback(
    (mode: OperationMode) =>
      void track("operation-mode", () => onOperationModeChange?.(mode)),
    [onOperationModeChange, track],
  );
  const setAlterationMode = useCallback(
    (mode: AlterationMode) =>
      void track("alteration-mode", () => onAlterationModeChange?.(mode)),
    [onAlterationModeChange, track],
  );

  const applyMinOffTime = useCallback(
    (minutes: number) =>
      track("min-off-time", () => onMinOffTimeChange?.(minutes)),
    [onMinOffTimeChange, track],
  );

  // A column with no pump bound has no counters at all — the T.B.D. case.
  const counterLabelsFor = (pump: PumpStatus | null) => {
    if (pump === null) {
      return {
        totalRuntime: UNAVAILABLE_LABEL,
        currentRuntime: UNAVAILABLE_LABEL,
        totalStarts: UNAVAILABLE_LABEL,
        currentStarts: UNAVAILABLE_LABEL,
      };
    }
    return {
      totalRuntime: formatSeconds(
        liveSeconds(pump, pump.totalRuntimeSeconds, nowMs),
      ),
      currentRuntime: formatSeconds(
        liveSeconds(pump, pump.currentRuntimeSeconds, nowMs),
      ),
      totalStarts: formatCount(pump.totalStarts),
      currentStarts: formatCount(pump.currentStarts),
    };
  };

  // What each column is, resolved once: which pump is put to it, and what that
  // pump is doing. The header rows and the gauge under them are separate grid
  // rows, so they would otherwise each work it out.
  const columnViews: PumpColumnView[] = state.columns.map((column) => {
    const pump =
      column.pumpId === null ? null : (pumpById.get(column.pumpId) ?? null);
    if (pump === null) return { column, pump, runState: null };
    return {
      column,
      pump,
      runState: derivePumpRunState(pump.enabled, pump.isOn, pump.faulted),
    };
  });

  return (
    <Box>
      <MinOffTimeSection
        minutes={state.minOffTimeMinutes}
        onApply={applyMinOffTime}
        locked={locked}
      />

      <ModeSection
        title="Operation Mode"
        description="Each mode keeps its own high and low level for every pump. Selecting one puts its levels back in service; levels set below are stored against the mode selected here."
        options={operationModes}
        labels={OPERATION_MODE_LABELS}
        value={state.operationMode}
        onChange={setOperationMode}
        unavailable={unavailableOperationModes}
        locked={locked}
        pending={isPending("operation-mode")}
      />

      <ModeSection
        title="Alteration Mode"
        description="Evens out wear by sharing demand across the enabled pumps. With no alteration each column is always its own pump; on either setting a column becomes a role and the device rotates which pump fills it, leading with whichever has the fewest starts or the least run time."
        options={alterationModes}
        labels={ALTERATION_MODE_LABELS}
        value={state.alterationMode}
        onChange={setAlterationMode}
        unavailable={unavailableAlterationModes}
        locked={locked}
        pending={isPending("alteration-mode")}
      />

      <Box
        sx={{
          bgcolor: PumpMonitoringPalette.panelBg,
          border: `1px solid ${PumpMonitoringPalette.border}`,
          borderRadius: "20px",
          p: 2,
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
        }}
      >
        {/* One grid, so the three header rows and the gauges under them share
            a single set of columns — a pump's switch, number and status sit
            over its own gauge because they are literally the same grid column.
            That is also why the whole thing scrolls as one.

            The grid is laid out at its own width and left-aligned in the
            panel; every track is sized to what stands in it (see
            PUMP_COLUMN_WIDTH), which keeps the scroll off all but the
            narrowest screens. */}
        <Box sx={{ overflowX: "auto" }}>
          <Box
            sx={{
              display: "grid",
              // Motor current track, then the row labels / water level track,
              // a gap track, then one track per pump column.
              gridTemplateColumns: `${CURRENT_COLUMN_WIDTH}px auto ${PUMP_GROUP_GAP}px repeat(${columnViews.length}, ${PUMP_COLUMN_WIDTH}px)`,
              columnGap: `${COLUMN_GAP}px`,
              rowGap: 1.5,
              alignItems: "center",
              pb: 0.5,
              width: "max-content",
            }}
          >
            <PumpHeaderRows
              views={columnViews}
              leading={<MotorCurrentHeading />}
              onEnabledChange={setPumpEnabled}
              locked={locked}
              isEnablePending={(pumpId) =>
                isPending(pumpKey(pumpId, "enabled"))
              }
            />

            {/* The gauge row. Top-aligned rather than centered: the columns
                run to different heights, and it is their tops that have to
                line up. */}
            <Box sx={{ alignSelf: "start", justifySelf: "center", pt: 1 }}>
              <MotorCurrentColumn
                motorCurrent={state.motorCurrent}
                band={state.currentBand}
                onTriggerLevelHighChange={(level) =>
                  setCurrentBand("high", level)
                }
                onTriggerLevelLowChange={(level) =>
                  setCurrentBand("low", level)
                }
                // A host that can't send this band leaves the handler out.
                locked={locked || !onCurrentBandChange}
                pending={isPending("current-band")}
              />
            </Box>

            <Box sx={{ alignSelf: "start", justifySelf: "center", pt: 1 }}>
              <WaterLevelColumn
                waterLevel={state.waterLevel}
                band={state.waterBand}
                onTriggerLevelHighChange={(level) =>
                  setWaterBand("high", level)
                }
                onTriggerLevelLowChange={(level) => setWaterBand("low", level)}
                locked={locked || !onWaterBandChange}
                pending={isPending("water-band")}
              />
            </Box>

            <PumpGroupGutter />

            {columnViews.map(({ column, pump }) => (
              <Box
                key={column.number}
                sx={{ alignSelf: "start", width: "100%", pt: 1 }}
              >
                <PumpColumn
                  column={column}
                  pump={pump}
                  onTriggerLevelHighChange={setTriggerLevelHigh}
                  onTriggerLevelLowChange={setTriggerLevelLow}
                  locked={locked}
                  thresholdPending={isPending(
                    columnKey(column.number, "threshold"),
                  )}
                />
              </Box>
            ))}

            {/* The counter rows follow the gauges as their own grid rows, so
                the reset under each row can stretch across every pump. */}
            <PumpCounterRows
              views={columnViews}
              unresettable={unresettableCounters ?? {}}
              labelsFor={counterLabelsFor}
              onResetRuntime={requestResetRuntime}
              onResetStarts={requestResetStarts}
              locked={locked}
              resetInFlight={resetInFlight}
              lastReset={lastReset}
            />
          </Box>
        </Box>
      </Box>

      <ResetCounterDialog
        open={pendingReset !== null}
        counter={pendingReset ?? "runtime"}
        pumpCount={state.pumps.length}
        onConfirm={confirmReset}
        onCancel={cancelReset}
        pending={resetInFlight !== null}
      />
    </Box>
  );
}
