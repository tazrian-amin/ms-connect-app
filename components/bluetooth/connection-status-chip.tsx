import Chip, { type ChipProps } from "@mui/material/Chip";
import type { ConnectionStatus } from "@/lib/bluetooth/connection";

const statusChips: Record<ConnectionStatus, { label: string; color: ChipProps["color"] }> = {
  disconnected: { label: "Not connected", color: "default" },
  requesting: { label: "Choosing device…", color: "info" },
  connecting: { label: "Connecting…", color: "info" },
  connected: { label: "Connected", color: "success" },
  reconnecting: { label: "Reconnecting…", color: "warning" },
};

const demoChip = { label: "Demo", color: "secondary" } as const;

/** `demo` marks a connected simulated device (see lib/bluetooth/demo.ts). */
export function ConnectionStatusChip({ status, demo = false }: { status: ConnectionStatus; demo?: boolean }) {
  const { label, color } = demo && status === "connected" ? demoChip : statusChips[status];
  return <Chip size="small" label={label} color={color} />;
}
