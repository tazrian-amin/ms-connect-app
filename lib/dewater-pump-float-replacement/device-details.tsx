"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import { CommandButton, CommandForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatusWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { dewaterPumpFloatReplacementCommands } from "@/lib/bluetooth/commands/dewater-pump-float-replacement";
import { useLatestMessage } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { dewaterPumpFloatReplacementProfile } from "./bluetooth-profile";

export function DewaterPumpFloatReplacementDetails() {
  const messenger = getMessenger(dewaterPumpFloatReplacementProfile, dewaterPumpFloatReplacementCommands);
  const reading = useLatestMessage(messenger, "reading");

  return (
    <DeviceDetailsLayout
      slug="dewater-pump-float-replacement"
      controls={
        <ControlSection>
          <CommandForm
            messenger={messenger}
            command="setPumpMode"
            title="Pump mode"
            description="Automatic runs the pump from the water level. On and Off override it."
            fields={{ mode: { label: "Mode", optionLabels: { auto: "Automatic", on: "On", off: "Off" } } }}
          />
          <CommandForm
            messenger={messenger}
            command="setPumpLevels"
            title="Pump levels"
            description="In automatic mode the pump starts at the start level and stops at the stop level."
            fields={{
              startLevel: { label: "Start level", unit: "m", min: 0 },
              stopLevel: { label: "Stop level", unit: "m", min: 0 },
            }}
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
          <StatWidget label="Water level" value={reading?.data.waterLevel} unit="m" precision={2} />
          <StatusWidget
            label="Pump"
            status={
              reading &&
              (reading.data.pumpRunning ? { text: "Running", color: "success" } : { text: "Stopped", color: "default" })
            }
          />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Water level" unit="m" />
          <TelemetryChart title="Pump activity" />
        </TelemetrySection>
      }
    />
  );
}
