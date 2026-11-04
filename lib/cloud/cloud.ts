import { encodeText } from "@/lib/bluetooth/codec";
import { bleLog } from "@/lib/bluetooth/debug";

/*
 * Cloud mode links a device that reports to the backend over its own network (e.g. cellular)
 * instead of over Bluetooth. A `CloudSource` fetches what the device last reported and forwards
 * commands to it; the link hands both on as the same NDJSON messages the device would notify over
 * Bluetooth (see lib/bluetooth/commands/README.md). Everything above the connection (messenger,
 * device state, edit mode, controls) works unchanged, as it does for a demo.
 *
 * The link keeps a snapshot of everything the device has reported, so the app can show the last
 * known data while the backend can't be reached, e.g. offline, and after the app restarts.
 */

/** One stored report or command reply: the same envelope a device sends over Bluetooth. */
export type CloudMessage = {
  deviceId: string;
  /** Epoch ms when the device produced the data. */
  timestamp: number;
  data: Record<string, unknown>;
};

/** The backend's view of one unit, picked by the serial number the user enters. */
export type CloudSource = {
  /** Shown as the connected device's name, e.g. the serial number. */
  name: string;
  /** Shown as the Device Information model. */
  model: string;
  /** How often to fetch the latest report. */
  intervalMs: number;
  /** The unit's latest report. Rejects with an `Error` whose message is fit to show the user. */
  fetchLatest(signal: AbortSignal): Promise<CloudMessage>;
  /**
   * Forwards one command, e.g. `{"cmd":"get_config"}` or `{"set_moving_interval_s":"60"}`, and
   * resolves to the reply. Rejects like `fetchLatest`.
   */
  sendCommand(command: Record<string, string>, signal: AbortSignal): Promise<CloudMessage>;
};

/** Where a link keeps its snapshot between visits. */
export type CloudCache = {
  /** Every field reported so far, latest value of each, from an earlier visit; null if none. */
  snapshot: CloudMessage | null;
  /** Called with the updated snapshot whenever a report or reply arrives. */
  save(snapshot: CloudMessage): void;
};

/** The cloud end of a connection: polls the backend for reports and forwards written commands to it. */
export class CloudLink {
  readonly source: CloudSource;
  readonly #send: (value: DataView) => void;
  readonly #onReachable: (reachable: boolean) => void;
  readonly #cache: CloudCache | undefined;
  readonly #abort = new AbortController();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #buffer = "";
  #decoder = new TextDecoder();
  #lastTimestamp: number | null = null;
  #snapshot: CloudMessage | null;

  /**
   * `send` receives each message as the device's notifications would carry it. `onReachable` is
   * told whether each poll after the first got through.
   */
  constructor(
    source: CloudSource,
    send: (value: DataView) => void,
    onReachable: (reachable: boolean) => void,
    cache?: CloudCache,
  ) {
    this.source = source;
    this.#send = send;
    this.#onReachable = onReachable;
    this.#cache = cache;
    this.#snapshot = cache?.snapshot ?? null;
  }

  /** Fetches the first report, rejecting if the backend doesn't know the unit, then keeps polling. */
  async start(): Promise<void> {
    this.#emit(await this.source.fetchLatest(this.#abort.signal));
    this.#schedulePoll();
  }

  /**
   * Picks up a link from an earlier visit: hands on the cached snapshot at once, then polls
   * straight away and keeps polling whether or not the backend answers.
   */
  resume(): void {
    this.replay();
    this.#schedulePoll(0);
  }

  /** Hands on the snapshot again, e.g. to a page that started listening after it arrived. */
  replay(): void {
    if (this.#snapshot && !this.#abort.signal.aborted) this.#deliver(this.#snapshot);
  }

  stop(): void {
    this.#abort.abort();
    clearTimeout(this.#timer);
  }

  /** Answers the standard Device Information reads. Battery level is one of the tracker's fields instead. */
  read(key: string): DataView {
    const text = { manufacturer: "Mining Sentry", model: this.source.model }[key];
    if (text !== undefined) return toDataView(encodeText(text));
    throw new DOMException(`The cloud has no "${key}" characteristic.`, "NotFoundError");
  }

  /**
   * Takes one chunk the app wrote to the device. Resolves once every command it completes has been
   * accepted by the backend, so the messenger reports a failed send as it would a failed write.
   */
  async write(value: BufferSource): Promise<void> {
    this.#buffer += this.#decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = this.#buffer.indexOf("\n")) !== -1) {
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line) await this.#forward(line);
    }
  }

  async #forward(line: string) {
    bleLog("cloud", `forwarding ${line}`);
    // The messenger only writes commands it has formatted itself.
    const reply = await this.source.sendCommand(JSON.parse(line), this.#abort.signal);
    // A reply always goes through, even one stamped the same as the last report.
    this.#emit(reply, true);
  }

  #schedulePoll(delay = this.source.intervalMs) {
    if (this.#abort.signal.aborted) return;
    this.#timer = setTimeout(async () => {
      try {
        this.#emit(await this.source.fetchLatest(this.#abort.signal));
        this.#onReachable(true);
      } catch (error) {
        if (this.#abort.signal.aborted) return;
        bleLog("cloud", "poll failed", error);
        this.#onReachable(false);
      }
      this.#schedulePoll();
    }, delay);
  }

  #emit(message: CloudMessage, always = false) {
    if (this.#abort.signal.aborted) return;
    // Polls between two reports return the same one again.
    if (!always && message.timestamp === this.#lastTimestamp) return;
    if (!always) this.#lastTimestamp = message.timestamp;
    this.#remember(message);
    this.#deliver(message);
  }

  #remember(message: CloudMessage) {
    // A rejection (`error`, `cmd`) is about one command, not the device's state.
    const fields = Object.fromEntries(Object.entries(message.data).filter(([key]) => key !== "error" && key !== "cmd"));
    if (Object.keys(fields).length === 0) return;
    const previous = this.#snapshot;
    this.#snapshot = {
      deviceId: message.deviceId,
      timestamp: Math.max(previous?.timestamp ?? 0, message.timestamp),
      data: { ...previous?.data, ...fields },
    };
    this.#cache?.save(this.#snapshot);
  }

  #deliver(message: CloudMessage) {
    this.#send(toDataView(encodeText(`${JSON.stringify(message)}\n`)));
  }
}

function toDataView(bytes: Uint8Array<ArrayBuffer>): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
