import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import { DeviceSection } from "./device-section";

/**
 * Section 2 of a device details page: values the user sets on the device (app → device).
 * Fill it with `CommandForm` and `CommandButton`, or device-specific controls.
 */
export function ControlSection({ description, children }: { description?: ReactNode; children: ReactNode }) {
  return (
    <DeviceSection title="Settings" description={description ?? "Set values on the connected device."}>
      <Stack spacing={2} sx={{ mt: 2 }}>
        {children}
      </Stack>
    </DeviceSection>
  );
}
