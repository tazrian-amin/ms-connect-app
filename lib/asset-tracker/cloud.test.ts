import { beforeEach, describe, expect, it, vi } from "vitest";

// The API address is read when the module loads, so each test imports it afresh.
async function load(apiUrl: string | undefined = "https://api.test/") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_ASSET_TRACKER_API_URL", apiUrl);
  return import("./cloud");
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const signal = new AbortController().signal;

describe("createAssetTrackerCloudSource", () => {
  it("fetches the latest report by serial number", async () => {
    const { createAssetTrackerCloudSource } = await load();
    fetchMock.mockResolvedValue(json({ deviceId: "AT 1", timestamp: 5, data: { latitude: 1 } }));

    const source = createAssetTrackerCloudSource("AT 1");
    await expect(source.fetchLatest(signal)).resolves.toEqual({ deviceId: "AT 1", timestamp: 5, data: { latitude: 1 } });
    // Trailing slash on the base URL dropped, serial number escaped.
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/trackers/AT%201/latest", expect.anything());
  });

  it("posts commands as JSON", async () => {
    const { createAssetTrackerCloudSource } = await load();
    fetchMock.mockResolvedValue(json({ deviceId: "AT-1", timestamp: 5, data: {} }));

    await createAssetTrackerCloudSource("AT-1").sendCommand({ cmd: "get_config" }, signal);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/trackers/AT-1/commands");
    expect(init).toMatchObject({ method: "POST", body: '{"cmd":"get_config"}' });
  });

  it.each([
    [() => json({ error: "nope" }, 404), "No tracker with serial number AT-1 was found."],
    [() => json({ error: "database down" }, 500), "The cloud service couldn't answer (database down)."],
    [() => new Response("<html>", { status: 502 }), "The cloud service couldn't answer (error 502)."],
    [() => json({ hello: "world" }), "The cloud service sent something the app doesn't understand."],
  ])("explains a failed answer", async (response, message) => {
    const { createAssetTrackerCloudSource } = await load();
    fetchMock.mockResolvedValue(response());
    await expect(createAssetTrackerCloudSource("AT-1").fetchLatest(signal)).rejects.toThrow(message);
  });

  it("explains when the service can't be reached", async () => {
    const { createAssetTrackerCloudSource } = await load();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(createAssetTrackerCloudSource("AT-1").fetchLatest(signal)).rejects.toThrow(
      "Couldn't reach the cloud service. Check your internet connection and try again.",
    );
  });

  it("passes on an abort as it is", async () => {
    const { createAssetTrackerCloudSource } = await load();
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abort);
    await expect(createAssetTrackerCloudSource("AT-1").fetchLatest(controller.signal)).rejects.toBe(abort);
  });

  it("says when the build has no API address", async () => {
    const { createAssetTrackerCloudSource } = await load("");
    await expect(createAssetTrackerCloudSource("AT-1").fetchLatest(signal)).rejects.toThrow(
      "The cloud service isn't set up in this version of the app.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchAssetTrackerHistory", () => {
  it("returns the located reports, oldest first, keeping motion where reported", async () => {
    const { fetchAssetTrackerHistory } = await load();
    fetchMock.mockResolvedValue(
      json([
        { deviceId: "AT-1", timestamp: 300, data: { latitude: 3, longitude: 3, is_moving: true } },
        { deviceId: "AT-1", timestamp: 100, data: { latitude: 1, longitude: 1 } },
        { deviceId: "AT-1", timestamp: 200, data: { battery_percentage: 50 } }, // no location
        { deviceId: "AT-1", timestamp: "soon", data: { latitude: 2, longitude: 2 } }, // no time
        "garbage",
      ]),
    );

    await expect(fetchAssetTrackerHistory("AT-1", 0, 1000, signal)).resolves.toEqual([
      { latitude: 1, longitude: 1, time: 100 },
      { latitude: 3, longitude: 3, time: 300, moving: true },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/trackers/AT-1/history?from=0&to=1000");
  });

  it("rejects an answer that isn't a list", async () => {
    const { fetchAssetTrackerHistory } = await load();
    fetchMock.mockResolvedValue(json({ items: [] }));
    await expect(fetchAssetTrackerHistory("AT-1", 0, 1, signal)).rejects.toThrow(
      "The cloud service sent something the app doesn't understand.",
    );
  });
});
