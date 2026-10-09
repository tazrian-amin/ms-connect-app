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
import { conveyorVolumetricScaleCommands } from "@/lib/bluetooth/commands/conveyor-volumetric-scale";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { conveyorVolumetricScaleProfile } from "./bluetooth-profile";

export function ConveyorVolumetricScaleDetails() {
  const messenger = getMessenger(conveyorVolumetricScaleProfile, conveyorVolumetricScaleCommands);
  const { data, updatedAt } = useDeviceState(messenger);

  return (
    <DeviceDetailsLayout
      slug="conveyor-volumetric-scale"
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
          <StatWidget label="Volume rate" value={data.volume_rate} unit="m³/h" />
          <StatWidget label="Total volume" value={data.total_volume} unit="m³" />
          <StatWidget label="Belt speed" value={data.belt_speed} unit="m/s" precision={2} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Volume rate" unit="m³/h" />
          <TelemetryChart title="Belt speed" unit="m/s" />
        </TelemetrySection>
      }
    />
  );
}
