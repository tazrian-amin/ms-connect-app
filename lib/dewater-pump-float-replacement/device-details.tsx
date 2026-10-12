"use client";

import { useEffect, useMemo, useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { ActionButton, SettingForm } from "@/components/device-details/command-controls";
import { DeviceDetailsLayout } from "@/components/device-details/device-details-layout";
import { DeviceSection } from "@/components/device-details/device-section";
import { MessageLog } from "@/components/device-details/message-log";
import { TelemetryLineChart, type TelemetryThreshold } from "@/components/device-details/telemetry-chart";
import {
  dewaterPumpFloatReplacementCommands,
  pumpNumbers,
  type DewaterPumpFloatReplacementData,
  type PumpNumber,
} from "@/lib/bluetooth/commands/dewater-pump-float-replacement";
import type { DeviceMessage } from "@/lib/bluetooth/commands/schema";
import { useConnectionState, useDeviceState } from "@/lib/bluetooth/hooks";
import { getMessenger, type DeviceMessenger } from "@/lib/bluetooth/messaging";
import { disableEditMode, enableEditMode, useEditMode } from "@/lib/edit-mode";
import { dewaterPumpFloatReplacementProfile } from "./bluetooth-profile";
import {
  EditsToggle,
  formatReading,
  MOTOR_CURRENT_BAND_PLACEHOLDER,
  MOTOR_CURRENT_SCALE,
  PumpMonitoringDashboard,
  PumpMonitoringPalette,
  useLastReset,
  WATER_BAND_PLACEHOLDER,
  WATER_LEVEL_SCALE,
  type AlterationMode,
  type Band,
  type OperationMode,
  type PumpDashboardState,
  type PumpTriggerBand,
  type SessionCounter,
  type UnavailableOptions,
} from "./pump-monitoring-dashboard";

type Commands = typeof dewaterPumpFloatReplacementCommands;
type Reply = DeviceMessage<Commands>["data"];

// The firmware answers within a loop pass; anything slower has been lost.
const REPLY_TIMEOUT_MS = 5_000;

// The dashboard is drawn for where the firmware is going. Controls it can't act on yet are shown
// disabled with this reason, and come to life as the firmware adds the commands behind them.
const NOT_IN_FIRMWARE = "Not supported by the device's firmware yet.";

const UNRESETTABLE_COUNTERS: UnavailableOptions<SessionCounter> = {
  runtime: "The device doesn't track runtime yet.",
};

/**
 * Sends a command and waits for the device to answer it. Resolves null once a reply passes
 * `confirmed`, otherwise why not: the device rejected it, never answered, or the write failed.
 */
function sendAndConfirm(
  messenger: DeviceMessenger<Commands>,
  name: string,
  send: () => Promise<void>,
  confirmed: (reply: Reply) => boolean,
): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (problem: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(problem);
    };
    const timer = setTimeout(() => finish("The device did not answer."), REPLY_TIMEOUT_MS);
    const unsubscribe = messenger.subscribe(({ data }) => {
      if (data.error !== undefined && data.cmd === name) finish(`The device rejected this: ${data.error}`);
      else if (confirmed(data)) finish(null);
    });
    // `send` can throw before it returns a promise, e.g. for a value of the wrong type.
    Promise.resolve()
      .then(send)
      .catch((cause: unknown) =>
        finish(cause instanceof Error ? cause.message : "The device did not accept the command."),
      );
  });
}

// The dashboard is drawn in feet; the firmware reports and accepts metres.
const FEET_PER_METRE = 3.28084;

/** Metres from the device as feet, to the tenth the dashboard shows. */
function toFeet(metres: number): number {
  return Math.round(metres * FEET_PER_METRE * 10) / 10;
}

/** Feet from the dashboard as metres, to the hundredth the firmware keeps. */
function toMetres(feet: number): number {
  return Math.round((feet / FEET_PER_METRE) * 100) / 100;
}

/** A band the device reports in metres, in feet; null until both ends are reported. */
function toFeetBand(high: number | undefined, low: number | undefined): Band | null {
  return high === undefined || low === undefined ? null : { high: toFeet(high), low: toFeet(low) };
}

