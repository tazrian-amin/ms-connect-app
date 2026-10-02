import { defineCommands, defineMessages, type AppCommand, type DeviceMessage } from "./schema";

// TODO: Placeholder data model. Replace these message types and fields with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

/** Messages the device sends to the app. */
export const binHeightMeasurementIncomingData = defineMessages({
  reading: {
    height: "number", // m, sensor to material surface
  },
  settings: {
    binHeight: "number", // m
  },
});

/** Commands the app sends to the device. */
export const binHeightMeasurementOutgoingData = defineMessages({
  requestReading: {},
  setBinHeight: {
    binHeight: "number", // m
  },
});

export const binHeightMeasurementCommands = defineCommands({
  fromDevice: binHeightMeasurementIncomingData,
  toDevice: binHeightMeasurementOutgoingData,
});

export type BinHeightMeasurementMessage = DeviceMessage<typeof binHeightMeasurementCommands>;
export type BinHeightMeasurementCommand = AppCommand<typeof binHeightMeasurementCommands>;
