"use client";

import { useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab, { type TabProps } from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ConnectionStatus } from "@/lib/bluetooth/connection";
import { useConnectionState } from "@/lib/bluetooth/hooks";
import { getConnection } from "@/lib/bluetooth/registry";
import { useAnyEditMode, warnEditMode } from "@/lib/edit-mode";
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

/**
 * One tab per bin across the top of the device details page, with a button to add a bin and a
 * menu to rename or remove the selected one. While edit mode is on, changing bins would leave the edited bin's page, so it is
 * blocked like leaving the page is. Renaming and reordering stay allowed, since they keep the same bin shown.
 * Tabs are reordered by dragging them, or from the menu for keyboard users.
 */
export function BinTabs({ bins, selectedId, onSelect, onAdd, onRename, onRemove, onMove }: BinTabsProps) {
  const editing = useAnyEditMode();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const selected = bins.find((bin) => bin.id === selectedId);
  const selectedIndex = bins.findIndex((bin) => bin.id === selectedId);

  const sensors = useSensors(
    // A click only selects the tab; the pointer has to move a little before it drags.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // On touch, a swipe still scrolls the tabs; a long press picks one up.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false);
    if (!over || active.id === over.id) return;
    onMove(String(active.id), bins.findIndex((bin) => bin.id === over.id));
  };

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(false)}
      >
        <SortableContext items={bins.map((bin) => bin.id)} strategy={horizontalListSortingStrategy}>
          <Tabs
            value={selectedId}
            onChange={unlessEditing((_, id: string) => onSelect(id))}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Bins"
            sx={{
              minWidth: 0,
              // The indicator stays where the selected tab was, so hide it until the tabs settle.
              "& .MuiTabs-indicator": { visibility: dragging ? "hidden" : undefined },
            }}
          >
            {bins.map((bin) => (
              <SortableTab
                key={bin.id}
                value={bin.id}
                label={<BinTabLabel bin={bin} />}
                id={`bin-tab-${bin.id}`}
                aria-controls={`bin-panel-${bin.id}`}
              />
            ))}
          </Tabs>
        </SortableContext>
      </DndContext>
      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignItems: "center", pb: { xs: 1.5, sm: 0 } }}>
        <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={unlessEditing(() => setAdding(true))}>
          Add bin
        </Button>
        <IconButton
          id="bin-actions-button"
          aria-label={`More actions for ${selected?.name ?? "this bin"}`}
          aria-controls={menuAnchor ? "bin-actions-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={menuAnchor ? "true" : undefined}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          id="bin-actions-menu"
          anchorEl={menuAnchor}
          open={menuAnchor !== null}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ list: { "aria-labelledby": "bin-actions-button" } }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setRenaming(true);
            }}
          >
            <ListItemIcon>
              <EditOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
          <MenuItem
            disabled={selectedIndex <= 0}
            onClick={() => {
              setMenuAnchor(null);
              onMove(selectedId, selectedIndex - 1);
            }}
          >
            <ListItemIcon>
              <ArrowBackIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Move left</ListItemText>
          </MenuItem>
          <MenuItem
            disabled={selectedIndex === -1 || selectedIndex >= bins.length - 1}
            onClick={() => {
              setMenuAnchor(null);
              onMove(selectedId, selectedIndex + 1);
            }}
          >
            <ListItemIcon>
              <ArrowForwardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Move right</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              unlessEditing(() => setConfirming(true))();
            }}
          >
            <ListItemIcon>
              <DeleteOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Remove bin</ListItemText>
          </MenuItem>
        </Menu>
      </Stack>

      <AddBinDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(bin) => {
          setAdding(false);
          onAdd(bin);
        }}
      />

      <RenameBinDialog
        open={renaming}
        bin={selected}
        onClose={() => setRenaming(false)}
        onRename={(name) => {
          setRenaming(false);
          onRename(selectedId, name);
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

/**
 * A tab that can be dragged sideways to a new place. Only the pointer listeners are used: dnd-kit's
 * attributes would replace the tab's role and its keyboard handling would clash with the tabs' own,
 * so keyboard users move tabs from the menu instead.
 */
function SortableTab({ value, style, ...props }: TabProps & { value: string }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value });
  return (
    <Tab
      ref={setNodeRef}
      value={value}
      {...props}
      {...listeners}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.7 : undefined,
        touchAction: "manipulation",
      }}
    />
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
