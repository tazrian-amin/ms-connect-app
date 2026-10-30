"use client";

import { useEffect, useId, useRef } from "react";

type WaterLevelGaugeProps = {
  /** Feet from the sensor down to the water, or null before any reading. */
  distance: number | null;
  /** Distance in ft beyond which the water is too low (the pumps run dry). */
  maxDistance: number;
  /** Distance in ft within which the water is too high. */
  minDistance: number;
  /** What the device reports about the water level, or null before it has. */
  alarm: "high" | "low" | "normal" | null;
};

const SVG_W = 400;

/** Top of the stand's yellow rail, its walkway, and the bottom of its red truss. */
const RAIL_TOP = 52;
const DECK_Y = 70;
const TRUSS_BOTTOM = 88;
const BRIDGE = { left: 60, right: 380 };
const TRUSS_PANEL = 20;
/** Top of the banks either side of the pit. */
const GROUND_Y = 94;
/** The pit's walls, ragged like blasted rock, and its floor. */
const PIT_LEFT = [
  [104, GROUND_Y],
  [112, 132],
  [106, 170],
  [118, 214],
  [112, 260],
  [126, 300],
] as const;
const PIT_RIGHT = [
  [348, 300],
  [340, 262],
  [350, 220],
  [342, 168],
  [352, 128],
  [346, GROUND_Y],
] as const;
const PIT_FLOOR = 312;
const EARTH_BOTTOM = 326;

/** The two pumps hang from the stand into the water, their intakes near the floor. */
const PUMPS = [168, 200];
const PUMP_INTAKE_Y = 292;

/** The sensor hangs under the truss; distances are measured from its face. */
const SENSOR_X = 256;
const SENSOR_Y = 102;
/** Where the scale's full range ends. */
const RANGE_BOTTOM = 300;
/** Half the width of the sensor's beam, per unit it travels. */
const BEAM_SPREAD = 0.12;
/** The dimension line showing the reading, clear of the beam. */
const DIM_X = 300;
/** The ruler on the far bank. */
const RULER_X = 360;

const STATION = { pole: 30, enclosures: [12, 36], boxTop: 60, boxH: 22, boxW: 18 };

const BADGE_TOP = EARTH_BOTTOM + 10;
const SVG_H = BADGE_TOP + 28;

/** How quickly the drawing catches up with a new reading, per second. */
const EASE_RATE = 2.5;
/** Pulses from the sensor: how many are in flight, and how many reach the water each second. */
const PULSES = 3;
const PULSE_RATE = 0.9;
/** Ripples on the pit's surface: height, wavelength, speed (radians per second), and sample step. */
const WAVE = { height: 1.2, length: 28, speed: 2.2, step: 4 };
/** Surface span drawn, wide enough that the walls hide its ends. */
const WATER = { left: 96, right: 360 };

const BADGE_FILL = { high: "#b45309", low: "#b91c1c", normal: "#0f766e", unknown: "#0f766e" };
const THRESHOLD = { max: "#ef4444", min: "#f59e0b" };

/*
 * Scene colours for light and dark themes (MUI puts the "dark" class on <html>). The stand keeps its
 * painted red and yellow, and the pumps their blue, as on site; the rock and water follow the theme.
 */
