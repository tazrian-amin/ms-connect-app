"use client";

import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { PumpMonitoringPalette } from "./constants";
import type { UnavailableOptions } from "./modes";

interface ModeSectionProps<T extends string> {
  title: string;
  description: string;
  options: readonly T[];
  labels: Record<T, string>;
  /** Null until the device reports it — no option is selected. */
  value: T | null;
  onChange: (value: T) => void;
  /** Options drawn but not selectable, with the reason for each. */
  unavailable?: UnavailableOptions<T>;
  /** Read-only dashboard — the choices are inert. */
  locked?: boolean;
  /** The change is with the device; the selection holds until it answers. */
  pending?: boolean;
}

/**
 * One device mode as a row of radio choices in its own card — the Operation
 * and Alteration Mode sections are both this, configured.
 */
export function ModeSection<T extends string>({
  title,
  description,
  options,
  labels,
  value,
  onChange,
  unavailable = {},
  locked = false,
  pending = false,
}: ModeSectionProps<T>) {
  return (
    <Box
      sx={{
        mb: 2,
        bgcolor: PumpMonitoringPalette.panelBg,
        border: `1px solid ${PumpMonitoringPalette.border}`,
        borderRadius: "20px",
        px: 2,
        py: 1.75,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography
          sx={{
            color: PumpMonitoringPalette.text,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {title}
        </Typography>
        {pending && <CircularProgress size={14} />}
      </Box>
      <Typography
        sx={{
          color: PumpMonitoringPalette.textMuted,
          fontSize: 13,
          lineHeight: "20px",
        }}
      >
        {description}
      </Typography>

      <RadioGroup
        // An empty value selects nothing, rather than switching the group to
        // uncontrolled while the device has yet to report a mode.
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value as T)}
        sx={{
          mt: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 0.5, md: 3 },
        }}
      >
        {options.map((option) => {
          const reason = unavailable[option];
          return (
            // The tooltip explains a choice that can't be made; a disabled
            // control takes no pointer events, so it is set on a wrapper.
            <Tooltip key={option} title={reason ?? ""} placement="top">
              <span>
                <FormControlLabel
                  value={option}
                  disabled={locked || pending || reason !== undefined}
                  control={<Radio size="small" />}
                  label={
                    <Typography
                      sx={{
                        color: PumpMonitoringPalette.text,
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: "20px",
                        ...(reason !== undefined ? { opacity: 0.55 } : {}),
                      }}
                    >
                      {labels[option]}
                    </Typography>
                  }
                  sx={{ m: 0, gap: 0.75 }}
                />
              </span>
            </Tooltip>
          );
        })}
      </RadioGroup>
    </Box>
  );
}
