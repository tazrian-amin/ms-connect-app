"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import BluetoothDisabledIcon from "@mui/icons-material/BluetoothDisabled";
import EditIcon from "@mui/icons-material/Edit";
import EditOffIcon from "@mui/icons-material/EditOff";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutlined";
import type { BluetoothConnection } from "@/lib/bluetooth/connection";
import { useBluetoothSupport, useConnectionState, type BluetoothSupport } from "@/lib/bluetooth/hooks";
import type { StandardCharacteristic } from "@/lib/bluetooth/profile";
import type { DemoSimulator } from "@/lib/bluetooth/demo";
import { deviceDemos, deviceProfiles, getConnection } from "@/lib/bluetooth/registry";
import { noteDemoStarted, offerDemoFeedback } from "@/lib/demo-feedback";
import { disableEditMode, enableEditMode, useEditMode, warnEditMode } from "@/lib/edit-mode";
import { ConnectionStatusChip } from "@/components/bluetooth/connection-status-chip";
import { DeviceInfo } from "@/components/bluetooth/device-info";
import { DeviceSection } from "./device-section";

const supportMessages: Partial<Record<BluetoothSupport, string>> = {
  unsupported:
    "This browser does not support Web Bluetooth. Use Chrome or Edge on Android, Windows, ChromeOS or Linux.",
  insecure: "Bluetooth needs a secure connection. Open the app over HTTPS.",
  unavailable: "Bluetooth looks switched off or unavailable on this device. Turn it on and try again.",
};

type ConnectionSectionProps = {
  slug: string;
  /** The link to show, for a device type with several; otherwise the device's only one. */
  connection?: BluetoothConnection;
};

/**
 * Section 1 of a device details page: Bluetooth connection, then device information once connected.
 * For a device with a demo, also offers a simulated one to visitors who don't have the hardware.
 */
export function ConnectionSection({ slug, connection }: ConnectionSectionProps) {
  const profile = deviceProfiles[slug];
  const shown = connection ?? (profile && getConnection(profile));
  // Every device's profile includes the standard characteristics (see `deviceProfiles`).
  return shown ? (
    <ConnectionCard
      slug={slug}
      connection={shown as BluetoothConnection<StandardCharacteristic>}
      createDemo={deviceDemos[slug]}
    />
  ) : null;
}

type ConnectionCardProps = {
  slug: string;
  connection: BluetoothConnection<StandardCharacteristic>;
  createDemo?: () => DemoSimulator;
};

function ConnectionCard({ slug, connection, createDemo }: ConnectionCardProps) {
  const support = useBluetoothSupport();
  const { status, deviceName, demo } = useConnectionState(connection);

  // Bluetooth support doesn't matter while trying the demo.
  const supportMessage = demo ? undefined : supportMessages[support];
  const busy = status === "requesting" || status === "connecting";
  const linked = status === "connected" || status === "reconnecting";
  const canConnect = support === "supported" || support === "unavailable";
  const editing = useEditMode(connection);

  return (
    <DeviceSection
      title="Connection"
      description={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <ConnectionStatusChip status={status} demo={demo} />
          {deviceName && (
            <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>
              {deviceName}
            </Typography>
          )}
        </Stack>
      }
      action={
        linked ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {editing ? (
              <Button
                variant="contained"
                color="warning"
                disableElevation
                startIcon={<EditOffIcon />}
                onClick={disableEditMode}
              >
                Disable edits
              </Button>
            ) : (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                disabled={status !== "connected"}
                onClick={() => enableEditMode(connection)}
              >
                Enable edits
              </Button>
            )}
            <Button
              variant="outlined"
              color={demo ? "error" : "inherit"}
              startIcon={demo ? <ExitToAppIcon /> : <BluetoothDisabledIcon />}
              onClick={() => {
                if (editing) return warnEditMode("disconnect");
                connection.disconnect();
                if (demo) offerDemoFeedback(slug);
              }}
            >
              {demo ? "Exit demo" : "Disconnect"}
            </Button>
          </Stack>
        ) : (
          <Button
            variant="contained"
            disableElevation
            disabled={busy || !canConnect}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <BluetoothIcon />}
            onClick={() => connection.connect()}
          >
            {busy ? "Connecting…" : "Connect"}
          </Button>
        )
      }
    >
      {demo && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You&apos;re trying a demo with simulated readings. Nothing is sent to a real device.
        </Alert>
      )}
      {createDemo && status === "disconnected" && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1, sm: 2 }}
          sx={{ alignItems: { xs: "flex-start", sm: "center" }, mt: 2 }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Don&apos;t have the device? Try the demo version to interact with the device dashboard.
          </Typography>
          <Button
            size="small"
            startIcon={<PlayCircleOutlineIcon />}
            onClick={() => {
              connection.connectDemo(createDemo());
              noteDemoStarted(slug);
            }}
            sx={{ flexShrink: 0 }}
          >
            Try demo
          </Button>
        </Stack>
      )}
      {supportMessage && (
        <Alert severity={support === "unavailable" ? "warning" : "error"} sx={{ mt: 2 }}>
          {supportMessage}
        </Alert>
      )}
      {editing && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Edit mode is on. Changes you apply are sent to the device. Disable edits before leaving this page or
          disconnecting.
        </Alert>
      )}
      {status === "connected" && <DeviceInfo connection={connection} />}
    </DeviceSection>
  );
}
