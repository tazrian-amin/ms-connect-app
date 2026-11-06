import "server-only";
import { fingerprint, randomId, safeEqual, signToken, verifyToken } from "./crypto";
import type { AccessSettings } from "./settings-store";

/*
 * Two signed, HttpOnly cookies:
 *
 * - Site session: issued for the site password, lasts SESSION_DAYS. Carries the password's
 *   version, so changing the password invalidates every session.
 * - Admin: issued for the admin credentials from the environment.
 */

export const SESSION_COOKIE = "ms_session";
export const ADMIN_COOKIE = "ms_admin";

export const SESSION_DAYS = 3;
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const ADMIN_MS = 12 * 60 * 60 * 1000;

export type Session = { sid: string; exp: number };

type SessionToken = Session & { t: "s"; pv: string };
type AdminToken = { t: "a"; exp: number; ac: string };

/** What the browser and the service worker learn about the visitor's access. */
export type AccessState = {
  authenticated: boolean;
  /** Epoch ms at which the session ends. */
  expiresAt: number | null;
};

export const signedOut: AccessState = { authenticated: false, expiresAt: null };

export function issueSession(settings: AccessSettings): { token: string; session: Session } {
  const session = { sid: randomId(), exp: Date.now() + SESSION_MS };
  const token = signToken({ t: "s", ...session, pv: settings.sitePassword!.version } satisfies SessionToken, settings.signingKey);
  return { token, session };
}

export function readSession(settings: AccessSettings, token: string | undefined): Session | null {
  const payload = verifyToken<SessionToken>(token, settings.signingKey);
  if (!payload || payload.t !== "s" || payload.exp <= Date.now()) return null;
  if (!settings.sitePassword || payload.pv !== settings.sitePassword.version) return null;
  return { sid: payload.sid, exp: payload.exp };
}

export function accessState(session: Session | null): AccessState {
  return session ? { authenticated: true, expiresAt: session.exp } : signedOut;
}

function adminCredentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const expected = adminCredentials();
  if (!expected) return false;
  // Both compared, so the time taken does not reveal which one was wrong.
  const userOk = safeEqual(username, expected.username);
  const passwordOk = safeEqual(password, expected.password);
  return userOk && passwordOk;
}

// Changing the credentials in the environment signs the admin out.
function adminCredentialsFingerprint(settings: AccessSettings): string | null {
  const credentials = adminCredentials();
  return credentials ? fingerprint(`${credentials.username}\n${credentials.password}`, settings.signingKey) : null;
}

export function issueAdmin(settings: AccessSettings): { token: string; maxAge: number } {
  const token = signToken(
    { t: "a", exp: Date.now() + ADMIN_MS, ac: adminCredentialsFingerprint(settings)! } satisfies AdminToken,
    settings.signingKey,
  );
  return { token, maxAge: ADMIN_MS / 1000 };
}

export function readAdmin(settings: AccessSettings, token: string | undefined): boolean {
  const payload = verifyToken<AdminToken>(token, settings.signingKey);
  const expected = adminCredentialsFingerprint(settings);
  return Boolean(payload && payload.t === "a" && payload.exp > Date.now() && expected && payload.ac === expected);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** Best guess at the client's IP, for rate limiting. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
