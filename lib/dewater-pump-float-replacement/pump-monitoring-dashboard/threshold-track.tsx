"use client";

import {
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  formatReading,
  LED_COLUMN_HEIGHT,
  LED_COLUMN_WIDTH,
  PumpMonitoringPalette,
  THRESHOLD_MARKER_HEIGHT,
  THRESHOLD_MARKER_WIDTH,
  THRESHOLD_POINTER_ARROW_HEIGHT,
  THRESHOLD_POINTER_ARROW_WIDTH,
  THRESHOLD_POINTER_HEIGHT,
  THRESHOLD_POINTER_LEFT,
  THRESHOLD_POINTER_WIDTH,
  thresholdMinSeparation,
  WATER_LEVEL_SCALE,
  type GaugeScale,
} from "./constants";
import {
  clampToScale,
  resolveThresholdLayout,
  snapToStep,
  trackOffsetToLevel,
  type ThresholdPointerLayout,
} from "./threshold-track-math";

export type ThresholdPointerLabel = "HIGH" | "LOW";

/**
 * Pill text for the two pointers, separate from the labels the drag logic
 * keys on — a column can name its band whatever its readouts call it.
 */
export interface ThresholdPointerText {
  high: string;
  low: string;
}

const DEFAULT_POINTER_TEXT: ThresholdPointerText = { high: "HIGH", low: "LOW" };

interface ThresholdTrackProps {
  /** Subject of the sliders, e.g. "Pump" — used for the accessible names. */
  name: string;
  /** What the column measures. Defaults to the water level scale. */
  scale?: GaugeScale;
  /** Overrides the HIGH/LOW pill text (and the accessible names with it). */
  pointerText?: ThresholdPointerText;
  /** Over the full column; stays one step above `low`. */
  triggerLevelHigh: number;
  /** Over the full column; stays one step below `high`. */
  triggerLevelLow: number;
  onTriggerLevelHighChange: (value: number) => void;
  onTriggerLevelLowChange: (value: number) => void;
  /** Pointers still mark the band, but can't be dragged. */
  disabled?: boolean;
  /**
   * The device hasn't reported this band: the pointers rest where they are
   * given but read "—", and can't be dragged.
   */
  unreported?: boolean;
}

interface DragState {
  label: ThresholdPointerLabel;
  level: number;
}

/**
 * Whichever pointer is nearer the press wins. A press equidistant from both —
 * which a pair only a foot or two apart makes easy to land — is decided by its
 * direction, so the closer of the two can still be taken deliberately (press
 * above the midpoint for HIGH, below it for LOW).
 */
function pointerUnderPress(
  level: number,
  triggerLevelHigh: number,
  triggerLevelLow: number,
): ThresholdPointerLabel {
  const highDistance = Math.abs(level - triggerLevelHigh);
  const lowDistance = Math.abs(level - triggerLevelLow);
  if (highDistance === lowDistance) {
    return level >= triggerLevelHigh ? "HIGH" : "LOW";
  }
  return highDistance < lowDistance ? "HIGH" : "LOW";
}

