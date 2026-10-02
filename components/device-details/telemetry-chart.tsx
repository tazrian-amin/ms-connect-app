"use client";

import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";

type TelemetryChartProps = {
  title: string;
  /** Unit of the plotted values, shown on the y axis. */
  unit?: string;
};

// TODO: Placeholder. Plot the device's recorded readings once telemetry history is stored.
/** Line chart of one quantity over time. Currently always empty. */
export function TelemetryChart({ title, unit }: TelemetryChartProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <LineChart
        height={240}
        series={[{ data: [], label: title, showMark: false }]}
        xAxis={[{ scaleType: "time", data: [] }]}
        yAxis={[{ label: unit }]}
        hideLegend
      />
    </Paper>
  );
}
