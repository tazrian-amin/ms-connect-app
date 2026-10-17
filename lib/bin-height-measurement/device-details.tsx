"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
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
import { BinVisual } from "./bin-dashboard/bin-visual";
import { DEFAULT_MATERIAL_COLOR } from "./bin-dashboard/material-colors";
import { MaterialColorSelect } from "./bin-dashboard/material-color-select";
import { AddBinDialog } from "./bin-dialogs";
import { BinTabs } from "./bin-tabs";
import {
  addBin,
  moveBin,
  removeBin,
  renameBin,
  setBinMaterialColor,
  useBins,
  type Bin,
  type NewBin,
} from "./bins";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

/** Full scale of the sensor's 12-bit ADC reading. */
const ADC_MAX = 4095;

export function BinHeightMeasurementDetails() {
  const bins = useBins();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Falls back to the first bin before one is picked, or after the picked one is removed.
  const selected = bins?.find((bin) => bin.id === selectedId) ?? bins?.[0];

  // Nothing until the saved bins are read, then a prompt to add the first one if there are none.
  if (!bins) return null;
  if (!selected) return <NoBins onAdd={(bin) => setSelectedId(addBin(bin).id)} />;

  const handleRemove = (id: string) => {
    const index = bins.findIndex((bin) => bin.id === id);
    const neighbour = bins[index + 1] ?? bins[index - 1];
    removeBin(id);
    if (neighbour) setSelectedId(neighbour.id);
  };

  return (
    <>
      {bins.map((bin) => (
        <BinRecorder key={bin.id} bin={bin} />
      ))}
      <BinTabs
        bins={bins}
        selectedId={selected.id}
        onSelect={setSelectedId}
        onAdd={(bin) => setSelectedId(addBin(bin).id)}
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

/** Shown before any bin is added: a button in the middle of the page to add the first one. */
function NoBins({ onAdd }: { onAdd: (bin: NewBin) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderStyle: "dashed",
        py: { xs: 6, sm: 10 },
        px: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 2,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="h6" component="h2">
          No bins yet
        </Typography>
        <Typography sx={{ color: "text.secondary" }}>
          Add a bin to connect its sensor and watch its material height.
        </Typography>
      </Stack>
      <Button variant="contained" size="large" disableElevation startIcon={<AddIcon />} onClick={() => setAdding(true)}>
        Add a new bin
      </Button>
      <AddBinDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(bin) => {
          setAdding(false);
          onAdd(bin);
        }}
      />
    </Paper>
  );
}

/**
 * Keeps a bin's readings flowing while another bin's tab is shown. History only records while
 * something listens, so without this a hidden bin's chart would have a gap for the time it was hidden.
 */
function BinRecorder({ bin }: { bin: Bin }) {
  useFieldHistory(getMessenger(binHeightMeasurementProfile, binHeightMeasurementCommands, bin), "material_height");
  return null;
}

/** Connection, settings, readings and telemetry of one bin, over its own sensor's link. */
function BinDetails({ bin }: { bin: Bin }) {
  const messenger = getMessenger(binHeightMeasurementProfile, binHeightMeasurementCommands, bin);
  const { data, updatedAt } = useDeviceState(messenger);
  const { status } = useConnectionState(messenger.connection);
  const heights = useFieldHistory(messenger, "material_height");
  const connected = status === "connected";
  const materialColor = bin.materialColor ?? DEFAULT_MATERIAL_COLOR;

  // As soon as the link is up, set the device clock (it has none, so samples carry its timestamps
  // from then on) and ask for the stored interval, so the settings show it.
  useEffect(() => {
    if (!connected) return;
    messenger.sendSetting("set_time", Date.now()).catch(() => {});
    messenger.sendAction("get_config").catch(() => {});
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
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "flex-end" }}>
              <MaterialColorSelect
                value={materialColor}
                onChange={(color) => setBinMaterialColor(bin.id, color)}
              />
              <ActionButton
                messenger={messenger}
                action="read_now"
                label="Refresh"
                icon={<RefreshIcon />}
                requiresEditMode={false}
              />
            </Stack>
          }
        >
          <DashboardWidget label="Fill level" sx={{ gridColumn: "1 / -1" }}>
            {/* Fill is the reading as a share of ADC full scale until the sensor is calibrated to the bin.
                Drawn empty, with no value, until the sensor has reported. */}
            <BinVisual
              category={bin.category}
              materialType={bin.materialType}
              fillLevel={
                data.material_height !== null && data.material_height !== undefined
                  ? (data.material_height / ADC_MAX) * 100
                  : null
              }
              capacity={ADC_MAX}
              loadUnitLabel="ADC"
              materialColor={materialColor}
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
