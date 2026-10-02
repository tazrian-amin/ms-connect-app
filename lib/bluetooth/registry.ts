import { binHeightMeasurementProfile } from "@/lib/bin-height-measurement/bluetooth-profile";
import { conveyorVolumetricScaleProfile } from "@/lib/conveyor-volumetric-scale/bluetooth-profile";
import { conveyorVolumetricScaleProProfile } from "@/lib/conveyor-volumetric-scale-pro/bluetooth-profile";
import { dewaterPumpFloatReplacementProfile } from "@/lib/dewater-pump-float-replacement/bluetooth-profile";
import { dewaterWaterLevelMonitorProfile } from "@/lib/dewater-water-level-monitor/bluetooth-profile";
import { dischargeWaterFlowMonitorProfile } from "@/lib/discharge-water-flow-monitor/bluetooth-profile";
import { getDevice } from "@/lib/homepage/devices";
import { BluetoothConnection } from "./connection";
import type { DeviceProfile, MessagingCharacteristic, StandardCharacteristic } from "./profile";

/**
 * Bluetooth profile for each device slug. Every profile includes the standard and messaging
 * characteristics so device-agnostic UI (the connection panel) can rely on them.
 */
export const deviceProfiles: Record<string, DeviceProfile<StandardCharacteristic | MessagingCharacteristic>> = {
  "discharge-water-flow-monitor": dischargeWaterFlowMonitorProfile,
  "dewater-water-level-monitor": dewaterWaterLevelMonitorProfile,
  "dewater-pump-float-replacement": dewaterPumpFloatReplacementProfile,
  "conveyor-volumetric-scale": conveyorVolumetricScaleProfile,
  "conveyor-volumetric-scale-pro": conveyorVolumetricScaleProProfile,
  "bin-height-measurement": binHeightMeasurementProfile,
};

// One connection per profile, kept at module level so a link stays open while the
// user moves between pages with client-side navigation.
const connections = new Map<DeviceProfile, BluetoothConnection>();
const activityListeners = new Set<() => void>();

/**
 * Returns the shared connection for a profile. Device-specific code should pass its own
 * profile import to get type-checked characteristic names.
 */
export function getConnection<K extends string>(profile: DeviceProfile<K>): BluetoothConnection<K> {
  let connection = connections.get(profile);
  if (!connection) {
    connection = new BluetoothConnection(profile, {
      findOtherUser: (device) => findOtherUser(device, profile),
    });
    connection.subscribeState(() => activityListeners.forEach((listener) => listener()));
    connections.set(profile, connection);
  }
  return connection as unknown as BluetoothConnection<K>;
}

/** Display name of the device type another connection is using this hardware as, if any. */
function findOtherUser(device: BluetoothDevice, asker: DeviceProfile): string | null {
  for (const [profile, connection] of connections) {
    if (profile === asker || connection.device?.id !== device.id) continue;
    if (connection.getState().status === "disconnected") continue;
    const slug = Object.keys(deviceProfiles).find((key) => deviceProfiles[key] === profile);
    return (slug && getDevice(slug)?.name) || "another device";
  }
  return null;
}

/** Closes every link, e.g. before a reload the user asked for. */
export function disconnectAll(): void {
  connections.forEach((connection) => connection.disconnect());
}

/** True while any device is linked or being linked; app updates wait until this is false. */
export function isAnyDeviceLinked(): boolean {
  for (const connection of connections.values()) {
    if (connection.getState().status !== "disconnected") return true;
  }
  return false;
}

/** Notifies when any connection's state changes. Pairs with `isAnyDeviceLinked`. */
export function subscribeDeviceActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}
