import { cookies, headers } from "next/headers";
import { accessResponse, accessState, currentAccess, errorResponse, getAccessSettings, readJson } from "@/lib/access/api";
import { verifySecret } from "@/lib/access/crypto";
import { clientIp, cookieOptions, issueViewMode, VIEW_COOKIE } from "@/lib/access/session";
import { takeAttempt } from "@/lib/access/settings-store";

// View mode: shows device names and opens device pages, until the session ends.

/** Turns view mode on with the 6-digit code: `{ code }`. */
export async function POST(request: Request) {
  const settings = await getAccessSettings();
  const { session } = await currentAccess(settings);
  if (!session) return accessResponse(accessState(null, false));

  // A 6-digit code is quick to guess without a limit. Counted per address and per session.
  const ip = clientIp(await headers());
  const allowed = (await takeAttempt(`view:${ip}`, 10, 15 * 60)) && (await takeAttempt(`view:${session.sid}`, 10, 15 * 60));
  if (!allowed) return errorResponse("Too many attempts. Wait 15 minutes and try again.", 429);

  if (!settings.viewCode) {
    return errorResponse("The view code hasn't been set yet. Ask an administrator.", 503);
  }

  const { code } = await readJson(request);
  if (typeof code !== "string" || !/^\d{6}$/.test(code) || !(await verifySecret(code, settings.viewCode.hash))) {
    return errorResponse("That code isn't right.", 403);
  }

  (await cookies()).set(VIEW_COOKIE, issueViewMode(settings, session), { ...cookieOptions, expires: session.exp });
  return accessResponse(accessState(session, true));
}

/** Turns view mode off. */
export async function DELETE() {
  const { session } = await currentAccess(await getAccessSettings());
  (await cookies()).delete(VIEW_COOKIE);
  return accessResponse(accessState(session, false));
}
