import { encodeText } from "./codec";
import type { ActionName, CommandSet, DeviceData, ReservedFields, SettingName } from "./commands/schema";

/*
 * Demo mode lets a visitor try a device's dashboard without the hardware. A `DemoSimulator` stands
 * in for the firmware: the connection hands it the same command lines the app would write over
 * Bluetooth, and it answers with the same NDJSON messages (see ./commands/README.md). Everything
 * above the connection (messenger, device state, edit mode, controls) works unchanged.
 */

/** What a simulator reports: any of the device's fields, or a rejection. */
export type DemoReply<C extends CommandSet> = DeviceData<C> & ReservedFields;

/** Pretend firmware for one device type. Create a fresh one for every demo, so each starts over. */
export type DemoSimulator<C extends CommandSet = CommandSet> = {
  /** Reported as `deviceId`, e.g. "DEMO-CVS-0001". Read for every message, so a setting can change it. */
  deviceId: string;
  /** Shown as the advertised device name. */
  name: string;
  /** Read back as the Device Information model number. */
  model: string;
  /** How often `tick` runs. Read before every tick, so a setting can change it. */
  intervalMs: number;
  /** A periodic update, also sent right after the demo starts. Advances the simulation. */
  tick(): DemoReply<C>;
  /** The reply to an action. */
  action(name: ActionName<C>): DemoReply<C>;
  /** The reply to a setting, whose value arrives as a string as it would on the wire. */
  setting(name: SettingName<C>, value: string): DemoReply<C>;
};

// A real link takes a moment to answer; replying instantly would make pending states flash.
const REPLY_DELAY_MS = 250;
// Readings "from before the demo started", sent at once so telemetry charts don't start empty.
const BACKLOG_READINGS = 90;

/** The simulated end of a demo connection: buffers written bytes into lines and answers them. */
export class DemoLink {
  readonly simulator: DemoSimulator;
  readonly #send: (value: DataView) => void;
  #buffer = "";
  #decoder = new TextDecoder();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #stopped = false;
  #replies = new Set<ReturnType<typeof setTimeout>>();

  /** Starts the simulation. `send` receives each message as the device's notifications would carry it. */
  constructor(simulator: DemoSimulator, send: (value: DataView) => void) {
    this.simulator = simulator;
    this.#send = send;
    this.#later(() => {
      const now = Date.now();
      for (let age = BACKLOG_READINGS; age > 0; age--) this.#emit(simulator.tick(), now - age * simulator.intervalMs);
      this.#emit(simulator.tick(), now);
      this.#scheduleTick();
    });
  }

  stop(): void {
    this.#stopped = true;
    clearTimeout(this.#timer);
    this.#replies.forEach(clearTimeout);
    this.#replies.clear();
  }

  /**
   * Answers the standard Device Information reads. Demo devices have no battery, like most of the
   * real ones, which run on mains power; the battery read fails, so it isn't shown.
   */
  read(key: string): DataView {
    const text = { manufacturer: "Mining Sentry", model: this.simulator.model, firmware: "Demo" }[key];
    if (text !== undefined) return toDataView(encodeText(text));
    throw new DOMException(`The demo device has no "${key}" characteristic.`, "NotFoundError");
  }

  /** Takes one chunk the app wrote to the device, and answers once a whole command has arrived. */
  write(value: BufferSource): void {
    this.#buffer += this.#decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = this.#buffer.indexOf("\n")) !== -1) {
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line) this.#later(() => this.#emit(this.#answer(line)));
    }
  }

  #answer(line: string): DemoReply<CommandSet> {
    let command: Record<string, unknown>;
    try {
      command = JSON.parse(line);
    } catch {
      return { error: "Not valid JSON." };
    }
    const [entry, ...rest] = Object.entries(command);
    if (!entry || rest.length > 0) return { error: "A command must have exactly one key." };
    const [key, value] = entry;
    if (typeof value !== "string") return { error: "Command values must be strings.", cmd: key };
    const reply = key === "cmd" ? this.simulator.action(value) : this.simulator.setting(key, value);
    // The app validates commands before sending, so this only guards a simulator that missed one.
    return reply ?? { error: `Unknown command ${key === "cmd" ? value : key}.`, cmd: key === "cmd" ? value : key };
  }

  #scheduleTick() {
    if (this.#stopped) return;
    this.#timer = setTimeout(() => {
      this.#emit(this.simulator.tick());
      this.#scheduleTick();
    }, this.simulator.intervalMs);
  }

  #emit(data: DemoReply<CommandSet>, timestamp = Date.now()) {
    const message = { deviceId: this.simulator.deviceId, timestamp, data };
    this.#send(toDataView(encodeText(`${JSON.stringify(message)}\n`)));
  }

  #later(run: () => void) {
    if (this.#stopped) return;
    const timer = setTimeout(() => {
      this.#replies.delete(timer);
      run();
    }, REPLY_DELAY_MS);
    this.#replies.add(timer);
  }
}

function toDataView(bytes: Uint8Array<ArrayBuffer>): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Moves `value` a random step towards `target`, kept within `min`..`max`, rounded to `decimals`. */
export function drift(value: number, target: number, spread: number, min: number, max: number, decimals = 1): number {
  const next = value + (target - value) * 0.2 + (Math.random() - 0.5) * spread;
  const factor = 10 ** decimals;
  return Math.round(Math.min(max, Math.max(min, next)) * factor) / factor;
}
