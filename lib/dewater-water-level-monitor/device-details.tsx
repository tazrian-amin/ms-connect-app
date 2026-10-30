"use client";

import type { ChipProps } from "@mui/material/Chip";
import RefreshIcon from "@mui/icons-material/Refresh";
import Box from "@mui/material/Box";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatusWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { DeviceSection } from "@/components/device-details/device-section";
import { TelemetryLineChart } from "@/components/device-details/telemetry-chart";
import { dewaterWaterLevelMonitorCommands } from "@/lib/bluetooth/commands/dewater-water-level-monitor";
import { useFieldHistory } from "@/lib/bluetooth/history";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dewaterWaterLevelMonitorProfile } from "./bluetooth-profile";
import { WaterLevelGauge } from "./water-level-gauge";

const alarmStatus: Record<"high" | "low" | "normal", { text: string; color: ChipProps["color"] }> = {
  high: { text: "Water too high", color: "warning" },
  low: { text: "Water too low", color: "error" },
  normal: { text: "Normal", color: "success" },
};

/** Distances in ft drawn until the device reports its own. */
const DEFAULT_MAX_DISTANCE = 22;
const DEFAULT_MIN_DISTANCE = 12;
/** Max in the alarm red, min in amber, on the gauge and the chart alike. */
const THRESHOLD_COLORS = { max: "#ef4444", min: "#f59e0b" };

export function DewaterWaterLevelMonitorDetails() {
  const messenger = getMessenger(dewaterWaterLevelMonitorProfile, dewaterWaterLevelMonitorCommands);
  const { data, updatedAt } = useDeviceState(messenger);
  const distances = useFieldHistory(messenger, "water_distance");
  const maxDistance = data.max_distance ?? DEFAULT_MAX_DISTANCE;
  const minDistance = data.min_distance ?? DEFAULT_MIN_DISTANCE;

  return (
    <DeviceDetailsLayout
      slug="dewater-water-level-monitor"
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_max_distance"
            title="Max distance"
            description="The device raises a low water alarm when the water drops further than this below the pump stand."
            label="Max distance"
            unit="ft"
            min={0}
            reported={data.max_distance}
          />
          <SettingForm
            messenger={messenger}
            setting="set_min_distance"
            title="Min distance"
            description="The device raises a high water alarm when the water rises closer than this to the pump stand."
            label="Min distance"
            unit="ft"
            min={0}
            reported={data.min_distance}
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
          <DashboardWidget label="Sump" sx={{ gridColumn: "1 / -1" }}>
            <WaterLevelGauge
              distance={data.water_distance ?? null}
              maxDistance={maxDistance}
              minDistance={minDistance}
              alarm={data.alarm ?? null}
            />
          </DashboardWidget>
          <Box sx={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: { sm: "1fr 1fr" }, gap: 2 }}>
            <StatWidget label="Pump stand to water" value={data.water_distance} unit="ft" />
            <StatusWidget label="Alarm" status={data.alarm ? alarmStatus[data.alarm] : null} />
          </Box>
        </DashboardSection>
      }
      telemetry={
        <DeviceSection title="Pump Stand to Water Distance">
          <TelemetryLineChart
            label="Water Level (feet)"
            unit="ft"
            color="#3b82f6"
            points={distances}
            thresholds={[
              { label: `Max Threshold (${maxDistance})`, value: maxDistance, color: THRESHOLD_COLORS.max },
              { label: `Min Threshold (${minDistance})`, value: minDistance, color: THRESHOLD_COLORS.min },
            ]}
            thresholdLabels="legend"
            emptyMessage="Waiting for water level readings from the device…"
          />
        </DeviceSection>
      }
    />
  );
}