const SCENE_CSS = `
.dwl {
  --dwl-wall: #f1efec; --dwl-strata: #e2ded8;
  --dwl-earth: #d6d0c7; --dwl-earth-edge: #a8a29e; --dwl-rock: #c4bdb2;
  --dwl-water: #2dd4bf; --dwl-water-top: #14b8a6; --dwl-water-deep: #115e59;
  --dwl-truss: #dc2626; --dwl-rail: #eab308; --dwl-deck: #71717a; --dwl-concrete: #e4e4e7;
  --dwl-pump: #2563eb; --dwl-pump-edge: #1e40af;
  --dwl-sensor: #3f3f46; --dwl-beam: #0d9488; --dwl-cable: #27272a;
  --dwl-pole: #a1a1aa; --dwl-box: #e4e4e7; --dwl-box-edge: #a1a1aa; --dwl-panel: #1e3a8a; --dwl-panel-line: #93c5fd;
  --dwl-antenna: #fafaf9; --dwl-label: #71717a; --dwl-dim: #0f172a; --dwl-pill: #ffffff;
}
:root.dark .dwl {
  --dwl-wall: #1f1d1b; --dwl-strata: #2a2724;
  --dwl-earth: #2c2926; --dwl-earth-edge: #57534e; --dwl-rock: #3a3632;
  --dwl-water: #5eead4; --dwl-water-top: #0f766e; --dwl-water-deep: #042f2e;
  --dwl-truss: #dc2626; --dwl-rail: #eab308; --dwl-deck: #a1a1aa; --dwl-concrete: #52525b;
  --dwl-pump: #3b82f6; --dwl-pump-edge: #93c5fd;
  --dwl-sensor: #d4d4d8; --dwl-beam: #5eead4; --dwl-cable: #a1a1aa;
  --dwl-pole: #71717a; --dwl-box: #52525b; --dwl-box-edge: #a1a1aa; --dwl-panel: #1e3a8a; --dwl-panel-line: #60a5fa;
  --dwl-antenna: #d6d3d1; --dwl-label: #a1a1aa; --dwl-dim: #f4f4f5; --dwl-pill: #18181b;
}
@keyframes dwl-blink { 0%, 70% { opacity: 1; } 85% { opacity: 0.2; } }
.dwl-led { animation: dwl-blink 2s ease-in-out infinite; }
.dwl-idle .dwl-reading, .dwl-idle .dwl-led { display: none; }
@media (prefers-reduced-motion: reduce) {
  .dwl-led { animation: none; }
}
`;

const pitPath = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => `${x} ${y}`).join(" L ");

/** Earth around the pit: both banks, its walls and floor, as one shape with the pit cut out of it. */
const EARTH_PATH =
  `M 0 ${GROUND_Y} L ${pitPath(PIT_LEFT)} L ${PIT_LEFT[PIT_LEFT.length - 1][0] + 8} ${PIT_FLOOR} ` +
  `L ${PIT_RIGHT[0][0] - 8} ${PIT_FLOOR} L ${pitPath(PIT_RIGHT)} L ${SVG_W} ${GROUND_Y} ` +
  `V ${EARTH_BOTTOM} H 0 Z`;
const EARTH_EDGE =
  `M 0 ${GROUND_Y} L ${pitPath(PIT_LEFT)} L ${PIT_LEFT[PIT_LEFT.length - 1][0] + 8} ${PIT_FLOOR} ` +
  `L ${PIT_RIGHT[0][0] - 8} ${PIT_FLOOR} L ${pitPath(PIT_RIGHT)} L ${SVG_W} ${GROUND_Y}`;

/** The red truss under the walkway: chords, verticals, and diagonals that cross in each panel. */
const TRUSS_PATH = (() => {
  const parts = [`M ${BRIDGE.left} ${DECK_Y} H ${BRIDGE.right}`, `M ${BRIDGE.left} ${TRUSS_BOTTOM} H ${BRIDGE.right}`];
  for (let x = BRIDGE.left; x <= BRIDGE.right; x += TRUSS_PANEL) {
    parts.push(`M ${x} ${DECK_Y} V ${TRUSS_BOTTOM}`);
    if (x < BRIDGE.right) {
      parts.push(`M ${x} ${DECK_Y} L ${x + TRUSS_PANEL} ${TRUSS_BOTTOM}`);
      parts.push(`M ${x} ${TRUSS_BOTTOM} L ${x + TRUSS_PANEL} ${DECK_Y}`);
    }
  }
  return parts.join(" ");
})();

