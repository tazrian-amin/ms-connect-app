import {
  defineProfile,
  serialModuleMessagingCharacteristics,
  serialModuleService,
  standardCharacteristics,
  standardServices,
} from "@/lib/bluetooth/profile";

// The firmware talks through an HM-10 serial BLE module (see firmware/Bin-Height-Measurement-Firmware),
// not the Nordic UART Service. The module has no Device Information or Battery service, so those
// reads fail and the connection panel just leaves them out.
export const binHeightMeasurementProfile = defineProfile({
  filters: [
    // The firmware renames the module to "MS-BIN-<4 hex>" at boot.
    { namePrefix: "MS-BIN" },
    // Factory name, for a module the firmware couldn't configure or a phone that cached the old name.
    { namePrefix: "HMSoft" },
    // Genuine HM-10s also advertise their serial service.
    { services: [serialModuleService] },
  ],
  optionalServices: [...standardServices, serialModuleService],
  characteristics: {
    ...standardCharacteristics,
    ...serialModuleMessagingCharacteristics,
  },
});
