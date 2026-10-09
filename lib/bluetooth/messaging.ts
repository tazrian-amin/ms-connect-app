import { encodeText } from "./codec";
import {
  formatAction,
  formatSetting,
  MessageFormatError,
  parseDeviceMessage,
  type ActionName,
  type CommandSet,
  type DeviceData,
  type DeviceMessage,
  type SentCommand,
  type SettingName,
  type SettingValue,
} from "./commands/schema";
import type { BluetoothConnection } from "./connection";
import type { DeviceProfile, MessagingCharacteristic } from "./profile";
import { getConnection } from "./registry";

// A line this long without a "\n" means the stream is out of sync; drop it rather than grow forever.
const MAX_LINE_LENGTH = 4_096;
// 20 bytes fits the smallest BLE MTU, so commands get through whatever the link negotiated.
// The device reassembles chunks up to the "\n", so chunk size is invisible to it.
const WRITE_CHUNK_BYTES = 20;

type MessageListener<C extends CommandSet> = (message: DeviceMessage<C>) => void;

/** One line exactly as it went over the link, for diagnostics. */
export type TrafficEntry = {
  direction: "in" | "out";
  line: string;
  /** Epoch ms when the line was received or acknowledged. */
  time: number;
  /** Why an incoming line was ignored, if it was. */
  problem?: string;
};

type TrafficListener = (entry: TrafficEntry) => void;

/** Everything the device has reported during the current link, latest value of each field. */
export type DeviceState<C extends CommandSet> = {
  deviceId: string | null;
  data: DeviceData<C>;
  /** Timestamp of the newest message that carried fields, in epoch ms. */
  updatedAt: number | null;
};

const emptyState = { deviceId: null, data: {}, updatedAt: null };

/**
 * Two-way message channel over a device's messaging characteristics (see ./commands/schema.ts).
 *
 * - Incoming packets are reassembled into lines, validated against the device's command set,
 *   and handed to listeners. Invalid lines are logged and dropped.
 * - The fields of every valid message are merged into one device state, kept until the link ends.
 * - Notifications are only enabled while something is listening (to messages, state or raw traffic).
 * - Outgoing commands are validated the same way before anything is written.
 * - On every (re)connect the partial-line buffer is cleared.
 * - The last value of each action and setting sent during the current link is kept until the link
 *   ends, so the UI can show what was set even when the device does not report it back.
 */
export class DeviceMessenger<C extends CommandSet> {
  readonly connection: BluetoothConnection<MessagingCharacteristic>;
  readonly commands: C;

  #listeners = new Set<MessageListener<C>>();
  #stateListeners = new Set<() => void>();
  #trafficListeners = new Set<TrafficListener>();
  #unsubscribe: (() => void) | null = null;
  #decoder = new TextDecoder();
  #buffer = "";
  #wasConnected = false;
  #state: DeviceState<C> = emptyState;
  #lastSent = new Map<string, SentCommand>();
  #sentListeners = new Set<() => void>();

