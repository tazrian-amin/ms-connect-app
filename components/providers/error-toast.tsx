"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { dismissError, useErrorToast } from "@/lib/error-toast";

const AUTO_HIDE_MS = 10_000;

/** Shows errors reported with `showError`, one at a time. */
export function ErrorToast() {
  const toast = useErrorToast();
  // Keeps the last message on screen while the toast animates out.
  const [shown, setShown] = useState(toast);
  if (toast && toast !== shown) setShown(toast);

  return (
    <Snackbar
      // A new id restarts the auto-hide timer and the enter animation.
      key={shown?.id}
      open={toast !== null}
      autoHideDuration={AUTO_HIDE_MS}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      onClose={(_, reason) => reason !== "clickaway" && dismissError()}
    >
      <Alert severity="error" variant="filled" onClose={dismissError} sx={{ width: "100%" }}>
        {shown?.message}
      </Alert>
    </Snackbar>
  );
}
