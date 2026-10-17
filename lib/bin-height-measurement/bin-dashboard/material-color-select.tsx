"use client";

import { useId, useRef } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import ColorizeIcon from "@mui/icons-material/Colorize";
import { MATERIAL_PRESETS } from "./material-colors";

const CUSTOM = "custom";

type MaterialColorSelectProps = {
  /** The current colour, #rrggbb. */
  value: string;
  onChange: (color: string) => void;
};

function Swatch({ color }: { color: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 16,
        height: 16,
        borderRadius: 0.5,
        bgcolor: color,
        border: 1,
        borderColor: "divider",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Picks the colour a bin's material is drawn in: one of the common mining materials, or any
 * colour from the browser's colour picker via the last item.
 */
export function MaterialColorSelect({ value, onChange }: MaterialColorSelectProps) {
  const labelId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const preset = MATERIAL_PRESETS.find((p) => p.color.toLowerCase() === value.toLowerCase());
  const selected = preset ? preset.color : CUSTOM;

  // Opened from the item's click rather than the Select's change, so picking "Custom" again
  // while it is already selected still opens the picker.
  const openPicker = () => pickerRef.current?.click();

  return (
    <Box sx={{ position: "relative" }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id={labelId}>Material colour</InputLabel>
        <Select
          labelId={labelId}
          label="Material colour"
          value={selected}
          onChange={(event) => {
            if (event.target.value !== CUSTOM) onChange(event.target.value);
          }}
          renderValue={(v) => (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Swatch color={value} />
              <span>{MATERIAL_PRESETS.find((p) => p.color === v)?.name ?? "Custom"}</span>
            </Stack>
          )}
        >
          {MATERIAL_PRESETS.map((p) => (
            <MenuItem key={p.color} value={p.color}>
              <ListItemIcon>
                <Swatch color={p.color} />
              </ListItemIcon>
              <ListItemText>{p.name}</ListItemText>
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM} onClick={openPicker}>
            <ListItemIcon>
              {preset ? <ColorizeIcon fontSize="small" /> : <Swatch color={value} />}
            </ListItemIcon>
            <ListItemText>Custom colour…</ListItemText>
          </MenuItem>
        </Select>
      </FormControl>
      {/* Kept in the layout (not display: none) so browsers open the picker beside the Select. */}
      <input
        ref={pickerRef}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden
        style={{ position: "absolute", left: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
    </Box>
  );
}
