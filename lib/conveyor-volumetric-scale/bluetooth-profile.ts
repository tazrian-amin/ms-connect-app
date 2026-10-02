import {
  defineProfile,
  messagingCharacteristics,
  messagingService,
  standardCharacteristics,
  standardServices,
} from "@/lib/bluetooth/profile";

// TODO: Add the firmware's advertising filter (e.g. `[{ namePrefix: "..." }]`) and any custom
// services beyond messaging in `optionalServices`.
export const conveyorVolumetricScaleProfile = defineProfile({
  optionalServices: [...standardServices, messagingService],
  characteristics: {
    ...standardCharacteristics,
    ...messagingCharacteristics,
  },
});
