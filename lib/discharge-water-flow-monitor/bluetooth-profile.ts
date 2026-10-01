import { defineProfile, standardCharacteristics, standardServices } from "@/lib/bluetooth/profile";

// TODO: Add the firmware's advertising filter (e.g. `[{ namePrefix: "..." }]`), its custom
// service UUIDs in `optionalServices`, and its data/command characteristics.
export const dischargeWaterFlowMonitorProfile = defineProfile({
  optionalServices: [...standardServices],
  characteristics: {
    ...standardCharacteristics,
  },
});
