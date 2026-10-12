import type { ReactNode } from "react";
import Box, { type BoxProps } from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import {
  gaugeSegmentHeight,
  LED_COLUMN_HEIGHT,
  LED_COLUMN_WIDTH,
  LED_COLUMN_PADDING,
  LED_SEGMENT_GAP,
  LED_SEGMENT_WIDTH,
  PumpMonitoringPalette,
  type GaugeScale,
} from "./constants";

interface LedColumnShellProps {
  children: ReactNode;
  sx?: BoxProps["sx"];
}

/**
 * Segment bar dimensions for one scale (full width of the inner track). The
 * height comes from the scale because the stack's total height is fixed — a
 * column with fewer, coarser steps gets taller LEDs rather than a shorter
 * column. See gaugeSegmentHeight.
 */
export function ledSegmentSx(scale: GaugeScale) {
  const height = gaugeSegmentHeight(scale);
  return {
    width: LED_SEGMENT_WIDTH,
    height,
    borderRadius: `${height / 2}px`,
  } as const;
}

/** Glow applied to a lit segment; mirrors the RN shadow-based glow. */
export function ledSegmentGlowSx(glowColor?: string): { boxShadow?: string } {
  return glowColor ? { boxShadow: `0 0 6px ${glowColor}` } : {};
}

/**
 * Covers a column whose threshold change is still with the device. Sits over
 * the pointers (which are z-index 2) so the band can't be dragged again before
 * the device has answered the last drag, and reads as the wait rather than as
 * a value — the pointers underneath still show what the device has now.
 */
export function LedColumnPendingOverlay() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: `${LED_COLUMN_WIDTH / 6}px`,
        bgcolor: "rgba(100, 116, 139, 0.25)",
      }}
    >
      <CircularProgress size={22} />
    </Box>
  );
}

/** Fixed-height column with the LED stack vertically centered inside. */
export function LedColumnShell({ children, sx }: LedColumnShellProps) {
  return (
    <Box
      sx={{
        height: LED_COLUMN_HEIGHT,
        width: LED_COLUMN_WIDTH,
        bgcolor: PumpMonitoringPalette.columnBg,
        borderRadius: `${LED_COLUMN_WIDTH / 6}px`,
        border: `1px solid ${PumpMonitoringPalette.borderMuted}`,
        p: `${LED_COLUMN_PADDING}px`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        ...sx,
      }}
    >
      <Box
        sx={{
          width: LED_SEGMENT_WIDTH,
          display: "flex",
          flexDirection: "column-reverse",
          gap: `${LED_SEGMENT_GAP}px`,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
