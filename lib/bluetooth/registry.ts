import { binHeightMeasurementProfile } from "@/lib/bin-height-measurement/bluetooth-profile";
import { conveyorVolumetricScaleProfile } from "@/lib/conveyor-volumetric-scale/bluetooth-profile";
import { conveyorVolumetricScaleProProfile } from "@/lib/conveyor-volumetric-scale-pro/bluetooth-profile";
import { dewaterPumpFloatReplacementProfile } from "@/lib/dewater-pump-float-replacement/bluetooth-profile";
import { dewaterWaterLevelMonitorProfile } from "@/lib/dewater-water-level-monitor/bluetooth-profile";
import { dischargeWaterFlowMonitorProfile } from "@/lib/discharge-water-flow-monitor/bluetooth-profile";
import { getDevice } from "@/lib/homepage/devices";
import { BluetoothConnection, type ConnectionStatus } from "./connection";
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

/**
 * Which one of several links of the same device type a connection is, for device types that
 * monitor more than one piece of hardware from one page (e.g. one bin height sensor per bin).
 */
export type ConnectionInstance = {
  /** Stable for the life of the instance, e.g. a bin's id. */
  id: string;
  /** Shown to the user, e.g. "Bin 2". */
  name: string;
};

// The key of a device type's only connection, for device types that link to one piece of hardware.
const SOLE_INSTANCE = "";

// One connection per profile and instance, kept at module level so a link stays open while the
// user moves between pages with client-side navigation.
const connections = new Map<DeviceProfile, Map<string, BluetoothConnection>>();
const instanceNames = new WeakMap<BluetoothConnection, string>();
const activityListeners = new Set<() => void>();

function* allConnections(): Generator<[DeviceProfile, BluetoothConnection]> {
  for (const [profile, instances] of connections) {
    for (const connection of instances.values()) yield [profile, connection];
  }
}

/**
 * Returns the shared connection for a profile, or for one instance of it. Device-specific code
 * should pass its own profile import to get type-checked characteristic names.
 */
export function getConnection<K extends string>(
  profile: DeviceProfile<K>,
  instance?: ConnectionInstance,
): BluetoothConnection<K> {
  let instances = connections.get(profile);
  if (!instances) {
    instances = new Map();
    connections.set(profile, instances);
  }
  const id = instance?.id ?? SOLE_INSTANCE;
  let connection = instances.get(id);
  if (!connection) {
    const created: BluetoothConnection = new BluetoothConnection(profile, {
      findOtherUser: (device) => findOtherUser(device, created),
    });
    created.subscribeState(notifyActivity);
    instances.set(id, created);
    connection = created;
  }
  if (instance) instanceNames.set(connection, instance.name);
  return connection as unknown as BluetoothConnection<K>;
}

/** Disconnects one instance's link and forgets it, e.g. when the user removes a bin. */
export function releaseConnection(profile: DeviceProfile, instanceId: string): void {
  const connection = connections.get(profile)?.get(instanceId);
  if (!connection) return;
  connection.disconnect();
  connections.get(profile)?.delete(instanceId);
  notifyActivity();
}

function notifyActivity() {
  activityListeners.forEach((listener) => listener());
}

/** Display name of what another connection is using this hardware as, if any. */
function findOtherUser(device: BluetoothDevice, asker: BluetoothConnection): string | null {
  for (const [profile, connection] of allConnections()) {
    if (connection === asker || connection.device?.id !== device.id) continue;
    if (connection.getState().status === "disconnected") continue;
    const slug = Object.keys(deviceProfiles).find((key) => deviceProfiles[key] === profile);
    const deviceName = (slug && getDevice(slug)?.name) || "another device";
    const instanceName = instanceNames.get(connection);
    return instanceName ? `${instanceName} (${deviceName})` : deviceName;
  }
  return null;
}

/** Closes every link, e.g. before a reload the user asked for. */
export function disconnectAll(): void {
  for (const [, connection] of allConnections()) connection.disconnect();
}

/** True while any device is linked or being linked; app updates wait until this is false. */
export function isAnyDeviceLinked(): boolean {
  for (const [, connection] of allConnections()) {
    if (connection.getState().status !== "disconnected") return true;
  }
  return false;
}

// How far along each status is, so a device type with several links reports its most active one.
const statusRank: Record<ConnectionStatus, number> = {
  disconnected: 0,
  requesting: 1,
  connecting: 2,
  reconnecting: 3,
  connected: 4,
};

/** The most active status among all of a profile's connections, e.g. for its card on the homepage. */
export function getProfileStatus(profile: DeviceProfile): ConnectionStatus {
  let status: ConnectionStatus = "disconnected";
  for (const connection of connections.get(profile)?.values() ?? []) {
    const current = connection.getState().status;
    if (statusRank[current] > statusRank[status]) status = current;
  }
  return status;
}

/** Notifies when any connection's state changes. Pairs with `isAnyDeviceLinked` and `getProfileStatus`. */
export function subscribeDeviceActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}
