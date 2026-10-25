"use client";

import { useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Button from "@mui/material/Button";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ActionButton } from "@/components/device-details/command-controls";
import { DashboardWidget } from "@/components/device-details/dashboard-widgets";
import type { dischargeWaterFlowMonitorCommands } from "@/lib/bluetooth/commands/discharge-water-flow-monitor";
import type { DeviceMessenger } from "@/lib/bluetooth/messaging";
import { VOLUME_UNITS, formatVolume, useVolumeUnit, type VolumeUnit } from "./volume-units";

type TotalVolumeWidgetProps = {
  messenger: DeviceMessenger<typeof dischargeWaterFlowMonitorCommands>;
  /** US gallons released since the last reset, or undefined until reported. */
  gallons: number | undefined;
};

/** Water released this session, in the reader's chosen unit, with a reset for the device's counter. */
export function TotalVolumeWidget({ messenger, gallons }: TotalVolumeWidgetProps) {
  const [unit, setUnit] = useVolumeUnit();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const choose = (next: VolumeUnit) => {
    setUnit(next);
    setMenuAnchor(null);
  };

  return (
    <DashboardWidget label="Total volume released">
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between", containerType: "inline-size" }}
      >
        {/* Shrinks with the tile rather than wrapping, so a large total stays on one line. */}
        <Typography
          variant="h4"
          component="p"
          sx={{
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            fontSize: "clamp(1.25rem, 11cqi, 2.125rem)",
          }}
        >
          {gallons === undefined ? "—" : formatVolume(gallons, unit)}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          endIcon={<ArrowDropDownIcon />}
          aria-label={`Volume unit: ${VOLUME_UNITS[unit].name}`}
          aria-haspopup="menu"
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ flexShrink: 0, textTransform: "none", color: "text.secondary", borderColor: "divider" }}
        >
          {VOLUME_UNITS[unit].label}
        </Button>
        <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
          {(Object.keys(VOLUME_UNITS) as VolumeUnit[]).map((option) => (
            <MenuItem key={option} selected={option === unit} onClick={() => choose(option)}>
              <ListItemText primary={VOLUME_UNITS[option].name} secondary={VOLUME_UNITS[option].label} />
            </MenuItem>
          ))}
        </Menu>
      </Stack>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Since the counter was last reset
      </Typography>
      <ActionButton
        messenger={messenger}
        action="reset_total"
        label="Reset total"
        icon={<RestartAltIcon />}
        variant="text"
        color="warning"
        confirm="The device's total volume counter will go back to zero. This cannot be undone."
      />
    </DashboardWidget>
  );
}
