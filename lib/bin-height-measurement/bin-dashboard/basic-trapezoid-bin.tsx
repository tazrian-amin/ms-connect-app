"use client";

import { BinGauge, STROKE, trapezoid, type BinProps, type ProfilePoint } from "./bin-gauge";

const PROFILE: ProfilePoint[] = [
  { y: 8, w: 180 },
  { y: 288, w: 240 },
];
const [TOP, BASE] = PROFILE;

/** A bin whose walls widen toward the base, like a stockpile bunker. */
export function BasicTrapezoidBin(props: BinProps) {
  const outline = trapezoid(TOP, BASE);
  return (
    <BinGauge
      {...props}
      profile={PROFILE}
      body={<path d={outline} fill="#434343" fillOpacity={0.3} />}
      overlay={<path d={outline} fill="none" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />}
    />
  );
}
