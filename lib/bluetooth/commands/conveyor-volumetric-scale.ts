import { defineCommands, defineMessages, type AppCommand, type DeviceMessage } from "./schema";

// TODO: Placeholder data model. Replace these message types and fields with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

/** Messages the device sends to the app. */
export const conveyorVolumetricScaleIncomingData = defineMessages({
  reading: {
    volumeRate: "number", // m³/h
    totalVolume: "number", // m³ since last reset
    beltSpeed: "number", // m/s
  },
});

/** Commands the app sends to the device. */
export const conveyorVolumetricScaleOutgoingData = defineMessages({
  requestReading: {},
  resetTotal: {},
});

export const conveyorVolumetricScaleCommands = defineCommands({
  fromDevice: conveyorVolumetricScaleIncomingData,
  toDevice: conveyorVolumetricScaleOutgoingData,
});

export type ConveyorVolumetricScaleMessage = DeviceMessage<typeof conveyorVolumetricScaleCommands>;
export type ConveyorVolumetricScaleCommand = AppCommand<typeof conveyorVolumetricScaleCommands>;
