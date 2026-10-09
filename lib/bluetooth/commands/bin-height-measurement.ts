import { defineCommands, type DeviceData } from "./schema";

// TODO: Placeholder data model. Replace these fields, actions and settings with the ones agreed with
// firmware. Incoming and outgoing data are already checked strictly against what is declared here.

export const binHeightMeasurementCommands = defineCommands({
  fields: {
    height: "number", // m, sensor to material surface
    bin_height: "number", // m
  },
  actions: ["get_reading"],
  settings: {
    set_bin_height: "number", // m
  },
});

export type BinHeightMeasurementData = DeviceData<typeof binHeightMeasurementCommands>;
