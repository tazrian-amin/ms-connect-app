import { defineCommands, type DeviceData, type FieldType, type SettingType } from "./schema";

// Matches firmware/dewater-pump-float-replacement, whose field names are the source of truth: the app
// follows the firmware's names, not the other way round. Water levels are heights in metres as the
// firmware reports them: 20 m minus the radar's distance to the water surface. Higher means more water.

export const PUMP_COUNT = 6;
export const pumpNumbers = [1, 2, 3, 4, 5, 6] as const;
export type PumpNumber = (typeof pumpNumbers)[number];

export const pumpLogicModes = ["normal", "alteration", "winter"] as const;

/** Repeats each entry for every pump, e.g. `enabled` → `pump_1_enabled` … `pump_6_enabled`. */
function perPump<const S extends Record<string, FieldType>>(schema: S) {
  return Object.fromEntries(
    pumpNumbers.flatMap((pump) => Object.entries(schema).map(([key, type]) => [`pump_${pump}_${key}`, type])),
  ) as { [K in keyof S & string as `pump_${PumpNumber}_${K}`]: S[K] };
}

/** Repeats each entry for every dashboard column, e.g. `high_thr` → `column_1_high_thr` … `column_6_high_thr`. */
function perColumn<const S extends Record<string, FieldType>>(schema: S) {
  return Object.fromEntries(
    pumpNumbers.flatMap((column) => Object.entries(schema).map(([key, type]) => [`column_${column}_${key}`, type])),
  ) as { [K in keyof S & string as `column_${PumpNumber}_${K}`]: S[K] };
}

const settings = {
  pump_logic_mode: pumpLogicModes,
  set_pump_cooldown_min: "number", // 30–1440
  ble_data_interval_s: "number",
  set_water_high_thr_m: "number",
  set_water_low_thr_m: "number",
  set_current_sens_high_thr: "number",
  set_current_sens_low_thr: "number",
  // The firmware takes resets as {"reset_pump_count":"1"}, not as actions; send `true`.
  reset_pump_count: "boolean",
  reset_pump_runtime: "boolean",
  ...(perPump({
    set_enable: "boolean",
    set_high: "number", // must be above the pump's low threshold
    set_low: "number", // must be below the pump's high threshold
  }) satisfies Record<string, SettingType>),
} as const satisfies Record<string, SettingType>;

const actions = ["get_status", "get_config", "get_pump_states", "get_sample_period"] as const;

export const dewaterPumpFloatReplacementCommands = defineCommands({
  fields: {
    // get_status / get_config
    embedded_software_ver: "string",
    category: "string",
    product_uid: "string",
    serial_number: "string",
    sample_period_s: "number", // how often the device sends periodic data
    // get_status only; placeholders until the hardware measures them, e.g. "1.65nc" (nc = not connected)
    adc_voltage_v1: "string",
    supply_voltage_v2: "string",
    lat: "string",
    lon: "string",
    // get_sample_period
    period_s: "number", // the same interval
    // reply to the ble_data_interval_s setting
    ble_data_interval_s: "number", // the same interval
    // every reply to a command
    status: ["ok", "error"],
    msg: "string", // why a command was rejected, alongside status "error"
    // get_pump_states, and periodically
    current_water_level: "number", // m
    motor_current: "number", // filtered A1 reading, 12-bit ADC counts
    pump_min_off_time_min: "number", // how long a pump rests after stopping
    water_high_thr: "number", // m, at or above this every enabled pump runs
    water_low_thr: "number", // m, at or below this every pump stops with a fault
    pump_logic_mode: pumpLogicModes,
    ...perPump({
      enabled: "boolean",
      fault: "boolean",
      state: ["on", "off"], // whether the pump is running
      total_starts: "number",
      current_starts: "number", // since the last reset_pump_count
      total_runtime: "number", // s
      current_runtime: "number", // s, since the last reset_pump_runtime
    }),
    ...perColumn({
      high_thr: "number", // m, the column's pump starts when the water rises to this
      low_thr: "number", // m, the column's pump stops when the water falls to this
      pump: "number", // the pump answering the column
    }),
    current_high_thr: "number", // 12-bit ADC counts
    current_low_thr: "number", // 12-bit ADC counts
    // replies to reset_pump_count / reset_pump_runtime
    pump_counts_reset: "number",
    pump_runtime_reset: "number",
  },
  actions,
  settings,
  // The firmware rejects a command as {"status":"error","msg":"<command name> <reason>"}, without `cmd`.
  readRejection: (data) => {
    if (data.status !== "error" || typeof data.msg !== "string") return null;
    const name = data.msg.split(" ")[0];
    const known = Object.hasOwn(settings, name) || (actions as readonly string[]).includes(name);
    return known ? { error: data.msg, cmd: name } : { error: data.msg };
  },
});

export type DewaterPumpFloatReplacementData = DeviceData<typeof dewaterPumpFloatReplacementCommands>;
