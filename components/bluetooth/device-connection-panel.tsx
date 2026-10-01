"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import BluetoothDisabledIcon from "@mui/icons-material/BluetoothDisabled";
import { useBluetoothSupport, useDeviceConnection, type BluetoothSupport } from "@/lib/bluetooth/hooks";
import type { DeviceProfile, StandardCharacteristic } from "@/lib/bluetooth/profile";
import { deviceProfiles } from "@/lib/bluetooth/registry";
import { ConnectionStatusChip } from "./connection-status-chip";
import { DeviceInfo } from "./device-info";

const supportMessages: Partial<Record<BluetoothSupport, string>> = {
  unsupported:
    "This browser does not support Web Bluetooth. Use Chrome or Edge on Android, Windows, ChromeOS or Linux.",
  insecure: "Bluetooth needs a secure connection. Open the app over HTTPS.",
  unavailable: "Bluetooth looks switched off or unavailable on this device. Turn it on and try again.",
};

export function DeviceConnectionPanel({ slug }: { slug: string }) {
  const profile = deviceProfiles[slug];
  return profile ? <ConnectionCard profile={profile} /> : null;
}

function ConnectionCard({ profile }: { profile: DeviceProfile<StandardCharacteristic> }) {
  const support = useBluetoothSupport();
  const { connection, status, deviceName, error } = useDeviceConnection(profile);

  const supportMessage = supportMessages[support];
  const busy = status === "requesting" || status === "connecting";
  const linked = status === "connected" || status === "reconnecting";
  const canConnect = support === "supported" || support === "unavailable";

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
      >
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            Bluetooth connection
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
            <ConnectionStatusChip status={status} />
            {deviceName && (
              <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>
                {deviceName}
              </Typography>
            )}
          </Stack>
        </Stack>

        {linked ? (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<BluetoothDisabledIcon />}
            onClick={() => connection.disconnect()}
          >
            Disconnect
          </Button>
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
        )}
      </Stack>

      {supportMessage && (
        <Alert severity={support === "unavailable" ? "warning" : "error"} sx={{ mt: 2 }}>
          {supportMessage}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {status === "connected" && <DeviceInfo connection={connection} />}
    </Card>
  );
}
