"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { disconnectAll, isAnyDeviceLinked, subscribeDeviceActivity } from "@/lib/bluetooth/registry";

// Installed apps can stay open for a long time on one screen, which never triggers the
// browser's own update check, so also check on a timer and whenever the app resurfaces.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
// Devices often report "online" before the connection actually carries traffic (Wi-Fi still
// associating, mobile data warming up), so check again shortly after coming back online.
const ONLINE_RECHECK_DELAYS_MS = [10_000, 60_000];

/**
 * Registers the service worker and keeps the installed app on the latest deploy.
 *
 * A new deploy installs in the background (see public/sw.js). It is applied, with a reload,
 * as soon as no Bluetooth device is linked, so an update never cuts off a live session.
 * While a device is linked, a snackbar lets the user apply it right away instead.
 *
 * After the very first install the page also reloads once, under the same rule. The router
 * prefetched route data before the worker was in control, so the worker never saw it; a
 * fully controlled session lets it cache that data for offline navigation.
 */
export function AppUpdater() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [firstInstallDone, setFirstInstallDone] = useState(false);
  const applying = useRef(false);
  const deviceLinked = useSyncExternalStore(subscribeDeviceActivity, isAnyDeviceLinked, () => false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const serviceWorker = navigator.serviceWorker;

    // The worker serves pages cache-first, which would hide edits during development.
    // Remove any worker left over from a local production run instead.
    if (process.env.NODE_ENV !== "production") {
      serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()));
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;
    const startedUncontrolled = !serviceWorker.controller;

    // Only an update has a previous controller; the very first install needs no reload.
    const watchInstall = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && serviceWorker.controller) setWaitingWorker(worker);
      });
    };
    const checkForUpdate = () => {
      // Rejects while offline; the next check will try again.
      registration?.update().catch(() => {});
    };
    let onlineRechecks: ReturnType<typeof setTimeout>[] = [];
    const checkWhenOnline = () => {
      onlineRechecks.forEach(clearTimeout);
      checkForUpdate();
      onlineRechecks = ONLINE_RECHECK_DELAYS_MS.map((delay) => setTimeout(checkForUpdate, delay));
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    const handleControllerChange = () => {
      if (applying.current) window.location.reload();
      else if (startedUncontrolled) setFirstInstallDone(true);
    };

    serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registered) => {
        registration = registered;
        if (registered.waiting && serviceWorker.controller) setWaitingWorker(registered.waiting);
        watchInstall(registered.installing);
        registered.addEventListener("updatefound", () => watchInstall(registered.installing));
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });

    serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("online", checkWhenOnline);
    const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("online", checkWhenOnline);
      clearInterval(interval);
      onlineRechecks.forEach(clearTimeout);
    };
  }, []);

  // The worker activates, `controllerchange` fires, and the page reloads into the new build.
  const applyUpdate = useCallback(() => {
    if (!waitingWorker || applying.current) return;
    applying.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, [waitingWorker]);

  useEffect(() => {
    if (!deviceLinked) applyUpdate();
  }, [deviceLinked, applyUpdate]);

  useEffect(() => {
    if (firstInstallDone && !deviceLinked) window.location.reload();
  }, [firstInstallDone, deviceLinked]);

  return (
    <Snackbar
      open={waitingWorker !== null && deviceLinked}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      message="A new version is ready. It installs once you disconnect."
      action={
        // Disconnecting cleanly lets the update apply through the effect above.
        <Button color="primary" size="small" onClick={disconnectAll}>
          Update now
        </Button>
      }
    />
  );
}
