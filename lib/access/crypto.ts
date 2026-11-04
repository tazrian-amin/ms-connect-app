import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_KEY_LENGTH = 32;

function scryptAsync(value: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(value, salt, SCRYPT_KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** A salted scrypt hash, stored as `scrypt$<salt>$<hash>`. */
export async function hashSecret(value: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(value, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifySecret(value: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(value, Buffer.from(salt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Constant-time string comparison, for values that are not hashed (the admin credentials). */
export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function randomId(): string {
  return randomBytes(12).toString("base64url");
}

/** `<payload>.<signature>`, both base64url. Tamper-proof, but not secret. */
export function signToken(payload: object, key: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyToken<T>(token: string | undefined, key: string): T | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

/** A short keyed digest, safe to put in a readable token without revealing `value`. */
export function fingerprint(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url").slice(0, 16);
}
