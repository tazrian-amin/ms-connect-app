import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeText } from "@/lib/bluetooth/codec";
import { CloudLink, type CloudMessage, type CloudSource } from "./cloud";

/** A backend whose answers the test sets; records the commands it gets. */
function fakeSource() {
  let latest: CloudMessage | Error = { deviceId: "AT-1", timestamp: 1, data: { battery_percentage: 80 } };
  const commands: Record<string, string>[] = [];
  const source: CloudSource = {
    name: "AT-1",
    model: "Asset Tracker",
    intervalMs: 1000,
    fetchLatest: vi.fn(async () => {
      if (latest instanceof Error) throw latest;
      return latest;
    }),
    sendCommand: vi.fn(async (command) => {
      commands.push(command);
      return { deviceId: "AT-1", timestamp: 99, data: { moving_interval_s: Number(Object.values(command)[0]) } };
    }),
  };
  return { source, commands, report: (next: CloudMessage | Error) => (latest = next) };
}

/** Starts a link and collects what it hands on, decoded. */
function link(source: CloudSource, snapshot: CloudMessage | null = null) {
  const delivered: CloudMessage[] = [];
  const reachable: boolean[] = [];
  const saved: CloudMessage[] = [];
  const cloud = new CloudLink(
    source,
    (value) => delivered.push(JSON.parse(decodeText(value))),
    (ok) => reachable.push(ok),
    { snapshot, save: (message) => saved.push(message) },
  );
  return { cloud, delivered, reachable, saved };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CloudLink", () => {
  it("hands on the first report, then polls", async () => {
    const { source, report } = fakeSource();
    const { cloud, delivered, reachable } = link(source);
    await cloud.start();
    expect(delivered).toEqual([{ deviceId: "AT-1", timestamp: 1, data: { battery_percentage: 80 } }]);

    report({ deviceId: "AT-1", timestamp: 2, data: { battery_percentage: 79 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(delivered.at(-1)!.data).toEqual({ battery_percentage: 79 });
    expect(reachable).toEqual([true]);
    cloud.stop();
  });

  it("doesn't hand on the same report twice", async () => {
    const { source } = fakeSource();
    const { cloud, delivered } = link(source);
    await cloud.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(delivered).toHaveLength(1);
    expect(source.fetchLatest).toHaveBeenCalledTimes(4);
    cloud.stop();
  });

  it("rejects start() when the backend doesn't know the unit", async () => {
    const { source, report } = fakeSource();
    report(new Error("No tracker with serial number AT-1 was found."));
    const { cloud, delivered } = link(source);
    await expect(cloud.start()).rejects.toThrow("No tracker with serial number AT-1 was found.");
    expect(delivered).toEqual([]);
  });

  it("reports when the backend can't be reached, and keeps polling until it can", async () => {
    const { source, report } = fakeSource();
    const { cloud, reachable } = link(source);
    await cloud.start();

    report(new Error("offline"));
    await vi.advanceTimersByTimeAsync(2000);
    report({ deviceId: "AT-1", timestamp: 5, data: {} });
    await vi.advanceTimersByTimeAsync(1000);
    expect(reachable).toEqual([false, false, true]);
    cloud.stop();
  });

  it("keeps a snapshot of every field reported so far, without rejections", async () => {
    const { source, report } = fakeSource();
    const { cloud, saved } = link(source);
    await cloud.start();
    report({ deviceId: "AT-1", timestamp: 2, data: { latitude: 40, error: "nope", cmd: "set_x" } });
    await vi.advanceTimersByTimeAsync(1000);

    expect(saved.at(-1)).toEqual({ deviceId: "AT-1", timestamp: 2, data: { battery_percentage: 80, latitude: 40 } });
    cloud.stop();
  });

  it("forwards each command line the app writes, and hands on the reply", async () => {
    const { source, commands } = fakeSource();
    const { cloud, delivered } = link(source);
    await cloud.start();

    // Written in two chunks, as a long line might be over Bluetooth.
    await cloud.write(new TextEncoder().encode('{"set_moving_'));
    expect(commands).toEqual([]);
    await cloud.write(new TextEncoder().encode('interval_s":"120"}\n'));

    expect(commands).toEqual([{ set_moving_interval_s: "120" }]);
    expect(delivered.at(-1)).toEqual({ deviceId: "AT-1", timestamp: 99, data: { moving_interval_s: 120 } });
    cloud.stop();
  });

  it("resume() shows the cached snapshot straight away, then polls at once", async () => {
    const { source } = fakeSource();
    const cached = { deviceId: "AT-1", timestamp: 0, data: { battery_percentage: 50 } };
    const { cloud, delivered } = link(source, cached);
    cloud.resume();
    expect(delivered).toEqual([cached]);

    await vi.advanceTimersByTimeAsync(0);
    expect(source.fetchLatest).toHaveBeenCalledTimes(1);
    expect(delivered.at(-1)!.data).toEqual({ battery_percentage: 80 });
    cloud.stop();
  });

  it("stops polling once stopped", async () => {
    const { source } = fakeSource();
    const { cloud } = link(source);
    await cloud.start();
    cloud.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(source.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it("answers the Device Information reads", () => {
    const { cloud } = link(fakeSource().source);
    expect(decodeText(cloud.read("manufacturer"))).toBe("Mining Sentry");
    expect(decodeText(cloud.read("model"))).toBe("Asset Tracker");
    expect(() => cloud.read("serial")).toThrow('The cloud has no "serial" characteristic.');
  });
});
