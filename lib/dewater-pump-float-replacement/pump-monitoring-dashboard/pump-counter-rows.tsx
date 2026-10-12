"use client";

import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import {
  PUMP_COLUMN_SCALE_INSET,
  PUMP_DISABLED_OPACITY,
  PumpMonitoringPalette,
} from "./constants";
import {
  GaugeTrackGutter,
  PumpGroupGutter,
  type PumpColumnView,
} from "./pump-header-rows";
import type { UnavailableOptions } from "./modes";
import type { PumpStatus, SessionCounter } from "./types";
import { formatResetTime, type LastResetTimes } from "./use-last-reset";

/** The four preformatted figures one column's counter rows show. */
export interface PumpCounterLabels {
  /** Lifetime runtime since installation, e.g. "2d 4h 23m" — or "2y 1d 4h" once
   * it passes a year, where the minute stops being worth its width. Not
   * resettable. */
  totalRuntime: string;
  /** Runtime since the last reset, same format. */
  currentRuntime: string;
  /** Lifetime start count, e.g. "12". Not resettable. */
  totalStarts: string;
  /** Start count since the last reset, same as the runtime pair. */
  currentStarts: string;
}

interface PumpCounterRowsProps {
  views: PumpColumnView[];
  /** Counters whose reset can't be sent, with the reason shown on the button. */
  unresettable: UnavailableOptions<SessionCounter>;
  labelsFor: (pump: PumpStatus | null) => PumpCounterLabels;
  /** Clears the session runtime of every pump — see the buttons below. */
  onResetRuntime: () => void;
  /** Clears the session start count of every pump, and nothing else. */
  onResetStarts: () => void;
  /** Read-only dashboard: both buttons are inert, the figures read as normal. */
  locked: boolean;
  /** Which counter's reset is currently out with the device, if either. */
  resetInFlight: SessionCounter | null;
  /** When each counter was last cleared from this browser — see useLastReset. */
  lastReset: LastResetTimes;
}

/**
 * Which of a measure's two figures a row carries. The lifetime figure is the
 * background one — it only ever grows, and nothing on the dashboard acts on it
 * — so the session figure is the one given the weight, being both the shorter
 * story and the one the button underneath clears.
 */
type CounterVariant = "total" | "session";

/**
 * Name of one counter row, in the grid's label column — the same column the
 * three header rows label themselves in, and carrying the same weight, so the
 * whole label column reads as one stack from the switches down to the starts.
 */
function CounterRowLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        color: PumpMonitoringPalette.text,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: 0.2,
        lineHeight: 1.4,
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * One pump's figure for one counter row. Bare — no card, no border — because
 * the row's label already says what it is and the column it sits in already
 * says whose it is; a box around each would only repeat the grid.
 *
 * Tabular figures so the digits hold their columns as the counters tick, rather
 * than shuffling sideways every time a 1 becomes a 2. Centred on the gauge
 * above rather than on the grid column, which carries that gauge's scale as
 * well — see PUMP_COLUMN_SCALE_INSET. A long figure overruns that inset into
 * the scale's empty width, which is free: nothing else stands in it on a
 * counter row.
 */
function CounterValue({
  value,
  variant,
  dimmed,
}: {
  value: string;
  variant: CounterVariant;
  dimmed: boolean;
}) {
  const session = variant === "session";
  return (
    <Typography
      sx={{
        color: session
          ? PumpMonitoringPalette.text
          : PumpMonitoringPalette.textMuted,
        fontSize: session ? 16 : 15,
        fontWeight: session ? 700 : 600,
        letterSpacing: 0.3,
        lineHeight: 1.4,
        textAlign: "center",
        pr: `${PUMP_COLUMN_SCALE_INSET}px`,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        ...(dimmed ? { opacity: PUMP_DISABLED_OPACITY } : {}),
      }}
    >
      {value}
    </Typography>
  );
}

/**
 * One labelled row of figures: the measure's name, then every pump's value for
 * it. Bare grid cells, so each figure lands in its own pump's column.
 */
function CounterValueRow({
  label,
  views,
  labelsFor,
  field,
  variant,
}: {
  label: string;
  views: PumpColumnView[];
  labelsFor: (pump: PumpStatus | null) => PumpCounterLabels;
  field: keyof PumpCounterLabels;
  variant: CounterVariant;
}) {
  return (
    <>
      <GaugeTrackGutter />
      <CounterRowLabel>{label}</CounterRowLabel>
      <PumpGroupGutter />
      {views.map(({ column, pump }) => (
        <CounterValue
          key={column.number}
          value={labelsFor(pump)[field]}
          variant={variant}
          dimmed={pump === null || pump.enabled === false}
        />
      ))}
    </>
  );
}

/**
 * Hairline across the whole grid, separating one measure's block from what
 * comes before it. The counters are four rows of plain figures; without these
 * the runtime pair and the starts pair would read as one eight-row list.
 */
function GroupDivider() {
  return (
    <Box
      sx={{
        gridColumn: "1 / -1",
        height: "1px",
        bgcolor: PumpMonitoringPalette.borderMuted,
      }}
    />
  );
}