/**
 * The firmware keeps one `pump_logic_mode` where the dashboard has two choices, so the two are read
 * out of it: winter is an operation mode, alteration (by starts) an alteration mode, and the
 * firmware can't run both at once.
 */
function toOperationMode(mode: DewaterPumpFloatReplacementData["pump_logic_mode"]): OperationMode | null {
  if (mode === undefined) return null;
  return mode === "winter" ? "winter" : "normal";
}

function toAlterationMode(mode: DewaterPumpFloatReplacementData["pump_logic_mode"]): AlterationMode | null {
  if (mode === undefined) return null;
  return mode === "alteration" ? "starts" : "off";
}

/** Everything the dashboard draws, from what the device has reported so far. */
function toDashboardState(data: DewaterPumpFloatReplacementData): PumpDashboardState {
  return {
    waterLevel: data.current_water_level === undefined ? null : toFeet(data.current_water_level),
    waterBand: toFeetBand(data.water_high_thr, data.water_low_thr),
    // The firmware reports no live current, and keeps its current thresholds in raw ADC counts,
    // which have no known scale to amps.
    motorCurrent: null,
    currentBand: null,
    pumps: pumpNumbers.map((pump) => ({
      id: pump,
      enabled: data[`pump_${pump}_enabled`] ?? null,
      isOn: null, // Not reported by the firmware.
      faulted: data[`pump_${pump}_fault`] ?? null,
      totalRuntimeSeconds: null, // Not reported by the firmware.
      currentRuntimeSeconds: null,
      totalStarts: data[`pump_${pump}_total_starts`] ?? null,
      currentStarts: data[`pump_${pump}_current_starts`] ?? null,
    })),
    // The firmware does not say which pump answers which column, so each column is its own pump.
    columns: pumpNumbers.map((pump) => ({
      number: pump,
      pumpId: pump,
      band: toFeetBand(data[`column_${pump}_high_thr`], data[`column_${pump}_low_thr`]),
    })),
    operationMode: toOperationMode(data.pump_logic_mode),
    alterationMode: toAlterationMode(data.pump_logic_mode),
    minOffTimeMinutes: data.pump_min_off_time_min ?? null,
  };
}

/**
 * A band's two ends as dashed chart lines: Max in the alarm red, Min in amber. A band the device
 * hasn't reported is drawn where its sliders rest, and named "—" as they are.
 */
function bandThresholds(
  band: Band | null,
  placeholder: Band,
  name: (end: "Max" | "Min", value: string) => string,
): TelemetryThreshold[] {
  const shown = band ?? placeholder;
  const value = (level: number) => (band ? formatReading(level) : "—");
  return [
    { label: name("Max", value(shown.high)), value: shown.high, color: PumpMonitoringPalette.redActive },
    { label: name("Min", value(shown.low)), value: shown.low, color: PumpMonitoringPalette.amberActive },
  ];
}

