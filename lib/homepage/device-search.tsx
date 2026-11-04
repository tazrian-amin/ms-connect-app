"use client";

import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";

type DeviceSearchProps = {
  value: string;
  onChange: (value: string) => void;
  /** Off until view mode is on: matching results would reveal the hidden names. */
  disabled?: boolean;
};

export function DeviceSearch({ value, onChange, disabled = false }: DeviceSearchProps) {
  return (
    <TextField
      fullWidth
      disabled={disabled}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={disabled ? "Enter the view code to search devices" : "Search devices by name or description..."}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: "text.secondary", fontSize: { xs: 20, sm: 24 } }} />
            </InputAdornment>
          ),
          sx: { borderRadius: 2, py: { xs: 0, sm: 0.5 }, fontSize: { xs: "0.9375rem", sm: "1rem" } },
        },
        htmlInput: { "aria-label": "Search devices" },
      }}
    />
  );
}
