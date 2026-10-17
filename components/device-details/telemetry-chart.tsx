"use client";

import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import { LineChart } from "@mui/x-charts/LineChart";
import type { HistoryPoint } from "@/lib/bluetooth/history";

/** A fixed level drawn across a chart, e.g. an alarm threshold. */
export type TelemetryThreshold = {
  /** Names the line, e.g. "Max 45 ft" — at its right end, or in the legend (see `thresholdLabels`). */
  label: string;
  value: number;
  color: string;
};

type TelemetryLineChartProps = {
  /** Name of the plotted quantity, shown in the legend. */
  label: string;
  /** Unit of the plotted values, shown on the y axis. */
  unit?: string;
  /** Line colour of the plotted series. */
  color?: string;
  /** Readings to plot, oldest first, e.g. from `useFieldHistory`. Empty until there are any. */
  points?: HistoryPoint[];
  /** Fixes the top of the y axis, e.g. the sensor's full range. */
  max?: number;
  /** Drawn as dashed lines across the chart. */
  thresholds?: TelemetryThreshold[];
  /** Where the thresholds are named: in the legend beside the series, or along each line. */
  thresholdLabels?: "legend" | "line";
  /** Shown in the plot area while there is nothing to plot. */
  emptyMessage?: string;
};

/**
 * Line chart of one quantity over time, without a frame, for a device that lays out its own
 * telemetry cards: a legend, unit-labelled ticks and optional threshold lines.
 */
export function TelemetryLineChart({
  label,
  unit,
  color,
  points = [],
  max,
  thresholds = [],
  thresholdLabels = "line",
  emptyMessage,
}: TelemetryLineChartProps) {
  // A threshold named in the legend joins it as a series with nothing to plot; its line is still
  // the reference line below.
  const legendThresholds =
    thresholdLabels === "legend"
      ? thresholds.map((threshold) => ({ data: [], label: threshold.label, color: threshold.color, showMark: false }))
      : [];
  return (
    <LineChart
      height={240}
      series={[{ data: points.map((point) => point.value), label, color, showMark: false }, ...legendThresholds]}
      xAxis={[
        {
          scaleType: "time",
          data: points.map((point) => new Date(point.time)),
          valueFormatter: (value: Date | null, context) => formatTime(value, context.location, points),
        },
      ]}
      yAxis={[
        { min: 0, max, width: 56, valueFormatter: (value: number) => (unit ? `${value} ${unit}` : String(value)) },
      ]}
      localeText={emptyMessage ? { noData: emptyMessage } : undefined}
    >
      {thresholds.map((threshold, index) => (
        <ChartsReferenceLine
          key={index}
          y={threshold.value}
          label={thresholdLabels === "line" ? threshold.label : undefined}
          labelAlign="end"
          lineStyle={{ stroke: threshold.color, strokeDasharray: "6 4" }}
          labelStyle={{ fill: threshold.color, fontSize: 11 }}
        />
      ))}
    </LineChart>
  );
}

type TelemetryChartProps = {
  title: string;
  /** Unit of the plotted values, shown on the y axis. */
  unit?: string;
  /** Readings to plot, oldest first, e.g. from `useFieldHistory`. Empty until there are any. */
  points?: HistoryPoint[];
  /** Fixes the y axis to this range, e.g. the sensor's full range. */
  min?: number;
  max?: number;
  /** Shown in the plot area while there is nothing to plot. */
  emptyMessage?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clock time for the axis ticks (with the date once the readings span more than a day), and the full
 * date and time in the tooltip. Replaces the time scale's default ticks, which show only the field that
 * changes, e.g. ":29" for seconds.
 */
function formatTime(value: Date | null, location: string, points: HistoryPoint[]): string {
  // The chart asks with no value for an axis position that no longer has data, e.g. the instant
  // the readings are cleared when a demo ends.
  if (!value) return "";
  if (location !== "tick") {
    return value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
  }
  const span = points.length > 1 ? points[points.length - 1].time - points[0].time : 0;
  return span > DAY_MS
    ? value.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Line chart of one quantity over time, in its own titled frame. */
export function TelemetryChart({ title, unit, points = [], min, max, emptyMessage }: TelemetryChartProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <LineChart
        height={240}
        series={[{ data: points.map((point) => point.value), label: title, showMark: false }]}
        xAxis={[
          {
            scaleType: "time",
            data: points.map((point) => new Date(point.time)),
            valueFormatter: (value: Date | null, context) => formatTime(value, context.location, points),
          },
        ]}
        yAxis={[{ label: unit, min, max }]}
        hideLegend
        localeText={emptyMessage ? { noData: emptyMessage } : undefined}
      />
    </Paper>
  );
}
