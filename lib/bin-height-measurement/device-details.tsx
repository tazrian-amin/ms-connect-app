"use client";

import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { CommandButton, CommandForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { binHeightMeasurementCommands } from "@/lib/bluetooth/commands/bin-height-measurement";
import { useLastSentCommand, useLatestMessage } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

export function BinHeightMeasurementDetails() {
  const messenger = getMessenger(binHeightMeasurementProfile, binHeightMeasurementCommands);
  const reading = useLatestMessage(messenger, "reading");
  const settings = useLatestMessage(messenger, "settings");
  const lastSent = useLastSentCommand(messenger, "setBinHeight");

  const binHeight = settings?.data.binHeight ?? lastSent?.data.binHeight ?? null;
  const height = reading?.data.height ?? null;
  const fill = binHeight && height !== null ? Math.min(Math.max((1 - height / binHeight) * 100, 0), 100) : null;

  return (
    <DeviceDetailsLayout
      slug="bin-height-measurement"
      controls={
        <ControlSection>
          <CommandForm
            messenger={messenger}
            command="setBinHeight"
            title="Bin height"
            description="Distance from the sensor to the bottom of the empty bin."
            fields={{ binHeight: { label: "Bin height", unit: "m", min: 0 } }}
            reported={settings?.data}
          />
        </ControlSection>
      }
      dashboard={
        <DashboardSection
          updatedAt={reading?.timestamp}
          action={
            <CommandButton
              messenger={messenger}
              command="requestReading"
              label="Refresh"
              icon={<RefreshIcon />}
              requiresEditMode={false}
            />
          }
        >
          <StatWidget label="Distance to material" value={height} unit="m" precision={2} />
          <StatWidget label="Bin height" value={binHeight} unit="m" precision={2} />
          <DashboardWidget label="Fill level" sx={{ gridColumn: "1 / -1" }}>
            <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
              {fill === null ? "—" : `${Math.round(fill)}%`}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={fill ?? 0}
              aria-label="Fill level"
              sx={{ height: 10, borderRadius: 5 }}
            />
            {fill === null && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Needs a reading and the bin height.
              </Typography>
            )}
          </DashboardWidget>
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Distance to material" unit="m" />
        </TelemetrySection>
      }
    />
  );
}
