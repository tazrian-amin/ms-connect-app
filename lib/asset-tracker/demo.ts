import { assetTrackerCommands } from "@/lib/bluetooth/commands/asset-tracker";
import type { DemoSimulator } from "@/lib/bluetooth/demo";

const INTERVAL_MS = 2_000;
/** Ticks per leg of the route: a drive, then a stop long enough for tracking to go inactive. */
const MOVING_TICKS = 60;
const STATIONARY_TICKS = 180;
/** Degrees per tick while driving: about 40 km/h. */
const STEP = 0.0002;

const DEFAULT_CONFIG = {
  stationary_interval_s: 1800,
  moving_interval_s: 60,
  inactivity_timeout_s: 300,
};

/**
 * A truck that drives around Dhaka for a couple of minutes, then parks long enough for tracking to
 * go inactive, while its battery slowly drains.
 */
export function createAssetTrackerDemo(): DemoSimulator<typeof assetTrackerCommands> {
  let latitude = 23.8103;
  let longitude = 90.4125;
  let heading = Math.random() * 2 * Math.PI;
  let battery = 85;
  let deviceName = "Truck 12";
  let ticks = 0;
  let stoppedTicks = 0;

  // Its own copy, so settings changed in one demo don't carry over to the next.
  const config = { ...DEFAULT_CONFIG };

  const trackingMode = () =>
    stoppedTicks * (INTERVAL_MS / 1000) >= config.inactivity_timeout_s ? ("inactive" as const) : ("active" as const);
  const isMoving = () => ticks % (MOVING_TICKS + STATIONARY_TICKS) < MOVING_TICKS;
  const reading = () => ({
    device_name: deviceName,
    latitude: round(latitude, 6),
    longitude: round(longitude, 6),
    battery_percentage: Math.round(battery),
    battery_voltage: round(3.4 + (0.62 * battery) / 100, 2),
    is_moving: isMoving(),
    is_charging: false,
    tracking_mode: trackingMode(),
  });

  return {
    deviceId: "DEMO-AT-0001",
    name: "MS-ASSET Demo",
    model: "Asset Tracker",
    intervalMs: INTERVAL_MS,
    tick() {
      ticks++;
      if (isMoving()) {
        stoppedTicks = 0;
        heading += (Math.random() - 0.5) * 0.4;
        latitude += STEP * Math.cos(heading);
        longitude += STEP * Math.sin(heading);
        battery = Math.max(0, battery - 0.02);
      } else {
        stoppedTicks++;
        battery = Math.max(0, battery - 0.002);
      }
      return ticks === 1 ? { ...reading(), ...config } : reading();
    },
    action(name) {
      return name === "get_config" ? { ...config } : reading();
    },
    setting(name, value) {
      if (name === "set_device_name") {
        const trimmed = value.trim();
        if (trimmed === "" || trimmed.length > 32) return { error: "Name must be 1–32 characters.", cmd: name };
        deviceName = trimmed;
        return { device_name: deviceName };
      }
      const seconds = Number(value);
      if (!Number.isInteger(seconds) || seconds < 1) {
        return { error: "Must be a whole number of seconds, 1 or more.", cmd: name };
      }
      switch (name) {
        case "set_stationary_interval_s":
          config.stationary_interval_s = seconds;
          return { stationary_interval_s: seconds };
        case "set_moving_interval_s":
          config.moving_interval_s = seconds;
          return { moving_interval_s: seconds };
        case "set_inactivity_timeout_s":
          config.inactivity_timeout_s = seconds;
          return { inactivity_timeout_s: seconds, tracking_mode: trackingMode() };
      }
    },
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
