"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { Pebble, PebblePattern, pebblesAlong } from "@/lib/pebbles";
import { DEFAULT_MATERIAL_TYPE, type MaterialType } from "./bin-categories";
import { DEFAULT_MATERIAL_COLOR, shadeHex } from "./material-colors";

/** Props every bin drawing takes. */
export interface BinProps {
  /** 0–100, or null before any reading: the bin is drawn empty with no value. */
  fillLevel: number | null;
  /** Used with fillLevel to show "current load" (e.g. tons or ADC counts). */
  capacity: number;
  /** Label for the load derived from capacity (e.g. "counts" or "tons"). */
  loadUnitLabel?: string;
  /** #rrggbb colour the material is drawn in, shaded for depth from top to bottom. */
  materialColor?: string;
  /** Solid is drawn as packed pebbles, liquid as translucent rippling liquid with rising bubbles. */
  materialType?: MaterialType;
}

// zinc-500, legible against both light and dark card backgrounds; also the fill badge's background.
const LABEL_FILL = "#71717a";
export const STROKE = "#424242";

export const BODY_W = 300;
const LEFT_LABEL_GUTTER = 52;
const RIGHT_MARGIN = 20;
const SVG_W = LEFT_LABEL_GUTTER + BODY_W + RIGHT_MARGIN;
export const CENTER_X = LEFT_LABEL_GUTTER + BODY_W / 2;

export type ProfilePoint = { y: number; w: number };

/** Trapezoid between two outline points, centred on the bin. */
export function trapezoid(top: ProfilePoint, bottom: ProfilePoint): string {
  return `M ${CENTER_X - top.w / 2} ${top.y} L ${CENTER_X + top.w / 2} ${top.y} L ${CENTER_X + bottom.w / 2} ${bottom.y} L ${CENTER_X - bottom.w / 2} ${bottom.y} Z`;
}

/** The bin's width at height `y`, interpolated along the section of `profile` it falls in. */
function widthAt(profile: ProfilePoint[], y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (y <= b.y) return a.w + ((b.w - a.w) * (y - a.y)) / (b.y - a.y);
  }
  return profile[profile.length - 1].w;
}

/** Outline of material up to `fillTopY`, following the walls of `profile` down to its bottom. */
function buildFillPath(profile: ProfilePoint[], fillTopY: number): string {
  const points = [{ y: fillTopY, w: widthAt(profile, fillTopY) }, ...profile.filter((p) => p.y > fillTopY)];
  const right = points.map((p) => `${CENTER_X + p.w / 2} ${p.y}`);
  const left = points.reverse().map((p) => `${CENTER_X - p.w / 2} ${p.y}`);
  return `M ${[...right, ...left].join(" L ")} Z`;
}

/** Gradient stops (top to bottom) for each kind of material; for solids, the shadow between the pebbles. */
function materialStops(color: string, type: MaterialType) {
  switch (type) {
    case "liquid":
      return [
        { color, opacity: 0.8 },
        { color: shadeHex(color, -0.2), opacity: 0.92 },
      ];
    default:
      return [
        { color: shadeHex(color, -0.35), opacity: 1 },
        { color: shadeHex(color, -0.55), opacity: 1 },
      ];
  }
}

const WAVE_LENGTH = 48;
const WAVE_AMPLITUDE = 3;
const WAVE_LEFT = CENTER_X - BODY_W / 2 - WAVE_LENGTH;
const WAVE_COUNT = Math.ceil((BODY_W + 2 * WAVE_LENGTH) / WAVE_LENGTH);

/**
 * A liquid's rippled surface at `y`, one wavelength wider than the bin on each side so it can
 * slide sideways by a wavelength and loop without its ends showing.
 */
function waveCrestPath(y: number): string {
  const half = WAVE_LENGTH / 2;
  return `M ${WAVE_LEFT} ${y}${` q ${half / 2} ${-WAVE_AMPLITUDE} ${half} 0 t ${half} 0`.repeat(WAVE_COUNT)}`;
}

/** The liquid body under a rippled surface at `y`, down past `bottomY`. */
function waveFillPath(y: number, bottomY: number): string {
  const right = WAVE_LEFT + WAVE_COUNT * WAVE_LENGTH;
  return `${waveCrestPath(y)} L ${right} ${bottomY} L ${WAVE_LEFT} ${bottomY} Z`;
}

/** Bubbles rising through a liquid: across the narrowest width (-1 to 1), size, and timing. */
const BUBBLES = [
  { x: -0.55, r: 2, pace: 1, delay: 0 },
  { x: 0.15, r: 1.4, pace: 1.3, delay: 1.2 },
  { x: 0.6, r: 2.4, pace: 0.9, delay: 2.1 },
  { x: -0.1, r: 1.2, pace: 1.15, delay: 0.6 },
  { x: 0.35, r: 1.7, pace: 1.05, delay: 3 },
];

const LIQUID_MOTION_CSS = `
@keyframes bin-wave { to { transform: translateX(-${WAVE_LENGTH}px); } }
@keyframes bin-wave-back { from { transform: translateX(-${WAVE_LENGTH}px); } to { transform: translateX(0); } }
@keyframes bin-bubble {
  0% { transform: translateY(0); opacity: 0; }
  15%, 85% { opacity: 0.7; }
  100% { transform: translateY(var(--rise)); opacity: 0; }
}
.bin-wave { animation: bin-wave 4s linear infinite; }
.bin-wave-back { animation: bin-wave-back 6.5s linear infinite; }
.bin-bubble { opacity: 0; animation: bin-bubble 3s ease-in infinite; }
@media (prefers-reduced-motion: reduce) {
  .bin-wave, .bin-wave-back, .bin-bubble { animation: none; }
}
`;

