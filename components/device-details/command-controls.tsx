"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { CommandData, CommandSet, CommandType, FieldType } from "@/lib/bluetooth/commands/schema";
import { useConnectionState, useLastSentCommand } from "@/lib/bluetooth/hooks";
import type { DeviceMessenger } from "@/lib/bluetooth/messaging";
import { useEditMode } from "@/lib/edit-mode";

type FieldValue = string | number | boolean;

export type CommandFieldConfig = {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Display labels for a field that is one of a fixed set of values, keyed by value. */
  optionLabels?: Record<string, string>;
};

/** Commands whose `data` has no fields, i.e. ones a plain button can send. */
type FieldlessCommandType<C extends CommandSet> = {
  [T in CommandType<C>]: keyof C["toDevice"][T] extends never ? T : never;
}[CommandType<C>];

/**
 * Sends commands for one control, tracking whether a send is in flight and why the last one failed.
 * `enabled` is false unless the device is connected and, for controls that change the device, edit mode is on.
 */
function useCommandSender<C extends CommandSet>(messenger: DeviceMessenger<C>, requiresEditMode = true) {
  const { status } = useConnectionState(messenger.connection);
  const editing = useEditMode(messenger.connection);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send<T extends CommandType<C>>(type: T, data: CommandData<C, T>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await messenger.send(type, data);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The device did not accept the command.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { send, pending, error, setError, enabled: status === "connected" && (editing || !requiresEditMode) };
}

type CommandFormProps<C extends CommandSet, T extends CommandType<C>> = {
  messenger: DeviceMessenger<C>;
  command: T;
  title: string;
  description?: string;
  /** Label and input options for each field of the command's `data`. */
  fields: { [F in keyof CommandData<C, T>]: CommandFieldConfig };
  /**
   * Values the device reports as current, e.g. from a settings message. When omitted, the values
   * last sent from this app during the current connection are shown instead.
   */
  reported?: CommandData<C, T> | null;
  submitLabel?: string;
};

/**
 * Form that sends one command with fields, built from the command's schema: numbers and text get
 * a text field, booleans a switch, and one-of-a-set values a toggle group. Shows the current values.
 */
export function CommandForm<C extends CommandSet, T extends CommandType<C>>({
  messenger,
  command,
  title,
  description,
  fields,
  reported,
  submitLabel = "Apply",
}: CommandFormProps<C, T>) {
  const { send, pending, error, setError, enabled } = useCommandSender(messenger);
  const lastSent = useLastSentCommand(messenger, command);
  // Only what the user has changed; everything else shows the current value.
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});
  // Unapplied changes are dropped when the form is disabled, e.g. when edit mode is turned off.
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  if (draftEnabled !== enabled) {
    setDraftEnabled(enabled);
    setDraft({});
    setError(null);
  }

  const schema = messenger.commands.toDevice[command];
  const configs = fields as Record<string, CommandFieldConfig>;
  const current = (reported ?? lastSent?.data ?? null) as Record<string, FieldValue> | null;
  const valueOf = (field: string): FieldValue => draft[field] ?? current?.[field] ?? defaultValue(schema[field]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const data: Record<string, unknown> = {};
    for (const [field, type] of Object.entries(schema)) {
      const parsed = parseField(valueOf(field), type, configs[field]);
      if (typeof parsed === "object" && "problem" in parsed) return setError(parsed.problem);
      data[field] = parsed;
    }
    if (await send(command, data as CommandData<C, T>)) setDraft({});
  }

  return (
    <Paper variant="outlined" component="form" onSubmit={handleSubmit} noValidate sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {description}
        </Typography>
      )}
      <CurrentValues
        current={current}
        source={reported ? "Reported by the device" : "Last set from this app"}
        configs={configs}
      />

      <Stack spacing={2} sx={{ mt: 2 }}>
        {Object.entries(schema).map(([field, type]) => (
          <FieldInput
            key={field}
            type={type}
            config={configs[field]}
            value={valueOf(field)}
            disabled={!enabled || pending}
            onChange={(value) => setDraft((previous) => ({ ...previous, [field]: value }))}
          />
        ))}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="submit"
          variant="contained"
          disableElevation
          disabled={!enabled || pending}
          startIcon={pending && <CircularProgress size={18} color="inherit" />}
        >
          {submitLabel}
        </Button>
      </Box>
    </Paper>
  );
}

function CurrentValues({
  current,
  source,
  configs,
}: {
  current: Record<string, FieldValue> | null;
  source: string;
  configs: Record<string, CommandFieldConfig>;
}) {
  if (!current) {
    return (
      <Typography variant="caption" component="p" sx={{ color: "text.secondary", mt: 1 }}>
        Not set since connecting.
      </Typography>
    );
  }
  const shown = Object.entries(configs)
    .filter(([field]) => current[field] !== undefined)
    .map(([field, config]) => `${config.label}: ${formatValue(current[field], config)}`);
  return (
    <Typography variant="caption" component="p" sx={{ color: "text.secondary", mt: 1 }}>
      {source}: {shown.join(" · ")}
    </Typography>
  );
}