function ThresholdPointer({
  name,
  text,
  scale,
  layout,
  value,
  valueMin,
  valueMax,
  disabled,
  unreported,
}: {
  name: string;
  text: string;
  scale: GaugeScale;
  layout: ThresholdPointerLayout;
  value: number;
  valueMin: number;
  valueMax: number;
  disabled: boolean;
  unreported: boolean;
}) {
  return (
    <Box
      role="slider"
      aria-label={`${name} ${text.toLowerCase()} trigger level`}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuenow={value}
      // Every level on the dashboard is a measurement, so the reading is
      // spoken with its unit rather than as a bare number.
      aria-valuetext={
        unreported
          ? "not reported"
          : `${formatReading(value)} ${scale.unitLong}`
      }
      aria-disabled={disabled || undefined}
      sx={{ pointerEvents: "none" }}
    >
      <Box
        sx={{
          position: "absolute",
          top: layout.markerTop,
          left: 0,
          width: THRESHOLD_MARKER_WIDTH,
          height: THRESHOLD_MARKER_HEIGHT,
          borderRadius: "1px",
          bgcolor: PumpMonitoringPalette.thresholdPointerBorder,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: layout.pillTop,
          left: THRESHOLD_POINTER_LEFT,
          width: THRESHOLD_POINTER_WIDTH,
          height: THRESHOLD_POINTER_HEIGHT,
          borderRadius: "5px",
          bgcolor: PumpMonitoringPalette.thresholdPointer,
          border: `2px solid ${PumpMonitoringPalette.thresholdPointerBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          // Label and reading stay on one line whatever the reading is; the
          // pill is fixed-width and a wrap would break its shape.
          whiteSpace: "nowrap",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.2)",
        }}
      >
        <Typography
          sx={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: PumpMonitoringPalette.thresholdPointerGrip,
          }}
        >
          {text}
        </Typography>
        {/* The reading itself, so a drag states where it is as it goes rather
            than only where it landed. Tracks the drag, not the device: this is
            the value that would be sent if the pointer were released here.
            Bracketed off the label, which names what the pill is rather than
            what it currently reads. */}
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: PumpMonitoringPalette.thresholdPointerGrip,
          }}
        >
          ({unreported ? "—" : formatReading(value)})
        </Typography>
      </Box>
      {/* Aimed at the tick line: the pill says the depth, the arrow says where
          on the scale it falls. */}
      <Box
        sx={{
          position: "absolute",
          top:
            layout.pillTop +
            (THRESHOLD_POINTER_HEIGHT - THRESHOLD_POINTER_ARROW_HEIGHT) / 2,
          left: THRESHOLD_POINTER_LEFT + THRESHOLD_POINTER_WIDTH,
          width: 0,
          height: 0,
          borderTop: `${THRESHOLD_POINTER_ARROW_HEIGHT / 2}px solid transparent`,
          borderBottom: `${THRESHOLD_POINTER_ARROW_HEIGHT / 2}px solid transparent`,
          borderLeft: `${THRESHOLD_POINTER_ARROW_WIDTH}px solid ${PumpMonitoringPalette.thresholdPointerBorder}`,
        }}
      />
    </Box>
  );
}

/**
 * A column's HIGH/LOW threshold sliders, overlaid on an LED column by the
 * pump gauge and the water level column alike. Both share one hit area
 * spanning the whole column — each pointer can travel the full height, and
 * the pair is clamped so they may meet but never cross. A press always jumps
 * the nearer pointer to it before tracking movement; the change is only
 * reported on release, so a drag sends a single command.
 */
export function ThresholdTrack({
  name,
  scale = WATER_LEVEL_SCALE,
  pointerText = DEFAULT_POINTER_TEXT,
  triggerLevelHigh,
  triggerLevelLow,
  onTriggerLevelHighChange,
  onTriggerLevelLowChange,
  disabled: disabledProp = false,
  unreported = false,
}: ThresholdTrackProps) {
  const disabled = disabledProp || unreported;
  const [drag, setDrag] = useState<DragState | null>(null);

  // The pair is held a step apart rather than merely uncrossed: two thresholds
  // at the same reading leave no dead band at all, so the pump they control
  // would start and stop at the same reading and chatter around it. HIGH stops
  // a step above LOW on the way down, LOW a step below HIGH on the way up.
  //
  // Snapped as well as clamped: the sibling it is held off may itself be a step
  // out of phase (a band the device reports, or one set before the scale had
  // this step), and a pointer that came to rest between two LEDs would read
  // against no segment at all.
  const clampToSibling = useCallback(
    (label: ThresholdPointerLabel, level: number) => {
      const separation = thresholdMinSeparation(scale);
      return snapToStep(
        scale,
        clampToScale(
          scale,
          label === "HIGH"
            ? Math.max(level, triggerLevelLow + separation)
            : Math.min(level, triggerLevelHigh - separation),
        ),
      );
    },
    [scale, triggerLevelHigh, triggerLevelLow],
  );

  const levelFromPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return trackOffsetToLevel(scale, event.clientY - rect.top);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const level = levelFromPointer(event);
    const label = pointerUnderPress(level, triggerLevelHigh, triggerLevelLow);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ label, level: clampToSibling(label, level) });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({
      label: drag.label,
      level: clampToSibling(drag.label, levelFromPointer(event)),
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const level = clampToSibling(drag.label, levelFromPointer(event));
    setDrag(null);
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (drag.label === "HIGH") {
      if (level !== triggerLevelHigh) onTriggerLevelHighChange(level);
    } else if (level !== triggerLevelLow) {
      onTriggerLevelLowChange(level);
    }
  };

  const handlePointerCancel = () => setDrag(null);

  const highLevel = drag?.label === "HIGH" ? drag.level : triggerLevelHigh;
  const lowLevel = drag?.label === "LOW" ? drag.level : triggerLevelLow;
  const layout = resolveThresholdLayout(scale, highLevel, lowLevel);
  const separation = thresholdMinSeparation(scale);

  return (
    <Box
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      sx={{
        position: "absolute",
        left: 0,
        top: 0,
        width: LED_COLUMN_WIDTH,
        height: LED_COLUMN_HEIGHT,
        zIndex: 2,
        cursor: disabled ? "default" : "ns-resize",
        touchAction: "none",
        ...(disabled ? { pointerEvents: "none" } : {}),
      }}
    >
      {/* LOW first so HIGH stacks above it where the two overlap. */}
      <ThresholdPointer
        name={name}
        text={pointerText.low}
        scale={scale}
        layout={layout.low}
        value={lowLevel}
        valueMin={0}
        valueMax={highLevel - separation}
        disabled={disabled}
        unreported={unreported}
      />
      <ThresholdPointer
        name={name}
        text={pointerText.high}
        scale={scale}
        layout={layout.high}
        value={highLevel}
        valueMin={lowLevel + separation}
        valueMax={scale.max}
        disabled={disabled}
        unreported={unreported}
      />
    </Box>
  );
}
