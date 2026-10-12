import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import { ConnectionSection } from "./connection-section";
import { EditModeGuard } from "./edit-mode-guard";

type DeviceDetailsLayoutProps = {
  slug: string;
  /** A `ControlSection`, or the device's own section(s) for its settings. */
  controls: ReactNode;
  /**
   * A `DashboardSection`. Left out by a device whose live readings share one section with its
   * settings, as the dewater pump float replacement's pump monitoring does.
   */
  dashboard?: ReactNode;
  /** A `TelemetrySection`, or the device's own telemetry section(s). */
  telemetry?: ReactNode;
  /** Shown last, e.g. a `MessageLog` while bringing up new firmware. */
  diagnostics?: ReactNode;
};

/**
 * The four sections of every device details page, in the same order for each device. Each one
 * takes the full width so it has room for its own sub-sections.
 */
export function DeviceDetailsLayout({ slug, controls, dashboard, telemetry, diagnostics }: DeviceDetailsLayoutProps) {
  return (
    <>
      <Stack spacing={3}>
        <ConnectionSection slug={slug} />
        {controls}
        {dashboard}
        {telemetry}
        {diagnostics}
      </Stack>
      <EditModeGuard />
    </>
  );
}
