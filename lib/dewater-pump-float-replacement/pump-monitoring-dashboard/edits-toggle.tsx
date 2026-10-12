"use client";

import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import type { SxProps, Theme } from "@mui/material/styles";
import ToggleButton from "@mui/material/ToggleButton";

import { PumpMonitoringPalette } from "./constants";

const toggleSx: SxProps<Theme> = {
  gap: 0.75,
  px: 1.5,
  py: 0.75,
  flexShrink: 0,
  alignSelf: { xs: "flex-start", sm: "center" },
  borderRadius: "10px",
  borderColor: PumpMonitoringPalette.borderMuted,
  color: PumpMonitoringPalette.textMuted,
  fontSize: 13,
  fontWeight: 600,
  textTransform: "none",
  whiteSpace: "nowrap",
  lineHeight: 1.2,
  "&.Mui-selected": {
    color: PumpMonitoringPalette.text,
    borderColor: PumpMonitoringPalette.greenActive,
    bgcolor: PumpMonitoringPalette.editUnlockedBg,
    "&:hover": { bgcolor: PumpMonitoringPalette.editUnlockedBg },
  },
  "&.Mui-disabled": {
    borderColor: PumpMonitoringPalette.borderMuted,
    color: PumpMonitoringPalette.textMuted,
    opacity: 0.45,
  },
};

interface EditsToggleProps {
  /** Whether edits are unlocked. */
  editing: boolean;
  /** Edits can't be unlocked at all, e.g. while no device is connected. */
  disabled?: boolean;
  onChange: (editing: boolean) => void;
}

/**
 * Every dashboard control may change the real machine, so it opens read-only
 * and the user opts in here before anything can be changed by accident.
 */
export function EditsToggle({
  editing,
  disabled = false,
  onChange,
}: EditsToggleProps) {
  return (
    <ToggleButton
      value="edits"
      size="small"
      selected={editing}
      disabled={disabled}
      onChange={() => onChange(!editing)}
      sx={toggleSx}
    >
      {editing ? (
        <LockOutlinedIcon sx={{ fontSize: 17 }} />
      ) : (
        <LockOpenOutlinedIcon sx={{ fontSize: 17 }} />
      )}
      {editing ? "Disable Edits" : "Enable Edits"}
    </ToggleButton>
  );
}