const RAIL_PATH = (() => {
  const parts = [`M ${BRIDGE.left} ${RAIL_TOP} H ${BRIDGE.right}`, `M ${BRIDGE.left} ${(RAIL_TOP + DECK_Y) / 2} H ${BRIDGE.right}`];
  for (let x = BRIDGE.left; x <= BRIDGE.right; x += 40) parts.push(`M ${x} ${RAIL_TOP} V ${DECK_Y}`);
  return parts.join(" ");
})();

/** Faint layers in the quarry's highwall behind the stand. */
const STRATA = [18, 34, 50, 66, 80].map(
  (y, i) => `M 0 ${y} Q 100 ${y + (i % 2 ? 4 : -4)} 200 ${y} T ${SVG_W} ${y + (i % 2 ? -2 : 2)}`,
);

/** The pit's water surface as a polyline at `y`, with ripples running across it. */
function surface(y: number, height: number, phase: number): string {
  const points: string[] = [];
  for (let x = WATER.left; x <= WATER.right; x += WAVE.step) {
    points.push(`${x} ${(y + height * Math.sin((2 * Math.PI * x) / WAVE.length - phase)).toFixed(2)}`);
  }
  return points.join(" L ");
}

const waterPath = (top: string) => `M ${top} L ${WATER.right} ${PIT_FLOOR} L ${WATER.left} ${PIT_FLOOR} Z`;

/** The ruler's range: a round number of feet a little past the furthest thing it has to show. */
function rangeFor(furthest: number): { full: number; step: number } {
  const step = furthest > 40 ? 10 : 5;
  return { full: Math.max(step * 2, Math.ceil((furthest * 1.2) / step) * step), step };
}

/**
 * A cross-section of the sump a dewater level monitor watches: the pump stand spans the pit with its
 * pumps hanging into the water, and the sensor under it pings the surface below. The water rises and
 * falls with the reading against the min and max distances, so its level reads at a glance before the
 * number does. The monitor itself stands on the bank, wired to the sensor.
 */
