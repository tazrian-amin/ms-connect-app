"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";

type DischargeFlowGaugeProps = {
  /** US gal/min leaving the pipe, or null before any reading. */
  flowRate: number | null;
  /** Flow in US gal/min that fills the pipe's bore and throws the jet furthest. */
  fullScale: number;
};

const SVG_W = 400;
const VIEW_TOP = 40;

const PIPE_Y = 78;
const PIPE_R = 20;
const BORE_R = 15;
/** The flange face the water leaves from. */
const OUT_X = 172;
const FLANGE_W = 10;
const FLANGE_R = 26;
/** Where the pipe's stand meets it. */
const PIPE_STAND_X = 64;

/** The paddle wheel, tucked under the outlet so the jet strikes its upper right side, as in a turbine meter. */
const WHEEL = { x: 196, y: 150 };
const HUB_R = 8;
/** The inner and outer rims, with the paddles between them. */
const RIM_R = 28;
const TIP_R = 42;
const PADDLES = 10;
const SPOKES = 6;

const GROUND_Y = 214;
/** Water surface in the discharge channel, where the jet lands. */
const CHANNEL_Y = 224;
const CHANNEL_LEFT = 128;
const EARTH_BOTTOM = 248;
const BADGE_TOP = EARTH_BOTTOM + 10;
const METER_Y = BADGE_TOP + 36;
const METER = { left: 70, right: 330 };
const SVG_H = METER_Y + 24;

/** How fast the wheel turns at full scale, in degrees per second. */
const MAX_SPIN_DEG_PER_S = 540;
/** How fast the streaks in the jet run, in drawing units per second, at no flow and at full scale. */
const STREAK_SPEED = { min: 40, max: 260 };
/** Smallest share of full scale drawn while there is any flow, so a trickle still shows. */
const MIN_VISIBLE = 0.04;
/** How quickly the drawing catches up with a new reading, per second. */
const EASE_RATE = 2.5;
/**
 * Waves on the channel where the jet lands: their height at no flow and at full scale, wavelength, how far
 * they carry and how wide the calm patch under the jet is (drawing units), how fast they run (radians per
 * second), and how finely the surface is sampled.
 */
const WAVE = { minHeight: 0.6, maxHeight: 2.6, length: 22, decay: 80, calm: 6, speed: 9, step: 4 };
/** Behind the white reading, in both themes. */
const BADGE_FILL = "#0369a1";

/*
 * Scene colours for light and dark themes (MUI puts the "dark" class on <html>). The water keeps
 * one bright blue that reads on both backgrounds; the steel and earth around it are set back from it.
 */
const SCENE_CSS = `
.dwf {
  --dwf-pipe: #52525b; --dwf-pipe-edge: #3f3f46; --dwf-bore: #27272a;
  --dwf-steel: #a1a1aa; --dwf-wheel: #52525b; --dwf-paddle: #3f3f46; --dwf-axle: #e4e4e7;
  --dwf-earth: #e4ddd3; --dwf-earth-edge: #a8a29e;
  --dwf-water: #38bdf8; --dwf-water-deep: #0ea5e9; --dwf-water-edge: #0284c7; --dwf-streak: #e0f2fe;
  --dwf-meter-track: #e4e4e7; --dwf-label: #71717a;
}
:root.dark .dwf {
  --dwf-pipe: #71717a; --dwf-pipe-edge: #a1a1aa; --dwf-bore: #18181b;
  --dwf-steel: #52525b; --dwf-wheel: #71717a; --dwf-paddle: #a1a1aa; --dwf-axle: #27272a;
  --dwf-earth: #2c2926; --dwf-earth-edge: #57534e;
  --dwf-water: #38bdf8; --dwf-water-deep: #0369a1; --dwf-water-edge: #7dd3fc; --dwf-streak: #e0f2fe;
  --dwf-meter-track: #3f3f46; --dwf-label: #a1a1aa;
}
@keyframes dwf-ripple { from { transform: scale(0.3); opacity: 0.9; } to { transform: scale(1.6); opacity: 0; } }
@keyframes dwf-spray {
  from { transform: translate(0, 0); opacity: 1; }
  to { transform: translate(var(--dx), var(--dy)); opacity: 0; }
}
.dwf-ripple { transform-box: fill-box; transform-origin: center; animation: dwf-ripple 1.4s ease-out infinite; }
.dwf-spray { animation: dwf-spray 0.7s ease-out infinite; }
.dwf-dry .dwf-ripple, .dwf-dry .dwf-spray { display: none; }
@media (prefers-reduced-motion: reduce) {
  .dwf-ripple, .dwf-spray { animation: none; }
}
`;

