"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { shadeHex } from "@/lib/bin-height-measurement/bin-dashboard/material-colors";
import { PEBBLE_SHAPES, Pebble, PebblePattern, pebblesAlong, seededRandom, type PlacedPebble } from "@/lib/pebbles";

type ConveyorStockpileProps = {
  /** Volume conveyed this session in m³, or null before any reading. No pile is drawn until it is above zero. */
  totalVolume: number | null;
  /** Production goal for the day or shift in m³. The pile reaches full size when `totalVolume` meets it. */
  goal: number | null;
  /** m³/h currently on the belt; rocks ride the belt while it is above zero. */
  volumeRate: number | null;
  /** m/s; sets how fast the belt, pulleys and rocks move, and freezes them at zero. */
  beltSpeed: number | null;
  /** #rrggbb colour of the aggregate. */
  materialColor?: string;
};

/** A point `along` the belt from the tail pulley and `out` from its centre line (positive is below), in scene coordinates. */
function onBelt(along: number, out: number) {
  return { x: TAIL.x + along * COS + out * SIN, y: TAIL.y - along * SIN + out * COS };
}

const SVG_W = 400;
const GROUND_Y = 250;
const FLOOR_Y = 272;
const EARTH_BOTTOM = 286;
const BADGE_TOP = EARTH_BOTTOM + 8;
const SVG_H = BADGE_TOP + 30;

/** The belt's incline above horizontal, in degrees. */
const BELT_ANGLE = 12;
const COS = Math.cos((BELT_ANGLE * Math.PI) / 180);
const SIN = Math.sin((BELT_ANGLE * Math.PI) / 180);

/** Only the belt's last stretch is drawn: it comes in past the left edge and ends at the head pulley. */
const HEAD = { x: 190, y: 112 };
const BELT_L = 240;
const TAIL = { x: HEAD.x - BELT_L * COS, y: HEAD.y + BELT_L * SIN };
const PULLEY_R = 8;
const ROCK_LIFT = PULLEY_R + 5; // top of the load on the belt, above the belt's centre line
/** Where the load leaves the belt over the head pulley. */
const ROCK_END = onBelt(BELT_L, -ROCK_LIFT);
const THROW = 42; // how far rocks carry forward as they fall
const APEX_X = ROCK_END.x + THROW;
/** Top of the drawing: room above the head pulley for the load riding over it. */
const VIEW_TOP = HEAD.y - 34;
/** Where the belt's frame stands on the ground, left of the pit. */
const LEG_XS = [36, 92];

const PIT_TOP_HALF = 126;
const PIT_FLOOR_HALF = 110;
/** Slope of the pile's sides: rise over run, roughly aggregate's angle of repose. */
const REPOSE = 0.9;
const MAX_PILE_H = 110;

/** Size of the stones on the belt, in the stream and on the pile, against full-size pebbles. */
const LOAD_SCALE = 0.35;
/** Length of belt after which the load's stones repeat. */
const LOAD_PERIOD = 36;
/** One repeat of the load riding the belt, in the belt's frame: small stones two layers deep. */
const LOAD_PEBBLES: PlacedPebble[] = (() => {
  const rand = seededRandom(41);
  const pebbles: PlacedPebble[] = [];
  for (let layer = 1; layer >= 0; layer--) {
    for (let x = layer * 2; x < LOAD_PERIOD; x += 3.2 + rand() * 1.2) {
      const shape = PEBBLE_SHAPES[Math.floor(rand() * PEBBLE_SHAPES.length)];
      pebbles.push({ x, y: -PULLEY_R - 3 - layer * 3 - rand(), shape });
    }
  }
  return pebbles;
})();

/** How long stones take to fall from the head pulley onto the pile. */
const FALL_S = 0.9;
/** Stones in the stream off the head pulley: how far each carries, against THROW, and size. */
/** Where the load starts rounding off, short of the head pulley so its rounded end rests on the belt. */
const LOAD_END = BELT_L - 7;
/** Radius of the load's rounded end, from where it starts rounding. */
const LOAD_CAP_R = 17.5;
/** How far round its rounded end, from the top, the load reaches before it falls. */
const LOAD_CAP_ANGLE = (55 * Math.PI) / 180;
/**
 * Stones in the stream off the head pulley: where each leaves the rounded end of the load, spread
 * through its depth so the stream is as thick as the load, how far it carries, against THROW, and size.
 */
