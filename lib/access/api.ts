import "server-only";
import { cookies } from "next/headers";
import { accessiblePages } from "@/lib/app-routes";
import { accessState, readSession, readViewMode, SESSION_COOKIE, VIEW_COOKIE, type AccessState } from "./session";
import { getAccessSettings, type AccessSettings } from "./settings-store";

/** The visitor's access, from their cookies. */
export async function currentAccess(settings: AccessSettings) {
  const jar = await cookies();
  const session = readSession(settings, jar.get(SESSION_COOKIE)?.value);
  const viewMode = readViewMode(settings, session, jar.get(VIEW_COOKIE)?.value);
  return { session, viewMode };
}

/**
 * The body every /api/session response carries. The service worker reads it to enforce the
 * session offline, and `pages` tells it which pages it may keep for offline use.
 */
export function accessResponse(state: AccessState, init?: ResponseInit): Response {
  const status = init?.status ?? (state.authenticated ? 200 : 401);
  return Response.json(
    { ...state, pages: state.authenticated ? accessiblePages(state.viewMode) : [] },
    { ...init, status, headers: { "Cache-Control": "no-store", ...init?.headers } },
  );
}

export function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export { accessState, getAccessSettings };