/** Droplets flung off the paddles where the jet strikes: offset from the wheel's centre, then which way they fly. */
const SPRAY = [
  { x: 22, y: -34, dx: 14, dy: -12, delay: 0 },
  { x: 30, y: -26, dx: 18, dy: -6, delay: 0.18 },
  { x: 14, y: -40, dx: 6, dy: -14, delay: 0.35 },
  { x: 36, y: -16, dx: 16, dy: 2, delay: 0.5 },
  { x: 26, y: -32, dx: 10, dy: -16, delay: 0.62 },
];

type JetShape = {
  /** Outline of the jet, from the outlet to where it lands in the channel. */
  body: string;
  /** Its centre line, along which the streaks run. */
  centre: string;
  streakWidth: number;
  /** Middle of where it lands. */
  landX: number;
};

/** A parabola that leaves the outlet level at `y0` and lands `reach` further on at the channel: a quadratic Bézier exactly. */
function arc(y0: number, reach: number): [control: string, end: string] {
  return [`${(OUT_X + reach / 2).toFixed(1)} ${y0.toFixed(1)}`, `${(OUT_X + reach).toFixed(1)} ${CHANNEL_Y}`];
}

/**
 * The jet for a pipe running `fill` full (0–1): water fills the bore from the bottom, and the faster
 * it runs the further it throws. Its top layer carries further than its bottom, so it spreads as it falls.
 */
function jetShape(fill: number): JetShape {
  const depth = Math.max(2, fill * 2 * BORE_R);
  const bottom = PIPE_Y + BORE_R;
  const top = bottom - depth;
  const reachTop = 24 + 150 * Math.sqrt(fill);
  const reachBottom = 8 + 72 * fill;
  const [topControl, topEnd] = arc(top, reachTop);
  const [bottomControl] = arc(bottom, reachBottom);
  const [centreControl, centreEnd] = arc((top + bottom) / 2, (reachTop + reachBottom) / 2);
  return {
    body:
      `M ${OUT_X} ${top.toFixed(1)} Q ${topControl} ${topEnd} ` +
      `L ${(OUT_X + reachBottom).toFixed(1)} ${CHANNEL_Y} Q ${bottomControl} ${OUT_X} ${bottom} Z`,
    centre: `M ${OUT_X} ${((top + bottom) / 2).toFixed(1)} Q ${centreControl} ${centreEnd}`,
    streakWidth: Math.max(1, depth * 0.3),
    landX: OUT_X + (reachTop + reachBottom) / 2,
  };
}

const DRY_JET = jetShape(0);

/**
 * The channel's surface as a polyline, with waves running out both ways from where the jet lands at `landX`.
 * They die away with distance, and flatten right under the jet so it always meets the water.
 */
function waveSurface(landX: number, amplitude: number, phase: number): string {
  const points: string[] = [];
  for (let x = CHANNEL_LEFT; x <= SVG_W; x += WAVE.step) {
    const d = Math.abs(x - landX);
    const envelope = amplitude * Math.exp(-d / WAVE.decay) * (1 - Math.exp(-d / WAVE.calm));
    const y = CHANNEL_Y - envelope * Math.sin((2 * Math.PI * d) / WAVE.length - phase);
    points.push(`${x} ${y.toFixed(2)}`);
  }
  return points.join(" L ");
}

const FLAT_SURFACE = waveSurface(0, 0, 0);
const CHANNEL_FLOOR = `L ${SVG_W} ${CHANNEL_Y + 14} L ${CHANNEL_LEFT} ${CHANNEL_Y + 14} Z`;

