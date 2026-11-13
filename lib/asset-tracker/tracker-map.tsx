"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, LineString } from "geojson";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import type { LngLatBoundsLike } from "maplibre-gl";
import { Layer, Map, Marker, NavigationControl, Source, type MapRef } from "@vis.gl/react-maplibre";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { keyframes, useColorScheme } from "@mui/material/styles";
import { formatPeriod, stopDuration, type Journey, type Stop } from "./journey";
import { StopBadge } from "./journey-timeline";
import type { LatLng, TimedLatLng } from "./location";
import { useLocationName } from "./location-name";
import { PIN_COLOR, PIN_OUTLINE, ROUTE_COLOR, SELECTED_ROUTE_COLOR } from "./map-colors";

type TrackerMapProps =
  | {
      mode: "live";
      /** The tracker's last reported location. The pin sits here and the map follows it. */
      position: LatLng;
      /** Whether the asset is moving, which makes the pin pulse. */
      moving?: boolean;
      /** Its path on the current trip, oldest first, drawn as a line ending at the pin. */
      trail?: LatLng[];
      /** Where the current trip set off from, marked with a dot, and when it left. */
      lastStop?: { at: LatLng; leftAt?: number };
    }
  | {
      mode: "history";
      /** The locations of the chosen period, oldest first; at least one. */
      route: TimedLatLng[];
      /** The route split into stops and trips; each stop gets a numbered marker. */
      journey: Journey;
      /** Index of the stop or trip to show, whose card opens or whose line is highlighted. */
      selected: number | null;
      onSelect: (index: number | null) => void;
    };

// OpenFreeMap: free vector tiles with no API key or usage limits. Swapping these for another
// provider's style URLs (e.g. MapTiler) is all a change of provider takes.
const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// MapLibre looks for its worker next to its own script, which bundling moves. Pointing it at the
// file directly makes the bundler emit the worker and hand back its URL.
const WORKER_URL = new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href;

const ZOOM = 15;
/** Room around a whole route, so its start and end markers aren't cut off by the edges. */
const FIT_PADDING = 64;
const FIT_MAX_ZOOM = 16;
/** At least this close in on a stop picked from the timeline, so the street is readable. */
const STOP_ZOOM = 15;
/** Moves a picked stop below the middle, leaving room for its card above it. */
const STOP_OFFSET: [number, number] = [0, 80];

const PIN_WIDTH = 28;
const PIN_HEIGHT = 40;
const DOT_SIZE = 18;
const STOP_SIZE = 24;
const PULSE_SIZE = 14;

const pulse = keyframes`
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(3); opacity: 0; }
`;

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Map of one tracker: live, following its latest location, or a past route from start to end.
 * Browser only: load it with `next/dynamic` and `ssr: false`.
 */
