"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ConnectionStatusChip } from "@/components/bluetooth/connection-status-chip";
import { useProfileStatus } from "@/lib/bluetooth/hooks";
import { deviceProfiles } from "@/lib/bluetooth/registry";
import { DeviceIconTile } from "./device-icon-tile";
import type { Device } from "./devices";

export function DeviceCard({ device }: { device: Device }) {
  const status = useProfileStatus(deviceProfiles[device.slug]);

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        transition: "border-color 150ms, transform 150ms",
        "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)" },
        "&:hover .device-card-cta svg": { transform: "translateX(3px)" },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/devices/${device.slug}`}
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          p: { xs: 2, sm: 2.5 },
        }}
      >
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <DeviceIconTile Icon={device.Icon} size={48} />
          {status !== "disconnected" && <ConnectionStatusChip status={status} />}
        </Stack>

        <Typography
          variant="h6"
          component="h3"
          sx={{ mt: 2, fontWeight: 600, fontSize: { xs: "0.9375rem", sm: "1rem" }, lineHeight: 1.4 }}
        >
          {device.name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 0.75,
            color: "text.secondary",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {device.description}
        </Typography>

        <Box
          className="device-card-cta"
          sx={{
            mt: "auto",
            pt: 2,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "text.primary",
            "& svg": { fontSize: 16, color: "primary.main", transition: "transform 150ms" },
          }}
        >
          Open Device
          <ArrowForwardIcon />
        </Box>
      </CardActionArea>
    </Card>
  );
}
