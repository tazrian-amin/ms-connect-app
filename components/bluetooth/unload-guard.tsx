"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isAnyDeviceLinked, subscribeDeviceActivity } from "@/lib/bluetooth/registry";

/**
 * Asks for confirmation before the page is reloaded or closed while a device is linked.
 * A full page load ends every Bluetooth connection. In-app navigation does not trigger this.
 */
export function UnloadGuard() {
  const deviceLinked = useSyncExternalStore(subscribeDeviceActivity, isAnyDeviceLinked, () => false);

  useEffect(() => {
    if (!deviceLinked) return;
    const confirmLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [deviceLinked]);

  return null;
}