export default function TrackerMap(props: TrackerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const { mode, systemMode } = useColorScheme();
  const scheme = (mode === "system" ? systemMode : mode) ?? "light";
  // Bumped by a tap on the map away from the markers, which closes any card pinned open.
  const [closeCards, setCloseCards] = useState(0);

  const line = props.mode === "live" ? props.trail : props.route;
  const routeLine = useMemo<Feature<LineString> | null>(() => {
    if (!line || line.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: line.map((point) => [point.longitude, point.latitude]) },
    };
  }, [line]);

  // Live: glide to each newly reported location, so the tracker stays in view as it moves.
  // Keeps whatever zoom the user picked, except on coming back from history, where it resets.
  const live = props.mode === "live" ? props.position : null;
  const liveLatitude = live?.latitude;
  const liveLongitude = live?.longitude;
  const followTracker = useEffectEvent((zoom?: number) => {
    if (liveLatitude === undefined || liveLongitude === undefined) return;
    mapRef.current?.easeTo({ center: [liveLongitude, liveLatitude], zoom, duration: 1000 });
  });
  useEffect(() => followTracker(), [liveLatitude, liveLongitude]);
  useEffect(() => followTracker(ZOOM), [props.mode]);

  // History: fit the whole route in view whenever a new one is shown.
  const route = props.mode === "history" ? props.route : null;
  useEffect(() => {
    if (route) mapRef.current?.fitBounds(boundsOf(route), { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, duration: 800 });
  }, [route]);

  // History: bring the stop or trip picked in the timeline into view.
  const selected = props.mode === "history" && props.selected !== null ? props.journey.segments[props.selected] : null;
  const selectedTrip = selected?.kind === "trip" && route ? route.slice(selected.first, selected.last + 1) : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    if (selected.kind === "stop") {
      const { latitude, longitude } = selected.at;
      const zoom = Math.max(map.getZoom(), STOP_ZOOM);
      map.easeTo({ center: [longitude, latitude], zoom, offset: STOP_OFFSET, duration: 800 });
    } else if (selectedTrip) {
      map.fitBounds(boundsOf(selectedTrip), { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, duration: 800 });
    }
    // `selectedTrip` is worked out from `selected`, and new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const tripLine = useMemo<Feature<LineString> | null>(
    () =>
      selectedTrip && selectedTrip.length > 1
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: selectedTrip.map((point) => [point.longitude, point.latitude]),
            },
          }
        : null,
    // As above: `selectedTrip` changes only with `selected`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={
        route
          ? { bounds: boundsOf(route), fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM } }
          : { latitude: live!.latitude, longitude: live!.longitude, zoom: ZOOM }
      }
      mapStyle={MAP_STYLES[scheme]}
      workerUrl={WORKER_URL}
      style={{ width: "100%", height: "100%" }}
      dragRotate={false}
      // The ⓘ button, rather than a line of credits that wraps on phones.
      attributionControl={{ compact: true }}
      // Taps on a marker reach the map too, so only taps elsewhere close the cards.
      onClick={(event) => {
        const target = event.originalEvent.target;
        if (target instanceof Element && target.closest(".maplibregl-marker")) return;
        setCloseCards((n) => n + 1);
        if (props.mode === "history") props.onSelect(null);
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {routeLine && (
        <Source id="route" type="geojson" data={routeLine}>
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            // Short rounded dashes, so the route reads as a trail rather than a road.
            // Faded while a trip is picked, so that trip stands out.
            paint={{
              "line-color": ROUTE_COLOR,
              "line-width": 4,
              "line-dasharray": [1, 1.75],
              "line-opacity": tripLine ? 0.35 : 1,
            }}
          />
        </Source>
      )}
      {tripLine && (
        <Source id="selected-trip" type="geojson" data={tripLine}>
          <Layer
            id="selected-trip-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": SELECTED_ROUTE_COLOR, "line-width": 6 }}
          />
        </Source>
      )}
      {props.mode === "live" ? (
        <>
          {props.lastStop && (
            <MapMarker
              at={props.lastStop.at}
              shape="dot"
              label="Last stop"
              caption={
                props.lastStop.leftAt === undefined
                  ? "Last stop"
                  : `Last stop · set off ${timeFormat.format(props.lastStop.leftAt)}`
              }
              closeSignal={closeCards}
            />
          )}
          <MapMarker
            at={props.position}
            shape="pin"
            moving={props.moving}
            label="Tracker location"
            closeSignal={closeCards}
          />
        </>
      ) : (
        <HistoryMarkers {...props} closeSignal={closeCards} />
      )}
    </Map>
  );
}

type HistoryMarkersProps = Extract<TrackerMapProps, { mode: "history" }> & { closeSignal: number };

/**
 * A blue dot where the route starts, a numbered marker at each stop, and a red pin where it ends.
 * A route that starts at a stop has no dot, as the stop's marker shows where it began; one that
 * ends at a stop has no marker for that stop, as the pin is there and its card tells of the stop.
 */