function FieldInput({
  type,
  config,
  value,
  disabled,
  onChange,
}: {
  type: FieldType;
  config: CommandFieldConfig;
  value: FieldValue;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
}) {
  if (typeof type !== "string") {
    return (
      <Stack spacing={0.5}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {config.label}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={value}
          disabled={disabled}
          onChange={(_, selected: string | null) => selected !== null && onChange(selected)}
        >
          {type.map((option) => (
            <ToggleButton key={option} value={option} sx={{ px: 2 }}>
              {config.optionLabels?.[option] ?? option}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
    );
  }

  if (type === "boolean") {
    return (
      <FormControlLabel
        label={config.label}
        disabled={disabled}
        control={<Switch checked={value === true} onChange={(event) => onChange(event.target.checked)} />}
      />
    );
  }

  // Arrays are entered comma-separated.
  return (
    <TextField
      label={config.label}
      size="small"
      type={type === "number" ? "number" : "text"}
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      helperText={type.endsWith("[]") ? "Separate values with commas" : undefined}
      slotProps={{
        htmlInput: { min: config.min, max: config.max, step: config.step ?? "any" },
        input: config.unit ? { endAdornment: <InputAdornment position="end">{config.unit}</InputAdornment> } : {},
      }}
    />
  );
}

function defaultValue(type: FieldType): FieldValue {
  if (typeof type !== "string") return type[0];
  return type === "boolean" ? false : "";
}

/** Converts what the user entered to the field's type, or explains why it cannot be. */
function parseField(
  value: FieldValue,
  type: FieldType,
  config: CommandFieldConfig,
): FieldValue | string[] | number[] | boolean[] | { problem: string } {
  if (typeof type !== "string" || type === "boolean") return value;
  const text = String(value).trim();
  if (type === "string") return text;
  if (type === "string[]") return text.split(",").map((item) => item.trim());
  if (type === "boolean[]") return text.split(",").map((item) => item.trim() === "true");

  const parseNumber = (item: string): number | { problem: string } => {
    const number = Number(item);
    if (item === "" || !Number.isFinite(number)) return { problem: `Enter a number for ${config.label}.` };
    if (config.min !== undefined && number < config.min)
      return { problem: `${config.label} must be at least ${formatValue(config.min, config)}.` };
    if (config.max !== undefined && number > config.max)
      return { problem: `${config.label} must be at most ${formatValue(config.max, config)}.` };
    return number;
  };
  if (type === "number") return parseNumber(text);

  const numbers: number[] = [];
  for (const item of text.split(",")) {
    const parsed = parseNumber(item.trim());
    if (typeof parsed === "object") return parsed;
    numbers.push(parsed);
  }
  return numbers;
}

function formatValue(value: unknown, config: CommandFieldConfig): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  const text = (typeof value === "string" && config.optionLabels?.[value]) || String(value);
  return config.unit ? `${text} ${config.unit}` : text;
}

type CommandButtonProps<C extends CommandSet, T extends FieldlessCommandType<C>> = {
  messenger: DeviceMessenger<C>;
  command: T;
  label: string;
  icon?: ReactNode;
  variant?: "text" | "outlined" | "contained";
  color?: "primary" | "inherit" | "error" | "warning";
  /** Asks the user to confirm with this text before sending, for commands that cannot be undone. */
  confirm?: string;
  /** False for commands that do not change the device, e.g. requesting a reading, so they work outside edit mode. */
  requiresEditMode?: boolean;
};

/** Button that sends a command with no fields, e.g. a reset or a request for a fresh reading. */
export function CommandButton<C extends CommandSet, T extends FieldlessCommandType<C>>({
  messenger,
  command,
  label,
  icon,
  variant = "outlined",
  color = "primary",
  confirm,
  requiresEditMode = true,
}: CommandButtonProps<C, T>) {
  const { send, pending, error, setError, enabled } = useCommandSender(messenger, requiresEditMode);
  const [confirming, setConfirming] = useState(false);

  const sendCommand = () => {
    setConfirming(false);
    void send(command, {} as CommandData<C, T>);
  };

  return (
    <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
      <Button
        variant={variant}
        color={color}
        disableElevation
        disabled={!enabled || pending}
        startIcon={pending ? <CircularProgress size={18} color="inherit" /> : icon}
        onClick={() => (confirm ? setConfirming(true) : sendCommand())}
      >
        {label}
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ alignSelf: "stretch" }}>
          {error}
        </Alert>
      )}
      {confirm && (
        <Dialog open={confirming} onClose={() => setConfirming(false)}>
          <DialogTitle>{label}?</DialogTitle>
          <DialogContent>
            <DialogContentText>{confirm}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button color={color === "inherit" ? "primary" : color} onClick={sendCommand}>
              {label}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}
