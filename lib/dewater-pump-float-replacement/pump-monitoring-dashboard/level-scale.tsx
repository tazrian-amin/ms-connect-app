import { useMemo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  GAUGE_TITLE_WIDTH,
  gaugeSegmentCount,
  LED_COLUMN_HEIGHT,
  LED_COLUMN_WIDTH,
  LEVEL_SCALE_GAP,
  LEVEL_SCALE_LABEL_GAP,
  LEVEL_SCALE_TICK_MAJOR,
  LEVEL_SCALE_TICK_MID,
  LEVEL_SCALE_TICK_MINOR,
  levelScaleWidth,
  PumpMonitoringPalette,
  type GaugeScale,
} from "./constants";
import { levelToTrackOffset } from "./threshold-track-math";

interface ScaleTick {
  value: number;
  /** Offset from the column top, matching where a threshold at this value sits. */
  top: number;
  length: number;
  labelled: boolean;
}

/**
 * Placed through `levelToTrackOffset`, the same mapping the threshold pointers
 * use — which is what makes a pointer read against the scale beside it. The
 * offsets are rounded so a 1px rule lands on a device pixel instead of being
 * smeared across two.
 */
function buildScaleTicks(scale: GaugeScale): ScaleTick[] {
  return Array.from(
    { length: gaugeSegmentCount(scale) + 1 },
    (_, index): ScaleTick => {
      const value = index * scale.step;
      const labelled = value % scale.labelStep === 0;
      return {
        value,
        top: Math.round(levelToTrackOffset(scale, value)),
        length: labelled
          ? LEVEL_SCALE_TICK_MAJOR
          : value % scale.midStep === 0
            ? LEVEL_SCALE_TICK_MID
            : LEVEL_SCALE_TICK_MINOR,
        labelled,
      };
    },
  );
}

/**
 * The scale beside a gauge: one tick per step — one per LED — with the longer
 * and labelled ones set by the scale itself. It states what the LEDs are
 * counting, so a reading or a threshold can be read off the column without
 * counting segments.
 *
 * Decorative: the values it marks are already carried by the sliders' own
 * accessible values and by the readouts under each column.
 */
export function LevelScale({ scale }: { scale: GaugeScale }) {
  const ticks = useMemo(() => buildScaleTicks(scale), [scale]);

  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        width: levelScaleWidth(scale),
        height: LED_COLUMN_HEIGHT,
        flexShrink: 0,
      }}
    >
      {ticks.map((tick) => (
        <Box key={tick.value}>
          <Box
            sx={{
              position: "absolute",
              top: tick.top,
              left: 0,
              width: tick.length,
              height: "1px",
              bgcolor: tick.labelled
                ? PumpMonitoringPalette.text
                : PumpMonitoringPalette.textMuted,
              opacity: tick.labelled ? 0.55 : 0.35,
            }}
          />
          {tick.labelled && (
            <Typography
              sx={{
                position: "absolute",
                // Reads against its own tick, so it is centred on the depth it
                // names rather than hanging below it.
                top: tick.top,
                left: LEVEL_SCALE_TICK_MAJOR + LEVEL_SCALE_LABEL_GAP,
                transform: "translateY(-50%)",
                fontSize: 9,
                fontWeight: 600,
                lineHeight: 1,
                color: PumpMonitoringPalette.textMuted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {tick.value}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * A gauge with its scale down the right-hand side, and — where the column has
 * one to state — its title up the left.
 *
 * The title gutter is opt-in and only the two reading columns take it: the
 * motor current column and the water level column each name what they measure,
 * up the side of the gauge rather than from a line above it. The six pump
 * columns have nothing to put there, and are no longer given the blank gutter
 * that used to mirror the scale on their left. It was there to hold the LEDs
 * on their grid column's centre line, and it cost a scale's width per pump to
 * do it — most of a column's worth of white space across the six. The columns
 * now line up on the LEDs directly instead; see PUMP_COLUMN_SCALE_INSET.
 *
 * `children` are drawn in the gauge box, which is the positioning context for
 * the LED shell, the threshold pointers and the pending overlay alike.
 */
export function GaugeFrame({
  children,
  title,
  scale,
}: {
  children: ReactNode;
  /** Vertical title naming what the gauge measures, set in its own gutter. */
  title?: ReactNode;
  /** What the scale beside the gauge counts in; omitted, none is drawn. */
  scale?: GaugeScale;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: `${LEVEL_SCALE_GAP}px`,
      }}
    >
      {title && (
        <Box
          sx={{
            width: GAUGE_TITLE_WIDTH,
            height: LED_COLUMN_HEIGHT,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {title}
        </Box>
      )}
      <Box
        sx={{
          position: "relative",
          width: LED_COLUMN_WIDTH,
          height: LED_COLUMN_HEIGHT,
          flexShrink: 0,
        }}
      >
        {children}
      </Box>
      {scale && <LevelScale scale={scale} />}
    </Box>
  );
}
