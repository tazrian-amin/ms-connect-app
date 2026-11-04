"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useViewMode } from "@/lib/access/session-client";

const noop = () => () => {};

/**
 * Shows a device page only in view mode, and otherwise sends the visitor to the home page.
 *
 * proxy.ts and the service worker already redirect page loads; this covers client-side
 * navigation from cached route data, and view mode ending while the page is open.
 */
export function ViewModeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const viewMode = useViewMode();
  // The server render cannot know the visitor's view mode, so nothing shows until hydrated.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  useEffect(() => {
    if (hydrated && !viewMode) router.replace("/");
  }, [hydrated, viewMode, router]);

  return hydrated && viewMode ? children : null;
}
