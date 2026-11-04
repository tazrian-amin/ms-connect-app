import { cookies, headers } from "next/headers";
import { accessResponse, accessState, currentAccess, errorResponse, getAccessSettings, readJson } from "@/lib/access/api";
import { verifySecret } from "@/lib/access/crypto";
import { clientIp, cookieOptions, issueSession, SESSION_COOKIE, signedOut, VIEW_COOKIE } from "@/lib/access/session";
import { takeAttempt } from "@/lib/access/settings-store";

// Site sessions. Reached without signing in (see proxy.ts), so every handler checks for itself.

/** The visitor's current access. 401 without a session. */
export async function GET() {
  const { session, viewMode } = await currentAccess(await getAccessSettings());
  return accessResponse(accessState(session, viewMode));
}

/** Signs in with the site password: `{ password }`. */
export async function POST(request: Request) {
  const ip = clientIp(await headers());
  if (!(await takeAttempt(`site:${ip}`, 10, 15 * 60))) {
    return errorResponse("Too many attempts. Wait 15 minutes and try again.", 429);
  }

  const settings = await getAccessSettings();
  if (!settings.sitePassword) {
    return errorResponse("The site password hasn't been set yet. Ask an administrator.", 503);
  }

  const { password } = await readJson(request);
  if (typeof password !== "string" || !(await verifySecret(password, settings.sitePassword.hash))) {
    return errorResponse("That password isn't right.", 401);
  }

  const { token, session } = issueSession(settings);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...cookieOptions, expires: session.exp });
  // A new session starts with view mode off.
  jar.delete(VIEW_COOKIE);
  return accessResponse(accessState(session, false));
}

/** Signs out. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(VIEW_COOKIE);
  return accessResponse(signedOut);
}
