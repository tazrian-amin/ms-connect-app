"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/app-routes";

/**
 * Prefetches every route once the service worker controls the page, so the worker can cache
 * the route data (see handlePrefetch in public/sw.js). Offline, the router then switches pages
 * from that cache without a full reload, which would drop every Bluetooth connection.
 */
export function OfflineNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const serviceWorker = navigator.serviceWorker;

    const prefetchAll = () => {
      if (serviceWorker.controller) appRoutes.forEach((route) => router.prefetch(route));
    };
    // Uncontrolled only on the very first visit; AppUpdater reloads that page once the
    // worker takes control, and this runs again then.
    prefetchAll();
  }, [router]);

  return null;
}
