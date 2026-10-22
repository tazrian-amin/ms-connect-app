/** The shapes a bin can be drawn as, picked when the bin is added. */
export const BIN_CATEGORIES = [
  { value: "basic-storage", label: "Basic storage", description: "Straight-walled container" },
  { value: "basic-trapezoid", label: "Basic trapezoid", description: "Walls that widen toward the base" },
  { value: "basic-hopper", label: "Basic bin hopper", description: "Tapers down to a discharge outlet" },
  { value: "industrial-hopper", label: "Industrial bin hopper", description: "Sectioned steel hopper" },
] as const;

export type BinCategory = (typeof BIN_CATEGORIES)[number]["value"];

/** What the bin holds, which sets how its material is drawn. */
export const MATERIAL_TYPES = [
  { value: "solid", label: "Solid" },
  { value: "liquid", label: "Liquid" },
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number]["value"];

export const DEFAULT_BIN_CATEGORY: BinCategory = BIN_CATEGORIES[0].value;
export const DEFAULT_MATERIAL_TYPE: MaterialType = MATERIAL_TYPES[0].value;

export function isBinCategory(value: unknown): value is BinCategory {
  return BIN_CATEGORIES.some((c) => c.value === value);
}

export function isMaterialType(value: unknown): value is MaterialType {
  return MATERIAL_TYPES.some((t) => t.value === value);
}
