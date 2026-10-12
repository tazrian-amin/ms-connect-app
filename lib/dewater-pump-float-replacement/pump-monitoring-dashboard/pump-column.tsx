"use client";

import Box from "@mui/material/Box";

import { PumpLevelGauge } from "./pump-level-gauge";
import type { ColumnStatus, PumpStatus } from "./types";

interface PumpColumnProps {
  /** The column itself — its position and its two trigger levels. */
  column: ColumnStatus;
  /**
   * The pump the device has bound to this column, or null while none is.
   * Null is the "T.B.D." case: the column exists and its levels can be set,
   * but no pump has been put to it. Its enable flag and state
   * are the header rows' business, and its counters the counter rows'.
   */
  pump: PumpStatus | null;
  /** Keyed by column, not pump: the levels belong to the role. */
  onTriggerLevelHighChange: (columnNumber: number, level: number) => void;
  onTriggerLevelLowChange: (columnNumber: number, level: number) => void;
  /**
   * Read-only column: every control is inert, but the readouts and gauge keep
   * reading as normal.
   */
  locked?: boolean;
  /** A threshold change is with the device: the gauge holds still until it answers. */
  thresholdPending?: boolean;
}

/**
 * The body of one pump's column: its trigger-level gauge. What the pump *is* —
 * its number, its enable switch and its state — is stated once per row above
 * the gauges, in PumpHeaderRows; what it has done is stated once per row below
 * them, in PumpCounterRows.
 */
export function PumpColumn({
  column,
  pump,
  onTriggerLevelHighChange,
  onTriggerLevelLowChange,
  locked = false,
  thresholdPending = false,
}: PumpColumnProps) {
  // Switched out by its enable flag — the pump exists, the operator has just
  // taken it out of the control loop, so the whole column reads as inactive.
  const pumpDisabled = pump?.enabled === false;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      }}
    >
      <PumpLevelGauge
        band={column.band}
        onTriggerLevelHighChange={(level) =>
          onTriggerLevelHighChange(column.number, level)
        }
        onTriggerLevelLowChange={(level) =>
          onTriggerLevelLowChange(column.number, level)
        }
        // A disabled pump greys its gauge out with the rest of its column.
        // An *unbound* one does not: the levels are the column's own, and
        // which pump answers them is the device's to decide, so a role no pump
        // has been put to yet still reads and edits as normal.
        disabled={pumpDisabled}
        locked={locked}
        pending={thresholdPending}
      />
    </Box>
  );
}
