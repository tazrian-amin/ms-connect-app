import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/*
 * Stores the two secrets the admin can change (the site password and the device view code),
 * plus the key that signs session cookies. There is no database, so this is either:
 *
 * - Upstash Redis over its REST API, when KV_REST_API_URL / KV_REST_API_TOKEN (set by the Vercel
 *   Marketplace integration) or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are present.
 *   Needed on Vercel, whose file system is read-only and not shared between instances.
 * - Otherwise a JSON file in .data/ (gitignored). Fine for local development and for a single
 *   self-hosted `next start` server.
 *
 * Only hashes of the password and code are stored, never the values themselves.
 */

export type StoredSecret = {
  /** scrypt hash, see lib/access/crypto.ts. */
  hash: string;
  /** Changes on every update. Cookies carry it, so a change invalidates every cookie at once. */
  version: string;
  updatedAt: number;
};

export type AccessSettings = {
  /** HMAC key for session, view and admin cookies. Generated on first use. */
  signingKey: string;
  sitePassword?: StoredSecret;
  viewCode?: StoredSecret;
};

const KEY = "ms-connect:access-settings";
const FILE = join(process.cwd(), ".data", "access-settings.json");
// Every request through proxy.ts reads the settings, so they are kept in memory for a few
// seconds. A change made on another server instance takes at most this long to apply there.
const CACHE_TTL_MS = 5_000;

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);

let cached: { settings: AccessSettings; at: number } | null = null;

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Access settings could not be saved. On Vercel, connect an Upstash Redis database to the project " +
        "(Storage → Marketplace → Upstash Redis) and redeploy.",
    );
  }
}

async function redis<T>(command: (string | number)[]): Promise<T> {
  const response = await fetch(redisUrl!, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || body.error) throw new Error(`Redis ${command[0]} failed: ${body.error ?? response.status}`);
  return body.result as T;
}

async function load(): Promise<AccessSettings | null> {
  if (useRedis) {
    const raw = await redis<string | null>(["GET", KEY]);
    return raw ? (JSON.parse(raw) as AccessSettings) : null;
  }
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as AccessSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function save(settings: AccessSettings, { onlyIfAbsent = false } = {}): Promise<void> {
  if (useRedis) {
    await redis(onlyIfAbsent ? ["SET", KEY, JSON.stringify(settings), "NX"] : ["SET", KEY, JSON.stringify(settings)]);
    return;
  }
  if (process.env.VERCEL) throw new StorageNotConfiguredError();
  try {
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    // Write then rename, so a reader never sees a half-written file.
    const temp = `${FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(settings, null, 2), { mode: 0o600 });
    await rename(temp, FILE);
  } catch (error) {
    console.error("Saving access settings failed:", error);
    throw new StorageNotConfiguredError();
  }
}

/** The current settings. Creates the signing key the first time, if the store is writable. */
export async function getAccessSettings({ fresh = false } = {}): Promise<AccessSettings> {
  if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.settings;

  let settings = await load();
  if (!settings) {
    // Two instances may race here; with Redis only the first write lands, and both re-read it.
    await save({ signingKey: randomBytes(32).toString("base64url") }, { onlyIfAbsent: true });
    settings = await load();
    if (!settings) throw new StorageNotConfiguredError();
  }
  cached = { settings, at: Date.now() };
  return settings;
}

/** Applies `change` to the latest settings and saves them. */
export async function updateAccessSettings(
  change: (settings: AccessSettings) => AccessSettings,
): Promise<AccessSettings> {
  const next = change(await getAccessSettings({ fresh: true }));
  await save(next);
  cached = { settings: next, at: Date.now() };
  return next;
}

const memoryAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Counts an attempt against `key` and reports whether it is still within `limit` per `windowSeconds`.
 * Uses Redis when configured, so the limit holds across server instances.
 */
export async function takeAttempt(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (useRedis) {
    const redisKey = `ms-connect:attempts:${key}`;
    const count = await redis<number>(["INCR", redisKey]);
    if (count === 1) await redis(["EXPIRE", redisKey, windowSeconds]);
    return count <= limit;
  }
  const now = Date.now();
  const entry = memoryAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryAttempts.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
