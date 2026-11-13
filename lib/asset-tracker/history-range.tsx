"use client";

import { useState } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { HistoryRange } from "./location-history";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The longest range that can be shown at once, so a request stays a sensible size. */
export const MAX_RANGE_DAYS = 31;

type Preset = { id: string; label: string; range: () => HistoryRange };

const PRESETS: Preset[] = [
  { id: "1h", label: "Last hour", range: () => ago(HOUR) },
  { id: "today", label: "Today", range: () => ({ from: new Date().setHours(0, 0, 0, 0), to: Date.now() }) },
  { id: "24h", label: "Last 24 hours", range: () => ago(DAY) },
  { id: "7d", label: "Last 7 days", range: () => ago(7 * DAY) },
];

export const DEFAULT_PRESET = "24h";

export function presetRange(id: string): HistoryRange {
  return (PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]).range();
}

function ago(span: number): HistoryRange {
  const to = Date.now();
  return { from: to - span, to };
}

type HistoryRangePickerProps = {
  range: HistoryRange;
  /** Which preset the range came from, or null for one picked by hand. */
  preset: string | null;
  onChange: (range: HistoryRange, preset: string | null) => void;
};

/** Quick ranges, plus From and To fields for any other period. */
export function HistoryRangePicker({ range, preset, onChange }: HistoryRangePickerProps) {
  // What's typed in the fields, kept apart from the applied range, so a half-edited or invalid
  // range doesn't reload the map. Reset whenever the applied range changes, e.g. from a preset.
  const [draft, setDraft] = useState({ from: toInputValue(range.from), to: toInputValue(range.to) });
  const [shown, setShown] = useState(range);
  if (shown !== range) {
    setShown(range);
    setDraft({ from: toInputValue(range.from), to: toInputValue(range.to) });
  }

  const from = fromInputValue(draft.from);
  const to = fromInputValue(draft.to);
  const error =
    from === null || to === null
      ? "Enter a start and end date."
      : from >= to
        ? "The start must be before the end."
        : to - from > MAX_RANGE_DAYS * DAY
          ? `Pick a range of ${MAX_RANGE_DAYS} days or less.`
          : null;

  const edit = (field: "from" | "to", value: string) => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    const nextFrom = fromInputValue(next.from);
    const nextTo = fromInputValue(next.to);
    if (nextFrom !== null && nextTo !== null && nextFrom < nextTo && nextTo - nextFrom <= MAX_RANGE_DAYS * DAY) {
      onChange({ from: nextFrom, to: nextTo }, null);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }} role="group" aria-label="Quick ranges">
        {PRESETS.map(({ id, label, range: makeRange }) => (
          <Chip
            key={id}
            label={label}
            clickable
            color={preset === id ? "secondary" : "default"}
            variant={preset === id ? "filled" : "outlined"}
            aria-pressed={preset === id}
            onClick={() => onChange(makeRange(), id)}
          />
        ))}
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label="From"
          type="datetime-local"
          size="small"
          value={draft.from}
          onChange={(event) => edit("from", event.target.value)}
          error={Boolean(error)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 220 }}
        />
        <TextField
          label="To"
          type="datetime-local"
          size="small"
          value={draft.to}
          onChange={(event) => edit("to", event.target.value)}
          error={Boolean(error)}
          helperText={error ?? undefined}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 220 }}
        />
      </Stack>
    </Stack>
  );
}

/** Epoch ms as the local "YYYY-MM-DDTHH:mm" a datetime-local field takes. */
function toInputValue(time: number): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local field's value (local time) as epoch ms, or null if incomplete. */
function fromInputValue(value: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}
