import { toHex } from "@/lib/bluetooth/codec";
import { bleLog } from "@/lib/bluetooth/debug";
import { DemoLink, type DemoSimulator } from "@/lib/bluetooth/demo";
import { describeBluetoothError, isChooserCancelled } from "@/lib/bluetooth/errors";
import type { DeviceProfile } from "@/lib/bluetooth/profile";
import { CloudLink, type CloudCache, type CloudSource } from "@/lib/cloud/cloud";

export type ConnectionStatus = "disconnected" | "requesting" | "connecting" | "connected" | "reconnecting";

export type ConnectionState = {
  status: ConnectionStatus;
  /** Name the hardware advertises, from when the user picks it until the link is disconnected. */
  deviceName: string | null;
  error: string | null;
  /** True while linked to a simulated device (see lib/bluetooth/demo.ts) rather than real hardware. */
  demo: boolean;
  /** True while linked through the backend (see lib/cloud/cloud.ts) rather than over Bluetooth. */
  cloud: boolean;
};

type ValueListener = (value: DataView) => void;

export type ConnectionOptions = {
  /**
   * Name of another part of the app already linked to this hardware, or null if it is free.
   * Two connections sharing one device would disconnect each other.
   */
  findOtherUser?: (device: BluetoothDevice) => string | null;
};

export const initialConnectionState: ConnectionState = {
  status: "disconnected",
  deviceName: null,
  error: null,
  demo: false,
  cloud: false,
};

const CONNECT_TIMEOUT_MS = 15_000;
// Delays between automatic reconnect attempts after the link drops unexpectedly.
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];

/**
 * One Bluetooth link to one piece of hardware.
 *
 * - `connect()` opens the browser's device chooser, so it must run inside a user gesture (a click).
 * - GATT operations are queued: Chrome rejects a read/write that starts while another is in flight.
 * - If the link drops on its own, it reconnects with backoff and restores notification subscriptions.
 * - State is exposed through `getState`/`subscribeState` for `useSyncExternalStore`.
 * - `connectDemo()` links to a simulator instead, for trying the app without the hardware.
 * - `connectCloud()` links through the backend instead, for devices that report over their own network;
 *   `resumeCloud()` picks such a link up again after the app restarts, even offline.
 */
export class BluetoothConnection<K extends string = string> {
  readonly profile: DeviceProfile<K>;
  readonly #findOtherUser: ConnectionOptions["findOtherUser"];

  #state: ConnectionState = initialConnectionState;
  #stateListeners = new Set<() => void>();

  #device: BluetoothDevice | null = null;
  #characteristics = new Map<K, BluetoothRemoteGATTCharacteristic>();
  // Keys that resolve to each characteristic. Several keys can share one, e.g. a serial module's
  // single characteristic carries both directions.
  #keysOf = new WeakMap<BluetoothRemoteGATTCharacteristic, Set<K>>();
  #valueListeners = new Map<K, Set<ValueListener>>();
  #queue: Promise<unknown> = Promise.resolve();

  #userDisconnected = false;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #demo: DemoLink | null = null;
  #cloud: CloudLink | null = null;

  constructor(profile: DeviceProfile<K>, options: ConnectionOptions = {}) {
    this.profile = profile;
    this.#findOtherUser = options.findOtherUser;
  }

  getState = (): ConnectionState => this.#state;

  subscribeState = (listener: () => void): (() => void) => {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  };

  get device(): BluetoothDevice | null {
    return this.#device;
  }

