import { defineCommands, defineMessages, type AppCommand, type DeviceMessage } from "./schema";

// TODO: Placeholder data model. Replace these message types and fields with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

/** Messages the device sends to the app. */
export const dischargeWaterFlowMonitorIncomingData = defineMessages({
  reading: {
    flowRate: "number", // L/min
    totalVolume: "number", // L since last reset
  },
});

/** Commands the app sends to the device. */
export const dischargeWaterFlowMonitorOutgoingData = defineMessages({
  requestReading: {},
  resetTotal: {},
});

export const dischargeWaterFlowMonitorCommands = defineCommands({
  fromDevice: dischargeWaterFlowMonitorIncomingData,
  toDevice: dischargeWaterFlowMonitorOutgoingData,
});

export type DischargeWaterFlowMonitorMessage = DeviceMessage<typeof dischargeWaterFlowMonitorCommands>;
export type DischargeWaterFlowMonitorCommand = AppCommand<typeof dischargeWaterFlowMonitorCommands>;
