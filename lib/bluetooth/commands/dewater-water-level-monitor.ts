import { defineCommands, defineMessages, type AppCommand, type DeviceMessage } from "./schema";

// TODO: Placeholder data model. Replace these message types and fields with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

/** Messages the device sends to the app. */
export const dewaterWaterLevelMonitorIncomingData = defineMessages({
  reading: {
    waterLevel: "number", // m
  },
  alarm: {
    level: ["high", "low", "normal"],
  },
});

/** Commands the app sends to the device. */
export const dewaterWaterLevelMonitorOutgoingData = defineMessages({
  requestReading: {},
  setAlarmLevels: {
    highLevel: "number", // m
    lowLevel: "number", // m
  },
});

export const dewaterWaterLevelMonitorCommands = defineCommands({
  fromDevice: dewaterWaterLevelMonitorIncomingData,
  toDevice: dewaterWaterLevelMonitorOutgoingData,
});

export type DewaterWaterLevelMonitorMessage = DeviceMessage<typeof dewaterWaterLevelMonitorCommands>;
export type DewaterWaterLevelMonitorCommand = AppCommand<typeof dewaterWaterLevelMonitorCommands>;
