"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { ConnectionStatusChip } from "@/components/connection/connection-status-chip";
import { useProfileStatus } from "@/lib/bluetooth/hooks";
import { deviceCloudSources, deviceProfiles } from "@/lib/connection/registry";
import { DeviceIconTile } from "./device-icon-tile";
import type { Device } from "./devices";

type DeviceCardProps = {
  device: Device;
  /** Whether this card's name and description show. Off, they are blurred and the card does not open. */
  revealed: boolean;
  /** The eye button and, while hidden, the card itself: shows or hides this card's details. */
  onToggleView: () => void;
};

// Shown blurred in place of the real text while the card is hidden.
const HIDDEN_NAME = "Device name hidden";
const HIDDEN_DESCRIPTION = "Use the eye button to see this device and its description.";

const hiddenText = { filter: "blur(5px)", userSelect: "none" } as const;

export function DeviceCard({ device, revealed, onToggleView }: DeviceCardProps) {
  const status = useProfileStatus(deviceProfiles[device.slug]);
  const viewLabel = revealed ? "Hide device details" : "Show device details";

  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        height: "100%",
        borderRadius: 2,
        transition: "border-color 150ms, transform 150ms",
        "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)" },
        "&:hover .device-card-cta svg": { transform: "translateX(3px)" },
      }}
    >
      <CardActionArea
        {...(revealed
          ? { component: Link, href: `/devices/${device.slug}` }
          : { onClick: onToggleView, "aria-label": "Hidden device. Show its details." })}
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          p: { xs: 2, sm: 2.5 },
        }}
      >
        {/* Right padding leaves room for the eye button, which sits outside the link. */}
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1, pr: 5 }}>
          <DeviceIconTile Icon={device.Icon} size={48} />
          {status !== "disconnected" && (
            <ConnectionStatusChip status={status} cloud={deviceCloudSources[device.slug] !== undefined} />
          )}
        </Stack>

        <Typography
          variant="h6"
          component="h3"
          sx={{ mt: 2, fontWeight: 600, fontSize: { xs: "0.9375rem", sm: "1rem" }, lineHeight: 1.4 }}
        >
          {revealed ? device.name : <Box component="span" aria-hidden sx={hiddenText}>{HIDDEN_NAME}</Box>}
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
          {revealed ? device.description : <Box component="span" aria-hidden sx={hiddenText}>{HIDDEN_DESCRIPTION}</Box>}
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
          {revealed ? "Open Device" : "Reveal Device"}
          <ArrowForwardIcon />
        </Box>
      </CardActionArea>

      <Tooltip title={viewLabel}>
        <IconButton
          aria-label={viewLabel}
          aria-pressed={revealed}
          onClick={onToggleView}
          size="small"
          sx={{ position: "absolute", top: { xs: 12, sm: 16 }, right: { xs: 12, sm: 16 }, color: "text.secondary" }}
        >
          {revealed ? <VisibilityOutlinedIcon fontSize="small" /> : <VisibilityOffOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Card>
  );
}