const SPOKES_PATH = Array.from({ length: SPOKES }, (_, i) => {
  const a = (i * Math.PI) / SPOKES;
  const [x, y] = [RIM_R * Math.cos(a), RIM_R * Math.sin(a)];
  return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${(-x).toFixed(1)} ${(-y).toFixed(1)}`;
}).join(" ");

/**
 * A discharge scene for a flow monitor: water leaves the end of a pipe and arcs over a paddle wheel
 * into a channel below. The jet fills more of the pipe's bore and throws further as flow rises, and the
 * wheel turns in proportion to the flow, so the rate reads at a glance before the number does.
 */
export function DischargeFlowGauge({ flowRate, fullScale }: DischargeFlowGaugeProps) {
  const uid = useId();
  const pipeShadeId = `${uid}-pipe`;
  const waterShadeId = `${uid}-water`;

  const known = flowRate !== null;
  const flowing = known && flowRate > 0;
  const share = flowing ? Math.max(MIN_VISIBLE, Math.min(1, flowRate / fullScale)) : 0;

  // The scene is redrawn every frame from these, outside React, so a reading eases in rather than jumping.
  const target = useRef(share);
  const jetRef = useRef<SVGPathElement>(null);
  const streakRef = useRef<SVGPathElement>(null);
  const wheelRef = useRef<SVGGElement>(null);
  const splashRef = useRef<SVGGElement>(null);
  const channelRef = useRef<SVGPathElement>(null);
  const surfaceRef = useRef<SVGPathElement>(null);
  const meterRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    target.current = share;
  }, [share]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let fill = 0;
    let angle = 0;
    let streakOffset = 0;
    let wavePhase = 0;
    let landX = DRY_JET.landX;
    let shownFill = -1;
    let last = performance.now();

    const draw = () => {
      wheelRef.current?.setAttribute("transform", `translate(${WHEEL.x} ${WHEEL.y}) rotate(${angle.toFixed(2)})`);
      streakRef.current?.setAttribute("stroke-dashoffset", streakOffset.toFixed(1));
      // The jet's outline only changes with the flow, so it is rebuilt only then.
      if (Math.abs(fill - shownFill) >= 0.0005) {
        shownFill = fill;
        const jet = jetShape(fill);
        const visible = fill > 0.005 ? "1" : "0";
        landX = jet.landX;
        jetRef.current?.setAttribute("d", jet.body);
        jetRef.current?.setAttribute("opacity", visible);
        streakRef.current?.setAttribute("d", jet.centre);
        streakRef.current?.setAttribute("stroke-width", jet.streakWidth.toFixed(1));
        streakRef.current?.setAttribute("opacity", visible);
        splashRef.current?.setAttribute("transform", `translate(${landX.toFixed(1)} ${CHANNEL_Y})`);
        meterRef.current?.setAttribute("width", ((METER.right - METER.left) * fill).toFixed(1));
      }
      if (reduced) return;
      const height = fill > 0.005 ? WAVE.minHeight + (WAVE.maxHeight - WAVE.minHeight) * fill : 0;
      const surface = waveSurface(landX, height, wavePhase);
      surfaceRef.current?.setAttribute("d", `M ${surface}`);
      channelRef.current?.setAttribute("d", `M ${surface} ${CHANNEL_FLOOR}`);
    };

    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (reduced) {
        fill = target.current;
      } else {
        fill += (target.current - fill) * (1 - Math.exp(-EASE_RATE * dt));
        if (Math.abs(target.current - fill) < 0.001) fill = target.current;
        angle = (angle + fill * MAX_SPIN_DEG_PER_S * dt) % 360;
        streakOffset -= (STREAK_SPEED.min + (STREAK_SPEED.max - STREAK_SPEED.min) * fill) * dt;
        wavePhase = (wavePhase + WAVE.speed * dt) % (2 * Math.PI);
      }
      draw();
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const earthPath = `M 0 ${GROUND_Y} H ${CHANNEL_LEFT} V ${CHANNEL_Y + 14} H ${SVG_W} V ${EARTH_BOTTOM} H 0 Z`;
  const percent = Math.round(Math.min(1, known ? flowRate / fullScale : 0) * 100);

  return (
    <div className="flex flex-col items-center">
      <svg
        width="100%"
        viewBox={`0 ${VIEW_TOP} ${SVG_W} ${SVG_H - VIEW_TOP}`}
        style={{ maxWidth: SVG_W * 1.4 }}
        className={flowing ? "dwf" : "dwf dwf-dry"}
        role="img"
        aria-label={
          known ? `Flow ${flowRate.toFixed(1)} gallons per minute, ${percent}% of full scale` : "No flow reading yet"
        }
      >
        <defs>
          <linearGradient id={pipeShadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.28} />
            <stop offset="35%" stopColor="#ffffff" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.3} />
          </linearGradient>
          <linearGradient id={waterShadeId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--dwf-water)" }} stopOpacity={0.95} />
            <stop offset="100%" style={{ stopColor: "var(--dwf-water-deep)" }} stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <style>{SCENE_CSS}</style>

        {/* Ground, with the channel the water runs away in. */}
        <path d={earthPath} style={{ fill: "var(--dwf-earth)" }} />
        <path
          ref={channelRef}
          d={`M ${FLAT_SURFACE} ${CHANNEL_FLOOR}`}
          style={{ fill: "var(--dwf-water-deep)" }}
          opacity={0.55}
        />
        <path
          d={`M 0 ${GROUND_Y} H ${CHANNEL_LEFT} V ${CHANNEL_Y + 14} H ${SVG_W}`}
          fill="none"
          style={{ stroke: "var(--dwf-earth-edge)" }}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          ref={surfaceRef}
          d={`M ${FLAT_SURFACE}`}
          fill="none"
          style={{ stroke: "var(--dwf-water)" }}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Stands for the pipe and the wheel's axle. */}
        <path
          d={`M ${PIPE_STAND_X} ${PIPE_Y + PIPE_R} V ${GROUND_Y}`}
          style={{ stroke: "var(--dwf-steel)" }}
          strokeWidth={5}
        />
        <path
          d={`M ${PIPE_STAND_X - 12} ${GROUND_Y} H ${PIPE_STAND_X + 12}`}
          style={{ stroke: "var(--dwf-steel)" }}
          strokeWidth={3}
        />
        <path
          d={`M ${OUT_X - FLANGE_W / 2} ${PIPE_Y + FLANGE_R - 2} L ${WHEEL.x} ${WHEEL.y}`}
          style={{ stroke: "var(--dwf-steel)" }}
          strokeWidth={5}
          strokeLinecap="round"
        />

        {/* The jet, behind the wheel so it pours over and round the paddles. */}
        <path
          ref={jetRef}
          d={DRY_JET.body}
          opacity={0}
          fill={`url(#${waterShadeId})`}
          style={{ stroke: "var(--dwf-water-edge)" }}
          strokeWidth={0.75}
          strokeOpacity={0.6}
        />
        <path
          ref={streakRef}
          d={DRY_JET.centre}
          opacity={0}
          fill="none"
          style={{ stroke: "var(--dwf-streak)" }}
          strokeOpacity={0.7}
          strokeLinecap="round"
          strokeDasharray="6 16"
        />

        {/* Where it lands, ripples spread across the channel. */}
        <g ref={splashRef} transform={`translate(${DRY_JET.landX} ${CHANNEL_Y})`}>
          {[0, 0.45, 0.9].map((delay) => (
            <ellipse
              key={delay}
              className="dwf-ripple"
              rx={18}
              ry={3}
              fill="none"
              style={{ stroke: "var(--dwf-streak)", animationDelay: `${delay}s` }}
              strokeWidth={1.2}
            />
          ))}
        </g>

        <g ref={wheelRef} transform={`translate(${WHEEL.x} ${WHEEL.y})`}>
          {/* A water wheel: paddles between two rims, on spokes from the hub. */}
          <circle r={RIM_R} style={{ fill: "var(--dwf-wheel)" }} opacity={0.18} />
          {Array.from({ length: PADDLES }, (_, i) => (
            <rect
              key={i}
              x={-3.5}
              y={-TIP_R - 1}
              width={7}
              height={TIP_R + 1 - RIM_R}
              rx={1}
              transform={`rotate(${(i * 360) / PADDLES})`}
              style={{ fill: "var(--dwf-wheel)", stroke: "var(--dwf-paddle)" }}
              strokeWidth={1}
            />
          ))}
          <circle r={TIP_R - 1} fill="none" style={{ stroke: "var(--dwf-paddle)" }} strokeWidth={1.5} />
          <circle r={RIM_R} fill="none" style={{ stroke: "var(--dwf-paddle)" }} strokeWidth={2.5} />
          <path d={SPOKES_PATH} style={{ stroke: "var(--dwf-paddle)" }} strokeWidth={2} />
          <circle r={HUB_R} style={{ fill: "var(--dwf-wheel)", stroke: "var(--dwf-paddle)" }} strokeWidth={1.5} />
          <circle r={2.5} style={{ fill: "var(--dwf-axle)" }} />
        </g>

        {/* Spray thrown off the paddles where the jet strikes them. */}
        <g transform={`translate(${WHEEL.x} ${WHEEL.y})`}>
          {SPRAY.map((drop, i) => (
            <circle
              key={i}
              className="dwf-spray"
              cx={drop.x}
              cy={drop.y}
              r={1.6}
              style={
                {
                  fill: "var(--dwf-water)",
                  animationDelay: `${drop.delay}s`,
                  "--dx": `${drop.dx}px`,
                  "--dy": `${drop.dy}px`,
                } as CSSProperties
              }
            />
          ))}
        </g>

        {/* The pipe, in front of the jet's root so the water leaves its bore. */}
        <rect
          x={-4}
          y={PIPE_Y - PIPE_R}
          width={OUT_X - FLANGE_W + 4}
          height={PIPE_R * 2}
          style={{ fill: "var(--dwf-pipe)", stroke: "var(--dwf-pipe-edge)" }}
          strokeWidth={1.5}
        />
        <rect
          x={-4}
          y={PIPE_Y - PIPE_R}
          width={OUT_X - FLANGE_W + 4}
          height={PIPE_R * 2}
          fill={`url(#${pipeShadeId})`}
        />
        <rect
          x={OUT_X - FLANGE_W}
          y={PIPE_Y - FLANGE_R}
          width={FLANGE_W}
          height={FLANGE_R * 2}
          rx={2}
          style={{ fill: "var(--dwf-pipe)", stroke: "var(--dwf-pipe-edge)" }}
          strokeWidth={1.5}
        />
        <rect
          x={OUT_X - FLANGE_W}
          y={PIPE_Y - FLANGE_R}
          width={FLANGE_W}
          height={FLANGE_R * 2}
          rx={2}
          fill={`url(#${pipeShadeId})`}
        />
        {[-1, 1].map((side) => (
          <circle
            key={side}
            cx={OUT_X - FLANGE_W / 2}
            cy={PIPE_Y + side * (FLANGE_R - 5)}
            r={1.8}
            style={{ fill: "var(--dwf-pipe-edge)" }}
          />
        ))}
        <rect
          x={OUT_X - 1.5}
          y={PIPE_Y - BORE_R}
          width={3}
          height={BORE_R * 2}
          rx={1.5}
          style={{ fill: "var(--dwf-bore)" }}
        />

        {/* Reading, and how much of full scale it is. */}
        <rect
          x={SVG_W / 2 - 80}
          y={BADGE_TOP}
          width={160}
          height={24}
          rx={3}
          fill={BADGE_FILL}
          opacity={flowing ? 1 : 0.55}
        />
        <text x={SVG_W / 2} y={BADGE_TOP + 17} textAnchor="middle" fontSize={14} fontWeight="700" fill="#ffffff">
          {known ? `${flowRate.toFixed(1)} gal/min` : "—"}
        </text>
        <rect
          x={METER.left}
          y={METER_Y}
          width={METER.right - METER.left}
          height={6}
          rx={3}
          style={{ fill: "var(--dwf-meter-track)" }}
        />
        <rect
          ref={meterRef}
          x={METER.left}
          y={METER_Y}
          width={0}
          height={6}
          rx={3}
          style={{ fill: "var(--dwf-water)" }}
        />
        <text x={METER.left - 8} y={METER_Y + 6} textAnchor="end" fontSize={10} style={{ fill: "var(--dwf-label)" }}>
          0
        </text>
        <text x={METER.right + 8} y={METER_Y + 6} fontSize={10} style={{ fill: "var(--dwf-label)" }}>
          {`${fullScale.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal/min`}
        </text>
      </svg>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {!known ? "Waiting for a flow reading" : flowing ? `Discharging · ${percent}% of full scale` : "No flow"}
      </p>
    </div>
  );
}