function HistoryMarkers({ route, journey, selected, onSelect, closeSignal }: HistoryMarkersProps) {
  const { segments } = journey;
  const startsStopped = segments[0]?.kind === "stop";
  const lastIndex = segments.length - 1;
  const endStop = segments[lastIndex]?.kind === "stop" ? (segments[lastIndex] as Stop) : null;
  const end = route.at(-1)!;
  // Cards on stops open and close with the timeline's selection, so the two stay in step.
  const controlled = (index: number) => ({
    open: selected === index,
    onOpenChange: (open: boolean) => onSelect(open ? index : selected === index ? null : selected),
  });

  return (
    <>
      {route.length > 1 && !startsStopped && (
        // Keyed by time, so a card left open on one route doesn't carry over to the next.
        <MapMarker
          key={route[0].time}
          at={route[0]}
          shape="dot"
          label="Route start"
          caption={`Start · ${timeFormat.format(route[0].time)}`}
          closeSignal={closeSignal}
        />
      )}
      {segments.map((segment, index) =>
        segment.kind === "stop" && segment !== endStop ? (
          <MapMarker
            key={`stop-${segment.start}`}
            at={segment.at}
            shape="stop"
            number={segment.number}
            label={`Stop ${segment.number}`}
            caption={<StopCaption stop={segment} />}
            closeSignal={closeSignal}
            {...controlled(index)}
          />
        ) : null,
      )}
      <MapMarker
        key={end.time}
        at={end}
        shape="pin"
        label={route.length > 1 ? "Route end" : "Recorded location"}
        caption={
          endStop ? (
            <StopCaption stop={endStop} prefix="End" />
          ) : (
            `${route.length > 1 ? "End" : "Recorded"} · ${timeFormat.format(end.time)}`
          )
        }
        closeSignal={closeSignal}
        {...(endStop ? controlled(lastIndex) : {})}
      />
    </>
  );
}

/** "Stop 3 · stopped 2 h 15 min", then when it arrived and left. */
function StopCaption({ stop, prefix }: { stop: Stop; prefix?: string }) {
  return (
    <>
      <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
        {prefix ? `${prefix} · ` : ""}Stop {stop.number} · stopped {stopDuration(stop)}
      </Box>
      <Box component="span" sx={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
        {formatPeriod(stop.start, stop.end)}
      </Box>
    </>
  );
}

function boundsOf(points: LatLng[]): LngLatBoundsLike {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const { latitude, longitude } of points) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [west, south, east, north];
}

type MapMarkerProps = {
  at: LatLng;
  /** "pin" for the tracker or a route's end, "dot" for a route's start, "stop" for a numbered stop. */
  shape: "pin" | "dot" | "stop";
  /** The stop's number, for a "stop". */
  number?: number;
  /** Accessible name of the marker's button. */
  label: string;
  /** Extra line on the card, e.g. when the location was recorded. */
  caption?: ReactNode;
  moving?: boolean;
  /** Closes the card when it changes. */
  closeSignal: number;
  /** Whether the card is pinned open, when the parent keeps track of it rather than the marker. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A marker that shows a card with the place name and coordinates: on hover, on keyboard focus, or
 * pinned open by a tap or click until tapped again, Escape, or a tap elsewhere on the map.
 */
function MapMarker(props: MapMarkerProps) {
  const { at, shape, number, label, caption, moving = false, closeSignal, open, onOpenChange } = props;
  const [hovered, setHovered] = useState(false);
  const [ownPinned, setOwnPinned] = useState(false);
  const pinned = open ?? ownPinned;
  const setPinned = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOwnPinned(next));
  const [focused, setFocused] = useState(false);
  const cardOpen = hovered || pinned || focused;

  const [seenSignal, setSeenSignal] = useState(closeSignal);
  if (closeSignal !== seenSignal) {
    setSeenSignal(closeSignal);
    setOwnPinned(false);
  }

  const [width, height] =
    shape === "pin" ? [PIN_WIDTH, PIN_HEIGHT] : shape === "stop" ? [STOP_SIZE, STOP_SIZE] : [DOT_SIZE, DOT_SIZE];

  return (
    // A pin's tip sits on the location; a dot is centred on it. The pin is drawn above the dot.
    <Marker
      latitude={at.latitude}
      longitude={at.longitude}
      anchor={shape === "pin" ? "bottom" : "center"}
      style={{ zIndex: cardOpen ? 3 : shape === "pin" ? 2 : 1 }}
    >
      {cardOpen && <LocationCard at={at} caption={caption} offset={height + 8} interactive={pinned} />}
      <Box
        component="button"
        type="button"
        aria-label={label}
        aria-expanded={cardOpen}
        // Hover shows the card for mouse users; a tap or click pins it open until tapped again.
        onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
        onClick={() => setPinned(!pinned)}
        onFocus={(event) => event.currentTarget.matches(":focus-visible") && setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => event.key === "Escape" && (setPinned(false), setFocused(false))}
        sx={{
          position: "relative",
          display: "block",
          width,
          height,
          p: 0,
          border: 0,
          bgcolor: "transparent",
          cursor: "pointer",
          borderRadius: shape === "pin" ? 1 : "50%",
          "&:focus-visible": { outline: "2px solid", outlineColor: ROUTE_COLOR, outlineOffset: 2 },
        }}
      >
        {shape === "pin" ? <Pin moving={moving} /> : shape === "stop" ? <StopBadge number={number ?? 0} /> : <Dot />}
      </Box>
    </Marker>
  );
}

