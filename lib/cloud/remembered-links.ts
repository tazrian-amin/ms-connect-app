import { deviceCloudSources, deviceProfiles, getConnection, releaseConnection, type ConnectionInstance } from "@/lib/connection/registry";
import type { CloudCache, CloudMessage } from "./cloud";

/*
 * A unit linked through the cloud (see ./cloud.ts) stays linked until the user disconnects it,
 * across visits and while offline, showing the last data it reported. What it is and what it last
 * reported are kept in this browser's localStorage. Without storage, it is kept for the visit.
 *
 * A device type with one link per page keeps one remembered link; one that monitors several units
 * from one page (e.g. one asset tracker per asset) keeps one per instance.
 */

type RememberedCloudLink = {
  serialNumber: string;
  snapshot: CloudMessage | null;
  /** The instance's name when it was linked, for a device type with several links. */
  instanceName?: string;
};

const KEY_PREFIX = "ms-connect:cloud-link:";

const cloudLinkKey = (slug: string, instanceId?: string) =>
  instanceId ? `${KEY_PREFIX}${slug}:${instanceId}` : `${KEY_PREFIX}${slug}`;

function readCloudLink(key: string): RememberedCloudLink | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (stored && typeof stored.serialNumber === "string") return stored;
  } catch {
    // Storage blocked or the stored value is corrupt: nothing to resume.
  }
  return null;
}

function writeCloudLink(key: string, link: RememberedCloudLink | null) {
  try {
    if (link) window.localStorage.setItem(key, JSON.stringify(link));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage blocked or full; the link lasts for this visit only.
  }
}

/** Remembers the unit from its first report onward, with the latest snapshot of its data. */
function cloudCache(key: string, link: RememberedCloudLink): CloudCache {
  return { snapshot: link.snapshot, save: (latest) => writeCloudLink(key, { ...link, snapshot: latest }) };
}

/**
 * Links a cloud device type's page, or one instance of it, to the unit with this serial number.
 * Rejects with a message for the user, e.g. for a serial number the backend doesn't know.
 */
export function connectCloudDevice(slug: string, serialNumber: string, instance?: ConnectionInstance): Promise<void> {
  const createSource = deviceCloudSources[slug];
  if (!createSource) throw new Error(`"${slug}" does not link through the cloud.`);
  const key = cloudLinkKey(slug, instance?.id);
  // One unit can't show on two tabs of the same page at once.
  const sameUnit = rememberedLinks().find(
    ([otherKey, other]) =>
      otherKey !== key &&
      otherKey.startsWith(`${cloudLinkKey(slug)}:`) &&
      other.serialNumber.toLowerCase() === serialNumber.toLowerCase(),
  );
  if (sameUnit) {
    const where = sameUnit[1].instanceName ? ` as ${sameUnit[1].instanceName}` : "";
    return Promise.reject(new Error(`The device with serial number ${serialNumber} is already connected${where}.`));
  }
  const link: RememberedCloudLink = { serialNumber, snapshot: null, instanceName: instance?.name };
  return getConnection(deviceProfiles[slug], instance).connectCloud(createSource(serialNumber), cloudCache(key, link));
}

/** Ends a cloud link the user disconnected, so it isn't resumed and its data is no longer shown. */
export function disconnectCloudDevice(slug: string, instance?: ConnectionInstance): void {
  writeCloudLink(cloudLinkKey(slug, instance?.id), null);
  getConnection(deviceProfiles[slug], instance).disconnect();
}

/** Ends and forgets one instance's cloud link for good, e.g. when the user removes an asset. */
export function forgetCloudDevice(slug: string, instanceId: string): void {
  writeCloudLink(cloudLinkKey(slug, instanceId), null);
  releaseConnection(deviceProfiles[slug], instanceId);
}

/**
 * Hands a device type's sole remembered link, from before it had one link per instance, to the
 * instance `adopt` returns for its serial number, so it resumes there. Call before `resumeCloudDevices`.
 */
export function adoptSoleCloudLink(slug: string, adopt: (serialNumber: string, snapshot: CloudMessage | null) => ConnectionInstance): void {
  const soleKey = cloudLinkKey(slug);
  const link = readCloudLink(soleKey);
  if (!link) return;
  const instance = adopt(link.serialNumber, link.snapshot);
  writeCloudLink(cloudLinkKey(slug, instance.id), { ...link, instanceName: instance.name });
  writeCloudLink(soleKey, null);
}

/** Picks up every cloud link from an earlier visit. Call once in the browser when the app starts. */
export function resumeCloudDevices(): void {
  for (const [key, link] of rememberedLinks()) {
    const rest = key.slice(KEY_PREFIX.length);
    const colon = rest.indexOf(":");
    const slug = colon === -1 ? rest : rest.slice(0, colon);
    const instanceId = colon === -1 ? undefined : rest.slice(colon + 1);
    const createSource = deviceCloudSources[slug];
    if (!createSource) continue;
    const instance = instanceId ? { id: instanceId, name: link.instanceName ?? link.serialNumber } : undefined;
    getConnection(deviceProfiles[slug], instance).resumeCloud(createSource(link.serialNumber), cloudCache(key, link));
  }
}

function rememberedLinks(): [string, RememberedCloudLink][] {
  const found: [string, RememberedCloudLink][] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      const link = key?.startsWith(KEY_PREFIX) ? readCloudLink(key) : null;
      if (key && link) found.push([key, link]);
    }
  } catch {
    // Storage blocked: nothing to resume.
  }
  return found;
}
