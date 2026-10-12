"use client";

import { useCallback, useState } from "react";

/**
 * Tracks which controls have an action in flight, so only that control shows
 * a spinner — one pump's slow write never freezes the rest of the row.
 *
 * Transport-agnostic: `track` just awaits whatever the host's handler returns.
 * A handler signals failure by resolving `false` or throwing; anything else
 * counts as success. Reporting the failure (toast, banner…) is the host's job.
 */
export function usePendingActions() {
  const [pendingKeys, setPendingKeys] = useState<readonly string[]>([]);

  const isPending = useCallback(
    (key: string) => pendingKeys.includes(key),
    [pendingKeys],
  );

  const track = useCallback(
    async (
      key: string,
      action: () => Promise<boolean | void> | boolean | void,
    ): Promise<boolean> => {
      setPendingKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      try {
        return (await action()) !== false;
      } catch {
        return false;
      } finally {
        setPendingKeys((prev) => prev.filter((pending) => pending !== key));
      }
    },
    [],
  );

  return { isPending, track };
}
