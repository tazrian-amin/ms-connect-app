"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { binHeightMeasurementCommands } from "@/lib/bluetooth/commands/bin-height-measurement";
import { useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { BinTabs } from "./bin-tabs";
import { addBin, moveBin, removeBin, renameBin, useBins, type Bin } from "./bins";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

export function BinHeightMeasurementDetails() {
  const bins = useBins();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Falls back to the first bin before one is picked, or after the picked one is removed.
  const selected = bins.find((bin) => bin.id === selectedId) ?? bins[0];

  const handleRemove = (id: string) => {
    const index = bins.findIndex((bin) => bin.id === id);
    const neighbour = bins[index + 1] ?? bins[index - 1];
    removeBin(id);
    if (neighbour) setSelectedId(neighbour.id);
  };

  return (
    <>
      <BinTabs
        bins={bins}
        selectedId={selected.id}
        onSelect={setSelectedId}
        onAdd={(name) => setSelectedId(addBin(name).id)}
        onRename={renameBin}
        onRemove={handleRemove}
        onMove={moveBin}
      />
      <Box
        role="tabpanel"
        id={`bin-panel-${selected.id}`}
        aria-labelledby={`bin-tab-${selected.id}`}
        sx={{ pt: 3 }}
      >
        {/* Keyed so switching bins starts the panel afresh, e.g. half-typed settings. */}
        <BinDetails key={selected.id} bin={selected} />
      </Box>
    </>
  );
}

/** Connection, settings, readings and telemetry of one bin, over its own sensor's link. */
function BinDetails({ bin }: { bin: Bin }) {
  const messenger = getMessenger(binHeightMeasurementProfile, binHeightMeasurementCommands, bin);
  const { deviceId, data, updatedAt } = useDeviceState(messenger);

  return (
    <DeviceDetailsLayout
      slug="bin-height-measurement"
      connection={messenger.connection}
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_device_id"
            title="Device ID"
            description="Serial number the sensor reports itself as. Stored on the device."
            label="Device ID"
            reported={deviceId}
          />
          <Box>
            <ActionButton
              messenger={messenger}
              action="reset_config"
              label="Reset device ID"
              color="error"
              confirm="The stored device ID will be cleared and the sensor will use its chip ID instead."
            />
          </Box>
        </ControlSection>
      }
      dashboard={
        <DashboardSection
          updatedAt={updatedAt}
          action={
            <ActionButton
              messenger={messenger}
              action="read_now"
              label="Refresh"
              icon={<RefreshIcon />}
              requiresEditMode={false}
            />
          }
        >
          {/* Raw ADC counts until the sensor is calibrated to metres. */}
          <StatWidget label="Material height" value={data.material_height} unit="ADC" precision={0} />
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Material height" unit="ADC" />
        </TelemetrySection>
      }
    />
  );
}
