"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import { DeviceIconTile } from "./device-icon-tile";
import type { Device } from "./devices";

export function DeviceCard({ device }: { device: Device }) {
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
        <Typography variant="h6" component="h3" sx={{ fontWeight: 600, fontSize: "1.125rem" }}>
          <span aria-hidden>{device.emoji}</span> {device.name}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
