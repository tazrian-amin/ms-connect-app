"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { binHeightMeasurementCommands } from "@/lib/bluetooth/commands/bin-height-measurement";
import { useFieldHistory } from "@/lib/bluetooth/history";
import { useConnectionState, useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { IndustrialBinHopper } from "./bin-dashboard/industrial-bin-hopper";
import { BinTabs } from "./bin-tabs";
import { addBin, moveBin, removeBin, renameBin, useBins, type Bin } from "./bins";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

/** Full scale of the sensor's 12-bit ADC reading. */
const ADC_MAX = 4095;

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
  const { data, updatedAt } = useDeviceState(messenger);
  const { status } = useConnectionState(messenger.connection);
  const heights = useFieldHistory(messenger, "material_height");
  const connected = status === "connected";

  // Ask for the stored interval as soon as the link is up, so the settings show it.
  useEffect(() => {
    if (connected) messenger.sendAction("get_config").catch(() => {});
  }, [connected, messenger]);

  return (
    <DeviceDetailsLayout
      slug="bin-height-measurement"
      connection={messenger.connection}
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_sample_period_ms"
            title="Bluetooth data interval"
            description="How often the sensor sends the material height. Stored on the device."
            label="Interval"
            unit="ms"
            min={1000}
            max={3_600_000}
            step={1000}
            reported={data.sample_period_ms}
          />
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
          <DashboardWidget label="Fill level" sx={{ gridColumn: "1 / -1" }}>
            {/* Fill is the reading as a share of ADC full scale until the sensor is calibrated to the bin.
                Drawn empty, with no value, until the sensor has reported. */}
            <IndustrialBinHopper
              fillLevel={
                data.material_height !== null && data.material_height !== undefined
                  ? (data.material_height / ADC_MAX) * 100
                  : null
              }
              capacity={ADC_MAX}
              loadUnitLabel="ADC"
            />
          </DashboardWidget>
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          {/* Raw ADC counts until the sensor is calibrated to metres. */}
          <TelemetryChart
            title="Material height"
            unit="ADC"
            points={heights}
            min={0}
            max={ADC_MAX}
            emptyMessage="Waiting for readings from the sensor."
          />
        </TelemetrySection>
      }
    />
  );
}
