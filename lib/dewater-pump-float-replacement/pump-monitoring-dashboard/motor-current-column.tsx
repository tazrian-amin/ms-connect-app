"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  LedColumnPendingOverlay,
  LedColumnShell,
  ledSegmentGlowSx,
  ledSegmentSx,
} from "./led-column-shell";
import { GaugeFrame } from "./level-scale";
import { ThresholdTrack, type ThresholdPointerText } from "./threshold-track";
import { valueToSegmentIndex } from "./threshold-track-math";
import {
  formatReading,
  gaugeSegmentCount,
  MOTOR_CURRENT_SCALE,
  PumpMonitoringPalette,
  MOTOR_CURRENT_BAND_PLACEHOLDER,
} from "./constants";
import type { Band } from "./types";

/**
 * Named Max/Min, as the water column's band is — both are alarm bands the
 * device holds rather than the HIGH/LOW the pumps are controlled on. At or
 * above Max the device faults every pump for over-current; the firmware
 * stores Min for an under-current check it doesn't run yet.
 */
const CURRENT_POINTER_TEXT: ThresholdPointerText = { high: "MAX", low: "MIN" };

/**
 * What the current column is *for*, over the column itself. It stands in the
 * space the pump rows use for their switches, numbers and statuses — none of
 * which this track has — so the heading takes all three rows as one block
 * rather than picking one of them to sit in.
 *
 * The column below names the quantity ("Motor Current (Arms)"); this names the
 * job it does, which is the thing a reader coming to the dashboard needs first.
 */
export function MotorCurrentHeading() {
  return (
    <Typography
      sx={{
        color: PumpMonitoringPalette.text,
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1.3,
        textAlign: "center",
      }}
    >
      Motor Current Fault Detection
    </Typography>
  );
}

interface MotorCurrentColumnProps {
  /** Live motor current in amps RMS; null while the device doesn't report one. */
  motorCurrent: number | null;
  /**
   * Amps over the full column, MAX held a step above MIN. Null until the
   * device reports them — the pointers then rest at a placeholder, read "—" and
   * can't be dragged.
   */
  band: Band | null;
  onTriggerLevelHighChange: (level: number) => void;
  onTriggerLevelLowChange: (level: number) => void;
  /** Pointers still mark the band, but can't be dragged. */
  locked?: boolean;
  /**
   * A band change is with the device. The pointers stay where the device has
   * them until it answers, under a waiting overlay.
   */
  pending?: boolean;
}

/**
 * Live motor current, built exactly as the water level column is — the same
 * LED shell, the same MAX/MIN sliders, the same scale beside it — and
 * differing only in what it counts: amps in steps of 20, not feet.
 *
 * Sits at the far left of the dashboard grid, in a track of its own before the
 * row labels, so it stands beside the water column it is read against rather
 * than in among the pumps.
 */
export function MotorCurrentColumn({
  motorCurrent,
  band,
  onTriggerLevelHighChange,
  onTriggerLevelLowChange,
  locked = false,
  pending = false,
}: MotorCurrentColumnProps) {
  const litSegments =
    motorCurrent === null
      ? 0
      : valueToSegmentIndex(MOTOR_CURRENT_SCALE, motorCurrent);
  const segments = useMemo(
    () =>
      Array.from(
        { length: gaugeSegmentCount(MOTOR_CURRENT_SCALE) },
        (_, i) => i,
      ),
    [],
  );
  const segmentSx = ledSegmentSx(MOTOR_CURRENT_SCALE);
  const shown = band ?? MOTOR_CURRENT_BAND_PLACEHOLDER;

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <GaugeFrame
        scale={MOTOR_CURRENT_SCALE}
        /* Reads bottom-to-top up the gauge, in a gutter of its own — the same
           arrangement the water column's title uses, so the two columns read
           as a pair. */
        title={
          <Typography
            sx={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              color: PumpMonitoringPalette.text,
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            Motor Current (Arms)
          </Typography>
        }
      >
        <LedColumnShell>
          {segments.map((index) => {
            const active = index < litSegments;
            return (
              <Box
                key={index}
                sx={{
                  ...segmentSx,
                  bgcolor: active
                    ? PumpMonitoringPalette.currentActive
                    : PumpMonitoringPalette.segmentInactive,
                  ...(active
                    ? ledSegmentGlowSx(PumpMonitoringPalette.currentActiveGlow)
                    : {}),
                }}
              />
            );
          })}
        </LedColumnShell>

        <ThresholdTrack
          name="Motor current"
          scale={MOTOR_CURRENT_SCALE}
          pointerText={CURRENT_POINTER_TEXT}
          triggerLevelHigh={shown.high}
          triggerLevelLow={shown.low}
          onTriggerLevelHighChange={onTriggerLevelHighChange}
          onTriggerLevelLowChange={onTriggerLevelLowChange}
          disabled={locked || pending}
          unreported={band === null}
        />

        {pending && <LedColumnPendingOverlay />}
      </GaugeFrame>

      <Typography
        sx={{
          mt: 0.75,
          fontSize: 11,
          color: PumpMonitoringPalette.textMuted,
          fontWeight: 500,
        }}
      >
        Max{" "}
        {band ? `${formatReading(band.high)} ${MOTOR_CURRENT_SCALE.unit}` : "—"}
      </Typography>
      <Typography
        sx={{
          fontSize: 11,
          color: PumpMonitoringPalette.textMuted,
          fontWeight: 500,
        }}
      >
        Min{" "}
        {band ? `${formatReading(band.low)} ${MOTOR_CURRENT_SCALE.unit}` : "—"}
      </Typography>

      <Box
        sx={{
          mt: 2,
          bgcolor: PumpMonitoringPalette.columnBg,
          border: `1px solid ${PumpMonitoringPalette.borderMuted}`,
          borderRadius: "12px",
          px: 2,
          py: 1,
        }}
      >
        <Typography
          sx={{
            color: PumpMonitoringPalette.currentBadgeText,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {motorCurrent === null
            ? "—"
            : `${formatReading(motorCurrent)} ${MOTOR_CURRENT_SCALE.unit}`}
        </Typography>
      </Box>
    </Box>
  );
}
