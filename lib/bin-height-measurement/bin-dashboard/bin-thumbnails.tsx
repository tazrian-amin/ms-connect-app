import type { ReactNode } from "react";
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import type { BinCategory } from "./bin-categories";

/*
 * Icon-sized outlines of each bin drawing, partly filled, to show what a category looks like
 * before it is picked. Traced from the drawings' profiles onto a 24×24 grid.
 */

const OUTLINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" } as const;
const MATERIAL = { fill: "currentColor", fillOpacity: 0.35, stroke: "none" } as const;
const JOINT = { fill: "none", stroke: "currentColor", strokeWidth: 1 } as const;

const shapes: Record<BinCategory, ReactNode> = {
  "basic-storage": (
    <>
      <rect x={4} y={11.5} width={16} height={8} {...MATERIAL} />
      <rect x={4} y={4.5} width={16} height={15} {...OUTLINE} />
      <rect x={2.75} y={3} width={18.5} height={1.5} rx={0.5} fill="currentColor" />
      <rect x={5.5} y={19.5} width={2.5} height={2} fill="currentColor" />
      <rect x={16} y={19.5} width={2.5} height={2} fill="currentColor" />
    </>
  ),
  "basic-trapezoid": (
    <>
      <path d="M5.5 12 L18.5 12 L20 20 L4 20 Z" {...MATERIAL} />
      <path d="M7 4 L17 4 L20 20 L4 20 Z" {...OUTLINE} />
    </>
  ),
  "basic-hopper": (
    <>
      <path d="M6 11 L18 11 L15.5 17 L8.5 17 Z" {...MATERIAL} />
      <path d="M3 4 L21 4 L15.5 17 L8.5 17 Z" {...OUTLINE} />
      <rect x={10} y={17} width={4} height={3.5} fill="currentColor" />
    </>
  ),
  "industrial-hopper": (
    <>
      <path d="M5.3 13 L18.7 13 L17 15.8 L14.5 19.3 L13.5 21 L10.5 21 L9.5 19.3 L7 15.8 Z" {...MATERIAL} />
      <path
        d="M3.5 3 L20.5 3 L19.8 6.5 L19.8 11.1 L17 15.8 L14.5 19.3 L13.5 21 L10.5 21 L9.5 19.3 L7 15.8 L4.2 11.1 L4.2 6.5 Z"
        {...OUTLINE}
      />
      <path d="M4.2 6.5 H19.8 M4.2 11.1 H19.8 M7 15.8 H17" {...JOINT} />
      <path d="M9 3 V6.5 M12 3 V6.5 M15 3 V6.5" {...JOINT} />
    </>
  ),
};

/** A small picture of what a bin of `category` looks like. */
export function BinThumbnail({ category, ...props }: SvgIconProps & { category: BinCategory }) {
  return <SvgIcon {...props}>{shapes[category]}</SvgIcon>;
}
