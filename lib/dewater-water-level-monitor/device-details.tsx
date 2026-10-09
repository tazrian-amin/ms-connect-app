"use client";

import type { ChipProps } from "@mui/material/Chip";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatusWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { dewaterWaterLevelMonitorCommands } from "@/lib/bluetooth/commands/dewater-water-level-monitor";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dewaterWaterLevelMonitorProfile } from "./bluetooth-profile";

const alarmStatus: Record<"high" | "low" | "normal", { text: string; color: ChipProps["color"] }> = {
  high: { text: "High level", color: "error" },
  low: { text: "Low level", color: "warning" },
  normal: { text: "Normal", color: "success" },
};

export function DewaterWaterLevelMonitorDetails() {
  const messenger = getMessenger(dewaterWaterLevelMonitorProfile, dewaterWaterLevelMonitorCommands);
  const { data, updatedAt } = useDeviceState(messenger);

  return (
    <DeviceDetailsLayout
      slug="dewater-water-level-monitor"
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_high_alarm_level"
            title="High alarm level"
            description="The device raises an alarm when the water goes above this level."
            label="High level"
            unit="m"
            min={0}
            reported={data.high_alarm_level}
          />
          <SettingForm
            messenger={messenger}
            setting="set_low_alarm_level"
            title="Low alarm level"
            description="The device raises an alarm when the water goes below this level."
            label="Low level"
            unit="m"
            min={0}
            reported={data.low_alarm_level}
          />
        </ControlSection>
      }
      dashboard={
        <DashboardSection
          updatedAt={updatedAt}
          action={
            <ActionButton
              messenger={messenger}
              action="get_reading"
              label="Refresh"
              icon={<RefreshIcon />}
              requiresEditMode={false}
            />
          }
        >
          <StatWidget label="Water level" value={data.water_level} unit="m" precision={2} />
          <StatusWidget label="Alarm" status={data.alarm ? alarmStatus[data.alarm] : null} />
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
