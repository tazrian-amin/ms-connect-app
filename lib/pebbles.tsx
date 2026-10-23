import { shadeHex } from "@/lib/bin-height-measurement/bin-dashboard/material-colors";

/*
 * Stones for drawing solid material such as ore or aggregate in SVG: a tiling pattern of packed
 * pebbles for its body and rows of loose pebbles for its surface. Placement is seeded, so the same
 * stones are drawn on every render.
 */

/** Deterministic pseudo-random numbers in [0, 1), so pebbles land in the same places on every render. */
export function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PebbleShape = { d: string; r: number; tone: number };
export type PlacedPebble = { x: number; y: number; shape: PebbleShape };

/** A rounded, irregular stone of radius about `r` around the origin, shaded lighter or darker by `tone`. */
function pebbleShape(r: number, rand: () => number): PebbleShape {
  const n = 7;
  const squash = 0.7 + rand() * 0.25;
  const tilt = rand() * Math.PI;
  const points = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI + (rand() - 0.5) * 0.5;
    const radius = r * (0.8 + rand() * 0.25);
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius * squash;
    return [px * Math.cos(tilt) - py * Math.sin(tilt), px * Math.sin(tilt) + py * Math.cos(tilt)];
  });
  // Curving through the corners between edge midpoints rounds the outline off like a worn stone.
  const fmt = ([x, y]: number[]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M ${fmt(mid(points[n - 1], points[0]))}`;
  points.forEach((p, i) => {
    d += ` Q ${fmt(p)} ${fmt(mid(p, points[(i + 1) % n]))}`;
  });
  return { d: `${d} Z`, r, tone: -0.25 + rand() * 0.4 };
}

export const PEBBLE_SHAPES = (() => {
  const rand = seededRandom(7);
  return Array.from({ length: 12 }, () => pebbleShape(5.5 + rand() * 2.5, rand));
})();

const PEBBLE_TILE = { w: 60, h: 48 };

/** Pebbles packed into one tile of the solid fill pattern, staggered by row like settled stones. */
const TILE_PEBBLES: PlacedPebble[] = (() => {
  const rand = seededRandom(11);
  const cols = 5;
  const rows = 4;
  const cellW = PEBBLE_TILE.w / cols;
  const cellH = PEBBLE_TILE.h / rows;
  const placed: PlacedPebble[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      placed.push({
        x: (col + 0.5 + (row % 2) * 0.5) * cellW + (rand() - 0.5) * 4,
        y: (row + 0.5) * cellH + (rand() - 0.5) * 4,
        shape: PEBBLE_SHAPES[(row * cols + col) % PEBBLE_SHAPES.length],
      });
    }
  }
  // Pebbles crossing the tile's edge are repeated on the opposite side so the tiling has no seams.
  const offsets = [-1, 0, 1];
  return placed
    .flatMap((p) =>
      offsets.flatMap((i) =>
        offsets.map((j) => ({
          ...p,
          x: p.x + i * PEBBLE_TILE.w,
          y: p.y + j * PEBBLE_TILE.h,
        })),
      ),
    )
    .filter(
      (p) =>
        p.x + p.shape.r > 0 &&
        p.x - p.shape.r < PEBBLE_TILE.w &&
        p.y + p.shape.r > 0 &&
        p.y - p.shape.r < PEBBLE_TILE.h,
    );
})();

/**
 * A row of pebbles resting along the edge from `from` to `to`, sunk slightly into the material
 * below it, so a surface looks heaped rather than cut flat.
 */
export function pebblesAlong(
  from: { x: number; y: number },
  to: { x: number; y: number },
  seed = 23,
  /** Size of the stones to be drawn, as a share of full-size pebbles; spacing shrinks to match. */
  scale = 1,
): PlacedPebble[] {
  const rand = seededRandom(seed);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const pebbles: PlacedPebble[] = [];
  for (let d = 0; d < length + 6 * scale; d += (9 + rand() * 4) * scale) {
    const t = d / length;
    pebbles.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t + (1 + rand() * 3) * scale,
      shape: PEBBLE_SHAPES[pebbles.length % PEBBLE_SHAPES.length],
    });
  }
  return pebbles;
}

export function Pebble({ x, y, shape, color }: PlacedPebble & { color: string }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <path d={shape.d} fill={shadeHex(color, shape.tone)} stroke={shadeHex(color, -0.45)} strokeWidth={0.6} />
      <ellipse
        cx={-shape.r * 0.3}
        cy={-shape.r * 0.35}
        rx={shape.r * 0.4}
        ry={shape.r * 0.22}
        fill="#ffffff"
        fillOpacity={0.16}
      />
    </g>
  );
}

/** A tiling pattern of packed pebbles in shades of `color`, to fill a solid material's outline with. */
export function PebblePattern({ id, color, scale = 1 }: { id: string; color: string; scale?: number }) {
  return (
    <pattern
      id={id}
      width={PEBBLE_TILE.w}
      height={PEBBLE_TILE.h}
      patternUnits="userSpaceOnUse"
      patternTransform={scale === 1 ? undefined : `scale(${scale})`}
    >
      {TILE_PEBBLES.map((p, i) => (
        <Pebble key={i} {...p} color={color} />
      ))}
    </pattern>
  );
}
