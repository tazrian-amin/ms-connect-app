import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const conveyorVolumetricScaleCommands = defineCommands({
  fields: {
    volume_rate: "number", // m³/h
    total_volume: "number", // m³ since last reset
    belt_speed: "number", // m/s
  },
  actions: ["get_reading", "reset_total"],
  settings: {},
});

export type ConveyorVolumetricScaleData = DeviceData<typeof conveyorVolumetricScaleCommands>;
