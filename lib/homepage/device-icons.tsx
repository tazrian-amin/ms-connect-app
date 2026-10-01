import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 32 32",
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function FlowMonitorIcon(props: IconProps) {
  return (
    <svg {...base} stroke="#3b5bdb" {...props}>
      <rect x="4" y="9" width="24" height="9" rx="2" />
      <path d="M8 13.5h14m-3-3 3 3-3 3" />
      <path d="M6 23c1.5-1.5 2.5-1.5 4 0s2.5 1.5 4 0 2.5-1.5 4 0 2.5 1.5 4 0 2.5-1.5 4 0" />
    </svg>
  );
}

export function WaterLevelIcon(props: IconProps) {
  return (
    <svg {...base} stroke="#2f9e8f" {...props}>
      <path d="M16 4v10m-4-7 4-3 4 3" />
      <circle cx="16" cy="14" r="1" fill="#2f9e8f" />
      <path d="M5 20c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0 3.5 1.5 5.5 0" />
      <path d="M5 25c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0 3.5 1.5 5.5 0" />
    </svg>
  );
}

export function PumpFloatIcon(props: IconProps) {
  return (
    <svg {...base} stroke="#e8890c" {...props}>
      <path d="M16 3v6m-2.5-3.5h5" />
      <circle cx="16" cy="17" r="6.5" />
      <circle cx="16" cy="17" r="1.75" fill="#e8890c" />
      <path d="M6 28h20" />
    </svg>
  );
}

export function ConveyorScaleIcon(props: IconProps) {
  return (
    <svg {...base} stroke="#7c3aed" {...props}>
      <rect x="11" y="6" width="10" height="8" rx="1" />
      <path d="M8 18h16" />
      <rect x="4" y="21" width="24" height="5" rx="2.5" />
      <circle cx="7.5" cy="23.5" r="0.75" fill="#7c3aed" />
      <circle cx="24.5" cy="23.5" r="0.75" fill="#7c3aed" />
    </svg>
  );
}

export function ConveyorScaleProIcon(props: IconProps) {
  return (
    <svg {...base} stroke="#e03131" {...props}>
      <rect x="7" y="11" width="9" height="8" rx="1" />
      <path d="M16 15l6-7" />
      <circle cx="24" cy="6.5" r="2.5" />
      <rect x="4" y="21" width="24" height="5" rx="2.5" />
      <circle cx="7.5" cy="23.5" r="0.75" fill="#e03131" />
      <circle cx="24.5" cy="23.5" r="0.75" fill="#e03131" />
    </svg>
  );
}

export function BinHeightIcon(props: IconProps) {
  return (
    <svg {...base} stroke="#1c7ed6" {...props}>
      <path d="M9 4v24h14" />
      <path d="M9 9h4M9 14h6M9 19h4M9 24h6" />
      <path d="M21 6v14m-3-11 3-3 3 3m-6 8 3 3 3-3" />
    </svg>
  );
}
