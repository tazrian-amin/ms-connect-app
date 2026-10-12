// Chrome tokens reuse the scale dashboard's CSS variables (app/globals.css) so
// they flip with theme mode even though this markup uses plain CSSProperties,
// not MUI's sx/useTheme(). LED/indicator/status colors stay fixed regardless
// of theme since they carry fixed semantic meaning.
export const PumpMonitoringPalette = {
  panelBg: "var(--panel-bg)",
  columnBg: "var(--panel-bg-alt)",
  segmentInactive: "#cbd5e1",
  border: "var(--panel-border)",
  borderMuted: "var(--panel-border-muted)",
  text: "var(--panel-text)",
  textMuted: "var(--panel-text-muted)",
  waterActive: "#3b82f6",
  waterActiveGlow: "rgba(59, 130, 246, 0.45)",
  greenActive: "#10b981",
  greenActiveGlow: "rgba(16, 185, 129, 0.45)",
  redActive: "#ef4444",
  redActiveGlow: "rgba(239, 68, 68, 0.45)",
  /** Low/min end of a range — pairs with redActive for the high/max end. */
  amberActive: "#f59e0b",
  indicatorOff: "#94a3b8",
  waterBadgeText: "#1d4ed8",
  resetButtonBg: "var(--panel-control-bg)",
  resetButtonText: "var(--panel-text)",
  /**
   * What a reset button turns on hover. Neutral at rest so it doesn't shout
   * from a dashboard nobody is touching, and destructive-red under the pointer,
   * where it is about to be pressed — the same red the confirmation's own Reset
   * carries, so the two read as one action.
   */
  resetButtonHoverBg: "var(--panel-danger-bg)",
  resetButtonHoverBorder: "var(--panel-danger-border)",
  resetButtonHoverText: "var(--panel-danger-text)",
  /** Tint behind the "Enable Edits" toggle while edits are unlocked. */
  editUnlockedBg: "rgba(16, 185, 129, 0.14)",
  /** Informational notice pill. Nothing on the dashboard uses one today. */
  noticeBg: "var(--panel-notice-bg)",
  noticeBorder: "var(--panel-notice-border)",
  noticeText: "var(--panel-notice-text)",
  /** Start-count badge on each pump column. */
  startsBadgeBg: "var(--panel-bg)",
  startsBadgeText: "var(--panel-text-muted)",
  /**
   * Motor current column. Violet rather than the water column's blue: the two
   * gauges stand side by side reading different quantities, and colour is what
   * keeps a glance from taking one for the other.
   */
  currentActive: "#8b5cf6",
  currentActiveGlow: "rgba(139, 92, 246, 0.45)",
  currentBadgeText: "#6d28d9",
  thresholdPointer: "#64748b",
  thresholdPointerBorder: "#475569",
  thresholdPointerGrip: "#f1f5f9",
} as const;

/**
 * Depth of the shaft the columns measure, and so the full travel of every
 * level on this dashboard: the water reading, the water column's own band, and
 * each pump column's two trigger levels are all depths in feet over 0–this.
 */
export const WATER_LEVEL_MAX_FEET = 60;

/** Full travel of the motor current column, in amps RMS. */
export const MOTOR_CURRENT_MAX_AMPS = 1000;

/**
 * What one LED — and one press of a threshold — is worth on the current
 * column. A motor's current is read for its trend and its trip points, not to
 * the amp, and a column with 1000 segments would be unreadable besides.
 */
export const MOTOR_CURRENT_STEP_AMPS = 20;

/**
 * What a gauge column measures: the range it spans, what one segment of it is
 * worth, and how it names its readings.
 *
 * The columns share their whole geometry — the LED shell, the threshold
 * sliders, the scale beside them — and differ only in this, which is why it is
 * one value passed down rather than a fork at every level.
 */
export interface GaugeScale {
  /** Top of the range; the bottom is always 0. */
  max: number;
  /** One LED, and the smallest change a threshold can be moved by. */
  step: number;
  /** Unit suffix on the readouts, e.g. "ft". */
  unit: string;
  /** Spoken unit, for the sliders' accessible values, e.g. "feet". */
  unitLong: string;
  /** Units between the scale's longer ticks. */
  midStep: number;
  /** Units between its labelled ticks. */
  labelStep: number;
}

export const WATER_LEVEL_SCALE: GaugeScale = {
  max: WATER_LEVEL_MAX_FEET,
  step: 1,
  unit: "ft",
  unitLong: "feet",
  midStep: 5,
  labelStep: 10,
};

export const MOTOR_CURRENT_SCALE: GaugeScale = {
  max: MOTOR_CURRENT_MAX_AMPS,
  step: MOTOR_CURRENT_STEP_AMPS,
  unit: "A",
  unitLong: "amps",
  midStep: 100,
  labelStep: 200,
};

/**
 * Where each column's sliders rest while the device has yet to report its
 * levels. The pointers stay on the column — the gauge reads as itself rather
 * than as an empty box — but their pills and readouts show "—" and they can't
 * be dragged, so nothing here is ever mistaken for a value from the device.
 */
