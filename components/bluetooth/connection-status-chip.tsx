import Chip, { type ChipProps } from "@mui/material/Chip";
import type { ConnectionStatus } from "@/lib/bluetooth/connection";

const statusChips: Record<ConnectionStatus, { label: string; color: ChipProps["color"] }> = {
  disconnected: { label: "Not connected", color: "default" },
  requesting: { label: "Choosing device…", color: "info" },
  connecting: { label: "Connecting…", color: "info" },
  connected: { label: "Connected", color: "success" },
  reconnecting: { label: "Reconnecting…", color: "warning" },
};

export function ConnectionStatusChip({ status }: { status: ConnectionStatus }) {
  const { label, color } = statusChips[status];
  return <Chip size="small" label={label} color={color} />;
}
