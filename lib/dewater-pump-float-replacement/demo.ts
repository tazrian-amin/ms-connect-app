import {
  dewaterPumpFloatReplacementCommands,
  pumpLogicModes,
  pumpNumbers,
} from "@/lib/bluetooth/commands/dewater-pump-float-replacement";
import type { DemoReply, DemoSimulator } from "@/lib/bluetooth/demo";
import { MOTOR_CURRENT_MAX_AMPS } from "./pump-monitoring-dashboard/constants";

type Commands = typeof dewaterPumpFloatReplacementCommands;
type Reply = DemoReply<Commands>;

const DEFAULT_INTERVAL_S = 2;
const ADC_MAX = 4095;
// Water levels are heights in m, 0–20 as the firmware reports them.
const LEVEL_MAX_M = 18;
// What one running pump takes out of the sump per second, in m.
const PUMP_OUTFLOW_M_PER_S = 0.045;
// What one running pump draws, in amps.
const PUMP_AMPS = 175;

/*
 * The firmware reports motor current and its thresholds in raw ADC counts with no agreed scale to
 * amps yet. The demo takes full scale to be the gauge's full range, so the motor current column
 * and chart can show what they will once the scale is known.
 */
const AMPS_PER_COUNT = MOTOR_CURRENT_MAX_AMPS / ADC_MAX;

/** Motor current ADC counts from the demo device, in amps. */
export function demoCountsToAmps(counts: number): number {
  return Math.round(counts * AMPS_PER_COUNT);
}

/** Amps from the dashboard, as the ADC counts the demo device takes. */
export function demoAmpsToCounts(amps: number): number {
  return Math.min(ADC_MAX, Math.max(0, Math.round(amps / AMPS_PER_COUNT)));
}

type Pump = {
  number: number;
  enabled: boolean;
  on: boolean;
  totalStarts: number;
  currentStarts: number;
  totalRuntime: number;
  currentRuntime: number;
};

/** A dashboard column: the levels that start and stop whichever pump answers it. */
type Column = { high: number; low: number; pump: Pump };

const SERIAL = "DEMO-PFR-0001";

/**
 * A sump with a varying inflow, drained by up to six pumps. Each column's pump starts when the
 * water rises to the column's high level and stops when it falls to the low level; every enabled
 * pump runs at or above the overall high level, and none at or below the low one. Starts and
 * runtime build up as the pumps cycle. In alteration mode the enabled pumps take turns: each time
 * the sump is drained, the pump that led goes to the back of the line, so wear is shared.
 *
 * Replies follow the firmware: `status` on every reply to a command, and a rejection as
 * `status: "error"` with a `msg` that starts with the command name.
 */
