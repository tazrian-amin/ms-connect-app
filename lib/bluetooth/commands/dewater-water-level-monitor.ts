import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const dewaterWaterLevelMonitorCommands = defineCommands({
  fields: {
    water_distance: "number", // ft from the sensor on the pump stand down to the water
    alarm: ["high", "low", "normal"], // water level: high when closer than min_distance, low when further than max_distance
    max_distance: "number", // ft
    min_distance: "number", // ft
  },
  actions: ["get_reading"],
  settings: {
    set_max_distance: "number", // ft
    set_min_distance: "number", // ft
  },
});

export type DewaterWaterLevelMonitorData = DeviceData<typeof dewaterWaterLevelMonitorCommands>;
