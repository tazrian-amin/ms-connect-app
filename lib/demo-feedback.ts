import { useSyncExternalStore } from "react";

/*
 * After a visitor ends a demo (see lib/bluetooth/demo.ts) with its Exit demo button, a dialog asks
 * how it went and offers to get in touch. It is a marketing prompt, so it is shown sparingly:
 *
 * - only after a demo the visitor actually used (at least MIN_DEMO_MS), and only when they ended it
 *   themselves; leaving the page, or exiting from the "Demo mode is on" warning, never asks;
 * - at most once per device, ever, and at most once per COOLDOWN_MS across all devices;
 * - never again once the visitor picks "Don't ask again".
 *
 * What was asked is kept in this browser's localStorage. Without storage, it is kept for the visit.
 */

const MIN_DEMO_MS = 30_000;
const SHOW_DELAY_MS = 1_500;
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "ms-connect:demo-feedback";

type FeedbackRecord = {
  /** Epoch ms each device's demo was asked about, by slug. */
  asked: Record<string, number>;
  /** Set by "Don't ask again". */
  optedOut?: boolean;
};

let memoryRecord: FeedbackRecord = { asked: {} };

function readRecord(): FeedbackRecord {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object" && stored.asked && typeof stored.asked === "object") return stored;
  } catch {
    // Storage blocked or the stored value is corrupt: fall back to this visit's record.
  }
  return memoryRecord;
}

function writeRecord(record: FeedbackRecord) {
  memoryRecord = record;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Kept for this visit only.
  }
}

function mayAsk(slug: string, now: number): boolean {
  const { asked, optedOut } = readRecord();
  if (optedOut || asked[slug] !== undefined) return false;
  return Object.values(asked).every((time) => now - time >= COOLDOWN_MS);
}

const demoStarts = new Map<string, number>();
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let shownSlug: string | null = null;
const listeners = new Set<() => void>();

function setShown(slug: string | null) {
  shownSlug = slug;
  listeners.forEach((listener) => listener());
}

/** Call when the visitor starts a device's demo. */
export function noteDemoStarted(slug: string): void {
  demoStarts.set(slug, Date.now());
}

/** Call when the visitor ends a device's demo with its Exit demo button. Asks shortly after, if it may. */
export function offerDemoFeedback(slug: string): void {
  const startedAt = demoStarts.get(slug);
  demoStarts.delete(slug);
  if (startedAt === undefined || Date.now() - startedAt < MIN_DEMO_MS) return;
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    const now = Date.now();
    if (!mayAsk(slug, now)) return;
    const record = readRecord();
    writeRecord({ ...record, asked: { ...record.asked, [slug]: now } });
    setShown(slug);
  }, SHOW_DELAY_MS);
}

/** Drops an offer that hasn't been shown yet, e.g. because the visitor left the page. */
export function cancelDemoFeedbackOffer(): void {
  clearTimeout(pendingTimer);
}

/** Closes the dialog. `optOut` is "Don't ask again". */
export function closeDemoFeedback(optOut = false): void {
  if (optOut) writeRecord({ ...readRecord(), optedOut: true });
  setShown(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Slug of the device whose demo the dialog is asking about, or null while it is closed. */
export function useDemoFeedback(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => shownSlug,
    () => null,
  );
}
