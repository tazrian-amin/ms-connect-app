"use client";

import { useEffect } from "react";
import { refreshSession, useSession } from "@/lib/access/session-client";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Ends the visit when the session does. Checks with the server on load, on a timer, and when
 * the app resurfaces or reconnects, so a password change signs open pages out; and reloads at
 * the moment the session expires, online or not. The reload lands on the password dialog,
 * served by proxy.ts, or offline by the service worker.
 */
export function SessionWatcher() {
  const { expiresAt } = useSession();

  useEffect(() => {
    const check = async () => {
      const state = await refreshSession();
      if (state && !state.authenticated) window.location.reload();
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("online", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("online", check);
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const timeout = setTimeout(() => window.location.reload(), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [expiresAt]);

  return null;
}
