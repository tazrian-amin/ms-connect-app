"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { ASSET_NAME_MAX_LENGTH, suggestAssetName, validateAssetName, type Asset, type NewAsset } from "./assets";

type AddAssetDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Called with the new asset's name, already validated. */
  onAdd: (asset: NewAsset) => void;
};

/** Asks for a new asset's name. Its tracker's serial number is asked for when connecting. */
export function AddAssetDialog({ open, onClose, onAdd }: AddAssetDialogProps) {
  return (
    <AssetNameDialog
      open={open}
      title="Add asset"
      submitLabel="Add"
      getInitialName={suggestAssetName}
      onClose={onClose}
      onSubmit={(name) => onAdd({ name })}
    />
  );
}

type RenameAssetDialogProps = {
  open: boolean;
  asset: Asset | undefined;
  onClose: () => void;
  /** Called with the asset's new name, already validated. */
  onRename: (name: string) => void;
};

/** Asks for a new name for `asset`. */
export function RenameAssetDialog({ open, asset, onClose, onRename }: RenameAssetDialogProps) {
  return (
    <AssetNameDialog
      open={open}
      title="Rename asset"
      submitLabel="Rename"
      getInitialName={() => asset?.name ?? ""}
      renamingId={asset?.id}
      onClose={onClose}
      onSubmit={onRename}
    />
  );
}

type AssetNameDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  /** Fills the field each time the dialog opens, e.g. a suggestion or the current name. */
  getInitialName: () => string;
  /** The asset being renamed, which may keep its own name; left out when adding. */
  renamingId?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

/** Asks for an asset's name, for a new asset or one being renamed. */
function AssetNameDialog({ open, title, submitLabel, getInitialName, renamingId, onClose, onSubmit }: AssetNameDialogProps) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const problem = validateAssetName(name, renamingId);
  const showProblem = touched && problem !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        transition: {
          // Start afresh each time it opens.
          onEnter: () => {
            setName(getInitialName());
            setTouched(false);
          },
        },
      }}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!problem) onSubmit(name);
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Asset name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setTouched(true);
            }}
            onFocus={(event) => event.target.select()}
            error={showProblem}
            helperText={showProblem ? problem : "Shown on the asset's tab, e.g. a truck or a loader."}
            slotProps={{ htmlInput: { maxLength: ASSET_NAME_MAX_LENGTH } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={showProblem}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