export const WATER_BAND_PLACEHOLDER = { high: 45, low: 15 } as const;
export const MOTOR_CURRENT_BAND_PLACEHOLDER = { high: 800, low: 200 } as const;
export const PUMP_BAND_PLACEHOLDER = { high: 30, low: 15 } as const;

/**
 * A reading as the readouts print it: at most two decimals, which is what the
 * firmware reports, and none at all when it is whole.
 */
export function formatReading(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** LEDs in a column on this scale — one per step. */
export function gaugeSegmentCount(scale: GaugeScale): number {
  return Math.round(scale.max / scale.step);
}

export const LED_COLUMN_WIDTH = 72;
export const LED_COLUMN_PADDING = 8;
export const LED_SEGMENT_GAP = 2;
/** Inner track width inside the column padding. */
export const LED_SEGMENT_WIDTH = LED_COLUMN_WIDTH - LED_COLUMN_PADDING * 2;

/** One LED segment on the water scale — the height every column is sized from. */
export const LED_SEGMENT_HEIGHT = 6;

/**
 * Vertical span of the LED stack inside the column shell. Fixed for every
 * column whatever it measures: they stand side by side in one grid row, and a
 * column of a different height would break the row they are read across.
 */
export const LED_STACK_HEIGHT =
  WATER_LEVEL_MAX_FEET * LED_SEGMENT_HEIGHT +
  (WATER_LEVEL_MAX_FEET - 1) * LED_SEGMENT_GAP;

/**
 * A segment's height on a given scale — derived, because the stack height is
 * the fixed quantity and the segment count follows the scale. Fewer, coarser
 * steps make taller LEDs, and every column still ends at the same line.
 */
export function gaugeSegmentHeight(scale: GaugeScale): number {
  const count = gaugeSegmentCount(scale);
  return (LED_STACK_HEIGHT - (count - 1) * LED_SEGMENT_GAP) / count;
}

/** Column height fits the full LED stack plus vertical padding. */
export const LED_COLUMN_HEIGHT = LED_STACK_HEIGHT + LED_COLUMN_PADDING * 2;

export const LED_STACK_OFFSET_Y = LED_COLUMN_PADDING;

/**
 * Between a gauge and the scale beside it. The threshold pointers cross it to
 * reach the ticks — see THRESHOLD_POINTER_LEFT — so it is sized for them
 * rather than as free space.
 */
export const LEVEL_SCALE_GAP = 8;
/** Tick lengths: every step, every scale.midStep, and every labelled one. */
export const LEVEL_SCALE_TICK_MINOR = 4;
export const LEVEL_SCALE_TICK_MID = 7;
export const LEVEL_SCALE_TICK_MAJOR = 10;
/** Between the longest tick and the label it carries. */
export const LEVEL_SCALE_LABEL_GAP = 3;
/** One tabular digit at the tick labels' 9px — see LevelScale. */
export const LEVEL_SCALE_DIGIT_WIDTH = 6;

/**
 * Width of the scale drawn beside a gauge — see LevelScale. Ticks run down its
 * left and their labels sit to the right of the long ones, so it has to hold
 * the longest tick plus the widest label the scale prints, which is its own max.
 *
 * Derived per scale rather than fixed at the widest of them: the current
 * column's scale prints "1000" and the water column's prints "60", and sizing
 * both for four digits left every foot scale carrying two digits' worth of
 * white space it had no use for.
 */
export function levelScaleWidth(scale: GaugeScale): number {
  return (
    LEVEL_SCALE_TICK_MAJOR +
    LEVEL_SCALE_LABEL_GAP +
    String(scale.max).length * LEVEL_SCALE_DIGIT_WIDTH
  );
}

/**
 * Gutter to the left of a gauge, holding the vertical title that names what it
 * measures. Sized for that rotated line of text and nothing else.
 */
export const GAUGE_TITLE_WIDTH = 24;

/**
 * Both threshold sliders travel the whole LED stack — 0 = bottom segment, the
 * scale's max = top segment — so their values read as absolute readings.
 */
export const THRESHOLD_TRACK_TOP = LED_STACK_OFFSET_Y;
export const THRESHOLD_TRACK_HEIGHT = LED_STACK_HEIGHT;

export const THRESHOLD_POINTER_HEIGHT = 18;
export const THRESHOLD_POINTER_WIDTH = LED_COLUMN_WIDTH + 10;
/** Arrowhead carrying the pill's reading across to the scale. */
export const THRESHOLD_POINTER_ARROW_WIDTH = 6;
export const THRESHOLD_POINTER_ARROW_HEIGHT = 10;
/**
 * Left edge of the label pill, derived rather than centred: the pill and its
 * arrowhead are placed as one, so that the tip lands exactly on the line the
 * scale's ticks start at. That is what lets a threshold be read off the scale
 * while it is being dragged, instead of only from the readout underneath once
 * it has been dropped.
 *
 * The pill gives up the arrow's width on its right and takes it back on its
 * left, so pill-plus-arrow still sits centred on the column.
 */
export const THRESHOLD_POINTER_LEFT =
  LED_COLUMN_WIDTH +
  LEVEL_SCALE_GAP -
  THRESHOLD_POINTER_ARROW_WIDTH -
  THRESHOLD_POINTER_WIDTH;
/**
 * Exact-threshold marker drawn under the label pill. It runs the width of the
 * column *and* the gap beyond it, up to the ticks — so the depth stays exactly
 * marked against the scale even where the pills have been nudged off it (see
 * resolveThresholdLayout).
 */
export const THRESHOLD_MARKER_HEIGHT = 2;
export const THRESHOLD_MARKER_WIDTH = LED_COLUMN_WIDTH + LEVEL_SCALE_GAP;
/** Kept between the two label pills once the thresholds converge. */
export const THRESHOLD_POINTER_MIN_GAP = 2;

/**
 * How far a column's HIGH threshold is held above its LOW one: one step of
 * whatever it measures. The two used to be free to meet, which left the pump
 * with no dead band at all — it would start and stop at the same reading and
 * chatter around it. One step is the smallest separation a scale can state, so
 * it is the smallest its sliders allow.
 */
export function thresholdMinSeparation(scale: GaugeScale): number {
  return scale.step;
}

/** Range the Minimum Off Time field accepts, in minutes. */
export const PUMP_MIN_OFF_TIME_MIN = 30;
export const PUMP_MIN_OFF_TIME_MAX = 1440;

export const COLUMN_GAP = 20;

/**
 * A track of air between the two reading columns and the row labels that head
 * the six pump columns. They do two different jobs — the pair reports what the
 * station is doing, the six set what it does — and at the ordinary column gap
 * the readings and the labels would run together into one row.
 *
 * Held as a track rather than a wider gap because grid gaps are all or
 * nothing, and it has to beat the space the water column's own title already
 * opens beside the current column: that space is mostly white (a thin rotated
 * line in a 24px gutter), so the eye would otherwise take *it* for the break —
 * the one place in the row where there isn't one. This lands the labels about
 * twice that far off, with COLUMN_GAP either side of it.
 */
export const PUMP_GROUP_GAP = 48;

/**
 * Width of a titled gauge's grid track: the title gutter, the gauge itself,
 * and the scale beside it. Only the two reading columns carry a title — the
 * pump columns are sized by PUMP_COLUMN_WIDTH instead.
 */
export function gaugeColumnWidth(scale: GaugeScale): number {
  return (
    GAUGE_TITLE_WIDTH +
    LEVEL_SCALE_GAP +
    LED_COLUMN_WIDTH +
    LEVEL_SCALE_GAP +
    levelScaleWidth(scale)
  );
}

/** The motor current column's track — the grid's first. */
export const CURRENT_COLUMN_WIDTH = gaugeColumnWidth(MOTOR_CURRENT_SCALE);

/** The water level column's track — the grid's second. */
export const WATER_COLUMN_WIDTH = gaugeColumnWidth(WATER_LEVEL_SCALE);

/**
 * Width of one pump's grid column. Fixed rather than content-sized: the header
 * rows, the gauge body and the counter rows are separate grid rows, and they
 * only read as one column each if every row tracks the same width.
 *
 * Sized by the two widest things standing in it — the gauge with its scale
 * (105), and a runtime figure like "128d 7h 42m" (when runtime is shown) on the counter rows below it
 * — with a little to spare. There is no third claim on the width: the scale
 * used to be counted twice, once for itself and once for a blank gutter
 * mirroring it, and that gutter is gone. See PUMP_COLUMN_SCALE_INSET for what
 * kept the LEDs centred in its place.
 */
export const PUMP_COLUMN_WIDTH = 108;

/**
 * How far a pump column's own furniture sits left of its track's centre line —
 * or rather, the width it gives up on the right to get there.
 *
 * The gauge stands at the left of the track with its scale to the right, so
 * the LEDs are not on the track's centre line. Everything that has to read as
 * belonging to them — the enable switch, the pump number, the status pill,
 * every counter figure below — is centred in the track less this, which puts
 * it on the LEDs' centre line whatever the track's width.
 */
export const PUMP_COLUMN_SCALE_INSET =
  LEVEL_SCALE_GAP + levelScaleWidth(WATER_LEVEL_SCALE);

/**
 * Height of the pump status pill. Fixed so the row keeps its height whichever
 * status each pump is in.
 */
export const STATUS_INDICATOR_HEIGHT = 42;

/** Height of the enable/disable switch row, same reason. */
export const PUMP_TOGGLE_HEIGHT = 30;

/** Height of the pump title row ("#1"–"#6"), same reason. */
export const COLUMN_TITLE_HEIGHT = 24;

/** Dimming applied to a disabled pump column's readouts and gauge. */
export const PUMP_DISABLED_OPACITY = 0.5;
