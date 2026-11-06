import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import type { BluetoothConnection } from "@/lib/connection/connection";
import type { ConnectionInstance } from "@/lib/connection/registry";
import { ConnectionSection } from "./connection-section";
import { DemoFeedbackDialog } from "./demo-feedback-dialog";
import { NavigationGuard } from "./navigation-guard";

type DeviceDetailsLayoutProps = {
  slug: string;
  /** The link the page is about, for a device type with several; otherwise the device's only one. */
  connection?: BluetoothConnection;
  /** Which of several links `connection` is, e.g. an asset's; needed for a cloud device type with several. */
  instance?: ConnectionInstance;
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
export function DeviceDetailsLayout({
  slug,
  connection,
  instance,
  controls,
  dashboard,
  telemetry,
  diagnostics,
}: DeviceDetailsLayoutProps) {
  return (
    <>
      <Stack spacing={3}>
        <ConnectionSection slug={slug} connection={connection} instance={instance} />
        {controls}
        {dashboard}
        {telemetry}
        {diagnostics}
      </Stack>
      <NavigationGuard />
      <DemoFeedbackDialog />
    </>
  );
}
