"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import {
  PUMP_MIN_OFF_TIME_MAX,
  PUMP_MIN_OFF_TIME_MIN,
  PumpMonitoringPalette,
} from "./constants";

interface MinOffTimeSectionProps {
  /** Minutes currently applied to the device, 30–1440; null until it reports them. */
  minutes: number | null;
  /**
   * Sends the value and resolves once the device has confirmed it — false if
   * it never answered, so the button can offer the press again.
   */
  onApply: (minutes: number) => Promise<boolean>;
  /** Read-only dashboard — the field and Apply button are inert. */
  locked?: boolean;
}

/**
 * idle → applying (command sent, awaiting the device) → applied (confirmed,
 * held briefly) → idle. A device that never answers drops back to idle with
 * the value unchanged, which re-enables the button for another try.
 */
type ApplyState = "idle" | "applying" | "applied";

/** How long the confirmation stays up before the button goes quiet again. */
const APPLIED_LABEL_MS = 1800;

/**
 * Digits only, and never more than the range's maximum needs. A number input
 * still admits "-", "." and "e", and `maxLength` does not apply to it, so the
 * cap is enforced here rather than by the field.
 */
const MAX_DIGITS = String(PUMP_MIN_OFF_TIME_MAX).length;

function sanitize(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_DIGITS);
}

/**
 * The dashboard's minimum off time: how long a pump must stay off before the
 * control loop may start it again — a short-cycling guard that applies to
 * every pump. Typing alone changes nothing; the value is only sent on Apply
 * (or Enter), so a single command goes out per change, as with the sliders.
 */
export function MinOffTimeSection({
  minutes,
  onApply,
  locked = false,
}: MinOffTimeSectionProps) {
  const [draft, setDraft] = useState(() => String(minutes ?? ""));
  const [applyState, setApplyState] = useState<ApplyState>("idle");

  // A newly applied value — or the dashboard going read-only — discards
  // whatever is half-typed in the field, so a pending edit can never be
  // applied later by surprise.
  const [prevMinutes, setPrevMinutes] = useState(minutes);
  const [prevLocked, setPrevLocked] = useState(locked);
  if (minutes !== prevMinutes || locked !== prevLocked) {
    setPrevMinutes(minutes);
    setPrevLocked(locked);
    setDraft(String(minutes ?? ""));
  }

  // Drop the confirmation on its own once it has been up long enough to read.
  useEffect(() => {
    if (applyState !== "applied") return;
    const timer = setTimeout(() => setApplyState("idle"), APPLIED_LABEL_MS);
    return () => clearTimeout(timer);
  }, [applyState]);

  const parsed = draft === "" ? null : Number(draft);
  const isValid =
    parsed !== null &&
    parsed >= PUMP_MIN_OFF_TIME_MIN &&
    parsed <= PUMP_MIN_OFF_TIME_MAX;
  // Only the in-flight state blocks a new press: once confirmed, retyping
  // during the brief "Applied" window can start the next change right away.
  const isApplying = applyState === "applying";
  const canApply = !locked && !isApplying && isValid && parsed !== minutes;

  const apply = async () => {
    if (!canApply || parsed === null) return;
    setApplyState("applying");
    // A device that never confirms leaves `minutes` untouched, so returning to
    // idle is enough to put the button back the way it was — still dirty, still
    // pressable — rather than reporting a change that may not have landed.
    setApplyState((await onApply(parsed)) ? "applied" : "idle");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void apply();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        mb: 2,
        bgcolor: PumpMonitoringPalette.panelBg,
        border: `1px solid ${PumpMonitoringPalette.border}`,
        borderRadius: "20px",
        px: 2,
        py: 1.75,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color: PumpMonitoringPalette.text,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Minimum Off Time
        </Typography>
        <Typography
          sx={{
            color: PumpMonitoringPalette.textMuted,
            fontSize: 13,
            lineHeight: "20px",
          }}
        >
          How long a pump must stay off before it can start again, from{" "}
          {PUMP_MIN_OFF_TIME_MIN} to {PUMP_MIN_OFF_TIME_MAX} minutes.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <TextField
          size="small"
          type="number"
          value={draft}
          placeholder="—"
          disabled={locked || isApplying}
          onChange={(event) => setDraft(sanitize(event.target.value))}
          onKeyDown={handleKeyDown}
          slotProps={{
            htmlInput: {
              // The spinners and the arrow keys both step by 1 and stop at the
              // ends of the range; `sanitize` only has to catch typing/paste.
              min: PUMP_MIN_OFF_TIME_MIN,
              max: PUMP_MIN_OFF_TIME_MAX,
              step: 1,
              inputMode: "numeric",
              "aria-label": "Minimum off time in minutes",
            },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Typography
                    sx={{
                      color: PumpMonitoringPalette.textMuted,
                      fontSize: 13,
                    }}
                  >
                    min
                  </Typography>
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: 132,
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              bgcolor: PumpMonitoringPalette.columnBg,
            },
            // WebKit keeps the steppers hidden until hover/focus, which reads
            // as a plain text field until you touch it — keep them visible so
            // the control announces itself as steppable.
            "& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button":
              {
                opacity: 1,
                height: 22,
              },
          }}
        />

        <Button
          size="small"
          disabled={!canApply}
          onClick={() => void apply()}
          startIcon={
            applyState === "applying" ? (
              <CircularProgress size={14} color="inherit" />
            ) : applyState === "applied" ? (
              <CheckRoundedIcon sx={{ fontSize: 18 }} />
            ) : undefined
          }
          sx={{
            // Held steady across "Apply" / "Applying" / "Applied" so the row
            // doesn't shift under the pointer mid-press.
            minWidth: 124,
            px: 2.5,
            py: 0.875,
            borderRadius: "10px",
            bgcolor: PumpMonitoringPalette.resetButtonBg,
            border: `1px solid ${PumpMonitoringPalette.borderMuted}`,
            color: PumpMonitoringPalette.resetButtonText,
            fontSize: 14,
            fontWeight: 600,
            textTransform: "none",
            "&:hover": { bgcolor: PumpMonitoringPalette.resetButtonBg },
            // The confirmation has to stay legible while the button sits
            // disabled, which is exactly when MUI dims it.
            "&.Mui-disabled": {
              ...(applyState === "applied"
                ? { color: PumpMonitoringPalette.greenActive }
                : {}),
            },
          }}
        >
          {applyState === "applying"
            ? "Applying"
            : applyState === "applied"
              ? "Applied"
              : "Apply"}
        </Button>
      </Box>
    </Box>
  );
}
