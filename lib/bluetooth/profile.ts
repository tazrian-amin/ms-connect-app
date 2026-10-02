/** Points at one GATT characteristic. UUIDs can be full 128-bit strings or standard names. */
export type CharacteristicRef = {
  service: BluetoothServiceUUID;
  characteristic: BluetoothCharacteristicUUID;
};

/**
 * Everything the app needs to know to find and talk to one kind of hardware.
 * `K` is the set of characteristic names, so reads/writes/subscriptions are type-checked.
 */
export type DeviceProfile<K extends string = string> = {
  /**
   * Filters for the browser's device chooser, e.g. `[{ namePrefix: "MS-FLOW" }]` or
   * `[{ services: [SERVICE_UUID] }]`. When omitted the chooser lists every nearby device,
   * which is only useful while the firmware's advertising data is still undecided.
   */
  filters?: BluetoothLEScanFilter[];
  /**
   * Every service the app accesses after connecting that is not already named in `filters`.
   * Chrome blocks access to any service that is not declared up front.
   */
  optionalServices: BluetoothServiceUUID[];
  characteristics: Record<K, CharacteristicRef>;
};

/** Identity helper that keeps the characteristic names as a literal union. */
export function defineProfile<K extends string>(profile: DeviceProfile<K>): DeviceProfile<K> {
  return profile;
}

// Standard Bluetooth SIG services most BLE hardware exposes. Devices that lack them
// still connect; reads of these characteristics just fail with NotFoundError.
export const standardServices: BluetoothServiceUUID[] = ["device_information", "battery_service"];

export const standardCharacteristics = {
  manufacturer: { service: "device_information", characteristic: "manufacturer_name_string" },
  model: { service: "device_information", characteristic: "model_number_string" },
  firmware: { service: "device_information", characteristic: "firmware_revision_string" },
  battery: { service: "battery_service", characteristic: "battery_level" },
} satisfies Record<string, CharacteristicRef>;

export type StandardCharacteristic = keyof typeof standardCharacteristics;

// Every device exchanges messages (see ./commands) over the Nordic UART Service, the de facto
// standard serial-over-BLE service that every common firmware BLE stack ships an implementation of.
export const messagingService: BluetoothServiceUUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

export const messagingCharacteristics = {
  /** NUS TX: the device notifies its messages here. */
  fromDevice: { service: messagingService, characteristic: "6e400003-b5a3-f393-e0a9-e50e24dcca9e" },
  /** NUS RX: the app writes its commands here. */
  toDevice: { service: messagingService, characteristic: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
} satisfies Record<string, CharacteristicRef>;

export type MessagingCharacteristic = keyof typeof messagingCharacteristics;
