import type { Page, Request } from "@playwright/test";

/*
 * A stand-in for the asset tracker backend (contract in lib/asset-tracker/cloud.ts), served with
 * page.route. The test server is built with NEXT_PUBLIC_ASSET_TRACKER_API_URL pointing at this
 * host (see playwright.config.ts), so the real backend is never reached.
 */
export const TRACKER_API = "https://asset-tracker-api.test";

export type TrackerFields = Record<string, string | number | boolean>;

export type HistoryEntry = { time: number; latitude: number; longitude: number; moving?: boolean };

type Tracker = { fields: TrackerFields; history: HistoryEntry[] };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const DEFAULT_FIELDS: TrackerFields = {
  device_name: "Loader 7",
  latitude: 40.869072,
  longitude: -85.163016,
  battery_percentage: 76,
  battery_voltage: 3.87,
  is_moving: false,
  is_charging: true,
  tracking_mode: "active",
  stationary_interval_s: 1800,
  moving_interval_s: 60,
  inactivity_timeout_s: 300,
};

export class FakeTrackerApi {
  readonly trackers = new Map<string, Tracker>();
  /** Every command sent, as `{ serial, body }`, in order. */
  readonly commands: { serial: string; body: Record<string, string> }[] = [];
  /** When set, every request fails with this status (and `{ error }` body). */
  failWith: { status: number; error?: string } | null = null;
  /** When true, requests fail at the network level, as when offline. */
  unreachable = false;
  #timestamp = Date.now();

  addTracker(serial: string, fields: TrackerFields = {}, history: HistoryEntry[] = []) {
    this.trackers.set(serial, { fields: { ...DEFAULT_FIELDS, ...fields }, history });
  }

  /** Changes what the tracker reports from its next poll on. */
  report(serial: string, fields: TrackerFields) {
    const tracker = this.trackers.get(serial)!;
    Object.assign(tracker.fields, fields);
    this.#timestamp += 1000;
  }

  async install(page: Page) {
    await page.route(`${TRACKER_API}/**`, async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      if (this.unreachable) return route.abort("internetdisconnected");
      if (this.failWith) {
        return route.fulfill({ status: this.failWith.status, headers: CORS, json: { error: this.failWith.error } });
      }
      const { status, json } = this.#answer(request);
      return route.fulfill({ status, headers: CORS, json });
    });
  }

  #answer(request: Request): { status: number; json: unknown } {
    const url = new URL(request.url());
    const match = url.pathname.match(/^\/trackers\/([^/]+)\/(latest|commands|history)$/);
    if (!match) return { status: 404, json: { error: "not found" } };
    const serial = decodeURIComponent(match[1]);
    const tracker = this.trackers.get(serial);
    if (!tracker) return { status: 404, json: { error: "unknown tracker" } };

    switch (match[2]) {
      case "latest":
        return { status: 200, json: { deviceId: serial, timestamp: this.#timestamp, data: tracker.fields } };
      case "commands": {
        const body = request.postDataJSON() as Record<string, string>;
        this.commands.push({ serial, body });
        if (body.cmd) return { status: 200, json: { deviceId: serial, timestamp: Date.now(), data: tracker.fields } };
        const [setting, value] = Object.entries(body)[0];
        const field = setting.replace(/^set_/, "");
        const current = tracker.fields[field];
        tracker.fields[field] = typeof current === "number" ? Number(value) : value;
        return { status: 200, json: { deviceId: serial, timestamp: Date.now(), data: { [field]: tracker.fields[field] } } };
      }
      case "history": {
        const from = Number(url.searchParams.get("from"));
        const to = Number(url.searchParams.get("to"));
        const entries = tracker.history
          .filter(({ time }) => time >= from && time <= to)
          .map(({ time, latitude, longitude, moving }) => ({
            deviceId: serial,
            timestamp: time,
            data: moving === undefined ? { latitude, longitude } : { latitude, longitude, is_moving: moving },
          }));
        return { status: 200, json: entries };
      }
    }
    return { status: 404, json: {} };
  }
}
