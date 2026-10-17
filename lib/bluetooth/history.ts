import { useSyncExternalStore } from "react";
import type { CommandSet, FieldName } from "./commands/schema";
import type { DeviceMessenger } from "./messaging";

/** One reading of a numeric field, at the time the device produced it. */
export type HistoryPoint = { time: number; value: number };

/** Fields of a command set that hold a single number. */
export type NumberFieldName<C extends CommandSet> = {
  [F in FieldName<C>]: C["fields"][F] extends "number" ? F : never;
}[FieldName<C>];

// Older readings are dropped so a link left open for days doesn't grow without bound.
const MAX_POINTS = 1_000;
const noPoints: HistoryPoint[] = [];

/**
 * Readings of one field, kept for the rest of the session (across reconnects and remounts) so a
 * chart picks up where it left off. Records only while something is subscribed.
 */
class FieldHistory {
  #points = noPoints;
  #listeners = new Set<() => void>();
  #unsubscribe: (() => void) | null = null;

  constructor(
    private readonly messenger: DeviceMessenger<CommandSet>,
    private readonly field: string,
  ) {}

  getPoints = (): HistoryPoint[] => this.#points;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    this.#unsubscribe ??= this.messenger.subscribe(({ timestamp, data }) => {
      const value = (data as Record<string, unknown>)[this.field];
      if (typeof value !== "number") return;
      this.#points = [...this.#points, { time: timestamp, value }].slice(-MAX_POINTS);
      this.#listeners.forEach((notify) => notify());
    });
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size > 0) return;
      this.#unsubscribe?.();
      this.#unsubscribe = null;
    };
  };
}

const histories = new WeakMap<DeviceMessenger<CommandSet>, Map<string, FieldHistory>>();

function getHistory(messenger: DeviceMessenger<CommandSet>, field: string): FieldHistory {
  let byField = histories.get(messenger);
  if (!byField) histories.set(messenger, (byField = new Map()));
  let history = byField.get(field);
  if (!history) byField.set(field, (history = new FieldHistory(messenger, field)));
  return history;
}

/** Every reading of a numeric field received this session, oldest first. Updates as readings arrive. */
export function useFieldHistory<C extends CommandSet>(
  messenger: DeviceMessenger<C>,
  field: NumberFieldName<C>,
): HistoryPoint[] {
  const history = getHistory(messenger as unknown as DeviceMessenger<CommandSet>, field);
  return useSyncExternalStore(history.subscribe, history.getPoints, () => noPoints);
}
