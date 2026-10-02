"use client";

import type { ChipProps } from "@mui/material/Chip";
import RefreshIcon from "@mui/icons-material/Refresh";
import { CommandButton, CommandForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatusWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { dewaterWaterLevelMonitorCommands } from "@/lib/bluetooth/commands/dewater-water-level-monitor";
import { useLatestMessage } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dewaterWaterLevelMonitorProfile } from "./bluetooth-profile";

const alarmStatus: Record<"high" | "low" | "normal", { text: string; color: ChipProps["color"] }> = {
  high: { text: "High level", color: "error" },
  low: { text: "Low level", color: "warning" },
  normal: { text: "Normal", color: "success" },
};

export function DewaterWaterLevelMonitorDetails() {
  const messenger = getMessenger(dewaterWaterLevelMonitorProfile, dewaterWaterLevelMonitorCommands);
  const reading = useLatestMessage(messenger, "reading");
  const alarm = useLatestMessage(messenger, "alarm");

  return (
    <DeviceDetailsLayout
      slug="dewater-water-level-monitor"
      controls={
        <ControlSection>
          <CommandForm
            messenger={messenger}
            command="setAlarmLevels"
            title="Alarm levels"
            description="The device raises an alarm when the water goes above the high level or below the low level."
            fields={{
              highLevel: { label: "High level", unit: "m", min: 0 },
              lowLevel: { label: "Low level", unit: "m", min: 0 },
            }}
          />
        </ControlSection>
      }
      dashboard={
        <DashboardSection
          updatedAt={Math.max(reading?.timestamp ?? 0, alarm?.timestamp ?? 0) || null}
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
          <StatWidget label="Water level" value={reading?.data.waterLevel} unit="m" precision={2} />
          <StatusWidget label="Alarm" status={alarm && alarmStatus[alarm.data.level]} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Water level" unit="m" />
        </TelemetrySection>
      }
    />
  );
}
