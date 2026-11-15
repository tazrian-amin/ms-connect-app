import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprint, hashSecret, safeEqual, signToken, verifySecret, verifyToken } from "./crypto";
import { checkAdminCredentials, issueAdmin, issueSession, readAdmin, readSession } from "./session";
import type { AccessSettings } from "./settings-store";

const KEY = "test-signing-key";

describe("hashSecret / verifySecret", () => {
  it("verifies the right secret only", async () => {
    const hash = await hashSecret("correct horse");
    expect(hash).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    await expect(verifySecret("correct horse", hash)).resolves.toBe(true);
    await expect(verifySecret("correct hors", hash)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashSecret("same")).not.toBe(await hashSecret("same"));
  });

  it("rejects stored values it doesn't recognise", async () => {
    await expect(verifySecret("x", "")).resolves.toBe(false);
    await expect(verifySecret("x", "md5$abc$def")).resolves.toBe(false);
  });
});

describe("signToken / verifyToken", () => {
  it("reads back what it signed", () => {
    expect(verifyToken(signToken({ a: 1 }, KEY), KEY)).toEqual({ a: 1 });
  });

  it("refuses a token signed with another key, or changed", () => {
    const token = signToken({ admin: false }, KEY);
    expect(verifyToken(token, "other-key")).toBeNull();

    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ admin: true })).toString("base64url")}.${signature}`;
    expect(verifyToken(forged, KEY)).toBeNull();
  });

  it.each([undefined, "", "no-dot", ".", "abc."])("refuses %j", (token) => {
    expect(verifyToken(token, KEY)).toBeNull();
  });
});

describe("safeEqual / fingerprint", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("gives a short, keyed digest", () => {
    expect(fingerprint("x", KEY)).toHaveLength(16);
    expect(fingerprint("x", KEY)).not.toBe(fingerprint("x", "other-key"));
  });
});

describe("site sessions", () => {
  const settings: AccessSettings = {
    signingKey: KEY,
    sitePassword: { hash: "unused", version: "v1", updatedAt: 0 },
  };

  it("are valid until they expire", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { token, session } = issueSession(settings);
    expect(readSession(settings, token)).toEqual(session);

    vi.setSystemTime(session.exp);
    expect(readSession(settings, token)).toBeNull();
  });

  it("end when the site password changes", () => {
    const { token } = issueSession(settings);
    const changed = { ...settings, sitePassword: { ...settings.sitePassword!, version: "v2" } };
    expect(readSession(changed, token)).toBeNull();
    expect(readSession({ signingKey: KEY }, token)).toBeNull();
  });

  it("aren't admin tokens, and vice versa", () => {
    vi.stubEnv("ADMIN_USERNAME", "admin");
    vi.stubEnv("ADMIN_PASSWORD", "secret");
    const { token: admin } = issueAdmin(settings);
    const { token: session } = issueSession(settings);
    expect(readSession(settings, admin)).toBeNull();
    expect(readAdmin(settings, session)).toBe(false);
    expect(readAdmin(settings, admin)).toBe(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("admin", () => {
  const settings: AccessSettings = { signingKey: KEY };

  it("checks the credentials from the environment", () => {
    vi.stubEnv("ADMIN_USERNAME", "admin");
    vi.stubEnv("ADMIN_PASSWORD", "secret");
    expect(checkAdminCredentials("admin", "secret")).toBe(true);
    expect(checkAdminCredentials("admin", "wrong")).toBe(false);
    expect(checkAdminCredentials("Admin", "secret")).toBe(false);
  });

  it("can't sign in when no credentials are configured", () => {
    vi.stubEnv("ADMIN_USERNAME", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(checkAdminCredentials("", "")).toBe(false);
  });

  it("is signed out when the credentials change", () => {
    vi.stubEnv("ADMIN_USERNAME", "admin");
    vi.stubEnv("ADMIN_PASSWORD", "secret");
    const { token } = issueAdmin(settings);
    expect(readAdmin(settings, token)).toBe(true);

    vi.stubEnv("ADMIN_PASSWORD", "new-secret");
    expect(readAdmin(settings, token)).toBe(false);
  });

  it("is signed out after 12 hours", () => {
    vi.useFakeTimers({ now: 0 });
    vi.stubEnv("ADMIN_USERNAME", "admin");
    vi.stubEnv("ADMIN_PASSWORD", "secret");
    const { token, maxAge } = issueAdmin(settings);
    expect(maxAge).toBe(12 * 60 * 60);

    vi.setSystemTime(12 * 60 * 60 * 1000 - 1);
    expect(readAdmin(settings, token)).toBe(true);
    vi.setSystemTime(12 * 60 * 60 * 1000);
    expect(readAdmin(settings, token)).toBe(false);
    vi.useRealTimers();
  });
});