export function WaterLevelGauge({ distance, maxDistance, minDistance, alarm }: WaterLevelGaugeProps) {
  const uid = useId();
  const waterShadeId = `${uid}-water`;
  const pitClipId = `${uid}-pit`;

  const known = distance !== null;
  const { full, step } = rangeFor(Math.max(maxDistance, known ? distance : 0));
  const yFor = (feet: number) => SENSOR_Y + (Math.min(full, Math.max(0, feet)) / full) * (RANGE_BOTTOM - SENSOR_Y);
  // Before any reading the pit rests half full between the thresholds, with nothing measured.
  const targetY = yFor(known ? distance : (minDistance + maxDistance) / 2);
  const minY = yFor(minDistance);
  const maxY = yFor(maxDistance);

  // The scene is redrawn every frame from these, outside React, so a reading eases in rather than jumping.
  const target = useRef(targetY);
  const waterRef = useRef<SVGPathElement>(null);
  const surfaceRef = useRef<SVGPathElement>(null);
  const beamRef = useRef<SVGPathElement>(null);
  const pulseRefs = useRef<(SVGPathElement | null)[]>([]);
  const dimLineRef = useRef<SVGLineElement>(null);
  const dimArrowRef = useRef<SVGPathElement>(null);
  const pillRef = useRef<SVGGElement>(null);

  useEffect(() => {
    target.current = targetY;
  }, [targetY]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let y = target.current;
    let phase = 0;
    let pulse = 0;
    let last = performance.now();

    const draw = () => {
      const top = surface(y, reduced ? 0 : WAVE.height, phase);
      waterRef.current?.setAttribute("d", waterPath(top));
      surfaceRef.current?.setAttribute("d", `M ${top}`);

      const reach = y - SENSOR_Y;
      const half = 4 + BEAM_SPREAD * reach;
      beamRef.current?.setAttribute(
        "d",
        `M ${SENSOR_X - 4} ${SENSOR_Y} L ${SENSOR_X + 4} ${SENSOR_Y} L ${SENSOR_X + half} ${y} L ${SENSOR_X - half} ${y} Z`,
      );
      // Each pulse widens with the beam on its way down, and fades as it nears the water.
      pulseRefs.current.forEach((path, i) => {
        if (!path) return;
        const p = reduced ? 0.5 + i / (PULSES * 4) : (pulse + i / PULSES) % 1;
        const py = SENSOR_Y + p * (reach - 3);
        const w = 3 + p * (half - 3);
        path.setAttribute("d", `M ${SENSOR_X - w} ${py} Q ${SENSOR_X} ${py + w * 0.45} ${SENSOR_X + w} ${py}`);
        path.setAttribute("opacity", reduced ? "0.5" : (0.95 - 0.75 * p).toFixed(2));
      });

      dimLineRef.current?.setAttribute("y2", (y - 1).toFixed(1));
      dimArrowRef.current?.setAttribute("transform", `translate(${DIM_X} ${(y - 1).toFixed(1)})`);
      pillRef.current?.setAttribute("transform", `translate(${DIM_X} ${((SENSOR_Y + y) / 2).toFixed(1)})`);
    };

    let frame = requestAnimationFrame(function stepFrame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (reduced) {
        y = target.current;
      } else {
        y += (target.current - y) * (1 - Math.exp(-EASE_RATE * dt));
        if (Math.abs(target.current - y) < 0.05) y = target.current;
        phase = (phase + WAVE.speed * dt) % (2 * Math.PI);
        pulse = (pulse + PULSE_RATE * dt) % 1;
      }
      draw();
      frame = requestAnimationFrame(stepFrame);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const restingTop = surface(targetY, 0, 0);
  const ticks = Array.from({ length: full / step + 1 }, (_, i) => i * step);
  const status = alarm ?? "unknown";

  return (
    <div className="flex flex-col items-center">
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ maxWidth: SVG_W * 1.4 }}
        className={known ? "dwl" : "dwl dwl-idle"}
        role="img"
        aria-label={
          known
            ? `Water ${distance.toFixed(1)} feet below the pump stand; min ${minDistance} ft, max ${maxDistance} ft`
            : "No water level reading yet"
        }
      >
        <defs>
          <linearGradient id={waterShadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--dwl-water-top)" }} stopOpacity={0.75} />
            <stop offset="100%" style={{ stopColor: "var(--dwl-water-deep)" }} stopOpacity={0.95} />
          </linearGradient>
          {/* The inside of the pit, so its threshold zones stop at the walls. */}
          <clipPath id={pitClipId}>
            <path
              d={`M ${pitPath(PIT_LEFT)} L ${PIT_LEFT[PIT_LEFT.length - 1][0] + 8} ${PIT_FLOOR} L ${PIT_RIGHT[0][0] - 8} ${PIT_FLOOR} L ${pitPath(PIT_RIGHT)} Z`}
            />
          </clipPath>
        </defs>
        <style>{SCENE_CSS}</style>

        {/* The quarry's highwall behind everything. */}
        <rect width={SVG_W} height={GROUND_Y} style={{ fill: "var(--dwl-wall)" }} />
        {STRATA.map((d) => (
          <path key={d} d={d} fill="none" style={{ stroke: "var(--dwl-strata)" }} strokeWidth={1.5} />
        ))}

        {/* Zones the water shouldn't reach: too high above the min distance, too low past the max. */}
        <g clipPath={`url(#${pitClipId})`}>
          <rect x={0} y={GROUND_Y} width={SVG_W} height={minY - GROUND_Y} fill={THRESHOLD.min} opacity={0.1} />
          <rect x={0} y={maxY} width={SVG_W} height={PIT_FLOOR - maxY} fill={THRESHOLD.max} opacity={0.1} />
        </g>

        {/* Pump columns, behind the water so their submerged length shows through it. */}
        {PUMPS.map((x) => (
          <g key={x}>
            <rect
              x={x - 3.5}
              y={TRUSS_BOTTOM - 2}
              width={7}
              height={PUMP_INTAKE_Y - TRUSS_BOTTOM + 2}
              style={{ fill: "var(--dwl-pump)", stroke: "var(--dwl-pump-edge)" }}
              strokeWidth={1}
            />
            <path
              d={`M ${x - 3.5} ${PUMP_INTAKE_Y} L ${x - 1.5} ${PUMP_INTAKE_Y + 10} H ${x + 1.5} L ${x + 3.5} ${PUMP_INTAKE_Y} Z`}
              style={{ fill: "var(--dwl-pump-edge)" }}
            />
          </g>
        ))}

        {/* The water, its surface rising and falling with the reading. */}
        <path ref={waterRef} d={waterPath(restingTop)} fill={`url(#${waterShadeId})`} opacity={known ? 1 : 0.45} />
        <path
          ref={surfaceRef}
          d={`M ${restingTop}`}
          fill="none"
          style={{ stroke: "var(--dwl-water)" }}
          strokeWidth={1.5}
          strokeLinejoin="round"
          opacity={known ? 1 : 0.45}
        />

        {/* Ground, with the pit cut out of it. */}
        <path d={EARTH_PATH} style={{ fill: "var(--dwl-earth)" }} />
        {[
          [18, 106, 8],
          [62, 118, 6],
          [84, 150, 7],
          [30, 180, 5],
          [70, 236, 8],
          [372, 112, 6],
          [386, 200, 7],
          [210, 320, 6],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} style={{ fill: "var(--dwl-rock)" }} />
        ))}
        <path
          d={EARTH_EDGE}
          fill="none"
          style={{ stroke: "var(--dwl-earth-edge)" }}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Min and max distances, named on the near bank. */}
        {[
          { y: minY, color: THRESHOLD.min, label: `Min ${minDistance} ft` },
          { y: maxY, color: THRESHOLD.max, label: `Max ${maxDistance} ft` },
        ].map(({ y, color, label }) => (
          <g key={label}>
            <path d={`M 50 ${y} H ${RULER_X - 4}`} stroke={color} strokeWidth={1.5} strokeDasharray="6 4" />
            <text
              x={48}
              y={y + 3.5}
              textAnchor="end"
              fontSize={10}
              fontWeight="600"
              fill={color}
              style={{ stroke: "var(--dwl-earth)" }}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {label}
            </text>
          </g>
        ))}

        {/* Ruler on the far bank, in feet below the sensor. */}
        <path d={`M ${RULER_X} ${SENSOR_Y} V ${RANGE_BOTTOM}`} style={{ stroke: "var(--dwl-label)" }} strokeWidth={1} />
        {ticks.map((feet) => (
          <g key={feet}>
            <path
              d={`M ${RULER_X} ${yFor(feet)} h ${feet % (step * 2) === 0 ? 6 : 3}`}
              style={{ stroke: "var(--dwl-label)" }}
              strokeWidth={1}
            />
            {feet % (step * 2) === 0 && (
              <text x={RULER_X + 9} y={yFor(feet) + 3.5} fontSize={9} style={{ fill: "var(--dwl-label)" }}>
                {feet === 0 ? "0 ft" : feet}
              </text>
            )}
          </g>
        ))}

        {/* Concrete abutments carrying the stand on each bank. */}
        {[BRIDGE.left - 4, BRIDGE.right - 24].map((x) => (
          <rect
            key={x}
            x={x}
            y={TRUSS_BOTTOM - 2}
            width={28}
            height={GROUND_Y - TRUSS_BOTTOM + 4}
            style={{ fill: "var(--dwl-concrete)", stroke: "var(--dwl-earth-edge)" }}
            strokeWidth={1}
          />
        ))}

        {/* The pump stand: red truss under a steel walkway, yellow rail above. */}
        <path d={TRUSS_PATH} fill="none" style={{ stroke: "var(--dwl-truss)" }} strokeWidth={2.5} strokeLinecap="round" />
        <rect
          x={BRIDGE.left}
          y={DECK_Y - 2.5}
          width={BRIDGE.right - BRIDGE.left}
          height={4}
          style={{ fill: "var(--dwl-deck)" }}
        />
        <path d={RAIL_PATH} fill="none" style={{ stroke: "var(--dwl-rail)" }} strokeWidth={2} strokeLinecap="round" />

        {/* Pump heads on the walkway. */}
        {PUMPS.map((x) => (
          <g key={x}>
            <rect
              x={x - 7}
              y={DECK_Y - 18}
              width={14}
              height={16}
              rx={3}
              style={{ fill: "var(--dwl-pump)", stroke: "var(--dwl-pump-edge)" }}
              strokeWidth={1}
            />
            <rect x={x - 9} y={DECK_Y - 4} width={18} height={3} rx={1} style={{ fill: "var(--dwl-sensor)" }} />
          </g>
        ))}

        {/* The monitor on the bank: solar panel and antenna on a pole, enclosures on a strut frame. */}
        <path
          d={`M ${STATION.pole} ${GROUND_Y} V 10`}
          style={{ stroke: "var(--dwl-pole)" }}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d={`M 6 ${GROUND_Y} V ${STATION.boxTop - 4} M 60 ${GROUND_Y} V ${STATION.boxTop - 4} M 4 ${STATION.boxTop + 4} H 60 M 4 ${STATION.boxTop + STATION.boxH - 4} H 60`}
          style={{ stroke: "var(--dwl-pole)" }}
          strokeWidth={2}
        />
        <path
          d={`M ${STATION.pole - 2} 12 L ${STATION.pole - 22} 16 L ${STATION.pole - 22} 22 L ${STATION.pole - 2} 26 Z`}
          style={{ fill: "var(--dwl-antenna)", stroke: "var(--dwl-box-edge)" }}
          strokeWidth={1}
        />
        <g transform={`translate(${STATION.pole + 2} 30) rotate(35)`}>
          <rect width={26} height={18} style={{ fill: "var(--dwl-panel)", stroke: "#e4e4e7" }} strokeWidth={1.2} />
          <path
            d="M 6.5 0 V 18 M 13 0 V 18 M 19.5 0 V 18 M 0 9 H 26"
            style={{ stroke: "var(--dwl-panel-line)" }}
            strokeWidth={0.5}
          />
        </g>
        {STATION.enclosures.map((x) => (
          <g key={x}>
            <rect
              x={x}
              y={STATION.boxTop}
              width={STATION.boxW}
              height={STATION.boxH}
              rx={2}
              style={{ fill: "var(--dwl-box)", stroke: "var(--dwl-box-edge)" }}
              strokeWidth={1}
            />
            <circle cx={x + STATION.boxW / 2} cy={STATION.boxTop + 8} r={3} fill="#f59e0b" />
          </g>
        ))}
        {/* Reporting light on the remote monitor. */}
        <circle
          className="dwl-led"
          cx={STATION.enclosures[1] + STATION.boxW - 4}
          cy={STATION.boxTop + STATION.boxH - 4}
          r={1.6}
          fill="#22c55e"
        />

        {/* Cable from the monitor along the stand to the sensor. */}
        <path
          d={`M ${STATION.enclosures[1] + STATION.boxW / 2} ${STATION.boxTop + STATION.boxH} Q 52 ${TRUSS_BOTTOM + 4} ${BRIDGE.left + 20} ${TRUSS_BOTTOM + 1.5} H ${SENSOR_X - 6}`}
          fill="none"
          style={{ stroke: "var(--dwl-cable)" }}
          strokeWidth={1.2}
        />

        {/* The sensor, hanging under the truss and looking straight down. */}
        <path d={`M ${SENSOR_X} ${TRUSS_BOTTOM} V ${TRUSS_BOTTOM + 3}`} style={{ stroke: "var(--dwl-sensor)" }} strokeWidth={2} />
        <rect
          x={SENSOR_X - 7}
          y={TRUSS_BOTTOM + 3}
          width={14}
          height={6}
          rx={1.5}
          style={{ fill: "var(--dwl-sensor)" }}
        />
        <path
          d={`M ${SENSOR_X - 5} ${TRUSS_BOTTOM + 9} L ${SENSOR_X - 7} ${SENSOR_Y} H ${SENSOR_X + 7} L ${SENSOR_X + 5} ${TRUSS_BOTTOM + 9} Z`}
          style={{ fill: "var(--dwl-sensor)" }}
          opacity={0.8}
        />

        {/* What the sensor measures: its beam and pulses down to the water, and the distance they span. */}
        <g className="dwl-reading">
          <path ref={beamRef} style={{ fill: "var(--dwl-beam)" }} opacity={0.12} />
          {Array.from({ length: PULSES }, (_, i) => (
            <path
              key={i}
              ref={(el) => {
                pulseRefs.current[i] = el;
              }}
              fill="none"
              style={{ stroke: "var(--dwl-beam)" }}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
          <path d={`M ${SENSOR_X + 9} ${SENSOR_Y} H ${DIM_X + 6}`} style={{ stroke: "var(--dwl-dim)" }} strokeWidth={0.75} strokeDasharray="2 2" />
          <line
            ref={dimLineRef}
            x1={DIM_X}
            y1={SENSOR_Y + 1}
            x2={DIM_X}
            y2={targetY}
            style={{ stroke: "var(--dwl-dim)" }}
            strokeWidth={1}
          />
          <path d={`M ${DIM_X - 3.5} ${SENSOR_Y + 6} L ${DIM_X} ${SENSOR_Y + 1} L ${DIM_X + 3.5} ${SENSOR_Y + 6}`} fill="none" style={{ stroke: "var(--dwl-dim)" }} strokeWidth={1} />
          <path ref={dimArrowRef} d="M -3.5 -5 L 0 0 L 3.5 -5" fill="none" style={{ stroke: "var(--dwl-dim)" }} strokeWidth={1} />
          <g ref={pillRef} transform={`translate(${DIM_X} ${(SENSOR_Y + targetY) / 2})`}>
            <rect x={-24} y={-9} width={48} height={18} rx={9} style={{ fill: "var(--dwl-pill)", stroke: "var(--dwl-dim)" }} strokeWidth={0.75} />
            <text y={4} textAnchor="middle" fontSize={10.5} fontWeight="700" style={{ fill: "var(--dwl-dim)" }}>
              {known ? `${distance.toFixed(1)} ft` : ""}
            </text>
          </g>
        </g>

        {/* Reading, coloured by the device's alarm. */}
        <rect
          x={SVG_W / 2 - 90}
          y={BADGE_TOP}
          width={180}
          height={24}
          rx={3}
          fill={BADGE_FILL[status]}
          opacity={known ? 1 : 0.55}
        />
        <text x={SVG_W / 2} y={BADGE_TOP + 17} textAnchor="middle" fontSize={13} fontWeight="700" fill="#ffffff">
          {known ? `${distance.toFixed(1)} ft to water` : "—"}
        </text>
      </svg>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {!known
          ? "Waiting for a water level reading"
          : alarm === "high"
            ? `Water too high · closer than ${minDistance} ft to the stand`
            : alarm === "low"
              ? `Water too low · further than ${maxDistance} ft below the stand`
              : `Water within range · ${minDistance}–${maxDistance} ft below the stand`}
      </p>
    </div>
  );
}
