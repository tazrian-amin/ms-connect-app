import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import type { AppCommand, CommandSet, CommandType, DeviceMessage, MessageType } from "./commands/schema";
import { initialConnectionState, type BluetoothConnection, type ConnectionState } from "./connection";
import type { DeviceMessenger } from "./messaging";
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
  return { ...useConnectionState(connection), connection };
}

/** Live state of a connection you already hold, e.g. `messenger.connection`. */
export function useConnectionState(connection: BluetoothConnection): ConnectionState {
  return useSyncExternalStore(connection.subscribeState, connection.getState, () => initialConnectionState);
}

/** Latest notified value of a characteristic, or null until the device sends one. */
export function useCharacteristicValue<K extends string>(connection: BluetoothConnection<K>, key: K): DataView | null {
  const [value, setValue] = useState<DataView | null>(null);
  useEffect(() => connection.subscribe(key, setValue), [connection, key]);
  return value;
}

/** Calls `onMessage` for every valid message the device sends while the component is mounted. */
export function useDeviceMessages<C extends CommandSet>(
  messenger: DeviceMessenger<C>,
  onMessage: (message: DeviceMessage<C>) => void,
): void {
  const handleMessage = useEffectEvent(onMessage);
  useEffect(() => messenger.subscribe((message) => handleMessage(message)), [messenger]);
}

/** Latest message of one type from the device, or null until it sends one. */
export function useLatestMessage<C extends CommandSet, T extends MessageType<C>>(
  messenger: DeviceMessenger<C>,
  type: T,
): DeviceMessage<C, T> | null {
  const [message, setMessage] = useState<DeviceMessage<C, T> | null>(null);
  useEffect(
    () =>
      messenger.subscribe((received) => {
        if (received.type === type) setMessage(received as DeviceMessage<C, T>);
      }),
    [messenger, type],
  );
  return message;
}

/** Last command of one type sent to the device during the current link, or null. */
export function useLastSentCommand<C extends CommandSet, T extends CommandType<C>>(
  messenger: DeviceMessenger<C>,
  type: T,
): AppCommand<C, T> | null {
  return useSyncExternalStore(
    messenger.subscribeSent,
    () => messenger.getLastSent(type),
    () => null,
  );
}
