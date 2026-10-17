/** Common mining materials and the colour each is drawn in, offered when picking a bin's material colour. */
export const MATERIAL_PRESETS = [
  { name: "Coal", color: "#3c3f44" },
  { name: "Iron ore", color: "#8b3a2b" },
  { name: "Copper ore", color: "#3f7f6b" },
  { name: "Limestone", color: "#c9c2b2" },
] as const;

/** Drawn when a bin has no colour picked: coal's cool charcoal. */
export const DEFAULT_MATERIAL_COLOR: string = MATERIAL_PRESETS[0].color;

/** Mixes a #rrggbb colour toward white (amount > 0) or black (amount < 0), amount in -1..1. */
export function shadeHex(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * t)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}
