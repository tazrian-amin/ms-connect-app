"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

import {
  COLUMN_TITLE_HEIGHT,
  PUMP_COLUMN_SCALE_INSET,
  PUMP_TOGGLE_HEIGHT,
  PumpMonitoringPalette,
  STATUS_INDICATOR_HEIGHT,
} from "./constants";
import {
  PUMP_RUN_STATE_LABELS,
  PUMP_RUN_STATE_TEXT_COLORS,
} from "./pump-run-state";
import type { ColumnStatus, PumpRunState, PumpStatus } from "./types";

/** One column's worth of what the three header rows need to say about it. */
export interface PumpColumnView {
  column: ColumnStatus;
  /** Null for a column no pump is bound to — the T.B.D. case. */
  pump: PumpStatus | null;
  /** Null alongside a null pump, or until the device reports on the pump. */
  runState: PumpRunState | null;
}

interface PumpHeaderRowsProps {
  views: PumpColumnView[];
  /**
   * Head the two reading tracks — the grid's first two columns, where the motor
   * current and water level columns stand. Each is given all three header rows
   * as one cell: those tracks have no switch, number or status to line up
   * with, so splitting a heading across them would only put it on rows that
   * mean nothing to it.
   */
  readingHeadings: readonly [current: ReactNode, water: ReactNode];
  onEnabledChange: (pumpId: number, enabled: boolean) => void;
  /** Read-only dashboard: the switches are inert, the rest reads as normal. */
  locked: boolean;
  /** Whether that pump's enable command is still out with the device. */
  isEnablePending: (pumpId: number) => boolean;
}

/** Shown wherever a figure belongs to a pump and no pump is bound yet. */
const UNBOUND_LABEL = "—";

/**
 * Empty cell holding open the grid's first two tracks, where the motor current
 * and water level columns stand. Every counter row emits one, because a row
 * that skipped it would shunt its whole line two columns to the left. The
 * header rows are covered instead by the headings below, which span all three
 * of them.
 */
export function ReadingTracksGutter() {
  return <Box sx={{ gridColumn: "span 2" }} />;
}

/**
 * Empty cell holding open the gap track that sets the row labels and pumps
 * apart from the two reading columns — see PUMP_GROUP_GAP. Emitted by every
 * row for the same reason as the gutter above: the track exists whether or not
 * a row has anything to put in it, and a row that skipped it would shunt its
 * labels and pumps a column to the left.
 */
export function PumpGroupGutter() {
  return <Box />;
}

/**
 * Rule down the middle of the gap track, setting the pump side of the grid
 * apart from the two reading columns. Absolutely positioned in that track, so
 * it takes no cell of its own and runs the grid's full height, over every row
 * gap in between. Needs the grid to be `position: relative`.
 */
export function PumpGroupDivider() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        gridColumn: "3 / 4",
        gridRow: "auto / auto",
        top: 0,
        bottom: 0,
        left: "50%",
        width: "1px",
        bgcolor: PumpMonitoringPalette.border,
      }}
    />
  );
}

/**
 * A reading track's heading, spanning the three header rows as a single cell.
 *
 * Both are placed first, so the grid's own auto-placement does the rest: with
 * these cells holding rows 1-3 of the first two columns, every following row's
 * cells simply skip them and start at the gap track, exactly as they would
 * past separate gutters.
 *
 * Sits at the foot of its cell, so it stands just over the gauge it heads
 * rather than floating midway up the three rows.
 */
