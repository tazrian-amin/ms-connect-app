import Box from "@mui/material/Box";
import type { Breakpoint } from "@mui/material/styles";
import type { Device } from "./devices";

type DeviceIconTileProps = {
  Icon: Device["Icon"];
  size?: number | Partial<Record<Breakpoint, number>>;
};

export function DeviceIconTile({ Icon, size = 56 }: DeviceIconTileProps) {
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
      <Icon width="60%" height="60%" />
    </Box>
  );
}
