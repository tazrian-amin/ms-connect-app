"use client";

import { useEffect, useSyncExternalStore } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { endAllDemos, isAnyDemoRunning, subscribeDeviceActivity } from "@/lib/bluetooth/registry";
import {
  disableEditMode,
  dismissEditModeWarning,
  isAnyEditing,
  useAnyEditMode,
  useEditModeWarning,
  warnEditMode,
  type EditModeWarning,
} from "@/lib/edit-mode";

const warningTexts: Record<EditModeWarning, string> = {
  navigate: "Edit mode needs to be disabled before you leave this page.",
  disconnect: "Edit mode needs to be disabled before you disconnect the device.",
  switch: "Edit mode needs to be disabled before you switch, add or remove tabs.",
};

// Marks the extra history entry that catches the browser's back button.
const GUARD_STATE_KEY = "navigationGuard";

/*
 * The block is shared by every guard on screen rather than owned by one. Switching bin tabs
 * replaces one bin's guard with another's in a single render; if each guard added and removed its
 * own history entry, the old guard's `history.back()` would land after the new guard's entry was
 * added and look like the user pressing back. Instead the last guard to let go removes the entry,
 * after giving a replacement the chance to take it over.
 */
let blockers = 0;
let blocking = false;
// Guards on screen, blocking or not. Demos end once the last one is gone, i.e. the page has been left.
let mountedGuards = 0;

let demoWarning = false;
const demoWarningListeners = new Set<() => void>();

function setDemoWarning(shown: boolean) {
  demoWarning = shown;
  demoWarningListeners.forEach((listener) => listener());
}

function subscribeDemoWarning(listener: () => void): () => void {
  demoWarningListeners.add(listener);
  return () => demoWarningListeners.delete(listener);
}

// Read when navigation is attempted, so switching between the reasons doesn't re-add the guard entry.
function warn() {
  if (isAnyEditing()) warnEditMode("navigate");
  else setDemoWarning(true);
}

// Back cannot be cancelled, so add a copy of this page to step back onto, and re-add it each time.
function pushGuardEntry() {
  window.history.pushState({ [GUARD_STATE_KEY]: true }, "", window.location.href);
}

function handlePopState(event: PopStateEvent) {
  if (event.state?.[GUARD_STATE_KEY]) return;
  pushGuardEntry();
  warn();
}

function handleClick(event: MouseEvent) {
  // Modified clicks open a new tab or window, which leaves this page alone.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self")) return;
  const url = new URL(link.href);
  const current = window.location;
  if (url.origin === current.origin && url.pathname === current.pathname && url.search === current.search) return;
  // Capture phase on window runs before React and Next's Link see the click.
  event.preventDefault();
  event.stopPropagation();
  warn();
}

/** Blocks leaving the page until the returned function is called. */
function block(): () => void {
  blockers++;
  if (!blocking) {
    blocking = true;
    pushGuardEntry();
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("click", handleClick, true);
  }
  return () => {
    blockers--;
    setTimeout(() => {
      if (blockers > 0 || !blocking) return;
      blocking = false;
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("click", handleClick, true);
      // Drop the guard entry so the next back press leaves the page as usual.
      if (window.history.state?.[GUARD_STATE_KEY]) window.history.back();
    });
  };
}

/**
 * While edit mode is on or a demo is running, blocks in-app navigation (link clicks and the
 * browser's back button) and shows a warning instead. Edit mode's warning wins when both are on,
 * since edits must be disabled before the demo can end. Also shows edit mode's warning when the
 * user tries to disconnect. Reloading or closing the tab with a real device linked is already
 * confirmed by UnloadGuard.
 */
export function NavigationGuard() {
  const editing = useAnyEditMode();
  const demo = useSyncExternalStore(subscribeDeviceActivity, isAnyDemoRunning, () => false);
  const warning = useEditModeWarning();
  const demoWarningShown = useSyncExternalStore(subscribeDemoWarning, () => demoWarning, () => false);
  const blocked = editing || demo;

  useEffect(() => (blocked ? block() : undefined), [blocked]);

  // If the page goes away anyway (e.g. a long-press on back skips several entries), end edit mode,
  // and the demos once no other guard has taken this one's place.
  useEffect(() => {
    mountedGuards++;
    return () => {
      mountedGuards--;
      disableEditMode();
      setTimeout(() => {
        if (mountedGuards > 0) return;
        setDemoWarning(false);
        endAllDemos();
      });
    };
  }, []);

  return (
    <>
      <Dialog open={warning !== null} onClose={dismissEditModeWarning}>
        <DialogTitle>Edit mode is on</DialogTitle>
        <DialogContent>
          <DialogContentText>{warning && warningTexts[warning]}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={dismissEditModeWarning}>
            Keep editing
          </Button>
          <Button onClick={disableEditMode}>Disable edits</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={demoWarningShown && demo} onClose={() => setDemoWarning(false)}>
        <DialogTitle>Demo mode is on</DialogTitle>
        <DialogContent>
          <DialogContentText>Exit the demo before you leave this page.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDemoWarning(false)}>
            Keep exploring
          </Button>
          <Button
            color="error"
            onClick={() => {
              setDemoWarning(false);
              endAllDemos();
            }}
          >
            Exit demo
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
