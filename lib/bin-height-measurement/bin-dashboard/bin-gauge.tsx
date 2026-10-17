"use client";

import { useId, type ReactNode } from "react";
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
  /** Solid is drawn opaque, liquid translucent with a bright surface, gas as a haze thinning upward. */
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

/** Gradient stops (top to bottom) for each kind of material. */
function materialStops(color: string, type: MaterialType) {
  switch (type) {
    case "liquid":
      return [
        { color, opacity: 0.8 },
        { color: shadeHex(color, -0.2), opacity: 0.92 },
      ];
    case "gas":
      return [
        { color: shadeHex(color, 0.2), opacity: 0.15 },
        { color, opacity: 0.55 },
      ];
    default:
      return [
        { color: shadeHex(color, 0.12), opacity: 1 },
        { color: shadeHex(color, -0.22), opacity: 1 },
      ];
  }
}

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
  const gradientId = `${useId()}-material`;

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

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${svgH}`} style={{ maxWidth: SVG_W }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            {materialStops(materialColor, materialType).map((stop, i) => (
              <stop key={i} offset={i === 0 ? "0%" : "100%"} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </linearGradient>
        </defs>

        {body}

        {currentFill > 0 && (
          <>
            <path d={buildFillPath(profile, fillTopY)} fill={`url(#${gradientId})`} />
            {materialType === "liquid" && (
              <line
                x1={CENTER_X - surfaceW / 2}
                y1={fillTopY}
                x2={CENTER_X + surfaceW / 2}
                y2={fillTopY}
                stroke={shadeHex(materialColor, 0.45)}
                strokeWidth={2.5}
              />
            )}
          </>
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