type BinGaugeProps = BinProps & {
  /** The inside of the bin from its top (100%) to its bottom (0%): its width at each joint. */
  profile: ProfilePoint[];
  /** Drawn behind the material, e.g. the walls. */
  body: ReactNode;
  /** Drawn over the material, e.g. an outline that should stay crisp. */
  overlay?: ReactNode;
  /** Lowest point of the drawing, e.g. below an outlet; the bottom of `profile` when left out. */
  bottomY?: number;
};

/**
 * Frame shared by the bin drawings: the material filled to the reading along the bin's walls,
 * percentage markers, a fill badge and the load below. Each bin supplies its outline and walls.
 */
export function BinGauge({
  fillLevel,
  capacity,
  loadUnitLabel = "tons",
  materialColor = DEFAULT_MATERIAL_COLOR,
  materialType = DEFAULT_MATERIAL_TYPE,
  profile,
  body,
  overlay,
  bottomY,
}: BinGaugeProps) {
  const uid = useId();
  const gradientId = `${uid}-material`;
  const shadeId = `${uid}-shade`;
  const pebblesId = `${uid}-pebbles`;
  const interiorId = `${uid}-interior`;

  const topY = profile[0].y;
  const baseY = profile[profile.length - 1].y;
  const totalH = baseY - topY;
  const badgeTop = (bottomY ?? baseY) + 8;
  const svgH = badgeTop + 30;

  const known = fillLevel !== null;
  const currentFill = known ? Math.min(100, Math.max(0, fillLevel)) : 0;
  const currentAmount = known ? ((currentFill / 100) * capacity).toFixed(1) : "—";
  const fillTopY = baseY - (currentFill / 100) * totalH;
  const surfaceW = widthAt(profile, fillTopY);
  const fillPath = buildFillPath(profile, fillTopY);
  const liquidDepth = baseY - fillTopY;
  const narrowestW = Math.min(surfaceW, ...profile.filter((p) => p.y > fillTopY).map((p) => p.w));

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${svgH}`} style={{ maxWidth: SVG_W }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            {materialStops(materialColor, materialType).map((stop, i) => (
              <stop key={i} offset={i === 0 ? "0%" : "100%"} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </linearGradient>
          <clipPath id={interiorId}>
            <path d={buildFillPath(profile, topY)} />
          </clipPath>
          {materialType === "solid" && (
            <>
              <linearGradient id={shadeId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.06} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0.3} />
              </linearGradient>
              <PebblePattern id={pebblesId} color={materialColor} />
            </>
          )}
        </defs>
        {materialType === "liquid" && <style>{LIQUID_MOTION_CSS}</style>}

        {body}

        {currentFill > 0 && materialType === "solid" && (
          <g clipPath={`url(#${interiorId})`}>
            <path d={fillPath} fill={`url(#${gradientId})`} />
            <path d={fillPath} fill={`url(#${pebblesId})`} />
            <path d={fillPath} fill={`url(#${shadeId})`} />
            {pebblesAlong({ x: CENTER_X - surfaceW / 2, y: fillTopY }, { x: CENTER_X + surfaceW / 2, y: fillTopY }).map(
              (p, i) => (
                <Pebble key={i} {...p} color={materialColor} />
              ),
            )}
          </g>
        )}

        {currentFill > 0 && materialType === "liquid" && (
          <g clipPath={`url(#${interiorId})`}>
            <g className="bin-wave-back">
              <path d={waveFillPath(fillTopY - 2, baseY + 4)} fill={shadeHex(materialColor, -0.25)} fillOpacity={0.5} />
            </g>
            <g className="bin-wave">
              <path d={waveFillPath(fillTopY, baseY + 4)} fill={`url(#${gradientId})`} />
              <path d={waveCrestPath(fillTopY)} fill="none" stroke={shadeHex(materialColor, 0.45)} strokeWidth={2} />
            </g>
            {liquidDepth > 24 &&
              BUBBLES.map((b, i) => (
                <circle
                  key={i}
                  className="bin-bubble"
                  cx={CENTER_X + (b.x * narrowestW) / 2}
                  cy={baseY - 4}
                  r={b.r}
                  fill="none"
                  stroke={shadeHex(materialColor, 0.6)}
                  strokeWidth={0.8}
                  style={
                    {
                      "--rise": `${-(liquidDepth - 10)}px`,
                      animationDuration: `${Math.max(1.5, (b.pace * liquidDepth) / 40).toFixed(1)}s`,
                      animationDelay: `${b.delay}s`,
                    } as CSSProperties
                  }
                />
              ))}
          </g>
        )}

        {overlay}

        {[25, 50, 75, 100].map((level) => {
          const y = baseY - (level / 100) * totalH;
          return (
            <g key={`lvl-${level}`}>
              <text x={10} y={y + 4} fontSize={11} fontWeight="700" fill={LABEL_FILL}>
                {`${level}%`}
              </text>
              <line
                x1={LEFT_LABEL_GUTTER - 10}
                y1={y}
                x2={LEFT_LABEL_GUTTER + 10}
                y2={y}
                stroke="#616161"
                strokeWidth={1.5}
                strokeDasharray="4,2"
              />
            </g>
          );
        })}

        <rect x={CENTER_X - 35} y={badgeTop} width={70} height={22} fill={LABEL_FILL} rx={3} opacity={0.95} />
        <text x={CENTER_X} y={badgeTop + 16} textAnchor="middle" fontSize={14} fontWeight="700" fill="#ffffff">
          {known ? `${Math.round(currentFill)}% Full` : "—"}
        </text>
      </svg>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {known ? `Load ≈ ${currentAmount} ${loadUnitLabel}` : "Load —"}
      </p>
    </div>
  );
}
