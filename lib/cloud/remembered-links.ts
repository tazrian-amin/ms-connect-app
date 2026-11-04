import { deviceCloudSources, deviceProfiles, getConnection } from "@/lib/connection/registry";
import type { CloudCache, CloudMessage } from "./cloud";

/*
 * A unit linked through the cloud (see ./cloud.ts) stays linked until the user disconnects it,
 * across visits and while offline, showing the last data it reported. What it is and what it last
 * reported are kept in this browser's localStorage. Without storage, it is kept for the visit.
 */

type RememberedCloudLink = { serialNumber: string; snapshot: CloudMessage | null };

const cloudLinkKey = (slug: string) => `ms-connect:cloud-link:${slug}`;

function readCloudLink(slug: string): RememberedCloudLink | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(cloudLinkKey(slug)) ?? "null");
    if (stored && typeof stored.serialNumber === "string") return stored;
  } catch {
    // Storage blocked or the stored value is corrupt: nothing to resume.
  }
  return null;
}

function writeCloudLink(slug: string, link: RememberedCloudLink | null) {
  try {
    if (link) window.localStorage.setItem(cloudLinkKey(slug), JSON.stringify(link));
    else window.localStorage.removeItem(cloudLinkKey(slug));
  } catch {
    // Storage blocked or full; the link lasts for this visit only.
  }
}

/** Remembers the unit from its first report onward, with the latest snapshot of its data. */
function cloudCache(slug: string, serialNumber: string, snapshot: CloudMessage | null): CloudCache {
  return { snapshot, save: (latest) => writeCloudLink(slug, { serialNumber, snapshot: latest }) };
}

/**
 * Links a cloud device type's page to the unit with this serial number. Rejects with a message for
 * the user, e.g. for a serial number the backend doesn't know.
 */
export function connectCloudDevice(slug: string, serialNumber: string): Promise<void> {
  const createSource = deviceCloudSources[slug];
  if (!createSource) throw new Error(`"${slug}" does not link through the cloud.`);
  return getConnection(deviceProfiles[slug]).connectCloud(createSource(serialNumber), cloudCache(slug, serialNumber, null));
}

/** Ends a cloud link the user disconnected, so it isn't resumed and its data is no longer shown. */
export function disconnectCloudDevice(slug: string): void {
  writeCloudLink(slug, null);
  getConnection(deviceProfiles[slug]).disconnect();
}

/** Picks up every cloud link from an earlier visit. Call once in the browser when the app starts. */
export function resumeCloudDevices(): void {
  for (const [slug, createSource] of Object.entries(deviceCloudSources)) {
    const remembered = readCloudLink(slug);
    if (!createSource || !remembered) continue;
    const { serialNumber, snapshot } = remembered;
    getConnection(deviceProfiles[slug]).resumeCloud(createSource(serialNumber), cloudCache(slug, serialNumber, snapshot));
  }
}
