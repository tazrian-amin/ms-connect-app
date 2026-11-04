"use client";

import { useState, type SubmitEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import BluetoothDisabledIcon from "@mui/icons-material/BluetoothDisabled";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import EditIcon from "@mui/icons-material/Edit";
import EditOffIcon from "@mui/icons-material/EditOff";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutlined";
import type { BluetoothConnection } from "@/lib/connection/connection";
import { useBluetoothSupport, useConnectionState, type BluetoothSupport } from "@/lib/bluetooth/hooks";
import type { StandardCharacteristic } from "@/lib/bluetooth/profile";
import type { DemoSimulator } from "@/lib/bluetooth/demo";
import { connectCloudDevice, disconnectCloudDevice } from "@/lib/cloud/remembered-links";
import { deviceCloudSources, deviceDemos, deviceProfiles, getConnection } from "@/lib/connection/registry";
import { noteDemoStarted, offerDemoFeedback } from "@/lib/demo-feedback";
import { disableEditMode, enableEditMode, useEditMode, warnEditMode } from "@/lib/edit-mode";
import { ConnectionStatusChip } from "@/components/connection/connection-status-chip";
import { DeviceInfo } from "@/components/connection/device-info";
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
 * A device that reports to the backend instead links through the cloud by its serial number.
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
      viaCloud={deviceCloudSources[slug] !== undefined}
    />
  ) : null;
}

type ConnectionCardProps = {
  slug: string;
  connection: BluetoothConnection<StandardCharacteristic>;
  createDemo?: () => DemoSimulator;
  /** True for a device that links through the cloud rather than over Bluetooth. */
  viaCloud: boolean;
};

function ConnectionCard({ slug, connection, createDemo, viaCloud }: ConnectionCardProps) {
  const support = useBluetoothSupport();
  const { status, deviceName, demo, cloud } = useConnectionState(connection);
  const [askingSerial, setAskingSerial] = useState(false);

  // Bluetooth support doesn't matter while trying the demo, or for a device that links through the cloud.
  const supportMessage = demo || viaCloud ? undefined : supportMessages[support];
  const busy = status === "requesting" || status === "connecting";
  const linked = status === "connected" || status === "reconnecting";
  const canConnect = viaCloud || support === "supported" || support === "unavailable";
  const editing = useEditMode(connection);

  return (
    <DeviceSection
      title="Connection"
      description={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <ConnectionStatusChip status={status} demo={demo} cloud={viaCloud} />
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
              startIcon={demo ? <ExitToAppIcon /> : viaCloud ? <CloudOffIcon /> : <BluetoothDisabledIcon />}
              onClick={() => {
                if (editing) return warnEditMode("disconnect");
                if (cloud) disconnectCloudDevice(slug);
                else connection.disconnect();
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
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : viaCloud ? <CloudIcon /> : <BluetoothIcon />
            }
            onClick={() => (viaCloud ? setAskingSerial(true) : connection.connect())}
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
      {cloud && status === "reconnecting" && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          The cloud can&apos;t be reached right now, e.g. while this phone or computer is offline. Showing the last
          data received; it updates by itself once the connection is back.
        </Alert>
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
      {viaCloud && (
        <SerialNumberDialog
          slug={slug}
          open={askingSerial}
          onClose={() => setAskingSerial(false)}
          onSubmit={(serialNumber) => connectCloudDevice(slug, serialNumber)}
        />
      )}
    </DeviceSection>
  );
}

type SerialNumberDialogProps = {
  slug: string;
  open: boolean;
  onClose: () => void;
  /** Links to the unit; rejects with a message for the user if it can't. */
  onSubmit: (serialNumber: string) => Promise<void>;
};

const serialStorageKey = (slug: string) => `ms-connect:serial-number:${slug}`;

/** Asks for the serial number of a device that links through the cloud, prefilled with the last one used. */
function SerialNumberDialog({ slug, open, onClose, onSubmit }: SerialNumberDialogProps) {
  const [serialNumber, setSerialNumber] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Starts afresh each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setSerialNumber(readStoredSerial(slug));
      setProblem(null);
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = serialNumber.trim();
    if (trimmed === "") return setProblem("Enter the serial number.");
    setProblem(null);
    setPending(true);
    try {
      await onSubmit(trimmed);
      storeSerial(slug, trimmed);
      onClose();
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "Couldn't connect to the device.");
    } finally {
      setPending(false);
    }
  }

  return (
    // Stays open while connecting, so a failure can be shown and the number corrected.
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Connect through the cloud</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter the serial number printed on the device. Its latest readings are fetched from the cloud.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            margin="normal"
            label="Serial number"
            value={serialNumber}
            disabled={pending}
            error={problem !== null}
            helperText={problem}
            onChange={(event) => setSerialNumber(event.target.value)}
            slotProps={{ htmlInput: { autoCapitalize: "characters", autoComplete: "off", spellCheck: false } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            startIcon={pending ? <CircularProgress size={18} color="inherit" /> : <CloudIcon />}
          >
            {pending ? "Connecting…" : "Connect"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function readStoredSerial(slug: string): string {
  try {
    return window.localStorage.getItem(serialStorageKey(slug)) ?? "";
  } catch {
    return "";
  }
}

function storeSerial(slug: string, serialNumber: string) {
  try {
    window.localStorage.setItem(serialStorageKey(slug), serialNumber);
  } catch {
    // Storage blocked; the user types it again next time.
  }
}
