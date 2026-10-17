"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { ActionButton } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { dischargeWaterFlowMonitorCommands } from "@/lib/bluetooth/commands/discharge-water-flow-monitor";
import { useFieldHistory } from "@/lib/bluetooth/history";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dischargeWaterFlowMonitorProfile } from "./bluetooth-profile";

export function DischargeWaterFlowMonitorDetails() {
  const messenger = getMessenger(dischargeWaterFlowMonitorProfile, dischargeWaterFlowMonitorCommands);
  const { data, updatedAt } = useDeviceState(messenger);
  const flowRates = useFieldHistory(messenger, "flow_rate");
  const totalVolumes = useFieldHistory(messenger, "total_volume");

  return (
    <DeviceDetailsLayout
      slug="discharge-water-flow-monitor"
      controls={
        <ControlSection>
          <ActionButton
            messenger={messenger}
            action="reset_total"
            label="Reset total volume"
            icon={<RestartAltIcon />}
            color="warning"
            confirm="The device's total volume counter will go back to zero. This cannot be undone."
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
          <StatWidget label="Flow rate" value={data.flow_rate} unit="L/min" />
          <StatWidget label="Total volume" value={data.total_volume} unit="L" precision={0} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Flow rate" unit="L/min" points={flowRates} />
          <TelemetryChart title="Total volume" unit="L" points={totalVolumes} />
        </TelemetrySection>
      }
    />
  );
}
