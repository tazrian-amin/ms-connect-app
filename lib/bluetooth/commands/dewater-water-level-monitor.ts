import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const dewaterWaterLevelMonitorCommands = defineCommands({
  fields: {
    water_level: "number", // m
    alarm: ["high", "low", "normal"],
    high_alarm_level: "number", // m
    low_alarm_level: "number", // m
  },
  actions: ["get_reading"],
  settings: {
    set_high_alarm_level: "number", // m
    set_low_alarm_level: "number", // m
  },
});

export type DewaterWaterLevelMonitorData = DeviceData<typeof dewaterWaterLevelMonitorCommands>;
