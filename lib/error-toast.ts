import { useSyncExternalStore } from "react";

/*
 * App-wide error toast. Anything can report a problem with `showError`; ErrorToast (mounted once
 * in the root layout) shows the latest one for a few seconds, and the user can close it sooner.
 */

export type ErrorToastState = {
  message: string;
  /** Changes with every report, so the same message reported twice shows again. */
  id: number;
} | null;

let current: ErrorToastState = null;
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows an error toast, replacing any that is already showing. */
export function showError(message: string): void {
  current = { message, id: ++nextId };
  emit();
}

export function dismissError(): void {
  if (!current) return;
  current = null;
  emit();
}

export function useErrorToast(): ErrorToastState {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
