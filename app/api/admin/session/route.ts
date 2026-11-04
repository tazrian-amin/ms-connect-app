import { cookies, headers } from "next/headers";
import { errorResponse, getAccessSettings, readJson } from "@/lib/access/api";
import { ADMIN_COOKIE, checkAdminCredentials, clientIp, cookieOptions, issueAdmin } from "@/lib/access/session";
import { takeAttempt } from "@/lib/access/settings-store";

// Admin sign-in, with ADMIN_USERNAME / ADMIN_PASSWORD from the environment.

/** Signs in: `{ username, password }`. */
export async function POST(request: Request) {
  const ip = clientIp(await headers());
  if (!(await takeAttempt(`admin:${ip}`, 5, 15 * 60))) {
    return errorResponse("Too many attempts. Wait 15 minutes and try again.", 429);
  }
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return errorResponse("Admin sign-in isn't configured on the server.", 503);
  }

  const { username, password } = await readJson(request);
  if (typeof username !== "string" || typeof password !== "string" || !checkAdminCredentials(username, password)) {
    return errorResponse("Wrong username or password.", 401);
  }

  const { token, maxAge } = issueAdmin(await getAccessSettings());
  (await cookies()).set(ADMIN_COOKIE, token, { ...cookieOptions, sameSite: "strict", maxAge });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