export function DewaterPumpFloatReplacementDetails() {
  const messenger = getMessenger(dewaterPumpFloatReplacementProfile, dewaterPumpFloatReplacementCommands);
  const { data } = useDeviceState(messenger);
  const { status } = useConnectionState(messenger.connection);
  const editing = useEditMode(messenger.connection);
  const { lastReset, markReset } = useLastReset(data.serial_number ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const connected = status === "connected";
  const state = useMemo(() => toDashboardState(data), [data]);

  // Fill the dashboard as soon as the link is up rather than waiting for Refresh. The serial
  // number from get_config is what the last-reset dates are filed under.
  useEffect(() => {
    if (!connected) return;
    messenger
      .sendAction("get_pump_states")
      .then(() => messenger.sendAction("get_config"))
      .catch(() => {});
  }, [connected, messenger]);

  /** Sends a command for the dashboard, reporting any failure, and resolves whether it landed. */
  async function confirm(name: string, send: () => Promise<void>, confirmed: (reply: Reply) => boolean) {
    const failure = await sendAndConfirm(messenger, name, send, confirmed);
    if (failure !== null) setProblem(failure);
    return failure === null;
  }

  function setPumpLogicMode(mode: (typeof dewaterPumpFloatReplacementCommands.settings.pump_logic_mode)[number]) {
    return confirm(
      "pump_logic_mode",
      () => messenger.sendSetting("pump_logic_mode", mode),
      (reply) => reply.pump_logic_mode === mode,
    );
  }

  // Firmware gaps, plus the pairs its single logic mode can't hold at once.
  const unavailableOperationModes: UnavailableOptions<OperationMode> = {
    flush: NOT_IN_FIRMWARE,
    ...(state.alterationMode === "starts" && {
      winter: "The firmware can't run winter mode with alteration yet. Turn alteration off first.",
    }),
  };
  const unavailableAlterationModes: UnavailableOptions<AlterationMode> = {
    runtime: NOT_IN_FIRMWARE,
    ...(state.operationMode === "winter" && {
      starts: "The firmware can't run alteration in winter mode yet. Switch to Normal first.",
    }),
  };

  return (
    <>
      <DeviceDetailsLayout
        slug="dewater-pump-float-replacement"
        controls={
          <DeviceSection
            title="Pump Monitoring"
            description="Monitor water level, control pump trigger levels, and track runtime."
            action={
              <EditsToggle
                editing={editing}
                disabled={!connected}
                onChange={(next) => (next ? enableEditMode(messenger.connection) : disableEditMode())}
              />
            }
          >
            <Box sx={{ mt: 2 }}>
              <PumpMonitoringDashboard
                state={state}
                locked={!(editing && connected)}
                unavailableOperationModes={unavailableOperationModes}
                unavailableAlterationModes={unavailableAlterationModes}
                unresettableCounters={UNRESETTABLE_COUNTERS}
                lastReset={lastReset}
                onPumpEnabledChange={(pumpId, enabled) => {
                  const pump = pumpId as PumpNumber;
                  return confirm(
                    `pump_${pump}_set_enable`,
                    () => messenger.sendSetting(`pump_${pump}_set_enable`, enabled),
                    (reply) => reply[`pump_${pump}_enabled`] !== undefined,
                  );
                }}
                onColumnTriggerLevelChange={(columnNumber, band: PumpTriggerBand, level) => {
                  const pump = columnNumber as PumpNumber;
                  const setting =
                    band === "high" ? (`pump_${pump}_set_high` as const) : (`pump_${pump}_set_low` as const);
                  return confirm(
                    setting,
                    () => messenger.sendSetting(setting, toMetres(level)),
                    (reply) => reply[`column_${pump}_${band}_thr`] !== undefined,
                  );
                }}
                onWaterBandChange={(band, level) => {
                  const setting = band === "high" ? "set_water_high_thr_m" : "set_water_low_thr_m";
                  return confirm(
                    setting,
                    () => messenger.sendSetting(setting, toMetres(level)),
                    (reply) => reply[`water_${band}_thr`] !== undefined,
                  );
                }}
                // No onCurrentBandChange: the firmware takes current thresholds in ADC counts (set
                // in the Device card below), not the amps this column is drawn in.
                // Normal and winter map straight onto the firmware's logic mode; flush has no
                // command yet, and is never offered.
                onOperationModeChange={(mode) => (mode === "flush" ? false : setPumpLogicMode(mode))}
                // Only reachable from normal operation (see unavailableAlterationModes), so turning
                // alteration off is a return to normal. Run-time alteration has no command yet.
                onAlterationModeChange={(mode) =>
                  mode === "runtime" ? false : setPumpLogicMode(mode === "starts" ? "alteration" : "normal")
                }
                onMinOffTimeChange={(minutes) =>
                  confirm(
                    "set_pump_cooldown_min",
                    () => messenger.sendSetting("set_pump_cooldown_min", minutes),
                    (reply) => reply.pump_min_off_time_min === minutes,
                  )
                }
                onResetCounter={async (counter) => {
                  if (counter !== "starts") return false;
                  const reset = await confirm(
                    "reset_pump_count",
                    () => messenger.sendSetting("reset_pump_count", true),
                    (reply) => pumpNumbers.every((pump) => reply[`pump_${pump}_current_starts`] === 0),
                  );
                  if (reset) markReset("starts");
                  return reset;
                }}
              />
            </Box>
          </DeviceSection>
        }
        telemetry={
          <>
            <DeviceSection title="Water Level Telemetry">
              <TelemetryLineChart
                label={`Water Level (${WATER_LEVEL_SCALE.unit})`}
                unit={WATER_LEVEL_SCALE.unit}
                color={PumpMonitoringPalette.waterActive}
                max={WATER_LEVEL_SCALE.max}
                thresholds={bandThresholds(
                  state.waterBand,
                  WATER_BAND_PLACEHOLDER,
                  (end, value) => `${end} Threshold (${value})`,
                )}
                thresholdLabels="legend"
                emptyMessage="Waiting for water level readings from the device…"
              />
            </DeviceSection>
            <DeviceSection title="Motor Current Telemetry">
              <TelemetryLineChart
                label="Motor Current (Arms)"
                unit={MOTOR_CURRENT_SCALE.unit}
                color={PumpMonitoringPalette.currentActive}
                max={MOTOR_CURRENT_SCALE.max}
                thresholds={bandThresholds(
                  state.currentBand,
                  MOTOR_CURRENT_BAND_PLACEHOLDER,
                  (end, value) => `${end} ${value} ${MOTOR_CURRENT_SCALE.unit}`,
                )}
                emptyMessage="Waiting for motor current readings from the device…"
              />
            </DeviceSection>
          </>
        }
        diagnostics={
          <>
            {/* Device details and settings the pump monitoring card doesn't cover. The current
                thresholds are here because the firmware keeps them in ADC counts, which the motor
                current column, drawn in amps, can't show. */}
            <DeviceSection
              title="Device"
              description={
                data.embedded_software_ver
                  ? `Firmware ${data.embedded_software_ver} · Serial ${data.serial_number ?? "—"}`
                  : "Press Device info."
              }
              action={
                <Stack direction="row" spacing={1}>
                  <ActionButton
                    messenger={messenger}
                    action="get_status"
                    label="Device info"
                    requiresEditMode={false}
                  />
                  <ActionButton
                    messenger={messenger}
                    action="get_pump_states"
                    label="Refresh"
                    icon={<RefreshIcon />}
                    requiresEditMode={false}
                  />
                </Stack>
              }
            >
              <Stack spacing={2} sx={{ mt: 2 }}>
                <SettingForm
                  messenger={messenger}
                  setting="set_current_sens_high_thr"
                  title="Over-current threshold"
                  description="At or above this reading every pump stops with a fault."
                  label="Threshold"
                  unit="ADC"
                  min={0}
                  max={4095}
                  step={1}
                  reported={data.current_high_thr}
                />
                <SettingForm
                  messenger={messenger}
                  setting="set_current_sens_low_thr"
                  title="Under-current threshold"
                  label="Threshold"
                  unit="ADC"
                  min={0}
                  max={4095}
                  step={1}
                  reported={data.current_low_thr}
                />
                <SettingForm
                  messenger={messenger}
                  setting="ble_data_interval_s"
                  title="Bluetooth data interval"
                  description="How often the device sends the water level and pump start counts."
                  label="Interval"
                  unit="s"
                  min={1}
                  max={3600}
                  step={1}
                  // The firmware reports the interval under a different name for each command that reads it.
                  reported={data.ble_data_interval_s ?? data.sample_period_s ?? data.period_s}
                />
              </Stack>
            </DeviceSection>
            <MessageLog messenger={messenger} />
          </>
        }
      />
      <Snackbar
        open={problem !== null}
        autoHideDuration={6_000}
        onClose={(_, reason) => reason !== "clickaway" && setProblem(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setProblem(null)} sx={{ width: "100%" }}>
          {problem}
        </Alert>
      </Snackbar>
    </>
  );
}
