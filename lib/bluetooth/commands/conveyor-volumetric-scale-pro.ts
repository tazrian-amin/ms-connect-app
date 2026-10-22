import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const conveyorVolumetricScaleProCommands = defineCommands({
  fields: {
    volume_rate: "number", // m³/h
    total_volume: "number", // m³ since last reset
    mass_rate: "number", // t/h
    belt_speed: "number", // m/s
    material_density: "number", // t/m³
    production_goal: "number", // m³ to produce this day or shift
  },
  actions: ["get_reading", "reset_total"],
  settings: {
    set_material_density: "number", // t/m³
  },
});

export type ConveyorVolumetricScaleProData = DeviceData<typeof conveyorVolumetricScaleProCommands>;
