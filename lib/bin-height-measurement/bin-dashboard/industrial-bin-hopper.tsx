"use client";

import { useId } from "react";
import { BODY_W, BinGauge, CENTER_X, STROKE, trapezoid, type BinProps, type ProfilePoint } from "./bin-gauge";

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

/** A sectioned steel hopper with roof beams and riveted walls, narrowing to a discharge. */
export function IndustrialBinHopper(props: BinProps) {
  const metalId = `${useId()}-metal`;
  const metal = `url(#${metalId})`;

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
    <BinGauge
      {...props}
      profile={PROFILE}
      body={
        <>
          <defs>
            <linearGradient id={metalId} x1="0%" y1="0%" x2="100%" y2="0%">
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
              y={TOP.y}
              width={6}
              height={SECTION_1.y - TOP.y}
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
        </>
      }
    />
  );
}
