"use client";

import { useId, useMemo } from "react";

export interface IndustrialBinHopperProps {
  /** 0–100, or null before any reading: the bin is drawn empty with no value. */
  fillLevel: number | null;
  /** Used with fillLevel to show "current load" (e.g. tons or ADC counts). */
  capacity: number;
  width?: number;
  /** Label for the load derived from capacity (e.g. "counts" or "tons"). */
  loadUnitLabel?: string;
}

function clamp01(n: number) {
  return Math.min(100, Math.max(0, n));
}

function getFillBadgeColor(fill: number) {
  if (fill >= 80) return "#d32f2f";
  if (fill >= 50) return "#f57c00";
  if (fill >= 25) return "#388e3c";
  return "#1976d2";
}

// Bin material fill - cool charcoal, subtle top-to-bottom depth.
const MATERIAL_FILL_TOP = "#4a4d52";
const MATERIAL_FILL_BOTTOM = "#2e3034";
// zinc-500, legible against both light and dark card backgrounds.
const LABEL_FILL = "#71717a";

function buildFillPath(params: {
  hopperOffsetX: number;
  width: number;
  topY: number;
  section1Y: number;
  section2Y: number;
  section3Y: number;
  bottomY: number;
  dischargeY: number;
  topWidth: number;
  midTopWidth: number;
  midBottomWidth: number;
  bottomWidth: number;
  dischargeWidth: number;
  fillHeight: number;
}): string {
  const {
    hopperOffsetX,
    width,
    topY,
    section1Y,
    section2Y,
    section3Y,
    bottomY,
    dischargeY,
    topWidth,
    midTopWidth,
    midBottomWidth,
    bottomWidth,
    dischargeWidth,
    fillHeight,
  } = params;

  if (fillHeight <= 0) return "";

  const fillTopY = dischargeY - fillHeight;

  const getWidthAtY = (y: number) => {
    if (y >= dischargeY) return dischargeWidth;
    if (y >= bottomY) {
      const progress = (y - bottomY) / (dischargeY - bottomY);
      return bottomWidth + (dischargeWidth - bottomWidth) * progress;
    }
    if (y >= section3Y) {
      const progress = (y - section3Y) / (bottomY - section3Y);
      return midBottomWidth + (bottomWidth - midBottomWidth) * progress;
    }
    if (y >= section2Y) {
      const progress = (y - section2Y) / (section3Y - section2Y);
      return midTopWidth + (midBottomWidth - midTopWidth) * progress;
    }
    if (y >= section1Y) {
      return midTopWidth;
    }
    if (y >= topY) {
      const progress = (y - topY) / (section1Y - topY);
      return topWidth + (midTopWidth - topWidth) * progress;
    }
    return topWidth;
  };

  const fillTopWidth = getWidthAtY(fillTopY);

  let fillPath = `M ${hopperOffsetX + (width - fillTopWidth) / 2} ${fillTopY} `;
  fillPath += `L ${hopperOffsetX + (width + fillTopWidth) / 2} ${fillTopY} `;

  const segments = [
    { y: section1Y, w: midTopWidth },
    { y: section2Y, w: midTopWidth },
    { y: section3Y, w: midBottomWidth },
    { y: bottomY, w: bottomWidth },
    { y: dischargeY, w: dischargeWidth },
  ];

  for (const seg of segments) {
    if (seg.y > fillTopY) {
      fillPath += `L ${hopperOffsetX + (width + seg.w) / 2} ${seg.y} `;
    }
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg && seg.y > fillTopY) {
      fillPath += `L ${hopperOffsetX + (width - seg.w) / 2} ${seg.y} `;
    }
  }

  fillPath += "Z";
  return fillPath;
}

