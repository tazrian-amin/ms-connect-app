"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import type { ConnectionStatus } from "@/lib/bluetooth/connection";
import { useConnectionState } from "@/lib/bluetooth/hooks";
import { getConnection } from "@/lib/bluetooth/registry";
import { useAnyEditMode, warnEditMode } from "@/lib/edit-mode";
import { BIN_NAME_MAX_LENGTH, suggestBinName, validateBinName, type Bin } from "./bins";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

type BinTabsProps = {
  bins: Bin[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Called with the name the user entered, already validated. */
  onAdd: (name: string) => void;
  /** Called once the user has confirmed the removal. */
  onRemove: (id: string) => void;
};

/**
 * One tab per bin across the top of the device details page, with buttons to add and remove bins.
 * While edit mode is on, changing bins would leave the edited bin's page, so it is blocked like
 * leaving the page is.
 */
export function BinTabs({ bins, selectedId, onSelect, onAdd, onRemove }: BinTabsProps) {
  const editing = useAnyEditMode();
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const selected = bins.find((bin) => bin.id === selectedId);

  const unlessEditing =
    <A extends unknown[]>(handler: (...args: A) => void) =>
    (...args: A) =>
      editing ? warnEditMode("switch") : handler(...args);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Tabs
        value={selectedId}
        onChange={unlessEditing((_, id: string) => onSelect(id))}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Bins"
        sx={{ minWidth: 0 }}
      >
        {bins.map((bin) => (
          <Tab
            key={bin.id}
            value={bin.id}
            label={<BinTabLabel bin={bin} />}
            id={`bin-tab-${bin.id}`}
            aria-controls={`bin-panel-${bin.id}`}
          />
        ))}
      </Tabs>
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, pb: { xs: 1.5, sm: 0 } }}>
        <Button
          color="inherit"
          startIcon={<DeleteOutlinedIcon />}
          disabled={bins.length <= 1}
          onClick={unlessEditing(() => setConfirming(true))}
        >
          Remove bin
        </Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={unlessEditing(() => setAdding(true))}>
          Add bin
        </Button>
      </Stack>

      <AddBinDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(name) => {
          setAdding(false);
          onAdd(name);
        }}
      />

      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>Remove {selected?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>Its sensor is disconnected if it is connected.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => {
              setConfirming(false);
              onRemove(selectedId);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

type AddBinDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
};

/** Asks for the new bin's name, suggesting the next numbered one. */
function AddBinDialog({ open, onClose, onAdd }: AddBinDialogProps) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const problem = validateBinName(name);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        transition: {
          // Start each time from a fresh suggestion.
          onEnter: () => {
            setName(suggestBinName());
            setTouched(false);
          },
        },
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!problem) onAdd(name);
        }}
      >
        <DialogTitle>Add bin</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Bin name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setTouched(true);
            }}
            onFocus={(event) => event.target.select()}
            error={touched && problem !== null}
            helperText={(touched && problem) || "Shown on the bin's tab."}
            slotProps={{ htmlInput: { maxLength: BIN_NAME_MAX_LENGTH } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={touched && problem !== null}>
            Add
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

const statusDots: Record<ConnectionStatus, { label: string; color: string }> = {
  disconnected: { label: "Not connected", color: "action.disabled" },
  requesting: { label: "Choosing device", color: "info.main" },
  connecting: { label: "Connecting", color: "info.main" },
  connected: { label: "Connected", color: "success.main" },
  reconnecting: { label: "Reconnecting", color: "warning.main" },
};

/** Bin name with a dot for the state of its sensor's link. */
function BinTabLabel({ bin }: { bin: Bin }) {
  const { status } = useConnectionState(getConnection(binHeightMeasurementProfile, bin));
  const { label, color } = statusDots[status];
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box
        component="span"
        role="img"
        aria-label={label}
        title={label}
        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }}
      />
      <span>{bin.name}</span>
    </Stack>
  );
}
