"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useColorScheme } from "@mui/material/styles";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";

type Mode = "light" | "dark" | "system";

// Clicking cycles through these in order.
const OPTIONS: { mode: Mode; label: string; Icon: typeof LightModeOutlinedIcon }[] = [
  { mode: "system", label: "System", Icon: DevicesOutlinedIcon },
  { mode: "light", label: "Light", Icon: LightModeOutlinedIcon },
  { mode: "dark", label: "Dark", Icon: DarkModeOutlinedIcon },
];

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();

  // `mode` is undefined until mounted; treat it as system until then.
  const index = Math.max(0, OPTIONS.findIndex((o) => o.mode === mode));
  const current = OPTIONS[index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];

  return (
    <Tooltip title={`Theme: ${current.label}`}>
      <IconButton
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
        onClick={() => setMode(next.mode)}
        sx={{ flexShrink: 0 }}
      >
        <current.Icon />
      </IconButton>
    </Tooltip>
  );
}
