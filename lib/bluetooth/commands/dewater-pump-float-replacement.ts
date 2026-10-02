import { defineCommands, defineMessages, type AppCommand, type DeviceMessage } from "./schema";

// TODO: Placeholder data model. Replace these message types and fields with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

/** Messages the device sends to the app. */
export const dewaterPumpFloatReplacementIncomingData = defineMessages({
  reading: {
    waterLevel: "number", // m
    pumpRunning: "boolean",
  },
});

/** Commands the app sends to the device. */
export const dewaterPumpFloatReplacementOutgoingData = defineMessages({
  requestReading: {},
  setPumpLevels: {
    startLevel: "number", // m
    stopLevel: "number", // m
  },
  setPumpMode: {
    mode: ["auto", "on", "off"],
  },
});

export const dewaterPumpFloatReplacementCommands = defineCommands({
  fromDevice: dewaterPumpFloatReplacementIncomingData,
  toDevice: dewaterPumpFloatReplacementOutgoingData,
});

export type DewaterPumpFloatReplacementMessage = DeviceMessage<typeof dewaterPumpFloatReplacementCommands>;
export type DewaterPumpFloatReplacementCommand = AppCommand<typeof dewaterPumpFloatReplacementCommands>;
