"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { enableViewMode } from "@/lib/access/session-client";

type ViewCodeDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** Asks for the 6-digit code that turns view mode on. */
export function ViewCodeDialog({ open, onClose }: ViewCodeDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setCode("");
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await enableViewMode(code);
    setSubmitting(false);
    if (result.ok) {
      setCode("");
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth slotProps={{ paper: { component: "form", onSubmit: submit } }}>
      <DialogTitle>Show device details</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Enter the 6-digit view code to see device names and open device pages. It stays on until your session ends.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="View code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          error={error !== null}
          helperText={error ?? " "}
          slotProps={{
            htmlInput: {
              inputMode: "numeric",
              autoComplete: "one-time-code",
              maxLength: 6,
              "aria-label": "6-digit view code",
              style: { letterSpacing: "0.4em", fontVariantNumeric: "tabular-nums" },
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} color="inherit" disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disableElevation disabled={submitting}>
          {submitting ? "Checking…" : "Show details"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
