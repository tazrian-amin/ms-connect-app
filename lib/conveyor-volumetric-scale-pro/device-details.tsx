"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { conveyorVolumetricScaleProCommands } from "@/lib/bluetooth/commands/conveyor-volumetric-scale-pro";
import { useFieldHistory } from "@/lib/bluetooth/history";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { ConveyorStockpile } from "@/lib/conveyor-volumetric-scale/conveyor-stockpile";
import { conveyorVolumetricScaleProProfile } from "./bluetooth-profile";

export function ConveyorVolumetricScaleProDetails() {
  const messenger = getMessenger(conveyorVolumetricScaleProProfile, conveyorVolumetricScaleProCommands);
  const { data, updatedAt } = useDeviceState(messenger);
  const volumeRates = useFieldHistory(messenger, "volume_rate");
  const massRates = useFieldHistory(messenger, "mass_rate");

  return (
    <DeviceDetailsLayout
      slug="conveyor-volumetric-scale-pro"
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_material_density"
            title="Material density"
            description="Used to convert the measured volume to mass."
            label="Density"
            unit="t/m³"
            min={0}
            reported={data.material_density}
          />
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
          <DashboardWidget label="Session production" sx={{ gridColumn: "1 / -1" }}>
            <ConveyorStockpile
              totalVolume={data.total_volume ?? null}
              goal={data.production_goal ?? null}
              volumeRate={data.volume_rate ?? null}
              beltSpeed={data.belt_speed ?? null}
            />
          </DashboardWidget>
          <StatWidget label="Volume rate" value={data.volume_rate} unit="m³/h" />
          <StatWidget label="Mass rate" value={data.mass_rate} unit="t/h" />
          <StatWidget label="Total volume" value={data.total_volume} unit="m³" />
          <StatWidget label="Belt speed" value={data.belt_speed} unit="m/s" precision={2} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Volume rate" unit="m³/h" points={volumeRates} />
          <TelemetryChart title="Mass rate" unit="t/h" points={massRates} />
        </TelemetrySection>
      }
    />
  );
}
