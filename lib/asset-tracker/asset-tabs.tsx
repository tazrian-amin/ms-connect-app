"use client";

import { InstanceTabs } from "@/components/device-details/instance-tabs";
import { getConnection } from "@/lib/connection/registry";
import { AddAssetDialog, RenameAssetDialog } from "./asset-dialogs";
import type { Asset, NewAsset } from "./assets";
import { assetTrackerProfile } from "./bluetooth-profile";

type AssetTabsProps = {
  assets: Asset[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Called with the new asset's name, already validated. */
  onAdd: (asset: NewAsset) => void;
  /** Called with the asset's new name, already validated. */
  onRename: (id: string, name: string) => void;
  /** Called once the user has confirmed the removal. */
  onRemove: (id: string) => void;
  /** Called with the index the asset was dragged or moved to. */
  onMove: (id: string, index: number) => void;
};

/** One tab per asset across the top of the device details page (see `InstanceTabs`). */
export function AssetTabs({ assets, selectedId, onSelect, onAdd, onRename, onRemove, onMove }: AssetTabsProps) {
  return (
    <InstanceTabs
      items={assets}
      selectedId={selectedId}
      onSelect={onSelect}
      onRemove={onRemove}
      onMove={onMove}
      noun="asset"
      label="Assets"
      idPrefix="asset"
      getConnection={(asset) => getConnection(assetTrackerProfile, asset)}
      removeMessage="Its tracker is disconnected and its last data is no longer shown. The tracker itself keeps reporting to the cloud."
      addDialog={({ open, onClose }) => (
        <AddAssetDialog
          open={open}
          onClose={onClose}
          onAdd={(asset) => {
            onClose();
            onAdd(asset);
          }}
        />
      )}
      renameDialog={({ open, item, onClose }) => (
        <RenameAssetDialog
          open={open}
          asset={item}
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
