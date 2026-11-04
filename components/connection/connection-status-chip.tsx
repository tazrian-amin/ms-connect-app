import Chip, { type ChipProps } from "@mui/material/Chip";
import type { ConnectionStatus } from "@/lib/connection/connection";

const statusChips: Record<ConnectionStatus, { label: string; color: ChipProps["color"] }> = {
  disconnected: { label: "Not connected", color: "default" },
  requesting: { label: "Choosing device…", color: "info" },
  connecting: { label: "Connecting…", color: "info" },
  connected: { label: "Connected", color: "success" },
  reconnecting: { label: "Reconnecting…", color: "warning" },
};

const demoChip = { label: "Demo", color: "secondary" } as const;
// A cloud link that can't reach the backend keeps trying for as long as it takes, showing the last data.
const offlineChip = { label: "Offline", color: "warning" } as const;

type ConnectionStatusChipProps = {
  status: ConnectionStatus;
  /** Marks a connected simulated device (see lib/bluetooth/demo.ts). */
  demo?: boolean;
  /** Marks a device that links through the cloud (see lib/cloud/cloud.ts). */
  cloud?: boolean;
};

export function ConnectionStatusChip({ status, demo = false, cloud = false }: ConnectionStatusChipProps) {
  const { label, color } =
    demo && status === "connected" ? demoChip : cloud && status === "reconnecting" ? offlineChip : statusChips[status];
  return <Chip size="small" label={label} color={color} />;
}
