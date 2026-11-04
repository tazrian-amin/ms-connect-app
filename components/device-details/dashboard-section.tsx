import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { DeviceSection } from "./device-section";

type DashboardSectionProps = {
  /** Device timestamp of the newest data shown, in epoch ms. */
  updatedAt?: number | null;
  /** Shown in the header, e.g. a `CommandButton` that asks the device for a fresh reading. */
  action?: ReactNode;
  children: ReactNode;
};

/**
 * Section 3 of a device details page: live, device-specific widgets built from the messages the
 * device sends. Widgets may also send commands. Lay widgets out as direct children; they flow into
 * a responsive grid. A widget can span the full row with `sx={{ gridColumn: "1 / -1" }}`.
 */
export function DashboardSection({ updatedAt, action, children }: DashboardSectionProps) {
  return (
    <DeviceSection
      title="Dashboard"
      description={
        updatedAt ? `Last update ${formatUpdatedAt(updatedAt)}` : "Waiting for data from the device."
      }
      action={action}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 2, mt: 2 }}>
        {children}
      </Box>
    </DeviceSection>
  );
}

/** Just the time for today's data; with the date for older data, e.g. a tracker's last report shown offline. */
function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString();
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
