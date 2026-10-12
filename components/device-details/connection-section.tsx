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
import type { BluetoothConnection } from "@/lib/bluetooth/connection";
import { useBluetoothSupport, useConnectionState, type BluetoothSupport } from "@/lib/bluetooth/hooks";
import type { StandardCharacteristic } from "@/lib/bluetooth/profile";
import { deviceProfiles, getConnection } from "@/lib/bluetooth/registry";
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

/** Section 1 of a device details page: Bluetooth connection, then device information once connected. */
export function ConnectionSection({ slug, connection }: ConnectionSectionProps) {
  const profile = deviceProfiles[slug];
  const shown = connection ?? (profile && getConnection(profile));
  // Every device's profile includes the standard characteristics (see `deviceProfiles`).
  return shown ? <ConnectionCard connection={shown as BluetoothConnection<StandardCharacteristic>} /> : null;
}

function ConnectionCard({ connection }: { connection: BluetoothConnection<StandardCharacteristic> }) {
  const support = useBluetoothSupport();
  const { status, deviceName, error } = useConnectionState(connection);

  const supportMessage = supportMessages[support];
  const busy = status === "requesting" || status === "connecting";
  const linked = status === "connected" || status === "reconnecting";
  const canConnect = support === "supported" || support === "unavailable";
  const editing = useEditMode(connection);

  return (
    <DeviceSection
      title="Connection"
      description={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <ConnectionStatusChip status={status} />
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
              color="inherit"
              startIcon={<BluetoothDisabledIcon />}
              onClick={() => (editing ? warnEditMode("disconnect") : connection.disconnect())}
            >
              Disconnect
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
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {status === "connected" && <DeviceInfo connection={connection} />}
    </DeviceSection>
  );
}
