import { useSyncExternalStore } from "react";

/*
 * Which homepage device cards the visitor has revealed with the eye button. Kept in
 * localStorage, so the choice survives reloads, and shared between open tabs. Cleared on sign-out
 * (see lib/access/session-client.ts), so the next person on the device starts with every card hidden.
 */

export const REVEALED_DEVICES_KEY = "ms-connect-revealed-devices";

const none: ReadonlySet<string> = new Set();

let state: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function load(): ReadonlySet<string> {
  if (state) return state;
  try {
    const saved = JSON.parse(localStorage.getItem(REVEALED_DEVICES_KEY) ?? "[]");
    state = Array.isArray(saved) ? new Set(saved.filter((slug) => typeof slug === "string")) : none;
  } catch {
    state = none;
  }
  return state;
}

function set(next: ReadonlySet<string>) {
  state = next;
  try {
    if (next.size > 0) localStorage.setItem(REVEALED_DEVICES_KEY, JSON.stringify([...next]));
    else localStorage.removeItem(REVEALED_DEVICES_KEY);
  } catch {
    // Storage full or blocked; the choice still holds until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

// Another tab changed the choice: re-read it.
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== REVEALED_DEVICES_KEY) return;
  state = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function toggleRevealedDevice(slug: string) {
  const next = new Set(load());
  if (!next.delete(slug)) next.add(slug);
  set(next);
}

/** Forgets every revealed card, e.g. on sign-out. */
export function clearRevealedDevices() {
  set(none);
}

/** The revealed cards' slugs. Empty on the server render, as the static page is shared. */
export function useRevealedDevices(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, load, () => none);
}
