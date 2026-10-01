import { useEffect, useState, useSyncExternalStore } from "react";
import { initialConnectionState, type BluetoothConnection, type ConnectionState } from "./connection";
import type { DeviceProfile } from "./profile";
import { getConnection } from "./registry";

export type BluetoothSupport =
  | "checking"
  /** Web Bluetooth is available and the adapter reports it is on. */
  | "supported"
  /** The browser has no Web Bluetooth (Firefox, Safari, iOS). */
  | "unsupported"
  /** Served over plain HTTP; Web Bluetooth requires HTTPS or localhost. */
  | "insecure"
  /** The API exists but there is no adapter, or Bluetooth is switched off. */
  | "unavailable";

const subscribeNothing = () => () => {};

function getApiSupport(): "supported" | "unsupported" | "insecure" {
  if (!window.isSecureContext) return "insecure";
  return "bluetooth" in navigator ? "supported" : "unsupported";
}

export function useBluetoothSupport(): BluetoothSupport {
  // Null during SSR and hydration, since the server cannot know the visitor's browser.
  const api = useSyncExternalStore(subscribeNothing, getApiSupport, () => null);
  const [adapterAvailable, setAdapterAvailable] = useState(true);

  useEffect(() => {
    if (api !== "supported") return;
    const bluetooth = navigator.bluetooth;
    const check = () => {
      bluetooth.getAvailability().then(setAdapterAvailable, () => {});
    };
    check();
    bluetooth.addEventListener("availabilitychanged", check);
    return () => bluetooth.removeEventListener("availabilitychanged", check);
  }, [api]);

  if (api === null) return "checking";
  if (api === "supported" && !adapterAvailable) return "unavailable";
  return api;
}

/** Live connection state for a device profile, plus the connection to read, write and subscribe with. */
export function useDeviceConnection<K extends string>(
  profile: DeviceProfile<K>,
): ConnectionState & { connection: BluetoothConnection<K> } {
  const connection = getConnection(profile);
  const state = useSyncExternalStore(connection.subscribeState, connection.getState, () => initialConnectionState);
  return { ...state, connection };
}

/** Latest notified value of a characteristic, or null until the device sends one. */
export function useCharacteristicValue<K extends string>(connection: BluetoothConnection<K>, key: K): DataView | null {
  const [value, setValue] = useState<DataView | null>(null);
  useEffect(() => connection.subscribe(key, setValue), [connection, key]);
  return value;
}
