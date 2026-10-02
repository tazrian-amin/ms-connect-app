import { useSyncExternalStore } from "react";
import type { BluetoothConnection } from "@/lib/bluetooth/connection";

/*
 * Edit mode guards a device's settings against accidental changes. Controls that change the
 * device stay disabled until the user turns edit mode on for that device's connection. While it
 * is on, leaving the page or disconnecting is blocked (see EditModeGuard) and a warning explains why.
 *
 * Only one connection can be in edit mode at a time, since leaving its page is blocked.
 */

/** What the user tried to do while edit mode was on. */
export type EditModeWarning = "navigate" | "disconnect";

let editing: BluetoothConnection | null = null;
let warning: EditModeWarning | null = null;
let stopWatching: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function enableEditMode(connection: BluetoothConnection): void {
  if (editing === connection) return;
  disableEditMode();
  editing = connection;
  // A link that is lost for good ends edit mode, so the user is never stuck on the page.
  stopWatching = connection.subscribeState(() => {
    if (connection.getState().status === "disconnected") disableEditMode();
  });
  emit();
}

export function disableEditMode(): void {
  if (!editing && !warning) return;
  stopWatching?.();
  stopWatching = null;
  editing = null;
  warning = null;
  emit();
}

export function isEditing(connection: BluetoothConnection): boolean {
  return editing === connection;
}

export function isAnyEditing(): boolean {
  return editing !== null;
}

/** Shows the warning dialog for something edit mode blocked. */
export function warnEditMode(reason: EditModeWarning): void {
  warning = reason;
  emit();
}

export function dismissEditModeWarning(): void {
  warning = null;
  emit();
}

/** Whether `connection` is in edit mode. */
export function useEditMode(connection: BluetoothConnection): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isEditing(connection),
    () => false,
  );
}

/** Whether any connection is in edit mode. */
export function useAnyEditMode(): boolean {
  return useSyncExternalStore(subscribe, isAnyEditing, () => false);
}

/** The warning to show, or null. */
export function useEditModeWarning(): EditModeWarning | null {
  return useSyncExternalStore(
    subscribe,
    () => warning,
    () => null,
  );
}
