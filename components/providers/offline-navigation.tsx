"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useViewMode } from "@/lib/access/session-client";
import { accessiblePages } from "@/lib/app-routes";

/**
 * Prefetches every route the visitor may open once the service worker controls the page, so
 * the worker can cache the route data (see handlePrefetch in public/sw.js). Offline, the router
 * then switches pages from that cache without a full reload, which would drop every Bluetooth
 * connection. Device pages are included only in view mode, and are fetched when it turns on.
 */
export function OfflineNavigation() {
  const router = useRouter();
  const viewMode = useViewMode();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const serviceWorker = navigator.serviceWorker;

    const prefetchAll = () => {
      if (serviceWorker.controller) accessiblePages(viewMode).forEach((route) => router.prefetch(route));
    };
    // Uncontrolled only on the very first visit; AppUpdater reloads that page once the
    // worker takes control, and this runs again then.
    prefetchAll();
  }, [router, viewMode]);

  return null;
}
