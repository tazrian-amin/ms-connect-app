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
