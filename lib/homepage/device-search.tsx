"use client";

import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";

type DeviceSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DeviceSearch({ value, onChange }: DeviceSearchProps) {
  return (
    <TextField
      fullWidth
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search devices by name or description..."
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          sx: { borderRadius: 2, py: 0.5 },
        },
        htmlInput: { "aria-label": "Search devices" },
      }}
    />
  );
}
