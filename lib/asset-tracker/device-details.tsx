"use client";

import { useEffect, useState } from "react";
import type { ChipProps } from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { ControlSection } from "@/components/device-details/control-section";
import { DashboardSection } from "@/components/device-details/dashboard-section";
import { DashboardWidget, StatusWidget, StatWidget } from "@/components/device-details/dashboard-widgets";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { DeviceSection } from "@/components/device-details/device-section";
import { assetTrackerCommands } from "@/lib/bluetooth/commands/asset-tracker";
import { useConnectionState, useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger } from "@/lib/bluetooth/messaging";
import { AddAssetDialog } from "./asset-dialogs";
import { AssetTabs } from "./asset-tabs";
import { addAsset, moveAsset, removeAsset, renameAsset, useAssets, type Asset, type NewAsset } from "./assets";
import { assetTrackerProfile } from "./bluetooth-profile";

const SLUG = "asset-tracker";

type Status = { text: string; color: ChipProps["color"] };

const motionStatus = (moving: boolean): Status =>
  moving ? { text: "Moving", color: "success" } : { text: "Stationary", color: "default" };

const trackingModeStatus: Record<"active" | "inactive", Status> = {
  active: { text: "Active", color: "success" },
  inactive: { text: "Inactive", color: "default" },
};

const chargingStatus = (charging: boolean): Status =>
  charging ? { text: "Charging", color: "info" } : { text: "Not charging", color: "default" };

export function AssetTrackerDetails() {
  const assets = useAssets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Falls back to the first asset before one is picked, or after the picked one is removed.
  const selected = assets?.find((asset) => asset.id === selectedId) ?? assets?.[0];

  const handleAdd = (newAsset: NewAsset) => setSelectedId(addAsset(newAsset).id);

  // Nothing until the saved assets are read, then a prompt to add the first one if there are none.
  if (!assets) return null;
  if (!selected) return <NoAssets onAdd={handleAdd} />;

  const handleRemove = (id: string) => {
    const index = assets.findIndex((asset) => asset.id === id);
    const neighbour = assets[index + 1] ?? assets[index - 1];
    removeAsset(id);
    if (neighbour) setSelectedId(neighbour.id);
  };

  return (
    <>
      <AssetTabs
        assets={assets}
        selectedId={selected.id}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onRename={renameAsset}
        onRemove={handleRemove}
        onMove={moveAsset}
      />
      <Box
        role="tabpanel"
        id={`asset-panel-${selected.id}`}
        aria-labelledby={`asset-tab-${selected.id}`}
        sx={{ pt: 3 }}
      >
        {/* Keyed so switching assets starts the panel afresh, e.g. half-typed settings. */}
        <AssetDetails key={selected.id} asset={selected} />
      </Box>
    </>
  );
}

/** Shown before any asset is added: a button in the middle of the page to add the first one. */
function NoAssets({ onAdd }: { onAdd: (asset: NewAsset) => void }) {
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
          No assets yet
        </Typography>
        <Typography sx={{ color: "text.secondary" }}>
          Add an asset, then connect its tracker by serial number to see where it is and how it&apos;s doing.
        </Typography>
      </Stack>
      <Button variant="contained" size="large" disableElevation startIcon={<AddIcon />} onClick={() => setAdding(true)}>
        Add a new asset
      </Button>
      <AddAssetDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(asset) => {
          setAdding(false);
          onAdd(asset);
        }}
      />
    </Paper>
  );
}

/**
 * Connection, settings, readings and location of one asset, over its own tracker's cloud link.
 * No telemetry section: the map below the dashboard takes its place.
 */
function AssetDetails({ asset }: { asset: Asset }) {
  const messenger = getMessenger(assetTrackerProfile, assetTrackerCommands, asset);
  const { data, updatedAt } = useDeviceState(messenger);
  const { status } = useConnectionState(messenger.connection);
  const connected = status === "connected";

  // As soon as the link is up, ask for the tracking configuration, so the settings show it.
  useEffect(() => {
    if (connected) messenger.sendAction("get_config").catch(() => {});
  }, [connected, messenger]);

  return (
    <DeviceDetailsLayout
      slug={SLUG}
      connection={messenger.connection}
      instance={asset}
      controls={
        <ControlSection>
          {/* One column on phones, two on tablets (sm–lg), all four in a row on desktop. */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <SettingForm
              messenger={messenger}
              setting="set_device_name"
              title="Asset name"
              description="What the tracker is fitted to, e.g. a truck or a loader."
              label="Name"
              reported={data.device_name}
            />
            <SettingForm
              messenger={messenger}
              setting="set_stationary_interval_s"
              title="Stationary interval"
              description="How often the tracker reports its location while the asset is not moving."
              label="Interval"
              unit="s"
              min={1}
              step={1}
              reported={data.stationary_interval_s}
            />
            <SettingForm
              messenger={messenger}
              setting="set_moving_interval_s"
              title="Moving interval"
              description="How often the tracker reports its location while the asset is moving."
              label="Interval"
              unit="s"
              min={1}
              step={1}
              reported={data.moving_interval_s}
            />
            <SettingForm
              messenger={messenger}
              setting="set_inactivity_timeout_s"
              title="Inactivity timeout"
              description="How long the asset must stay still before tracking goes inactive."
              label="Timeout"
              unit="s"
              min={1}
              step={1}
              reported={data.inactivity_timeout_s}
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
              action="get_reading"
              label="Refresh"
              icon={<RefreshIcon />}
              requiresEditMode={false}
            />
          }
        >
          <DashboardWidget label="Asset">
            <Typography variant="h5" component="p" sx={{ fontWeight: 600, minHeight: 42, alignContent: "center" }}>
              {data.device_name ?? "—"}
            </Typography>
          </DashboardWidget>
          <StatusWidget label="Motion" status={data.is_moving === undefined ? null : motionStatus(data.is_moving)} />
          <StatusWidget
            label="Tracking mode"
            status={data.tracking_mode ? trackingModeStatus[data.tracking_mode] : null}
          />
          <StatWidget label="Battery" value={data.battery_percentage} unit="%" precision={0} />
          <StatWidget label="Battery voltage" value={data.battery_voltage} unit="V" precision={2} />
          <StatusWidget
            label="Charging"
            status={data.is_charging === undefined ? null : chargingStatus(data.is_charging)}
          />
          <DashboardWidget label="Last reported location" sx={{ gridColumn: "1 / -1" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { sm: "1fr 1fr" }, gap: 1 }}>
              <Coordinate label="Latitude" value={data.latitude} />
              <Coordinate label="Longitude" value={data.longitude} />
            </Box>
          </DashboardWidget>
        </DashboardSection>
      }
      telemetry={<LocationMap />}
    />
  );
}

function Coordinate({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Typography variant="h6" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
      <Typography component="span" variant="body1" sx={{ color: "text.secondary", mr: 1 }}>
        {label}
      </Typography>
      {value === undefined ? "—" : `${value.toFixed(4)}°`}
    </Typography>
  );
}

// TODO: Replace the placeholder with a map centred on the last reported location, with a marker for the tracker.
function LocationMap() {
  return (
    <DeviceSection title="Map" description="The tracker's last reported location.">
      <Box
        sx={{
          mt: 2,
          height: { xs: 240, sm: 360 },
          border: 1,
          borderStyle: "dashed",
          borderColor: "divider",
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          color: "text.secondary",
        }}
      >
        <MapOutlinedIcon fontSize="large" />
        <Typography variant="body2">Map view coming soon</Typography>
      </Box>
    </DeviceSection>
  );
}
