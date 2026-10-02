import type { ReactNode } from "react";
import Chip, { type ChipProps } from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

type DashboardWidgetProps = {
  label: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
};

/** Frame for one dashboard tile. Build device-specific widgets inside it. */
export function DashboardWidget({ label, children, sx }: DashboardWidgetProps) {
  return (
    <Paper variant="outlined" sx={[{ p: 2, borderRadius: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

type StatWidgetProps = {
  label: string;
  /** Null or undefined until the device has reported the value. */
  value: number | null | undefined;
  unit?: string;
  /** Decimal places to show. */
  precision?: number;
};

/** A single numeric reading, large. */
export function StatWidget({ label, value, unit, precision = 1 }: StatWidgetProps) {
  const known = value !== null && value !== undefined;
  return (
    <DashboardWidget label={label}>
      <Typography variant="h4" component="p" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {known ? value.toFixed(precision) : "—"}
        {known && unit && (
          <Typography component="span" variant="body1" sx={{ color: "text.secondary", ml: 0.75 }}>
            {unit}
          </Typography>
        )}
      </Typography>
    </DashboardWidget>
  );
}

type StatusWidgetProps = {
  label: string;
  /** Null until the device has reported the status. */
  status: { text: string; color: ChipProps["color"] } | null;
};

/** A state the device reports, such as an alarm level or whether a pump is running. */
export function StatusWidget({ label, status }: StatusWidgetProps) {
  return (
    <DashboardWidget label={label}>
      <Stack direction="row" sx={{ minHeight: 42, alignItems: "center" }}>
        {status ? (
          <Chip label={status.text} color={status.color} />
        ) : (
          <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
            —
          </Typography>
        )}
      </Stack>
    </DashboardWidget>
  );
}
