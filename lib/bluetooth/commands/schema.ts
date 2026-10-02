/*
 * Message format shared by all devices.
 *
 * Wire format: UTF-8 JSON, one message per line, each line terminated by "\n" (NDJSON).
 * A line may be split across any number of BLE packets; the receiver buffers until "\n",
 * so neither side needs to care about the negotiated MTU.
 *
 * Device → app (notified on the messaging "fromDevice" characteristic):
 *   {"deviceId":"FM-000123","timestamp":1759400000000,"type":"reading","data":{...}}
 *
 * App → device (written to the messaging "toDevice" characteristic):
 *   {"timestamp":1759400000000,"type":"reset","data":{}}
 *
 * - deviceId:  the unit's unique hardware ID (e.g. serial number), stable across reboots.
 * - timestamp: Unix epoch milliseconds when the message was created, by the sender's clock.
 *              Device timestamps are the source of truth for when data was produced; the app
 *              keeps them as received and never sets the device clock.
 * - type:      which message this is; one of the names declared in that device's command file.
 * - data:      the message's payload, always an object (`{}` when there is nothing to send).
 *              Receivers ignore fields they don't know, so new fields can be added safely.
 *
 * App commands carry no deviceId because the Bluetooth link already addresses one unit.
 */

/** Type of one `data` field. An array of strings means "one of these values". */
export type FieldType = "number" | "string" | "boolean" | "number[]" | "boolean[]" | "string[]" | readonly string[];

type FieldValue<F extends FieldType> = F extends "number"
  ? number
  : F extends "string"
    ? string
    : F extends "boolean"
      ? boolean
      : F extends "number[]"
        ? number[]
        : F extends "boolean[]"
          ? boolean[]
          : F extends "string[]"
            ? string[]
            : F extends readonly (infer V)[]
              ? V
              : never;

/** Field name → field type for one message's `data`. */
export type DataSchema = Record<string, FieldType>;

export type DataOf<S extends DataSchema> = { [F in keyof S]: FieldValue<S[F]> };

/** Message `type` → schema of its `data`. */
export type MessageSchemas = Record<string, DataSchema>;

/** Every message a device can send and every command it accepts, by `type`. */
export type CommandSet = {
  fromDevice: MessageSchemas;
  toDevice: MessageSchemas;
};

type PayloadIn<M extends MessageSchemas, T extends keyof M> = M[T] extends DataSchema ? DataOf<M[T]> : never;

export type MessageType<C extends CommandSet> = keyof C["fromDevice"] & string;
export type CommandType<C extends CommandSet> = keyof C["toDevice"] & string;
export type MessageData<C extends CommandSet, T extends MessageType<C>> = PayloadIn<C["fromDevice"], T>;
export type CommandData<C extends CommandSet, T extends CommandType<C>> = PayloadIn<C["toDevice"], T>;

/** A validated message from a device, narrowed by `type`. */
export type DeviceMessage<C extends CommandSet, T extends MessageType<C> = MessageType<C>> = {
  [M in T]: { deviceId: string; timestamp: number; type: M; data: MessageData<C, M> };
}[T];

/** A command from the app to a device, narrowed by `type`. */
export type AppCommand<C extends CommandSet, T extends CommandType<C> = CommandType<C>> = {
  [M in T]: { timestamp: number; type: M; data: CommandData<C, M> };
}[T];

/** Identity helper for one direction's schemas that keeps message types and field types as literals. */
export function defineMessages<const M extends MessageSchemas>(messages: M): M {
  return messages;
}

/** Identity helper that keeps message types and field types as literals. */
export function defineCommands<const F extends MessageSchemas, const T extends MessageSchemas>(commands: {
  fromDevice: F;
  toDevice: T;
}): { fromDevice: F; toDevice: T } {
  return commands;
}

export class MessageFormatError extends Error {
  constructor(
    message: string,
    readonly line: string,
  ) {
    super(message);
    this.name = "MessageFormatError";
  }
}

/** Parses and validates one line received from a device. Throws `MessageFormatError` if it does not match. */
export function parseDeviceMessage<C extends CommandSet>(commands: C, line: string): DeviceMessage<C> {
  const fail = (reason: string): never => {
    throw new MessageFormatError(reason, line);
  };

  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    fail("Not valid JSON.");
  }
  if (!isObject(message)) return fail("Message is not a JSON object.");

  const { deviceId, timestamp, type, data } = message;
  if (typeof deviceId !== "string" || deviceId === "") fail("`deviceId` must be a non-empty string.");
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) fail("`timestamp` must be a number.");
  const problem = checkPayload(commands.fromDevice, type, data);
  if (problem) fail(problem);
  return message as DeviceMessage<C>;
}

/** Serializes a command as one line, newline included. Throws `MessageFormatError` if it does not match. */
export function formatAppCommand<C extends CommandSet>(commands: C, command: AppCommand<C>): string {
  // Types already catch most mistakes; this also catches casts and values built from user input.
  const problem = checkPayload(commands.toDevice, command.type, command.data);
  if (problem) throw new MessageFormatError(problem, JSON.stringify(command));
  return `${JSON.stringify({ timestamp: command.timestamp, type: command.type, data: command.data })}\n`;
}

/** Why `type` and `data` do not match the schemas, or null if they do. */
function checkPayload(schemas: MessageSchemas, type: unknown, data: unknown): string | null {
  if (typeof type !== "string" || type === "") return "`type` must be a non-empty string.";
  if (!Object.hasOwn(schemas, type)) return `Unknown message type ${JSON.stringify(type)}.`;
  if (!isObject(data)) return "`data` must be a JSON object.";

  for (const [field, fieldType] of Object.entries(schemas[type])) {
    if (!matches(data[field], fieldType)) return `\`data.${field}\` of "${type}" must be ${describe(fieldType)}.`;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matches(value: unknown, type: FieldType): boolean {
  if (typeof type !== "string") return typeof value === "string" && type.includes(value);
  switch (type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
    case "boolean":
      return typeof value === type;
    case "number[]":
      return Array.isArray(value) && value.every((item) => matches(item, "number"));
    case "boolean[]":
      return Array.isArray(value) && value.every((item) => typeof item === "boolean");
    case "string[]":
      return Array.isArray(value) && value.every((item) => typeof item === "string");
  }
}

function describe(type: FieldType): string {
  return typeof type === "string" ? `a ${type}` : `one of ${type.map((value) => JSON.stringify(value)).join(", ")}`;
}
