import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceDemos } from "@/lib/connection/registry";
import { decodeText, encodeText } from "./codec";
import { deviceCommands } from "./commands";
import { parseDeviceMessage } from "./commands/schema";
import { DemoLink, drift, type DemoSimulator } from "./demo";

/*
 * Every device's demo stands in for its firmware, so what it sends must be what the real device is
 * allowed to send: a message the app's own parser accepts, with only the fields the device declares.
 */

const TICKS = 500;

function checkReply(slug: string, simulator: DemoSimulator, data: object) {
  const message = parseDeviceMessage(
    deviceCommands[slug],
    JSON.stringify({ deviceId: simulator.deviceId, timestamp: 1, data }),
  );
  const declared = [...Object.keys(deviceCommands[slug].fields), "error", "cmd"];
  expect(Object.keys(message.data).filter((field) => !declared.includes(field))).toEqual([]);
  return message.data;
}

describe.each(Object.keys(deviceCommands))("the %s demo", (slug) => {
  const create = deviceDemos[slug]!;

  it("exists", () => {
    expect(create).toBeTypeOf("function");
  });

  it("sends only valid, declared readings, many ticks in a row", () => {
    const simulator = create();
    expect(simulator.deviceId).not.toBe("");
    expect(simulator.intervalMs).toBeGreaterThan(0);
    for (let i = 0; i < TICKS; i++) {
      const data = checkReply(slug, simulator, simulator.tick());
      expect(data.error).toBeUndefined();
      for (const value of Object.values(data)) {
        if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("answers every action the device declares, without an error", () => {
    const simulator = create();
    simulator.tick();
    for (const action of deviceCommands[slug].actions) {
      expect(checkReply(slug, simulator, simulator.action(action)).error, action).toBeUndefined();
    }
  });

  it("answers every setting with a valid message, even for a nonsense value", () => {
    const simulator = create();
    for (const setting of Object.keys(deviceCommands[slug].settings)) {
      const reply = simulator.setting(setting, "not a valid value \u0000");
      expect(reply, setting).toBeDefined();
      checkReply(slug, simulator, reply);
    }
  });

  it("starts over for each demo", () => {
    const first = create();
    for (let i = 0; i < 50; i++) first.tick();
    const second = create();
    expect(second.tick()).toBeDefined();
    expect(second).not.toBe(first);
  });
});

describe("drift", () => {
  it("stays within its bounds and rounds to the given decimals", () => {
    let value = 5;
    for (let i = 0; i < 1_000; i++) {
      value = drift(value, 50, 30, 0, 10, 2);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
      expect(Math.round(value * 100) / 100).toBe(value);
    }
  });

  it("moves towards its target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(drift(0, 10, 1, 0, 100)).toBe(2);
  });
});

describe("DemoLink", () => {
  const simulator = (): DemoSimulator => ({
    deviceId: "DEMO-1",
    name: "Demo",
    model: "Test Model",
    intervalMs: 1_000,
    tick: () => ({ level: 1 }),
    action: (name) => (name === "known" ? { level: 2 } : (undefined as never)),
    setting: (name, value) => ({ [name]: value }),
  });

  let sent: Array<{ deviceId: string; timestamp: number; data: Record<string, unknown> }>;
  let link: DemoLink;
  const write = (text: string) => link.write(encodeText(text));

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    link = new DemoLink(simulator(), (value) => {
      const text = decodeText(value);
      expect(text.endsWith("\n")).toBe(true);
      sent.push(JSON.parse(text));
    });
  });

  afterEach(() => {
    link.stop();
    vi.useRealTimers();
  });

  it("sends a backlog of past readings after a short delay, then one per interval", () => {
    expect(sent).toHaveLength(0);
    vi.advanceTimersByTime(250);
    expect(sent).toHaveLength(91);
    const times = sent.map(({ timestamp }) => timestamp);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(sent.every(({ deviceId }) => deviceId === "DEMO-1")).toBe(true);

    vi.advanceTimersByTime(1_000);
    expect(sent).toHaveLength(92);
  });

  it("stops sending once stopped", () => {
    vi.advanceTimersByTime(250);
    link.stop();
    vi.advanceTimersByTime(10_000);
    expect(sent).toHaveLength(91);
  });

  it("answers a command only once its whole line has arrived, even split across writes", () => {
    vi.advanceTimersByTime(250);
    sent = [];
    write('{"cmd":');
    write('"known"}\n{"set_x":"7"}\n');
    vi.advanceTimersByTime(250);
    expect(sent.map(({ data }) => data)).toEqual([{ level: 2 }, { set_x: "7" }]);
  });

  it("rejects malformed commands the way firmware would", () => {
    vi.advanceTimersByTime(250);
    sent = [];
    write("not json\n");
    write('{"a":"1","b":"2"}\n');
    write('{"cmd":3}\n');
    write('{"cmd":"unknown"}\n');
    write("   \n");
    vi.advanceTimersByTime(250);
    expect(sent.map(({ data }) => data)).toEqual([
      { error: "Not valid JSON." },
      { error: "A command must have exactly one key." },
      { error: "Command values must be strings.", cmd: "cmd" },
      { error: "Unknown command unknown.", cmd: "unknown" },
    ]);
  });

  it("answers the Device Information reads, and has no battery", () => {
    expect(decodeText(link.read("model"))).toBe("Test Model");
    expect(decodeText(link.read("manufacturer"))).toBe("Mining Sentry");
    expect(() => link.read("battery")).toThrow(DOMException);
  });
});
