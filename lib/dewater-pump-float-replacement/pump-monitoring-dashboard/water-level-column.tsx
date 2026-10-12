"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  LedColumnPendingOverlay,
  LedColumnShell,
  ledSegmentSx,
  ledSegmentGlowSx,
} from "./led-column-shell";
import { GaugeFrame } from "./level-scale";
import { ThresholdTrack, type ThresholdPointerText } from "./threshold-track";
import { valueToSegmentIndex } from "./threshold-track-math";
import {
  formatReading,
  gaugeSegmentCount,
  PumpMonitoringPalette,
  WATER_LEVEL_SCALE,
  WATER_BAND_PLACEHOLDER,
} from "./constants";
import type { Band } from "./types";

/**
 * The water column names its band Max/Min, to keep it apart from the pumps'
 * HIGH/LOW: at or above Max every enabled pump runs, and at or below Min every
 * pump stops with a fault.
 */
const WATER_POINTER_TEXT: ThresholdPointerText = { high: "MAX", low: "MIN" };

/**
 * What the water column is *for*, over the column itself — the counterpart of
 * MotorCurrentHeading, taking the three header rows as one block beside it.
 */
export function WaterLevelHeading() {
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
      Current Water Level
    </Typography>
  );
}

interface WaterLevelColumnProps {
  /** Live water level in feet; null until the device reports one. */
  waterLevel: number | null;
  /**
   * Feet over the full column, MAX held a step above MIN. Null until the
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
 * Live water level, with its own MAX/MIN threshold sliders overlaid. These
 * are independent of the per-pump triggers: the LEDs keep showing the raw
 * level, and the pointers only mark this column's own band.
 *
 * Sits in the dashboard grid's second column, beside the motor current column,
 * under its own heading — and names its quantity up the side of its gauge.
 */
export function WaterLevelColumn({
  waterLevel,
  band,
  onTriggerLevelHighChange,
  onTriggerLevelLowChange,
  locked = false,
  pending = false,
}: WaterLevelColumnProps) {
  const litSegments =
    waterLevel === null
      ? 0
      : valueToSegmentIndex(WATER_LEVEL_SCALE, waterLevel);
  const segments = useMemo(
    () =>
      Array.from({ length: gaugeSegmentCount(WATER_LEVEL_SCALE) }, (_, i) => i),
    [],
  );
  const segmentSx = ledSegmentSx(WATER_LEVEL_SCALE);
  const shown = band ?? WATER_BAND_PLACEHOLDER;

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <GaugeFrame
        scale={WATER_LEVEL_SCALE}
        /* Reads bottom-to-top up the gauge, the way the level itself climbs,
           in a gutter of its own against the LEDs it names. Centered on the
           gauge alone, so it stays put as the readouts underneath change
           height. */
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
            Water Level ({WATER_LEVEL_SCALE.unit})
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
                    ? PumpMonitoringPalette.waterActive
                    : PumpMonitoringPalette.segmentInactive,
                  ...(active
                    ? ledSegmentGlowSx(PumpMonitoringPalette.waterActiveGlow)
                    : {}),
                }}
              />
            );
          })}
        </LedColumnShell>

        <ThresholdTrack
          name="Water level"
          pointerText={WATER_POINTER_TEXT}
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
        {band ? `${formatReading(band.high)} ${WATER_LEVEL_SCALE.unit}` : "—"}
      </Typography>
      <Typography
        sx={{
          fontSize: 11,
          color: PumpMonitoringPalette.textMuted,
          fontWeight: 500,
        }}
      >
        Min{" "}
        {band ? `${formatReading(band.low)} ${WATER_LEVEL_SCALE.unit}` : "—"}
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
            color: PumpMonitoringPalette.waterBadgeText,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {waterLevel === null
            ? "—"
            : `${formatReading(waterLevel)} ${WATER_LEVEL_SCALE.unit}`}
        </Typography>
      </Box>
    </Box>
  );
}
