import { defineCommands, type DeviceData, type FieldType, type SettingType } from "./schema";

// Matches firmware/dewater-pump-float-replacement. Water levels are heights in metres as the
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

export const dewaterPumpFloatReplacementCommands = defineCommands({
  fields: {
    // get_status / get_config
    embedded_software_ver: "string",
    category: "string",
    product_uid: "string",
    serial_number: "string",
    ble_data_interval_s: "number", // how often the device sends periodic data
    // get_pump_states, and periodically
    current_water_level: "number", // m
    pump_cooldown_min: "number", // how long a pump rests after stopping
    water_high_thr_m: "number", // at or above this every enabled pump runs
    water_low_thr_m: "number", // at or below this every pump stops with a fault
    pump_logic_mode: pumpLogicModes,
    ...perPump({
      enabled: "boolean",
      fault: "boolean",
      total_starts: "number",
      current_starts: "number", // since the last reset_pump_count
      high_thr: "number", // m, the pump starts when the water rises to this
      low_thr: "number", // m, the pump stops when the water falls to this
    }),
    // replies to the current threshold settings
    current_high_thr: "number", // 12-bit ADC counts
    current_low_thr: "number", // 12-bit ADC counts
  },
  actions: ["get_status", "get_config", "get_pump_states", "get_sample_period", "reset_pump_count"],
  settings: {
    pump_logic_mode: pumpLogicModes,
    set_pump_cooldown_min: "number", // at least 30
    ble_data_interval_s: "number",
    set_water_high_thr_m: "number",
    set_water_low_thr_m: "number",
    set_current_sens_high_thr: "number",
    set_current_sens_low_thr: "number",
    ...(perPump({
      set_enable: "boolean",
      set_high: "number", // must be above the pump's low threshold
      set_low: "number", // must be below the pump's high threshold
    }) satisfies Record<string, SettingType>),
  },
});

export type DewaterPumpFloatReplacementData = DeviceData<typeof dewaterPumpFloatReplacementCommands>;
