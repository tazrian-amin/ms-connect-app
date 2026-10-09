import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const dischargeWaterFlowMonitorCommands = defineCommands({
  fields: {
    flow_rate: "number", // L/min
    total_volume: "number", // L since last reset
  },
  actions: ["get_reading", "reset_total"],
  settings: {},
});

export type DischargeWaterFlowMonitorData = DeviceData<typeof dischargeWaterFlowMonitorCommands>;
