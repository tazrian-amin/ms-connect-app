"use client";

import { useId } from "react";
import { DEFAULT_MATERIAL_COLOR, shadeHex } from "./material-colors";

export interface IndustrialBinHopperProps {
  /** 0–100, or null before any reading: the bin is drawn empty with no value. */
  fillLevel: number | null;
  /** Used with fillLevel to show "current load" (e.g. tons or ADC counts). */
  capacity: number;
  /** Label for the load derived from capacity (e.g. "counts" or "tons"). */
  loadUnitLabel?: string;
  /** #rrggbb colour the material is drawn in, shaded for depth from top to bottom. */
  materialColor?: string;
}

// zinc-500, legible against both light and dark card backgrounds; also the fill badge's background.
const LABEL_FILL = "#71717a";
const STROKE = "#424242";

const BODY_W = 300;
const LEFT_LABEL_GUTTER = 52;
const RIGHT_MARGIN = 20;
const SVG_W = LEFT_LABEL_GUTTER + BODY_W + RIGHT_MARGIN;
const CENTER_X = LEFT_LABEL_GUTTER + BODY_W / 2;

type ProfilePoint = { y: number; w: number };

/** The hopper's outline from top to discharge: its width at each joint between sections. */
const PROFILE: ProfilePoint[] = [
  { y: 8, w: BODY_W * 0.85 },
  { y: 68, w: BODY_W * 0.78 },
  { y: 148, w: BODY_W * 0.78 },
  { y: 228, w: BODY_W * 0.5 },
  { y: 288, w: BODY_W * 0.25 },
  { y: 318, w: BODY_W * 0.15 },
];
const [TOP, SECTION_1, SECTION_2] = PROFILE;
const TOP_Y = TOP.y;
const DISCHARGE_Y = PROFILE[PROFILE.length - 1].y;
const TOTAL_H = DISCHARGE_Y - TOP_Y;
const BADGE_TOP = DISCHARGE_Y + 8;
const SVG_H = BADGE_TOP + 30;

/** Trapezoid between two outline points, centred on the hopper. */
function trapezoid(top: ProfilePoint, bottom: ProfilePoint): string {
  return `M ${CENTER_X - top.w / 2} ${top.y} L ${CENTER_X + top.w / 2} ${top.y} L ${CENTER_X + bottom.w / 2} ${bottom.y} L ${CENTER_X - bottom.w / 2} ${bottom.y} Z`;
}

/** The hopper's width at height `y`, interpolated along the section it falls in. */
function widthAt(y: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1];
    const b = PROFILE[i];
    if (y <= b.y) return a.w + ((b.w - a.w) * (y - a.y)) / (b.y - a.y);
  }
  return PROFILE[PROFILE.length - 1].w;
}

/** Outline of material filled to `fillHeight` above the discharge, following the hopper's walls. */
function buildFillPath(fillHeight: number): string {
  const fillTopY = DISCHARGE_Y - fillHeight;
  const points = [{ y: fillTopY, w: widthAt(fillTopY) }, ...PROFILE.filter((p) => p.y > fillTopY)];
  const right = points.map((p) => `${CENTER_X + p.w / 2} ${p.y}`);
  const left = points.reverse().map((p) => `${CENTER_X - p.w / 2} ${p.y}`);
  return `M ${[...right, ...left].join(" L ")} Z`;
}

export function IndustrialBinHopper({
  fillLevel,
  capacity,
  loadUnitLabel = "tons",
  materialColor = DEFAULT_MATERIAL_COLOR,
}: IndustrialBinHopperProps) {
  const gradientId = useId();
  const metal = `url(#${gradientId}-metal)`;

  const known = fillLevel !== null;
  const currentFill = known ? Math.min(100, Math.max(0, fillLevel)) : 0;
  const currentAmount = known ? ((currentFill / 100) * capacity).toFixed(1) : "—";
  const fillHeight = (currentFill / 100) * TOTAL_H;

  // Drawn in this order so the beams sit on the top section and the rivets on the first middle one.
  const section = (i: number) => (
    <path
      d={trapezoid(PROFILE[i], PROFILE[i + 1])}
      // The discharge, the last section, is plain; the rest are sheet metal.
      fill={i === PROFILE.length - 2 ? "#757575" : metal}
      stroke={STROKE}
      strokeWidth={2.5}
    />
  );

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ maxWidth: SVG_W }}>
        <defs>
          <linearGradient id={`${gradientId}-material`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={shadeHex(materialColor, 0.12)} />
            <stop offset="100%" stopColor={shadeHex(materialColor, -0.22)} />
          </linearGradient>
          <linearGradient id={`${gradientId}-metal`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9e9e9e" stopOpacity={0.9} />
            <stop offset="50%" stopColor="#e0e0e0" />
            <stop offset="100%" stopColor="#757575" stopOpacity={0.9} />
          </linearGradient>
        </defs>

        {section(0)}
        {[0.3, 0.5, 0.7].map((pos) => (
          <rect
            key={`beam-${pos}`}
            x={CENTER_X - TOP.w / 2 + TOP.w * pos - 3}
            y={TOP_Y}
            width={6}
            height={SECTION_1.y - TOP_Y}
            fill="#616161"
            stroke={STROKE}
            strokeWidth={1}
          />
        ))}

        {section(1)}
        {[-1, 1].flatMap((side) =>
          Array.from({ length: 8 }, (_, i) => (
            <circle
              key={`rivet-${side}-${i}`}
              cx={CENTER_X + side * (SECTION_1.w / 2 - 10)}
              cy={SECTION_1.y + ((SECTION_2.y - SECTION_1.y) / 8) * i + 10}
              r={2}
              fill="#757575"
              stroke={STROKE}
              strokeWidth={0.5}
            />
          )),
        )}

        {section(2)}
        {section(3)}
        {section(4)}

        {fillHeight > 0 && <path d={buildFillPath(fillHeight)} fill={`url(#${gradientId}-material)`} />}

        {[25, 50, 75, 100].map((level) => {
          const y = DISCHARGE_Y - (level / 100) * TOTAL_H;
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

        <rect x={CENTER_X - 35} y={BADGE_TOP} width={70} height={22} fill={LABEL_FILL} rx={3} opacity={0.95} />
        <text x={CENTER_X} y={BADGE_TOP + 16} textAnchor="middle" fontSize={14} fontWeight="700" fill="#ffffff">
          {known ? `${Math.round(currentFill)}% Full` : "—"}
        </text>
      </svg>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {known ? `Load ≈ ${currentAmount} ${loadUnitLabel}` : "Load —"}
      </p>
    </div>
  );
}