export function IndustrialBinHopper({
  fillLevel,
  capacity,
  width = 300,
  loadUnitLabel = "tons",
}: IndustrialBinHopperProps) {
  const gradientId = useId();

  const LEFT_LABEL_GUTTER = 52;
  const RIGHT_MARGIN = 20;
  const bodyW = Math.max(200, width);
  const svgWidth = LEFT_LABEL_GUTTER + bodyW + RIGHT_MARGIN;
  const hopperOffsetX = LEFT_LABEL_GUTTER;

  const known = fillLevel !== null;
  const currentFill = known ? clamp01(fillLevel) : 0;
  const badgeColor = known ? getFillBadgeColor(currentFill) : LABEL_FILL;
  const currentAmount = known ? ((currentFill / 100) * capacity).toFixed(1) : "—";

  const topWidth = bodyW * 0.85;
  const midTopWidth = bodyW * 0.78;
  const midBottomWidth = bodyW * 0.5;
  const bottomWidth = bodyW * 0.25;
  const dischargeWidth = bodyW * 0.15;

  const topY = 8;
  const section1Y = 68;
  const section2Y = 148;
  const section3Y = 228;
  const bottomY = 288;
  const dischargeY = 318;

  const totalHeight = dischargeY - topY;
  const badgeTop = dischargeY + 8;
  const svgCanvasHeight = badgeTop + 30;
  const fillHeight = (currentFill / 100) * totalHeight;

  const fillPath = useMemo(
    () =>
      buildFillPath({
        hopperOffsetX,
        width: bodyW,
        topY,
        section1Y,
        section2Y,
        section3Y,
        bottomY,
        dischargeY,
        topWidth,
        midTopWidth,
        midBottomWidth,
        bottomWidth,
        dischargeWidth,
        fillHeight,
      }),
    [
      hopperOffsetX,
      bodyW,
      topY,
      section1Y,
      section2Y,
      section3Y,
      bottomY,
      dischargeY,
      topWidth,
      midTopWidth,
      midBottomWidth,
      bottomWidth,
      dischargeWidth,
      fillHeight,
    ],
  );

  const ox = hopperOffsetX;

  return (
    <div className="flex flex-col items-center">
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgCanvasHeight}`}
        style={{ maxWidth: svgWidth }}
      >
        <defs>
          <linearGradient id={`${gradientId}-material`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={MATERIAL_FILL_TOP} stopOpacity={1} />
            <stop offset="100%" stopColor={MATERIAL_FILL_BOTTOM} stopOpacity={1} />
          </linearGradient>
          <linearGradient id={`${gradientId}-metal`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9e9e9e" stopOpacity={0.9} />
            <stop offset="50%" stopColor="#e0e0e0" stopOpacity={1} />
            <stop offset="100%" stopColor="#757575" stopOpacity={0.9} />
          </linearGradient>
        </defs>

        {/* Top section */}
        <path
          d={`M ${ox + (bodyW - topWidth) / 2} ${topY} L ${ox + (bodyW + topWidth) / 2} ${topY} L ${ox + (bodyW + midTopWidth) / 2} ${section1Y} L ${ox + (bodyW - midTopWidth) / 2} ${section1Y} Z`}
          fill={`url(#${gradientId}-metal)`}
          stroke="#424242"
          strokeWidth={2.5}
        />

        {[0.3, 0.5, 0.7].map((pos) => (
          <rect
            key={`beam-${pos}`}
            x={ox + (bodyW - topWidth) / 2 + topWidth * pos - 3}
            y={topY}
            width={6}
            height={section1Y - topY}
            fill="#616161"
            stroke="#424242"
            strokeWidth={1}
          />
        ))}

        {/* Middle 1 */}
        <path
          d={`M ${ox + (bodyW - midTopWidth) / 2} ${section1Y} L ${ox + (bodyW + midTopWidth) / 2} ${section1Y} L ${ox + (bodyW + midTopWidth) / 2} ${section2Y} L ${ox + (bodyW - midTopWidth) / 2} ${section2Y} Z`}
          fill={`url(#${gradientId}-metal)`}
          stroke="#424242"
          strokeWidth={2.5}
        />

        {Array.from({ length: 8 }).map((_, i) => (
          <circle
            key={`r1-${i}`}
            cx={ox + (bodyW - midTopWidth) / 2 + 10}
            cy={section1Y + ((section2Y - section1Y) / 8) * i + 10}
            r={2}
            fill="#757575"
            stroke="#424242"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <circle
            key={`r2-${i}`}
            cx={ox + (bodyW + midTopWidth) / 2 - 10}
            cy={section1Y + ((section2Y - section1Y) / 8) * i + 10}
            r={2}
            fill="#757575"
            stroke="#424242"
            strokeWidth={0.5}
          />
        ))}

        {/* Middle 2 */}
        <path
          d={`M ${ox + (bodyW - midTopWidth) / 2} ${section2Y} L ${ox + (bodyW + midTopWidth) / 2} ${section2Y} L ${ox + (bodyW + midBottomWidth) / 2} ${section3Y} L ${ox + (bodyW - midBottomWidth) / 2} ${section3Y} Z`}
          fill={`url(#${gradientId}-metal)`}
          stroke="#424242"
          strokeWidth={2.5}
        />

        {/* Bottom funnel */}
        <path
          d={`M ${ox + (bodyW - midBottomWidth) / 2} ${section3Y} L ${ox + (bodyW + midBottomWidth) / 2} ${section3Y} L ${ox + (bodyW + bottomWidth) / 2} ${bottomY} L ${ox + (bodyW - bottomWidth) / 2} ${bottomY} Z`}
          fill={`url(#${gradientId}-metal)`}
          stroke="#424242"
          strokeWidth={2.5}
        />

        {/* Discharge */}
        <path
          d={`M ${ox + (bodyW - bottomWidth) / 2} ${bottomY} L ${ox + (bodyW + bottomWidth) / 2} ${bottomY} L ${ox + (bodyW + dischargeWidth) / 2} ${dischargeY} L ${ox + (bodyW - dischargeWidth) / 2} ${dischargeY} Z`}
          fill="#757575"
          stroke="#424242"
          strokeWidth={2.5}
        />

        {fillPath.length > 0 ? (
          <path d={fillPath} fill={`url(#${gradientId}-material)`} />
        ) : null}

        {[25, 50, 75, 100].map((level) => {
          const y = dischargeY - (level / 100) * totalHeight;
          const textLeft = 10;
          const lineStartX = hopperOffsetX - 10;
          return (
            <g key={`lvl-${level}`}>
              <text
                x={textLeft}
                y={y + 4}
                fontSize={11}
                fontWeight="700"
                fill={LABEL_FILL}
                textAnchor="start"
              >
                {`${level}%`}
              </text>
              <line
                x1={lineStartX}
                y1={y}
                x2={lineStartX + 20}
                y2={y}
                stroke="#616161"
                strokeWidth={1.5}
                strokeDasharray="4,2"
              />
            </g>
          );
        })}

        <rect
          x={ox + bodyW / 2 - 35}
          y={badgeTop}
          width={70}
          height={22}
          fill={badgeColor}
          rx={3}
          opacity={0.95}
        />
        <text
          x={ox + bodyW / 2}
          y={badgeTop + 16}
          textAnchor="middle"
          fontSize={14}
          fontWeight="700"
          fill="#ffffff"
        >
          {known ? `${Math.round(currentFill)}% Full` : "—"}
        </text>
      </svg>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {known ? `Load ≈ ${currentAmount} ${loadUnitLabel}` : "Load —"}
      </p>
    </div>
  );
}