const FALL_STREAM = (() => {
  const rand = seededRandom(53);
  return Array.from({ length: 24 }, () => {
    const r = PULLEY_R + 4 + rand() * (LOAD_CAP_R - PULLEY_R - 5);
    const angle = LOAD_CAP_ANGLE * (0.45 + rand() * 0.55);
    return {
      start: onBelt(LOAD_END + r * Math.sin(angle), -r * Math.cos(angle)),
      carry: 0.75 + rand() * 0.4,
      scale: LOAD_SCALE * (0.85 + rand() * 0.3),
    };
  });
})();
/** Drawing units per metre of belt travel, to turn belt speed into animation speed. */
const PX_PER_M = 20;
/** Volume in m³ drawn as a full pile while no goal has been set. */
const UNSET_GOAL_SCALE = 10_000;
const PILE_GROW_MS = 1200;
const LABEL_FILL = "#71717a";
const GOAL_REACHED_FILL = "#16a34a";
const BELT_DASH = 10;

/*
 * Scene colours for light and dark themes (MUI puts the "dark" class on <html>). The material keeps
 * its own colour, a mid-tone that reads on both backgrounds; everything around it is set back from it.
 */
const SCENE_CSS = `
.cvs {
  --cvs-earth: #e4ddd3; --cvs-earth-edge: #a8a29e; --cvs-pit: rgba(120, 113, 108, 0.08);
  --cvs-steel: #a1a1aa; --cvs-belt: #3f3f46; --cvs-belt-mark: #a1a1aa;
  --cvs-pulley: #52525b; --cvs-pulley-mark: #e4e4e7; --cvs-motor: #52525b;
  --cvs-goal: #a1a1aa; --cvs-label: #71717a;
}
:root.dark .cvs {
  --cvs-earth: #2c2926; --cvs-earth-edge: #57534e; --cvs-pit: rgba(255, 255, 255, 0.03);
  --cvs-steel: #52525b; --cvs-belt: #52525b; --cvs-belt-mark: #a1a1aa;
  --cvs-pulley: #71717a; --cvs-pulley-mark: #27272a; --cvs-motor: #3f3f46;
  --cvs-goal: #71717a; --cvs-label: #a1a1aa;
}`;

const MOTION_CSS = `
/* The load slides one repeat along the belt per loop, so the bed of stones looks endless. */
@keyframes cvs-load { to { transform: translateX(${LOAD_PERIOD}px); } }
/*
 * Off the head pulley stones fall as thrown objects do: forward at a steady pace close to the belt's,
 * and down ever faster, so they flow off the belt instead of being flung.
 */
@keyframes cvs-throw-x { to { transform: translateX(var(--carry)); } }
@keyframes cvs-throw-y { to { transform: translateY(var(--land)); } }
@keyframes cvs-stream-fade { 0%, 100% { opacity: 0; } 2%, 92% { opacity: 1; } }
.cvs-load { animation: cvs-load var(--load-period) linear infinite; }
.cvs-throw-x { animation: cvs-throw-x ${FALL_S}s linear infinite; }
.cvs-throw-y { animation: cvs-throw-y ${FALL_S}s cubic-bezier(0.45, 0, 1, 1) infinite; }
.cvs-stream { opacity: 0; animation: cvs-stream-fade 1s infinite; }
@keyframes cvs-belt { to { stroke-dashoffset: -${BELT_DASH}; } }
@keyframes cvs-spin { to { transform: rotate(360deg); } }
.cvs-belt { animation: cvs-belt var(--belt-period) linear infinite; }
.cvs-spin { transform-origin: 0 0; animation: cvs-spin var(--spin-period) linear infinite; }
.cvs-stopped * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .cvs-load, .cvs-throw-x, .cvs-throw-y, .cvs-stream, .cvs-belt, .cvs-spin { animation: none; }
}
`;