/**
 * Where the counters above stand from: the moment they were last cleared, so
 * "0d 0h 22m" is read as 22 minutes *since then* rather than as a figure with
 * no start. Kept by the browser rather than by the device — hence the note,
 * which is the difference between a date the operator can act on and one they
 * would wrongly take for the station's own record.
 */
function LastResetNote({ at }: { at: number | null }) {
  return (
    <Typography
      title="Reset times are remembered by this phone, not by the controller — a reset done from another phone won't appear here."
      sx={{
        mb: 0.75,
        color: PumpMonitoringPalette.textMuted,
        fontSize: 11,
        lineHeight: 1.4,
      }}
    >
      {at === null ? "No reset recorded" : `Last reset ${formatResetTime(at)}`}
    </Typography>
  );
}

/**
 * Clears one session counter across every pump at once. It spans the whole row
 * of figures it sits under because that is its reach: the two counters are
 * separate figures with a device command each, so this button clears its own
 * on all six pumps and leaves the other running on all six.
 *
 * A pump the operator has disabled is reset with the rest — the counters are
 * the pump's record of work done, not part of the control loop, so being out
 * of the loop is no reason to be left behind at a stale figure.
 */
function ResetAllButton({
  counter,
  span,
  disabled,
  unavailableReason,
  loading,
  lastResetAt,
  onClick,
}: {
  counter: SessionCounter;
  /** Pump columns to stretch over — the whole row of figures, never the label. */
  span: number;
  disabled: boolean;
  /** Why this reset can't be sent at all; the button is disabled and says so. */
  unavailableReason?: string;
  loading: boolean;
  lastResetAt: number | null;
  onClick: () => void;
}) {
  return (
    <Box sx={{ gridColumn: `span ${span}` }}>
      <LastResetNote at={lastResetAt} />
      {/* A disabled button takes no pointer events, so the tooltip is set on a
          wrapper. */}
      <Tooltip title={unavailableReason ?? ""}>
        <Box>
          <Button
            fullWidth
            disabled={disabled || unavailableReason !== undefined}
            loading={loading}
            onClick={onClick}
            sx={{
              py: 1,
              borderRadius: "10px",
              bgcolor: PumpMonitoringPalette.resetButtonBg,
              border: `1px solid ${PumpMonitoringPalette.borderMuted}`,
              color: PumpMonitoringPalette.resetButtonText,
              fontSize: 14,
              fontWeight: 600,
              textTransform: "none",
              transition: (theme) =>
                theme.transitions.create(
                  ["background-color", "border-color", "color"],
                  { duration: theme.transitions.duration.shortest },
                ),
              // Disabled buttons take no pointer events, so this can't fire on a
              // locked dashboard — hovering one says nothing is about to happen.
              "&:hover": {
                bgcolor: PumpMonitoringPalette.resetButtonHoverBg,
                borderColor: PumpMonitoringPalette.resetButtonHoverBorder,
                color: PumpMonitoringPalette.resetButtonHoverText,
              },
            }}
          >
            Reset Session {counter === "runtime" ? "Runtime" : "Starts"}
          </Button>
        </Box>
      </Tooltip>
    </Box>
  );
}

/**
 * Empty cells holding the grid's motor current column, label column and group
 * gap open on the button rows — the reset button starts at the first pump.
 */
function ButtonRowGutters() {
  return (
    <>
      <GaugeTrackGutter />
      <Box />
      <PumpGroupGutter />
    </>
  );
}

/**
 * The counter half of the dashboard grid: each figure is a labelled row across
 * the pumps, the way the switches, numbers and statuses above it are, with the
 * button that clears all six session figures under the pair it belongs to.
 *
 * Named once on the left rather than on every card, because the alternative is
 * the same four words printed under six gauges twice over — repetition the grid
 * itself already carries. Rendered as bare grid cells — a fragment, not a
 * wrapper — so every figure stays under its own pump's gauge, and so a reset
 * button can stretch across the row it belongs to.
 */
const COUNTERS: readonly SessionCounter[] = ["runtime", "starts"];

export function PumpCounterRows({
  views,
  unresettable,
  labelsFor,
  onResetRuntime,
  onResetStarts,
  locked,
  resetInFlight,
  lastReset,
}: PumpCounterRowsProps) {
  // One reset at a time: they go to the same device over the same link, and
  // each fans out over all six pumps.
  const buttonsDisabled = locked || resetInFlight !== null;

  return COUNTERS.map((counter) => {
    const isRuntime = counter === "runtime";
    return (
      <Fragment key={counter}>
        <GroupDivider />
        <CounterValueRow
          label={isRuntime ? "Total Runtime" : "Total Starts"}
          views={views}
          labelsFor={labelsFor}
          field={isRuntime ? "totalRuntime" : "totalStarts"}
          variant="total"
        />
        <CounterValueRow
          label={isRuntime ? "Session Runtime" : "Session Starts"}
          views={views}
          labelsFor={labelsFor}
          field={isRuntime ? "currentRuntime" : "currentStarts"}
          variant="session"
        />

        <ButtonRowGutters />
        <ResetAllButton
          counter={counter}
          span={views.length}
          disabled={buttonsDisabled}
          unavailableReason={unresettable[counter]}
          loading={resetInFlight === counter}
          lastResetAt={lastReset[counter]}
          onClick={isRuntime ? onResetRuntime : onResetStarts}
        />
      </Fragment>
    );
  });
}
