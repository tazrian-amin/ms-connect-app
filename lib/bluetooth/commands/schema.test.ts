import { describe, expect, it, vi } from "vitest";
import { decodeText, encodeText, toHex } from "../codec";
import { defineCommands, formatAction, formatSetting, MessageFormatError, parseDeviceMessage } from "./schema";

const commands = defineCommands({
  fields: {
    level: "number",
    name: "string",
    on: "boolean",
    mode: ["auto", "manual"],
    readings: "number[]",
  },
  actions: ["get_reading"],
  settings: {
    set_level: "number",
    set_on: "boolean",
    set_mode: ["auto", "manual"],
    set_name: "string",
  },
});

const line = (message: object) => JSON.stringify(message);

describe("parseDeviceMessage", () => {
  it("accepts a valid message", () => {
    const message = parseDeviceMessage(
      commands,
      line({ deviceId: "D1", timestamp: 1000, data: { level: 2.5, mode: "auto", readings: [1, 2] } }),
    );
    expect(message).toEqual({ deviceId: "D1", timestamp: 1000, data: { level: 2.5, mode: "auto", readings: [1, 2] } });
  });

  it("stamps a message without a clock (timestamp 0) with the time it arrived", () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    expect(parseDeviceMessage(commands, line({ deviceId: "D1", timestamp: 0, data: {} })).timestamp).toBe(42);
  });

  it("ignores fields it doesn't know, so firmware can add them first", () => {
    expect(() => parseDeviceMessage(commands, line({ deviceId: "D1", timestamp: 1, data: { new_field: "x" } }))).not.toThrow();
  });

  it("accepts a rejection", () => {
    const message = parseDeviceMessage(
      commands,
      line({ deviceId: "D1", timestamp: 1, data: { error: "Out of range", cmd: "set_level" } }),
    );
    expect(message.data).toEqual({ error: "Out of range", cmd: "set_level" });
  });

  it.each([
    ["not JSON", "{oops", "Not valid JSON."],
    ["an array", "[]", "Message is not a JSON object."],
    ["no device ID", line({ deviceId: "", timestamp: 1, data: {} }), "`deviceId` must be a non-empty string."],
    ["a negative timestamp", line({ deviceId: "D1", timestamp: -1, data: {} }), "`timestamp` must be a number of epoch milliseconds, or 0."],
    ["no data", line({ deviceId: "D1", timestamp: 1 }), "`data` must be a JSON object."],
    ["a wrong type", line({ deviceId: "D1", timestamp: 1, data: { level: "high" } }), "`data.level` must be a number."],
    ["an unknown option", line({ deviceId: "D1", timestamp: 1, data: { mode: "turbo" } }), '`data.mode` must be one of "auto", "manual".'],
    ["a bad array item", line({ deviceId: "D1", timestamp: 1, data: { readings: [1, "2"] } }), "`data.readings` must be a number[]."],
    ["an infinite number", '{"deviceId":"D1","timestamp":1,"data":{"level":1e999}}', "`data.level` must be a number."],
  ])("rejects %s", (_, input, reason) => {
    expect(() => parseDeviceMessage(commands, input)).toThrowError(new MessageFormatError(reason, input));
  });
});

describe("formatAction / formatSetting", () => {
  it("writes one JSON line per command", () => {
    expect(formatAction(commands, "get_reading")).toBe('{"cmd":"get_reading"}\n');
    expect(formatSetting(commands, "set_level", 12.5)).toBe('{"set_level":"12.5"}\n');
    expect(formatSetting(commands, "set_mode", "manual")).toBe('{"set_mode":"manual"}\n');
    expect(formatSetting(commands, "set_name", 'Pump "A"')).toBe('{"set_name":"Pump \\"A\\""}\n');
  });

  it("sends booleans as 1 or 0", () => {
    expect(formatSetting(commands, "set_on", true)).toBe('{"set_on":"1"}\n');
    expect(formatSetting(commands, "set_on", false)).toBe('{"set_on":"0"}\n');
  });

  it("refuses commands and values the device doesn't take", () => {
    expect(() => formatAction(commands, "self_destruct")).toThrow('Unknown action "self_destruct".');
    expect(() => formatSetting(commands, "set_volume", 1)).toThrow('Unknown setting "set_volume".');
    expect(() => formatSetting(commands, "set_level", "12")).toThrow("set_level must be a number.");
    expect(() => formatSetting(commands, "set_level", Number.NaN)).toThrow("set_level must be a number.");
    expect(() => formatSetting(commands, "set_mode", "turbo")).toThrow('set_mode must be one of "auto", "manual".');
  });
});

describe("codec", () => {
  const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

  it("round-trips text, dropping trailing NUL padding", () => {
    const encoded = encodeText("Héllo");
    expect(decodeText(new DataView(encoded.buffer))).toBe("Héllo");
    expect(decodeText(view([0x4f, 0x4b, 0, 0, 0]))).toBe("OK");
  });

  it("dumps bytes as hex", () => {
    expect(toHex(view([0x0a, 0xff, 0x3c]))).toBe("0a ff 3c");
    expect(toHex(new DataView(new Uint8Array([1, 2, 3, 4]).buffer, 1, 2))).toBe("02 03");
  });
});
