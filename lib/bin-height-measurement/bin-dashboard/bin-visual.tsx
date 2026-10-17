"use client";

import type { ComponentType } from "react";
import { BasicBinHopper } from "./basic-bin-hopper";
import { BasicStorageBin } from "./basic-storage-bin";
import { BasicTrapezoidBin } from "./basic-trapezoid-bin";
import type { BinCategory } from "./bin-categories";
import type { BinProps } from "./bin-gauge";
import { IndustrialBinHopper } from "./industrial-bin-hopper";

const drawings: Record<BinCategory, ComponentType<BinProps>> = {
  "basic-storage": BasicStorageBin,
  "basic-trapezoid": BasicTrapezoidBin,
  "basic-hopper": BasicBinHopper,
  "industrial-hopper": IndustrialBinHopper,
};

/** Draws a bin in the shape of its category. */
export function BinVisual({ category, ...props }: BinProps & { category: BinCategory }) {
  const Drawing = drawings[category];
  return <Drawing {...props} />;
}
