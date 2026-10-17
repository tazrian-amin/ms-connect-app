import {
  defineProfile,
  serialModuleMessagingCharacteristics,
  serialModuleService,
  standardCharacteristics,
  standardServices,
} from "@/lib/bluetooth/profile";

// The firmware talks through a JDY-23 serial BLE module (see firmware/Bin-Height-Measurement-Firmware),
// not the Nordic UART Service. The module has no Device Information or Battery service, so those
// reads fail and the connection panel just leaves them out.
// TODO: Add an advertising filter once the hardware team fixes the module name (AT+NAME).
export const binHeightMeasurementProfile = defineProfile({
  optionalServices: [...standardServices, serialModuleService],
  characteristics: {
    ...standardCharacteristics,
    ...serialModuleMessagingCharacteristics,
  },
});
