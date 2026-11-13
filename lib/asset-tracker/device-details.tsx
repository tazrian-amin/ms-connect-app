"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ChipProps } from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
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
import { DEFAULT_PRESET, HistoryRangePicker, presetRange } from "./history-range";
import { analyseJourney, formatDuration } from "./journey";
import { JourneyPanel } from "./journey-timeline";
import { useLiveTrip, type LiveTrip } from "./live-trip";
import { pathLengthKm, type TimedLatLng } from "./location";
import { useLocationHistory, type HistoryRange, type HistorySource } from "./location-history";

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
  const { status, demo, cloud, deviceName } = useConnectionState(messenger.connection);
  const connected = status === "connected";
  const historySource: HistorySource | null = demo
    ? { kind: "demo" }
    : cloud && deviceName
      ? { kind: "cloud", serialNumber: deviceName }
      : null;
  const trip = useLiveTrip(messenger, status !== "disconnected", historySource);

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
      telemetry={
        <LocationMap
          latitude={data.latitude}
          longitude={data.longitude}
          moving={data.is_moving}
          trip={trip}
          historySource={historySource}
        />
      }
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

// MapLibre needs the browser (WebGL, workers), so the map is loaded on the client only, and its
// sizeable code only once a device page is open.
const TrackerMap = dynamic(() => import("./tracker-map"), {
  ssr: false,
  loading: () => <MapMessage text="Loading map…" />,
});

type LocationMapProps = {
  latitude: number | undefined;
  longitude: number | undefined;
  moving: boolean | undefined;
  /** Where it last stopped and its path since, shown only while it's moving. */
  trip: LiveTrip;
  /** Where to load past locations from, or null while there's no tracker to ask. */
  historySource: HistorySource | null;
};

/**
 * The tracker on a map. Live: its last reported location, with a pin that follows it. History: its
 * route over a chosen period, from start to end.
 */
function LocationMap({ latitude, longitude, moving, trip, historySource }: LocationMapProps) {
  const hasLocation = latitude !== undefined && longitude !== undefined;
  // Live: just the pin while it stands still; while moving, also where it set off and its path since.
  const trail = moving && trip.path.length > 1 ? trip.path : undefined;
  const lastStop =
    moving && trip.stop
      ? { at: trip.stop, leftAt: trip.path.find((point) => point.time > trip.stop!.time)?.time }
      : undefined;
  const [view, setView] = useState<"live" | "history">("live");
  const [period, setPeriod] = useState<{ range: HistoryRange; preset: string | null } | null>(null);
  const history = useLocationHistory(
    view === "history" ? historySource : null,
    view === "history" ? (period?.range ?? null) : null,
  );
  const points = history?.points;
  const journey = useMemo(() => (points?.length ? analyseJourney(points) : null), [points]);
  // The stop or trip picked in the timeline or on the map; let go when another route loads.
  const [selection, setSelection] = useState<{ route: TimedLatLng[]; index: number } | null>(null);
  const selected = selection && selection.route === points ? selection.index : null;
  const select = (index: number | null) => setSelection(index === null || !points ? null : { route: points, index });

  const showView = (next: "live" | "history") => {
    setView(next);
    // A preset like "Last 24 hours" is worked out afresh each time history opens; a range picked
    // by hand is kept as it was.
    if (next === "history" && period?.preset !== null) {
      const preset = period?.preset ?? DEFAULT_PRESET;
      setPeriod({ range: presetRange(preset), preset });
    }
  };

  const description =
    view === "history"
      ? "Where the tracker went in the chosen period, from the blue start dot to the red end pin. Numbered markers are where it stopped; pick a stop or trip from the list to see it on the map."
      : moving && lastStop
        ? "The tracker is on the move: the dashed line is its path since it set off from the blue dot."
        : moving && trail
          ? "The tracker is on the move: the dashed line is its path since the page started following it."
          : "The tracker's last reported location.";

  let content: ReactNode;
  if (view === "live") {
    content = hasLocation ? (
      <TrackerMap mode="live" position={{ latitude, longitude }} moving={moving} trail={trail} lastStop={lastStop} />
    ) : (
      <MapMessage text="No location reported yet" />
    );
  } else if (!historySource) {
    content = <MapMessage text="Connect the tracker, or try the demo, to see where it has been." />;
  } else if (points?.length && journey) {
    content = <TrackerMap mode="history" route={points} journey={journey} selected={selected} onSelect={select} />;
  } else if (history?.status === "error") {
    content = <MapMessage text={history.error} />;
  } else if (history?.status === "loaded") {
    content = <MapMessage text="No locations were recorded in this period." />;
  } else {
    content = <MapMessage text="Loading history…" />;
  }
  const showingMap = (view === "live" && hasLocation) || (view === "history" && Boolean(points?.length));

  return (
    <DeviceSection
      title="Map"
      description={description}
      action={
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, next: "live" | "history" | null) => next && showView(next)}
          aria-label="Map view"
        >
          <ToggleButton value="live" sx={{ px: 2 }}>
            Live
          </ToggleButton>
          <ToggleButton value="history" sx={{ px: 2 }}>
            History
          </ToggleButton>
        </ToggleButtonGroup>
      }
    >
      {view === "history" && period && (
        <Box sx={{ mt: 2 }}>
          <HistoryRangePicker
            range={period.range}
            preset={period.preset}
            onChange={(range, preset) => setPeriod({ range, preset })}
          />
          {history?.status === "error" && points?.length ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {history.error}
            </Alert>
          ) : null}
          {history?.status === "loaded" && points?.length ? (
            <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
              {points.length.toLocaleString()} {points.length === 1 ? "location" : "locations"} · about{" "}
              {pathLengthKm(points).toLocaleString(undefined, { maximumFractionDigits: 1 })} km travelled
              {journey && (
                <>
                  {" "}
                  · moving {formatDuration(journey.movingMs)} · stopped {formatDuration(journey.stoppedMs)} at{" "}
                  {journey.stopCount} {journey.stopCount === 1 ? "stop" : "stops"}
                </>
              )}
            </Typography>
          ) : null}
        </Box>
      )}
      {/* History: the stops and trips beside the map on wide screens, under it on phones. */}
      <Box
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          height: { md: 480, lg: 560 },
        }}
      >
        {view === "history" && journey && journey.segments.length > 0 && (
          <JourneyPanel journey={journey} selected={selected} onSelect={select} />
        )}
        <Box
          sx={{
            position: "relative",
            flex: { md: 1 },
            minWidth: 0,
            height: { xs: 360, sm: 480, md: "auto" },
            border: 1,
            borderStyle: showingMap ? "solid" : "dashed",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          {view === "history" && history?.status === "loading" && points?.length ? (
            <LinearProgress
              aria-label="Loading history"
              sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 }}
            />
          ) : null}
          {content}
        </Box>
      </Box>
    </DeviceSection>
  );
}

function MapMessage({ text }: { text: string }) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        color: "text.secondary",
      }}
    >
      <MapOutlinedIcon fontSize="large" />
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
