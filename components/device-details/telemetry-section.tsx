import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import { DeviceSection } from "./device-section";

/**
 * Section 4 of a device details page: charts of the device's data over time. Read-only; it never
 * sends commands. Charts are direct children and stack at full width.
 */
export function TelemetrySection({ children }: { children: ReactNode }) {
  return (
    <DeviceSection title="Telemetry" description="Device data over time.">
      <Stack spacing={2} sx={{ mt: 2 }}>
        {children}
      </Stack>
    </DeviceSection>
  );
}
