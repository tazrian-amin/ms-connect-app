"use client";

import { BinGauge, CENTER_X, STROKE, trapezoid, type BinProps, type ProfilePoint } from "./bin-gauge";

const PROFILE: ProfilePoint[] = [
  { y: 8, w: 240 },
  { y: 268, w: 100 },
];
const [TOP, BASE] = PROFILE;
const OUTLET_W = 56;
const OUTLET_H = 22;

/** A hopper tapering from a wide mouth down to a discharge outlet. */
export function BasicBinHopper(props: BinProps) {
  const outline = trapezoid(TOP, BASE);
  return (
    <BinGauge
      {...props}
      profile={PROFILE}
      bottomY={BASE.y + OUTLET_H}
      body={
        <>
          <path d={outline} fill="#434343" fillOpacity={0.3} />
          <rect
            x={CENTER_X - OUTLET_W / 2}
            y={BASE.y}
            width={OUTLET_W}
            height={OUTLET_H}
            fill="#424242"
            stroke="#616161"
            strokeWidth={2}
          />
        </>
      }
      overlay={<path d={outline} fill="none" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />}
    />
  );
}