function ReadingTrackHeading({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        gridRow: "span 3",
        alignSelf: "stretch",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        px: 0.5,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The row's name, in the grid's label column — between the reading columns and
 * the pumps, so it reads as the start of the pump rows it names. Centered on
 * that column, the way every pump cell is centered on its own, so the three
 * read as one stack.
 */
function RowLabel({ children, height }: { children: ReactNode; height: number }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height,
      }}
    >
      <Typography
        sx={{
          color: PumpMonitoringPalette.text,
          fontSize: 15,
          fontWeight: 700,
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

/**
 * One cell of a header row, centered over its pump's gauge below — over the
 * LEDs, that is, not over the grid column, which carries the scale beside them
 * as well. See PUMP_COLUMN_SCALE_INSET.
 */
function HeaderCell({ children, height }: { children: ReactNode; height: number }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pr: `${PUMP_COLUMN_SCALE_INSET}px`,
        height,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Whether the pump takes part in the control loop. The row's label says what
 * the switches are, so each one carries no word of its own — its position is
 * the state, and it keeps an accessible name naming the pump it belongs to.
 *
 * The switch tracks the device, not the press: while the command is out it
 * holds its position and shows a spinner beside it, and only the device's
 * answer moves it.
 */
function EnableSwitch({
  pump,
  columnNumber,
  locked,
  pending,
  onEnabledChange,
}: {
  pump: PumpStatus | null;
  columnNumber: number;
  locked: boolean;
  pending: boolean;
  onEnabledChange: (pumpId: number, enabled: boolean) => void;
}) {
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
      <Switch
        size="small"
        checked={pump?.enabled ?? false}
        disabled={locked || pending || pump === null || pump.enabled === null}
        onChange={(event) => {
          if (pump) onEnabledChange(pump.id, event.target.checked);
        }}
        slotProps={{
          input: {
            "aria-label": pump
              ? `Enable pump ${pump.id}`
              : `Column ${columnNumber} has no pump assigned`,
          },
        }}
      />
      {/* Reserved either way, so the switch doesn't shift as commands come
          and go. */}
      <Box
        sx={{
          width: 12,
          display: "flex",
          alignItems: "center",
          color: PumpMonitoringPalette.textMuted,
        }}
      >
        {pending && <CircularProgress size={11} color="inherit" />}
      </Box>
    </Stack>
  );
}

/** Which pump is answering this column's levels, or T.B.D. while none is. */
function PumpTitle({ pump }: { pump: PumpStatus | null }) {
  return (
    <Typography
      sx={{
        color:
          pump === null || pump.enabled === false
            ? PumpMonitoringPalette.textMuted
            : PumpMonitoringPalette.text,
        fontSize: 16,
        fontWeight: 600,
        lineHeight: `${COLUMN_TITLE_HEIGHT}px`,
      }}
    >
      {pump ? `#${pump.id}` : "T.B.D."}
    </Typography>
  );
}

/**
 * Single pill carrying what the pump is doing, as a word — see PumpRunState for
 * the four it can be. The word is the whole indicator, so its colour is what
 * separates them at a glance. A column with no state — no pump bound, or none
 * reported yet — shows the same dash its counters do.
 *
 * Fills the width its cell leaves it, which is the gauge's own — the pill is
 * the widest thing in the header stack, and squaring it to the LEDs is what
 * makes the six read as one row of chips over one row of columns.
 */
function StatusIndicator({ runState }: { runState: PumpRunState | null }) {
  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: STATUS_INDICATOR_HEIGHT,
        bgcolor: PumpMonitoringPalette.columnBg,
        border: `1px solid ${PumpMonitoringPalette.borderMuted}`,
        borderRadius: "12px",
        // The pill is now the gauge's width rather than the whole column's,
        // and "Disabled" is the longest word it has to hold — so the padding
        // is the little that is left over after the word.
        px: 0.75,
      }}
    >
      <Typography
        sx={{
          color:
            runState === null
              ? PumpMonitoringPalette.textMuted
              : PUMP_RUN_STATE_TEXT_COLORS[runState],
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {runState === null ? UNBOUND_LABEL : PUMP_RUN_STATE_LABELS[runState]}
      </Typography>
    </Box>
  );
}

/**
 * The three rows heading the dashboard grid: each pump's enable switch, its
 * number, and what it is doing. Rendered as bare grid cells — a fragment, not
 * a wrapper — so they share the parent grid's columns with the gauges
 * underneath and every cell stays over its own pump.
 */
export function PumpHeaderRows({
  views,
  readingHeadings,
  onEnabledChange,
  locked,
  isEnablePending,
}: PumpHeaderRowsProps) {
  return (
    <>
      <ReadingTrackHeading>{readingHeadings[0]}</ReadingTrackHeading>
      <ReadingTrackHeading>{readingHeadings[1]}</ReadingTrackHeading>
      <PumpGroupGutter />
      <RowLabel height={PUMP_TOGGLE_HEIGHT}>Enable/Disable</RowLabel>
      {views.map(({ column, pump }) => (
        <HeaderCell key={column.number} height={PUMP_TOGGLE_HEIGHT}>
          <EnableSwitch
            pump={pump}
            columnNumber={column.number}
            locked={locked}
            pending={pump !== null && isEnablePending(pump.id)}
            onEnabledChange={onEnabledChange}
          />
        </HeaderCell>
      ))}

      <PumpGroupGutter />
      <RowLabel height={COLUMN_TITLE_HEIGHT}>Pumps</RowLabel>
      {views.map(({ column, pump }) => (
        <HeaderCell key={column.number} height={COLUMN_TITLE_HEIGHT}>
          <PumpTitle pump={pump} />
        </HeaderCell>
      ))}

      <PumpGroupGutter />
      <RowLabel height={STATUS_INDICATOR_HEIGHT}>Status</RowLabel>
      {views.map(({ column, runState }) => (
        <HeaderCell key={column.number} height={STATUS_INDICATOR_HEIGHT}>
          <StatusIndicator runState={runState} />
        </HeaderCell>
      ))}
    </>
  );
}
