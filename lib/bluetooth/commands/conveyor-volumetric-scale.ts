import { defineCommands, placeholderData } from "./schema";

// TODO: Replace each placeholder with a map of message type → data schema once the data model
// is agreed with firmware, e.g. `fromDevice: { reading: { level: "number" } }`. From then on
// incoming and outgoing data are checked strictly against it.
export const conveyorVolumetricScaleCommands = defineCommands({
  fromDevice: placeholderData,
  toDevice: placeholderData,
});
