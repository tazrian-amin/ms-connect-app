import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.
// The unit's ID and the reading's time travel in the message envelope (`deviceId`, `timestamp`).

export const assetTrackerCommands = defineCommands({
  fields: {
    device_name: "string", // what the tracker is fitted to, e.g. "Truck 12"
    latitude: "number", // decimal degrees, WGS 84
    longitude: "number", // decimal degrees, WGS 84
    battery_percentage: "number", // 0–100
    battery_voltage: "number", // V
    is_moving: "boolean",
    is_charging: "boolean",
    tracking_mode: ["active", "inactive"], // inactive once stationary for inactivity_timeout_s
    stationary_interval_s: "number", // s between location reports while stationary
    moving_interval_s: "number", // s between location reports while moving
    inactivity_timeout_s: "number", // s without motion before tracking goes inactive
  },
  actions: ["get_reading", "get_config"],
  settings: {
    set_device_name: "string", // 1–32 characters
    set_stationary_interval_s: "number", // s
    set_moving_interval_s: "number", // s
    set_inactivity_timeout_s: "number", // s
  },
});

export type AssetTrackerData = DeviceData<typeof assetTrackerCommands>;
