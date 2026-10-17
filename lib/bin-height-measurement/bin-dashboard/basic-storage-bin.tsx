"use client";

import { BinGauge, CENTER_X, STROKE, type BinProps, type ProfilePoint } from "./bin-gauge";

const W = 220;
const PROFILE: ProfilePoint[] = [
  { y: 8, w: W },
  { y: 288, w: W },
];
const [TOP, BASE] = PROFILE;
const FOOT_H = 12;

/** A plain straight-walled container with a rim and feet. */
export function BasicStorageBin(props: BinProps) {
  const left = CENTER_X - W / 2;
  return (
    <BinGauge
      {...props}
      profile={PROFILE}
      bottomY={BASE.y + FOOT_H}
      body={
        <>
          <rect x={left} y={TOP.y} width={W} height={BASE.y - TOP.y} fill="#595959" fillOpacity={0.25} />
          {[0.1, 0.9].map((pos) => (
            <rect
              key={`foot-${pos}`}
              x={left + W * pos - 10}
              y={BASE.y}
              width={20}
              height={FOOT_H}
              fill="#616161"
              stroke={STROKE}
              strokeWidth={1}
            />
          ))}
        </>
      }
      overlay={
        <>
          <rect x={left} y={TOP.y} width={W} height={BASE.y - TOP.y} fill="none" stroke={STROKE} strokeWidth={2.5} />
          <rect x={left - 8} y={TOP.y - 4} width={W + 16} height={8} rx={2} fill="#757575" stroke={STROKE} strokeWidth={1.5} />
        </>
      }
    />
  );
}
