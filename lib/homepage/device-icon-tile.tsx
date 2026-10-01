import Box from "@mui/material/Box";
import type { Device } from "./devices";

export function DeviceIconTile({ Icon, size = 56 }: { Icon: Device["Icon"]; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: 1.5,
        bgcolor: "#ffffff",
        border: 1,
        borderColor: "divider",
      }}
    >
      <Icon width={size * 0.6} height={size * 0.6} />
    </Box>
  );
}
