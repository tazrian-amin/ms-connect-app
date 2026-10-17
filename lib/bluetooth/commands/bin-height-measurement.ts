import { defineCommands, type DeviceData } from "./schema";

// Matches firmware/Bin-Height-Measurement-Firmware, whose field and command names are the source of truth.

export const binHeightMeasurementCommands = defineCommands({
  fields: {
    material_height: "number", // raw 12-bit ADC reading (0–4095), not yet calibrated to metres
    time_synced: "boolean", // whether the device clock has been set with set_time
    sample_period_ms: "number", // how often the device sends a sample
  },
  actions: ["read_now", "get_config", "reset_config"],
  settings: {
    set_time: "number", // epoch ms
    set_device_id: "string", // 1–127 characters, stored on the device
  },
});

export type BinHeightMeasurementData = DeviceData<typeof binHeightMeasurementCommands>;
