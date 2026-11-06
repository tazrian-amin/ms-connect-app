import { useSyncExternalStore } from "react";
import { clearRevealedDevices } from "@/lib/homepage/revealed-devices";

/*
 * The browser's view of the visitor's access, from /api/session. The service worker sits in
 * front of that endpoint (public/sw.js): online it passes the server's answer through, and
 * offline it answers from the last one it saw, so this works the same either way.
 *
 * The last answer is also kept in localStorage, so the page knows the session from its first
 * render instead of waiting for the network.
 */

export type SessionState = {
  authenticated: boolean;
  expiresAt: number | null;
};

const STORAGE_KEY = "ms-connect-access";
const unknown: SessionState = { authenticated: false, expiresAt: null };

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
  // Signed out: the next person on this device starts with every device card hidden.
  if (!next.authenticated) clearRevealedDevices();
  const current = load();
  if (current.authenticated === next.authenticated && current.expiresAt === next.expiresAt) return;
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

/** The visitor's access. Signed out on the server render, as the static pages are shared. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, load, () => unknown);
}
