import {
  defineProfile,
  messagingCharacteristics,
  messagingService,
  standardCharacteristics,
  standardServices,
} from "@/lib/bluetooth/profile";

// Never used over Bluetooth: the tracker links through the cloud (see ./cloud.ts). The profile
// still keys its connection, which carries the same messages as every other device's.
export const assetTrackerProfile = defineProfile({
  optionalServices: [...standardServices, messagingService],
  characteristics: {
    ...standardCharacteristics,
    ...messagingCharacteristics,
  },
});