function Pin({ moving }: { moving: boolean }) {
  return (
    <>
      {moving && (
        // Ripples out from the tip, where the pin meets the map.
        <Box
          sx={{
            position: "absolute",
            left: `calc(50% - ${PULSE_SIZE / 2}px)`,
            bottom: -PULSE_SIZE / 2,
            width: PULSE_SIZE,
            height: PULSE_SIZE,
            borderRadius: "50%",
            bgcolor: PIN_COLOR,
            animation: `${pulse} 1.6s ease-out infinite`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
      )}
      <Box
        component="svg"
        viewBox="0 0 24 34"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 2px 2px rgba(0, 0, 0, 0.35))",
        }}
      >
        <path
          d="M12 0.75C5.79 0.75 0.75 5.68 0.75 11.8c0 8.07 9.66 18.6 10.47 19.98a0.9 0.9 0 0 0 1.56 0C13.59 30.4 23.25 19.87 23.25 11.8 23.25 5.68 18.21 0.75 12 0.75Z"
          fill={PIN_COLOR}
          stroke={PIN_OUTLINE}
          strokeWidth={1.5}
        />
        <circle cx={12} cy={12} r={4.25} fill={PIN_OUTLINE} />
      </Box>
    </>
  );
}

/** A route's start: a blue dot in the route's colour, ringed in white. */
function Dot() {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        bgcolor: ROUTE_COLOR,
        border: "3px solid #ffffff",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.4)",
      }}
    />
  );
}

type LocationCardProps = {
  at: LatLng;
  caption?: ReactNode;
  /** Distance from the marker's anchor to the card's bottom edge, in px. */
  offset: number;
  interactive: boolean;
};

/** Card above a marker with the place name, an optional caption, and the coordinates. */
function LocationCard({ at: { latitude, longitude }, caption, offset, interactive }: LocationCardProps) {
  const place = useLocationName(latitude, longitude, true);
  return (
    <Paper
      role="status"
      elevation={4}
      sx={{
        position: "absolute",
        left: "50%",
        bottom: offset,
        transform: "translateX(-50%)",
        width: "max-content",
        maxWidth: 260,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        textAlign: "left",
        cursor: "auto",
        // Only takes the pointer when tapped open, so hovering doesn't flicker as it appears.
        pointerEvents: interactive ? "auto" : "none",
        userSelect: "text",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {place.status === "found" ? place.name : place.status === "unknown" ? "Unnamed location" : <Skeleton width={180} />}
      </Typography>
      {caption && (
        <Typography variant="caption" component="p">
          {caption}
        </Typography>
      )}
      <Typography variant="caption" component="p" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
        {latitude.toFixed(6)}°, {longitude.toFixed(6)}°
      </Typography>
    </Paper>
  );
}
