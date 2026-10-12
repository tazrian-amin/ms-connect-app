"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { TelemetryChart } from "@/components/device-details/telemetry-chart";
import { TelemetrySection } from "@/components/device-details/telemetry-section";
import { binHeightMeasurementCommands } from "@/lib/bluetooth/commands/bin-height-measurement";
import { useDeviceState, useLastSent } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { BinTabs } from "./bin-tabs";
import { addBin, removeBin, useBins, type Bin } from "./bins";
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
        onRemove={handleRemove}
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
  const lastSent = useLastSent(messenger, "set_bin_height");

  const binHeight = data.bin_height ?? (lastSent?.value as number | undefined) ?? null;
  const height = data.height ?? null;
  const fill = binHeight && height !== null ? Math.min(Math.max((1 - height / binHeight) * 100, 0), 100) : null;

  return (
    <DeviceDetailsLayout
      slug="bin-height-measurement"
      connection={messenger.connection}
      controls={
        <ControlSection>
          <SettingForm
            messenger={messenger}
            setting="set_bin_height"
            title="Bin height"
            description="Distance from the sensor to the bottom of the empty bin."
            label="Bin height"
            unit="m"
            min={0}
            reported={data.bin_height}
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
          <StatWidget label="Distance to material" value={height} unit="m" precision={2} />
          <StatWidget label="Bin height" value={binHeight} unit="m" precision={2} />
          <DashboardWidget label="Fill level" sx={{ gridColumn: "1 / -1" }}>
            <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
              {fill === null ? "—" : `${Math.round(fill)}%`}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={fill ?? 0}
              aria-label="Fill level"
              sx={{ height: 10, borderRadius: 5 }}
            />
            {fill === null && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Needs a reading and the bin height.
              </Typography>
            )}
          </DashboardWidget>
        </DashboardSection>
      }
      telemetry={
        <TelemetrySection>
          <TelemetryChart title="Distance to material" unit="m" />
        </TelemetrySection>
      }
    />
  );
}