  /** Lets the user pick a device, then connects to it. Call from a click handler. */
  async connect(): Promise<void> {
    const { status } = this.#state;
    if (status !== "disconnected") return;

    this.#setState({ status: "requesting", error: null });
    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice(this.#requestOptions());
      bleLog("connection", `picked "${device.name ?? "unnamed"}" (${device.id})`);
    } catch (error) {
      bleLog("connection", "device chooser failed or was cancelled", error);
      this.#setState({ status: "disconnected", error: isChooserCancelled(error) ? null : describeBluetoothError(error) });
      return;
    }

    const otherUser = this.#findOtherUser?.(device);
    if (otherUser) {
      this.#setState({
        status: "disconnected",
        error: `This device is already connected as ${otherUser}. Disconnect it there first.`,
      });
      return;
    }

    if (this.#device !== device) {
      this.#device?.removeEventListener("gattserverdisconnected", this.#handleDisconnected);
      device.addEventListener("gattserverdisconnected", this.#handleDisconnected);
      this.#device = device;
    }
    this.#userDisconnected = false;
    this.#setState({ deviceName: device.name ?? "Unnamed device" });

    try {
      await this.#open("connecting");
    } catch (error) {
      bleLog("connection", "connect failed", error);
      this.#setState({ status: "disconnected", error: describeBluetoothError(error) });
    }
  }

  /** Links to a simulated device instead of real hardware. Ended by `disconnect()` like a real link. */
  connectDemo(simulator: DemoSimulator): void {
    if (this.#state.status !== "disconnected") return;
    bleLog("connection", `starting demo "${simulator.name}"`);
    this.#demo = new DemoLink(simulator, (value) => {
      // The simulator only speaks over the messaging characteristic.
      this.#valueListeners.get("fromDevice" as K)?.forEach((listener) => listener(value));
    });
    this.#setState({ status: "connected", deviceName: simulator.name, error: null, demo: true });
  }

  /**
   * Links through the backend to the unit `source` describes, instead of over Bluetooth. Rejects
   * with a message for the user, e.g. for a serial number the backend doesn't know, and leaves the
   * state's `error` alone so the caller decides where to show it. Ended by `disconnect()`.
   */
  async connectCloud(source: CloudSource, cache?: CloudCache): Promise<void> {
    if (this.#state.status !== "disconnected") return;
    bleLog("connection", `linking through the cloud to "${source.name}"`);
    const link = this.#createCloudLink(source, cache);
    this.#setState({ status: "connecting", deviceName: source.name, error: null, cloud: true });
    try {
      await link.start();
    } catch (error) {
      // Disconnected while the first report was on its way; nothing to report.
      if (this.#cloud !== link) return;
      link.stop();
      this.#cloud = null;
      this.#setState({ status: "disconnected" });
      throw error;
    }
    if (this.#cloud === link) this.#setState({ status: "connected" });
  }

  /**
   * Links again to a unit linked through the cloud on an earlier visit. Shows the cached data at
   * once and reconnects until the backend answers, however long that takes, e.g. while offline.
   */
  resumeCloud(source: CloudSource, cache: CloudCache): void {
    if (this.#state.status !== "disconnected") return;
    bleLog("connection", `resuming cloud link to "${source.name}"`);
    const link = this.#createCloudLink(source, cache);
    this.#setState({ status: "reconnecting", deviceName: source.name, error: null, cloud: true });
    link.resume();
  }

  #createCloudLink(source: CloudSource, cache?: CloudCache): CloudLink {
    const link = new CloudLink(
      source,
      // The backend only relays the messaging characteristic.
      (value) => this.#valueListeners.get("fromDevice" as K)?.forEach((listener) => listener(value)),
      (reachable) => {
        if (this.#cloud === link) this.#setState({ status: reachable ? "connected" : "reconnecting" });
      },
      cache,
    );
    this.#cloud = link;
    return link;
  }

  /** Closes the link and stops any automatic reconnect. */
  disconnect(): void {
    this.#demo?.stop();
    this.#demo = null;
    this.#cloud?.stop();
    this.#cloud = null;
    this.#userDisconnected = true;
    clearTimeout(this.#reconnectTimer);
    this.#device?.gatt?.disconnect();
    this.#characteristics.clear();
    this.#setState({ status: "disconnected", error: null });
  }

  /** Reads the current value of a characteristic. */
  read(key: K): Promise<DataView> {
    const demo = this.#demo;
    if (demo) return this.#enqueue(async () => demo.read(key));
    const cloud = this.#cloud;
    if (cloud) return this.#enqueue(async () => cloud.read(key));
    return this.#enqueue(async () => (await this.#characteristic(key)).readValue());
  }

  /**
   * Sends bytes to a characteristic. Uses write-with-response when the characteristic
   * supports it, so the promise resolves only once the device has acknowledged the write.
   */
  write(key: K, value: BufferSource): Promise<void> {
    const demo = this.#demo;
    if (demo) return this.#enqueue(async () => demo.write(value));
    const cloud = this.#cloud;
    if (cloud) return this.#enqueue(() => cloud.write(value));
    return this.#enqueue(async () => {
      const characteristic = await this.#characteristic(key);
      if (characteristic.properties.write) {
        await characteristic.writeValueWithResponse(value);
      } else {
        await characteristic.writeValueWithoutResponse(value);
      }
    });
  }

  /**
   * Listens for notifications from a characteristic. Subscriptions survive reconnects.
   * Returns a function that removes the listener.
   */
  subscribe(key: K, listener: ValueListener): () => void {
    let listeners = this.#valueListeners.get(key);
    if (!listeners) {
      listeners = new Set();
      this.#valueListeners.set(key, listeners);
    }
    listeners.add(listener);
    if (listeners.size === 1 && this.#state.status === "connected") {
      this.#enqueue(() => this.#startNotifications(key)).catch(this.#reportError);
    }
    // A cloud link may have had its data before anyone listened, e.g. resumed while on another page.
    const cloud = this.#cloud;
    if (cloud && key === ("fromDevice" as K) && listeners.size === 1) {
      queueMicrotask(() => {
        if (this.#cloud === cloud) cloud.replay();
      });
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      this.#valueListeners.delete(key);
      const characteristic = this.#characteristics.get(key);
      if (characteristic && this.#state.status === "connected") {
        // The device may already be gone; nothing useful to report if stopping fails.
        this.#enqueue(() => characteristic.stopNotifications()).catch(() => {});
      }
    };
  }

  async #open(status: "connecting" | "reconnecting"): Promise<void> {
    const gatt = this.#device?.gatt;
    if (!gatt) throw new DOMException("This device has no GATT server.", "NotSupportedError");

    this.#setState({ status });
    this.#characteristics.clear();
    try {
      await withTimeout(gatt.connect(), CONNECT_TIMEOUT_MS);
    } catch (error) {
      gatt.disconnect();
      throw error;
    }
    if (!gatt.connected) throw new DOMException("The device dropped the connection.", "NetworkError");
    bleLog("connection", `GATT connected (${status})`);

    this.#reconnectAttempt = 0;
    this.#setState({ status: "connected", error: null });
    // Restore subscriptions that were active before a reconnect (or made while disconnected).
    for (const key of this.#valueListeners.keys()) {
      this.#enqueue(() => this.#startNotifications(key)).catch(this.#reportError);
    }
  }

  #handleDisconnected = () => {
    bleLog("connection", `GATT disconnected while ${this.#state.status}${this.#userDisconnected ? " (by user)" : ""}`);
    this.#characteristics.clear();
    // Only an established link reconnects on its own. While connecting or reconnecting, #open's
    // failure handling owns the state; when already disconnected, the drop is not ours.
    if (this.#userDisconnected || this.#state.status !== "connected") return;
    this.#scheduleReconnect();
  };

  #scheduleReconnect() {
    const delay = RECONNECT_DELAYS_MS[this.#reconnectAttempt];
    if (delay === undefined) {
      this.#reconnectAttempt = 0;
      this.#setState({ status: "disconnected", error: "Lost connection to the device." });
      return;
    }
    this.#reconnectAttempt += 1;
    this.#setState({ status: "reconnecting" });
    this.#reconnectTimer = setTimeout(async () => {
      if (this.#userDisconnected) return;
      try {
        await this.#open("reconnecting");
      } catch {
        if (!this.#userDisconnected) this.#scheduleReconnect();
      }
    }, delay);
  }

  async #characteristic(key: K): Promise<BluetoothRemoteGATTCharacteristic> {
    const cached = this.#characteristics.get(key);
    if (cached) return cached;

    const gatt = this.#device?.gatt;
    if (!gatt?.connected) throw new DOMException("The device is not connected.", "InvalidStateError");

    const ref = this.profile.characteristics[key];
    bleLog("connection", `looking up "${key}": service ${ref.service}, characteristic ${ref.characteristic}`);
    const service = await gatt.getPrimaryService(ref.service);
    const characteristic = await service.getCharacteristic(ref.characteristic);
    bleLog("connection", `found "${key}"`, characteristic.properties);
    // The browser may hand back the same object after a reconnect, or for another key; attach the handler once.
    let keys = this.#keysOf.get(characteristic);
    if (!keys) {
      const sharingKeys = new Set<K>();
      keys = sharingKeys;
      this.#keysOf.set(characteristic, keys);
      characteristic.addEventListener("characteristicvaluechanged", () => {
        const value = characteristic.value;
        if (!value) return;
        bleLog("rx", `${value.byteLength} bytes: ${toHex(value)}`);
        sharingKeys.forEach((sharingKey) => this.#valueListeners.get(sharingKey)?.forEach((listener) => listener(value)));
      });
    }
    keys.add(key);
    this.#characteristics.set(key, characteristic);
    return characteristic;
  }

  async #startNotifications(key: K): Promise<void> {
    // Demo and cloud links deliver to every subscriber already.
    if (this.#demo || this.#cloud) return;
    const characteristic = await this.#characteristic(key);
    await characteristic.startNotifications();
    bleLog("connection", `notifications on for "${key}"`);
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => {});
    return result;
  }

  #reportError = (error: unknown) => {
    bleLog("connection", "operation failed", error);
    this.#setState({ error: describeBluetoothError(error) });
  };

  #requestOptions(): RequestDeviceOptions {
    const { filters, optionalServices } = this.profile;
    return filters?.length ? { filters, optionalServices } : { acceptAllDevices: true, optionalServices };
  }

  #setState(patch: Partial<ConnectionState>) {
    if (patch.status && patch.status !== this.#state.status) {
      bleLog("connection", `${this.#state.status} → ${patch.status}`);
    }
    if (patch.error) bleLog("connection", `error shown: ${patch.error}`);
    // A name only describes a live (or in-progress) link; don't keep showing the last device once it's gone.
    if (patch.status === "disconnected") patch = { ...patch, deviceName: null, demo: false, cloud: false };
    this.#state = { ...this.#state, ...patch };
    this.#stateListeners.forEach((listener) => listener());
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException("Timed out connecting to the device.", "TimeoutError")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
