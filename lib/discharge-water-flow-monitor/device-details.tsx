"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import Box from "@mui/material/Box";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { dischargeWaterFlowMonitorCommands } from "@/lib/bluetooth/commands/discharge-water-flow-monitor";
import { useFieldHistory } from "@/lib/bluetooth/history";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dischargeWaterFlowMonitorProfile } from "./bluetooth-profile";
import { DischargeFlowGauge } from "./discharge-flow-gauge";
import { TotalVolumeWidget } from "./total-volume-widget";

// TODO: Confirm the flow sensor's output range with firmware. Full scale on the gauge is the flow at the
// top of that range, so it follows the scaling setting.
const SENSOR_FULL_SCALE_V = 10;
/** Gauge full scale in US gal/min until the device reports its scaling. */
const DEFAULT_FULL_SCALE = 500;

export function DischargeWaterFlowMonitorDetails() {
  const messenger = getMessenger(dischargeWaterFlowMonitorProfile, dischargeWaterFlowMonitorCommands);
  const { data, updatedAt } = useDeviceState(messenger);
  const flowRates = useFieldHistory(messenger, "flow_rate");
  const fullScale = data.flow_per_volt ? data.flow_per_volt * SENSOR_FULL_SCALE_V : DEFAULT_FULL_SCALE;

  return (
    <DeviceDetailsLayout
      slug="discharge-water-flow-monitor"
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_flow_per_volt"
            title="Scaling"
            description="Flow that each volt of the flow sensor's output stands for."
            label="Flow per volt"
            unit="gal/min/V"
            min={0}
            reported={data.flow_per_volt}
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
          <DashboardWidget label="Discharge" sx={{ gridColumn: "1 / -1" }}>
            <DischargeFlowGauge flowRate={data.flow_rate ?? null} fullScale={fullScale} />
          </DashboardWidget>
          {/* Side by side under the gauge, each wide enough for a large total and its unit picker. */}
          <Box sx={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: { sm: "1fr 1fr" }, gap: 2 }}>
            <StatWidget label="Instantaneous flow rate" value={data.flow_rate} unit="gal/min" />
            <TotalVolumeWidget messenger={messenger} gallons={data.total_volume} />
          </Box>
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Instantaneous flow rate" unit="gal/min" points={flowRates} />
        </TelemetrySection>
      }
    />
  );
}
