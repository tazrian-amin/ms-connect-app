/*
 * Message format shared by all devices. The full spec for firmware developers is ./README.md.
 *
 * Wire format: UTF-8 JSON, one message per line, each line terminated by "\n" (NDJSON).
 * A line may be split across any number of BLE packets; the receiver buffers until "\n",
 * so neither side needs to care about the negotiated MTU.
 *
 * Device → app (notified on the messaging "fromDevice" characteristic):
 *   {"deviceId":"FM-000123","timestamp":1759400000000,"data":{"flow_rate":12.5}}
 *
 * - deviceId:  the unit's unique hardware ID (e.g. serial number), stable across reboots.
 * - timestamp: Unix epoch milliseconds when the data was produced, by the device's clock.
 *              0 means the device does not know the time yet; the app then uses the arrival time.
 * - data:      any subset of the device's declared fields. The app keeps the latest value of each
 *              field, so a field means the same thing in every message. Unknown fields are ignored.
 *              `error` and `cmd` are reserved: a rejected command is reported as
 *              {"error":"<why>","cmd":"<command or setting name>"}.
 *
 * App → device (written to the messaging "toDevice" characteristic):
 *   {"cmd":"get_reading"}       an action: a command with no argument
 *   {"set_bin_height":"6.5"}    a setting: the key names it and the value is always a string
 */

/** Type of one `data` field. An array of strings means "one of these values". */
export type FieldType = "number" | "string" | "boolean" | "number[]" | "boolean[]" | "string[]" | readonly string[];

/** Settings travel as a single string, so they can only hold a single value. */
export type SettingType = "number" | "string" | "boolean" | readonly string[];

export type FieldValue<F extends FieldType> = F extends "number"
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

/** Field name → field type. */
export type DataSchema = Record<string, FieldType>;

/** Everything a device reports and every command it accepts. */
export type CommandSet = {
  /** Every field the device may report in `data`. */
  fields: DataSchema;
  /** Commands with no argument, sent as {"cmd":"<action>"}. */
  actions: readonly string[];
  /** Values the app can set, sent as {"<setting>":"<value>"}. */
  settings: Record<string, SettingType>;
};

/** Identity helper that keeps names and field types as literals. */
export function defineCommands<
  const F extends DataSchema,
  const A extends readonly string[],
  const S extends Record<string, SettingType>,
>(commands: { fields: F; actions: A; settings: S }): { fields: F; actions: A; settings: S } {
  return commands;
}

export type FieldName<C extends CommandSet> = keyof C["fields"] & string;
export type ActionName<C extends CommandSet> = C["actions"][number];
export type SettingName<C extends CommandSet> = keyof C["settings"] & string;
export type SettingValue<C extends CommandSet, S extends SettingName<C>> = FieldValue<C["settings"][S]>;

/** Fields reserved in every device's `data`. */
export type ReservedFields = {
  /** Why the device rejected a command. */
  error?: string;
  /** The action or setting a reply answers. */
  cmd?: string;
};

/** The fields a device reported. Each one is present only if the device has sent it. */
export type DeviceData<C extends CommandSet> = { [F in FieldName<C>]?: FieldValue<C["fields"][F]> };

/** A validated message from a device. */
export type DeviceMessage<C extends CommandSet> = {
  deviceId: string;
  /** Epoch ms. */
  timestamp: number;
  data: DeviceData<C> & ReservedFields;
};

/** A command the app sent, as remembered by the messenger. */
export type SentCommand = { timestamp: number; name: string; value?: string | number | boolean };

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

  const { deviceId, timestamp, data } = message;
  if (typeof deviceId !== "string" || deviceId === "") fail("`deviceId` must be a non-empty string.");
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0) {
    fail("`timestamp` must be a number of epoch milliseconds, or 0.");
  }
  if (!isObject(data)) return fail("`data` must be a JSON object.");

  for (const [field, value] of Object.entries(data)) {
    const type: FieldType | undefined =
      field === "error" || field === "cmd" ? "string" : Object.hasOwn(commands.fields, field) ? commands.fields[field] : undefined;
    // Unknown fields are ignored so firmware can add fields before the app knows them.
    if (type !== undefined && !matches(value, type)) fail(`\`data.${field}\` must be ${describe(type)}.`);
  }

  return {
    deviceId: deviceId as string,
    timestamp: (timestamp as number) || Date.now(),
    data: data as DeviceMessage<C>["data"],
  };
}

/** Serializes an action as one line, newline included. Throws `MessageFormatError` if the device has no such action. */
export function formatAction<C extends CommandSet>(commands: C, action: string): string {
  if (!commands.actions.includes(action)) {
    throw new MessageFormatError(`Unknown action ${JSON.stringify(action)}.`, action);
  }
  return `${JSON.stringify({ cmd: action })}\n`;
}

/**
 * Serializes a setting as one line, newline included. Every value is sent as a string; booleans as "1" or "0".
 * Throws `MessageFormatError` if the device has no such setting or the value does not match its type.
 */
export function formatSetting<C extends CommandSet>(commands: C, setting: string, value: unknown): string {
  const fail = (reason: string): never => {
    throw new MessageFormatError(reason, `${setting}=${String(value)}`);
  };
  if (!Object.hasOwn(commands.settings, setting)) fail(`Unknown setting ${JSON.stringify(setting)}.`);
  // Types already catch most mistakes; this also catches casts and values built from user input.
  const type = commands.settings[setting];
  if (!matches(value, type)) fail(`${setting} must be ${describe(type)}.`);
  const text = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  return `${JSON.stringify({ [setting]: text })}\n`;
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
