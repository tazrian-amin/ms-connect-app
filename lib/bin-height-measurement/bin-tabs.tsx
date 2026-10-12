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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import type { ConnectionStatus } from "@/lib/bluetooth/connection";
import { useConnectionState } from "@/lib/bluetooth/hooks";
import { getConnection } from "@/lib/bluetooth/registry";
import type { Bin } from "./bins";
import { binHeightMeasurementProfile } from "./bluetooth-profile";

type BinTabsProps = {
  bins: Bin[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  /** Called once the user has confirmed the removal. */
  onRemove: (id: string) => void;
};

/** One tab per bin across the top of the device details page, with buttons to add and remove bins. */
export function BinTabs({ bins, selectedId, onSelect, onAdd, onRemove }: BinTabsProps) {
  const [confirming, setConfirming] = useState(false);
  const selected = bins.find((bin) => bin.id === selectedId);

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
        onChange={(_, id: string) => onSelect(id)}
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
          onClick={() => setConfirming(true)}
        >
          Remove bin
        </Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>
          Add bin
        </Button>
      </Stack>

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