export function createDewaterPumpFloatReplacementDemo(): DemoSimulator<Commands> {
  let intervalS = DEFAULT_INTERVAL_S;
  let waterLevel = 6.2;
  let waterHighThr = 14;
  let waterLowThr = 1.5;
  let currentHighThr = demoAmpsToCounts(850);
  let currentLowThr = demoAmpsToCounts(100);
  let minOffTimeMin = 30;
  let logicMode: (typeof pumpLogicModes)[number] = "normal";
  let ticks = 0;
  // Whether any pump has run since the columns were last assigned, i.e. a cycle has ended.
  let ranSinceAssigned = false;

  // Pump 6 is a spare, held out of service.
  const pumps: Pump[] = pumpNumbers.map((number) => ({
    number,
    enabled: number !== 6,
    on: false,
    totalStarts: 1_240 + ((number * 7) % 5),
    currentStarts: 36 + ((number * 3) % 4),
    totalRuntime: 3_100_000 - number * 260_000,
    currentRuntime: 86_000 - number * 9_000,
  }));

  // Staggered levels, so more pumps join as the water keeps rising.
  const columns: Column[] = pumps.map((pump, index) => ({
    high: Math.round((7 + index * 1.2) * 100) / 100,
    low: Math.round((4.2 + index * 0.6) * 100) / 100,
    pump,
  }));

  /**
   * Puts each pump to a column: its own, or with alteration on, the enabled pumps in turn (moving
   * the lead to the back when `rotate`) and the disabled ones last.
   */
  const assignColumns = (rotate: boolean): boolean => {
    let order = pumps;
    if (logicMode === "alteration") {
      const enabled = columns.map((column) => column.pump).filter((pump) => pump.enabled);
      const disabled = columns.map((column) => column.pump).filter((pump) => !pump.enabled);
      order = [...(rotate ? [...enabled.slice(1), ...enabled.slice(0, 1)] : enabled), ...disabled];
    }
    let changed = false;
    columns.forEach((column, index) => {
      if (column.pump !== order[index]) changed = true;
      column.pump = order[index];
    });
    return changed;
  };

  const perPump = (fields: (pump: Pump) => Record<string, unknown>) =>
    Object.fromEntries(
      pumps.flatMap((pump) => Object.entries(fields(pump)).map(([key, value]) => [`pump_${pump.number}_${key}`, value])),
    );

  const columnPumps = () =>
    Object.fromEntries(columns.map((column, index) => [`column_${index + 1}_pump`, column.pump.number]));

  const motorCurrent = () => {
    const running = pumps.filter((pump) => pump.on).length;
    const amps = running * PUMP_AMPS + (running > 0 ? 20 : 4) + Math.random() * 15;
    return demoAmpsToCounts(amps);
  };

  const pumpCounters = () =>
    perPump((pump) => ({
      state: pump.on ? "on" : "off",
      fault: false,
      total_starts: pump.totalStarts,
      current_starts: pump.currentStarts,
      total_runtime: pump.totalRuntime,
      current_runtime: pump.currentRuntime,
    }));

  const pumpStates = (): Reply => ({
    status: "ok",
    ...pumpCounters(),
    ...perPump((pump) => ({ enabled: pump.enabled })),
    ...Object.fromEntries(
      columns.flatMap((column, index) => [
        [`column_${index + 1}_high_thr`, column.high],
        [`column_${index + 1}_low_thr`, column.low],
      ]),
    ),
    ...columnPumps(),
    current_water_level: waterLevel,
    pump_min_off_time_min: minOffTimeMin,
    water_high_thr: waterHighThr,
    water_low_thr: waterLowThr,
    pump_logic_mode: logicMode,
    current_high_thr: currentHighThr,
    current_low_thr: currentLowThr,
    motor_current: motorCurrent(),
  });

  const config = () => ({
    category: "dewater-pump-float-replacement",
    product_uid: "com.miningsentry.demo:pfr",
    serial_number: SERIAL,
    sample_period_s: intervalS,
  });

  const reject = (name: string, reason: string): Reply => ({ status: "error", msg: `${name} ${reason}` });
  const ok = (data: Record<string, unknown>): Reply => ({ status: "ok", ...data });

  /** Parses a number setting, or returns the rejection for it. */
  const numberIn = (name: string, value: string, min: number, max: number): number | Reply => {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max
      ? number
      : reject(name, `must be a number from ${min} to ${max}`);
  };

  return {
    deviceId: SERIAL,
    name: "MS-PUMP Demo",
    model: "Dewater Pump Float Replacement",
    get intervalMs() {
      return intervalS * 1_000;
    },
    tick() {
      ticks++;
      // Inflow swells and eases, so sometimes one pump keeps up and sometimes several are needed.
      const inflow = (0.085 + 0.08 * Math.sin(ticks / 24) + Math.random() * 0.02) * intervalS;
      for (const { high, low, pump } of columns) {
        const run =
          pump.enabled &&
          waterLevel > waterLowThr &&
          (waterLevel >= waterHighThr || (pump.on ? waterLevel > low : waterLevel >= high));
        if (run && !pump.on) {
          pump.totalStarts++;
          pump.currentStarts++;
        }
        pump.on = run;
        if (pump.on) {
          pump.totalRuntime += intervalS;
          pump.currentRuntime += intervalS;
        }
      }
      const outflow = pumps.filter((pump) => pump.on).length * PUMP_OUTFLOW_M_PER_S * intervalS;
      waterLevel = Math.round(Math.min(LEVEL_MAX_M, Math.max(0, waterLevel + inflow - outflow)) * 100) / 100;
      // Pumps only change columns between cycles, never while one is running.
      const idle = pumps.every((pump) => !pump.on);
      if (!idle) ranSinceAssigned = true;
      const reassigned = idle && assignColumns(ranSinceAssigned);
      if (idle) ranSinceAssigned = false;
      return {
        current_water_level: waterLevel,
        motor_current: motorCurrent(),
        ...pumpCounters(),
        ...(reassigned && columnPumps()),
      };
    },
    action(name) {
      switch (name) {
        case "get_status":
          return ok({
            embedded_software_ver: "demo",
            ...config(),
            adc_voltage_v1: "1.65nc",
            supply_voltage_v2: "12.0nc",
            lat: "0.0nc",
            lon: "0.0nc",
          });
        case "get_config":
          return ok(config());
        case "get_pump_states":
          return pumpStates();
        case "get_sample_period":
          return ok({ period_s: intervalS });
      }
    },
    setting(name, value) {
      const pumpSetting = /^pump_(\d)_set_(enable|high|low)$/.exec(name);
      if (pumpSetting) {
        const number = Number(pumpSetting[1]);
        if (pumpSetting[2] === "enable") {
          const pump = pumps[number - 1];
          pump.enabled = value === "1";
          if (!pump.enabled) pump.on = false;
          return ok({ [`pump_${number}_enabled`]: pump.enabled });
        }
        // Trigger levels belong to the column, whichever pump answers it.
        const column = columns[number - 1];
        const level = numberIn(name, value, 0, 20);
        if (typeof level !== "number") return level;
        if (pumpSetting[2] === "high") {
          if (level <= column.low) return reject(name, "must be above the pump's low level");
          column.high = level;
          return ok({ [`column_${number}_high_thr`]: level });
        }
        if (level >= column.high) return reject(name, "must be below the pump's high level");
        column.low = level;
        return ok({ [`column_${number}_low_thr`]: level });
      }

      switch (name) {
        case "pump_logic_mode": {
          const mode = pumpLogicModes.find((known) => known === value);
          if (!mode) return reject(name, `must be one of ${pumpLogicModes.join(", ")}`);
          logicMode = mode;
          const reassigned = pumps.every((pump) => !pump.on) && assignColumns(false);
          return ok({ pump_logic_mode: mode, ...(reassigned && columnPumps()) });
        }
        case "set_pump_cooldown_min": {
          const minutes = numberIn(name, value, 30, 1440);
          if (typeof minutes !== "number") return minutes;
          minOffTimeMin = minutes;
          return ok({ pump_min_off_time_min: minutes });
        }
        case "ble_data_interval_s": {
          const seconds = numberIn(name, value, 1, 3600);
          if (typeof seconds !== "number") return seconds;
          intervalS = seconds;
          return ok({ ble_data_interval_s: seconds });
        }
        case "set_water_high_thr_m": {
          const level = numberIn(name, value, 0, 20);
          if (typeof level !== "number") return level;
          if (level <= waterLowThr) return reject(name, "must be above the low threshold");
          waterHighThr = level;
          return ok({ water_high_thr: level });
        }
        case "set_water_low_thr_m": {
          const level = numberIn(name, value, 0, 20);
          if (typeof level !== "number") return level;
          if (level >= waterHighThr) return reject(name, "must be below the high threshold");
          waterLowThr = level;
          return ok({ water_low_thr: level });
        }
        case "set_current_sens_high_thr": {
          const counts = numberIn(name, value, 0, ADC_MAX);
          if (typeof counts !== "number") return counts;
          if (counts <= currentLowThr) return reject(name, "must be above the low threshold");
          currentHighThr = counts;
          return ok({ current_high_thr: counts });
        }
        case "set_current_sens_low_thr": {
          const counts = numberIn(name, value, 0, ADC_MAX);
          if (typeof counts !== "number") return counts;
          if (counts >= currentHighThr) return reject(name, "must be below the high threshold");
          currentLowThr = counts;
          return ok({ current_low_thr: counts });
        }
        case "reset_pump_count":
          pumps.forEach((pump) => (pump.currentStarts = 0));
          return ok({ pump_counts_reset: 1, ...perPump(() => ({ current_starts: 0 })) });
        case "reset_pump_runtime":
          pumps.forEach((pump) => (pump.currentRuntime = 0));
          return ok({ pump_runtime_reset: 1, ...perPump(() => ({ current_runtime: 0 })) });
      }
      return reject(name, "is not a known command");
    },
  };
}