/** A stone at (x, y) drawn at `scale` of the pile's stones. */
function SmallPebble({ x, y, shape, scale, color }: PlacedPebble & { scale: number; color: string }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`}>
      <Pebble x={0} y={0} shape={shape} color={color} />
    </g>
  );
}

/** Pile outline for a pile `h` tall, apex at the centre of the pit. */
function pilePath(h: number): string {
  const half = h / REPOSE;
  const apexY = FLOOR_Y - h;
  return `M ${APEX_X - half} ${FLOOR_Y} L ${APEX_X - 6} ${apexY + 5.4} Q ${APEX_X} ${apexY - 1} ${APEX_X + 6} ${apexY + 5.4} L ${APEX_X + half} ${FLOOR_Y} Z`;
}

/** `target`, eased toward over `ms` whenever it changes (starting from 0), or jumped to under reduced motion. */
function useEased(target: number, ms: number): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const from = current.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = reduced ? 1 : Math.min(1, (now - start) / ms);
      current.current = from + (target - from) * (1 - (1 - t) ** 3);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/**
 * A stockpile scene for a conveyor scale: the last stretch of an inclined belt carries crushed rock in
 * from the left and drops it off the head pulley onto a pile in a pit. The pile grows with the session's total volume toward
 * a dashed outline of the goal, its drawn area in proportion to progress, and is absent until there
 * is production (e.g. while the scale is being calibrated). The belt moves at the measured speed.
 */
export function ConveyorStockpile({
  totalVolume,
  volumeRate,
  beltSpeed,
  goal,
  materialColor = "#8f8a82",
}: ConveyorStockpileProps) {
  const uid = useId();
  const pebblesId = `${uid}-pebbles`;
  const lightId = `${uid}-light`;
  const groundClipId = `${uid}-ground`;
  const loadClipId = `${uid}-load`;

  const known = totalVolume !== null;
  const produced = known && totalVolume > 0;
  const hasGoal = goal !== null && goal > 0;
  const progress = produced ? totalVolume / (hasGoal ? goal : UNSET_GOAL_SCALE) : 0;
  const goalReached = hasGoal && progress >= 1;
  // Height grows with the square root so the pile's drawn area, what the eye compares, tracks progress.
  const pileH = useEased(MAX_PILE_H * Math.sqrt(Math.min(1, progress)), PILE_GROW_MS);
  const pileHalf = pileH / REPOSE;
  const apexY = FLOOR_Y - pileH;
  const toeLeft = { x: APEX_X - pileHalf, y: FLOOR_Y };
  const toeRight = { x: APEX_X + pileHalf, y: FLOOR_Y };
  const apex = { x: APEX_X, y: apexY };
  const pile = pilePath(pileH);
  const goalApexY = FLOOR_Y - MAX_PILE_H;
  const formatM3 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const running = (beltSpeed ?? 0) > 0;
  const carrying = (volumeRate ?? 0) > 0;
  const beltPxPerS = Math.max(beltSpeed ?? 0, 0.5) * PX_PER_M;
  const streaming = running && carrying;
  const motionVars = {
    "--load-period": `${(LOAD_PERIOD / beltPxPerS).toFixed(3)}s`,
    "--belt-period": `${(BELT_DASH / beltPxPerS).toFixed(3)}s`,
    "--spin-period": `${((2 * Math.PI * PULLEY_R) / beltPxPerS).toFixed(2)}s`,
    // Rocks land on the pile's top, or on the pit floor while there is no pile yet.
    "--land": `${(apexY - 3 - ROCK_END.y).toFixed(1)}px`,
  } as CSSProperties;

  const pitTop = { left: APEX_X - PIT_TOP_HALF, right: APEX_X + PIT_TOP_HALF };
  const pitFloor = {
    left: APEX_X - PIT_FLOOR_HALF,
    right: APEX_X + PIT_FLOOR_HALF,
  };
  const pitPath = `M ${pitTop.left} ${GROUND_Y} L ${pitFloor.left} ${FLOOR_Y} L ${pitFloor.right} ${FLOOR_Y} L ${pitTop.right} ${GROUND_Y} Z`;
  const earthPath = `M 0 ${GROUND_Y} L ${pitTop.left} ${GROUND_Y} L ${pitFloor.left} ${FLOOR_Y} L ${pitFloor.right} ${FLOOR_Y} L ${pitTop.right} ${GROUND_Y} L ${SVG_W} ${GROUND_Y} L ${SVG_W} ${EARTH_BOTTOM} L 0 ${EARTH_BOTTOM} Z`;

  const beltLoop = `M 0 ${-PULLEY_R} L ${BELT_L} ${-PULLEY_R} A ${PULLEY_R} ${PULLEY_R} 0 0 1 ${BELT_L} ${PULLEY_R} L 0 ${PULLEY_R} A ${PULLEY_R} ${PULLEY_R} 0 0 1 0 ${-PULLEY_R} Z`;
  const capEnd = (r: number) =>
    `${(LOAD_END + r * Math.sin(LOAD_CAP_ANGLE)).toFixed(1)} ${(-r * Math.cos(LOAD_CAP_ANGLE)).toFixed(1)}`;
  const loadClip = `M -2 -20 L ${LOAD_END} -20 L ${LOAD_END} ${-LOAD_CAP_R} A ${LOAD_CAP_R} ${LOAD_CAP_R} 0 0 1 ${capEnd(LOAD_CAP_R)} L ${capEnd(PULLEY_R)} A ${PULLEY_R} ${PULLEY_R} 0 0 0 ${LOAD_END} ${-PULLEY_R} L -2 ${-PULLEY_R} Z`;
  const trussTop = PULLEY_R + 3;
  const trussBottom = PULLEY_R + 11;
  const trussBays = 10;
  const trussZigzag = Array.from({ length: trussBays + 1 }, (_, i) => {
    const x = (i / trussBays) * BELT_L;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${i % 2 ? trussBottom : trussTop}`;
  }).join(" ");

  const legs = LEG_XS.map((x) => onBelt((x - TAIL.x) / COS, trussBottom));

  return (
    <div className="flex flex-col items-center">
      <svg
        width="100%"
        viewBox={`0 ${VIEW_TOP} ${SVG_W} ${SVG_H - VIEW_TOP}`}
        style={{ maxWidth: SVG_W * 1.4, ...motionVars }}
        className={running ? "cvs" : "cvs cvs-stopped"}
      >
        <defs>
          <PebblePattern id={pebblesId} color={materialColor} scale={LOAD_SCALE} />
          <linearGradient id={lightId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.12} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.32} />
          </linearGradient>
          {/* The pile shows above ground and inside the pit, never through the earth around it. */}
          <clipPath id={groundClipId}>
            <rect x={0} y={0} width={SVG_W} height={GROUND_Y} />
            <path d={pitPath} />
          </clipPath>
        </defs>
        <style>{SCENE_CSS + MOTION_CSS}</style>

        <path d={earthPath} style={{ fill: "var(--cvs-earth)" }} />
        <path d={pitPath} style={{ fill: "var(--cvs-pit)" }} />
        <path
          d={`M 0 ${GROUND_Y} L ${pitTop.left} ${GROUND_Y} L ${pitFloor.left} ${FLOOR_Y} L ${pitFloor.right} ${FLOOR_Y} L ${pitTop.right} ${GROUND_Y} L ${SVG_W} ${GROUND_Y}`}
          fill="none"
          style={{ stroke: "var(--cvs-earth-edge)" }}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {legs.map((leg, i) => (
          <line
            key={i}
            x1={leg.x}
            y1={leg.y}
            x2={leg.x}
            y2={GROUND_Y}
            style={{ stroke: "var(--cvs-steel)" }}
            strokeWidth={4}
          />
        ))}

        {pileH > 0.5 && (
          <g clipPath={`url(#${groundClipId})`}>
            <path d={pile} fill={shadeHex(materialColor, -0.45)} />
            <path d={pile} fill={`url(#${pebblesId})`} />
            <path d={pile} fill={`url(#${lightId})`} />
            {[...pebblesAlong(apex, toeLeft, 23, LOAD_SCALE), ...pebblesAlong(apex, toeRight, 29, LOAD_SCALE)].map(
              (p, i) => (
                <SmallPebble key={i} {...p} scale={LOAD_SCALE} color={materialColor} />
              ),
            )}
          </g>
        )}

        {hasGoal && !goalReached && (
          <g clipPath={`url(#${groundClipId})`}>
            <path
              d={pilePath(MAX_PILE_H)}
              fill="none"
              style={{ stroke: "var(--cvs-goal)" }}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
          </g>
        )}
        {hasGoal && !goalReached && (
          <text x={APEX_X + 14} y={goalApexY + 4} fontSize={11} fontWeight="700" style={{ fill: "var(--cvs-label)" }}>
            Goal
          </text>
        )}

        {/* The belt, drawn along +x in a frame turned to its incline. */}
        <g transform={`translate(${TAIL.x} ${TAIL.y}) rotate(${-BELT_ANGLE})`}>
          <path
            d={`M 0 ${trussTop} H ${BELT_L} M 0 ${trussBottom} H ${BELT_L} ${trussZigzag}`}
            fill="none"
            style={{ stroke: "var(--cvs-steel)" }}
            strokeWidth={1.5}
          />
          <path d={beltLoop} fill="none" style={{ stroke: "var(--cvs-belt)" }} strokeWidth={4} />
          <path
            className="cvs-belt"
            d={beltLoop}
            fill="none"
            style={{ stroke: "var(--cvs-belt-mark)" }}
            strokeWidth={1.5}
            strokeDasharray={`${BELT_DASH / 2} ${BELT_DASH / 2}`}
          />
          {carrying && (
            <>
              <clipPath id={loadClipId}>
                {/* Along the belt, then rounding over the head pulley so the load thins as it tips off. */}
                <path d={loadClip} />
              </clipPath>
              <g clipPath={`url(#${loadClipId})`}>
                <rect
                  x={0}
                  y={-PULLEY_R - 6}
                  width={BELT_L + LOAD_CAP_R}
                  height={5}
                  rx={2}
                  fill={shadeHex(materialColor, -0.4)}
                />
                <g className="cvs-load">
                  {Array.from({ length: Math.ceil(BELT_L / LOAD_PERIOD) + 2 }, (_, k) =>
                    LOAD_PEBBLES.map((p, i) => (
                      <SmallPebble
                        key={`${k}-${i}`}
                        {...p}
                        x={p.x + (k - 1) * LOAD_PERIOD}
                        scale={LOAD_SCALE}
                        color={materialColor}
                      />
                    )),
                  )}
                </g>
              </g>
            </>
          )}
          {/* Drive motor on the frame under the head pulley, square to the frame and covering its end. */}
          <rect
            x={BELT_L - 13}
            y={trussTop - 1}
            width={14}
            height={10}
            rx={2}
            style={{ fill: "var(--cvs-motor)", stroke: "var(--cvs-belt)" }}
            strokeWidth={1.5}
          />
          <g transform={`translate(${BELT_L} 0)`}>
            <circle r={PULLEY_R - 2} style={{ fill: "var(--cvs-pulley)" }} />
            <g className="cvs-spin">
              <path
                d={`M ${-(PULLEY_R - 3)} 0 H ${PULLEY_R - 3} M 0 ${-(PULLEY_R - 3)} V ${PULLEY_R - 3}`}
                style={{ stroke: "var(--cvs-pulley-mark)" }}
                strokeWidth={1.2}
              />
            </g>
            <circle r={1.5} style={{ fill: "var(--cvs-pulley-mark)" }} />
          </g>
        </g>

        {streaming &&
          FALL_STREAM.map((stone, i) => {
            const timing = {
              animationDuration: `${FALL_S}s`,
              animationDelay: `${(-(i * FALL_S) / FALL_STREAM.length).toFixed(2)}s`,
            };
            return (
              <g key={i} transform={`translate(${stone.start.x.toFixed(1)} ${stone.start.y.toFixed(1)})`}>
                <g
                  className="cvs-throw-x"
                  style={{ ...timing, "--carry": `${(stone.carry * THROW).toFixed(1)}px` } as CSSProperties}
                >
                  <g className="cvs-throw-y" style={timing}>
                    <g className="cvs-stream" style={timing}>
                      <SmallPebble
                        x={0}
                        y={0}
                        shape={PEBBLE_SHAPES[(i + 5) % PEBBLE_SHAPES.length]}
                        scale={stone.scale}
                        color={materialColor}
                      />
                    </g>
                  </g>
                </g>
              </g>
            );
          })}

        <rect
          x={APEX_X - (hasGoal ? 80 : 50)}
          y={BADGE_TOP}
          width={hasGoal ? 160 : 100}
          height={22}
          fill={goalReached ? GOAL_REACHED_FILL : LABEL_FILL}
          rx={3}
          opacity={0.95}
        />
        <text x={APEX_X} y={BADGE_TOP + 16} textAnchor="middle" fontSize={14} fontWeight="700" fill="#ffffff">
          {known ? `${formatM3(totalVolume)}${hasGoal ? ` / ${formatM3(goal)}` : ""} m³` : "—"}
        </text>
      </svg>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {[
          !produced
            ? "No production yet"
            : goalReached
              ? "Goal reached"
              : hasGoal && `${Math.floor(progress * 100)}% of goal`,
          beltSpeed === null ? "Belt —" : running ? `Conveying ${(volumeRate ?? 0).toFixed(0)} m³/h` : "Belt stopped",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}
