import { describeBluetoothError, isChooserCancelled } from "./errors";
import type { DeviceProfile } from "./profile";

export type ConnectionStatus = "disconnected" | "requesting" | "connecting" | "connected" | "reconnecting";

export type ConnectionState = {
  status: ConnectionStatus;
  /** Name the hardware advertises, once the user has picked it. */
  deviceName: string | null;
  error: string | null;
};

type ValueListener = (value: DataView) => void;

export type ConnectionOptions = {
  /**
   * Name of another part of the app already linked to this hardware, or null if it is free.
   * Two connections sharing one device would disconnect each other.
   */
  findOtherUser?: (device: BluetoothDevice) => string | null;
};

export const initialConnectionState: ConnectionState = { status: "disconnected", deviceName: null, error: null };

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
 */
export class BluetoothConnection<K extends string = string> {
  readonly profile: DeviceProfile<K>;
  readonly #findOtherUser: ConnectionOptions["findOtherUser"];

  #state: ConnectionState = initialConnectionState;
  #stateListeners = new Set<() => void>();

  #device: BluetoothDevice | null = null;
  #characteristics = new Map<K, BluetoothRemoteGATTCharacteristic>();
  #listening = new WeakSet<BluetoothRemoteGATTCharacteristic>();
  #valueListeners = new Map<K, Set<ValueListener>>();
  #queue: Promise<unknown> = Promise.resolve();

  #userDisconnected = false;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;

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
    } catch (error) {
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
      this.#setState({ status: "disconnected", error: describeBluetoothError(error) });
    }
  }

  /** Closes the link and stops any automatic reconnect. */
  disconnect(): void {
    this.#userDisconnected = true;
    clearTimeout(this.#reconnectTimer);
    this.#device?.gatt?.disconnect();
    this.#characteristics.clear();
    this.#setState({ status: "disconnected", error: null });
  }

  /** Reads the current value of a characteristic. */
  read(key: K): Promise<DataView> {
    return this.#enqueue(async () => (await this.#characteristic(key)).readValue());
  }

  /**
   * Sends bytes to a characteristic. Uses write-with-response when the characteristic
   * supports it, so the promise resolves only once the device has acknowledged the write.
   */
  write(key: K, value: BufferSource): Promise<void> {
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

    this.#reconnectAttempt = 0;
    this.#setState({ status: "connected", error: null });
    // Restore subscriptions that were active before a reconnect (or made while disconnected).
    for (const key of this.#valueListeners.keys()) {
      this.#enqueue(() => this.#startNotifications(key)).catch(this.#reportError);
    }
  }

  #handleDisconnected = () => {
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
    const service = await gatt.getPrimaryService(ref.service);
    const characteristic = await service.getCharacteristic(ref.characteristic);
    // The browser may hand back the same object after a reconnect; attach the handler once.
    if (!this.#listening.has(characteristic)) {
      this.#listening.add(characteristic);
      characteristic.addEventListener("characteristicvaluechanged", () => {
        const value = characteristic.value;
        if (!value) return;
        this.#valueListeners.get(key)?.forEach((listener) => listener(value));
      });
    }
    this.#characteristics.set(key, characteristic);
    return characteristic;
  }

  async #startNotifications(key: K): Promise<void> {
    const characteristic = await this.#characteristic(key);
    await characteristic.startNotifications();
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => {});
    return result;
  }

  #reportError = (error: unknown) => {
    this.#setState({ error: describeBluetoothError(error) });
  };

  #requestOptions(): RequestDeviceOptions {
    const { filters, optionalServices } = this.profile;
    return filters?.length ? { filters, optionalServices } : { acceptAllDevices: true, optionalServices };
  }

  #setState(patch: Partial<ConnectionState>) {
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
