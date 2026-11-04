import type { CloudMessage, CloudSource } from "@/lib/cloud/cloud";

/*
 * The asset tracker reports over its own network (GPS + cellular) to the backend rather than over
 * Bluetooth, and the app reads it from there by the serial number printed on the unit.
 *
 * TODO: Agree this contract with the backend. Expected endpoints, relative to
 * NEXT_PUBLIC_ASSET_TRACKER_API_URL (which must allow this app's origin through CORS):
 *
 *   GET  /trackers/{serial}/latest     the unit's latest report
 *   POST /trackers/{serial}/commands   one command, body as over Bluetooth, e.g. {"cmd":"get_config"}
 *                                      or {"set_moving_interval_s":"60"}; replies with the fields it
 *                                      affects, or a rejection as {"error":"...","cmd":"..."} in `data`
 *
 * Both answer 200 with the Bluetooth message envelope, so the backend can store what the tracker
 * sends as is (fields in lib/bluetooth/commands/asset-tracker.ts):
 *
 *   {"deviceId":"AT-000123","timestamp":1759400000000,"data":{"latitude":23.81,"longitude":90.41,...}}
 *
 * 404 means no tracker has that serial number. Any other failure may carry {"error":"<why>"}.
 */

const API_URL = process.env.NEXT_PUBLIC_ASSET_TRACKER_API_URL;
// Trackers report every minute at most while moving (see moving_interval_s), so this keeps up.
const POLL_INTERVAL_MS = 15_000;

export function createAssetTrackerCloudSource(serialNumber: string): CloudSource {
  const path = `/trackers/${encodeURIComponent(serialNumber)}`;
  return {
    name: serialNumber,
    model: "Asset Tracker",
    intervalMs: POLL_INTERVAL_MS,
    fetchLatest: (signal) => request(`${path}/latest`, { signal }, serialNumber),
    sendCommand: (command, signal) =>
      request(
        `${path}/commands`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command), signal },
        serialNumber,
      ),
  };
}

async function request(path: string, init: RequestInit, serialNumber: string): Promise<CloudMessage> {
  if (!API_URL) throw new Error("The cloud service isn't set up in this version of the app.");
  let response: Response;
  try {
    response = await fetch(`${API_URL.replace(/\/+$/, "")}${path}`, { ...init, cache: "no-store" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error("Couldn't reach the cloud service. Check your internet connection and try again.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 404) throw new Error(`No tracker with serial number ${serialNumber} was found.`);
  if (!response.ok) {
    const reason = isRecord(body) && typeof body.error === "string" ? body.error : `error ${response.status}`;
    throw new Error(`The cloud service couldn't answer (${reason}).`);
  }
  if (!isRecord(body) || typeof body.deviceId !== "string" || !isRecord(body.data)) {
    throw new Error("The cloud service sent something the app doesn't understand.");
  }
  return { deviceId: body.deviceId, timestamp: Number(body.timestamp) || 0, data: body.data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
