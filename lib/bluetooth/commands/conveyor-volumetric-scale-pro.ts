import { defineCommands, defineMessages, type AppCommand, type DeviceMessage } from "./schema";

// TODO: Placeholder data model. Replace these message types and fields with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

/** Messages the device sends to the app. */
export const conveyorVolumetricScaleProIncomingData = defineMessages({
  reading: {
    volumeRate: "number", // m³/h
    totalVolume: "number", // m³ since last reset
    massRate: "number", // t/h
    beltSpeed: "number", // m/s
  },
});

/** Commands the app sends to the device. */
export const conveyorVolumetricScaleProOutgoingData = defineMessages({
  requestReading: {},
  resetTotal: {},
  setMaterialDensity: {
    density: "number", // t/m³
  },
});

export const conveyorVolumetricScaleProCommands = defineCommands({
  fromDevice: conveyorVolumetricScaleProIncomingData,
  toDevice: conveyorVolumetricScaleProOutgoingData,
});

export type ConveyorVolumetricScaleProMessage = DeviceMessage<typeof conveyorVolumetricScaleProCommands>;
export type ConveyorVolumetricScaleProCommand = AppCommand<typeof conveyorVolumetricScaleProCommands>;
