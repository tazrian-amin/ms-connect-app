import { useSyncExternalStore } from "react";

/*
 * The browser's view of the visitor's access, from /api/session. The service worker sits in
 * front of that endpoint (public/sw.js): online it passes the server's answer through, and
 * offline it answers from the last one it saw, so this works the same either way.
 *
 * The last answer is also kept in localStorage, so the page knows whether view mode is on
 * from its first render instead of waiting for the network.
 */

export type SessionState = {
  authenticated: boolean;
  expiresAt: number | null;
  viewMode: boolean;
};

export type ViewModeResult = { ok: true } | { ok: false; error: string };

const STORAGE_KEY = "ms-connect-access";
const unknown: SessionState = { authenticated: false, expiresAt: null, viewMode: false };

let state: SessionState | null = null;
const listeners = new Set<() => void>();

function load(): SessionState {
  if (state) return state;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SessionState | null;
    state = saved && saved.expiresAt && saved.expiresAt > Date.now() ? saved : unknown;
  } catch {
    state = unknown;
  }
  return state;
}

function set(next: SessionState) {
  const current = load();
  if (
    current.authenticated === next.authenticated &&
    current.expiresAt === next.expiresAt &&
    current.viewMode === next.viewMode
  ) {
    return;
  }
  state = next;
  try {
    if (next.authenticated) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage full or blocked; the in-memory state still works.
  }
  listeners.forEach((listener) => listener());
}

function fromBody(body: Partial<SessionState>): SessionState {
  return {
    authenticated: Boolean(body.authenticated),
    expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : null,
    viewMode: Boolean(body.viewMode),
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionState(): SessionState {
  return load();
}

/**
 * Asks the server (or, offline, the service worker) for the current access.
 * Returns null when neither answered, which says nothing about the session.
 */
export async function refreshSession(): Promise<SessionState | null> {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    if (response.status !== 200 && response.status !== 401) return null;
    const next = response.status === 401 ? unknown : fromBody(await response.json());
    set(next);
    return next;
  } catch {
    return null;
  }
}

export async function enableViewMode(code: string): Promise<ViewModeResult> {
  try {
    const response = await fetch("/api/session/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      set(fromBody(body));
      return { ok: true };
    }
    if (response.status === 401) {
      set(unknown);
      window.location.reload();
    }
    return { ok: false, error: body.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, error: "You're offline. Connect to the internet to enter the code." };
  }
}

export async function disableViewMode(): Promise<void> {
  // Off locally first, so the details hide at once even if the request is slow or offline.
  set({ ...load(), viewMode: false });
  try {
    const response = await fetch("/api/session/view", { method: "DELETE" });
    if (response.ok) set(fromBody(await response.json()));
  } catch {
    // Offline: the cookie stays until the next request; the service worker still treats it as off.
  }
}

/** The visitor's access. Signed out on the server render, as the static pages are shared. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, load, () => unknown);
}

export function useViewMode(): boolean {
  return useSession().viewMode;
}
