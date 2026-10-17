"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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
import type {
  ActionName,
  CommandSet,
  SettingName,
  SettingType,
  SettingValue,
} from "@/lib/bluetooth/commands/schema";
import { useConnectionState, useDeviceMessages, useLastSent } from "@/lib/bluetooth/hooks";
import type { DeviceMessenger } from "@/lib/bluetooth/messaging";
import { useEditMode } from "@/lib/edit-mode";
import { showError } from "@/lib/error-toast";

type FieldValue = string | number | boolean;

/**
 * Sends one action or setting, tracking whether a send is in flight and why the last one failed,
 * including a rejection the device reports back for it.
 * `enabled` is false unless the device is connected and, for controls that change the device, edit mode is on.
 */
function useCommandSender<C extends CommandSet>(messenger: DeviceMessenger<C>, name: string, requiresEditMode = true) {
  const { status } = useConnectionState(messenger.connection);
  const editing = useEditMode(messenger.connection);
  const [pending, setPending] = useState(false);

  useDeviceMessages(messenger, ({ data }) => {
    if (data.error !== undefined && data.cmd === name) showError(`The device rejected this: ${data.error}`);
  });

  async function send(write: () => Promise<void>): Promise<boolean> {
    setPending(true);
    try {
      await write();
      return true;
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "The device did not accept the command.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { send, pending, enabled: status === "connected" && (editing || !requiresEditMode) };
}

type SettingFormProps<C extends CommandSet, S extends SettingName<C>> = {
  messenger: DeviceMessenger<C>;
  setting: S;
  title: string;
  description?: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Display labels for a setting that is one of a fixed set of values, keyed by value. */
  optionLabels?: Record<string, string>;
  /**
   * The value the device reports as current. When omitted or not yet reported, the value last
   * sent from this app during the current connection is shown instead.
   */
  reported?: SettingValue<C, S> | null;
  submitLabel?: string;
};

type InputConfig = Pick<SettingFormProps<CommandSet, string>, "label" | "unit" | "min" | "max" | "step" | "optionLabels">;

/**
 * Form that sends one setting, built from its type: numbers and text get a text field, booleans a
 * switch, and one-of-a-set values a toggle group. Shows the current value.
 */
export function SettingForm<C extends CommandSet, S extends SettingName<C>>({
  messenger,
  setting,
  title,
  description,
  reported,
  submitLabel = "Apply",
  ...config
}: SettingFormProps<C, S>) {
  const { send, pending, enabled } = useCommandSender(messenger, setting);
  const lastSent = useLastSent(messenger, setting);
  // Only what the user has changed; otherwise the current value is shown.
  const [draft, setDraft] = useState<FieldValue | null>(null);
  // An unapplied change is dropped when the form is disabled, e.g. when edit mode is turned off.
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  if (draftEnabled !== enabled) {
    setDraftEnabled(enabled);
    setDraft(null);
  }

  const type = messenger.commands.settings[setting];
  const current = (reported ?? lastSent?.value ?? null) as FieldValue | null;
  const value = draft ?? current ?? defaultValue(type);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseValue(value, type, config);
    if (typeof parsed === "object") return showError(parsed.problem);
    if (await send(() => messenger.sendSetting(setting, parsed as SettingValue<C, S>))) setDraft(null);
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
      <Typography variant="caption" component="p" sx={{ color: "text.secondary", mt: 1 }}>
        {current === null
          ? "Not reported since connecting."
          : `${reported != null ? "Reported by the device" : "Last set from this app"}: ${formatValue(current, config)}`}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <ValueInput
          type={type}
          config={config}
          value={value}
          disabled={!enabled || pending}
          onChange={setDraft}
        />
      </Box>

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

function ValueInput({
  type,
  config,
  value,
  disabled,
  onChange,
}: {
  type: SettingType;
  config: InputConfig;
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

  return (
    <TextField
      label={config.label}
      size="small"
      type={type === "number" ? "number" : "text"}
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        htmlInput: { min: config.min, max: config.max, step: config.step ?? "any" },
        input: config.unit ? { endAdornment: <InputAdornment position="end">{config.unit}</InputAdornment> } : {},
      }}
    />
  );
}

function defaultValue(type: SettingType): FieldValue {
  if (typeof type !== "string") return type[0];
  return type === "boolean" ? false : "";
}

/** Converts what the user entered to the setting's type, or explains why it cannot be. */
function parseValue(value: FieldValue, type: SettingType, config: InputConfig): FieldValue | { problem: string } {
  if (type !== "number") return typeof value === "string" ? value.trim() : value;
  const text = String(value).trim();
  const number = Number(text);
  if (text === "" || !Number.isFinite(number)) return { problem: `Enter a number for ${config.label}.` };
  if (config.min !== undefined && number < config.min)
    return { problem: `${config.label} must be at least ${formatValue(config.min, config)}.` };
  if (config.max !== undefined && number > config.max)
    return { problem: `${config.label} must be at most ${formatValue(config.max, config)}.` };
  return number;
}

function formatValue(value: FieldValue, config: InputConfig): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  const text = (typeof value === "string" && config.optionLabels?.[value]) || String(value);
  return config.unit ? `${text} ${config.unit}` : text;
}

type ActionButtonProps<C extends CommandSet> = {
  messenger: DeviceMessenger<C>;
  action: ActionName<C>;
  label: string;
  icon?: ReactNode;
  variant?: "text" | "outlined" | "contained";
  color?: "primary" | "inherit" | "error" | "warning";
  /** Asks the user to confirm with this text before sending, for commands that cannot be undone. */
  confirm?: string;
  /** False for actions that do not change the device, e.g. requesting a reading, so they work outside edit mode. */
  requiresEditMode?: boolean;
};

/** Button that sends an action, e.g. a reset or a request for a fresh reading. */
export function ActionButton<C extends CommandSet>({
  messenger,
  action,
  label,
  icon,
  variant = "outlined",
  color = "primary",
  confirm,
  requiresEditMode = true,
}: ActionButtonProps<C>) {
  const { send, pending, enabled } = useCommandSender(messenger, action, requiresEditMode);
  const [confirming, setConfirming] = useState(false);

  const sendCommand = () => {
    setConfirming(false);
    void send(() => messenger.sendAction(action));
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
