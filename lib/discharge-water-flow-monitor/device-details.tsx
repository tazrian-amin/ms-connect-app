"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { CommandButton } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { dischargeWaterFlowMonitorCommands } from "@/lib/bluetooth/commands/discharge-water-flow-monitor";
import { useLatestMessage } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dischargeWaterFlowMonitorProfile } from "./bluetooth-profile";

export function DischargeWaterFlowMonitorDetails() {
  const messenger = getMessenger(dischargeWaterFlowMonitorProfile, dischargeWaterFlowMonitorCommands);
  const reading = useLatestMessage(messenger, "reading");

  return (
    <DeviceDetailsLayout
      slug="discharge-water-flow-monitor"
      controls={
        <ControlSection>
          <CommandButton
            messenger={messenger}
            command="resetTotal"
            label="Reset total volume"
            icon={<RestartAltIcon />}
            color="warning"
            confirm="The device's total volume counter will go back to zero. This cannot be undone."
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
          <StatWidget label="Flow rate" value={reading?.data.flowRate} unit="L/min" />
          <StatWidget label="Total volume" value={reading?.data.totalVolume} unit="L" precision={0} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Flow rate" unit="L/min" />
          <TelemetryChart title="Total volume" unit="L" />
        </TelemetrySection>
      }
    />
  );
}