  constructor(connection: BluetoothConnection<MessagingCharacteristic>, commands: C) {
    this.connection = connection;
    this.commands = commands;
    this.#wasConnected = connection.getState().status === "connected";
    connection.subscribeState(this.#handleState);
  }

  /** Listens for every valid message from the device. Returns a function that removes the listener. */
  subscribe(listener: MessageListener<C>): () => void {
    return this.#listen(this.#listeners, listener);
  }

  /** The fields reported so far. Pairs with `subscribeState`. */
  getState = (): DeviceState<C> => this.#state;

  /** Notifies when the device state changes. Keeps notifications on while subscribed. */
  subscribeState = (listener: () => void): (() => void) => this.#listen(this.#stateListeners, listener);

  /** Listens for every line sent or received, valid or not. Returns a function that removes the listener. */
  subscribeTraffic(listener: TrafficListener): () => void {
    return this.#listen(this.#trafficListeners, listener);
  }

  /** Sends an action, e.g. `get_status`. Resolves once the device has acknowledged every packet of it. */
  sendAction(action: ActionName<C>): Promise<void> {
    return this.#write(formatAction(this.commands, action), { timestamp: Date.now(), name: action });
  }

  /**
   * Sends a setting. Resolves once the device has acknowledged every packet of it.
   * Throws `MessageFormatError` without sending anything if `value` does not match the setting's type.
   */
  sendSetting<S extends SettingName<C>>(setting: S, value: SettingValue<C, S>): Promise<void> {
    const sent = { timestamp: Date.now(), name: setting, value: value as SentCommand["value"] };
    return this.#write(formatSetting(this.commands, setting, value), sent);
  }

  /** The last action or setting of this name the device acknowledged during the current link, or null. */
  getLastSent(name: string): SentCommand | null {
    return this.#lastSent.get(name) ?? null;
  }

  /** Notifies when a command is sent or the remembered commands are cleared. Pairs with `getLastSent`. */
  subscribeSent = (listener: () => void): (() => void) => {
    this.#sentListeners.add(listener);
    return () => this.#sentListeners.delete(listener);
  };

  async #write(line: string, sent: SentCommand): Promise<void> {
    const bytes = encodeText(line);
    // Queue every chunk synchronously so chunks of concurrent sends cannot interleave.
    const writes: Promise<void>[] = [];
    for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTES) {
      writes.push(this.connection.write("toDevice", bytes.subarray(offset, offset + WRITE_CHUNK_BYTES)));
    }
    await Promise.all(writes);
    this.#emitTraffic({ direction: "out", line: line.trimEnd(), time: Date.now() });
    this.#lastSent.set(sent.name, sent);
    this.#sentListeners.forEach((listener) => listener());
  }

  #listen<L>(listeners: Set<L>, listener: L): () => void {
    listeners.add(listener);
    this.#unsubscribe ??= this.connection.subscribe("fromDevice", this.#receive);
    return () => {
      listeners.delete(listener);
      if (this.#listeners.size + this.#stateListeners.size + this.#trafficListeners.size > 0) return;
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#reset();
    };
  }

  #receive = (value: DataView) => {
    this.#buffer += this.#decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = this.#buffer.indexOf("\n")) !== -1) {
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line) this.#dispatch(line);
    }
    if (this.#buffer.length > MAX_LINE_LENGTH) {
      console.warn(`Dropped ${this.#buffer.length} characters from the device with no line ending.`);
      this.#buffer = "";
    }
  };

  #dispatch(line: string) {
    let message: DeviceMessage<C>;
    try {
      message = parseDeviceMessage(this.commands, line);
    } catch (error) {
      if (!(error instanceof MessageFormatError)) throw error;
      console.warn(`Ignored message from device: ${error.message}`, line);
      this.#emitTraffic({ direction: "in", line, time: Date.now(), problem: error.message });
      return;
    }
    this.#emitTraffic({ direction: "in", line, time: Date.now() });
    this.#merge(message);
    this.#listeners.forEach((listener) => listener(message));
  }

  #merge(message: DeviceMessage<C>) {
    // Only declared fields; `error`, `cmd` and unknown fields are not device state.
    const fields = Object.entries(message.data).filter(([field]) => Object.hasOwn(this.commands.fields, field));
    if (fields.length === 0) return;
    this.#state = {
      deviceId: message.deviceId,
      data: { ...this.#state.data, ...Object.fromEntries(fields) },
      updatedAt: Math.max(this.#state.updatedAt ?? 0, message.timestamp),
    };
    this.#stateListeners.forEach((listener) => listener());
  }

  #emitTraffic(entry: TrafficEntry) {
    this.#trafficListeners.forEach((listener) => listener(entry));
  }

  #handleState = () => {
    const { status } = this.connection.getState();
    // Values may differ on the next link (another unit, or changed on the device meanwhile).
    // A brief reconnect keeps them, since it is still the same unit.
    if (status === "disconnected") {
      if (this.#lastSent.size > 0) {
        this.#lastSent.clear();
        this.#sentListeners.forEach((listener) => listener());
      }
      if (this.#state !== emptyState) {
        this.#state = emptyState;
        this.#stateListeners.forEach((listener) => listener());
      }
    }

    const connected = status === "connected";
    if (connected === this.#wasConnected) return;
    this.#wasConnected = connected;
    // A packet cut off by the drop would corrupt the first line after reconnecting.
    this.#reset();
  };

  #reset() {
    this.#buffer = "";
    this.#decoder = new TextDecoder();
  }
}

// Values are DeviceMessenger<C> for whichever command set the device was first asked with.
const messengers = new WeakMap<BluetoothConnection, object>();

/** Returns the shared messenger for a device, e.g. `getMessenger(binHeightMeasurementProfile, binHeightMeasurementCommands)`. */
export function getMessenger<C extends CommandSet>(
  profile: DeviceProfile<MessagingCharacteristic>,
  commands: C,
): DeviceMessenger<C> {
  const connection = getConnection(profile);
  let messenger = messengers.get(connection) as DeviceMessenger<C> | undefined;
  if (!messenger) {
    messenger = new DeviceMessenger(connection, commands);
    messengers.set(connection, messenger);
  }
  return messenger;
}
