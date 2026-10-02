import { encodeText } from "./codec";
import {
  formatAppCommand,
  MessageFormatError,
  parseDeviceMessage,
  type AppCommand,
  type CommandSet,
  type CommandData,
  type CommandType,
  type DeviceMessage,
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

/**
 * Two-way message channel over a device's messaging characteristics (see ./commands/schema.ts).
 *
 * - Incoming packets are reassembled into lines, validated against the device's command set,
 *   and handed to listeners. Invalid lines are logged and dropped.
 * - Notifications are only enabled while something is listening.
 * - Outgoing commands are validated the same way before anything is written.
 * - On every (re)connect the partial-line buffer is cleared.
 */
export class DeviceMessenger<C extends CommandSet> {
  readonly connection: BluetoothConnection<MessagingCharacteristic>;
  readonly commands: C;

  #listeners = new Set<MessageListener<C>>();
  #unsubscribe: (() => void) | null = null;
  #decoder = new TextDecoder();
  #buffer = "";
  #wasConnected = false;

  constructor(connection: BluetoothConnection<MessagingCharacteristic>, commands: C) {
    this.connection = connection;
    this.commands = commands;
    this.#wasConnected = connection.getState().status === "connected";
    connection.subscribeState(this.#handleState);
  }

  /** Listens for every valid message from the device. Returns a function that removes the listener. */
  subscribe(listener: MessageListener<C>): () => void {
    this.#listeners.add(listener);
    this.#unsubscribe ??= this.connection.subscribe("fromDevice", this.#receive);
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size > 0) return;
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#reset();
    };
  }

  /**
   * Sends a command. Resolves once the device has acknowledged every packet of it.
   * Throws `MessageFormatError` without sending anything if `data` does not match the command set.
   */
  async send<T extends CommandType<C>>(type: T, data: CommandData<C, T>): Promise<void> {
    const command = { timestamp: Date.now(), type, data } as AppCommand<C>;
    const bytes = encodeText(formatAppCommand(this.commands, command));
    // Queue every chunk synchronously so chunks of concurrent sends cannot interleave.
    const writes: Promise<void>[] = [];
    for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTES) {
      writes.push(this.connection.write("toDevice", bytes.subarray(offset, offset + WRITE_CHUNK_BYTES)));
    }
    await Promise.all(writes);
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
      return;
    }
    this.#listeners.forEach((listener) => listener(message));
  }

  #handleState = () => {
    const connected = this.connection.getState().status === "connected";
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
