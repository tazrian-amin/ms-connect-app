"use client";

import { useEffect } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import {
  disableEditMode,
  dismissEditModeWarning,
  useAnyEditMode,
  useEditModeWarning,
  warnEditMode,
  type EditModeWarning,
} from "@/lib/edit-mode";

const warningTexts: Record<EditModeWarning, string> = {
  navigate: "Edit mode needs to be disabled before you leave this page.",
  disconnect: "Edit mode needs to be disabled before you disconnect the device.",
};

// Marks the extra history entry that catches the browser's back button.
const GUARD_STATE_KEY = "editModeGuard";

/**
 * While edit mode is on, blocks in-app navigation (link clicks and the browser's back button) and
 * shows a warning instead. Also shows the warning when the user tries to disconnect.
 * Reloading or closing the tab is already confirmed by UnloadGuard while a device is linked.
 */
export function EditModeGuard() {
  const editing = useAnyEditMode();
  const warning = useEditModeWarning();

  useEffect(() => {
    if (!editing) return;

    // Back cannot be cancelled, so add a copy of this page to step back onto, and re-add it each time.
    const pushGuardEntry = () => window.history.pushState({ [GUARD_STATE_KEY]: true }, "", window.location.href);
    pushGuardEntry();

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.[GUARD_STATE_KEY]) return;
      pushGuardEntry();
      warnEditMode("navigate");
    };

    const handleClick = (event: MouseEvent) => {
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
      warnEditMode("navigate");
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("click", handleClick, true);
      // Drop the guard entry so the next back press leaves the page as usual.
      if (window.history.state?.[GUARD_STATE_KEY]) window.history.back();
    };
  }, [editing]);

  // If the page goes away anyway (e.g. a long-press on back skips several entries), end edit mode.
  useEffect(() => () => disableEditMode(), []);

  return (
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
  );
}
