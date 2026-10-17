"use client";

import { useState, type ReactNode } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import {
  DEFAULT_BIN_CATEGORY,
  DEFAULT_MATERIAL_TYPE,
  type BinCategory,
  type MaterialType,
} from "./bin-dashboard/bin-categories";
import { BinCategorySelect, MaterialTypeSelect } from "./bin-dashboard/bin-category-selects";
import { MaterialColorSelect } from "./bin-dashboard/material-color-select";
import { DEFAULT_MATERIAL_COLOR } from "./bin-dashboard/material-colors";
import { BIN_NAME_MAX_LENGTH, suggestBinName, validateBinName, type Bin, type NewBin } from "./bins";

type AddBinDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Called with what the user picked, the name already validated. */
  onAdd: (bin: NewBin) => void;
};

/** Asks for a new bin's name, category, material type and material colour. */
export function AddBinDialog({ open, onClose, onAdd }: AddBinDialogProps) {
  const [category, setCategory] = useState<BinCategory>(DEFAULT_BIN_CATEGORY);
  const [materialType, setMaterialType] = useState<MaterialType>(DEFAULT_MATERIAL_TYPE);
  const [materialColor, setMaterialColor] = useState(DEFAULT_MATERIAL_COLOR);

  return (
    <BinNameDialog
      open={open}
      title="Add bin"
      submitLabel="Add"
      getInitialName={suggestBinName}
      onOpen={() => {
        setCategory(DEFAULT_BIN_CATEGORY);
        setMaterialType(DEFAULT_MATERIAL_TYPE);
        setMaterialColor(DEFAULT_MATERIAL_COLOR);
      }}
      onClose={onClose}
      onSubmit={(name) => onAdd({ name, category, materialType, materialColor })}
    >
      <BinCategorySelect value={category} onChange={setCategory} />
      <MaterialTypeSelect value={materialType} onChange={setMaterialType} />
      <MaterialColorSelect value={materialColor} onChange={setMaterialColor} fullWidth />
    </BinNameDialog>
  );
}

type RenameBinDialogProps = {
  open: boolean;
  bin: Bin | undefined;
  onClose: () => void;
  /** Called with the bin's new name, already validated. */
  onRename: (name: string) => void;
};

/** Asks for a new name for `bin`. */
export function RenameBinDialog({ open, bin, onClose, onRename }: RenameBinDialogProps) {
  return (
    <BinNameDialog
      open={open}
      title="Rename bin"
      submitLabel="Rename"
      getInitialName={() => bin?.name ?? ""}
      renamingId={bin?.id}
      onClose={onClose}
      onSubmit={onRename}
    />
  );
}

type BinNameDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  /** Fills the field each time the dialog opens, e.g. a suggestion or the current name. */
  getInitialName: () => string;
  /** Called each time the dialog opens, to reset any fields in `children`. */
  onOpen?: () => void;
  /** The bin being renamed, which may keep its own name; left out when adding. */
  renamingId?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  /** More fields, below the name. */
  children?: ReactNode;
};

/** Asks for a bin's name, for a new bin or one being renamed, and any other fields given. */
function BinNameDialog({
  open,
  title,
  submitLabel,
  getInitialName,
  onOpen,
  renamingId,
  onClose,
  onSubmit,
  children,
}: BinNameDialogProps) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const problem = validateBinName(name, renamingId);

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
            onOpen?.();
          },
        },
      }}
    >
      <form
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
          {children}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={touched && problem !== null}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
