"use client";

import { InstanceTabs } from "@/components/device-details/instance-tabs";
import { getConnection } from "@/lib/connection/registry";
import { AddBinDialog, RenameBinDialog } from "./bin-dialogs";
import type { Bin, NewBin } from "./bins";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

type BinTabsProps = {
  bins: Bin[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Called with what the user picked for the new bin, the name already validated. */
  onAdd: (bin: NewBin) => void;
  /** Called with the bin's new name, already validated. */
  onRename: (id: string, name: string) => void;
  /** Called once the user has confirmed the removal. */
  onRemove: (id: string) => void;
  /** Called with the index the bin was dragged or moved to. */
  onMove: (id: string, index: number) => void;
};

/** One tab per bin across the top of the device details page (see `InstanceTabs`). */
export function BinTabs({ bins, selectedId, onSelect, onAdd, onRename, onRemove, onMove }: BinTabsProps) {
  return (
    <InstanceTabs
      items={bins}
      selectedId={selectedId}
      onSelect={onSelect}
      onRemove={onRemove}
      onMove={onMove}
      noun="bin"
      label="Bins"
      idPrefix="bin"
      getConnection={(bin) => getConnection(binHeightMeasurementProfile, bin)}
      removeMessage="Its sensor is disconnected if it is connected."
      addDialog={({ open, onClose }) => (
        <AddBinDialog
          open={open}
          onClose={onClose}
          onAdd={(bin) => {
            onClose();
            onAdd(bin);
          }}
        />
      )}
      renameDialog={({ open, item, onClose }) => (
        <RenameBinDialog
          open={open}
          bin={item}
          onClose={onClose}
          onRename={(name) => {
            onClose();
            if (item) onRename(item.id, name);
          }}
        />
      )}
    />
  );
}
