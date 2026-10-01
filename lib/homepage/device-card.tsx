"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ConnectionStatusChip } from "@/components/bluetooth/connection-status-chip";
import { useDeviceConnection } from "@/lib/bluetooth/hooks";
import { deviceProfiles } from "@/lib/bluetooth/registry";
import { DeviceIconTile } from "./device-icon-tile";
import type { Device } from "./devices";

export function DeviceCard({ device }: { device: Device }) {
  const { status } = useDeviceConnection(deviceProfiles[device.slug]);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        transition: "border-color 150ms",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/devices/${device.slug}`}
        sx={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-start", gap: 2, p: 2.5 }}
      >
        <DeviceIconTile Icon={device.Icon} />
        <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, fontSize: "1.125rem" }}>
            <span aria-hidden>{device.emoji}</span> {device.name}
          </Typography>
          {status !== "disconnected" && <ConnectionStatusChip status={status} />}
        </Stack>
      </CardActionArea>
    </Card>
  );
}
