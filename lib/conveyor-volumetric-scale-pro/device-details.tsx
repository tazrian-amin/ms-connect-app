"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { CommandButton, CommandForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { conveyorVolumetricScaleProCommands } from "@/lib/bluetooth/commands/conveyor-volumetric-scale-pro";
import { useLatestMessage } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { conveyorVolumetricScaleProProfile } from "./bluetooth-profile";

export function ConveyorVolumetricScaleProDetails() {
  const messenger = getMessenger(conveyorVolumetricScaleProProfile, conveyorVolumetricScaleProCommands);
  const reading = useLatestMessage(messenger, "reading");

  return (
    <DeviceDetailsLayout
      slug="conveyor-volumetric-scale-pro"
      controls={
        <ControlSection>
          <CommandForm
            messenger={messenger}
            command="setMaterialDensity"
            title="Material density"
            description="Used to convert the measured volume to mass."
            fields={{ density: { label: "Density", unit: "t/m³", min: 0 } }}
          />
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
          <StatWidget label="Volume rate" value={reading?.data.volumeRate} unit="m³/h" />
          <StatWidget label="Mass rate" value={reading?.data.massRate} unit="t/h" />
          <StatWidget label="Total volume" value={reading?.data.totalVolume} unit="m³" />
          <StatWidget label="Belt speed" value={reading?.data.beltSpeed} unit="m/s" precision={2} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Volume rate" unit="m³/h" />
          <TelemetryChart title="Mass rate" unit="t/h" />
        </TelemetrySection>
      }
    />
  );
}
