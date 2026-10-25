import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const dischargeWaterFlowMonitorCommands = defineCommands({
  fields: {
    flow_rate: "number", // US gal/min
    total_volume: "number", // US gal since last reset
    flow_per_volt: "number", // US gal/min per volt of the flow sensor's analog output
  },
  actions: ["get_reading", "reset_total"],
  settings: {
    set_flow_per_volt: "number", // US gal/min per volt
  },
});

export type DischargeWaterFlowMonitorData = DeviceData<typeof dischargeWaterFlowMonitorCommands>;
