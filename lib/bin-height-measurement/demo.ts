import { binHeightMeasurementCommands } from "@/lib/bluetooth/commands/bin-height-measurement";
import type { DemoSimulator } from "@/lib/bluetooth/demo";

/** Full scale of the sensor's 12-bit ADC reading. */
const ADC_MAX = 4095;
const MIN_SAMPLE_PERIOD_MS = 1_000;
const MAX_SAMPLE_PERIOD_MS = 3_600_000;

/**
 * A bin that is filled slowly and then discharged, over and over. Every bin's demo sensor starts
 * at its own point in the cycle, so bins side by side don't move in step.
 */
export function createBinHeightMeasurementDemo(): DemoSimulator<typeof binHeightMeasurementCommands> {
  const unitId = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  const defaultDeviceId = `DEMO-BIN-${unitId}`;
  let deviceId = defaultDeviceId;
  let samplePeriodMs = 2_000;
  let timeSynced = false;
  let height = 800 + Math.random() * 2_400;
  let filling = Math.random() < 0.7;

  const config = () => ({ time_synced: timeSynced, sample_period_ms: samplePeriodMs });
  const reading = () => ({ material_height: Math.round(height) });

  return {
    get deviceId() {
      return deviceId;
    },
    name: `MS-BIN-${unitId}`,
    model: "Bin Height Measurement",
    get intervalMs() {
      return samplePeriodMs;
    },
    tick() {
      // Filling adds a little at a time; a discharge empties the bin much faster.
      height += filling ? 12 + Math.random() * 18 : -(70 + Math.random() * 40);
      if (height >= 3_700) filling = false;
      if (height <= 500) filling = true;
      height = Math.min(ADC_MAX, Math.max(0, height + (Math.random() - 0.5) * 20));
      return reading();
    },
    action(name) {
      if (name === "read_now") return reading();
      if (name === "reset_config") deviceId = defaultDeviceId;
      return config();
    },
    setting(name, value) {
      switch (name) {
        case "set_time":
          timeSynced = true;
          return { time_synced: true };
        case "set_device_id":
          if (!/^[\x20-\x7e]{1,127}$/.test(value)) {
            return { error: "Device ID must be 1–127 printable ASCII characters.", cmd: name };
          }
          deviceId = value;
          return config();
        case "set_sample_period_ms": {
          const period = Number(value);
          if (!Number.isInteger(period) || period < MIN_SAMPLE_PERIOD_MS || period > MAX_SAMPLE_PERIOD_MS) {
            return { error: `Sample period must be ${MIN_SAMPLE_PERIOD_MS}–${MAX_SAMPLE_PERIOD_MS} ms.`, cmd: name };
          }
          samplePeriodMs = period;
          return config();
        }
      }
    },
  };
}
