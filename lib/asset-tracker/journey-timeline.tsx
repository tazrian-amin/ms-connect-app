"use client";

import { useEffect, useRef, useState } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import { formatDuration, formatPeriod, stopDuration, type Journey } from "./journey";
import { STOP_COLOR } from "./map-colors";

type JourneyTimelineProps = {
  journey: Journey;
  /** Index of the segment shown on the map, or null. */
  selected: number | null;
  onSelect: (index: number | null) => void;
};

/** Width of the open panel beside the map, and of the rail it folds into, in px. */
const PANEL_WIDTH = 340;
const RAIL_WIDTH = 56;
const FOLDED_KEY = "asset-tracker:journey-panel-folded";

/**
 * The period's stops and trips, in a panel beside the map on wide screens that folds into a narrow
 * rail of stop numbers to give the map the room, and under the map on phones, where it folds away
 * upwards. Whether it's folded is remembered in this browser.
 */
export function JourneyPanel(props: JourneyTimelineProps) {
  const wide = useMediaQuery((theme: Theme) => theme.breakpoints.up("md"));
  const [folded, setFolded] = useState(readFolded);
  const toggle = () => {
    setFolded(!folded);
    try {
      localStorage.setItem(FOLDED_KEY, String(!folded));
    } catch {
      // Not remembered, e.g. in a private window: it just opens unfolded next time.
    }
  };

  const { stopCount } = props.journey;
  const label = folded ? "Show stops and trips" : "Hide stops and trips";
  // Folded beside the map, it's a rail of stop numbers; folded under it, just the header.
  const rail = wide && folded;

  return (
    <Box
      component="aside"
      aria-label="Stops and trips"
      sx={{
        order: { xs: 1, md: 0 },
        flexShrink: 0,
        width: { xs: "100%", md: folded ? RAIL_WIDTH : PANEL_WIDTH },
        transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.short }),
        display: "flex",
        flexDirection: "column",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: rail ? "center" : "space-between",
          gap: 1,
          pl: rail ? 0 : 2,
          pr: rail ? 0 : 0.5,
          py: 0.5,
          borderBottom: wide || !folded ? 1 : 0,
          borderColor: "divider",
        }}
      >
        {!rail && (
          <Typography variant="subtitle2" component="h3" noWrap sx={{ minWidth: 0 }}>
            Stops and trips
            <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
              {" "}
              · {stopCount} {stopCount === 1 ? "stop" : "stops"}
            </Box>
          </Typography>
        )}
        <Tooltip title={label} placement={wide ? "right" : "top"}>
          <IconButton size="small" onClick={toggle} aria-label={label} aria-expanded={!folded}>
            {wide ? (
              folded ? (
                <ChevronRightIcon />
              ) : (
                <ChevronLeftIcon />
              )
            ) : folded ? (
              <ExpandMoreIcon />
            ) : (
              <ExpandLessIcon />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      {(rail || !folded) && (
        <Box sx={{ flex: 1, minHeight: 0, maxHeight: { xs: 320, md: "none" }, overflowY: "auto" }}>
          {rail ? <StopRail {...props} /> : <JourneyTimeline {...props} />}
        </Box>
      )}
    </Box>
  );
}

function readFolded(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(FOLDED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Keeps the picked entry in view, e.g. after a stop is picked on the map. */
function useScrollToSelected(selected: number | null) {
  const items = useRef(new Map<number, HTMLElement>());
  useEffect(() => {
    if (selected !== null) items.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (index: number) => (element: HTMLElement | null) => {
    if (element) items.current.set(index, element);
    else items.current.delete(index);
  };
}

/**
 * The folded panel: each stop's number in order, joined by a line for the trips between them.
 * Hovering one tells how long it stopped and when; picking one shows it on the map.
 */
function StopRail({ journey, selected, onSelect }: JourneyTimelineProps) {
  const itemRef = useScrollToSelected(selected);
  return (
    <Box
      component="ol"
      sx={{
        position: "relative",
        m: 0,
        px: 0,
        py: 1,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      {/* The line the stops sit on: the trips between them. */}
      <Box
        aria-hidden
        sx={{ position: "absolute", top: 20, bottom: 20, left: "calc(50% - 1px)", width: 2, bgcolor: "divider" }}
      />
      {journey.segments.map((segment, index) =>
        segment.kind === "stop" ? (
          <Box component="li" key={segment.start} sx={{ position: "relative" }}>
            <Tooltip
              placement="right"
              title={
                <>
                  <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
                    Stop {segment.number} · stopped {stopDuration(segment)}
                  </Box>
                  {formatPeriod(segment.start, segment.end)}
                </>
              }
            >
              <ListItemButton
                ref={itemRef(index)}
                selected={selected === index}
                aria-pressed={selected === index}
                aria-label={`Stop ${segment.number}, stopped ${stopDuration(segment)}, ${formatPeriod(segment.start, segment.end)}`}
                onClick={() => onSelect(selected === index ? null : index)}
                sx={{ p: 0.5, borderRadius: "50%", flexGrow: 0 }}
              >
                <StopBadge number={segment.number} />
              </ListItemButton>
            </Tooltip>
          </Box>
        ) : null,
      )}
    </Box>
  );
}

/**
 * The period's stops and trips in order, with when and for how long. Picking one shows it on the
 * map; picking it again lets it go.
 */
export function JourneyTimeline({ journey, selected, onSelect }: JourneyTimelineProps) {
  const itemRef = useScrollToSelected(selected);

  return (
    <List dense disablePadding>
      {journey.segments.map((segment, index) => (
        <ListItemButton
          key={`${segment.kind}-${segment.start}`}
          ref={itemRef(index)}
          selected={selected === index}
          aria-pressed={selected === index}
          onClick={() => onSelect(selected === index ? null : index)}
          divider={index < journey.segments.length - 1}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            {segment.kind === "stop" ? <StopBadge number={segment.number} /> : <RouteOutlinedIcon color="action" />}
          </ListItemIcon>
          <ListItemText
            primary={
              segment.kind === "stop"
                ? `Stopped · ${stopDuration(segment)}`
                : `Moving · ${formatDuration(segment.end - segment.start)} · ${segment.distanceKm.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 1 },
                  )} km`
            }
            secondary={formatPeriod(segment.start, segment.end)}
            slotProps={{
              primary: {
                sx: { fontWeight: segment.kind === "stop" ? 600 : 400 },
              },
              secondary: { sx: { fontVariantNumeric: "tabular-nums" } },
            }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}

/** The stop's number, matching its marker on the map. */
export function StopBadge({ number }: { number: number }) {
  return (
    <Box
      aria-label={`Stop ${number}`}
      sx={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        bgcolor: "#ffffff",
        color: STOP_COLOR,
        border: `2px solid ${STOP_COLOR}`,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.35)",
      }}
    >
      {number}
    </Box>
  );
}
