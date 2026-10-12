"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import type { SessionCounter } from "./types";

interface ResetCounterDialogProps {
  open: boolean;
  /** Which of the two session counters is being cleared, on every pump. */
  counter: SessionCounter;
  /** How many pumps the reset reaches — named in the prompt. */
  pumpCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * The reset is with the device — one command per pump. It only counts once
   * the device answers each, so the dialog stays up, and shut, until then.
   */
  pending?: boolean;
}

/**
 * Guards a counter reset, which is destructive, has no undo, and clears the
 * counter on every pump at once.
 */
export function ResetCounterDialog({
  open,
  counter,
  pumpCount,
  onConfirm,
  onCancel,
  pending = false,
}: ResetCounterDialogProps) {
  const isRuntime = counter === "runtime";
  const counterName = isRuntime ? "session runtime" : "session starts";

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      onClose={pending ? undefined : onCancel}
    >
      <DialogTitle>Reset {counterName} for all pumps?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          This clears the{" "}
          {isRuntime ? "session runtime" : "session start count"} of{" "}
          <Typography
            component="span"
            variant="body2"
            color="text.primary"
            sx={{ fontWeight: 600 }}
          >
            all {pumpCount} pumps
          </Typography>{" "}
          back to zero, and can&apos;t be undone.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          The {isRuntime ? "total runtime" : "total starts"} since installation
          {isRuntime ? " is" : " are"} not affected.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="secondary" disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          loading={pending}
          autoFocus
        >
          Reset
        </Button>
      </DialogActions>
    </Dialog>
  );
}
